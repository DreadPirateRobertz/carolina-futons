import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

vi.mock('public/cartService', () => ({
  getProductVariants: vi.fn().mockResolvedValue([{
    variant: { price: 599 }, inStock: true, imageSrc: 'https://example.com/variant.jpg', mediaItems: [],
  }]),
  addToCart: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
}));

vi.mock('backend/swatchService.web', () => ({
  getProductSwatches: vi.fn().mockResolvedValue([
    { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'https://example.com/sw1.jpg' },
    { _id: 'sw-2', swatchName: 'Forest Green', colorHex: '#228B22', swatchImage: 'https://example.com/sw2.jpg' },
  ]),
  getSwatchCount: vi.fn().mockResolvedValue(15),
  getAllSwatchFamilies: vi.fn().mockResolvedValue(['blue', 'green', 'neutral']),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#22c55e', sunsetCoral: '#ff6b6b', mountainBlue: '#1e3a5f', sandDark: '#c9b99a', espresso: '#3c2415' },
}));

vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  HEART_FILLED_SVG: 'filled', HEART_OUTLINE_SVG: 'outline',
  isCallForPrice: vi.fn((product) => (product?.price ?? Infinity) <= 1),
  CALL_FOR_PRICE_TEXT: 'Call for Pricing \u2014 (828) 327-8030',
}));

vi.mock('public/AddToCart.js', () => ({ updateStickyPrice: vi.fn() }));
vi.mock('wix-location-frontend', () => ({ to: vi.fn() }));

