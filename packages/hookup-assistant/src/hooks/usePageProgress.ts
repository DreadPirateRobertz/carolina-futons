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
 */

import { useState, useCallback } from 'react';

const TAG = '[usePageProgress]';

// wasSkipped records whether the element was in skippedIds before markHooked
// moved it — needed to fully reverse a markHooked that displaced a skip.
type ProgressAction =
  | { type: 'hooked'; elementId: string; wasSkipped: boolean }
  | { type: 'skipped'; elementId: string };

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

export function usePageProgress(pageName: string) {
  const [hookedIds, setHookedIds] = useState<string[]>(() => loadIds(pageName, 'hooked'));
  const [skippedIds, setSkippedIds] = useState<string[]>(() => loadIds(pageName, 'skipped'));
  const [history, setHistory] = useState<ProgressAction[]>([]);

  const markHooked = useCallback((elementId: string) => {
    // Read wasSkipped at call time (before state updates) — this is the stable
    // "before" value needed to fully reverse this action in undoLast.
    const wasSkipped = skippedIds.includes(elementId);
    setHookedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'hooked', next);
      // Push history only when the element is actually added
      setHistory((h) => [...h, { type: 'hooked', elementId, wasSkipped }]);
      return next;
    });
    // Remove from skipped if it was there
    setSkippedIds((prev) => {
      const next = prev.filter((id) => id !== elementId);
      saveIds(pageName, 'skipped', next);
      return next;
    });
  }, [pageName, skippedIds]);

  const markSkipped = useCallback((elementId: string) => {
    setSkippedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'skipped', next);
      // Push history only when the element is actually added
      setHistory((h) => [...h, { type: 'skipped', elementId }]);
      return next;
    });
  }, [pageName]);

  const undoLast = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    // Flat sequential state updates — avoids calling setState inside another
    // setState updater (which can fire twice in React Strict Mode).
    setHistory(history.slice(0, -1));
    if (last.type === 'hooked') {
      setHookedIds((ids) => {
        const next = ids.filter((id) => id !== last.elementId);
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
    } else {
      setSkippedIds((ids) => {
        const next = ids.filter((id) => id !== last.elementId);
        saveIds(pageName, 'skipped', next);
        return next;
      });
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
