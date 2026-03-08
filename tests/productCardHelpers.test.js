// productCardHelpers.test.js — TDD tests for product card structure + badges
// cf-biba: Product card containers with white bg, 12px radius, shadows, badges
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock designTokens before importing module under test
vi.mock('../src/public/designTokens.js', () => ({
  colors: {
    white: '#FFFFFF',
    sunsetCoral: '#E8845C',
    mountainBlue: '#5B8FA8',
    espresso: '#3A2518',
    sandLight: '#F2E8D5',
  },
  borderRadius: { sm: '4px', card: '12px' },
  shadows: {
    card: '0 2px 12px rgba(58, 37, 24, 0.08)',
    cardHover: '0 8px 24px rgba(58, 37, 24, 0.12)',
  },
  transitions: { cardHover: '300ms cubic-bezier(0.4, 0, 0.2, 1)' },
}));

vi.mock('../src/public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn((category) => `https://placeholder.com/${category || 'default'}.jpg`),
}));

import {
  styleCardContainer,
  styleBadge,
  getBadgeColor,
  initCardHover,
  formatCardPrice,
  setCardImage,
} from '../src/public/productCardHelpers.js';

// ── Helper: mock Wix element ──────────────────────────────────────────
function mockElement(overrides = {}) {
  return {
    style: {
      backgroundColor: '',
      borderRadius: '',
      boxShadow: '',
      transition: '',
      color: '',
    },
    text: '',
    src: '',
    alt: '',
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Card Container Styling
// ═══════════════════════════════════════════════════════════════════════

describe('styleCardContainer', () => {
  it('applies white background', () => {
    const el = mockElement();
    styleCardContainer(el);
    expect(el.style.backgroundColor).toBe('#FFFFFF');
  });

  it('applies 12px border radius', () => {
    const el = mockElement();
    styleCardContainer(el);
    expect(el.style.borderRadius).toBe('12px');
  });

  it('applies card shadow', () => {
    const el = mockElement();
    styleCardContainer(el);
    expect(el.style.boxShadow).toBe('0 2px 12px rgba(58, 37, 24, 0.08)');
  });

  it('applies hover transition', () => {
    const el = mockElement();
    styleCardContainer(el);
    expect(el.style.transition).toBe('300ms cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('handles null element gracefully', () => {
    expect(() => styleCardContainer(null)).not.toThrow();
  });

  it('handles element with no style property', () => {
    expect(() => styleCardContainer({})).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Badge Color Mapping
// ═══════════════════════════════════════════════════════════════════════

describe('getBadgeColor', () => {
  it('returns coral for "Sale"', () => {
    expect(getBadgeColor('Sale')).toBe('#E8845C');
  });

  it('returns mountainBlue for "New"', () => {
    expect(getBadgeColor('New')).toBe('#5B8FA8');
  });

  it('returns mountainBlue for "Bestseller"', () => {
    expect(getBadgeColor('Bestseller')).toBe('#5B8FA8');
  });

  it('returns mountainBlue for "Featured"', () => {
    expect(getBadgeColor('Featured')).toBe('#5B8FA8');
  });

  it('returns coral for "Clearance"', () => {
    expect(getBadgeColor('Clearance')).toBe('#E8845C');
  });

  it('is case-insensitive', () => {
    expect(getBadgeColor('sale')).toBe('#E8845C');
    expect(getBadgeColor('NEW')).toBe('#5B8FA8');
    expect(getBadgeColor('BESTSELLER')).toBe('#5B8FA8');
  });

  it('returns mountainBlue for unknown badge types', () => {
    expect(getBadgeColor('Limited Edition')).toBe('#5B8FA8');
  });

  it('returns null for empty/null input', () => {
    expect(getBadgeColor('')).toBeNull();
    expect(getBadgeColor(null)).toBeNull();
    expect(getBadgeColor(undefined)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. Badge Styling
// ═══════════════════════════════════════════════════════════════════════

describe('styleBadge', () => {
  it('applies coral bg and espresso text for Sale badge (WCAG AA)', () => {
    const el = mockElement();
    styleBadge(el, 'Sale');
    expect(el.style.backgroundColor).toBe('#E8845C');
    expect(el.style.color).toBe('#3A2518');
  });

  it('applies mountainBlue bg and white text for New badge', () => {
    const el = mockElement();
    styleBadge(el, 'New');
    expect(el.style.backgroundColor).toBe('#5B8FA8');
    expect(el.style.color).toBe('#FFFFFF');
  });

  it('applies coral bg and espresso text for Clearance badge (WCAG AA)', () => {
    const el = mockElement();
    styleBadge(el, 'Clearance');
    expect(el.style.backgroundColor).toBe('#E8845C');
    expect(el.style.color).toBe('#3A2518');
  });

  it('applies mountainBlue bg for Bestseller badge', () => {
    const el = mockElement();
    styleBadge(el, 'Bestseller');
    expect(el.style.backgroundColor).toBe('#5B8FA8');
  });

  it('applies 4px border radius to badge', () => {
    const el = mockElement();
    styleBadge(el, 'Sale');
    expect(el.style.borderRadius).toBe('4px');
  });

  it('sets badge text', () => {
    const el = mockElement();
    styleBadge(el, 'Sale');
    expect(el.text).toBe('Sale');
  });

  it('shows the badge element', () => {
    const el = mockElement();
    styleBadge(el, 'New');
    expect(el.show).toHaveBeenCalled();
  });

  it('hides badge for null/empty badge type', () => {
    const el = mockElement();
    styleBadge(el, null);
    expect(el.hide).toHaveBeenCalled();
  });

  it('hides badge for empty string', () => {
    const el = mockElement();
    styleBadge(el, '');
    expect(el.hide).toHaveBeenCalled();
  });

  it('handles null element gracefully', () => {
    expect(() => styleBadge(null, 'Sale')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Card Hover Effect
// ═══════════════════════════════════════════════════════════════════════

describe('initCardHover', () => {
  it('registers mouseIn handler', () => {
    const el = mockElement();
    initCardHover(el);
    expect(el.onMouseIn).toHaveBeenCalledTimes(1);
  });

  it('registers mouseOut handler', () => {
    const el = mockElement();
    initCardHover(el);
    expect(el.onMouseOut).toHaveBeenCalledTimes(1);
  });

  it('mouseIn elevates shadow to cardHover', () => {
    const el = mockElement();
    initCardHover(el);
    // Get the handler and call it
    const mouseInHandler = el.onMouseIn.mock.calls[0][0];
    mouseInHandler();
    expect(el.style.boxShadow).toBe('0 8px 24px rgba(58, 37, 24, 0.12)');
  });

  it('mouseOut restores card shadow', () => {
    const el = mockElement();
    initCardHover(el);
    // First elevate
    const mouseInHandler = el.onMouseIn.mock.calls[0][0];
    mouseInHandler();
    // Then restore
    const mouseOutHandler = el.onMouseOut.mock.calls[0][0];
    mouseOutHandler();
    expect(el.style.boxShadow).toBe('0 2px 12px rgba(58, 37, 24, 0.08)');
  });

  it('handles null element gracefully', () => {
    expect(() => initCardHover(null)).not.toThrow();
  });

  it('handles element without mouse handlers', () => {
    expect(() => initCardHover({})).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. Price Formatting
// ═══════════════════════════════════════════════════════════════════════

describe('formatCardPrice', () => {
  it('shows regular price when no discount', () => {
    const priceEl = mockElement();
    const origPriceEl = mockElement();
    const saleBadgeEl = mockElement();
    formatCardPrice(priceEl, origPriceEl, saleBadgeEl, {
      formattedPrice: '$599.00',
    });
    expect(priceEl.text).toBe('$599.00');
    expect(origPriceEl.hide).toHaveBeenCalled();
    expect(saleBadgeEl.hide).toHaveBeenCalled();
  });

  it('shows discounted price and strikethrough original when on sale', () => {
    const priceEl = mockElement();
    const origPriceEl = mockElement();
    const saleBadgeEl = mockElement();
    formatCardPrice(priceEl, origPriceEl, saleBadgeEl, {
      formattedPrice: '$599.00',
      formattedDiscountedPrice: '$449.00',
    });
    expect(priceEl.text).toBe('$449.00');
    expect(origPriceEl.text).toBe('$599.00');
    expect(origPriceEl.show).toHaveBeenCalled();
    expect(saleBadgeEl.show).toHaveBeenCalled();
  });

  it('shows "Price unavailable" when no price data', () => {
    const priceEl = mockElement();
    const origPriceEl = mockElement();
    const saleBadgeEl = mockElement();
    formatCardPrice(priceEl, origPriceEl, saleBadgeEl, {});
    expect(priceEl.text).toBe('Price unavailable');
    expect(origPriceEl.hide).toHaveBeenCalled();
  });

  it('handles null product gracefully', () => {
    const priceEl = mockElement();
    const origPriceEl = mockElement();
    const saleBadgeEl = mockElement();
    expect(() => formatCardPrice(priceEl, origPriceEl, saleBadgeEl, null)).not.toThrow();
    expect(priceEl.text).toBe('Price unavailable');
  });

  it('handles null price element gracefully', () => {
    expect(() => formatCardPrice(null, null, null, { formattedPrice: '$50' })).not.toThrow();
  });

  it('handles missing origPrice element when on sale', () => {
    const priceEl = mockElement();
    const saleBadgeEl = mockElement();
    expect(() => formatCardPrice(priceEl, null, saleBadgeEl, {
      formattedPrice: '$599.00',
      formattedDiscountedPrice: '$449.00',
    })).not.toThrow();
    expect(priceEl.text).toBe('$449.00');
  });

  it('handles missing saleBadge element when on sale', () => {
    const priceEl = mockElement();
    const origPriceEl = mockElement();
    expect(() => formatCardPrice(priceEl, origPriceEl, null, {
      formattedPrice: '$599.00',
      formattedDiscountedPrice: '$449.00',
    })).not.toThrow();
    expect(priceEl.text).toBe('$449.00');
    expect(origPriceEl.text).toBe('$599.00');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Card Image with Placeholder Fallback
// ═══════════════════════════════════════════════════════════════════════

describe('setCardImage', () => {
  it('sets image src from product mainMedia', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/futon.jpg', name: 'Futon' });
    expect(el.src).toBe('https://img.com/futon.jpg');
  });

  it('sets alt text from product name', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/futon.jpg', name: 'Night & Day Futon Frame' });
    expect(el.alt).toContain('Night & Day Futon Frame');
  });

  it('uses placeholder when mainMedia is missing', () => {
    const el = mockElement();
    setCardImage(el, { name: 'Futon' }, 'futon-frames');
    expect(el.src).toBe('https://placeholder.com/futon-frames.jpg');
  });

  it('uses placeholder when mainMedia is empty string', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: '', name: 'Futon' }, 'mattresses');
    expect(el.src).toBe('https://placeholder.com/mattresses.jpg');
  });

  it('uses default placeholder when no category', () => {
    const el = mockElement();
    setCardImage(el, { name: 'Item' });
    expect(el.src).toBe('https://placeholder.com/default.jpg');
  });

  it('handles null product gracefully', () => {
    const el = mockElement();
    expect(() => setCardImage(el, null)).not.toThrow();
    expect(el.src).toBe('https://placeholder.com/default.jpg');
    expect(el.alt).toBe('Product image');
  });

  it('handles null element gracefully', () => {
    expect(() => setCardImage(null, { mainMedia: 'x', name: 'Y' })).not.toThrow();
  });

  it('sets fallback alt when name is missing', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/x.jpg' });
    expect(el.alt).toBe('Product image');
  });

  // ── CLS Prevention: explicit dimensions ──────────────────────────
  it('sets responsive width and aspect-ratio when dimensions provided', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/futon.jpg', name: 'Futon' }, 'futon-frames', { width: 400, height: 400 });
    expect(el.style.width).toBe('100%');
    expect(el.style.aspectRatio).toBe('400 / 400');
  });

  it('does not set dimensions when not provided', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/futon.jpg', name: 'Futon' });
    expect(el.style.width).toBeUndefined();
    expect(el.style.aspectRatio).toBeUndefined();
  });

  it('sets correct aspect-ratio for non-square dimensions', () => {
    const el = mockElement();
    setCardImage(el, { mainMedia: 'https://img.com/futon.jpg', name: 'Futon' }, '', { width: 600, height: 400 });
    expect(el.style.aspectRatio).toBe('600 / 400');
    expect(el.style.width).toBe('100%');
  });

  it('handles dimensions gracefully when style is not settable', () => {
    const el = {
      src: '',
      alt: '',
      style: {
        get width() { return ''; },
        set width(_) { throw new Error('not settable'); },
      },
    };
    expect(() => setCardImage(el, { mainMedia: 'https://img.com/x.jpg', name: 'Y' }, '', { width: 400, height: 400 })).not.toThrow();
  });
});
