# Thank You Illustration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a high-quality SVG illustration module for the Thank You page — a Blue Ridge sunset celebration scene that passes the 8/8 quality bar.

**Architecture:** Single module `thankYouIllustrations.js` exporting one `celebration` SVG via `getThankYouSvg(slug)`. Mirrors `comfortIllustrations.js` pattern exactly. TDD: tests first, then implementation, then visual verification.

**Tech Stack:** Vitest (tests), SVG (illustration), sharedTokens.js (colors), Puppeteer (visual QA)

---

### Task 1: Write the failing test file

**Files:**
- Create: `tests/thankYouIllustrations.test.js`

**Step 1: Create the complete test file**

```js
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
    // Birds are line pairs or small paths in the sky area
    const birdPattern = /bird|Bird/;
    // Check for comment or id referencing birds, OR at least 3 small V-shape line pairs
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
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/thankYouIllustrations.test.js`
Expected: FAIL — module `thankYouIllustrations.js` does not exist

**Step 3: Commit**

```bash
git add tests/thankYouIllustrations.test.js
git commit -m "test(cf-55ml): add TDD tests for Thank You illustration module

30 tests covering API, SVG structure, 8/8 quality bar, security,
thematic content, and svgToDataUri. All fail — module not yet created.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Create the illustration module with celebration SVG

**Files:**
- Create: `src/public/thankYouIllustrations.js`

**Step 1: Create the module**

The SVG must be a Blue Ridge sunset celebration scene with:
- **Sunset sky:** 6+ stop gradient (skyGradientTop → mountainBlueLight → sandLight → sunsetCoralLight → sunsetCoral → skyGradientBottom)
- **Cabin glow:** radialGradient id containing "cabin-glow" or "warm-glow", centered at cabin door
- **7 ridgeline layers:** each progressively lighter/hazier, soft rolling curves with extra control points
- **Cabin:** walls (rect), peaked roof (path), door (rect), chimney (rect), windows with glow (rects with radial fill)
- **Chimney smoke:** 2 organic curling paths, id or class containing "smoke"
- **Birds:** 4+ V-shapes using line pairs in the sky, with ids containing "bird"
- **Pine trees:** 3 clusters with branch-layer paths (not blobs)
- **Wildflowers:** 4+ small circles/paths at foreground base
- **Fireflies:** 3+ small warm circles with low opacity
- **Trail:** winding path from foreground to cabin
- **Clouds:** 2+ wispy ellipse groups
- **Package on porch:** small rect with ribbon path

Use the exact filter/gradient/layer pattern from `comfortIllustrations.js`:
- `watercolor-celebration` filter: `feTurbulence baseFrequency="0.04" numOctaves="4"` + `feDisplacementMap scale="4"`
- `paperGrain-celebration` filter: `feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3"` + `feBlend mode="multiply"`
- Wrap all content in `<g filter="url(#paperGrain-celebration)">`
- Three groups: `id="background"`, `id="midground"` (with `opacity="0.7"`), `id="foreground"`

Module structure:
```js
import { colors } from 'public/sharedTokens.js';

const {
  sandBase, sandLight, sandDark,
  espresso, espressoLight,
  mountainBlue, mountainBlueDark, mountainBlueLight,
  sunsetCoral, sunsetCoralDark, sunsetCoralLight,
  offWhite, white,
  skyGradientTop, skyGradientBottom,
  success, mutedBrown,
} = colors;

export const THANK_YOU_SLUGS = ['celebration'];

const SVG_MAP = { celebration: celebrationSvg };

export function getThankYouSvg(slug) {
  if (!slug || !SVG_MAP[slug]) return null;
  return SVG_MAP[slug]();
}

export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}

function celebrationSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" role="img" aria-labelledby="title-celebration">
  <title id="title-celebration">Post-purchase celebration — a warm cabin with glowing windows beneath a Blue Ridge sunset sky, chimney smoke rising, birds in flight, fireflies emerging at twilight</title>
  <defs>
    <filter id="watercolor-celebration">
      <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="4" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="4"/>
    </filter>
    <filter id="paperGrain-celebration">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="grain"/>
      <feColorMatrix type="saturate" values="0" in="grain" result="desaturated"/>
      <feBlend in="SourceGraphic" in2="desaturated" mode="multiply"/>
    </filter>
    <linearGradient id="celebration-sky" x1="0" y1="0" x2="0" y2="1">
      <!-- 7-stop sunset sky gradient -->
    </linearGradient>
    <radialGradient id="cabin-glow" cx="50%" cy="75%" r="35%">
      <!-- warm glow from cabin door -->
    </radialGradient>
    <linearGradient id="celebration-ground" x1="0" y1="0" x2="0" y2="1">
      <!-- ground gradient -->
    </linearGradient>
  </defs>
  <g filter="url(#paperGrain-celebration)">
    <g id="background">
      <!-- sky rect, far ridgelines (3 layers), clouds (2), birds (4 V-shapes) -->
    </g>
    <g id="midground" opacity="0.7">
      <!-- mid ridgelines (2 layers), pine tree clusters (3), haze -->
    </g>
    <g id="foreground">
      <!-- ground, cabin (walls+roof+door+chimney+windows), smoke (2 paths), -->
      <!-- package on porch, wildflowers (4), fireflies (3), trail path -->
    </g>
  </g>
</svg>`;
}
```

IMPORTANT: The actual SVG paths must have **organic hand-drawn wobble** — extra control points on every bezier. Study `plushSvg()` ridgeline paths for the right level of irregularity. Blue Ridge ridgelines are SOFT and ROLLING. Each ridgeline layer must be lighter opacity than the one in front.

**Element count target:** 30+ (well above 25 minimum). Every path must use only sharedTokens color variables — zero hardcoded hex.

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/thankYouIllustrations.test.js`
Expected: ALL 30 tests PASS

