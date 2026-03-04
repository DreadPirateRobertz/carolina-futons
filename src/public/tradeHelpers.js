/**
 * @module tradeHelpers
 * @description Frontend helpers for the trade/commercial account portal.
 * Provides display formatting, tier badge configuration, invoice status
 * display, pricing calculations, and form validation for trade accounts.
 *
 * @requires public/sharedTokens.js
 */
import { colors } from 'public/sharedTokens.js';

// ── Tier Configuration ───────────────────────────────────────────────

const TIER_CONFIG = {
  bronze: {
    label: 'Bronze',
    discount: '10%',
    color: colors.sunsetCoral,
    bgColor: colors.sunsetCoralLight,
  },
  silver: {
    label: 'Silver',
    discount: '15%',
    color: colors.mountainBlue,
    bgColor: colors.mountainBlueLight,
  },
  gold: {
    label: 'Gold',
    discount: '20%',
    color: colors.espresso,
    bgColor: colors.sandBase,
  },
  platinum: {
    label: 'Platinum',
    discount: '25%',
    color: colors.espresso,
    bgColor: colors.sandDark,
  },
};

const DEFAULT_TIER = {
  label: 'Trade',
  discount: '0%',
  color: colors.muted,
  bgColor: colors.offWhite,
};

// ── Invoice Status Configuration ─────────────────────────────────────

const INVOICE_STATUS_CONFIG = {
  pending: { label: 'Pending', color: colors.mountainBlue },
  paid: { label: 'Paid', color: colors.success },
  overdue: { label: 'Overdue', color: colors.error },
  void: { label: 'Void', color: colors.muted },
};

const DEFAULT_STATUS = { label: 'Unknown', color: colors.muted };

// ── Email Validation ─────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Public API ───────────────────────────────────────────────────────

/**
 * Get badge display configuration for a trade tier.
 * @param {string} tier - bronze|silver|gold|platinum
 * @returns {{ label: string, discount: string, color: string, bgColor: string }}
 */
export function getTierBadgeConfig(tier) {
  if (!tier || typeof tier !== 'string') return DEFAULT_TIER;
  return TIER_CONFIG[tier.toLowerCase()] || DEFAULT_TIER;
}

/**
 * Get display configuration for an invoice status.
 * @param {string} status - pending|paid|overdue|void
 * @returns {{ label: string, color: string }}
 */
export function formatInvoiceStatus(status) {
  if (!status || typeof status !== 'string') return DEFAULT_STATUS;
  return INVOICE_STATUS_CONFIG[status.toLowerCase()] || DEFAULT_STATUS;
}

/**
 * Format a number as USD currency.
 * @param {number} amount
 * @returns {string} Formatted currency string (e.g., "$5,000.00")
 */
export function formatCurrency(amount) {
  const num = Number(amount);
  if (!isFinite(num)) return '$0.00';
  const abs = Math.abs(num);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
}

/**
 * Calculate savings from trade pricing.
 * @param {number} unitPrice - Original unit price
 * @param {number} quantity - Number of units
 * @param {number} discountPercent - Tier discount percentage
 * @returns {{ originalTotal: number, discountTotal: number, savings: number }}
 */
export function calculateSavings(unitPrice, quantity, discountPercent) {
  const price = Number(unitPrice) || 0;
  const qty = Number(quantity) || 0;
  const discount = Number(discountPercent) || 0;

  const originalTotal = Math.round(price * qty * 100) / 100;
  const discountTotal = Math.round(originalTotal * (1 - discount / 100) * 100) / 100;
  const savings = Math.round((originalTotal - discountTotal) * 100) / 100;

  return { originalTotal, discountTotal, savings };
}

/**
 * Get account manager display info.
 * @param {Object|null} account - Trade account object
 * @returns {{ name: string, email: string, available: boolean }}
 */
export function getAccountManagerDisplay(account) {
  if (!account || !account.accountManagerName) {
    return { name: '', email: '', available: false };
  }
  return {
    name: account.accountManagerName,
    email: account.accountManagerEmail || '',
    available: true,
  };
}

/**
 * Get tax-exempt status display.
 * @param {boolean} verified
 * @returns {{ label: string, verified: boolean, color: string }}
 */
export function getTaxExemptStatusDisplay(verified) {
  return {
    label: verified ? 'Verified' : 'Not Verified',
    verified: Boolean(verified),
    color: verified ? colors.success : colors.muted,
  };
}

/**
 * Get payment terms label.
 * @param {number} days
 * @returns {string} e.g., "Net-30"
 */
export function getPaymentTermsLabel(days) {
  const d = Number(days) || 30;
  return `Net-${d}`;
}

/**
 * Validate a trade account application form.
 * @param {Object|null} form
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
export function validateTradeApplication(form) {
  const errors = [];

  if (!form) {
    return { valid: false, errors: [{ field: 'form', message: 'Application data required' }] };
  }

  if (!form.businessName || !form.businessName.trim()) {
    errors.push({ field: 'businessName', message: 'Business name is required' });
  }
  if (!form.contactName || !form.contactName.trim()) {
    errors.push({ field: 'contactName', message: 'Contact name is required' });
  }
  if (!form.contactEmail || !EMAIL_REGEX.test(form.contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'Valid email address is required' });
  }

  return { valid: errors.length === 0, errors };
}
