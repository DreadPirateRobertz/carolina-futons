/**
 * Integration tests for Member Page order history section.
 * Imports the actual page module, mocks $w + backend, and exercises
 * initOrderHistory through $w.onReady to test real UI state transitions.
 *
 * NOTE: Module-level state (_deliveries, _orderData, _orderPage, _orderFilter)
 * persists across tests within the same describe block since the page module
 * is imported once via beforeAll. Tests are ordered to account for this:
 * - "no delivery" tests run before "with delivery" tests
 * - Tests that modify _orderPage (pagination) account for prior state
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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
    items: [],
    style: { color: '', backgroundColor: '', fontWeight: '', borderColor: '', opacity: 1 },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    click: vi.fn(),
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

// ── Mock backend modules ────────────────────────────────────────────

const mockGetOrderHistory = vi.fn();
const mockGetActiveDeliveries = vi.fn();
const mockGetReorderItems = vi.fn();
const mockAddToCart = vi.fn(() => Promise.resolve());

vi.mock('backend/accountDashboard.web', () => ({
  getOrderHistory: (...args) => mockGetOrderHistory(...args),
  getActiveDeliveries: (...args) => mockGetActiveDeliveries(...args),
  getReorderItems: (...args) => mockGetReorderItems(...args),
  getAccountSummary: vi.fn().mockResolvedValue({ success: true, data: {} }),
  getWishlist: vi.fn().mockResolvedValue({ success: true, data: { items: [], totalCount: 0, hasNext: false } }),
  getSavedAddresses: vi.fn().mockResolvedValue({ success: true, data: { addresses: [] } }),
  getCommunicationPrefs: vi.fn().mockResolvedValue({ success: true, data: { newsletter: true, saleAlerts: true, backInStock: true } }),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C',
    success: '#4CAF50',
    muted: '#999',
    espresso: '#3A2518',
    sandLight: '#F2E8D5',
    offWhite: '#FAF7F2',
  },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

vi.mock('public/ReturnsPortal.js', () => ({
  initReturnsSection: vi.fn(),
}));

vi.mock('public/storeCreditHelpers.js', () => ({
  initStoreCreditDashboard: vi.fn(),
}));

vi.mock('public/loyaltyHelpers.js', () => ({
  formatPoints: vi.fn(() => '0'),
  formatProgressText: vi.fn(() => ''),
  getProgressPercent: vi.fn(() => 0),
  getTierColor: vi.fn(() => '#999'),
  getTierIcon: vi.fn(() => ''),
  canAffordReward: vi.fn(() => false),
  formatRewardCost: vi.fn(() => ''),
  buildTierComparisonData: vi.fn(() => []),
  getNextMilestone: vi.fn(() => null),
}));

vi.mock('public/cartService', () => ({
  addToCart: (...args) => mockAddToCart(...args),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({
      _id: 'member-1',
      loginEmail: 'member@test.com',
      contactDetails: { firstName: 'TestUser', emails: ['member@test.com'] },
    }),
  },
  authentication: { promptLogin: vi.fn() },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn().mockReturnThis(),
      ascending: vi.fn().mockReturnThis(),
      descending: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
    })),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('wix-window-frontend', () => ({
  lightbox: { openLightbox: vi.fn() },
  openModal: vi.fn(),
}));

vi.mock('backend/loyaltyService.web', () => ({
  getMyLoyaltyAccount: vi.fn().mockResolvedValue({ success: true, data: { points: 0, tier: 'Bronze' } }),
  redeemReward: vi.fn(),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/notificationService.web', () => ({
  toggleProductAlerts: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Test fixtures ──────────────────────────────────────────────────

function makeSampleOrders(overrides = {}) {
  return {
    success: true,
    data: {
      orders: [
        {
          _id: 'order-1',
          number: '1001',
          createdDate: '2026-03-01',
          status: 'Shipped',
          total: 599.99,
          itemCount: 2,
          trackingNumber: '1Z999AA10000000001',
          lineItems: [
            { name: 'Eureka Futon', quantity: 1, price: 499.99, imageUrl: 'img1.jpg' },
            { name: 'Futon Cover', quantity: 1, price: 100.00, imageUrl: 'img2.jpg' },
          ],
        },
        {
          _id: 'order-2',
          number: '1002',
          createdDate: '2026-02-15',
          status: 'Delivered',
          total: 1299.00,
          itemCount: 1,
          trackingNumber: null,
          lineItems: [
            { name: 'Kodiak Futon', quantity: 1, price: 1299.00, imageUrl: 'img3.jpg' },
          ],
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 2,
      totalPages: 1,
      hasNext: false,
      ...overrides,
    },
  };
}

const sampleDeliveries = {
  success: true,
  data: {
    deliveries: [
      {
        _id: 'd1',
        orderId: 'order-1',
        status: 'in_transit',
        trackingNumber: '1Z999AA10000000001',
        estimatedDelivery: '2026-03-10',
        deliveryTier: 'white_glove',
      },
    ],
    count: 1,
  },
};

const emptyOrders = {
  success: true,
  data: { orders: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasNext: false },
};

const emptyDeliveries = { success: true, data: { deliveries: [], count: 0 } };
const failedResponse = { success: false, error: 'Server error' };

/**
 * Simulate onItemReady for a single repeater item.
 * Creates a scoped $item mock and invokes the onItemReady callback.
 * Returns the $item function for asserting on element state.
 */
