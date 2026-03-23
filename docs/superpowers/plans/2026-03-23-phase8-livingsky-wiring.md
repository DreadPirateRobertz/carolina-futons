# Phase 8 — LivingSkyState Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire all remaining illustration modules to `LivingSkyState` so site-wide illustrations respond dynamically to time-of-day sky changes driven by `living-sky.js`.

**Architecture:** Each illustration module gets a local `applyLivingSkyState(svg, state)` helper (following the established `contactIllustrations.js` pattern — intentionally unexported, local to the module) and an `init*` function that sets the initial SVG and subscribes to `#livingSkyFrame.onMessage`. The `masterPage` already broadcasts `LivingSkyState` via `postLivingSkyState()` in `living-sky-wix.js` — no changes needed there. Each task is independent and can be executed in parallel.

**Tech Stack:** Wix Velo (JS), `living-sky.js` (state source), `illustrationShared.js` (mountain path helpers), `sharedTokens.js` (brand colors), Vitest (tests). Test CWD: `cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run`.

---

## Reference Implementation

**Pattern to follow:** `contactIllustrations.js:113–175` — `applyLivingSkyState(svg, state)` + `initContactShowroomScene($w, options)`.

Key rules from the established pattern:
- `applyLivingSkyState` is **unexported** (local to the module, keeps API clean)
- Only wrap the `$w('#livingSkyFrame')` selector in try/catch; let `onMessage` callback errors surface
- Validate `state.skyColors[0]` with `/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/` before using as SVG fill (XSS guard from postMessage)
- Gracefully handle `state = null` / missing state fields with `||` defaults
- The init function is fully wrapped in try/catch with a `console.warn` on failure
- `LivingSkyState` shape: `{ skyColors: string[], ridgeColors: { r1, r2, r3, r4, tree }, starOpacity: number, season: string, ... }`

```js
const SAFE_HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

function applyLivingSkyState(svg, state) {
  const isNight = Number(state.starOpacity) > 0;
  const skyColor = state.skyColors && state.skyColors[0];
  const safeGradient = typeof skyColor === 'string' && SAFE_HEX_RE.test(skyColor)
    ? skyColor : null;
  let overlay = '';
  if (safeGradient) {
    const opacity = isNight ? 0.55 : 0.25;
    overlay += `<rect width="280" height="200" fill="${safeGradient}" opacity="${opacity}" id="sky-overlay"/>`;
  }
  if (isNight) {
    overlay += NIGHT_OVERLAY;   // module-specific star positions + moon
  }
  if (!overlay) return svg;
  return svg.replace('</svg>', overlay + '</svg>');
}
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/public/emptyStateIllustrations.js` | Modify | Add `initEmptyStateScene($w, key, containerId)` + local sky helper |
| `src/public/comfortIllustrations.js` | Modify | Add `initComfortIllustration($w, slug, containerId)` + local sky helper |
| `src/public/aboutIllustrations.js` | Modify | Extend existing `initAboutIllustrations($w)` with sky subscription |
| `src/public/onboardingIllustrations.js` | Modify | Add `initOnboardingScene($w, key, containerId)` + local sky helper |
| `tests/emptyStateIllustrations.test.js` | Modify | Add LivingSkyState wiring tests |
| `tests/comfortIllustrations.test.js` | Modify | Add LivingSkyState wiring tests |
| `tests/aboutIllustrations.test.js` | Modify or Create | Add LivingSkyState wiring tests |
| `tests/onboardingIllustrations.test.js` | Modify | Add LivingSkyState wiring tests |

---

## Task 1: Wire emptyStateIllustrations.js

**Context:** `emptyStateIllustrations.js` exports `ILLUSTRATION_SVGS` (a map of 8 SVG strings keyed by empty-state type: `cart`, `search`, `wishlist`, `reviews`, `history`, `products`, `orders`, `default`) and `svgToDataUri`. It has **no init function**. Page-level Velo code sets `container.html = svgToDataUri(ILLUSTRATION_SVGS[key])`. Phase 8 adds an `initEmptyStateScene` that sets initial html AND subscribes to sky updates.

