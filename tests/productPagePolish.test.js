import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7', sandLight: '#F2E8D5', sandDark: '#D4BC96',
    espresso: '#3A2518', espressoLight: '#5C4033',
    mountainBlue: '#5B8FA8', mountainBlueDark: '#3D6B80', mountainBlueLight: '#A8CCD8',
    sunsetCoral: '#E8845C', sunsetCoralDark: '#C96B44',
    offWhite: '#FAF7F2', white: '#FFFFFF',
    success: '#4A7C59', error: '#C62828',
    muted: '#999999',
  },
  typography: {
    h3: { size: '24px', weight: 600 },
    bodySmall: { size: '14px', weight: 400 },
    caption: { size: '12px', weight: 500 },
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  borderRadius: { sm: '4px', md: '8px', lg: '12px', card: '12px' },
  shadows: {
    card: '0 2px 8px rgba(58,37,24,0.08)',
    cardHover: '0 4px 16px rgba(58,37,24,0.12)',
  },
  transitions: { fast: '150ms ease', medium: '250ms ease' },
}));

// ── Imports (will fail until implementation exists) ──────────────────

import {
  styleGalleryThumbnail,
  styleStickyCartBar,
  styleReviewStars,
  styleRatingBar,
  styleReviewCard,
  styleComfortSection,
  styleComfortCard,
  styleCrossSellSection,
  applyProductPageTokens,
} from '../src/public/ProductPagePolish.js';
import { colors, shadows, transitions } from 'public/designTokens.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: {
      color: '', backgroundColor: '', borderColor: '', borderWidth: '',
      boxShadow: '', transition: '', borderRadius: '', padding: '',
      overflowX: '', display: '', gap: '', flexWrap: '',
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

// ═══════════════════════════════════════════════════════════════════════
// Gallery Thumbnail Active State
// ═══════════════════════════════════════════════════════════════════════

