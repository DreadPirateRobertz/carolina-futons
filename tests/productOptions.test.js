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

import { initVariantSelector, handleCustomVariantChange, initSwatchSelector, selectSwatch } from '../src/public/ProductOptions.js';

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
      // Should not throw
      await handleCustomVariantChange($w, state);
      // Price should not have been updated (still default)
    });

    it('handles getProductVariants throwing an error', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockRejectedValueOnce(new Error('Network fail'));
      $w('#sizeDropdown').value = 'Full';
      // Should not throw
      await expect(handleCustomVariantChange($w, state)).resolves.not.toThrow();
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
});
