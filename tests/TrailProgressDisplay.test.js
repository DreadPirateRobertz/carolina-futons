/**
 * @file TrailProgressDisplay.test.js
 * @description Tests for CF-mcyh.3: Trail Progress UI component.
 *
 * Tests:
 *   - formatPerkLabel — known perk ids, unknown fallback
 *   - formatTrailProgress — various completion states
 *   - formatCompletedAt — null, valid date, ISO string, invalid
 *   - renderTrailCard — sets all elements correctly; complete/incomplete states
 *   - renderTrailsRail — sets repeater data with _id, wires onItemReady
 *   - initTrailsDisplay — shows section on success, hides on empty, hides on error
 */

import { describe, it, expect, vi } from 'vitest';
import {
  formatPerkLabel,
  formatTrailProgress,
  formatCompletedAt,
  renderTrailCard,
  renderTrailsRail,
  initTrailsDisplay,
} from '../src/public/TrailProgressDisplay.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeText() {
  let val = '';
  return { set text(v) { val = v; }, get text() { return val; }, hide: vi.fn(), show: vi.fn() };
}

function makeProgressBar() {
  let val = 0;
  return { set value(v) { val = v; }, get value() { return val; } };
}

function makeBox() {
  return { hide: vi.fn(), show: vi.fn() };
}

function makeElements() {
  return {
    $trailName: makeText(),
    $trailTheme: makeText(),
    $progressBar: makeProgressBar(),
    $progressLabel: makeText(),
    $perkLabel: makeText(),
    $completedBadge: makeBox(),
    $completedAtLabel: makeText(),
  };
}

function makeTrail(overrides = {}) {
  return {
    trailId: 'trail-spring',
    name: 'Spring Awakening',
    season: 'spring',
    theme: 'new beginnings',
    challengeIds: ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'],
    perkId: 'perk-free-shipping',
    completedChallengeIds: [],
    isComplete: false,
    completedAt: null,
    ...overrides,
  };
}

// ── formatPerkLabel ───────────────────────────────────────────────────────────

describe('formatPerkLabel', () => {
  it('returns "Free Shipping" for perk-free-shipping', () => {
    expect(formatPerkLabel('perk-free-shipping')).toBe('Free Shipping');
  });

  it('returns "Early Access" for perk-early-access', () => {
    expect(formatPerkLabel('perk-early-access')).toBe('Early Access');
  });

  it('returns "Free Styling Call" for perk-styling-call', () => {
    expect(formatPerkLabel('perk-styling-call')).toBe('Free Styling Call');
  });

  it('returns raw perkId for unknown perk', () => {
    expect(formatPerkLabel('perk-unknown-thing')).toBe('perk-unknown-thing');
  });
});

// ── formatTrailProgress ───────────────────────────────────────────────────────

describe('formatTrailProgress', () => {
  it('returns "0 / 5 challenges" when no challenges completed', () => {
    expect(formatTrailProgress([], ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'])).toBe('0 / 5 challenges');
  });

  it('returns "3 / 5 challenges" for partial progress', () => {
    expect(formatTrailProgress(['ch-1', 'ch-2', 'ch-3'], ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'])).toBe('3 / 5 challenges');
  });

  it('returns "5 / 5 challenges" when fully complete', () => {
    const ids = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'];
    expect(formatTrailProgress(ids, ids)).toBe('5 / 5 challenges');
  });
});

// ── formatCompletedAt ─────────────────────────────────────────────────────────

describe('formatCompletedAt', () => {
  it('returns "" for null', () => {
    expect(formatCompletedAt(null)).toBe('');
  });

  it('returns "" for undefined', () => {
    expect(formatCompletedAt(undefined)).toBe('');
  });

  it('formats ISO string to "Apr 1"', () => {
    expect(formatCompletedAt('2026-04-01T00:00:00Z')).toBe('Apr 1');
  });

  it('formats Date object', () => {
    expect(formatCompletedAt(new Date('2026-03-22T00:00:00Z'))).toBe('Mar 22');
  });

  it('returns "" for an invalid date string', () => {
    expect(formatCompletedAt('not-a-date')).toBe('');
  });
});

// ── renderTrailCard ───────────────────────────────────────────────────────────

describe('renderTrailCard', () => {
  it('sets trail name', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ name: 'Spring Awakening' }));
    expect(els.$trailName.text).toBe('Spring Awakening');
  });

  it('sets trail theme', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ theme: 'new beginnings' }));
    expect(els.$trailTheme.text).toBe('new beginnings');
  });

  it('sets progress label as "X / Y challenges"', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ completedChallengeIds: ['ch-1', 'ch-2'] }));
    expect(els.$progressLabel.text).toBe('2 / 5 challenges');
  });

  it('sets progress bar value as percentage (0 / 5 = 0)', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ completedChallengeIds: [] }));
    expect(els.$progressBar.value).toBe(0);
  });

  it('sets progress bar value as percentage (3 / 5 = 60)', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ completedChallengeIds: ['ch-1', 'ch-2', 'ch-3'] }));
    expect(els.$progressBar.value).toBeCloseTo(60, 0);
  });

  it('sets progress bar to 100 when fully complete', () => {
    const ids = ['ch-1', 'ch-2', 'ch-3', 'ch-4', 'ch-5'];
    const els = makeElements();
    renderTrailCard(els, makeTrail({ completedChallengeIds: ids, isComplete: true }));
    expect(els.$progressBar.value).toBe(100);
  });

  it('sets perk label from perkId', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ perkId: 'perk-early-access' }));
    expect(els.$perkLabel.text).toBe('Early Access');
  });

  it('hides completedBadge and clears completedAtLabel when not complete', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ isComplete: false, completedAt: null }));
    expect(els.$completedBadge.hide).toHaveBeenCalled();
    expect(els.$completedAtLabel.text).toBe('');
  });

  it('shows completedBadge when isComplete is true', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ isComplete: true, completedAt: '2026-03-20T00:00:00Z' }));
    expect(els.$completedBadge.show).toHaveBeenCalled();
  });

  it('sets completedAtLabel with formatted date when complete', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ isComplete: true, completedAt: '2026-03-20T00:00:00Z' }));
    expect(els.$completedAtLabel.text).toBe('Completed Mar 20');
  });

  it('sets completedAtLabel to "Completed" when completedAt is null but isComplete is true', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ isComplete: true, completedAt: null }));
    expect(els.$completedAtLabel.text).toBe('Completed');
  });

  it('sets progress bar to 0 when challengeIds is empty (guard against divide-by-zero)', () => {
    const els = makeElements();
    renderTrailCard(els, makeTrail({ challengeIds: [], completedChallengeIds: [] }));
    expect(els.$progressBar.value).toBe(0);
  });
});

