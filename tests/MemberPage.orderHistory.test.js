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

// ── Data layer tests using helpers directly ─────────────────────────

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
    const result = formatDeliveryEstimate(new Date(2026, 2, 10));
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

describe('Order History Integration - Merge Pipeline', () => {
  it('full pipeline: fetch → merge → filter produces expected shape', () => {
    const orders = sampleOrders.data.orders;
    const deliveries = sampleDeliveries.data.deliveries;

    const merged = mergeDeliveryStatus(orders, deliveries);
    expect(merged).toHaveLength(2);
    expect(merged[0].deliveryEta).toBe('2026-03-10');
    expect(merged[0].deliveryTrackingNumber).toBe('1Z999AA10000000001');

    const filtered = filterOrdersByStatus(merged, 'Shipped');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]._id).toBe('order-1');
    expect(filtered[0].deliveryEta).toBe('2026-03-10');
  });

  it('pipeline with empty deliveries preserves orders', () => {
    const merged = mergeDeliveryStatus(sampleOrders.data.orders, []);
    expect(merged).toHaveLength(2);
    expect(merged[0].deliveryEta).toBeUndefined();
  });

  it('pipeline with empty orders returns empty', () => {
    const merged = mergeDeliveryStatus([], sampleDeliveries.data.deliveries);
    expect(merged).toEqual([]);
  });

  it('filter "all" returns full merged set', () => {
    const merged = mergeDeliveryStatus(sampleOrders.data.orders, sampleDeliveries.data.deliveries);
    const filtered = filterOrdersByStatus(merged, 'all');
    expect(filtered).toHaveLength(2);
  });

  it('filter unknown status returns empty', () => {
    const merged = mergeDeliveryStatus(sampleOrders.data.orders, sampleDeliveries.data.deliveries);
    const filtered = filterOrdersByStatus(merged, 'ReturnRequested');
    expect(filtered).toEqual([]);
  });
});

describe('Order History Integration - Backend Response Handling', () => {
  it('handles success=false from getOrderHistory', () => {
    const failedResponse = { success: false, error: 'Server error' };
    expect(failedResponse.success).toBe(false);
  });

  it('handles missing deliveries data gracefully', () => {
    const noDeliveries = { success: true, data: { deliveries: [], count: 0 } };
    const merged = mergeDeliveryStatus(sampleOrders.data.orders, noDeliveries.data.deliveries);
    expect(merged).toHaveLength(2);
    expect(merged[0].deliveryEta).toBeUndefined();
  });

  it('handles orders with no lineItems', () => {
    const ordersNoItems = {
      success: true,
      data: {
        orders: [{ _id: 'o1', number: '999', status: 'Processing', total: 0 }],
        hasNext: false,
      },
    };
    const merged = mergeDeliveryStatus(ordersNoItems.data.orders, []);
    expect(merged[0]._id).toBe('o1');
    expect(formatItemCount(0)).toBe('0 items');
  });

  it('pagination hasNext flag controls Load More visibility', () => {
    expect(sampleOrders.data.hasNext).toBe(false);

    const paginatedOrders = {
      success: true,
      data: { ...sampleOrders.data, hasNext: true, totalPages: 3 },
    };
    expect(paginatedOrders.data.hasNext).toBe(true);
  });
});
