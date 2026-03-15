import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}
let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Module mocks ──────────────────────────────────────────────────────

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/financingPageHelpers.js', () => ({
  validatePriceInput: vi.fn((val) => {
    const price = parseFloat(val);
    if (isNaN(price) || price <= 0) return { valid: false, error: 'Enter a valid price' };
    return { valid: true, price };
  }),
  formatCurrency: vi.fn((p) => `$${p.toFixed(2)}`),
  formatMonthlyPayment: vi.fn(),
  getFinancingFaqs: vi.fn(() => [
    { question: 'How does financing work?', answer: 'We partner with Affirm...' },
  ]),
  filterFaqsByTopic: vi.fn(),
  buildComparisonRows: vi.fn(() => [
    { label: 'Affirm 12mo', payment: '$67/mo', totalCost: '$804', interestText: '0% APR', isZeroInterest: true },
  ]),
  getProviderInfo: vi.fn(() => [
    { name: 'Affirm', description: 'Monthly payments', range: '$200-$5,000' },
  ]),
  getPriceRangeLabel: vi.fn(() => 'Mid-range'),
  QUICK_PRICES: [
    { label: '$499', price: 499 },
    { label: '$799', price: 799 },
  ],
}));

vi.mock('backend/financingCalc.web', () => ({
  getFinancingWidget: vi.fn(() => Promise.resolve({
    success: true, lowestMonthly: '$42/mo',
    terms: [{ months: 12, rate: 0 }],
    afterpay: { eligible: true, message: 'Pay in 4', schedule: [{ label: 'Today', amount: 199.75, payment: 1 }] },
    eligible: true,
  })),
}));

// ── Lazy imports for assertions ───────────────────────────────────────

const { trackEvent } = await import('public/engagementTracker');
const { initBackToTop } = await import('public/mobileHelpers');
const { announce, makeClickable } = await import('public/a11yHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const {
  validatePriceInput, formatCurrency, buildComparisonRows,
  getFinancingFaqs, getProviderInfo, getPriceRangeLabel, QUICK_PRICES,
} = await import('public/financingPageHelpers.js');
const { getFinancingWidget } = await import('backend/financingCalc.web');

// ── Test suite ────────────────────────────────────────────────────────

