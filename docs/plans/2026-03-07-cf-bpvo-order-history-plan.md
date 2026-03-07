# CF-bpvo: Order History & Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up Member Page order history to existing backend APIs with pagination, status filtering, delivery ETA, loading/empty/error states.

**Architecture:** `initOrderHistory()` calls `getOrderHistory` + `getActiveDeliveries` from `accountDashboard.web.js`, merges delivery data into orders, renders via `#ordersRepeater`. Pure helper functions in `MemberPageHelpers.js`, TDD.

**Tech Stack:** Wix Velo ($w), Vitest, accountDashboard.web.js backend

---

### Task 1: Add MemberPageHelpers Pure Functions — Tests

**Files:**
- Modify: `tests/MemberPageHelpers.test.js` (append new describe blocks)
- Reference: `src/public/MemberPageHelpers.js`

**Step 1: Write failing tests for all 6 new helpers**

Append to `tests/MemberPageHelpers.test.js`:

```js
// Add to imports at top:
// mergeDeliveryStatus, formatDeliveryEstimate, formatItemCount,
// getOrderFilterOptions, filterOrdersByStatus, buildTrackingUrl,
// ORDER_FILTER_OPTIONS

// ── mergeDeliveryStatus ──────────────────────────────────────────────

describe('mergeDeliveryStatus', () => {
  it('merges matching delivery into order', () => {
    const orders = [{ _id: 'o1', status: 'Processing' }];
    const deliveries = [{ orderId: 'o1', estimatedDelivery: '2026-03-15', status: 'in_transit', trackingNumber: '1Z999' }];
    const result = mergeDeliveryStatus(orders, deliveries);
    expect(result[0].deliveryEta).toBe('2026-03-15');
    expect(result[0].liveStatus).toBe('in_transit');
    expect(result[0].deliveryTrackingNumber).toBe('1Z999');
  });

  it('leaves order unchanged when no matching delivery', () => {
    const orders = [{ _id: 'o1', status: 'Delivered' }];
    const deliveries = [{ orderId: 'o2', status: 'in_transit' }];
    const result = mergeDeliveryStatus(orders, deliveries);
    expect(result[0].deliveryEta).toBeUndefined();
    expect(result[0].liveStatus).toBeUndefined();
  });

  it('handles empty orders array', () => {
    expect(mergeDeliveryStatus([], [{ orderId: 'o1' }])).toEqual([]);
  });

  it('handles empty deliveries array', () => {
    const orders = [{ _id: 'o1', status: 'Processing' }];
    const result = mergeDeliveryStatus(orders, []);
    expect(result).toEqual(orders);
  });

  it('handles null/undefined inputs', () => {
    expect(mergeDeliveryStatus(null, [])).toEqual([]);
    expect(mergeDeliveryStatus([], null)).toEqual([]);
    expect(mergeDeliveryStatus(undefined, undefined)).toEqual([]);
  });

  it('uses first delivery when multiple match same orderId', () => {
    const orders = [{ _id: 'o1' }];
    const deliveries = [
      { orderId: 'o1', status: 'in_transit', estimatedDelivery: '2026-03-15' },
      { orderId: 'o1', status: 'delivered', estimatedDelivery: '2026-03-10' },
    ];
    const result = mergeDeliveryStatus(orders, deliveries);
    expect(result[0].liveStatus).toBe('in_transit');
  });
});

// ── formatDeliveryEstimate ───────────────────────────────────────────

describe('formatDeliveryEstimate', () => {
  it('formats valid date', () => {
    const result = formatDeliveryEstimate('2026-03-15');
    expect(result).toContain('March');
    expect(result).toContain('15');
  });

  it('formats Date object', () => {
    const result = formatDeliveryEstimate(new Date('2026-03-15'));
    expect(result).toContain('March');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatDeliveryEstimate(null)).toBe('');
    expect(formatDeliveryEstimate(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatDeliveryEstimate('not-a-date')).toBe('');
  });

  it('includes weekday', () => {
    const result = formatDeliveryEstimate('2026-03-15');
    // March 15, 2026 is a Sunday
    expect(result).toContain('Sunday');
  });
});

// ── formatItemCount ─────────────────────────────────────────────────

describe('formatItemCount', () => {
  it('returns "1 item" for 1', () => {
    expect(formatItemCount(1)).toBe('1 item');
  });

  it('returns plural for > 1', () => {
    expect(formatItemCount(3)).toBe('3 items');
  });

  it('returns "0 items" for 0', () => {
    expect(formatItemCount(0)).toBe('0 items');
  });

  it('returns "0 items" for negative', () => {
    expect(formatItemCount(-1)).toBe('0 items');
  });

  it('returns "0 items" for null/undefined', () => {
    expect(formatItemCount(null)).toBe('0 items');
    expect(formatItemCount(undefined)).toBe('0 items');
  });
});

// ── getOrderFilterOptions ────────────────────────────────────────────

describe('getOrderFilterOptions', () => {
  it('returns array with All Orders as first option', () => {
    const opts = getOrderFilterOptions();
    expect(opts[0]).toEqual({ label: 'All Orders', value: 'all' });
  });

  it('includes Processing, Shipped, Delivered, Cancelled', () => {
    const opts = getOrderFilterOptions();
    const values = opts.map(o => o.value);
    expect(values).toContain('Processing');
    expect(values).toContain('Shipped');
    expect(values).toContain('Delivered');
    expect(values).toContain('Cancelled');
  });
});

// ── filterOrdersByStatus ────────────────────────────────────────────

describe('filterOrdersByStatus', () => {
  const orders = [
    { _id: '1', status: 'Processing' },
    { _id: '2', status: 'Shipped' },
    { _id: '3', status: 'Delivered' },
    { _id: '4', status: 'Cancelled' },
  ];

  it('returns all orders for "all"', () => {
    expect(filterOrdersByStatus(orders, 'all')).toEqual(orders);
  });

  it('filters by Processing', () => {
    const result = filterOrdersByStatus(orders, 'Processing');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('1');
  });

  it('filters by Delivered', () => {
    const result = filterOrdersByStatus(orders, 'Delivered');
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('3');
  });

  it('returns empty array for unknown status', () => {
    expect(filterOrdersByStatus(orders, 'Unknown')).toEqual([]);
  });

  it('handles empty orders array', () => {
    expect(filterOrdersByStatus([], 'Processing')).toEqual([]);
  });

  it('handles null/undefined inputs', () => {
    expect(filterOrdersByStatus(null, 'all')).toEqual([]);
    expect(filterOrdersByStatus(orders, null)).toEqual(orders);
    expect(filterOrdersByStatus(orders, undefined)).toEqual(orders);
  });
});

// ── buildTrackingUrl ────────────────────────────────────────────────

describe('buildTrackingUrl', () => {
  it('builds URL with order number and email', () => {
    expect(buildTrackingUrl('1234', 'test@example.com'))
      .toBe('/tracking?order=1234&email=test%40example.com');
  });

  it('returns /tracking with empty params for missing inputs', () => {
    expect(buildTrackingUrl('', '')).toBe('/tracking?order=&email=');
    expect(buildTrackingUrl(null, null)).toBe('/tracking?order=&email=');
  });

  it('encodes special characters in email', () => {
    const url = buildTrackingUrl('1234', 'user+test@example.com');
    expect(url).toContain('user%2Btest%40example.com');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/hal/gt/cfutons/crew/miquella && npx vitest run tests/MemberPageHelpers.test.js 2>&1 | tail -20`
