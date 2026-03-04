# Mountain Skyline SVG Border — cf-989f Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a programmatic SVG mountain silhouette component for page headers — the #1 missing brand element from design.jpeg.

**Architecture:** Pure JS module exporting SVG string generators + Wix Velo `$w` init wrappers. No external deps. SVG uses viewBox for responsive scaling, `<linearGradient>` from sharedTokens, 3 layered mountain `<path>` elements. Two modes: standard (sky gradient background for light pages) and transparent (no background for dark page sections).

**Tech Stack:** Vitest, Wix Velo $w model, sharedTokens.js color tokens

---

### Task 1: Branch Setup

**Step 1: Create feature branch**

```bash
cd /Users/hal/gt/cfutons
git checkout main && git pull
git checkout -b cf-989f-mountain-skyline
```

**Step 2: Verify clean state**

Run: `git status`
Expected: On branch `cf-989f-mountain-skyline`, clean working tree

---

### Task 2: Write Failing Tests — SVG Generator Core

**Files:**
- Create: `tests/mountainSkyline.test.js`

**Step 1: Write the failing tests for `generateMountainSkylineSVG`**

```js
/**
 * Tests for MountainSkyline.js — programmatic SVG mountain border
 *
 * Covers: SVG generation, gradient variants, transparent mode,
 * accessibility, responsive options, defensive defaults.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMountainSkylineSVG,
  initMountainSkyline,
  initMountainSkylineTransparent,
} from '../src/public/MountainSkyline.js';
import { colors } from '../src/public/sharedTokens.js';

// ── generateMountainSkylineSVG — basic structure ────────────────────

describe('generateMountainSkylineSVG', () => {
  describe('basic SVG structure', () => {
    it('returns a string containing valid SVG open and close tags', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });

    it('includes xmlns attribute for valid SVG', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('uses viewBox 0 0 1200 200 for responsive scaling', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('viewBox="0 0 1200 200"');
    });

    it('sets preserveAspectRatio to none for full-width stretch', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('preserveAspectRatio="none"');
    });

    it('sets width to 100% for container fill', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('width="100%"');
    });
  });

  // ── accessibility ───────────────────────────────────────────────

  describe('accessibility', () => {
    it('has aria-hidden="true" since purely decorative', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('aria-hidden="true"');
    });

    it('has role="img"', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('role="img"');
    });
  });

  // ── gradient ────────────────────────────────────────────────────

  describe('gradient', () => {
    it('contains a linearGradient element', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('<linearGradient');
    });

    it('sunrise variant uses skyGradientTop and skyGradientBottom tokens', () => {
      const svg = generateMountainSkylineSVG({ variant: 'sunrise' });
      expect(svg).toContain(colors.skyGradientTop);
      expect(svg).toContain(colors.skyGradientBottom);
    });

    it('defaults to sunrise variant', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain(colors.skyGradientTop);
      expect(svg).toContain(colors.skyGradientBottom);
    });

    it('sunset variant uses skyGradientBottom and sunsetCoral tokens', () => {
      const svg = generateMountainSkylineSVG({ variant: 'sunset' });
      expect(svg).toContain(colors.skyGradientBottom);
      expect(svg).toContain(colors.sunsetCoral);
    });
  });

  // ── mountain layers ─────────────────────────────────────────────

  describe('mountain layers', () => {
    it('contains exactly 3 path elements for mountain ridgelines', () => {
      const svg = generateMountainSkylineSVG();
      const pathCount = (svg.match(/<path /g) || []).length;
      expect(pathCount).toBe(3);
    });

    it('standard mode uses espresso-based fills', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain(colors.espresso);
    });
  });

  // ── standard vs transparent mode ────────────────────────────────

  describe('standard mode (default)', () => {
    it('includes a rect element for sky gradient background', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('<rect');
    });

    it('rect fills with the gradient', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('url(#skyGradient)');
    });
  });

  describe('transparent mode', () => {
    it('omits rect background when transparent is true', () => {
      const svg = generateMountainSkylineSVG({ transparent: true });
      expect(svg).not.toContain('<rect');
    });

    it('uses lighter fills for dark background contrast', () => {
      const svg = generateMountainSkylineSVG({ transparent: true });
      expect(svg).toContain(colors.mountainBlueLight);
      expect(svg).toContain(colors.sandBase);
      expect(svg).toContain(colors.espressoLight);
    });

    it('still has aria-hidden and role for accessibility', () => {
      const svg = generateMountainSkylineSVG({ transparent: true });
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('role="img"');
    });

    it('still contains gradient definition', () => {
      const svg = generateMountainSkylineSVG({ transparent: true });
      expect(svg).toContain('<linearGradient');
    });
  });

  // ── custom options ──────────────────────────────────────────────

  describe('custom options', () => {
    it('respects custom height', () => {
      const svg = generateMountainSkylineSVG({ height: 80 });
      expect(svg).toContain('height="80"');
    });

    it('uses default height of 120 when not specified', () => {
      const svg = generateMountainSkylineSVG();
      expect(svg).toContain('height="120"');
    });
  });

  // ── defensive defaults ──────────────────────────────────────────

  describe('defensive defaults', () => {
    it('does not throw with empty options', () => {
      expect(() => generateMountainSkylineSVG({})).not.toThrow();
    });

    it('does not throw with no arguments', () => {
      expect(() => generateMountainSkylineSVG()).not.toThrow();
    });

    it('does not throw with null options', () => {
      expect(() => generateMountainSkylineSVG(null)).not.toThrow();
    });

    it('does not throw with invalid variant string', () => {
      expect(() => generateMountainSkylineSVG({ variant: 'invalid' })).not.toThrow();
    });

    it('falls back to sunrise for unknown variant', () => {
      const svg = generateMountainSkylineSVG({ variant: 'unknown' });
      expect(svg).toContain(colors.skyGradientTop);
    });

    it('does not throw with negative height', () => {
      expect(() => generateMountainSkylineSVG({ height: -10 })).not.toThrow();
    });

    it('clamps negative height to default 120', () => {
      const svg = generateMountainSkylineSVG({ height: -10 });
      expect(svg).toContain('height="120"');
    });

    it('clamps zero height to default 120', () => {
      const svg = generateMountainSkylineSVG({ height: 0 });
      expect(svg).toContain('height="120"');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/mountainSkyline.test.js`
