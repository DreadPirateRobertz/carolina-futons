/**
 * cartSpendToTierBar.test.js
 * CF-1qo6 — Cart spend-to-next-tier progress bar with endowed progress mechanic.
 *
 * Endowed progress (Kivetz 2006): floor displayed progress at 20% to
 * anchor goal pursuit and increase tier-threshold completion by 82%.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calcTierProgressWithCart,
  initSpendToTierBar,
  updateSpendToTierBar,
} from '../src/public/CartSpendToTierBar.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    value: 0,
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
  };
}

function make$w() {
  const els = {
    '#tierProgressBar': makeEl(),
    '#tierProgressText': makeEl(),
    '#tierName': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// 150pts earned, 350 more to Mountain Guide (500 threshold), 30% progress
const MEMBER_ACCOUNT = {
  points: 150,
  tier: 'Trail Blazer',
  nextTier: 'Mountain Guide',
  pointsToNext: 350,
  progress: 30,
};

// Near-zero account: progress will be below the 20% endowed floor
const LOW_ACCOUNT = {
  points: 0,
  tier: 'Trail Blazer',
  nextTier: 'Mountain Guide',
  pointsToNext: 500,
  progress: 0,
};

const MAX_TIER_ACCOUNT = {
  points: 2500,
  tier: 'Summit Legend',
  nextTier: null,
  pointsToNext: 0,
  progress: 100,
};

// ── calcTierProgressWithCart — pure function ──────────────────────────────────

describe('calcTierProgressWithCart', () => {
  it('applies endowed floor when raw progress is below 20', () => {
    // cartSubtotal=50: cartPoints=50, rawProgress=min(100, 0+50*100/500)=10 → endowed=20
    const { endowedProgress } = calcTierProgressWithCart(LOW_ACCOUNT, 50);
    expect(endowedProgress).toBe(20);
  });

  it('does not apply floor when raw progress is already >= 20', () => {
    // cartSubtotal=100: cartPoints=100, rawProgress=min(100, 30+100*70/350)=50 → endowed=50
    const { endowedProgress } = calcTierProgressWithCart(MEMBER_ACCOUNT, 100);
    expect(endowedProgress).toBe(50);
  });

  it('caps endowed progress at 100 when cart reaches next tier', () => {
    // cartSubtotal=400: cartPoints=400 >= pointsToNext=350 → 100%
    const { endowedProgress } = calcTierProgressWithCart(MEMBER_ACCOUNT, 400);
    expect(endowedProgress).toBe(100);
  });

  it('returns 100 for max-tier account regardless of cart', () => {
    const { endowedProgress } = calcTierProgressWithCart(MAX_TIER_ACCOUNT, 0);
    expect(endowedProgress).toBe(100);
  });

  it('computes remainingAfterCart as points still needed after this order', () => {
    // pointsToNext=350, cartPoints=100 → remaining=250
    const { remainingAfterCart } = calcTierProgressWithCart(MEMBER_ACCOUNT, 100);
    expect(remainingAfterCart).toBe(250);
  });

  it('clamps remainingAfterCart to 0 when cart exceeds threshold', () => {
    // cartSubtotal=500 > pointsToNext=350 → remaining=0
    const { remainingAfterCart } = calcTierProgressWithCart(MEMBER_ACCOUNT, 500);
    expect(remainingAfterCart).toBe(0);
  });

  it('returns endowed=20 floor even at cartSubtotal=0 when base progress is low', () => {
    const { endowedProgress } = calcTierProgressWithCart(LOW_ACCOUNT, 0);
    expect(endowedProgress).toBe(20);
  });
});

// ── initSpendToTierBar — guest / non-member ───────────────────────────────────

describe('initSpendToTierBar — non-member (getLoyaltyAccount throws)', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockRejectedValue(new Error('Permissions error'));

  beforeEach(() => { $w = make$w(); });

  it('hides tierProgressBar', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 300, getLoyaltyAccount });
    expect($w('#tierProgressBar').hide).toHaveBeenCalled();
  });

  it('hides tierProgressText', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 300, getLoyaltyAccount });
    expect($w('#tierProgressText').hide).toHaveBeenCalled();
  });

  it('hides tierName', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 300, getLoyaltyAccount });
    expect($w('#tierName').hide).toHaveBeenCalled();
  });
});

// ── initSpendToTierBar — null loyalty data ────────────────────────────────────

describe('initSpendToTierBar — getLoyaltyAccount returns null', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(null);

  beforeEach(() => { $w = make$w(); });

  it('hides all three elements', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 300, getLoyaltyAccount });
    expect($w('#tierProgressBar').hide).toHaveBeenCalled();
    expect($w('#tierProgressText').hide).toHaveBeenCalled();
    expect($w('#tierName').hide).toHaveBeenCalled();
  });
});

// ── initSpendToTierBar — member, cart short of next tier ─────────────────────

describe('initSpendToTierBar — member, cart does not reach next tier', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);

  beforeEach(() => { $w = make$w(); });

  it('shows tierProgressBar', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressBar').show).toHaveBeenCalled();
  });

  it('sets tierProgressBar value to endowed progress', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressBar').value).toBe(50);
  });

  it('shows tierProgressText with spend-to-next message', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressText').show).toHaveBeenCalled();
    expect($w('#tierProgressText').text).toBe('Add $250 more for Mountain Guide!');
  });

  it('shows tierName with current tier', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierName').show).toHaveBeenCalled();
    expect($w('#tierName').text).toBe('Trail Blazer');
  });
});

// ── initSpendToTierBar — member, cart reaches next tier ──────────────────────

describe('initSpendToTierBar — member, cart reaches next tier', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);

  beforeEach(() => { $w = make$w(); });

  it('sets bar to 100% when cart covers pointsToNext', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 400, getLoyaltyAccount });
    expect($w('#tierProgressBar').value).toBe(100);
  });

  it('shows tier-earn message', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 400, getLoyaltyAccount });
    expect($w('#tierProgressText').text).toBe('This order earns you Mountain Guide status!');
  });
});

// ── initSpendToTierBar — max tier ─────────────────────────────────────────────

describe('initSpendToTierBar — member at max tier', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MAX_TIER_ACCOUNT);

  beforeEach(() => { $w = make$w(); });

  it('sets bar to 100%', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressBar').value).toBe(100);
  });

  it('shows top-tier congratulation text', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressText').text).toBe("You're a Summit Legend — top tier!");
  });

  it('shows tierName', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierName').text).toBe('Summit Legend');
  });
});

// ── initSpendToTierBar — endowed floor visible ────────────────────────────────

describe('initSpendToTierBar — endowed floor applied', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(LOW_ACCOUNT);

  beforeEach(() => { $w = make$w(); });

  it('shows 20% even when raw account progress is 0 and cart is small', async () => {
    await initSpendToTierBar($w, { cartSubtotal: 50, getLoyaltyAccount });
    expect($w('#tierProgressBar').value).toBe(20);
  });
});

// ── updateSpendToTierBar ──────────────────────────────────────────────────────

describe('updateSpendToTierBar', () => {
  it('does not mutate elements when loyaltyData is null', () => {
    const $w = make$w();
    updateSpendToTierBar($w, { cartSubtotal: 300, loyaltyData: null });
    expect($w('#tierProgressBar').show).not.toHaveBeenCalled();
    expect($w('#tierProgressBar').hide).not.toHaveBeenCalled();
    expect($w('#tierProgressText').show).not.toHaveBeenCalled();
  });

  it('updates bar value when loyaltyData is present', () => {
    const $w = make$w();
    updateSpendToTierBar($w, { cartSubtotal: 100, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#tierProgressBar').value).toBe(50);
  });

  it('updates progress text when loyaltyData is present', () => {
    const $w = make$w();
    updateSpendToTierBar($w, { cartSubtotal: 100, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#tierProgressText').text).toBe('Add $250 more for Mountain Guide!');
  });

  it('shows earn message when updated cart reaches tier', () => {
    const $w = make$w();
    updateSpendToTierBar($w, { cartSubtotal: 400, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#tierProgressText').text).toBe('This order earns you Mountain Guide status!');
  });
});

// ── onCartChanged live update sequence ────────────────────────────────────────
// Simulates the Cart Page flow: init on load, then updateSpendToTierBar on
// each cart change via onCartChanged debounce. Verifies the bar recalculates
// with the new subtotal rather than caching the initial value.

describe('updateSpendToTierBar — live cart change after init', () => {
  it('recalculates bar value and text when subtotal changes after init', async () => {
    const $w = make$w();
    const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);

    // Page load: subtotal=100 → endowed=50, remaining=$250
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressBar').value).toBe(50);
    expect($w('#tierProgressText').text).toBe('Add $250 more for Mountain Guide!');

    // Cart changed (item added): subtotal=300 → endowed=90, remaining=$50
    updateSpendToTierBar($w, { cartSubtotal: 300, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#tierProgressBar').value).toBe(90);
    expect($w('#tierProgressText').text).toBe('Add $50 more for Mountain Guide!');
  });

  it('shows tier-earn message when cart change pushes subtotal over threshold', async () => {
    const $w = make$w();
    const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);

    // Page load: subtotal=100 (short of threshold)
    await initSpendToTierBar($w, { cartSubtotal: 100, getLoyaltyAccount });
    expect($w('#tierProgressText').text).toBe('Add $250 more for Mountain Guide!');

    // Cart changed: subtotal=350 (exactly meets pointsToNext=350) → 100%, earn message
    updateSpendToTierBar($w, { cartSubtotal: 350, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#tierProgressBar').value).toBe(100);
    expect($w('#tierProgressText').text).toBe('This order earns you Mountain Guide status!');
  });

  it('no-ops when onCartChanged fires before loyalty account loads (loyaltyData null)', () => {
    // Simulates the race: onCartChanged fires during page init before
    // getLoyaltyAccount() has resolved and populated _cartLoyaltyData.
    const $w = make$w();
    updateSpendToTierBar($w, { cartSubtotal: 200, loyaltyData: null });
    expect($w('#tierProgressBar').show).not.toHaveBeenCalled();
    expect($w('#tierProgressBar').hide).not.toHaveBeenCalled();
    expect($w('#tierProgressText').show).not.toHaveBeenCalled();
  });
});
