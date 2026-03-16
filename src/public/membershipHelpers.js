/**
 * @module membershipHelpers
 * @description Pure display helpers for CF+ membership UI.
 * Formatting, pricing, benefit descriptions, and CTA logic.
 */

/**
 * Format a plan price for display.
 * @param {Object|null} price - { value, currency }
 * @param {string} period - 'monthly' or 'annual'
 * @returns {string} Formatted price string (e.g., "$9.99/mo")
 */
export function formatPlanPrice(price, period) {
  if (!price || !price.value) return '';
  const suffix = period === 'annual' ? '/yr' : '/mo';
  return `$${price.value}${suffix}`;
}

/**
 * Calculate savings of annual vs monthly plan.
 * @param {number} monthlyPrice - Monthly plan price
 * @param {number} annualPrice - Annual plan price
 * @returns {{ amount: number, percent: number }}
 */
export function getPlanSavings(monthlyPrice, annualPrice) {
  const yearlyAtMonthly = monthlyPrice * 12;
  if (yearlyAtMonthly <= 0) return { amount: 0, percent: 0 };
  const saved = yearlyAtMonthly - annualPrice;
  return {
    amount: Math.max(0, Math.round(saved * 100) / 100),
    percent: saved > 0 ? Math.round((saved / yearlyAtMonthly) * 100) : 0,
  };
}

/**
 * Get list of CF+ benefit descriptions for marketing display.
 * @returns {string[]} Benefit descriptions
 */
export function getBenefitsList() {
  return [
    'Free shipping on every order',
    '10% member discount on all products',
    'Early access to new arrivals and sales',
    'Priority customer support',
    'Exclusive member-only promotions',
  ];
}

/**
 * Get the appropriate CTA button config based on membership status.
 * @param {boolean} isActive - Whether member has active CF+
 * @returns {{ text: string, action: string }}
 */
export function getMembershipCTA(isActive) {
  if (isActive) {
    return { text: 'Manage Membership', action: 'manage' };
  }
  return { text: 'Join CF+', action: 'signup' };
}

/**
 * Format a renewal date for display.
 * @param {string|null} isoDate - ISO date string
 * @returns {string} Formatted date (e.g., "Apr 15, 2026") or empty string
 */
export function formatRenewalDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
