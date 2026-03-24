/**
 * cartLoyaltyBar.test.js
 * CF-jbu — cart tier progress bar (session-1 loyalty discovery)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initCartLoyaltyBar, updateCartLoyaltyBar } from '../src/public/CartLoyaltyBar.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    value: 0,
    _visible: true,
    _expanded: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    expand: vi.fn(function () { this._expanded = true; }),
    collapse: vi.fn(function () { this._expanded = false; }),
    accessibility: {},
    style: {},
    ...overrides,
  };
}

function make$w() {
  const els = {
    '#loyaltyBarSection': makeEl(),
    '#loyaltyBarProgress': makeEl(),
    '#loyaltyBarText': makeEl(),
    '#loyaltyBarCta': makeEl(),
    '#loyaltyBarJoinCta': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ACCOUNT = {
  points: 150,
  tier: 'Trail Blazer',
  tierDiscount: 5,
  nextTier: 'Mountain Guide',
  pointsToNext: 350, // needs 350 more pts to reach 500
  progress: 30,      // 150/500 = 30%
};

const MAX_TIER_ACCOUNT = {
  points: 2500,
  tier: 'Summit Legend',
  tierDiscount: 20,
  nextTier: null,
  pointsToNext: 0,
  progress: 100,
};

// ── Non-member / guest state ─────────────────────────────────────────────────

describe('initCartLoyaltyBar — non-member (getLoyaltyAccount throws)', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockRejectedValue(new Error('Permissions error'));

  beforeEach(() => {
    $w = make$w();
  });

  it('expands the loyalty bar section', async () => {
    await initCartLoyaltyBar($w, { subtotal: 500, getLoyaltyAccount });
    expect($w('#loyaltyBarSection').expand).toHaveBeenCalled();
  });

  it('hides the member text element', async () => {
    await initCartLoyaltyBar($w, { subtotal: 500, getLoyaltyAccount });
    expect($w('#loyaltyBarText').hide).toHaveBeenCalled();
  });

  it('hides the member CTA element', async () => {
    await initCartLoyaltyBar($w, { subtotal: 500, getLoyaltyAccount });
    expect($w('#loyaltyBarCta').hide).toHaveBeenCalled();
  });

  it('shows join CTA with estimated points from subtotal (2 pts per $1)', async () => {
    await initCartLoyaltyBar($w, { subtotal: 500, getLoyaltyAccount });
    expect($w('#loyaltyBarJoinCta').show).toHaveBeenCalled();
    expect($w('#loyaltyBarJoinCta').text).toBe('Join rewards to earn 1000 pts on this order');
  });

  it('rounds fractional subtotal in join CTA', async () => {
    await initCartLoyaltyBar($w, { subtotal: 149.99, getLoyaltyAccount });
    expect($w('#loyaltyBarJoinCta').text).toBe('Join rewards to earn 300 pts on this order');
  });
});

// ── Member state — with next tier ─────────────────────────────────────────────

describe('initCartLoyaltyBar — member with next tier', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MEMBER_ACCOUNT);

  beforeEach(() => {
    $w = make$w();
  });

  it('expands the loyalty bar section', async () => {
    await initCartLoyaltyBar($w, { subtotal: 200, getLoyaltyAccount });
    expect($w('#loyaltyBarSection').expand).toHaveBeenCalled();
  });

  it('hides the join CTA', async () => {
    await initCartLoyaltyBar($w, { subtotal: 200, getLoyaltyAccount });
    expect($w('#loyaltyBarJoinCta').hide).toHaveBeenCalled();
  });

  it('sets progress bar to loyalty account progress value', async () => {
    await initCartLoyaltyBar($w, { subtotal: 200, getLoyaltyAccount });
    expect($w('#loyaltyBarProgress').value).toBe(30);
  });

  it('shows tier name and preview points in text element', async () => {
    await initCartLoyaltyBar($w, { subtotal: 200, getLoyaltyAccount });
    expect($w('#loyaltyBarText').show).toHaveBeenCalled();
    expect($w('#loyaltyBarText').text).toBe('Trail Blazer · Earn 400 pts on this order');
  });

  it('shows upsell CTA with dollars-to-next-tier when current order falls short', async () => {
    // pointsToNext=350, subtotal=100 → preview 200 pts, still 150 short
    await initCartLoyaltyBar($w, { subtotal: 100, getLoyaltyAccount });
    expect($w('#loyaltyBarCta').show).toHaveBeenCalled();
    expect($w('#loyaltyBarCta').text).toBe('Add $150 to reach Mountain Guide');
  });

  it('shows "this order gets you there" CTA when preview points cover pointsToNext', async () => {
    // pointsToNext = 350, subtotal = 400 → preview 800 >= 350
    await initCartLoyaltyBar($w, { subtotal: 400, getLoyaltyAccount });
    expect($w('#loyaltyBarCta').text).toBe('This order gets you to Mountain Guide!');
  });

  it('shows CTA when preview points exactly match pointsToNext', async () => {
    // pointsToNext=350, subtotal=175 → preview 350 = 350
    await initCartLoyaltyBar($w, { subtotal: 175, getLoyaltyAccount });
    expect($w('#loyaltyBarCta').text).toBe('This order gets you to Mountain Guide!');
  });
});

// ── Member state — at max tier ────────────────────────────────────────────────

describe('initCartLoyaltyBar — member at max tier (no nextTier)', () => {
  let $w;
  const getLoyaltyAccount = vi.fn().mockResolvedValue(MAX_TIER_ACCOUNT);

  beforeEach(() => {
    $w = make$w();
  });

  it('sets progress bar to 100', async () => {
    await initCartLoyaltyBar($w, { subtotal: 300, getLoyaltyAccount });
    expect($w('#loyaltyBarProgress').value).toBe(100);
  });

  it('shows text with tier name and preview points', async () => {
    await initCartLoyaltyBar($w, { subtotal: 300, getLoyaltyAccount });
    expect($w('#loyaltyBarText').text).toBe('Summit Legend · Earn 600 pts on this order');
  });

  it('hides the upsell CTA at max tier', async () => {
    await initCartLoyaltyBar($w, { subtotal: 300, getLoyaltyAccount });
    expect($w('#loyaltyBarCta').hide).toHaveBeenCalled();
  });
});

// ── updateCartLoyaltyBar ──────────────────────────────────────────────────────

describe('updateCartLoyaltyBar — re-renders with new subtotal', () => {
  let $w;

  beforeEach(() => {
    $w = make$w();
  });

  it('updates progress bar value from cached loyaltyData', () => {
    updateCartLoyaltyBar($w, { subtotal: 250, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#loyaltyBarProgress').value).toBe(30);
  });

  it('recalculates preview points from new subtotal', () => {
    updateCartLoyaltyBar($w, { subtotal: 250, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#loyaltyBarText').text).toBe('Trail Blazer · Earn 500 pts on this order');
  });

  it('recalculates upsell CTA with new subtotal', () => {
    // pointsToNext=350, subtotal=100 → preview=200, still need 150 more
    updateCartLoyaltyBar($w, { subtotal: 100, loyaltyData: MEMBER_ACCOUNT });
    expect($w('#loyaltyBarCta').text).toBe('Add $150 to reach Mountain Guide');
  });

  it('no-ops when loyaltyData is null', () => {
    // Should not throw
    expect(() => updateCartLoyaltyBar($w, { subtotal: 100, loyaltyData: null })).not.toThrow();
  });
});

// ── Error resilience ──────────────────────────────────────────────────────────

describe('initCartLoyaltyBar — error resilience', () => {
  it('collapses section when getLoyaltyAccount returns malformed data', async () => {
    const $w = make$w();
    const getLoyaltyAccount = vi.fn().mockResolvedValue(null); // malformed
    await initCartLoyaltyBar($w, { subtotal: 200, getLoyaltyAccount });
    // Should not throw — either collapses or gracefully handles null
    expect($w('#loyaltyBarSection').collapse).toHaveBeenCalled();
  });
});
