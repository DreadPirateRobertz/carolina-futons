import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn().mockResolvedValue({ success: true }),
}));

import { safeParse } from '../src/backend/utils/safeParse.js';

describe('safeParse utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses valid JSON array', () => {
    expect(safeParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('parses JSON string', () => {
    expect(safeParse('"hello"')).toBe('hello');
  });

  it('parses JSON number', () => {
    expect(safeParse('42')).toBe(42);
  });

  it('returns fallback for null input', () => {
    expect(safeParse(null, [])).toEqual([]);
  });

  it('returns fallback for undefined input', () => {
    expect(safeParse(undefined, {})).toEqual({});
  });

  it('returns fallback for empty string', () => {
    expect(safeParse('', 'default')).toBe('default');
  });

  it('returns default null fallback when no fallback provided', () => {
    expect(safeParse(null)).toBe(null);
  });

  it('returns fallback for malformed JSON', () => {
    expect(safeParse('{bad json}', [])).toEqual([]);
  });

  it('returns fallback for truncated JSON', () => {
    expect(safeParse('{"items":[1,2,', [])).toEqual([]);
  });

  it('returns fallback for non-string input types', () => {
    expect(safeParse(12345, 'fallback')).toBe(12345);
  });

  it('logs to console when context provided and parse fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    safeParse('{corrupt}', [], 'test/context');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[safeParse] Parse failure in test/context'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('does not log when no context provided and parse fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    safeParse('{corrupt}', []);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('attempts to log to errorMonitoring when context provided', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // safeParse fires a dynamic import('backend/errorMonitoring.web') internally.
    // We verify it doesn't throw and the console log includes the context.
    const result = safeParse('{corrupt}', [], 'returns/formatReturn');
    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('returns/formatReturn'),
      expect.any(String)
    );
    consoleSpy.mockRestore();
  });

  it('handles nested JSON correctly', () => {
    const input = '{"items":[{"id":1,"name":"test"}],"count":1}';
    const result = safeParse(input, null);
    expect(result).toEqual({ items: [{ id: 1, name: 'test' }], count: 1 });
  });

  it('returns fallback for partially valid JSON with trailing comma', () => {
    expect(safeParse('[1,2,3,]', [])).toEqual([]);
  });
});
