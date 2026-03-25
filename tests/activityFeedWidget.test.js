/**
 * @file activityFeedWidget.test.js
 * @description Tests for CF-gx44: ActivityFeedWidget — recent activity stream on dashboard.
 *
 * Covers:
 *  - renders activity list with icons, descriptions, points, relative time
 *  - correct icons per type (purchase, review, referral, streak, quest, spin, badge, tier)
 *  - relative time formatting (just now, Nm ago, Nh ago, yesterday, Nd ago, Nw ago)
 *  - points display (+N pts or empty)
 *  - empty state
 *  - error state
 *  - respects limit
 *  - no throw on reject
 *
 * CF-gx44
 */
import { describe, it, expect, vi } from 'vitest';
import { initActivityFeedWidget, formatRelativeTime, humanizeEventType } from '../src/public/ActivityFeedWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    _classes: [],
    data: null,
    _onItemReady: null,
    show:        vi.fn(function () { this._visible = true; }),
    hide:        vi.fn(function () { this._visible = false; }),
    addClass:    vi.fn(function (cls) { this._classes.push(cls); }),
    onItemReady: vi.fn(function (cb) { this._onItemReady = cb; }),
  };
}

function make$w() {
  const els = {
    '#activityTitle':    makeEl(),
    '#activityRepeater': makeEl(),
    '#activityEmpty':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  $w._repeater = els['#activityRepeater'];
  return $w;
}

function fireItemReady($w, itemData) {
  const $item = (sel) => {
    if (!$item._els[sel]) $item._els[sel] = makeEl();
    return $item._els[sel];
  };
  $item._els = {};
  $w._repeater._onItemReady?.($item, itemData);
  return $item;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';
const NOW = new Date('2026-03-25T12:00:00Z');

function makeActivity(overrides = {}) {
  return {
    activityId: 'act-1',
    type: 'purchase',
    description: 'Earned 50 pts for product review',
    pointsEarned: 50,
    timestamp: '2026-03-25T10:00:00Z',
    iconType: 'cart',
    ...overrides,
  };
}

function makeOpts($w, activities) {
  return {
    $w,
    getActivityFeed: vi.fn().mockResolvedValue(activities),
    now: NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('title', () => {
  it('sets #activityTitle to "Recent Activity"', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    expect($w._els['#activityTitle'].text).toBe('Recent Activity');
  });
});

describe('renders activity list', () => {
  it('sets repeater data', async () => {
    const $w = make$w();
    const activities = [makeActivity()];
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, activities));
    expect($w._repeater.data).toBe(activities);
  });

  it('shows repeater when activities exist', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    expect($w._repeater.show).toHaveBeenCalled();
  });

  it('hides #activityEmpty when activities exist', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    expect($w._els['#activityEmpty'].hide).toHaveBeenCalled();
  });

  it('sets description text', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    const $item = fireItemReady($w, makeActivity({ description: 'Earned 100 pts for purchase' }));
    expect($item._els['#activityDesc'].text).toBe('Earned 100 pts for purchase');
  });

  it('calls getActivityFeed with memberId and limit 10', async () => {
    const $w = make$w();
    const opts = makeOpts($w, [makeActivity()]);
    await initActivityFeedWidget(MEMBER_ID, opts);
    expect(opts.getActivityFeed).toHaveBeenCalledWith(MEMBER_ID, 10);
  });
});

describe('icons per type', () => {
  const iconTests = [
    ['cart',     'purchase',       '\uD83D\uDED2'],
    ['star',     'review',         '\u2B50'],
    ['gift',     'referral',       '\uD83C\uDF81'],
    ['fire',     'streak',         '\uD83D\uDD25'],
    ['trophy',   'quest_complete', '\uD83C\uDFC6'],
    ['wheel',    'spin',           '\uD83C\uDFA1'],
    ['shield',   'badge_earned',   '\uD83D\uDEE1\uFE0F'],
    ['arrow-up', 'tier_up',        '\u2B06\uFE0F'],
  ];

  for (const [iconType, type, emoji] of iconTests) {
    it(`shows ${emoji} for ${type}`, async () => {
      const $w = make$w();
      await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
      const $item = fireItemReady($w, makeActivity({ iconType, type }));
      expect($item._els['#activityIcon'].text).toBe(emoji);
    });
  }
});

