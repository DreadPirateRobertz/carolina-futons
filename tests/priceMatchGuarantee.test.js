/**
 * Tests for pages/Price Match Guarantee.js
 * Covers: policy display, form init, submit flow, requests repeater, error states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    html: '',
    options: [],
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', ariaRequired: false, ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/priceMatchService.web', () => ({
  submitPriceMatchRequest: vi.fn(),
  getMyPriceMatches: vi.fn(),
  getCompetitorSources: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4A7C59',
    error: '#DC2626',
    mountainBlue: '#5B8FA8',
    espresso: '#1E3A5F',
  },
}));

vi.mock('public/priceMatchHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/priceMatchHelpers.js');
  return actual;
});

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((text, _max) => (text || '').toString().replace(/<[^>]*>/g, '').trim()),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

/** Import the page (fresh each time due to resetModules) and run $w.onReady. */
async function loadPage(overrides = {}) {
  // Get fresh mock references after resetModules
  const { getMyPriceMatches, getCompetitorSources } = await import('backend/priceMatchService.web');
  getMyPriceMatches.mockResolvedValue(overrides.requests ?? { requests: [] });
  getCompetitorSources.mockResolvedValue(overrides.competitors ?? { competitors: [] });

  if (overrides.submitResult) {
    const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
    submitPriceMatchRequest.mockResolvedValue(overrides.submitResult);
  }
  if (overrides.submitError) {
    const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
    submitPriceMatchRequest.mockRejectedValue(overrides.submitError);
  }

  await import('../src/pages/Price Match Guarantee.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── $w.onReady ──────────────────────────────────────────────────────

describe('$w.onReady', () => {
  it('initializes back-to-top, page SEO, and tracks page view', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    const { initPageSeo } = await import('public/pageSeo.js');
    const { trackEvent } = await import('public/engagementTracker');

    expect(initBackToTop).toHaveBeenCalledWith($w);
    expect(initPageSeo).toHaveBeenCalledWith('priceMatch');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'price_match' });
  });

  it('loads requests and competitor sources concurrently', async () => {
    await loadPage();
    const { getMyPriceMatches, getCompetitorSources } = await import('backend/priceMatchService.web');

    expect(getMyPriceMatches).toHaveBeenCalled();
    expect(getCompetitorSources).toHaveBeenCalled();
  });

  it('hides error/success/preview elements on init', async () => {
    await loadPage();

    expect(getEl('#pmFormError').hide).toHaveBeenCalled();
    expect(getEl('#pmSuccessSection').hide).toHaveBeenCalled();
    expect(getEl('#pmSavingsPreview').hide).toHaveBeenCalled();
  });

  it('collapses requests section on init', async () => {
    await loadPage();
    expect(getEl('#pmRequestsSection').collapse).toHaveBeenCalled();
  });
});

// ── Policy Section ──────────────────────────────────────────────────

describe('initPolicySection', () => {
  it('sets policy title and description from helper', async () => {
    await loadPage();

    expect(getEl('#priceMatchTitle').text).toBe('Price Match Guarantee');
    expect(getEl('#priceMatchDescription').text).toContain('Found a lower price');
  });

  it('sets up policy rules repeater with onItemReady and data', async () => {
    await loadPage();

    const rulesRepeater = getEl('#policyRulesRepeater');
    expect(rulesRepeater.onItemReady).toHaveBeenCalled();
    expect(rulesRepeater.data).toHaveLength(5);
    expect(rulesRepeater.data[0]).toEqual({ _id: 'rule-0', text: expect.stringContaining('identical') });
  });

  it('rules repeater onItemReady sets text on $item', async () => {
    await loadPage();

    const rulesRepeater = getEl('#policyRulesRepeater');
    const itemReadyFn = rulesRepeater.onItemReady.mock.calls[0][0];

    const mockItem = createMockElement();
    const $item = () => mockItem;
    itemReadyFn($item, { text: 'Test rule text' });
    expect(mockItem.text).toBe('Test rule text');
  });

  it('sets up exclusions repeater with data', async () => {
    await loadPage();

    const exclusionsRepeater = getEl('#policyExclusionsRepeater');
    expect(exclusionsRepeater.onItemReady).toHaveBeenCalled();
    expect(exclusionsRepeater.data).toHaveLength(5);
    expect(exclusionsRepeater.data[0]).toEqual({ _id: 'excl-0', text: expect.stringContaining('Clearance') });
  });
});

