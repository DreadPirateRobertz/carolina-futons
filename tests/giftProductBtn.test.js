/**
 * @file giftProductBtn.test.js
 * @description Tests for CF-9fv2 Gift Cards S2 — Give as a Gift on Product Page.
 *
 * Tests:
 *  - selectGiftDenomination: price matching logic
 *  - handleGiftProductClick: cart API call, fallback navigate, return values
 *  - initGiftProductButton: button wiring, aria label, disable/enable, error handling
 *  - Module exports: constants
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectGiftDenomination,
  handleGiftProductClick,
  initGiftProductButton,
  GIFT_PRODUCT_BTN_TEXT,
  GIFT_CARD_PRODUCT_ID,
} from '../src/public/giftProductBtn.js';

// ── helpers ───────────────────────────────────────────────────────────

/** Build a minimal fake $w button element */
function makeBtn(overrides = {}) {
  const clickHandlers = [];
  return {
    text: '',
    accessibility: { ariaLabel: '' },
    disabled: false,
    onClick: vi.fn(fn => { clickHandlers.push(fn); }),
    disable: vi.fn(() => { /* btn.disabled = true */ }),
    enable: vi.fn(() => { /* btn.disabled = false */ }),
    _fire: async () => { for (const h of clickHandlers) await h(); },
    ...overrides,
  };
}

/** Build a minimal fake $w selector that returns a button */
function make$w(btn) {
  return vi.fn(() => btn);
}

const PRODUCT = { productId: 'sofa-blue-001', productName: 'Blue Ridge Sofa', price: 799 };

// ═══════════════════════════════════════════════════════════════════
// selectGiftDenomination
// ═══════════════════════════════════════════════════════════════════