describe('relative time formatting', () => {
  it('"just now" for < 1 minute ago', () => {
    expect(formatRelativeTime('2026-03-25T11:59:30Z', NOW)).toBe('just now');
  });

  it('"5m ago" for 5 minutes ago', () => {
    expect(formatRelativeTime('2026-03-25T11:55:00Z', NOW)).toBe('5m ago');
  });

  it('"2h ago" for 2 hours ago', () => {
    expect(formatRelativeTime('2026-03-25T10:00:00Z', NOW)).toBe('2h ago');
  });

  it('"yesterday" for 1 day ago', () => {
    expect(formatRelativeTime('2026-03-24T12:00:00Z', NOW)).toBe('yesterday');
  });

  it('"3d ago" for 3 days ago', () => {
    expect(formatRelativeTime('2026-03-22T12:00:00Z', NOW)).toBe('3d ago');
  });

  it('"2w ago" for 14 days ago', () => {
    expect(formatRelativeTime('2026-03-11T12:00:00Z', NOW)).toBe('2w ago');
  });

  it('renders relative time in repeater item', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    const $item = fireItemReady($w, makeActivity({ timestamp: '2026-03-25T10:00:00Z' }));
    expect($item._els['#activityTime'].text).toBe('2h ago');
  });
});

describe('points display', () => {
  it('shows "+50 pts" when pointsEarned > 0', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    const $item = fireItemReady($w, makeActivity({ pointsEarned: 50 }));
    expect($item._els['#activityPoints'].text).toBe('+50 pts');
  });

  it('shows empty string when pointsEarned is 0', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    const $item = fireItemReady($w, makeActivity({ pointsEarned: 0 }));
    expect($item._els['#activityPoints'].text).toBe('');
  });
});

describe('empty state', () => {
  it('shows #activityEmpty when activities is empty', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, []));
    expect($w._els['#activityEmpty'].show).toHaveBeenCalled();
    expect($w._els['#activityEmpty'].text).toBe('No activity yet — start earning points!');
  });

  it('hides repeater on empty', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, []));
    expect($w._repeater.hide).toHaveBeenCalled();
  });

  it('shows #activityEmpty when activities is null', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#activityEmpty'].show).toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('shows #activityEmpty when getActivityFeed rejects', async () => {
    const $w = make$w();
    const opts = { $w, getActivityFeed: vi.fn().mockRejectedValue(new Error('fail')), now: NOW };
    await initActivityFeedWidget(MEMBER_ID, opts);
    expect($w._els['#activityEmpty'].show).toHaveBeenCalled();
  });

  it('does not throw when getActivityFeed rejects', async () => {
    const $w = make$w();
    const opts = { $w, getActivityFeed: vi.fn().mockRejectedValue(new Error('fail')), now: NOW };
    await expect(initActivityFeedWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});

describe('humanizeEventType (CF-r6r1)', () => {
  it('maps gamification_add_to_cart to human string', () => {
    expect(humanizeEventType('gamification_add_to_cart')).toBe('Added item to cart');
  });

  it('maps gamification_submit_review to human string', () => {
    expect(humanizeEventType('gamification_submit_review')).toBe('Submitted a product review');
  });

  it('maps gamification_order_complete to human string', () => {
    expect(humanizeEventType('gamification_order_complete')).toBe('Completed a purchase');
  });

  it('maps streak_extended to human string', () => {
    expect(humanizeEventType('streak_extended')).toBe('Extended streak');
  });

  it('maps badge_earned to human string', () => {
    expect(humanizeEventType('badge_earned')).toBe('Earned a badge');
  });

  it('strips gamification_ prefix and cleans underscores for unknown events', () => {
    expect(humanizeEventType('gamification_unknown_event')).toBe('unknown event');
  });

  it('cleans underscores for non-gamification unknown events', () => {
    expect(humanizeEventType('some_other_event')).toBe('some other event');
  });

  it('passes through already-human descriptions unchanged', () => {
    expect(humanizeEventType('Earned 50 pts for product review')).toBe('Earned 50 pts for product review');
  });

  it('renders humanized description in repeater item', async () => {
    const $w = make$w();
    await initActivityFeedWidget(MEMBER_ID, makeOpts($w, [makeActivity()]));
    const $item = fireItemReady($w, makeActivity({ description: 'gamification_add_to_cart' }));
    expect($item._els['#activityDesc'].text).toBe('Added item to cart');
  });
});
