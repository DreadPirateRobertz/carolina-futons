# Web AR Product Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `<model-viewer>` 3D product visualization to the cfutons web product page, with iOS AR Quick Look and Android Scene Viewer support.

**Architecture:** Wix HtmlComponent (`$w('#productARViewer')`) receives model data via `postMessage`. Three new public modules: `models3d.js` (catalog), `arSupport.js` (detection), `ProductARViewer.js` (viewer init). Lazy-loaded on user interaction.

**Tech Stack:** Google `<model-viewer>` 3.5.0, Wix Velo `$w()` API, Vitest

---

### Task 1: models3d.js — Write failing tests

**Files:**
- Create: `tests/models3d.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, expect } from 'vitest';
import { MODELS_3D, MODEL_CDN_BASE, getModel3DForProduct, hasARModel } from '../src/public/models3d.js';

describe('models3d', () => {
  describe('MODELS_3D catalog', () => {
    it('contains at least 10 products', () => {
      expect(MODELS_3D.length).toBeGreaterThanOrEqual(10);
    });

    it('each entry has required fields', () => {
      for (const model of MODELS_3D) {
        expect(model.productId).toMatch(/^prod-/);
        expect(model.glbUrl).toMatch(/\.glb$/);
        expect(model.usdzUrl).toMatch(/\.usdz$/);
        expect(model.dimensions).toHaveProperty('width');
        expect(model.dimensions).toHaveProperty('depth');
        expect(model.dimensions).toHaveProperty('height');
        expect(model.dimensions.width).toBeGreaterThan(0);
        expect(model.dimensions.depth).toBeGreaterThan(0);
        expect(model.dimensions.height).toBeGreaterThan(0);
        expect(typeof model.fileSizeBytes).toBe('number');
        expect(typeof model.contentHash).toBe('string');
        expect(typeof model.hasFabricVariants).toBe('boolean');
      }
    });

    it('dimensions are in meters (all under 3m)', () => {
      for (const model of MODELS_3D) {
        expect(model.dimensions.width).toBeLessThan(3);
        expect(model.dimensions.depth).toBeLessThan(3);
        expect(model.dimensions.height).toBeLessThan(3);
      }
    });

    it('has no duplicate productIds', () => {
      const ids = MODELS_3D.map(m => m.productId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('MODEL_CDN_BASE', () => {
    it('is an HTTPS URL', () => {
      expect(MODEL_CDN_BASE).toMatch(/^https:\/\//);
    });
  });

  describe('getModel3DForProduct', () => {
    it('returns model for known product', () => {
      const model = getModel3DForProduct('prod-asheville-full');
      expect(model).toBeDefined();
      expect(model.productId).toBe('prod-asheville-full');
      expect(model.glbUrl).toContain('.glb');
      expect(model.usdzUrl).toContain('.usdz');
    });

    it('returns undefined for unknown product', () => {
      expect(getModel3DForProduct('prod-nonexistent')).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(getModel3DForProduct('')).toBeUndefined();
    });
  });

  describe('hasARModel', () => {
    it('returns true for product with model', () => {
      expect(hasARModel('prod-asheville-full')).toBe(true);
    });

    it('returns false for product without model', () => {
      expect(hasARModel('prod-nonexistent')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(hasARModel('')).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/models3d.test.js`
Expected: FAIL — cannot find module `../src/public/models3d.js`

---

### Task 2: models3d.js — Implement

**Files:**
- Create: `src/public/models3d.js`

**Step 1: Write implementation**

Port from mobile `cfutons_mobile/crew/dallas/src/data/models3d.ts` — strip TypeScript, keep data and functions.

