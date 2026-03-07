import { describe, it, expect } from 'vitest';

import {
  ONBOARDING_SVGS,
  svgToDataUri,
} from '../src/public/onboardingIllustrations.js';

import { colors } from '../src/public/sharedTokens.js';

// 4 required onboarding scene keys (added firstVisitBanner)
const REQUIRED_KEYS = ['welcome', 'arPreview', 'shopWithConfidence', 'firstVisitBanner'];

// Brand colors allowed for dark bg scenes (light/bright accents)
const DARK_BG_SAFE_COLORS = [
  colors.offWhite, colors.sandBase, colors.sandLight,
  colors.sunsetCoral, colors.sunsetCoralLight,
  colors.mountainBlue, colors.mountainBlueLight,
  colors.skyGradientTop, colors.skyGradientBottom,
];

// All brand hex values (for hardcoded-color detection)
const ALL_BRAND_HEX = Object.values(colors).filter(v => typeof v === 'string' && v.startsWith('#'));

describe('Onboarding Illustrations', () => {

  // ── Registry completeness ──────────────────────────────────────────

  describe('ONBOARDING_SVGS registry', () => {
    it('exports all 3 required scene keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ONBOARDING_SVGS[key], `missing key: ${key}`).toBeDefined();
      });
    });

    it('contains no extra keys beyond the required 4', () => {
      expect(Object.keys(ONBOARDING_SVGS).sort()).toEqual([...REQUIRED_KEYS].sort());
    });
  });

  // ── SVG validity ───────────────────────────────────────────────────

  describe('SVG structure', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key} scene`, () => {
        it('is a non-empty string', () => {
          expect(typeof ONBOARDING_SVGS[key]).toBe('string');
          expect(ONBOARDING_SVGS[key].length).toBeGreaterThan(200);
        });

        it('is a valid SVG element', () => {
          const svg = ONBOARDING_SVGS[key];
          expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
          expect(svg.trimEnd()).toMatch(/<\/svg>$/);
        });

        it('has a viewBox for responsive sizing', () => {
          expect(ONBOARDING_SVGS[key]).toMatch(/viewBox="[^"]+"/);
        });

        it('has xmlns attribute', () => {
          expect(ONBOARDING_SVGS[key]).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('uses percentage or no fixed pixel dimensions on root', () => {
          const rootTag = ONBOARDING_SVGS[key].match(/<svg[^>]+>/)[0];
          expect(rootTag).not.toMatch(/width="\d+px"/);
          expect(rootTag).not.toMatch(/height="\d+px"/);
        });
      });
    });
  });

  // ── Quality bar: SVG filter effects ────────────────────────────────

  describe('SVG filter effects (watercolor texture)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has feTurbulence filter for watercolor texture`, () => {
        expect(ONBOARDING_SVGS[key]).toMatch(/feTurbulence/);
      });

      it(`${key} has feDisplacementMap for organic distortion`, () => {
        expect(ONBOARDING_SVGS[key]).toMatch(/feDisplacementMap/);
      });
    });
  });

  // ── Quality bar: element count (15+ per scene) ─────────────────────

  describe('element richness (minimum 15 elements per scene)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 15 SVG shape/path elements`, () => {
        const svg = ONBOARDING_SVGS[key];
        // Count visible elements: path, rect, circle, ellipse, polygon, polyline, line
        const shapeMatches = svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)[\s/]/g);
        const count = shapeMatches ? shapeMatches.length : 0;
        expect(count, `${key} has only ${count} elements, need 15+`).toBeGreaterThanOrEqual(15);
      });
    });
  });

  // ── Quality bar: rich gradients (5+ stops) ─────────────────────────

  describe('rich gradients (5+ stops across all gradients)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 5 gradient stops total`, () => {
        const svg = ONBOARDING_SVGS[key];
        const stopMatches = svg.match(/<stop\s/g);
        const count = stopMatches ? stopMatches.length : 0;
        expect(count, `${key} has only ${count} gradient stops, need 5+`).toBeGreaterThanOrEqual(5);
      });
    });
  });

  // ── Quality bar: paper grain overlay ───────────────────────────────

  describe('paper grain / texture overlay', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has noise or turbulence filter for paper grain`, () => {
        const svg = ONBOARDING_SVGS[key];
        const hasTexture = svg.includes('feTurbulence') || svg.includes('feNoise');
        expect(hasTexture, `${key} missing paper grain texture`).toBe(true);
      });
    });
  });

  // ── Brand token colors ─────────────────────────────────────────────

  describe('brand token colors', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses at least 3 brand colors`, () => {
        const svg = ONBOARDING_SVGS[key];
        const usedColors = ALL_BRAND_HEX.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedColors.length, `${key} only uses ${usedColors.length} brand colors`)
          .toBeGreaterThanOrEqual(3);
      });

      it(`${key} has no hardcoded hex outside brand tokens`, () => {
        const svg = ONBOARDING_SVGS[key];
        // Find all hex color references
        const hexMatches = svg.match(/#[0-9A-Fa-f]{6}\b/g) || [];
        const unknownHex = hexMatches.filter(hex =>
          !ALL_BRAND_HEX.some(brand => brand.toLowerCase() === hex.toLowerCase())
        );
        expect(unknownHex, `${key} has non-token hex: ${unknownHex.join(', ')}`).toEqual([]);
      });
    });
  });

  // ── Dark background contrast ───────────────────────────────────────

  describe('dark background (#1C1410) contrast', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses light-on-dark colors visible on espresso bg`, () => {
        const svg = ONBOARDING_SVGS[key];
        const usedLightColors = DARK_BG_SAFE_COLORS.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedLightColors.length, `${key} needs light colors for dark bg`)
          .toBeGreaterThanOrEqual(2);
      });

      it(`${key} does NOT use espresso as primary fill (invisible on dark bg)`, () => {
        const svg = ONBOARDING_SVGS[key];
        // Espresso fills should be minimal or absent — they'd vanish on #1C1410
        const espressoFills = svg.match(new RegExp(`fill="${colors.espresso}"`, 'gi')) || [];
        expect(espressoFills.length, `${key} has ${espressoFills.length} espresso fills — invisible on dark`)
          .toBeLessThanOrEqual(1);
      });
    });
  });

  // ── Transparent background ─────────────────────────────────────────

  describe('transparent background (for dark container)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} does not fill root rect with opaque light color`, () => {
        const svg = ONBOARDING_SVGS[key];
        // Should NOT have a full-bleed opaque background rect
        expect(svg).not.toMatch(/fill="${colors.offWhite}"\s*\/>\s*$/m);
        expect(svg).not.toMatch(/fill="${colors.sandLight}"\s*\/>\s*$/m);
      });
    });
  });

  // ── Thematic content ───────────────────────────────────────────────

  describe('thematic content per scene', () => {
    it('welcome scene has mountain/landscape elements', () => {
      const svg = ONBOARDING_SVGS.welcome;
      // Should contain paths (mountains, window, room)
      expect(svg).toMatch(/<path[\s>]/);
      expect(svg).toMatch(/<(rect|polygon)[\s>]/);
    });

    it('arPreview scene has geometric shapes (phone/furniture outline)', () => {
      const svg = ONBOARDING_SVGS.arPreview;
      expect(svg).toMatch(/<rect[\s>]/);
      expect(svg).toMatch(/<path[\s>]/);
    });

    it('shopWithConfidence scene has delivery/home elements', () => {
      const svg = ONBOARDING_SVGS.shopWithConfidence;
      expect(svg).toMatch(/<(path|rect|polygon)[\s>]/);
    });

    it('firstVisitBanner scene has mountain landscape elements', () => {
      const svg = ONBOARDING_SVGS.firstVisitBanner;
      expect(svg).toMatch(/<path[\s>]/);
    });

    it('firstVisitBanner is wider banner format (viewBox width > height)', () => {
      const svg = ONBOARDING_SVGS.firstVisitBanner;
      const vbMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      expect(vbMatch).toBeTruthy();
      expect(parseInt(vbMatch[1])).toBeGreaterThan(parseInt(vbMatch[2]));
    });

    it('all scenes contain at least one gradient', () => {
      REQUIRED_KEYS.forEach(key => {
        const svg = ONBOARDING_SVGS[key];
        const hasGradient = svg.includes('<linearGradient') || svg.includes('<radialGradient');
        expect(hasGradient, `${key} missing gradient`).toBe(true);
      });
    });
  });

  // ── Data URI conversion ────────────────────────────────────────────

  describe('svgToDataUri', () => {
    it('converts SVG string to data URI', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>';
      const uri = svgToDataUri(svg);
      expect(uri).toMatch(/^data:image\/svg\+xml[,;]/);
    });

    it('returns empty string for falsy input', () => {
      expect(svgToDataUri('')).toBe('');
      expect(svgToDataUri(null)).toBe('');
      expect(svgToDataUri(undefined)).toBe('');
    });

    it('produces valid data URIs for all 3 onboarding scenes', () => {
      REQUIRED_KEYS.forEach(key => {
        const uri = svgToDataUri(ONBOARDING_SVGS[key]);
        expect(uri, `${key} data URI`).toMatch(/^data:image\/svg\+xml/);
        expect(uri.length, `${key} data URI too short`).toBeGreaterThan(100);
      });
    });
  });

  // ── Security ───────────────────────────────────────────────────────

  describe('security', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has no script tags`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/<script/i);
      });

      it(`${key} has no event handler attributes`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/on(click|load|error|mouseover)=/i);
      });

      it(`${key} has no external references`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/xlink:href="http/i);
        expect(ONBOARDING_SVGS[key]).not.toMatch(/href="http/i);
      });
    });
  });
});