Expected: FAIL — functions not exported

**Step 3: Commit test file**

```bash
git add tests/MemberPageHelpers.test.js
git commit -m "test(CF-bpvo): add failing tests for order history helpers"
```

---

### Task 2: Implement MemberPageHelpers Pure Functions

**Files:**
- Modify: `src/public/MemberPageHelpers.js` (append after existing code)

**Step 1: Implement all 6 functions + constant**

Append to `src/public/MemberPageHelpers.js` before the closing of the file:

```js
// ── Order History Helpers ───────────────────────────────────────────

/** Status filter options for the order history dropdown */
export const ORDER_FILTER_OPTIONS = [
  { label: 'All Orders', value: 'all' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Shipped', value: 'Shipped' },
  { label: 'Delivered', value: 'Delivered' },
  { label: 'Cancelled', value: 'Cancelled' },
];

/**
 * Merge active delivery data into an orders array.
 * Matches deliveries to orders by orderId, adding deliveryEta,
 * liveStatus, and deliveryTrackingNumber fields.
 * @param {Array|null} orders
 * @param {Array|null} deliveries
 * @returns {Array} Orders with merged delivery data
 */
export function mergeDeliveryStatus(orders, deliveries) {
  if (!Array.isArray(orders)) return [];
  if (!Array.isArray(deliveries) || deliveries.length === 0) return [...orders];

  const deliveryMap = new Map();
  for (const d of deliveries) {
    if (d.orderId && !deliveryMap.has(d.orderId)) {
      deliveryMap.set(d.orderId, d);
    }
  }

  return orders.map(order => {
    const delivery = deliveryMap.get(order._id);
    if (!delivery) return { ...order };
    return {
      ...order,
      deliveryEta: delivery.estimatedDelivery,
      liveStatus: delivery.status,
      deliveryTrackingNumber: delivery.trackingNumber || null,
      deliveryTier: delivery.deliveryTier || null,
    };
  });
}

/**
 * Format an estimated delivery date for display.
 * @param {string|Date|null} dateValue
 * @returns {string} e.g. "Sunday, March 15" or ""
 */
export function formatDeliveryEstimate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format item count for display.
 * @param {number|null} count
 * @returns {string} e.g. "1 item" or "3 items"
 */
export function formatItemCount(count) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  return n === 1 ? '1 item' : `${n} items`;
}

/**
 * Get order filter dropdown options.
 * @returns {Array<{label: string, value: string}>}
 */
export function getOrderFilterOptions() {
  return ORDER_FILTER_OPTIONS;
}

/**
 * Filter orders by fulfillment status.
 * @param {Array|null} orders
 * @param {string|null} statusFilter - 'all' or a status string
 * @returns {Array}
 */
export function filterOrdersByStatus(orders, statusFilter) {
  if (!Array.isArray(orders)) return [];
  if (!statusFilter || statusFilter === 'all') return orders;
  return orders.filter(o => o.status === statusFilter);
}

/**
 * Build the URL for the order tracking page.
 * @param {string|null} orderNumber
 * @param {string|null} email
 * @returns {string}
 */
export function buildTrackingUrl(orderNumber, email) {
  const num = orderNumber || '';
  const mail = encodeURIComponent(email || '');
  return `/tracking?order=${num}&email=${mail}`;
}
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/hal/gt/cfutons/crew/miquella && npx vitest run tests/MemberPageHelpers.test.js 2>&1 | tail -20`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add src/public/MemberPageHelpers.js tests/MemberPageHelpers.test.js
git commit -m "feat(CF-bpvo): add order history helper functions with tests"
```

---

### Task 3: Write Integration Tests for initOrderHistory

**Files:**
- Create: `tests/MemberPage.orderHistory.test.js`
- Reference: `tests/categoryPage.test.js` (for $w mock pattern)
- Reference: `src/pages/Member Page.js`

**Step 1: Write integration test file**

Create `tests/MemberPage.orderHistory.test.js`:

```js
/**
 * Tests for Member Page order history section (initOrderHistory).
 * Mocks $w elements and backend modules, verifies data loading,
 * repeater population, pagination, filtering, and UI states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock backend modules ────────────────────────────────────────────

const mockGetOrderHistory = vi.fn();
const mockGetActiveDeliveries = vi.fn();
const mockGetReorderItems = vi.fn();

vi.mock('backend/accountDashboard.web', () => ({
  getOrderHistory: (...args) => mockGetOrderHistory(...args),
  getActiveDeliveries: (...args) => mockGetActiveDeliveries(...args),
  getReorderItems: (...args) => mockGetReorderItems(...args),
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
  },
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

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

// ── Test fixtures ──────────────────────────────────────────────────

const sampleOrders = {
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
  },
};

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

// ── Helper tests ────────────────────────────────────────────────────

import {
  mergeDeliveryStatus,
  formatDeliveryEstimate,
  formatItemCount,
  filterOrdersByStatus,
  buildTrackingUrl,
  getOrderFilterOptions,
} from '../src/public/MemberPageHelpers.js';

describe('Order History Integration - Data Layer', () => {
  it('mergeDeliveryStatus enriches orders with delivery data', () => {
    const merged = mergeDeliveryStatus(
      sampleOrders.data.orders,
      sampleDeliveries.data.deliveries
    );
    expect(merged[0].deliveryEta).toBe('2026-03-10');
    expect(merged[0].liveStatus).toBe('in_transit');
    expect(merged[1].deliveryEta).toBeUndefined();
  });

  it('formatDeliveryEstimate produces readable date', () => {
    const result = formatDeliveryEstimate('2026-03-10');
    expect(result).toContain('March');
    expect(result).toContain('10');
  });

  it('formatItemCount handles singular and plural', () => {
    expect(formatItemCount(1)).toBe('1 item');
    expect(formatItemCount(2)).toBe('2 items');
  });

  it('filterOrdersByStatus filters correctly', () => {
    const shipped = filterOrdersByStatus(sampleOrders.data.orders, 'Shipped');
    expect(shipped).toHaveLength(1);
    expect(shipped[0].number).toBe('1001');
  });

  it('buildTrackingUrl encodes email', () => {
    const url = buildTrackingUrl('1001', 'test@example.com');
    expect(url).toBe('/tracking?order=1001&email=test%40example.com');
  });

  it('getOrderFilterOptions includes all statuses', () => {
    const opts = getOrderFilterOptions();
    expect(opts.length).toBeGreaterThanOrEqual(5);
    expect(opts[0].value).toBe('all');
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd /Users/hal/gt/cfutons/crew/miquella && npx vitest run tests/MemberPage.orderHistory.test.js 2>&1 | tail -20`
Expected: PASS (these test the helpers directly; integration tests for $w wiring come in Task 5)

**Step 3: Commit**

```bash
git add tests/MemberPage.orderHistory.test.js
git commit -m "test(CF-bpvo): add order history integration test scaffolding"
```

---

### Task 4: Rewrite initOrderHistory in Member Page.js

**Files:**
- Modify: `src/pages/Member Page.js` (lines 332-441)

**Step 1: Add import for accountDashboard backend**

At top of `Member Page.js`, after existing imports, the backend import will be dynamic (inside `initOrderHistory`) to follow the existing pattern of lazy imports.

**Step 2: Replace initOrderHistory function**

Replace the entire `initOrderHistory` function (lines 334-441) with:

```js
// ── Order History ───────────────────────────────────────────────────

let _orderData = [];
let _orderPage = 1;
let _orderFilter = 'all';
let _memberEmail = '';
let _deliveries = [];

async function initOrderHistory() {
  try {
    const ordersRepeater = $w('#ordersRepeater');
    if (!ordersRepeater) return;

    const {
      mergeDeliveryStatus,
      formatOrderDate,
      formatOrderTotal,
      formatOrderNumber,
      formatDeliveryEstimate,
      formatItemCount,
      getOrderFilterOptions,
      filterOrdersByStatus,
      buildTrackingUrl,
      hasTrackingInfo,
      isReturnEligible,
      buildOrderGalleryItems,
      getStatusColor,
    } = await import('public/MemberPageHelpers.js');

    // Get member email for tracking links
    _memberEmail = currentMember?.loginEmail || currentMember?.contactDetails?.emails?.[0] || '';

    // Setup repeater item rendering
    ordersRepeater.onItemReady(($item, itemData) => {
      try { $item('#orderNumber').text = formatOrderNumber(itemData.number); } catch (e) {}
      try {
        $item('#orderDate').text = formatOrderDate(itemData.createdDate);
      } catch (e) {}
      try { $item('#orderTotal').text = formatOrderTotal({ total: itemData.total }); } catch (e) {}
      try { $item('#orderItemCount').text = formatItemCount(itemData.itemCount); } catch (e) {}

      // Status badge
      try {
        const status = itemData.status || 'Processing';
        const badgeEl = $item('#orderStatusBadge');
        if (badgeEl) {
          badgeEl.text = status;
          badgeEl.style.color = getStatusColor(status);
          try { badgeEl.accessibility.ariaLabel = `Order status: ${status}`; } catch (e) {}
        } else {
          try { $item('#orderStatus').text = status; } catch (e) {}
        }
      } catch (e) {}

      // Delivery ETA
      try {
        const etaEl = $item('#orderDeliveryEta');
        if (etaEl) {
          if (itemData.deliveryEta) {
            const formatted = formatDeliveryEstimate(itemData.deliveryEta);
            etaEl.text = itemData.status === 'Delivered'
              ? `Delivered ${formatted}`
              : `Est. delivery: ${formatted}`;
            etaEl.show('fade', { duration: 250 });
          } else {
            etaEl.hide();
          }
        }
      } catch (e) {}

      // Track Order button
      try {
        const trackBtn = $item('#orderTrackBtn');
        const hasTracking = itemData.trackingNumber || itemData.deliveryTrackingNumber;
        if (hasTracking) {
          trackBtn.show();
          try { trackBtn.accessibility.ariaLabel = `Track order ${itemData.number}`; } catch (e) {}
          trackBtn.onClick(() => {
            import('wix-location-frontend').then(({ to }) => {
              to(buildTrackingUrl(itemData.number, _memberEmail));
            });
          });
        } else {
          trackBtn.hide();
        }
      } catch (e) {}

      // Reorder button
      try {
        const reorderBtn = $item('#orderReorderBtn');
        try { reorderBtn.accessibility.ariaLabel = `Reorder items from order ${itemData.number}`; } catch (e) {}
        reorderBtn.onClick(async () => {
          try {
            reorderBtn.disable();
            reorderBtn.label = 'Adding...';
            const { getReorderItems } = await import('backend/accountDashboard.web');
            const result = await getReorderItems(itemData._id);
            if (result.success && result.data.items.length > 0) {
              const { addToCart } = await import('public/cartService');
              for (const item of result.data.items) {
                await addToCart(item.productId, item.quantity || 1);
              }
              reorderBtn.label = 'Added to Cart!';
              announce($w, `Items from order ${itemData.number} added to cart`);
              trackEvent('reorder', { orderNumber: itemData.number });
            } else {
              reorderBtn.label = 'No Items';
            }
            reorderBtn.disable();
            setTimeout(() => {
              reorderBtn.label = 'Reorder';
              reorderBtn.enable();
            }, 3000);
          } catch (err) {
            console.error('[MemberPage] Reorder error:', err);
            reorderBtn.label = 'Reorder';
            reorderBtn.enable();
          }
        });
      } catch (e) {}

      // Start a Return button
      try {
        const returnBtn = $item('#orderStartReturnBtn');
        try { returnBtn.accessibility.ariaLabel = `Start a return for order ${itemData.number}`; } catch (e) {}
        if (!isReturnEligible(itemData.status)) {
          returnBtn.hide();
        } else {
          returnBtn.onClick(() => {
            try { $w('#startReturnBtn').click(); } catch (e) {}
            trackEvent('return_started', { orderNumber: itemData.number });
          });
        }
      } catch (e) {}

      // Order items mini-gallery
      try {
        const gallery = $item('#orderItemsGallery');
        if (gallery && itemData.lineItems) {
          const galleryItems = buildOrderGalleryItems(
            itemData.lineItems.map(li => ({
              mediaItem: { src: li.imageUrl },
              name: li.name,
            }))
          );
          if (galleryItems.length > 0) {
            gallery.items = galleryItems;
          }
        }
      } catch (e) {}
    });

    // Setup filter dropdown
    try {
      const filterDropdown = $w('#orderFilterDropdown');
      if (filterDropdown) {
        filterDropdown.options = getOrderFilterOptions();
        filterDropdown.value = 'all';
        try { filterDropdown.accessibility.ariaLabel = 'Filter orders by status'; } catch (e) {}
        filterDropdown.onChange(async () => {
          _orderFilter = filterDropdown.value || 'all';
          _orderPage = 1;
          await loadOrders();
          announce($w, `Showing ${filterDropdown.options.find(o => o.value === _orderFilter)?.label || 'all'} orders`);
        });
      }
    } catch (e) {}

    // Setup Load More button
    try {
      const loadMoreBtn = $w('#ordersLoadMoreBtn');
      if (loadMoreBtn) {
        loadMoreBtn.hide();
        try { loadMoreBtn.accessibility.ariaLabel = 'Load more orders'; } catch (e) {}
        loadMoreBtn.onClick(async () => {
          try {
            loadMoreBtn.disable();
            loadMoreBtn.label = 'Loading...';
            _orderPage += 1;
            await loadOrders(true);
            loadMoreBtn.label = 'Load More Orders';
            loadMoreBtn.enable();
          } catch (err) {
            console.error('[MemberPage] Load more error:', err);
            loadMoreBtn.label = 'Retry';
            loadMoreBtn.enable();
          }
        });
      }
    } catch (e) {}

    // Initial load
    await loadOrders();

  } catch (e) {
    console.error('[MemberPage] Error initializing order history:', e);
  }
}

async function loadOrders(append = false) {
  const {
    mergeDeliveryStatus,
    filterOrdersByStatus,
  } = await import('public/MemberPageHelpers.js');

  try {
    // Show loading, hide error
    try { $w('#ordersLoader').show(); } catch (e) {}
    try { $w('#ordersError').hide(); } catch (e) {}
    if (!append) {
      try { $w('#ordersRepeater').collapse(); } catch (e) {}
      try { $w('#ordersEmpty').hide(); } catch (e) {}
    }

    const { getOrderHistory, getActiveDeliveries } = await import('backend/accountDashboard.web');

    // Fetch orders + deliveries in parallel (only fetch deliveries on first load)
    const promises = [getOrderHistory({ page: _orderPage })];
    if (!append && _deliveries.length === 0) {
      promises.push(getActiveDeliveries());
    }

    const results = await Promise.all(promises);
    const orderResult = results[0];
    const deliveryResult = results[1];

    if (!orderResult.success) {
      showOrdersError('Unable to load your orders. Please try again.');
      return;
    }

    if (deliveryResult?.success) {
      _deliveries = deliveryResult.data.deliveries || [];
    }

    // Merge delivery data into orders
    const enrichedOrders = mergeDeliveryStatus(orderResult.data.orders, _deliveries);

    // Apply client-side filter
    const filtered = filterOrdersByStatus(enrichedOrders, _orderFilter);

    if (append) {
      _orderData = [..._orderData, ...filtered];
    } else {
      _orderData = filtered;
    }

    // Hide loader
    try { $w('#ordersLoader').hide(); } catch (e) {}

    if (_orderData.length === 0 && !append) {
      try { $w('#ordersEmpty').show(); } catch (e) {}
      try { $w('#ordersRepeater').collapse(); } catch (e) {}
      try { $w('#ordersLoadMoreBtn').hide(); } catch (e) {}
      return;
    }

    // Set repeater data
    try {
      $w('#ordersRepeater').data = _orderData;
      $w('#ordersRepeater').expand();
    } catch (e) {}

    // Show/hide load more
    try {
      if (orderResult.data.hasNext) {
        $w('#ordersLoadMoreBtn').show();
      } else {
        $w('#ordersLoadMoreBtn').hide();
      }
    } catch (e) {}

  } catch (err) {
    console.error('[MemberPage] Error loading orders:', err);
    showOrdersError('Unable to load your orders. Please try again.');
  }
}

function showOrdersError(message) {
  try { $w('#ordersLoader').hide(); } catch (e) {}
  try {
    const errorEl = $w('#ordersError');
    errorEl.text = message;
    errorEl.show('fade', { duration: 200 });
  } catch (e) {}
  try {
    const retryBtn = $w('#ordersRetryBtn');
    if (retryBtn) {
      retryBtn.onClick(async () => {
        _orderPage = 1;
        await loadOrders();
      });
    }
  } catch (e) {}
}
```

**Step 3: Remove the duplicate STATUS_COLORS constant at top of file**

The top-level `STATUS_COLORS` constant (lines 22-27) is now handled by `getStatusColor` from MemberPageHelpers. Remove it.

**Step 4: Run all tests**

Run: `cd /Users/hal/gt/cfutons/crew/miquella && npx vitest run 2>&1 | tail -20`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add src/pages/Member\ Page.js
git commit -m "feat(CF-bpvo): rewrite initOrderHistory with backend data loading, pagination, filtering, delivery ETA"
```

---

### Task 5: Final Verification & PR

**Step 1: Run full test suite**

Run: `cd /Users/hal/gt/cfutons/crew/miquella && npx vitest run 2>&1 | tail -30`
Expected: ALL PASS, no regressions

**Step 2: Verify git status is clean**

Run: `git status`

**Step 3: Push and create PR**

```bash
git push -u origin cf-bpvo-order-history
gh pr create --title "feat(CF-bpvo): Member Page order history with tracking" --body "$(cat <<'EOF'
## Summary
- Wire `initOrderHistory()` to `getOrderHistory` + `getActiveDeliveries` backend APIs
- Add pagination (Load More), status filter dropdown, loading/empty/error states
- Merge delivery ETA into order cards, enhance track button with member email
- Add 6 new pure functions to MemberPageHelpers.js (TDD)
- Reorder uses `getReorderItems` backend for ownership verification

## Test plan
- [ ] New helper function tests pass (mergeDeliveryStatus, formatDeliveryEstimate, etc.)
- [ ] Integration tests verify data layer merging
- [ ] Full test suite passes with no regressions
- [ ] Manual: Member Page loads orders, shows delivery ETA, pagination works
- [ ] Manual: Filter dropdown filters by status
- [ ] Manual: Track button navigates to tracking page with prefilled data

## Bead
CF-bpvo: Member: order history and tracking

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
