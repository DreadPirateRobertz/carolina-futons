/**
 * useProgressDashboard — global progress tracking across all pages.
 *
 * S8: Progress Dashboard — reads per-page progress from localStorage,
 * computes global totals, and tracks how many elements have been hooked
 * since the hook was first mounted (session delta).
 */

import { useState, useRef, useCallback } from 'react';
import { PAGES, getAllElements } from '../data/pages.js';
import { loadIds, saveIds } from '../utils/storage.js';

export interface PageStat {
  name: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  total: number;
  hooked: number;
  skipped: number;
}

function readAllStats(): PageStat[] {
  return PAGES.map((page) => ({
    name: page.name,
    priority: page.priority,
    total: getAllElements(page.name).length,
    hooked: loadIds(page.name, 'hooked').length,
    skipped: loadIds(page.name, 'skipped').length,
  }));
}

export function useProgressDashboard() {
  const [pages, setPages] = useState<PageStat[]>(() => readAllStats());

  // Snapshot hooked counts at mount — baseline for session delta calculation.
  const sessionBaseRef = useRef<Map<string, number> | null>(null);
  if (!sessionBaseRef.current) {
    const base = new Map<string, number>();
    for (const p of pages) {
      base.set(p.name, p.hooked);
    }
    sessionBaseRef.current = base;
  }

  /** Re-read all stats from localStorage (call when opening the dashboard view). */
  const refresh = useCallback(() => {
    setPages(readAllStats());
  }, []);

  const resetPage = useCallback((pageName: string) => {
    saveIds(pageName, 'hooked', []);
    saveIds(pageName, 'skipped', []);
    setPages(readAllStats());
  }, []);

  const resetAll = useCallback(() => {
    for (const page of PAGES) {
      saveIds(page.name, 'hooked', []);
      saveIds(page.name, 'skipped', []);
    }
    setPages(readAllStats());
  }, []);

  const totalHooked = pages.reduce((s, p) => s + p.hooked, 0);
  const totalElements = pages.reduce((s, p) => s + p.total, 0);
  const sessionHooked = pages.reduce((s, p) => {
    const base = sessionBaseRef.current?.get(p.name) ?? 0;
    return s + Math.max(0, p.hooked - base);
  }, 0);

  return { pages, totalHooked, totalElements, sessionHooked, resetPage, resetAll, refresh };
}
