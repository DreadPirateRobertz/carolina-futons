import { describe, it, expect, beforeAll } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';
import { getComfortSvg, COMFORT_SLUGS, initComfortIllustration } from '../src/public/comfortIllustrations.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Collect all hex color values from sharedTokens.colors as an allowlist. */
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

/** Extract all hex colors (#RGB, #RRGGBB, #RRGGBBAA) from a string. */
function extractHexColors(str) {
  const matches = str.match(/#[0-9A-Fa-f]{3,8}\b/g) || [];
  return matches.map((h) => h.toUpperCase());
}

/** Count SVG shape/path elements in a string. */
function countShapeElements(svg) {
  const tags = ['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line'];
  let count = 0;
  for (const tag of tags) {
    // Match opening tags like <path ... or self-closing <path .../>
    const re = new RegExp(`<${tag}[\\s/>]`, 'gi');
    const matches = svg.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

// ── Shared State ─────────────────────────────────────────────────────

const slugs = ['plush', 'medium', 'firm'];
const svgBySlug = {};
const TOKEN_HEXES = buildTokenHexAllowlist();

beforeAll(() => {
  for (const slug of slugs) {
    svgBySlug[slug] = getComfortSvg(slug);
  }
});

// ── getComfortSvg API ────────────────────────────────────────────────

describe('getComfortSvg', () => {
  it('returns a string for "plush"', () => {
    expect(typeof getComfortSvg('plush')).toBe('string');
  });

  it('returns a string for "medium"', () => {
    expect(typeof getComfortSvg('medium')).toBe('string');
  });

  it('returns a string for "firm"', () => {
    expect(typeof getComfortSvg('firm')).toBe('string');
  });

  it('returns null for "unknown"', () => {
    expect(getComfortSvg('unknown')).toBeNull();
  });

  it('returns null for null', () => {
    expect(getComfortSvg(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getComfortSvg(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getComfortSvg('')).toBeNull();
  });
});

// ── COMFORT_SLUGS export ─────────────────────────────────────────────

describe('COMFORT_SLUGS', () => {
  it('exports an array of three comfort slugs', () => {
    expect(Array.isArray(COMFORT_SLUGS)).toBe(true);
    expect(COMFORT_SLUGS).toEqual(['plush', 'medium', 'firm']);
  });
});

// ── SVG structure ────────────────────────────────────────────────────

describe('SVG structure', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('starts with <svg', () => {
        expect(svgBySlug[slug]).toMatch(/^<svg[\s>]/);
      });

      it('has a viewBox attribute for responsive scaling', () => {
        expect(svgBySlug[slug]).toMatch(/viewBox="/);
      });

      it('does not have fixed width/height pixel values', () => {
        // Should NOT have width="400px" or height="300px" style attrs
        expect(svgBySlug[slug]).not.toMatch(/\bwidth="\d+px"/);
        expect(svgBySlug[slug]).not.toMatch(/\bheight="\d+px"/);
      });

      it('contains a <title> element for accessibility', () => {
        expect(svgBySlug[slug]).toMatch(/<title[^>]*>.*<\/title>/s);
      });

      it('has role="img" for a11y', () => {
        expect(svgBySlug[slug]).toMatch(/role="img"/);
      });

      it('has aria-labelledby pointing to a title id', () => {
        // Extract the title id and check aria-labelledby references it
        const titleIdMatch = svgBySlug[slug].match(/<title\s+id="([^"]+)"/);
        expect(titleIdMatch).not.toBeNull();
        const titleId = titleIdMatch[1];
        expect(svgBySlug[slug]).toMatch(new RegExp(`aria-labelledby="[^"]*${titleId}[^"]*"`));
      });
    });
  }
});

// ── Quality bar — no deprecated filters (Figma-first migration) ─────

describe('Quality bar — no deprecated filters', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('does NOT contain feTurbulence (deprecated per overseer directive)', () => {
        expect(svgBySlug[slug]).not.toMatch(/<feTurbulence/);
      });

      it('does NOT contain feDisplacementMap (deprecated per overseer directive)', () => {
        expect(svgBySlug[slug]).not.toMatch(/<feDisplacementMap/);
      });

      it('does NOT contain fractalNoise (deprecated per overseer directive)', () => {
        expect(svgBySlug[slug]).not.toMatch(/type="fractalNoise"/);
      });

      it('achieves watercolor feel through layered opacity paths', () => {
        // At least 4 mountain ridge paths with varying opacity
        const opacityPaths = svgBySlug[slug].match(/opacity="0\.\d+"/g) || [];
        expect(opacityPaths.length).toBeGreaterThanOrEqual(10);
      });
    });
  }
});

// ── Quality bar — brand tokens only ──────────────────────────────────

