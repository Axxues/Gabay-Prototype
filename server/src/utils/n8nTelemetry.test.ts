import { describe, it, expect } from 'vitest';
import { extractExecutionTelemetry } from './n8nTelemetry.js';

describe('n8nTelemetry', () => {
  it('returns null gracefully when database file does not exist', () => {
    const result = extractExecutionTelemetry({
      dbPath: 'C:/non_existent_path_to_db/dummy.sqlite',
      sessionId: 'test-session',
    });
    expect(result).toBeNull();
  });

  it('extracts real telemetry from local n8n database if available', () => {
    const result = extractExecutionTelemetry({
      sessionId: 'session-mu367wwu-j2lmbu',
    });

    if (result) {
      expect(result.executionId).toBeGreaterThan(0);
      expect(typeof result.totalDurationMs).toBe('number');
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks.length).toBeGreaterThan(0);

      // Verify node types and depths
      const rootTasks = result.tasks.filter((t) => t.depth === 0);
      expect(rootTasks.length).toBeGreaterThan(0);
      expect(rootTasks[0].label).toBe('Gabay Webhook');

      // Verify task properties
      for (const t of result.tasks) {
        expect(t.id).toBeDefined();
        expect(t.label).toBeDefined();
        expect(typeof t.durationMs).toBe('number');
        expect(typeof t.depth).toBe('number');
        expect(['completed', 'failed']).toContain(t.status);
      }
    }
  });

  it('extracts running execution telemetry with active status when allowRunning is true', () => {
    const result = extractExecutionTelemetry({
      allowRunning: true,
    });

    expect(result).not.toBeNull();
    if (result) {
      expect(result.status).toBeDefined();
      expect(['running', 'success', 'error']).toContain(result.status);
      expect(Array.isArray(result.tasks)).toBe(true);
      for (const t of result.tasks) {
        expect(['completed', 'failed', 'running', 'pending']).toContain(t.status);
      }
    }
  });
});
