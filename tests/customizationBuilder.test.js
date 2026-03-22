import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, callForPriceProduct } from './fixtures/products.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/customizationService.web', () => ({
  getCustomizationOptions: vi.fn().mockResolvedValue({
    swatches: [
      { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', material: 'Cotton', priceTier: 'standard', swatchImage: 'img1.jpg', colorFamily: 'blue' },
      { _id: 'sw-2', swatchName: 'Crimson Velvet', colorHex: '#8B0000', material: 'Velvet', priceTier: 'premium', swatchImage: 'img2.jpg', colorFamily: 'red' },
      { _id: 'sw-3', swatchName: 'Organic Hemp', colorHex: '#C4B896', material: 'Hemp', priceTier: 'luxury', swatchImage: 'img3.jpg', colorFamily: 'neutral' },
    ],
    pricingRules: [
      { tier: 'standard', surchargePercent: 0, surchargeFlat: 0, label: 'Standard Fabric' },
      { tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium Fabric (+15%)' },
      { tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury Fabric (+$75)' },
    ],
  }),
  calculateCustomizationPrice: vi.fn((base, tier, rules) => {
    if (tier === 'premium') return { basePrice: base, surcharge: 74.85, totalPrice: 573.85, surchargeLabel: 'Premium Fabric (+15%)' };
    if (tier === 'luxury') return { basePrice: base, surcharge: 75, totalPrice: 574, surchargeLabel: 'Luxury Fabric (+$75)' };
    return { basePrice: base, surcharge: 0, totalPrice: base, surchargeLabel: 'Standard Fabric' };
  }),
  saveConfiguration: vi.fn().mockResolvedValue({ _id: 'cfg-new' }),
  getSavedConfigurations: vi.fn().mockResolvedValue([]),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sandBase: '#E8D5B7', sandDark: '#D4BC96', espresso: '#3A2518',
    mountainBlue: '#5B8FA8', sunsetCoral: '#E8845C', offWhite: '#FAF7F2',
    success: '#4A7C59', error: '#C0392B', muted: '#767676',
  },
}));

vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  isCallForPrice: vi.fn((product) => (product?.price ?? Infinity) <= 1),
  CALL_FOR_PRICE_TEXT: 'Call for Pricing \u2014 (828) 327-8030',
}));

