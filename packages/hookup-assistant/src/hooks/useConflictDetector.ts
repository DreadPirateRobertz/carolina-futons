/**
 * useConflictDetector — S11: detect nickname conflicts before applying an ID.
 *
 * A conflict occurs when the currently selected element already has a nickname
 * that differs from the target ID. Three outcomes:
 *
 *   'none'       — element has no nickname; proceed directly
 *   'already-set'— element already has the correct nickname; auto-advance
 *   'conflict'   — element has a *different* nickname; prompt for override
 *
 * The pure `detectConflict()` function encapsulates the branching logic so it
 * can be tested independently. The `useConflictDetector` hook wraps it with
 * React state for the pending-override UI flow.
 */

import { useState, useCallback } from 'react';

export type ConflictType = 'none' | 'conflict' | 'already-set';

export interface ConflictInfo {
  type: ConflictType;
  /** The nickname already on the element — null when type is 'none' */
  existingNickname: string | null;
}

/**
 * Pure conflict-detection function. No React dependency.
 *
 * @param currentNickname  The existing nickname on the element (null = none set)
 * @param targetId         The ID we intend to apply
 */
export function detectConflict(
  currentNickname: string | null,
  targetId: string,
): ConflictInfo {
  if (currentNickname === null) {
    return { type: 'none', existingNickname: null };
  }
  if (currentNickname === targetId) {
    return { type: 'already-set', existingNickname: currentNickname };
  }
  return { type: 'conflict', existingNickname: currentNickname };
}

/**
 * React hook wrapping conflict state for the panel override flow.
 *
 * `pendingConflict` is set to the existing nickname when a conflict is
 * detected and the panel is waiting for the user to choose Override or Cancel.
 * Clearing it dismisses the conflict banner.
 */
export function useConflictDetector() {
  const [pendingConflict, setPendingConflict] = useState<string | null>(null);

  const openConflict = useCallback((existingNickname: string) => {
    setPendingConflict(existingNickname);
  }, []);

  const clearConflict = useCallback(() => {
    setPendingConflict(null);
  }, []);

  return { pendingConflict, openConflict, clearConflict };
}
