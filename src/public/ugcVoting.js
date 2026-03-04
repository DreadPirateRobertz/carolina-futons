/**
 * ugcVoting.js — UGC voting helper with optimistic UI
 *
 * Manages vote state for user-generated content photos using
 * sessionStorage for local state and backend for persistence.
 *
 * @module public/ugcVoting
 */

import { voteForPhoto } from 'backend/ugcService.web';
import { trackEvent } from 'public/engagementTracker.js';
import { announce } from 'public/a11yHelpers.js';
import { session } from 'wix-storage-frontend';

/** @constant {string} Storage key for voted photo IDs */
const STORAGE_KEY = 'ugc_voted_photos';

/**
 * Safely read the voted photo IDs array from sessionStorage.
 * Handles null, corrupted JSON, and non-array values.
 * @returns {string[]} Array of voted photo ID strings (empty array on error)
 */
function readVotedIds() {
  try {
    const raw = session.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * Safely write voted photo IDs array to sessionStorage.
 * @param {string[]} ids - Array of photo ID strings to persist
 */
function writeVotedIds(ids) {
  try {
    session.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage write failed — silently degrade
  }
}

/**
 * Check whether the current user has voted for a given photo in this session.
 * @param {string} photoId - The photo ID to check
 * @returns {boolean} True if the photo has been voted for
 */
export function isVotedByUser(photoId) {
  try {
    if (!photoId) return false;
    const ids = readVotedIds();
    return ids.includes(photoId);
  } catch {
    return false;
  }
}

/**
 * Get all voted photo IDs from sessionStorage.
 * Returns a fresh copy each call so mutations do not affect stored state.
 * @returns {string[]} Array of voted photo ID strings
 */
export function getVotedPhotoIds() {
  try {
    return [...readVotedIds()];
  } catch {
    return [];
  }
}

/**
 * Handle a vote/unvote click for a photo. Calls the backend, updates
 * sessionStorage on success, tracks the event, and announces the result
 * for screen readers.
 *
 * @param {Function} $w - Wix Velo selector function
 * @param {string} photoId - The photo ID to vote for
 * @param {number} currentCount - The current vote count (for optimistic UI)
 * @returns {Promise<{success: boolean, voted?: boolean, newCount?: number, error?: string}>}
 */
export async function handleVoteClick($w, photoId, currentCount) {
  try {
    if (!photoId) {
      return { success: false, error: 'Invalid photoId' };
    }

    const result = await voteForPhoto(photoId);

    if (!result || !result.success) {
      return { success: false, error: (result && result.error) || 'Vote failed' };
    }

    // Update sessionStorage based on backend response
    try {
      const ids = readVotedIds();
      if (result.voted) {
        if (!ids.includes(photoId)) {
          ids.push(photoId);
        }
      } else {
        const idx = ids.indexOf(photoId);
        if (idx !== -1) {
          ids.splice(idx, 1);
        }
      }
      writeVotedIds(ids);
    } catch {
      // Storage update failed — vote still succeeded on backend
    }

    // Track engagement event
    try {
      trackEvent('ugc_vote', { photoId, voted: result.voted });
    } catch {
      // Tracking failure is non-critical
    }

    // Announce for screen readers
    try {
      const message = result.voted
        ? 'Vote added'
        : 'Vote removed';
      announce($w, message);
    } catch {
      // Announce failure is non-critical
    }

    return result;
  } catch (err) {
    return { success: false, error: err && err.message ? err.message : 'Vote failed' };
  }
}

/**
 * Sync local vote state with the backend for a batch of photo IDs.
 * Preserves any existing voted photos not in the sync batch.
 *
 * @param {string[]} photoIds - Array of photo IDs to sync
 * @returns {Promise<void>}
 */
export async function syncVoteState(photoIds) {
  try {
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return;
    }

    const existingIds = readVotedIds();
    // IDs that are NOT in the sync batch — preserve them
    const preserved = existingIds.filter((id) => !photoIds.includes(id));

    const votedInBatch = [];

    for (const id of photoIds) {
      try {
        const result = await voteForPhoto(id);
        if (result && result.success && result.voted) {
          votedInBatch.push(id);
        }
      } catch {
        // Individual sync failure — skip this ID
      }
    }

    writeVotedIds([...preserved, ...votedInBatch]);
  } catch {
    // Sync failed entirely — keep existing state
  }
}

/**
 * Initialize the voting UI by wiring click handlers on vote elements.
 *
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} opts - Configuration options
 * @param {boolean} [opts.animateOnVote] - Whether to animate on vote
 */
export function initVoting($w, opts) {
  try {
    if (!$w) return;

    const _opts = opts || {};

    try {
      const voteBtn = $w('#ugcVoteButton');
      voteBtn.onClick(() => {
        try {
          const countEl = $w('#ugcVoteCount');
          const currentCount = parseInt(countEl.text, 10) || 0;
          // Fire and forget — UI update handled by handleVoteClick
          handleVoteClick($w, '', currentCount);
        } catch {
          // Count element may not exist
        }
      });
    } catch {
      // Vote button element not found — no handlers to set up
    }
  } catch {
    // Initialization failed gracefully
  }
}