**Step 3: Commit**

```bash
git add src/public/thankYouIllustrations.js
git commit -m "feat(cf-55ml): add Thank You celebration SVG illustration

Blue Ridge sunset scene — cabin with warm glow, 7 ridgeline layers,
chimney smoke, birds, pine trees, wildflowers, fireflies, delivery
package. 30+ elements, 8/8 quality bar, zero hardcoded hex.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Visual verification via Puppeteer

**Files:**
- None modified — screenshot verification only

**Step 1: Create a temp HTML file to render the SVG**

Use Puppeteer to navigate to a page that renders the celebration SVG inline. Take a screenshot at 800x500.

**Step 2: Compare against design.jpeg aesthetic**

Verify visually:
- Sunset warmth (coral/gold dominant, not cold blue)
- Visible watercolor texture displacement (edges should shimmer)
- Soft rolling ridgelines (not jagged, not smooth mathematical)
- Cabin glow is warm and inviting
- Atmospheric haze between ridgeline layers
- Overall matches the hand-illustrated feel of design.jpeg headers

**Step 3: If visual issues found, fix SVG paths and re-run tests**

---

### Task 4: Add to illustration preview page

**Files:**
- Modify: `design-vision/illustration-preview-all.html`

**Step 1: Add a Thank You Illustrations section**

Add a new `.category` section after the existing ones, following the same pattern:
- `<h2>Thank You Illustrations <span class="count">(1 scene)</span></h2>`
- Grid with `.card` containing the inline SVG, meta info, quality bar checks

**Step 2: Take screenshot of the preview page section**

Verify the illustration renders alongside existing ones.

**Step 3: Commit**

```bash
git add design-vision/illustration-preview-all.html
git commit -m "docs(cf-55ml): add Thank You illustration to preview page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Push branch and open PR

**Step 1: Push branch**

```bash
git push -u origin cf-55ml-thankyou-illustrations
```

**Step 2: Open PR**

```bash
gh pr create --title "feat(cf-55ml): Thank You page celebration illustration" --body "$(cat <<'EOF'
## Summary
- New `thankYouIllustrations.js` module with Blue Ridge sunset celebration scene
- 30+ SVG elements, 8/8 quality bar (watercolor filters, paper grain, atmospheric depth)
- TDD: tests written first, all passing
- Added to illustration preview page for visual QA

## 8/8 Quality Bar
1. feTurbulence + feDisplacementMap watercolor filter
2. Organic hand-drawn Blue Ridge ridgelines (7 layers)
3. 30+ SVG elements (cabin, smoke, birds, trees, wildflowers, fireflies)
4. 7-stop sunset sky gradient + cabin glow radial
5. fractalNoise paper grain overlay
6. 3 atmospheric depth layers with haze
7. All colors from sharedTokens — zero hardcoded hex
8. Visually verified via Puppeteer screenshot

## Test plan
- [ ] `npx vitest run tests/thankYouIllustrations.test.js` — 30 tests pass
- [ ] Visual screenshot matches design.jpeg sunset warmth
- [ ] No hardcoded hex colors outside sharedTokens

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Notify melania**

```bash
gt nudge cfutons/melania "PR ready for cf-55ml: Thank You celebration illustration. 8/8 quality bar, TDD, visual verified."
```
