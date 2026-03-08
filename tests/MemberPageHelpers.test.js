/**
 * Tests for MemberPageHelpers.js — Customer account dashboard logic
 */
import { describe, it, expect } from 'vitest';
import {
  STATUS_COLORS,
  getStatusColor,
  formatOrderDate,
  formatOrderTotal,
  formatOrderNumber,
  hasTrackingInfo,
  isReturnEligible,
  buildOrderGalleryItems,
  sortWishlist,
  WISHLIST_SORT_OPTIONS,
  getWishlistStockStatus,
  getWishlistSaleInfo,
  buildWishlistShareUrl,
  getWelcomeMessage,
  formatLoyaltyDisplay,
  DASHBOARD_QUICK_LINKS,
  formatAddress,
  normalizeAddresses,
  COMM_PREF_TOGGLES,
  DEFAULT_COMM_PREFS,
  PAGE_SECTIONS,
  mergeDeliveryStatus,
  formatDeliveryEstimate,
  formatItemCount,
  getOrderFilterOptions,
  filterOrdersByStatus,
  buildTrackingUrl,
  ORDER_FILTER_OPTIONS,
  ALERT_TYPE_LABELS,
  formatAlertForDisplay,
} from '../src/public/MemberPageHelpers.js';

// ── ALERT_TYPE_LABELS ─────────────────────────────────────────────────

describe('ALERT_TYPE_LABELS', () => {
  it('has labels for price_drop, back_in_stock, low_stock', () => {
    expect(ALERT_TYPE_LABELS).toHaveProperty('price_drop');
    expect(ALERT_TYPE_LABELS).toHaveProperty('back_in_stock');
    expect(ALERT_TYPE_LABELS).toHaveProperty('low_stock');
  });

  it('returns human-readable strings', () => {
    expect(ALERT_TYPE_LABELS.price_drop).toBe('Price Drop');
    expect(ALERT_TYPE_LABELS.back_in_stock).toBe('Back in Stock');
    expect(ALERT_TYPE_LABELS.low_stock).toBe('Low Stock');
  });
});

// ── formatAlertForDisplay ─────────────────────────────────────────────

describe('formatAlertForDisplay', () => {
  it('returns default for null', () => {
    const result = formatAlertForDisplay(null);
    expect(result.typeLabel).toBe('Alert');
    expect(result.productName).toBe('');
    expect(result.message).toBe('');
    expect(result.date).toBe('');
  });

  it('returns default for undefined', () => {
    const result = formatAlertForDisplay(undefined);
    expect(result.typeLabel).toBe('Alert');
  });

  it('formats price_drop alert with price and percent', () => {
    const alert = {
      alertType: 'price_drop',
      productName: 'Futon Frame',
      price: 299.99,
      dropPercent: 15,
      sentAt: '2026-03-15T12:00:00',
    };
    const result = formatAlertForDisplay(alert);
    expect(result.typeLabel).toBe('Price Drop');
    expect(result.productName).toBe('Futon Frame');
    expect(result.message).toContain('15%');
    expect(result.message).toContain('$299.99');
    expect(result.date).toContain('March');
    expect(result.date).toContain('2026');
  });

  it('formats price_drop with missing price/percent', () => {
    const alert = { alertType: 'price_drop' };
    const result = formatAlertForDisplay(alert);
    expect(result.message).toBe('Price dropped');
  });

  it('formats back_in_stock alert', () => {
    const alert = { alertType: 'back_in_stock', productName: 'Mattress' };
    const result = formatAlertForDisplay(alert);
    expect(result.typeLabel).toBe('Back in Stock');
    expect(result.message).toBe('Now back in stock');
  });

  it('formats low_stock alert with quantity', () => {
    const alert = { alertType: 'low_stock', quantityInStock: 3 };
    const result = formatAlertForDisplay(alert);
    expect(result.typeLabel).toBe('Low Stock');
    expect(result.message).toContain('3');
  });

  it('formats low_stock alert without quantity', () => {
    const alert = { alertType: 'low_stock' };
    const result = formatAlertForDisplay(alert);
    expect(result.message).toContain('few');
  });

  it('uses "Alert" for unknown alertType', () => {
    const alert = { alertType: 'unknown_type' };
    const result = formatAlertForDisplay(alert);
    expect(result.typeLabel).toBe('Alert');
  });

  it('handles missing sentAt gracefully', () => {
    const alert = { alertType: 'back_in_stock' };
    expect(formatAlertForDisplay(alert).date).toBe('');
  });

  it('handles invalid sentAt date', () => {
    const alert = { alertType: 'back_in_stock', sentAt: 'not-a-date' };
    expect(formatAlertForDisplay(alert).date).toBe('');
  });

  it('handles missing productName', () => {
    const alert = { alertType: 'price_drop' };
    expect(formatAlertForDisplay(alert).productName).toBe('');
  });
});

