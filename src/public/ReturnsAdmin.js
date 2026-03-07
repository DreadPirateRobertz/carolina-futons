/** @module ReturnsAdmin - Admin dashboard helpers for returns management.
 *
 * Pure-JS logic for the Admin Returns page: status labels, state-machine transitions,
 * badge coloring (design tokens), row formatting, dashboard stat cards, refund
 * validation, shipping-label eligibility checks, and priority sorting (action-required first).
 *
 * Statuses follow the lifecycle: requested -> approved -> shipped -> received -> refunded.
 * Denied is a terminal state reachable from requested, approved, or received.
 *
 * Dependencies: designTokens (colors).
 */
import { colors } from 'public/designTokens.js';

// ── Status Constants ─────────────────────────────────────────────

const ALL_STATUSES = ['requested', 'approved', 'shipped', 'received', 'refunded', 'denied'];

const STATUS_LABELS = {
  requested: 'Pending Review',
  approved: 'Approved',
  shipped: 'In Transit',
  received: 'Received',
  refunded: 'Refunded',
  denied: 'Denied',
};

/** Valid next statuses from each current status. */
const STATUS_TRANSITIONS = {
  requested: ['approved', 'denied'],
  approved: ['shipped', 'denied'],
  shipped: ['received'],
  received: ['refunded', 'denied'],
  refunded: [],
  denied: [],
};

// ── Status Helpers ───────────────────────────────────────────────

/**
 * Get human-readable admin label for a status.
 * @param {string} status
 * @returns {string}
 */
export function getAdminStatusLabel(status) {
  return STATUS_LABELS[status] || status || 'Unknown';
}

/**
 * Get valid next status transitions for a return.
 * @param {string} currentStatus
 * @returns {string[]}
 */
export function getNextStatuses(currentStatus) {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Check if a status transition is valid.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * Get all available statuses for the filter dropdown.
 * @returns {Array<{label: string, value: string}>}
 */
export function getStatusFilterOptions() {
  return [
    { label: 'All Returns', value: '' },
    ...ALL_STATUSES.map(s => ({ label: STATUS_LABELS[s], value: s })),
  ];
}

/**
 * Get the badge color for a status.
 * @param {string} status
 * @returns {string}
 */
export function getAdminStatusColor(status) {
  switch (status) {
    case 'requested': return colors.mountainBlue;
    case 'approved': return colors.mountainBlue;
    case 'shipped': return colors.sunsetCoral;
    case 'received': return colors.sunsetCoral;
    case 'refunded': return colors.success;
    case 'denied': return colors.error;
    default: return colors.textMuted;
  }
}

// ── Return Formatting ────────────────────────────────────────────

/**
 * Format a return record for admin display.
 * @param {Object} ret - Admin return record from getAdminReturns
 * @returns {Object}
 */
export function formatAdminReturnRow(ret) {
  if (!ret) return null;

  let items = [];
  if (Array.isArray(ret.items)) {
    items = ret.items;
  } else if (typeof ret.items === 'string') {
    try { items = JSON.parse(ret.items); } catch (e) {}
  }

  return {
    _id: ret._id || '',
    rmaNumber: ret.rmaNumber || '',
    orderNumber: ret.orderNumber || '',
    memberName: ret.memberName || 'Guest',
    memberEmail: ret.memberEmail || '',
    type: ret.type === 'exchange' ? 'Exchange' : 'Return',
    reason: ret.reason || '',
    details: ret.details || '',
    status: ret.status || 'requested',
    statusLabel: getAdminStatusLabel(ret.status),
    statusColor: getAdminStatusColor(ret.status),
    itemCount: items.length,
    items,
    adminNotes: ret.adminNotes || '',
    hasLabel: !!ret.returnTrackingNumber,
    trackingNumber: ret.returnTrackingNumber || '',
    refundAmount: ret.refundAmount || null,
    date: ret.date || '',
  };
}

// ── Stats Formatting ─────────────────────────────────────────────

/**
 * Format return stats for dashboard display.
 * @param {Object} stats - Raw stats from getReturnStats
 * @returns {Object}
 */
export function formatReturnStats(stats) {
  if (!stats) return { total: 0, actionRequired: 0, inProgress: 0, completed: 0, cards: [] };

  const total = stats.total || 0;
  const actionRequired = (stats.requested || 0) + (stats.received || 0);
  const inProgress = (stats.approved || 0) + (stats.shipped || 0);
  const completed = (stats.refunded || 0) + (stats.denied || 0);

  return {
    total,
    actionRequired,
    inProgress,
    completed,
    cards: [
      { label: 'Total Returns', value: total, color: colors.espresso },
      { label: 'Action Required', value: actionRequired, color: colors.sunsetCoral },
      { label: 'In Progress', value: inProgress, color: colors.mountainBlue },
      { label: 'Completed', value: completed, color: colors.success },
    ],
  };
}

// ── Refund Validation ────────────────────────────────────────────

/**
 * Validate refund input before processing.
 * @param {Object} ret - Return record
 * @param {number|string} amount - Refund amount
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateRefund(ret, amount) {
  const errors = [];

  if (!ret) {
    errors.push('Return record not found.');
    return { valid: false, errors };
  }

  if (ret.status === 'refunded') errors.push('This return has already been refunded.');
  if (ret.status === 'denied') errors.push('Cannot refund a denied return.');

  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    errors.push('Please enter a valid refund amount greater than $0.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a return can have a label generated.
 * @param {Object} ret - Return record
 * @returns {{canGenerate: boolean, reason: string}}
 */
export function canGenerateLabel(ret) {
  if (!ret) return { canGenerate: false, reason: 'Return not found.' };
  if (ret.status !== 'approved') return { canGenerate: false, reason: 'Return must be approved first.' };
  if (ret.hasLabel || ret.returnTrackingNumber) return { canGenerate: false, reason: 'Label already generated.' };
  return { canGenerate: true, reason: '' };
}

/**
 * Check if a return needs admin attention (action required).
 * @param {string} status
 * @returns {boolean}
 */
export function needsAction(status) {
  return status === 'requested' || status === 'received';
}

/**
 * Sort returns with action-required items first, then by date descending.
 * @param {Object[]} returns
 * @returns {Object[]}
 */
export function sortAdminReturns(returns) {
  if (!Array.isArray(returns)) return [];

  return [...returns].sort((a, b) => {
    const aAction = needsAction(a.status) ? 0 : 1;
    const bAction = needsAction(b.status) ? 0 : 1;
    if (aAction !== bAction) return aAction - bAction;
    return (b.date || '').localeCompare(a.date || '');
  });
}
