import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    checked: false,
    options: [],
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
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

// ── Mock Backend Modules ────────────────────────────────────────────

const mockLookupResult = {
  success: true,
  order: {
    number: '10042',
    createdDate: new Date('2025-06-15'),
    status: 'In Transit',
    statusDescription: 'Your package is on its way',
    fulfillmentStatus: 'IN_TRANSIT',
    paymentStatus: 'PAID',
  },
  shipping: {
    carrier: 'UPS',
    serviceName: 'UPS Ground',
    trackingNumber: '1Z999AA10123456784',
    estimatedDelivery: '2025-06-20',
    shippingAddress: {
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    },
  },
  tracking: {
    status: 'In Transit',
    statusCode: 'IT',
    activities: [
      { status: 'Departed Facility', location: 'Charlotte, NC', date: '20250618', time: '1430' },
      { status: 'Arrived at Facility', location: 'Greensboro, NC', date: '20250617', time: '0800' },
    ],
  },
  timeline: [
    { step: 0, label: 'Order Placed', completed: true, current: false },
    { step: 1, label: 'Shipped', completed: true, current: false },
    { step: 2, label: 'In Transit', completed: true, current: true },
    { step: 3, label: 'Out for Delivery', completed: false, current: false },
    { step: 4, label: 'Delivered', completed: false, current: false },
  ],
  lineItems: [
    { name: 'Eureka Futon Frame', quantity: 1, sku: 'EUR-FRM-001', price: 499, image: 'img1.jpg' },
    { name: 'Moonshadow Mattress', quantity: 1, sku: 'MOON-MAT-001', price: 349, image: 'img2.jpg' },
  ],
  totals: { subtotal: 848, shipping: 29.99, total: 877.99 },
  notificationsEnabled: false,
};

const mockLookupOrder = vi.fn().mockResolvedValue(mockLookupResult);
const mockSubscribe = vi.fn().mockResolvedValue({ success: true, alreadySubscribed: false });
const mockUnsubscribe = vi.fn().mockResolvedValue({ success: true });
const mockGetTimeline = vi.fn().mockResolvedValue({ success: true, timeline: [], activities: [] });

