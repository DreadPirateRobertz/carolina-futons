/**
 * Tests for CartIllustrations.js — Cart Page SVG illustrations
 *
 * cf-6a6d: Mountain skyline hero + empty cart scene
 *
 * Tests: SVG generation, 8/8 quality bar (feTurbulence, feDisplacementMap,
 * organic paths, 15+ elements, 5+ gradient stops, paper grain, atmospheric
 * depth, sharedTokens colors), accessibility, $w injection, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCartSkylineSVG,
  generateEmptyCartSVG,
  initCartSkyline,
  initEmptyCartIllustration,
} from '../src/public/CartIllustrations.js';
import { colors } from '../src/public/sharedTokens.js';

// ── Helpers ──────────────────────────────────────────────────────────

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

function extractHexColors(str) {
  const matches = str.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  return matches.map((h) => h.toUpperCase());
}

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

// ── Mock $w ──────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    html: '', style: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    ...overrides,
  };
}

function create$w(elements = {}) {
  const els = new Map();
  Object.entries(elements).forEach(([sel, el]) => els.set(sel, el));
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

let $w;
beforeEach(() => { $w = create$w(); vi.clearAllMocks(); });

// ══════════════════════════════════════════════════════════════════════
// ── Cart Skyline Hero ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('generateCartSkylineSVG', () => {

  // ── SVG structure ──────────────────────────────────────────────────

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = generateCartSkylineSVG();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has a viewBox for responsive scaling', () => {
      expect(generateCartSkylineSVG()).toMatch(/viewBox="[^"]+"/);
    });

    it('sets width to 100% for full-width fill', () => {
      expect(generateCartSkylineSVG()).toContain('width="100%"');
    });

    it('sets preserveAspectRatio="none" for edge-to-edge', () => {
      expect(generateCartSkylineSVG()).toContain('preserveAspectRatio="none"');
    });

    it('is aria-hidden (decorative)', () => {
      expect(generateCartSkylineSVG()).toContain('aria-hidden="true"');
    });

    it('has role="presentation"', () => {
      expect(generateCartSkylineSVG()).toContain('role="presentation"');
    });
  });

  // ── 8/8 Quality bar ───────────────────────────────────────────────

  describe('quality bar', () => {
    it('1. includes feTurbulence for watercolor texture', () => {
      expect(generateCartSkylineSVG()).toContain('<feTurbulence');
    });

    it('1. includes feDisplacementMap for organic distortion', () => {
      expect(generateCartSkylineSVG()).toContain('<feDisplacementMap');
    });

    it('2. uses organic bezier curves (C commands)', () => {
      expect(generateCartSkylineSVG()).toMatch(/C\s*[\d.-]/);
    });

    it('3. contains 15+ SVG shape elements', () => {
      expect(countShapeElements(generateCartSkylineSVG())).toBeGreaterThanOrEqual(15);
    });

    it('4. has 5+ gradient stops for rich sky transitions', () => {
      const stops = (generateCartSkylineSVG().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('5. includes paper grain overlay (2+ feTurbulence filters)', () => {
      const count = (generateCartSkylineSVG().match(/<feTurbulence/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('6. has atmospheric depth — distant layers lower opacity than near', () => {
      const svg = generateCartSkylineSVG();
      const distantMatch = svg.match(/ridge-distant[^>]*opacity="([^"]+)"/);
      const frontMatch = svg.match(/ridge-front[^>]*opacity="([^"]+)"/);
      expect(distantMatch).toBeTruthy();
      expect(frontMatch).toBeTruthy();
      expect(parseFloat(distantMatch[1])).toBeLessThan(parseFloat(frontMatch[1]));
    });

    it('6. includes feGaussianBlur for haze effect', () => {
      expect(generateCartSkylineSVG()).toContain('<feGaussianBlur');
    });

    it('7. uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(generateCartSkylineSVG());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex colors: ${violations.join(', ')}`).toEqual([]);
    });

    it('8. includes bird detail elements', () => {
      expect(generateCartSkylineSVG()).toContain('bird');
    });

    it('8. includes pine tree detail elements', () => {
      expect(generateCartSkylineSVG()).toContain('pine');
    });
  });

  // ── Ridgeline layers ──────────────────────────────────────────────

  describe('ridgeline layers', () => {
    it('has 5+ ridgeline layers for Blue Ridge depth', () => {
      const matches = generateCartSkylineSVG().match(/class="ridge-/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('uses mountainBlue for distant layers', () => {
      const svg = generateCartSkylineSVG();
      const distantMatch = svg.match(/ridge-distant[^>]*fill="([^"]+)"/);
      expect(distantMatch).toBeTruthy();
      expect(distantMatch[1]).toBe(colors.mountainBlue);
    });

    it('uses espresso for foreground layers', () => {
      expect(generateCartSkylineSVG()).toContain(colors.espresso);
    });

    it('applies watercolor filter to ridgeline shapes', () => {
      expect(generateCartSkylineSVG()).toMatch(/filter="url\(#[^"]*watercolor[^"]*\)"/);
    });
  });

  // ── Brand tokens ──────────────────────────────────────────────────

  describe('brand tokens', () => {
    it('uses skyGradientTop in gradient', () => {
      expect(generateCartSkylineSVG()).toContain(colors.skyGradientTop);
    });

    it('uses skyGradientBottom in gradient', () => {
      expect(generateCartSkylineSVG()).toContain(colors.skyGradientBottom);
    });

    it('uses sunsetCoral for warm accent', () => {
      expect(generateCartSkylineSVG()).toContain(colors.sunsetCoral);
    });

    it('contains a linearGradient definition', () => {
      const svg = generateCartSkylineSVG();
      expect(svg).toContain('<linearGradient');
      expect(svg).toContain('</linearGradient>');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── Empty Cart Scene ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('generateEmptyCartSVG', () => {

  // ── SVG structure ──────────────────────────────────────────────────

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = generateEmptyCartSVG();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has a viewBox for responsive sizing', () => {
      expect(generateEmptyCartSVG()).toMatch(/viewBox="[^"]+"/);
    });

    it('has xmlns attribute', () => {
      expect(generateEmptyCartSVG()).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('does not use hardcoded pixel dimensions on root', () => {
      const rootTag = generateEmptyCartSVG().match(/<svg[^>]+>/)[0];
      expect(rootTag).not.toMatch(/width="\d+px"/);
      expect(rootTag).not.toMatch(/height="\d+px"/);
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────

  describe('accessibility', () => {
    it('has role="img"', () => {
      expect(generateEmptyCartSVG()).toContain('role="img"');
    });

    it('has a <title> element', () => {
      expect(generateEmptyCartSVG()).toMatch(/<title[^>]*>[^<]+<\/title>/);
    });

    it('has aria-labelledby pointing to title', () => {
      expect(generateEmptyCartSVG()).toMatch(/aria-labelledby="[^"]+"/);
    });
  });

  // ── 8/8 Quality bar ───────────────────────────────────────────────

  describe('quality bar', () => {
    it('1. includes feTurbulence for watercolor texture', () => {
      expect(generateEmptyCartSVG()).toContain('<feTurbulence');
    });

    it('1. includes feDisplacementMap for organic distortion', () => {
      expect(generateEmptyCartSVG()).toContain('<feDisplacementMap');
    });

    it('2. uses organic bezier curves (C commands)', () => {
      expect(generateEmptyCartSVG()).toMatch(/C\s*[\d.-]/);
    });

    it('3. contains 15+ SVG shape elements', () => {
      expect(countShapeElements(generateEmptyCartSVG())).toBeGreaterThanOrEqual(15);
    });

    it('4. has 5+ gradient stops', () => {
      const stops = (generateEmptyCartSVG().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('5. includes paper grain overlay (2+ feTurbulence filters)', () => {
      const count = (generateEmptyCartSVG().match(/<feTurbulence/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('6. has atmospheric depth layers (background/midground/foreground)', () => {
      const svg = generateEmptyCartSVG();
      expect(svg).toContain('id="background"');
      expect(svg).toContain('id="midground"');
      expect(svg).toContain('id="foreground"');
    });

    it('7. uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(generateEmptyCartSVG());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex colors: ${violations.join(', ')}`).toEqual([]);
    });

    it('8. includes bird detail elements', () => {
      expect(generateEmptyCartSVG()).toContain('bird');
    });

    it('8. includes flora/wildflower details', () => {
      expect(generateEmptyCartSVG()).toContain('flora');
    });
  });

  // ── Thematic content ──────────────────────────────────────────────

  describe('thematic content', () => {
    it('includes trail/path element (journey metaphor)', () => {
      expect(generateEmptyCartSVG()).toContain('trail');
    });

    it('includes mountain ridgeline layers', () => {
      const svg = generateEmptyCartSVG();
      expect(svg).toMatch(/ridge|mountain/);
    });

    it('uses sunsetCoral for warm accent', () => {
      expect(generateEmptyCartSVG()).toContain(colors.sunsetCoral);
    });

    it('uses mountainBlue for sky/distance', () => {
      expect(generateEmptyCartSVG()).toContain(colors.mountainBlue);
    });

    it('uses espresso for foreground details', () => {
      expect(generateEmptyCartSVG()).toContain(colors.espresso);
    });
  });

  // ── Brand tokens ──────────────────────────────────────────────────

  describe('brand tokens', () => {
    it('uses sandBase or sandLight for ground', () => {
      const svg = generateEmptyCartSVG();
      const hasSand = svg.includes(colors.sandBase) || svg.includes(colors.sandLight);
      expect(hasSand).toBe(true);
    });

    it('uses skyGradientTop for sky', () => {
      expect(generateEmptyCartSVG()).toContain(colors.skyGradientTop);
    });

    it('uses success green for flora', () => {
      expect(generateEmptyCartSVG()).toContain(colors.success);
    });
  });

  // ── Security ──────────────────────────────────────────────────────

  describe('security', () => {
    it('contains no script tags', () => {
      expect(generateEmptyCartSVG()).not.toMatch(/<script/i);
    });

    it('contains no event handler attributes', () => {
      expect(generateEmptyCartSVG()).not.toMatch(/\son\w+=/i);
    });

    it('contains no external references', () => {
      expect(generateEmptyCartSVG()).not.toMatch(/xlink:href="http/);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── Init Wrappers ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('initCartSkyline', () => {
  it('injects SVG into #cartHeroSkyline element', () => {
    const el = createMockElement();
    const $w = create$w({ '#cartHeroSkyline': el });
    initCartSkyline($w);
    expect(el.html).toContain('<svg');
  });

  it('does not throw when $w is null', () => {
    expect(() => initCartSkyline(null)).not.toThrow();
  });

  it('does not throw when element is missing', () => {
    const $w = () => null;
    expect(() => initCartSkyline($w)).not.toThrow();
  });
});

describe('initEmptyCartIllustration', () => {
  it('injects SVG into #emptyCartIllustration element', () => {
    const el = createMockElement();
    const $w = create$w({ '#emptyCartIllustration': el });
    initEmptyCartIllustration($w);
    expect(el.html).toContain('<svg');
  });

  it('does not throw when $w is null', () => {
    expect(() => initEmptyCartIllustration(null)).not.toThrow();
  });

  it('does not throw when element is missing', () => {
    const $w = () => null;
    expect(() => initEmptyCartIllustration($w)).not.toThrow();
  });

  it('SVG has role="img" (not decorative — has meaning for empty state)', () => {
    const el = createMockElement();
    const $w = create$w({ '#emptyCartIllustration': el });
    initEmptyCartIllustration($w);
    expect(el.html).toContain('role="img"');
  });
});
