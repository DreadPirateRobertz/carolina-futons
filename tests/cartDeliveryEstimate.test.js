import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const { mockGetDeliveryEstimate } = vi.hoisted(() => ({
  mockGetDeliveryEstimate: vi.fn(),
}));
vi.mock('backend/checkoutOptimization.web', () => ({
  getDeliveryEstimate: mockGetDeliveryEstimate,
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

import {
  initCartDeliveryEstimate,
  updateCartDeliveryEstimate,
  formatDeliveryLabel,
} from '../src/public/cartDeliveryEstimate.js';
import { announce } from 'public/a11yHelpers';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: { color: '', backgroundColor: '', fontWeight: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

const MOCK_ESTIMATE = {
  success: true,
  data: {
    minDate: '2026-03-15',
    maxDate: '2026-03-22',
    label: 'Mar 15 – Mar 22',
  },
};

const MOCK_CART = {
  lineItems: [{ productId: 'p1', name: 'Futon', price: 599, quantity: 1 }],
  totals: { subtotal: 599, total: 648.99 },
};

// ── Tests ────────────────────────────────────────────────────────────

describe('cartDeliveryEstimate', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    mockGetDeliveryEstimate.mockResolvedValue(MOCK_ESTIMATE);
  });

  // ── formatDeliveryLabel ──────────────────────────────────────────

  describe('formatDeliveryLabel', () => {
    it('formats a delivery label from estimate data', () => {
      const result = formatDeliveryLabel(MOCK_ESTIMATE.data);
      expect(result).toBe('Estimated delivery: Mar 15 – Mar 22');
    });

    it('returns fallback for null data', () => {
      expect(formatDeliveryLabel(null)).toBe('Delivery estimate unavailable');
    });

    it('returns fallback for undefined data', () => {
      expect(formatDeliveryLabel(undefined)).toBe('Delivery estimate unavailable');
    });

    it('returns fallback for empty object', () => {
      expect(formatDeliveryLabel({})).toBe('Delivery estimate unavailable');
    });

    it('returns fallback when label is empty string', () => {
      expect(formatDeliveryLabel({ label: '' })).toBe('Delivery estimate unavailable');
    });
  });

  // ── initCartDeliveryEstimate ─────────────────────────────────────

  describe('initCartDeliveryEstimate', () => {
    it('fetches estimate and displays in delivery text element', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART);

      expect(mockGetDeliveryEstimate).toHaveBeenCalledWith('standard');
      expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 15 – Mar 22');
    });

    it('sets ARIA attributes on delivery text', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART);

      const el = $w('#cartDeliveryEstimate');
      expect(el.accessibility.role).toBe('status');
      expect(el.accessibility.ariaLive).toBe('polite');
      expect(el.accessibility.ariaLabel).toBe('Estimated delivery: Mar 15 – Mar 22');
    });

    it('expands the delivery section on success', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliverySection').expand).toHaveBeenCalled();
    });

    it('hides section when API returns failure', async () => {
      mockGetDeliveryEstimate.mockResolvedValue({ success: false, error: 'unavailable' });

      await initCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    });

    it('hides section when API throws', async () => {
      mockGetDeliveryEstimate.mockRejectedValue(new Error('Network error'));

      await initCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    });

    it('hides section for empty cart', async () => {
      await initCartDeliveryEstimate($w, { lineItems: [], totals: {} });

      expect(mockGetDeliveryEstimate).not.toHaveBeenCalled();
      expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    });

    it('hides section for null cart', async () => {
      await initCartDeliveryEstimate($w, null);

      expect(mockGetDeliveryEstimate).not.toHaveBeenCalled();
      expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    });

    it('shows truck icon on successful estimate', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliveryIcon').show).toHaveBeenCalled();
    });

    it('hides icon on failure', async () => {
      mockGetDeliveryEstimate.mockResolvedValue({ success: false });

      await initCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliveryIcon').hide).toHaveBeenCalled();
    });
  });

  // ── updateCartDeliveryEstimate ───────────────────────────────────

  describe('updateCartDeliveryEstimate', () => {
    it('updates text with fresh estimate', async () => {
      const newEstimate = {
        success: true,
        data: { minDate: '2026-03-17', maxDate: '2026-03-25', label: 'Mar 17 – Mar 25' },
      };
      mockGetDeliveryEstimate.mockResolvedValue(newEstimate);

      await updateCartDeliveryEstimate($w, MOCK_CART);

      expect($w('#cartDeliveryEstimate').text).toBe('Estimated delivery: Mar 17 – Mar 25');
    });

    it('announces update to screen readers', async () => {
      await updateCartDeliveryEstimate($w, MOCK_CART);

      expect(announce).toHaveBeenCalledWith($w, 'Estimated delivery: Mar 15 – Mar 22');
    });

    it('does not announce when estimate fails', async () => {
      mockGetDeliveryEstimate.mockResolvedValue({ success: false });

      await updateCartDeliveryEstimate($w, MOCK_CART);

      expect(announce).not.toHaveBeenCalled();
    });

    it('collapses section for empty cart on update', async () => {
      await updateCartDeliveryEstimate($w, { lineItems: [], totals: {} });

      expect($w('#cartDeliverySection').collapse).toHaveBeenCalled();
    });

    it('handles missing $w elements gracefully', async () => {
      const broken$w = () => { throw new Error('Element not found'); };
      // Should not throw
      await expect(updateCartDeliveryEstimate(broken$w, MOCK_CART)).resolves.not.toThrow();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles cart with undefined totals', async () => {
      await initCartDeliveryEstimate($w, { lineItems: [{ productId: 'p1' }] });

      // Should still fetch estimate (cart has items)
      expect(mockGetDeliveryEstimate).toHaveBeenCalled();
    });

    it('handles cart with zero subtotal', async () => {
      const zeroCart = { lineItems: [{ productId: 'p1' }], totals: { subtotal: 0 } };
      await initCartDeliveryEstimate($w, zeroCart);

      expect(mockGetDeliveryEstimate).toHaveBeenCalled();
    });

    it('defaults to standard shipping method', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART);

      expect(mockGetDeliveryEstimate).toHaveBeenCalledWith('standard');
    });

    it('accepts custom shipping method', async () => {
      await initCartDeliveryEstimate($w, MOCK_CART, 'white_glove_local');

      expect(mockGetDeliveryEstimate).toHaveBeenCalledWith('white_glove_local');
    });
  });
});
