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

    it('returns early when both size and finish are empty', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#sizeDropdown').value = '';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).not.toHaveBeenCalled();
    });

    it('queries with only size when finish is empty', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#sizeDropdown').value = 'Queen';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Size: 'Queen' });
    });

    it('does not update display when no variants returned', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      // Price should remain unchanged
      expect($w('#productPrice').text).toBe('');
    });

    it('handles API error gracefully', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockRejectedValueOnce(new Error('Network fail'));
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      // Should not throw
      await expect(handleCustomVariantChange($w, state)).resolves.toBeUndefined();
    });

    it('shows call-for-price text for $0 products', async () => {
      state.product = { ...state.product, price: 0 };
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 0 }, inStock: true, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productPrice').text).toBe('Call for Pricing \u2014 (828) 327-8030');
    });

    it('updates stock badge to In Stock', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').text).toBe('In Stock');
    });

    it('updates stock badge to Special Order when out of stock', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: false, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#stockStatus').text).toBe('Special Order');
    });

    it('shows compare price when variant has one', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599, comparePrice: 799 }, inStock: true, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productComparePrice').text).toBe('$799.00');
      expect($w('#productComparePrice').show).toHaveBeenCalled();
    });

    it('hides compare price when variant lacks one', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: null, mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productComparePrice').hide).toHaveBeenCalled();
    });

    it('updates main image and alt text on variant with imageSrc', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true,
        imageSrc: 'https://example.com/natural.jpg',
        label: 'Natural',
        mediaItems: [],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productMainImage').src).toBe('https://example.com/natural.jpg');
      expect($w('#productMainImage').alt).toContain('Natural');
    });

    it('updates gallery items when variant has mediaItems', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockResolvedValueOnce([{
        variant: { price: 599 }, inStock: true, imageSrc: null,
        mediaItems: [
          { src: 'https://example.com/a.jpg', alt: 'Angle A' },
          { src: 'https://example.com/b.jpg', alt: 'Angle B' },
        ],
      }]);
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';
      await handleCustomVariantChange($w, state);
      expect($w('#productGallery').items).toHaveLength(2);
      expect($w('#productGallery').items[0].type).toBe('image');
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

    it('registers onClick on swatchViewAll button', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchViewAll').onClick).toHaveBeenCalled();
    });

    it('registers onClick on swatchRequestLink', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchRequestLink').onClick).toHaveBeenCalled();
    });

    it('collapses on backend error', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockRejectedValueOnce(new Error('Backend down'));
      await initSwatchSelector($w, state);
      expect($w('#swatchSection').collapse).toHaveBeenCalled();
    });

    it('sets swatch grid data with _id fallback', async () => {
      const { getProductSwatches } = await import('backend/swatchService.web');
      getProductSwatches.mockResolvedValueOnce([
        { swatchName: 'No ID Swatch', colorHex: '#FF0000' },
      ]);
      await initSwatchSelector($w, state);
      expect($w('#swatchGrid').data[0]._id).toBe('swatch-0');
    });

    it('renders swatch grid with onItemReady callback', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchGrid').onItemReady).toHaveBeenCalled();
      // Simulate onItemReady callback
      const callback = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      const itemData = { _id: 'sw-1', swatchName: 'Ocean Blue', swatchImage: 'https://example.com/sw1.jpg' };
      callback($item, itemData);
      expect($item('#swatchThumb').src).toBe('https://example.com/sw1.jpg');
      expect($item('#swatchLabel').text).toBe('Ocean Blue');
    });

    it('renders swatch grid item with colorHex fallback when no image', async () => {
      await initSwatchSelector($w, state);
      const callback = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      const itemData = { _id: 'sw-3', swatchName: 'Red', colorHex: '#FF0000' };
      callback($item, itemData);
      expect($item('#swatchThumb').style.backgroundColor).toBe('#FF0000');
    });

    it('highlights selected swatch in grid', async () => {
      state.selectedSwatchId = 'sw-1';
      await initSwatchSelector($w, state);
      const callback = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      callback($item, { _id: 'sw-1', swatchName: 'Ocean Blue', swatchImage: 'https://example.com/sw1.jpg' });
      expect($item('#swatchThumb').style.borderColor).toBe('#1e3a5f'); // mountainBlue
      expect($item('#swatchThumb').style.borderWidth).toBe('3px');
    });

    it('does not highlight unselected swatch in grid', async () => {
      state.selectedSwatchId = 'sw-1';
      await initSwatchSelector($w, state);
      const callback = $w('#swatchGrid').onItemReady.mock.calls[0][0];
      const $item = create$w();
      callback($item, { _id: 'sw-2', swatchName: 'Forest Green', swatchImage: 'https://example.com/sw2.jpg' });
      expect($item('#swatchThumb').style.borderWidth).toBe('1px');
    });

    it('registers color filter onChange that re-fetches swatches', async () => {
      await initSwatchSelector($w, state);
      expect($w('#swatchColorFilter').onChange).toHaveBeenCalled();
    });

    it('capitalizes family names in filter options', async () => {
      await initSwatchSelector($w, state);
      const opts = $w('#swatchColorFilter').options;
      expect(opts[1].label).toBe('Blue');
      expect(opts[2].label).toBe('Green');
      expect(opts[3].label).toBe('Neutral');
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

    it('triggers variant change when swatch matches finish option', async () => {
      const { getProductVariants } = await import('public/cartService');
      getProductVariants.mockClear();
      $w('#finishDropdown').options = [
        { label: 'Ocean Blue', value: 'ocean-blue' },
        { label: 'Natural', value: 'natural' },
      ];
      $w('#sizeDropdown').value = 'Full';
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#finishDropdown').value).toBe('ocean-blue');
      expect(getProductVariants).toHaveBeenCalled();
    });

    it('refreshes grid data to update selection visuals', async () => {
      $w('#swatchGrid').data = [
        { _id: 'sw-1', swatchName: 'Ocean Blue' },
        { _id: 'sw-2', swatchName: 'Forest Green' },
      ];
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      // Grid data should be a new array reference (spread copy)
      expect($w('#swatchGrid').data).toHaveLength(2);
    });

    it('sets tint overlay opacity to 0.25', async () => {
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA' });
      expect($w('#swatchTintOverlay').style.opacity).toBe(0.25);
    });

    it('does not apply tint when colorHex is null', async () => {
      await selectSwatch($w, state, { _id: 'sw-1', swatchName: 'Custom', colorHex: null });
      // Overlay should not have been modified
      expect($w('#swatchTintOverlay').show).not.toHaveBeenCalled();
    });
  });
});
