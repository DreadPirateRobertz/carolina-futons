/**
 * Tests for Member Page — CF-p75a
 *
 * Covers: dashboard init, order history display, wishlist section,
 * returns section, auth guard (unauthenticated user), empty states.
 * Tests extracted helper logic from MemberPageHelpers.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';

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

// ── Dashboard Init ──────────────────────────────────────────────────

describe('Member Page — Dashboard init', () => {
  describe('getWelcomeMessage', () => {
    it('returns personalized greeting with first name', () => {
      const member = { contactDetails: { firstName: 'Sarah' } };
      expect(getWelcomeMessage(member)).toBe('Welcome back, Sarah!');
    });

    it('falls back to "Member" when firstName is missing', () => {
      const member = { contactDetails: {} };
      expect(getWelcomeMessage(member)).toBe('Welcome back, Member!');
    });

    it('falls back to "Member" when contactDetails is null', () => {
      expect(getWelcomeMessage({ contactDetails: null })).toBe('Welcome back, Member!');
    });

    it('falls back to "Member" when member is null', () => {
      expect(getWelcomeMessage(null)).toBe('Welcome back, Member!');
    });

    it('falls back to "Member" when member is undefined', () => {
      expect(getWelcomeMessage(undefined)).toBe('Welcome back, Member!');
    });
  });

  describe('formatLoyaltyDisplay', () => {
    it('formats points with locale separators', () => {
      const result = formatLoyaltyDisplay({ points: 1500, tier: 'Gold' });
      expect(result.pointsText).toBe('1,500 pts');
      expect(result.tierText).toBe('Gold');
    });

    it('handles zero points', () => {
      const result = formatLoyaltyDisplay({ points: 0, tier: 'Bronze' });
      expect(result.pointsText).toBe('0 pts');
      expect(result.tierText).toBe('Bronze');
    });

    it('handles large point values', () => {
      const result = formatLoyaltyDisplay({ points: 1234567 });
      expect(result.pointsText).toBe('1,234,567 pts');
    });

    it('returns "Join Rewards" when account is null', () => {
      const result = formatLoyaltyDisplay(null);
      expect(result.pointsText).toBe('Join Rewards');
      expect(result.tierText).toBeNull();
    });

    it('returns "Join Rewards" when points is undefined', () => {
      const result = formatLoyaltyDisplay({});
      expect(result.pointsText).toBe('Join Rewards');
    });

    it('returns null tier when tier is not set', () => {
      const result = formatLoyaltyDisplay({ points: 100 });
      expect(result.tierText).toBeNull();
    });
  });

  describe('DASHBOARD_QUICK_LINKS', () => {
    it('contains 3 quick links', () => {
      expect(DASHBOARD_QUICK_LINKS).toHaveLength(3);
    });

    it('each link has id, target, and label', () => {
      for (const link of DASHBOARD_QUICK_LINKS) {
        expect(link.id).toBeTruthy();
        expect(link.target).toBeTruthy();
        expect(link.label).toBeTruthy();
        expect(link.id.startsWith('#')).toBe(true);
        expect(link.target.startsWith('#')).toBe(true);
      }
    });

    it('links target the correct sections', () => {
      const targets = DASHBOARD_QUICK_LINKS.map(l => l.target);
      expect(targets).toContain('#ordersRepeater');
      expect(targets).toContain('#wishlistRepeater');
      expect(targets).toContain('#accountSettings');
    });
  });

  describe('PAGE_SECTIONS', () => {
    it('lists all 7 sections in initialization order', () => {
      expect(PAGE_SECTIONS).toHaveLength(7);
      expect(PAGE_SECTIONS).toContain('dashboard');
      expect(PAGE_SECTIONS).toContain('orderHistory');
      expect(PAGE_SECTIONS).toContain('wishlist');
      expect(PAGE_SECTIONS).toContain('accountSettings');
      expect(PAGE_SECTIONS).toContain('addressBook');
      expect(PAGE_SECTIONS).toContain('communicationPrefs');
      expect(PAGE_SECTIONS).toContain('returns');
    });
  });
});

// ── Order History Display ───────────────────────────────────────────

describe('Member Page — Order history display', () => {
  describe('getStatusColor', () => {
    it('returns mountainBlue for Processing', () => {
      expect(getStatusColor('Processing')).toBe(STATUS_COLORS.Processing);
    });

    it('returns sunsetCoral for Shipped', () => {
      expect(getStatusColor('Shipped')).toBe(STATUS_COLORS.Shipped);
    });

    it('returns success for Delivered', () => {
      expect(getStatusColor('Delivered')).toBe(STATUS_COLORS.Delivered);
    });

    it('returns muted for Cancelled', () => {
      expect(getStatusColor('Cancelled')).toBe(STATUS_COLORS.Cancelled);
    });

    it('returns mountainBlue as fallback for unknown status', () => {
      expect(getStatusColor('Unknown')).toBe(STATUS_COLORS.Processing);
    });

    it('returns mountainBlue for empty string', () => {
      expect(getStatusColor('')).toBe(STATUS_COLORS.Processing);
    });

    it('returns mountainBlue for undefined', () => {
      expect(getStatusColor(undefined)).toBe(STATUS_COLORS.Processing);
    });
  });

  describe('formatOrderDate', () => {
    it('formats a valid ISO date string', () => {
      const result = formatOrderDate('2025-03-15T10:30:00Z');
      expect(result).toContain('March');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('formats a Date object', () => {
      const result = formatOrderDate(new Date('2024-12-25'));
      expect(result).toContain('December');
      expect(result).toContain('2024');
    });

    it('returns empty string for null', () => {
      expect(formatOrderDate(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatOrderDate(undefined)).toBe('');
    });

    it('returns empty string for invalid date string', () => {
      expect(formatOrderDate('not-a-date')).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatOrderDate('')).toBe('');
    });
  });

  describe('formatOrderTotal', () => {
    it('formats a normal total', () => {
      expect(formatOrderTotal({ total: 599.99 })).toBe('$599.99');
    });

    it('formats zero total', () => {
      expect(formatOrderTotal({ total: 0 })).toBe('$0.00');
    });

    it('formats string total by coercing to number', () => {
      expect(formatOrderTotal({ total: '1299.50' })).toBe('$1299.50');
    });

    it('returns $0.00 for null totals', () => {
      expect(formatOrderTotal(null)).toBe('$0.00');
    });

    it('returns $0.00 for undefined totals', () => {
      expect(formatOrderTotal(undefined)).toBe('$0.00');
    });

    it('returns $0.00 for missing total field', () => {
      expect(formatOrderTotal({})).toBe('$0.00');
    });

    it('returns $0.00 for NaN total', () => {
      expect(formatOrderTotal({ total: 'abc' })).toBe('$0.00');
    });

    it('returns $0.00 for negative total', () => {
      expect(formatOrderTotal({ total: -50 })).toBe('$0.00');
    });

    it('returns $0.00 for Infinity', () => {
      expect(formatOrderTotal({ total: Infinity })).toBe('$0.00');
    });
  });

  describe('formatOrderNumber', () => {
    it('formats a numeric order number', () => {
      expect(formatOrderNumber(12345)).toBe('Order #12345');
    });

    it('formats a string order number', () => {
      expect(formatOrderNumber('CF-789')).toBe('Order #CF-789');
    });

    it('returns placeholder for null', () => {
      expect(formatOrderNumber(null)).toBe('Order #—');
    });

    it('returns placeholder for undefined', () => {
      expect(formatOrderNumber(undefined)).toBe('Order #—');
    });

    it('returns placeholder for empty string', () => {
      expect(formatOrderNumber('')).toBe('Order #—');
    });

    it('formats zero as a valid order number', () => {
      expect(formatOrderNumber(0)).toBe('Order #0');
    });
  });

  describe('hasTrackingInfo', () => {
    it('returns true when tracking number exists', () => {
      expect(hasTrackingInfo({ shippingInfo: { trackingNumber: '1Z999AA1' } })).toBe(true);
    });

    it('returns false when no tracking number', () => {
      expect(hasTrackingInfo({ shippingInfo: {} })).toBe(false);
    });

    it('returns false when no shippingInfo', () => {
      expect(hasTrackingInfo({})).toBe(false);
    });

    it('returns false for null order', () => {
      expect(hasTrackingInfo(null)).toBe(false);
    });

    it('returns false for undefined order', () => {
      expect(hasTrackingInfo(undefined)).toBe(false);
    });

    it('returns false when tracking number is empty string', () => {
      expect(hasTrackingInfo({ shippingInfo: { trackingNumber: '' } })).toBe(false);
    });
  });

  // isReturnEligible only hides the button for Cancelled orders.
  // Actual return eligibility (window, final-sale) is enforced by ReturnsPortal.js.
  describe('isReturnEligible', () => {
    it('returns true for Processing orders (button visible, portal enforces window)', () => {
      expect(isReturnEligible('Processing')).toBe(true);
    });

    it('returns true for Shipped orders', () => {
      expect(isReturnEligible('Shipped')).toBe(true);
    });

    it('returns true for Delivered orders', () => {
      expect(isReturnEligible('Delivered')).toBe(true);
    });

    it('returns false for Cancelled orders', () => {
      expect(isReturnEligible('Cancelled')).toBe(false);
    });

    it('returns true for unknown status', () => {
      expect(isReturnEligible('SomeOtherStatus')).toBe(true);
    });
  });

  describe('buildOrderGalleryItems', () => {
    it('builds gallery items from line items with media', () => {
      const lineItems = [
        { name: 'Futon Frame', mediaItem: { src: 'https://img/frame.jpg' } },
        { name: 'Mattress', mediaItem: { src: 'https://img/mattress.jpg' } },
      ];
      const result = buildOrderGalleryItems(lineItems);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        src: 'https://img/frame.jpg',
        alt: 'Ordered item: Futon Frame',
        title: 'Futon Frame',
      });
    });

    it('filters out items without media', () => {
      const lineItems = [
        { name: 'Frame', mediaItem: { src: 'https://img/frame.jpg' } },
        { name: 'Service', mediaItem: null },
        { name: 'Fee' },
      ];
      const result = buildOrderGalleryItems(lineItems);
      expect(result).toHaveLength(1);
    });

    it('uses fallback alt text when name is missing', () => {
      const lineItems = [
        { mediaItem: { src: 'https://img/x.jpg' } },
      ];
      const result = buildOrderGalleryItems(lineItems);
      expect(result[0].alt).toBe('Ordered item');
      expect(result[0].title).toBeUndefined();
    });

    it('returns empty array for null input', () => {
      expect(buildOrderGalleryItems(null)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(buildOrderGalleryItems(undefined)).toEqual([]);
    });

    it('returns empty array when no items have media', () => {
      const lineItems = [
        { name: 'A' },
        { name: 'B', mediaItem: {} },
        { name: 'C', mediaItem: { src: '' } },
      ];
      expect(buildOrderGalleryItems(lineItems)).toEqual([]);
    });

    it('handles items with null in array', () => {
      const lineItems = [
        null,
        { name: 'Frame', mediaItem: { src: 'https://img/frame.jpg' } },
      ];
      const result = buildOrderGalleryItems(lineItems);
      expect(result).toHaveLength(1);
    });
  });
});

// ── Wishlist Section ────────────────────────────────────────────────

describe('Member Page — Wishlist section', () => {
  const wishlistItems = [
    { _id: 'w1', name: 'Alpha Futon', price: 300, _createdDate: '2025-01-01' },
    { _id: 'w2', name: 'Charlie Sofa', price: 500, _createdDate: '2025-02-15' },
    { _id: 'w3', name: 'Beta Chair', price: 200, _createdDate: '2025-01-20' },
  ];

  describe('sortWishlist', () => {
    it('sorts by date descending (newest first)', () => {
      const result = sortWishlist(wishlistItems, 'date-desc');
      expect(result[0].name).toBe('Charlie Sofa');
      expect(result[2].name).toBe('Alpha Futon');
    });

    it('sorts by date ascending (oldest first)', () => {
      const result = sortWishlist(wishlistItems, 'date-asc');
      expect(result[0].name).toBe('Alpha Futon');
      expect(result[2].name).toBe('Charlie Sofa');
    });

    it('sorts by price ascending', () => {
      const result = sortWishlist(wishlistItems, 'price-asc');
      expect(result[0].price).toBe(200);
      expect(result[1].price).toBe(300);
      expect(result[2].price).toBe(500);
    });

    it('sorts by price descending', () => {
      const result = sortWishlist(wishlistItems, 'price-desc');
      expect(result[0].price).toBe(500);
      expect(result[2].price).toBe(200);
    });

    it('sorts by name A-Z', () => {
      const result = sortWishlist(wishlistItems, 'name-asc');
      expect(result[0].name).toBe('Alpha Futon');
      expect(result[1].name).toBe('Beta Chair');
      expect(result[2].name).toBe('Charlie Sofa');
    });

    it('does not mutate the original array', () => {
      const original = [...wishlistItems];
      sortWishlist(wishlistItems, 'price-asc');
      expect(wishlistItems).toEqual(original);
    });

    it('handles unknown sort order by returning unsorted copy', () => {
      const result = sortWishlist(wishlistItems, 'invalid-sort');
      expect(result).toHaveLength(3);
      expect(result).not.toBe(wishlistItems);
    });

    it('returns empty array for null input', () => {
      expect(sortWishlist(null, 'date-desc')).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(sortWishlist(undefined, 'price-asc')).toEqual([]);
    });

    it('handles items with missing price (treats as 0)', () => {
      const items = [
        { _id: '1', name: 'A', price: 100, _createdDate: '2025-01-01' },
        { _id: '2', name: 'B', _createdDate: '2025-01-02' },
      ];
      const result = sortWishlist(items, 'price-asc');
      expect(result[0].name).toBe('B');
      expect(result[1].name).toBe('A');
    });

    it('handles items with missing name (treats as empty string)', () => {
      const items = [
        { _id: '1', name: 'Zebra', price: 100, _createdDate: '2025-01-01' },
        { _id: '2', price: 200, _createdDate: '2025-01-02' },
      ];
      const result = sortWishlist(items, 'name-asc');
      expect(result[0]._id).toBe('2');
      expect(result[1]._id).toBe('1');
    });

    it('handles empty array', () => {
      expect(sortWishlist([], 'date-desc')).toEqual([]);
    });

    it('handles single-item array', () => {
      const result = sortWishlist([wishlistItems[0]], 'price-asc');
      expect(result).toHaveLength(1);
    });
  });

  describe('WISHLIST_SORT_OPTIONS', () => {
    it('has 5 sort options', () => {
      expect(WISHLIST_SORT_OPTIONS).toHaveLength(5);
    });

    it('each option has label and value', () => {
      for (const opt of WISHLIST_SORT_OPTIONS) {
        expect(typeof opt.label).toBe('string');
        expect(typeof opt.value).toBe('string');
        expect(opt.label.length).toBeGreaterThan(0);
        expect(opt.value.length).toBeGreaterThan(0);
      }
    });

    it('default sort order is date-desc', () => {
      expect(WISHLIST_SORT_OPTIONS[0].value).toBe('date-desc');
    });
  });

  describe('getWishlistStockStatus', () => {
    it('returns "In Stock" for in-stock items', () => {
      const result = getWishlistStockStatus({ inStock: true });
      expect(result.text).toBe('In Stock');
    });

    it('returns "Special Order" for out-of-stock items', () => {
      const result = getWishlistStockStatus({ inStock: false });
      expect(result.text).toBe('Special Order');
    });

    it('defaults to "In Stock" when inStock is undefined', () => {
      const result = getWishlistStockStatus({});
      expect(result.text).toBe('In Stock');
    });

    it('returns "Special Order" for null item', () => {
      const result = getWishlistStockStatus(null);
      expect(result.text).toBe('Special Order');
    });

    it('uses correct colors', () => {
      const inStock = getWishlistStockStatus({ inStock: true });
      const special = getWishlistStockStatus({ inStock: false });
      expect(inStock.color).toBeTruthy();
      expect(special.color).toBeTruthy();
      expect(inStock.color).not.toBe(special.color);
    });
  });

  describe('getWishlistSaleInfo', () => {
    it('detects sale when comparePrice > price', () => {
      const result = getWishlistSaleInfo({ price: 400, comparePrice: 599 });
      expect(result.onSale).toBe(true);
      expect(result.salePriceText).toBe('Was $599.00');
    });

    it('no sale when comparePrice equals price', () => {
      const result = getWishlistSaleInfo({ price: 400, comparePrice: 400 });
      expect(result.onSale).toBe(false);
      expect(result.salePriceText).toBe('');
    });

    it('no sale when comparePrice is less than price', () => {
      const result = getWishlistSaleInfo({ price: 400, comparePrice: 300 });
      expect(result.onSale).toBe(false);
    });

    it('no sale when comparePrice is missing', () => {
      const result = getWishlistSaleInfo({ price: 400 });
      expect(result.onSale).toBe(false);
    });

    it('no sale when comparePrice is null', () => {
      const result = getWishlistSaleInfo({ price: 400, comparePrice: null });
      expect(result.onSale).toBe(false);
    });

    it('no sale when comparePrice is zero', () => {
      const result = getWishlistSaleInfo({ price: 400, comparePrice: 0 });
      expect(result.onSale).toBe(false);
    });

    it('handles null item', () => {
      const result = getWishlistSaleInfo(null);
      expect(result.onSale).toBe(false);
      expect(result.salePriceText).toBe('');
    });

    it('handles item with missing price (treats as 0)', () => {
      const result = getWishlistSaleInfo({ comparePrice: 100 });
      expect(result.onSale).toBe(true);
      expect(result.salePriceText).toBe('Was $100.00');
    });
  });

  describe('buildWishlistShareUrl', () => {
    it('builds correct share URL', () => {
      const url = buildWishlistShareUrl('https://www.carolinafutons.com', 'mem-123');
      expect(url).toBe('https://www.carolinafutons.com/wishlist?member=mem-123');
    });

    it('handles empty baseUrl', () => {
      const url = buildWishlistShareUrl('', 'mem-123');
      expect(url).toBe('/wishlist?member=mem-123');
    });

    it('handles empty memberId', () => {
      const url = buildWishlistShareUrl('https://www.carolinafutons.com', '');
      expect(url).toBe('https://www.carolinafutons.com/wishlist?member=');
    });

    it('handles undefined parameters', () => {
      const url = buildWishlistShareUrl(undefined, undefined);
      expect(url).toContain('/wishlist?member=');
    });
  });
});

// ── Auth Guard (unauthenticated user) ───────────────────────────────

describe('Member Page — Auth guard', () => {
  it('getWelcomeMessage handles null member (pre-auth state)', () => {
    expect(getWelcomeMessage(null)).toBe('Welcome back, Member!');
  });

  it('formatLoyaltyDisplay handles null account (pre-auth)', () => {
    const result = formatLoyaltyDisplay(null);
    expect(result.pointsText).toBe('Join Rewards');
    expect(result.tierText).toBeNull();
  });

  it('buildWishlistShareUrl handles missing memberId', () => {
    const url = buildWishlistShareUrl('https://www.carolinafutons.com', '');
    expect(url).toContain('member=');
    expect(url).not.toContain('undefined');
  });

  it('sortWishlist handles empty array (no data before auth)', () => {
    expect(sortWishlist([], 'date-desc')).toEqual([]);
  });

  it('buildOrderGalleryItems handles empty array (no orders)', () => {
    expect(buildOrderGalleryItems([])).toEqual([]);
  });

  it('formatAddress handles missing data', () => {
    expect(formatAddress(null)).toBe('No address saved');
  });

  it('normalizeAddresses handles empty array', () => {
    expect(normalizeAddresses([])).toEqual([]);
  });
});

// ── Empty States ────────────────────────────────────────────────────

describe('Member Page — Empty states', () => {
  it('sortWishlist returns empty for empty wishlist', () => {
    expect(sortWishlist([], 'date-desc')).toEqual([]);
  });

  it('buildOrderGalleryItems returns empty for order with no line items', () => {
    expect(buildOrderGalleryItems([])).toEqual([]);
  });

  it('buildOrderGalleryItems returns empty for items without media', () => {
    const lineItems = [{ name: 'Service Fee' }, { name: 'Delivery' }];
    expect(buildOrderGalleryItems(lineItems)).toEqual([]);
  });

  it('normalizeAddresses returns empty for no addresses', () => {
    expect(normalizeAddresses([])).toEqual([]);
  });

  it('normalizeAddresses returns empty for null', () => {
    expect(normalizeAddresses(null)).toEqual([]);
  });

  it('formatOrderTotal shows $0.00 for empty order', () => {
    expect(formatOrderTotal({})).toBe('$0.00');
  });

  it('formatOrderDate returns empty for missing date', () => {
    expect(formatOrderDate(null)).toBe('');
  });

  it('formatOrderNumber returns placeholder for missing number', () => {
    expect(formatOrderNumber(null)).toBe('Order #—');
  });

  it('getWishlistStockStatus handles null item', () => {
    const result = getWishlistStockStatus(null);
    expect(result.text).toBe('Special Order');
  });

  it('getWishlistSaleInfo handles null item', () => {
    const result = getWishlistSaleInfo(null);
    expect(result.onSale).toBe(false);
  });
});

// ── Returns Section ─────────────────────────────────────────────────

describe('Member Page — Returns section', () => {
  it('PAGE_SECTIONS includes returns', () => {
    expect(PAGE_SECTIONS).toContain('returns');
  });

  it('isReturnEligible allows return for Delivered', () => {
    expect(isReturnEligible('Delivered')).toBe(true);
  });

  it('isReturnEligible blocks return for Cancelled', () => {
    expect(isReturnEligible('Cancelled')).toBe(false);
  });

  it('isReturnEligible allows return for Processing', () => {
    expect(isReturnEligible('Processing')).toBe(true);
  });

  it('isReturnEligible allows return for Shipped', () => {
    expect(isReturnEligible('Shipped')).toBe(true);
  });
});

// ── Address Book ────────────────────────────────────────────────────

describe('Member Page — Address book', () => {
  describe('formatAddress', () => {
    it('formats full address', () => {
      const addr = { street: '123 Main St', city: 'Hendersonville', state: 'NC', zip: '28792' };
      const result = formatAddress(addr);
      expect(result).toContain('123 Main St');
      expect(result).toContain('Hendersonville, NC 28792');
    });

    it('formats address without zip', () => {
      const addr = { street: '123 Main St', city: 'Hendersonville', state: 'NC' };
      const result = formatAddress(addr);
      expect(result).toContain('Hendersonville, NC');
    });

    it('formats address with only street', () => {
      const addr = { street: '123 Main St' };
      expect(formatAddress(addr)).toBe('123 Main St');
    });

    it('returns fallback for empty address', () => {
      expect(formatAddress({})).toBe('No address saved');
    });

    it('returns fallback for null', () => {
      expect(formatAddress(null)).toBe('No address saved');
    });

    it('returns fallback for undefined', () => {
      expect(formatAddress(undefined)).toBe('No address saved');
    });

    it('handles city without state', () => {
      const addr = { city: 'Hendersonville' };
      expect(formatAddress(addr)).toBe('No address saved');
    });

    it('handles state without city', () => {
      const addr = { state: 'NC' };
      expect(formatAddress(addr)).toBe('No address saved');
    });
  });

  describe('normalizeAddresses', () => {
    it('preserves existing _id', () => {
      const addresses = [{ _id: 'addr-1', street: '123 Main' }];
      const result = normalizeAddresses(addresses);
      expect(result[0]._id).toBe('addr-1');
    });

    it('assigns index-based _id when missing', () => {
      const addresses = [{ street: '123 Main' }, { street: '456 Oak' }];
      const result = normalizeAddresses(addresses);
      expect(result[0]._id).toBe('0');
      expect(result[1]._id).toBe('1');
    });

    it('returns empty for null input', () => {
      expect(normalizeAddresses(null)).toEqual([]);
    });

    it('returns empty for undefined input', () => {
      expect(normalizeAddresses(undefined)).toEqual([]);
    });

    it('spreads address fields after _id', () => {
      const addresses = [{ street: '123 Main', city: 'Asheville' }];
      const result = normalizeAddresses(addresses);
      expect(result[0].street).toBe('123 Main');
      expect(result[0].city).toBe('Asheville');
    });
  });
});

// ── Communication Preferences ───────────────────────────────────────

describe('Member Page — Communication preferences', () => {
  it('COMM_PREF_TOGGLES has 3 toggles', () => {
    expect(COMM_PREF_TOGGLES).toHaveLength(3);
  });

  it('each toggle has id, key, and label', () => {
    for (const toggle of COMM_PREF_TOGGLES) {
      expect(toggle.id).toBeTruthy();
      expect(toggle.key).toBeTruthy();
      expect(toggle.label).toBeTruthy();
      expect(toggle.id.startsWith('#')).toBe(true);
    }
  });

  it('toggle keys match DEFAULT_COMM_PREFS keys', () => {
    const toggleKeys = COMM_PREF_TOGGLES.map(t => t.key);
    const defaultKeys = Object.keys(DEFAULT_COMM_PREFS);
    expect(toggleKeys.sort()).toEqual(defaultKeys.sort());
  });

  it('DEFAULT_COMM_PREFS defaults all to true', () => {
    for (const value of Object.values(DEFAULT_COMM_PREFS)) {
      expect(value).toBe(true);
    }
  });
});

// ── STATUS_COLORS data integrity ────────────────────────────────────

describe('Member Page — STATUS_COLORS', () => {
  it('has exactly 4 statuses', () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(4);
  });

  it('all values are non-empty strings', () => {
    for (const color of Object.values(STATUS_COLORS)) {
      expect(typeof color).toBe('string');
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it('covers Processing, Shipped, Delivered, Cancelled', () => {
    expect(STATUS_COLORS).toHaveProperty('Processing');
    expect(STATUS_COLORS).toHaveProperty('Shipped');
    expect(STATUS_COLORS).toHaveProperty('Delivered');
    expect(STATUS_COLORS).toHaveProperty('Cancelled');
  });
});