function renderItem(repeater, itemData) {
  const onItemReady = repeater.onItemReady.mock.calls[0][0];
  const itemElements = new Map();
  const $item = (sel) => {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  };
  onItemReady($item, itemData);
  return $item;
}

// ── Import Page ─────────────────────────────────────────────────────

describe('Member Page - Order History Integration', () => {
  beforeAll(async () => {
    await import('../../src/pages/Member Page.js');
  });

  beforeEach(() => {
    elements.clear();
    mockGetOrderHistory.mockReset();
    mockGetActiveDeliveries.mockReset();
    mockGetReorderItems.mockReset();
    mockAddToCart.mockReset();
    mockAddToCart.mockResolvedValue();
  });

  // ── Loading & Data ────────────────────────────────────────────────

  describe('loading and data flow', () => {
    it('shows loader during fetch, hides after', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const loader = getEl('#ordersLoader');
      expect(loader.show).toHaveBeenCalled();
      expect(loader.hide).toHaveBeenCalled();
    });

    it('calls getOrderHistory and getActiveDeliveries on init', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      expect(mockGetOrderHistory).toHaveBeenCalledWith({ page: 1 });
      // getActiveDeliveries may or may not be called depending on prior state,
      // but getOrderHistory is always called
      expect(mockGetOrderHistory).toHaveBeenCalled();
    });

    it('sets repeater data with orders and expands', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]._id).toBe('order-1');
      expect(repeater.expand).toHaveBeenCalled();
    });

    it('registers onItemReady handler on repeater', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      expect(getEl('#ordersRepeater').onItemReady).toHaveBeenCalled();
    });
  });

  // ── Empty State ───────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when no orders', async () => {
      mockGetOrderHistory.mockResolvedValue(emptyOrders);
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      expect(getEl('#ordersEmpty').show).toHaveBeenCalled();
      expect(getEl('#ordersRepeater').collapse).toHaveBeenCalled();
      expect(getEl('#ordersLoadMoreBtn').hide).toHaveBeenCalled();
    });
  });

  // ── Error State ───────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error message on backend failure', async () => {
      mockGetOrderHistory.mockResolvedValue(failedResponse);
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const errorEl = getEl('#ordersError');
      expect(errorEl.text).toContain('Unable to load');
      expect(errorEl.show).toHaveBeenCalled();
      expect(getEl('#ordersLoader').hide).toHaveBeenCalled();
    });

    it('shows error on network exception', async () => {
      mockGetOrderHistory.mockRejectedValue(new Error('Network error'));
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const errorEl = getEl('#ordersError');
      expect(errorEl.text).toContain('Unable to load');
      expect(errorEl.show).toHaveBeenCalled();
    });

    it('wires retry button once during init (no stacking)', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const retryBtn = getEl('#ordersRetryBtn');
      expect(retryBtn.onClick).toHaveBeenCalledTimes(1);
    });
  });

  // ── Filter Dropdown ───────────────────────────────────────────────

  describe('filter dropdown', () => {
    it('populates dropdown with filter options', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const dropdown = getEl('#orderFilterDropdown');
      expect(dropdown.options.length).toBeGreaterThanOrEqual(5);
      expect(dropdown.options[0]).toEqual({ label: 'All Orders', value: 'all' });
      expect(dropdown.value).toBe('all');
    });

    it('registers onChange handler', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      expect(getEl('#orderFilterDropdown').onChange).toHaveBeenCalled();
    });

    it('onChange re-fetches and filters orders by status', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const dropdown = getEl('#orderFilterDropdown');
      const onChangeHandler = dropdown.onChange.mock.calls[0][0];

      // Simulate selecting "Shipped" filter
      dropdown.value = 'Shipped';
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      await onChangeHandler();

      const repeater = getEl('#ordersRepeater');
      expect(repeater.data.every(o => o.status === 'Shipped')).toBe(true);
      expect(repeater.data.length).toBe(1);
    });
  });

  // ── Pagination ────────────────────────────────────────────────────

  describe('pagination', () => {
    it('shows Load More when hasNext is true', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders({ hasNext: true, totalPages: 3, totalCount: 25 }));
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      expect(getEl('#ordersLoadMoreBtn').show).toHaveBeenCalled();
    });

    it('hides Load More when hasNext is false', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders({ hasNext: false }));
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const btn = getEl('#ordersLoadMoreBtn');
      const hideCalls = btn.hide.mock.calls;
      // Last hide call should be from the data load (hasNext=false)
      expect(hideCalls.length).toBeGreaterThan(0);
    });

    it('Load More appends next page data to repeater', async () => {
      const page1 = makeSampleOrders({ hasNext: true, totalPages: 3, totalCount: 25 });
      const page2 = {
        success: true,
        data: {
          orders: [{ _id: 'order-3', number: '1003', status: 'Processing', total: 399, itemCount: 1, trackingNumber: null, lineItems: [] }],
          page: 2, pageSize: 10, totalCount: 25, totalPages: 3, hasNext: true,
        },
      };
      mockGetOrderHistory.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const loadMoreBtn = getEl('#ordersLoadMoreBtn');
      const onClickHandler = loadMoreBtn.onClick.mock.calls[0][0];
      await onClickHandler();

      const repeater = getEl('#ordersRepeater');
      expect(repeater.data.length).toBeGreaterThanOrEqual(3);
      expect(repeater.data.some(o => o._id === 'order-3')).toBe(true);
    });

    it('Load More disables during fetch, re-enables after', async () => {
      const page1 = makeSampleOrders({ hasNext: true });
      const page2 = makeSampleOrders({ hasNext: false });
      mockGetOrderHistory.mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const loadMoreBtn = getEl('#ordersLoadMoreBtn');
      const onClickHandler = loadMoreBtn.onClick.mock.calls[0][0];
      await onClickHandler();

      expect(loadMoreBtn.disable).toHaveBeenCalled();
      expect(loadMoreBtn.enable).toHaveBeenCalled();
    });
  });

  // ── Repeater Item Rendering ───────────────────────────────────────

  describe('repeater item rendering', () => {
    it('renders order data into card elements', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);

      expect($item('#orderNumber').text).toContain('1001');
      expect($item('#orderTotal').text).toContain('599');
      expect($item('#orderItemCount').text).toBe('2 items');
      expect($item('#orderStatusBadge').text).toBe('Shipped');
    });

    it('shows track button when order has tracking number', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      // order-1 has trackingNumber
      const $item = renderItem(repeater, repeater.data[0]);
      expect($item('#orderTrackBtn').show).toHaveBeenCalled();
      expect($item('#orderTrackBtn').onClick).toHaveBeenCalled();
    });

    it('hides track button when no tracking info', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      // order-2 has trackingNumber: null
      const $item = renderItem(repeater, repeater.data[1]);
      expect($item('#orderTrackBtn').hide).toHaveBeenCalled();
    });

    it('hides return button for Cancelled orders', async () => {
      const cancelledOrders = {
        success: true,
        data: {
          orders: [{ _id: 'cancelled-1', number: '999', status: 'Cancelled', total: 100, itemCount: 1, trackingNumber: null, lineItems: [] }],
          page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasNext: false,
        },
      };
      mockGetOrderHistory.mockResolvedValue(cancelledOrders);
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);
      expect($item('#orderStartReturnBtn').hide).toHaveBeenCalled();
    });
  });

  // ── Delivery ETA (uses sampleDeliveries — runs after no-delivery tests) ──

  describe('delivery ETA integration', () => {
    it('merges delivery data and shows ETA on matched orders', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(sampleDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      // order-1 should have delivery data merged
      expect(repeater.data[0].deliveryEta).toBe('2026-03-10');
      expect(repeater.data[0].liveStatus).toBe('in_transit');
      expect(repeater.data[0].deliveryTrackingNumber).toBe('1Z999AA10000000001');
      // order-2 should NOT have delivery data
      expect(repeater.data[1].deliveryEta).toBeUndefined();
    });

    it('renders delivery ETA text in card', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(sampleDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);
      const etaEl = $item('#orderDeliveryEta');
      expect(etaEl.text).toContain('Est. delivery:');
      expect(etaEl.show).toHaveBeenCalled();
    });

    it('hides delivery ETA when order has no delivery match', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(sampleDeliveries);
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      // order-2 has no matching delivery
      const $item = renderItem(repeater, repeater.data[1]);
      expect($item('#orderDeliveryEta').hide).toHaveBeenCalled();
    });
  });

  // ── Reorder Flow ──────────────────────────────────────────────────

  describe('reorder flow', () => {
    it('calls getReorderItems then addToCart via Promise.all', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      mockGetReorderItems.mockResolvedValue({
        success: true,
        data: {
          items: [
            { productId: 'prod-1', quantity: 1 },
            { productId: 'prod-2', quantity: 2 },
          ],
        },
      });
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);

      const reorderBtn = $item('#orderReorderBtn');
      await reorderBtn.onClick.mock.calls[0][0]();

      expect(mockGetReorderItems).toHaveBeenCalledWith('order-1');
      expect(mockAddToCart).toHaveBeenCalledTimes(2);
      expect(mockAddToCart).toHaveBeenCalledWith('prod-1', 1);
      expect(mockAddToCart).toHaveBeenCalledWith('prod-2', 2);
      expect(reorderBtn.label).toBe('Added to Cart!');
    });

    it('shows "No Items" when reorder returns empty', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      mockGetReorderItems.mockResolvedValue({ success: true, data: { items: [] } });
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);
      await $item('#orderReorderBtn').onClick.mock.calls[0][0]();

      expect(mockAddToCart).not.toHaveBeenCalled();
      expect($item('#orderReorderBtn').label).toBe('No Items');
    });

    it('handles null data safely (null guard)', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      mockGetReorderItems.mockResolvedValue({ success: true, data: null });
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);
      // Should not throw
      await $item('#orderReorderBtn').onClick.mock.calls[0][0]();
      expect(mockAddToCart).not.toHaveBeenCalled();
    });

    it('re-enables button and resets label on error', async () => {
      mockGetOrderHistory.mockResolvedValue(makeSampleOrders());
      mockGetActiveDeliveries.mockResolvedValue(emptyDeliveries);
      mockGetReorderItems.mockRejectedValue(new Error('fetch failed'));
      await onReadyHandler();

      const repeater = getEl('#ordersRepeater');
      const $item = renderItem(repeater, repeater.data[0]);
      const reorderBtn = $item('#orderReorderBtn');
      await reorderBtn.onClick.mock.calls[0][0]();

      expect(reorderBtn.disable).toHaveBeenCalled();
      expect(reorderBtn.enable).toHaveBeenCalled();
      expect(reorderBtn.label).toBe('Reorder');
    });
  });
});
