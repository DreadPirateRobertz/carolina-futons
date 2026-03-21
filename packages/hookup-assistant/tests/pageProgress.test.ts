/**
 * pageProgress.test.ts — usePageProgress hook unit tests.
 *
 * Tests localStorage-based progress tracking: markHooked, markSkipped, resetPage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageProgress } from '../src/hooks/usePageProgress.js';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('usePageProgress — markHooked', () => {
  it('starts with empty hookedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    expect(result.current.hookedIds).toEqual([]);
  });

  it('adds element ID to hookedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    expect(result.current.hookedIds).toContain('heroTitle');
  });

  it('does not add duplicate IDs', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.markHooked('heroTitle'));
    expect(result.current.hookedIds.filter((id) => id === 'heroTitle')).toHaveLength(1);
  });

  it('persists to localStorage', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('removes element from skipped when hooked', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroBg'));
    expect(result.current.skippedIds).toContain('heroBg');
    act(() => result.current.markHooked('heroBg'));
    expect(result.current.skippedIds).not.toContain('heroBg');
    expect(result.current.hookedIds).toContain('heroBg');
  });
});

describe('usePageProgress — markSkipped', () => {
  it('starts with empty skippedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    expect(result.current.skippedIds).toEqual([]);
  });

  it('adds element ID to skippedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroTitle'));
    expect(result.current.skippedIds).toContain('heroTitle');
  });

  it('does not add duplicate skipped IDs', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroTitle'));
    act(() => result.current.markSkipped('heroTitle'));
    expect(result.current.skippedIds.filter((id) => id === 'heroTitle')).toHaveLength(1);
  });
});

describe('usePageProgress — resetPage', () => {
  it('clears hookedIds and skippedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => {
      result.current.markHooked('heroTitle');
      result.current.markSkipped('heroBg');
    });
    act(() => result.current.resetPage());
    expect(result.current.hookedIds).toEqual([]);
    expect(result.current.skippedIds).toEqual([]);
  });

  it('clears localStorage on reset (saves empty array)', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.resetPage());
    // After reset, localStorage should contain an empty array, not the old data
    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    const parsed = saved ? JSON.parse(saved) : null;
    expect(parsed).toEqual([]);
  });
});

describe('usePageProgress — page isolation', () => {
  it('different pages have independent state', () => {
    const { result: home } = renderHook(() => usePageProgress('Home'));
    const { result: product } = renderHook(() => usePageProgress('Product Page'));
    act(() => home.current.markHooked('heroTitle'));
    expect(product.current.hookedIds).not.toContain('heroTitle');
  });
});

// ── S13: undoLast ────────────────────────────────────────────────────────────

describe('usePageProgress — undoLast', () => {
  it('canUndo is false initially', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    expect(result.current.canUndo).toBe(false);
  });

  it('canUndo is true after markHooked', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    expect(result.current.canUndo).toBe(true);
  });

  it('canUndo is true after markSkipped', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroTitle'));
    expect(result.current.canUndo).toBe(true);
  });

  it('undoes markHooked — removes from hookedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.undoLast());
    expect(result.current.hookedIds).not.toContain('heroTitle');
  });

  it('undoes markSkipped — removes from skippedIds', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroTitle'));
    act(() => result.current.undoLast());
    expect(result.current.skippedIds).not.toContain('heroTitle');
  });

  it('canUndo becomes false after undoing the only action', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.undoLast());
    expect(result.current.canUndo).toBe(false);
  });

  it('persists undo to localStorage', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.undoLast());
    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(saved!)).toEqual([]);
  });

  it('undoes actions in LIFO order', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.markHooked('heroCTA'));
    act(() => result.current.undoLast());
    expect(result.current.hookedIds).toContain('heroTitle');
    expect(result.current.hookedIds).not.toContain('heroCTA');
  });

  it('does nothing when history is empty', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.undoLast()); // should not throw
    expect(result.current.hookedIds).toEqual([]);
    expect(result.current.skippedIds).toEqual([]);
  });

  it('resetPage clears canUndo', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.resetPage());
    expect(result.current.canUndo).toBe(false);
  });
});

describe('usePageProgress — undoLast duplicate guard', () => {
  it('does not push history when markHooked is called with an already-hooked ID', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markHooked('heroTitle'));
    act(() => result.current.markHooked('heroTitle')); // duplicate — no-op
    expect(result.current.canUndo).toBe(true);
    // Only one history entry — undo removes it and canUndo goes false
    act(() => result.current.undoLast());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.hookedIds).not.toContain('heroTitle');
  });

  it('does not push history when markSkipped is called with an already-skipped ID', () => {
    const { result } = renderHook(() => usePageProgress('Home'));
    act(() => result.current.markSkipped('heroTitle'));
    act(() => result.current.markSkipped('heroTitle')); // duplicate — no-op
    act(() => result.current.undoLast());
    expect(result.current.canUndo).toBe(false);
  });
});