**Files:**
- Modify: `refinery/rig/src/public/emptyStateIllustrations.js`
- Modify: `refinery/rig/tests/emptyStateIllustrations.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/emptyStateIllustrations.test.js`:

```js
import { initEmptyStateScene, ILLUSTRATION_SVGS } from '../src/public/emptyStateIllustrations';

// Minimal $w mock for LivingSkyState tests
function makeWix(hasFrame = true) {
  const handlers = {};
  const frame = hasFrame ? {
    onMessage: (fn) => { handlers.livingSky = fn; },
    postMessage: (state) => handlers.livingSky && handlers.livingSky({ data: state }),
  } : null;
  const containers = {};
  return {
    $w: (id) => {
      if (id === '#livingSkyFrame') {
        if (!frame) throw new Error('not found');
        return frame;
      }
      if (!containers[id]) containers[id] = { html: '' };
      return containers[id];
    },
    containers,
    frame,
    trigger: (state) => frame && frame.postMessage(state),
  };
}

describe('initEmptyStateScene', () => {
  it('sets initial html from ILLUSTRATION_SVGS[key]', () => {
    const { $w, containers } = makeWix();
    initEmptyStateScene($w, 'cart', '#emptyCartScene');
    expect(containers['#emptyCartScene'].html).toContain('<svg');
    expect(containers['#emptyCartScene'].html).toContain('cart-sky');
  });

  it('applies sky overlay on LivingSkyState message', () => {
    const { $w, containers, trigger } = makeWix();
    initEmptyStateScene($w, 'cart', '#emptyCartScene');
    trigger({ skyColors: ['#1A2B3C'], starOpacity: 0 });
    expect(containers['#emptyCartScene'].html).toContain('sky-overlay');
    expect(containers['#emptyCartScene'].html).toContain('#1A2B3C');
  });

  it('applies night overlay when starOpacity > 0', () => {
    const { $w, containers, trigger } = makeWix();
    initEmptyStateScene($w, 'cart', '#emptyCartScene');
    trigger({ skyColors: ['#0A0E1A'], starOpacity: 0.8 });
    expect(containers['#emptyCartScene'].html).toContain('id="stars"');
  });

  it('rejects non-hex skyColor (XSS guard)', () => {
    const { $w, containers, trigger } = makeWix();
    initEmptyStateScene($w, 'cart', '#emptyCartScene');
    const htmlBefore = containers['#emptyCartScene'].html;
    trigger({ skyColors: ['javascript:alert(1)'], starOpacity: 0 });
    // overlay with bad color is not injected
    expect(containers['#emptyCartScene'].html).not.toContain('javascript:');
  });

  it('does nothing when #livingSkyFrame is absent', () => {
    const { $w, containers } = makeWix(false);
    expect(() => initEmptyStateScene($w, 'cart', '#emptyCartScene')).not.toThrow();
    expect(containers['#emptyCartScene'].html).toContain('<svg');
  });

  it('does nothing when $w is falsy', () => {
    expect(() => initEmptyStateScene(null, 'cart', '#emptyCartScene')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/emptyStateIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: `initEmptyStateScene is not a function` or similar.

- [ ] **Step 3: Implement initEmptyStateScene**

Add to the bottom of `src/public/emptyStateIllustrations.js` (after `ILLUSTRATION_SVGS`):

```js
// ── LivingSkyState wiring ─────────────────────────────────────────────────────

const SAFE_HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

const EMPTY_STAR_POSITIONS = [
  [20,15],[55,10],[90,18],[130,8],[175,14],[220,6],[260,20],[40,5],[155,22],[195,12],
];

/**
 * Apply LivingSkyState overlay to an empty-state SVG string.
 * Unexported — used only through initEmptyStateScene.
 * @param {string} svg
 * @param {Object} state  LivingSkyState { skyColors, starOpacity }
 * @returns {string}
 */
