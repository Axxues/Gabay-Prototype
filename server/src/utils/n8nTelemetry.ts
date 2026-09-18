import { DatabaseSync } from 'node:sqlite';

export interface TelemetryTask {
  id: string;
  label: string;
  durationMs: number;
  startTime?: number;
  status: 'completed' | 'failed' | 'running' | 'pending';
  nodeType:
    | 'webhook'
    | 'code'
    | 'wait'
    | 'agent'
    | 'model'
    | 'memory'
    | 'vectorStore'
    | 'embeddings'
    | 'default';
  depth: number;
  parent?: string | null;
  runsCount?: number;
  error?: string | null;
}

export interface TelemetryExecution {
  executionId: number;
  status: 'running' | 'success' | 'error';
  activeNode?: string | null;
  totalDurationMs: number;
  totalTokens?: number;
  tasks: TelemetryTask[];
  isError?: boolean;
}

function getNodeType(name: string): TelemetryTask['nodeType'] {
  const n = name.toLowerCase();
  if (n.includes('webhook')) return 'webhook';
  if (n.includes('normalize') || n.includes('code')) return 'code';
  if (n.includes('wait')) return 'wait';
  if (n.includes('agent')) return 'agent';
  if (n.includes('memory')) return 'memory';
  if (n.includes('model') || n.includes('openai') || n.includes('groq')) return 'model';
  if (n.includes('rag') || n.includes('vector')) return 'vectorStore';
  if (n.includes('embedding')) return 'embeddings';
  return 'default';
}

function dereference(ref: unknown, data: unknown[]): unknown {
  if (typeof ref === 'string' && /^\d+$/.test(ref)) {
    const idx = parseInt(ref, 10);
    if (idx >= 0 && idx < data.length) {
      return dereference(data[idx], data);
    }
  } else if (Array.isArray(ref)) {
    return ref.map((item) => dereference(item, data));
  } else if (ref && typeof ref === 'object') {
    const obj = ref as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = dereference(v, data);
    }
    return res;
  }
  return ref;
}

