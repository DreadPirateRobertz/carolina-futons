/**
 * Tests for pages/Returns.js
 * Covers: page init, lookup form, RMA tracker, return form submission,
 * order details rendering, existing returns, RMA status, error/loading states.
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
    alt: '',
    data: [],
    options: [],
    checked: false,
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', ariaLive: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
    forEachItem: vi.fn(),
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

vi.mock('backend/returnsService.web', () => ({
  lookupReturn: vi.fn(),
  submitGuestReturn: vi.fn(),
  trackReturnShipment: vi.fn(),
  getReturnReasons: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#4A7C59', error: '#DC2626' },
  typography: {},
}));

vi.mock('public/ReturnsPortal.js', () => ({
  checkReturnWindow: vi.fn(() => ({ eligible: true, message: 'Within 30-day window' })),
  getStatusTimeline: vi.fn(() => [
    { label: 'Submitted', state: 'completed' },
    { label: 'Processing', state: 'active' },
    { label: 'Completed', state: 'pending' },
  ]),
  formatReturnStatus: vi.fn((s) => s?.charAt(0).toUpperCase() + s?.slice(1)),
  getStatusColor: vi.fn(() => '#5B8FA8'),
  getReturnableItems: vi.fn((items) => items),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((text) => (text || '').replace(/<[^>]*>/g, '')),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  query: {},
}));

// ── Test Data ───────────────────────────────────────────────────────

const mockReasons = [
  { label: 'Wrong size', value: 'wrong_size' },
  { label: 'Damaged', value: 'damaged' },
  { label: 'Not as described', value: 'not_as_described' },
];

const mockOrder = {
  number: '5678',
  date: '2026-02-15',
  total: 299.99,
  lineItems: [
    { _id: 'item-1', name: 'Futon Frame', quantity: 1, price: 199.99, image: 'https://example.com/frame.jpg', returnable: true },
    { _id: 'item-2', name: 'Mattress', quantity: 1, price: 100.00, returnable: true },
  ],
};

const mockExistingReturn = {
  _id: 'ret-1',
  rmaNumber: 'RMA-100',
  date: 'Mar 1, 2026',
  type: 'return',
  reason: 'Wrong size',
  status: 'processing',
  returnTrackingNumber: 'TRK-123',
};

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage(overrides = {}) {
  const { getReturnReasons } = await import('backend/returnsService.web');
  getReturnReasons.mockResolvedValue(overrides.reasons ?? { reasons: mockReasons });

  await import('../src/pages/Returns.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Page Init ───────────────────────────────────────────────────────

describe('page init', () => {
  it('calls initBackToTop and initPageSeo on ready', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initBackToTop).toHaveBeenCalled();
    expect(initPageSeo).toHaveBeenCalledWith('returns');
  });

  it('tracks page_view event', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'returns' });
  });

  it('loads return reasons into module state', async () => {
    await loadPage();
    const { getReturnReasons } = await import('backend/returnsService.web');
    expect(getReturnReasons).toHaveBeenCalled();
  });

  it('collapses all result sections on init', async () => {
    await loadPage();
    expect(getEl('#returnResultsSection').collapse).toHaveBeenCalled();
    expect(getEl('#rmaResultsSection').collapse).toHaveBeenCalled();
    expect(getEl('#returnFormSection').collapse).toHaveBeenCalled();
  });
});

// ── Lookup Form ─────────────────────────────────────────────────────

describe('initLookupForm', () => {
  it('sets page title and subtitle', async () => {
    await loadPage();
    expect(getEl('#returnsTitle').text).toBe('Returns & Exchanges');
    expect(getEl('#returnsSubtitle').text).toContain('Start a return');
  });

  it('wires lookupReturnBtn onClick', async () => {
    await loadPage();
    expect(getEl('#lookupReturnBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA labels on form inputs', async () => {
    await loadPage();
    expect(getEl('#returnOrderNumberInput').accessibility.ariaLabel).toBe('Order number');
    expect(getEl('#returnEmailInput').accessibility.ariaLabel).toBe('Email address used for this order');
  });
});

// ── Lookup Handler ──────────────────────────────────────────────────

describe('handleLookup', () => {
  it('shows error when order number is empty', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '';
    getEl('#returnEmailInput').value = 'test@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Please enter your order number.');
  });

  it('shows error for invalid email', async () => {
    await loadPage();
    getEl('#returnOrderNumberInput').value = '1234';
    getEl('#returnEmailInput').value = 'bad-email';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Please enter a valid email address.');
  });

  it('renders order details on successful lookup', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnOrderNumber').text).toBe('Order #5678');
    expect(getEl('#returnOrderTotal').text).toBe('$299.99');
    expect(getEl('#returnResultsSection').expand).toHaveBeenCalled();
  });

  it('renders return form when no existing returns', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnFormSection').expand).toHaveBeenCalled();
  });

  it('renders existing returns when present', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [mockExistingReturn] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#existingReturnsRepeater').data).toHaveLength(1);
    expect(getEl('#existingReturnsSection').expand).toHaveBeenCalled();
  });

  it('shows error on lookup failure', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: false, error: 'Order not found' });

    getEl('#returnOrderNumberInput').value = '9999';
    getEl('#returnEmailInput').value = 'test@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Order not found');
  });

  it('shows loading state during lookup', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    // showLoading(true) disables button and shows loader, showLoading(false) re-enables
    expect(getEl('#lookupReturnBtn').disable).toHaveBeenCalled();
    expect(getEl('#lookupReturnBtn').enable).toHaveBeenCalled();
  });

  it('tracks return_lookup event on success', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    const { trackEvent } = await import('public/engagementTracker');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const lookupCall = trackEvent.mock.calls.find(c => c[0] === 'return_lookup');
    expect(lookupCall).toBeTruthy();
  });

  it('handles exception during lookup gracefully', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockRejectedValue(new Error('network error'));

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Something went wrong. Please try again.');
  });
});

// ── RMA Tracker ─────────────────────────────────────────────────────

describe('handleRmaTrack', () => {
  it('shows error when RMA is empty', async () => {
    await loadPage();
    getEl('#rmaInput').value = '';

    const handler = getEl('#trackRmaBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Please enter your RMA number.');
  });

  it('renders RMA status on success', async () => {
    await loadPage();
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValue({
      success: true,
      rmaNumber: 'RMA-200',
      status: 'shipped',
    });

    getEl('#rmaInput').value = 'RMA-200';

    const handler = getEl('#trackRmaBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#rmaStatusNumber').text).toBe('RMA: RMA-200');
    expect(getEl('#rmaResultsSection').expand).toHaveBeenCalled();
  });

  it('renders tracking activities when present', async () => {
    await loadPage();
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValue({
      success: true,
      rmaNumber: 'RMA-300',
      status: 'in_transit',
      tracking: {
        trackingNumber: 'TRK-456',
        status: 'In Transit',
        activities: [
          { status: 'Picked up', location: 'Hendersonville NC', date: '20260310' },
          { status: 'In transit', location: 'Charlotte NC', date: '20260311' },
        ],
      },
    });

    getEl('#rmaInput').value = 'RMA-300';

    const handler = getEl('#trackRmaBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#rmaTrackingNumber').text).toBe('Tracking: TRK-456');
    expect(getEl('#rmaTrackingSection').expand).toHaveBeenCalled();
    expect(getEl('#rmaActivityRepeater').data).toHaveLength(2);
  });

  it('shows no-tracking message when no tracking data', async () => {
    await loadPage();
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValue({
      success: true,
      rmaNumber: 'RMA-400',
      status: 'processing',
      message: 'Return label has not been shipped yet.',
    });

    getEl('#rmaInput').value = 'RMA-400';

    const handler = getEl('#trackRmaBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#rmaTrackingSection').collapse).toHaveBeenCalled();
    expect(getEl('#rmaNoTracking').text).toBe('Return label has not been shipped yet.');
  });

  it('shows error on RMA lookup failure', async () => {
    await loadPage();
    const { trackReturnShipment } = await import('backend/returnsService.web');
    trackReturnShipment.mockResolvedValue({ success: false, error: 'Return not found.' });

    getEl('#rmaInput').value = 'RMA-999';

    const handler = getEl('#trackRmaBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBe('Return not found.');
  });
});

// ── Existing Returns Rendering ──────────────────────────────────────

describe('renderExistingReturns', () => {
  it('populates repeater with return data and status timeline', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [mockExistingReturn] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const repeater = getEl('#existingReturnsRepeater');
    expect(repeater.data).toHaveLength(1);
    expect(repeater.onItemReady).toHaveBeenCalled();

    // Simulate onItemReady
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, mockExistingReturn);

    expect($item('#existingRma').text).toBe('RMA-100');
    expect($item('#existingReturnType').text).toBe('Return');
    expect($item('#existingTrackingNumber').show).toHaveBeenCalled();
  });

  it('hides tracking number when not present', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    const noTrackReturn = { ...mockExistingReturn, returnTrackingNumber: '' };
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [noTrackReturn] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const repeater = getEl('#existingReturnsRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    itemReadyFn($item, noTrackReturn);

    expect($item('#existingTrackingNumber').hide).toHaveBeenCalled();
  });
});

// ── Return Form ─────────────────────────────────────────────────────

describe('renderReturnForm', () => {
  it('populates reason dropdown from loaded reasons', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const dropdown = getEl('#returnReasonSelect');
    expect(dropdown.options).toHaveLength(3);
    expect(dropdown.options[0].label).toBe('Wrong size');
  });

  it('populates return type dropdown', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const typeDropdown = getEl('#returnTypeSelect');
    expect(typeDropdown.options).toHaveLength(2);
  });

  it('populates items selector repeater from returnable items', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    const repeater = getEl('#returnItemsSelector');
    expect(repeater.data).toHaveLength(2);
  });
});

// ── Guest Return Submission ─────────────────────────────────────────

describe('handleGuestReturnSubmit', () => {
  async function setupAndSubmit(overrides = {}) {
    await loadPage();
    const { lookupReturn, submitGuestReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });
    submitGuestReturn.mockResolvedValue(overrides.submitResult ?? { success: true, rmaNumber: 'RMA-NEW-1' });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    // Trigger lookup first to populate _currentOrder and form
    const lookupHandler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await lookupHandler();

    // Set form values
    getEl('#returnReasonSelect').value = overrides.reason ?? 'wrong_size';
    getEl('#returnDetailsTextbox').value = overrides.details ?? 'Too small';
    getEl('#returnTypeSelect').value = overrides.returnType ?? 'return';

    // Mock forEachItem to simulate checked items
    const itemRepeater = getEl('#returnItemsSelector');
    itemRepeater.forEachItem.mockImplementation((fn) => {
      const items = overrides.selectedItems ?? [
        { _id: 'item-1', quantity: 1, checked: true },
      ];
      items.forEach(item => {
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) {
            const el = createMockElement();
            if (sel === '#selectItemCheckbox') el.checked = item.checked;
            itemEls.set(sel, el);
          }
          return itemEls.get(sel);
        };
        fn($item, item);
      });
    });

    // Trigger submit
    const submitHandler = getEl('#submitGuestReturnBtn').onClick.mock.calls[0][0];
    await submitHandler();

    return { lookupReturn, submitGuestReturn };
  }

  it('submits return and shows success message with RMA', async () => {
    const { submitGuestReturn } = await setupAndSubmit();

    expect(submitGuestReturn).toHaveBeenCalled();
    expect(getEl('#returnSuccessMessage').text).toContain('RMA-NEW-1');
    expect(getEl('#returnSuccessMessage').show).toHaveBeenCalled();
  });

  it('tracks guest_return_submitted event', async () => {
    await setupAndSubmit();
    const { trackEvent } = await import('public/engagementTracker');

    const submitCall = trackEvent.mock.calls.find(c => c[0] === 'guest_return_submitted');
    expect(submitCall).toBeTruthy();
    expect(submitCall[1].rmaNumber).toBe('RMA-NEW-1');
  });

  it('shows form error when no reason selected', async () => {
    await setupAndSubmit({ reason: '' });

    expect(getEl('#returnFormError').text).toBe('Please select a return reason.');
  });

  it('shows form error when no items selected', async () => {
    await setupAndSubmit({
      selectedItems: [{ _id: 'item-1', quantity: 1, checked: false }],
    });

    expect(getEl('#returnFormError').text).toBe('Please select at least one item to return.');
  });

  it('shows error on submit failure', async () => {
    await setupAndSubmit({
      submitResult: { success: false, error: 'Return window expired' },
    });

    expect(getEl('#returnFormError').text).toBe('Return window expired');
  });

  it('disables submit button during submission', async () => {
    await setupAndSubmit();

    expect(getEl('#submitGuestReturnBtn').disable).toHaveBeenCalled();
    expect(getEl('#submitGuestReturnBtn').enable).toHaveBeenCalled();
  });
});

// ── Order Details Rendering ─────────────────────────────────────────

describe('renderOrderDetails', () => {
  it('shows return window status with color', async () => {
    await loadPage();
    const { lookupReturn } = await import('backend/returnsService.web');
    lookupReturn.mockResolvedValue({ success: true, order: mockOrder, returns: [] });

    getEl('#returnOrderNumberInput').value = '5678';
    getEl('#returnEmailInput').value = 'john@example.com';

    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnWindowStatus').text).toBe('Within 30-day window');
    expect(getEl('#returnWindowStatus').style.color).toBe('#4A7C59');
  });
});

// ── New Search Button ───────────────────────────────────────────────

describe('newReturnSearchBtn', () => {
  it('resets form and collapses results on click', async () => {
    await loadPage();

    const handler = getEl('#newReturnSearchBtn').onClick.mock.calls[0][0];
    handler();

    expect(getEl('#returnResultsSection').collapse).toHaveBeenCalled();
    expect(getEl('#rmaResultsSection').collapse).toHaveBeenCalled();
    expect(getEl('#returnOrderNumberInput').value).toBe('');
    expect(getEl('#returnEmailInput').value).toBe('');
  });
});

// ── Error & Loading Helpers ─────────────────────────────────────────

describe('error and loading helpers', () => {
  it('showError sets text, color, and ARIA attributes', async () => {
    await loadPage();

    // Trigger showError via empty order number
    getEl('#returnOrderNumberInput').value = '';
    const handler = getEl('#lookupReturnBtn').onClick.mock.calls[0][0];
    await handler();

    expect(getEl('#returnError').text).toBeTruthy();
    expect(getEl('#returnError').style.color).toBe('#DC2626');
    expect(getEl('#returnError').show).toHaveBeenCalled();
  });

  it('cancel return button collapses form and results', async () => {
    await loadPage();

    const handler = getEl('#cancelReturnFormBtn').onClick.mock.calls[0][0];
    handler();

    expect(getEl('#returnFormSection').collapse).toHaveBeenCalled();
    expect(getEl('#returnResultsSection').collapse).toHaveBeenCalled();
  });
});