Expected: FAIL — cannot import `generateMountainSkylineSVG` (module doesn't exist)

**Step 3: Commit failing tests**

```bash
git add tests/mountainSkyline.test.js
git commit -m "test(cf-989f): add failing tests for MountainSkyline SVG generator"
```

---

### Task 3: Implement `generateMountainSkylineSVG`

**Files:**
- Create: `src/public/MountainSkyline.js`

**Step 1: Write the implementation**

```js
/**
 * MountainSkyline.js — Programmatic SVG mountain border component
 *
 * Generates a decorative mountain silhouette SVG for page headers.
 * The signature brand element from design.jpeg — layered mountain ridgelines
 * with sky gradient, using design tokens for all colors.
 *
 * Two modes:
 * - Standard: sky gradient background (for light page headers)
 * - Transparent: no background fill (for dark section dividers)
 *
 * @module MountainSkyline
 */
import { colors } from 'public/sharedTokens.js';

/**
 * Mountain ridgeline path data — 3 layers from back (high/light) to front (low/dark).
 * Coordinates are in viewBox space (1200 x 200).
 */
const MOUNTAIN_PATHS = {
  back: 'M0 200 L0 120 Q100 60 200 100 Q300 50 400 80 Q500 30 600 70 Q700 40 800 90 Q900 50 1000 75 Q1100 45 1200 95 L1200 200 Z',
  mid: 'M0 200 L0 140 Q150 80 300 120 Q400 70 500 110 Q600 60 700 100 Q800 75 900 115 Q1050 65 1200 110 L1200 200 Z',
  front: 'M0 200 L0 155 Q100 120 250 145 Q350 105 500 135 Q600 100 750 130 Q850 110 950 140 Q1100 100 1200 135 L1200 200 Z',
};

/** Standard fills: espresso at different opacities for depth */
const STANDARD_FILLS = {
  back: { color: colors.espresso, opacity: 0.3 },
  mid: { color: colors.espresso, opacity: 0.5 },
  front: { color: colors.espresso, opacity: 1.0 },
};

/** Transparent fills: lighter token colors for dark background contrast */
const TRANSPARENT_FILLS = {
  back: { color: colors.mountainBlueLight, opacity: 0.6 },
  mid: { color: colors.sandBase, opacity: 0.5 },
  front: { color: colors.espressoLight, opacity: 0.9 },
};

/** Gradient color pairs per variant */
const GRADIENT_VARIANTS = {
  sunrise: { top: colors.skyGradientTop, bottom: colors.skyGradientBottom },
  sunset: { top: colors.skyGradientBottom, bottom: colors.sunsetCoral },
};

/**
 * Generate a mountain skyline SVG string.
 * @param {Object} [options]
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Color variant
 * @param {boolean} [options.transparent=false] - Omit background for dark pages
 * @param {number} [options.height=120] - Height in pixels
 * @returns {string} SVG markup string
 */
export function generateMountainSkylineSVG(options) {
  const opts = options || {};
  const variant = GRADIENT_VARIANTS[opts.variant] ? opts.variant : 'sunrise';
  const transparent = Boolean(opts.transparent);
  const height = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : 120;

  const grad = GRADIENT_VARIANTS[variant];
  const fills = transparent ? TRANSPARENT_FILLS : STANDARD_FILLS;

  const bgRect = transparent
    ? ''
    : `<rect width="1200" height="200" fill="url(#skyGradient)" />`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" preserveAspectRatio="none" width="100%" height="${height}" role="img" aria-hidden="true">`,
    '<defs>',
    '<linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">',
    `<stop offset="0%" stop-color="${grad.top}" />`,
    `<stop offset="100%" stop-color="${grad.bottom}" />`,
    '</linearGradient>',
    '</defs>',
    bgRect,
    `<path d="${MOUNTAIN_PATHS.back}" fill="${fills.back.color}" opacity="${fills.back.opacity}" />`,
    `<path d="${MOUNTAIN_PATHS.mid}" fill="${fills.mid.color}" opacity="${fills.mid.opacity}" />`,
    `<path d="${MOUNTAIN_PATHS.front}" fill="${fills.front.color}" opacity="${fills.front.opacity}" />`,
    '</svg>',
  ].join('');
}

