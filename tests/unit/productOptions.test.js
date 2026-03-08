import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from '../fixtures/products.js';

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
}));

vi.mock('public/AddToCart.js', () => ({ updateStickyPrice: vi.fn() }));

import { initVariantSelector, handleCustomVariantChange, initSwatchSelector, selectSwatch } from '../../src/public/ProductOptions.js';

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
  });
});
