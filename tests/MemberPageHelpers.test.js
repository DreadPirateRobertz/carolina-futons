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
} from '../src/public/MemberPageHelpers.js';

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