// ── renderTrailsRail ──────────────────────────────────────────────────────────

describe('renderTrailsRail', () => {
  it('sets repeater data with _id derived from trailId', () => {
    const $trailsList = { data: [], onItemReady: vi.fn() };
    const trails = [
      makeTrail({ trailId: 'trail-spring' }),
      makeTrail({ trailId: 'trail-summer', name: 'Summer Stride' }),
    ];
    renderTrailsRail($trailsList, trails);
    expect($trailsList.data).toHaveLength(2);
    expect($trailsList.data[0]._id).toBe('trail-spring');
    expect($trailsList.data[1]._id).toBe('trail-summer');
  });

  it('registers onItemReady handler', () => {
    const $trailsList = { data: [], onItemReady: vi.fn() };
    renderTrailsRail($trailsList, [makeTrail()]);
    expect($trailsList.onItemReady).toHaveBeenCalled();
  });

  it('preserves all trail fields in repeater data', () => {
    const $trailsList = { data: [], onItemReady: vi.fn() };
    const trail = makeTrail({ completedChallengeIds: ['ch-1', 'ch-2'] });
    renderTrailsRail($trailsList, [trail]);
    expect($trailsList.data[0].completedChallengeIds).toEqual(['ch-1', 'ch-2']);
  });

  it('handles empty trails array', () => {
    const $trailsList = { data: [], onItemReady: vi.fn() };
    renderTrailsRail($trailsList, []);
    expect($trailsList.data).toHaveLength(0);
  });
});

// ── initTrailsDisplay ─────────────────────────────────────────────────────────

describe('initTrailsDisplay', () => {
  function makeSection() {
    return { hide: vi.fn(), show: vi.fn() };
  }

  function makeRepeater() {
    return { data: [], onItemReady: vi.fn() };
  }

  it('shows section and renders rail when trails are returned', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const trails = [makeTrail(), makeTrail({ trailId: 'trail-summer', name: 'Summer Stride' })];
    const getFn = vi.fn().mockResolvedValue({ success: true, trails });

    await initTrailsDisplay('member-1', getFn, $section, $list);

    expect($section.show).toHaveBeenCalled();
    expect($list.data).toHaveLength(2);
  });

  it('hides section when trails array is empty', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const getFn = vi.fn().mockResolvedValue({ success: true, trails: [] });

    await initTrailsDisplay('member-1', getFn, $section, $list);

    expect($section.hide).toHaveBeenCalled();
    expect($section.show).not.toHaveBeenCalled();
  });

  it('hides section when response has no trails property', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const getFn = vi.fn().mockResolvedValue({ success: false });

    await initTrailsDisplay('member-1', getFn, $section, $list);

    expect($section.hide).toHaveBeenCalled();
  });

  it('hides section on thrown error (non-critical)', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const getFn = vi.fn().mockRejectedValue(new Error('DB failure'));

    await initTrailsDisplay('member-1', getFn, $section, $list);

    expect($section.hide).toHaveBeenCalled();
    expect($section.show).not.toHaveBeenCalled();
  });

  it('passes memberId to the getTrailProgressFn', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const getFn = vi.fn().mockResolvedValue({ success: true, trails: [] });

    await initTrailsDisplay('member-xyz', getFn, $section, $list);

    expect(getFn).toHaveBeenCalledWith('member-xyz');
  });

  it('renders all 3 trails from a full response', async () => {
    const $section = makeSection();
    const $list = makeRepeater();
    const trails = [
      makeTrail({ trailId: 'trail-spring' }),
      makeTrail({ trailId: 'trail-summer', name: 'Summer Stride' }),
      makeTrail({ trailId: 'trail-fall', name: 'Fall Harvest' }),
    ];
    const getFn = vi.fn().mockResolvedValue({ success: true, trails });

    await initTrailsDisplay('member-1', getFn, $section, $list);

    expect($list.data).toHaveLength(3);
    expect($list.data.map(d => d._id)).toEqual(['trail-spring', 'trail-summer', 'trail-fall']);
  });
});
