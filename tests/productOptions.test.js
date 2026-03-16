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
});