describe('Quality bar — brand tokens only', () => {
  for (const slug of slugs) {
    it(`${slug}: all hex colors come from sharedTokens.colors`, () => {
      const svg = svgBySlug[slug];
      const foundHexes = extractHexColors(svg);

      expect(foundHexes.length).toBeGreaterThan(0);
      for (const hex of foundHexes) {
        expect(TOKEN_HEXES).toContain(hex);
      }
    });
  }
});

// ── Quality bar — gradients ──────────────────────────────────────────

describe('Quality bar — gradients', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('has at least one linearGradient or radialGradient', () => {
        expect(svgBySlug[slug]).toMatch(/<(linearGradient|radialGradient)/);
      });

      it('gradient has 5+ stops', () => {
        const stops = svgBySlug[slug].match(/<stop[\s/]/g) || [];
        expect(stops.length).toBeGreaterThanOrEqual(5);
      });
    });
  }
});

// ── Quality bar — element count ──────────────────────────────────────

describe('Quality bar — element count', () => {
  for (const slug of slugs) {
    it(`${slug}: has 15+ SVG shape/path elements`, () => {
      const count = countShapeElements(svgBySlug[slug]);
      expect(count).toBeGreaterThanOrEqual(15);
    });
  }
});

// ── initComfortIllustration — LivingSkyState wiring ──────────────────

function makeWix(hasFrame = true) {
  const handlers = {};
  const frame = hasFrame ? {
    onMessage: (fn) => { handlers.livingSky = fn; },
    postMessage: (state) => handlers.livingSky && handlers.livingSky({ data: state }),
  } : null;
  const containers = {};
  return {
    $w: (id) => {
      if (id === '#livingSkyFrame') { if (!frame) throw new Error('not found'); return frame; }
      if (!containers[id]) containers[id] = { html: '' };
      return containers[id];
    },
    containers,
    trigger: (state) => frame && frame.postMessage(state),
  };
}

describe('initComfortIllustration', () => {
  it('sets initial html for plush slug', () => {
    const { $w, containers } = makeWix();
    initComfortIllustration($w, 'plush', '#comfortScene');
    expect(containers['#comfortScene'].html).toContain('<svg');
  });

  it('applies sky overlay on LivingSkyState message', () => {
    const { $w, containers, trigger } = makeWix();
    initComfortIllustration($w, 'plush', '#comfortScene');
    trigger({ skyColors: ['#3A5A7A'], starOpacity: 0 });
    expect(containers['#comfortScene'].html).toContain('#3A5A7A');
    expect(containers['#comfortScene'].html).toContain('sky-overlay');
  });

  it('adds stars at night', () => {
    const { $w, containers, trigger } = makeWix();
    initComfortIllustration($w, 'medium', '#comfortScene');
    trigger({ skyColors: ['#0A0E1A'], starOpacity: 0.9 });
    expect(containers['#comfortScene'].html).toContain('id="stars"');
  });

  it('rejects non-hex skyColor', () => {
    const { $w, containers, trigger } = makeWix();
    initComfortIllustration($w, 'firm', '#comfortScene');
    trigger({ skyColors: ['" onmouseover="alert(1)'], starOpacity: 0 });
    expect(containers['#comfortScene'].html).not.toContain('onmouseover');
  });

  it('does not throw when livingSkyFrame absent', () => {
    const { $w } = makeWix(false);
    expect(() => initComfortIllustration($w, 'plush', '#comfortScene')).not.toThrow();
  });

  it('does not throw when $w is null', () => {
    expect(() => initComfortIllustration(null, 'plush', '#comfortScene')).not.toThrow();
  });

  it('second trigger replaces first — overlay does not accumulate', () => {
    const { $w, containers, trigger } = makeWix();
    initComfortIllustration($w, 'plush', '#comfortScene');
    trigger({ skyColors: ['#3A5A7A'], starOpacity: 0 });
    trigger({ skyColors: ['#1B2E3C'], starOpacity: 0 });
    // Only the second color present; first color not stacked
    expect(containers['#comfortScene'].html).toContain('#1B2E3C');
    expect(containers['#comfortScene'].html).not.toContain('#3A5A7A');
    expect((containers['#comfortScene'].html.match(/sky-overlay/g) || []).length).toBe(1);
  });

  it('sets empty html for unknown slug', () => {
    const { $w, containers } = makeWix();
    initComfortIllustration($w, 'nonexistent', '#comfortScene');
    expect(containers['#comfortScene'].html).toBe('');
  });
});

// ── Quality bar — atmospheric layers ─────────────────────────────────

describe('Quality bar — atmospheric layers', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('has a group with id="background"', () => {
        expect(svgBySlug[slug]).toMatch(/id="background"/);
      });

      it('has a group with id="midground"', () => {
        expect(svgBySlug[slug]).toMatch(/id="midground"/);
      });

      it('has a group with id="foreground"', () => {
        expect(svgBySlug[slug]).toMatch(/id="foreground"/);
      });
    });
  }
});
