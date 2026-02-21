// timeConstants.js — Shared time duration constants
// Centralizes hardcoded timeouts, TTLs, and delays used across the codebase.

// ── UI Feedback ──────────────────────────────────────────────────
// Standard timeout for resetting button labels after action ("Added!" → "Add to Cart")
export const BUTTON_RESET_MS = 3000;

// Standard timeout for auto-hiding success/error messages
export const FEEDBACK_DISMISS_MS = 4000;

// Copy-to-clipboard confirmation display time
export const COPY_CONFIRM_MS = 2000;

// ── Debounce / Throttle ─────────────────────────────────────────
// Default debounce delay for search/filter inputs
export const DEBOUNCE_MS = 300;

// ── Cache TTL ───────────────────────────────────────────────────
// Server-side in-memory cache TTL (facets, search results)
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Client-side product cache TTL
export const PRODUCT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Event Batching ──────────────────────────────────────────────
// Analytics event queue flush interval
export const EVENT_FLUSH_MS = 5000;

// ── Business Policy Durations (days) ────────────────────────────
export const RETURN_WINDOW_DAYS = 30;
export const GIFT_CARD_EXPIRY_DAYS = 365;
export const COUPON_DEFAULT_EXPIRY_DAYS = 30;
export const REFERRAL_CREDIT_EXPIRY_DAYS = 90;

// ── Backend Timing ──────────────────────────────────────────────
// Abandoned cart recovery: minimum age before sending recovery email
export const CART_RECOVERY_DELAY_MS = 60 * 60 * 1000; // 1 hour

// Contact form rate limit window
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Stats lookback window
export const STATS_LOOKBACK_DAYS = 30;

// ── Animation Durations ─────────────────────────────────────────
// Standard Wix show/hide animation durations (for reference; inline use is fine)
export const ANIM_FAST_MS = 200;
export const ANIM_MEDIUM_MS = 300;
export const ANIM_SLOW_MS = 400;
