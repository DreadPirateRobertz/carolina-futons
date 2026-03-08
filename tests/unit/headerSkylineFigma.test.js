/**
 * Tests for CF-b99: Header skyline Figma-first upgrade
 *
 * Verifies masterPage.js uses MountainSkylineFigma (static pipeline SVG)
 * instead of the deprecated MountainSkyline.js (programmatic SVG).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMountainSkylineSvg,
  initMountainSkylineFigma,
} from '../../src/public/MountainSkylineFigma.js';
import { colors } from '../../src/public/sharedTokens.js';

// ── $w Mock ─────────────────────────────────────────────────────────

function create$w() {
  const elements = new Map();
  function mockEl(id) {
    return {
      _id: id,
      html: '',
      show: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      style: {},
    };
  }
  const $w = (sel) => {
    if (!elements.has(sel)) elements.set(sel, mockEl(sel));
    return elements.get(sel);
  };
  $w._elements = elements;
  return $w;
}

let $w;
beforeEach(() => { $w = create$w(); vi.clearAllMocks(); });

// ── 1. masterPage imports MountainSkylineFigma, not MountainSkyline ──

describe('masterPage header skyline — Figma-first upgrade', () => {
  it('masterPage.js imports MountainSkylineFigma, not MountainSkyline', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/pages/masterPage.js', 'utf8');

    // Must import the Figma version
    expect(src).toContain('MountainSkylineFigma');

    // Must NOT import the deprecated programmatic version for header
    // (other pages may still use it, but masterPage header should not)
    const headerFn = src.match(/function\s+initMountainSkylineHeader[\s\S]*?^}/m);
    expect(headerFn).not.toBeNull();
    const fnBody = headerFn[0];
    expect(fnBody).toContain('MountainSkylineFigma');
    expect(fnBody).not.toContain("'public/MountainSkyline.js'");
  });

  it('initMountainSkylineHeader uses containerId #headerSkyline', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/pages/masterPage.js', 'utf8');
    const headerFn = src.match(/function\s+initMountainSkylineHeader[\s\S]*?^}/m);
    expect(headerFn).not.toBeNull();
    expect(headerFn[0]).toContain('#headerSkyline');
  });
});

// ── 2. initMountainSkylineFigma renders into #headerSkyline ──────────

describe('initMountainSkylineFigma — header context', () => {
  it('sets html on #headerSkyline container', () => {
    initMountainSkylineFigma($w, { containerId: '#headerSkyline' });
    const el = $w('#headerSkyline');
    expect(el.html).toContain('<svg');
    expect(el.html).toContain('</svg>');
  });

  it('renders valid SVG with correct attributes', () => {
    initMountainSkylineFigma($w, { containerId: '#headerSkyline' });
    const html = $w('#headerSkyline').html;
    expect(html).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(html).toContain('viewBox="0 0 1440 200"');
    expect(html).toContain('preserveAspectRatio="none"');
    expect(html).toContain('width="100%"');
  });

  it('SVG has accessibility attributes (decorative)', () => {
    initMountainSkylineFigma($w, { containerId: '#headerSkyline' });
    const html = $w('#headerSkyline').html;
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('role="presentation"');
  });

  it('defaults to #mountainSkyline if no containerId given', () => {
    initMountainSkylineFigma($w);
    const el = $w('#mountainSkyline');
    expect(el.html).toContain('<svg');
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkylineFigma(null)).not.toThrow();
  });

  it('does not throw when container element missing', () => {
    const broken$w = () => { throw new Error('Element not found'); };
    expect(() => initMountainSkylineFigma(broken$w, { containerId: '#missing' })).not.toThrow();
  });
});

// ── 3. SVG content uses brand tokens (no hardcoded non-brand hex) ────

describe('Header SVG brand token compliance', () => {
  it('contains brand colors from sharedTokens', () => {
    const svg = getMountainSkylineSvg();
    // Must contain at least some brand colors
    const brandHexes = [
      colors.mountainBlue, colors.espresso, colors.skyGradientTop,
      colors.skyGradientBottom, colors.espressoLight,
    ];
    const found = brandHexes.filter(hex => svg.includes(hex));
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it('has 7 ridge layers for Blue Ridge depth', () => {
    const svg = getMountainSkylineSvg();
    const ridges = svg.match(/class="ridge-\d+"/g) || [];
    expect(ridges.length).toBeGreaterThanOrEqual(7);
  });

  it('has atmospheric haze filters', () => {
    const svg = getMountainSkylineSvg();
    expect(svg).toContain('feGaussianBlur');
  });

  it('has detail elements (birds, trees, wildflowers)', () => {
    const svg = getMountainSkylineSvg();
    expect(svg).toContain('class="birds"');
    expect(svg).toContain('class="pine-trees"');
    expect(svg).toContain('class="wildflowers"');
  });

  it('has sky gradient with 5+ stops', () => {
    const svg = getMountainSkylineSvg();
    const skyGrad = svg.match(/id="sky-grad"[\s\S]*?<\/linearGradient>/);
    expect(skyGrad).not.toBeNull();
    const stops = (skyGrad[0].match(/<stop /g) || []).length;
    expect(stops).toBeGreaterThanOrEqual(5);
  });

  it('has no deprecated SVG filters (feTurbulence, feDisplacementMap)', () => {
    const svg = getMountainSkylineSvg();
    expect(svg).not.toContain('feTurbulence');
    expect(svg).not.toContain('feDisplacementMap');
    expect(svg).not.toContain('fractalNoise');
  });
});
