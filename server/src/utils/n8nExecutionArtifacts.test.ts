import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { extractExecutionArtifacts } from './n8nExecutionArtifacts.js';

interface StoredExecution {
  id: number;
  mode?: 'webhook' | 'integrated';
  status: 'running' | 'success' | 'error';
  data: string;
  startedAt?: string;
  stoppedAt?: string | null;
}

const tempDirectories: string[] = [];

function page(table: string, offset: number, markdown: string, hasMore: boolean, nextOffset: number | null) {
  return {
    canonicalVersion: 1,
    kind: 'rows',
    table,
    metric: 'rows',
    offset,
    limit: 1,
    markdown,
    count: 1,
    hasMore,
    nextOffset,
  };
}

function executionData(requestId: string, runs: Array<[string, unknown]>, lastNodeExecuted = 'Gabay Webhook') {
  const runData: Record<string, unknown[]> = {};
  for (const [name, value] of runs) {
    (runData[name] ??= []).push(value);
  }
  return JSON.stringify([
    { resultData: '1', requestId },
    { runData: '2', lastNodeExecuted },
    runData,
  ]);
}

function childData(runs: Array<[string, unknown]>) {
  const runData: Record<string, unknown[]> = {};
  for (const [name, value] of runs) {
    (runData[name] ??= []).push(value);
  }
  return JSON.stringify([
    { resultData: '1' },
    { runData: '2', lastNodeExecuted: 'Format Structured Rows' },
    runData,
  ]);
}

function successfulRun(output: unknown, startTime: number) {
  return {
    startTime,
    executionTime: 1,
    executionStatus: 'success',
    data: { main: [[{ json: output }]] },
  };
}

function runningRun(output: unknown, startTime: number) {
  return {
    startTime,
    executionTime: 1,
    executionStatus: 'running',
    data: { main: [[{ json: output }]] },
  };
}

