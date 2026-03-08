import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initFinancingOptions, updateFinancingPrice } from '../../src/public/ProductFinancing.js';
import { futonFrame } from '../fixtures/products.js';

// Mock financingCalc.web backend (replaces old financingService.web)
const mockWidgetResult = {
  success: true,
  price: 600,
  eligible: true,
  minimumAmount: 200,
  terms: [
    { months: 6, apr: 0, label: '6 Months', description: '0% APR for 6 months', monthly: 100, total: 600, interest: 0, isZeroInterest: true },
    { months: 12, apr: 0, label: '12 Months', description: '0% APR for 12 months', monthly: 50, total: 600, interest: 0, isZeroInterest: true },
    { months: 24, apr: 9.99, label: '24 Months', description: '9.99% APR for 24 months', monthly: 27.63, total: 663.12, interest: 63.12, isZeroInterest: false },
  ],
  afterpay: {
    eligible: true,
    installments: 4,
    installmentAmount: 150,
    total: 600,
    message: 'or 4 interest-free payments of $150.00 with Afterpay',
    schedule: [
      { payment: 1, label: 'Today', amount: 150 },
      { payment: 2, label: 'In 2 weeks', amount: 150 },
      { payment: 3, label: 'In 4 weeks', amount: 150 },
      { payment: 4, label: 'In 6 weeks', amount: 150 },
    ],
  },
  lowestMonthly: 'As low as $50/mo',
  widgetData: {
    showWidget: true,
    sections: [
      { type: 'afterpay', title: 'Pay in 4', subtitle: 'Interest-free with Afterpay', highlight: '$150.00/payment' },
      { type: 'financing', title: '6 Months', subtitle: '0% APR for 6 months', highlight: '$100.00/mo', details: { monthly: 100, total: 600, interest: 0, apr: 0 } },
      { type: 'financing', title: '12 Months', subtitle: '0% APR for 12 months', highlight: '$50.00/mo', details: { monthly: 50, total: 600, interest: 0, apr: 0 } },
      { type: 'financing', title: '24 Months', subtitle: '9.99% APR for 24 months', highlight: '$27.63/mo', details: { monthly: 27.63, total: 663.12, interest: 63.12, apr: 9.99 } },
    ],
    defaultSection: 0,
    minimumAmount: 200,
    belowMinimum: false,
    belowMinimumMessage: null,
  },
};

const mockGetFinancingWidget = vi.fn(async () => mockWidgetResult);

