import { describe, it, expect, beforeAll } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';
import { getThankYouSvg, THANK_YOU_SLUGS, svgToDataUri } from '../src/public/thankYouIllustrations.js';

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
    const re = new RegExp(`<${tag}[\\s/>]`, 'gi');
    const matches = svg.match(re);
    if (matches) count += matches.length;
  }
  return count;
}

// ── Shared State ─────────────────────────────────────────────────────

const slugs = ['celebration'];
const svgBySlug = {};
const TOKEN_HEXES = buildTokenHexAllowlist();

beforeAll(() => {
  for (const slug of slugs) {
    svgBySlug[slug] = getThankYouSvg(slug);
  }
});

// ── getThankYouSvg API ───────────────────────────────────────────────

describe('getThankYouSvg', () => {
  it('returns a string for "celebration"', () => {
    expect(typeof getThankYouSvg('celebration')).toBe('string');
  });

  it('returns null for "unknown"', () => {
    expect(getThankYouSvg('unknown')).toBeNull();
  });

  it('returns null for null', () => {
    expect(getThankYouSvg(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getThankYouSvg(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getThankYouSvg('')).toBeNull();
  });
});

// ── THANK_YOU_SLUGS export ───────────────────────────────────────────

describe('THANK_YOU_SLUGS', () => {
  it('exports an array with celebration slug', () => {
    expect(Array.isArray(THANK_YOU_SLUGS)).toBe(true);
    expect(THANK_YOU_SLUGS).toEqual(['celebration']);
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

      it('has xmlns attribute', () => {
        expect(svgBySlug[slug]).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      });

      it('does not have fixed width/height pixel values', () => {
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

      it('gradient has 6+ stops', () => {
        const stops = svgBySlug[slug].match(/<stop[\s/]/g) || [];
        expect(stops.length).toBeGreaterThanOrEqual(6);
      });
    });
  }
});

// ── Quality bar — element count ──────────────────────────────────────

describe('Quality bar — element count', () => {
  for (const slug of slugs) {
    it(`${slug}: has 25+ SVG shape/path elements`, () => {
      const count = countShapeElements(svgBySlug[slug]);
      expect(count).toBeGreaterThanOrEqual(25);
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

// ── Security ─────────────────────────────────────────────────────────

describe('Security', () => {
  for (const slug of slugs) {
    describe(`${slug}`, () => {
      it('contains no script tags', () => {
        expect(svgBySlug[slug]).not.toMatch(/<script/i);
      });

      it('contains no event handler attributes', () => {
        expect(svgBySlug[slug]).not.toMatch(/\bon\w+\s*=/i);
      });

      it('contains no external hrefs', () => {
        expect(svgBySlug[slug]).not.toMatch(/href="http/i);
      });
    });
  }
});

// ── Thematic content ─────────────────────────────────────────────────

describe('Thematic — celebration scene', () => {
  it('contains sunset sky gradient', () => {
    expect(svgBySlug.celebration).toMatch(/sunset-sky|celebration-sky/);
  });

  it('contains cabin warm glow radial gradient', () => {
    expect(svgBySlug.celebration).toMatch(/radialGradient/);
    expect(svgBySlug.celebration).toMatch(/cabin-glow|warm-glow/);
  });

  it('contains bird elements (V shapes)', () => {
    const birdPattern = /bird|Bird/;
    const lineCount = (svgBySlug.celebration.match(/<line[^>]+stroke/g) || []).length;
    const hasBirdRef = birdPattern.test(svgBySlug.celebration);
    expect(hasBirdRef || lineCount >= 6).toBe(true);
  });

  it('contains smoke paths (chimney)', () => {
    expect(svgBySlug.celebration).toMatch(/smoke|chimney/i);
  });
});

// ── svgToDataUri ─────────────────────────────────────────────────────

describe('svgToDataUri', () => {
  it('returns a data URI for a valid SVG string', () => {
    const result = svgToDataUri('<svg>test</svg>');
    expect(result).toMatch(/^data:image\/svg\+xml,/);
  });

  it('returns empty string for null', () => {
    expect(svgToDataUri(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(svgToDataUri(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(svgToDataUri('')).toBe('');
  });

  it('handles special characters', () => {
    const result = svgToDataUri('<svg>&amp;"quotes"</svg>');
    expect(result).toMatch(/^data:image\/svg\+xml,/);
    expect(result).toContain(encodeURIComponent('&amp;'));
  });
});
