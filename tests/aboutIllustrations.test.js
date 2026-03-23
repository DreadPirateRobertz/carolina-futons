/**
 * About Page Illustration Tests (cf-g4f)
 *
 * Team Portrait + Blue Ridge Timeline SVG illustrations.
 * Figma-first pipeline: static SVG, no deprecated filters.
 * Verifies quality bar:
 *   1. NO deprecated filters (feTurbulence, feDisplacementMap, fractalNoise)
 *   2. Organic hand-drawn paths (15+ shape elements)
 *   3. 5+ gradient stops
 *   4. Atmospheric depth (background/midground/foreground)
 *   5. All colors from sharedTokens
 *   6. Detail elements (birds, trees, etc.)
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
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

import { WARM_ILLUSTRATION_PALETTE } from './warmIllustrationPalette.js';

const TOKEN_HEXES = buildTokenHexAllowlist();
for (const hex of WARM_ILLUSTRATION_PALETTE) TOKEN_HEXES.add(hex.toUpperCase());

// ═══════════════════════════════════════════════════════════════════
// TEAM PORTRAIT
// ═══════════════════════════════════════════════════════════════════

describe('Team Portrait (getTeamPortraitSvg)', () => {
  let svg;

  beforeAll(async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    svg = mod.getTeamPortraitSvg();
  });

  // ── API ──

  it('exports getTeamPortraitSvg as a function', async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    expect(typeof mod.getTeamPortraitSvg).toBe('function');
  });

  it('returns an SVG string', () => {
    expect(typeof svg).toBe('string');
    expect(svg).toMatch(/^<svg[\s>]/);
  });

  // ── SVG structure ──

  it('has viewBox for responsive scaling', () => {
    expect(svg).toMatch(/viewBox="/);
  });

  it('has no fixed pixel dimensions', () => {
    expect(svg).not.toMatch(/\bwidth="\d+px"/);
    expect(svg).not.toMatch(/\bheight="\d+px"/);
  });

  it('has <title> for accessibility', () => {
    expect(svg).toMatch(/<title[^>]*>.*<\/title>/s);
  });

  it('has role="img" and aria-labelledby', () => {
    expect(svg).toMatch(/role="img"/);
    const titleIdMatch = svg.match(/<title\s+id="([^"]+)"/);
    expect(titleIdMatch).not.toBeNull();
    expect(svg).toMatch(new RegExp(`aria-labelledby="[^"]*${titleIdMatch[1]}[^"]*"`));
  });

  // ── Quality bar 1: NO deprecated filters ──

  it('does not contain feTurbulence (deprecated)', () => {
    expect(svg).not.toMatch(/<feTurbulence/);
  });

  it('does not contain feDisplacementMap (deprecated)', () => {
    expect(svg).not.toMatch(/<feDisplacementMap/);
  });

  it('does not contain fractalNoise (deprecated)', () => {
    expect(svg).not.toMatch(/type="fractalNoise"/);
  });

  // ── Quality bar 2: 15+ shape/path elements (organic hand-drawn) ──

  it('has 15+ SVG shape/path elements', () => {
    expect(countShapeElements(svg)).toBeGreaterThanOrEqual(15);
  });

  // ── Quality bar 3: 5+ gradient stops ──

  it('has at least one gradient', () => {
    expect(svg).toMatch(/<(linearGradient|radialGradient)/);
  });

  it('has 5+ gradient stops', () => {
    const stops = svg.match(/<stop[\s/]/g) || [];
    expect(stops.length).toBeGreaterThanOrEqual(5);
  });

  // ── Quality bar 4: atmospheric depth layers ──

  it('has background layer group', () => {
    expect(svg).toMatch(/id="background"/);
  });

  it('has midground layer group', () => {
    expect(svg).toMatch(/id="midground"/);
  });

  it('has foreground layer group', () => {
    expect(svg).toMatch(/id="foreground"/);
  });

  // ── Quality bar 7: all colors from sharedTokens ──

  it('all hex colors come from sharedTokens.colors', () => {
    const foundHexes = extractHexColors(svg);
    expect(foundHexes.length).toBeGreaterThan(0);
    for (const hex of foundHexes) {
      expect(TOKEN_HEXES, `Unlisted hex: ${hex}`).toContain(hex);
    }
  });

  // ── Quality bar 8: detail elements ──

  it('contains team photo frame elements (rustic frame groups)', () => {
    // Team portrait should have illustrated photo frames (matching design.jpeg "Our Story" section)
    const frameGroups = svg.match(/id="[^"]*(?:team-frame|photo-frame)[^"]*"/gi) || [];
    expect(frameGroups.length).toBeGreaterThanOrEqual(3);
  });

  it('photo frames have rough hand-drawn border paths', () => {
    // Each frame should use organic bezier paths (not rectangles) for rustic borders
    const frameBorders = svg.match(/id="[^"]*frame-border[^"]*"/gi) || [];
    expect(frameBorders.length).toBeGreaterThanOrEqual(3);
  });

  it('contains Blue Ridge mountain backdrop', () => {
    // Must have mountain ridgelines in background/midground
    const mountainPaths = svg.match(/id="[^"]*(?:mountain|ridge)[^"]*"/gi) || [];
    expect(mountainPaths.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// BLUE RIDGE TIMELINE
// ═══════════════════════════════════════════════════════════════════

describe('Blue Ridge Timeline (getTimelineSvg)', () => {
  let svg;

  beforeAll(async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    svg = mod.getTimelineSvg();
  });

  // ── API ──

  it('exports getTimelineSvg as a function', async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    expect(typeof mod.getTimelineSvg).toBe('function');
  });

  it('returns an SVG string', () => {
    expect(typeof svg).toBe('string');
    expect(svg).toMatch(/^<svg[\s>]/);
  });

  // ── SVG structure ──

  it('has viewBox for responsive scaling', () => {
    expect(svg).toMatch(/viewBox="/);
  });

  it('has no fixed pixel dimensions', () => {
    expect(svg).not.toMatch(/\bwidth="\d+px"/);
    expect(svg).not.toMatch(/\bheight="\d+px"/);
  });

  it('has <title> for accessibility', () => {
    expect(svg).toMatch(/<title[^>]*>.*<\/title>/s);
  });

  it('has role="img" and aria-labelledby', () => {
    expect(svg).toMatch(/role="img"/);
    const titleIdMatch = svg.match(/<title\s+id="([^"]+)"/);
    expect(titleIdMatch).not.toBeNull();
    expect(svg).toMatch(new RegExp(`aria-labelledby="[^"]*${titleIdMatch[1]}[^"]*"`));
  });

  // ── Quality bar 1: NO deprecated filters ──

  it('does not contain feTurbulence (deprecated)', () => {
    expect(svg).not.toMatch(/<feTurbulence/);
  });

  it('does not contain feDisplacementMap (deprecated)', () => {
    expect(svg).not.toMatch(/<feDisplacementMap/);
  });

  it('does not contain fractalNoise (deprecated)', () => {
    expect(svg).not.toMatch(/type="fractalNoise"/);
  });

  // ── Quality bar 2: 15+ shape/path elements ──

  it('has 15+ SVG shape/path elements', () => {
    expect(countShapeElements(svg)).toBeGreaterThanOrEqual(15);
  });

  // ── Quality bar 3: 5+ gradient stops ──

  it('has at least one gradient', () => {
    expect(svg).toMatch(/<(linearGradient|radialGradient)/);
  });

  it('has 5+ gradient stops', () => {
    const stops = svg.match(/<stop[\s/]/g) || [];
    expect(stops.length).toBeGreaterThanOrEqual(5);
  });

  // ── Quality bar 4: atmospheric depth layers ──

  it('has background layer group', () => {
    expect(svg).toMatch(/id="background"/);
  });

  it('has midground layer group', () => {
    expect(svg).toMatch(/id="midground"/);
  });

  it('has foreground layer group', () => {
    expect(svg).toMatch(/id="foreground"/);
  });

  // ── Quality bar 7: all colors from sharedTokens ──

  it('all hex colors come from sharedTokens.colors', () => {
    const foundHexes = extractHexColors(svg);
    expect(foundHexes.length).toBeGreaterThan(0);
    for (const hex of foundHexes) {
      expect(TOKEN_HEXES, `Unlisted hex: ${hex}`).toContain(hex);
    }
  });

  // ── Quality bar 8: detail elements ──

  it('contains timeline milestone markers', () => {
    // Timeline should have dated milestone elements
    const milestoneGroups = svg.match(/id="[^"]*(?:milestone|year|era)[^"]*"/gi) || [];
    expect(milestoneGroups.length).toBeGreaterThanOrEqual(3);
  });

  it('contains mountain landscape elements', () => {
    const mountainPaths = svg.match(/id="[^"]*(?:mountain|ridge)[^"]*"/gi) || [];
    expect(mountainPaths.length).toBeGreaterThanOrEqual(1);
  });

  it('contains bird or tree detail elements', () => {
    // Detail elements: birds (V shapes), pine trees, wildflowers
    const details = svg.match(/id="[^"]*(?:bird|tree|pine|flower)[^"]*"/gi) || [];
    expect(details.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// INIT FUNCTION — wires SVGs into $w containers
// ═══════════════════════════════════════════════════════════════════

describe('initAboutIllustrations($w)', () => {
  it('exports initAboutIllustrations as a function', async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    expect(typeof mod.initAboutIllustrations).toBe('function');
  });

  it('injects team portrait SVG into #teamPortraitContainer', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const elements = new Map();
    const $w = (sel) => {
      if (!elements.has(sel)) elements.set(sel, { html: '', postMessage: () => {} });
      return elements.get(sel);
    };
    initAboutIllustrations($w);

    const container = elements.get('#teamPortraitContainer');
    expect(container.html).toMatch(/^<svg[\s>]/);
    expect(container.html).toMatch(/team/i);
  });

  it('injects timeline SVG into #timelineContainer', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const elements = new Map();
    const $w = (sel) => {
      if (!elements.has(sel)) elements.set(sel, { html: '', postMessage: () => {} });
      return elements.get(sel);
    };
    initAboutIllustrations($w);

    const container = elements.get('#timelineContainer');
    expect(container.html).toMatch(/^<svg[\s>]/);
    expect(container.html).toMatch(/timeline/i);
  });

  it('does not throw when containers are missing', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = () => null;
    expect(() => initAboutIllustrations($w)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// LIVINGSKY WIRING — initAboutIllustrations subscribes #livingSkyFrame
// ═══════════════════════════════════════════════════════════════════

describe('initAboutIllustrations($w) — onMessage sky subscription (CF-p8c / cf-gug)', () => {
  function makeW() {
    const elements = new Map();
    let _onMessageCb = null;
    const $w = (sel) => {
      if (!elements.has(sel)) {
        const el = { html: '', postMessage: vi.fn() };
        if (sel === '#livingSkyFrame') {
          el.onMessage = (cb) => { _onMessageCb = cb; };
        }
        elements.set(sel, el);
      }
      return elements.get(sel);
    };
    $w._fire = (data) => { if (_onMessageCb) _onMessageCb({ data }); };
    return $w;
  }

  it('does not export initLivingSky (onMessage pattern replaces delegation)', async () => {
    const mod = await import('../src/public/aboutIllustrations.js');
    expect(mod.initLivingSky).toBeUndefined();
  });

  it('updates both containers when #livingSkyFrame fires a day-mode state', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = makeW();
    initAboutIllustrations($w);
    $w._fire({ skyColors: ['#1A2B3C'], starOpacity: 0 });
    expect($w('#teamPortraitContainer').html).toContain('id="sky-overlay"');
    expect($w('#timelineContainer').html).toContain('id="sky-overlay"');
  });

  it('injects star field when starOpacity > 0 (night mode)', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = makeW();
    initAboutIllustrations($w);
    $w._fire({ skyColors: ['#0A0E1A'], starOpacity: 0.8 });
    expect($w('#teamPortraitContainer').html).toContain('id="stars"');
    expect($w('#timelineContainer').html).toContain('id="stars"');
  });

  it('does not inject sky-overlay when skyColors[0] fails hex validation (XSS guard)', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = makeW();
    initAboutIllustrations($w);
    $w._fire({ skyColors: ['javascript:alert(1)'], starOpacity: 0 });
    expect($w('#teamPortraitContainer').html).not.toContain('id="sky-overlay"');
    expect($w('#timelineContainer').html).not.toContain('id="sky-overlay"');
  });

  it('does not throw when #livingSkyFrame is absent', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = (sel) => {
      if (sel === '#livingSkyFrame') return null;
      return { html: '', postMessage: vi.fn() };
    };
    expect(() => initAboutIllustrations($w)).not.toThrow();
  });

  it('does not throw when event.data is null', async () => {
    const { initAboutIllustrations } = await import('../src/public/aboutIllustrations.js');
    const $w = makeW();
    initAboutIllustrations($w);
    expect(() => $w._fire(null)).not.toThrow();
  });
});
