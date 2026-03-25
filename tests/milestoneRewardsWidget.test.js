/**
 * @file milestoneRewardsWidget.test.js
 * @description Tests for CF-lhrg: MilestoneRewardsWidget — milestone progress bars and unlockable rewards.
 *
 * CF-lhrg
 */
import { describe, it, expect, vi } from 'vitest';
import { initMilestoneRewardsWidget } from '../src/public/MilestoneRewardsWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    src: '',
    targetValue: 0,
    _visible: true,
    data: null,
    _onItemReady: null,
    show:        vi.fn(function () { this._visible = true; }),
    hide:        vi.fn(function () { this._visible = false; }),
    onItemReady: vi.fn(function (cb) { this._onItemReady = cb; }),
  };
}

function make$w() {
  const els = {
    '#milestonesTitle':    makeEl(),
    '#milestonesRepeater': makeEl(),
    '#milestoneNextUp':    makeEl(),
    '#milestonesError':    makeEl(),
  };

  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

function fireItemReady($w, itemData) {
  const $item = (sel) => {
    if (!$item._els[sel]) $item._els[sel] = makeEl();
    return $item._els[sel];
  };
  $item._els = {};
  $w._els['#milestonesRepeater']._onItemReady?.($item, itemData);
  return $item;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';

function makeMilestones(overrides = []) {
  const defaults = [
    { milestoneId: 'first-purchase',   title: 'First Purchase',   description: 'Complete your first order',       currentValue: 1, targetValue: 1,  reward: '100 bonus points',                        isUnlocked: true },
    { milestoneId: 'loyal-customer',   title: 'Loyal Customer',   description: 'Complete 5 orders',               currentValue: 3, targetValue: 5,  reward: '500 bonus points + free shipping coupon', isUnlocked: false },
    { milestoneId: 'top-reviewer',     title: 'Top Reviewer',     description: 'Write 10 reviews',                currentValue: 2, targetValue: 10, reward: '1000 bonus points + badge',               isUnlocked: false },
    { milestoneId: 'social-butterfly', title: 'Social Butterfly', description: 'Share 5 wishlists',               currentValue: 0, targetValue: 5,  reward: '250 bonus points',                        isUnlocked: false },
    { milestoneId: 'streak-master',    title: 'Streak Master',    description: 'Maintain a 30-day login streak',  currentValue: 10, targetValue: 30, reward: '2000 bonus points + exclusive badge',    isUnlocked: false },
  ];
  if (overrides.length > 0) return overrides;
  return defaults;
}

function makeOpts($w, milestones) {
  return {
    $w,
    getMilestones: vi.fn().mockResolvedValue(milestones),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MilestoneRewardsWidget — renders all milestones', () => {
  it('sets title to "Your Milestones"', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    expect($w._els['#milestonesTitle'].text).toBe('Your Milestones');
  });

  it('sets repeater data with all milestones', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    expect($w._els['#milestonesRepeater'].data).toHaveLength(5);
  });

  it('repeater items have correct _id', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const ids = $w._els['#milestonesRepeater'].data.map(d => d._id);
    expect(ids).toEqual(['first-purchase', 'loyal-customer', 'top-reviewer', 'social-butterfly', 'streak-master']);
  });

  it('shows repeater', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    expect($w._els['#milestonesRepeater'].show).toHaveBeenCalled();
  });

  it('hides error on success', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    expect($w._els['#milestonesError'].hide).toHaveBeenCalled();
  });
});

describe('MilestoneRewardsWidget — progress bars', () => {
  it('calculates correct percentage for partial progress', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'loyal-customer', title: 'Loyal Customer', description: 'Complete 5 orders', currentValue: 3, targetValue: 5, reward: '500 bonus points + free shipping coupon', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneBar'].targetValue).toBe(60); // 3/5 = 60%
  });

  it('shows 100% for completed milestone', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'first-purchase', title: 'First Purchase', description: 'Complete your first order', currentValue: 1, targetValue: 1, reward: '100 bonus points', isUnlocked: true };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneBar'].targetValue).toBe(100);
  });

  it('shows 0% for zero progress', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'social-butterfly', title: 'Social Butterfly', description: 'Share 5 wishlists', currentValue: 0, targetValue: 5, reward: '250 bonus points', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneBar'].targetValue).toBe(0);
  });

  it('handles zero targetValue without NaN', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, [
      { milestoneId: 'zero', title: 'Zero', description: 'test', currentValue: 0, targetValue: 0, reward: 'nada', isUnlocked: true },
    ]));
    const item = { _id: 'zero', title: 'Zero', description: 'test', currentValue: 0, targetValue: 0, reward: 'nada', isUnlocked: true };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneBar'].targetValue).toBe(0);
  });
});

