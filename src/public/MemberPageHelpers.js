// MemberPageHelpers.js — Testable logic extracted from Member Page.js
// Pure functions and data structures for the customer account dashboard.

import { colors } from 'public/designTokens.js';

// ── Status Badge Colors ─────────────────────────────────────────────

/** Order fulfillment status → color mapping */
export const STATUS_COLORS = {
  Processing: colors.mountainBlue,
  Shipped: colors.sunsetCoral,
  Delivered: colors.success,
  Cancelled: colors.muted,
};

/**
 * Get the display color for an order status badge.
 * @param {string} status - Fulfillment status
 * @returns {string} CSS color value
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status] || colors.mountainBlue;
}

// ── Order Formatting ────────────────────────────────────────────────

/**
 * Format an order date for display.
 * @param {string|Date|null|undefined} dateValue
 * @returns {string} Formatted date string or fallback
 */
export function formatOrderDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format an order total for display.
 * @param {object|null|undefined} totals - Order totals object
 * @returns {string} Formatted price string
 */
export function formatOrderTotal(totals) {
  const total = Number(totals?.total || 0);
  if (!isFinite(total) || total < 0) return '$0.00';
  return `$${total.toFixed(2)}`;
}

/**
 * Build the order number display string.
 * @param {string|number|null|undefined} orderNumber
 * @returns {string}
 */
export function formatOrderNumber(orderNumber) {
  if (orderNumber == null || orderNumber === '') return 'Order #—';
  return `Order #${orderNumber}`;
}

/**
 * Determine if an order's track button should be visible.
 * @param {object} order
 * @returns {boolean}
 */
export function hasTrackingInfo(order) {
  return Boolean(order?.shippingInfo?.trackingNumber);
}

/**
 * Determine if the return button should be visible for an order.
 * Only Cancelled orders hide the return button — all other statuses
 * (including Processing/Shipped) show it. Actual return eligibility
 * (return window, final-sale check) is enforced by ReturnsPortal.js.
 * @param {string} fulfillmentStatus
 * @returns {boolean}
 */
export function isReturnEligible(fulfillmentStatus) {
  return fulfillmentStatus !== 'Cancelled';
}

/**
 * Build gallery items from order line items.
 * @param {Array} lineItems
 * @returns {Array} Gallery-ready items with src, alt, title
 */
export function buildOrderGalleryItems(lineItems) {
  if (!Array.isArray(lineItems)) return [];
  return lineItems
    .filter(li => li?.mediaItem?.src)
    .map(li => ({
      src: li.mediaItem.src,
      alt: li.name ? `Ordered item: ${li.name}` : 'Ordered item',
      title: li.name,
    }));
}

// ── Wishlist Helpers ────────────────────────────────────────────────

/**
 * Sort wishlist items by the given sort order.
 * @param {Array} items - Wishlist items
 * @param {string} sortOrder - One of: date-desc, date-asc, price-asc, price-desc, name-asc
 * @returns {Array} Sorted copy of items
 */
export function sortWishlist(items, sortOrder) {
  if (!Array.isArray(items)) return [];
  const sorted = [...items];
  switch (sortOrder) {
    case 'date-desc':
      sorted.sort((a, b) => new Date(b._createdDate) - new Date(a._createdDate));
      break;
    case 'date-asc':
      sorted.sort((a, b) => new Date(a._createdDate) - new Date(b._createdDate));
      break;
    case 'price-asc':
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'name-asc':
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    default:
      break;
  }
  return sorted;
}

