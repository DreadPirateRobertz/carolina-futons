import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from '../__mocks__/wix-data.js';

// Mock $w element factory
function make$w(elements = {}) {
  return function $w(selector) {
    if (!elements[selector]) {
      elements[selector] = {
        text: '', src: '', alt: '', label: '', value: '',
        style: {}, accessibility: {},
        _expanded: false, _collapsed: false, _visible: true,
        _handlers: {},
        data: null,
        expand() { this._expanded = true; this._collapsed = false; },
        collapse() { this._collapsed = true; this._expanded = false; },
        show() { this._visible = true; },
        hide() { this._visible = false; },
        onClick(fn) { this._handlers.click = fn; },
        scrollTo() {},
        onItemReady(fn) { this._itemReadyFn = fn; },
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

const SWATCHES = [
  { _id: 'sw-1', swatchId: 'denim', swatchName: 'Denim Blue', swatchImage: 'wix:image://denim.jpg', colorFamily: 'Blues', colorHex: '#4A6FA5', material: 'Cotton', careInstructions: 'Machine wash', availableForProducts: 'prod-a', sortOrder: 1 },
  { _id: 'sw-2', swatchId: 'red', swatchName: 'Red', swatchImage: 'wix:image://red.jpg', colorFamily: 'Reds', colorHex: '#DC143C', material: 'Microfiber', careInstructions: 'Spot clean', availableForProducts: 'all', sortOrder: 2 },
];

let initFeelAndComfort;

beforeEach(async () => {
  __seed('ComfortLevels', COMFORT_LEVELS);
  __seed('ProductComfort', PRODUCT_COMFORT);
  __seed('FabricSwatches', SWATCHES);
  // Fresh import each time to avoid stale module state
  const mod = await import('../../src/public/FeelAndComfort.js');
  initFeelAndComfort = mod.initFeelAndComfort;
});

describe('initFeelAndComfort', () => {
  it('expands section when product has comfort data', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test Futon' } });
    expect(els['#feelAndComfortSection']._expanded).toBe(true);
  });

  it('renders comfort card name', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test Futon' } });
    expect(els['#comfortName'].text).toBe('Plush');
  });

  it('sets section heading to "Feel & Comfort"', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test Futon' } });
    expect(els['#feelAndComfortTitle'].text).toBe('Feel & Comfort');
  });

  it('adds ARIA label to section', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortSection'].accessibility.ariaLabel).toContain('Feel');
  });

  it('shows swatch CTA when swatches exist', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test', productOptions: [{ name: 'Fabric', choices: [] }] } });
    expect(els['#feelSwatchCTA']._visible).toBe(true);
    expect(els['#feelSwatchCTA'].label).toContain('swatch');
  });

  it('sets swatch preview grid data', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelSwatchPreview'].data).not.toBeNull();
    expect(els['#feelSwatchPreview'].data.length).toBeGreaterThan(0);
  });

  it('collapses section when no product', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: null });
    expect(els['#feelAndComfortSection']._collapsed).toBe(true);
  });

  it('collapses section when state is null', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, null);
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
    expect(els['#comfortName'].text).toBe('Plush');
  });

  it('still shows section if only swatches exist (no comfort)', async () => {
    __seed('ProductComfort', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelAndComfortSection']._expanded).toBe(true);
  });

  it('hides swatch CTA when no swatches', async () => {
    __seed('FabricSwatches', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelSwatchCTA']._visible).toBe(false);
  });

  it('collapses comfort sub-section when no comfort data', async () => {
    __seed('ProductComfort', []);
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#comfortSection']._collapsed).toBe(true);
  });

  it('registers click handler on swatch CTA', async () => {
    const els = {};
    const $w = make$w(els);
    await initFeelAndComfort($w, { product: { _id: 'prod-a', name: 'Test' } });
    expect(els['#feelSwatchCTA']._handlers.click).toBeDefined();
  });
});