function createDatabase(executions: StoredExecution[]) {
  const directory = mkdtempSync(join(tmpdir(), 'n8n-artifacts-'));
  tempDirectories.push(directory);
  const dbPath = join(directory, 'database.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE execution_entity (
      id INTEGER PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt TEXT,
      stoppedAt TEXT
    );
    CREATE TABLE execution_data (
      executionId INTEGER NOT NULL,
      data TEXT NOT NULL
    );
  `);
  const insertEntity = db.prepare('INSERT INTO execution_entity (id, mode, status, startedAt, stoppedAt) VALUES (?, ?, ?, ?, ?)');
  const insertData = db.prepare('INSERT INTO execution_data (executionId, data) VALUES (?, ?)');
  for (const execution of executions) {
    insertEntity.run(execution.id, execution.mode ?? 'webhook', execution.status, execution.startedAt ?? null, execution.stoppedAt ?? null);
    insertData.run(execution.id, execution.data);
  }
  db.close();
  return dbPath;
}

function artifacts(executions: StoredExecution[], requestId = 'request-final') {
  return extractExecutionArtifacts({ requestId, dbPath: createDatabase(executions) });
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('extractExecutionArtifacts', () => {
  it('treats LIKE metacharacters as literal request IDs and rejects colliding rows', () => {
    const dbPath = createDatabase([
      {
        id: 1,
        status: 'success',
        data: executionData('request%_final', [
          ['RAG: Analytics', successfulRun(page('submission', 0, 'literal', false, null), 1)],
        ]),
      },
      {
        id: 2,
        status: 'success',
        data: executionData('requestZZfinal', [
          ['RAG: Analytics', successfulRun(page('submission', 0, 'wildcard-collision', false, null), 1)],
        ]),
      },
    ]);
    const prepareSpy = vi.spyOn(DatabaseSync.prototype, 'prepare');

    try {
      const result = extractExecutionArtifacts({ requestId: 'request%_final', dbPath });
      expect(result.structured?.pages[0].markdown).toBe('literal');
      expect(String(prepareSpy.mock.calls[0][0])).toContain("ESCAPE '!'");
    } finally {
      prepareSpy.mockRestore();
    }
  });

  it('rejects request substring and superset collisions', () => {
    const result = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final-extra', [
            ['RAG: Analytics', successfulRun(page('submission', 0, 'superset', false, null), 1)],
          ]),
        },
      ]),
    });

    expect(result).toEqual({ execution: null, structured: null, structuredError: 'main_not_found' });
  });

  it('prefers the latest finished main over an older running main when no request ID is supplied', () => {
    const result = extractExecutionArtifacts({
      dbPath: createDatabase([
        {
          id: 1,
          status: 'running',
          data: executionData('older-running', [
            ['RAG: Analytics', successfulRun(page('submission', 0, 'running', false, null), 1)],
          ]),
        },
        {
          id: 2,
          status: 'success',
          data: executionData('latest-success', [
            ['RAG: Analytics', successfulRun(page('submission', 0, 'finished', false, null), 1)],
          ]),
        },
      ]),
    });

    expect(result.execution).toMatchObject({ executionId: 2, status: 'success' });
    expect(result.structured?.pages[0]).toMatchObject({ executionId: 2, markdown: 'finished' });
  });

  it('rejects formatter pages from error and running main executions even with child data', () => {
    for (const status of ['error', 'running'] as const) {
      const result = extractExecutionArtifacts({
        requestId: 'request-final',
        dbPath: createDatabase([
          {
            id: 1,
            status,
            data: executionData('request-final', [
              ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 2 } } }, 1)],
              ['Format Structured Rows', successfulRun(page('submission', 0, 'stale-main', false, null), 2)],
            ]),
          },
          {
            id: 2,
            mode: 'integrated',
            status: 'success',
            data: childData([
              ['Format Structured Rows', successfulRun(page('submission', 0, 'child', false, null), 3)],
            ]),
          },
        ]),
      });

      expect(result.structured).toBeNull();
      expect(result.structuredError).toBe('invalid_artifact');
    }
  });  it('returns telemetry and a parent Analytics artifact from the same database read', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['Gabay Webhook', successfulRun({ requestId: 'request-final' }, 1)],
          ['RAG: Analytics', successfulRun(page('submission', 0, '| id |\n| --- |\n| 1 |', false, null), 2)],
        ]),
      },
    ]);

    expect(result.execution).toMatchObject({ executionId: 1, status: 'success' });
    expect(result.structured).toEqual({
      kind: 'rows',
      version: 1,
      table: 'submission',
      complete: true,
      pages: [
        {
          table: 'submission',
          offset: 0,
          markdown: '| id |\n| --- |\n| 1 |',
          count: 1,
          hasMore: false,
          nextOffset: null,
          executionId: 1,
        },
      ],
    });
  });

  it('follows a successful Analytics child when the parent has no output', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['Gabay Webhook', successfulRun({ requestId: 'request-final' }, 1)],
          ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['RAG: Analytics', successfulRun({}, 3)],
          ['Format Structured Rows', successfulRun(page('course_grade', 0, '| grade |\n| --- |\n| A |', false, null), 4)],
        ]),
      },
    ]);

    expect(result.structured?.pages[0]).toMatchObject({ executionId: 2, table: 'course_grade', offset: 0 });
  });

  it('follows a successful child when the parent execution is still running', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'running',
        data: executionData('request-final', [
          ['Gabay Webhook', runningRun({ requestId: 'request-final' }, 1)],
          ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('user_directory', 0, '| name |\n| --- |\n| Ana |', false, null), 4)],
        ]),
      },
    ]);

    expect(result.execution).toMatchObject({ executionId: 1, status: 'running' });
    expect(result.structured).toBeNull();
    expect(result.structuredError).toBe('invalid_artifact');
  });

  it('does not accept a page from a running parent when a successful child exists', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'running',
        data: executionData('request-final', [
          ['RAG: Analytics', successfulRun({
            ...page('submission', 0, 'stale', false, null),
            metadata: { subExecution: { executionId: 2 } },
          }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('submission', 0, 'final', false, null), 4)],
        ]),
      },
    ]);

    expect(result.structured).toBeNull();
    expect(result.structuredError).toBe('invalid_artifact');
  });

  it('orders pages by numeric offset and preserves duplicate rows', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('submission', 10, '| id |\n| --- |\n| dup |', false, null), 3)],
          ['Format Structured Rows', successfulRun(page('submission', 0, '| id |\n| --- |\n| dup |', true, 10), 2)],
        ]),
      },
    ]);

    expect(result.structured).toMatchObject({
      table: 'submission',
      complete: false,
      pages: [
        { offset: 0, markdown: '| id |\n| --- |\n| dup |', hasMore: true, nextOffset: 10 },
        { offset: 10, markdown: '| id |\n| --- |\n| dup |', hasMore: false, nextOffset: null },
      ],
    });
  });

  it('selects the final Analytics chain and ignores an earlier unrelated call', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 3 } } }, 5)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('submission', 0, 'old', false, null), 3)],
        ]),
      },
      {
        id: 3,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('submission', 0, 'final', false, null), 6)],
        ]),
      },
    ]);

    expect(result.structured?.pages[0].markdown).toBe('final');
  });

  it('uses one SQLite connection and bounded main and integrated-child queries', () => {
    const dbPath = createDatabase([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'success',
        data: childData([
          ['Format Structured Rows', successfulRun(page('submission', 0, '| id |\\n| --- |\\n| 1 |', false, null), 3)],
        ]),
      },
    ]);
    const prepareSpy = vi.spyOn(DatabaseSync.prototype, 'prepare');
    const closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');

    try {
      const result = extractExecutionArtifacts({ requestId: 'request-final', dbPath });
      const queries = prepareSpy.mock.calls.map(([sql]) => String(sql));

      expect(result.structured?.pages[0]).toMatchObject({ executionId: 2, table: 'submission' });
      expect(prepareSpy).toHaveBeenCalledTimes(2);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(queries[0]).toContain("e.mode = 'webhook'");
      expect(queries[0]).toMatch(/LIMIT/i);
      expect(queries[1]).not.toContain("e.mode = 'webhook'");
      expect(queries[1]).toMatch(/LIMIT/i);
    } finally {
      prepareSpy.mockRestore();
      closeSpy.mockRestore();
    }
  });

  it('uses requestId as authoritative and does not fall back to sessionId on a request miss', () => {
    const dbPath = createDatabase([
      {
        id: 1,
        status: 'success',
        data: executionData('session-match', [
          ['RAG: Analytics', successfulRun(page('submission', 0, 'wrong-request', false, null), 2)],
        ]),
      },
    ]);

    const result = extractExecutionArtifacts({ requestId: 'request-miss', sessionId: 'session-match', dbPath });

    expect(result).toEqual({ execution: null, structured: null, structuredError: 'main_not_found' });
  });

  it('uses sessionId only when requestId is absent', () => {
    const result = extractExecutionArtifacts({
      sessionId: 'session-only',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('session-only', [
            ['RAG: Analytics', successfulRun(page('submission', 0, 'session-result', false, null), 2)],
          ]),
        },
      ]),
    });

    expect(result.execution).toMatchObject({ executionId: 1 });
    expect(result.structured?.pages[0].markdown).toBe('session-result');
    expect(result.structuredError).toBeUndefined();
  });

  it('follows nested integrated child executions and stops safely on cycles', () => {
    const nested = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ]),
        },
        {
          id: 2,
          mode: 'integrated',
          status: 'success',
          data: childData([
            ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 3 } } }, 3)],
          ]),
        },
        {
          id: 3,
          mode: 'integrated',
          status: 'success',
          data: childData([
            ['Format Structured Rows', successfulRun(page('submission', 0, 'nested-result', false, null), 4)],
          ]),
        },
      ]),
    });
    expect(nested.structured?.pages[0]).toMatchObject({ executionId: 3, markdown: 'nested-result' });

    const cycle = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ]),
        },
        {
          id: 2,
          mode: 'integrated',
          status: 'success',
          data: childData([
            ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 3 } } }, 3)],
          ]),
        },
        {
          id: 3,
          mode: 'integrated',
          status: 'success',
          data: childData([
            ['RAG: Analytics', successfulRun({ metadata: { subExecution: { executionId: 2 } } }, 4)],
          ]),
        },
      ]),
    });
    expect(cycle.structured).toBeNull();
    expect(cycle.structuredError).toBe('invalid_artifact');
  });

  it('returns child status errors instead of accepting error or running child pages', () => {
    const error = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ]),
        },
        {
          id: 2,
          mode: 'integrated',
          status: 'error',
          data: childData([
            ['Format Structured Rows', successfulRun(page('submission', 0, 'must-not-pass', false, null), 3)],
          ]),
        },
      ]),
    });
    expect(error.structured).toBeNull();
    expect(error.structuredError).toBe('child_not_successful');

    const running = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ]),
        },
        {
          id: 2,
          mode: 'integrated',
          status: 'running',
          data: childData([
            ['Format Structured Rows', successfulRun(page('submission', 0, 'must-not-pass', false, null), 3)],
          ]),
        },
      ]),
    });
    expect(running.structured).toBeNull();
    expect(running.structuredError).toBe('child_not_successful');
  });

  it('returns child_not_found for a genuinely missing child', () => {
    const result = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 99 } } }, 2)],
          ]),
        },
      ]),
    });

    expect(result.structured).toBeNull();
    expect(result.structuredError).toBe('child_not_found');
  });

  it('returns invalid_artifact for a corrupt successful child', () => {
    const result = extractExecutionArtifacts({
      requestId: 'request-final',
      dbPath: createDatabase([
        {
          id: 1,
          status: 'success',
          data: executionData('request-final', [
            ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
          ]),
        },
        {
          id: 2,
          mode: 'integrated',
          status: 'success',
          data: '{not-json',
        },
      ]),
    });

    expect(result.structured).toBeNull();
    expect(result.structuredError).toBe('invalid_artifact');
  });

  it('returns telemetry but no structured artifact when the child is missing or corrupt', () => {
    const result = artifacts([
      {
        id: 1,
        status: 'running',
        data: executionData('request-final', [
          ['RAG: Analytics', runningRun({ metadata: { subExecution: { executionId: 2 } } }, 2)],
        ]),
      },
      {
        id: 2,
        mode: 'integrated',
        status: 'error',
        data: '{not-json',
      },
    ]);

    expect(result.execution).toMatchObject({ executionId: 1, status: 'running' });
    expect(result.structured).toBeNull();
    expect(result.structuredError).toBe('invalid_artifact');
  });

  it('fails safely when the SQLite database cannot be opened', () => {
    expect(extractExecutionArtifacts({ dbPath: join(tmpdir(), 'missing-n8n-artifacts.sqlite'), requestId: 'request-final' })).toEqual({
      execution: null,
      structured: null,
    });
  });

  it('retries a transient SQLite lock on the same connection and recovers', () => {
    const dbPath = createDatabase([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['RAG: Analytics', successfulRun(page('submission', 0, 'recovered', false, null), 1)],
        ]),
      },
    ]);
    const realPrepare = DatabaseSync.prototype.prepare;
    let calls = 0;
    const prepareSpy = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(
      function (this: DatabaseSync, sql: string) {
        calls += 1;
        if (calls === 1) {
          const locked = new Error('database is locked') as Error & { code?: string };
          locked.code = 'ERR_SQLITE_BUSY';
          throw locked;
        }
        return realPrepare.call(this, sql);
      },
    );
    const closeSpy = vi.spyOn(DatabaseSync.prototype, 'close');

    try {
      const result = extractExecutionArtifacts({ requestId: 'request-final', dbPath });
      expect(result.structured?.pages[0].markdown).toBe('recovered');
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      prepareSpy.mockRestore();
      closeSpy.mockRestore();
    }
  });

  it('reports telemetry_locked when the lock persists through every retry', () => {
    const dbPath = createDatabase([
      {
        id: 1,
        status: 'success',
        data: executionData('request-final', [
          ['RAG: Analytics', successfulRun(page('submission', 0, 'never-seen', false, null), 1)],
        ]),
      },
    ]);
    const prepareSpy = vi.spyOn(DatabaseSync.prototype, 'prepare').mockImplementation(() => {
      throw new Error('database is locked');
    });

    try {
      const result = extractExecutionArtifacts({ requestId: 'request-final', dbPath });
      expect(result).toEqual({ execution: null, structured: null, structuredError: 'telemetry_locked' });
    } finally {
      prepareSpy.mockRestore();
    }
  });
});