describe('selectGiftDenomination', () => {
  it('returns exact match when price equals a denomination', () => {
    expect(selectGiftDenomination(100)?.amount).toBe(100);
  });

  it('returns exact match for $25', () => {
    expect(selectGiftDenomination(25)?.amount).toBe(25);
  });

  it('returns exact match for $500', () => {
    expect(selectGiftDenomination(500)?.amount).toBe(500);
  });

  it('rounds UP to next denomination when price is between', () => {
    // $26 → next above is $50
    expect(selectGiftDenomination(26)?.amount).toBe(50);
  });

  it('rounds UP correctly for price just above a denomination', () => {
    // $101 → next above is $150
    expect(selectGiftDenomination(101)?.amount).toBe(150);
  });

  it('returns $50 for price = $30', () => {
    expect(selectGiftDenomination(30)?.amount).toBe(50);
  });

  it('returns highest denomination when price exceeds all', () => {
    expect(selectGiftDenomination(999)?.amount).toBe(500);
  });

  it('returns highest denomination for very large price', () => {
    expect(selectGiftDenomination(10000)?.amount).toBe(500);
  });

  it('returns null for price = 0', () => {
    expect(selectGiftDenomination(0)).toBeNull();
  });

  it('returns null for negative price', () => {
    expect(selectGiftDenomination(-50)).toBeNull();
  });

  it('returns null for non-number (string)', () => {
    expect(selectGiftDenomination('100')).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(selectGiftDenomination(NaN)).toBeNull();
  });

  it('returns null for null', () => {
    expect(selectGiftDenomination(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(selectGiftDenomination(undefined)).toBeNull();
  });

  it('returned denomination has both amount and label', () => {
    const d = selectGiftDenomination(100);
    expect(d).toHaveProperty('amount');
    expect(d).toHaveProperty('label');
  });
});

// ═══════════════════════════════════════════════════════════════════
// handleGiftProductClick — success flow
// ═══════════════════════════════════════════════════════════════════

describe('handleGiftProductClick — success flow', () => {
  let addToCart;

  beforeEach(() => {
    addToCart = vi.fn().mockResolvedValue({ success: true });
  });

  it('calls addToCart with GIFT_CARD_PRODUCT_ID', async () => {
    await handleGiftProductClick(PRODUCT, { addToCart });
    expect(addToCart).toHaveBeenCalledTimes(1);
    expect(addToCart.mock.calls[0][0][0].productId).toBe(GIFT_CARD_PRODUCT_ID);
  });

  it('calls addToCart with correct denomination for product price', async () => {
    // $799 → rounds up to $500 (highest), since 799 > 500
    await handleGiftProductClick(PRODUCT, { addToCart });
    expect(addToCart.mock.calls[0][0][0].options.amount).toBe(500);
  });

  it('calls addToCart with productName in options.giftFor', async () => {
    await handleGiftProductClick(PRODUCT, { addToCart });
    expect(addToCart.mock.calls[0][0][0].options.giftFor).toBe('Blue Ridge Sofa');
  });

  it('calls addToCart with sourceProductId in options', async () => {
    await handleGiftProductClick(PRODUCT, { addToCart });
    expect(addToCart.mock.calls[0][0][0].options.sourceProductId).toBe('sofa-blue-001');
  });

  it('calls addToCart with quantity 1', async () => {
    await handleGiftProductClick(PRODUCT, { addToCart });
    expect(addToCart.mock.calls[0][0][0].quantity).toBe(1);
  });

  it('returns success:true and correct denomination', async () => {
    const result = await handleGiftProductClick({ ...PRODUCT, price: 100 }, { addToCart });
    expect(result.success).toBe(true);
    expect(result.denomination).toBe(100);
  });

  it('selects $50 denomination for $49 product', async () => {
    const result = await handleGiftProductClick({ ...PRODUCT, price: 49 }, { addToCart });
    expect(result.denomination).toBe(50);
  });

  it('selects $25 denomination for $25 product', async () => {
    const result = await handleGiftProductClick({ ...PRODUCT, price: 25 }, { addToCart });
    expect(result.denomination).toBe(25);
  });
});

// ═══════════════════════════════════════════════════════════════════
// handleGiftProductClick — error / fallback
// ═══════════════════════════════════════════════════════════════════

describe('handleGiftProductClick — error paths', () => {
  it('returns error:no_denomination when price is 0', async () => {
    const result = await handleGiftProductClick({ ...PRODUCT, price: 0 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('no_denomination');
  });

  it('returns error:no_denomination when product has no price', async () => {
    const result = await handleGiftProductClick({ productId: 'x', productName: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('no_denomination');
  });

  it('calls navigate with /gift-cards?amount=X on cart failure', async () => {
    const addToCart = vi.fn().mockRejectedValue(new Error('Cart API down'));
    const navigate = vi.fn();
    await handleGiftProductClick({ ...PRODUCT, price: 100 }, { addToCart, navigate });
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=100');
  });

  it('returns success:false and error:cart_failed on cart API error', async () => {
    const addToCart = vi.fn().mockRejectedValue(new Error('Cart API down'));
    const result = await handleGiftProductClick(PRODUCT, { addToCart });
    expect(result.success).toBe(false);
    expect(result.error).toBe('cart_failed');
  });

  it('succeeds without navigate option provided', async () => {
    const addToCart = vi.fn().mockResolvedValue({});
    const result = await handleGiftProductClick(PRODUCT, { addToCart });
    expect(result.success).toBe(true);
  });

  it('succeeds without addToCart (no-op cart call)', async () => {
    const result = await handleGiftProductClick({ ...PRODUCT, price: 50 }, {});
    expect(result.success).toBe(true);
    expect(result.denomination).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftProductButton — wiring
// ═══════════════════════════════════════════════════════════════════

describe('initGiftProductButton — wiring', () => {
  it('sets button text to GIFT_PRODUCT_BTN_TEXT', () => {
    const btn = makeBtn();
    initGiftProductButton(make$w(btn), PRODUCT);
    expect(btn.text).toBe(GIFT_PRODUCT_BTN_TEXT);
  });

  it('sets aria label on the button', () => {
    const btn = makeBtn();
    initGiftProductButton(make$w(btn), PRODUCT);
    expect(btn.accessibility.ariaLabel).toContain('gift');
  });

  it('registers a click handler', () => {
    const btn = makeBtn();
    initGiftProductButton(make$w(btn), PRODUCT);
    expect(btn.onClick).toHaveBeenCalledTimes(1);
  });

  it('disables button during click handler, re-enables after', async () => {
    const btn = makeBtn();
    const addToCart = vi.fn().mockResolvedValue({});
    initGiftProductButton(make$w(btn), PRODUCT, { addToCart });
    await btn._fire();
    expect(btn.disable).toHaveBeenCalled();
    expect(btn.enable).toHaveBeenCalled();
  });

  it('calls addToCart when button clicked', async () => {
    const btn = makeBtn();
    const addToCart = vi.fn().mockResolvedValue({});
    initGiftProductButton(make$w(btn), PRODUCT, { addToCart });
    await btn._fire();
    expect(addToCart).toHaveBeenCalledTimes(1);
  });

  it('does not throw when #giftProductBtn is missing ($w throws)', () => {
    const $w = vi.fn(() => { throw new Error('Element not found'); });
    expect(() => initGiftProductButton($w, PRODUCT)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// module exports
// ═══════════════════════════════════════════════════════════════════

describe('module exports', () => {
  it('exports GIFT_PRODUCT_BTN_TEXT as a non-empty string', () => {
    expect(typeof GIFT_PRODUCT_BTN_TEXT).toBe('string');
    expect(GIFT_PRODUCT_BTN_TEXT.length).toBeGreaterThan(0);
  });

  it('exports GIFT_CARD_PRODUCT_ID as a non-empty string', () => {
    expect(typeof GIFT_CARD_PRODUCT_ID).toBe('string');
    expect(GIFT_CARD_PRODUCT_ID.length).toBeGreaterThan(0);
  });
});
