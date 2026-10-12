import { DatabaseSync } from 'node:sqlite';
import {
  extractExecutionTelemetry,
  type TelemetryExecution,
  type TelemetryExecutionRow,
} from './n8nTelemetry.js';

export interface CanonicalStructuredPage {
  table: string;
  offset: number;
  markdown: string;
  count: number;
  hasMore: boolean;
  nextOffset: number | null;
  executionId: number;
}

export interface CanonicalStructuredResult {
  kind: 'rows';
  version: 1;
  table: string;
  pages: CanonicalStructuredPage[];
  complete: boolean;
}

export type StructuredError =
  | 'main_not_found'
  | 'child_not_found'
  | 'child_not_successful'
  | 'invalid_artifact'
  | 'telemetry_locked';

export interface N8nExecutionArtifacts {
  execution: TelemetryExecution | null;
  structured: CanonicalStructuredResult | null;
  structuredError?: StructuredError;
}

interface StoredExecution extends TelemetryExecutionRow {
  id: number;
  mode: string;
}

interface Run {
  executionStatus?: unknown;
  error?: unknown;
  startTime?: unknown;
  data?: unknown;
}

interface StructuredExtraction {
  pages: CanonicalStructuredPage[];
  error?: StructuredError;
}

const MAIN_EXECUTION_LIMIT = 10;
const CHILD_BATCH_LIMIT = 50;

function decode(value: unknown, data: unknown[], seen = new Set<number>()): unknown {
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const index = Number(value);
    if (!Number.isSafeInteger(index) || index < 0 || index >= data.length || seen.has(index)) {
      return value;
    }
    const nextSeen = new Set(seen);
    nextSeen.add(index);
    return decode(data[index], data, nextSeen);
  }
  if (Array.isArray(value)) {
    return value.map((item) => decode(item, data, seen));
  }
  if (value && typeof value === 'object') {
    const decoded: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      decoded[key] = decode(item, data, seen);
    }
    return decoded;
  }
  return value;
}

function rawExecution(row: StoredExecution): unknown[] | null {
  try {
    const parsed = JSON.parse(row.data) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodedRunData(raw: unknown[]): Record<string, unknown> | null {
  const root = raw[0];
  if (!root || typeof root !== 'object') return null;
  const resultData = decode((root as Record<string, unknown>).resultData, raw);
  if (!resultData || typeof resultData !== 'object') return null;
  const runData = decode((resultData as Record<string, unknown>).runData, raw);
  return runData && typeof runData === 'object' ? (runData as Record<string, unknown>) : null;
}

function nodeRuns(runData: Record<string, unknown> | null, raw: unknown[], name: string): Run[] {
  if (!runData) return [];
  const value = decode(runData[name], raw);
  if (!Array.isArray(value)) return [];
  return value.filter((run): run is Run => Boolean(run && typeof run === 'object'));
}

function isAnalyticsNode(name: string): boolean {
  return name.toLowerCase() === 'rag: analytics' || name.toLowerCase() === 'rag_analytics';
}

function analyticsRuns(runData: Record<string, unknown> | null, raw: unknown[]): Run[] {
  if (!runData) return [];
  return Object.entries(runData)
    .filter(([name]) => isAnalyticsNode(name))
    .flatMap(([, value]) => {
      const decoded = decode(value, raw);
      if (!Array.isArray(decoded)) return [];
      return decoded.filter((run): run is Run => Boolean(run && typeof run === 'object'));
    });
}

function findSubExecutionId(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSubExecutionId(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  if (object.metadata && typeof object.metadata === 'object') {
    const metadata = object.metadata as Record<string, unknown>;
    const subExecution = metadata.subExecution;
    if (subExecution && typeof subExecution === 'object') {
      const executionId = (subExecution as Record<string, unknown>).executionId;
      if (typeof executionId === 'number' && Number.isSafeInteger(executionId) && executionId > 0) {
        return executionId;
      }
      if (typeof executionId === 'string' && /^\d+$/.test(executionId)) {
        const parsed = Number(executionId);
        if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
      }
    }
  }
  for (const item of Object.values(object)) {
    const found = findSubExecutionId(item);
    if (found !== null) return found;
  }
  return null;
}

function validPage(value: unknown, executionId: number): CanonicalStructuredPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const page = value as Record<string, unknown>;
  if (typeof page.table !== 'string' || page.table.length === 0 || page.metric !== 'rows') return null;
  if (page.kind !== undefined && page.kind !== 'rows') return null;
  if (page.canonicalVersion !== undefined && page.canonicalVersion !== 1) return null;
  if (typeof page.offset !== 'number' || !Number.isFinite(page.offset)) return null;
  if (typeof page.markdown !== 'string') return null;
  if (typeof page.count !== 'number' || !Number.isFinite(page.count)) return null;
  if (typeof page.hasMore !== 'boolean') return null;
  if (page.nextOffset !== null && (typeof page.nextOffset !== 'number' || !Number.isFinite(page.nextOffset))) {
    return null;
  }
  return {
    table: page.table,
    offset: page.offset,
    markdown: page.markdown,
    count: page.count,
    hasMore: page.hasMore,
    nextOffset: page.nextOffset as number | null,
    executionId,
  };
}

function pagesFromValue(value: unknown, executionId: number): CanonicalStructuredPage[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => pagesFromValue(item, executionId));
  }
  if (!value || typeof value !== 'object') return [];
  const page = validPage(value, executionId);
  if (page) return [page];
  return Object.values(value as Record<string, unknown>).flatMap((item) => pagesFromValue(item, executionId));
}