// ── Form Section ────────────────────────────────────────────────────

describe('initFormSection', () => {
  it('sets ARIA labels on form inputs', async () => {
    await loadPage();

    expect(getEl('#pmProductName').accessibility.ariaLabel).toBe('Product name');
    expect(getEl('#pmProductName').accessibility.ariaRequired).toBe(true);
    expect(getEl('#pmOurPrice').accessibility.ariaLabel).toBe('Our price for this product');
    expect(getEl('#pmCompetitorSelect').accessibility.ariaLabel).toBe('Select competitor retailer');
    expect(getEl('#pmCompetitorPrice').accessibility.ariaLabel).toBe('Competitor price');
    expect(getEl('#pmCompetitorUrl').accessibility.ariaLabel).toBe('Link to competitor listing (optional)');
    expect(getEl('#pmNotes').accessibility.ariaLabel).toBe('Additional notes (optional)');
    expect(getEl('#pmSubmitBtn').accessibility.ariaLabel).toBe('Submit price match request');
  });

  it('populates competitor dropdown from static list', async () => {
    await loadPage();

    const options = getEl('#pmCompetitorSelect').options;
    expect(options.length).toBeGreaterThanOrEqual(11);
    expect(options[0]).toEqual({ label: 'Wayfair', value: 'wayfair' });
    expect(options[options.length - 1]).toEqual({ label: 'Other', value: 'other' });
  });

  it('wires onInput for savings preview on both price fields', async () => {
    await loadPage();

    expect(getEl('#pmOurPrice').onInput).toHaveBeenCalled();
    expect(getEl('#pmCompetitorPrice').onInput).toHaveBeenCalled();
  });

  it('wires submit button onClick', async () => {
    await loadPage();
    expect(getEl('#pmSubmitBtn').onClick).toHaveBeenCalled();
  });
});

// ── Savings Preview ─────────────────────────────────────────────────

describe('updateSavingsPreview', () => {
  it('shows savings when competitor price is lower', async () => {
    await loadPage();

    getEl('#pmOurPrice').value = '299.99';
    getEl('#pmCompetitorPrice').value = '249.99';

    const onInputFn = getEl('#pmOurPrice').onInput.mock.calls[0][0];
    onInputFn();

    const preview = getEl('#pmSavingsPreview');
    expect(preview.show).toHaveBeenCalled();
    expect(preview.text).toContain('$50.00');
    expect(preview.style.color).toBe('#4A7C59');
  });

  it('hides savings when competitor price is higher', async () => {
    await loadPage();

    getEl('#pmOurPrice').value = '199.99';
    getEl('#pmCompetitorPrice').value = '299.99';

    const onInputFn = getEl('#pmOurPrice').onInput.mock.calls[0][0];
    onInputFn();

    expect(getEl('#pmSavingsPreview').hide).toHaveBeenCalled();
  });
});

// ── Competitor Sources (backend) ────────────────────────────────────

describe('loadCompetitorSources', () => {
  it('merges backend competitors into dropdown when available', async () => {
    await loadPage({
      competitors: {
        competitors: [
          { name: 'Custom Retailer' },
          { name: 'Special Store' },
        ],
      },
    });

    const options = getEl('#pmCompetitorSelect').options;
    expect(options).toEqual([
      { label: 'Custom Retailer', value: 'custom-retailer' },
      { label: 'Special Store', value: 'special-store' },
      { label: 'Other', value: 'other' },
    ]);
  });

  it('keeps static options when backend returns empty', async () => {
    await loadPage({ competitors: { competitors: [] } });

    const options = getEl('#pmCompetitorSelect').options;
    expect(options.length).toBe(11);
  });

  it('keeps static options when backend fails', async () => {
    // Override after initial setup
    const { getCompetitorSources } = await import('backend/priceMatchService.web');
    getCompetitorSources.mockRejectedValue(new Error('API down'));

    await import('../src/pages/Price Match Guarantee.js');
    if (onReadyHandler) await onReadyHandler();

    const options = getEl('#pmCompetitorSelect').options;
    expect(options.length).toBe(11);
  });
});

