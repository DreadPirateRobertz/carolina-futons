/**
 * Tests for MountainSkyline.js — Programmatic SVG mountain skyline border
 *
 * cf-989f: Mountain skyline SVG border — signature brand element for all page headers
 *
 * Tests: SVG generation, brand token usage, gradient variants, responsive scaling,
 * WCAG AA (aria-hidden, decorative role), $w injection, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMountainSVG,
  initMountainSkyline,
} from '../src/public/MountainSkyline.js';
import { colors } from '../src/public/sharedTokens.js';

// ── Mock $w helper ──────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    html: '',
    style: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
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

beforeEach(() => {
  $w = create$w();
  vi.clearAllMocks();
});

// ── generateMountainSVG — SVG structure ─────────────────────────────

describe('generateMountainSVG', () => {
  it('returns a valid SVG string', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('includes a viewBox for responsive scaling', () => {
    const svg = generateMountainSVG();
    expect(svg).toMatch(/viewBox="[^"]+"/);
  });

  it('sets width to 100% for responsive fill', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('width="100%"');
  });

  it('sets preserveAspectRatio for edge-to-edge scaling', () => {
    const svg = generateMountainSVG();
    expect(svg).toMatch(/preserveAspectRatio="none"/);
  });

  it('includes aria-hidden="true" for WCAG AA decorative element', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('aria-hidden="true"');
  });

  it('includes role="presentation" for WCAG AA', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('role="presentation"');
  });

  it('contains a mountain path element (silhouette)', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('<path');
  });

  it('contains a linearGradient definition for sky', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('</linearGradient>');
  });
});

// ── generateMountainSVG — brand tokens ──────────────────────────────

describe('generateMountainSVG — brand tokens', () => {
  it('uses skyGradientTop token in sunrise variant', () => {
    const svg = generateMountainSVG({ variant: 'sunrise' });
    expect(svg).toContain(colors.skyGradientTop);
  });

  it('uses skyGradientBottom token in sunrise variant', () => {
    const svg = generateMountainSVG({ variant: 'sunrise' });
    expect(svg).toContain(colors.skyGradientBottom);
  });

  it('uses espresso token for mountain silhouette fill', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain(colors.espresso);
  });

  it('defaults to sunrise variant when no variant specified', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain(colors.skyGradientTop);
    expect(svg).toContain(colors.skyGradientBottom);
  });
});

// ── generateMountainSVG — sunset variant ────────────────────────────

describe('generateMountainSVG — sunset variant', () => {
  it('uses sunset coral-based gradient for sunset variant', () => {
    const svg = generateMountainSVG({ variant: 'sunset' });
    expect(svg).toContain(colors.sunsetCoral);
  });

  it('uses skyGradientBottom (golden) in sunset variant', () => {
    const svg = generateMountainSVG({ variant: 'sunset' });
    expect(svg).toContain(colors.skyGradientBottom);
  });

  it('still uses espresso for mountain silhouette in sunset', () => {
    const svg = generateMountainSVG({ variant: 'sunset' });
    expect(svg).toContain(colors.espresso);
  });

  it('produces different gradients for sunrise vs sunset', () => {
    const sunrise = generateMountainSVG({ variant: 'sunrise' });
    const sunset = generateMountainSVG({ variant: 'sunset' });
    expect(sunrise).not.toBe(sunset);
  });
});

// ── generateMountainSVG — height option ─────────────────────────────

describe('generateMountainSVG — height option', () => {
  it('applies custom height when provided', () => {
    const svg = generateMountainSVG({ height: 80 });
    expect(svg).toContain('height="80"');
  });

  it('uses default height when not specified', () => {
    const svg = generateMountainSVG();
    expect(svg).toContain('height="120"');
  });
});

// ── generateMountainSVG — invalid inputs ────────────────────────────

describe('generateMountainSVG — invalid inputs', () => {
  it('falls back to sunrise for unknown variant', () => {
    const svg = generateMountainSVG({ variant: 'invalid' });
    expect(svg).toContain(colors.skyGradientTop);
    expect(svg).toContain(colors.skyGradientBottom);
  });

  it('uses default height for non-numeric height', () => {
    const svg = generateMountainSVG({ height: 'abc' });
    expect(svg).toContain('height="120"');
  });

  it('uses default height for negative height', () => {
    const svg = generateMountainSVG({ height: -50 });
    expect(svg).toContain('height="120"');
  });

  it('uses default height for zero height', () => {
    const svg = generateMountainSVG({ height: 0 });
    expect(svg).toContain('height="120"');
  });

  it('handles null options gracefully', () => {
    expect(() => generateMountainSVG(null)).not.toThrow();
  });

  it('handles undefined options gracefully', () => {
    expect(() => generateMountainSVG(undefined)).not.toThrow();
  });
});

// ── initMountainSkyline — $w injection ──────────────────────────────

describe('initMountainSkyline', () => {
  it('sets html property on the container element', () => {
    const container = createMockElement();
    $w = create$w({ '#mountainSkyline': container });

    initMountainSkyline($w);

    expect(container.html).toContain('<svg');
  });

  it('uses default containerId #mountainSkyline', () => {
    const container = createMockElement();
    $w = create$w({ '#mountainSkyline': container });

    initMountainSkyline($w);

    expect(container.html).toContain('<svg');
  });

  it('accepts a custom containerId', () => {
    const container = createMockElement();
    $w = create$w({ '#heroSkyline': container });

    initMountainSkyline($w, { containerId: '#heroSkyline' });

    expect(container.html).toContain('<svg');
  });

  it('passes variant option to SVG generation', () => {
    const container = createMockElement();
    $w = create$w({ '#mountainSkyline': container });

    initMountainSkyline($w, { variant: 'sunset' });

    expect(container.html).toContain(colors.sunsetCoral);
  });

  it('passes height option to SVG generation', () => {
    const container = createMockElement();
    $w = create$w({ '#mountainSkyline': container });

    initMountainSkyline($w, { height: 80 });

    expect(container.html).toContain('height="80"');
  });

  it('does not throw when container element is missing', () => {
    const $wFailing = () => { throw new Error('Element not found'); };
    expect(() => initMountainSkyline($wFailing)).not.toThrow();
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkyline(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initMountainSkyline(undefined)).not.toThrow();
  });

  it('handles container element without html property gracefully', () => {
    const container = {};
    $w = create$w({ '#mountainSkyline': container });

    expect(() => initMountainSkyline($w)).not.toThrow();
    expect(container.html).toContain('<svg');
  });
});

// ── initMountainSkyline — multiple containers ───────────────────────

describe('initMountainSkyline — multiple instances', () => {
  it('can initialize multiple containers with different variants', () => {
    const header = createMockElement();
    const hero = createMockElement();
    $w = create$w({ '#headerSkyline': header, '#heroSkyline': hero });

    initMountainSkyline($w, { containerId: '#headerSkyline', variant: 'sunrise' });
    initMountainSkyline($w, { containerId: '#heroSkyline', variant: 'sunset' });

    expect(header.html).toContain(colors.skyGradientTop);
    expect(hero.html).toContain(colors.sunsetCoral);
  });
});