describe('Gallery Thumbnail Active State', () => {
  it('applies Mountain Blue border to active thumbnail', () => {
    const el = createMockElement();
    styleGalleryThumbnail(el, true);
    expect(el.style.borderColor).toBe(colors.mountainBlue);
    expect(el.style.borderWidth).toBe('3px');
  });

  it('applies sandDark border to inactive thumbnail', () => {
    const el = createMockElement();
    styleGalleryThumbnail(el, false);
    expect(el.style.borderColor).toBe(colors.sandDark);
    expect(el.style.borderWidth).toBe('1px');
  });

  it('applies transition for smooth border change', () => {
    const el = createMockElement();
    styleGalleryThumbnail(el, true);
    expect(el.style.transition).toBe(transitions.fast);
  });

  it('applies border radius to thumbnails', () => {
    const el = createMockElement();
    styleGalleryThumbnail(el, false);
    expect(el.style.borderRadius).toBe('4px');
  });

  it('handles null element gracefully', () => {
    expect(() => styleGalleryThumbnail(null, true)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sticky Cart Bar Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Sticky Cart Bar Styling', () => {
  let $w;
  beforeEach(() => { $w = create$w(); });

  it('applies espresso background to bar', () => {
    styleStickyCartBar($w);
    expect($w('#stickyCartBar').style.backgroundColor).toBe(colors.espresso);
  });

  it('applies sand color to product name', () => {
    styleStickyCartBar($w);
    expect($w('#stickyProductName').style.color).toBe(colors.sand);
  });

  it('applies sand color to price', () => {
    styleStickyCartBar($w);
    expect($w('#stickyPrice').style.color).toBe(colors.sand);
  });

  it('applies coral background to CTA button', () => {
    styleStickyCartBar($w);
    expect($w('#stickyAddBtn').style.backgroundColor).toBe(colors.sunsetCoral);
  });

  it('applies espresso text to CTA button for WCAG AA contrast', () => {
    styleStickyCartBar($w);
    expect($w('#stickyAddBtn').style.color).toBe(colors.espresso);
  });

  it('applies warm shadow to bar', () => {
    styleStickyCartBar($w);
    expect($w('#stickyCartBar').style.boxShadow).toBe(shadows.card);
  });

  it('handles missing elements gracefully', () => {
    const broken$w = () => null;
    expect(() => styleStickyCartBar(broken$w)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Review Stars Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Review Stars Styling', () => {
  it('returns coral-colored filled stars and sandDark empty stars', () => {
    const result = styleReviewStars(3.5);
    expect(result.filled).toBe(3);
    expect(result.half).toBe(true);
    expect(result.empty).toBe(1);
    expect(result.filledColor).toBe(colors.sunsetCoral);
    expect(result.emptyColor).toBe(colors.sandDark);
  });

  it('handles 5-star rating', () => {
    const result = styleReviewStars(5);
    expect(result.filled).toBe(5);
    expect(result.half).toBe(false);
    expect(result.empty).toBe(0);
  });

  it('handles 0 rating', () => {
    const result = styleReviewStars(0);
    expect(result.filled).toBe(0);
    expect(result.half).toBe(false);
    expect(result.empty).toBe(5);
  });

  it('handles undefined rating (defaults to 0)', () => {
    const result = styleReviewStars(undefined);
    expect(result.filled).toBe(0);
    expect(result.empty).toBe(5);
  });

  it('clamps rating to 0-5 range', () => {
    const result = styleReviewStars(7);
    expect(result.filled).toBe(5);
    expect(result.empty).toBe(0);
  });

  it('clamps negative rating to 0', () => {
    const result = styleReviewStars(-2);
    expect(result.filled).toBe(0);
    expect(result.empty).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Rating Bar Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Rating Bar Styling', () => {
  it('applies Mountain Blue fill color to bar element', () => {
    const el = createMockElement();
    styleRatingBar(el, 75);
    expect(el.style.backgroundColor).toBe(colors.mountainBlue);
  });

  it('sets bar width to percentage', () => {
    const el = createMockElement();
    styleRatingBar(el, 60);
    expect(el.style.width).toBe('60%');
  });

  it('applies sandLight background track', () => {
    const el = createMockElement();
    const track = createMockElement();
    styleRatingBar(el, 40, track);
    expect(track.style.backgroundColor).toBe(colors.sandLight);
  });

  it('clamps percentage to 0-100', () => {
    const el = createMockElement();
    styleRatingBar(el, 150);
    expect(el.style.width).toBe('100%');
  });

  it('handles 0 percentage', () => {
    const el = createMockElement();
    styleRatingBar(el, 0);
    expect(el.style.width).toBe('0%');
  });

  it('handles null element gracefully', () => {
    expect(() => styleRatingBar(null, 50)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Review Card Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Review Card Styling', () => {
  it('applies warm card shadow', () => {
    const el = createMockElement();
    styleReviewCard(el);
    expect(el.style.boxShadow).toBe(shadows.card);
  });

  it('applies card border radius', () => {
    const el = createMockElement();
    styleReviewCard(el);
    expect(el.style.borderRadius).toBe('12px');
  });

  it('applies offWhite background', () => {
    const el = createMockElement();
    styleReviewCard(el);
    expect(el.style.backgroundColor).toBe(colors.offWhite);
  });

  it('applies padding using spacing tokens', () => {
    const el = createMockElement();
    styleReviewCard(el);
    expect(el.style.padding).toBe('24px');
  });

  it('handles null element gracefully', () => {
    expect(() => styleReviewCard(null)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Comfort Section Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Comfort Section Styling', () => {
  let $w;
  beforeEach(() => { $w = create$w(); });

  it('applies sandLight background to comfort section', () => {
    styleComfortSection($w);
    expect($w('#comfortSection').style.backgroundColor).toBe(colors.sandLight);
  });

  it('applies card border radius to section', () => {
    styleComfortSection($w);
    expect($w('#comfortSection').style.borderRadius).toBe('12px');
  });

  it('applies padding to section', () => {
    styleComfortSection($w);
    expect($w('#comfortSection').style.padding).toBe('32px');
  });

  it('handles missing section gracefully', () => {
    const broken$w = () => null;
    expect(() => styleComfortSection(broken$w)).not.toThrow();
  });
});

describe('Comfort Card Styling', () => {
  it('applies warm shadow to card', () => {
    const el = createMockElement();
    styleComfortCard(el, false);
    expect(el.style.boxShadow).toBe(shadows.card);
  });

  it('highlights active comfort card with Mountain Blue border', () => {
    const el = createMockElement();
    styleComfortCard(el, true);
    expect(el.style.borderColor).toBe(colors.mountainBlue);
    expect(el.style.borderWidth).toBe('2px');
  });

  it('applies offWhite background', () => {
    const el = createMockElement();
    styleComfortCard(el, false);
    expect(el.style.backgroundColor).toBe(colors.offWhite);
  });

  it('applies transition for smooth state change', () => {
    const el = createMockElement();
    styleComfortCard(el, false);
    expect(el.style.transition).toBe(transitions.medium);
  });

  it('handles null element gracefully', () => {
    expect(() => styleComfortCard(null, true)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Cross-Sell Section Styling
// ═══════════════════════════════════════════════════════════════════════

describe('Cross-Sell Section Styling', () => {
  let $w;
  beforeEach(() => { $w = create$w(); });

  it('applies horizontal scroll to repeater container', () => {
    styleCrossSellSection($w, '#relatedRepeater');
    expect($w('#relatedRepeater').style.overflowX).toBe('auto');
  });

  it('applies flex row layout', () => {
    styleCrossSellSection($w, '#relatedRepeater');
    expect($w('#relatedRepeater').style.display).toBe('flex');
    expect($w('#relatedRepeater').style.flexWrap).toBe('nowrap');
  });

  it('applies gap between items', () => {
    styleCrossSellSection($w, '#relatedRepeater');
    expect($w('#relatedRepeater').style.gap).toBe('24px');
  });

  it('handles missing repeater gracefully', () => {
    const broken$w = () => null;
    expect(() => styleCrossSellSection(broken$w, '#relatedRepeater')).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Full Page Token Application
// ═══════════════════════════════════════════════════════════════════════

describe('applyProductPageTokens', () => {
  let $w;
  beforeEach(() => { $w = create$w(); });

  it('styles sticky cart bar', () => {
    applyProductPageTokens($w);
    expect($w('#stickyCartBar').style.backgroundColor).toBe(colors.espresso);
  });

  it('styles comfort section', () => {
    applyProductPageTokens($w);
    expect($w('#comfortSection').style.backgroundColor).toBe(colors.sandLight);
  });

  it('styles cross-sell repeaters', () => {
    applyProductPageTokens($w);
    expect($w('#relatedRepeater').style.overflowX).toBe('auto');
    expect($w('#collectionRepeater').style.overflowX).toBe('auto');
  });

  it('applies coral color to all CTA buttons', () => {
    applyProductPageTokens($w);
    expect($w('#addToCartButton').style.backgroundColor).toBe(colors.sunsetCoral);
    expect($w('#addToCartButton').style.color).toBe(colors.espresso);
  });

  it('styles wishlist button with Mountain Blue', () => {
    applyProductPageTokens($w);
    expect($w('#wishlistBtn').style.borderColor).toBe(colors.mountainBlue);
  });

  it('handles missing elements without throwing', () => {
    const broken$w = (sel) => {
      if (sel === '#stickyCartBar') return null;
      return createMockElement();
    };
    expect(() => applyProductPageTokens(broken$w)).not.toThrow();
  });

  it('styles reviews section heading with espresso', () => {
    applyProductPageTokens($w);
    expect($w('#reviewsSectionTitle').style.color).toBe(colors.espresso);
  });

  it('applies Mountain Blue to review sort dropdown border', () => {
    applyProductPageTokens($w);
    expect($w('#reviewsSortDropdown').style.borderColor).toBe(colors.mountainBlue);
  });
});
