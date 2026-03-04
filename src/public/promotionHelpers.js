/**
 * @module promotionHelpers
 * @description Frontend helpers for displaying promotions, flash sales,
 * BOGO deals, promo code UI, and countdown timers.
 */

// ── Countdown Timer ────────────────────────────────────────────────

/**
 * Format milliseconds into a countdown string.
 * @param {number} ms - Remaining milliseconds
 * @returns {string} Formatted countdown (e.g., "02:30:15" or "1d 03:00:00")
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0));
  if (total === 0) return '00:00:00';

  const totalSeconds = Math.floor(total / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = n => String(n).padStart(2, '0');
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return days > 0 ? `${days}d ${hms}` : hms;
}

/**
 * Get urgency level based on remaining time.
 * @param {number} remainingMs - Milliseconds remaining
 * @returns {'critical'|'urgent'|'normal'|'low'}
 */
export function getUrgencyLevel(remainingMs) {
  const ms = Number(remainingMs) || 0;
  if (ms <= 3600000) return 'critical';     // < 1 hour
  if (ms <= 21600000) return 'urgent';      // < 6 hours
  if (ms <= 86400000) return 'normal';      // < 24 hours
  return 'low';
}

// ── Discount Formatting ────────────────────────────────────────────

/**
 * Format a discount for display.
 * @param {string} type - 'percentage' | 'fixed' | 'freeShipping' | 'bogo'
 * @param {number} [value] - Discount value
 * @returns {string} Display string (e.g., "10% OFF", "$25 OFF", "FREE SHIPPING")
 */
export function formatDiscount(type, value) {
  switch (type) {
    case 'percentage':
      return `${value}% OFF`;
    case 'fixed':
      return `$${value} OFF`;
    case 'freeShipping':
      return 'FREE SHIPPING';
    case 'bogo':
      return value === 100 ? 'FREE' : `${value}% OFF`;
    default:
      return '';
  }
}

// ── Promo Code Input ───────────────────────────────────────────────

/**
 * Client-side validation for promo code input format.
 * @param {string} code - Input to validate
 * @returns {boolean} True if format is acceptable
 */
export function isPromoCodeValid(code) {
  if (!code || typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

/**
 * Sanitize promo code input for submission.
 * @param {string} input - Raw user input
 * @returns {string} Cleaned, uppercased code
 */
export function sanitizePromoInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 50);
}

// ── Flash Sale Banner ──────────────────────────────────────────────

/**
 * Build display data for a flash sale banner.
 * @param {Object} sale - Flash sale object from getActiveFlashSales
 * @returns {Object|null} Banner data or null if sale invalid/expired
 */
export function buildFlashSaleBanner(sale) {
  if (!sale || !sale.remainingMs || sale.remainingMs <= 0) return null;

  return {
    headline: sale.title,
    discountLabel: formatDiscount('percentage', sale.discountPercent),
    countdown: formatCountdown(sale.remainingMs),
    urgency: getUrgencyLevel(sale.remainingMs),
    ctaText: 'Shop Now',
    productIds: sale.productIds || '',
  };
}

// ── BOGO Badge ─────────────────────────────────────────────────────

/**
 * Build display data for a BOGO deal badge.
 * @param {Object} deal - BOGO deal object from getActiveBOGODeals
 * @returns {Object|null} Badge data or null if deal invalid
 */
export function buildBOGOBadge(deal) {
  if (!deal) return null;

  const discountText = deal.getDiscountPercent === 100
    ? 'FREE'
    : `${deal.getDiscountPercent}% OFF`;

  const label = `BUY ${deal.buyQuantity} GET ${deal.getQuantity} ${discountText}`;

  const description = deal.getDiscountPercent === 100
    ? `Buy a ${deal.buyCategory} item, get a ${deal.getCategory} item FREE`
    : `Buy a ${deal.buyCategory} item, get a ${deal.getCategory} item ${discountText}`;

  return { label, description, dealTitle: deal.title };
}

// ── Savings Display ────────────────────────────────────────────────

/**
 * Calculate combined savings display for cart.
 * @param {Object} params
 * @param {number} params.promoDiscount - Discount from promo code
 * @param {number} params.bogoSavings - Savings from BOGO deals
 * @param {number} params.subtotal - Original cart subtotal
 * @returns {Object} { totalSavings, savingsPercent, displayText }
 */
export function calculateSavingsDisplay({ promoDiscount = 0, bogoSavings = 0, subtotal = 0 }) {
  const total = Math.min(
    round2((Number(promoDiscount) || 0) + (Number(bogoSavings) || 0)),
    Math.max(0, Number(subtotal) || 0)
  );

  if (total <= 0) {
    return { totalSavings: 0, savingsPercent: 0, displayText: '' };
  }

  const sub = Math.max(0, Number(subtotal) || 0);
  const pct = sub > 0 ? round2((total / sub) * 100) : 0;

  return {
    totalSavings: total,
    savingsPercent: pct,
    displayText: `You save $${total} (${pct}% off)`,
  };
}

// ── Internal ───────────────────────────────────────────────────────

function round2(n) {
  return Math.round(n * 100) / 100;
}
