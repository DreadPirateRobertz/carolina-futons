// giftCardHelpers.js — Testable logic extracted from Gift Cards page
// Pure functions for gift card validation, formatting, and display.

import { colors } from 'public/designTokens.js';

/** Available gift card denominations (must match backend GIFT_CARD_AMOUNTS) */
export const GIFT_CARD_DENOMINATIONS = [
  { amount: 25, label: '$25' },
  { amount: 50, label: '$50' },
  { amount: 100, label: '$100' },
  { amount: 150, label: '$150' },
  { amount: 200, label: '$200' },
  { amount: 500, label: '$500' },
];

const VALID_AMOUNTS = new Set(GIFT_CARD_DENOMINATIONS.map(d => d.amount));

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CODE_RE = /^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

/**
 * Validate the gift card purchase form.
 * @param {Object|null|undefined} form
 * @param {number} form.amount - Selected denomination
 * @param {string} form.purchaserEmail - Buyer email
 * @param {string} form.recipientEmail - Recipient email
 * @param {string} [form.recipientName] - Recipient name
 * @param {string} [form.message] - Personal message
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validatePurchaseForm(form) {
  if (!form) {
    return {
      valid: false,
      errors: [
        { field: 'amount', message: 'Please select an amount' },
        { field: 'purchaserEmail', message: 'Your email is required' },
        { field: 'recipientEmail', message: 'Recipient email is required' },
      ],
    };
  }

  const errors = [];
  const amount = Number(form.amount);

  if (!form.amount || !isFinite(amount) || !VALID_AMOUNTS.has(amount)) {
    errors.push({ field: 'amount', message: 'Please select a valid gift card amount' });
  }

  const buyerEmail = (form.purchaserEmail || '').trim();
  if (!buyerEmail) {
    errors.push({ field: 'purchaserEmail', message: 'Your email is required' });
  } else if (!EMAIL_RE.test(buyerEmail)) {
    errors.push({ field: 'purchaserEmail', message: 'Please enter a valid email address' });
  }

  const recipientEmail = (form.recipientEmail || '').trim();
  if (!recipientEmail) {
    errors.push({ field: 'recipientEmail', message: 'Recipient email is required' });
  } else if (!EMAIL_RE.test(recipientEmail)) {
    errors.push({ field: 'recipientEmail', message: 'Please enter a valid recipient email' });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a gift card code format.
 * @param {string|null|undefined} code
 * @returns {boolean}
 */
export function validateGiftCardCode(code) {
  if (!code || typeof code !== 'string') return false;
  return CODE_RE.test(code.trim());
}

/**
 * Format a balance amount for display.
 * @param {number|string|null|undefined} amount
 * @returns {string} Formatted dollar amount
 */
export function formatBalance(amount) {
  const num = Number(amount);
  if (!isFinite(num) || num < 0) return '$0.00';
  return `$${num.toFixed(2)}`;
}

/**
 * Format an expiration date for display.
 * @param {string|Date|null|undefined} dateValue
 * @returns {string} Formatted date or empty string
 */
export function formatExpirationDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Get the display properties for a balance check result status.
 * @param {Object|null} result - Balance check result from backend
 * @returns {{ label: string, color: string }}
 */
export function getBalanceStatusDisplay(result) {
  if (!result || !result.found) {
    return { label: 'Not Found', color: colors.error };
  }

  switch (result.status) {
    case 'active':
      return { label: 'Active', color: colors.success };
    case 'expired':
      return { label: 'Expired', color: colors.error };
    case 'redeemed':
      return { label: 'Fully Redeemed', color: colors.muted };
    default:
      return { label: 'Unknown', color: colors.muted };
  }
}

/**
 * Build the usage text showing remaining vs initial balance.
 * @param {number|null} balance - Current balance
 * @param {number|null} initialAmount - Original amount
 * @returns {string}
 */
export function getCardUsageText(balance, initialAmount) {
  const bal = formatBalance(balance);
  const initial = formatBalance(initialAmount);
  return `${bal} remaining of ${initial}`;
}

/**
 * Normalize a gift card code for display/submission (uppercase, trimmed).
 * @param {string|null|undefined} code
 * @returns {string}
 */
export function formatGiftCardCode(code) {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase();
}
