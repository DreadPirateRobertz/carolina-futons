/**
 * useKeyboardShortcuts — S13: global keyboard shortcut registry.
 *
 * Shortcut map:
 *   Enter / Space  → apply ID (if editor+element available) or mark done
 *   S              → skip current element
 *   D              → mark done (respects type mismatch guard in ManualModePanel)
 *   N              → next page
 *   P              → previous page
 *   M              → toggle manual mode
 *   Cmd/Ctrl+Z     → undo last action
 *   ?              → toggle help overlay
 *
 * Shortcuts are suppressed when the focused element is an INPUT or TEXTAREA.
 */

import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onApplyOrDone: () => void;   // Enter / Space
  onSkip: () => void;          // S
  onDone: () => void;          // D
  onNextPage: () => void;      // N
  onPrevPage: () => void;      // P
  onToggleManual: () => void;  // M
  onUndo: () => void;          // Cmd/Ctrl+Z
  onToggleHelp: () => void;    // ?
}

function isEditing(): boolean {
  const tag = (document.activeElement as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  // Ref pattern: keep latest handlers without re-attaching the listener on every render.
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditing()) return;

      const h = ref.current;

      // Cmd/Ctrl+Z → undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        h.onUndo();
        return;
      }

      // Ignore other modifier-key combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          h.onApplyOrDone();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          h.onSkip();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          h.onDone();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          h.onNextPage();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          h.onPrevPage();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          h.onToggleManual();
          break;
        case '?':
          e.preventDefault();
          h.onToggleHelp();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // stable — listener attached once, reads latest handlers via ref
}