```javascript
// 3D model asset catalog for AR "View in Your Room" feature.
// Ported from cfutons_mobile models3d.ts — shared catalog across web+mobile.

/** CDN base URL for 3D model assets */
export const MODEL_CDN_BASE = 'https://cdn.carolinafutons.com/models';

/** Convert inches to meters */
function inToM(inches) {
  return Math.round(inches * 0.0254 * 1000) / 1000;
}

/** 3D model catalog — futons, frames, murphy-beds only */
export const MODELS_3D = [
  // --- Murphy Cabinet Beds ---
  {
    productId: 'prod-murphy-queen-vertical',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-vertical-q1r2s3.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-vertical-q1r2s3.usdz`,
    dimensions: { width: inToM(64), depth: inToM(24), height: inToM(42) },
    fileSizeBytes: 7_200_000,
    contentHash: 'q1r2s3',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-full-horizontal',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-full-horizontal-t4u5v6.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-full-horizontal-t4u5v6.usdz`,
    dimensions: { width: inToM(78), depth: inToM(20), height: inToM(44) },
    fileSizeBytes: 6_500_000,
    contentHash: 't4u5v6',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-queen-bookcase',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-bookcase-w7x8y9.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-bookcase-w7x8y9.usdz`,
    dimensions: { width: inToM(100), depth: inToM(24), height: inToM(84) },
    fileSizeBytes: 8_400_000,
    contentHash: 'w7x8y9',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-twin-cabinet',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-twin-cabinet-z0a1b2.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-twin-cabinet-z0a1b2.usdz`,
    dimensions: { width: inToM(44), depth: inToM(24), height: inToM(38) },
    fileSizeBytes: 4_800_000,
    contentHash: 'z0a1b2',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-queen-desk',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-queen-desk-c3d4e5.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-queen-desk-c3d4e5.usdz`,
    dimensions: { width: inToM(66), depth: inToM(26), height: inToM(84) },
    fileSizeBytes: 8_100_000,
    contentHash: 'c3d4e5',
    hasFabricVariants: false,
  },
  {
    productId: 'prod-murphy-full-storage',
    glbUrl: `${MODEL_CDN_BASE}/glb/murphy-full-storage-f6g7h8.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/murphy-full-storage-f6g7h8.usdz`,
    dimensions: { width: inToM(60), depth: inToM(24), height: inToM(82) },
    fileSizeBytes: 7_000_000,
    contentHash: 'f6g7h8',
    hasFabricVariants: false,
  },
  // --- Futons & Frames ---
  {
    productId: 'prod-asheville-full',
    glbUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
    usdzUrl: `${MODEL_CDN_BASE}/usdz/asheville-full-14c9a033.usdz`,
    dimensions: { width: inToM(54), depth: inToM(34), height: inToM(33) },
    fileSizeBytes: 4_125_648,
    contentHash: '14c9a033',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-blue-ridge-queen',
    glbUrl: `${MODEL_CDN_BASE}/glb/blue-ridge-queen-d4e5f6.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/blue-ridge-queen-d4e5f6.usdz`,
    dimensions: { width: inToM(60), depth: inToM(36), height: inToM(35) },
    fileSizeBytes: 7_500_000,
    contentHash: 'd4e5f6',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-pisgah-twin',
    glbUrl: `${MODEL_CDN_BASE}/glb/pisgah-twin-g7h8i9.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/pisgah-twin-g7h8i9.usdz`,
    dimensions: { width: inToM(39), depth: inToM(32), height: inToM(31) },
    fileSizeBytes: 5_200_000,
    contentHash: 'g7h8i9',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-biltmore-loveseat',
    glbUrl: `${MODEL_CDN_BASE}/glb/biltmore-loveseat-j0k1l2.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/biltmore-loveseat-j0k1l2.usdz`,
    dimensions: { width: inToM(48), depth: inToM(33), height: inToM(32) },
    fileSizeBytes: 5_800_000,
    contentHash: 'j0k1l2',
    hasFabricVariants: true,
  },
  {
    productId: 'prod-hardwood-frame',
    glbUrl: `${MODEL_CDN_BASE}/glb/hardwood-frame-m3n4o5.glb`,
    usdzUrl: `${MODEL_CDN_BASE}/usdz/hardwood-frame-m3n4o5.usdz`,
    dimensions: { width: inToM(54), depth: inToM(38), height: inToM(33) },
    fileSizeBytes: 4_100_000,
    contentHash: 'm3n4o5',
    hasFabricVariants: false,
  },
];

/** Look up 3D model asset for a product */
export function getModel3DForProduct(productId) {
  return MODELS_3D.find(m => m.productId === productId);
}

/** Check whether a product has an AR model available */
export function hasARModel(productId) {
  return MODELS_3D.some(m => m.productId === productId);
}
```

**Step 2: Add vitest alias**

In `vitest.config.js`, add inside `resolve.alias`:
```javascript
'public/models3d.js': path.resolve(__dirname, 'src/public/models3d.js'),
'public/models3d': path.resolve(__dirname, 'src/public/models3d.js'),
```

**Step 3: Run tests**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/models3d.test.js`
Expected: ALL PASS

**Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons
git checkout -b cf-5rfj-web-ar
git add src/public/models3d.js tests/models3d.test.js vitest.config.js
git commit -m "feat(ar): add 3D model catalog for web AR (CF-5rfj)"
```

---

### Task 3: arSupport.js — Write failing tests

**Files:**
- Create: `tests/arSupport.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('public/models3d', () => ({
  hasARModel: vi.fn((id) => id === 'prod-asheville-full'),
}));

import { checkWebARSupport, isProductAREnabled, AR_CATEGORIES } from '../src/public/arSupport.js';

describe('arSupport', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  describe('AR_CATEGORIES', () => {
    it('includes futons, frames, and murphy-beds', () => {
      expect(AR_CATEGORIES.has('futons')).toBe(true);
      expect(AR_CATEGORIES.has('frames')).toBe(true);
      expect(AR_CATEGORIES.has('murphy-beds')).toBe(true);
    });

    it('does not include covers or accessories', () => {
      expect(AR_CATEGORIES.has('covers')).toBe(false);
      expect(AR_CATEGORIES.has('accessories')).toBe(false);
    });
  });

  describe('checkWebARSupport', () => {
    it('returns true when customElements is available', () => {
      vi.stubGlobal('customElements', { get: vi.fn() });
      expect(checkWebARSupport()).toBe(true);
    });

    it('returns false when customElements is undefined', () => {
      vi.stubGlobal('customElements', undefined);
      expect(checkWebARSupport()).toBe(false);
    });
  });

  describe('isProductAREnabled', () => {
    it('returns true for eligible in-stock product with AR model', () => {
      const product = { _id: 'prod-asheville-full', collections: ['futons'], inStock: true };
      expect(isProductAREnabled(product)).toBe(true);
    });

    it('returns false for out-of-stock product', () => {
      const product = { _id: 'prod-asheville-full', collections: ['futons'], inStock: false };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for non-AR category', () => {
      const product = { _id: 'prod-asheville-full', collections: ['covers'], inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for product without AR model', () => {
      const product = { _id: 'prod-no-model', collections: ['futons'], inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('returns false for null product', () => {
      expect(isProductAREnabled(null)).toBe(false);
    });

    it('returns false for product missing collections', () => {
      const product = { _id: 'prod-asheville-full', inStock: true };
      expect(isProductAREnabled(product)).toBe(false);
    });

    it('matches category from collections array', () => {
      const product = { _id: 'prod-asheville-full', collections: ['sale', 'futons', 'featured'], inStock: true };
      expect(isProductAREnabled(product)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/arSupport.test.js`
Expected: FAIL — cannot find module `../src/public/arSupport.js`

---

### Task 4: arSupport.js — Implement

**Files:**
- Create: `src/public/arSupport.js`

**Step 1: Write implementation**

```javascript
// Web AR support detection and product eligibility.
// Adapted from cfutons_mobile arSupport.ts — web-only subset.

import { hasARModel } from 'public/models3d.js';

/** Product categories eligible for AR viewing */
export const AR_CATEGORIES = new Set(['futons', 'frames', 'murphy-beds']);

/**
 * Check if the browser supports custom elements (required for <model-viewer>).
 * Returns true on any modern browser (Chrome, Safari, Firefox, Edge).
 */
export function checkWebARSupport() {
  try {
    return typeof customElements !== 'undefined' && customElements !== null;
  } catch {
    return false;
  }
}

/**
 * Check if a product is eligible for AR viewing.
 * Requires: AR-eligible category, in stock, has 3D model.
 */
export function isProductAREnabled(product) {
  if (!product) return false;
  if (!product.inStock) return false;
  if (!product._id) return false;

  const collections = product.collections;
  if (!Array.isArray(collections)) return false;

  const inARCategory = collections.some(c => AR_CATEGORIES.has(c));
  if (!inARCategory) return false;

  return hasARModel(product._id);
}
```

**Step 2: Add vitest aliases**

In `vitest.config.js`, add inside `resolve.alias`:
```javascript
'public/arSupport.js': path.resolve(__dirname, 'src/public/arSupport.js'),
'public/arSupport': path.resolve(__dirname, 'src/public/arSupport.js'),
```

**Step 3: Run tests**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/arSupport.test.js`
Expected: ALL PASS

**Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons
git add src/public/arSupport.js tests/arSupport.test.js vitest.config.js
git commit -m "feat(ar): add web AR support detection (CF-5rfj)"
```

---

### Task 5: ProductARViewer.js — Write failing tests

**Files:**
- Create: `tests/ProductARViewer.test.js`

**Step 1: Write the failing test**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('public/models3d', () => ({
  getModel3DForProduct: vi.fn((id) => {
    if (id === 'prod-asheville-full') {
      return {
        productId: 'prod-asheville-full',
        glbUrl: 'https://cdn.example.com/model.glb',
        usdzUrl: 'https://cdn.example.com/model.usdz',
        dimensions: { width: 1.37, depth: 0.86, height: 0.84 },
      };
    }
    return undefined;
  }),
  hasARModel: vi.fn((id) => id === 'prod-asheville-full'),
}));

vi.mock('public/arSupport', () => ({
  checkWebARSupport: vi.fn(() => true),
  isProductAREnabled: vi.fn((p) => p?._id === 'prod-asheville-full' && p?.inStock),
}));

import { initProductARViewer } from '../src/public/ProductARViewer.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', html: '',
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onMessage: vi.fn(),
    postMessage: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

describe('ProductARViewer', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = {
      product: {
        _id: 'prod-asheville-full',
        name: 'Asheville Full Futon',
        collections: ['futons'],
        inStock: true,
      },
    };
  });

  describe('initProductARViewer', () => {
    it('shows the AR button for eligible product', async () => {
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').show).toHaveBeenCalled();
    });

    it('hides the AR button when product has no AR model', async () => {
      state.product = { _id: 'prod-no-model', name: 'No Model', collections: ['futons'], inStock: true };
      const { isProductAREnabled } = await import('public/arSupport');
      isProductAREnabled.mockReturnValue(false);

      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').hide).toHaveBeenCalled();
    });

    it('hides the AR button when product is null', async () => {
      state.product = null;
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').hide).toHaveBeenCalled();
    });

    it('registers click handler on AR button', async () => {
      await initProductARViewer($w, state);
      expect($w('#viewInRoomBtn').onClick).toHaveBeenCalled();
    });

    it('sends model data to HtmlComponent on button click', async () => {
      await initProductARViewer($w, state);

      const clickHandler = $w('#viewInRoomBtn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#productARViewer').postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'loadModel',
          glbUrl: 'https://cdn.example.com/model.glb',
          usdzUrl: 'https://cdn.example.com/model.usdz',
          title: 'Asheville Full Futon',
        })
      );
    });

    it('expands the AR viewer container on button click', async () => {
      await initProductARViewer($w, state);

      const clickHandler = $w('#viewInRoomBtn').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#arViewerContainer').expand).toHaveBeenCalled();
    });

    it('returns a destroy function', async () => {
      const result = await initProductARViewer($w, state);
      expect(typeof result.destroy).toBe('function');
    });

    it('collapses viewer on destroy', async () => {
      const result = await initProductARViewer($w, state);
      result.destroy();
      expect($w('#arViewerContainer').collapse).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/ProductARViewer.test.js`
Expected: FAIL — cannot find module `../src/public/ProductARViewer.js`

---

### Task 6: ProductARViewer.js — Implement

**Files:**
- Create: `src/public/ProductARViewer.js`

**Step 1: Write implementation**

```javascript
// ProductARViewer — 3D product visualization using <model-viewer> in Wix HtmlComponent.
// Lazy loads on user interaction. Graceful degradation if AR unavailable.

import { getModel3DForProduct } from 'public/models3d.js';
import { checkWebARSupport, isProductAREnabled } from 'public/arSupport.js';

/**
 * Initialize the AR product viewer on the product page.
 * Follows Wix Velo init pattern: receives $w and state, returns { destroy }.
 *
 * Required Wix Studio elements:
 * - #viewInRoomBtn: Button — "View in Room" CTA
 * - #arViewerContainer: Box — wrapper (starts collapsed)
 * - #productARViewer: HtmlComponent — embeds <model-viewer>
 */
export async function initProductARViewer($w, state) {
  const btn = $w('#viewInRoomBtn');
  const container = $w('#arViewerContainer');
  const viewer = $w('#productARViewer');

  // Guard: no product or AR not supported
  if (!state.product || !isProductAREnabled(state.product)) {
    btn.hide();
    container.collapse();
    return { destroy() {} };
  }

  const model = getModel3DForProduct(state.product._id);
  if (!model) {
    btn.hide();
    container.collapse();
    return { destroy() {} };
  }

  // Show the "View in Room" button
  btn.show();

  // On click: expand viewer and send model data
  btn.onClick(() => {
    container.expand();
    viewer.postMessage({
      type: 'loadModel',
      glbUrl: model.glbUrl,
      usdzUrl: model.usdzUrl,
      title: state.product.name,
      dimensions: model.dimensions,
    });
  });

  return {
    destroy() {
      container.collapse();
    },
  };
}
```

**Step 2: Add vitest aliases**

In `vitest.config.js`, add inside `resolve.alias`:
```javascript
'public/ProductARViewer.js': path.resolve(__dirname, 'src/public/ProductARViewer.js'),
'public/ProductARViewer': path.resolve(__dirname, 'src/public/ProductARViewer.js'),
```

**Step 3: Run tests**

Run: `cd /Users/hal/gt/cfutons && npx vitest run tests/ProductARViewer.test.js`
Expected: ALL PASS

**Step 4: Run full test suite**

Run: `cd /Users/hal/gt/cfutons && npx vitest run`
Expected: ALL PASS (existing 151 + new 3 test files)

**Step 5: Commit**

```bash
cd /Users/hal/gt/cfutons
git add src/public/ProductARViewer.js tests/ProductARViewer.test.js vitest.config.js
git commit -m "feat(ar): add ProductARViewer with model-viewer integration (CF-5rfj)"
```

---

### Task 7: Product Page integration

**Files:**
- Modify: `src/pages/Product Page.js`

**Step 1: Add import**

At the top of `Product Page.js`, after the existing imports, add:

```javascript
import { initProductARViewer } from 'public/ProductARViewer.js';
```

**Step 2: Add to productSections array**

In the `productSections` array (around line 73-93), add after `imageGallery`:

```javascript
{ name: 'arViewer', init: () => initProductARViewer($w, state) },
```

**Step 3: Run full test suite**

Run: `cd /Users/hal/gt/cfutons && npx vitest run`
Expected: ALL PASS

**Step 4: Commit**

```bash
cd /Users/hal/gt/cfutons
git add src/pages/Product\ Page.js
git commit -m "feat(ar): integrate AR viewer into product page init chain (CF-5rfj)"
```

---

### Task 8: Open PR

**Step 1: Push branch**

```bash
cd /Users/hal/gt/cfutons
git push -u origin cf-5rfj-web-ar
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: Web AR product visualization (CF-5rfj)" --body "$(cat <<'EOF'
## Summary
- Add 3D product visualization to product pages using Google model-viewer
- 13 products (futons, frames, murphy-beds) with GLB + USDZ models
- iOS AR Quick Look via USDZ, Android Scene Viewer, desktop 3D preview
- Lazy loaded — zero page load impact
- Graceful degradation when AR unavailable

## New Files
- `src/public/models3d.js` — 3D model catalog (ported from mobile)
- `src/public/arSupport.js` — Web AR capability detection
- `src/public/ProductARViewer.js` — Viewer init via Wix HtmlComponent

## Test plan
- [x] models3d: catalog integrity, lookup, missing product
- [x] arSupport: capability detection, product eligibility, edge cases
- [x] ProductARViewer: init/destroy lifecycle, postMessage contract, error states
- [ ] Manual: verify model-viewer renders on product page in Wix preview
- [ ] Manual: test iOS USDZ Quick Look on iPhone Safari
- [ ] Manual: test Android Scene Viewer on Chrome

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Notify melania**

```bash
gt mail send cfutons/melania -s "PR ready: CF-5rfj Web AR visualization" -m "PR opened for CF-5rfj. 3 new modules (models3d, arSupport, ProductARViewer) + tests. Needs Wix Studio elements: #viewInRoomBtn, #arViewerContainer, #productARViewer HtmlComponent. Ready for review."
```