describe('MilestoneRewardsWidget — lock/trophy icons', () => {
  it('shows trophy for unlocked milestone', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'first-purchase', title: 'First Purchase', description: 'Complete your first order', currentValue: 1, targetValue: 1, reward: '100 bonus points', isUnlocked: true };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneLock'].src).toBe('trophy');
  });

  it('shows lock for locked milestone', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'loyal-customer', title: 'Loyal Customer', description: 'Complete 5 orders', currentValue: 3, targetValue: 5, reward: '500 bonus points + free shipping coupon', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneLock'].src).toBe('lock');
  });
});

describe('MilestoneRewardsWidget — nextUp highlights', () => {
  it('highlights closest-to-completion locked milestone', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    // loyal-customer is 3/5 (60%), top-reviewer 2/10 (20%), social-butterfly 0/5 (0%), streak-master 10/30 (33%)
    expect($w._els['#milestoneNextUp'].text).toBe('Next up: Loyal Customer (3/5)');
    expect($w._els['#milestoneNextUp'].show).toHaveBeenCalled();
  });

  it('shows "All milestones unlocked!" when all complete', async () => {
    const $w = make$w();
    const allUnlocked = [
      { milestoneId: 'first-purchase', title: 'First Purchase', description: 'd', currentValue: 1, targetValue: 1, reward: 'r', isUnlocked: true },
      { milestoneId: 'loyal-customer', title: 'Loyal Customer', description: 'd', currentValue: 5, targetValue: 5, reward: 'r', isUnlocked: true },
    ];
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, allUnlocked));
    expect($w._els['#milestoneNextUp'].text).toBe('All milestones unlocked!');
  });

  it('picks milestone with highest percentage when multiple locked', async () => {
    const $w = make$w();
    const milestones = [
      { milestoneId: 'a', title: 'A', description: 'd', currentValue: 4, targetValue: 5, reward: 'r', isUnlocked: false },
      { milestoneId: 'b', title: 'B', description: 'd', currentValue: 9, targetValue: 10, reward: 'r', isUnlocked: false },
    ];
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, milestones));
    // B is 90%, A is 80% — B should be highlighted
    expect($w._els['#milestoneNextUp'].text).toBe('Next up: B (9/10)');
  });
});

describe('MilestoneRewardsWidget — repeater item rendering', () => {
  it('sets milestone name text', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'streak-master', title: 'Streak Master', description: 'Maintain a 30-day login streak', currentValue: 10, targetValue: 30, reward: '2000 bonus points + exclusive badge', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneName'].text).toBe('Streak Master');
  });

  it('sets milestone description text', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'streak-master', title: 'Streak Master', description: 'Maintain a 30-day login streak', currentValue: 10, targetValue: 30, reward: '2000 bonus points + exclusive badge', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneDesc'].text).toBe('Maintain a 30-day login streak');
  });

  it('sets milestone reward text', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, makeMilestones()));
    const item = { _id: 'top-reviewer', title: 'Top Reviewer', description: 'Write 10 reviews', currentValue: 2, targetValue: 10, reward: '1000 bonus points + badge', isUnlocked: false };
    const $item = fireItemReady($w, item);
    expect($item._els['#milestoneReward'].text).toBe('1000 bonus points + badge');
  });
});

describe('MilestoneRewardsWidget — error handling', () => {
  it('shows #milestonesError when getMilestones returns null', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#milestonesError'].show).toHaveBeenCalled();
  });

  it('hides title, repeater, and nextUp on error', async () => {
    const $w = make$w();
    await initMilestoneRewardsWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#milestonesTitle'].hide).toHaveBeenCalled();
    expect($w._els['#milestonesRepeater'].hide).toHaveBeenCalled();
    expect($w._els['#milestoneNextUp'].hide).toHaveBeenCalled();
  });

  it('shows #milestonesError when getMilestones rejects', async () => {
    const $w = make$w();
    const opts = { $w, getMilestones: vi.fn().mockRejectedValue(new Error('fail')) };
    await initMilestoneRewardsWidget(MEMBER_ID, opts);
    expect($w._els['#milestonesError'].show).toHaveBeenCalled();
  });

  it('does not throw when getMilestones rejects', async () => {
    const $w = make$w();
    const opts = { $w, getMilestones: vi.fn().mockRejectedValue(new Error('fail')) };
    await expect(initMilestoneRewardsWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
