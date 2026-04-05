/**
 * @module TrailProgressWidget
 * @description Self-contained Blue Ridge Trail progress widget.
 * Renders a single trail as a 5-checkpoint visual path: each challenge
 * shows its completion state, and the perk badge appears at the end once
 * the trail is fully complete.
 *
 * Elements (Wix editor nicknames):
 *   trailProgressSection      — Box: outer container (hidden until data loads)
 *   trailProgressTitle        — Text: trail name
 *   trailProgressTheme        — Text: trail theme
 *   trailProgressCount        — Text: "X / 5 challenges"
 *   checkpointRepeater        — Repeater: one item per challenge (5 total)
 *     ↳ checkpointLabel       — Text: human-readable challenge name
 *     ↳ checkpointCompleteIcon — Box: visible when checkpoint done
 *     ↳ checkpointIncompleteIcon — Box: visible when checkpoint not yet done
 *   trailPerkSection          — Box: perk reveal (shown only on full completion)
 *   trailPerkReward           — Text: human-readable perk name
 *   trailCompleteMsg          — Box: "Trail Complete!" banner (shown on completion)
 *
 * CF-mcyh.3
 */

import { getTrailProgress as _defaultGetTrailProgress } from 'backend/challengeService.web';
import { formatPerkLabel } from 'public/TrailProgressDisplay.js';

// ── Challenge label map ───────────────────────────────────────────────────────

const CHALLENGE_LABELS = {
  'ch-first-purchase':        'First Purchase',
  'ch-write-review':          'Write a Review',
  'ch-share-room-photo':      'Share a Room Photo',
  'ch-refer-friend':          'Refer a Friend',
  'ch-sleep-quiz':            'Take the Sleep Quiz',
  'ch-3day-streak':           '3-Day Visit Streak',
  'ch-wishlist-3-items':      'Wishlist 3 Items',
  'ch-futon-studio':          'Use Futon Studio',
  'ch-price-alert-subscribe': 'Subscribe to Price Alerts',
  'ch-second-purchase':       'Second Purchase',
  'ch-7day-streak':           '7-Day Visit Streak',
  'ch-video-review':          'Submit a Video Review',
  'ch-trade-in':              'Trade In a Piece',
  'ch-earn-1000-pts':         'Earn 1,000 Points',
  'ch-reach-mountain-guide':  'Reach Mountain Guide',
};

/**
 * Returns a human-readable label for a challenge ID.
 * Falls back to the raw challengeId if not in the map.
 * @param {string} challengeId
 * @returns {string}
 */
export function getCheckpointLabel(challengeId) {
  return CHALLENGE_LABELS[challengeId] || challengeId;
}

/**
 * Builds an array of checkpoint objects from trail challenge data.
 * Each checkpoint carries the label and its completion state so the
 * repeater onItemReady handler needs no extra logic.
 *
 * @param {string[]} challengeIds
 * @param {string[]} completedChallengeIds
 * @returns {{ _id: string, label: string, isComplete: boolean, index: number }[]}
 */
export function buildCheckpoints(challengeIds, completedChallengeIds) {
  const doneSet = new Set(completedChallengeIds);
  return challengeIds.map((id, index) => ({
    _id: id,
    label: getCheckpointLabel(id),
    isComplete: doneSet.has(id),
    index,
  }));
}

// ── initTrailProgressWidget ───────────────────────────────────────────────────

/**
 * Initialises the Trail Progress widget for a single trail.
 *
 * Fetches progress for the authenticated member (server-side), locates `trailId`
 * in the response, then populates the checkpoint repeater and perk section.
 * Hides the outer section and returns early on any error or missing trail.
 *
 * @param {string}   memberId   — (legacy, unused — memberId derived server-side)
 * @param {string}   trailId    — trail to display (e.g. 'trail-spring')
 * @param {Object}   [opts]     — injectable overrides for testing
 * @param {Function} [opts.$w]
 * @param {Function} [opts.getTrailProgress]
 * @returns {Promise<void>}
 */
export async function initTrailProgressWidget(memberId, trailId, opts = {}) {
  const $w               = opts.$w               ?? globalThis.$w;
  const getTrailProgress = opts.getTrailProgress  ?? (() => _defaultGetTrailProgress());

  // Start hidden — reveal once we have data.
  try { $w('#trailProgressSection').hide(); } catch (e) {}

  // ── Fetch trail progress ────────────────────────────────────────────────────
  let trail;
  try {
    const response = await getTrailProgress();
    if (!response?.success) return;
    trail = (response.trails || []).find(t => t.trailId === trailId);
    if (!trail) return;
  } catch (_) {
    return; // Non-fatal — outer section stays hidden.
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  try { $w('#trailProgressTitle').text = trail.name; } catch (e) {}
  try { $w('#trailProgressTheme').text = trail.theme; } catch (e) {}
  try {
    $w('#trailProgressCount').text =
      `${trail.completedChallengeIds.length} / ${trail.challengeIds.length} challenges`;
  } catch (e) {}

  // ── Checkpoint repeater ─────────────────────────────────────────────────────
  // Wire onItemReady BEFORE setting .data (Wix repeater requirement).
  try {
    $w('#checkpointRepeater').onItemReady(($item, itemData) => {
      try { $item('#checkpointLabel').text = itemData.label; } catch (e) {}
      if (itemData.isComplete) {
        try { $item('#checkpointCompleteIcon').show(); } catch (e) {}
        try { $item('#checkpointIncompleteIcon').hide(); } catch (e) {}
      } else {
        try { $item('#checkpointCompleteIcon').hide(); } catch (e) {}
        try { $item('#checkpointIncompleteIcon').show(); } catch (e) {}
      }
    });
  } catch (e) {}

  try {
    $w('#checkpointRepeater').data = buildCheckpoints(
      trail.challengeIds,
      trail.completedChallengeIds
    );
  } catch (e) {}

  // ── Perk / completion section ───────────────────────────────────────────────
  // Always populate the reward label (visible in progress as a target hint).
  try { $w('#trailPerkReward').text = formatPerkLabel(trail.perkId); } catch (e) {}

  if (trail.isComplete) {
    try { $w('#trailPerkSection').show(); } catch (e) {}
    try { $w('#trailCompleteMsg').show(); } catch (e) {}
  } else {
    try { $w('#trailPerkSection').hide(); } catch (e) {}
    try { $w('#trailCompleteMsg').hide(); } catch (e) {}
  }

  // ── Reveal ──────────────────────────────────────────────────────────────────
  try { $w('#trailProgressSection').show(); } catch (e) {}
}

// Export for testing
export const _CHALLENGE_LABELS = CHALLENGE_LABELS;
