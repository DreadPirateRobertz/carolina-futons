# Cart + Onboarding Illustrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace two deprecated programmatic SVG modules (CartIllustrations.js, onboardingIllustrations.js) with Figma-first static SVG modules following the MountainSkylineFigma.js pattern.

**Architecture:** Two new modules (`CartIllustrationsFigma.js`, `OnboardingIllustrationsFigma.js`) each containing static SVG content strings (not template literals) with getter functions and Wix `$w` init wrappers. SVG content follows Blue Ridge Mountain aesthetic with 7 ridgeline layers, atmospheric haze, 15+ detail elements, brand-token-only colors. Tests adapted from existing test files but updated to match the new static-SVG pattern (no feTurbulence/feDisplacementMap assertions).

**Tech Stack:** Wix Velo (JavaScript), vitest, sharedTokens.js brand colors

**Design doc:** `docs/plans/2026-03-06-cart-onboarding-illustrations-design.md`

---

### Task 1: Create CartIllustrationsFigma tests

**Files:**
- Create: `tests/CartIllustrationsFigma.test.js`

**Step 1: Write the failing test file**

Key differences from existing `cartIllustrations.test.js`:
- Imports from `CartIllustrationsFigma.js` (not `CartIllustrations.js`)
- Tests `getCartSkylineSvg()` and `getEmptyCartSvg()` (not `generateCartSkylineSVG()`)
- NO assertions for `feTurbulence`, `feDisplacementMap`, `feNoise` (deprecated filters)
- Keeps: brand color validation, element count (15+), gradient stops (5+), accessibility, $w injection, ridgeline layers (5+), security