function _applyEmptySkyState(svg, state) {
  const isNight = Number(state.starOpacity) > 0;
  const skyColor = state.skyColors && state.skyColors[0];
  const safeColor = typeof skyColor === 'string' && SAFE_HEX_RE.test(skyColor)
    ? skyColor : null;
  let overlay = '';
  if (safeColor) {
    const opacity = isNight ? 0.55 : 0.25;
    overlay += `<rect width="280" height="200" fill="${safeColor}" opacity="${opacity}" id="sky-overlay"/>`;
  }
  if (isNight) {
    overlay += '<g id="stars">';
    for (const [x, y] of EMPTY_STAR_POSITIONS) {
      overlay += `<circle cx="${x}" cy="${y}" r="1.2" fill="#FAF7F2" opacity="0.8"/>`;
    }
    overlay += '</g>';
  }
  if (!overlay) return svg;
  return svg.replace('</svg>', overlay + '</svg>');
}

/**
 * Initialize an empty-state illustration on a Wix HtmlComponent container.
 * Sets initial SVG and subscribes to LivingSkyState updates from #livingSkyFrame.
 * @param {Function} $w - Wix selector
 * @param {string} key - Key in ILLUSTRATION_SVGS (e.g. 'cart', 'search')
 * @param {string} containerId - Wix element ID (e.g. '#emptyCartScene')
 */
