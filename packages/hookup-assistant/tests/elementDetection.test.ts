/**
 * elementDetection.test.ts — useElementDetection hook tests.
 *
 * Covers:
 *  - editor API unavailable: editorAvailable false, selected null
 *  - editor available: editorAvailable true, subscribes via onSelectionChanged
 *  - cleanup: unsubscribe called on unmount
 *  - selection callback: null componentRef → selected null
 *  - selection callback: valid componentRef → selected populated with type + nickname
 *  - selection callback: getType throws (inner catch) → selected null
 *  - selection callback: getNickname resolves null → currentNickname null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useElementDetection } from '../src/hooks/useElementDetection.js';

// ── Control knobs ────────────────────────────────────────────────────────────

const {
  mockOnSelectionChanged,
  mockGetType,
  mockGetNickname,
} = vi.hoisted(() => ({
  mockOnSelectionChanged: vi.fn(),
  mockGetType: vi.fn(),
  mockGetNickname: vi.fn(),
}));

vi.mock('@wix/editor', () => ({
  selection: { onSelectionChanged: mockOnSelectionChanged },
  components: {
    getType: mockGetType,
    getNickname: mockGetNickname,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockOnSelectionChanged.mockReturnValue(() => {});
  mockGetType.mockResolvedValue({ componentType: 'wixui.Button' });
  mockGetNickname.mockResolvedValue('shopBtn');
});

// ── Editor API unavailable ────────────────────────────────────────────────────

describe('useElementDetection — editor API unavailable', () => {
  it('sets editorAvailable false when onSelectionChanged throws', async () => {
    mockOnSelectionChanged.mockImplementation(() => {
      throw new Error('editor API not ready');
    });

    const { result } = renderHook(() => useElementDetection());

    await waitFor(() => {
      expect(result.current.editorAvailable).toBe(false);
    });
    expect(result.current.selected).toBeNull();
  });
});

// ── Editor available ──────────────────────────────────────────────────────────

describe('useElementDetection — editor available', () => {
  it('sets editorAvailable true when onSelectionChanged succeeds', async () => {
    const { result } = renderHook(() => useElementDetection());

    await waitFor(() => {
      expect(result.current.editorAvailable).toBe(true);
    });
    expect(result.current.selected).toBeNull();
  });

  it('subscribes via onSelectionChanged on mount', async () => {
    renderHook(() => useElementDetection());

    await waitFor(() => expect(mockOnSelectionChanged).toHaveBeenCalledTimes(1));
    expect(mockOnSelectionChanged).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls the unsubscribe function on unmount', async () => {
    const mockOff = vi.fn();
    mockOnSelectionChanged.mockReturnValue(mockOff);

    const { unmount } = renderHook(() => useElementDetection());
    await waitFor(() => expect(mockOnSelectionChanged).toHaveBeenCalled());

    unmount();
    expect(mockOff).toHaveBeenCalledTimes(1);
  });
});

// ── Selection callback ────────────────────────────────────────────────────────

type SelectionCb = (event: { componentRef: unknown }) => Promise<void>;

function captureCallback(): { getCb: () => SelectionCb | null } {
  let capturedCb: SelectionCb | null = null;
  mockOnSelectionChanged.mockImplementation((cb: SelectionCb) => {
    capturedCb = cb;
    return () => {};
  });
  return { getCb: () => capturedCb };
}

describe('useElementDetection — selection callback', () => {
  it('sets selected null when componentRef is null', async () => {
    const { getCb } = captureCallback();
    const { result } = renderHook(() => useElementDetection());
    await waitFor(() => expect(getCb()).not.toBeNull());

    await act(async () => { await getCb()!({ componentRef: null }); });

    expect(result.current.selected).toBeNull();
  });

  it('populates selected with compRef, type, and nickname on valid componentRef', async () => {
    const fakeRef = { id: 'comp-123' };
    // beforeEach defaults: getType → wixui.Button, getNickname → 'shopBtn'
    const { getCb } = captureCallback();
    const { result } = renderHook(() => useElementDetection());
    await waitFor(() => expect(getCb()).not.toBeNull());

    await act(async () => { await getCb()!({ componentRef: fakeRef }); });

    await waitFor(() => expect(result.current.selected).not.toBeNull());
    expect(result.current.selected?.compRef).toBe(fakeRef);
    expect(result.current.selected?.currentNickname).toBe('shopBtn');
  });

  it('sets selected null when getType throws (inner catch)', async () => {
    mockGetType.mockRejectedValue(new Error('SDK error'));

    const { getCb } = captureCallback();
    const { result } = renderHook(() => useElementDetection());
    await waitFor(() => expect(getCb()).not.toBeNull());

    await act(async () => { await getCb()!({ componentRef: { id: 'x' } }); });

    expect(result.current.selected).toBeNull();
  });

  it('sets currentNickname null when getNickname resolves null', async () => {
    const fakeRef = { id: 'comp-no-nick' };
    mockGetType.mockResolvedValue({ componentType: 'wixui.Text' });
    mockGetNickname.mockResolvedValue(null);

    const { getCb } = captureCallback();
    const { result } = renderHook(() => useElementDetection());
    await waitFor(() => expect(getCb()).not.toBeNull());

    await act(async () => { await getCb()!({ componentRef: fakeRef }); });

    await waitFor(() => expect(result.current.selected).not.toBeNull());
    expect(result.current.selected?.currentNickname).toBeNull();
  });
});
