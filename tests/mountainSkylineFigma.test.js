/**
 * Tests for MountainSkylineFigma.js — Static SVG mountain skyline (Figma-first approach)
 *
 * hq-zvz2: POC — Figma Draw redesign replaces programmatic SVG generation.
 * The new module loads a pre-designed SVG asset instead of building SVG via JS template strings.
 *
 * Tests: SVG loading, brand token compliance, illustration quality,
 * $w injection, error handling, accessibility, no deprecated filters.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMountainSkylineSvg,
  initMountainSkylineFigma,
} from '../src/public/MountainSkylineFigma.js';
import { colors } from '../src/public/sharedTokens.js';

// ── Mock $w helper ──────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return { html: '', style: {}, show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()), collapse: vi.fn(), expand: vi.fn(), ...overrides };
}

function create$w(elements = {}) {
  const els = new Map();
  Object.entries(elements).forEach(([sel, el]) => els.set(sel, el));
  const $w = (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
  $w._els = els;
  return $w;
}

let $w;
beforeEach(() => { $w = create$w(); vi.clearAllMocks(); });

// ── getMountainSkylineSvg — SVG asset loading ───────────────────────

describe('getMountainSkylineSvg', () => {
  it('returns a valid SVG string', () => {
    const svg = getMountainSkylineSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes a viewBox for responsive scaling', () => {
    expect(getMountainSkylineSvg()).toMatch(/viewBox="[^"]+"/);
  });

  it('includes aria-hidden="true" for WCAG AA decorative element', () => {
    expect(getMountainSkylineSvg()).toContain('aria-hidden="true"');
  });

  it('includes role="presentation" for WCAG AA', () => {
    expect(getMountainSkylineSvg()).toContain('role="presentation"');
  });

  it('sets width to 100% for responsive container fill', () => {
    expect(getMountainSkylineSvg()).toContain('width="100%"');
  });

  it('accepts a custom height option', () => {
    expect(getMountainSkylineSvg({ height: 80 })).toContain('height="80"');
  });

  it('uses default height when not specified', () => {
    expect(getMountainSkylineSvg()).toContain('height="120"');
  });

  it('uses default height for invalid values', () => {
    expect(getMountainSkylineSvg({ height: -5 })).toContain('height="120"');
    expect(getMountainSkylineSvg({ height: 0 })).toContain('height="120"');
    expect(getMountainSkylineSvg({ height: 'abc' })).toContain('height="120"');
  });

  it('handles null/undefined options gracefully', () => {
    expect(() => getMountainSkylineSvg(null)).not.toThrow();
    expect(() => getMountainSkylineSvg(undefined)).not.toThrow();
  });
});

// ── NO deprecated filters ───────────────────────────────────────────

describe('getMountainSkylineSvg — no deprecated filters', () => {
  it('does NOT contain feTurbulence (deprecated per Figma-first directive)', () => {
    expect(getMountainSkylineSvg()).not.toContain('<feTurbulence');
  });

  it('does NOT contain feDisplacementMap (deprecated per Figma-first directive)', () => {
    expect(getMountainSkylineSvg()).not.toContain('<feDisplacementMap');
  });

  it('may contain feGaussianBlur for atmospheric haze (allowed)', () => {
    expect(getMountainSkylineSvg()).toContain('<feGaussianBlur');
  });
});

// ── illustration quality ────────────────────────────────────────────

describe('getMountainSkylineSvg — illustration quality', () => {
  it('has 5+ gradient stops for rich sky transitions', () => {
    const stops = (getMountainSkylineSvg().match(/<stop /g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(5);
  });

  it('contains 15+ SVG child elements for rich illustration', () => {
    const els = (getMountainSkylineSvg().match(/<(path|circle|ellipse|rect|line|g) /g) || []).length;
    expect(els).toBeGreaterThanOrEqual(15);
  });

  it('has 7 mountain ridgeline layers (path elements)', () => {
    const svg = getMountainSkylineSvg();
    const mountainPaths = (svg.match(/class="ridge-/g) || []).length;
    expect(mountainPaths).toBe(7);
  });

  it('includes bird elements', () => {
    expect(getMountainSkylineSvg()).toContain('birds');
  });

  it('includes pine tree elements', () => {
    expect(getMountainSkylineSvg()).toContain('pine-trees');
  });

  it('includes wildflower elements', () => {
    expect(getMountainSkylineSvg()).toContain('wildflowers');
  });

  it('uses organic bezier curves (C commands)', () => {
    expect(getMountainSkylineSvg()).toMatch(/C\s*[\d.-]/);
  });

  it('distant ridges have lower opacity than near ridges', () => {
    const svg = getMountainSkylineSvg();
    const distantMatch = svg.match(/ridge-1[^>]*opacity="([^"]+)"/);
    const frontMatch = svg.match(/ridge-7[^>]*opacity="([^"]+)"/);
    expect(distantMatch).toBeTruthy();
    expect(frontMatch).toBeTruthy();
    expect(parseFloat(distantMatch[1])).toBeLessThan(parseFloat(frontMatch[1]));
  });
});

// ── brand token compliance ──────────────────────────────────────────

describe('getMountainSkylineSvg — brand tokens', () => {
  it('uses mountainBlue for distant ridges', () => {
    expect(getMountainSkylineSvg()).toContain(colors.mountainBlue);
  });

  it('uses espresso for near ridges', () => {
    expect(getMountainSkylineSvg()).toContain(colors.espresso);
  });

  it('uses skyGradientTop in sky gradient', () => {
    expect(getMountainSkylineSvg()).toContain(colors.skyGradientTop);
  });

  it('uses sunsetCoral for wildflower accents', () => {
    expect(getMountainSkylineSvg()).toContain(colors.sunsetCoral);
  });

  it('contains zero hardcoded hex values outside brand palette', () => {
    const svg = getMountainSkylineSvg();
    const allHex = svg.match(/#[0-9a-fA-F]{6}/g) || [];
    const brandHex = new Set(Object.values(colors).filter(c => typeof c === 'string' && c.startsWith('#')).map(c => c.toUpperCase()));
    const nonBrand = allHex.filter(h => !brandHex.has(h.toUpperCase()));
    expect(nonBrand).toEqual([]);
  });
});

// ── initMountainSkylineFigma — Wix integration ─────────────────────

describe('initMountainSkylineFigma', () => {
  it('sets html property on the container element', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineFigma($w);
    expect(c.html).toContain('<svg');
  });

  it('uses default containerId #mountainSkyline', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineFigma($w);
    expect(c.html).toContain('<svg');
  });

  it('accepts a custom containerId', () => {
    const c = createMockElement(); $w = create$w({ '#heroSkyline': c });
    initMountainSkylineFigma($w, { containerId: '#heroSkyline' });
    expect(c.html).toContain('<svg');
  });

  it('passes height option through', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineFigma($w, { height: 80 });
    expect(c.html).toContain('height="80"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkylineFigma(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initMountainSkylineFigma(undefined)).not.toThrow();
  });

  it('does not throw when container element is missing', () => {
    expect(() => initMountainSkylineFigma(() => { throw new Error('x'); })).not.toThrow();
  });

  it('injected SVG has no deprecated filters', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineFigma($w);
    expect(c.html).not.toContain('<feTurbulence');
    expect(c.html).not.toContain('<feDisplacementMap');
  });
});
