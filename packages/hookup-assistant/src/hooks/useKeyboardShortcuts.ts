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

import { useEffect } from 'react';

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
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isEditing()) return;

      // Cmd/Ctrl+Z → undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handlers.onUndo();
        return;
      }

      // Ignore other modifier-key combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          handlers.onApplyOrDone();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          handlers.onSkip();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          handlers.onDone();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          handlers.onNextPage();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          handlers.onPrevPage();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          handlers.onToggleManual();
          break;
        case '?':
          e.preventDefault();
          handlers.onToggleHelp();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}
