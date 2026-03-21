/**
 * @module exitIntentCapture
 * @description Testable exit-intent popup logic — session gating, email validation,
 * config/copy, and page exclusion. Decoupled from $w() DOM so it can run in vitest.
 * The masterPage.js wires this into the actual Wix elements.
 */

export const EXIT_INTENT_STORAGE_KEY = 'cf_exit_shown';

/**
 * Scroll velocity threshold (px/ms) for detecting mobile exit intent.
 * A rapid upward scroll indicates the user may be trying to leave.
 */
export const SCROLL_EXIT_VELOCITY_THRESHOLD = 3;

const EXCLUDED_PATHS = ['cart', 'checkout', 'thank-you'];

/**
 * Whether the exit-intent popup should be shown on this page visit.
 * @param {string} [currentPath] - Current page path (e.g. '/products/blue-ridge')
 * @returns {boolean}
 */
export function shouldShowExitIntent(currentPath) {
  // Already shown this session?
  try {
    if (sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY)) return false;
  } catch (_) { /* sessionStorage unavailable — allow showing */ }

  // Excluded pages (cart, checkout, thank-you)
  const path = (currentPath || '').toLowerCase();
  if (EXCLUDED_PATHS.some(p => path.includes(p))) return false;

  return true;
}

/**
 * Mark the exit-intent popup as shown for this session.
 */
export function markExitIntentShown() {
  try {
    sessionStorage.setItem(EXIT_INTENT_STORAGE_KEY, '1');
  } catch (_) { /* sessionStorage unavailable — best effort */ }
}

/**
 * Mark the exit-intent popup as dismissed (same effect as shown — prevents re-display).
 */
export function markExitIntentDismissed() {
  markExitIntentShown();
}

/**
 * Validate an email address for the capture form.
 * @param {string} email
 * @returns {boolean}
 */
export function validateCaptureEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed);
}

/**
 * Get exit-intent popup copy/config. Centralizes all strings so masterPage.js
 * doesn't hard-code them.
 * @returns {Object}
 */
export function getExitIntentConfig() {
  return {
    title: 'Wait \u2014 Before You Go!',
    subtitle: 'Get 10% off your first order. Join our community for exclusive deals and early access.',
    ctaText: 'Get My 10% Off',
    successMessage: 'Check your inbox! Use code WELCOME10 for 10% off your first order.',
    emailPlaceholder: 'Enter your email',
    ariaLabel: 'Special offer before you go',
    closeAriaLabel: 'Close popup',
    discountCode: 'WELCOME10',
  };
}

/**
 * Get mobile-specific exit-intent config. Extends base config with
 * bottom sheet animation and swipe dismiss settings.
 * @returns {Object}
 */
export function getMobileExitIntentConfig() {
  const base = getExitIntentConfig();
  return {
    ...base,
    animation: 'slide',
    animationDirection: 'bottom',
    swipeDismissThreshold: 80,
  };
}

/**
 * Detect whether a scroll velocity indicates mobile exit intent.
 * Positive velocity = scrolling up (toward top of page / leaving).
 * @param {number} velocityPxPerMs - Scroll velocity in px/ms (positive = upward)
 * @returns {boolean}
 */
export function detectScrollExit(velocityPxPerMs) {
  if (typeof velocityPxPerMs !== 'number' || isNaN(velocityPxPerMs)) return false;
  return velocityPxPerMs >= SCROLL_EXIT_VELOCITY_THRESHOLD;
}

/**
 * Open the exit-intent lightbox element.
 * Requires Stilgar to add one Lightbox element named `exitIntentLightbox` in the editor.
 * Uses dynamic import so this module remains testable in vitest (no Wix DOM dependency).
 *
 * @param {Object} [data] - Data passed to the lightbox (offer text, etc.)
 * @returns {Promise<void>}
 */
export async function openExitIntentLightbox(data) {
  try {
    const { openLightbox } = await import('wix-window-frontend');
    await openLightbox('exitIntentLightbox', data || {});
  } catch (err) {
    console.warn('[exitIntentCapture] openLightbox unavailable:', err.message);
  }
}

// Minimum time on page (ms) before cursor-leave detection fires.
export const MIN_TIME_ON_PAGE_MS = 30 * 1000;

