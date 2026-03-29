/**
 * Tests for assembly difficulty badge — renderCardAssemblyBadge + ASSEMBLY_BADGE_CONFIG
 * (cf-73fz)
 *
 * Covers:
 * - ASSEMBLY_BADGE_CONFIG shape and tier values
 * - Easy/Medium/Expert: correct label, bg, fg colors
 * - null / undefined / unknown difficulty → element hidden
 * - Badge text is set correctly for each tier
 * - aria-label includes time when assemblyTimeMinutes provided
 * - aria-label omitted when assemblyTimeMinutes absent
 * - null $el is a no-op (does not throw)
 * - Style props applied (bg, fg, borderRadius)
 * - Style exceptions caught silently (graceful degradation)
 * - Show/hide exceptions caught and logged as warnings
 * - Catalog-MASTER: all 88 products have assemblyDifficulty + assemblyTimeMinutes
 * - Catalog-MASTER: only valid difficulty values used
 * - Catalog-MASTER: front-loading-nesting products are Medium
 * - Catalog-MASTER: murphy-cabinet-beds products are Expert
 * - assemblyGuides ASSEMBLY_DATA covers front-loading-nesting
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import catalogMaster from '../content/catalog-MASTER.json';

vi.mock('../src/public/designTokens.js', () => ({
  colors: {
    white: '#FFFFFF',
    espresso: '#3A2518',
    success: '#4A7C59',
    badgeGold: '#C8960C',
    badgeCoral: '#E8634B',
    sunsetCoral: '#4A7D94',
    mountainBlue: '#5B8FA8',
    sandLight: '#F2E8D5',
  },
  borderRadius: { sm: '4px', card: '12px' },
  shadows: {},
  transitions: { cardHover: '300ms ease' },
}));

vi.mock('../src/public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'https://placeholder.com/default.jpg'),
}));

vi.mock('../src/public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

import {
  renderCardAssemblyBadge,
  ASSEMBLY_BADGE_CONFIG,
} from '../src/public/productCardHelpers.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockEl(overrides = {}) {
  return {
    text: '',
    hide: vi.fn(),
    show: vi.fn(),
    setAttribute: vi.fn(),
    style: { backgroundColor: '', color: '', borderRadius: '' },
    ...overrides,
  };
}

function mockElNoStyle() {
  const el = mockEl();
  Object.defineProperty(el, 'style', { get() { throw new Error('no style'); } });
  return el;
}

function mockElThrowsOnShow() {
  const el = mockEl();
  el.show = vi.fn(() => { throw new Error('show unsupported'); });
  return el;
}

// ═════════════════════════════════════════════════════════════════════════════
// ASSEMBLY_BADGE_CONFIG
// ═════════════════════════════════════════════════════════════════════════════

describe('ASSEMBLY_BADGE_CONFIG', () => {
  it('has entries for Easy, Medium, Expert', () => {
    expect(ASSEMBLY_BADGE_CONFIG).toHaveProperty('Easy');
    expect(ASSEMBLY_BADGE_CONFIG).toHaveProperty('Medium');
    expect(ASSEMBLY_BADGE_CONFIG).toHaveProperty('Expert');
  });

  it('Easy config has label, bg, fg', () => {
    const { label, bg, fg } = ASSEMBLY_BADGE_CONFIG.Easy;
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(bg).toBeTruthy();
    expect(fg).toBeTruthy();
  });

  it('Medium config has label, bg, fg', () => {
    const { label, bg, fg } = ASSEMBLY_BADGE_CONFIG.Medium;
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(bg).toBeTruthy();
    expect(fg).toBeTruthy();
  });

  it('Expert config has label, bg, fg', () => {
    const { label, bg, fg } = ASSEMBLY_BADGE_CONFIG.Expert;
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(bg).toBeTruthy();
    expect(fg).toBeTruthy();
  });

  it('three tiers use distinct background colors', () => {
    const bgs = [
      ASSEMBLY_BADGE_CONFIG.Easy.bg,
      ASSEMBLY_BADGE_CONFIG.Medium.bg,
      ASSEMBLY_BADGE_CONFIG.Expert.bg,
    ];
    expect(new Set(bgs).size).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// renderCardAssemblyBadge — hiding for invalid/missing difficulty
// ═════════════════════════════════════════════════════════════════════════════

describe('renderCardAssemblyBadge — hides for absent/invalid difficulty', () => {
  it('hides element when difficulty is null', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, null);
    expect($el.hide).toHaveBeenCalledOnce();
    expect($el.show).not.toHaveBeenCalled();
  });

  it('hides element when difficulty is undefined', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, undefined);
    expect($el.hide).toHaveBeenCalledOnce();
    expect($el.show).not.toHaveBeenCalled();
  });

  it('hides element when difficulty is an unrecognized string', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Novice');
    expect($el.hide).toHaveBeenCalledOnce();
    expect($el.show).not.toHaveBeenCalled();
  });

  it('hides element when difficulty is empty string', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, '');
    expect($el.hide).toHaveBeenCalledOnce();
  });

  it('is a no-op when $el is null', () => {
    expect(() => renderCardAssemblyBadge(null, 'Easy')).not.toThrow();
  });

  it('is a no-op when $el is undefined', () => {
    expect(() => renderCardAssemblyBadge(undefined, 'Easy')).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// renderCardAssemblyBadge — Easy
// ═════════════════════════════════════════════════════════════════════════════

describe('renderCardAssemblyBadge — Easy', () => {
  it('shows the element', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.show).toHaveBeenCalledOnce();
  });

  it('sets text to Easy label', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.text).toBe(ASSEMBLY_BADGE_CONFIG.Easy.label);
  });

  it('applies success (green) background color', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.style.backgroundColor).toBe('#4A7C59'); // colors.success
  });

  it('applies white foreground color', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.style.color).toBe('#FFFFFF');
  });

  it('applies borderRadius', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.style.borderRadius).toBe('4px');
  });

  it('sets aria-label with time when assemblyTimeMinutes provided', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy', 30);
    expect($el.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringContaining('30 minutes')
    );
  });

  it('does not call setAttribute when assemblyTimeMinutes is absent', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.setAttribute).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// renderCardAssemblyBadge — Medium
// ═════════════════════════════════════════════════════════════════════════════

describe('renderCardAssemblyBadge — Medium', () => {
  it('shows the element', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Medium');
    expect($el.show).toHaveBeenCalledOnce();
  });

  it('sets text to Medium label', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Medium');
    expect($el.text).toBe(ASSEMBLY_BADGE_CONFIG.Medium.label);
  });

  it('applies gold (yellow) background color', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Medium');
    expect($el.style.backgroundColor).toBe('#C8960C'); // colors.badgeGold
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// renderCardAssemblyBadge — Expert
// ═════════════════════════════════════════════════════════════════════════════

describe('renderCardAssemblyBadge — Expert', () => {
  it('shows the element', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Expert');
    expect($el.show).toHaveBeenCalledOnce();
  });

  it('sets text to Expert label', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Expert');
    expect($el.text).toBe(ASSEMBLY_BADGE_CONFIG.Expert.label);
  });

  it('applies coral (orange) background color', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Expert');
    expect($el.style.backgroundColor).toBe('#E8634B'); // colors.badgeCoral
  });

  it('sets aria-label with time for 120 minutes', () => {
    const $el = mockEl();
    renderCardAssemblyBadge($el, 'Expert', 120);
    expect($el.setAttribute).toHaveBeenCalledWith(
      'aria-label',
      expect.stringContaining('120 minutes')
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Graceful degradation
// ═════════════════════════════════════════════════════════════════════════════

describe('renderCardAssemblyBadge — graceful degradation', () => {
  it('does not throw when element has no style property', () => {
    const $el = mockElNoStyle();
    expect(() => renderCardAssemblyBadge($el, 'Easy')).not.toThrow();
  });

  it('still sets text and shows element when style throws', () => {
    const $el = mockElNoStyle();
    renderCardAssemblyBadge($el, 'Easy');
    expect($el.show).toHaveBeenCalled();
    expect($el.text).toBe(ASSEMBLY_BADGE_CONFIG.Easy.label);
  });

  it('catches and logs warning when show() throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const $el = mockElThrowsOnShow();
    expect(() => renderCardAssemblyBadge($el, 'Easy')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('#gridAssemblyBadge'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it('catches hide() throw silently when difficulty is null', () => {
    const $el = mockEl();
    $el.hide = vi.fn(() => { throw new Error('no element'); });
    expect(() => renderCardAssemblyBadge($el, null)).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// catalog-MASTER.json — data integrity
// ═════════════════════════════════════════════════════════════════════════════

const VALID_DIFFICULTIES = new Set(['Easy', 'Medium', 'Expert']);
const products = catalogMaster.products;

describe('catalog-MASTER.json — assemblyDifficulty field', () => {
  it('all 88 products have assemblyDifficulty', () => {
    const missing = products.filter(p => !p.assemblyDifficulty);
    expect(missing).toHaveLength(0);
  });

  it('all 88 products have assemblyTimeMinutes', () => {
    const missing = products.filter(p => p.assemblyTimeMinutes == null);
    expect(missing).toHaveLength(0);
  });

  it('assemblyDifficulty is always Easy, Medium, or Expert', () => {
    const invalid = products.filter(p => !VALID_DIFFICULTIES.has(p.assemblyDifficulty));
    expect(invalid).toHaveLength(0);
  });

  it('assemblyTimeMinutes is always a positive integer', () => {
    const invalid = products.filter(p =>
      typeof p.assemblyTimeMinutes !== 'number' ||
      p.assemblyTimeMinutes <= 0 ||
      !Number.isInteger(p.assemblyTimeMinutes)
    );
    expect(invalid).toHaveLength(0);
  });

  it('futon-frames products are Medium difficulty', () => {
    const frames = products.filter(p => p.category === 'futon-frames');
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every(p => p.assemblyDifficulty === 'Medium')).toBe(true);
  });

  it('murphy-cabinet-beds products are Expert difficulty', () => {
    const murphys = products.filter(p => p.category === 'murphy-cabinet-beds');
    expect(murphys.length).toBeGreaterThan(0);
    expect(murphys.every(p => p.assemblyDifficulty === 'Expert')).toBe(true);
  });

  it('murphy-cabinet-beds assemblyTimeMinutes >= 60', () => {
    const murphys = products.filter(p => p.category === 'murphy-cabinet-beds');
    expect(murphys.every(p => p.assemblyTimeMinutes >= 60)).toBe(true);
  });

  it('mattresses are Easy difficulty with assemblyTimeMinutes <= 15', () => {
    const mattresses = products.filter(p => p.category === 'mattresses');
    expect(mattresses.length).toBeGreaterThan(0);
    expect(mattresses.every(p => p.assemblyDifficulty === 'Easy')).toBe(true);
    expect(mattresses.every(p => p.assemblyTimeMinutes <= 15)).toBe(true);
  });

  it('front-loading-nesting products are Medium difficulty', () => {
    const nested = products.filter(p => p.category === 'front-loading-nesting');
    expect(nested.length).toBeGreaterThan(0);
    expect(nested.every(p => p.assemblyDifficulty === 'Medium')).toBe(true);
  });

  it('wall-hugger-frames products are Medium difficulty', () => {
    const wallHuggers = products.filter(p => p.category === 'wall-hugger-frames');
    expect(wallHuggers.length).toBeGreaterThan(0);
    expect(wallHuggers.every(p => p.assemblyDifficulty === 'Medium')).toBe(true);
  });

  it('casegoods-accessories products are Easy difficulty', () => {
    const accessories = products.filter(p => p.category === 'casegoods-accessories');
    expect(accessories.length).toBeGreaterThan(0);
    expect(accessories.every(p => p.assemblyDifficulty === 'Easy')).toBe(true);
  });

  it('products are distributed across all three tiers', () => {
    const tiers = new Set(products.map(p => p.assemblyDifficulty));
    expect(tiers.has('Easy')).toBe(true);
    expect(tiers.has('Medium')).toBe(true);
    expect(tiers.has('Expert')).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// assemblyGuides — ASSEMBLY_DATA completeness
// ═════════════════════════════════════════════════════════════════════════════

describe('assemblyGuides — ASSEMBLY_DATA completeness', () => {
  it('covers front-loading-nesting category', async () => {
    const { getAssemblyInfo } = await import('../src/backend/assemblyGuides.web.js');
    const result = await getAssemblyInfo('front-loading-nesting');
    expect(result.success).toBe(true);
    expect(result.info).not.toBeNull();
    expect(result.info.category).toBe('front-loading-nesting');
  });

  it('front-loading-nesting is Medium difficulty', async () => {
    const { getAssemblyInfo } = await import('../src/backend/assemblyGuides.web.js');
    const result = await getAssemblyInfo('front-loading-nesting');
    expect(result.info.difficultyLevel).toBe(2); // Medium=2
  });

  it('covers all catalog categories', async () => {
    const { getAssemblyInfo } = await import('../src/backend/assemblyGuides.web.js');
    const catalogCategories = [...new Set(products.map(p => p.category))];
    for (const cat of catalogCategories) {
      const result = await getAssemblyInfo(cat);
      expect(result.success).toBe(true);
      expect(result.info).not.toBeNull();
    }
  });
});
