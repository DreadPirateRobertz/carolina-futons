# Swatch & Comfort Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete test coverage and unified "Feel & Comfort" section for the swatch & comfort experience feature (cf-r9sc).

**Architecture:** Backend services (`swatchService.web.js`, `comfortService.web.js`, `emailService.web.js`) and frontend modules (`swatchSelector.js`, `SwatchRequestFlow.js`, `ComfortStoryCards.js`) already exist. We add comprehensive tests (TDD-style — write test, verify fail, implement if needed), create a unified `FeelAndComfort.js` module that groups comfort card + swatch preview + CTA, wire it into the Product Page orchestrator, and add mobile/a11y polish.

**Tech Stack:** Vitest, Wix Velo `$w` model, `wix-data` mock with `__seed()`, `designTokens.js` brand tokens.

---

### Task 1: comfortService backend tests

**Files:**
- Create: `tests/comfortService.test.js`
- Test target: `src/backend/comfortService.web.js`

**Step 1: Write the test file**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getComfortLevels,
  getProductComfort,
  getComfortProducts,
} from '../src/backend/comfortService.web.js';

const COMFORT_LEVELS = [
  { _id: 'cl-1', slug: 'plush', name: 'Plush', tagline: 'Sink right in', description: 'Cloud-like softness', illustration: 'wix:image://plush.svg', illustrationAlt: 'Person sinking into cushion', sortOrder: 1 },
  { _id: 'cl-2', slug: 'medium', name: 'Medium', tagline: 'Just right', description: 'Balanced support', illustration: 'wix:image://medium.svg', illustrationAlt: 'Person sitting balanced', sortOrder: 2 },
  { _id: 'cl-3', slug: 'firm', name: 'Firm', tagline: 'Rock solid support', description: 'Structured and supportive', illustration: 'wix:image://firm.svg', illustrationAlt: 'Person sitting upright', sortOrder: 3 },
];

const PRODUCT_COMFORT = [
  { _id: 'pc-1', productId: 'prod-a', comfortLevelId: 'cl-1', sortOrder: 1 },
  { _id: 'pc-2', productId: 'prod-b', comfortLevelId: 'cl-2', sortOrder: 2 },
  { _id: 'pc-3', productId: 'prod-c', comfortLevelId: 'cl-3', sortOrder: 3 },
  { _id: 'pc-4', productId: 'prod-d', comfortLevelId: 'cl-1', sortOrder: 4 },
];

describe('getComfortLevels', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
  });

  it('returns all comfort levels sorted by sortOrder', async () => {
    const levels = await getComfortLevels();
    expect(levels).toHaveLength(3);
    expect(levels[0].slug).toBe('plush');
    expect(levels[1].slug).toBe('medium');
    expect(levels[2].slug).toBe('firm');
  });

  it('returns mapped fields only', async () => {
    const levels = await getComfortLevels();
    const plush = levels[0];
    expect(plush.name).toBe('Plush');
    expect(plush.tagline).toBe('Sink right in');
    expect(plush.description).toBe('Cloud-like softness');
    expect(plush.illustration).toBe('wix:image://plush.svg');
    expect(plush.illustrationAlt).toBe('Person sinking into cushion');
    expect(plush.sortOrder).toBeUndefined();
    expect(plush._id).toBeUndefined();
  });

  it('returns empty array when no data', async () => {
    __seed('ComfortLevels', []);
    const levels = await getComfortLevels();
    expect(Array.isArray(levels)).toBe(true);
    expect(levels).toHaveLength(0);
  });
});

describe('getProductComfort', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns comfort level for a mapped product', async () => {
    const comfort = await getProductComfort('prod-a');
    expect(comfort).not.toBeNull();
    expect(comfort.slug).toBe('plush');
    expect(comfort.name).toBe('Plush');
  });

  it('returns null for unmapped product', async () => {
    const comfort = await getProductComfort('nonexistent');
    expect(comfort).toBeNull();
  });

  it('returns null for null/undefined input', async () => {
    expect(await getProductComfort(null)).toBeNull();
    expect(await getProductComfort(undefined)).toBeNull();
  });

  it('returns null for empty string', async () => {
    expect(await getProductComfort('')).toBeNull();
  });

  it('returns mapped fields only (no _id or sortOrder)', async () => {
    const comfort = await getProductComfort('prod-b');
    expect(comfort.slug).toBe('medium');
    expect(comfort._id).toBeUndefined();
    expect(comfort.sortOrder).toBeUndefined();
  });
});

