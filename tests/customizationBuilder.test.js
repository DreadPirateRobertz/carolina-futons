import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

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
    vi.restoreAllMocks();
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

    it('shows call-for-price text instead of price for CFP products', async () => {
      state.product.price = 0;
      await initCustomizationBuilder($w, state);
      expect($w('#custBasePrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
      expect($w('#custTotalPrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
    });

    it('collapses surcharge and pricing sections for call-for-price products', async () => {
      state.product.price = 0;
      await initCustomizationBuilder($w, state);
      expect($w('#custSurchargeSection').collapse).toHaveBeenCalled();
      expect($w('#custPricingSection').collapse).toHaveBeenCalled();
    });

    it('disables save button initially', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSaveBtn').disable).toHaveBeenCalled();
    });

    it('registers onClick handler on save button', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSaveBtn').onClick).toHaveBeenCalled();
    });

    it('sets preview image from product mainMedia', async () => {
      state.product.mainMedia = 'https://example.com/product.jpg';
      await initCustomizationBuilder($w, state);
      expect($w('#custPreviewImage').src).toBe('https://example.com/product.jpg');
    });

    it('does not set preview image when mainMedia is absent', async () => {
      state.product.mainMedia = undefined;
      await initCustomizationBuilder($w, state);
      expect($w('#custPreviewImage').src).toBe('');
    });

    it('collapses surcharge section initially for normal products', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custSurchargeSection').collapse).toHaveBeenCalled();
    });

    it('sets total price equal to base price initially', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custTotalPrice').text).toBe('$499.00');
    });

    it('initializes state.customization to null', async () => {
      state.customization = { fabricSwatchId: 'old' };
      await initCustomizationBuilder($w, state);
      expect(state.customization).toBeNull();
    });

    it('collapses section when swatches is null', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockResolvedValueOnce({ swatches: null, pricingRules: [] });
      await initCustomizationBuilder($w, state);
      expect($w('#custBuilderSection').collapse).toHaveBeenCalled();
    });

    it('sets up fabric filter dropdown', async () => {
      await initCustomizationBuilder($w, state);
      const filterOpts = $w('#custFabricFilter').options;
      expect(filterOpts[0]).toEqual({ label: 'All Fabrics', value: '' });
      expect(filterOpts).toHaveLength(4); // All + blue, red, neutral
    });

    it('capitalizes color family names in filter options', async () => {
      await initCustomizationBuilder($w, state);
      const filterOpts = $w('#custFabricFilter').options;
      expect(filterOpts[1].label).toBe('Blue');
      expect(filterOpts[2].label).toBe('Red');
      expect(filterOpts[3].label).toBe('Neutral');
    });

    it('registers onChange handler on fabric filter', async () => {
      await initCustomizationBuilder($w, state);
      expect($w('#custFabricFilter').onChange).toHaveBeenCalled();
    });

    it('filters swatches when fabric filter onChange fires', async () => {
      await initCustomizationBuilder($w, state);
      const onChange = $w('#custFabricFilter').onChange.mock.calls[0][0];
      $w('#custFabricFilter').value = 'blue';
      onChange();
      // Grid should be re-rendered with only blue swatches
      expect($w('#custSwatchGrid').data).toHaveLength(1);
      expect($w('#custSwatchGrid').data[0].colorFamily).toBe('blue');
    });

    it('shows all swatches when fabric filter is set to empty', async () => {
      await initCustomizationBuilder($w, state);
      const onChange = $w('#custFabricFilter').onChange.mock.calls[0][0];
      $w('#custFabricFilter').value = '';
      onChange();
      expect($w('#custSwatchGrid').data).toHaveLength(3);
    });
  });

  // ── renderCustomizationSwatches (via onItemReady) ──

  describe('swatch grid onItemReady', () => {
    async function getItemReady() {
      await initCustomizationBuilder($w, state);
      return $w('#custSwatchGrid').onItemReady.mock.calls[0][0];
    }

    function createMockItem() {
      const items = new Map();
      return (sel) => {
        if (!items.has(sel)) items.set(sel, createMockElement());
        return items.get(sel);
      };
    }

    it('sets thumbnail src and alt from swatchImage', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'Coastal Blue', swatchImage: 'img1.jpg', colorHex: '#5B8FA8' });
      expect($item('#custSwThumb').src).toBe('img1.jpg');
      expect($item('#custSwThumb').alt).toBe('Coastal Blue fabric swatch');
    });

    it('uses colorHex as backgroundColor when no swatchImage', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-x', swatchName: 'Solid Red', swatchImage: null, colorHex: '#FF0000' });
      expect($item('#custSwThumb').style.backgroundColor).toBe('#FF0000');
    });

    it('sets swatch label text', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'Coastal Blue', swatchImage: 'img.jpg' });
      expect($item('#custSwLabel').text).toBe('Coastal Blue');
    });

    it('sets material badge text', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'X', material: 'Cotton', swatchImage: 'img.jpg' });
      expect($item('#custSwMaterial').text).toBe('Cotton');
    });

    it('shows +15% tier badge for premium swatches', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-2', swatchName: 'X', priceTier: 'premium', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').text).toBe('+15%');
      expect($item('#custSwTierBadge').show).toHaveBeenCalled();
    });

    it('shows +$75 tier badge for luxury swatches', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-3', swatchName: 'X', priceTier: 'luxury', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').text).toBe('+$75');
      expect($item('#custSwTierBadge').show).toHaveBeenCalled();
    });

    it('hides tier badge for standard swatches', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'X', priceTier: 'standard', swatchImage: 'img.jpg' });
      expect($item('#custSwTierBadge').hide).toHaveBeenCalled();
    });

    it('registers click handler on swatch thumbnail', async () => {
      const onItemReady = await getItemReady();
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'X', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').onClick).toHaveBeenCalled();
    });

    it('shows selected border when swatch matches current customization', async () => {
      const onItemReady = await getItemReady();
      // Set customization AFTER init (which resets it to null)
      state.customization = { fabricSwatchId: 'sw-1' };
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'X', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').style.borderColor).toBe('#5B8FA8'); // mountainBlue
      expect($item('#custSwThumb').style.borderWidth).toBe('3px');
    });

    it('shows deselected border when swatch does not match', async () => {
      const onItemReady = await getItemReady();
      state.customization = { fabricSwatchId: 'sw-2' };
      const $item = createMockItem();
      onItemReady($item, { _id: 'sw-1', swatchName: 'X', swatchImage: 'img.jpg' });
      expect($item('#custSwThumb').style.borderColor).toBe('#D4BC96'); // sandDark
      expect($item('#custSwThumb').style.borderWidth).toBe('1px');
    });

    it('preserves existing _id values in grid data mapping', async () => {
      await initCustomizationBuilder($w, state);
      const gridData = $w('#custSwatchGrid').data;
      expect(gridData[0]._id).toBe('sw-1');
      expect(gridData[1]._id).toBe('sw-2');
      expect(gridData[2]._id).toBe('sw-3');
    });

    it('generates fallback _id when swatch has no _id', async () => {
      const { getCustomizationOptions } = await import('backend/customizationService.web');
      getCustomizationOptions.mockResolvedValueOnce({
        swatches: [
          { swatchName: 'No ID Swatch', colorHex: '#000', swatchImage: 'img.jpg', colorFamily: 'dark' },
        ],
        pricingRules: [],
      });
      await initCustomizationBuilder($w, state);
      const gridData = $w('#custSwatchGrid').data;
      expect(gridData[0]._id).toBe('cust-sw-0');
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

    it('defaults priceTier to standard when not specified', () => {
      const swatch = { _id: 'sw-x', swatchName: 'Plain', colorHex: '#FFF' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect(state.customization.priceTier).toBe('standard');
    });

    it('sets fabricColorHex on state.customization', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect(state.customization.fabricColorHex).toBe('#5B8FA8');
    });

    it('sets totalPrice from product price on state', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      // After updateCustomizationPrice, totalPrice should reflect calculation
      expect(state.customization.totalPrice).toBe(499);
    });

    it('displays material text with prefix', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', material: 'Cotton', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect($w('#custSelectedMaterial').text).toBe('Material: Cotton');
    });

    it('sets empty material text when material is undefined', () => {
      const swatch = { _id: 'sw-1', swatchName: 'Plain', colorHex: '#FFF', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect($w('#custSelectedMaterial').text).toBe('');
    });

    it('re-renders grid data to update selection borders', () => {
      $w('#custSwatchGrid').data = [{ _id: 'sw-1' }, { _id: 'sw-2' }];
      const original = $w('#custSwatchGrid').data;
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      // Should be a new array reference (spread) for re-render
      expect($w('#custSwatchGrid').data).not.toBe(original);
      expect($w('#custSwatchGrid').data).toHaveLength(2);
    });

    it('announces selection to screen reader', async () => {
      const { announce } = await import('public/a11yHelpers.js');
      announce.mockClear();
      const swatch = { _id: 'sw-1', swatchName: 'Coastal Blue', colorHex: '#5B8FA8', priceTier: 'standard' };
      selectCustomizationSwatch($w, state, swatch, []);
      expect(announce).toHaveBeenCalledWith($w, 'Selected Coastal Blue fabric');
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

    it('sets overlay opacity to 0.25', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', null);
      expect($w('#custPreviewOverlay').style.opacity).toBe('0.25');
    });

    it('sets swatch preview alt text', () => {
      updateCustomizationPreview($w, state, '#5B8FA8', 'img1.jpg');
      expect($w('#custPreviewSwatch').alt).toBe('Selected fabric swatch preview');
    });

    it('clears overlay color when colorHex is empty', () => {
      updateCustomizationPreview($w, state, '', 'img1.jpg');
      expect($w('#custPreviewOverlay').style.backgroundColor).toBe('');
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

    it('displays luxury surcharge as +$75.00', () => {
      const rules = [{ tier: 'luxury', surchargePercent: 0, surchargeFlat: 75, label: 'Luxury Fabric (+$75)' }];
      updateCustomizationPrice($w, state, 'luxury', rules);
      expect($w('#custSurcharge').text).toBe('+$75.00');
      expect($w('#custSurchargeSection').expand).toHaveBeenCalled();
    });

    it('displays surcharge label text', () => {
      const rules = [{ tier: 'premium', surchargePercent: 15, surchargeFlat: 0, label: 'Premium Fabric (+15%)' }];
      updateCustomizationPrice($w, state, 'premium', rules);
      expect($w('#custSurchargeLabel').text).toBe('Premium Fabric (+15%)');
    });

    it('updates base price display', () => {
      const rules = [];
      updateCustomizationPrice($w, state, 'standard', rules);
      expect($w('#custBasePrice').text).toBe('$499.00');
    });

    it('does not update state.customization.totalPrice when customization is null', () => {
      state.customization = null;
      const rules = [];
      // Should not throw
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

    it('shows specific error text when no customization selected', async () => {
      state.customization = null;
      await saveCustomization($w, state);
      expect($w('#custSaveError').text).toBe('Please select a fabric first.');
    });

    it('hides error and success messages at start of save', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveError').hide).toHaveBeenCalled();
      expect($w('#custSaveSuccess').hide).toHaveBeenCalled();
    });

    it('re-enables save button after successful save', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveBtn').enable).toHaveBeenCalled();
    });

    it('shows "saved locally" text for anonymous users', async () => {
      await saveCustomization($w, state);
      expect($w('#custSaveSuccess').text).toContain('locally');
    });

    it('announces save success to screen reader', async () => {
      const { announce } = await import('public/a11yHelpers.js');
      announce.mockClear();
      await saveCustomization($w, state);
      expect(announce).toHaveBeenCalledWith($w, 'Configuration saved successfully');
    });

    it('re-enables save button in finally block (success path)', async () => {
      await saveCustomization($w, state);
      // Button should be re-enabled after save completes (finally block)
      expect($w('#custSaveBtn').enable).toHaveBeenCalled();
    });

    it('calls saveConfiguration with correct payload for logged-in member', async () => {
      const wixMembers = await import('wix-members-frontend');
      const spy = vi.spyOn(wixMembers.currentMember, 'getMember').mockResolvedValue({ _id: 'member-42' });
      const { saveConfiguration } = await import('backend/customizationService.web');
      saveConfiguration.mockClear();

      await saveCustomization($w, state);

      expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
        productId: 'prod-1',
        memberId: 'member-42',
        configName: 'My Configuration',
        fabricSwatchId: 'sw-2',
        fabricName: 'Crimson Velvet',
        totalPrice: 573.85,
      }));
      spy.mockRestore();
    });

    it('shows "Configuration saved!" for logged-in member', async () => {
      const wixMembers = await import('wix-members-frontend');
      const spy = vi.spyOn(wixMembers.currentMember, 'getMember').mockResolvedValue({ _id: 'member-42' });

      await saveCustomization($w, state);
      expect($w('#custSaveSuccess').text).toBe('Configuration saved!');
      spy.mockRestore();
    });

    it('shows error when backend saveConfiguration returns error', async () => {
      const wixMembers = await import('wix-members-frontend');
      const spy = vi.spyOn(wixMembers.currentMember, 'getMember').mockResolvedValue({ _id: 'member-42' });
      const { saveConfiguration } = await import('backend/customizationService.web');
      saveConfiguration.mockResolvedValueOnce({ error: 'Duplicate config' });

      await saveCustomization($w, state);
      expect($w('#custSaveError').text).toBe('Could not save configuration. Please try again.');
      spy.mockRestore();
    });

    it('uses configName from input field when provided', async () => {
      const wixMembers = await import('wix-members-frontend');
      const spy = vi.spyOn(wixMembers.currentMember, 'getMember').mockResolvedValue({ _id: 'member-42' });
      const { saveConfiguration } = await import('backend/customizationService.web');
      saveConfiguration.mockClear();
      $w('#custConfigName').value = 'Living Room Setup';

      await saveCustomization($w, state);

      expect(saveConfiguration).toHaveBeenCalledWith(expect.objectContaining({
        configName: 'Living Room Setup',
      }));
      spy.mockRestore();
    });
  });

  // ── loadSavedCustomizations ──

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

    it('calls getSavedConfigurations for logged-in member', async () => {
      const { currentMember } = await import('wix-members-frontend');
      vi.spyOn(currentMember, 'getMember').mockResolvedValueOnce({ _id: 'member-99' });
      const { getSavedConfigurations } = await import('backend/customizationService.web');
      getSavedConfigurations.mockClear();
      getSavedConfigurations.mockResolvedValueOnce([]);

      await loadSavedCustomizations($w, state);
      expect(getSavedConfigurations).toHaveBeenCalledWith('prod-1', 'member-99');
    });

    it('expands saved section and renders list when local configs exist', async () => {
      // Seed local storage with saved configs (anonymous user path)
      const configs = [
        { _id: 'cfg-1', productId: 'prod-1', configName: 'My Futon', fabricName: 'Coastal Blue', fabricColorHex: '#5B8FA8', totalPrice: 499 },
      ];
      sessionStorage.setItem('cf_saved_configs', JSON.stringify(configs));

      await loadSavedCustomizations($w, state);
      expect($w('#custSavedSection').expand).toHaveBeenCalled();
      expect($w('#custSavedList').data).toHaveLength(1);
      expect($w('#custSavedList').onItemReady).toHaveBeenCalled();
    });

    it('renders saved config item with name, fabric, color dot, and price', async () => {
      const configs = [
        { _id: 'cfg-1', productId: 'prod-1', configName: 'My Futon', fabricName: 'Coastal Blue', fabricColorHex: '#5B8FA8', totalPrice: 499 },
      ];
      sessionStorage.setItem('cf_saved_configs', JSON.stringify(configs));

      await loadSavedCustomizations($w, state);
      const onItemReady = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $itemMock = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      onItemReady($itemMock, configs[0]);
      expect($itemMock('#savedConfigName').text).toBe('My Futon');
      expect($itemMock('#savedFabricName').text).toBe('Coastal Blue');
      expect($itemMock('#savedColorDot').style.backgroundColor).toBe('#5B8FA8');
      expect($itemMock('#savedPrice').text).toBe('$499.00');
    });

    it('registers load button click handler on saved config items', async () => {
      const configs = [
        { _id: 'cfg-1', productId: 'prod-1', configName: 'My Futon', fabricName: 'Coastal Blue', fabricColorHex: '#5B8FA8', totalPrice: 499 },
      ];
      sessionStorage.setItem('cf_saved_configs', JSON.stringify(configs));

      await loadSavedCustomizations($w, state);
      const onItemReady = $w('#custSavedList').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $itemMock = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      onItemReady($itemMock, configs[0]);
      expect($itemMock('#savedLoadBtn').onClick).toHaveBeenCalled();
    });

    it('filters local configs by product ID', async () => {
      const configs = [
        { _id: 'cfg-1', productId: 'prod-1', configName: 'Match', fabricName: 'Blue', totalPrice: 499 },
        { _id: 'cfg-2', productId: 'prod-other', configName: 'No Match', fabricName: 'Red', totalPrice: 599 },
      ];
      sessionStorage.setItem('cf_saved_configs', JSON.stringify(configs));

      await loadSavedCustomizations($w, state);
      expect($w('#custSavedList').data).toHaveLength(1);
      expect($w('#custSavedList').data[0].configName).toBe('Match');
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
