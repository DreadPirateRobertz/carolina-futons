/**
 * @module CouponCodeInput
 * @description Coupon code input UX for Cart Page.
 * Handles validation, loading state, success/error display, and removal.
 *
 * Element IDs used:
 *   #couponSection, #couponInput, #couponApplyBtn, #couponError,
 *   #couponErrorText, #couponSuccess, #couponSuccessText, #couponRemoveBtn,
 *   #couponLoadingIcon
 *
 * @requires public/a11yHelpers.js
 * @requires wix-stores-frontend
 */
import { announce } from 'public/a11yHelpers.js';
import wixStoresFrontend from 'wix-stores-frontend';

const MAX_CODE_LENGTH = 50;
const VALID_CODE_PATTERN = /^[A-Z0-9_-]+$/;

/**
 * Initialize the coupon code input on the cart page.
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {Object} [options.appliedCoupon] - Already applied coupon { code, name }
 * @param {Function} [options.onApplied] - Callback after successful apply
 * @param {Function} [options.onRemoved] - Callback after successful removal
 */
export async function initCouponCodeInput($w, options = {}) {
  try {
    // Reset UI state
    try { $w('#couponError').hide(); } catch (e) { console.warn('[CouponCodeInput] hide error failed:', e?.message); }
    try { $w('#couponSuccess').hide(); } catch (e) { console.warn('[CouponCodeInput] hide success failed:', e?.message); }
    try { $w('#couponSection').show(); } catch (e) { console.warn('[CouponCodeInput] show section failed:', e?.message); }

    // ARIA
    try { $w('#couponInput').accessibility.ariaLabel = 'Enter coupon code'; } catch (e) { console.warn('[CouponCodeInput] ARIA input failed:', e?.message); }
    try { $w('#couponApplyBtn').accessibility.ariaLabel = 'Apply coupon code'; } catch (e) { console.warn('[CouponCodeInput] ARIA btn failed:', e?.message); }
    try { $w('#couponError').accessibility.ariaLive = 'assertive'; } catch (e) {}
    try { $w('#couponError').accessibility.role = 'alert'; } catch (e) {}
    try { $w('#couponSuccess').accessibility.ariaLive = 'polite'; } catch (e) {}

    // If coupon already applied, show success state
    if (options.appliedCoupon?.code) {
      showAppliedState($w, options.appliedCoupon.code);
    }

    // Wire apply button
    $w('#couponApplyBtn').onClick(async () => {
      try {
        const code = $w('#couponInput').value;
        const result = await applyCouponCode($w, code);
        if (result.success && typeof options.onApplied === 'function') {
          options.onApplied(result);
        }
      } catch (e) {
        console.error('[CouponCodeInput] onClick failed:', e?.message || e);
      }
    });

    // Wire Enter key
    $w('#couponInput').onKeyPress((event) => {
      try {
        if (event.key === 'Enter') {
          $w('#couponApplyBtn').onClick.mock
            ? null // test environment
            : $w('#couponApplyBtn').click?.();
        }
      } catch (e) {
        console.warn('[CouponCodeInput] keypress handler failed:', e?.message);
      }
    });

    // Wire remove button
    try {
      $w('#couponRemoveBtn').onClick(async () => {
        try {
          const couponId = $w('#couponRemoveBtn').getAttribute?.('data-coupon-id') || options.appliedCoupon?._id;
          const result = await removeCouponCode($w, couponId);
          if (result.success && typeof options.onRemoved === 'function') {
            options.onRemoved(result);
          }
        } catch (e) {
          console.error('[CouponCodeInput] remove onClick failed:', e?.message || e);
        }
      });
    } catch (e) { console.warn('[CouponCodeInput] remove btn wire failed:', e?.message); }
  } catch (e) {
    console.error('[CouponCodeInput] Init failed:', e?.message || e);
  }
}

