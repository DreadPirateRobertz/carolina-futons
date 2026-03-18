/**
 * usePageProgress — manages per-page hookup progress in localStorage.
 *
 * Hooked/skipped element IDs are persisted under the key:
 *   cf-hookup-{pageName}-hooked
 *   cf-hookup-{pageName}-skipped
 */

import { useState, useCallback } from 'react';

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
  }, [pageName]);

  const markSkipped = useCallback((elementId: string) => {
    setSkippedIds((prev) => {
      if (prev.includes(elementId)) return prev;
      const next = [...prev, elementId];
      saveIds(pageName, 'skipped', next);
      return next;
    });
  }, [pageName]);

  const resetPage = useCallback(() => {
    setHookedIds([]);
    setSkippedIds([]);
    saveIds(pageName, 'hooked', []);
    saveIds(pageName, 'skipped', []);
  }, [pageName]);

  return { hookedIds, skippedIds, markHooked, markSkipped, resetPage };
}
