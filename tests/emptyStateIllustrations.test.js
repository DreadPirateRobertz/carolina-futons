import { describe, it, expect } from 'vitest';

import {
  ILLUSTRATION_SVGS,
  svgToDataUri,
} from '../src/public/emptyStateIllustrations.js';

import { colors } from '../src/public/sharedTokens.js';

// All 8 required empty state keys
const REQUIRED_KEYS = [
  'cart', 'search', 'wishlist', 'reviews',
  'category', 'error', 'notFound', 'sideCart',
];

describe('Empty State Illustrations', () => {

  // ── Registry completeness ──────────────────────────────────────────

  describe('ILLUSTRATION_SVGS registry', () => {
    it('exports all 8 required illustration keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ILLUSTRATION_SVGS[key], `missing key: ${key}`).toBeDefined();
      });
    });

    it('contains no extra keys beyond the required 8', () => {
      expect(Object.keys(ILLUSTRATION_SVGS).sort()).toEqual([...REQUIRED_KEYS].sort());
    });
  });

  // ── SVG validity ───────────────────────────────────────────────────

  describe('SVG structure', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key} illustration`, () => {
        it('is a non-empty string', () => {
          expect(typeof ILLUSTRATION_SVGS[key]).toBe('string');
          expect(ILLUSTRATION_SVGS[key].length).toBeGreaterThan(100);
        });

        it('is a valid SVG element', () => {
          const svg = ILLUSTRATION_SVGS[key];
          expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
          expect(svg.trimEnd()).toMatch(/<\/svg>$/);
        });

        it('has a viewBox for responsive sizing', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/viewBox="[^"]+"/);
        });

        it('has xmlns attribute', () => {
          expect(ILLUSTRATION_SVGS[key]).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('does not use hardcoded pixel width/height on root', () => {
          // Root SVG should use viewBox + 100% width, not fixed px
          const rootTag = ILLUSTRATION_SVGS[key].match(/<svg[^>]+>/)[0];
          expect(rootTag).not.toMatch(/width="\d+px"/);
          expect(rootTag).not.toMatch(/height="\d+px"/);
        });
      });
    });
  });

  // ── Brand token usage ──────────────────────────────────────────────

  describe('brand token colors', () => {
    // Each SVG should use at least 2 brand token colors (not random hex)
    const brandHexValues = [
      colors.sandBase, colors.sandLight, colors.sandDark,
      colors.espresso, colors.espressoLight,
      colors.mountainBlue, colors.mountainBlueDark, colors.mountainBlueLight,
      colors.sunsetCoral, colors.sunsetCoralDark, colors.sunsetCoralLight,
      colors.offWhite, colors.skyGradientTop, colors.skyGradientBottom,
      colors.success,
    ];

    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses at least 2 brand colors`, () => {
        const svg = ILLUSTRATION_SVGS[key];
        const usedBrandColors = brandHexValues.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedBrandColors.length, `${key} only uses ${usedBrandColors.length} brand colors`).toBeGreaterThanOrEqual(2);
      });
    });

    it('cart uses sandBase or sunsetCoral (sunrise theme)', () => {
      const svg = ILLUSTRATION_SVGS.cart.toLowerCase();
      const hasSand = svg.includes(colors.sandBase.toLowerCase());
      const hasCoral = svg.includes(colors.sunsetCoral.toLowerCase());
      expect(hasSand || hasCoral).toBe(true);
    });

    it('search uses mountainBlue or skyGradientTop (misty theme)', () => {
      const svg = ILLUSTRATION_SVGS.search.toLowerCase();
      const hasBlue = svg.includes(colors.mountainBlue.toLowerCase());
      const hasSky = svg.includes(colors.skyGradientTop.toLowerCase());
      expect(hasBlue || hasSky).toBe(true);
    });

    it('error uses espresso (storm theme)', () => {
      expect(ILLUSTRATION_SVGS.error.toLowerCase()).toContain(
        colors.espresso.toLowerCase()
      );
    });
  });

  // ── Data URI conversion ────────────────────────────────────────────

  describe('svgToDataUri', () => {
    it('converts SVG string to data URI', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
      const uri = svgToDataUri(svg);
      expect(uri).toMatch(/^data:image\/svg\+xml[,;]/);
    });

    it('result contains encoded SVG content', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
      const uri = svgToDataUri(svg);
      // Should be decodable back to original
      if (uri.includes(';base64,')) {
        const decoded = atob(uri.split(';base64,')[1]);
        expect(decoded).toContain('<rect');
      } else {
        const decoded = decodeURIComponent(uri.split(',')[1]);
        expect(decoded).toContain('<rect');
      }
    });

    it('handles special characters in SVG', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>A & B "quoted"</text></svg>';
      expect(() => svgToDataUri(svg)).not.toThrow();
      const uri = svgToDataUri(svg);
      expect(uri).toMatch(/^data:image\/svg\+xml/);
    });

    it('returns empty string for falsy input', () => {
      expect(svgToDataUri('')).toBe('');
      expect(svgToDataUri(null)).toBe('');
      expect(svgToDataUri(undefined)).toBe('');
    });

    it('produces valid data URIs for all 8 illustrations', () => {
      REQUIRED_KEYS.forEach(key => {
        const uri = svgToDataUri(ILLUSTRATION_SVGS[key]);
        expect(uri, `${key} data URI`).toMatch(/^data:image\/svg\+xml/);
        expect(uri.length, `${key} data URI too short`).toBeGreaterThan(50);
      });
    });
  });

  // ── Thematic consistency ───────────────────────────────────────────

  describe('thematic content', () => {
    it('cart SVG contains path/trail elements (mountain trail theme)', () => {
      // Should have path elements representing the trail
      expect(ILLUSTRATION_SVGS.cart).toMatch(/<path[\s>]/);
    });

    it('search SVG contains mountain silhouette shapes', () => {
      expect(ILLUSTRATION_SVGS.search).toMatch(/<(path|polygon)[\s>]/);
    });

    it('wishlist SVG contains cabin/house shapes', () => {
      expect(ILLUSTRATION_SVGS.wishlist).toMatch(/<(path|polygon|rect)[\s>]/);
    });

    it('error SVG contains cloud shapes', () => {
      expect(ILLUSTRATION_SVGS.error).toMatch(/<(path|circle|ellipse)[\s>]/);
    });

    it('notFound SVG contains fog/mist elements', () => {
      expect(ILLUSTRATION_SVGS.notFound).toMatch(/<(path|rect|ellipse)[\s>]/);
    });

    it('all SVGs contain at least one gradient for watercolor feel', () => {
      REQUIRED_KEYS.forEach(key => {
        const svg = ILLUSTRATION_SVGS[key];
        const hasGradient = svg.includes('<linearGradient') || svg.includes('<radialGradient');
        expect(hasGradient, `${key} missing gradient`).toBe(true);
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('SVGs do not contain script tags (security)', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ILLUSTRATION_SVGS[key]).not.toMatch(/<script/i);
      });
    });

    it('SVGs do not contain event handler attributes (security)', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ILLUSTRATION_SVGS[key]).not.toMatch(/on(click|load|error|mouseover)=/i);
      });
    });

    it('SVGs do not contain external references', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ILLUSTRATION_SVGS[key]).not.toMatch(/xlink:href="http/i);
        expect(ILLUSTRATION_SVGS[key]).not.toMatch(/href="http/i);
      });
    });
  });
});
