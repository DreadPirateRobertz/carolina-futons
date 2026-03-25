/**
 * @file premiumUpsellWidget.test.js
 * @description Tests for CF-ortb: PremiumUpsellWidget + getPremiumUpsellData.
 *
 * Covers:
 *  - Upsell shown for Mountain Guide+ tier (eligible)
 *  - Upsell hidden for Trail Blazer (not eligible)
 *  - Already-member state shown correctly
 *  - Benefit list populated
 *  - Price text formatted
 *  - Signup button wired
 *  - Non-member graceful degradation
 *  - Backend error graceful degradation
 *  - formatPlanPrices utility
 *
 * CF-ortb
 */
import { describe, it, expect, vi } from 'vitest';
import {
  initPremiumUpsellWidget,
  formatPlanPrices,
} from '../src/public/PremiumUpsellWidget.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    _onClick: null,
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    expand:   vi.fn(function () { this._visible = true; }),
    collapse: vi.fn(function () { this._visible = false; }),
    onClick:  vi.fn(function (cb) { this._onClick = cb; }),
  };
}

function make$w() {
  const els = {
    '#premiumUpsellSection': makeEl(),
    '#premiumUpsellTitle':   makeEl(),
    '#premiumBenefitsList':  makeEl(),
    '#premiumPriceText':     makeEl(),
    '#premiumSignupBtn':     makeEl(),
    '#premiumAlreadyMember': makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PLANS = [
  { id: 'cf-plus-monthly', type: 'monthly', price: 14.99, label: 'CF+ Monthly' },
  { id: 'cf-plus-annual', type: 'annual', price: 119.99, label: 'CF+ Annual' },
];
const BENEFITS = [
  'Free shipping on all orders',
  '10% off every order',
  'Early access to new products',
  'Member-only promotions',
];

function makeUpsellData(overrides = {}) {
  return {
    eligible: true,
    alreadyMember: false,
    tier: 'Mountain Guide',
    plans: PLANS,
    benefits: BENEFITS,
    ...overrides,
  };
}

function makeOpts($w, data) {
  return {
    $w,
    getPremiumUpsellData: vi.fn().mockResolvedValue(data),
  };
}

// ── formatPlanPrices ─────────────────────────────────────────────────────────

describe('formatPlanPrices', () => {
  it('formats both monthly and annual', () => {
    expect(formatPlanPrices(PLANS)).toBe('$14.99/mo or $119.99/yr');
  });

  it('formats monthly only', () => {
    expect(formatPlanPrices([PLANS[0]])).toBe('$14.99/mo');
  });

  it('formats annual only', () => {
    expect(formatPlanPrices([PLANS[1]])).toBe('$119.99/yr');
  });

  it('returns empty for null/empty', () => {
    expect(formatPlanPrices(null)).toBe('');
    expect(formatPlanPrices([])).toBe('');
  });
});

// ── Eligible member (Mountain Guide+) ────────────────────────────────────────

describe('PremiumUpsellWidget — eligible member', () => {
  it('expands section for eligible tier', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData()));
    expect($w._els['#premiumUpsellSection'].expand).toHaveBeenCalled();
  });

  it('shows benefits list', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData()));
    expect($w._els['#premiumBenefitsList'].text).toContain('Free shipping');
    expect($w._els['#premiumBenefitsList'].text).toContain('10% off');
  });

  it('shows price text', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData()));
    expect($w._els['#premiumPriceText'].text).toBe('$14.99/mo or $119.99/yr');
  });

  it('sets title text', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData()));
    expect($w._els['#premiumUpsellTitle'].text).toBe('Upgrade to CF+');
  });

  it('wires signup button', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData()));
    expect($w._els['#premiumSignupBtn'].onClick).toHaveBeenCalled();
  });

  it('eligible for Summit Master tier', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({ tier: 'Summit Master' })));
    expect($w._els['#premiumUpsellSection'].expand).toHaveBeenCalled();
  });
});

// ── Trail Blazer (not eligible) ──────────────────────────────────────────────

describe('PremiumUpsellWidget — Trail Blazer (not eligible)', () => {
  it('does not expand section for Trail Blazer', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({ eligible: false, tier: 'Trail Blazer' })));
    expect($w._els['#premiumUpsellSection'].expand).not.toHaveBeenCalled();
  });
});

// ── Already a CF+ member ─────────────────────────────────────────────────────

describe('PremiumUpsellWidget — already member', () => {
  it('shows already-member text', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({
      eligible: false, alreadyMember: true,
    })));
    expect($w._els['#premiumAlreadyMember'].show).toHaveBeenCalled();
  });

  it('hides signup button for existing members', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({
      eligible: false, alreadyMember: true,
    })));
    expect($w._els['#premiumSignupBtn'].hide).toHaveBeenCalled();
  });

  it('hides price for existing members', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({
      eligible: false, alreadyMember: true,
    })));
    expect($w._els['#premiumPriceText'].hide).toHaveBeenCalled();
  });

  it('still expands section for already-member', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, makeUpsellData({
      eligible: false, alreadyMember: true,
    })));
    expect($w._els['#premiumUpsellSection'].expand).toHaveBeenCalled();
  });
});

// ── Graceful degradation ─────────────────────────────────────────────────────

describe('PremiumUpsellWidget — graceful degradation', () => {
  it('does not expand for non-members (null data)', async () => {
    const $w = make$w();
    await initPremiumUpsellWidget(makeOpts($w, null));
    expect($w._els['#premiumUpsellSection'].expand).not.toHaveBeenCalled();
  });

  it('does not expand on backend error', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getPremiumUpsellData: vi.fn().mockRejectedValue(new Error('fail')),
    };
    await initPremiumUpsellWidget(opts);
    expect($w._els['#premiumUpsellSection'].expand).not.toHaveBeenCalled();
  });

  it('does not throw on error', async () => {
    const $w = make$w();
    const opts = {
      $w,
      getPremiumUpsellData: vi.fn().mockRejectedValue(new Error('fail')),
    };
    await expect(initPremiumUpsellWidget(opts)).resolves.not.toThrow();
  });
});
