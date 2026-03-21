/**
 * usePageProgress — manages per-page hookup progress in localStorage.
 *
 * Hooked/skipped element IDs are persisted under the key:
 *   cf-hookup-{pageName}-hooked
 *   cf-hookup-{pageName}-skipped
 *
 * S13 addition: undoLast() reverses the most recent markHooked or markSkipped
 * action using an in-memory history stack (not persisted across page reloads).
 */

import { useState, useCallback } from 'react';

type ProgressAction = { type: 'hooked' | 'skipped'; elementId: string };

function storageKey(pageName: string, kind: 'hooked' | 'skipped') {
  return `cf-hookup-${pageName.replace(/\s+/g, '-').toLowerCase()}-${kind}`;
}

function loadIds(pageName: string, kind: 'hooked' | 'skipped'): string[] {
  try {
    const raw = localStorage.getItem(storageKey(pageName, kind));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveIds(pageName: string, kind: 'hooked' | 'skipped', ids: string[]) {
  try {
    localStorage.setItem(storageKey(pageName, kind), JSON.stringify(ids));
  } catch {
    // localStorage not available (tests / sandboxed frame) — ignore
  }
}

export function usePageProgress(pageName: string) {
  const [hookedIds, setHookedIds] = useState<string[]>(() => loadIds(pageName, 'hooked'));
  const [skippedIds, setSkippedIds] = useState<string[]>(() => loadIds(pageName, 'skipped'));
  const [history, setHistory] = useState<ProgressAction[]>([]);

  const markHooked = useCallback((elementId: string) => {
    setHookedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'hooked', next);
      return next;
    });
    // Remove from skipped if it was there
    setSkippedIds((prev) => {
      const next = prev.filter((id) => id !== elementId);
      saveIds(pageName, 'skipped', next);
      return next;
    });
    setHistory((prev) => [...prev, { type: 'hooked', elementId }]);
  }, [pageName]);

  const markSkipped = useCallback((elementId: string) => {
    setSkippedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'skipped', next);
      return next;
    });
    setHistory((prev) => [...prev, { type: 'skipped', elementId }]);
  }, [pageName]);

  const undoLast = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.type === 'hooked') {
        setHookedIds((ids) => {
          const next = ids.filter((id) => id !== last.elementId);
          saveIds(pageName, 'hooked', next);
          return next;
        });
      } else {
        setSkippedIds((ids) => {
          const next = ids.filter((id) => id !== last.elementId);
          saveIds(pageName, 'skipped', next);
          return next;
        });
      }
      return prev.slice(0, -1);
    });
  }, [pageName]);

  const resetPage = useCallback(() => {
    setHookedIds([]);
    setSkippedIds([]);
    setHistory([]);
    saveIds(pageName, 'hooked', []);
    saveIds(pageName, 'skipped', []);
  }, [pageName]);

  return { hookedIds, skippedIds, markHooked, markSkipped, undoLast, canUndo: history.length > 0, resetPage };
}