function runTime(run: Run): number {
  return typeof run.startTime === 'number' && Number.isFinite(run.startTime) ? run.startTime : 0;
}

function runSucceeded(run: Run): boolean {
  if (run.error) return false;
  return run.executionStatus === undefined || run.executionStatus === 'success';
}

function lastAnalyticsRun(runData: Record<string, unknown> | null, raw: unknown[]): Run | null {
  const runs = analyticsRuns(runData, raw).sort((a, b) => runTime(a) - runTime(b));
  return runs.length > 0 ? runs[runs.length - 1] : null;
}

function directPages(row: StoredExecution, raw: unknown[]): CanonicalStructuredPage[] {
  if (row.status !== 'success') return [];
  const runData = decodedRunData(raw);
  const analytics = lastAnalyticsRun(runData, raw);
  if (!analytics || !runSucceeded(analytics)) return [];
  return pagesFromValue(analytics.data, row.id);
}

function formatterPages(row: StoredExecution, raw: unknown[]): CanonicalStructuredPage[] {
  if (row.status !== 'success') return [];
  const runData = decodedRunData(raw);
  return nodeRuns(runData, raw, 'Format Structured Rows')
    .filter(runSucceeded)
    .flatMap((run) => pagesFromValue(run.data, row.id));
}

function nextChildId(row: StoredExecution, raw: unknown[]): number | null {
  const runData = decodedRunData(raw);
  const analytics = lastAnalyticsRun(runData, raw);
  return analytics ? findSubExecutionId(analytics) : null;
}

function structuredResult(pages: CanonicalStructuredPage[]): CanonicalStructuredResult | null {
  if (pages.length === 0) return null;
  const ordered = [...pages].sort((a, b) => a.offset - b.offset);
  const complete = ordered.every((page) => !page.hasMore) && ordered[ordered.length - 1].nextOffset === null;
  return {
    kind: 'rows',
    version: 1,
    table: ordered[0].table,
    pages: ordered,
    complete,
  };
}

function containsLiteralIdentity(data: string, identity: string): boolean {
  return data.includes(JSON.stringify(identity));
}

function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, '!$&');
}

function targetExecution(rows: StoredExecution[], requestId?: string, sessionId?: string): StoredExecution | null {
  const identity = requestId ?? sessionId;
  const matching = identity
    ? rows.filter((row) => containsLiteralIdentity(row.data, identity))
    : rows;
  if (requestId) return matching[0] ?? null;
  const finished = matching.filter((row) => row.status === 'success' || row.status === 'error');
  return finished[0] ?? matching[0] ?? null;
}

function mainRows(db: DatabaseSync, requestId?: string, sessionId?: string): StoredExecution[] {
  const identity = requestId ?? sessionId;
  const sql = identity
    ? `SELECT e.id, e.mode, e.status, e.startedAt, e.stoppedAt, d.data
       FROM execution_entity e
       JOIN execution_data d ON e.id = d.executionId
       WHERE e.mode = 'webhook' AND d.data LIKE ? ESCAPE '!'
       ORDER BY e.id DESC
       LIMIT ${MAIN_EXECUTION_LIMIT}`
    : `SELECT e.id, e.mode, e.status, e.startedAt, e.stoppedAt, d.data
       FROM execution_entity e
       JOIN execution_data d ON e.id = d.executionId
       WHERE e.mode = 'webhook'
       ORDER BY e.id DESC
       LIMIT ${MAIN_EXECUTION_LIMIT}`;
  const statement = db.prepare(sql);
  return (identity ? statement.all(`%${escapeLikePattern(identity)}%`) : statement.all()) as unknown as StoredExecution[];
}

function childRows(db: DatabaseSync, ids: number[]): StoredExecution[] {
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (uniqueIds.length === 0) return [];
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const statement = db.prepare(
    `SELECT e.id, e.mode, e.status, e.startedAt, e.stoppedAt, d.data
     FROM execution_entity e
     JOIN execution_data d ON e.id = d.executionId
     WHERE e.id IN (${placeholders})
     ORDER BY e.id DESC
     LIMIT ?`
  );
  return statement.all(...uniqueIds, Math.min(uniqueIds.length, CHILD_BATCH_LIMIT)) as unknown as StoredExecution[];
}