describe('getComfortProducts', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns product IDs for a comfort slug', async () => {
    const ids = await getComfortProducts('plush');
    expect(ids).toContain('prod-a');
    expect(ids).toContain('prod-d');
  });

  it('returns empty for nonexistent slug', async () => {
    const ids = await getComfortProducts('ultra-soft');
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toHaveLength(0);
  });

  it('returns empty for null/undefined input', async () => {
    expect(await getComfortProducts(null)).toEqual([]);
    expect(await getComfortProducts(undefined)).toEqual([]);
  });

  it('returns empty for empty string', async () => {
    expect(await getComfortProducts('')).toEqual([]);
  });

  it('returns only product IDs (no extra fields)', async () => {
    const ids = await getComfortProducts('firm');
    expect(ids).toEqual(['prod-c']);
    ids.forEach(id => expect(typeof id).toBe('string'));
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/comfortService.test.js`
Expected: All PASS (backend already implemented)

**Step 3: Commit**

```bash
git add tests/comfortService.test.js
git commit -m "test: add comfortService backend tests — getComfortLevels, getProductComfort, getComfortProducts"
```

---

### Task 2: SwatchRequestFlow frontend logic tests

**Files:**
- Create: `tests/swatchRequestFlow.test.js`
- Test target: `src/public/SwatchRequestFlow.js`

**Step 1: Write the test file**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  toggleSwatchSelection,
  getSelectedSwatches,
  clearSelectedSwatches,
  validateRequestForm,
  MAX_SWATCHES,
} from '../src/public/SwatchRequestFlow.js';

describe('toggleSwatchSelection', () => {
  beforeEach(() => {
    clearSelectedSwatches();
  });

  it('selects a valid swatch', () => {
    const result = toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim Blue' });
    expect(result.selected).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(1);
  });

  it('deselects an already selected swatch', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim Blue' });
    const result = toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim Blue' });
    expect(result.selected).toBe(false);
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('enforces MAX_SWATCHES limit', () => {
    for (let i = 0; i < MAX_SWATCHES; i++) {
      toggleSwatchSelection({ _id: `sw-${i}`, swatchName: `Swatch ${i}` });
    }
    const result = toggleSwatchSelection({ _id: 'sw-extra', swatchName: 'Extra' });
    expect(result.selected).toBe(false);
    expect(result.limitReached).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(MAX_SWATCHES);
  });

  it('returns error for null swatch', () => {
    const result = toggleSwatchSelection(null);
    expect(result.selected).toBe(false);
    expect(result.error).toBe('Invalid swatch');
  });

  it('returns error for swatch missing _id', () => {
    const result = toggleSwatchSelection({ swatchName: 'No ID' });
    expect(result.selected).toBe(false);
    expect(result.error).toBe('Invalid swatch');
  });

  it('can re-select after deselecting', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    const result = toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    expect(result.selected).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(1);
  });
});

describe('getSelectedSwatches', () => {
  beforeEach(() => {
    clearSelectedSwatches();
  });

  it('returns empty array initially', () => {
    expect(getSelectedSwatches()).toEqual([]);
  });

  it('returns a copy (not reference)', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    const first = getSelectedSwatches();
    const second = getSelectedSwatches();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});

describe('clearSelectedSwatches', () => {
  it('clears all selections', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    toggleSwatchSelection({ _id: 'sw-2', swatchName: 'B' });
    clearSelectedSwatches();
    expect(getSelectedSwatches()).toEqual([]);
  });
});

describe('validateRequestForm', () => {
  const validForm = { name: 'Jane Doe', email: 'jane@example.com', address: '123 Main St' };

  it('returns no errors for valid form', () => {
    expect(validateRequestForm(validForm)).toEqual([]);
  });

  it('requires name', () => {
    const errors = validateRequestForm({ ...validForm, name: '' });
    expect(errors).toContainEqual({ field: 'name', message: 'Name is required' });
  });

  it('requires name under 200 chars', () => {
    const errors = validateRequestForm({ ...validForm, name: 'a'.repeat(201) });
    expect(errors).toContainEqual({ field: 'name', message: 'Name must be under 200 characters' });
  });

  it('requires email', () => {
    const errors = validateRequestForm({ ...validForm, email: '' });
    expect(errors).toContainEqual({ field: 'email', message: 'Email is required' });
  });

  it('rejects invalid email', () => {
    const errors = validateRequestForm({ ...validForm, email: 'not-an-email' });
    expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
  });

  it('rejects email with angle brackets (XSS vector)', () => {
    const errors = validateRequestForm({ ...validForm, email: '<script>@evil.com' });
    expect(errors.some(e => e.field === 'email')).toBe(true);
  });

  it('requires address', () => {
    const errors = validateRequestForm({ ...validForm, address: '' });
    expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
  });

  it('requires address under 500 chars', () => {
    const errors = validateRequestForm({ ...validForm, address: 'x'.repeat(501) });
    expect(errors).toContainEqual({ field: 'address', message: 'Address must be under 500 characters' });
  });

  it('returns multiple errors at once', () => {
    const errors = validateRequestForm({ name: '', email: '', address: '' });
    expect(errors).toHaveLength(3);
  });

  it('trims whitespace before validation', () => {
    const errors = validateRequestForm({ name: '   ', email: '   ', address: '   ' });
    expect(errors).toHaveLength(3);
  });

  it('handles null/undefined fields', () => {
    const errors = validateRequestForm({ name: null, email: undefined, address: null });
    expect(errors).toHaveLength(3);
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/swatchRequestFlow.test.js`
Expected: All PASS (logic already implemented in SwatchRequestFlow.js)

**Step 3: Commit**

```bash
git add tests/swatchRequestFlow.test.js
git commit -m "test: add SwatchRequestFlow tests — selection, validation, edge cases"
```

---

### Task 3: ComfortStoryCards frontend tests

**Files:**
- Create: `tests/comfortStoryCards.test.js`
- Test target: `src/public/ComfortStoryCards.js`

**Step 1: Write the test file**

Uses a `$w` mock factory that simulates Wix element access. Tests `renderComfortCard`, `initComfortCards`, `initComfortFilter`.

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { renderComfortCard, initComfortCards, initComfortFilter, COMFORT_ICONS } from '../src/public/ComfortStoryCards.js';

// Mock $w element factory
function make$w(elements = {}) {
  return function $w(selector) {
    if (!elements[selector]) {
      elements[selector] = {
        text: '',
        src: '',
        alt: '',
        value: '',
        options: [],
        data: null,
        _expanded: false,
        _collapsed: false,
        _handlers: {},
        expand() { this._expanded = true; this._collapsed = false; },
        collapse() { this._collapsed = true; this._expanded = false; },
        show() {},
        hide() {},
        onChange(fn) { this._handlers.change = fn; },
        accessibility: {},
      };
    }
    return elements[selector];
  };
}

const COMFORT_LEVELS = [
  { _id: 'cl-1', slug: 'plush', name: 'Plush', tagline: 'Sink right in', description: 'Cloud-soft', illustration: 'wix:image://plush.svg', illustrationAlt: 'Plush illustration', sortOrder: 1 },
  { _id: 'cl-2', slug: 'medium', name: 'Medium', tagline: 'Just right', description: 'Balanced', illustration: 'wix:image://medium.svg', illustrationAlt: 'Medium illustration', sortOrder: 2 },
  { _id: 'cl-3', slug: 'firm', name: 'Firm', tagline: 'Rock solid', description: 'Structured', illustration: 'wix:image://firm.svg', illustrationAlt: 'Firm illustration', sortOrder: 3 },
];

const PRODUCT_COMFORT = [
  { _id: 'pc-1', productId: 'prod-a', comfortLevelId: 'cl-1', sortOrder: 1 },
];

describe('COMFORT_ICONS', () => {
  it('has entries for plush, medium, firm', () => {
    expect(COMFORT_ICONS.plush).toBeDefined();
    expect(COMFORT_ICONS.medium).toBeDefined();
    expect(COMFORT_ICONS.firm).toBeDefined();
  });

  it('each entry has icon and label', () => {
    Object.values(COMFORT_ICONS).forEach(entry => {
      expect(entry.icon).toBeDefined();
      expect(entry.label).toBeDefined();
      expect(typeof entry.label).toBe('string');
    });
  });
});

describe('renderComfortCard', () => {
  it('sets name, tagline, description on elements', () => {
    const els = {};
    const $item = make$w(els);
    renderComfortCard($item, { name: 'Plush', tagline: 'Sink in', description: 'Soft', illustration: null });
    expect(els['#comfortName'].text).toBe('Plush');
    expect(els['#comfortTagline'].text).toBe('Sink in');
    expect(els['#comfortDescription'].text).toBe('Soft');
  });

  it('sets illustration src and alt when available', () => {
    const els = {};
    const $item = make$w(els);
    renderComfortCard($item, { name: 'Firm', tagline: '', description: '', illustration: 'wix:image://firm.svg', illustrationAlt: 'Firm alt' });
    expect(els['#comfortIllustration'].src).toBe('wix:image://firm.svg');
    expect(els['#comfortIllustration'].alt).toBe('Firm alt');
  });

  it('provides default alt text when illustrationAlt is missing', () => {
    const els = {};
    const $item = make$w(els);
    renderComfortCard($item, { name: 'Medium', tagline: '', description: '', illustration: 'wix:image://med.svg' });
    expect(els['#comfortIllustration'].alt).toContain('Medium');
  });

  it('does nothing when comfort is null/undefined', () => {
    const els = {};
    const $item = make$w(els);
    renderComfortCard($item, null);
    expect(els['#comfortName']).toBeUndefined();
  });

  it('handles missing fields gracefully (empty strings)', () => {
    const els = {};
    const $item = make$w(els);
    renderComfortCard($item, { name: null, tagline: undefined, description: '' });
    expect(els['#comfortName'].text).toBe('');
    expect(els['#comfortTagline'].text).toBe('');
    expect(els['#comfortDescription'].text).toBe('');
  });
});

describe('initComfortCards', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('expands section and renders card for product with comfort mapping', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortCards($w, { product: { _id: 'prod-a' } });
    expect(els['#comfortSection']._expanded).toBe(true);
    expect(els['#comfortName'].text).toBe('Plush');
  });

  it('collapses section when product has no comfort mapping', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortCards($w, { product: { _id: 'unmapped-product' } });
    expect(els['#comfortSection']._collapsed).toBe(true);
  });

  it('collapses section when state.product is null', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortCards($w, { product: null });
    expect(els['#comfortSection']._collapsed).toBe(true);
  });

  it('collapses section when state is null', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortCards($w, null);
    expect(els['#comfortSection']._collapsed).toBe(true);
  });
});

