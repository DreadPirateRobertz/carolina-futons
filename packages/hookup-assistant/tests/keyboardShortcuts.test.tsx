/**
 * keyboardShortcuts.test.tsx — S13: useKeyboardShortcuts hook unit tests.
 *
 * Tests the full shortcut map, suppression when focused in an input,
 * and Cmd/Ctrl+Z undo behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts.js';
import type { ShortcutHandlers } from '../src/hooks/useKeyboardShortcuts.js';

// ---------------------------------------------------------------------------
// Helpers

function makeHandlers(): ShortcutHandlers {
  return {
    onApplyOrDone: vi.fn(),
    onSkip: vi.fn(),
    onDone: vi.fn(),
    onNextPage: vi.fn(),
    onPrevPage: vi.fn(),
    onToggleManual: vi.fn(),
    onUndo: vi.fn(),
    onToggleHelp: vi.fn(),
  };
}

function fire(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

beforeEach(() => {
  // Reset document.activeElement to body (no input focused)
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
});

// ── Basic shortcut dispatch ─────────────────────────────────────────────────

describe('useKeyboardShortcuts — Enter/Space', () => {
  it('Enter calls onApplyOrDone', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('Enter');
    expect(h.onApplyOrDone).toHaveBeenCalledOnce();
  });

  it('Space calls onApplyOrDone', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire(' ');
    expect(h.onApplyOrDone).toHaveBeenCalledOnce();
  });
});

describe('useKeyboardShortcuts — S (skip)', () => {
  it('lowercase s calls onSkip', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('s');
    expect(h.onSkip).toHaveBeenCalledOnce();
  });

  it('uppercase S calls onSkip', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('S');
    expect(h.onSkip).toHaveBeenCalledOnce();
  });
});

describe('useKeyboardShortcuts — D (done)', () => {
  it('lowercase d calls onDone', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('d');
    expect(h.onDone).toHaveBeenCalledOnce();
  });

  it('uppercase D calls onDone', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('D');
    expect(h.onDone).toHaveBeenCalledOnce();
  });
});

describe('useKeyboardShortcuts — N/P page nav', () => {
  it('n calls onNextPage', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('n');
    expect(h.onNextPage).toHaveBeenCalledOnce();
  });

  it('N calls onNextPage', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('N');
    expect(h.onNextPage).toHaveBeenCalledOnce();
  });

  it('p calls onPrevPage', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('p');
    expect(h.onPrevPage).toHaveBeenCalledOnce();
  });

  it('P calls onPrevPage', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('P');
    expect(h.onPrevPage).toHaveBeenCalledOnce();
  });
});

describe('useKeyboardShortcuts — M (toggle manual)', () => {
  it('m calls onToggleManual', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('m');
    expect(h.onToggleManual).toHaveBeenCalledOnce();
  });

  it('M calls onToggleManual', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('M');
    expect(h.onToggleManual).toHaveBeenCalledOnce();
  });
});

describe('useKeyboardShortcuts — ? (help)', () => {
  it('? calls onToggleHelp', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('?');
    expect(h.onToggleHelp).toHaveBeenCalledOnce();
  });
});

// ── Cmd/Ctrl+Z ──────────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — Cmd/Ctrl+Z undo', () => {
  it('Cmd+Z calls onUndo', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('z', { metaKey: true });
    expect(h.onUndo).toHaveBeenCalledOnce();
  });

  it('Ctrl+Z calls onUndo', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('z', { ctrlKey: true });
    expect(h.onUndo).toHaveBeenCalledOnce();
  });

  it('plain z does not call onUndo', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('z');
    expect(h.onUndo).not.toHaveBeenCalled();
  });
});

// ── Modifier combos suppressed ───────────────────────────────────────────────

describe('useKeyboardShortcuts — modifier key suppression', () => {
  it('Cmd+S does not call onSkip', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('s', { metaKey: true });
    expect(h.onSkip).not.toHaveBeenCalled();
  });

  it('Ctrl+N does not call onNextPage', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('n', { ctrlKey: true });
    expect(h.onNextPage).not.toHaveBeenCalled();
  });

  it('Alt+D does not call onDone', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));
    fire('d', { altKey: true });
    expect(h.onDone).not.toHaveBeenCalled();
  });
});

// ── Input field suppression ──────────────────────────────────────────────────

describe('useKeyboardShortcuts — suppressed in input fields', () => {
  it('does not fire when an INPUT is focused', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fire('s');
    fire('d');
    fire('Enter');

    expect(h.onSkip).not.toHaveBeenCalled();
    expect(h.onDone).not.toHaveBeenCalled();
    expect(h.onApplyOrDone).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('does not fire when a TEXTAREA is focused', () => {
    const h = makeHandlers();
    renderHook(() => useKeyboardShortcuts(h));

    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    fire('n');
    fire('p');

    expect(h.onNextPage).not.toHaveBeenCalled();
    expect(h.onPrevPage).not.toHaveBeenCalled();

    document.body.removeChild(ta);
  });
});

// ── Cleanup on unmount ────────────────────────────────────────────────────────

describe('useKeyboardShortcuts — cleanup on unmount', () => {
  it('stops firing after hook is unmounted', () => {
    const h = makeHandlers();
    const { unmount } = renderHook(() => useKeyboardShortcuts(h));
    unmount();
    fire('s');
    expect(h.onSkip).not.toHaveBeenCalled();
  });
});
