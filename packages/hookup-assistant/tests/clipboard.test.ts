/**
 * clipboard.test.ts — useClipboard hook tests (S10).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from '../src/hooks/useClipboard.js';

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with copied=false', () => {
    const { result } = renderHook(() => useClipboard());
    expect(result.current.copied).toBe(false);
  });

  it('sets copied=true after successful copy via Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useClipboard());
    await act(async () => { await result.current.copy('heroTitle'); });
    expect(writeText).toHaveBeenCalledWith('heroTitle');
    expect(result.current.copied).toBe(true);
  });

  it('returns true on successful copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useClipboard());
    let success: boolean = false;
    await act(async () => { success = await result.current.copy('test'); });
    expect(success).toBe(true);
  });

  it('returns false when Clipboard API throws', async () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useClipboard());
    let success: boolean = true;
    await act(async () => { success = await result.current.copy('test'); });
    expect(success).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it('uses execCommand fallback when clipboard API unavailable', async () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const { result } = renderHook(() => useClipboard());
    await act(async () => { await result.current.copy('heroTitle'); });
    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
