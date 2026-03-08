import { describe, it, expect } from 'vitest';
import {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  grid,
  breakpoints,
  seo,
  categories,
  crossSellMap,
  bundleSuggestions,
} from '../../src/public/designTokens.js';

// ── Colors ──────────────────────────────────────────────────────────

describe('colors', () => {
  it('has all primary palette colors', () => {
    expect(colors.sandBase).toBe('#E8D5B7');
    expect(colors.espresso).toBe('#3A2518');
    expect(colors.mountainBlue).toBe('#5B8FA8');
    expect(colors.sunsetCoral).toBe('#E8845C');
  });

  it('all color values are valid hex or rgba', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(
        value.startsWith('#') || value.startsWith('rgba'),
        `${key}: ${value} should be hex or rgba`
      ).toBe(true);
    }
  });

  it('has hover variants for interactive colors', () => {
    expect(colors.mountainBlueDark).toBeDefined();
    expect(colors.sunsetCoralDark).toBeDefined();
  });
});

// ── Typography ──────────────────────────────────────────────────────

describe('typography', () => {
  it('defines heading and body font families', () => {
    expect(typography.headingFamily).toContain('Playfair Display');
    expect(typography.bodyFamily).toContain('Source Sans 3');
  });

  it('all scale entries have size, weight, lineHeight', () => {
    const scales = ['heroTitle', 'h1', 'h2', 'h3', 'h4', 'body', 'bodySmall', 'caption', 'button'];
    for (const scale of scales) {
      expect(typography[scale].size).toBeDefined();
      expect(typography[scale].weight).toBeGreaterThan(0);
      expect(typography[scale].lineHeight).toBeGreaterThan(0);
    }
  });

  it('heading sizes decrease from hero to h4', () => {
    const sizes = ['heroTitle', 'h1', 'h2', 'h3', 'h4'].map(
      k => parseInt(typography[k].size)
    );
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });
});

// ── Spacing ─────────────────────────────────────────────────────────

describe('spacing', () => {
  it('has standard spacing scale', () => {
    expect(spacing.xs).toBe('4px');
    expect(spacing.sm).toBe('8px');
    expect(spacing.md).toBe('16px');
    expect(spacing.lg).toBe('24px');
  });

  it('has page padding and max width', () => {
    expect(spacing.maxWidth).toBe('1280px');
    expect(spacing.pagePadding).toBeDefined();
    expect(spacing.pagePaddingDesktop).toBeDefined();
  });
});

// ── Breakpoints ─────────────────────────────────────────────────────

describe('breakpoints', () => {
  it('has standard device breakpoints', () => {
    expect(breakpoints.mobile).toBeLessThan(breakpoints.tablet);
    expect(breakpoints.tablet).toBeLessThan(breakpoints.desktop);
    expect(breakpoints.desktop).toBeLessThan(breakpoints.wide);
  });
});

// ── SEO ─────────────────────────────────────────────────────────────

describe('seo', () => {
  it('has site name and default description', () => {
    expect(seo.siteName).toBe('Carolina Futons');
    expect(seo.defaultDescription).toContain('futon');
  });

  it('has business address', () => {
    expect(seo.businessAddress.city).toBe('Hendersonville');
    expect(seo.businessAddress.state).toBe('NC');
  });

  it('has category-specific SEO titles for all categories', () => {
    const slugs = Object.keys(seo.categoryTitles);
    expect(slugs).toContain('futon-frames');
    expect(slugs).toContain('mattresses');
    expect(slugs).toContain('murphy-cabinet-beds');
    expect(slugs).toContain('wall-huggers');
  });
});

// ── Categories ──────────────────────────────────────────────────────

describe('categories', () => {
  it('defines all major product categories', () => {
    expect(categories.futonFrames.slug).toBe('futon-frames');
    expect(categories.mattresses.slug).toBe('mattresses');
    expect(categories.murphyBeds.slug).toBe('murphy-cabinet-beds');
    expect(categories.platformBeds.slug).toBe('platform-beds');
  });

  it('futon frames has subcategories', () => {
    expect(categories.futonFrames.subcategories.length).toBeGreaterThan(0);
    const slugs = categories.futonFrames.subcategories.map(s => s.slug);
    expect(slugs).toContain('wall-huggers');
    expect(slugs).toContain('unfinished-wood');
  });
});

// ── Cross-sell Map ──────────────────────────────────────────────────

describe('crossSellMap', () => {
  it('futon frames cross-sell to mattresses', () => {
    expect(crossSellMap['futon-frames']).toContain('mattresses');
  });

  it('all categories have cross-sell entries', () => {
    const cats = Object.keys(crossSellMap);
    expect(cats.length).toBeGreaterThanOrEqual(5);
    for (const suggestions of Object.values(crossSellMap)) {
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    }
  });
});

// ── Bundle Suggestions ──────────────────────────────────────────────

describe('bundleSuggestions', () => {
  it('frame suggests mattress next', () => {
    expect(bundleSuggestions.frame.suggestNext).toBe('mattress');
    expect(bundleSuggestions.frame.label).toContain('Mattress');
  });

  it('cover is terminal (no next suggestion)', () => {
    expect(bundleSuggestions.cover.suggestNext).toBeNull();
  });
});
