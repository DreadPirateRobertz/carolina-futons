/**
 * @file rewardsTierWidget.test.js
 * @description Tests for CF-f5j9, CF-r6r1: RewardsTierWidget — tier display with progress.
 *
 * Uses canonical tier names/thresholds from gamificationTokens.js:
 *   Trail Blazer (0), Mountain Guide (500), Summit Master (2000), Blue Ridge Legend (5000)
 *
 * CF-f5j9, CF-r6r1
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
    currentTier: 'trail-blazer',
    tierName: 'Trail Blazer',
    pointsInTier: 200,
    pointsToNextTier: 300,
    nextTierName: 'Mountain Guide',
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

describe('tier boundaries (canonical: Trail Blazer/Mountain Guide/Summit Master/Blue Ridge Legend)', () => {
  it('499 points = Trail Blazer', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'trail-blazer', tierName: 'Trail Blazer', pointsInTier: 499, pointsToNextTier: 1, nextTierName: 'Mountain Guide',
    })));
    expect($w._els['#tierName'].text).toBe('Trail Blazer');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-trail-blazer');
  });

  it('500 points = Mountain Guide', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'mountain-guide', tierName: 'Mountain Guide', pointsInTier: 0, pointsToNextTier: 1500, nextTierName: 'Summit Master',
    })));
    expect($w._els['#tierName'].text).toBe('Mountain Guide');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-mountain-guide');
  });

  it('1999 points = Mountain Guide', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'mountain-guide', tierName: 'Mountain Guide', pointsInTier: 1499, pointsToNextTier: 1, nextTierName: 'Summit Master',
    })));
    expect($w._els['#tierName'].text).toBe('Mountain Guide');
  });

  it('2000 points = Summit Master', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'summit-master', tierName: 'Summit Master', pointsInTier: 0, pointsToNextTier: 3000, nextTierName: 'Blue Ridge Legend',
    })));
    expect($w._els['#tierName'].text).toBe('Summit Master');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-summit-master');
  });

  it('4999 points = Summit Master', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'summit-master', tierName: 'Summit Master', pointsInTier: 2999, pointsToNextTier: 1, nextTierName: 'Blue Ridge Legend',
    })));
    expect($w._els['#tierName'].text).toBe('Summit Master');
  });

  it('5000 points = Blue Ridge Legend', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'blue-ridge-legend', tierName: 'Blue Ridge Legend', pointsInTier: 0, pointsToNextTier: 0,
      nextTierName: null, nextTierBenefits: null,
      benefits: ['3x points', 'Free shipping', 'Early access', 'Birthday double points', 'Exclusive products'],
    })));
    expect($w._els['#tierName'].text).toBe('Blue Ridge Legend');
    expect($w._els['#tierBadge'].addClass).toHaveBeenCalledWith('tier-blue-ridge-legend');
  });
});

describe('progress bar', () => {
  it('calculates correct percentage', async () => {
    const $w = make$w();
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
      pointsToNextTier: 300, nextTierName: 'Mountain Guide',
    })));
    expect($w._els['#tierPointsNeeded'].text).toBe('300 more points to Mountain Guide');
  });

  it('hides progress bar at max tier', async () => {
    const $w = make$w();
    await initRewardsTierWidget(MEMBER_ID, makeOpts($w, makeTierData({
      currentTier: 'blue-ridge-legend', tierName: 'Blue Ridge Legend',
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

  it('shows multiple benefits for Summit Master tier', async () => {
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

  it('hides next tier benefits at max tier', async () => {
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