// clientY threshold: values at or below this indicate cursor reached browser chrome.
const CURSOR_LEAVE_Y_THRESHOLD = 10;

/**
 * Initialize desktop cursor-leave exit-intent detection.
 * Listens for `mouseleave` on document. Only fires after MIN_TIME_ON_PAGE_MS
 * and only once per session (uses sessionStorage flag).
 *
 * @param {string} [currentPath] - Current page path (for page exclusion check)
 * @param {Object} [opts] - Injectable overrides for testability
 * @param {Object} [opts.doc] - document-like object (default: globalThis.document)
 * @param {Function} [opts.now] - Returns current time in ms (default: Date.now)
 * @returns {Function} Cleanup function — removes the event listener
 */
export function initCursorLeaveDetection(currentPath, opts = {}) {
  const doc = opts.doc || (typeof document !== 'undefined' ? document : null);
  if (!doc) return () => {};

  if (!shouldShowExitIntent(currentPath)) return () => {};

  const getNow = opts.now || Date.now;
  const startTime = getNow();

  function onMouseLeave(e) {
    // Only fire when cursor exits through top edge (toward browser chrome)
    // clientY must be present and within threshold (undefined/null → unknown direction, skip)
    if (e.clientY == null || e.clientY > CURSOR_LEAVE_Y_THRESHOLD) return;

    // Enforce minimum time on page
    if (getNow() - startTime < MIN_TIME_ON_PAGE_MS) return;

    // Re-check session flag in case another trigger already fired
    if (!shouldShowExitIntent(currentPath)) return;

    // Remove listener first to prevent any race, then mark + open
    doc.removeEventListener('mouseleave', onMouseLeave);
    markExitIntentShown();
    openExitIntentLightbox({ discount: '10OFF', expiry: '48h' });
  }

  doc.addEventListener('mouseleave', onMouseLeave);
  return () => doc.removeEventListener('mouseleave', onMouseLeave);
}

/**
 * Submit exit-intent email capture via emailService + couponsService.
 * Subscribes the email to the newsletter and generates a single-use 10% coupon.
 *
 * @param {string} email - Email from the popup form
 * @returns {Promise<{success: boolean, couponCode?: string, error?: string}>}
 */
export async function submitExitIntentEmail(email) {
  if (!validateCaptureEmail(email)) {
    return { success: false, error: 'invalid_email' };
  }

  try {
    const { subscribeToNewsletter } = await import('backend/newsletterService.web');
    const subResult = await subscribeToNewsletter(email, { source: 'exit_intent_popup' });
    if (!subResult.success) {
      return { success: false, error: subResult.message || 'subscription_failed' };
    }

    // Generate single-use 10% coupon — failure is non-blocking
    let couponCode = null;
    try {
      const { createWelcomeCoupon } = await import('backend/couponsService.web');
      const couponResult = await createWelcomeCoupon(email);
      if (couponResult.success) {
        couponCode = couponResult.code;
      }
    } catch (couponErr) {
      console.warn('[exitIntentCapture] Coupon generation failed (non-blocking):', couponErr.message);
    }

    return { success: true, couponCode };
  } catch (err) {
    console.error('[exitIntentCapture] submitExitIntentEmail failed:', err);
    return { success: false, error: 'submission_failed' };
  }
}

/**
 * Submit exit-intent email capture: validate, subscribe, queue welcome series.
 * @param {string} email - Email from the popup form
 * @returns {Promise<{success: boolean, discountCode?: string, error?: string, message?: string}>}
 */
export async function submitExitCapture(email) {
  if (!validateCaptureEmail(email)) {
    return { success: false, error: 'invalid_email' };
  }

  try {
    const { subscribeToNewsletter, captureExitIntentEmail } = await import('backend/newsletterService.web');
    const result = await subscribeToNewsletter(email, { source: 'exit_intent_popup' });

    if (!result.success) {
      return result;
    }

    // Queue welcome series into EmailQueue — failure here should not block capture
    try {
      await captureExitIntentEmail(email);
    } catch (queueErr) {
      console.warn('EmailQueue welcome series failed (non-blocking):', queueErr);
    }

    markExitIntentShown();
    return result;
  } catch (err) {
    console.error('Exit intent submission failed:', err);
    return { success: false, error: 'submission_failed' };
  }
}
