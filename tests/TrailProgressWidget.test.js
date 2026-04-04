/**
 * @file TrailProgressWidget.test.js
 * @description Tests for CF-mcyh.3: TrailProgressWidget.
 *
 * Covers:
 *   - getCheckpointLabel — known IDs, unknown fallback
 *   - buildCheckpoints   — correct shape, isComplete flag, index, empty arrays
 *   - _CHALLENGE_LABELS  — all 15 Spring/Summer/Fall challenge IDs present
 *   - initTrailProgressWidget — header fields, repeater wiring, perk/complete section,
 *       early-return on missing trail, error resilience, element-throw resilience
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCheckpointLabel,
  buildCheckpoints,
  initTrailProgressWidget,
  _CHALLENGE_LABELS,
} from '../src/public/TrailProgressWidget.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeText() {
  let val = '';
  return { set text(v) { val = v; }, get text() { return val; }, hide: vi.fn(), show: vi.fn() };
}

function makeBox() {
  return { hide: vi.fn(), show: vi.fn() };
}

function makeRepeater() {
  let _data = [];
  return {
    onItemReady: vi.fn(),
    get data() { return _data; },
    set data(v) { _data = v; },
    hide: vi.fn(),
    show: vi.fn(),
  };
}

/**
 * Creates a minimal $w mock with named elements.
 * Repeater is shared; all others are created on first access.
 */
function make$w() {
  const elements = {};
  const repeater = makeRepeater();
  return vi.fn((selector) => {
    if (selector === '#checkpointRepeater') return repeater;
    if (!elements[selector]) elements[selector] = makeText();
    return elements[selector];
  });
}

function makeTrail(overrides = {}) {
  return {
    trailId: 'trail-spring',
    name: 'Spring Awakening',
    season: 'spring',
    theme: 'new beginnings',
    challengeIds: ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'],
    perkId: 'perk-free-shipping',
    completedChallengeIds: [],
    isComplete: false,
    completedAt: null,
    ...overrides,
  };
}

function makeGetFn(trails = [makeTrail()]) {
  return vi.fn().mockResolvedValue({ success: true, trails });
}

// ── getCheckpointLabel ────────────────────────────────────────────────────────

describe('getCheckpointLabel', () => {
  it('returns "First Purchase" for ch-first-purchase', () => {
    expect(getCheckpointLabel('ch-first-purchase')).toBe('First Purchase');
  });

  it('returns "Write a Review" for ch-write-review', () => {
    expect(getCheckpointLabel('ch-write-review')).toBe('Write a Review');
  });

  it('returns "Share a Room Photo" for ch-share-room-photo', () => {
    expect(getCheckpointLabel('ch-share-room-photo')).toBe('Share a Room Photo');
  });

  it('returns "Refer a Friend" for ch-refer-friend', () => {
    expect(getCheckpointLabel('ch-refer-friend')).toBe('Refer a Friend');
  });

  it('returns "Take the Sleep Quiz" for ch-sleep-quiz', () => {
    expect(getCheckpointLabel('ch-sleep-quiz')).toBe('Take the Sleep Quiz');
  });

  it('returns "3-Day Visit Streak" for ch-3day-streak', () => {
    expect(getCheckpointLabel('ch-3day-streak')).toBe('3-Day Visit Streak');
  });

  it('returns "Wishlist 3 Items" for ch-wishlist-3-items', () => {
    expect(getCheckpointLabel('ch-wishlist-3-items')).toBe('Wishlist 3 Items');
  });

  it('returns "Use Futon Studio" for ch-futon-studio', () => {
    expect(getCheckpointLabel('ch-futon-studio')).toBe('Use Futon Studio');
  });

  it('returns "Subscribe to Price Alerts" for ch-price-alert-subscribe', () => {
    expect(getCheckpointLabel('ch-price-alert-subscribe')).toBe('Subscribe to Price Alerts');
  });

  it('returns "Second Purchase" for ch-second-purchase', () => {
    expect(getCheckpointLabel('ch-second-purchase')).toBe('Second Purchase');
  });

  it('returns "7-Day Visit Streak" for ch-7day-streak', () => {
    expect(getCheckpointLabel('ch-7day-streak')).toBe('7-Day Visit Streak');
  });

  it('returns "Submit a Video Review" for ch-video-review', () => {
    expect(getCheckpointLabel('ch-video-review')).toBe('Submit a Video Review');
  });

  it('returns "Trade In a Piece" for ch-trade-in', () => {
    expect(getCheckpointLabel('ch-trade-in')).toBe('Trade In a Piece');
  });

  it('returns "Earn 1,000 Points" for ch-earn-1000-pts', () => {
    expect(getCheckpointLabel('ch-earn-1000-pts')).toBe('Earn 1,000 Points');
  });

  it('returns "Reach Mountain Guide" for ch-reach-mountain-guide', () => {
    expect(getCheckpointLabel('ch-reach-mountain-guide')).toBe('Reach Mountain Guide');
  });

  it('returns raw challengeId for unknown id', () => {
    expect(getCheckpointLabel('ch-unknown-challenge')).toBe('ch-unknown-challenge');
  });
});