// ── getStatusColor ────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns color for known statuses', () => {
    expect(getStatusColor('Processing')).toBeTruthy();
    expect(getStatusColor('Shipped')).toBeTruthy();
    expect(getStatusColor('Delivered')).toBeTruthy();
    expect(getStatusColor('Cancelled')).toBeTruthy();
  });

  it('returns default color for unknown status', () => {
    expect(getStatusColor('UnknownStatus')).toBeTruthy();
  });
});

// ── formatOrderDate ───────────────────────────────────────────────────

describe('formatOrderDate', () => {
  it('formats Date object', () => {
    const result = formatOrderDate(new Date('2026-02-20T12:00:00'));
    expect(result).toContain('2026');
  });

  it('formats date string', () => {
    const result = formatOrderDate('2026-02-20');
    expect(result).toBeTruthy();
  });

  it('returns empty string for null/undefined', () => {
    expect(formatOrderDate(null)).toBe('');
    expect(formatOrderDate(undefined)).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatOrderDate('not-a-date')).toBe('');
  });
});

// ── formatOrderTotal ──────────────────────────────────────────────────

describe('formatOrderTotal', () => {
  it('formats total from totals object', () => {
    expect(formatOrderTotal({ total: 150 })).toBe('$150.00');
  });

  it('returns $0.00 for null', () => {
    expect(formatOrderTotal(null)).toBe('$0.00');
  });

  it('returns $0.00 for missing total', () => {
    expect(formatOrderTotal({})).toBe('$0.00');
  });

  it('returns $0.00 for negative total', () => {
    expect(formatOrderTotal({ total: -50 })).toBe('$0.00');
  });

  it('returns $0.00 for NaN total', () => {
    expect(formatOrderTotal({ total: 'abc' })).toBe('$0.00');
  });
});

// ── formatOrderNumber ─────────────────────────────────────────────────

describe('formatOrderNumber', () => {
  it('formats order number', () => {
    expect(formatOrderNumber(12345)).toBe('Order #12345');
    expect(formatOrderNumber('CF-001')).toBe('Order #CF-001');
  });

  it('returns placeholder for null/undefined/empty', () => {
    expect(formatOrderNumber(null)).toContain('#');
    expect(formatOrderNumber(undefined)).toContain('#');
    expect(formatOrderNumber('')).toContain('#');
  });
});

// ── hasTrackingInfo ───────────────────────────────────────────────────

describe('hasTrackingInfo', () => {
  it('returns true when tracking number exists', () => {
    expect(hasTrackingInfo({ shippingInfo: { trackingNumber: '1Z999' } })).toBe(true);
  });

  it('returns false when no tracking number', () => {
    expect(hasTrackingInfo({ shippingInfo: {} })).toBe(false);
    expect(hasTrackingInfo({})).toBe(false);
  });

  it('returns false for null/undefined order', () => {
    expect(hasTrackingInfo(null)).toBe(false);
    expect(hasTrackingInfo(undefined)).toBe(false);
  });
});

// ── isReturnEligible ──────────────────────────────────────────────────

describe('isReturnEligible', () => {
  it('returns false for Cancelled', () => {
    expect(isReturnEligible('Cancelled')).toBe(false);
  });

  it('returns true for Processing, Shipped, Delivered', () => {
    expect(isReturnEligible('Processing')).toBe(true);
    expect(isReturnEligible('Shipped')).toBe(true);
    expect(isReturnEligible('Delivered')).toBe(true);
  });
});

// ── buildOrderGalleryItems ────────────────────────────────────────────

describe('buildOrderGalleryItems', () => {
  it('builds gallery items from line items', () => {
    const lineItems = [
      { name: 'Futon Frame', mediaItem: { src: 'img.jpg' } },
      { name: 'Mattress', mediaItem: { src: 'img2.jpg' } },
    ];
    const items = buildOrderGalleryItems(lineItems);
    expect(items).toHaveLength(2);
    expect(items[0].src).toBe('img.jpg');
    expect(items[0].alt).toContain('Futon Frame');
  });

  it('filters out items without media', () => {
    const lineItems = [
      { name: 'A', mediaItem: { src: 'a.jpg' } },
      { name: 'B' },
      { name: 'C', mediaItem: {} },
    ];
    expect(buildOrderGalleryItems(lineItems)).toHaveLength(1);
  });

  it('returns empty for non-array', () => {
    expect(buildOrderGalleryItems(null)).toEqual([]);
    expect(buildOrderGalleryItems('string')).toEqual([]);
  });

  it('provides default alt text when name missing', () => {
    const items = buildOrderGalleryItems([{ mediaItem: { src: 'x.jpg' } }]);
    expect(items[0].alt).toBe('Ordered item');
  });
});

