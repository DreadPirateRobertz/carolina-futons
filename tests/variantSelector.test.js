import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/cartService', () => ({
  getProductVariants: vi.fn().mockResolvedValue([
    {
      inStock: true,
      variant: { price: 599, comparePrice: 699 },
      imageSrc: 'https://example.com/variant.jpg',
      mediaItems: [{ src: 'https://example.com/v1.jpg', alt: 'Variant 1' }],
    },
  ]),
  addToCart: vi.fn(),
  onCartChanged: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4CAF50',
    sunsetCoral: '#E8845C',
  },
}));

import {
  formatCurrency,
  initVariantSelector,
  handleCustomVariantChange,
} from '../src/public/product/variantSelector.js';
import { getProductVariants } from 'public/cartService';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    items: [],
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

describe('variantSelector', () => {
  let $w, product;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    product = { ...futonFrame, _id: 'prod-1' };
  });

  describe('formatCurrency', () => {
    it('formats whole dollar amount', () => {
      expect(formatCurrency(599)).toBe('$599.00');
    });

    it('formats cents correctly', () => {
      expect(formatCurrency(19.99)).toBe('$19.99');
    });

    it('formats zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('formats large amounts with comma separator', () => {
      expect(formatCurrency(1999)).toBe('$1,999.00');
    });

    it('formats negative amounts', () => {
      expect(formatCurrency(-50)).toBe('-$50.00');
    });
  });

  describe('initVariantSelector', () => {
    it('registers onChange on size dropdown', () => {
      initVariantSelector($w, product);
      expect($w('#sizeDropdown').onChange).toHaveBeenCalled();
    });

    it('registers onChange on finish dropdown', () => {
      initVariantSelector($w, product);
      expect($w('#finishDropdown').onChange).toHaveBeenCalled();
    });

    it('does not throw when dropdowns do not exist', () => {
      const brokenW = () => null;
      expect(() => initVariantSelector(brokenW, product)).not.toThrow();
    });

    it('calls onVariantChange callback when variant changes', async () => {
      const onVariantChange = vi.fn();
      initVariantSelector($w, product, { onVariantChange });

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      const changeCb = $w('#sizeDropdown').onChange.mock.calls[0][0];
      await changeCb();

      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Size: 'Full', Finish: 'Natural' });
      expect(onVariantChange).toHaveBeenCalledWith(
        expect.objectContaining({ inStock: true })
      );
    });
  });

  describe('handleCustomVariantChange', () => {
    it('queries variants with size and finish choices', async () => {
      $w('#sizeDropdown').value = 'Queen';
      $w('#finishDropdown').value = 'Espresso';

      await handleCustomVariantChange($w, product);

      expect(getProductVariants).toHaveBeenCalledWith('prod-1', {
        Size: 'Queen',
        Finish: 'Espresso',
      });
    });

    it('queries with only size when finish is empty', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = '';

      await handleCustomVariantChange($w, product);

      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Size: 'Full' });
    });

    it('queries with only finish when size is empty', async () => {
      $w('#sizeDropdown').value = '';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect(getProductVariants).toHaveBeenCalledWith('prod-1', { Finish: 'Natural' });
    });

    it('returns early when both dropdowns are empty', async () => {
      $w('#sizeDropdown').value = '';
      $w('#finishDropdown').value = '';

      await handleCustomVariantChange($w, product);

      expect(getProductVariants).not.toHaveBeenCalled();
    });

    it('updates price element with variant price', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productPrice').text).toBe('$599.00');
    });

    it('shows compare price when variant has one', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productComparePrice').text).toBe('$699.00');
      expect($w('#productComparePrice').show).toHaveBeenCalled();
    });

    it('hides compare price when variant has none', async () => {
      getProductVariants.mockResolvedValueOnce([{
        inStock: true,
        variant: { price: 499, comparePrice: null },
      }]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productComparePrice').hide).toHaveBeenCalled();
    });

    it('shows "In Stock" when variant is in stock', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#stockStatus').text).toBe('In Stock');
      expect($w('#stockStatus').style.color).toBe('#4CAF50');
      expect($w('#stockStatus').show).toHaveBeenCalled();
    });

    it('shows "Special Order" when variant is out of stock', async () => {
      getProductVariants.mockResolvedValueOnce([{
        inStock: false,
        variant: { price: 599 },
      }]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#stockStatus').text).toBe('Special Order');
      expect($w('#stockStatus').style.color).toBe('#E8845C');
    });

    it('updates main product image when variant has imageSrc', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productMainImage').src).toBe('https://example.com/variant.jpg');
    });

    it('updates product gallery with variant media items', async () => {
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      const gallery = $w('#productGallery');
      expect(gallery.items).toEqual([
        { type: 'image', src: 'https://example.com/v1.jpg', alt: 'Variant 1' },
      ]);
    });

    it('uses product name as alt fallback for gallery items', async () => {
      getProductVariants.mockResolvedValueOnce([{
        inStock: true,
        variant: { price: 599 },
        mediaItems: [{ url: 'https://example.com/v1.jpg' }],
      }]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productGallery').items[0].alt).toBe(product.name);
    });

    it('does nothing when getProductVariants returns empty array', async () => {
      getProductVariants.mockResolvedValueOnce([]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productPrice').text).toBe('');
    });

    it('does nothing when getProductVariants returns null', async () => {
      getProductVariants.mockResolvedValueOnce(null);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productPrice').text).toBe('');
    });

    it('handles backend error gracefully', async () => {
      getProductVariants.mockRejectedValueOnce(new Error('API timeout'));

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await expect(handleCustomVariantChange($w, product)).resolves.not.toThrow();
    });

    it('calls onVariantChange with selected variant', async () => {
      const onVariantChange = vi.fn();
      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product, onVariantChange);

      expect(onVariantChange).toHaveBeenCalledWith(
        expect.objectContaining({ inStock: true, variant: { price: 599, comparePrice: 699 } })
      );
    });

    it('skips gallery update when variant has no mediaItems', async () => {
      getProductVariants.mockResolvedValueOnce([{
        inStock: true,
        variant: { price: 499 },
        imageSrc: 'img.jpg',
        mediaItems: [],
      }]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productGallery').items).toEqual([]);
    });

    it('uses media item url as fallback when src is missing', async () => {
      getProductVariants.mockResolvedValueOnce([{
        inStock: true,
        variant: { price: 499 },
        mediaItems: [{ url: 'https://example.com/fallback.jpg', alt: 'Fallback' }],
      }]);

      $w('#sizeDropdown').value = 'Full';
      $w('#finishDropdown').value = 'Natural';

      await handleCustomVariantChange($w, product);

      expect($w('#productGallery').items[0].src).toBe('https://example.com/fallback.jpg');
    });
  });
});
