import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from '../fixtures/products.js';

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
} from '../../src/public/CustomizationBuilder.js';

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