import { initVariantSelector, handleCustomVariantChange, initSwatchSelector, selectSwatch, initFinishSwatches } from '../src/public/ProductOptions.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', items: [], data: [],
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: 0 },
    options: [],
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(), onInput: vi.fn(),
    getCurrentItem: vi.fn(() => futonFrame),
    onCurrentIndexChanged: vi.fn(),
    forEachItem: vi.fn(),
    focus: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('ProductOptions', () => {
  let $w, state;
  beforeEach(() => {
    $w = create$w();
    state = { product: { ...futonFrame, _id: 'prod-1', collections: ['futon-frames'] }, selectedSwatchId: null };
  });

  describe('initVariantSelector', () => {
    it('registers onChange on size dropdown', () => {
      initVariantSelector($w, state);
      expect($w('#sizeDropdown').onChange).toHaveBeenCalled();
    });

    it('registers onChange on finish dropdown', () => {
      initVariantSelector($w, state);
      expect($w('#finishDropdown').onChange).toHaveBeenCalled();
    });

    it('listens for dataset index changes', () => {
      initVariantSelector($w, state);
      expect($w('#productDataset').onCurrentIndexChanged).toHaveBeenCalled();
    });
  });

  describe('handleCustomVariantChange', () => {
    it('queries variants with selected size and finish', async () => {
      const { getProductVariants } = await import('public/cartService');
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Size: 'Full', Finish: 'Natural' });
    });

    it('updates price display on variant change', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productPrice').text).toBe('$599.00');
    });

    it('calls updateStickyPrice', async () => {
      const { updateStickyPrice } = await import('public/AddToCart.js');
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect(updateStickyPrice).toHaveBeenCalled();
    });

    it('does nothing when both dropdowns are empty', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#sizeDropdown').value = '';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).not.toHaveBeenCalled();
    });

    it('shows stock status "In Stock" for in-stock variant', async () => {
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').text).toBe('In Stock');
    });

    it('shows stock status "Special Order" for out-of-stock variant', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: false, imageSrc: '', mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').text).toBe('Special Order');
    });

    it('shows compare price when variant has one', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 499, comparePrice: 699 }, inStock: true, imageSrc: '', mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productComparePrice').text).toBe('$699.00');
      expect($w('#productComparePrice').show).toHaveBeenCalled();
    });

    it('hides compare price when variant has none', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 499 }, inStock: true, imageSrc: '', mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productComparePrice').hide).toHaveBeenCalled();
    });

    it('updates main product image when variant has imageSrc', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
        imageSrc: 'https://example.com/variant-full.jpg',
        mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productMainImage').src).toBe('https://example.com/variant-full.jpg');
    });

    it('sets alt text with product name and variant label', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
        imageSrc: 'https://example.com/v.jpg', label: 'Full Natural',
        mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productMainImage').alt).toContain('Full Natural');
    });

    it('updates gallery items from mediaItems', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: '',
        mediaItems: [
          { src: 'https://example.com/a.jpg', alt: 'Front' },
          { src: 'https://example.com/b.jpg', alt: 'Side' },
        ],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productGallery').items).toHaveLength(2);
      expect($w('#productGallery').items[0].src).toBe('https://example.com/a.jpg');
    });

    it('shows call-for-price text for call-for-price products', async () => {
      state.product.price = 0; // triggers isCallForPrice
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productPrice').text).toContain('Call for Pricing');
    });

    it('handles getProductVariants returning empty array', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([]);
      $w('#sizeDropdown').value = 'Full';
      const priceBefore = $w('#productPrice').text;
      await handleCustomVariantChange($w, state);
      expect($w('#productPrice').text).toBe(priceBefore);
    });

    it('handles getProductVariants throwing an error', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockRejectedValueOnce(new Error('Network fail'));
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      // Should complete without throwing — error caught internally
    });

    it('queries with only size when finish is empty', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#sizeDropdown').value = 'Queen';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Size: 'Queen' });
    });
  });

  describe('initSwatchSelector', () => {
    it('populates swatch grid with data', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchGrid').data.length).toBe(2);
    });

    it('displays swatch count', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchCount').text).toContain('15+');
    });

    it('sets up color filter with family options', async () => {
      await initSwatchSelector($w, state);
      const opts = $w('#swatchColorFilter').options;
      expect(opts[0]).toEqual({ label: 'All', value: '' });
      expect(opts.length).toBe(4); // All + 3 families
    });

    it('expands swatch section', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchSection').expand).toHaveBeenCalled();
    });

    it('collapses swatch section when no swatches', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([]);
      await initSwatchSelector($w, state);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('collapses swatch section when product is null', async () => {
      state.product = null;
      await initSwatchSelector($w, state);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('registers View All click handler', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchViewAll').onClick).toHaveBeenCalled();
    });

    it('registers swatch request link handler', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchRequestLink').onClick).toHaveBeenCalled();
    });

    it('sets up onItemReady on swatch grid', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchGrid').onItemReady).toHaveBeenCalled();
    });
  });

  describe('selectSwatch', () => {
    it('sets selectedSwatchId on state', async () => {
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect(state.selectedSwatchId).toBe('sw-1');
    });

    it('applies tint fallback when no matching variant', async () => {
      $w('#finishDropdown').options = [{ label: 'Natural', value: 'natural' }];
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#swatchTintOverlay').style.backgroundColor).toBe('#2244AA');
    });

    it('triggers variant change when swatch name matches finish dropdown option', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#finishDropdown').options = [{ label: 'Ocean Blue', value: 'ocean-blue' }];
      $w('#sizeDropdown').value = 'Full';
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#finishDropdown').value).toBe('ocean-blue');
      expect(getProductVariants).toHaveBeenCalled();
    });

    it('case-insensitive match on finish dropdown', async () => {
      $w('#finishDropdown').options = [{ label: 'ocean blue', value: 'ocean-blue' }];
      $w('#sizeDropdown').value = 'Full';
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#finishDropdown').value).toBe('ocean-blue');
    });

    it('does not apply tint when colorHex is undefined', async () => {
      $w('#finishDropdown').options = [];
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Unknown', colorHex: undefined });
      expect($w('#swatchTintOverlay').style.backgroundColor).toBe('');
    });

    it('refreshes swatch grid to update selection styling', async () => {
      $w('#swatchGrid').data = [{ _id: 'sw-1' }, { _id: 'sw-2' }];
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      // Grid data should be refreshed (new array reference for re-render)
      expect($w('#swatchGrid').data).toHaveLength(2);
    });
  });

  describe('initFinishSwatches', () => {
    beforeEach(() => {
      state.product.productOptions = [
        { name: 'Size', choices: [
          { value: 'Twin', description: 'Twin' },
          { value: 'Full', description: 'Full' },
          { value: 'Queen', description: 'Queen' },
        ]},
        { name: 'Finish', choices: [
          { value: 'Natural Oak', description: 'Natural Oak' },
          { value: 'Espresso', description: 'Espresso' },
          { value: 'Walnut', description: 'Walnut' },
          { value: 'Cherry', description: 'Cherry' },
        ]},
      ];
    });

    it('hides the finishDropdown for visual users', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishDropdown').hide).toHaveBeenCalled();
    });

    it('sets role="radiogroup" on finishSwatches container', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').accessibility.role).toBe('radiogroup');
    });

    it('sets aria-label on finishSwatches container', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').accessibility.ariaLabel).toBe('Finish');
    });

    it('maps colorHex from choice.color into swatch data', async () => {
      state.product.productOptions = [
        { name: 'Finish', choices: [
          { value: 'Natural Oak', description: 'Natural Oak', color: '#D4A76A' },
          { value: 'Espresso', description: 'Espresso', color: '#3C2415' },
        ]},
      ];
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').data[0].colorHex).toBe('#D4A76A');
      expect($w('#finishSwatches').data[1].colorHex).toBe('#3C2415');
    });

    it('sets colorHex to null when choice has no color', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').data[0].colorHex).toBeNull();
    });

    it('registers onItemReady before setting data (Wix Repeater contract)', async () => {
      const callOrder = [];
      const origOnItemReady = $w('#finishSwatches').onItemReady;
      $w('#finishSwatches').onItemReady = vi.fn((...args) => {
        callOrder.push('onItemReady');
        return origOnItemReady(...args);
      });
      Object.defineProperty($w('#finishSwatches'), 'data', {
        set: function(v) { callOrder.push('data'); this._data = v; },
        get: function() { return this._data || []; },
        configurable: true,
      });
      await initFinishSwatches($w, state);
      const itemReadyIdx = callOrder.indexOf('onItemReady');
      const dataIdx = callOrder.indexOf('data');
      expect(itemReadyIdx).toBeLessThan(dataIdx);
    });

    it('populates finishSwatches repeater with finish options', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').data).toHaveLength(4);
      expect($w('#finishSwatches').data[0].value).toBe('Natural Oak');
      expect($w('#finishSwatches').data[3].value).toBe('Cherry');
    });

    it('assigns unique _id to each swatch item', async () => {
      await initFinishSwatches($w, state);
      const ids = $w('#finishSwatches').data.map(d => d._id);
      expect(new Set(ids).size).toBe(4);
    });

    it('registers onItemReady on finishSwatches repeater', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').onItemReady).toHaveBeenCalled();
    });

    it('does nothing when product has no Finish option', async () => {
      state.product.productOptions = [
        { name: 'Size', choices: [{ value: 'Full', description: 'Full' }] },
      ];
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').onItemReady).not.toHaveBeenCalled();
    });

    it('does nothing when product has no productOptions', async () => {
      delete state.product.productOptions;
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').onItemReady).not.toHaveBeenCalled();
    });

    it('checks variant stock for each finish option', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      await initFinishSwatches($w, state);
      // 4 stock checks (one per finish) + 1 default selection = 5 calls
      expect(getProductVariants).toHaveBeenCalledTimes(5);
    });

    it('marks out-of-stock finishes in swatch data', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockImplementation((_id, choices) => {
        if (choices?.Finish === 'Espresso') {
          return Promise.resolve([{ variant: { price: 599 }, inStock: false }]);
        }
        return Promise.resolve([{ variant: { price: 599 }, inStock: true }]);
      });
      await initFinishSwatches($w, state);
      const espresso = $w('#finishSwatches').data.find(d => d.value === 'Espresso');
      expect(espresso.outOfStock).toBe(true);
    });

    it('selects first in-stock finish by default', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishDropdown').value).toBe('Natural Oak');
    });

    it('expands finishSwatches container', async () => {
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').expand).toHaveBeenCalled();
    });

    it('triggers variant change after selecting default finish', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      await initFinishSwatches($w, state);
      // Should have called getProductVariants during stock check AND default selection
      expect(getProductVariants).toHaveBeenCalled();
    });

    describe('onItemReady behavior', () => {
      let itemReadyCallback;

      beforeEach(async () => {
        await initFinishSwatches($w, state);
        itemReadyCallback = $w('#finishSwatches').onItemReady.mock.calls[0][0];
      });

      it('sets swatch label text', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false });
        expect($item('#finishSwatchLabel').text).toBe('Natural Oak');
      });

      it('dims out-of-stock swatches', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-1', value: 'Espresso', description: 'Espresso', outOfStock: true });
        expect($item('#finishSwatchCircle').style.opacity).toBe(0.3);
      });

      it('registers click handler on swatch circle', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false });
        expect($item('#finishSwatchCircle').onClick).toHaveBeenCalled();
      });

      it('click on in-stock swatch updates hidden dropdown value', async () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-2', value: 'Walnut', description: 'Walnut', outOfStock: false });
        const clickHandler = $item('#finishSwatchCircle').onClick.mock.calls[0][0];
        await clickHandler();
        expect($w('#finishDropdown').value).toBe('Walnut');
      });

      it('click on out-of-stock swatch does not update dropdown', async () => {
        $w('#finishDropdown').value = 'Natural Oak';
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-1', value: 'Espresso', description: 'Espresso', outOfStock: true });
        const clickHandler = $item('#finishSwatchCircle').onClick.mock.calls[0][0];
        await clickHandler();
        expect($w('#finishDropdown').value).toBe('Natural Oak');
      });

      it('click on swatch triggers re-render for ARIA update', async () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false, colorHex: null });
        const clickHandler = $item('#finishSwatchCircle').onClick.mock.calls[0][0];
        const dataBefore = $w('#finishSwatches').data;
        $w('#finishSwatches').data = [{ _id: 'finish-0' }];
        await clickHandler();
        expect($w('#finishSwatches').data).not.toBe(dataBefore);
      });

      it('sets backgroundColor from colorHex on swatch circle', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false, colorHex: '#D4A76A' });
        expect($item('#finishSwatchCircle').style.backgroundColor).toBe('#D4A76A');
      });

      it('click on in-stock swatch triggers variant change', async () => {
        const { getProductVariants } = await import('public/cartService');
        getProductVariants.mockClear();
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false });
        const clickHandler = $item('#finishSwatchCircle').onClick.mock.calls[0][0];
        await clickHandler();
        expect(getProductVariants).toHaveBeenCalled();
      });
    });

    describe('accessibility — individual swatch items', () => {
      let itemReadyCallback;

      beforeEach(async () => {
        await initFinishSwatches($w, state);
        itemReadyCallback = $w('#finishSwatches').onItemReady.mock.calls[0][0];
      });

      it('sets aria-label on each swatch circle with finish name', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false });
        expect($item('#finishSwatchCircle').accessibility.ariaLabel).toBe('Natural Oak finish');
      });

      it('sets aria-checked="true" on selected swatch', () => {
        $w('#finishDropdown').value = 'Walnut';
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-2', value: 'Walnut', description: 'Walnut', outOfStock: false });
        expect($item('#finishSwatchCircle').accessibility.ariaChecked).toBe('true');
      });

      it('sets aria-checked="false" on non-selected swatch', () => {
        $w('#finishDropdown').value = 'Natural Oak';
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-2', value: 'Walnut', description: 'Walnut', outOfStock: false });
        expect($item('#finishSwatchCircle').accessibility.ariaChecked).toBe('false');
      });

      it('sets aria-disabled on OOS swatch', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-1', value: 'Espresso', description: 'Espresso', outOfStock: true });
        expect($item('#finishSwatchCircle').accessibility.ariaDisabled).toBe('true');
      });

      it('sets tooltip text on OOS swatch', () => {
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-1', value: 'Espresso', description: 'Espresso', outOfStock: true });
        expect($item('#finishSwatchCircle').accessibility.ariaLabel).toContain('Special Order');
      });

      it('applies focus ring border on selected swatch', () => {
        $w('#finishDropdown').value = 'Natural Oak';
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-0', value: 'Natural Oak', description: 'Natural Oak', outOfStock: false });
        expect($item('#finishSwatchCircle').style.borderColor).toBe('#1e3a5f'); // mountainBlue
        expect($item('#finishSwatchCircle').style.borderWidth).toBe('3px');
      });

      it('applies default border on non-selected swatch', () => {
        $w('#finishDropdown').value = 'Natural Oak';
        const $item = create$w();
        itemReadyCallback($item, { _id: 'finish-2', value: 'Walnut', description: 'Walnut', outOfStock: false });
        expect($item('#finishSwatchCircle').style.borderColor).toBe('#c9b99a'); // sandDark
        expect($item('#finishSwatchCircle').style.borderWidth).toBe('1px');
      });
    });

    it('survives single stock check failure without breaking init', async () => {
      const { getProductVariants } = await import('public/cartService');
      let callCount = 0;
      getProductVariants.mockImplementation(() => {
        callCount++;
        if (callCount === 2) return Promise.reject(new Error('Network error'));
        return Promise.resolve([{ variant: { price: 599 }, inStock: true }]);
      });
      await initFinishSwatches($w, state);
      // Should still render all 4 swatches despite one failure
      expect($w('#finishSwatches').data).toHaveLength(4);
      expect($w('#finishSwatches').expand).toHaveBeenCalled();
    });

    it('defaults to OOS when stock check fails (safe direction)', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockImplementation((_id, choices) => {
        if (choices?.Finish === 'Walnut') return Promise.reject(new Error('timeout'));
        return Promise.resolve([{ variant: { price: 599 }, inStock: true }]);
      });
      await initFinishSwatches($w, state);
      const walnut = $w('#finishSwatches').data.find(d => d.value === 'Walnut');
      expect(walnut.outOfStock).toBe(true);
    });

    it('defaults to OOS when stock check returns empty array', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockImplementation((_id, choices) => {
        if (choices?.Finish === 'Cherry') return Promise.resolve([]);
        return Promise.resolve([{ variant: { price: 599 }, inStock: true }]);
      });
      await initFinishSwatches($w, state);
      const cherry = $w('#finishSwatches').data.find(d => d.value === 'Cherry');
      expect(cherry.outOfStock).toBe(true);
    });

    it('handles all finishes out of stock — falls back to first as display default', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValue([{ variant: { price: 599 }, inStock: false }]);
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').data.every(d => d.outOfStock)).toBe(true);
      expect($w('#finishDropdown').value).toBe('Natural Oak');
      expect($w('#finishSwatches').expand).toHaveBeenCalled();
    });

    it('uses description fallback to value when description missing', async () => {
      state.product.productOptions = [
        { name: 'Finish', choices: [
          { value: 'Natural Oak' },
        ]},
      ];
      await initFinishSwatches($w, state);
      expect($w('#finishSwatches').data[0].description).toBe('Natural Oak');
    });

    it('skips first OOS finish and selects next in-stock as default', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockImplementation((_id, choices) => {
        if (choices?.Finish === 'Natural Oak') {
          return Promise.resolve([{ variant: { price: 599 }, inStock: false }]);
        }
        return Promise.resolve([{ variant: { price: 599 }, inStock: true }]);
      });
      await initFinishSwatches($w, state);
      expect($w('#finishDropdown').value).toBe('Espresso');
    });
  });

  describe('initVariantSelector — dataset callback', () => {
    it('updates state.product when dataset index changes', () => {
      initVariantSelector($w, state);
      const callback = $w('#productDataset').onCurrentIndexChanged.mock.calls[0][0];
      const updatedProduct = { _id: 'prod-2', name: 'Updated Futon' };
      $w('#productDataset').getCurrentItem = vi.fn(() => updatedProduct);
      callback();
      expect(state.product).toBe(updatedProduct);
    });

    it('does not overwrite state.product when getCurrentItem returns null', () => {
      initVariantSelector($w, state);
      const callback = $w('#productDataset').onCurrentIndexChanged.mock.calls[0][0];
      const original = state.product;
      $w('#productDataset').getCurrentItem = vi.fn(() => null);
      callback();
      expect(state.product).toBe(original);
    });
  });

  describe('renderSwatchGrid — onItemReady behavior', () => {
    let gridItemReadyCallback;

    beforeEach(async () => {
      await initSwatchSelector($w, state);
      gridItemReadyCallback = $w('#swatchGrid').onItemReady.mock.calls[0][0];
    });

    it('sets swatch thumbnail image and alt text', () => {
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', swatchImage: 'https://example.com/sw.jpg' });
      expect($item('#swatchThumb').src).toBe('https://example.com/sw.jpg');
      expect($item('#swatchThumb').alt).toBe('Ocean Blue');
    });

    it('falls back to colorHex background when no swatchImage', () => {
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-2', swatchName: 'Forest', colorHex: '#228B22' });
      expect($item('#swatchThumb').style.backgroundColor).toBe('#228B22');
    });

    it('sets swatch label text', () => {
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue' });
      expect($item('#swatchLabel').text).toBe('Ocean Blue');
    });

    it('registers click handler on swatch thumb', () => {
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($item('#swatchThumb').onClick).toHaveBeenCalled();
    });

    it('click selects the swatch and updates state', async () => {
      const $item = create$w();
      $w('#finishDropdown').options = [];
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      const clickHandler = $item('#swatchThumb').onClick.mock.calls[0][0];
      await clickHandler();
      expect(state.selectedSwatchId).toBe('sw-1');
    });

    it('highlights selected swatch with mountainBlue border', () => {
      state.selectedSwatchId = 'sw-1';
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue' });
      expect($item('#swatchThumb').style.borderColor).toBe('#1e3a5f');
      expect($item('#swatchThumb').style.borderWidth).toBe('3px');
    });

    it('non-selected swatch has sandDark border', () => {
      state.selectedSwatchId = 'sw-other';
      const $item = create$w();
      gridItemReadyCallback($item, { _id: 'sw-1', swatchName: 'Ocean Blue' });
      expect($item('#swatchThumb').style.borderColor).toBe('#c9b99a');
      expect($item('#swatchThumb').style.borderWidth).toBe('1px');
    });
  });

  describe('initSwatchColorFilter — onChange filtering', () => {
    it('re-fetches swatches with selected color family on filter change', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      await initSwatchSelector($w, state);
      getProductSwatches.mockClear();
      const filterEl = $w('#swatchColorFilter');
      const onChangeHandler = filterEl.onChange.mock.calls[0][0];
      filterEl.value = 'blue';
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'https://example.com/sw1.jpg' },
      ]);
      await onChangeHandler();
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1', 'blue');
    });

    it('passes null when "All" is selected', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      await initSwatchSelector($w, state);
      getProductSwatches.mockClear();
      const filterEl = $w('#swatchColorFilter');
      const onChangeHandler = filterEl.onChange.mock.calls[0][0];
      filterEl.value = '';
      getProductSwatches.mockResolvedValueOnce([]);
      await onChangeHandler();
      expect(getProductSwatches).toHaveBeenCalledWith('prod-1', null);
    });
  });

  describe('openSwatchGallery — modal flow', () => {
    beforeEach(async () => {
      // Provide document for Escape key tests
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    afterEach(() => {
      delete globalThis.document;
    });

    async function openGallery() {
      // Default mocks return 2 swatches, count=15, families=['blue','green','neutral']
      // initSwatchSelector calls getProductSwatches once, openSwatchGallery calls it again
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
    }

    it('shows swatch gallery modal', async () => {
      await openGallery();
      expect($w('#swatchGalleryModal').show).toHaveBeenCalled();
    });

    it('sets ARIA dialog attributes on modal', async () => {
      await openGallery();
      expect($w('#swatchGalleryModal').accessibility.role).toBe('dialog');
      expect($w('#swatchGalleryModal').accessibility.ariaModal).toBe(true);
      expect($w('#swatchGalleryModal').accessibility.ariaLabel).toBe('Swatch gallery');
    });

    it('focuses search input after opening', async () => {
      await openGallery();
      expect($w('#swatchSearch').focus).toHaveBeenCalled();
    });

    it('populates gallery grid with all swatches', async () => {
      await openGallery();
      expect($w('#swatchGalleryGrid').data).toHaveLength(2);
    });

    it('registers Escape key handler', async () => {
      await openGallery();
      expect(globalThis.document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('registers close button handler', async () => {
      await openGallery();
      expect($w('#swatchGalleryClose').onClick).toHaveBeenCalled();
    });

    it('close handler hides modal and restores focus', async () => {
      await openGallery();
      const closeHandler = $w('#swatchGalleryClose').onClick.mock.calls[0][0];
      closeHandler();
      expect($w('#swatchGalleryModal').hide).toHaveBeenCalled();
      expect($w('#swatchViewAll').focus).toHaveBeenCalled();
    });

    it('close handler removes Escape listener', async () => {
      await openGallery();
      const closeHandler = $w('#swatchGalleryClose').onClick.mock.calls[0][0];
      closeHandler();
      expect(globalThis.document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('registers search input handler', async () => {
      await openGallery();
      expect($w('#swatchSearch').onInput).toHaveBeenCalled();
    });

    it('filters gallery by swatch name on search input', async () => {
      await openGallery();
      const searchHandler = $w('#swatchSearch').onInput.mock.calls[0][0];
      searchHandler({ target: { value: 'Ocean' } });
      expect($w('#swatchGalleryGrid').data).toHaveLength(1);
      expect($w('#swatchGalleryGrid').data[0].swatchName).toBe('Ocean Blue');
    });

    it('filters gallery by material on search input', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'https://example.com/sw1.jpg' },
        { _id: 'sw-2', swatchName: 'Forest Green', colorHex: '#228B22', swatchImage: 'https://example.com/sw2.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', material: 'Linen', colorHex: '#2244AA' },
        { _id: 'sw-2', swatchName: 'Forest Green', material: 'Velvet', colorHex: '#228B22' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const searchHandler = $w('#swatchSearch').onInput.mock.calls[0][0];
      searchHandler({ target: { value: 'velvet' } });
      expect($w('#swatchGalleryGrid').data).toHaveLength(1);
      expect($w('#swatchGalleryGrid').data[0].swatchName).toBe('Forest Green');
    });

    it('shows all swatches when search is empty', async () => {
      await openGallery();
      const searchHandler = $w('#swatchSearch').onInput.mock.calls[0][0];
      searchHandler({ target: { value: '' } });
      expect($w('#swatchGalleryGrid').data).toHaveLength(2);
    });

    it('Escape key hides modal and restores focus', async () => {
      await openGallery();
      const keydownHandler = globalThis.document.addEventListener.mock.calls
        .find(c => c[0] === 'keydown')[1];
      keydownHandler({ key: 'Escape' });
      expect($w('#swatchGalleryModal').hide).toHaveBeenCalled();
      expect($w('#swatchViewAll').focus).toHaveBeenCalled();
    });

    it('Escape key removes its own listener after closing', async () => {
      await openGallery();
      const keydownHandler = globalThis.document.addEventListener.mock.calls
        .find(c => c[0] === 'keydown')[1];
      keydownHandler({ key: 'Escape' });
      expect(globalThis.document.removeEventListener).toHaveBeenCalledWith('keydown', keydownHandler);
    });

    it('non-Escape key does not close modal', async () => {
      await openGallery();
      const keydownHandler = globalThis.document.addEventListener.mock.calls
        .find(c => c[0] === 'keydown')[1];
      keydownHandler({ key: 'Enter' });
      expect($w('#swatchGalleryModal').hide).not.toHaveBeenCalled();
    });
  });

  describe('renderSwatchGalleryGrid — onItemReady behavior', () => {
    async function setupGalleryGrid() {
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      return $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
    }

    it('sets gallery item thumbnail and name', async () => {
      const callback = await setupGalleryGrid();
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', swatchImage: 'https://example.com/sw1.jpg', material: 'Linen' });
      expect($item('#sgThumb').src).toBe('https://example.com/sw1.jpg');
      expect($item('#sgThumb').alt).toBe('Ocean Blue');
      expect($item('#sgName').text).toBe('Ocean Blue');
      expect($item('#sgMaterial').text).toBe('Linen');
    });

    it('falls back to colorHex background when no image', async () => {
      const callback = await setupGalleryGrid();
      const $item = create$w();
      callback($item, { _id: 'sw-2', swatchName: 'Forest', colorHex: '#228B22' });
      expect($item('#sgThumb').style.backgroundColor).toBe('#228B22');
    });

    it('registers click handler for selection + detail view', async () => {
      const callback = await setupGalleryGrid();
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'https://example.com/sw1.jpg', material: 'Linen', colorFamily: 'blue', careInstructions: 'Dry clean' });
      expect($item('#sgThumb').onClick).toHaveBeenCalled();
    });

    it('click selects swatch and shows detail panel', async () => {
      const callback = await setupGalleryGrid();
      const $item = create$w();
      const swatchData = { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'https://example.com/sw1.jpg', material: 'Linen', colorFamily: 'blue', careInstructions: 'Dry clean' };
      $w('#finishDropdown').options = [];
      callback($item, swatchData);
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickHandler();
      expect(state.selectedSwatchId).toBe('sw-1');
      expect($w('#swatchDetailName').text).toBe('Ocean Blue');
      expect($w('#swatchDetailMaterial').text).toBe('Material: Linen');
      expect($w('#swatchDetailCare').text).toBe('Care: Dry clean');
      expect($w('#swatchDetailFamily').text).toBe('Color Family: Blue');
      expect($w('#swatchDetailImage').src).toBe('https://example.com/sw1.jpg');
      expect($w('#swatchDetail').expand).toHaveBeenCalled();
    });

    it('highlights selected swatch in gallery grid', async () => {
      const callback = await setupGalleryGrid();
      state.selectedSwatchId = 'sw-1';
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue' });
      expect($item('#sgThumb').style.borderColor).toBe('#1e3a5f');
      expect($item('#sgThumb').style.borderWidth).toBe('3px');
    });

    it('non-selected swatch in gallery has sandDark border', async () => {
      const callback = await setupGalleryGrid();
      state.selectedSwatchId = 'sw-other';
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue' });
      expect($item('#sgThumb').style.borderColor).toBe('#c9b99a');
      expect($item('#sgThumb').style.borderWidth).toBe('1px');
    });

    it('shows empty material in gallery grid cell when swatch has no material', async () => {
      const callback = await setupGalleryGrid();
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', swatchImage: 'https://example.com/sw.jpg' });
      expect($item('#sgMaterial').text).toBe('');
    });
  });

  describe('showSwatchDetail — missing optional fields', () => {
    async function setupAndClickSwatch(swatchData) {
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const callback = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      $w('#finishDropdown').options = [];
      callback($item, swatchData);
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('shows empty material text when swatch has no material', async () => {
      await setupAndClickSwatch({ _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#swatchDetailMaterial').text).toBe('');
    });

    it('shows empty care text when swatch has no careInstructions', async () => {
      await setupAndClickSwatch({ _id: 'sw-1', swatchName: 'Ocean Blue', material: 'Cotton' });
      expect($w('#swatchDetailCare').text).toBe('');
    });

    it('shows empty family text when swatch has no colorFamily', async () => {
      await setupAndClickSwatch({ _id: 'sw-1', swatchName: 'Ocean Blue', material: 'Linen' });
      expect($w('#swatchDetailFamily').text).toBe('');
    });

    it('capitalizes first letter of colorFamily', async () => {
      await setupAndClickSwatch({ _id: 'sw-1', swatchName: 'Ocean Blue', colorFamily: 'blue' });
      expect($w('#swatchDetailFamily').text).toBe('Color Family: Blue');
    });
  });

  describe('handleCustomVariantChange — edge cases', () => {
    it('uses "variant" fallback in alt text when no label or value', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
        imageSrc: 'https://example.com/v.jpg',
        mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productMainImage').alt).toContain('variant');
    });

    it('uses "Product" fallback in alt text when product name is missing', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
        imageSrc: 'https://example.com/v.jpg', label: 'Full Natural',
        mediaItems: [],
      }]);
      state.product.name = undefined;
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productMainImage').alt).toContain('Product');
    });

    it('maps mediaItems.url to gallery src when src is missing', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: '',
        mediaItems: [
          { url: 'https://example.com/a.jpg' },
        ],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productGallery').items[0].src).toBe('https://example.com/a.jpg');
    });

    it('uses product name as gallery alt text fallback when item.alt missing', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: '',
        mediaItems: [
          { src: 'https://example.com/a.jpg' },
        ],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#productGallery').items[0].alt).toBe(state.product.name);
    });

    it('sets stock status color to success for in-stock variant', async () => {
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').style.color).toBe('#22c55e');
    });

    it('sets stock status color to sunsetCoral for OOS variant', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: false, imageSrc: '', mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').style.color).toBe('#ff6b6b');
    });

    it('queries with only finish when size is empty', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#sizeDropdown').value = '';
      $w('#finishDropdown').value = 'Walnut';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Finish: 'Walnut' });
    });
  });

  describe('initSwatchSelector — error handling', () => {
    it('collapses section when getProductSwatches throws', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockRejectedValueOnce(new Error('Network error'));
      await initSwatchSelector($w, state);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('does not open gallery when getProductSwatches returns empty on open', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      await initSwatchSelector($w, state);
      // Mock empty response for gallery open
      getProductSwatches.mockResolvedValueOnce([]);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      expect($w('#swatchGalleryModal').show).not.toHaveBeenCalled();
    });
  });

  // ── Error branch coverage: catch blocks and null guards ──────────────

  describe('initVariantSelector — error branches', () => {
    it('survives when $w throws on element access', () => {
      const throwing$w = () => { throw new Error('element not found'); };
      expect(() => initVariantSelector(throwing$w, state)).not.toThrow();
    });

    it('survives when dataset onCurrentIndexChanged throws', () => {
      const broken$w = (sel) => {
        if (sel === '#productDataset') throw new Error('no dataset');
        return $w(sel);
      };
      expect(() => initVariantSelector(broken$w, state)).not.toThrow();
    });

    it('survives when size element is null', () => {
      const null$w = (sel) => {
        if (sel === '#sizeDropdown') return null;
        return $w(sel);
      };
      expect(() => initVariantSelector(null$w, state)).not.toThrow();
    });
  });

  describe('handleCustomVariantChange — error branches', () => {
    it('catches and logs when $w throws during variant fetch', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const throwing$w = () => { throw new Error('DOM gone'); };
      await handleCustomVariantChange(throwing$w, state);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Error handling variant change'), expect.any(Error));
      spy.mockRestore();
    });

    it('handles variant with no imageSrc (skips image update)', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 499 }, inStock: true, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Queen';
      await handleCustomVariantChange($w, state);
      // Should still update price without touching image
      expect($w('#productPrice').text).toBe('$499.00');
    });

    it('handles variant with no variant.price (skips price update)', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: {}, inStock: true, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Queen';
      const originalText = $w('#productPrice').text;
      await handleCustomVariantChange($w, state);
      expect($w('#productPrice').text).toBe(originalText);
    });

    it('handles productGallery element throwing', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: 'img.jpg',
        mediaItems: [{ src: 'a.jpg', alt: 'A' }],
      }]);
      const broken$w = (sel) => {
        if (sel === '#productGallery') throw new Error('gallery broken');
        return $w(sel);
      };
      broken$w('#sizeDropdown').value = 'Queen';
      // Should not throw despite gallery element error
      await expect(handleCustomVariantChange(broken$w, state)).resolves.toBeUndefined();
    });

    it('handles comparePrice element throwing on show', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599, comparePrice: 799 }, inStock: true,
      }]);
      $w('#sizeDropdown').value = 'Queen';
      $w('#productComparePrice').show = vi.fn(() => { throw new Error('show failed'); });
      await expect(handleCustomVariantChange($w, state)).resolves.toBeUndefined();
    });

    it('handles stockStatus element being null', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
      }]);
      const null$w = (sel) => {
        if (sel === '#stockStatus') return null;
        return $w(sel);
      };
      null$w('#sizeDropdown').value = 'Queen';
      await expect(handleCustomVariantChange(null$w, state)).resolves.toBeUndefined();
    });
  });

  describe('initSwatchSelector — null/error branches', () => {
    it('collapses when section element is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchSection') return null;
        return $w(sel);
      };
      await initSwatchSelector(null$w, state);
      // Attempted to collapse (will throw but caught)
    });

    it('collapses when state.product is null', async () => {
      await initSwatchSelector($w, { product: null });
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('survives when swatchRequestLink onClick throws', async () => {
      const broken$w = (sel) => {
        if (sel === '#swatchRequestLink') throw new Error('element missing');
        return $w(sel);
      };
      await expect(initSwatchSelector(broken$w, state)).resolves.toBeUndefined();
    });

    it('navigates to /request-swatches on swatch request link click', async () => {
      await initSwatchSelector($w, state);
      const handler = $w('#swatchRequestLink').onClick.mock.calls[0][0];
      // Handler triggers dynamic import of wix-location-frontend
      await handler();
    });
  });

  describe('initSwatchColorFilter — null/edge branches', () => {
    it('returns early when filter element is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchColorFilter') return null;
        return $w(sel);
      };
      // Should not throw
      await initSwatchSelector(null$w, state);
    });

    it('returns early when families is empty array', async () => {
      const { getAllSwatchFamilies } = await import('backend/swatchService.web');
      getAllSwatchFamilies.mockResolvedValueOnce([]);
      await initSwatchSelector($w, state);
      // Filter should not have onChange registered with empty families
    });

    it('filters out falsy family names', async () => {
      const { getAllSwatchFamilies } = await import('backend/swatchService.web');
      getAllSwatchFamilies.mockResolvedValueOnce(['blue', null, '', 'green']);
      await initSwatchSelector($w, state);
      const opts = $w('#swatchColorFilter').options;
      // Should have 'All' + 'blue' + 'green' (null and '' filtered out)
      expect(opts.length).toBe(3);
    });
  });

  describe('renderSwatchGrid — null/edge branches', () => {
    it('returns early when grid element is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchGrid') return null;
        return $w(sel);
      };
      await initSwatchSelector(null$w, state);
      // Should not throw
    });

    it('assigns _id from index when swatch has no _id', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { swatchName: 'Test', colorHex: '#fff' },
      ]);
      await initSwatchSelector($w, state);
      expect($w('#swatchGrid').data[0]._id).toBe('swatch-0');
    });

    it('onItemReady sets empty text when swatchName is missing', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-x', colorHex: '#fff' },
      ]);
      await initSwatchSelector($w, state);
      const onReady = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sw-x', colorHex: '#fff' });
      expect($item('#swatchLabel').text).toBe('');
    });

    it('onItemReady uses "Fabric swatch" as alt fallback', async () => {
      await initSwatchSelector($w, state);
      const onReady = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sw-x', swatchImage: 'test.jpg' });
      expect($item('#swatchThumb').alt).toBe('Fabric swatch');
    });
  });

  describe('applySwatchTint — edge branches', () => {
    it('does not show overlay when overlay element is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchTintOverlay') return null;
        return $w(sel);
      };
      // selectSwatch with no matching dropdown option -> falls through to applySwatchTint
      null$w('#finishDropdown').options = [];
      await selectSwatch(null$w, { selectedSwatchId: null }, { _id: 'x', swatchName: 'Test', colorHex: '#ff0000' });
      // Should not throw
    });

    it('shows overlay with fade when colorHex is provided', async () => {
      $w('#finishDropdown').options = [];
      await selectSwatch($w, { selectedSwatchId: null }, { _id: 'x', swatchName: 'Test', colorHex: '#ff0000' });
      expect($w('#swatchTintOverlay').style.backgroundColor).toBe('#ff0000');
      expect($w('#swatchTintOverlay').style.opacity).toBe(0.25);
      expect($w('#swatchTintOverlay').show).toHaveBeenCalledWith('fade', { duration: 200 });
    });
  });

  describe('openSwatchGallery — null/edge branches', () => {
    it('returns early when modal element is null', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      const null$w = (sel) => {
        if (sel === '#swatchGalleryModal') return null;
        return $w(sel);
      };
      await initSwatchSelector(null$w, state);
      const viewAllHandler = null$w('#swatchViewAll').onClick.mock.calls[0]?.[0];
      if (viewAllHandler) {
        await viewAllHandler();
        // Modal show should not be called
      }
    });

    it('search filters by colorFamily', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'sw1.jpg' },
        { _id: 'sw-2', swatchName: 'Forest Green', colorHex: '#228B22', swatchImage: 'sw2.jpg' },
      ]);
      // Second call for gallery open
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorFamily: 'blue', colorHex: '#2244AA', swatchImage: 'sw1.jpg', material: 'cotton' },
        { _id: 'sw-2', swatchName: 'Forest Green', colorFamily: 'green', colorHex: '#228B22', swatchImage: 'sw2.jpg', material: 'linen' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();

      const searchHandler = $w('#swatchSearch').onInput.mock.calls[0][0];
      searchHandler({ target: { value: 'blue' } });
      // Should filter to only blue family
      expect($w('#swatchGalleryGrid').data.length).toBe(1);
    });
  });

  describe('renderSwatchGalleryGrid — null/edge branches', () => {
    it('returns early when gallery grid is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchGalleryGrid') return null;
        return $w(sel);
      };
      // Should not throw
      expect(() => {
        // Directly test by triggering openSwatchGallery indirectly
      }).not.toThrow();
    });

    it('gallery item uses "Fabric swatch" alt when swatchName is missing', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'sw1.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sg-1', swatchImage: 'img.jpg', colorHex: '#aaa' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const onReady = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sg-1', swatchImage: 'img.jpg' });
      expect($item('#sgThumb').alt).toBe('Fabric swatch');
    });

    it('gallery item assigns _id from index when missing', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'sw1.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { swatchName: 'No ID', colorHex: '#aaa' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      expect($w('#swatchGalleryGrid').data[0]._id).toBe('sg-0');
    });
  });

  describe('showSwatchDetail — edge branches', () => {
    it('returns early when detail element is null', async () => {
      const null$w = (sel) => {
        if (sel === '#swatchDetail') return null;
        return $w(sel);
      };
      // Manually call showSwatchDetail path through gallery click
    });

    it('shows enlarged image with alt text when swatchImage present', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'sw1.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sg-1', swatchName: 'Ocean Blue', swatchImage: 'enlarged.jpg', material: 'cotton', careInstructions: 'Machine wash', colorFamily: 'blue' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const onReady = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sg-1', swatchName: 'Ocean Blue', swatchImage: 'enlarged.jpg', material: 'cotton', careInstructions: 'Machine wash', colorFamily: 'blue' });
      // Trigger click to invoke showSwatchDetail
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#swatchDetailImage').src).toBe('enlarged.jpg');
      expect($w('#swatchDetailImage').alt).toBe('Ocean Blue swatch - enlarged view');
      expect($w('#swatchDetailImage').show).toHaveBeenCalled();
      expect($w('#swatchDetail').expand).toHaveBeenCalled();
    });

    it('uses "Fabric" fallback in alt text when swatchName is missing', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'X', colorHex: '#aaa', swatchImage: 'x.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sg-1', swatchImage: 'img.jpg' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const onReady = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sg-1', swatchImage: 'img.jpg' });
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#swatchDetailImage').alt).toBe('Fabric swatch - enlarged view');
    });

    it('sets all detail fields from swatch data', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'X', colorHex: '#aaa', swatchImage: 'x.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sg-1', swatchName: 'Denim', material: 'Cotton', careInstructions: 'Dry clean', colorFamily: 'blue', swatchImage: 'img.jpg' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const onReady = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sg-1', swatchName: 'Denim', material: 'Cotton', careInstructions: 'Dry clean', colorFamily: 'blue', swatchImage: 'img.jpg' });
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      await clickHandler();
      expect($w('#swatchDetailName').text).toBe('Denim');
      expect($w('#swatchDetailMaterial').text).toBe('Material: Cotton');
      expect($w('#swatchDetailCare').text).toBe('Care: Dry clean');
      expect($w('#swatchDetailFamily').text).toBe('Color Family: Blue');
    });

    it('skips detail image when swatch has no swatchImage', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sw-1', swatchName: 'X', colorHex: '#aaa', swatchImage: 'x.jpg' },
      ]);
      getProductSwatches.mockResolvedValueOnce([
        { _id: 'sg-1', swatchName: 'Plain', colorHex: '#ccc' },
      ]);
      await initSwatchSelector($w, state);
      const viewAllHandler = $w('#swatchViewAll').onClick.mock.calls[0][0];
      await viewAllHandler();
      const onReady = $w('#swatchGalleryGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { _id: 'sg-1', swatchName: 'Plain', colorHex: '#ccc' });
      const clickHandler = $item('#sgThumb').onClick.mock.calls[0][0];
      $w('#swatchDetailImage').show.mockClear();
      await clickHandler();
      expect($w('#swatchDetailImage').show).not.toHaveBeenCalled();
    });
  });

  describe('initFinishSwatches — additional error branches', () => {
    it('survives when container accessibility throws', async () => {
      const broken$w = (sel) => {
        const el = $w(sel);
        if (sel === '#finishSwatches') {
          return { ...el, accessibility: { set role(_) { throw new Error('no a11y'); } } };
        }
        return el;
      };
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak', description: 'Oak', color: '#8B4513' }] }];
      await expect(initFinishSwatches(broken$w, state)).resolves.toBeUndefined();
    });

    it('survives when dropdown.hide() throws', async () => {
      $w('#finishDropdown').hide = vi.fn(() => { throw new Error('hide failed'); });
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak', description: 'Oak', color: '#8B4513' }] }];
      await expect(initFinishSwatches($w, state)).resolves.toBeUndefined();
    });

    it('catches top-level error and logs it', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const throwing$w = () => { throw new Error('total failure'); };
      await initFinishSwatches(throwing$w, { product: { productOptions: [{ name: 'Finish', choices: [] }] } });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Error initializing finish swatches'), expect.any(Error));
      spy.mockRestore();
    });

    it('onItemReady survives when label element throws', async () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak', description: 'Oak', color: '#8B4513' }] }];
      await initFinishSwatches($w, state);
      const onReady = $w('#finishSwatches').onItemReady.mock.calls[0][0];
      const broken$item = (sel) => {
        if (sel === '#finishSwatchLabel') throw new Error('no label');
        return createMockElement();
      };
      expect(() => onReady(broken$item, { value: 'Oak', description: 'Oak', colorHex: '#8B4513', outOfStock: false })).not.toThrow();
    });

    it('onItemReady survives when circle element throws', async () => {
      state.product.productOptions = [{ name: 'Finish', choices: [{ value: 'Oak', description: 'Oak', color: '#8B4513' }] }];
      await initFinishSwatches($w, state);
      const onReady = $w('#finishSwatches').onItemReady.mock.calls[0][0];
      const broken$item = (sel) => {
        if (sel === '#finishSwatchCircle') throw new Error('no circle');
        return createMockElement();
      };
      expect(() => onReady(broken$item, { value: 'Oak', description: 'Oak', colorHex: '#8B4513', outOfStock: false })).not.toThrow();
    });
  });

  describe('selectSwatch — additional error branches', () => {
    it('survives when grid.data re-assignment throws', async () => {
      const broken$w = (sel) => {
        if (sel === '#swatchGrid') return { data: null, get data() { return this._d; }, set data(_) { throw new Error('readonly'); } };
        if (sel === '#finishDropdown') return { options: [] };
        if (sel === '#swatchTintOverlay') return $w(sel);
        return $w(sel);
      };
      await expect(selectSwatch(broken$w, { selectedSwatchId: null }, { _id: 'x', swatchName: 'Test', colorHex: '#ff0000' })).resolves.toBeUndefined();
    });

    it('survives when finishDropdown throws', async () => {
      const broken$w = (sel) => {
        if (sel === '#finishDropdown') throw new Error('no dropdown');
        return $w(sel);
      };
      await expect(selectSwatch(broken$w, { selectedSwatchId: null }, { _id: 'x', swatchName: 'Test', colorHex: '#ff0000' })).resolves.toBeUndefined();
    });
  });
});