vi.mock('backend/orderTracking.web', () => ({
  lookupOrder: (...args) => mockLookupOrder(...args),
  subscribeToNotifications: (...args) => mockSubscribe(...args),
  unsubscribeFromNotifications: (...args) => mockUnsubscribe(...args),
  getTrackingTimeline: (...args) => mockGetTimeline(...args),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#2E7D32',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    muted: '#999999',
    mutedBrown: '#8B7355',
    error: '#D32F2F',
  },
  typography: {
    h3: { weight: 700 },
    h4: { weight: 600 },
  },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  query: {},
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Order Tracking Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Order Tracking.js');
  });

  beforeEach(() => {
    elements.clear();
    mockLookupOrder.mockClear();
    mockSubscribe.mockClear();
    mockUnsubscribe.mockClear();
    mockGetTimeline.mockClear();
    mockLookupOrder.mockResolvedValue(mockLookupResult);
    mockSubscribe.mockResolvedValue({ success: true, alreadySubscribed: false });
    mockUnsubscribe.mockResolvedValue({ success: true });
    mockGetTimeline.mockResolvedValue({ success: true, timeline: [], activities: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ── Page Initialization ──────────────────────────────────────────

  describe('page initialization', () => {
    it('sets tracking page title and subtitle', async () => {
      await onReadyHandler();
      expect(getEl('#trackingTitle').text).toBe('Track Your Order');
      expect(getEl('#trackingSubtitle').text).toContain('order number and email');
    });

    it('collapses results sections on init', async () => {
      await onReadyHandler();
      expect(getEl('#trackingResultsSection').collapse).toHaveBeenCalled();
      expect(getEl('#activitySection').collapse).toHaveBeenCalled();
      expect(getEl('#lineItemsSection').collapse).toHaveBeenCalled();
      expect(getEl('#notificationSection').collapse).toHaveBeenCalled();
    });

    it('hides error and loader on init', async () => {
      await onReadyHandler();
      expect(getEl('#trackingError').hide).toHaveBeenCalled();
      expect(getEl('#trackingLoader').hide).toHaveBeenCalled();
    });

    it('registers click handler on track order button', async () => {
      await onReadyHandler();
      expect(getEl('#trackOrderBtn').onClick).toHaveBeenCalled();
    });

    it('registers enter key handlers on inputs', async () => {
      await onReadyHandler();
      expect(getEl('#emailInput').onKeyPress).toHaveBeenCalled();
      expect(getEl('#orderNumberInput').onKeyPress).toHaveBeenCalled();
    });

    it('registers click handler on new search button', async () => {
      await onReadyHandler();
      expect(getEl('#newSearchBtn').onClick).toHaveBeenCalled();
    });

    it('registers click handler on refresh button', async () => {
      await onReadyHandler();
      expect(getEl('#refreshTrackingBtn').onClick).toHaveBeenCalled();
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'order_tracking' });
    });

    it('sets ARIA labels on form inputs', async () => {
      await onReadyHandler();
      expect(getEl('#orderNumberInput').accessibility.ariaLabel).toBe('Order number');
      expect(getEl('#emailInput').accessibility.ariaLabel).toContain('Email');
      expect(getEl('#trackOrderBtn').accessibility.ariaLabel).toBe('Track order');
    });
  });

  // ── Client-Side Validation ───────────────────────────────────────

  describe('client-side validation', () => {
    it('shows error when order number is empty', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackingError').text).toContain('order number');
    });

    it('shows error when email is empty', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = '';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackingError').text).toContain('email');
    });

    it('shows error when email is invalid', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'not-an-email';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackingError').text).toContain('email');
    });

    it('does not call lookupOrder with invalid inputs', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(mockLookupOrder).not.toHaveBeenCalled();
    });
  });

  // ── Successful Lookup ────────────────────────────────────────────

  describe('successful order lookup', () => {
    async function doLookup() {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('calls lookupOrder with order number and email', async () => {
      await doLookup();
      expect(mockLookupOrder).toHaveBeenCalledWith('10042', 'jane@example.com');
    });

    it('shows loading state during lookup', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      // Make lookupOrder hang so we can check loading state
      let resolve;
      mockLookupOrder.mockReturnValueOnce(new Promise(r => { resolve = r; }));

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      const lookupPromise = clickHandler();

      expect(getEl('#trackOrderBtn').disable).toHaveBeenCalled();
      expect(getEl('#trackOrderBtn').label).toBe('Looking up...');

      resolve(mockLookupResult);
      await lookupPromise;

      expect(getEl('#trackOrderBtn').enable).toHaveBeenCalled();
      expect(getEl('#trackOrderBtn').label).toBe('Track Order');
    });

    it('renders order number and date', async () => {
      await doLookup();
      expect(getEl('#resultOrderNumber').text).toBe('Order #10042');
      expect(getEl('#resultOrderDate').text).toContain('2025');
    });

    it('renders order status with color', async () => {
      await doLookup();
      expect(getEl('#resultStatus').text).toBe('In Transit');
      expect(getEl('#resultStatus').style.color).toBe('#5B8FA8'); // mountainBlue
    });

    it('renders status description', async () => {
      await doLookup();
      expect(getEl('#resultStatusDescription').text).toBe('Your package is on its way');
    });

    it('expands results section', async () => {
      await doLookup();
      expect(getEl('#trackingResultsSection').expand).toHaveBeenCalled();
    });

    it('announces order found for screen readers', async () => {
      await doLookup();
      const { announce } = await import('public/a11yHelpers');
      expect(announce).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('10042')
      );
    });

    it('tracks order_tracked event', async () => {
      await doLookup();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('order_tracked', {
        orderNumber: '10042',
        status: 'IN_TRANSIT',
      });
    });
  });

  // ── Failed Lookup ────────────────────────────────────────────────

  describe('failed order lookup', () => {
    it('shows error when order not found', async () => {
      mockLookupOrder.mockResolvedValueOnce({
        success: false,
        error: 'Order not found. Please check your order number.',
      });

      await onReadyHandler();
      getEl('#orderNumberInput').value = '99999';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackingError').text).toContain('Order not found');
    });

    it('shows generic error when lookupOrder throws', async () => {
      mockLookupOrder.mockRejectedValueOnce(new Error('Network error'));

      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackingError').text).toContain('Something went wrong');
    });

    it('re-enables button after failed lookup', async () => {
      mockLookupOrder.mockRejectedValueOnce(new Error('Network error'));

      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(getEl('#trackOrderBtn').enable).toHaveBeenCalled();
      expect(getEl('#trackOrderBtn').label).toBe('Track Order');
    });
  });

  // ── Timeline Rendering ──────────────────────────────────────────

  describe('timeline rendering', () => {
    async function doLookup() {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('expands timeline container', async () => {
      await doLookup();
      expect(getEl('#trackingTimeline').expand).toHaveBeenCalled();
    });

    it('sets timeline labels for each step', async () => {
      await doLookup();
      expect(getEl('#timelineLabel0').text).toBe('Order Placed');
      expect(getEl('#timelineLabel1').text).toBe('Shipped');
      expect(getEl('#timelineLabel2').text).toBe('In Transit');
    });

    it('colors completed steps with success color', async () => {
      await doLookup();
      expect(getEl('#timelineDot0').style.backgroundColor).toBe('#2E7D32'); // success
      expect(getEl('#timelineDot1').style.backgroundColor).toBe('#2E7D32');
    });

    it('colors current+completed step dot with success (completed takes precedence)', async () => {
      await doLookup();
      // Step 2 is both completed and current — completed branch runs first
      expect(getEl('#timelineDot2').style.backgroundColor).toBe('#2E7D32'); // success
    });

    it('styles current step label with mountainBlue', async () => {
      await doLookup();
      expect(getEl('#timelineLabel2').style.color).toBe('#5B8FA8'); // mountainBlue
    });

    it('colors pending steps with muted', async () => {
      await doLookup();
      expect(getEl('#timelineDot3').style.backgroundColor).toBe('#999999'); // muted
      expect(getEl('#timelineDot4').style.backgroundColor).toBe('#999999');
    });

    it('bolds current step label', async () => {
      await doLookup();
      expect(getEl('#timelineLabel2').style.fontWeight).toBe('600'); // h4.weight
    });

    it('sets ARIA labels for timeline steps', async () => {
      await doLookup();
      expect(getEl('#timelineLabel0').accessibility.ariaLabel).toContain('Completed');
      expect(getEl('#timelineLabel2').accessibility.ariaLabel).toContain('Current');
      expect(getEl('#timelineLabel3').accessibility.ariaLabel).toContain('Pending');
    });

    it('colors exception status with coral', async () => {
      const exceptionResult = {
        ...mockLookupResult,
        order: { ...mockLookupResult.order, fulfillmentStatus: 'EXCEPTION', status: 'Exception' },
        timeline: [
          { step: 0, label: 'Order Placed', completed: true, current: false },
          { step: 1, label: 'Shipped', completed: true, current: false },
          { step: 2, label: 'In Transit', completed: false, current: true },
          { step: 3, label: 'Out for Delivery', completed: false, current: false },
          { step: 4, label: 'Delivered', completed: false, current: false },
        ],
      };
      mockLookupOrder.mockResolvedValueOnce(exceptionResult);
      await doLookup();

      // Exception current dot should be coral
      expect(getEl('#timelineDot2').style.backgroundColor).toBe('#E8845C'); // sunsetCoral
    });
  });

  // ── Shipping Details ─────────────────────────────────────────────

  describe('shipping details', () => {
    async function doLookup(result) {
      mockLookupOrder.mockResolvedValueOnce(result || mockLookupResult);
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('renders carrier and service info', async () => {
      await doLookup();
      expect(getEl('#carrierName').text).toBe('UPS');
      expect(getEl('#serviceName').text).toBe('UPS Ground');
      expect(getEl('#trackingNumberText').text).toBe('1Z999AA10123456784');
    });

    it('renders estimated delivery date', async () => {
      await doLookup();
      expect(getEl('#estimatedDelivery').text).toContain('Estimated delivery');
    });

    it('shows pending when no estimated delivery', async () => {
      const noEst = {
        ...mockLookupResult,
        shipping: { ...mockLookupResult.shipping, estimatedDelivery: null },
      };
      await doLookup(noEst);
      expect(getEl('#estimatedDelivery').text).toContain('Pending');
    });

    it('renders shipping destination', async () => {
      await doLookup();
      expect(getEl('#shippingDestination').text).toContain('Asheville');
      expect(getEl('#shippingDestination').text).toContain('NC');
    });

    it('expands shipping details section', async () => {
      await doLookup();
      expect(getEl('#shippingDetailsSection').expand).toHaveBeenCalled();
    });

    it('registers UPS tracking link button', async () => {
      await doLookup();
      expect(getEl('#upsTrackingBtn').onClick).toHaveBeenCalled();
    });

    it('shows no-tracking message when no tracking number', async () => {
      const noTracking = {
        ...mockLookupResult,
        shipping: { ...mockLookupResult.shipping, trackingNumber: null },
      };
      await doLookup(noTracking);
      expect(getEl('#noTrackingMessage').text).toContain('being prepared');
      expect(getEl('#noTrackingMessage').show).toHaveBeenCalled();
    });
  });

  // ── Line Items ───────────────────────────────────────────────────

  describe('line items', () => {
    async function doLookup() {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('sets repeater data with line items', async () => {
      await doLookup();
      const repeater = getEl('#trackingItemsRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]).toMatchObject({ name: 'Eureka Futon Frame' });
    });

    it('registers onItemReady on items repeater', async () => {
      await doLookup();
      expect(getEl('#trackingItemsRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady populates item card', async () => {
      await doLookup();
      const repeater = getEl('#trackingItemsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '', src: '', alt: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { name: 'Eureka Futon Frame', quantity: 1, sku: 'EUR-FRM-001', price: 499, image: 'img1.jpg' });
      expect(itemEls['#itemImage'].src).toBe('img1.jpg');
      expect(itemEls['#itemName'].text).toBe('Eureka Futon Frame');
      expect(itemEls['#itemQty'].text).toBe('Qty: 1');
      expect(itemEls['#itemPrice'].text).toBe('$499.00');
      expect(itemEls['#itemSku'].text).toBe('SKU: EUR-FRM-001');
    });

    it('onItemReady hides SKU when empty', async () => {
      await doLookup();
      const repeater = getEl('#trackingItemsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '', src: '', alt: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { name: 'Test', quantity: 2, sku: '', price: 100, image: '' });
      expect(itemEls['#itemSku'].text).toBe('');
    });

    it('expands line items section', async () => {
      await doLookup();
      expect(getEl('#lineItemsSection').expand).toHaveBeenCalled();
    });
  });

  // ── Order Totals ─────────────────────────────────────────────────

  describe('order totals', () => {
    async function doLookup() {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('renders subtotal', async () => {
      await doLookup();
      expect(getEl('#totalSubtotal').text).toBe('$848.00');
    });

    it('renders shipping cost', async () => {
      await doLookup();
      expect(getEl('#totalShipping').text).toBe('$29.99');
    });

    it('shows Free for zero shipping', async () => {
      mockLookupOrder.mockResolvedValueOnce({
        ...mockLookupResult,
        totals: { subtotal: 1200, shipping: 0, total: 1200 },
      });
      await doLookup();
      expect(getEl('#totalShipping').text).toBe('Free');
    });

    it('renders total with bold weight', async () => {
      await doLookup();
      expect(getEl('#totalAmount').text).toBe('$877.99');
      expect(getEl('#totalAmount').style.fontWeight).toBe('700'); // h3.weight
    });
  });

  // ── Activity Log ─────────────────────────────────────────────────

  describe('activity log', () => {
    async function doLookup() {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('sets activity repeater data', async () => {
      await doLookup();
      const repeater = getEl('#activityRepeater');
      expect(repeater.data).toHaveLength(2);
    });

    it('onItemReady formats activity with date and time', async () => {
      await doLookup();
      const repeater = getEl('#activityRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { status: 'Departed Facility', location: 'Charlotte, NC', date: '20250618', time: '1430' });
      expect(itemEls['#activityStatus'].text).toBe('Departed Facility');
      expect(itemEls['#activityLocation'].text).toBe('Charlotte, NC');
      expect(itemEls['#activityDateTime'].text).toContain('2:30 PM');
    });

    it('onItemReady formats AM time correctly', async () => {
      await doLookup();
      const repeater = getEl('#activityRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemEls = {};
      const $item = (sel) => {
        if (!itemEls[sel]) itemEls[sel] = { text: '' };
        return itemEls[sel];
      };

      itemReadyCb($item, { status: 'Scan', location: 'Test', date: '20250618', time: '0800' });
      expect(itemEls['#activityDateTime'].text).toContain('8:00 AM');
    });

    it('collapses activity section when no activities', async () => {
      mockLookupOrder.mockResolvedValueOnce({
        ...mockLookupResult,
        tracking: null,
      });
      await doLookup();
      expect(getEl('#activitySection').collapse).toHaveBeenCalled();
    });

    it('expands activity section when activities exist', async () => {
      await doLookup();
      expect(getEl('#activitySection').expand).toHaveBeenCalled();
    });
  });

  // ── Notification Toggle ──────────────────────────────────────────

  describe('notification toggle', () => {
    async function doLookup(result) {
      mockLookupOrder.mockResolvedValueOnce(result || mockLookupResult);
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('sets toggle to current notification state', async () => {
      await doLookup();
      expect(getEl('#notificationToggle').checked).toBe(false);
    });

    it('shows enabled label when notifications are on', async () => {
      await doLookup({
        ...mockLookupResult,
        notificationsEnabled: true,
      });
      expect(getEl('#notificationLabel').text).toContain('receive email updates');
    });

    it('shows opt-in label when notifications are off', async () => {
      await doLookup();
      expect(getEl('#notificationLabel').text).toContain('Get email updates');
    });

    it('registers onChange handler on toggle', async () => {
      await doLookup();
      expect(getEl('#notificationToggle').onChange).toHaveBeenCalled();
    });

    it('calls subscribeToNotifications when toggled on', async () => {
      await doLookup();
      const toggle = getEl('#notificationToggle');
      const onChangeHandler = toggle.onChange.mock.calls[0][0];
      toggle.checked = true;

      await onChangeHandler();
      expect(mockSubscribe).toHaveBeenCalledWith('10042', 'jane@example.com');
    });

    it('calls unsubscribeFromNotifications when toggled off', async () => {
      await doLookup({
        ...mockLookupResult,
        notificationsEnabled: true,
      });
      const toggle = getEl('#notificationToggle');
      const onChangeHandler = toggle.onChange.mock.calls[0][0];
      toggle.checked = false;

      await onChangeHandler();
      expect(mockUnsubscribe).toHaveBeenCalledWith('10042', 'jane@example.com');
    });

    it('reverts toggle on subscription failure', async () => {
      mockSubscribe.mockRejectedValueOnce(new Error('Network error'));

      await doLookup();
      const toggle = getEl('#notificationToggle');
      const onChangeHandler = toggle.onChange.mock.calls[0][0];
      toggle.checked = true;

      await onChangeHandler();
      expect(toggle.checked).toBe(false); // reverted
    });

    it('collapses notification section when no tracking number', async () => {
      await doLookup({
        ...mockLookupResult,
        shipping: { ...mockLookupResult.shipping, trackingNumber: null },
      });
      expect(getEl('#notificationSection').collapse).toHaveBeenCalled();
    });

    it('expands notification section when tracking exists', async () => {
      await doLookup();
      expect(getEl('#notificationSection').expand).toHaveBeenCalled();
    });
  });

  // ── New Search Button ────────────────────────────────────────────

  describe('new search button', () => {
    it('clears inputs and collapses results on click', async () => {
      await onReadyHandler();

      // Simulate having looked up an order
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const newSearchHandler = getEl('#newSearchBtn').onClick.mock.calls[0][0];
      newSearchHandler();

      expect(getEl('#orderNumberInput').value).toBe('');
      expect(getEl('#emailInput').value).toBe('');
      expect(getEl('#trackingResultsSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Enter Key Submission ─────────────────────────────────────────

  describe('enter key submission', () => {
    it('submits form on Enter key in email input', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const keyPressHandler = getEl('#emailInput').onKeyPress.mock.calls[0][0];
      await keyPressHandler({ key: 'Enter' });

      expect(mockLookupOrder).toHaveBeenCalled();
    });

    it('does not submit on non-Enter key', async () => {
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const keyPressHandler = getEl('#emailInput').onKeyPress.mock.calls[0][0];
      await keyPressHandler({ key: 'Tab' });

      expect(mockLookupOrder).not.toHaveBeenCalled();
    });
  });

  // ── Auto-Refresh ─────────────────────────────────────────────────

  describe('auto-refresh', () => {
    async function doLookup(result) {
      mockLookupOrder.mockResolvedValueOnce(result || mockLookupResult);
      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';
      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      await clickHandler();
    }

    it('starts auto-refresh for in-transit orders', async () => {
      mockGetTimeline.mockResolvedValue({
        success: true,
        timeline: mockLookupResult.timeline,
        activities: [],
        fulfillmentStatus: 'IN_TRANSIT',
        statusLabel: 'In Transit',
      });

      await doLookup();

      // Advance 5 minutes
      await vi.advanceTimersByTimeAsync(300000);

      expect(mockGetTimeline).toHaveBeenCalledWith('1Z999AA10123456784');
    });

    it('does not start auto-refresh for delivered orders', async () => {
      const delivered = {
        ...mockLookupResult,
        order: { ...mockLookupResult.order, fulfillmentStatus: 'DELIVERED' },
      };
      await doLookup(delivered);

      await vi.advanceTimersByTimeAsync(300000);
      expect(mockGetTimeline).not.toHaveBeenCalled();
    });

    it('does not start auto-refresh without tracking number', async () => {
      const noTracking = {
        ...mockLookupResult,
        shipping: { ...mockLookupResult.shipping, trackingNumber: null },
      };
      await doLookup(noTracking);

      await vi.advanceTimersByTimeAsync(300000);
      expect(mockGetTimeline).not.toHaveBeenCalled();
    });
  });

  // ── Error Resilience ─────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when page elements are missing', async () => {
      // Override $w to throw for some elements
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#trackingTitle' || sel === '#trackingSubtitle') {
            throw new Error('Element not found');
          }
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });

    it('handles lookupOrder returning undefined gracefully', async () => {
      mockLookupOrder.mockResolvedValueOnce(undefined);

      await onReadyHandler();
      getEl('#orderNumberInput').value = '10042';
      getEl('#emailInput').value = 'jane@example.com';

      const clickHandler = getEl('#trackOrderBtn').onClick.mock.calls[0][0];
      // Should not throw — the catch block should handle it
      await expect(clickHandler()).resolves.not.toThrow();
    });
  });
});