// ── _CHALLENGE_LABELS ─────────────────────────────────────────────────────────

describe('_CHALLENGE_LABELS', () => {
  it('has all 15 Spring/Summer/Fall challenge IDs', () => {
    const expected = [
      'ch-first-purchase', 'ch-write-review', 'ch-share-room-photo',
      'ch-refer-friend', 'ch-sleep-quiz',
      'ch-3day-streak', 'ch-wishlist-3-items', 'ch-futon-studio',
      'ch-price-alert-subscribe', 'ch-second-purchase',
      'ch-7day-streak', 'ch-video-review', 'ch-trade-in',
      'ch-earn-1000-pts', 'ch-reach-mountain-guide',
    ];
    for (const id of expected) {
      expect(_CHALLENGE_LABELS).toHaveProperty(id);
      expect(typeof _CHALLENGE_LABELS[id]).toBe('string');
      expect(_CHALLENGE_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it('has exactly 15 entries', () => {
    expect(Object.keys(_CHALLENGE_LABELS)).toHaveLength(15);
  });
});

// ── buildCheckpoints ──────────────────────────────────────────────────────────

describe('buildCheckpoints', () => {
  const ALL_IDS = ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'];

  it('returns one checkpoint per challenge', () => {
    const result = buildCheckpoints(ALL_IDS, []);
    expect(result).toHaveLength(5);
  });

  it('sets _id to challengeId', () => {
    const result = buildCheckpoints(ALL_IDS, []);
    expect(result[0]._id).toBe('ch-first-purchase');
    expect(result[4]._id).toBe('ch-sleep-quiz');
  });

  it('sets isComplete true for completed challenges', () => {
    const result = buildCheckpoints(ALL_IDS, ['ch-first-purchase', 'ch-write-review']);
    expect(result[0].isComplete).toBe(true);
    expect(result[1].isComplete).toBe(true);
    expect(result[2].isComplete).toBe(false);
  });

  it('sets isComplete false for all when none completed', () => {
    const result = buildCheckpoints(ALL_IDS, []);
    expect(result.every(c => !c.isComplete)).toBe(true);
  });

  it('sets isComplete true for all when all completed', () => {
    const result = buildCheckpoints(ALL_IDS, ALL_IDS);
    expect(result.every(c => c.isComplete)).toBe(true);
  });

  it('sets label from getCheckpointLabel', () => {
    const result = buildCheckpoints(['ch-first-purchase'], []);
    expect(result[0].label).toBe('First Purchase');
  });

  it('sets index from array position', () => {
    const result = buildCheckpoints(ALL_IDS, []);
    expect(result[0].index).toBe(0);
    expect(result[4].index).toBe(4);
  });

  it('returns empty array for empty challengeIds', () => {
    expect(buildCheckpoints([], [])).toEqual([]);
  });

  it('does not mark incomplete challenges that are in completedChallengeIds out of order', () => {
    // Only exact ID match should set isComplete
    const result = buildCheckpoints(['ch-sleep-quiz', 'ch-refer-friend'], ['ch-sleep-quiz']);
    expect(result[0].isComplete).toBe(true);
    expect(result[1].isComplete).toBe(false);
  });
});

// ── initTrailProgressWidget ───────────────────────────────────────────────────

describe('initTrailProgressWidget', () => {
  let $w;

  beforeEach(() => {
    $w = make$w();
  });

  // ── Early returns ───────────────────────────────────────────────────────────

  it('returns early and hides section when getTrailProgress returns success:false', async () => {
    const getFn = vi.fn().mockResolvedValue({ success: false, trails: [] });
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressSection').hide).toHaveBeenCalled();
    expect($w('#trailProgressSection').show).not.toHaveBeenCalled();
  });

  it('returns early when the requested trailId is not in the response', async () => {
    const getFn = makeGetFn([makeTrail({ trailId: 'trail-summer' })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressSection').show).not.toHaveBeenCalled();
  });

  it('returns early and keeps section hidden when getTrailProgress throws', async () => {
    const getFn = vi.fn().mockRejectedValue(new Error('Network error'));
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressSection').show).not.toHaveBeenCalled();
  });

  it('returns early when trails array is empty', async () => {
    const getFn = makeGetFn([]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressSection').show).not.toHaveBeenCalled();
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  it('sets trail name', async () => {
    const getFn = makeGetFn([makeTrail({ name: 'Spring Awakening' })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressTitle').text).toBe('Spring Awakening');
  });

  it('sets trail theme', async () => {
    const getFn = makeGetFn([makeTrail({ theme: 'new beginnings' })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressTheme').text).toBe('new beginnings');
  });

  it('sets progress count as "X / Y challenges"', async () => {
    const trail = makeTrail({ completedChallengeIds: ['ch-first-purchase', 'ch-write-review'] });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressCount').text).toBe('2 / 5 challenges');
  });

  it('sets progress count as "0 / 5 challenges" when none completed', async () => {
    const getFn = makeGetFn([makeTrail({ completedChallengeIds: [] })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressCount').text).toBe('0 / 5 challenges');
  });

  it('sets progress count as "5 / 5 challenges" when fully complete', async () => {
    const ids = ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'];
    const trail = makeTrail({ completedChallengeIds: ids, isComplete: true });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressCount').text).toBe('5 / 5 challenges');
  });

  // ── Checkpoint repeater ─────────────────────────────────────────────────────

  it('wires onItemReady on the checkpoint repeater', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    const repeater = $w('#checkpointRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('sets repeater data with 5 checkpoints for Spring trail', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    const repeater = $w('#checkpointRepeater');
    expect(repeater.data).toHaveLength(5);
  });

  it('each checkpoint has _id, label, isComplete, index', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    const { data } = $w('#checkpointRepeater');
    for (const cp of data) {
      expect(cp).toHaveProperty('_id');
      expect(cp).toHaveProperty('label');
      expect(cp).toHaveProperty('isComplete');
      expect(cp).toHaveProperty('index');
    }
  });

  it('marks completed checkpoints as isComplete:true', async () => {
    const trail = makeTrail({ completedChallengeIds: ['ch-first-purchase'] });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    const { data } = $w('#checkpointRepeater');
    expect(data[0].isComplete).toBe(true);
    expect(data[1].isComplete).toBe(false);
  });

  it('onItemReady callback shows completeIcon and hides incompleteIcon for done checkpoint', async () => {
    const trail = makeTrail({ completedChallengeIds: ['ch-first-purchase'] });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });

    const repeater = $w('#checkpointRepeater');
    const handler = repeater.onItemReady.mock.calls[0][0];

    // Cache elements so the same instance is returned on repeated calls
    const itemEls = {};
    const $item = vi.fn((selector) => {
      if (!itemEls[selector]) itemEls[selector] = makeBox();
      return itemEls[selector];
    });
    handler($item, { _id: 'ch-first-purchase', label: 'First Purchase', isComplete: true, index: 0 });

    expect(itemEls['#checkpointCompleteIcon'].show).toHaveBeenCalled();
    expect(itemEls['#checkpointIncompleteIcon'].hide).toHaveBeenCalled();
  });

  it('onItemReady callback hides completeIcon and shows incompleteIcon for pending checkpoint', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });

    const repeater = $w('#checkpointRepeater');
    const handler = repeater.onItemReady.mock.calls[0][0];

    const itemEls = {};
    const $item = vi.fn((selector) => {
      if (!itemEls[selector]) itemEls[selector] = makeBox();
      return itemEls[selector];
    });
    handler($item, { _id: 'ch-write-review', label: 'Write a Review', isComplete: false, index: 1 });

    expect(itemEls['#checkpointIncompleteIcon'].show).toHaveBeenCalled();
    expect(itemEls['#checkpointCompleteIcon'].hide).toHaveBeenCalled();
  });

  it('onItemReady sets checkpoint label text', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });

    const repeater = $w('#checkpointRepeater');
    const handler = repeater.onItemReady.mock.calls[0][0];

    const elements = {};
    const $item = vi.fn((selector) => {
      if (!elements[selector]) elements[selector] = makeText();
      return elements[selector];
    });
    handler($item, { _id: 'ch-first-purchase', label: 'First Purchase', isComplete: false, index: 0 });

    expect(elements['#checkpointLabel'].text).toBe('First Purchase');
  });

  // ── Perk section — incomplete trail ────────────────────────────────────────

  it('hides perkSection when trail is not complete', async () => {
    const getFn = makeGetFn([makeTrail({ isComplete: false })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailPerkSection').hide).toHaveBeenCalled();
    expect($w('#trailPerkSection').show).not.toHaveBeenCalled();
  });

  it('hides trailCompleteMsg when trail is not complete', async () => {
    const getFn = makeGetFn([makeTrail({ isComplete: false })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailCompleteMsg').hide).toHaveBeenCalled();
    expect($w('#trailCompleteMsg').show).not.toHaveBeenCalled();
  });

  it('still sets perkReward label when trail is not complete (shows as target)', async () => {
    const getFn = makeGetFn([makeTrail({ perkId: 'perk-free-shipping', isComplete: false })]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailPerkReward').text).toBe('Free Shipping');
  });

  // ── Perk section — complete trail ──────────────────────────────────────────

  it('shows perkSection when trail is complete', async () => {
    const ids = ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'];
    const trail = makeTrail({ completedChallengeIds: ids, isComplete: true });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailPerkSection').show).toHaveBeenCalled();
  });

  it('shows trailCompleteMsg when trail is complete', async () => {
    const ids = ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'];
    const trail = makeTrail({ completedChallengeIds: ids, isComplete: true });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailCompleteMsg').show).toHaveBeenCalled();
  });

  it('sets perkReward label from perkId on completed trail', async () => {
    const ids = ['ch-first-purchase', 'ch-write-review', 'ch-share-room-photo', 'ch-refer-friend', 'ch-sleep-quiz'];
    const trail = makeTrail({ completedChallengeIds: ids, isComplete: true, perkId: 'perk-early-access' });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailPerkReward').text).toBe('Early Access');
  });

  it('sets perk label "Free Styling Call" for perk-styling-call', async () => {
    const trail = makeTrail({ perkId: 'perk-styling-call', isComplete: false });
    const getFn = makeGetFn([trail]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailPerkReward').text).toBe('Free Styling Call');
  });

  // ── Outer section visibility ────────────────────────────────────────────────

  it('shows trailProgressSection after successful render', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressSection').show).toHaveBeenCalled();
  });

  it('hides trailProgressSection before async load (initial state)', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-1', 'trail-spring', { $w, getTrailProgress: getFn });
    // hide should have been called first (before show), in the right order
    const hideCalls = $w('#trailProgressSection').hide.mock.invocationCallOrder;
    const showCalls = $w('#trailProgressSection').show.mock.invocationCallOrder;
    expect(hideCalls[0]).toBeLessThan(showCalls[0]);
  });

  // ── Correct trailId selection ───────────────────────────────────────────────

  it('passes memberId to getTrailProgress', async () => {
    const getFn = makeGetFn([makeTrail()]);
    await initTrailProgressWidget('member-xyz', 'trail-spring', { $w, getTrailProgress: getFn });
    expect(getFn).toHaveBeenCalledWith('member-xyz');
  });

  it('renders the correct trail when response contains multiple trails', async () => {
    const trails = [
      makeTrail({ trailId: 'trail-spring', name: 'Spring Awakening' }),
      makeTrail({ trailId: 'trail-summer', name: 'Summer Stride' }),
    ];
    const getFn = makeGetFn(trails);
    await initTrailProgressWidget('member-1', 'trail-summer', { $w, getTrailProgress: getFn });
    expect($w('#trailProgressTitle').text).toBe('Summer Stride');
  });

  // ── Element throw resilience ────────────────────────────────────────────────

  it('does not throw if individual $w element access throws', async () => {
    const throwingW = vi.fn((selector) => {
      if (selector === '#trailProgressTitle') throw new Error('Element not found');
      return makeText();
    });
    const getFn = makeGetFn([makeTrail()]);
    // Should not throw despite the element error
    await expect(
      initTrailProgressWidget('member-1', 'trail-spring', { $w: throwingW, getTrailProgress: getFn })
    ).resolves.toBeUndefined();
  });

  it('does not throw if checkpointRepeater onItemReady throws', async () => {
    const brokenRepeater = {
      onItemReady: vi.fn(() => { throw new Error('Repeater error'); }),
      get data() { return []; },
      set data(_v) {},
      hide: vi.fn(),
      show: vi.fn(),
    };
    const broken$w = vi.fn((selector) => {
      if (selector === '#checkpointRepeater') return brokenRepeater;
      return makeText();
    });
    const getFn = makeGetFn([makeTrail()]);
    await expect(
      initTrailProgressWidget('member-1', 'trail-spring', { $w: broken$w, getTrailProgress: getFn })
    ).resolves.toBeUndefined();
  });
});