export function initEmptyStateScene($w, key, containerId) {
  try {
    if (!$w) return;
    const container = $w(containerId);
    if (!container) return;
    const baseSvg = ILLUSTRATION_SVGS[key] || ILLUSTRATION_SVGS.default || '';
    container.html = baseSvg;

    let livingSkyFrame;
    try { livingSkyFrame = $w('#livingSkyFrame'); } catch (_) { /* not on this page */ }
    if (livingSkyFrame && typeof livingSkyFrame.onMessage === 'function') {
      livingSkyFrame.onMessage((event) => {
        const state = event && event.data;
        if (!state) return;
        container.html = _applyEmptySkyState(baseSvg, state);
      });
    }
  } catch (e) { console.warn('[emptyStateIllustrations] initEmptyStateScene failed:', e); }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/emptyStateIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Run full suite to check for regressions**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run 2>&1 | tail -5
```

Expected: same count passing as before + 6 new.

- [ ] **Step 6: Commit**

```bash
git add refinery/rig/src/public/emptyStateIllustrations.js refinery/rig/tests/emptyStateIllustrations.test.js
git commit -m "feat(CF-p8a): wire emptyStateIllustrations to LivingSkyState"
```

---

## Task 2: Wire comfortIllustrations.js

**Context:** `comfortIllustrations.js` has `COMFORT_SLUGS = ['plush', 'medium', 'firm']`, `getComfortSvg(slug)` returns an 800×500 SVG with a `#plush-sky` / `#medium-sky` / `#firm-sky` gradient in the background. Each SVG uses hardcoded hex colors (not brand tokens). Page code calls `$w('#comfortScene').html = getComfortSvg(slug)`. Phase 8 adds `initComfortIllustration($w, slug, containerId)`.

**Files:**
- Modify: `refinery/rig/src/public/comfortIllustrations.js`
- Modify: `refinery/rig/tests/comfortIllustrations.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/comfortIllustrations.test.js`:

```js
import { initComfortIllustration } from '../src/public/comfortIllustrations';

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
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/comfortIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 3: Implement initComfortIllustration**

Add to the bottom of `src/public/comfortIllustrations.js`:

```js
// ── LivingSkyState wiring ─────────────────────────────────────────────────────

const _SAFE_HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

const _COMFORT_STARS = [
  [40,20],[100,12],[180,25],[260,8],[350,18],[460,10],[560,22],[650,15],[720,28],[780,8],
];

function _applyComfortSkyState(svg, state) {
  const isNight = Number(state.starOpacity) > 0;
  const skyColor = state.skyColors && state.skyColors[0];
  const safeColor = typeof skyColor === 'string' && _SAFE_HEX.test(skyColor) ? skyColor : null;
  let overlay = '';
  if (safeColor) {
    const op = isNight ? 0.6 : 0.22;
    overlay += `<rect width="800" height="500" fill="${safeColor}" opacity="${op}" id="sky-overlay"/>`;
  }
  if (isNight) {
    overlay += '<g id="stars">';
    for (const [x, y] of _COMFORT_STARS) {
      overlay += `<circle cx="${x}" cy="${y}" r="1.5" fill="#FAF7F2" opacity="0.75"/>`;
    }
    overlay += '</g>';
  }
  if (!overlay) return svg;
  return svg.replace('</svg>', overlay + '</svg>');
}

/**
 * Initialize a comfort illustration on a Wix HtmlComponent.
 * Sets initial SVG via getComfortSvg(slug) and subscribes to LivingSkyState.
 * @param {Function} $w
 * @param {string} slug - 'plush' | 'medium' | 'firm'
 * @param {string} containerId
 */
export function initComfortIllustration($w, slug, containerId) {
  try {
    if (!$w) return;
    const container = $w(containerId);
    if (!container) return;
    const baseSvg = getComfortSvg(slug);
    container.html = baseSvg;
    let frame;
    try { frame = $w('#livingSkyFrame'); } catch (_) { /* not on this page */ }
    if (frame && typeof frame.onMessage === 'function') {
      frame.onMessage((event) => {
        const state = event && event.data;
        if (!state) return;
        container.html = _applyComfortSkyState(baseSvg, state);
      });
    }
  } catch (e) { console.warn('[comfortIllustrations] initComfortIllustration failed:', e); }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/comfortIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Run full suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add refinery/rig/src/public/comfortIllustrations.js refinery/rig/tests/comfortIllustrations.test.js
git commit -m "feat(CF-p8b): wire comfortIllustrations to LivingSkyState"
```

---

## Task 3: Wire aboutIllustrations.js

**Context:** `aboutIllustrations.js` already has `initAboutIllustrations($w)` which sets team portrait and timeline SVGs. No sky subscription. Phase 8 extends this function with sky wiring — it subscribes to `#livingSkyFrame.onMessage` and on each message re-renders both SVGs with the sky overlay applied.

**Files:**
- Modify: `refinery/rig/src/public/aboutIllustrations.js`
- Create or Modify: `refinery/rig/tests/aboutIllustrations.test.js`

- [ ] **Step 1: Read the existing initAboutIllustrations to understand the container IDs**

```bash
grep -n "initAboutIllustrations\|containerId\|#about\|\.html\|portrait\|timeline" \
  /Users/hal/gt/cfutons/refinery/rig/src/public/aboutIllustrations.js | head -20
```

Note the container IDs and SVG generator functions used.

- [ ] **Step 2: Write failing tests**

Create `tests/aboutIllustrations.test.js` (or add to existing):

```js
import { initAboutIllustrations } from '../src/public/aboutIllustrations';

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

describe('initAboutIllustrations — LivingSkyState', () => {
  it('subscribes to #livingSkyFrame and applies sky overlay on message', () => {
    const { $w, containers, trigger } = makeWix();
    initAboutIllustrations($w);
    const teamId = '#aboutTeamPortrait';   // adjust to actual ID if different
    const initial = containers[teamId] && containers[teamId].html;
    trigger({ skyColors: ['#2A4A6A'], starOpacity: 0 });
    const updated = containers[teamId] && containers[teamId].html;
    expect(updated).toContain('sky-overlay');
    expect(updated).toContain('#2A4A6A');
  });

  it('does not throw when livingSkyFrame absent', () => {
    const { $w } = makeWix(false);
    expect(() => initAboutIllustrations($w)).not.toThrow();
  });
});
```

> **Note:** After running Step 1, adjust `teamId` above to match the actual `$w(containerId)` call in `initAboutIllustrations`.

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/aboutIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 4: Implement sky wiring inside initAboutIllustrations**

Add the sky helper and subscription to `aboutIllustrations.js`. Add BEFORE the existing `initAboutIllustrations`:

```js
const _ABOUT_SAFE_HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

function _applyAboutSkyState(svg, state, width, height) {
  const isNight = Number(state.starOpacity) > 0;
  const skyColor = state.skyColors && state.skyColors[0];
  const safeColor = typeof skyColor === 'string' && _ABOUT_SAFE_HEX.test(skyColor) ? skyColor : null;
  let overlay = '';
  if (safeColor) {
    const op = isNight ? 0.55 : 0.2;
    overlay += `<rect width="${width}" height="${height}" fill="${safeColor}" opacity="${op}" id="sky-overlay"/>`;
  }
  if (!overlay) return svg;
  return svg.replace('</svg>', overlay + '</svg>');
}
```

Then inside `initAboutIllustrations`, after the existing `container.html = ...` calls, add:

```js
    // Subscribe to LivingSkyState
    let frame;
    try { frame = $w('#livingSkyFrame'); } catch (_) { /* not on this page */ }
    if (frame && typeof frame.onMessage === 'function') {
      frame.onMessage((event) => {
        const state = event && event.data;
        if (!state) return;
        // Re-render all about illustrations with sky state
        try { $w('#aboutTeamPortrait').html = _applyAboutSkyState(getTeamPortraitSvg(), state, 400, 300); } catch (_) {}
        try { $w('#aboutTimeline').html = _applyAboutSkyState(getTimelineSvg(), state, 800, 200); } catch (_) {}
      });
    }
```

> **Note:** Replace `getTeamPortraitSvg()`, `getTimelineSvg()`, `#aboutTeamPortrait`, `#aboutTimeline`, `400, 300`, `800, 200` with the actual function names and container IDs observed in Step 1.

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/aboutIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 6: Run full suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add refinery/rig/src/public/aboutIllustrations.js refinery/rig/tests/aboutIllustrations.test.js
git commit -m "feat(CF-p8c): wire aboutIllustrations to LivingSkyState"
```

---

## Task 4: Wire onboardingIllustrations.js

**Context:** `onboardingIllustrations.js` mirrors `emptyStateIllustrations.js` — exports `svgToDataUri` and `ONBOARDING_SVGS` (a keyed map of SVG strings). No init function. Phase 8 adds `initOnboardingScene($w, key, containerId)`.

**Files:**
- Modify: `refinery/rig/src/public/onboardingIllustrations.js`
- Modify: `refinery/rig/tests/onboardingIllustrations.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/onboardingIllustrations.test.js`:

```js
import { initOnboardingScene, ONBOARDING_SVGS } from '../src/public/onboardingIllustrations';

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

describe('initOnboardingScene', () => {
  it('sets initial html from ONBOARDING_SVGS[key]', () => {
    const firstKey = Object.keys(ONBOARDING_SVGS)[0];
    const { $w, containers } = makeWix();
    initOnboardingScene($w, firstKey, '#onboardingScene');
    expect(containers['#onboardingScene'].html).toContain('<svg');
  });

  it('applies sky overlay on LivingSkyState message', () => {
    const firstKey = Object.keys(ONBOARDING_SVGS)[0];
    const { $w, containers, trigger } = makeWix();
    initOnboardingScene($w, firstKey, '#onboardingScene');
    trigger({ skyColors: ['#2D4A6A'], starOpacity: 0 });
    expect(containers['#onboardingScene'].html).toContain('sky-overlay');
    expect(containers['#onboardingScene'].html).toContain('#2D4A6A');
  });

  it('adds stars at night', () => {
    const firstKey = Object.keys(ONBOARDING_SVGS)[0];
    const { $w, containers, trigger } = makeWix();
    initOnboardingScene($w, firstKey, '#onboardingScene');
    trigger({ skyColors: ['#080C14'], starOpacity: 1 });
    expect(containers['#onboardingScene'].html).toContain('id="stars"');
  });

  it('rejects non-hex skyColor', () => {
    const firstKey = Object.keys(ONBOARDING_SVGS)[0];
    const { $w, containers, trigger } = makeWix();
    initOnboardingScene($w, firstKey, '#onboardingScene');
    trigger({ skyColors: ['<script>evil</script>'], starOpacity: 0 });
    expect(containers['#onboardingScene'].html).not.toContain('<script>');
  });

  it('does not throw when $w is null', () => {
    expect(() => initOnboardingScene(null, 'welcome', '#scene')).not.toThrow();
  });

  it('does not throw when livingSkyFrame absent', () => {
    const firstKey = Object.keys(ONBOARDING_SVGS)[0];
    const { $w } = makeWix(false);
    expect(() => initOnboardingScene($w, firstKey, '#onboardingScene')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/onboardingIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 3: Implement initOnboardingScene**

Add to the bottom of `src/public/onboardingIllustrations.js`:

```js
// ── LivingSkyState wiring ─────────────────────────────────────────────────────

const _OB_SAFE_HEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

const _OB_STARS = [
  [25,12],[60,8],[100,20],[145,6],[195,16],[240,9],[270,22],[310,14],[90,25],[210,5],
];

function _applyOnboardingSkyState(svg, state) {
  const isNight = Number(state.starOpacity) > 0;
  const skyColor = state.skyColors && state.skyColors[0];
  const safeColor = typeof skyColor === 'string' && _OB_SAFE_HEX.test(skyColor) ? skyColor : null;
  let overlay = '';
  if (safeColor) {
    const op = isNight ? 0.55 : 0.25;
    overlay += `<rect width="280" height="200" fill="${safeColor}" opacity="${op}" id="sky-overlay"/>`;
  }
  if (isNight) {
    overlay += '<g id="stars">';
    for (const [x, y] of _OB_STARS) {
      overlay += `<circle cx="${x}" cy="${y}" r="1.2" fill="#FAF7F2" opacity="0.8"/>`;
    }
    overlay += '</g>';
  }
  if (!overlay) return svg;
  return svg.replace('</svg>', overlay + '</svg>');
}

/**
 * Initialize an onboarding illustration and subscribe to LivingSkyState.
 * @param {Function} $w
 * @param {string} key - Key in ONBOARDING_SVGS
 * @param {string} containerId
 */
export function initOnboardingScene($w, key, containerId) {
  try {
    if (!$w) return;
    const container = $w(containerId);
    if (!container) return;
    const baseSvg = ONBOARDING_SVGS[key] || '';
    container.html = baseSvg;
    let frame;
    try { frame = $w('#livingSkyFrame'); } catch (_) { /* not on this page */ }
    if (frame && typeof frame.onMessage === 'function') {
      frame.onMessage((event) => {
        const state = event && event.data;
        if (!state) return;
        container.html = _applyOnboardingSkyState(baseSvg, state);
      });
    }
  } catch (e) { console.warn('[onboardingIllustrations] initOnboardingScene failed:', e); }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/hal/gt/cfutons/refinery/rig
npx vitest run tests/onboardingIllustrations.test.js --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Run full suite**

```bash
cd /Users/hal/gt/cfutons/refinery/rig && npx vitest run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add refinery/rig/src/public/onboardingIllustrations.js refinery/rig/tests/onboardingIllustrations.test.js
git commit -m "feat(CF-p8d): wire onboardingIllustrations to LivingSkyState"
```

---

## Integration Note for All Tasks

After all 4 tasks are merged, page-level Velo scripts that currently do:
```js
container.html = svgToDataUri(ILLUSTRATION_SVGS[key]);
// or
container.html = getComfortSvg(slug);
```

Should be updated to call the new `init*` functions instead:
```js
initEmptyStateScene($w, 'cart', '#emptyCartScene');
initComfortIllustration($w, 'plush', '#comfortScene');
initAboutIllustrations($w);   // already called, now also wires sky
initOnboardingScene($w, 'welcome', '#onboardingScene');
```

These page-level call-site updates are **not in scope for these tasks** — they belong in the Wix Studio hookup bead (CF-03jx, once unlocked by editor login). Tasks 1–4 only add the `init*` functions to the modules; existing callers continue to work unchanged.
