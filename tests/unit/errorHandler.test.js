import { describe, it, expect, vi } from 'vitest';
import { logError, withErrorBoundary } from '../../src/backend/utils/errorHandler.js';

// ── logError ────────────────────────────────────────────────────────

describe('logError', () => {
  it('returns structured error entry', () => {
    const entry = logError('test.context', new Error('Something broke'), { silent: true });
    expect(entry.context).toBe('test.context');
    expect(entry.message).toBe('Something broke');
    expect(entry.timestamp).toBeDefined();
    expect(entry.stack).toBeDefined();
  });

  it('handles string errors', () => {
    const entry = logError('test', 'plain string error', { silent: true });
    expect(entry.message).toBe('plain string error');
    expect(entry.stack).toBeUndefined();
  });

  it('handles null/undefined errors', () => {
    const entry = logError('test', null, { silent: true });
    expect(entry.message).toBe('null');
  });

  it('logs to console.error by default', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('myModule', new Error('test error'));
    expect(spy).toHaveBeenCalledWith('[myModule]', 'test error');
    spy.mockRestore();
  });

  it('suppresses console output when silent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('myModule', new Error('test'), { silent: true });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('includes ISO timestamp', () => {
    const entry = logError('test', 'err', { silent: true });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── withErrorBoundary ───────────────────────────────────────────────

describe('withErrorBoundary', () => {
  it('returns function result when no error', async () => {
    const fn = async (x) => x * 2;
    const safe = withErrorBoundary(fn, 'test', 0);
    expect(await safe(5)).toBe(10);
  });

  it('returns fallback value on error', async () => {
    const fn = async () => { throw new Error('boom'); };
    const safe = withErrorBoundary(fn, 'test', { success: false });
    const result = await safe();
    expect(result).toEqual({ success: false });
  });

  it('calls fallback function on error', async () => {
    const fn = async () => { throw new Error('specific error'); };
    const safe = withErrorBoundary(fn, 'test', (err) => ({ error: err.message }));
    const result = await safe();
    expect(result).toEqual({ error: 'specific error' });
  });

  it('passes through arguments to wrapped function', async () => {
    const fn = async (a, b) => a + b;
    const safe = withErrorBoundary(fn, 'test', 0);
    expect(await safe(3, 4)).toBe(7);
  });

  it('logs error via logError', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = async () => { throw new Error('handled'); };
    const safe = withErrorBoundary(fn, 'myModule.myMethod', null);
    await safe();
    expect(spy).toHaveBeenCalledWith('[myModule.myMethod]', 'handled');
    spy.mockRestore();
  });

  it('returns null fallback correctly', async () => {
    const fn = async () => { throw new Error('fail'); };
    const safe = withErrorBoundary(fn, 'test', null);
    expect(await safe()).toBeNull();
  });

  it('returns empty array fallback correctly', async () => {
    const fn = async () => { throw new Error('fail'); };
    const safe = withErrorBoundary(fn, 'test', []);
    const result = await safe();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});
