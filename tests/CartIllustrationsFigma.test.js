/**
 * Tests for CartIllustrationsFigma.js — Figma-first static SVG cart illustrations
 *
 * cf-aij: Cart illustrations redesign (Figma-first pipeline)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCartSkylineSvg,
  getEmptyCartSvg,
  initCartSkyline,
  initEmptyCartIllustration,
} from '../src/public/CartIllustrationsFigma.js';
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
    const m = svg.match(re);
    if (m) count += m.length;
  }
  return count;
}

// Illustration SVGs intentionally retain the warm Blue Ridge Mountain palette
// even after the UI chrome shifted to blue/white branding (CF-1v76).
const WARM_ILLUSTRATION_PALETTE = new Set([
  '#3A2518', '#E8D5B7', '#E8845C', '#F2E8D5', '#F2A882',
  '#5C4033', '#D4BC96', '#FAF7F2', '#C9A0A0', '#C96B44',
]);

const TOKEN_HEXES = buildTokenHexAllowlist();
// Merge warm illustration colors into the allowlist
for (const hex of WARM_ILLUSTRATION_PALETTE) TOKEN_HEXES.add(hex.toUpperCase());

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
// ── Cart Skyline (1440x200, decorative header) ───────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('getCartSkylineSvg', () => {

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = getCartSkylineSvg();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has viewBox 0 0 1440 200', () => {
      expect(getCartSkylineSvg()).toContain('viewBox="0 0 1440 200"');
    });

    it('sets width to 100%', () => {
      expect(getCartSkylineSvg()).toContain('width="100%"');
    });

    it('sets preserveAspectRatio="none"', () => {
      expect(getCartSkylineSvg()).toContain('preserveAspectRatio="none"');
    });

    it('is aria-hidden (decorative)', () => {
      expect(getCartSkylineSvg()).toContain('aria-hidden="true"');
    });

    it('has role="presentation"', () => {
      expect(getCartSkylineSvg()).toContain('role="presentation"');
    });

    it('has xmlns attribute', () => {
      expect(getCartSkylineSvg()).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('respects custom height option', () => {
      expect(getCartSkylineSvg({ height: 150 })).toContain('height="150"');
    });

    it('uses default height of 120 when no option', () => {
      expect(getCartSkylineSvg()).toContain('height="120"');
    });

    it('ignores invalid height values', () => {
      expect(getCartSkylineSvg({ height: -1 })).toContain('height="120"');
      expect(getCartSkylineSvg({ height: 0 })).toContain('height="120"');
      expect(getCartSkylineSvg({ height: 'abc' })).toContain('height="120"');
    });
  });

  describe('quality bar', () => {
    it('uses organic bezier curves (C commands)', () => {
      expect(getCartSkylineSvg()).toMatch(/C\s*[\d.-]/);
    });

    it('contains 15+ SVG shape elements', () => {
      expect(countShapeElements(getCartSkylineSvg())).toBeGreaterThanOrEqual(15);
    });

    it('has 5+ gradient stops', () => {
      const stops = (getCartSkylineSvg().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(getCartSkylineSvg());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex: ${violations.join(', ')}`).toEqual([]);
    });

    it('includes bird detail elements', () => {
      expect(getCartSkylineSvg().toLowerCase()).toContain('bird');
    });

    it('includes pine tree detail elements', () => {
      const svg = getCartSkylineSvg().toLowerCase();
      expect(svg.includes('pine') || svg.includes('tree')).toBe(true);
    });

    it('includes wildflower elements', () => {
      const svg = getCartSkylineSvg().toLowerCase();
      expect(svg.includes('wildflower') || svg.includes('flora')).toBe(true);
    });
  });

  describe('ridgeline layers', () => {
    it('has 5+ ridgeline layers', () => {
      const matches = getCartSkylineSvg().match(/class="ridge-/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('has atmospheric depth — opacity ramp from distant to near', () => {
      const svg = getCartSkylineSvg();
      const opacities = [];
      const ridgeMatches = svg.matchAll(/class="ridge-(\d+)"[^>]*opacity="([^"]+)"/g);
      for (const m of ridgeMatches) {
        opacities.push({ layer: parseInt(m[1]), opacity: parseFloat(m[2]) });
      }
      opacities.sort((a, b) => a.layer - b.layer);
      expect(opacities.length).toBeGreaterThanOrEqual(5);
      // Later layers should generally have higher opacity
      expect(opacities[opacities.length - 1].opacity).toBeGreaterThan(opacities[0].opacity);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── Empty Cart Scene (280x200, meaningful illustration) ──────────────
// ══════════════════════════════════════════════════════════════════════

describe('getEmptyCartSvg', () => {

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = getEmptyCartSvg();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has viewBox 0 0 280 200', () => {
      expect(getEmptyCartSvg()).toContain('viewBox="0 0 280 200"');
    });

    it('has role="img" (meaningful)', () => {
      expect(getEmptyCartSvg()).toContain('role="img"');
    });

    it('has aria-labelledby referencing title', () => {
      expect(getEmptyCartSvg()).toMatch(/aria-labelledby="[^"]+"/);
    });

    it('contains a <title> element', () => {
      expect(getEmptyCartSvg()).toMatch(/<title[^>]*>[^<]+<\/title>/);
    });

    it('sets preserveAspectRatio="xMidYMid meet"', () => {
      expect(getEmptyCartSvg()).toContain('preserveAspectRatio="xMidYMid meet"');
    });
  });

  describe('quality bar', () => {
    it('contains 15+ SVG shape elements', () => {
      expect(countShapeElements(getEmptyCartSvg())).toBeGreaterThanOrEqual(15);
    });

    it('has 5+ gradient stops', () => {
      const stops = (getEmptyCartSvg().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(getEmptyCartSvg());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex: ${violations.join(', ')}`).toEqual([]);
    });

    it('has ridgeline layers for mountain backdrop', () => {
      const matches = getEmptyCartSvg().match(/class="ridge-/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── $w init wrappers ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('initCartSkyline', () => {
  it('injects SVG into #cartHeroSkyline', () => {
    const el = createMockElement();
    const $w = create$w({ '#cartHeroSkyline': el });
    initCartSkyline($w);
    expect(el.html).toContain('<svg');
    expect(el.html).toContain('viewBox="0 0 1440 200"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initCartSkyline(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initCartSkyline(undefined)).not.toThrow();
  });

  it('handles missing container gracefully', () => {
    const $w = (sel) => { if (sel === '#nonexistent') return null; return createMockElement(); };
    expect(() => initCartSkyline($w)).not.toThrow();
  });

  it('passes custom height to SVG', () => {
    const el = createMockElement();
    const $w = create$w({ '#cartHeroSkyline': el });
    initCartSkyline($w, { height: 150 });
    expect(el.html).toContain('height="150"');
  });
});

describe('initEmptyCartIllustration', () => {
  it('injects SVG into #emptyCartIllustration', () => {
    const el = createMockElement();
    const $w = create$w({ '#emptyCartIllustration': el });
    initEmptyCartIllustration($w);
    expect(el.html).toContain('<svg');
    expect(el.html).toContain('viewBox="0 0 280 200"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initEmptyCartIllustration(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initEmptyCartIllustration(undefined)).not.toThrow();
  });
});

// ── Security ─────────────────────────────────────────────────────────

describe('security', () => {
  it('cart skyline has no script tags', () => {
    expect(getCartSkylineSvg()).not.toMatch(/<script/i);
  });

  it('empty cart has no script tags', () => {
    expect(getEmptyCartSvg()).not.toMatch(/<script/i);
  });

  it('no event handler attributes in cart skyline', () => {
    expect(getCartSkylineSvg()).not.toMatch(/on(click|load|error|mouseover)=/i);
  });

  it('no event handler attributes in empty cart', () => {
    expect(getEmptyCartSvg()).not.toMatch(/on(click|load|error|mouseover)=/i);
  });
});