vi.mock('backend/financingCalc.web', () => ({
  getFinancingWidget: (...args) => mockGetFinancingWidget(...args),
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
    focus: vi.fn(),
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

  for (const [sel, val] of Object.entries(overrides)) {
    if (val !== null) elements[sel] = val;
  }

  $w._elements = elements;
  return $w;
}

describe('ProductFinancing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFinancingWidget.mockResolvedValue(mockWidgetResult);
  });

  describe('initFinancingOptions', () => {
    it('calls getFinancingWidget with product price', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect(mockGetFinancingWidget).toHaveBeenCalledWith(600);
    });

    it('expands financing section for eligible price', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').expand).toHaveBeenCalled();
    });

    it('sets teaser text from lowestMonthly', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingTeaser').text).toBe('As low as $50/mo');
      expect($w('#financingTeaser').show).toHaveBeenCalled();
    });

    it('populates plan repeater with widgetData sections', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      expect(repeater.data).toHaveLength(4); // 1 afterpay + 3 financing
      expect(repeater.data[0]._id).toBe('plan-0');
      expect(repeater.data[0].type).toBe('afterpay');
      expect(repeater.data[1].type).toBe('financing');
    });

    it('renders afterpay item in repeater', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[0]);

      expect($item('#planLabel').text).toBe('Pay in 4');
      expect($item('#planMonthly').text).toBe('$150.00/payment');
      expect($item('#planDescription').text).toBe('Interest-free with Afterpay');
    });

    it('renders financing item in repeater', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[1]);

      expect($item('#planLabel').text).toBe('6 Months');
      expect($item('#planMonthly').text).toBe('$100.00/mo');
      expect($item('#planDescription').text).toBe('0% APR for 6 months');
    });

    it('shows "No interest" for 0% APR financing sections', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[1]);

      expect($item('#planInterest').text).toBe('No interest');
    });

    it('shows total and APR for interest-bearing sections', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      // Section index 3 = 24 months with 9.99% APR
      callback($item, mockWidgetResult.widgetData.sections[3]);

      expect($item('#planInterest').text).toBe('$663.12 total (9.99% APR)');
    });

    it('shows "Interest-free" for afterpay interest line', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const repeater = $w('#financingRepeater');
      const callback = repeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[0]);

      expect($item('#planInterest').text).toBe('No interest');
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

    it('collapses section when widget returns not eligible', async () => {
      mockGetFinancingWidget.mockResolvedValueOnce({
        ...mockWidgetResult,
        eligible: false,
        widgetData: { ...mockWidgetResult.widgetData, showWidget: false, sections: [] },
      });

      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 25 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when backend returns error', async () => {
      mockGetFinancingWidget.mockResolvedValueOnce({ success: false, error: 'Valid price required' });

      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when backend throws', async () => {
      mockGetFinancingWidget.mockRejectedValueOnce(new Error('network error'));

      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('sets up learn more button click handler', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingLearnMore').onClick).toHaveBeenCalled();
    });

    it('sets up close button and overlay handlers', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#financingClose').onClick).toHaveBeenCalled();
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

      await initFinancingOptions($w, state);
      // Should not throw
    });

    it('opens modal with detail repeater on learn more click', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      expect($w('#financingOverlay').show).toHaveBeenCalledWith('fade', { duration: 200 });
      expect($w('#financingModal').show).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('populates detail repeater in modal from widgetData', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      const detailRepeater = $w('#financingDetailRepeater');
      expect(detailRepeater.data).toHaveLength(4);

      const callback = detailRepeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();

      // Test a financing section with details
      callback($item, mockWidgetResult.widgetData.sections[2]);

      expect($item('#detailLabel').text).toBe('12 Months');
      expect($item('#detailMonthly').text).toBe('$50.00/mo');
      expect($item('#detailApr').text).toBe('0% APR');
      expect($item('#detailInterest').text).toBe('No interest charges');
    });

    it('shows interest in detail for APR sections', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      const detailRepeater = $w('#financingDetailRepeater');
      const callback = detailRepeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[3]);

      expect($item('#detailApr').text).toBe('9.99% APR');
      expect($item('#detailInterest').text).toBe('Interest: $63.12');
    });

    it('shows afterpay schedule in detail repeater', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      const clickHandler = $w('#financingLearnMore').onClick.mock.calls[0][0];
      clickHandler();

      const detailRepeater = $w('#financingDetailRepeater');
      const callback = detailRepeater.onItemReady.mock.calls[0][0];
      const $item = createMock$w();
      callback($item, mockWidgetResult.widgetData.sections[0]);

      expect($item('#detailLabel').text).toBe('Pay in 4');
      expect($item('#detailMonthly').text).toBe('$150.00/payment');
      expect($item('#detailApr').text).toBe('0% APR');
      expect($item('#detailInterest').text).toBe('No interest charges');
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

    it('shows Afterpay message below teaser when eligible', async () => {
      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 600 } };

      await initFinancingOptions($w, state);

      expect($w('#afterpayMessage').text).toBe('or 4 interest-free payments of $150.00 with Afterpay');
      expect($w('#afterpayMessage').show).toHaveBeenCalled();
    });

    it('hides Afterpay message when not eligible', async () => {
      mockGetFinancingWidget.mockResolvedValueOnce({
        ...mockWidgetResult,
        afterpay: { eligible: false, reason: 'Maximum order $1000', installments: 4, installmentAmount: 0, total: 0, message: '' },
      });

      const $w = createMock$w();
      const state = { product: { ...futonFrame, price: 1500 } };

      await initFinancingOptions($w, state);

      expect($w('#afterpayMessage').hide).toHaveBeenCalled();
    });
  });

  describe('updateFinancingPrice', () => {
    it('calls getFinancingWidget with new price', async () => {
      const $w = createMock$w();
      await updateFinancingPrice($w, 800);

      expect(mockGetFinancingWidget).toHaveBeenCalledWith(800);
    });

    it('refreshes section for new price', async () => {
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

    it('collapses when widget returns not eligible', async () => {
      mockGetFinancingWidget.mockResolvedValueOnce({
        ...mockWidgetResult,
        eligible: false,
        widgetData: { ...mockWidgetResult.widgetData, showWidget: false, sections: [] },
      });

      const $w = createMock$w();
      await updateFinancingPrice($w, 25);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });

    it('updates Afterpay message on price change', async () => {
      const $w = createMock$w();
      await updateFinancingPrice($w, 600);

      expect($w('#afterpayMessage').text).toBe('or 4 interest-free payments of $150.00 with Afterpay');
      expect($w('#afterpayMessage').show).toHaveBeenCalled();
    });

    it('handles backend error gracefully', async () => {
      mockGetFinancingWidget.mockRejectedValueOnce(new Error('network'));

      const $w = createMock$w();
      await updateFinancingPrice($w, 600);

      expect($w('#financingSection').collapse).toHaveBeenCalled();
    });
  });
});
