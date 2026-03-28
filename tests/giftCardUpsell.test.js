/**
 * @file giftCardUpsell.test.js
 * @description Tests for CF-ou1f Gift Cards S4 — post-purchase upsell on Thank You page.
 *
 * Tests:
 *  - selectUpsellDenomination: denomination selection logic
 *  - shouldShowGiftCardUpsell: session dedup, threshold checks
 *  - initGiftCardUpsell: text, button, navigation, collapse when hidden
 *  - Robustness: missing elements, negative/invalid totals
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  selectUpsellDenomination,
  shouldShowGiftCardUpsell,
  initGiftCardUpsell,
  GIFT_CARDS_PATH,
  UPSELL_SESSION_KEY,
} from '../src/public/giftCardUpsell.js';

// ── helpers ───────────────────────────────────────────────────────────

function makeStorage() {
  const store = {};
  return {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

function makeBtn() {
  const handlers = [];
  return {
    text: '',
    accessibility: { ariaLabel: '' },
    onClick: vi.fn(fn => { handlers.push(fn); }),
    _fire: () => handlers.forEach(fn => fn()),
  };
}

function makeSection() {
  return { collapse: vi.fn() };
}

function makeText() {
  return { text: '' };
}

function make$w() {
  const btn = makeBtn();
  const section = makeSection();
  const heading = makeText();
  const desc = makeText();

  const $w = vi.fn(sel => {
    if (sel === '#giftCardUpsellBtn') return btn;
    if (sel === '#giftCardUpsellSection') return section;
    if (sel === '#giftCardUpsellHeading') return heading;
    if (sel === '#giftCardUpsellDesc') return desc;
    throw new Error(`Unknown selector: ${sel}`);
  });

  $w._btn = btn;
  $w._section = section;
  $w._heading = heading;
  $w._desc = desc;
  return $w;
}

// ═══════════════════════════════════════════════════════════════════
// selectUpsellDenomination
// ═══════════════════════════════════════════════════════════════════

describe('selectUpsellDenomination', () => {
  it('returns $25 for order total $0', () => {
    expect(selectUpsellDenomination(0)?.amount).toBe(25);
  });

  it('returns $25 for order total $1', () => {
    expect(selectUpsellDenomination(1)?.amount).toBe(25);
  });

  it('returns $25 for order total $24.99', () => {
    expect(selectUpsellDenomination(24.99)?.amount).toBe(25);
  });

  it('returns $50 for order total exactly $25 (strictly greater)', () => {
    expect(selectUpsellDenomination(25)?.amount).toBe(50);
  });

  it('returns $50 for order total $49', () => {
    expect(selectUpsellDenomination(49)?.amount).toBe(50);
  });

  it('returns $100 for order total $50', () => {
    expect(selectUpsellDenomination(50)?.amount).toBe(100);
  });

  it('returns $500 for order total $499', () => {
    expect(selectUpsellDenomination(499)?.amount).toBe(500);
  });

  it('returns null for order total exactly $500 (no higher denomination)', () => {
    expect(selectUpsellDenomination(500)).toBeNull();
  });

  it('returns null for order total $1000', () => {
    expect(selectUpsellDenomination(1000)).toBeNull();
  });

  it('returns null for negative order total', () => {
    expect(selectUpsellDenomination(-10)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(selectUpsellDenomination(NaN)).toBeNull();
  });

  it('returns null for null', () => {
    expect(selectUpsellDenomination(null)).toBeNull();
  });

  it('returns null for string', () => {
    expect(selectUpsellDenomination('100')).toBeNull();
  });

  it('returned denomination has amount and label', () => {
    const d = selectUpsellDenomination(80);
    expect(d).toHaveProperty('amount');
    expect(d).toHaveProperty('label');
  });
});

// ═══════════════════════════════════════════════════════════════════
// shouldShowGiftCardUpsell
// ═══════════════════════════════════════════════════════════════════

describe('shouldShowGiftCardUpsell', () => {
  it('returns true when order total is under highest denomination', () => {
    expect(shouldShowGiftCardUpsell(80, { storage: makeStorage() })).toBe(true);
  });

  it('returns true for order total $0', () => {
    expect(shouldShowGiftCardUpsell(0, { storage: makeStorage() })).toBe(true);
  });

  it('returns false when order total is $500 (no denomination above)', () => {
    expect(shouldShowGiftCardUpsell(500, { storage: makeStorage() })).toBe(false);
  });

  it('returns false when order total exceeds $500', () => {
    expect(shouldShowGiftCardUpsell(999, { storage: makeStorage() })).toBe(false);
  });

  it('returns false when session flag already set', () => {
    const storage = makeStorage();
    storage.setItem(UPSELL_SESSION_KEY, '1');
    expect(shouldShowGiftCardUpsell(80, { storage })).toBe(false);
  });

  it('returns true when session storage is null (fails open)', () => {
    expect(shouldShowGiftCardUpsell(80, { storage: null })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardUpsell — shown (order total below threshold)
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardUpsell — shown', () => {
  let $w, storage;

  beforeEach(() => {
    $w = make$w();
    storage = makeStorage();
  });

  it('sets heading text containing denomination amount', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect($w._heading.text).toContain('100');
  });

  it('sets button text containing denomination amount', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect($w._btn.text).toContain('100');
  });

  it('sets aria label on button', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect($w._btn.accessibility.ariaLabel).toContain('gift card');
  });

  it('registers onClick on button', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect($w._btn.onClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT collapse section when shown', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect($w._section.collapse).not.toHaveBeenCalled();
  });

  it('button click navigates to /gift-cards with amount param', async () => {
    const navigate = vi.fn();
    await initGiftCardUpsell($w, 80, { storage, navigate });
    $w._btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=100');
  });

  it('navigate URL includes the correct denomination for order $24', async () => {
    const navigate = vi.fn();
    await initGiftCardUpsell($w, 24, { storage, navigate });
    $w._btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=25');
  });

  it('navigate URL includes $500 denomination for order $499', async () => {
    const navigate = vi.fn();
    await initGiftCardUpsell($w, 499, { storage, navigate });
    $w._btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards?amount=500');
  });

  it('sets session flag after showing', async () => {
    await initGiftCardUpsell($w, 80, { storage, navigate: vi.fn() });
    expect(storage.getItem(UPSELL_SESSION_KEY)).toBe('1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardUpsell — collapsed (order over threshold or session shown)
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardUpsell — collapsed', () => {
  it('collapses section when order total is $500', async () => {
    const $w = make$w();
    await initGiftCardUpsell($w, 500, { storage: makeStorage() });
    expect($w._section.collapse).toHaveBeenCalledTimes(1);
  });

  it('collapses section when order total exceeds $500', async () => {
    const $w = make$w();
    await initGiftCardUpsell($w, 750, { storage: makeStorage() });
    expect($w._section.collapse).toHaveBeenCalledTimes(1);
  });

  it('collapses section when session flag already set', async () => {
    const $w = make$w();
    const storage = makeStorage();
    storage.setItem(UPSELL_SESSION_KEY, '1');
    await initGiftCardUpsell($w, 80, { storage });
    expect($w._section.collapse).toHaveBeenCalledTimes(1);
  });

  it('does NOT set button text when collapsed', async () => {
    const $w = make$w();
    await initGiftCardUpsell($w, 500, { storage: makeStorage() });
    expect($w._btn.text).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardUpsell — robustness
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardUpsell — robustness', () => {
  it('does not throw when $w throws for all selectors', async () => {
    const $w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(
      initGiftCardUpsell($w, 80, { storage: makeStorage() })
    ).resolves.not.toThrow();
  });

  it('does not throw when section collapse throws (order over threshold)', async () => {
    const $w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(
      initGiftCardUpsell($w, 500, { storage: makeStorage() })
    ).resolves.not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// module exports
// ═══════════════════════════════════════════════════════════════════

describe('module exports', () => {
  it('exports GIFT_CARDS_PATH as /gift-cards', () => {
    expect(GIFT_CARDS_PATH).toBe('/gift-cards');
  });

  it('exports UPSELL_SESSION_KEY as a non-empty string', () => {
    expect(typeof UPSELL_SESSION_KEY).toBe('string');
    expect(UPSELL_SESSION_KEY.length).toBeGreaterThan(0);
  });
});