export function extractExecutionTelemetry(opts: {
  requestId?: string;
  sessionId?: string;
  dbPath?: string;
  allowRunning?: boolean;
}): TelemetryExecution | null {
  const dbPath = opts.dbPath || process.env.N8N_SQLITE_PATH || 'C:/Users/JV/n8n_data/database.sqlite';

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });

    const rows = db
      .prepare(
        `SELECT e.id, e.status, e.startedAt, e.stoppedAt, d.data
         FROM execution_entity e
         JOIN execution_data d ON e.id = d.executionId
         WHERE e.mode = 'webhook'
         ORDER BY e.id DESC
         LIMIT 10`
      )
      .all() as Array<{
      id: number;
      status: string;
      startedAt: string | null;
      stoppedAt: string | null;
      data: string;
    }>;

    const finishedRows = rows.filter((r) => r.status === 'success' || r.status === 'error');
    const runningRows = rows.filter((r) => r.status === 'running');

    let candidates: typeof rows;
    if (opts.allowRunning) {
      candidates = runningRows.length > 0 ? runningRows : (finishedRows.length > 0 ? finishedRows : rows);
    } else {
      candidates = finishedRows.length > 0 ? finishedRows : rows;
    }

    let targetRow: (typeof rows)[0] | null = null;

    if (opts.requestId) {
      for (const row of rows) {
        if (row.data.includes(opts.requestId)) {
          if (opts.allowRunning || row.status === 'success' || row.status === 'error') {
            targetRow = row;
            break;
          }
        }
      }
    }

    if (!targetRow && opts.sessionId) {
      for (const row of rows) {
        if (row.data.includes(opts.sessionId)) {
          if (opts.allowRunning || row.status === 'success' || row.status === 'error') {
            targetRow = row;
            break;
          }
        }
      }
    }

    // Only fall back to latest candidate if neither requestId nor sessionId was specified
    if (!targetRow && !opts.requestId && !opts.sessionId && candidates.length > 0) {
      targetRow = candidates[0];
    }

    if (!targetRow) return null;

    const rawData = JSON.parse(targetRow.data) as unknown[];
    if (!Array.isArray(rawData) || rawData.length === 0) return null;

    const root = (rawData[0] ?? {}) as Record<string, unknown>;
    const resultRef = root.resultData;
    const resultData =
      typeof resultRef === 'string' && /^\d+$/.test(resultRef)
        ? (rawData[parseInt(resultRef, 10)] as Record<string, unknown>)
        : null;

    if (!resultData) return null;

    const lastNodeRef = resultData.lastNodeExecuted;
    const lastNodeName =
      typeof lastNodeRef === 'string' && /^\d+$/.test(lastNodeRef)
        ? String(rawData[parseInt(lastNodeRef, 10)] ?? '')
        : typeof lastNodeRef === 'string'
        ? lastNodeRef
        : null;

    const runRef = resultData.runData;
    const runData =
      typeof runRef === 'string' && /^\d+$/.test(runRef)
        ? (rawData[parseInt(runRef, 10)] as Record<string, unknown>)
        : null;

    if (!runData) return null;

    let totalTokens: number | undefined = undefined;
    for (const item of rawData) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (typeof obj['llm.tokens.total'] === 'number') {
          totalTokens = Math.max(totalTokens ?? 0, obj['llm.tokens.total'] as number);
        }
      }
    }

    interface NodeGroup {
      name: string;
      parent: string | null;
      startTime: number;
      executionTime: number;
      runsCount: number;
      status: 'completed' | 'failed' | 'running' | 'pending';
      error?: string | null;
    }

    const grouped: Record<string, NodeGroup> = {};

    for (const [nodeName, runListRef] of Object.entries(runData)) {
      const runs = dereference(runListRef, rawData) as Array<Record<string, unknown>>;
      if (!Array.isArray(runs)) continue;

      for (const r of runs) {
        if (!r || typeof r !== 'object') continue;
        const sources = Array.isArray(r.source) ? (r.source as Array<Record<string, unknown>>) : [];
        const parent = typeof sources[0]?.previousNode === 'string' ? sources[0].previousNode : null;
        const key = `${nodeName}:::${parent ?? ''}`;

        const rStart = typeof r.startTime === 'number' ? r.startTime : 0;
        const rTime = typeof r.executionTime === 'number' ? r.executionTime : 0;
        const isErr = r.executionStatus === 'error' || Boolean(r.error);

        if (!grouped[key]) {
          grouped[key] = {
            name: nodeName,
            parent,
            startTime: rStart,
            executionTime: 0,
            runsCount: 0,
            status: 'completed',
            error: null,
          };
        }

        grouped[key].executionTime += rTime;
        grouped[key].runsCount += 1;
        if (rStart > 0 && (grouped[key].startTime === 0 || rStart < grouped[key].startTime)) {
          grouped[key].startTime = rStart;
        }
        if (isErr) {
          grouped[key].status = 'failed';
          grouped[key].error = typeof r.error === 'string' ? r.error : JSON.stringify(r.error ?? 'Node error');
        }
      }
    }

    const nodesList = Object.values(grouped);
    nodesList.sort((a, b) => a.startTime - b.startTime);

    const tasks: TelemetryTask[] = [];

    function addChildren(parentName: string, depth: number) {
      const children = nodesList.filter((n) => n.parent === parentName && n.name !== 'Coordinator_Agent');
      children.sort((a, b) => a.startTime - b.startTime);
      for (const c of children) {
        tasks.push({
          id: `task-${tasks.length}`,
          label: c.name,
          durationMs: c.executionTime,
          startTime: c.startTime,
          status: c.status,
          nodeType: getNodeType(c.name),
          depth,
          parent: c.parent,
          runsCount: c.runsCount,
          error: c.error,
        });
        addChildren(c.name, depth + 1);
      }
    }

    const rootNodes = nodesList.filter((n) =>
      !n.parent || ['Gabay Webhook', 'Normalize Input', 'Rate Limit Wait'].includes(n.parent)
    );
    rootNodes.sort((a, b) => a.startTime - b.startTime);

    for (const r of rootNodes) {
      tasks.push({
        id: `task-${tasks.length}`,
        label: r.name,
        durationMs: r.executionTime,
        startTime: r.startTime,
        status: r.status,
        nodeType: getNodeType(r.name),
        depth: 0,
        parent: r.parent,
        runsCount: r.runsCount,
        error: r.error,
      });
      if (r.name === 'Coordinator_Agent') {
        addChildren('Coordinator_Agent', 1);
      }
    }

    const isRunning = targetRow.status === 'running';

    // If currently running, mark the active node as 'running'
    if (isRunning) {
      const targetActiveNode = lastNodeName || (tasks.length > 0 ? tasks[tasks.length - 1].label : null);
      if (targetActiveNode) {
        const found = tasks.find((t) => t.label === targetActiveNode);
        if (found) {
          found.status = 'running';
        } else {
          tasks.push({
            id: `task-${tasks.length}`,
            label: targetActiveNode,
            durationMs: 0,
            startTime: Date.now(),
            status: 'running',
            nodeType: getNodeType(targetActiveNode),
            depth: targetActiveNode === 'Coordinator_Agent' ? 0 : 1,
            runsCount: 1,
          });
        }
      }
    }

    const totalDurationMs = tasks
      .filter((t) => t.depth === 0)
      .reduce((sum, t) => sum + t.durationMs, 0);

    const executionStatus: 'running' | 'success' | 'error' =
      targetRow.status === 'running'
        ? 'running'
        : targetRow.status === 'error' || tasks.some((t) => t.status === 'failed')
        ? 'error'
        : 'success';

    return {
      executionId: targetRow.id,
      status: executionStatus,
      activeNode: lastNodeName,
      totalDurationMs,
      totalTokens,
      tasks,
      isError: executionStatus === 'error',
    };
  } catch (err) {
    console.warn('[n8nTelemetry] Failed to extract telemetry:', err);
    return null;
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
        // ignore close error
      }
    }
  }
}
