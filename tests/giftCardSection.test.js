/**
 * @file giftCardSection.test.js
 * @description Tests for CF-mwpw Gift Cards S1 — homepage gift card section.
 *
 * Tests:
 *  - Module exports: constants
 *  - isGiftCardsEnabled: injectable checkEnabled, fail-open behavior
 *  - initGiftCardSection: text setting, button wiring, navigate, collapse when disabled
 *  - Robustness: missing elements, checkEnabled throws
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initGiftCardSection,
  isGiftCardsEnabled,
  GIFT_CARD_HEADING,
  GIFT_CARD_DESC,
  GIFT_CARD_BTN_TEXT,
  GIFT_CARDS_PATH,
} from '../src/public/giftCardSection.js';

// ── helpers ───────────────────────────────────────────────────────────

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

/**
 * Build a $w mock that returns different elements by selector.
 */
function make$w({ btn, section, heading, desc } = {}) {
  const _btn = btn ?? makeBtn();
  const _section = section ?? makeSection();
  const _heading = heading ?? makeText();
  const _desc = desc ?? makeText();

  const $w = vi.fn(sel => {
    if (sel === '#giftCardBtn') return _btn;
    if (sel === '#giftCardSection') return _section;
    if (sel === '#giftCardHeading') return _heading;
    if (sel === '#giftCardDesc') return _desc;
    throw new Error(`Unknown selector: ${sel}`);
  });

  $w._btn = _btn;
  $w._section = _section;
  $w._heading = _heading;
  $w._desc = _desc;
  return $w;
}

// ═══════════════════════════════════════════════════════════════════
// Module exports — constants
// ═══════════════════════════════════════════════════════════════════

describe('module exports', () => {
  it('exports GIFT_CARD_HEADING as a non-empty string', () => {
    expect(typeof GIFT_CARD_HEADING).toBe('string');
    expect(GIFT_CARD_HEADING.length).toBeGreaterThan(0);
  });

  it('exports GIFT_CARD_DESC as a non-empty string', () => {
    expect(typeof GIFT_CARD_DESC).toBe('string');
    expect(GIFT_CARD_DESC.length).toBeGreaterThan(0);
  });

  it('exports GIFT_CARD_BTN_TEXT as a non-empty string', () => {
    expect(typeof GIFT_CARD_BTN_TEXT).toBe('string');
    expect(GIFT_CARD_BTN_TEXT.length).toBeGreaterThan(0);
  });

  it('exports GIFT_CARDS_PATH as /gift-cards', () => {
    expect(GIFT_CARDS_PATH).toBe('/gift-cards');
  });
});

// ═══════════════════════════════════════════════════════════════════
// isGiftCardsEnabled
// ═══════════════════════════════════════════════════════════════════

describe('isGiftCardsEnabled', () => {
  it('returns true when checkEnabled returns true', async () => {
    const result = await isGiftCardsEnabled({ checkEnabled: () => true });
    expect(result).toBe(true);
  });

  it('returns false when checkEnabled returns false', async () => {
    const result = await isGiftCardsEnabled({ checkEnabled: () => false });
    expect(result).toBe(false);
  });

  it('returns true when checkEnabled returns truthy value', async () => {
    const result = await isGiftCardsEnabled({ checkEnabled: () => 1 });
    expect(result).toBe(true);
  });

  it('returns false when checkEnabled returns falsy (0)', async () => {
    const result = await isGiftCardsEnabled({ checkEnabled: () => 0 });
    expect(result).toBe(false);
  });

  it('fails open (returns true) when checkEnabled throws', async () => {
    const result = await isGiftCardsEnabled({
      checkEnabled: () => { throw new Error('API down'); },
    });
    expect(result).toBe(true);
  });

  it('supports async checkEnabled', async () => {
    const result = await isGiftCardsEnabled({
      checkEnabled: async () => false,
    });
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardSection — enabled state
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardSection — enabled', () => {
  let $w;

  beforeEach(() => {
    $w = make$w();
  });

  const opts = { checkEnabled: () => true, navigate: vi.fn() };

  it('sets heading text to GIFT_CARD_HEADING', async () => {
    await initGiftCardSection($w, opts);
    expect($w._heading.text).toBe(GIFT_CARD_HEADING);
  });

  it('sets description text to GIFT_CARD_DESC', async () => {
    await initGiftCardSection($w, opts);
    expect($w._desc.text).toBe(GIFT_CARD_DESC);
  });

  it('sets button text to GIFT_CARD_BTN_TEXT', async () => {
    await initGiftCardSection($w, opts);
    expect($w._btn.text).toBe(GIFT_CARD_BTN_TEXT);
  });

  it('sets aria label on the button', async () => {
    await initGiftCardSection($w, opts);
    expect($w._btn.accessibility.ariaLabel).toContain('gift');
  });

  it('registers an onClick handler on the button', async () => {
    await initGiftCardSection($w, opts);
    expect($w._btn.onClick).toHaveBeenCalledTimes(1);
  });

  it('does NOT collapse the section when enabled', async () => {
    await initGiftCardSection($w, opts);
    expect($w._section.collapse).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardSection — CTA navigation
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardSection — navigation', () => {
  it('button click calls navigate with GIFT_CARDS_PATH', async () => {
    const navigate = vi.fn();
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => true, navigate });
    $w._btn._fire();
    expect(navigate).toHaveBeenCalledWith(GIFT_CARDS_PATH);
  });

  it('navigate is called with exactly /gift-cards', async () => {
    const navigate = vi.fn();
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => true, navigate });
    $w._btn._fire();
    expect(navigate).toHaveBeenCalledWith('/gift-cards');
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardSection — disabled / collapsed state
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardSection — disabled', () => {
  it('collapses #giftCardSection when gift cards disabled', async () => {
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => false });
    expect($w._section.collapse).toHaveBeenCalledTimes(1);
  });

  it('does NOT set heading text when disabled', async () => {
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => false });
    expect($w._heading.text).toBe('');
  });

  it('does NOT set button text when disabled', async () => {
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => false });
    expect($w._btn.text).toBe('');
  });

  it('does NOT register onClick when disabled', async () => {
    const $w = make$w();
    await initGiftCardSection($w, { checkEnabled: () => false });
    expect($w._btn.onClick).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initGiftCardSection — robustness
// ═══════════════════════════════════════════════════════════════════

describe('initGiftCardSection — robustness', () => {
  it('does not throw when $w throws for any selector', async () => {
    const $w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(
      initGiftCardSection($w, { checkEnabled: () => true })
    ).resolves.not.toThrow();
  });

  it('does not throw when section collapse throws (disabled path)', async () => {
    const $w = vi.fn(() => { throw new Error('Element not found'); });
    await expect(
      initGiftCardSection($w, { checkEnabled: () => false })
    ).resolves.not.toThrow();
  });
});
