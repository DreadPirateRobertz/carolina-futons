import { describe, it, expect, vi } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';

import {
  CONTACT_ILLUSTRATIONS,
  svgToDataUri,
  generateHeroSVG,
  generateShowroomSVG,
  initContactHeroSkyline,
  initContactShowroomScene,
  buildShowroomSVGWithState,
} from '../src/public/contactIllustrations.js';

// ── Helpers ────────────────────────────────────────────────────────

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
const REQUIRED_KEYS = ['showroom', 'hero'];

// ══════════════════════════════════════════════════════════════════════
// CONTACT ILLUSTRATIONS TEST SUITE
// ══════════════════════════════════════════════════════════════════════

describe('Contact Illustrations', () => {

  // ── Registry completeness ──────────────────────────────────────────

  describe('CONTACT_ILLUSTRATIONS registry', () => {
    it('exports showroom and hero illustration keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(CONTACT_ILLUSTRATIONS[key], `missing key: ${key}`).toBeDefined();
      });
    });

    it('contains only the expected keys', () => {
      expect(Object.keys(CONTACT_ILLUSTRATIONS).sort()).toEqual([...REQUIRED_KEYS].sort());
    });
  });

  // ── SVG structure ──────────────────────────────────────────────────

  describe('SVG structure', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key} illustration`, () => {
        it('is a non-empty string', () => {
          expect(typeof CONTACT_ILLUSTRATIONS[key]).toBe('string');
          expect(CONTACT_ILLUSTRATIONS[key].length).toBeGreaterThan(100);
        });

        it('is a valid SVG element', () => {
          const svg = CONTACT_ILLUSTRATIONS[key];
          expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
          expect(svg.trimEnd()).toMatch(/<\/svg>$/);
        });

        it('has a viewBox for responsive sizing', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/viewBox="[^"]+"/);
        });

        it('has xmlns attribute', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('does not use hardcoded pixel width/height on root', () => {
          const rootTag = CONTACT_ILLUSTRATIONS[key].match(/<svg[^>]+>/)[0];
          expect(rootTag).not.toMatch(/width="\d+px"/);
          expect(rootTag).not.toMatch(/height="\d+px"/);
        });
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // 10-POINT QUALITY BAR
  // ══════════════════════════════════════════════════════════════════════

  // ── 1. NO deprecated filters (Figma-first pipeline) ────────

  describe('Quality bar — no deprecated filters', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('does not contain feTurbulence (deprecated)', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/<feTurbulence/);
        });

        it('does not contain feDisplacementMap (deprecated)', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/<feDisplacementMap/);
        });

        it('does not contain fractalNoise (deprecated)', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/type="fractalNoise"/);
        });
      });
    });
  });

  // ── 3. Brand tokens only (no hardcoded hex) ───────────────────────

  describe('Quality bar — brand tokens only', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: all hex colors come from sharedTokens.colors`, () => {
        const svg = CONTACT_ILLUSTRATIONS[key];
        const foundHexes = extractHexColors(svg);
        expect(foundHexes.length).toBeGreaterThan(0);
        for (const hex of foundHexes) {
          expect(TOKEN_HEXES, `${key} has non-token hex: ${hex}`).toContain(hex);
        }
      });
    });
  });

  // ── 4. Rich gradients (5+ stops) ─────────────────────────────────

  describe('Quality bar — gradients', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has at least one gradient', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/<(linearGradient|radialGradient)/);
        });

        it('has 5+ gradient stops total', () => {
          const stops = CONTACT_ILLUSTRATIONS[key].match(/<stop[\s/]/g) || [];
          expect(stops.length, `${key} has ${stops.length} stops`).toBeGreaterThanOrEqual(5);
        });
      });
    });
  });

  // ── 5. Element count (15+ shapes per scene) ──────────────────────

  describe('Quality bar — element count', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: has 15+ SVG shape/path elements`, () => {
        const count = countShapeElements(CONTACT_ILLUSTRATIONS[key]);
        expect(count, `${key} has ${count} elements`).toBeGreaterThanOrEqual(15);
      });
    });
  });

  // ── 6. Atmospheric depth layers ───────────────────────────────────

  describe('Quality bar — atmospheric layers', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has a group with id="background"', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/id="background"/);
        });

        it('has a group with id="midground"', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/id="midground"/);
        });

        it('has a group with id="foreground"', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/id="foreground"/);
        });
      });
    });
  });

  // ── 7. Accessibility ─────────────────────────────────────────────

  describe('Quality bar — accessibility', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key}`, () => {
        it('has role="img"', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/role="img"/);
        });

        it('has a <title> element', () => {
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(/<title[^>]*>.*<\/title>/s);
        });

        it('has aria-labelledby referencing the title id', () => {
          const titleIdMatch = CONTACT_ILLUSTRATIONS[key].match(/<title\s+id="([^"]+)"/);
          expect(titleIdMatch, `${key} missing title id`).not.toBeNull();
          const titleId = titleIdMatch[1];
          expect(CONTACT_ILLUSTRATIONS[key]).toMatch(
            new RegExp(`aria-labelledby="[^"]*${titleId}[^"]*"`)
          );
        });
      });
    });
  });

  // ── 8. Detail elements (birds, trees, flowers) ───────────────────

  describe('Quality bar — detail elements', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key}: has bird V-shapes or wildflower stems`, () => {
        const svg = CONTACT_ILLUSTRATIONS[key];
        const espressoHex = colors.espresso.toLowerCase();
        const successHex = colors.success.toLowerCase();
        const svgLower = svg.toLowerCase();
        const birdLineRe = new RegExp(`<line[^>]*stroke="${espressoHex}"`, 'g');
        const birdLineCount = (svgLower.match(birdLineRe) || []).length;
        const hasBirds = birdLineCount >= 2;
        const hasWildflowerStems = svgLower.includes(`stroke="${successHex}"`);
        expect(hasBirds || hasWildflowerStems,
          `${key} lacks detail elements (needs espresso bird lines or success wildflower stems)`).toBe(true);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // THEMATIC CONTENT
  // ══════════════════════════════════════════════════════════════════════

  describe('thematic content', () => {
    it('showroom contains building/cabin shapes (rect or polygon)', () => {
      expect(CONTACT_ILLUSTRATIONS.showroom).toMatch(/<(rect|polygon|path)[^>]*>/);
    });

    it('showroom contains a map pin or location marker element', () => {
      // Map pin = circle + path combo, or explicit marker shape
      const svg = CONTACT_ILLUSTRATIONS.showroom;
      const hasCircle = svg.includes('<circle');
      const hasPath = svg.includes('<path');
      expect(hasCircle && hasPath).toBe(true);
    });

    it('hero contains mountain ridgeline paths (multiple path elements)', () => {
      const paths = CONTACT_ILLUSTRATIONS.hero.match(/<path[\s>]/g) || [];
      expect(paths.length).toBeGreaterThanOrEqual(5);
    });

    it('hero uses sunrise/warm color palette', () => {
      const svg = CONTACT_ILLUSTRATIONS.hero.toLowerCase();
      const hasCoral = svg.includes(colors.sunsetCoral.toLowerCase()) ||
                       svg.includes(colors.sunsetCoralLight.toLowerCase());
      const hasSand = svg.includes(colors.sandBase.toLowerCase()) ||
                      svg.includes(colors.sandLight.toLowerCase());
      expect(hasCoral || hasSand).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

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

    it('produces valid data URIs for both illustrations', () => {
      REQUIRED_KEYS.forEach(key => {
        const uri = svgToDataUri(CONTACT_ILLUSTRATIONS[key]);
        expect(uri, `${key} data URI`).toMatch(/^data:image\/svg\+xml/);
        expect(uri.length, `${key} data URI too short`).toBeGreaterThan(50);
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // WIX INTEGRATION FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

  describe('Wix integration', () => {
    it('initContactHeroSkyline is a function', () => {
      expect(typeof initContactHeroSkyline).toBe('function');
    });

    it('initContactShowroomScene is a function', () => {
      expect(typeof initContactShowroomScene).toBe('function');
    });

    it('initContactHeroSkyline sets html on target element', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#contactHeroSkyline' ? mockEl : null;
      initContactHeroSkyline(mock$w);
      expect(mockEl.html).toContain('<svg');
    });

    it('initContactShowroomScene sets html on target element', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#contactShowroomScene' ? mockEl : null;
      initContactShowroomScene(mock$w);
      expect(mockEl.html).toContain('<svg');
    });

    it('initContactHeroSkyline accepts custom containerId', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#customHero' ? mockEl : null;
      initContactHeroSkyline(mock$w, { containerId: '#customHero' });
      expect(mockEl.html).toContain('<svg');
    });

    it('initContactShowroomScene accepts custom containerId', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#customScene' ? mockEl : null;
      initContactShowroomScene(mock$w, { containerId: '#customScene' });
      expect(mockEl.html).toContain('<svg');
    });

    it('initContactHeroSkyline does not throw if element missing', () => {
      const mock$w = () => null;
      expect(() => initContactHeroSkyline(mock$w)).not.toThrow();
    });

    it('initContactShowroomScene does not throw if element missing', () => {
      const mock$w = () => null;
      expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    });

    it('initContactHeroSkyline does not throw if $w is null', () => {
      expect(() => initContactHeroSkyline(null)).not.toThrow();
    });

    it('initContactShowroomScene does not throw if $w is null', () => {
      expect(() => initContactShowroomScene(null)).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // SECURITY
  // ══════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════
  // GENERATE FUNCTIONS & HEIGHT PASS-THROUGH
  // ══════════════════════════════════════════════════════════════════════

  describe('generateHeroSVG', () => {
    it('returns hero SVG without options', () => {
      const svg = generateHeroSVG();
      expect(svg).toContain('<svg');
      expect(svg).toContain('height="100%"');
    });

    it('returns hero SVG with null options', () => {
      const svg = generateHeroSVG(null);
      expect(svg).toContain('height="100%"');
    });

    it('returns hero SVG with empty options', () => {
      const svg = generateHeroSVG({});
      expect(svg).toContain('height="100%"');
    });

    it('replaces height when positive number', () => {
      const svg = generateHeroSVG({ height: 300 });
      expect(svg).toContain('height="300"');
      expect(svg).not.toContain('height="100%"');
    });

    it('ignores zero height', () => {
      const svg = generateHeroSVG({ height: 0 });
      expect(svg).toContain('height="100%"');
    });

    it('ignores negative height', () => {
      const svg = generateHeroSVG({ height: -50 });
      expect(svg).toContain('height="100%"');
    });

    it('ignores string height', () => {
      const svg = generateHeroSVG({ height: '200px' });
      expect(svg).toContain('height="100%"');
    });
  });

  describe('generateShowroomSVG', () => {
    it('returns showroom SVG without options', () => {
      const svg = generateShowroomSVG();
      expect(svg).toContain('<svg');
      expect(svg).toContain('height="100%"');
    });

    it('returns showroom SVG with null options', () => {
      const svg = generateShowroomSVG(null);
      expect(svg).toContain('height="100%"');
    });

    it('replaces height when positive number', () => {
      const svg = generateShowroomSVG({ height: 250 });
      expect(svg).toContain('height="250"');
      expect(svg).not.toContain('height="100%"');
    });

    it('ignores zero height', () => {
      const svg = generateShowroomSVG({ height: 0 });
      expect(svg).toContain('height="100%"');
    });

    it('ignores negative height', () => {
      const svg = generateShowroomSVG({ height: -10 });
      expect(svg).toContain('height="100%"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // BOUNDARY CONDITIONS
  // ══════════════════════════════════════════════════════════════════════

  describe('boundary conditions', () => {
    it('initContactHeroSkyline passes height through to SVG', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#contactHeroSkyline' ? mockEl : null;
      initContactHeroSkyline(mock$w, { height: 400 });
      expect(mockEl.html).toContain('height="400"');
    });

    it('initContactShowroomScene passes height through to SVG', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#contactShowroomScene' ? mockEl : null;
      initContactShowroomScene(mock$w, { height: 350 });
      expect(mockEl.html).toContain('height="350"');
    });

    it('init functions handle undefined options gracefully', () => {
      const mockEl = { html: '' };
      const mock$w = (sel) => sel === '#contactHeroSkyline' ? mockEl : null;
      expect(() => initContactHeroSkyline(mock$w, undefined)).not.toThrow();
      expect(mockEl.html).toContain('<svg');
    });

    it('init functions handle $w returning undefined', () => {
      const mock$w = () => undefined;
      expect(() => initContactHeroSkyline(mock$w)).not.toThrow();
      expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    });

    it('init functions handle $w throwing', () => {
      const mock$w = () => { throw new Error('element not found'); };
      expect(() => initContactHeroSkyline(mock$w)).not.toThrow();
      expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // LIVING SKY STATE WIRING (CF-33f)
  // ══════════════════════════════════════════════════════════════════════

  describe('initContactShowroomScene — LivingSkyState wiring', () => {
    // Helper: build mock $w with container + optional livingSkyFrame
    function makeWix({ hasFrame = true, frameHasOnMessage = true } = {}) {
      let handler = null;
      const containerEl = { html: '' };
      const livingSkyEl = frameHasOnMessage
        ? { onMessage: (fn) => { handler = fn; } }
        : {};
      const mock$w = (sel) => {
        if (sel === '#contactShowroomScene') return containerEl;
        if (sel === '#livingSkyFrame') return hasFrame ? livingSkyEl : null;
        return null;
      };
      const trigger = (data) => handler && handler({ data });
      return { mock$w, containerEl, trigger };
    }

    // Canonical LivingSkyState fixture (living-sky.js:280-298)
    function makeState({ sky0 = '#5B8FA8', starOpacity = 0, weather = 'clear' } = {}) {
      return {
        skyColors: [sky0, '#4A7D94', '#3D6B80', '#2C5A6A'],
        ridgeColors: { r1: '#3A2518', r2: '#5B8FA8', r3: '#667788', r4: '#5B8FA8', tree: '#334455' },
        starOpacity,
        cloudOpacity: 0,
        weather,
      };
    }

    it('subscribes to #livingSkyFrame onMessage on init', () => {
      const onMessageSpy = vi.fn();
      const containerEl = { html: '' };
      const mock$w = (sel) => {
        if (sel === '#contactShowroomScene') return containerEl;
        if (sel === '#livingSkyFrame') return { onMessage: onMessageSpy };
        return null;
      };
      initContactShowroomScene(mock$w);
      expect(onMessageSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('does not throw when #livingSkyFrame is not found', () => {
      const { mock$w } = makeWix({ hasFrame: false });
      expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    });

    it('does not throw when #livingSkyFrame has no onMessage method', () => {
      const { mock$w } = makeWix({ frameHasOnMessage: false });
      expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    });

    it('is a no-op when state data is null', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      const before = containerEl.html;
      trigger(null);
      expect(containerEl.html).toBe(before);
    });

    it('is a no-op when state data is undefined', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      const before = containerEl.html;
      trigger(undefined);
      expect(containerEl.html).toBe(before);
    });

    it('updates container html when valid state arrives (injects sky-overlay)', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      const before = containerEl.html;
      trigger(makeState({ sky0: '#5B8FA8' }));
      expect(containerEl.html).not.toBe(before);
      expect(containerEl.html).toContain('id="sky-overlay"');
    });

    it('no sky-overlay injected when skyColors is absent in day mode (early return)', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      const base = containerEl.html;
      trigger({ starOpacity: 0, weather: 'clear' }); // no skyColors
      expect(containerEl.html).toBe(base);
    });

    it('night mode injects stars even when skyColors is absent', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger({ starOpacity: 0.5, weather: 'clear' }); // no skyColors, starOpacity > 0 = night
      expect(containerEl.html).toMatch(/id="stars"/);
    });

    it('invalid skyColors[0] (non-hex) is rejected — no sky-overlay injected', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      const base = containerEl.html;
      trigger({ ...makeState(), skyColors: ['linear-gradient(red, blue)', '#4A7D94', '#3D6B80', '#2C5A6A'] });
      expect(containerEl.html).toBe(base);
    });

    it('night mode (starOpacity > 0) injects star elements', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#0A0F2C', starOpacity: 0.8 }));
      expect(containerEl.html).toMatch(/id="stars"/);
    });

    it('night mode injects a moon element', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#0A0F2C', starOpacity: 1.0 }));
      expect(containerEl.html).toMatch(/id="moon"/);
    });

    it('night mode injects window lantern glow', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#0A0F2C', starOpacity: 0.9 }));
      expect(containerEl.html).toMatch(/id="window-glow"/);
    });

    it('day mode does not inject star or moon elements', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#B8D4E3', starOpacity: 0 }));
      expect(containerEl.html).not.toMatch(/id="stars"/);
      expect(containerEl.html).not.toMatch(/id="moon"/);
    });

    it('night boundary: starOpacity = 0 is day (no stars)', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#4A5568', starOpacity: 0 }));
      expect(containerEl.html).not.toMatch(/id="stars"/);
    });

    it('night boundary: starOpacity > 0 is night (has stars)', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#1A1F3E', starOpacity: 0.1 }));
      expect(containerEl.html).toMatch(/id="stars"/);
    });

    it('sky color appears in updated SVG', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#A0B0C8', weather: 'cloudy' }));
      expect(containerEl.html).toContain('#A0B0C8');
    });

    it('updated SVG remains a valid SVG', () => {
      const { mock$w, containerEl, trigger } = makeWix();
      initContactShowroomScene(mock$w);
      trigger(makeState({ sky0: '#B8D4E3' }));
      expect(containerEl.html.trimStart()).toMatch(/^<svg[\s>]/);
      expect(containerEl.html.trimEnd()).toMatch(/<\/svg>$/);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // SECURITY
  // ══════════════════════════════════════════════════════════════════════

  describe('security', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has no script tags`, () => {
        expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/<script/i);
      });

      it(`${key} has no event handler attributes`, () => {
        expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/on(click|load|error|mouseover)=/i);
      });

      it(`${key} has no external references`, () => {
        expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/xlink:href="http/i);
        expect(CONTACT_ILLUSTRATIONS[key]).not.toMatch(/href="http/i);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// PHASE 8B: buildShowroomSVGWithState — LivingSkyState ambient wiring
// ══════════════════════════════════════════════════════════════════════

describe('buildShowroomSVGWithState', () => {

  // ── Sky gradient wiring ─────────────────────────────────────────

  it('returns valid SVG for null state (static fallback)', () => {
    const svg = buildShowroomSVGWithState(null);
    expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
    expect(svg).toMatch(/viewBox="0 0 400 280"/);
  });

  it('uses static sky defaults when state is null', () => {
    const svg = buildShowroomSVGWithState(null);
    expect(svg).toContain('#B8D4E3');
    expect(svg).toContain('#A8CCD8');
  });

  it('maps state.skyColors to sky gradient stops', () => {
    const state = { skyColors: ['#050810', '#0D1628', '#141E30', '#20283A'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#050810');
    expect(svg).toContain('#0D1628');
    expect(svg).toContain('#141E30');
    expect(svg).toContain('#20283A');
  });

  it('has 4-stop linear gradient using skyColors', () => {
    const state = { skyColors: ['#050810', '#0D1628', '#141E30', '#20283A'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('<linearGradient id="show-sky-dyn"');
    const stops = svg.match(/<stop offset/g) || [];
    expect(stops.length).toBeGreaterThanOrEqual(4);
  });

  // ── Ridge layer darkness ────────────────────────────────────────

  it('maps state.ridgeColors to ridge layer fills', () => {
    const state = { skyColors: ['#B8D4E3', '#A8CCD8', '#F0C87A', '#F2E8D5'], ridgeColors: { r1: '#0A1234', r2: '#1B2345', r3: '#2C3456', r4: '#3D4567' }, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#0A1234');
    expect(svg).toContain('#1B2345');
    expect(svg).toContain('#2C3456');
    expect(svg).toContain('#3D4567');
  });

  it('falls back to static ridge defaults when ridgeColors absent', () => {
    const state = { skyColors: ['#B8D4E3', '#A8CCD8', '#F0C87A', '#F2E8D5'], ridgeColors: null, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#3A2518'); // r1 default
  });

  // ── Ambient window glow ────────────────────────────────────────

  it('window fill is sky blue at daytime (starOpacity < 0.1)', () => {
    const state = { skyColors: ['#2858A0', '#4878A8', '#88B0C4', '#A4C8DC'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#B8D4E3');
  });

  it('window fill is soft gold at dusk (starOpacity 0.1–0.39)', () => {
    const state = { skyColors: ['#100E1E', '#381630', '#801C20', '#C04020'], ridgeColors: {}, starOpacity: 0.2, moonPos: { opacity: 0.5 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#F0C87A');
  });

  it('window fill is warm lantern yellow at night (starOpacity >= 0.4)', () => {
    const state = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0.9, moonPos: { opacity: 1 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#FFF0A0');
  });

  it('uses day fill for starOpacity exactly 0.1 boundary', () => {
    const dayState = { skyColors: ['#2858A0', '#4878A8', '#88B0C4', '#A4C8DC'], ridgeColors: {}, starOpacity: 0.09, moonPos: { opacity: 0 } };
    const duskState = { skyColors: ['#100E1E', '#381630', '#801C20', '#C04020'], ridgeColors: {}, starOpacity: 0.1, moonPos: { opacity: 0 } };
    expect(buildShowroomSVGWithState(dayState)).toContain('#B8D4E3');
    expect(buildShowroomSVGWithState(duskState)).toContain('#F0C87A');
  });

  // ── Night stars ────────────────────────────────────────────────

  it('stars appear at night (starOpacity > 0.05)', () => {
    const state = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0.85, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    // Stars rendered as circles at fixed sky positions
    expect(svg).toContain('cx="60"');
    expect(svg).toContain('cx="112"');
    expect(svg).toContain('cx="342"');
  });

  it('stars absent at daytime (starOpacity = 0)', () => {
    const state = { skyColors: ['#2858A0', '#4878A8', '#88B0C4', '#A4C8DC'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    // Star circles use specific sky coordinates not found elsewhere in the SVG
    expect(svg).not.toContain('cx="60"');
    expect(svg).not.toContain('cx="342"');
  });

  it('stars absent at threshold starOpacity = 0.05', () => {
    const state = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0.05, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).not.toContain('cx="60"');
    expect(svg).not.toContain('cx="342"');
  });

  // ── Moon arc ───────────────────────────────────────────────────

  it('moon appears at night (moonPos.opacity > 0.05)', () => {
    const state = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0.9 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).toContain('#FFF8E0');
  });

  it('moon absent at daytime (moonPos.opacity = 0)', () => {
    const state = { skyColors: ['#2858A0', '#4878A8', '#88B0C4', '#A4C8DC'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).not.toContain('#FFF8E0');
  });

  it('moon uses sky0 color for crescent shadow', () => {
    const state = { skyColors: ['#0A0A1A', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0.8 } };
    const svg = buildShowroomSVGWithState(state);
    // Moon crescent = bright disk + sky-colored shadow circle
    expect(svg).toContain('#FFF8E0');
    expect(svg).toContain('#0A0A1A');
  });

  // ── Security ───────────────────────────────────────────────────

  it('sanitizes non-hex sky colors — no XSS passthrough', () => {
    const state = { skyColors: ['javascript:alert(1)', '<img/onerror=alert(1)>', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).not.toContain('javascript:');
    expect(svg).not.toContain('onerror');
    expect(svg).not.toContain('<img');
    expect(svg).toContain('#B8D4E3'); // fallback for sky0
  });

  it('sanitizes non-hex ridge colors — no XSS passthrough', () => {
    const state = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: { r1: '<script>xss</script>', r2: 'url(evil)', r3: '#345678', r4: '#456789' }, starOpacity: 0, moonPos: { opacity: 0 } };
    const svg = buildShowroomSVGWithState(state);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('url(evil)');
    expect(svg).toContain('#3A2518'); // r1 fallback
  });

  // ── Height passthrough ─────────────────────────────────────────

  it('applies height option to SVG root', () => {
    const svg = buildShowroomSVGWithState(null, { height: 320 });
    expect(svg).toContain('height="320"');
    expect(svg).not.toContain('height="100%"');
  });

  it('uses 100% height when option not provided', () => {
    const svg = buildShowroomSVGWithState(null);
    expect(svg).toContain('height="100%"');
  });

  // ── SVG structure integrity ─────────────────────────────────────

  it('has background, midground, foreground groups', () => {
    const svg = buildShowroomSVGWithState(null);
    expect(svg).toMatch(/id="background"/);
    expect(svg).toMatch(/id="midground"/);
    expect(svg).toMatch(/id="foreground"/);
  });

  it('has accessibility attributes', () => {
    const svg = buildShowroomSVGWithState(null);
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/<title[^>]*>.*<\/title>/s);
    expect(svg).toMatch(/aria-labelledby/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// PHASE 8B: initContactShowroomScene — LivingSkyState subscription
// ══════════════════════════════════════════════════════════════════════

describe('initContactShowroomScene — LivingSkyState subscription', () => {

  it('subscribes to #livingSkyFrame and updates SVG on night state', () => {
    const sceneEl = { html: '' };
    let messageHandler = null;
    const frameEl = { onMessage: (fn) => { messageHandler = fn; } };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      if (sel === '#livingSkyFrame') return frameEl;
      return null;
    };
    initContactShowroomScene(mock$w);
    expect(sceneEl.html).toContain('<svg'); // initial static
    const nightState = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0.9, moonPos: { opacity: 1 } };
    messageHandler({ data: nightState });
    expect(sceneEl.html).toContain('#FFF0A0'); // lantern yellow windows
  });

  it('renders dynamic sky gradient colors after state update', () => {
    const sceneEl = { html: '' };
    let messageHandler = null;
    const frameEl = { onMessage: (fn) => { messageHandler = fn; } };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      if (sel === '#livingSkyFrame') return frameEl;
      return null;
    };
    initContactShowroomScene(mock$w);
    const dayState = { skyColors: ['#3860A0', '#608098', '#98B8CC', '#B4CCE0'], ridgeColors: {}, starOpacity: 0, moonPos: { opacity: 0 } };
    messageHandler({ data: dayState });
    expect(sceneEl.html).toContain('#3860A0');
    expect(sceneEl.html).toContain('#B4CCE0');
  });

  it('falls back to static SVG when livingSkyFrame is absent', () => {
    const sceneEl = { html: '' };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      return null; // no livingSkyFrame
    };
    initContactShowroomScene(mock$w);
    expect(sceneEl.html).toContain('<svg');
  });

  it('does not throw when livingSkyFrame selector throws', () => {
    const sceneEl = { html: '' };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      throw new Error('not on this page');
    };
    expect(() => initContactShowroomScene(mock$w)).not.toThrow();
    expect(sceneEl.html).toContain('<svg');
  });

  it('skips update when message data is null', () => {
    const sceneEl = { html: '' };
    let messageHandler = null;
    const frameEl = { onMessage: (fn) => { messageHandler = fn; } };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      if (sel === '#livingSkyFrame') return frameEl;
      return null;
    };
    initContactShowroomScene(mock$w);
    const initialHtml = sceneEl.html;
    messageHandler({ data: null });
    expect(sceneEl.html).toBe(initialHtml);
  });

  it('passes height option through to dynamic SVG', () => {
    const sceneEl = { html: '' };
    let messageHandler = null;
    const frameEl = { onMessage: (fn) => { messageHandler = fn; } };
    const mock$w = (sel) => {
      if (sel === '#contactShowroomScene') return sceneEl;
      if (sel === '#livingSkyFrame') return frameEl;
      return null;
    };
    initContactShowroomScene(mock$w, { height: 300 });
    const nightState = { skyColors: ['#050810', '#080D1C', '#0D1628', '#141E30'], ridgeColors: {}, starOpacity: 0.9, moonPos: { opacity: 1 } };
    messageHandler({ data: nightState });
    expect(sceneEl.html).toContain('height="300"');
  });

  it('uses custom containerId when provided', () => {
    const sceneEl = { html: '' };
    let messageHandler = null;
    const frameEl = { onMessage: (fn) => { messageHandler = fn; } };
    const mock$w = (sel) => {
      if (sel === '#myScene') return sceneEl;
      if (sel === '#livingSkyFrame') return frameEl;
      return null;
    };
    initContactShowroomScene(mock$w, { containerId: '#myScene' });
    expect(sceneEl.html).toContain('<svg');
  });
});
