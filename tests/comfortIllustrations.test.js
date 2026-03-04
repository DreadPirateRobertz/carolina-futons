import { describe, it, expect, beforeAll } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';
import { getComfortSvg, COMFORT_SLUGS } from '../src/public/comfortIllustrations.js';

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

// ── Quality bar — watercolor filters ─────────────────────────────────

describe('Quality bar — filters', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('contains feTurbulence filter for watercolor texture', () => {
        expect(svgBySlug[slug]).toMatch(/<feTurbulence/);
      });

      it('contains feDisplacementMap', () => {
        expect(svgBySlug[slug]).toMatch(/<feDisplacementMap/);
      });

      it('contains paper grain noise filter (type="fractalNoise")', () => {
        expect(svgBySlug[slug]).toMatch(/type="fractalNoise"/);
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