/**
 * Initialize mountain skyline on a Wix HtmlComponent (light page headers).
 * @param {Function} $w - Wix $w selector
 * @param {Object} [options]
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Color variant
 * @param {number} [options.height=120] - Height in pixels
 * @param {string} [options.elementId='#mountainSkyline'] - HtmlComponent selector
 */
export function initMountainSkyline($w, options) {
  try {
    const opts = options || {};
    const elementId = opts.elementId || '#mountainSkyline';
    const svg = generateMountainSkylineSVG({ variant: opts.variant, height: opts.height });
    const el = $w(elementId);
    if (el && typeof el.postMessage === 'function') {
      el.postMessage(svg);
    }
  } catch (e) {
    // Defensive: element may not exist on all pages
  }
}

/**
 * Initialize mountain skyline on a Wix HtmlComponent (dark bg section dividers).
 * @param {Function} $w - Wix $w selector
 * @param {Object} [options]
 * @param {'sunrise'|'sunset'} [options.variant='sunrise'] - Color variant
 * @param {number} [options.height=120] - Height in pixels
 * @param {string} [options.elementId='#mountainSkyline'] - HtmlComponent selector
 */
export function initMountainSkylineTransparent($w, options) {
  try {
    const opts = options || {};
    const elementId = opts.elementId || '#mountainSkyline';
    const svg = generateMountainSkylineSVG({ variant: opts.variant, height: opts.height, transparent: true });
    const el = $w(elementId);
    if (el && typeof el.postMessage === 'function') {
      el.postMessage(svg);
    }
  } catch (e) {
    // Defensive: element may not exist on all pages
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/mountainSkyline.test.js`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/public/MountainSkyline.js
git commit -m "feat(cf-989f): implement MountainSkyline SVG generator with sunrise/sunset/transparent variants"
```

---

### Task 4: Write Failing Tests — Init Wrappers

**Files:**
- Modify: `tests/mountainSkyline.test.js`

**Step 1: Add tests for `initMountainSkyline` and `initMountainSkylineTransparent`**

Append to `tests/mountainSkyline.test.js`:

```js
// ── initMountainSkyline ─────────────────────────────────────────

describe('initMountainSkyline', () => {
  let mock$w;
  let mockElement;

  beforeEach(() => {
    mockElement = { postMessage: vi.fn() };
    mock$w = vi.fn(() => mockElement);
  });

  it('calls $w with default element ID #mountainSkyline', () => {
    initMountainSkyline(mock$w);
    expect(mock$w).toHaveBeenCalledWith('#mountainSkyline');
  });

  it('calls $w with custom element ID when provided', () => {
    initMountainSkyline(mock$w, { elementId: '#heroSkyline' });
    expect(mock$w).toHaveBeenCalledWith('#heroSkyline');
  });

  it('posts SVG string to element via postMessage', () => {
    initMountainSkyline(mock$w);
    expect(mockElement.postMessage).toHaveBeenCalledTimes(1);
    const svgArg = mockElement.postMessage.mock.calls[0][0];
    expect(svgArg).toContain('<svg');
    expect(svgArg).toContain('</svg>');
  });

  it('posts standard SVG (with rect background)', () => {
    initMountainSkyline(mock$w);
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).toContain('<rect');
  });

  it('passes variant option to generator', () => {
    initMountainSkyline(mock$w, { variant: 'sunset' });
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).toContain(colors.sunsetCoral);
  });

  it('passes height option to generator', () => {
    initMountainSkyline(mock$w, { height: 80 });
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).toContain('height="80"');
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkyline(null)).not.toThrow();
  });

  it('does not throw when $w is undefined', () => {
    expect(() => initMountainSkyline(undefined)).not.toThrow();
  });

  it('does not throw when element has no postMessage', () => {
    const badEl = {};
    const bad$w = vi.fn(() => badEl);
    expect(() => initMountainSkyline(bad$w)).not.toThrow();
  });

  it('does not throw when $w throws', () => {
    const throwing$w = vi.fn(() => { throw new Error('element not found'); });
    expect(() => initMountainSkyline(throwing$w)).not.toThrow();
  });

  it('does not throw with null options', () => {
    expect(() => initMountainSkyline(mock$w, null)).not.toThrow();
  });
});

// ── initMountainSkylineTransparent ──────────────────────────────

describe('initMountainSkylineTransparent', () => {
  let mock$w;
  let mockElement;

  beforeEach(() => {
    mockElement = { postMessage: vi.fn() };
    mock$w = vi.fn(() => mockElement);
  });

  it('calls $w with default element ID #mountainSkyline', () => {
    initMountainSkylineTransparent(mock$w);
    expect(mock$w).toHaveBeenCalledWith('#mountainSkyline');
  });

  it('posts transparent SVG (no rect background)', () => {
    initMountainSkylineTransparent(mock$w);
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).not.toContain('<rect');
  });

  it('uses lighter fills for dark background contrast', () => {
    initMountainSkylineTransparent(mock$w);
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).toContain(colors.mountainBlueLight);
    expect(svg).toContain(colors.espressoLight);
  });

  it('passes variant option through', () => {
    initMountainSkylineTransparent(mock$w, { variant: 'sunset' });
    const svg = mockElement.postMessage.mock.calls[0][0];
    expect(svg).toContain(colors.sunsetCoral);
  });

  it('does not throw when $w is null', () => {
    expect(() => initMountainSkylineTransparent(null)).not.toThrow();
  });

  it('does not throw when $w throws', () => {
    const throwing$w = vi.fn(() => { throw new Error('nope'); });
    expect(() => initMountainSkylineTransparent(throwing$w)).not.toThrow();
  });
});
```

**Step 2: Run to verify new tests pass (implementation already exists)**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/mountainSkyline.test.js`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/mountainSkyline.test.js
git commit -m "test(cf-989f): add init wrapper tests for MountainSkyline — $w integration, defensive cases"
```

---

### Task 5: Run Full Suite, Push, Open PR

**Step 1: Run full test suite**

Run: `cd /Users/hal/gt/cfutons && npm test`
Expected: All tests pass, including new mountainSkyline tests

**Step 2: Push branch**

```bash
git push -u origin cf-989f-mountain-skyline
```

**Step 3: Open PR**

```bash
gh pr create --title "cf-989f: Mountain skyline SVG border — signature brand element" --body "$(cat <<'EOF'
## Summary
- Programmatic SVG mountain silhouette for page headers (the #1 missing brand element from design.jpeg)
- `generateMountainSkylineSVG(options)` core generator with sunrise/sunset variants
- `initMountainSkyline($w)` for light page headers (sky gradient background)
- `initMountainSkylineTransparent($w)` for dark section dividers (no background fill)
- All colors from sharedTokens.js — no hardcoded values
- WCAG AA: `aria-hidden="true"`, `role="img"` (decorative)
- Responsive via viewBox scaling, preserveAspectRatio="none"

## Test plan
- [ ] 30+ tests covering SVG structure, gradients, mountain layers, transparent mode, a11y, defensive defaults, init wrappers
- [ ] Full test suite passes (npm test)
- [ ] Verify SVG renders correctly in Wix HtmlComponent

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 4: Notify melania**

```bash
gt nudge cfutons/crew/melania "cf-989f PR opened — mountain skyline SVG with standard + transparent variants, 30+ tests"
```
