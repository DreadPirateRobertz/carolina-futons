/**
 * @module storeCreditHelpers
 * @description Frontend helpers for store credit balance dashboard,
 * auto-apply at checkout, gifting UI, and expiration alerts.
 *
 * @requires src/public/designTokens.js
 */

/**
 * Format a store credit balance for display.
 * @param {number} balance - Credit balance in dollars.
 * @returns {string} Formatted balance string (e.g., "$125.50").
 */
export function formatCreditBalance(balance) {
  const num = Number(balance) || 0;
  return `$${num.toFixed(2)}`;
}

/**
 * Get a human-readable label for a credit reason.
 * @param {string} reason - Credit reason code.
 * @returns {string} Display label.
 */
export function getReasonLabel(reason) {
  const labels = {
    return: 'Return Credit',
    refund: 'Refund',
    promotion: 'Promotional Credit',
    admin_gift: 'Admin Gift',
    goodwill: 'Goodwill Credit',
    gift_received: 'Gift from Member',
  };
  return labels[reason] || 'Store Credit';
}

/**
 * Get a status badge configuration for a credit status.
 * @param {string} status - Credit status.
 * @returns {{ label: string, color: string }} Badge config.
 */
export function getStatusBadge(status) {
  const badges = {
    active: { label: 'Active', color: '#4CAF50' },
    used: { label: 'Used', color: '#9E9E9E' },
    expired: { label: 'Expired', color: '#F44336' },
  };
  return badges[status] || { label: status, color: '#9E9E9E' };
}

/**
 * Calculate days until a credit expires.
 * @param {string|Date} expirationDate - Expiration date.
 * @returns {number} Days remaining (negative if expired).
 */
export function daysUntilExpiration(expirationDate) {
  if (!expirationDate) return Infinity;
  const exp = new Date(expirationDate);
  const now = new Date();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a credit is expiring soon (within threshold days).
 * @param {string|Date} expirationDate - Expiration date.
 * @param {number} [thresholdDays=30] - Warning threshold.
 * @returns {boolean} True if expiring within threshold.
 */
export function isExpiringSoon(expirationDate, thresholdDays = 30) {
  const days = daysUntilExpiration(expirationDate);
  return days > 0 && days <= thresholdDays;
}

/**
 * Format an expiration date for display with urgency context.
 * @param {string|Date} expirationDate - Expiration date.
 * @returns {string} Formatted expiration message.
 */
export function formatExpirationMessage(expirationDate) {
  const days = daysUntilExpiration(expirationDate);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 7) return `Expires in ${days} days`;
  if (days <= 30) return `Expires in ${days} days`;
  const date = new Date(expirationDate);
  return `Expires ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * Initialize the store credit dashboard on Member Page.
 * Fetches balance, renders credits, and sets up expiration alerts.
 *
 * @param {Function} $w - Wix Velo selector function.
 * @returns {Promise<void>}
 */
export async function initStoreCreditDashboard($w) {
  try {
    const { getMyStoreCredit, getExpiringCredits } = await import('backend/storeCreditService.web');

    // Get current member ID from Wix auth
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member || !member._id) {
      hideStoreCreditSection($w);
      return;
    }

    const [creditResult, expiringResult] = await Promise.all([
      getMyStoreCredit(member._id),
      getExpiringCredits(member._id, 30),
    ]);

    if (!creditResult.success) {
      hideStoreCreditSection($w);
      return;
    }

    // Update balance display
    try {
      $w('#storeCreditBalance').text = formatCreditBalance(creditResult.totalBalance);
    } catch (_) { /* element may not exist */ }

    // Show/hide based on balance
    if (creditResult.totalBalance > 0) {
      try { $w('#storeCreditSection').show('fade', { duration: 250 }); } catch (_) { /* */ }
    } else {
      try { $w('#storeCreditSection').hide(); } catch (_) { /* */ }
    }

    // Expiration warning
    if (expiringResult.success && expiringResult.expiringTotal > 0) {
      try {
        $w('#storeCreditExpirationWarning').text =
          `${formatCreditBalance(expiringResult.expiringTotal)} expiring within 30 days`;
        $w('#storeCreditExpirationWarning').show('fade', { duration: 250 });
      } catch (_) { /* */ }
    }
  } catch (err) {
    console.error('[storeCreditHelpers] Error initializing dashboard:', err);
    hideStoreCreditSection($w);
  }
}

/**
 * Initialize auto-apply store credit at checkout.
 * Checks member's balance and offers to apply it to the order.
 *
 * @param {Function} $w - Wix Velo selector function.
 * @param {number} orderTotal - Current order total before credit.
 * @returns {Promise<{available: boolean, balance: number}>}
 */
export async function initCheckoutStoreCredit($w, orderTotal) {
  try {
    const { getMyStoreCredit } = await import('backend/storeCreditService.web');
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();

    if (!member || !member._id) {
      return { available: false, balance: 0 };
    }

    const result = await getMyStoreCredit(member._id);
    if (!result.success || result.totalBalance <= 0) {
      return { available: false, balance: 0 };
    }

    const applicableAmount = Math.min(result.totalBalance, orderTotal);

    // Update checkout UI
    try {
      $w('#storeCreditAvailable').text = `Store credit available: ${formatCreditBalance(result.totalBalance)}`;
      $w('#storeCreditApplyAmount').text = `-${formatCreditBalance(applicableAmount)}`;
      $w('#storeCreditCheckoutSection').show('fade', { duration: 250 });
    } catch (_) { /* elements may not exist */ }

    return { available: true, balance: result.totalBalance, applicableAmount };
  } catch (err) {
    console.error('[storeCreditHelpers] Error initializing checkout credit:', err);
    return { available: false, balance: 0 };
  }
}

/**
 * Format a transaction entry for display in credit history.
 * @param {{ type: string, amount: number, date: string, orderId?: string }} txn - Transaction.
 * @returns {{ label: string, amountDisplay: string, dateDisplay: string }}
 */
export function formatTransaction(txn) {
  if (!txn) return { label: 'Unknown', amountDisplay: '$0.00', dateDisplay: '' };

  const typeLabels = {
    issue: 'Credit Issued',
    redeem: 'Applied to Order',
    gift_sent: 'Gifted',
    gift_received: 'Gift Received',
  };

  const isDebit = txn.type === 'redeem' || txn.type === 'gift_sent';
  const prefix = isDebit ? '-' : '+';

  return {
    label: typeLabels[txn.type] || txn.type,
    amountDisplay: `${prefix}${formatCreditBalance(txn.amount)}`,
    dateDisplay: txn.date
      ? new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '',
  };
}

// ── Internal helpers ────────────────────────────────────────────────

function hideStoreCreditSection($w) {
  try { $w('#storeCreditSection').hide(); } catch (_) { /* element may not exist */ }
}
