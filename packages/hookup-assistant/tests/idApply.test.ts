/**
 * idApply.test.ts — S4: useIdApply hook unit tests.
 *
 * Tests the apply status state machine, 300ms timeout, localStorage
 * persistence, and success/error branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdApply } from '../src/hooks/useIdApply.js';
import type { ElementDef } from '../src/types/index.js';

// ---------------------------------------------------------------------------
// localStorage mock

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

// ---------------------------------------------------------------------------
// @wix/editor mock — controlled via this reference

const mockSetNickname = vi.fn();

vi.mock('@wix/editor', () => ({
  components: {
    setNickname: (...args: unknown[]) => mockSetNickname(...args),
  },
}));

// ---------------------------------------------------------------------------

const sampleElement: ElementDef = { id: 'heroTitle', type: 'Text', notes: 'H1' };
const dummyCompRef = { id: 'comp-123' };

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ── Initial state ───────────────────────────────────────────────────────────

describe('useIdApply — initial state', () => {
  it('starts with idle status', () => {
    const { result } = renderHook(() => useIdApply('Home'));
    expect(result.current.status).toBe('idle');
  });
});

// ── resetStatus ─────────────────────────────────────────────────────────────

describe('useIdApply — resetStatus', () => {
  it('resets status back to idle', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(result.current.status).toBe('success');
    act(() => result.current.resetStatus());
    expect(result.current.status).toBe('idle');
  });
});

// ── Success path ─────────────────────────────────────────────────────────────

describe('useIdApply — success', () => {
  it('calls editor.components.setNickname with compRef and element id', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(mockSetNickname).toHaveBeenCalledWith(dummyCompRef, 'heroTitle');
  });

  it('sets status to success after setNickname resolves', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(result.current.status).toBe('success');
  });

  it('returns true on success', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    let returnVal: boolean | undefined;
    await act(async () => {
      returnVal = await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(returnVal).toBe(true);
  });

  it('saves element ID to localStorage on success', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cf-hookup-home-applied',
      JSON.stringify(['heroTitle'])
    );
  });

  it('does not save duplicate IDs to localStorage', async () => {
    // Pre-seed applied list
    store['cf-hookup-home-applied'] = JSON.stringify(['heroTitle']);
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    const saved = localStorageMock.getItem('cf-hookup-home-applied');
    expect(JSON.parse(saved!)).toEqual(['heroTitle']);
  });

  it('accumulates multiple applied IDs across calls', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Home'));
    const el2: ElementDef = { id: 'heroCTA', type: 'Button', notes: '' };
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    await act(async () => {
      await result.current.applyId(el2, dummyCompRef);
    });
    const saved = localStorageMock.getItem('cf-hookup-home-applied');
    expect(JSON.parse(saved!)).toEqual(['heroTitle', 'heroCTA']);
  });
});

// ── Error path ───────────────────────────────────────────────────────────────

describe('useIdApply — error', () => {
  it('sets status to error when setNickname rejects', async () => {
    mockSetNickname.mockRejectedValue(new Error('SDK error'));
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(result.current.status).toBe('error');
  });

  it('returns false on error', async () => {
    mockSetNickname.mockRejectedValue(new Error('SDK error'));
    const { result } = renderHook(() => useIdApply('Home'));
    let returnVal: boolean | undefined;
    await act(async () => {
      returnVal = await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(returnVal).toBe(false);
  });

  it('does NOT save to localStorage on error', async () => {
    mockSetNickname.mockRejectedValue(new Error('SDK error'));
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ── 300ms timeout ────────────────────────────────────────────────────────────

describe('useIdApply — 300ms timeout', () => {
  // These tests use real timers — setNickname hangs for 1s so the 300ms
  // timeout in useIdApply fires naturally. Each test takes ~300ms to run.

  it('sets status to error when setNickname takes longer than 300ms', async () => {
    // setNickname hangs for 1 second — longer than the 300ms timeout
    mockSetNickname.mockImplementation(() => new Promise((res) => setTimeout(res, 1000)));
    const { result } = renderHook(() => useIdApply('Home'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(result.current.status).toBe('error');
  }, 2000);

  it('returns false on timeout', async () => {
    mockSetNickname.mockImplementation(() => new Promise((res) => setTimeout(res, 1000)));
    const { result } = renderHook(() => useIdApply('Home'));
    let returnVal: boolean | undefined;
    await act(async () => {
      returnVal = await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(returnVal).toBe(false);
  }, 2000);
});

// ── applying intermediate state ───────────────────────────────────────────────

describe('useIdApply — applying state', () => {
  it('transitions through applying then success', async () => {
    // Track status values observed during the async flow
    const statusHistory: string[] = [];
    let resolveSetNickname!: () => void;
    mockSetNickname.mockReturnValue(new Promise<void>((res) => { resolveSetNickname = res; }));

    const { result } = renderHook(() => useIdApply('Home'));

    // Start apply without resolving the setNickname promise yet
    const applyPromise = result.current.applyId(sampleElement, dummyCompRef);

    // After calling applyId, the async function runs and sets 'applying'
    // We need to flush microtasks for the state update to land
    await act(async () => {
      // Flush the getEditorModule() and setStatus('applying') microtasks
      await Promise.resolve();
      await Promise.resolve();
    });

    statusHistory.push(result.current.status);

    // Now resolve setNickname to complete the flow
    await act(async () => {
      resolveSetNickname();
      await applyPromise;
    });

    statusHistory.push(result.current.status);

    // Should have gone through applying → success
    expect(statusHistory).toContain('applying');
    expect(result.current.status).toBe('success');
  });
});

// ── Page isolation ────────────────────────────────────────────────────────────

describe('useIdApply — page isolation', () => {
  it('uses page-specific localStorage key', async () => {
    mockSetNickname.mockResolvedValue(undefined);
    const { result } = renderHook(() => useIdApply('Product Page'));
    await act(async () => {
      await result.current.applyId(sampleElement, dummyCompRef);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'cf-hookup-product-page-applied',
      expect.any(String)
    );
  });
});
