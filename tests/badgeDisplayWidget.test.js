/**
 * @file badgeDisplayWidget.test.js
 * @description Tests for CF-hgmo: BadgeDisplayWidget — show earned badges on member dashboard.
 *
 * Covers:
 *  - no badges: shows #noBadgesMsg, hides #badgeRepeater
 *  - badges present: hides #noBadgesMsg, shows #badgeRepeater
 *  - repeater data set to badges array
 *  - #badgeIcon src set from getBadgeIcon() inline SVG (not broken PNG path)
 *  - #badgeName text set from label
 *  - #badgeDate formatted as "Earned MM/DD/YYYY"
 *  - new badge (notified:false) gets "badge-new" class on item container
 *  - notified badge does not get "badge-new" class
 *  - markBadgeNotified called only for unnotified badges
 *  - markBadgeNotified not called for already-notified badges
 *  - does not throw when getMemberBadges rejects
 *
 * CF-hgmo
 */
import { describe, it, expect, vi } from 'vitest';
import { initBadgeDisplayWidget } from '../src/public/BadgeDisplayWidget.js';
import { getBadgeIcon } from '../src/public/badgeIcons.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    src: '',
    _visible: true,
    _classes: [],
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    addClass: vi.fn(function (cls) { this._classes.push(cls); }),
  };
}

/**
 * Build a $w mock that tracks repeater data and onItemReady callbacks.
 * Returns a $w function plus helpers to fire item-ready callbacks manually.
 */
function make$w() {
  const repeater = {
    ...makeEl(),
    data: null,
    _onItemReady: null,
    onItemReady: vi.fn(function (cb) { this._onItemReady = cb; }),
  };

  const els = {
    '#badgeRepeater': repeater,
    '#noBadgesMsg':   makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._repeater = repeater;
  $w._noBadgesMsg = els['#noBadgesMsg'];
  return $w;
}

/**
 * Simulate repeater firing onItemReady for a single item.
 * Returns the $item proxy (callable as $item(selector) and has .addClass / ._els).
 */
function fireItemReady($w, itemData) {
  const $item = (sel) => {
    if (!$item._els[sel]) $item._els[sel] = makeEl();
    return $item._els[sel];
  };
  $item._els = {};
  $item._classes = [];
  $item.addClass = vi.fn((cls) => { $item._classes.push(cls); });

  $w._repeater._onItemReady?.($item, itemData);
  return $item;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';

function makeBadge(overrides = {}) {
  return {
    badgeId:   'first_purchase',
    label:     'First Purchase',
    awardedAt: new Date('2025-06-15T12:00:00Z'),
    notified:  false,
    ...overrides,
  };
}

function makeOpts($w, badges, markBadgeNotified = vi.fn().mockResolvedValue({ updated: true })) {
  return {
    $w,
    getMemberBadges:   vi.fn().mockResolvedValue(badges),
    markBadgeNotified,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('no badges', () => {
  it('shows #noBadgesMsg when getMemberBadges returns empty array', async () => {
    const $w = make$w();
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, []));
    expect($w._noBadgesMsg.show).toHaveBeenCalled();
  });

  it('hides #badgeRepeater when no badges', async () => {
    const $w = make$w();
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, []));
    expect($w._repeater.hide).toHaveBeenCalled();
  });
});

describe('badges present', () => {
  it('hides #noBadgesMsg when badges exist', async () => {
    const $w = make$w();
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [makeBadge()]));
    expect($w._noBadgesMsg.hide).toHaveBeenCalled();
  });

  it('shows #badgeRepeater when badges exist', async () => {
    const $w = make$w();
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [makeBadge()]));
    expect($w._repeater.show).toHaveBeenCalled();
  });

  it('sets repeater data to the badges array', async () => {
    const $w = make$w();
    const badges = [makeBadge()];
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, badges));
    expect($w._repeater.data).toBe(badges);
  });

  it('registers onItemReady callback', async () => {
    const $w = make$w();
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [makeBadge()]));
    expect($w._repeater.onItemReady).toHaveBeenCalled();
  });
});

