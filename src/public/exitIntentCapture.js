/**
 * @module exitIntentCapture
 * @description Testable exit-intent popup logic — session gating, email validation,
 * config/copy, and page exclusion. Decoupled from $w() DOM so it can run in vitest.
 * The masterPage.js wires this into the actual Wix elements.
 */

export const EXIT_INTENT_STORAGE_KEY = 'cf_exit_shown';

const EXCLUDED_PATHS = ['cart', 'checkout', 'thank-you'];

/**
 * Whether the exit-intent popup should be shown on this page visit.
 * @param {string} [currentPath] - Current page path (e.g. '/products/blue-ridge')
 * @returns {boolean}
 */
export function shouldShowExitIntent(currentPath) {
  // Already shown this session?
  try {
    if (globalThis.sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY)) return false;
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
    globalThis.sessionStorage.setItem(EXIT_INTENT_STORAGE_KEY, '1');
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