// ── sortWishlist ──────────────────────────────────────────────────────

describe('sortWishlist', () => {
  const items = [
    { name: 'Beta', price: 200, _createdDate: '2026-02-01' },
    { name: 'Alpha', price: 100, _createdDate: '2026-03-01' },
    { name: 'Charlie', price: 300, _createdDate: '2026-01-01' },
  ];

  it('sorts by date descending (newest first)', () => {
    const sorted = sortWishlist(items, 'date-desc');
    expect(sorted[0].name).toBe('Alpha');
  });

  it('sorts by date ascending (oldest first)', () => {
    const sorted = sortWishlist(items, 'date-asc');
    expect(sorted[0].name).toBe('Charlie');
  });

  it('sorts by price ascending', () => {
    const sorted = sortWishlist(items, 'price-asc');
    expect(sorted[0].price).toBe(100);
  });

  it('sorts by price descending', () => {
    const sorted = sortWishlist(items, 'price-desc');
    expect(sorted[0].price).toBe(300);
  });

  it('sorts by name ascending', () => {
    const sorted = sortWishlist(items, 'name-asc');
    expect(sorted[0].name).toBe('Alpha');
  });

  it('returns copy for unknown sort order', () => {
    const sorted = sortWishlist(items, 'unknown');
    expect(sorted).toHaveLength(3);
    expect(sorted).not.toBe(items);
  });

  it('returns empty for non-array', () => {
    expect(sortWishlist(null, 'date-desc')).toEqual([]);
  });

  it('handles items with missing price', () => {
    const withMissing = [{ name: 'A', price: null }, { name: 'B', price: 50 }];
    const sorted = sortWishlist(withMissing, 'price-asc');
    expect(sorted[0].price).toBe(0 || null); // null coerced to 0
  });
});

// ── getWishlistStockStatus ────────────────────────────────────────────

describe('getWishlistStockStatus', () => {
  it('returns In Stock for in-stock item', () => {
    const result = getWishlistStockStatus({ inStock: true });
    expect(result.text).toBe('In Stock');
  });

  it('returns Special Order for out-of-stock', () => {
    const result = getWishlistStockStatus({ inStock: false });
    expect(result.text).toBe('Special Order');
  });

  it('returns Special Order for null item', () => {
    expect(getWishlistStockStatus(null).text).toBe('Special Order');
  });
});

// ── getWishlistSaleInfo ───────────────────────────────────────────────

describe('getWishlistSaleInfo', () => {
  it('detects sale when comparePrice > price', () => {
    const result = getWishlistSaleInfo({ price: 100, comparePrice: 150 });
    expect(result.onSale).toBe(true);
    expect(result.salePriceText).toContain('150');
  });

  it('returns not on sale when no compare price', () => {
    expect(getWishlistSaleInfo({ price: 100 }).onSale).toBe(false);
  });

  it('returns not on sale when compare <= price', () => {
    expect(getWishlistSaleInfo({ price: 100, comparePrice: 100 }).onSale).toBe(false);
  });

  it('handles null item', () => {
    expect(getWishlistSaleInfo(null).onSale).toBe(false);
  });
});

// ── buildWishlistShareUrl ─────────────────────────────────────────────

describe('buildWishlistShareUrl', () => {
  it('builds share URL with member ID', () => {
    const url = buildWishlistShareUrl('https://carolinafutons.com', 'member123');
    expect(url).toBe('https://carolinafutons.com/wishlist?member=member123');
  });

  it('handles empty baseUrl', () => {
    const url = buildWishlistShareUrl('', 'member123');
    expect(url).toBe('/wishlist?member=member123');
  });

  it('handles null values', () => {
    const url = buildWishlistShareUrl(null, null);
    expect(url).toContain('/wishlist?member=');
  });
});

// ── getWelcomeMessage ─────────────────────────────────────────────────

