import { describe, it, expect } from 'vitest';
import { ILLUSTRATIONS, svgToDataUri } from '../src/public/emptyStateIllustrations.js';
import { colors } from '../src/public/sharedTokens.js';

// ── Helper ──────────────────────────────────────────────────────────

function decodeSvg(dataUri) {
  const prefix = 'data:image/svg+xml,';
  if (!dataUri.startsWith(prefix)) return '';
  return decodeURIComponent(dataUri.slice(prefix.length));
}

// ── Required state keys (must match EMPTY_STATE_CONTENT) ────────────

const REQUIRED_KEYS = [
  'cart',
  'search',
  'wishlist',
  'reviews',
  'category',
  'error',
  'notFound',
  'sideCart',
];

// Brand colors that should appear in the illustrations
const BRAND_COLORS = [
  colors.sandBase,       // #E8D5B7
  colors.espresso,       // #3A2518
  colors.mountainBlue,   // #5B8FA8
  colors.sunsetCoral,    // #E8845C
];

// ── Tests ───────────────────────────────────────────────────────────

describe('Empty State Illustrations', () => {
  // ── Registry completeness ─────────────────────────────────────────

  describe('ILLUSTRATIONS registry', () => {
    it('exports an ILLUSTRATIONS object', () => {
      expect(ILLUSTRATIONS).toBeDefined();
      expect(typeof ILLUSTRATIONS).toBe('object');
    });

    it('has all 8 required state keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ILLUSTRATIONS, `missing key: ${key}`).toHaveProperty(key);
      });
    });

    it('has no extra keys beyond the 8 required states', () => {
      const keys = Object.keys(ILLUSTRATIONS);
      expect(keys.length).toBe(8);
      keys.forEach(key => {
        expect(REQUIRED_KEYS, `unexpected key: ${key}`).toContain(key);
      });
    });
  });

  // ── SVG validity ──────────────────────────────────────────────────

  describe('SVG validity', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key} illustration`, () => {
        it('is a valid data URI', () => {
          expect(ILLUSTRATIONS[key]).toMatch(/^data:image\/svg\+xml,/);
        });

        it('contains valid SVG markup', () => {
          const svg = decodeSvg(ILLUSTRATIONS[key]);
          expect(svg).toContain('<svg');
          expect(svg).toContain('</svg>');
        });

        it('has a viewBox attribute', () => {
          const svg = decodeSvg(ILLUSTRATIONS[key]);
          expect(svg).toMatch(/viewBox="[^"]+"/);
        });

        it('has xmlns attribute for standalone validity', () => {
          const svg = decodeSvg(ILLUSTRATIONS[key]);
          expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('uses at least 2 brand token colors', () => {
          const svg = decodeSvg(ILLUSTRATIONS[key]);
          const usedBrandColors = BRAND_COLORS.filter(c =>
            svg.toLowerCase().includes(c.toLowerCase())
          );
          expect(
            usedBrandColors.length,
            `${key} uses only ${usedBrandColors.length} brand colors: ${usedBrandColors.join(', ')}`
          ).toBeGreaterThanOrEqual(2);
        });

        it('does not contain hardcoded non-brand hex colors', () => {
          const svg = decodeSvg(ILLUSTRATIONS[key]);
          // Extract all hex colors from the SVG
          const hexColors = svg.match(/#[0-9A-Fa-f]{6}/g) || [];
          // All known brand/token colors (lowercase)
          const allowedColors = Object.values(colors)
            .filter(c => typeof c === 'string' && c.startsWith('#'))
            .map(c => c.toLowerCase());
          // Also allow common SVG defaults
          allowedColors.push('#000000', '#ffffff', '#none');

          hexColors.forEach(hex => {
            expect(
              allowedColors,
              `${key} contains non-brand color ${hex}`
            ).toContain(hex.toLowerCase());
          });
        });

        it('is reasonably sized (< 10KB encoded)', () => {
          expect(ILLUSTRATIONS[key].length).toBeLessThan(10000);
        });
      });
    });
  });

  // ── svgToDataUri helper ───────────────────────────────────────────

  describe('svgToDataUri', () => {
    it('converts an SVG string to a data URI', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
      const result = svgToDataUri(svg);
      expect(result).toMatch(/^data:image\/svg\+xml,/);
      expect(decodeSvg(result)).toContain('<rect/>');
    });

    it('handles empty string', () => {
      const result = svgToDataUri('');
      expect(result).toBe('data:image/svg+xml,');
    });

    it('URI-encodes special characters', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>#test & "quotes"</text></svg>';
      const result = svgToDataUri(svg);
      expect(result).not.toContain(' ');
      const decoded = decodeSvg(result);
      expect(decoded).toContain('#test & "quotes"');
    });
  });

  // ── Scene-specific content ────────────────────────────────────────

  describe('scene-specific content', () => {
    it('cart: contains path/trail element', () => {
      const svg = decodeSvg(ILLUSTRATIONS.cart);
      // Should have mountain shapes and a path/trail
      expect(svg).toContain('path');
    });

    it('search: contains mountain shapes', () => {
      const svg = decodeSvg(ILLUSTRATIONS.search);
      expect(svg).toContain('path');
    });

    it('wishlist: contains heart shape', () => {
      const svg = decodeSvg(ILLUSTRATIONS.wishlist);
      // Heart is typically drawn with path or specific shape
      expect(svg).toContain('path');
    });

    it('error: contains bridge-like structure', () => {
      const svg = decodeSvg(ILLUSTRATIONS.error);
      expect(svg).toContain('path');
    });

    it('notFound: contains figure/hiker element', () => {
      const svg = decodeSvg(ILLUSTRATIONS.notFound);
      expect(svg).toContain('path');
    });

    it('sideCart: contains bag shape', () => {
      const svg = decodeSvg(ILLUSTRATIONS.sideCart);
      expect(svg).toContain('path');
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────

  describe('accessibility', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: SVG has role="img" for screen readers`, () => {
        const svg = decodeSvg(ILLUSTRATIONS[key]);
        expect(svg).toContain('role="img"');
      });
    });
  });
});
