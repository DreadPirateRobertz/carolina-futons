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

// ── Helpers (from comfort illustration tests) ────────────────────────

/** Collect all hex color values from sharedTokens.colors as an allowlist. */
function buildTokenHexAllowlist() {
  const hexes = new Set();
  for (const value of Object.values(colors)) {
    if (typeof value === 'string') {
      const match = value.match(/^#[0-9A-Fa-f]{3,8}$/);
      if (match) hexes.add(value.toUpperCase());
    }
  }
  return hexes;
}

/** Extract all hex colors (#RGB, #RRGGBB, #RRGGBBAA) from a string. */
function extractHexColors(str) {
  const matches = str.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  return matches.map((h) => h.toUpperCase());
}

/** Count SVG shape/path elements in a string. */
function countShapeElements(svg) {
  const tags = ['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line'];
  let count = 0;
  for (const tag of tags) {
    const re = new RegExp(`<${tag}[\\s/>]`, 'gi');
    const matches = svg.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

const TOKEN_HEXES = buildTokenHexAllowlist();

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

  // ══════════════════════════════════════════════════════════════════════
  // 8-POINT QUALITY BAR (cf-37uy retrofit)
  // Matching comfortIllustrations quality standard
  // ══════════════════════════════════════════════════════════════════════

  // ── 1. No programmatic SVG filters (deprecated per overseer directive) ──

  describe('Quality bar — no SVG filters', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} does not use <filter> elements (deprecated)`, () => {
        expect(ILLUSTRATION_SVGS[key]).not.toMatch(/<filter[\s>]/);
      });
    });
  });

  // ── 3. Brand tokens only (no hardcoded hex) ───────────────────────

  describe('Quality bar — brand tokens only', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: all hex colors come from sharedTokens.colors`, () => {
        const svg = ILLUSTRATION_SVGS[key];
        const foundHexes = extractHexColors(svg);
        expect(foundHexes.length).toBeGreaterThan(0);
        for (const hex of foundHexes) {
          expect(TOKEN_HEXES, `${key} has non-token hex: ${hex}`).toContain(hex);
        }
      });
    });
  });

  // ── 4. Rich gradients (5+ stops) ─────────────────────────────────

  describe('Quality bar — gradients', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has at least one gradient', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/<(linearGradient|radialGradient)/);
        });

        it('has 5+ gradient stops total', () => {
          const stops = ILLUSTRATION_SVGS[key].match(/<stop[\s/]/g) || [];
          expect(stops.length, `${key} has ${stops.length} stops`).toBeGreaterThanOrEqual(5);
        });
      });
    });
  });

  // ── 5. Element count (15+ shapes per scene) ──────────────────────

  describe('Quality bar — element count', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: has 15+ SVG shape/path elements`, () => {
        const count = countShapeElements(ILLUSTRATION_SVGS[key]);
        expect(count, `${key} has ${count} elements`).toBeGreaterThanOrEqual(15);
      });
    });
  });

  // ── 6. Atmospheric depth layers ───────────────────────────────────

  describe('Quality bar — atmospheric layers', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has a group with id="background"', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/id="background"/);
        });

        it('has a group with id="midground"', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/id="midground"/);
        });

        it('has a group with id="foreground"', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/id="foreground"/);
        });
      });
    });
  });

  // ── 7. Accessibility ─────────────────────────────────────────────

  describe('Quality bar — accessibility', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has role="img"', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/role="img"/);
        });

        it('has a <title> element', () => {
          expect(ILLUSTRATION_SVGS[key]).toMatch(/<title[^>]*>.*<\/title>/s);
        });

        it('has aria-labelledby referencing the title id', () => {
          const titleIdMatch = ILLUSTRATION_SVGS[key].match(/<title\s+id="([^"]+)"/);
          expect(titleIdMatch, `${key} missing title id`).not.toBeNull();
          const titleId = titleIdMatch[1];
          expect(ILLUSTRATION_SVGS[key]).toMatch(
            new RegExp(`aria-labelledby="[^"]*${titleId}[^"]*"`)
          );
        });
      });
    });
  });

  // ── 8. Detail elements (birds, trees, flowers) ───────────────────

  describe('Quality bar — detail elements', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: has bird V-shapes (espresso-stroked line pairs) or wildflower stems (success-stroked paths)`, () => {
        const svg = ILLUSTRATION_SVGS[key];
        const espressoHex = colors.espresso.toLowerCase();
        const successHex = colors.success.toLowerCase();
        const svgLower = svg.toLowerCase();
        // Birds = V-shaped line pairs with espresso stroke (2 lines per V)
        const birdLineRe = new RegExp(`<line[^>]*stroke="${espressoHex}"`, 'g');
        const birdLineCount = (svgLower.match(birdLineRe) || []).length;
        const hasBirds = birdLineCount >= 2;
        // Wildflower stems = thin paths with success/green stroke
        const hasWildflowerStems = svgLower.includes(`stroke="${successHex}"`);
        expect(hasBirds || hasWildflowerStems,
          `${key} lacks detail elements (needs espresso bird lines or success wildflower stems)`).toBe(true);
      });
    });
  });
});