// ── handleSubmit ────────────────────────────────────────────────────

describe('handleSubmit', () => {
  function setFormValues(fieldValues = {}) {
    getEl('#pmProductName').value = fieldValues.productName ?? 'Clover Futon Frame';
    getEl('#pmOurPrice').value = fieldValues.ourPrice ?? '499.99';
    getEl('#pmCompetitorSelect').value = fieldValues.competitorValue ?? 'wayfair';
    getEl('#pmCompetitorPrice').value = fieldValues.competitorPrice ?? '399.99';
    getEl('#pmCompetitorUrl').value = fieldValues.competitorUrl ?? '';
    getEl('#pmNotes').value = fieldValues.notes ?? '';
  }

  function getSubmitHandler() {
    return getEl('#pmSubmitBtn').onClick.mock.calls[0][0];
  }

  it('shows validation errors for empty required fields', async () => {
    await loadPage();
    setFormValues({ productName: '', ourPrice: '', competitorPrice: '' });
    await getSubmitHandler()();

    const { announce } = await import('public/a11yHelpers.js');
    expect(getEl('#pmProductNameError').show).toHaveBeenCalled();
    expect(getEl('#pmProductNameError').text).toContain('select a product');
    expect(announce).toHaveBeenCalledWith($w, 'Please fix the errors in the form');

    const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
    expect(submitPriceMatchRequest).not.toHaveBeenCalled();
  });

  it('shows error when competitor price >= our price', async () => {
    await loadPage();
    setFormValues({ productName: 'Test Product', ourPrice: '299.99', competitorPrice: '399.99' });
    await getSubmitHandler()();

    expect(getEl('#pmCompetitorPriceError').show).toHaveBeenCalled();
    expect(getEl('#pmCompetitorPriceError').text).toContain('lower than our price');
  });

  it('shows error for invalid competitor URL', async () => {
    await loadPage();
    setFormValues({ competitorUrl: 'not-a-url' });
    await getSubmitHandler()();

    expect(getEl('#pmCompetitorUrlError').show).toHaveBeenCalled();
    expect(getEl('#pmCompetitorUrlError').text).toContain('valid URL');
  });

  it('disables submit button and changes label during submission', async () => {
    const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
    submitPriceMatchRequest.mockImplementation(() => new Promise(() => {})); // never resolves
    await loadPage();

    setFormValues();
    const promise = getSubmitHandler()();
    await new Promise(r => setTimeout(r, 10));

    expect(getEl('#pmSubmitBtn').disable).toHaveBeenCalled();
    expect(getEl('#pmSubmitBtn').label).toBe('Submitting...');
  });

  it('submits valid form data to backend', async () => {
    await loadPage({ submitResult: { success: true, request: { claimNumber: 'PM-001' } } });
    setFormValues({
      productName: 'Clover Frame',
      ourPrice: '499.99',
      competitorValue: 'wayfair',
      competitorPrice: '399.99',
      competitorUrl: 'https://wayfair.com/product',
      notes: 'Please review',
    });
    await getSubmitHandler()();

    const { submitPriceMatchRequest } = await import('backend/priceMatchService.web');
    expect(submitPriceMatchRequest).toHaveBeenCalledWith(expect.objectContaining({
      productName: 'Clover Frame',
      ourPrice: 499.99,
      competitorName: 'Wayfair',
      competitorPrice: 399.99,
      competitorUrl: 'https://wayfair.com/product',
      notes: 'Please review',
    }));
  });

  it('shows success message with claim number on success', async () => {
    await loadPage({ submitResult: { success: true, request: { claimNumber: 'PM-12345' } } });
    setFormValues();
    await getSubmitHandler()();

    expect(getEl('#pmSuccessMessage').text).toContain('PM-12345');
    expect(getEl('#pmFormSection').hide).toHaveBeenCalled();
    expect(getEl('#pmSuccessSection').show).toHaveBeenCalled();

    const { announce } = await import('public/a11yHelpers.js');
    expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('PM-12345'));
  });

  it('tracks price_match_submitted event on success', async () => {
    await loadPage({ submitResult: { success: true, request: { claimNumber: 'PM-001' } } });
    setFormValues();
    await getSubmitHandler()();

    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('price_match_submitted', expect.objectContaining({
      competitor: 'Wayfair',
      savings: expect.any(Number),
    }));
  });

  it('reloads requests after successful submission', async () => {
    await loadPage({ submitResult: { success: true, request: { claimNumber: 'PM-001' } } });
    const { getMyPriceMatches } = await import('backend/priceMatchService.web');
    const callsBefore = getMyPriceMatches.mock.calls.length;

    setFormValues();
    await getSubmitHandler()();

    // loadMyRequests called again after successful submit
    expect(getMyPriceMatches.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('shows form error when backend returns success=false', async () => {
    await loadPage({ submitResult: { success: false, message: 'Duplicate claim' } });
    setFormValues();
    await getSubmitHandler()();

    expect(getEl('#pmFormError').text).toBe('Duplicate claim');
    expect(getEl('#pmFormError').show).toHaveBeenCalled();
  });

  it('shows generic error on backend exception', async () => {
    await loadPage({ submitError: new Error('Network error') });
    setFormValues();
    await getSubmitHandler()();

    expect(getEl('#pmFormError').text).toContain('Something went wrong');
    expect(getEl('#pmFormError').text).toContain('(828) 252-9449');
  });

  it('re-enables submit button after submission (finally block)', async () => {
    await loadPage({ submitResult: { success: true, request: { claimNumber: 'PM-001' } } });
    setFormValues();
    await getSubmitHandler()();

    expect(getEl('#pmSubmitBtn').enable).toHaveBeenCalled();
    expect(getEl('#pmSubmitBtn').label).toBe('Submit Price Match');
  });

  it('re-enables submit button even on failure', async () => {
    await loadPage({ submitError: new Error('fail') });
    setFormValues();
    await getSubmitHandler()();

    expect(getEl('#pmSubmitBtn').enable).toHaveBeenCalled();
    expect(getEl('#pmSubmitBtn').label).toBe('Submit Price Match');
  });

  it('hides all errors before validation', async () => {
    await loadPage();
    setFormValues({ productName: '', ourPrice: '', competitorPrice: '' });
    await getSubmitHandler()();

    // hideAllErrors hides all error elements including #pmFormError
    expect(getEl('#pmFormError').hide).toHaveBeenCalled();
  });
});

// ── My Requests ─────────────────────────────────────────────────────

describe('loadMyRequests', () => {
  const mockRequests = [
    {
      _id: 'req-1',
      claimNumber: 'PM-100',
      productName: 'Clover Frame',
      ourPrice: 499.99,
      competitorName: 'Wayfair',
      competitorPrice: 399.99,
      priceDifference: 100,
      status: 'approved',
      creditAmount: 100,
      adminNotes: '',
      _createdDate: '2026-03-01T12:00:00Z',
    },
    {
      _id: 'req-2',
      claimNumber: 'PM-101',
      productName: 'Northern Frame',
      ourPrice: 299.99,
      competitorName: 'Amazon',
      competitorPrice: 249.99,
      priceDifference: 50,
      status: 'denied',
      creditAmount: 0,
      adminNotes: 'Item not identical — different size',
      _createdDate: '2026-03-02T12:00:00Z',
    },
  ];

  it('expands requests section when requests exist', async () => {
    await loadPage({ requests: { requests: mockRequests } });
    expect(getEl('#pmRequestsSection').expand).toHaveBeenCalled();
  });

  it('keeps requests section collapsed when no requests', async () => {
    await loadPage({ requests: { requests: [] } });
    expect(getEl('#pmRequestsSection').expand).not.toHaveBeenCalled();
  });

  it('sets repeater data from backend results', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('req-1');
  });

  it('onItemReady populates claim fields correctly', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockRequests[0]);

    expect($item('#pmReqClaimNumber').text).toBe('PM-100');
    expect($item('#pmReqProductName').text).toBe('Clover Frame');
    expect($item('#pmReqOurPrice').text).toBe('$499.99');
    expect($item('#pmReqCompetitorName').text).toBe('Wayfair');
    expect($item('#pmReqCompetitorPrice').text).toBe('$399.99');
    expect($item('#pmReqSavings').text).toBe('$100.00');
  });

  it('onItemReady sets status badge with color', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockRequests[0]); // approved

    expect($item('#pmReqStatus').text).toBe('Approved');
    expect($item('#pmReqStatus').style.color).toBe('#4A7C59');
    expect($item('#pmReqStatus').accessibility.ariaLabel).toBe('Claim status: Approved');
  });

  it('shows credit amount for approved requests', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockRequests[0]); // creditAmount: 100

    expect($item('#pmReqCreditAmount').text).toBe('Credit: $100.00');
    expect($item('#pmReqCreditAmount').show).toHaveBeenCalled();
  });

  it('hides credit amount when zero', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockRequests[1]); // creditAmount: 0

    expect($item('#pmReqCreditAmount').hide).toHaveBeenCalled();
  });

  it('shows admin notes only for denied requests', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    // Denied request with admin notes
    const deniedElements = new Map();
    const $deniedItem = (sel) => {
      if (!deniedElements.has(sel)) deniedElements.set(sel, createMockElement());
      return deniedElements.get(sel);
    };
    itemReadyFn($deniedItem, mockRequests[1]);

    expect($deniedItem('#pmReqAdminNotes').text).toBe('Item not identical — different size');
    expect($deniedItem('#pmReqAdminNotes').show).toHaveBeenCalled();

    // Approved request — admin notes hidden
    const approvedElements = new Map();
    const $approvedItem = (sel) => {
      if (!approvedElements.has(sel)) approvedElements.set(sel, createMockElement());
      return approvedElements.get(sel);
    };
    itemReadyFn($approvedItem, mockRequests[0]);

    expect($approvedItem('#pmReqAdminNotes').hide).toHaveBeenCalled();
  });

  it('formats created date correctly', async () => {
    await loadPage({ requests: { requests: mockRequests } });

    const repeater = getEl('#pmRequestsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockRequests[0]);

    expect($item('#pmReqDate').text).toContain('2026');
    expect($item('#pmReqDate').text).toContain('Mar');
  });
});

