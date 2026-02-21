import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFinancingOptions, updateFinancingPrice } from '../src/public/ProductFinancing.js';
import { futonFrame } from './fixtures/products.js';

// Mock backend module
const mockPlans = [
  { term: 4, apr: 0, label: 'Pay in 4', description: '4 interest-free payments', monthly: 150, total: 600, interest: 0 },
  { term: 6, apr: 0, label: '6 Months', description: '0% APR for 6 months', monthly: 100, total: 600, interest: 0 },
  { term: 12, apr: 0, label: '12 Months', description: '0% APR for 12 months', monthly: 50, total: 600, interest: 0 },
  { term: 24, apr: 9.99, label: '24 Months', description: '9.99% APR for 24 months', monthly: 27.63, total: 663.12, interest: 63.12 },
];

vi.mock('backend/financingService.web', () => ({
  getFinancingOptions: vi.fn(async () => mockPlans),
  getLowestMonthlyDisplay: vi.fn(async () => 'As low as $50/mo'),
}));

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    items: [],
    accessibility: { ariaLabel: '' },
  };
}

function createMock$w(overrides = {}) {
  const elements = {};

  const $w = (selector) => {
    if (overrides[selector] === null) return null;
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  };

  // Pre-create elements if overrides specify them
  for (const [sel, val] of Object.entries(overrides)) {
    if (val !== null) elements[sel] = val;
  }

  $w._elements = elements;
  return $w;
}

describe('ProductFinancing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initFinancingOptions', () => {
    it('expands financing section for eligible price', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').expand).toHaveBeenCalled();
    });

    it('sets teaser text', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingTeaser').text).toBe('As low as $50/mo');
      expect($w('#financingTeaser').show).toHaveBeenCalled();
    });

    it('populates plan repeater with data', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      expect(repeater.data).toHaveLength(4);
      expect(repeater.data[0]._id).toBe('plan-0');
      expect(repeater.data[0].label).toBe('Pay in 4');
    });

    it('calls onItemReady with plan data', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();

      // Simulate onItemReady callback
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockPlans[0]);

      expect($item('#planLabel').text).toBe('Pay in 4');
      expect($item('#planMonthly').text).toBe('$150/mo');
      expect($item('#planDescription').text).toBe('4 interest-free payments');
    });

    it('shows "No interest" for 0% APR plans', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockPlans[0]);

      expect($item('#planInterest').text).toBe('No interest');
    });

    it('shows total and APR for interest-bearing plans', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockPlans[3]);

      expect($item('#planInterest').text).toBe('$663.12 total (9.99% APR)');
    });

    it('collapses section when no product', async () => {
      const $w = createMock$w();
      const state = { product: null };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses section for zero price', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 0 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when no plans available', async () => {
      const { getFinancingOptions } = await import('backend/financingService.web');
      getFinancingOptions.mockResolvedValueOnce([]);

      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 25 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('sets up learn more button click handler', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingLearnMore').onClick).toHaveBeenCalled();
    });

    it('sets up close button handler', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingClose').onClick).toHaveBeenCalled();
    });

    it('sets up overlay dismiss handler', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingOverlay').onClick).toHaveBeenCalled();
    });

    it('sets accessibility labels', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingLearnMore').accessibility.ariaLabel).toBe('Learn more about financing options');
      expect($w('#financingClose').accessibility.ariaLabel).toBe('Close financing details');
    });

    it('handles missing financingSection gracefully', async () => {
      const $w = createMock$w({ '#financingSection': null });
      const state = { product: { ...futonFrame, price: 600 } };

      // Should not throw
      await initFinancingOptions($w, state);
    });

    it('opens modal with detail repeater on learn more click', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      // Simulate clicking "Learn More"
      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#financingOverlay').show).toHaveBeenCalledWith('fade', { duration: 200 });
      expect($w('#financingModal').show).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('populates detail repeater in modal', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      // Open modal
      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      const detailRepeater = $w('#financingDetailRepeater');
      expect(detailRepeater.data).toHaveLength(4);

      // Simulate onItemReady
      const callback = detailRepeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockPlans[2]);

      expect($item('#detailLabel').text).toBe('12 Months');
      expect($item('#detailTerm').text).toBe('12 payments');
      expect($item('#detailMonthly').text).toBe('$50/mo');
      expect($item('#detailTotal').text).toBe('Total: $600');
      expect($item('#detailApr').text).toBe('0% APR');
      expect($item('#detailInterest').text).toBe('No interest charges');
    });

    it('shows interest in detail for APR plans', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      const detailRepeater = $w('#financingDetailRepeater');
      const callback = detailRepeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockPlans[3]);

      expect($item('#detailApr').text).toBe('9.99% APR');
      expect($item('#detailInterest').text).toBe('Interest: $63.12');
    });

    it('closes modal on close button click', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const closeHandler = $w('#financingClose').onClick.mock.calls[0][0];
      closeHandler();

      expect($w('#financingModal').hide).toHaveBeenCalledWith('fade', { duration: 200 });
      expect($w('#financingOverlay').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('closes modal on overlay click', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const overlayHandler = $w('#financingOverlay').onClick.mock.calls[0][0];
      overlayHandler();

      expect($w('#financingModal').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });
  });

  describe('updateFinancingPrice', () => {
    it('refreshes plans for new price', async () => {
      const $w = createMock$w();
      await updateFinancingPrice($w, 600);

      expect($w('#financingSection').expand).toHaveBeenCalled();
      expect($w('#financingTeaser').text).toBe('As low as $50/mo');
    });

    it('collapses for zero price', async () => {
      const $w = createMock$w();
      await updateFinancingPrice($w, 0);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses for negative price', async () => {
      const $w = createMock$w();
      await updateFinancingPrice($w, -100);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses when no plans returned', async () => {
      const { getFinancingOptions } = await import('backend/financingService.web');
      getFinancingOptions.mockResolvedValueOnce([]);

      const $w = createMock$w();
      await updateFinancingPrice($w, 25);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });
  });
});