```javascript
/**
 * Tests for CartIllustrationsFigma.js — Figma-first static SVG cart illustrations
 *
 * cf-aij: Cart illustrations redesign (Figma-first pipeline)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCartSkylineSvg,
  getEmptyCartSvg,
  initCartSkyline,
  initEmptyCartIllustration,
} from '../src/public/CartIllustrationsFigma.js';
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
    const m = svg.match(re);
    if (m) count += m.length;
  }
  return count;
}

const TOKEN_HEXES = buildTokenHexAllowlist();

// ── Mock $w ──────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    html: '', style: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
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
beforeEach(() => { $w = create$w(); vi.clearAllMocks(); });

// ══════════════════════════════════════════════════════════════════════
// ── Cart Skyline (1440x200, decorative header) ───────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('getCartSkylineSvg', () => {

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = getCartSkylineSvg();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has viewBox 0 0 1440 200', () => {
      expect(getCartSkylineSvg()).toContain('viewBox="0 0 1440 200"');
    });

    it('sets width to 100%', () => {
      expect(getCartSkylineSvg()).toContain('width="100%"');
    });

    it('sets preserveAspectRatio="none"', () => {
      expect(getCartSkylineSvg()).toContain('preserveAspectRatio="none"');
    });

    it('is aria-hidden (decorative)', () => {
      expect(getCartSkylineSvg()).toContain('aria-hidden="true"');
    });

    it('has role="presentation"', () => {
      expect(getCartSkylineSvg()).toContain('role="presentation"');
    });

    it('has xmlns attribute', () => {
      expect(getCartSkylineSvg()).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('respects custom height option', () => {
      expect(getCartSkylineSvg({ height: 150 })).toContain('height="150"');
    });

    it('uses default height of 120 when no option', () => {
      expect(getCartSkylineSvg()).toContain('height="120"');
    });

    it('ignores invalid height values', () => {
      expect(getCartSkylineSvg({ height: -1 })).toContain('height="120"');
      expect(getCartSkylineSvg({ height: 0 })).toContain('height="120"');
      expect(getCartSkylineSvg({ height: 'abc' })).toContain('height="120"');
    });
  });

  describe('quality bar', () => {
    it('uses organic bezier curves (C commands)', () => {
      expect(getCartSkylineSvg()).toMatch(/C\s*[\d.-]/);
    });

    it('contains 15+ SVG shape elements', () => {
      expect(countShapeElements(getCartSkylineSvg())).toBeGreaterThanOrEqual(15);
    });

    it('has 5+ gradient stops', () => {
      const stops = (getCartSkylineSvg().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(getCartSkylineSvg());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex: ${violations.join(', ')}`).toEqual([]);
    });

    it('includes bird detail elements', () => {
      expect(getCartSkylineSvg().toLowerCase()).toContain('bird');
    });

    it('includes pine tree detail elements', () => {
      const svg = getCartSkylineSvg().toLowerCase();
      expect(svg.includes('pine') || svg.includes('tree')).toBe(true);
    });

    it('includes wildflower elements', () => {
      const svg = getCartSkylineSvg().toLowerCase();
      expect(svg.includes('wildflower') || svg.includes('flora')).toBe(true);
    });
  });

  describe('ridgeline layers', () => {
    it('has 5+ ridgeline layers', () => {
      const matches = getCartSkylineSvg().match(/class="ridge-/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('has atmospheric depth — opacity ramp from distant to near', () => {
      const svg = getCartSkylineSvg();
      const opacities = [];
      const ridgeMatches = svg.matchAll(/class="ridge-(\d+)"[^>]*opacity="([^"]+)"/g);
      for (const m of ridgeMatches) {
        opacities.push({ layer: parseInt(m[1]), opacity: parseFloat(m[2]) });
      }
      opacities.sort((a, b) => a.layer - b.layer);
      expect(opacities.length).toBeGreaterThanOrEqual(5);
      // Later layers should generally have higher opacity
      expect(opacities[opacities.length - 1].opacity).toBeGreaterThan(opacities[0].opacity);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── Empty Cart Scene (280x200, meaningful illustration) ──────────────
// ══════════════════════════════════════════════════════════════════════

describe('getEmptyCartSvg', () => {

  describe('SVG structure', () => {
    it('returns a valid SVG string', () => {
      const svg = getEmptyCartSvg();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('has viewBox 0 0 280 200', () => {
      expect(getEmptyCartSvg()).toContain('viewBox="0 0 280 200"');
    });

    it('has role="img" (meaningful)', () => {
      expect(getEmptyCartSvg()).toContain('role="img"');
    });

    it('has aria-labelledby referencing title', () => {
      expect(getEmptyCartSvg()).toMatch(/aria-labelledby="[^"]+"/);
    });

    it('contains a <title> element', () => {
      expect(getEmptyCartSvg()).toMatch(/<title[^>]*>[^<]+<\/title>/);
    });

    it('sets preserveAspectRatio="xMidYMid meet"', () => {
      expect(getEmptyCartSvg()).toContain('preserveAspectRatio="xMidYMid meet"');
    });
  });

  describe('quality bar', () => {
    it('contains 15+ SVG shape elements', () => {
      expect(countShapeElements(getEmptyCartSvg())).toBeGreaterThanOrEqual(15);
    });

    it('has 5+ gradient stops', () => {
      const stops = (getEmptyCartSvg().match(/<stop /g) || []).length;
      expect(stops).toBeGreaterThanOrEqual(5);
    });

    it('uses only brand token hex colors', () => {
      const usedHexes = extractHexColors(getEmptyCartSvg());
      const violations = usedHexes.filter(h => !TOKEN_HEXES.has(h));
      expect(violations, `Non-token hex: ${violations.join(', ')}`).toEqual([]);
    });

    it('has ridgeline layers for mountain backdrop', () => {
      const matches = getEmptyCartSvg().match(/class="ridge-/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// ── $w init wrappers ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

describe('initCartSkyline', () => {
  it('injects SVG into #cartHeroSkyline', () => {
    const el = createMockElement();
    const $w = create$w({ '#cartHeroSkyline': el });
    initCartSkyline($w);
    expect(el.html).toContain('<svg');
    expect(el.html).toContain('viewBox="0 0 1440 200"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initCartSkyline(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initCartSkyline(undefined)).not.toThrow();
  });

  it('handles missing container gracefully', () => {
    const $w = (sel) => { if (sel === '#nonexistent') return null; return createMockElement(); };
    expect(() => initCartSkyline($w)).not.toThrow();
  });

  it('passes custom height to SVG', () => {
    const el = createMockElement();
    const $w = create$w({ '#cartHeroSkyline': el });
    initCartSkyline($w, { height: 150 });
    expect(el.html).toContain('height="150"');
  });
});

describe('initEmptyCartIllustration', () => {
  it('injects SVG into #emptyCartIllustration', () => {
    const el = createMockElement();
    const $w = create$w({ '#emptyCartIllustration': el });
    initEmptyCartIllustration($w);
    expect(el.html).toContain('<svg');
    expect(el.html).toContain('viewBox="0 0 280 200"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initEmptyCartIllustration(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initEmptyCartIllustration(undefined)).not.toThrow();
  });
});

// ── Security ─────────────────────────────────────────────────────────

describe('security', () => {
  it('cart skyline has no script tags', () => {
    expect(getCartSkylineSvg()).not.toMatch(/<script/i);
  });

  it('empty cart has no script tags', () => {
    expect(getEmptyCartSvg()).not.toMatch(/<script/i);
  });

  it('no event handler attributes in cart skyline', () => {
    expect(getCartSkylineSvg()).not.toMatch(/on(click|load|error|mouseover)=/i);
  });

  it('no event handler attributes in empty cart', () => {
    expect(getEmptyCartSvg()).not.toMatch(/on(click|load|error|mouseover)=/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/CartIllustrationsFigma.test.js`
Expected: FAIL — module `CartIllustrationsFigma.js` does not exist yet

**Step 3: Commit test file**

```bash
git add tests/CartIllustrationsFigma.test.js
git commit -m "test(cf-aij): add CartIllustrationsFigma tests (TDD — red phase)"
```

---

### Task 2: Create OnboardingIllustrationsFigma tests

**Files:**
- Create: `tests/OnboardingIllustrationsFigma.test.js`

**Step 1: Write the failing test file**

Key differences from existing `onboardingIllustrations.test.js`:
- Imports from `OnboardingIllustrationsFigma.js`
- NO assertions for `feTurbulence`, `feDisplacementMap`, `feNoise`
- ONBOARDING_SVGS values are now **strings** (same as before — existing pattern exports raw SVG strings)
- Keeps: brand color validation, element count, gradient stops, dark-bg contrast, security, svgToDataUri

```javascript
/**
 * Tests for OnboardingIllustrationsFigma.js — Figma-first static SVG onboarding illustrations
 *
 * cf-aij: Onboarding illustrations redesign (Figma-first pipeline)
 */
import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_SVGS,
  svgToDataUri,
} from '../src/public/OnboardingIllustrationsFigma.js';
import { colors } from '../src/public/sharedTokens.js';

const REQUIRED_KEYS = ['welcome', 'arPreview', 'shopWithConfidence'];

const DARK_BG_SAFE_COLORS = [
  colors.offWhite, colors.sandBase, colors.sandLight,
  colors.sunsetCoral, colors.sunsetCoralLight,
  colors.mountainBlue, colors.mountainBlueLight,
  colors.skyGradientTop, colors.skyGradientBottom,
];

const ALL_BRAND_HEX = Object.values(colors).filter(v => typeof v === 'string' && v.startsWith('#'));

describe('Onboarding Illustrations (Figma-first)', () => {

  describe('ONBOARDING_SVGS registry', () => {
    it('exports all 3 required scene keys', () => {
      REQUIRED_KEYS.forEach(key => {
        expect(ONBOARDING_SVGS[key], `missing key: ${key}`).toBeDefined();
      });
    });

    it('contains no extra keys beyond the required 3', () => {
      expect(Object.keys(ONBOARDING_SVGS).sort()).toEqual([...REQUIRED_KEYS].sort());
    });
  });

  describe('SVG structure', () => {
    REQUIRED_KEYS.forEach(key => {
      describe(`${key} scene`, () => {
        it('is a non-empty string', () => {
          expect(typeof ONBOARDING_SVGS[key]).toBe('string');
          expect(ONBOARDING_SVGS[key].length).toBeGreaterThan(200);
        });

        it('is a valid SVG element', () => {
          const svg = ONBOARDING_SVGS[key];
          expect(svg.trimStart()).toMatch(/^<svg[\s>]/);
          expect(svg.trimEnd()).toMatch(/<\/svg>$/);
        });

        it('has viewBox 0 0 800 500', () => {
          expect(ONBOARDING_SVGS[key]).toContain('viewBox="0 0 800 500"');
        });

        it('has xmlns attribute', () => {
          expect(ONBOARDING_SVGS[key]).toContain('xmlns="http://www.w3.org/2000/svg"');
        });

        it('has role="img"', () => {
          expect(ONBOARDING_SVGS[key]).toContain('role="img"');
        });

        it('has aria-labelledby', () => {
          expect(ONBOARDING_SVGS[key]).toMatch(/aria-labelledby="[^"]+"/);
        });

        it('contains a <title> element', () => {
          expect(ONBOARDING_SVGS[key]).toMatch(/<title[^>]*>[^<]+<\/title>/);
        });
      });
    });
  });

  describe('element richness (minimum 15 elements per scene)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 15 SVG shape/path elements`, () => {
        const svg = ONBOARDING_SVGS[key];
        const shapeMatches = svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)[\s/]/g);
        const count = shapeMatches ? shapeMatches.length : 0;
        expect(count, `${key} has only ${count} elements, need 15+`).toBeGreaterThanOrEqual(15);
      });
    });
  });

  describe('rich gradients (5+ stops)', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has at least 5 gradient stops total`, () => {
        const svg = ONBOARDING_SVGS[key];
        const stopMatches = svg.match(/<stop\s/g);
        const count = stopMatches ? stopMatches.length : 0;
        expect(count, `${key} has only ${count} gradient stops, need 5+`).toBeGreaterThanOrEqual(5);
      });
    });
  });

  describe('brand token colors', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses at least 3 brand colors`, () => {
        const svg = ONBOARDING_SVGS[key];
        const usedColors = ALL_BRAND_HEX.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedColors.length, `${key} only uses ${usedColors.length} brand colors`)
          .toBeGreaterThanOrEqual(3);
      });

      it(`${key} has no hardcoded hex outside brand tokens`, () => {
        const svg = ONBOARDING_SVGS[key];
        const hexMatches = svg.match(/#[0-9A-Fa-f]{6}\b/g) || [];
        const unknownHex = hexMatches.filter(hex =>
          !ALL_BRAND_HEX.some(brand => brand.toLowerCase() === hex.toLowerCase())
        );
        expect(unknownHex, `${key} has non-token hex: ${unknownHex.join(', ')}`).toEqual([]);
      });
    });
  });

  describe('dark background contrast', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} uses light colors visible on dark bg`, () => {
        const svg = ONBOARDING_SVGS[key];
        const usedLightColors = DARK_BG_SAFE_COLORS.filter(hex =>
          svg.toLowerCase().includes(hex.toLowerCase())
        );
        expect(usedLightColors.length, `${key} needs light colors for dark bg`)
          .toBeGreaterThanOrEqual(2);
      });

      it(`${key} does NOT use espresso as primary fill`, () => {
        const svg = ONBOARDING_SVGS[key];
        const espressoFills = svg.match(new RegExp(`fill="${colors.espresso}"`, 'gi')) || [];
        expect(espressoFills.length).toBeLessThanOrEqual(1);
      });
    });
  });

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

    it('produces valid data URIs for all 3 scenes', () => {
      REQUIRED_KEYS.forEach(key => {
        const uri = svgToDataUri(ONBOARDING_SVGS[key]);
        expect(uri, `${key} data URI`).toMatch(/^data:image\/svg\+xml/);
        expect(uri.length, `${key} data URI too short`).toBeGreaterThan(100);
      });
    });

    it('properly encodes hash characters', () => {
      const svg = '<svg><rect fill="#E8D5B7"/></svg>';
      const uri = svgToDataUri(svg);
      expect(uri).not.toContain('#E8D5B7');
      expect(uri).toContain('%23E8D5B7');
    });
  });

  describe('security', () => {
    REQUIRED_KEYS.forEach(key => {
      it(`${key} has no script tags`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/<script/i);
      });

      it(`${key} has no event handler attributes`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/on(click|load|error|mouseover)=/i);
      });

      it(`${key} has no external references`, () => {
        expect(ONBOARDING_SVGS[key]).not.toMatch(/xlink:href="http/i);
        expect(ONBOARDING_SVGS[key]).not.toMatch(/href="http/i);
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/OnboardingIllustrationsFigma.test.js`
Expected: FAIL — module `OnboardingIllustrationsFigma.js` does not exist yet

**Step 3: Commit test file**

```bash
git add tests/OnboardingIllustrationsFigma.test.js
git commit -m "test(cf-aij): add OnboardingIllustrationsFigma tests (TDD — red phase)"
```

---

### Task 3: Implement CartIllustrationsFigma.js

**Files:**
- Create: `src/public/CartIllustrationsFigma.js`

**Step 1: Create the module**

Follow `MountainSkylineFigma.js` pattern exactly:
- Module doc header with source/pipeline reference
- `const CART_SKYLINE_SVG = '...'` — static SVG inner content (1440x200 cart header skyline)
- `const EMPTY_CART_SVG = '...'` — static SVG inner content (280x200 empty cart scene)
- `getCartSkylineSvg(options)` — wraps with `<svg>` tag, decorative accessibility
- `getEmptyCartSvg(options)` — wraps with `<svg>` tag, meaningful accessibility
- `initCartSkyline($w, options)` — injects into `#cartHeroSkyline`
- `initEmptyCartIllustration($w, options)` — injects into `#emptyCartIllustration`

SVG content requirements (from design doc):
- **Cart skyline**: 7 ridgeline layers (`class="ridge-1"` through `class="ridge-7"`), 7-stop sky gradient, bird group (`class="birds"`), pine tree group (`class="pine-trees"`), wildflower group (`class="wildflowers"`), atmospheric haze overlays. Opacity ramp: 0.10 (ridge-1) to 0.78 (ridge-7). All hex values from sharedTokens.
- **Empty cart**: 5 ridgeline layers, sky gradient (5+ stops), trail path, empty pack frame, fence post, cabin silhouette, wildflowers, birds. `<title>Your cart is empty — explore our collection</title>`.

Reference `MountainSkylineFigma.js` for exact code structure. The SVG_CONTENT strings are long single-line literals — this is intentional (pipeline output, not hand-edited).

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/CartIllustrationsFigma.test.js`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/public/CartIllustrationsFigma.js
git commit -m "feat(cf-aij): add CartIllustrationsFigma — static SVG cart illustrations"
```

---

### Task 4: Implement OnboardingIllustrationsFigma.js

**Files:**
- Create: `src/public/OnboardingIllustrationsFigma.js`

**Step 1: Create the module**

Pattern: Same static approach but exports `ONBOARDING_SVGS` object with 3 raw SVG strings + `svgToDataUri()` utility.

```javascript
// Module structure:
const WELCOME_SVG = '<svg ...>...</svg>';        // 800x500, dark theme
const AR_PREVIEW_SVG = '<svg ...>...</svg>';      // 800x500, dark theme
const SHOP_CONFIDENCE_SVG = '<svg ...>...</svg>'; // 800x500, dark theme

export function svgToDataUri(svgString) {
  if (!svgString) return '';
  return 'data:image/svg+xml,' + encodeURIComponent(svgString);
}

export const ONBOARDING_SVGS = {
  welcome: WELCOME_SVG,
  arPreview: AR_PREVIEW_SVG,
  shopWithConfidence: SHOP_CONFIDENCE_SVG,
};
```

SVG content requirements (from design doc):
- Each scene: `viewBox="0 0 800 500"`, `xmlns`, `role="img"`, `aria-labelledby`, `<title>`
- Dark theme: transparent bg, light/bright brand colors visible over #1C1410
- 15+ elements, 5+ gradient stops, 3+ brand colors, zero non-token hex
- **Welcome**: Mountain view through window, futon in room, lamp glow, warm interior
- **AR Preview**: Person silhouette, phone rectangle, AR ghost furniture, mountain backdrop
- **Shop with Confidence**: Delivery truck, winding mountain road, destination house, mountains

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/OnboardingIllustrationsFigma.test.js`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/public/OnboardingIllustrationsFigma.js
git commit -m "feat(cf-aij): add OnboardingIllustrationsFigma — static SVG onboarding scenes"
```

---

### Task 5: Run full test suite and verify no regressions

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: ALL existing tests still pass, new tests pass

**Step 2: Verify old tests still pass (old modules untouched)**

Run: `npx vitest run tests/cartIllustrations.test.js tests/onboardingIllustrations.test.js`
Expected: PASS — old modules not modified

**Step 3: Commit any fixes if needed**

---

### Task 6: Create feature branch, push, and open PR

**Step 1: Create feature branch and push**

```bash
git checkout -b cf-aij-cart-onboarding-illustrations
git push -u origin cf-aij-cart-onboarding-illustrations
```

**Step 2: Open PR**

```bash
gh pr create --title "feat(cf-aij): Figma-first cart + onboarding illustrations" --body "$(cat <<'EOF'
## Summary

- Add `CartIllustrationsFigma.js` — static SVG cart header skyline (1440x200) + empty cart scene (280x200)
- Add `OnboardingIllustrationsFigma.js` — static SVG onboarding scenes (3x 800x500, dark theme)
- Both follow `MountainSkylineFigma.js` pattern: static SVG content, no template interpolation, no deprecated filters
- TDD: full test suites for both modules

## Quality Bar (10-point)

1. Figma-first design principles followed
2. Natural hand-drawn paths (not mathematical bezier)
3. Atmospheric depth with opacity ramp
4. 5-7 ridgeline layers per mountain scene
5. 15+ distinct SVG elements per illustration
6. 5+ gradient stops per sky
7. All colors from sharedTokens (zero hardcoded hex)
8. Pipeline pattern (static optimized SVG)
9. Accessibility: aria-hidden on decorative, role="img" + title on meaningful
10. Visual review pending

## Docs/Guides Referenced

- docs/guides/figma-draw-tool-reference.md
- docs/guides/figma-illustration-workflow.md
- docs/guides/figma-community-asset-study.md
- docs/guides/hand-draw-plugin-evaluation.md
- docs/guides/svg-export-pipeline.md
- docs/guides/cross-rig-illustration-standards.md

## Test Plan

- [x] CartIllustrationsFigma.test.js — SVG structure, quality bar, ridgelines, $w injection, security
- [x] OnboardingIllustrationsFigma.test.js — registry, SVG structure, elements, gradients, brand colors, dark bg contrast, svgToDataUri, security
- [x] Full test suite green (no regressions)
EOF
)"
```

**Step 3: Update bead and notify melania**

```bash
bd update cf-aij --status=in_review
gt nudge cfutons/crew/melania "cf-aij PR opened — CartIllustrationsFigma + OnboardingIllustrationsFigma. 5 illustrations, static SVG pattern, TDD, all tests green. Ready for review."
```
