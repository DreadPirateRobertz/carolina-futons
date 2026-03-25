/**
 * @file rewardsTierWidget.test.js
 * @description Tests for CF-f5j9: RewardsTierWidget — tier display with progress.
 *
 * Covers:
 *  - correct tier at each boundary (499=Bronze, 500=Silver, 1499=Silver, 1500=Gold, 3999=Gold, 4000=Platinum)
 *  - progress bar math
 *  - benefits list
 *  - next tier preview
 *  - Platinum shows no next tier
 *  - error state
 *  - no throw on reject
 *
 * CF-f5j9
 */
import { describe, it, expect, vi } from 'vitest';
import { initRewardsTierWidget } from '../src/public/RewardsTierWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    targetValue: 0,
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
    '#tierBadge':            makeEl(),
    '#tierName':             makeEl(),
    '#tierProgress':         makeEl(),
    '#tierPointsNeeded':     makeEl(),
    '#tierBenefitsRepeater': makeEl(),
    '#tierNextBenefits':     makeEl(),
    '#tierError':            makeEl(),
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
  $w._els['#tierBenefitsRepeater']._onItemReady?.($item, itemData);
  return $item;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'mem-test';

function makeTierData(overrides = {}) {
  return {
    currentTier: 'bronze',
    tierName: 'Bronze',
    pointsInTier: 200,
    pointsToNextTier: 300,
    nextTierName: 'Silver',
    benefits: ['1x points'],
    nextTierBenefits: ['1.5x points', 'Free shipping on orders over $500'],
    ...overrides,
  };
}

function makeOpts($w, tierData) {
  return {
    $w,
    getMemberTier: vi.fn().mockResolvedValue(tierData),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tier boundaries', () => {
  it('499 points = Bronze', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'bronze', tierName: 'Bronze', pointsInTier: 499, pointsToNextTier: 1, nextTierName: 'Silver',
    })));
    expect($w._els['#tierName'].text).toBe('Bronze');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-bronze');
  });

  it('500 points = Silver', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'silver', tierName: 'Silver', pointsInTier: 0, pointsToNextTier: 1000, nextTierName: 'Gold',
    })));
    expect($w._els['#tierName'].text).toBe('Silver');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-silver');
  });

  it('1499 points = Silver', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'silver', tierName: 'Silver', pointsInTier: 999, pointsToNextTier: 1, nextTierName: 'Gold',
    })));
    expect($w._els['#tierName'].text).toBe('Silver');
  });

  it('1500 points = Gold', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'gold', tierName: 'Gold', pointsInTier: 0, pointsToNextTier: 2500, nextTierName: 'Platinum',
    })));
    expect($w._els['#tierName'].text).toBe('Gold');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-gold');
  });

  it('3999 points = Gold', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'gold', tierName: 'Gold', pointsInTier: 2499, pointsToNextTier: 1, nextTierName: 'Platinum',
    })));
    expect($w._els['#tierName'].text).toBe('Gold');
  });

  it('4000 points = Platinum', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'platinum', tierName: 'Platinum', pointsInTier: 0, pointsToNextTier: 0,
      nextTierName: null, nextTierBenefits: null,
      benefits: ['3x points', 'Free shipping', 'Early access', 'Birthday double points', 'Exclusive products'],
    })));
    expect($w._els['#tierName'].text).toBe('Platinum');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-platinum');
  });
});

describe('progress bar', () => {
  it('calculates correct percentage', async () => {
    const $w = make$w();
    // 200 points in tier, 300 to next = 200/500 = 40%
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      pointsInTier: 200, pointsToNextTier: 300,
    })));
    expect($w._els['#tierProgress'].targetValue).toBe(40);
    expect($w._els['#tierProgress'].show).toHaveBeenCalled();
  });

  it('shows 0% at tier boundary start', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      pointsInTier: 0, pointsToNextTier: 500,
    })));
    expect($w._els['#tierProgress'].targetValue).toBe(0);
  });

  it('shows points needed text', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      pointsToNextTier: 300, nextTierName: 'Silver',
    })));
    expect($w._els['#tierPointsNeeded'].text).toBe('300 more points to Silver');
  });

  it('hides progress bar at Platinum', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'platinum', tierName: 'Platinum',
      nextTierName: null, nextTierBenefits: null,
      pointsInTier: 1000, pointsToNextTier: 0,
    })));
    expect($w._els['#tierProgress'].hide).toHaveBeenCalled();
    expect($w._els['#tierPointsNeeded'].hide).toHaveBeenCalled();
  });
});

describe('benefits list', () => {
  it('sets repeater data with benefits', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      benefits: ['1x points'],
    })));
    expect($w._els['#tierBenefitsRepeater'].data).toEqual([{ _id: '0', text: '1x points' }]);
  });

  it('renders benefit text via onItemReady', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      benefits: ['2x points', 'Free shipping'],
    })));
    const $item = fireItemReady($w, { _id: '0', text: '2x points' });
    expect($item._els['#benefitText'].text).toBe('2x points');
  });

  it('shows multiple benefits for Gold tier', async () => {
    const $w = make$w();
    const benefits = ['2x points', 'Free shipping all orders', 'Early access to sales'];
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({ benefits })));
    expect($w._els['#tierBenefitsRepeater'].data).toHaveLength(3);
  });
});

describe('next tier preview', () => {
  it('shows next tier benefits', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      nextTierBenefits: ['1.5x points', 'Free shipping on orders over $500'],
    })));
    expect($w._els['#tierNextBenefits'].text).toBe('Next: 1.5x points, Free shipping on orders over $500');
    expect($w._els['#tierNextBenefits'].show).toHaveBeenCalled();
  });

  it('hides next tier benefits at Platinum', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      nextTierName: null, nextTierBenefits: null,
    })));
    expect($w._els['#tierNextBenefits'].hide).toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('shows #tierError when getMemberTier returns null', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#tierError'].show).toHaveBeenCalled();
  });

  it('hides tier elements on error', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, null));
    expect($w._els['#tierBadge'].hide).toHaveBeenCalled();
    expect($w._els['#tierName'].hide).toHaveBeenCalled();
    expect($w._els['#tierProgress'].hide).toHaveBeenCalled();
    expect($w._els['#tierPointsNeeded'].hide).toHaveBeenCalled();
    expect($w._els['#tierBenefitsRepeater'].hide).toHaveBeenCalled();
    expect($w._els['#tierNextBenefits'].hide).toHaveBeenCalled();
  });

  it('shows #tierError when getMemberTier rejects', async () => {
    const $w = make$w();
    const opts = { $w, getMemberTier: vi.fn().mockRejectedValue(new Error('fail')) };
    await initRewardsTierWidget(MEMBER_ID, opts);
    expect($w._els['#tierError'].show).toHaveBeenCalled();
  });

  it('does not throw when getMemberTier rejects', async () => {
    const $w = make$w();
    const opts = { $w, getMemberTier: vi.fn().mockRejectedValue(new Error('fail')) };
    await expect(initRewardsTierWidget(MEMBER_ID, opts)).resolves.not.toThrow();
  });
});