function structuredFromChain(target: StoredExecution, byId: Map<number, StoredExecution>): StructuredExtraction {  if (target.status !== 'success') return { pages: [], error: 'invalid_artifact' };
  const pending: StoredExecution[] = [target];
  const visited = new Set<number>();
  const pages: CanonicalStructuredPage[] = [];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current.id)) {
      if (current && visited.has(current.id)) return { pages: [], error: 'invalid_artifact' };
      continue;
    }
    visited.add(current.id);
    const raw = rawExecution(current);
    if (!raw) return { pages: [], error: 'invalid_artifact' };

    const direct = directPages(current, raw);
    if (direct.length > 0) {
      pages.push(...direct);
      return { pages };
    }

    const formatted = formatterPages(current, raw);
    if (formatted.length > 0) {
      pages.push(...formatted);
      return { pages };
    }

    const childId = nextChildId(current, raw);
    if (childId === null) {
      const hasAnalytics = lastAnalyticsRun(decodedRunData(raw), raw) !== null;
      return hasAnalytics ? { pages: [], error: 'invalid_artifact' } : { pages: [] };
    }
    if (childId === current.id || visited.has(childId)) return { pages: [], error: 'invalid_artifact' };

    const child = byId.get(childId);
    if (!child) return { pages: [], error: 'child_not_found' };
    if (child.status !== 'success') return { pages: [], error: 'child_not_successful' };
    pending.push(child);
  }

  return { pages, error: pages.length > 0 ? undefined : 'invalid_artifact' };
}

function loadReferencedChildren(db: DatabaseSync, target: StoredExecution): Map<number, StoredExecution> {
  const byId = new Map<number, StoredExecution>();
  const pending: StoredExecution[] = [target];
  const visited = new Set<number>();
  const queriedIds = new Set<number>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);
    const raw = rawExecution(current);
    if (!raw) continue;
    const childId = nextChildId(current, raw);
    if (childId === null || childId === current.id || queriedIds.has(childId)) continue;
    queriedIds.add(childId);
    const rows = childRows(db, [childId]);
    for (const row of rows) byId.set(row.id, row);
    for (const row of rows) {
      if (!visited.has(row.id)) pending.push(row);
    }
  }

  return byId;
}

const ARTIFACT_RETRY_ATTEMPTS = 4;
const ARTIFACT_RETRY_DELAY_MS = 150;

function isSqliteLocked(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && /BUSY|LOCKED/i.test(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /database is (locked|busy)|SQLITE_BUSY/i.test(message);
}

function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // ignore sleep interruptions; the next attempt proceeds immediately
  }
}

function attemptExtract(
  db: DatabaseSync,
  opts: { requestId?: string; sessionId?: string; dbPath?: string },
): N8nExecutionArtifacts {
  const rows = mainRows(db, opts.requestId, opts.sessionId);
  const target = targetExecution(rows, opts.requestId, opts.sessionId);
  const execution = extractExecutionTelemetry({
    ...opts,
    allowRunning: Boolean(opts.requestId),
    rows: target ? [target] as unknown as TelemetryExecutionRow[] : [],
  });

  if (!target) return { execution, structured: null, structuredError: 'main_not_found' };

  const raw = rawExecution(target);
  if (!raw) return { execution, structured: null, structuredError: 'invalid_artifact' };

  const byId = loadReferencedChildren(db, target);
  byId.set(target.id, target);
  const extracted = structuredFromChain(target, byId);
  const structured = structuredResult(extracted.pages);
  if (structured) return { execution, structured };
  return extracted.error ? { execution, structured: null, structuredError: extracted.error } : { execution, structured: null };
}

export function extractExecutionArtifacts(opts: {
  requestId?: string;
  sessionId?: string;
  dbPath?: string;
}): N8nExecutionArtifacts {
  const dbPath = opts.dbPath || process.env.N8N_SQLITE_PATH || 'C:/Users/JV/n8n_data/database.sqlite';
  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
  } catch {
    return { execution: null, structured: null };
  }
  // Brief retry on the SAME connection for SQLite lock contention and write
  // lag: a freshly finished n8n execution may not be visible yet
  // (main_not_found), and concurrent n8n writes can raise SQLITE_BUSY.
  // Genuine failures (child errors, corrupt rows) fail fast without waiting.
  try {
    for (let attempt = 0; attempt < ARTIFACT_RETRY_ATTEMPTS; attempt++) {
      try {
        const result = attemptExtract(db, opts);
        if (result.structured) return result;
        if (result.structuredError !== 'main_not_found') return result;
        if (attempt === ARTIFACT_RETRY_ATTEMPTS - 1) return result;
      } catch (error) {
        if (!isSqliteLocked(error)) return { execution: null, structured: null };
        if (attempt === ARTIFACT_RETRY_ATTEMPTS - 1) {
          return { execution: null, structured: null, structuredError: 'telemetry_locked' };
        }
      }
      sleepSync(ARTIFACT_RETRY_DELAY_MS);
    }
    return { execution: null, structured: null, structuredError: 'main_not_found' };
  } finally {
    if (db) {
      try {
        db.close();
      } catch {
      }
    }
  }
}