describe('getWelcomeMessage', () => {
  it('uses first name', () => {
    const member = { contactDetails: { firstName: 'Jane' } };
    expect(getWelcomeMessage(member)).toBe('Welcome back, Jane!');
  });

  it('falls back to "Member" for null', () => {
    expect(getWelcomeMessage(null)).toBe('Welcome back, Member!');
  });

  it('falls back when no firstName', () => {
    expect(getWelcomeMessage({ contactDetails: {} })).toBe('Welcome back, Member!');
  });
});

// ── formatLoyaltyDisplay ──────────────────────────────────────────────

describe('formatLoyaltyDisplay', () => {
  it('formats points and tier', () => {
    const result = formatLoyaltyDisplay({ points: 1500, tier: 'Gold' });
    expect(result.pointsText).toBe('1,500 pts');
    expect(result.tierText).toBe('Gold');
  });

  it('returns join message for null account', () => {
    expect(formatLoyaltyDisplay(null).pointsText).toBe('Join Rewards');
  });

  it('returns join message when points missing', () => {
    expect(formatLoyaltyDisplay({}).pointsText).toBe('Join Rewards');
  });

  it('handles zero points', () => {
    const result = formatLoyaltyDisplay({ points: 0 });
    expect(result.pointsText).toBe('0 pts');
  });
});

// ── formatAddress ─────────────────────────────────────────────────────

describe('formatAddress', () => {
  it('formats full address', () => {
    const addr = { street: '123 Main St', city: 'Hendersonville', state: 'NC', zip: '28792' };
    const result = formatAddress(addr);
    expect(result).toContain('123 Main St');
    expect(result).toContain('Hendersonville, NC 28792');
  });

  it('returns fallback for null', () => {
    expect(formatAddress(null)).toBe('No address saved');
  });

  it('handles missing fields', () => {
    expect(formatAddress({})).toBe('No address saved');
  });
});

// ── normalizeAddresses ────────────────────────────────────────────────

describe('normalizeAddresses', () => {
  it('adds _id if missing', () => {
    const addresses = [{ street: 'A' }, { street: 'B' }];
    const result = normalizeAddresses(addresses);
    expect(result[0]._id).toBe('0');
    expect(result[1]._id).toBe('1');
  });

  it('preserves existing _id', () => {
    const result = normalizeAddresses([{ _id: 'custom', street: 'A' }]);
    expect(result[0]._id).toBe('custom');
  });

  it('returns empty for non-array', () => {
    expect(normalizeAddresses(null)).toEqual([]);
  });
});

// ── Constants ─────────────────────────────────────────────────────────

describe('constants', () => {
  it('WISHLIST_SORT_OPTIONS has entries with label and value', () => {
    expect(WISHLIST_SORT_OPTIONS.length).toBeGreaterThan(0);
    WISHLIST_SORT_OPTIONS.forEach(o => {
      expect(o).toHaveProperty('label');
      expect(o).toHaveProperty('value');
    });
  });

  it('DASHBOARD_QUICK_LINKS has entries', () => {
    expect(DASHBOARD_QUICK_LINKS.length).toBeGreaterThan(0);
  });

  it('COMM_PREF_TOGGLES has entries', () => {
    expect(COMM_PREF_TOGGLES.length).toBeGreaterThan(0);
  });

  it('DEFAULT_COMM_PREFS has expected keys', () => {
    expect(DEFAULT_COMM_PREFS).toHaveProperty('newsletter');
    expect(DEFAULT_COMM_PREFS).toHaveProperty('saleAlerts');
    expect(DEFAULT_COMM_PREFS).toHaveProperty('backInStock');
  });

  it('PAGE_SECTIONS is non-empty array', () => {
    expect(PAGE_SECTIONS.length).toBeGreaterThan(0);
  });

  it('STATUS_COLORS has expected statuses', () => {
    expect(STATUS_COLORS).toHaveProperty('Processing');
    expect(STATUS_COLORS).toHaveProperty('Shipped');
    expect(STATUS_COLORS).toHaveProperty('Delivered');
    expect(STATUS_COLORS).toHaveProperty('Cancelled');
  });
});

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
    const result = formatDeliveryEstimate(new Date(2026, 2, 15));
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
    // Use a Date object with explicit time to avoid timezone shifting
    const result = formatDeliveryEstimate(new Date(2026, 2, 15)); // March 15, 2026 (Sunday)
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

  it('encodes special characters in order number', () => {
    const url = buildTrackingUrl('CF-001&evil=1', 'test@example.com');
    expect(url).toBe('/tracking?order=CF-001%26evil%3D1&email=test%40example.com');
  });
});
