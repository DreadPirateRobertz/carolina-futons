/**
 * useRepeaterGuard — S14: Repeater Guard state management.
 *
 * Tracks which repeater sections the user has confirmed entering.
 * When a repeater child element is the current target, the guard fires
 * until the user clicks "I'm in the template" for that repeater's ID.
 *
 * Resets across page changes (call resetAll() on page switch).
 */

import { useState, useCallback } from 'react';

export interface RepeaterGuardHook {
  /** True when the user has NOT yet confirmed entering the given repeater template. */
  isGuardActive: (repeaterId: string) => boolean;
  /** Dismiss the guard for this repeater — user confirmed they're inside the template. */
  confirmEntered: (repeaterId: string) => void;
  /** Reset all guard state (call on page change). */
  resetAll: () => void;
}

export function useRepeaterGuard(): RepeaterGuardHook {
  const [enteredRepeaters, setEnteredRepeaters] = useState<ReadonlySet<string>>(new Set());

  const isGuardActive = useCallback(
    (repeaterId: string) => !enteredRepeaters.has(repeaterId),
    [enteredRepeaters],
  );

  const confirmEntered = useCallback((repeaterId: string) => {
    setEnteredRepeaters((prev: ReadonlySet<string>) => {
      const next = new Set(prev);
      next.add(repeaterId);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setEnteredRepeaters(new Set());
  }, []);

  return { isGuardActive, confirmEntered, resetAll };
}