// ── New Request Button ──────────────────────────────────────────────

describe('initRequestsSection', () => {
  it('wires new request button to show form and clear', async () => {
    await loadPage();

    const newReqBtn = getEl('#pmNewRequestBtn');
    expect(newReqBtn.onClick).toHaveBeenCalled();
    expect(newReqBtn.accessibility.ariaLabel).toBe('Submit another price match request');
  });

  it('new request button shows form section and hides success', async () => {
    await loadPage();

    getEl('#pmProductName').value = 'Leftover';
    getEl('#pmOurPrice').value = '999';

    const newReqHandler = getEl('#pmNewRequestBtn').onClick.mock.calls[0][0];
    newReqHandler();

    expect(getEl('#pmSuccessSection').hide).toHaveBeenCalled();
    expect(getEl('#pmFormSection').show).toHaveBeenCalled();
    expect(getEl('#pmProductName').value).toBe('');
    expect(getEl('#pmOurPrice').value).toBe('');
  });
});

// ── Error Helpers ───────────────────────────────────────────────────

describe('error and UI helpers', () => {
  it('showFieldError sets ARIA alert attributes', async () => {
    await loadPage();

    getEl('#pmProductName').value = '';
    getEl('#pmOurPrice').value = '500';
    getEl('#pmCompetitorSelect').value = 'wayfair';
    getEl('#pmCompetitorPrice').value = '400';

    await getEl('#pmSubmitBtn').onClick.mock.calls[0][0]();

    const errorEl = getEl('#pmProductNameError');
    expect(errorEl.accessibility.ariaLive).toBe('assertive');
    expect(errorEl.accessibility.role).toBe('alert');
  });

  it('showFormError sets error color from design tokens', async () => {
    await loadPage({ submitError: new Error('fail') });

    getEl('#pmProductName').value = 'Test';
    getEl('#pmOurPrice').value = '500';
    getEl('#pmCompetitorSelect').value = 'wayfair';
    getEl('#pmCompetitorPrice').value = '400';

    await getEl('#pmSubmitBtn').onClick.mock.calls[0][0]();

    expect(getEl('#pmFormError').style.color).toBe('#DC2626');
    expect(getEl('#pmFormError').accessibility.role).toBe('alert');
  });
});
