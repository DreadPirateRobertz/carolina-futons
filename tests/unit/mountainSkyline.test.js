/**
 * Tests for MountainSkyline.js — Programmatic SVG mountain skyline border
 *
 * cf-989f: Mountain skyline SVG border — signature brand element for all page headers
 *
 * Tests: SVG generation, brand token usage, gradient variants (5+ stops), responsive scaling,
 * WCAG AA (aria-hidden, decorative role), $w injection, error handling,
 * illustration quality (filters, organic paths, 7 ridgeline layers, detail elements,
 * atmospheric haze, paper grain).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMountainSVG,
  initMountainSkyline,
  initMountainSkylineTransparent,
} from '../../src/public/MountainSkyline.js';
import { colors } from '../../src/public/sharedTokens.js';

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

// ── generateMountainSVG — SVG structure ─────────────────────────────

describe('generateMountainSVG', () => {
  it('returns a valid SVG string', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes a viewBox for responsive scaling', () => {
    expect(generateMountainSVG()).toMatch(/viewBox="[^"]+"/);
  });

  it('sets width to 100% for responsive fill', () => {
    expect(generateMountainSVG()).toContain('width="100%"');
  });

  it('sets preserveAspectRatio for edge-to-edge scaling', () => {
    expect(generateMountainSVG()).toMatch(/preserveAspectRatio="none"/);
  });

  it('includes aria-hidden="true" for WCAG AA decorative element', () => {
    expect(generateMountainSVG()).toContain('aria-hidden="true"');
  });

  it('includes role="presentation" for WCAG AA', () => {
    expect(generateMountainSVG()).toContain('role="presentation"');
  });

  it('contains mountain path elements', () => {
    expect(generateMountainSVG()).toContain('<path');
  });

  it('contains a linearGradient definition for sky', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('</linearGradient>');
  });
});

// ── illustration quality ────────────────────────────────────────────

describe('generateMountainSVG — illustration quality', () => {
  it('has 5+ gradient stops for rich sky transitions', () => {
    const stops = (generateMountainSVG().match(/<stop /g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(5);
  });

  it('includes feTurbulence filter for watercolor texture', () => {
    expect(generateMountainSVG()).toContain('<feTurbulence');
  });

  it('includes feDisplacementMap for organic distortion', () => {
    expect(generateMountainSVG()).toContain('<feDisplacementMap');
  });

  it('includes paper grain noise overlay (2+ feTurbulence filters)', () => {
    const count = (generateMountainSVG().match(/<feTurbulence/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('contains 15+ SVG child elements for rich illustration', () => {
    const els = (generateMountainSVG().match(/<(path|circle|ellipse|rect|line|g) /g) || []).length;
    expect(els).toBeGreaterThanOrEqual(15);
  });

  it('includes bird elements (V shapes in sky)', () => {
    expect(generateMountainSVG()).toContain('bird');
  });

  it('includes pine tree elements with multiple tiers', () => {
    expect(generateMountainSVG()).toContain('pine');
  });

  it('includes wildflower/flora detail at base', () => {
    expect(generateMountainSVG()).toContain('flora');
  });

  it('uses organic bezier curves (C commands) not just straight lines', () => {
    expect(generateMountainSVG()).toMatch(/C\s*[\d.-]/);
  });

  it('has 7 mountain ridgeline layers for Blue Ridge depth', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('mountain-distant');
    expect(svg).toContain('mountain-far');
    expect(svg).toContain('mountain-back');
    expect(svg).toContain('mountain-mid-far');
    expect(svg).toContain('mountain-mid');
    expect(svg).toContain('mountain-mid-near');
    expect(svg).toContain('mountain-front');
  });

  it('has exactly 7 mountain path elements', () => {
    const matches = generateMountainSVG().match(/class="mountain-/g) || [];
    expect(matches.length).toBe(7);
  });

  it('applies watercolor filter to mountain shapes', () => {
    expect(generateMountainSVG()).toContain('filter="url(#cf-watercolor)"');
  });

  it('includes atmospheric haze for depth between layers', () => {
    expect(generateMountainSVG()).toContain('atmospheric-haze');
  });

  it('includes feGaussianBlur for atmospheric haze effect', () => {
    expect(generateMountainSVG()).toContain('<feGaussianBlur');
  });

  it('distant layers have lower opacity than near layers', () => {
    const svg = generateMountainSVG();
    const distantMatch = svg.match(/mountain-distant[^>]*opacity="([^"]+)"/);
    const frontMatch = svg.match(/mountain-front[^>]*opacity="([^"]+)"/);
    expect(distantMatch).toBeTruthy();
    expect(frontMatch).toBeTruthy();
    expect(parseFloat(distantMatch[1])).toBeLessThan(parseFloat(frontMatch[1]));
  });

  it('distant layers use blue haze color (mountainBlue) in standard mode', () => {
    const svg = generateMountainSVG();
    const distantMatch = svg.match(/mountain-distant[^>]*fill="([^"]+)"/);
    expect(distantMatch).toBeTruthy();
    expect(distantMatch[1]).toBe(colors.mountainBlue);
  });
});

// ── brand tokens ────────────────────────────────────────────────────

describe('generateMountainSVG — brand tokens', () => {
  it('uses skyGradientTop token in sunrise variant', () => {
    expect(generateMountainSVG({ variant: 'sunrise' })).toContain(colors.skyGradientTop);
  });

  it('uses skyGradientBottom token in sunrise variant', () => {
    expect(generateMountainSVG({ variant: 'sunrise' })).toContain(colors.skyGradientBottom);
  });

  it('uses espresso token for mountain silhouette fill', () => {
    expect(generateMountainSVG()).toContain(colors.espresso);
  });

  it('uses mountainBlue token for distant layers', () => {
    expect(generateMountainSVG()).toContain(colors.mountainBlue);
  });

  it('defaults to sunrise variant when no variant specified', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain(colors.skyGradientTop);
    expect(svg).toContain(colors.skyGradientBottom);
  });
});

// ── sunset variant ──────────────────────────────────────────────────

describe('generateMountainSVG — sunset variant', () => {
  it('uses sunset coral-based gradient', () => {
    expect(generateMountainSVG({ variant: 'sunset' })).toContain(colors.sunsetCoral);
  });

  it('uses skyGradientBottom (golden) in sunset', () => {
    expect(generateMountainSVG({ variant: 'sunset' })).toContain(colors.skyGradientBottom);
  });

  it('still uses espresso for mountain silhouette', () => {
    expect(generateMountainSVG({ variant: 'sunset' })).toContain(colors.espresso);
  });

  it('produces different gradients for sunrise vs sunset', () => {
    expect(generateMountainSVG({ variant: 'sunrise' })).not.toBe(generateMountainSVG({ variant: 'sunset' }));
  });

  it('sunset variant also has 5+ gradient stops', () => {
    const stops = (generateMountainSVG({ variant: 'sunset' }).match(/<stop /g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(5);
  });

  it('sunset variant also has 7 ridgeline layers', () => {
    const matches = generateMountainSVG({ variant: 'sunset' }).match(/class="mountain-/g) || [];
    expect(matches.length).toBe(7);
  });
});

// ── transparent mode ────────────────────────────────────────────────

describe('generateMountainSVG — transparent mode', () => {
  it('omits sky background rect when transparent', () => {
    expect(generateMountainSVG({ transparent: true })).not.toMatch(/fill="url\(#cf-sky-grad/);
  });

  it('still contains all 7 mountain layers in transparent mode', () => {
    const svg = generateMountainSVG({ transparent: true });
    expect(svg).toContain('mountain-distant');
    expect(svg).toContain('mountain-back');
    expect(svg).toContain('mountain-front');
    const matches = svg.match(/class="mountain-/g) || [];
    expect(matches.length).toBe(7);
  });

  it('uses lighter fills for dark background contrast', () => {
    expect(generateMountainSVG({ transparent: true })).toContain(colors.mountainBlueLight);
  });

  it('still has illustration details in transparent mode', () => {
    const svg = generateMountainSVG({ transparent: true });
    expect(svg).toContain('bird');
    expect(svg).toContain('pine');
    expect(svg).toContain('flora');
  });

  it('still has filters in transparent mode', () => {
    const svg = generateMountainSVG({ transparent: true });
    expect(svg).toContain('<feTurbulence');
    expect(svg).toContain('<feDisplacementMap');
  });

  it('still has atmospheric haze in transparent mode', () => {
    expect(generateMountainSVG({ transparent: true })).toContain('atmospheric-haze');
  });

  it('standard mode includes sky-fill rect', () => {
    expect(generateMountainSVG({ transparent: false })).toMatch(/fill="url\(#cf-sky-grad/);
  });
});

// ── height option ───────────────────────────────────────────────────

describe('generateMountainSVG — height option', () => {
  it('applies custom height when provided', () => {
    expect(generateMountainSVG({ height: 80 })).toContain('height="80"');
  });

  it('uses default height when not specified', () => {
    expect(generateMountainSVG()).toContain('height="120"');
  });
});

// ── invalid inputs ──────────────────────────────────────────────────

describe('generateMountainSVG — invalid inputs', () => {
  it('falls back to sunrise for unknown variant', () => {
    const svg = generateMountainSVG({ variant: 'invalid' });
    expect(svg).toContain(colors.skyGradientTop);
    expect(svg).toContain(colors.skyGradientBottom);
  });

  it('uses default height for non-numeric height', () => {
    expect(generateMountainSVG({ height: 'abc' })).toContain('height="120"');
  });

  it('uses default height for negative height', () => {
    expect(generateMountainSVG({ height: -50 })).toContain('height="120"');
  });

  it('uses default height for zero height', () => {
    expect(generateMountainSVG({ height: 0 })).toContain('height="120"');
  });

  it('handles null options gracefully', () => {
    expect(() => generateMountainSVG(null)).not.toThrow();
  });

  it('handles undefined options gracefully', () => {
    expect(() => generateMountainSVG(undefined)).not.toThrow();
  });
});

// ── initMountainSkyline ─────────────────────────────────────────────

describe('initMountainSkyline', () => {
  it('sets html property on the container element', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w);
    expect(c.html).toContain('<svg');
  });

  it('uses default containerId #mountainSkyline', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w);
    expect(c.html).toContain('<svg');
  });

  it('accepts a custom containerId', () => {
    const c = createMockElement(); $w = create$w({ '#heroSkyline': c });
    initMountainSkyline($w, { containerId: '#heroSkyline' });
    expect(c.html).toContain('<svg');
  });

  it('passes variant option to SVG generation', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w, { variant: 'sunset' });
    expect(c.html).toContain(colors.sunsetCoral);
  });

  it('passes height option to SVG generation', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w, { height: 80 });
    expect(c.html).toContain('height="80"');
  });

  it('injects standard (non-transparent) SVG with sky gradient', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w);
    expect(c.html).toMatch(/fill="url\(#cf-sky-grad/);
  });

  it('injects SVG with 7 ridgeline layers', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkyline($w);
    const matches = c.html.match(/class="mountain-/g) || [];
    expect(matches.length).toBe(7);
  });

  it('does not throw when container element is missing', () => {
    expect(() => initMountainSkyline(() => { throw new Error('x'); })).not.toThrow();
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkyline(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initMountainSkyline(undefined)).not.toThrow();
  });

  it('handles container without html property gracefully', () => {
    const c = {}; $w = create$w({ '#mountainSkyline': c });
    expect(() => initMountainSkyline($w)).not.toThrow();
    expect(c.html).toContain('<svg');
  });
});

// ── initMountainSkylineTransparent ──────────────────────────────────

describe('initMountainSkylineTransparent', () => {
  it('sets html on the container element', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineTransparent($w);
    expect(c.html).toContain('<svg');
  });

  it('injects transparent SVG (no sky gradient fill)', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineTransparent($w);
    expect(c.html).not.toMatch(/fill="url\(#cf-sky-grad/);
  });

  it('uses lighter fills for dark background contrast', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineTransparent($w);
    expect(c.html).toContain(colors.mountainBlueLight);
  });

  it('passes variant option through', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineTransparent($w, { variant: 'sunset' });
    expect(c.html).toContain(colors.sunsetCoral);
  });

  it('accepts a custom containerId', () => {
    const c = createMockElement(); $w = create$w({ '#dividerSkyline': c });
    initMountainSkylineTransparent($w, { containerId: '#dividerSkyline' });
    expect(c.html).toContain('<svg');
  });

  it('injects SVG with 7 ridgeline layers', () => {
    const c = createMockElement(); $w = create$w({ '#mountainSkyline': c });
    initMountainSkylineTransparent($w);
    const matches = c.html.match(/class="mountain-/g) || [];
    expect(matches.length).toBe(7);
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkylineTransparent(null)).not.toThrow();
  });

  it('does not throw when $w throws', () => {
    expect(() => initMountainSkylineTransparent(() => { throw new Error('nope'); })).not.toThrow();
  });
});

// ── multiple instances ──────────────────────────────────────────────

describe('initMountainSkyline — multiple instances', () => {
  it('can initialize multiple containers with different variants', () => {
    const h = createMockElement(); const hero = createMockElement();
    $w = create$w({ '#headerSkyline': h, '#heroSkyline': hero });
    initMountainSkyline($w, { containerId: '#headerSkyline', variant: 'sunrise' });
    initMountainSkyline($w, { containerId: '#heroSkyline', variant: 'sunset' });
    expect(h.html).toContain(colors.skyGradientTop);
    expect(hero.html).toContain(colors.sunsetCoral);
  });
});
