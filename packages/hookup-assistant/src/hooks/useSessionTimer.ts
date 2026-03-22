/**
 * useSessionTimer — S9: session timing, pace display, tab-blur auto-pause, history.
 *
 * - Timer starts on the first recordApply() call.
 * - Elapsed time pauses when the document becomes hidden (visibilitychange)
 *   and resumes when it becomes visible again.
 * - A session record is appended to localStorage (cf-hookup-session-history)
 *   on unmount — only if the session was actually started.
 * - loadHistory() exposes previous records for display in the settings panel.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface SessionRecord {
  date: string;       // ISO string of session start
  elapsed: number;    // active ms (paused time excluded)
  applyCount: number; // IDs hooked this session
  pace: number;       // IDs / hour
}

const HISTORY_KEY = 'cf-hookup-session-history';
const TICK_INTERVAL_MS = 1000;
/** Minimum elapsed time before pace is meaningful (avoid wild early values). */
const MIN_PACE_ELAPSED_MS = 5_000;
/** Maximum history entries to retain. */
const MAX_HISTORY = 20;

export function loadHistory(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SessionRecord[];
  } catch {
    return [];
  }
}

function appendHistory(record: SessionRecord): void {
  try {
    const prev = loadHistory();
    const trimmed = prev.slice(-MAX_HISTORY + 1); // keep most recent N-1, append new
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...trimmed, record]));
  } catch {
    // quota exceeded — silently ignore
  }
}

/** Compute IDs/hour from applyCount and elapsedMs. Returns 0 until MIN_PACE_ELAPSED_MS. */
export function computePace(applyCount: number, elapsedMs: number): number {
  if (elapsedMs < MIN_PACE_ELAPSED_MS || applyCount === 0) return 0;
  return (applyCount / elapsedMs) * 3_600_000;
}

/** Format elapsed ms as M:SS or H:MM:SS. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useSessionTimer() {
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [applyCount, setApplyCount] = useState(0);
  const [paused, setPaused] = useState(false);

  /** ISO date of session start — null until first apply. */
  const startDateRef = useRef<string | null>(null);
  /** Date.now() when timer last resumed — null when paused. */
  const lastResumeRef = useRef<number | null>(null);
  /** Accumulated elapsed ms — mirrors elapsed state but readable in callbacks. */
  const elapsedRef = useRef(0);
  /** Mirror of applyCount state — readable in unmount cleanup. */
  const applyCountRef = useRef(0);

  // ── pause / resume ────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    if (lastResumeRef.current === null) return; // already paused
    elapsedRef.current += Date.now() - lastResumeRef.current;
    lastResumeRef.current = null;
    setElapsed(elapsedRef.current);
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!startDateRef.current) return; // not started yet
    if (lastResumeRef.current !== null) return; // already running
    lastResumeRef.current = Date.now();
    setPaused(false);
  }, []);

  // ── auto-pause on tab blur ────────────────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        pause();
      } else {
        resume();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [pause, resume]);

  // ── tick interval (starts after first apply) ──────────────────────────────

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      if (lastResumeRef.current !== null) {
        const now = Date.now();
        elapsedRef.current += now - lastResumeRef.current;
        lastResumeRef.current = now;
        setElapsed(elapsedRef.current);
      }
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [started]);

  // ── persist session to history on unmount ─────────────────────────────────

  useEffect(() => {
    return () => {
      if (!startDateRef.current) return; // session never started
      // Capture any time since last resume
      if (lastResumeRef.current !== null) {
        elapsedRef.current += Date.now() - lastResumeRef.current;
      }
      if (elapsedRef.current > 0 || applyCountRef.current > 0) {
        appendHistory({
          date: startDateRef.current,
          elapsed: elapsedRef.current,
          applyCount: applyCountRef.current,
          pace: computePace(applyCountRef.current, elapsedRef.current),
        });
      }
    };
  }, []); // intentionally empty — fires only on unmount

  // ── public API ────────────────────────────────────────────────────────────

  /** Call this each time an element is successfully hooked (Apply ID or Mark Done). */
  const recordApply = useCallback(() => {
    applyCountRef.current += 1;
    setApplyCount(applyCountRef.current);

    if (!startDateRef.current) {
      // First apply — start the session clock.
      startDateRef.current = new Date().toISOString();
      lastResumeRef.current = Date.now();
      setStarted(true);
    }
  }, []);

  const pace = computePace(applyCount, elapsed);

  return { started, elapsed, applyCount, paused, pace, recordApply };
}
