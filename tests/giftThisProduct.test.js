/**
 * @file giftThisProduct.test.js
 * @description CF-x09m.1: Gift Cards S1 — PDP "Gift This Product" CTA.
 *
 * Covers:
 *  - selectGiftThisDenomination: exact match, round up, fallback to max,
 *    invalid/zero/negative price, non-number inputs
 *  - buildGiftThisUrl: correct URL with query param
 *  - initGiftThisSection: section expand/collapse, button text + aria,
 *    click navigates to correct URL, tracking event fired with correct data,
 *    backend getOptions used when available, graceful no-op on missing elements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectGiftThisDenomination,
  buildGiftThisUrl,
  initGiftThisSection,
  GIFT_CARDS_PATH,
  GIFT_THIS_BTN_TEXT,
} from '../src/public/giftThisProduct.js';

vi.mock('public/engagementTracker.js', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({ colors: {} }));

// Standard denomination list used across tests
const DENOMS = [
  { amount: 25, label: '$25' },
  { amount: 50, label: '$50' },
  { amount: 100, label: '$100' },
  { amount: 150, label: '$150' },
  { amount: 200, label: '$200' },
  { amount: 500, label: '$500' },
];

// ── selectGiftThisDenomination ─────────────────────────────────────────────────

describe('selectGiftThisDenomination — denomination selection', () => {
  it('returns exact match when product price equals a denomination', () => {
    expect(selectGiftThisDenomination(100, DENOMS)).toEqual({ amount: 100, label: '$100' });
    expect(selectGiftThisDenomination(25, DENOMS)).toEqual({ amount: 25, label: '$25' });
    expect(selectGiftThisDenomination(500, DENOMS)).toEqual({ amount: 500, label: '$500' });
  });

  it('rounds up to next denomination when price is between two amounts', () => {
    expect(selectGiftThisDenomination(30, DENOMS)).toEqual({ amount: 50, label: '$50' });
    expect(selectGiftThisDenomination(75, DENOMS)).toEqual({ amount: 100, label: '$100' });
    expect(selectGiftThisDenomination(1, DENOMS)).toEqual({ amount: 25, label: '$25' });
    expect(selectGiftThisDenomination(499, DENOMS)).toEqual({ amount: 500, label: '$500' });
  });

  it('falls back to max denomination when price exceeds all amounts', () => {
    expect(selectGiftThisDenomination(600, DENOMS)).toEqual({ amount: 500, label: '$500' });
    expect(selectGiftThisDenomination(1000, DENOMS)).toEqual({ amount: 500, label: '$500' });
    expect(selectGiftThisDenomination(999999, DENOMS)).toEqual({ amount: 500, label: '$500' });
  });

  it('returns null for zero price', () => {
    expect(selectGiftThisDenomination(0, DENOMS)).toBeNull();
  });

  it('returns null for negative price', () => {
    expect(selectGiftThisDenomination(-50, DENOMS)).toBeNull();
  });

  it('returns null for NaN price', () => {
    expect(selectGiftThisDenomination(NaN, DENOMS)).toBeNull();
  });

  it('returns null for Infinity price', () => {
    expect(selectGiftThisDenomination(Infinity, DENOMS)).toBeNull();
  });

  it('returns null for non-number price (string)', () => {
    expect(selectGiftThisDenomination('100', DENOMS)).toBeNull();
  });

  it('returns null for null price', () => {
    expect(selectGiftThisDenomination(null, DENOMS)).toBeNull();
  });

  it('uses default GIFT_CARD_DENOMINATIONS when no override provided', () => {
    const result = selectGiftThisDenomination(75);
    expect(result).not.toBeNull();
    expect(result.amount).toBeGreaterThanOrEqual(75);
  });

  it('does not mutate the denominations array', () => {
    const copy = [...DENOMS];
    selectGiftThisDenomination(80, DENOMS);
    expect(DENOMS).toEqual(copy);
  });
});

// ── buildGiftThisUrl ───────────────────────────────────────────────────────────

describe('buildGiftThisUrl — URL construction', () => {
  it('builds /gift-cards?amount=X for a given denomination', () => {
    expect(buildGiftThisUrl(100)).toBe('/gift-cards?amount=100');
    expect(buildGiftThisUrl(25)).toBe('/gift-cards?amount=25');
    expect(buildGiftThisUrl(500)).toBe('/gift-cards?amount=500');
  });

  it('uses GIFT_CARDS_PATH constant as base', () => {
    expect(buildGiftThisUrl(50)).toContain(GIFT_CARDS_PATH);
  });
});

// ── initGiftThisSection ────────────────────────────────────────────────────────

function makeSection() {
  return {
    collapse: vi.fn(),
    expand: vi.fn(),
  };
}

function makeBtn() {
  const handlers = [];
  return {
    text: '',
    accessibility: { ariaLabel: '' },
    onClick: vi.fn(fn => handlers.push(fn)),
    _fire: () => handlers.forEach(fn => fn()),
  };
}

function make$w(btn, section) {
  return (selector) => {
    if (selector === '#giftThisBtn') return btn;
    if (selector === '#giftThisSection') return section;
    throw new Error(`Unknown selector: ${selector}`);
  };
}

const PRODUCT = { productId: 'prod-123', name: 'Canvas Futon Frame', price: 299 };

describe('initGiftThisSection — section display', () => {
  it('expands #giftThisSection for a valid product price', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(section.expand).toHaveBeenCalled();
  });

  it('collapses #giftThisSection when product price is invalid', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), { price: 0 }, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(section.collapse).toHaveBeenCalled();
    expect(section.expand).not.toHaveBeenCalled();
  });

  it('collapses when product has no price property', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), {}, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(section.collapse).toHaveBeenCalled();
  });
});

describe('initGiftThisSection — button wiring', () => {
  it('sets button text to GIFT_THIS_BTN_TEXT', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(btn.text).toBe(GIFT_THIS_BTN_TEXT);
  });

  it('sets aria label on button', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(btn.accessibility.ariaLabel).toContain('gift');
  });

  it('wires onClick handler to button', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    });
    expect(btn.onClick).toHaveBeenCalled();
  });
});

describe('initGiftThisSection — click navigation', () => {
  it('navigates to /gift-cards?amount=X on button click', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const navigate = vi.fn();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate,
      getOptions: async () => DENOMS,
    });
    btn._fire();
    // PRODUCT.price = 299 → rounds up to $500 (DENOMS: 25,50,100,150,200,500)
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=500');
  });

  it('navigates to exact denomination when price matches', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const navigate = vi.fn();
    await initGiftThisSection(make$w(btn, section), { ...PRODUCT, price: 100 }, {
      navigate,
      getOptions: async () => DENOMS,
    });
    btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=100');
  });

  it('navigates to max denomination for price above all amounts', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const navigate = vi.fn();
    await initGiftThisSection(make$w(btn, section), { ...PRODUCT, price: 999 }, {
      navigate,
      getOptions: async () => DENOMS,
    });
    btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=500');
  });
});

describe('initGiftThisSection — tracking event', () => {
  it('fires gift_this_click event on button click', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const track = vi.fn();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      trackEvent: track,
      getOptions: async () => DENOMS,
    });
    btn._fire();
    expect(track).toHaveBeenCalledWith('gift_this_click', expect.any(Object));
  });

  it('tracking payload includes productId, productName, price, denomination', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const track = vi.fn();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      trackEvent: track,
      getOptions: async () => DENOMS,
    });
    btn._fire();
    const [, payload] = track.mock.calls[0];
    expect(payload.productId).toBe('prod-123');
    expect(payload.productName).toBe('Canvas Futon Frame');
    expect(payload.price).toBe(299);
    expect(typeof payload.denomination).toBe('number');
  });

  it('still navigates even if tracking throws', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const navigate = vi.fn();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate,
      trackEvent: () => { throw new Error('tracking down'); },
      getOptions: async () => DENOMS,
    });
    btn._fire();
    expect(navigate).toHaveBeenCalled();
  });
});

describe('initGiftThisSection — backend getOptions', () => {
  it('uses injected getOptions denominations for selection', async () => {
    const btn = makeBtn();
    const section = makeSection();
    const navigate = vi.fn();
    // Provide a custom denomination list with only $75
    const customDenoms = [{ amount: 75, label: '$75' }];
    await initGiftThisSection(make$w(btn, section), { ...PRODUCT, price: 50 }, {
      navigate,
      getOptions: async () => customDenoms,
    });
    btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=75');
  });

  it('falls back to GIFT_CARD_DENOMINATIONS when getOptions returns empty array', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => [],
    });
    // Section should still expand (falls back to GIFT_CARD_DENOMINATIONS)
    expect(section.expand).toHaveBeenCalled();
  });

  it('falls back to GIFT_CARD_DENOMINATIONS when getOptions throws', async () => {
    const btn = makeBtn();
    const section = makeSection();
    await initGiftThisSection(make$w(btn, section), PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => { throw new Error('backend down'); },
    });
    expect(section.expand).toHaveBeenCalled();
  });
});

describe('initGiftThisSection — graceful no-op', () => {
  it('does not throw when #giftThisSection is absent', async () => {
    const btn = makeBtn();
    const $w = () => { throw new Error('no element'); };
    await expect(initGiftThisSection($w, PRODUCT, {
      navigate: vi.fn(),
      getOptions: async () => DENOMS,
    })).resolves.not.toThrow();
  });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('module constants', () => {
  it('GIFT_CARDS_PATH is /gift-cards', () => {
    expect(GIFT_CARDS_PATH).toBe('/gift-cards');
  });

  it('GIFT_THIS_BTN_TEXT is a non-empty string', () => {
    expect(typeof GIFT_THIS_BTN_TEXT).toBe('string');
    expect(GIFT_THIS_BTN_TEXT.length).toBeGreaterThan(0);
  });
});