describe('Financing Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Financing.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── 1. Init ─────────────────────────────────────────────────────────

  describe('page initialization', () => {
    it('calls initBackToTop on ready', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with financing', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('financing');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'financing' });
    });
  });

  // ── 2. Price input ──────────────────────────────────────────────────

  describe('price input setup', () => {
    it('sets placeholder on price input', async () => {
      await onReadyHandler();
      expect(getEl('#priceInput').placeholder).toBe('Enter product price (e.g. $799)');
    });

    it('sets ARIA label on price input', async () => {
      await onReadyHandler();
      expect(getEl('#priceInput').accessibility.ariaLabel).toBe('Enter a price to calculate financing options');
    });

    it('hides error text initially', async () => {
      await onReadyHandler();
      expect(getEl('#priceError').hide).toHaveBeenCalled();
    });

    it('collapses results section initially', async () => {
      await onReadyHandler();
      expect(getEl('#resultsSection').collapse).toHaveBeenCalled();
    });
  });

  // ── 3. Calculate button ─────────────────────────────────────────────

  describe('calculate button', () => {
    it('sets ARIA label on calculate button', async () => {
      await onReadyHandler();
      expect(getEl('#calculateBtn').accessibility.ariaLabel).toBe('Calculate financing options');
    });

    it('registers onClick handler', async () => {
      await onReadyHandler();
      expect(getEl('#calculateBtn').onClick).toHaveBeenCalled();
    });
  });

  // ── 4. Enter key ───────────────────────────────────────────────────

  describe('enter key', () => {
    it('registers onKeyPress on price input', async () => {
      await onReadyHandler();
      expect(getEl('#priceInput').onKeyPress).toHaveBeenCalled();
    });
  });

  // ── 5. Validation error ─────────────────────────────────────────────

  describe('validation error', () => {
    it('shows error for invalid input and announces it', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = 'abc';

      await calcHandler();

      expect(getEl('#priceError').text).toBe('Enter a valid price');
      expect(getEl('#priceError').show).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith($w, 'Enter a valid price');
    });
  });

  // ── 6. Valid calculation ────────────────────────────────────────────

  describe('valid calculation', () => {
    it('calls getFinancingWidget and sets result header and price range', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = '799';

      await calcHandler();

      expect(getFinancingWidget).toHaveBeenCalledWith(799);
      expect(getEl('#resultHeader').text).toBe('Financing options for $799.00');
      expect(getEl('#priceRangeLabel').text).toBe('Mid-range');
      expect(getEl('#priceRangeLabel').show).toHaveBeenCalled();
    });
  });

  // ── 7. Lowest monthly ──────────────────────────────────────────────

  describe('lowest monthly', () => {
    it('shows lowestMonthly text', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = '799';

      await calcHandler();

      expect(getEl('#lowestMonthly').text).toBe('$42/mo');
      expect(getEl('#lowestMonthly').show).toHaveBeenCalled();
    });
  });

  // ── 8. Quick prices ────────────────────────────────────────────────

  describe('quick prices', () => {
    it('sets ARIA label on repeater', async () => {
      await onReadyHandler();
      expect(getEl('#quickPriceRepeater').accessibility.ariaLabel).toBe('Quick price selection');
    });

    it('sets data from QUICK_PRICES', async () => {
      await onReadyHandler();
      const data = getEl('#quickPriceRepeater').data;
      expect(data).toHaveLength(QUICK_PRICES.length);
      expect(data[0]).toMatchObject({ label: '$499', price: 499 });
    });

    it('onItemReady sets label text', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quickPriceRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`quickItem${sel}`);
      itemReadyFn($item, { label: '$499', price: 499, _id: 'qp-0' });

      expect(getEl('quickItem#quickPriceLabel').text).toBe('$499');
    });
  });

  // ── 9. Quick price click ───────────────────────────────────────────

  describe('quick price click', () => {
    it('sets input value, loads financing results, and tracks event', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#quickPriceRepeater').onItemReady.mock.calls[0][0];
      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };
      itemReadyFn($item, { label: '$499', price: 499, _id: 'qp-0' });

      // makeClickable was called with quickPriceBtn
      expect(makeClickable).toHaveBeenCalled();
      const clickCall = makeClickable.mock.calls.find(c =>
        c[0] === itemElements.get('#quickPriceBtn')
      );
      expect(clickCall).toBeTruthy();

      // Invoke the click handler (loadFinancingResults is fire-and-forget)
      const clickHandler = clickCall[1];
      trackEvent.mockClear();
      clickHandler();

      expect(getEl('#priceInput').value).toBe('499');
      expect(trackEvent).toHaveBeenCalledWith('financing_quick_price', { price: 499 });
    });
  });

  // ── 10. Provider info ──────────────────────────────────────────────

  describe('provider info', () => {
    it('sets ARIA label on provider repeater', async () => {
      await onReadyHandler();
      expect(getEl('#providerRepeater').accessibility.ariaLabel).toBe('Payment providers');
    });

    it('sets data from getProviderInfo', async () => {
      await onReadyHandler();
      const data = getEl('#providerRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ name: 'Affirm', description: 'Monthly payments', range: '$200-$5,000' });
    });

    it('onItemReady sets name, description, and range', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#providerRepeater').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { name: 'Affirm', description: 'Monthly payments', range: '$200-$5,000', _id: 'prov-0' });

      expect(itemEls.get('#providerName').text).toBe('Affirm');
      expect(itemEls.get('#providerDesc').text).toBe('Monthly payments');
      expect(itemEls.get('#providerRange').text).toBe('$200-$5,000');
    });
  });

  // ── 11. Financing FAQs ─────────────────────────────────────────────

  describe('financing FAQs', () => {
    it('sets ARIA label on FAQ repeater', async () => {
      await onReadyHandler();
      expect(getEl('#financingFaqRepeater').accessibility.ariaLabel).toBe('Financing frequently asked questions');
    });

    it('sets data from getFinancingFaqs', async () => {
      await onReadyHandler();
      const data = getEl('#financingFaqRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ question: 'How does financing work?', answer: 'We partner with Affirm...' });
    });

    it('onItemReady collapses answer and sets chevron to +', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#financingFaqRepeater').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { question: 'How does financing work?', answer: 'We partner with Affirm...', _id: 'faq-0' });

      expect(itemEls.get('#faqAnswer').collapse).toHaveBeenCalled();
      expect(itemEls.get('#faqChevron').text).toBe('+');
    });
  });

  // ── 12. FAQ expand ─────────────────────────────────────────────────

  describe('FAQ expand', () => {
    it('tracks financing_faq_expand when toggling open', async () => {
      await onReadyHandler();
      const itemReadyFn = getEl('#financingFaqRepeater').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { question: 'How does financing work?', answer: 'We partner with Affirm...', _id: 'faq-0' });

      // makeClickable was called on faqQuestion with a toggle fn
      const faqClickCall = makeClickable.mock.calls.find(c =>
        c[0] === itemEls.get('#faqQuestion')
      );
      expect(faqClickCall).toBeTruthy();

      // The answer was collapsed by onItemReady, so collapsed = true
      itemEls.get('#faqAnswer').collapsed = true;
      const toggleFn = faqClickCall[1];
      toggleFn();

      expect(itemEls.get('#faqAnswer').expand).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('financing_faq_expand', { question: 'How does financing work?' });
    });
  });

  // ── 13. Comparison table ───────────────────────────────────────────

  describe('comparison table', () => {
    it('sets repeater data from buildComparisonRows and onItemReady sets fields', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = '799';

      await calcHandler();

      const repeater = getEl('#comparisonRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0]).toMatchObject({ label: 'Affirm 12mo', payment: '$67/mo' });

      // Simulate onItemReady
      const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { label: 'Affirm 12mo', payment: '$67/mo', totalCost: '$804', interestText: '0% APR', isZeroInterest: true, _id: 'comp-0' });

      expect(itemEls.get('#compLabel').text).toBe('Affirm 12mo');
      expect(itemEls.get('#compPayment').text).toBe('$67/mo');
      expect(itemEls.get('#compTotal').text).toBe('$804');
      expect(itemEls.get('#compInterest').text).toBe('0% APR');
    });
  });

  // ── 14. Zero interest badge ────────────────────────────────────────

  describe('zero interest badge', () => {
    it('shows "0% APR" when isZeroInterest is true', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = '799';
      await calcHandler();

      const itemReadyFn = getEl('#comparisonRepeater').onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { label: 'Affirm 12mo', payment: '$67/mo', totalCost: '$804', interestText: '0% APR', isZeroInterest: true, _id: 'comp-0' });

      expect(itemEls.get('#zeroBadge').text).toBe('0% APR');
      expect(itemEls.get('#zeroBadge').show).toHaveBeenCalled();
    });
  });

  // ── 15. Afterpay schedule ──────────────────────────────────────────

  describe('afterpay schedule', () => {
    it('expands section when eligible and sets message and schedule data', async () => {
      await onReadyHandler();
      const calcHandler = getEl('#calculateBtn').onClick.mock.calls[0][0];
      getEl('#priceInput').value = '799';

      await calcHandler();

      const section = getEl('#afterpaySection');
      expect(section.expand).toHaveBeenCalled();
      expect(getEl('#afterpayMessage').text).toBe('Pay in 4');

      const scheduleRepeater = getEl('#afterpayScheduleRepeater');
      expect(scheduleRepeater.data).toHaveLength(1);
      expect(scheduleRepeater.data[0]).toMatchObject({ label: 'Today', amount: 199.75, payment: 1 });

      // Simulate onItemReady for schedule
      const itemReadyFn = scheduleRepeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      itemReadyFn($item, { label: 'Today', amount: 199.75, payment: 1, _id: 'sched-0' });

      expect(itemEls.get('#scheduleLabel').text).toBe('Today');
      expect(itemEls.get('#scheduleAmount').text).toBe('$199.75');
      expect(itemEls.get('#schedulePayment').text).toBe('Payment 1');
    });
  });

  // ── 16. CTA buttons ───────────────────────────────────────────────

  describe('CTA buttons', () => {
    it('shopNowBtn registers onClick and tracks event', async () => {
      await onReadyHandler();
      const shopBtn = getEl('#shopNowBtn');
      expect(shopBtn.onClick).toHaveBeenCalled();

      const handler = shopBtn.onClick.mock.calls[0][0];
      trackEvent.mockClear();
      handler();

      expect(trackEvent).toHaveBeenCalledWith('financing_cta_shop', expect.objectContaining({}));
    });

    it('financingContactBtn registers onClick and tracks event', async () => {
      await onReadyHandler();
      const contactBtn = getEl('#financingContactBtn');
      expect(contactBtn.onClick).toHaveBeenCalled();

      const handler = contactBtn.onClick.mock.calls[0][0];
      trackEvent.mockClear();
      handler();

      expect(trackEvent).toHaveBeenCalledWith('financing_cta_contact', expect.objectContaining({}));
    });
  });
});