/** Available wishlist sort options for the dropdown */
export const WISHLIST_SORT_OPTIONS = [
  { label: 'Newest First', value: 'date-desc' },
  { label: 'Oldest First', value: 'date-asc' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Name: A-Z', value: 'name-asc' },
];

/**
 * Determine stock status display for a wishlist item.
 * @param {object} item - Wishlist item
 * @returns {{ text: string, color: string }}
 */
export function getWishlistStockStatus(item) {
  if (!item || item.inStock === false) {
    return { text: 'Special Order', color: colors.sunsetCoral };
  }
  return { text: 'In Stock', color: colors.success };
}

/**
 * Determine if a wishlist item has a sale price to display.
 * @param {object} item
 * @returns {{ onSale: boolean, salePriceText: string }}
 */
export function getWishlistSaleInfo(item) {
  if (!item) return { onSale: false, salePriceText: '' };
  if (item.comparePrice && item.comparePrice > (item.price || 0)) {
    return {
      onSale: true,
      salePriceText: `Was $${Number(item.comparePrice).toFixed(2)}`,
    };
  }
  return { onSale: false, salePriceText: '' };
}

/**
 * Build the wishlist share URL.
 * @param {string} baseUrl - Site base URL
 * @param {string} memberId - Current member ID
 * @returns {string}
 */
export function buildWishlistShareUrl(baseUrl, memberId) {
  return `${baseUrl || ''}/wishlist?member=${memberId || ''}`;
}

// ── Alert History Helpers ────────────────────────────────────────────

/** Human-readable labels for alert types */
export const ALERT_TYPE_LABELS = {
  price_drop: 'Price Drop',
  back_in_stock: 'Back in Stock',
  low_stock: 'Low Stock',
};

/**
 * Format a wishlist alert for display in the member page.
 * @param {object|null} alert - Alert object from getWishlistAlertHistory
 * @returns {{ typeLabel: string, productName: string, message: string, date: string }}
 */
export function formatAlertForDisplay(alert) {
  if (!alert) {
    return { typeLabel: 'Alert', productName: '', message: '', date: '' };
  }

  const typeLabel = ALERT_TYPE_LABELS[alert.alertType] || 'Alert';
  const productName = alert.productName || '';

  let message = '';
  if (alert.alertType === 'price_drop') {
    const price = alert.price != null ? `$${Number(alert.price).toFixed(2)}` : '';
    const pct = alert.dropPercent != null ? `${alert.dropPercent}%` : '';
    message = pct && price ? `Price dropped ${pct} to ${price}` : 'Price dropped';
  } else if (alert.alertType === 'back_in_stock') {
    message = 'Now back in stock';
  } else if (alert.alertType === 'low_stock') {
    const qty = alert.quantityInStock != null ? String(alert.quantityInStock) : 'few';
    message = `Only ${qty} left in stock`;
  }

  let date = '';
  if (alert.sentAt) {
    const d = new Date(alert.sentAt);
    if (!isNaN(d.getTime())) {
      date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  }

  return { typeLabel, productName, message, date };
}

// ── Dashboard Helpers ───────────────────────────────────────────────

/**
 * Build the welcome message for the dashboard.
 * @param {object|null} member
 * @returns {string}
 */
export function getWelcomeMessage(member) {
  const name = member?.contactDetails?.firstName || 'Member';
  return `Welcome back, ${name}!`;
}

/**
 * Format loyalty points for display.
 * @param {object|null} account - Loyalty account
 * @returns {{ pointsText: string, tierText: string|null }}
 */
export function formatLoyaltyDisplay(account) {
  if (!account || account.points === undefined || account.points === null) {
    return { pointsText: 'Join Rewards', tierText: null };
  }
  return {
    pointsText: `${account.points.toLocaleString()} pts`,
    tierText: account.tier || null,
  };
}

/** Quick link definitions for the dashboard */
export const DASHBOARD_QUICK_LINKS = [
  { id: '#dashQuickOrders', target: '#ordersRepeater', label: 'Jump to your orders' },
  { id: '#dashQuickWishlist', target: '#wishlistRepeater', label: 'Jump to your wishlist' },
  { id: '#dashQuickSettings', target: '#accountSettings', label: 'Jump to account settings' },
];

// ── Address Book Helpers ────────────────────────────────────────────

/**
 * Format an address for display.
 * @param {object} addr
 * @returns {string}
 */
export function formatAddress(addr) {
  if (!addr) return 'No address saved';
  const lines = [];
  if (addr.street) lines.push(addr.street);
  if (addr.city && addr.state) {
    lines.push(`${addr.city}, ${addr.state} ${addr.zip || ''}`);
  }
  return lines.join('\n') || 'No address saved';
}

/**
 * Normalize addresses for repeater data (ensure _id on each).
 * @param {Array} addresses
 * @returns {Array}
 */
export function normalizeAddresses(addresses) {
  if (!Array.isArray(addresses)) return [];
  return addresses.map((addr, idx) => ({
    _id: addr._id || String(idx),
    ...addr,
  }));
}

// ── Communication Preferences ───────────────────────────────────────

/** Default communication preference toggle configuration */
export const COMM_PREF_TOGGLES = [
  { id: '#prefNewsletter', key: 'newsletter', label: 'Receive newsletter emails' },
  { id: '#prefSaleAlerts', key: 'saleAlerts', label: 'Receive sale alerts' },
  { id: '#prefBackInStock', key: 'backInStock', label: 'Receive back-in-stock notifications' },
];

/** Default preference values for new members */
export const DEFAULT_COMM_PREFS = {
  newsletter: true,
  saleAlerts: true,
  backInStock: true,
};

// ── Section Initialization List ─────────────────────────────────────

/** Names of all page sections for init orchestration */
export const PAGE_SECTIONS = [
  'dashboard',
  'storeCredit',
  'loyaltyDashboard',
  'orderHistory',
  'wishlist',
  'accountSettings',
  'addressBook',
  'communicationPrefs',
  'returns',
];

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
  const num = encodeURIComponent(orderNumber || '');
  const mail = encodeURIComponent(email || '');
  return `/tracking?order=${num}&email=${mail}`;
}
