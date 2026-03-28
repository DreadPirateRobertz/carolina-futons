/**
 * usePageProgress — manages per-page hookup progress in localStorage.
 *
 * Hooked/skipped element IDs are persisted under the key:
 *   cf-hookup-{pageName}-hooked
 *   cf-hookup-{pageName}-skipped
 *
 * S13 addition: undoLast() reverses the most recent markHooked or markSkipped
 * action using an in-memory history stack. The history itself is not persisted
 * across page reloads, but each undoLast() call does write the resulting ID
 * state back to localStorage so the undo effect survives a reload.
 *
 * S12 addition: history is capped at HISTORY_LIMIT (10) entries. markHooked
 * accepts an optional compRef (the Wix editor ComponentRef used during
 * auto-apply). undoLast returns that compRef so callers can call
 * editor.components.setNickname(compRef, '') to clear the ID in the editor.
 *
 * S15: storage helpers extracted to ../utils/storage.ts so exportReport and
 * importReport can share the same key format without duplication.
 */

import { useState, useCallback } from 'react';
import { loadIds, saveIds } from '../utils/storage.js';

const TAG = '[usePageProgress]';
const HISTORY_LIMIT = 10;

// wasSkipped records whether the element was in skippedIds before markHooked
// moved it — needed to fully reverse a markHooked that displaced a skip.
// compRef (S12) is the Wix editor ComponentRef stored during auto-apply so
// undoLast can return it for the caller to clear the editor nickname.
type ProgressAction =
  | { type: 'hooked'; elementId: string; wasSkipped: boolean; compRef?: unknown }
  | { type: 'skipped'; elementId: string };

<<<<<<< HEAD
=======
function storageKey(pageName: string, kind: 'hooked' | 'skipped') {
  return `cf-hookup-${pageName.replace(/\s+/g, '-').toLowerCase()}-${kind}`;
}

function loadIds(pageName: string, kind: 'hooked' | 'skipped'): string[] {
  const key = storageKey(pageName, kind);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`${TAG} Unexpected data at key "${key}" — resetting. Was: ${raw}`);
      return [];
    }
    return parsed as string[];
  } catch (err) {
    console.warn(`${TAG} Failed to read "${key}" from localStorage:`, err);
    return [];
  }
}

function saveIds(pageName: string, kind: 'hooked' | 'skipped', ids: string[]) {
  const key = storageKey(pageName, kind);
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch (err) {
    console.warn(`${TAG} Could not persist "${key}" (storage unavailable or quota exceeded):`, err);
  }
}

/**
 * Reads the hooked element count for a page directly from localStorage.
 * Synchronous — safe to call during render for progress display in the dropdown.
 * Returns 0 if the key is absent or the stored value is malformed.
 */
export function readPageHookedCount(pageName: string): number {
  const key = storageKey(pageName, 'hooked');
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

>>>>>>> origin/polecat/chrome/CF-267m
export function usePageProgress(pageName: string) {
  const [hookedIds, setHookedIds] = useState<string[]>(() => loadIds(pageName, 'hooked'));
  const [skippedIds, setSkippedIds] = useState<string[]>(() => loadIds(pageName, 'skipped'));
  const [history, setHistory] = useState<ProgressAction[]>([]);

  // S12: compRef is the Wix editor ComponentRef from auto-apply; stored in history
  // so undoLast can return it for the caller to clear the editor nickname.
  const markHooked = useCallback((elementId: string, compRef?: unknown) => {
    // Read wasSkipped at call time (before state updates) — this is the stable
    // "before" value needed to fully reverse this action in undoLast.
    const wasSkipped = skippedIds.includes(elementId);
    setHookedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'hooked', next);
      // Push history only when the element is actually added; cap at HISTORY_LIMIT.
      setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { type: 'hooked', elementId, wasSkipped, compRef }]);
      return next;
    });
    // Remove from skipped if it was there
    setSkippedIds((prev) => {
      const next = prev.filter((id: string) => id !== elementId);
      saveIds(pageName, 'skipped', next);
      return next;
    });
  }, [pageName, skippedIds]);

  const markSkipped = useCallback((elementId: string) => {
    setSkippedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'skipped', next);
      // Push history only when the element is actually added; cap at HISTORY_LIMIT.
      setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), { type: 'skipped', elementId }]);
      return next;
    });
  }, [pageName]);

  // S12: returns the compRef stored during auto-apply so the caller can clear
  // the editor nickname via editor.components.setNickname(compRef, '').
  // Returns undefined for manual (non-auto-applied) hooked actions and for skipped actions.
  const undoLast = useCallback((): unknown => {
    if (history.length === 0) return undefined;
    const last = history[history.length - 1];
    // Flat sequential state updates — avoids calling setState inside another
    // setState updater (which can fire twice in React Strict Mode).
    setHistory(history.slice(0, -1));
    if (last.type === 'hooked') {
      setHookedIds((ids) => {
        const next = ids.filter((id: string) => id !== last.elementId);
        saveIds(pageName, 'hooked', next);
        return next;
      });
      // Restore to skipped if the element was there before markHooked moved it
      if (last.wasSkipped) {
        setSkippedIds((ids) => {
          if (ids.includes(last.elementId)) return ids;
          const next = [...ids, last.elementId];
          saveIds(pageName, 'skipped', next);
          return next;
        });
      }
      return last.compRef;
    } else {
      setSkippedIds((ids) => {
        const next = ids.filter((id: string) => id !== last.elementId);
        saveIds(pageName, 'skipped', next);
        return next;
      });
      return undefined;
    }
  }, [history, pageName]);

  const resetPage = useCallback(() => {
    setHookedIds([]);
    setSkippedIds([]);
    setHistory([]);
    saveIds(pageName, 'hooked', []);
    saveIds(pageName, 'skipped', []);
  }, [pageName]);

  return { hookedIds, skippedIds, markHooked, markSkipped, undoLast, canUndo: history.length > 0, resetPage };
}

/** Read the hooked element count for a page directly from localStorage (no React state). */
export function readPageHookedCount(pageName: string): number {
  return loadIds(pageName, 'hooked').length;
}
