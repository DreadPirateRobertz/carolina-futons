import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/inventoryService.web', () => ({
  getStockStatus: vi.fn(),
}));

import { initInventoryDisplay } from '../src/public/InventoryDisplay.js';
import { getStockStatus } from 'backend/inventoryService.web';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: { color: '', backgroundColor: '' },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(),
    onItemReady: vi.fn(), data: [],
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('InventoryDisplay', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { _id: 'prod-1', name: 'Test Futon' } };
  });

  describe('initInventoryDisplay', () => {
    it('returns early when product is null', async () => {
      state.product = null;
      await initInventoryDisplay($w, state);
      expect(getStockStatus).not.toHaveBeenCalled();
    });

    it('returns early when product has no _id', async () => {
      state.product = { name: 'No ID' };
      await initInventoryDisplay($w, state);
      expect(getStockStatus).not.toHaveBeenCalled();
    });

    it('calls getStockStatus with product ID', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect(getStockStatus).toHaveBeenCalledWith('prod-1');
    });

    it('shows "In Stock" with success color for in_stock status', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#stockStatus').text).toBe('In Stock');
    });

    it('shows "Out of Stock" with error color for out_of_stock status', async () => {
      getStockStatus.mockResolvedValue({ status: 'out_of_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#stockStatus').text).toBe('Out of Stock');
    });

    it('shows "Low Stock" with coral color for low_stock status', async () => {
      getStockStatus.mockResolvedValue({ status: 'low_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#stockStatus').text).toContain('Low Stock');
    });

    it('shows "Pre-Order Available" when preOrder is true', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', preOrder: true, variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#stockStatus').text).toBe('Pre-Order Available');
    });

    it('sets aria-label on stock status badge', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#stockStatus').accessibility.ariaLabel).toContain('In Stock');
    });

    it('populates variant stock repeater when variants exist', async () => {
      getStockStatus.mockResolvedValue({
        status: 'in_stock',
        variants: [
          { variantId: 'v1', variantLabel: 'Full / Natural', status: 'in_stock', quantity: 10 },
          { variantId: 'v2', variantLabel: 'Queen / Espresso', status: 'low_stock', quantity: 3 },
        ],
      });
      await initInventoryDisplay($w, state);
      const repeater = $w('#variantStockRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]._id).toBe('v1');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('variant repeater shows "Sold Out" for out_of_stock variants', async () => {
      getStockStatus.mockResolvedValue({
        status: 'low_stock',
        variants: [
          { variantId: 'v1', variantLabel: 'Full', status: 'out_of_stock', quantity: 0 },
        ],
      });
      await initInventoryDisplay($w, state);
      const repeater = $w('#variantStockRepeater');
      const onReady = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { variantLabel: 'Full', status: 'out_of_stock', quantity: 0 });
      expect($item('#variantStockLabel').text).toBe('Full');
      expect($item('#variantStockStatus').text).toBe('Sold Out');
    });

    it('variant repeater shows quantity for low_stock variants', async () => {
      getStockStatus.mockResolvedValue({
        status: 'low_stock',
        variants: [
          { variantId: 'v1', variantLabel: 'Queen', status: 'low_stock', quantity: 3 },
        ],
      });
      await initInventoryDisplay($w, state);
      const repeater = $w('#variantStockRepeater');
      const onReady = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { variantLabel: 'Queen', status: 'low_stock', quantity: 3 });
      expect($item('#variantStockStatus').text).toBe('Only 3 left');
    });

    it('variant repeater shows "Available" for in_stock variants', async () => {
      getStockStatus.mockResolvedValue({
        status: 'in_stock',
        variants: [
          { variantId: 'v1', variantLabel: 'Full', status: 'in_stock', quantity: 20 },
        ],
      });
      await initInventoryDisplay($w, state);
      const repeater = $w('#variantStockRepeater');
      const onReady = repeater.onItemReady.mock.calls[0][0];
      const $item = create$w();
      onReady($item, { variantLabel: 'Full', status: 'in_stock', quantity: 20 });
      expect($item('#variantStockStatus').text).toBe('Available');
    });

    it('skips variant repeater when no variants', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
      await initInventoryDisplay($w, state);
      expect($w('#variantStockRepeater').onItemReady).not.toHaveBeenCalled();
    });

    it('does not throw when getStockStatus rejects', async () => {
      getStockStatus.mockRejectedValue(new Error('Network error'));
      await expect(initInventoryDisplay($w, state)).resolves.not.toThrow();
    });

    it('does not throw when $w element is missing', async () => {
      getStockStatus.mockResolvedValue({ status: 'in_stock', variants: [] });
      const broken$w = () => { throw new Error('element not found'); };
      await expect(initInventoryDisplay(broken$w, state)).resolves.not.toThrow();
    });
  });
});