/**
 * Validate and apply a coupon code to the cart.
 * @param {Function} $w - Wix selector function
 * @param {string} code - Raw coupon code input
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function applyCouponCode($w, code) {
  // Hide previous messages
  try { $w('#couponError').hide(); } catch (e) {}
  try { $w('#couponSuccess').hide(); } catch (e) {}

  // ── Validation ──────────────────────────────────────────────────
  if (code == null || typeof code !== 'string') {
    showError($w, 'Please enter a coupon code.');
    return { success: false, message: 'Please enter a coupon code.' };
  }

  const trimmed = code.trim().toUpperCase();

  if (!trimmed) {
    showError($w, 'Please enter a coupon code.');
    return { success: false, message: 'Please enter a coupon code.' };
  }

  if (trimmed.length > MAX_CODE_LENGTH) {
    showError($w, 'Invalid coupon code — too long.');
    return { success: false, message: 'Invalid coupon code — too long.' };
  }

  if (!VALID_CODE_PATTERN.test(trimmed)) {
    showError($w, 'Invalid coupon code format.');
    return { success: false, message: 'Invalid coupon code format.' };
  }

  // ── Loading state ───────────────────────────────────────────────
  try { $w('#couponApplyBtn').disable(); } catch (e) {}
  try { $w('#couponApplyBtn').label = 'Applying...'; } catch (e) {}
  try { $w('#couponLoadingIcon').show(); } catch (e) {}

  try {
    await wixStoresFrontend.cart.applyCoupon(trimmed);

    // ── Success state ─────────────────────────────────────────────
    showAppliedState($w, trimmed);
    announce($w, `Coupon ${trimmed} applied successfully`);

    return { success: true, code: trimmed };
  } catch (err) {
    const msg = parseCouponError(err);
    showError($w, msg);
    announce($w, `Coupon invalid: ${msg}`);

    return { success: false, message: msg };
  } finally {
    // Re-enable button
    try { $w('#couponApplyBtn').enable(); } catch (e) {}
    try { $w('#couponApplyBtn').label = 'Apply'; } catch (e) {}
    try { $w('#couponLoadingIcon').hide(); } catch (e) {}
  }
}

/**
 * Remove an applied coupon from the cart.
 * @param {Function} $w - Wix selector function
 * @param {string} couponId - Coupon ID to remove
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function removeCouponCode($w, couponId) {
  try {
    await wixStoresFrontend.cart.removeCoupon(couponId);

    // Reset to input state
    try { $w('#couponSuccess').hide(); } catch (e) {}
    try { $w('#couponInput').show(); } catch (e) {}
    try { $w('#couponInput').value = ''; } catch (e) {}
    try { $w('#couponApplyBtn').show(); } catch (e) {}

    announce($w, 'Coupon removed');
    return { success: true };
  } catch (err) {
    console.error('[CouponCodeInput] Remove failed:', err?.message || err);
    showError($w, 'Failed to remove coupon. Please try again.');
    return { success: false, message: 'Failed to remove coupon.' };
  }
}

// ── Internal Helpers ────────────────────────────────────────────────

function showError($w, message) {
  try {
    $w('#couponErrorText').text = message;
    $w('#couponError').show();
  } catch (e) {
    console.warn('[CouponCodeInput] showError failed:', e?.message);
  }
}

function showAppliedState($w, code) {
  try { $w('#couponSuccessText').text = `Coupon ${code} applied`; } catch (e) {}
  try { $w('#couponSuccess').show(); } catch (e) {}
  try { $w('#couponError').hide(); } catch (e) {}
  try { $w('#couponInput').hide(); } catch (e) {}
  try { $w('#couponApplyBtn').hide(); } catch (e) {}
}

function parseCouponError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('not found') || msg.includes('does not exist')) {
    return 'Coupon code not found. Please check and try again.';
  }
  if (msg.includes('expired')) {
    return 'This coupon has expired.';
  }
  if (msg.includes('minimum') || msg.includes('subtotal')) {
    return 'Your cart does not meet the minimum for this coupon.';
  }
  if (msg.includes('already applied') || msg.includes('duplicate')) {
    return 'This coupon is already applied.';
  }
  return 'Could not apply coupon. Please try again.';
}
