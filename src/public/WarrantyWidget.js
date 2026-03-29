/**
 * @module WarrantyWidget
 * @description CTA widget shown on the Thank You Page and Member Page.
 * On the Thank You Page: shows a "Register Your Warranty" CTA after purchase.
 * On the Member Page: shows a list of registered warranties.
 *
 * Elements (Thank You Page mode):
 *   #warrantyCtaSection     — Container (collapsed by default)
 *   #warrantyCtaBtn         — "Register Warranty" button → navigates to /warranty-registration
 *
 * Elements (Member Page mode):
 *   #warrantyListSection    — Container (collapsed if no warranties)
 *   #warrantyRepeater       — Repeater showing warranty items
 *   #warrantyEmptyMsg       — Shown when member has no warranties
 *   #warrantyListLoading    — Loading state indicator
 *
 * CF-46ct
 */
import { getMyWarranties } from 'backend/warrantyService.web';
import wixLocation from 'wix-location';
import { safeCall, safeCollapse, safeExpand, safeText } from 'public/safeInit';

const WARRANTY_REGISTRATION_URL = '/warranty-registration';

/**
 * Show the warranty registration CTA on the Thank You Page.
 * Call after order confirmation is displayed.
 *
 * @param {Object} opts
 * @param {Function} opts.$w                  — Wix selector function
 * @param {string}   [opts.orderId]           — Order ID to pre-fill
 * @param {string}   [opts.productId]         — Product ID to pre-fill
 * @param {string}   [opts.productName]       — Product name to pre-fill
 */
export function initWarrantyCta(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;

  // Build the registration URL with pre-fill params
  const params = new URLSearchParams();
  if (opts.orderId)     params.set('orderId',     opts.orderId);
  if (opts.productId)   params.set('productId',   opts.productId);
  if (opts.productName) params.set('productName', encodeURIComponent(opts.productName));

  const registrationUrl = params.toString()
    ? `${WARRANTY_REGISTRATION_URL}?${params.toString()}`
    : WARRANTY_REGISTRATION_URL;

  // Show the CTA section
  safeExpand($w, '#warrantyCtaSection');

  // Wire the button
  safeCall(() => {
    $w('#warrantyCtaBtn').onClick(() => {
      wixLocation.to(registrationUrl);
    });
  });
}

/**
 * Load and display the member's warranty list on the Member Page.
 * Shows a repeater of warranties or an empty state message.
 *
 * @param {Object} opts
 * @param {Function} opts.$w — Wix selector function
 */
export async function initWarrantyList(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;

  safeCall(() => $w('#warrantyListLoading').show());
  safeCollapse($w, '#warrantyEmptyMsg');

  let warranties = [];
  try {
    const result = await getMyWarranties();
    if (result.success) {
      warranties = result.warranties || [];
    } else {
      console.warn('[WarrantyWidget] getMyWarranties failed:', result.error);
    }
  } catch (err) {
    console.error('[WarrantyWidget] getMyWarranties threw:', err);
  }

  safeCall(() => $w('#warrantyListLoading').hide());

  if (warranties.length === 0) {
    safeCollapse($w, '#warrantyListSection');
    safeExpand($w, '#warrantyEmptyMsg');
    return;
  }

  safeExpand($w, '#warrantyListSection');

  // Populate repeater
  safeCall(() => {
    $w('#warrantyRepeater').data = warranties.map(w => ({
      _id: w._id,
      planName: w.planName || 'Standard Warranty',
      productName: w.productName || 'Unknown Product',
      status: w.status || 'active',
      expiresAt: w.expiresAt ? _formatDate(w.expiresAt) : 'N/A',
      registeredAt: w.registeredAt ? _formatDate(w.registeredAt) : 'Not yet registered',
    }));

    $w('#warrantyRepeater').onItemReady(($item, itemData) => {
      safeCall(() => $item('#warrantyItemPlan').text = itemData.planName);
      safeCall(() => $item('#warrantyItemProduct').text = itemData.productName);
      safeCall(() => $item('#warrantyItemStatus').text = _formatStatus(itemData.status));
      safeCall(() => $item('#warrantyItemExpires').text = `Expires: ${itemData.expiresAt}`);
      safeCall(() => $item('#warrantyItemRegistered').text = `Registered: ${itemData.registeredAt}`);
    });
  });
}

/**
 * Format a date value to a readable string (e.g. "Apr 7, 2026").
 *
 * @param {Date|string} date
 * @returns {string}
 */
function _formatDate(date) {
  try {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return String(date);
  }
}

/**
 * Convert a status slug to a human-readable label.
 *
 * @param {string} status
 * @returns {string}
 */
function _formatStatus(status) {
  const labels = {
    active: 'Active',
    expired: 'Expired',
    claimed: 'Claimed',
    cancelled: 'Cancelled',
  };
  return labels[status] ?? status;
}