vi.mock('public/mobileHelpers.js', () => ({
  isMobile: vi.fn(() => false),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

// wix-members-frontend resolves via alias to the __mocks__ file which returns
// getMember() → null (anonymous user). Tests exercise the local storage path.
// For logged-in member tests, we test backend APIs directly in customizationService.test.js.

import {
  initCustomizationBuilder,
  selectCustomizationSwatch,
  updateCustomizationPreview,
  updateCustomizationPrice,
  saveCustomization,
  loadSavedCustomizations,
} from '../src/public/CustomizationBuilder.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', html: '', label: '',
    data: [],
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onInput: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    focus: vi.fn(),
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

// ── Tests ────────────────────────────────────────────────────────────

describe('CustomizationBuilder', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = {
      product: { ...futonFrame, _id: 'prod-1', price: 499 },
      selectedSwatchId: null,
      selectedQuantity: 1,
      customization: null,
    };
  });

  // ── initCustomizationBuilder ──

  describe('initCustomizationBuilder', () => {
    it('initializes and expands customization section when product exists', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').expand).toHaveBeenCalled();
    });

    it('collapses section when product is null', async () => {
      state.product = null;
      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').collapse).toHaveBeenCalled();
    });

    it('renders swatch grid with available fabrics', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSwatchGrid').data).toHaveLength(3);
    });

    it('sets up swatch item click handlers via onItemReady', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSwatchGrid').onItemReady).toHaveBeenCalled();
    });

    it('shows pricing info section', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custPricingSection').expand).toHaveBeenCalled();
    });

    it('displays base price initially', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custBasePrice').text).toContain('$499');
    });

    it('collapses section when no swatches available', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockResolvedValueOnce({ swatches: [], pricingRules: [] });

      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').collapse).toHaveBeenCalled();
    });

    it('handles API error and collapses section', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockRejectedValueOnce(new Error('Network error'));

      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').collapse).toHaveBeenCalled();
    });

    it('disables save button initially', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSaveBtn').disable).toHaveBeenCalled();
    });

    it('registers save button click handler', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSaveBtn').onClick).toHaveBeenCalled();
    });

    it('sets product mainMedia as preview image', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custPreviewImage').src).toBe('https://example.com/eureka.jpg');
    });

    it('initializes state.customization to null', async () => {
      state.customization = { fabricSwatchId: 'old' };
      await initCustomizationBuilder($w, state);
      expect(state.customization).toBeNull();
    });

    it('assigns _id fallback for swatches without _id', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockResolvedValueOnce({
        swatches: [{ swatchName: 'No ID', colorHex: '#FFF', swatchImage: null }],
        pricingRules: [],
      });
      await initCustomizationBuilder($w, state);
      expect($w('#custSwatchGrid').data[0]._id).toBe('cust-sw-0');
    });

    it('collapses surcharge section for normal-price products', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSurchargeSection').collapse).toHaveBeenCalled();
    });

    it('collapses when swatches is null', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockResolvedValueOnce({ swatches: null, pricingRules: [] });
      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').collapse).toHaveBeenCalled();
    });
  });

  // ── selectCustomizationSwatch ──

  describe('selectCustomizationSwatch', () => {
    it('updates state with selected swatch', () => {
      const swatch = { _id: 'sw-2', swatchName: 'Crimson Velvet', colorHex: '#8B0000', priceTier: 'premium' };
      selectCustomizationSwatch($w, state, swatch, []);

      expect(state.customization).toBeTruthy();
      expect(state.customization.fabricSwatchId).toBe('sw-2');
      expect(state.customization.fabricName).toBe('Crimson Velvet');
    });

    it('updates selected swatch display', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);

      expect($w('#custSelectedName').text).toBe('Coastal Blue');
    });

    it('triggers preview update', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);

      // Preview overlay should be shown with the color
      expect($w('#custPreviewOverlay').show).toHaveBeenCalled();
    });

    it('triggers price update', () => {
      const rules = [{ tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium (+15%)' }];
      const swatch = { _id: 'sw-2', swatchName: 'Crimson Velvet', colorHex: '#8B0000', priceTier: 'premium' };
      selectCustomizationSwatch($w, state, swatch, rules);

      expect($w('#custTotalPrice').text).toContain('$');
    });

    it('enables save button after selection', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);

      expect($w('#custSaveBtn').enable).toHaveBeenCalled();
    });

    it('sets material display text with prefix', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', material: 'Cotton', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect($w('#custSelectedMaterial').text).toBe('Material: Cotton');
    });

    it('sets empty material text when material is missing', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', material: null, priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect($w('#custSelectedMaterial').text).toBe('');
    });

    it('announces selected fabric for screen readers', async () => {
      const { announce } = await import('public/a11yHelpers.js');
      const swatch = { _id: 'sw-2', swatchName: 'Crimson Velvet', colorHex: '#8B0000', priceTier: 'premium' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect(announce).toHaveBeenCalledWith($w, 'Selected Crimson Velvet fabric');
    });

    it('refreshes grid data to update selection borders', async () => {
      await initCustomizationBuilder($w, state);
      const origData = $w('#custSwatchGrid').data;
      const swatch = { _id: 'sw-1', swatchName: 'X', colorHex: '#000', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect($w('#custSwatchGrid').data).not.toBe(origData);
      expect($w('#custSwatchGrid').data).toHaveLength(origData.length);
    });

    it('defaults priceTier to standard when missing', () => {
      const swatch = { _id: 'sw-x', swatchName: 'Plain', colorHex: '#AAA' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect(state.customization.priceTier).toBe('standard');
    });
  });

  // ── updateCustomizationPreview ──

  describe('updateCustomizationPreview', () => {
    it('applies color overlay to preview image', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', 'img1.jpg');

      expect($w('#custPreviewOverlay').style.backgroundColor).toBe('#5B8FA8');
      expect($w('#custPreviewOverlay').show).toHaveBeenCalled();
    });

    it('sets swatch texture image when available', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', 'img1.jpg');

      expect($w('#custPreviewSwatch').src).toBe('img1.jpg');
      expect($w('#custPreviewSwatch').show).toHaveBeenCalled();
    });

    it('hides swatch texture when no image provided', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', null);

      expect($w('#custPreviewSwatch').hide).toHaveBeenCalled();
    });

    it('handles missing preview elements gracefully', () => {
      const broken$w = () => { throw new Error('Element not found'); };
      expect(() => updateCustomizationPreview(broken$w, state, '#FFF', null)).not.toThrow();
    });

    it('sets preview overlay opacity to 0.25', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', 'img.jpg');
      expect($w('#custPreviewOverlay').style.opacity).toBe('0.25');
    });

    it('sets swatch preview alt text', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', 'img.jpg');
      expect($w('#custPreviewSwatch').alt).toBe('Selected fabric swatch preview');
    });
  });

  // ── updateCustomizationPrice ──

  describe('updateCustomizationPrice', () => {
    it('displays base price and surcharge for premium tier', () => {
      const rules = [{ tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium Fabric (+15%)' }];
      updateCustomizationPrice($w, state, 'premium', rules);

      expect($w('#custSurcharge').text).toContain('$74.85');
      expect($w('#custTotalPrice').text).toContain('$573.85');
      expect($w('#custSurchargeSection').expand).toHaveBeenCalled();
    });

    it('hides surcharge section for standard tier', () => {
      const rules = [{ tier: 'standard', surchargePercent: 0, surchargeFlat: 0, label: 'Standard Fabric' }];
      updateCustomizationPrice($w, state, 'standard', rules);

      expect($w('#custSurchargeSection').collapse).toHaveBeenCalled();
    });

    it('updates state with total price', () => {
      state.customization = { fabricSwatchId: 'sw-3', fabricName: 'Organic Hemp', fabricColorHex: '#C4B896', priceTier: 'luxury', totalPrice: 0 };
      const rules = [{ tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury (+$75)' }];
      updateCustomizationPrice($w, state, 'luxury', rules);

      expect(state.customization.totalPrice).toBe(574);
    });

    it('sets surcharge label text for premium', () => {
      const rules = [{ tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium Fabric (+15%)' }];
      updateCustomizationPrice($w, state, 'premium', rules);
      expect($w('#custSurchargeLabel').text).toBe('Premium Fabric (+15%)');
    });

    it('sets surcharge label text for luxury', () => {
      const rules = [{ tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury Fabric (+$75)' }];
      updateCustomizationPrice($w, state, 'luxury', rules);
      expect($w('#custSurchargeLabel').text).toBe('Luxury Fabric (+$75)');
      expect($w('#custSurcharge').text).toBe('+$75.00');
    });

    it('does not update state.customization.totalPrice when customization is null', () => {
      state.customization = null;
      const rules = [];
      updateCustomizationPrice($w, state, 'standard', rules);
      expect(state.customization).toBeNull();
    });
  });

  // ── saveCustomization ──
  // Note: wix-members-frontend mock returns getMember() → null (anonymous user),
  // so save tests exercise the local storage fallback path.

  describe('saveCustomization', () => {
    beforeEach(() => {
      state.customization = {
        fabricSwatchId: 'sw-2',
        fabricName: 'Crimson Velvet',
        fabricColorHex: '#8B0000',
        priceTier: 'premium',
        totalPrice: 573.85,
      };
    });

    it('saves configuration to local storage for anonymous users', async () => {
      await saveCustomization($w, state);
      // Anonymous save shows success via local storage path
      expect($w('#custSaveSuccess').show).toHaveBeenCalled();
      expect($w('#custSaveSuccess').text).toContain('saved');
    });

    it('shows error when no customization selected', async () => {
      state.customization = null;

      await saveCustomization($w, state);
      expect($w('#custSaveError').show).toHaveBeenCalled();
    });

    it('disables save button during save', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveBtn').disable).toHaveBeenCalled();
    });

    it('re-enables save button in finally block after success', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveBtn').enable).toHaveBeenCalled();
    });

    it('uses config name from input field', async () => {
      $w('#custConfigName').value = 'My Custom Setup';
      await saveCustomization($w, state);
      expect($w('#custSaveSuccess').text).toContain('saved');
    });

    it('announces save success for screen readers', async () => {
      const { announce } = await import('public/a11yHelpers.js');
      await saveCustomization($w, state);
      expect(announce).toHaveBeenCalledWith($w, 'Configuration saved successfully');
    });

    it('shows error text when no customization selected', async () => {
      state.customization = null;
      await saveCustomization($w, state);
      expect($w('#custSaveError').text).toBe('Please select a fabric first.');
    });

    it('hides previous error and success messages on save attempt', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveError').hide).toHaveBeenCalled();
      expect($w('#custSaveSuccess').hide).toHaveBeenCalled();
    });
  });

  // ── loadSavedCustomizations ──
  // Note: with anonymous user (getMember → null), loads from local storage

  describe('loadSavedCustomizations', () => {
    it('collapses saved section when no local configs found', async () => {
      await loadSavedCustomizations($w, state);
      expect($w('#custSavedSection').collapse).toHaveBeenCalled();
    });

    it('handles API error gracefully', async () => {
      const { getSavedConfigurations } = await import('backend/customizationService.web');
      getSavedConfigurations.mockRejectedValueOnce(new Error('Network error'));

      await loadSavedCustomizations($w, state);
      expect($w('#custSavedSection').collapse).toHaveBeenCalled();
    });

    it('renders saved config list via onItemReady', async () => {
      globalThis.sessionStorage.setItem('cf_saved_configs', JSON.stringify([
        { _id: 'local-1', productId: 'prod-1', configName: 'Blue Setup', fabricName: 'Coastal Blue', fabricColorHex: '#5B8FA8', totalPrice: 499 },
      ]));

      await loadSavedCustomizations($w, state);
      expect($w('#custSavedList').onItemReady).toHaveBeenCalled();
      expect($w('#custSavedSection').expand).toHaveBeenCalled();

      const listCb = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const $item = create$w();
      listCb($item, { _id: 'local-1', configName: 'Blue Setup', fabricName: 'Coastal Blue', fabricColorHex: '#5B8FA8', totalPrice: 499 });

      expect($item('#savedConfigName').text).toBe('Blue Setup');
      expect($item('#savedFabricName').text).toBe('Coastal Blue');
      expect($item('#savedColorDot').style.backgroundColor).toBe('#5B8FA8');
      expect($item('#savedPrice').text).toBe('$499.00');
      expect($item('#savedLoadBtn').onClick).toHaveBeenCalled();
    });

    it('shows Untitled for config with no name', async () => {
      globalThis.sessionStorage.setItem('cf_saved_configs', JSON.stringify([
        { _id: 'local-2', productId: 'prod-1', configName: '', fabricName: 'X', fabricColorHex: '#000', totalPrice: 100 },
      ]));

      await loadSavedCustomizations($w, state);
      const listCb = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const $item = create$w();
      listCb($item, { _id: 'local-2', configName: '', fabricName: 'X', totalPrice: 100 });
      expect($item('#savedConfigName').text).toBe('Untitled');
    });

    it('load button click applies saved config to state', async () => {
      globalThis.sessionStorage.setItem('cf_saved_configs', JSON.stringify([
        { _id: 'local-3', productId: 'prod-1', configName: 'Hemp Setup', fabricName: 'Organic Hemp', fabricSwatchId: 'sw-3', fabricColorHex: '#C4B896', priceTier: 'luxury', totalPrice: 574 },
      ]));

      await loadSavedCustomizations($w, state);
      const listCb = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const $item = create$w();
      const configData = { _id: 'local-3', configName: 'Hemp Setup', fabricName: 'Organic Hemp', fabricSwatchId: 'sw-3', fabricColorHex: '#C4B896', priceTier: 'luxury', totalPrice: 574 };
      listCb($item, configData);

      const loadCb = $item('#savedLoadBtn').onClick.mock.calls[0][0];
      loadCb();

      expect(state.customization).toBeTruthy();
      expect(state.customization.fabricSwatchId).toBe('sw-3');
      expect(state.customization.fabricName).toBe('Organic Hemp');
    });

    it('applySavedConfig announces loaded config name', async () => {
      const { announce } = await import('public/a11yHelpers.js');

      globalThis.sessionStorage.setItem('cf_saved_configs', JSON.stringify([
        { _id: 'local-4', productId: 'prod-1', configName: 'My Fave', fabricName: 'Coastal Blue', fabricSwatchId: 'sw-1', fabricColorHex: '#5B8FA8', priceTier: 'standard', totalPrice: 499 },
      ]));

      await loadSavedCustomizations($w, state);
      const listCb = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const $item = create$w();
      listCb($item, { _id: 'local-4', configName: 'My Fave', fabricName: 'Coastal Blue', fabricSwatchId: 'sw-1', fabricColorHex: '#5B8FA8', priceTier: 'standard', totalPrice: 499 });
      const loadCb = $item('#savedLoadBtn').onClick.mock.calls[0][0];
      loadCb();

      expect(announce).toHaveBeenCalledWith($w, 'Loaded configuration: My Fave');
    });

    it('filters local configs by productId', async () => {
      globalThis.sessionStorage.setItem('cf_saved_configs', JSON.stringify([
        { _id: 'local-a', productId: 'other-product', configName: 'Other', fabricName: 'X', totalPrice: 100 },
        { _id: 'local-b', productId: 'prod-1', configName: 'Match', fabricName: 'Y', totalPrice: 200 },
      ]));

      await loadSavedCustomizations($w, state);
      expect($w('#custSavedList').data).toHaveLength(1);
      expect($w('#custSavedList').data[0].configName).toBe('Match');
    });
  });

  // ── renderCustomizationSwatches onItemReady ──

  describe('renderCustomizationSwatches (via onItemReady)', () => {
    let callback;
    beforeEach(async () => {
      await initCustomizationBuilder($w, state);
      callback = $w('#custSwatchGrid').onItemReady.mock.calls[0][0];
    });

    it('sets thumbnail src and alt for image swatch', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Coastal Blue', swatchImage: 'img1.jpg', colorHex: '#5B8FA8' });
      expect($item('#custSwThumb').src).toBe('img1.jpg');
      expect($item('#custSwThumb').alt).toBe('Coastal Blue fabric swatch');
    });

    it('sets background color when no swatchImage', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-x', swatchName: 'Plain Red', swatchImage: null, colorHex: '#FF0000' });
      expect($item('#custSwThumb').style.backgroundColor).toBe('#FF0000');
    });

    it('sets label text from swatchName', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Coastal Blue', swatchImage: 'img.jpg' });
      expect($item('#custSwLabel').text).toBe('Coastal Blue');
    });

    it('sets material badge text', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'X', material: 'Cotton', swatchImage: 'img.jpg' });
      expect($item('#custSwMaterial').text).toBe('Cotton');
    });

    it('shows +15% badge for premium tier', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-2', swatchName: 'X', priceTier: 'premium', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').text).toBe('+15%');
      expect($item('#custSwTierBadge').show).toHaveBeenCalled();
    });

    it('shows +$75 badge for luxury tier', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-3', swatchName: 'X', priceTier: 'luxury', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').text).toBe('+$75');
      expect($item('#custSwTierBadge').show).toHaveBeenCalled();
    });

    it('hides tier badge for standard tier', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'X', priceTier: 'standard', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').hide).toHaveBeenCalled();
    });

    it('registers click handler on swatch thumbnail', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Coastal Blue', priceTier: 'standard', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').onClick).toHaveBeenCalled();
    });

    it('sets non-selected border style', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'X', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').style.borderColor).toBe('#D4BC96');
      expect($item('#custSwThumb').style.borderWidth).toBe('1px');
    });

    it('sets selected border style for active swatch', () => {
      state.customization = { fabricSwatchId: 'sw-1' };
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'X', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').style.borderColor).toBe('#5B8FA8');
      expect($item('#custSwThumb').style.borderWidth).toBe('3px');
    });

    it('sets empty label when swatchName is missing', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-x', swatchName: null, swatchImage: 'img.jpg' });
      expect($item('#custSwLabel').text).toBe('');
    });

    it('sets empty material when missing', () => {
      const $item = create$w();
      callback($item, { _id: 'sw-x', swatchName: 'X', material: null, swatchImage: 'img.jpg' });
      expect($item('#custSwMaterial').text).toBe('');
    });
  });

  // ── initFabricFilter ──

  describe('initFabricFilter (via init)', () => {
    it('sets filter options with capitalized labels', async () => {
      await initCustomizationBuilder($w, state);
      const opts = $w('#custFabricFilter').options;
      expect(opts[0]).toEqual({ label: 'All Fabrics', value: '' });
      expect(opts.some(o => o.label === 'Blue')).toBe(true);
      expect(opts.some(o => o.label === 'Red')).toBe(true);
      expect(opts.some(o => o.label === 'Neutral')).toBe(true);
    });

    it('registers onChange handler on fabric filter', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custFabricFilter').onChange).toHaveBeenCalled();
    });

    it('filters swatches when onChange fires', async () => {
      await initCustomizationBuilder($w, state);
      const filterCb = $w('#custFabricFilter').onChange.mock.calls[0][0];

      $w('#custFabricFilter').value = 'blue';
      filterCb();

      expect($w('#custSwatchGrid').data).toHaveLength(1);
      expect($w('#custSwatchGrid').data[0].colorFamily).toBe('blue');
    });

    it('shows all swatches when filter value is empty', async () => {
      await initCustomizationBuilder($w, state);
      const filterCb = $w('#custFabricFilter').onChange.mock.calls[0][0];

      $w('#custFabricFilter').value = '';
      filterCb();

      expect($w('#custSwatchGrid').data).toHaveLength(3);
    });
  });

  // ── Accessibility ──

  describe('accessibility', () => {
    it('sets ARIA labels on swatch grid', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSwatchGrid').accessibility.ariaLabel).toBe('Fabric selection grid');
    });

    it('sets ARIA label on preview area', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custPreviewArea').accessibility.ariaLabel).toBe('Product customization preview');
    });
  });

  // ── Call-for-price products ──

  describe('call-for-price products', () => {
    let cfpState;
    beforeEach(() => {
      cfpState = { product: { ...callForPriceProduct, _id: 'prod-cfp' }, selectedQuantity: 1, customization: null };
    });

    it('shows call-for-pricing text in base price', async () => {
      await initCustomizationBuilder($w, cfpState);
      expect($w('#custBasePrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
    });

    it('shows call-for-pricing text in total price', async () => {
      await initCustomizationBuilder($w, cfpState);
      expect($w('#custTotalPrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
    });

    it('collapses surcharge section', async () => {
      await initCustomizationBuilder($w, cfpState);
      expect($w('#custSurchargeSection').collapse).toHaveBeenCalled();
    });

    it('collapses pricing section', async () => {
      await initCustomizationBuilder($w, cfpState);
      expect($w('#custPricingSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Mobile behavior ──

  describe('mobile behavior', () => {
    it('adjusts grid layout hint for mobile', async () => {
      const { isMobile } = await import('public/mobileHelpers.js');
      isMobile.mockReturnValueOnce(true);

      await initCustomizationBuilder($w, state);
      // On mobile the section still expands — layout is CSS-driven
      expect($w('#custBuilderSection').expand).toHaveBeenCalled();
    });
  });
});
