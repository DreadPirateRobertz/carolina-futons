# Comfort Story Card Illustrations — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace emoji fallbacks in ComfortStoryCards with hand-drawn SVG illustrations matching the Blue Ridge watercolor aesthetic.

**Architecture:** New `comfortIllustrations.js` module exports `getComfortSvg(slug)` returning inline SVG strings built from sharedTokens colors. `ComfortStoryCards.js` updated with 3-tier fallback: CMS image → inline SVG → emoji. Visual verification via Puppeteer screenshot.

**Tech Stack:** Wix Velo, SVG with filter effects (feTurbulence, feDisplacementMap, feNoise), Vitest, Puppeteer

**Bead:** cf-2lvd | **Date:** 2026-03-02 | **Author:** godfrey

---

## Task 1: Write failing tests for comfortIllustrations.js

**Files:**
- Create: `tests/comfortIllustrations.test.js`

**Step 1: Write the failing test file**

Create `tests/comfortIllustrations.test.js` with these test groups:

```js
import { describe, it, expect } from 'vitest';
import { getComfortSvg, COMFORT_SLUGS } from '../src/public/comfortIllustrations.js';
import { colors } from '../src/public/sharedTokens.js';

describe('comfortIllustrations', () => {
  // -- getComfortSvg API --
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
    it('returns null for unknown slug', () => {
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

  // -- COMFORT_SLUGS export --
  describe('COMFORT_SLUGS', () => {
    it('exports array with exactly 3 slugs', () => {
      expect(COMFORT_SLUGS).toEqual(['plush', 'medium', 'firm']);
    });
  });

  // -- SVG structure requirements --
  describe('SVG structure', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      describe(slug, () => {
        let svg;
        beforeAll(() => { svg = getComfortSvg(slug); });

        it('starts with <svg', () => {
          expect(svg).toMatch(/^<svg\s/);
        });
        it('has viewBox attribute (responsive)', () => {
          expect(svg).toMatch(/viewBox="/);
        });
        it('has no fixed width/height px values', () => {
          expect(svg).not.toMatch(/width="\d+px"/);
          expect(svg).not.toMatch(/height="\d+px"/);
        });
        it('contains <title> for accessibility', () => {
          expect(svg).toMatch(/<title>/);
        });
        it('has role="img" for a11y', () => {
          expect(svg).toMatch(/role="img"/);
        });
        it('has aria-labelledby pointing to title', () => {
          expect(svg).toMatch(/aria-labelledby="/);
        });
      });
    }
  });

  // -- Quality bar: SVG filter effects --
  describe('quality bar — filters', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      describe(slug, () => {
        let svg;
        beforeAll(() => { svg = getComfortSvg(slug); });

        it('contains feTurbulence filter for watercolor texture', () => {
          expect(svg).toMatch(/feTurbulence/);
        });
        it('contains feDisplacementMap', () => {
          expect(svg).toMatch(/feDisplacementMap/);
        });
        it('contains paper grain noise filter (feTurbulence with type="fractalNoise")', () => {
          expect(svg).toMatch(/type="fractalNoise"/);
        });
      });
    }
  });

  // -- Quality bar: no hardcoded hex colors --
  describe('quality bar — brand tokens only', () => {
    // Collect all token hex values for allowlist
    const tokenHexValues = Object.values(colors)
      .filter(v => typeof v === 'string' && v.startsWith('#'))
      .map(v => v.toUpperCase());

    for (const slug of ['plush', 'medium', 'firm']) {
      it(`${slug}: all hex colors come from sharedTokens`, () => {
        const svg = getComfortSvg(slug);
        // Find all hex color references in the SVG
        const hexMatches = svg.match(/#[0-9A-Fa-f]{3,8}/g) || [];
        for (const hex of hexMatches) {
          // Skip SVG filter/gradient ID references (e.g., url(#filterName))
          // Only check actual color values (3, 4, 6, or 8 hex chars after #)
          if (hex.length === 4 || hex.length === 7 || hex.length === 5 || hex.length === 9) {
            expect(tokenHexValues).toContain(hex.toUpperCase());
          }
        }
      });
    }
  });

  // -- Quality bar: rich gradients --
  describe('quality bar — gradients', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      it(`${slug}: has at least one linearGradient or radialGradient`, () => {
        const svg = getComfortSvg(slug);
        expect(svg).toMatch(/(?:linearGradient|radialGradient)/);
      });
      it(`${slug}: gradient has 5+ stops`, () => {
        const svg = getComfortSvg(slug);
        const stopCount = (svg.match(/<stop\s/g) || []).length;
        expect(stopCount).toBeGreaterThanOrEqual(5);
      });
    }
  });

  // -- Quality bar: element count (15+) --
  describe('quality bar — element count', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      it(`${slug}: has 15+ SVG shape/path elements`, () => {
        const svg = getComfortSvg(slug);
        // Count shape elements: path, circle, ellipse, rect, polygon, polyline, line
        const shapeCount = (svg.match(/<(?:path|circle|ellipse|rect|polygon|polyline|line)\s/g) || []).length;
        expect(shapeCount).toBeGreaterThanOrEqual(15);
      });
    }
  });

  // -- Quality bar: atmospheric depth (3 layers) --
  describe('quality bar — atmospheric layers', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      it(`${slug}: has background, midground, and foreground groups`, () => {
        const svg = getComfortSvg(slug);
        expect(svg).toMatch(/id="background"/);
        expect(svg).toMatch(/id="midground"/);
        expect(svg).toMatch(/id="foreground"/);
      });
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run tests/comfortIllustrations.test.js`
Expected: FAIL — module not found (comfortIllustrations.js doesn't exist yet)

**Step 3: Commit failing tests**

```bash
git add tests/comfortIllustrations.test.js
git commit -m "test: add failing tests for comfort SVG illustrations (cf-2lvd)"
```

---

## Task 2: Create comfortIllustrations.js with SVG illustrations

**Files:**
- Create: `src/public/comfortIllustrations.js`
- Modify: `vitest.config.js` (add alias for `public/comfortIllustrations`)

**Step 1: Add vitest alias**

In `vitest.config.js`, add in the `resolve.alias` section alongside other public modules:
```js
'public/comfortIllustrations.js': path.resolve(__dirname, 'src/public/comfortIllustrations.js'),
'public/comfortIllustrations': path.resolve(__dirname, 'src/public/comfortIllustrations.js'),
```

**Step 2: Create comfortIllustrations.js**

Create `src/public/comfortIllustrations.js` exporting:
- `COMFORT_SLUGS` — `['plush', 'medium', 'firm']`
- `getComfortSvg(slug)` — returns SVG string or null

Each SVG must meet quality bar from CLAUDE.md:
1. `feTurbulence` + `feDisplacementMap` for watercolor texture
2. Paper grain overlay via `feNoise` (type="fractalNoise")
3. Organic hand-drawn paths with wobble
4. 15+ shape elements per scene
5. 5+ gradient stops for sky transitions
6. Three `<g>` layers: `id="background"`, `id="midground"`, `id="foreground"`
7. `<title>` element, `role="img"`, `aria-labelledby`
8. `viewBox` attribute, no fixed px width/height
9. ALL colors from `sharedTokens.colors` — zero hardcoded hex

Color palette per illustration:
- **Plush:** sandBase, sandLight, sunsetCoral, sunsetCoralLight, skyGradientTop, skyGradientBottom, offWhite
- **Medium:** sandBase, mountainBlue, mountainBlueLight, espressoLight, skyGradientTop, offWhite
- **Firm:** espresso, espressoLight, mountainBlue, mountainBlueDark, sandBase, offWhite

Scene composition:
- **Plush:** Soft clouds, flowing mountain silhouette, figure sinking into cloud-cushion, wildflowers, birds
- **Medium:** Balanced ridgeline, seated figure on even cushion, pine trees, balanced horizon
- **Firm:** Angular peaks, upright figure on flat structured surface, angular pines, strong ground plane

**Step 3: Run tests**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run tests/comfortIllustrations.test.js`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add src/public/comfortIllustrations.js vitest.config.js
git commit -m "feat: add hand-drawn SVG comfort illustrations (cf-2lvd)"
```

---

## Task 3: Write failing tests for SVG fallback in ComfortStoryCards

**Files:**
- Modify: `tests/comfortStoryCards.test.js`

**Step 1: Add new test group for SVG fallback**

Add to `tests/comfortStoryCards.test.js` after existing `renderComfortCard` tests:

```js
import { getComfortSvg } from '../src/public/comfortIllustrations.js';

describe('renderComfortCard — SVG fallback', () => {
  it('sets SVG html when illustration is missing and SVG container exists', () => {
    const $item = make$w();
    const comfort = { name: 'Plush', slug: 'plush', tagline: 'Sink in', description: 'Soft.' };
    renderComfortCard($item, comfort);
    const expectedSvg = getComfortSvg('plush');
    expect($item('#comfortIllustrationSvg').html).toBe(expectedSvg);
  });

  it('prefers CMS illustration over SVG when both available', () => {
    const $item = make$w();
    const comfort = {
      name: 'Plush', slug: 'plush', tagline: 'Sink in', description: 'Soft.',
      illustration: 'wix:image://v1/plush.jpg',
    };
    renderComfortCard($item, comfort);
    expect($item('#comfortIllustration').src).toBe('wix:image://v1/plush.jpg');
    // SVG container should NOT be set when CMS image is available
    expect($item('#comfortIllustrationSvg').html).toBeFalsy();
  });

  it('falls back to emoji icon when slug is unknown and no illustration', () => {
    const $item = make$w();
    const comfort = { name: 'Custom', slug: 'custom', tagline: 'T', description: 'D' };
    renderComfortCard($item, comfort);
    // No SVG for unknown slug, no CMS image — emoji fallback via COMFORT_ICONS not triggered
    // (COMFORT_ICONS only has plush/medium/firm, so SVG html stays empty)
    expect($item('#comfortIllustrationSvg').html).toBeFalsy();
  });

  it('handles missing #comfortIllustrationSvg element gracefully', () => {
    // $w that throws on #comfortIllustrationSvg access
    const elements = {};
    const $item = (sel) => {
      if (sel === '#comfortIllustrationSvg') throw new Error('Element not found');
      if (!elements[sel]) {
        elements[sel] = { text: '', src: '', alt: '', html: '' };
      }
      return elements[sel];
    };
    const comfort = { name: 'Plush', slug: 'plush', tagline: 'T', description: 'D' };
    expect(() => renderComfortCard($item, comfort)).not.toThrow();
  });

  it('sets SVG for all three comfort levels', () => {
    for (const slug of ['plush', 'medium', 'firm']) {
      const $item = make$w();
      renderComfortCard($item, { name: slug, slug, tagline: 'T', description: 'D' });
      expect($item('#comfortIllustrationSvg').html).toBe(getComfortSvg(slug));
    }
  });
});
```

**Step 2: Run tests to verify new tests fail**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run tests/comfortStoryCards.test.js`
Expected: New SVG fallback tests FAIL, existing tests still PASS

**Step 3: Commit**

```bash
git add tests/comfortStoryCards.test.js
git commit -m "test: add failing tests for SVG fallback in renderComfortCard (cf-2lvd)"
```

---

## Task 4: Wire SVG fallback into ComfortStoryCards.js

**Files:**
- Modify: `src/public/ComfortStoryCards.js`

**Step 1: Update renderComfortCard**

In `src/public/ComfortStoryCards.js`:

1. Add import at top:
   ```js
   import { getComfortSvg } from 'public/comfortIllustrations.js';
   ```

2. Update `renderComfortCard` illustration section (lines 32-37) to implement fallback chain:
   ```js
   try {
     if (comfort.illustration) {
       // Tier 1: CMS illustration URL
       $item('#comfortIllustration').src = comfort.illustration;
       $item('#comfortIllustration').alt = comfort.illustrationAlt || `${comfort.name} comfort level illustration`;
     } else {
       // Tier 2: Inline SVG from comfortIllustrations
       const svg = getComfortSvg(comfort.slug);
       if (svg) {
         try { $item('#comfortIllustrationSvg').html = svg; } catch (e) {}
       }
     }
   } catch (e) {}
   ```

**Step 2: Run all tests**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run tests/comfortStoryCards.test.js tests/comfortIllustrations.test.js`
Expected: ALL PASS

**Step 3: Run full test suite**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run`
Expected: ALL PASS (no regressions)

**Step 4: Commit**

```bash
git add src/public/ComfortStoryCards.js
git commit -m "feat: wire SVG illustration fallback into comfort cards (cf-2lvd)"
```

---

## Task 5: Visual verification via Puppeteer

**Files:**
- Create: `design-vision/comfort-illustration-preview.html` (temporary preview file)

**Step 1: Create preview HTML**

Create a simple HTML file that renders all three SVG illustrations side by side with labels, on a sand-colored background matching the site aesthetic.

**Step 2: Open in Puppeteer and screenshot**

Use `mcp__puppeteer__puppeteer_navigate` to open the HTML file, then `mcp__puppeteer__puppeteer_screenshot` to capture. Compare visually against `design.jpeg` for:
- Watercolor texture (not flat fills)
- Organic hand-drawn feel (not geometric perfection)
- Atmospheric depth (foreground/midground/background visible)
- Brand color palette (warm sand/espresso/coral/blue, not clinical)
- Detail elements (birds, trees, flowers etc.)

**Step 3: Iterate if needed**

If illustrations look flat or programmatic, revise SVG paths in `comfortIllustrations.js` and re-verify. Tests must still pass after each revision.

**Step 4: Commit preview**

```bash
git add design-vision/comfort-illustration-preview.html
git commit -m "docs: add comfort illustration preview for visual verification (cf-2lvd)"
```

---

## Task 6: Final verification and branch push

**Step 1: Run full test suite**

Run: `cd /Users/hal/gt/cfutons/crew/godfrey && npx vitest run`
Expected: ALL PASS

**Step 2: Push branch and open PR**

```bash
git push -u origin cf-2lvd-comfort-illustrations
gh pr create --title "feat: hand-drawn SVG comfort illustrations (cf-2lvd)" --body "..."
```

PR body should include:
- Summary of changes (new file, updated fallback chain)
- Screenshot of visual verification
- Test count delta
- Link to bead cf-2lvd
