// priceMatchHelpers.js - Frontend helpers for Price Match Guarantee page
// Validation, formatting, competitor options, and policy text.

import { colors } from 'public/designTokens.js';

const MAX_PRICE = 50000;

const APPROVED_COMPETITORS = [
  { label: 'Wayfair', value: 'wayfair' },
  { label: 'Amazon', value: 'amazon' },
  { label: 'Overstock', value: 'overstock' },
  { label: 'Ashley Furniture', value: 'ashley-furniture' },
  { label: 'IKEA', value: 'ikea' },
  { label: 'Target', value: 'target' },
  { label: 'Walmart', value: 'walmart' },
  { label: 'West Elm', value: 'west-elm' },
  { label: 'Pottery Barn', value: 'pottery-barn' },
  { label: 'CB2', value: 'cb2' },
  { label: 'Other', value: 'other' },
];

const STATUS_MAP = {
  pending: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
  credited: 'Credit Issued',
};

// ── Validation ───────────────────────────────────────────────────────

/**
 * Validate price match submission form fields.
 * @param {Object} fields - Form field values (all strings).
 * @param {string} fields.productName - Selected product name.
 * @param {string} fields.ourPrice - Our listed price (string from input).
 * @param {string} fields.competitorName - Competitor retailer name.
 * @param {string} fields.competitorPrice - Competitor price (string from input).
 * @param {string} [fields.competitorUrl] - URL to competitor listing.
 * @param {string} [fields.notes] - Additional notes.
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validatePriceMatchFields(fields) {
  if (!fields || typeof fields !== 'object') {
    return { valid: false, errors: [{ field: 'form', message: 'Form data is required' }] };
  }

  const errors = [];

  const productName = (fields.productName || '').toString().replace(/<[^>]*>/g, '').trim();
  if (!productName) {
    errors.push({ field: 'productName', message: 'Please select a product' });
  }

  const competitorName = (fields.competitorName || '').toString().replace(/<[^>]*>/g, '').trim();
  if (!competitorName) {
    errors.push({ field: 'competitorName', message: 'Please select a competitor' });
  }

  const ourPrice = parseFloat(fields.ourPrice);
  if (!Number.isFinite(ourPrice) || ourPrice <= 0) {
    errors.push({ field: 'ourPrice', message: 'Our price must be a valid positive number' });
  } else if (ourPrice > MAX_PRICE) {
    errors.push({ field: 'ourPrice', message: `Price cannot exceed $${MAX_PRICE.toLocaleString()}` });
  }

  const competitorPrice = parseFloat(fields.competitorPrice);
  if (!Number.isFinite(competitorPrice) || competitorPrice <= 0) {
    errors.push({ field: 'competitorPrice', message: 'Competitor price must be a valid positive number' });
  } else if (competitorPrice > MAX_PRICE) {
    errors.push({ field: 'competitorPrice', message: `Price cannot exceed $${MAX_PRICE.toLocaleString()}` });
  } else if (Number.isFinite(ourPrice) && ourPrice > 0 && competitorPrice >= ourPrice) {
    errors.push({ field: 'competitorPrice', message: 'Competitor price must be lower than our price' });
  }

  const competitorUrl = (fields.competitorUrl || '').toString().trim();
  if (competitorUrl) {
    try {
      const parsed = new URL(competitorUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        errors.push({ field: 'competitorUrl', message: 'URL must start with http:// or https://' });
      }
    } catch {
      errors.push({ field: 'competitorUrl', message: 'Please enter a valid URL' });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Competitor Options ───────────────────────────────────────────────

/**
 * Get dropdown options for competitor selection.
 * @returns {Array<{ label: string, value: string }>}
 */
export function getCompetitorOptions() {
  return APPROVED_COMPETITORS.map(c => ({ label: c.label, value: c.value }));
}

// ── Status Formatting ────────────────────────────────────────────────

/**
 * Format a claim status into human-readable text.
 * @param {string} status - Raw status string.
 * @returns {string} Formatted status label.
 */
export function formatClaimStatus(status) {
  if (!status || typeof status !== 'string') return 'Unknown';
  return STATUS_MAP[status.toLowerCase()] || status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Get a display color for a claim status.
 * @param {string} status - Raw status string.
 * @returns {string} CSS color value.
 */
export function getStatusColor(status) {
  const map = {
    pending: colors.mountainBlue || '#5B8FA8',
    approved: colors.success || '#4A7C59',
    denied: colors.error || colors.sunsetCoral || '#DC2626',
    credited: colors.success || '#4A7C59',
  };
  return map[status] || colors.espresso || '#1E3A5F';
}

// ── Price Formatting ─────────────────────────────────────────────────

/**
 * Format a number as USD currency string.
 * @param {number|string} price - Price value.
 * @returns {string} Formatted price (e.g. "$1,299.99").
 */
export function formatPrice(price) {
  const num = parseFloat(price);
  if (!Number.isFinite(num)) return '$0.00';
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Savings Calculation ──────────────────────────────────────────────

/**
 * Calculate savings between our price and competitor price.
 * @param {number} ourPrice - Our current price.
 * @param {number} competitorPrice - Competitor's listed price.
 * @returns {{ amount: number, percentage: number }}
 */
export function calculateSavings(ourPrice, competitorPrice) {
  const ours = parseFloat(ourPrice);
  const theirs = parseFloat(competitorPrice);

  if (!Number.isFinite(ours) || !Number.isFinite(theirs) || ours <= 0 || theirs >= ours) {
    return { amount: 0, percentage: 0 };
  }

  const amount = Math.round((ours - theirs) * 100) / 100;
  const percentage = Math.round((amount / ours) * 1000) / 10;
  return { amount, percentage };
}

// ── Policy ───────────────────────────────────────────────────────────

/**
 * Get price match guarantee policy details for display.
 * @returns {{ title: string, description: string, rules: string[], exclusions: string[] }}
 */
export function getPriceMatchPolicy() {
  return {
    title: 'Price Match Guarantee',
    description:
      'Found a lower price on an identical item from an approved competitor? ' +
      'We\'ll match it! Submit your claim and our team will verify and process your refund or store credit.',
    rules: [
      'Item must be identical (same brand, model, color, and size)',
      'Competitor must be an authorized retailer from our approved list',
      'Competitor price must be currently available and in stock',
      'Price match requests must be submitted within 30 days of purchase',
      'Limit one price match per item per customer',
    ],
    exclusions: [
      'Clearance, liquidation, or closeout items',
      'Marketplace or third-party seller prices (e.g., Amazon Marketplace)',
      'Coupon or promo-code-only pricing',
      'Membership or loyalty-exclusive pricing',
      'Pricing errors on competitor sites',
    ],
  };
}