describe('repeater item rendering', () => {
  it('sets #badgeIcon src as data URI wrapping getBadgeIcon() SVG', async () => {
    const $w = make$w();
    const badge = makeBadge({ badgeId: 'first_step' }); // first_step is in BADGE_REGISTRY
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    const src = $item._els['#badgeIcon'].src;
    expect(src).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(src).not.toContain('/images/badges/');
  });

  it('sets #badgeIcon src to empty string when getBadgeIcon returns non-SVG', async () => {
    // badge ID not in registry → getBadgeIcon returns '' (no <svg prefix)
    const $w = make$w();
    const badge = makeBadge({ badgeId: 'unknown_badge_xyz' });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item._els['#badgeIcon'].src).toBe('');
  });

  it('sets #badgeName text from badge label', async () => {
    const $w = make$w();
    const badge = makeBadge({ label: 'First Purchase' });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item._els['#badgeName'].text).toBe('First Purchase');
  });

  it('sets #badgeDate as "Earned MM/DD/YYYY"', async () => {
    const $w = make$w();
    const badge = makeBadge({ awardedAt: new Date('2025-06-15T12:00:00Z') });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item._els['#badgeDate'].text).toBe('Earned 06/15/2025');
  });

  it('formats awardedAt from ISO string', async () => {
    const $w = make$w();
    const badge = makeBadge({ awardedAt: '2024-01-03T12:00:00Z' });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item._els['#badgeDate'].text).toBe('Earned 01/03/2024');
  });
});

describe('new badge highlight (badge-new class)', () => {
  it('adds "badge-new" class to item container for unnotified badge', async () => {
    const $w = make$w();
    const badge = makeBadge({ notified: false });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item.addClass).toHaveBeenCalledWith('badge-new');
  });

  it('does not add "badge-new" class for already-notified badge', async () => {
    const $w = make$w();
    const badge = makeBadge({ notified: true });
    await initBadgeDisplayWidget(MEMBER_ID, makeOpts($w, [badge]));
    const $item = fireItemReady($w, badge);
    expect($item.addClass).not.toHaveBeenCalledWith('badge-new');
  });
});

describe('markBadgeNotified', () => {
  it('calls markBadgeNotified for each unnotified badge', async () => {
    const $w = make$w();
    const markFn = vi.fn().mockResolvedValue({ updated: true });
    const badges = [
      makeBadge({ badgeId: 'first_purchase', notified: false }),
      makeBadge({ badgeId: 'streak_7',       notified: false }),
    ];
    await initBadgeDisplayWidget(MEMBER_ID, { $w, getMemberBadges: vi.fn().mockResolvedValue(badges), markBadgeNotified: markFn });
    expect(markFn).toHaveBeenCalledTimes(2);
    expect(markFn).toHaveBeenCalledWith(MEMBER_ID, 'first_purchase');
    expect(markFn).toHaveBeenCalledWith(MEMBER_ID, 'streak_7');
  });

  it('does not call markBadgeNotified for already-notified badges', async () => {
    const $w = make$w();
    const markFn = vi.fn().mockResolvedValue({ updated: true });
    const badges = [
      makeBadge({ badgeId: 'first_purchase', notified: true }),
      makeBadge({ badgeId: 'streak_7',       notified: false }),
    ];
    await initBadgeDisplayWidget(MEMBER_ID, { $w, getMemberBadges: vi.fn().mockResolvedValue(badges), markBadgeNotified: markFn });
    expect(markFn).toHaveBeenCalledTimes(1);
    expect(markFn).toHaveBeenCalledWith(MEMBER_ID, 'streak_7');
    expect(markFn).not.toHaveBeenCalledWith(MEMBER_ID, 'first_purchase');
  });

  it('does not call markBadgeNotified when all badges are notified', async () => {
    const $w = make$w();
    const markFn = vi.fn();
    const badges = [makeBadge({ notified: true })];
    await initBadgeDisplayWidget(MEMBER_ID, { $w, getMemberBadges: vi.fn().mockResolvedValue(badges), markBadgeNotified: markFn });
    expect(markFn).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('does not throw when getMemberBadges rejects', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getMemberBadges:   vi.fn().mockRejectedValue(new Error('API down')),
      markBadgeNotified: vi.fn(),
    };
    await expect(initBadgeDisplayWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('does not throw when markBadgeNotified rejects', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getMemberBadges:   vi.fn().mockResolvedValue([makeBadge({ notified: false })]),
      markBadgeNotified: vi.fn().mockRejectedValue(new Error('Mark failed')),
    };
    await expect(initBadgeDisplayWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