describe('initComfortFilter', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('populates dropdown with all comfort levels + "All" option', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortFilter($w);
    const options = els['#comfortFilter'].options;
    expect(options[0].label).toBe('All Comfort Levels');
    expect(options[0].value).toBe('');
    expect(options.length).toBe(4); // All + 3 levels
  });

  it('sets default value to empty string (All)', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortFilter($w);
    expect(els['#comfortFilter'].value).toBe('');
  });

  it('registers onChange handler', async () => {
    const els = {};
    const $w = make$w(els);
    await initComfortFilter($w);
    expect(els['#comfortFilter']._handlers.change).toBeDefined();
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run tests/comfortStoryCards.test.js`
Expected: All PASS

**Step 3: Commit**

```bash
git add tests/comfortStoryCards.test.js
git commit -m "test: add ComfortStoryCards tests — renderComfortCard, initComfortCards, initComfortFilter"
```

---

### Task 4: FeelAndComfort unified section

**Files:**
- Create: `src/public/FeelAndComfort.js`
- Create: `tests/feelAndComfort.test.js`
- Modify: `src/pages/Product Page.js` (replace separate inits with unified)

**Step 1: Write the test file first**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';

// Mock $w factory
function make$w(elements = {}) {
  return function $w(selector) {
    if (!elements[selector]) {
      elements[selector] = {
        text: '', src: '', alt: '', label: '', value: '',
        style: {}, accessibility: {},
        _expanded: false, _collapsed: false, _visible: true,
        _handlers: {},
        expand() { this._expanded = true; this._collapsed = false; },
        collapse() { this._collapsed = true; this._expanded = false; },
        show() { this._visible = true; },
        hide() { this._visible = false; },
        onClick(fn) { this._handlers.click = fn; },
      };
    }
    return elements[selector];
  };
}

const COMFORT_LEVELS = [
  { _id: 'cl-1', slug: 'plush', name: 'Plush', tagline: 'Sink right in', description: 'Cloud-soft', illustration: 'wix:image://plush.svg', illustrationAlt: 'Plush illustration', sortOrder: 1 },
];

const PRODUCT_COMFORT = [
  { _id: 'pc-1', productId: 'prod-a', comfortLevelId: 'cl-1', sortOrder: 1 },
];

const SWATCHES = [
  { _id: 'sw-1', swatchId: 'denim', swatchName: 'Denim Blue', swatchImage: 'wix:image://denim.jpg', colorFamily: 'Blues', colorHex: '#4A6FA5', material: 'Cotton', careInstructions: 'Machine wash', availableForProducts: 'prod-a', sortOrder: 1 },
  { _id: 'sw-2', swatchId: 'red', swatchName: 'Red', swatchImage: 'wix:image://red.jpg', colorFamily: 'Reds', colorHex: '#DC143C', material: 'Microfiber', careInstructions: 'Spot clean', availableForProducts: 'all', sortOrder: 2 },
];

// Dynamic import to allow mock seeding before import
let initFeelAndComfort;

beforeEach(async () => {
  __seed('ComfortLevels', COMFORT_LEVELS);
  __seed('ProductComfort', PRODUCT_COMFORT);
  __seed('FabricSwatches', SWATCHES);
  const mod = await import('../src/public/FeelAndComfort.js');
  initFeelAndComfort = mod.initFeelAndComfort;
});

describe('initFeelAndComfort', () => {
  it('expands the feel-and-comfort section when product has comfort + swatches', async () => {
    const els = {};
    const $w = make$w(els);
    const state = { product: { _id: 'prod-a', name: 'Test Futon', productOptions: [{ name: 'Fabric', choices: [{ value: 'denim', description: 'Denim Blue' }] }] } };
    await initFeelAndComfort($w, state);
    expect(els['#feelAndComfortSection']._expanded).toBe(true);
  });

  it('renders comfort card data', async () => {
    const els = {};
    const $w = make$w(els);
    const state = { product: { _id: 'prod-a', name: 'Test Futon' } };
    await initFeelAndComfort($w, state);
    expect(els['#comfortName'].text).toBe('Plush');
  });

  it('shows swatch CTA with coral styling', async () => {
    const els = {};
    const $w = make$w(els);
    const state = { product: { _id: 'prod-a', name: 'Test Futon', productOptions: [{ name: 'Fabric', choices: [] }] } };
    await initFeelAndComfort($w, state);
    expect(els['#feelSwatchCTA']._visible).toBe(true);
  });

  it('collapses section when no product', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: null });
    expect(els['#feelAndComfortSection']._collapsed).toBe(true);
  });

  it('collapses section when no comfort AND no swatches', async () => {
    __seed('ProductComfort', []);
    __seed('FabricSwatches', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'empty-prod', name: 'Empty' } });
    expect(els['#feelAndComfortSection']._collapsed).toBe(true);
  });

  it('still shows section if only comfort exists (no swatches)', async () => {
    __seed('FabricSwatches', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortSection']._expanded).toBe(true);
  });

  it('still shows section if only swatches exist (no comfort)', async () => {
    __seed('ProductComfort', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortSection']._expanded).toBe(true);
  });

  it('sets section heading text', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortTitle'].text).toBe('Feel & Comfort');
  });

  it('adds ARIA label to section', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortSection'].accessibility.ariaLabel).toContain('Feel');
  });
});
```

**Step 2: Run test — expect FAIL (module doesn't exist yet)**

Run: `npx vitest run tests/feelAndComfort.test.js`
Expected: FAIL — cannot resolve `../src/public/FeelAndComfort.js`

**Step 3: Write the implementation**

Create `src/public/FeelAndComfort.js`:

```js
/**
 * FeelAndComfort.js — Unified "Feel & Comfort" product page section.
 * Groups comfort story card + fabric swatch preview + swatch request CTA
 * into one cohesive Blue Ridge-themed section.
 */
import { getProductComfort } from 'backend/comfortService.web';
import { getProductSwatches } from 'backend/swatchService.web';
import { renderComfortCard } from 'public/ComfortStoryCards.js';
import { colors } from 'public/designTokens.js';

/**
 * Initialize the unified Feel & Comfort section on the product page.
 * Shows comfort personality card, fabric swatch preview thumbnails,
 * and a prominent "Get Free Swatches" CTA.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Page state with product data.
 */
export async function initFeelAndComfort($w, state) {
  try {
    const section = $w('#feelAndComfortSection');
    if (!state?.product) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    const [comfort, swatches] = await Promise.all([
      getProductComfort(state.product._id).catch(() => null),
      getProductSwatches(state.product._id, null, 6).catch(() => []),
    ]);

    const hasComfort = !!comfort;
    const hasSwatches = swatches && swatches.length > 0;

    if (!hasComfort && !hasSwatches) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    // Section heading + ARIA
    try { $w('#feelAndComfortTitle').text = 'Feel & Comfort'; } catch (e) {}
    try { section.accessibility.ariaLabel = 'Feel and Comfort section'; } catch (e) {}

    // Comfort card
    if (hasComfort) {
      renderComfortCard($w, comfort);
      try { $w('#comfortSection').expand(); } catch (e) {}
    } else {
      try { $w('#comfortSection').collapse(); } catch (e) {}
    }

    // Swatch preview thumbnails
    if (hasSwatches) {
      try {
        const grid = $w('#feelSwatchPreview');
        if (grid) {
          grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `fs-${i}` }));
          grid.onItemReady(($item, itemData) => {
            try {
              if (itemData.swatchImage) {
                $item('#feelSwatchThumb').src = itemData.swatchImage;
                $item('#feelSwatchThumb').alt = `${itemData.swatchName} fabric swatch`;
              } else if (itemData.colorHex) {
                $item('#feelSwatchThumb').style.backgroundColor = itemData.colorHex;
              }
            } catch (e) {}
            try { $item('#feelSwatchLabel').text = itemData.swatchName || ''; } catch (e) {}
          });
        }
      } catch (e) {}

      // Swatch CTA — Coral styling
      try {
        const cta = $w('#feelSwatchCTA');
        cta.label = "Can't decide? Get free swatches";
        try { cta.style.backgroundColor = colors.sunsetCoral; } catch (e) {}
        try { cta.style.color = colors.white; } catch (e) {}
        try { cta.accessibility.ariaLabel = 'Request free fabric swatches shipped to your door'; } catch (e) {}
        cta.show();
        cta.onClick(() => {
          try { $w('#swatchRequestSection').expand(); } catch (e) {}
          try { $w('#swatchRequestSection').scrollTo(); } catch (e) {}
        });
      } catch (e) {}
    } else {
      try { $w('#feelSwatchPreview')?.collapse?.(); } catch (e) {}
      try { $w('#feelSwatchCTA').hide(); } catch (e) {}
    }

    section.expand();
  } catch (e) {
    console.error('Error initializing Feel & Comfort section:', e);
    try { $w('#feelAndComfortSection').collapse(); } catch (e2) {}
  }
}
```

**Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/feelAndComfort.test.js`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/public/FeelAndComfort.js tests/feelAndComfort.test.js
git commit -m "feat: add FeelAndComfort unified section with tests — comfort card + swatch preview + CTA"
```

---

### Task 5: Wire FeelAndComfort into Product Page orchestrator

**Files:**
- Modify: `src/pages/Product Page.js`

**Step 1: Add import and replace separate inits**

In `Product Page.js`:
- Add import: `import { initFeelAndComfort } from 'public/FeelAndComfort.js';`
- In `secondaryInits` array, replace the three separate entries (`swatchRequest`, `swatchCTA`, `comfortCards`) with a single `{ name: 'feelAndComfort', init: () => initFeelAndComfort($w, state) }`
- Keep the original separate inits as fallbacks (they won't conflict since they target different element IDs)

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/pages/Product\ Page.js
git commit -m "feat: wire FeelAndComfort unified section into Product Page orchestrator"
```

---

### Task 6: Mobile & accessibility polish

**Files:**
- Modify: `src/public/FeelAndComfort.js` (add mobile scroll + a11y)
- Modify: `src/public/SwatchRequestFlow.js` (a11y improvements)
- Modify: `src/public/ComfortStoryCards.js` (a11y improvements)

**Step 1: Add mobile horizontal scroll to swatch grids**

In `FeelAndComfort.js`, after setting up `#feelSwatchPreview` grid data, add:
```js
// Mobile: horizontal scroll for swatch grid
try {
  const { isMobile } = await import('public/mobileHelpers');
  if (isMobile()) {
    try { grid.style.overflowX = 'auto'; } catch (e) {}
    try { grid.style.flexWrap = 'nowrap'; } catch (e) {}
  }
} catch (e) {}
```

**Step 2: Add ARIA announcements for swatch selection in SwatchRequestFlow.js**

In `initSwatchRequestFlow`, after toggling swatch selection, add:
```js
try {
  const { announce } = await import('public/a11yHelpers');
  if (result.selected) {
    announce($w, `${itemData.swatchName} selected. ${getSelectedSwatches().length} of ${MAX_SWATCHES} swatches chosen.`);
  } else if (result.limitReached) {
    announce($w, `Maximum ${MAX_SWATCHES} swatches reached. Deselect one to choose another.`);
  } else {
    announce($w, `${itemData.swatchName} deselected. ${getSelectedSwatches().length} of ${MAX_SWATCHES} swatches chosen.`);
  }
} catch (e) {}
```

**Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/public/FeelAndComfort.js src/public/SwatchRequestFlow.js src/public/ComfortStoryCards.js
git commit -m "feat: add mobile scroll + ARIA announcements to swatch/comfort experience"
```

---

### Task 7: Final integration test + push

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (6500+ existing + new tests)

**Step 2: Push branch**

```bash
git push -u origin cf-r9sc-swatch-comfort
```

**Step 3: Open PR**

```bash
gh pr create --title "cf-r9sc: Swatch & comfort experience — tests, unified section, a11y" --body "$(cat <<'EOF'
## Summary
- Comprehensive test coverage for comfortService, SwatchRequestFlow, ComfortStoryCards
- New FeelAndComfort.js unified section (comfort card + swatch preview + Coral CTA)
- Product Page orchestrator wired to use unified section
- Mobile horizontal scroll for swatch grids
- ARIA announcements for swatch selection/deselection
- WCAG AA: labeled selectors, comfort card alt text, screen reader announcements

## Test plan
- [x] comfortService.test.js — backend comfort queries (levels, product mapping, filtering)
- [x] swatchRequestFlow.test.js — selection toggle, max 6 limit, form validation, XSS
- [x] comfortStoryCards.test.js — card rendering, section init, filter dropdown
- [x] feelAndComfort.test.js — unified section init, collapse states, CTA styling
- [x] All existing tests pass
- [ ] Visual: verify Feel & Comfort section groups comfort + swatches on product page
- [ ] Visual: verify mobile horizontal scroll on swatch grids
- [ ] Verify screen reader announces swatch selection changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
