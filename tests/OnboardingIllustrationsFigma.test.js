/**
 * Tests for OnboardingIllustrationsFigma.js — Figma-first static SVG onboarding illustrations
 *
 * cf-aij: Onboarding illustrations redesign (Figma-first pipeline)
 */
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_SVGS,
  svgToDataUri,
} from '../src/public/OnboardingIllustrationsFigma.js';
import { colors } from '../src/public/sharedTokens.js';

const REQUIRED_KEYS = ['welcome', 'arPreview', 'shopWithConfidence'];

const DARK_BG_SAFE_COLORS = [
  colors.offWhite, colors.sandBase, colors.sandLight,
  colors.sunsetCoral, colors.sunsetCoralLight,
  colors.mountainBlue, colors.mountainBlueLight,
  colors.skyGradientTop, colors.skyGradientBottom,
];

const ALL_BRAND_HEX = Object.values(colors).filter(v => typeof v === 'string' && v.startsWith('#'));

describe('Onboarding Illustrations (Figma-first)', () => {

  describe('ONBOARDING_SVGS registry', () => {
    it('exports all 3 required scene keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ONBOARDING_SVGS[key], `missing key: ${key}`).toBeDefined();
      });
    });

    it('contains no extra keys beyond the required 3', () => {
      expect(Object.keys(ONBOARDING_SVGS).sort()).toEqual([...REQUIRED_KEYS].sort());
    });
  });

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

        it('has viewBox 0 0 800 500', () => {
          expect(ONBOARDING_SVGS[key]).toContain('viewBox="0 0 800 500"');
        });

        it('has xmlns attribute', () => {
          expect(ONBOARDING_SVGS[key]).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('has role="img"', () => {
          expect(ONBOARDING_SVGS[key]).toContain('role="img"');
        });

        it('has aria-labelledby', () => {
          expect(ONBOARDING_SVGS[key]).toMatch(/aria-labelledby="[^"]+"/);
        });

        it('contains a <title> element', () => {
          expect(ONBOARDING_SVGS[key]).toMatch(/<title[^>]*>[^<]+<\/title>/);
        });
      });
    });
  });

  describe('element richness (minimum 15 elements per scene)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 15 SVG shape/path elements`, () => {
        const svg = ONBOARDING_SVGS[key];
        const shapeMatches = svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)[\s/]/g);
        const count = shapeMatches ? shapeMatches.length : 0;
        expect(count, `${key} has only ${count} elements, need 15+`).toBeGreaterThanOrEqual(15);
      });
    });
  });

  describe('rich gradients (5+ stops)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 5 gradient stops total`, () => {
        const svg = ONBOARDING_SVGS[key];
        const stopMatches = svg.match(/<stop\s/g);
        const count = stopMatches ? stopMatches.length : 0;
        expect(count, `${key} has only ${count} gradient stops, need 5+`).toBeGreaterThanOrEqual(5);
      });
    });
  });

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
        const hexMatches = svg.match(/#[0-9A-Fa-f]{6}\b/g) || [];
        const unknownHex = hexMatches.filter(hex =>
          !ALL_BRAND_HEX.some(brand => brand.toLowerCase() === hex.toLowerCase())
        );
        expect(unknownHex, `${key} has non-token hex: ${unknownHex.join(', ')}`).toEqual([]);
      });
    });
  });

  describe('dark background contrast', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses light colors visible on dark bg`, () => {
        const svg = ONBOARDING_SVGS[key];
        const usedLightColors = DARK_BG_SAFE_COLORS.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedLightColors.length, `${key} needs light colors for dark bg`)
          .toBeGreaterThanOrEqual(2);
      });

      it(`${key} does NOT use espresso as primary fill`, () => {
        const svg = ONBOARDING_SVGS[key];
        const espressoFills = svg.match(new RegExp(`fill="${colors.espresso}"`, 'gi')) || [];
        expect(espressoFills.length).toBeLessThanOrEqual(1);
      });
    });
  });

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

    it('produces valid data URIs for all 3 scenes', () => {
      REQUIRED_KEYS.forEach(key => {
        const uri = svgToDataUri(ONBOARDING_SVGS[key]);
        expect(uri, `${key} data URI`).toMatch(/^data:image\/svg\+xml/);
        expect(uri.length, `${key} data URI too short`).toBeGreaterThan(100);
      });
    });

    it('properly encodes hash characters', () => {
      const svg = '<svg><rect fill="#E8D5B7"/></svg>';
      const uri = svgToDataUri(svg);
      expect(uri).not.toContain('#E8D5B7');
      expect(uri).toContain('%23E8D5B7');
    });
  });

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
