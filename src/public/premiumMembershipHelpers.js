// premiumMembershipHelpers.js — Pure functions for CF+ Premium membership UI.
// Plan comparison, benefit display, badge rendering, status formatting.

import { colors } from 'public/designTokens.js';

const CF_PLUS_DISCOUNT_PERCENT = 10;

/**
 * Format a plan price with period suffix.
 * @param {number|null} price
 * @param {string} planType - 'monthly' | 'annual'
 * @returns {string}
 */
export function formatPlanPrice(price, planType) {
  const num = Number(price) || 0;
  const formatted = `$${num.toFixed(2)}`;
  if (planType === 'monthly') return `${formatted}/mo`;
  if (planType === 'annual') return `${formatted}/yr`;
  return formatted;
}

/**
 * Calculate annual savings of annual plan vs monthly.
 * @param {number} monthlyPrice
 * @param {number} annualPrice
 * @returns {number} Savings amount (clamped to 0)
 */
export function getPlanSavings(monthlyPrice, annualPrice) {
  const monthly = Number(monthlyPrice) || 0;
  const annual = Number(annualPrice) || 0;
  const yearlyAtMonthly = Math.round(monthly * 12 * 100) / 100;
  return Math.max(0, Math.round((yearlyAtMonthly - annual) * 100) / 100);
}

/**
 * Get badge display data for CF+ member.
 * @param {boolean} isActive
 * @returns {{ text: string, visible: boolean, color?: string }}
 */
export function formatMemberBadge(isActive) {
  if (!isActive) return { text: '', visible: false };
  return { text: 'CF+ Member', visible: true, color: colors.primary };
}

/**
 * Get human-readable label for membership status.
 * @param {string|null} status
 * @returns {string}
 */
export function getMembershipStatusLabel(status) {
  switch (status) {
    case 'active': return 'Active';
    case 'cancelled': return 'Cancelled';
    case 'expired': return 'Expired';
    default: return 'Unknown';
  }
}

/**
 * Format a renewal/expiration date for display.
 * @param {string|Date|null} dateValue
 * @returns {string}
 */
export function formatRenewalDate(dateValue) {
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
 * Calculate estimated annual savings from the CF+ discount.
 * @param {number|null} annualSpend - Estimated annual spend
 * @param {number|null} discountPercent - Discount percentage
 * @returns {number}
 */
export function calculateAnnualSavings(annualSpend, discountPercent) {
  const spend = Number(annualSpend) || 0;
  const pct = Number(discountPercent) || 0;
  return Math.round(spend * pct / 100 * 100) / 100;
}

/**
 * Get the standard CF+ benefits list for marketing display.
 * @returns {string[]}
 */
export function getBenefitsList() {
  return [
    'Free shipping on all orders',
    `${CF_PLUS_DISCOUNT_PERCENT}% off every order`,
    'Early access to new products',
    'Member-only promotions',
  ];
}

/**
 * Check if a membership status result indicates an active premium member.
 * @param {Object|null} statusResult - Result from checkMembershipStatus
 * @returns {boolean}
 */
export function isPremiumMember(statusResult) {
  if (!statusResult) return false;
  return statusResult.success === true && statusResult.isActive === true;
}
