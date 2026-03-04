// engagementTracker.js - Frontend Engagement & Conversion Tracking
// Tracks user behavior events for funnel analysis and retargeting.
// Events are batched and sent to the backend analytics module.
// Integrates with Wix Analytics and custom ProductAnalytics CMS.

import { trackProductView as backendTrackView, trackAddToCart, trackSocialShare as backendTrackShare } from 'backend/analyticsHelpers.web';

// ── Event Queue ──────────────────────────────────────────────────────
// Batch events to reduce backend calls

const _eventQueue = [];
let _flushTimer = null;
const FLUSH_INTERVAL = 5000; // 5s batch window

/**
 * Track a user engagement event. Events are batched and flushed periodically.
 * @param {string} eventType - Event name (e.g., 'page_view', 'add_to_cart')
 * @param {Object} [data={}] - Event-specific data
 */
export function trackEvent(eventType, data = {}) {
  if (!eventType || typeof eventType !== 'string') return;
  // Sanitize: only allow alphanumeric, underscores, hyphens
  const sanitized = eventType.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitized) return;

  _eventQueue.push({
    type: sanitized,
    data,
    timestamp: Date.now(),
    page: _getCurrentPage(),
  });

  // Start flush timer if not running
  if (!_flushTimer) {
    _flushTimer = setTimeout(flushEvents, FLUSH_INTERVAL);
  }
}

/**
 * Flush all queued events to backend. Called automatically on timer
 * and on page unload.
 */
export async function flushEvents() {
  if (_eventQueue.length === 0) return;

  const events = _eventQueue.splice(0);
  clearTimeout(_flushTimer);
  _flushTimer = null;

  // Process events by type for appropriate backend handling
  for (const event of events) {
    try {
      switch (event.type) {
        case 'product_view':
          await backendTrackView(
            event.data.productId,
            event.data.productName,
            event.data.category
          );
          break;
        case 'add_to_cart':
          await trackAddToCart(event.data.productId);
          break;
        case 'social_share':
          if (event.data.productId) {
            await backendTrackShare(event.data.productId, event.data.platform);
          }
          break;
        // Other events are tracked in session storage for local funnel analysis
        default:
          _storeLocalEvent(event);
          break;
      }
    } catch (e) {
      // Analytics is non-critical — never break the page
    }
  }
}

// ── Conversion Funnel Tracking ───────────────────────────────────────
// Tracks progression through key funnels for optimization

const FUNNELS = {
  purchase: ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase_complete'],
  engagement: ['page_view', 'product_view', 'gallery_interact', 'swatch_view', 'compare_add'],
  social: ['page_view', 'social_share', 'referral_click', 'newsletter_signup'],
  quiz: ['quiz_start', 'quiz_step_2', 'quiz_step_3', 'quiz_complete', 'quiz_product_click'],
};

/**
 * Get funnel progress for the current session.
 * @param {string} funnelName - One of: 'purchase', 'engagement', 'social', 'quiz'
 * @returns {{ steps: Array, currentStep: number, completionPct: number }}
 */
export function getFunnelProgress(funnelName) {
  const steps = FUNNELS[funnelName];
  if (!steps) return { steps: [], currentStep: 0, completionPct: 0 };

  const sessionEvents = _getSessionEvents();
  const eventTypes = new Set(sessionEvents.map(e => e.type));

  let currentStep = 0;
  for (const step of steps) {
    if (eventTypes.has(step)) {
      currentStep++;
    } else {
      break;
    }
  }

  return {
    steps,
    currentStep,
    completionPct: Math.round((currentStep / steps.length) * 100),
  };
}

// ── Pre-Built Event Helpers ──────────────────────────────────────────
// Convenience functions for common events

/** Track a product page view with category context. */
export function trackProductPageView(product) {
  if (!product || !product._id) return;
  trackEvent('product_view', {
    productId: product._id,
    productName: product.name,
    category: product.collections?.[0] || '',
    price: product.price,
  });
}

/** Track add-to-cart with product and variant info.
 * @param {Object|string} productOrId - Product object or product ID string
 * @param {number|string} [quantityOrName] - Quantity (when product object) or product name (legacy)
 * @param {string} [variant] - Variant info (legacy signature only)
 */
export function trackCartAdd(productOrId, quantityOrName, variant) {
  if (productOrId && typeof productOrId === 'object') {
    trackEvent('add_to_cart', {
      productId: productOrId._id || '',
      productName: productOrId.name || '',
      quantity: quantityOrName || 1,
      variant: variant || '',
    });
  } else {
    trackEvent('add_to_cart', {
      productId: productOrId,
      productName: quantityOrName || '',
      variant: variant || '',
    });
  }
}

/** Track checkout initiation. */
export function trackCheckoutStart(cartTotal, itemCount) {
  trackEvent('checkout_start', { cartTotal, itemCount });
}

/** Track completed purchase. */
export function trackPurchaseComplete(orderId, orderTotal) {
  trackEvent('purchase_complete', { orderId, orderTotal });
}

/**
 * Track social share action.
 * @param {string} platform - Platform name (facebook, pinterest, email, etc.)
 * @param {string} contentType - Content type (product, purchase, blog)
 * @param {string} [productId] - Product ID for per-product share tracking
 */
export function trackSocialShare(platform, contentType, productId) {
  trackEvent('social_share', { platform, contentType, productId });
}

/** Track newsletter signup. */
export function trackNewsletterSignup(source) {
  trackEvent('newsletter_signup', { source });
}

/** Track referral link copy/share. */
export function trackReferralAction(method) {
  trackEvent('referral_click', { method });
}

/** Track style quiz progression. */
export function trackQuizStep(stepNumber, answers) {
  trackEvent(`quiz_step_${stepNumber}`, { answers });
  if (stepNumber === 1) trackEvent('quiz_start', {});
}

/** Track quiz completion. */
export function trackQuizComplete(answers, resultCount) {
  trackEvent('quiz_complete', { answers, resultCount });
}

/** Track gallery/image interaction (zoom, lightbox, swipe). */
export function trackGalleryInteraction(action) {
  trackEvent('gallery_interact', { action });
}

/** Track swatch viewer usage. */
export function trackSwatchView(swatchId) {
  trackEvent('swatch_view', { swatchId });
}

/** Track product comparison. */
export function trackCompareAction(action, productId) {
  trackEvent('compare_add', { action, productId });
}

// ── Session Metrics ──────────────────────────────────────────────────

/**
 * Get engagement score for the current session (0-100).
 * Based on depth of interaction: views, interactions, cart, social.
 */
export function getEngagementScore() {
  const events = _getSessionEvents();
  if (events.length === 0) return 0;

  let score = 0;
  const types = new Set(events.map(e => e.type));

  // Base points for visiting
  score += 10;

  // Product engagement (up to 30 points)
  if (types.has('product_view')) score += 10;
  if (events.filter(e => e.type === 'product_view').length >= 3) score += 10;
  if (types.has('gallery_interact')) score += 5;
  if (types.has('swatch_view')) score += 5;

  // Cart intent (up to 20 points)
  if (types.has('add_to_cart')) score += 15;
  if (types.has('checkout_start')) score += 5;

  // Social/community (up to 20 points)
  if (types.has('social_share')) score += 10;
  if (types.has('newsletter_signup')) score += 5;
  if (types.has('referral_click')) score += 5;

  // Quiz engagement (up to 10 points)
  if (types.has('quiz_start')) score += 5;
  if (types.has('quiz_complete')) score += 5;

  // Time on site bonus (up to 10 points)
  const sessionDuration = Date.now() - (events[0]?.timestamp || Date.now());
  const minutes = sessionDuration / 60000;
  if (minutes > 2) score += 5;
  if (minutes > 5) score += 5;

  return Math.min(score, 100);
}

/**
 * Get session summary for display or backend sync.
 * @returns {{ eventCount: number, uniqueProducts: number, score: number, topFunnel: string }}
 */
export function getSessionSummary() {
  const events = _getSessionEvents();
  const productViews = events.filter(e => e.type === 'product_view');
  const uniqueProducts = new Set(productViews.map(e => e.data?.productId)).size;

  // Find best funnel progress
  let topFunnel = '';
  let topPct = 0;
  for (const name of Object.keys(FUNNELS)) {
    const { completionPct } = getFunnelProgress(name);
    if (completionPct > topPct) {
      topPct = completionPct;
      topFunnel = name;
    }
  }

  return {
    eventCount: events.length,
    uniqueProducts,
    score: getEngagementScore(),
    topFunnel: topFunnel ? `${topFunnel} (${topPct}%)` : 'none',
  };
}

// ── Synchronous Page-Exit Flush ──────────────────────────────────────
// Uses navigator.sendBeacon() for reliable event delivery on page exit.
// Falls back to localStorage persistence + recovery on next page load.

const PENDING_EVENTS_KEY = 'cf_pending_events';
const BEACON_ENDPOINT = '/_functions/trackEvents';

/**
 * Synchronously flush queued events on page exit using sendBeacon.
 * Unlike flushEvents(), this is safe to call from beforeunload because
 * it does not use async/await — sendBeacon is fire-and-forget.
 * Falls back to localStorage if sendBeacon is unavailable or fails.
 */
export function flushEventsSync() {
  if (_eventQueue.length === 0) return;

  const events = _eventQueue.splice(0);
  clearTimeout(_flushTimer);
  _flushTimer = null;

  // Also store local-only events to sessionStorage
  const localEvents = events.filter(e =>
    e.type !== 'product_view' && e.type !== 'add_to_cart'
  );
  for (const event of localEvents) {
    _storeLocalEvent(event);
  }

  // Try sendBeacon for backend-tracked events
  let beaconSent = false;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
      beaconSent = navigator.sendBeacon(BEACON_ENDPOINT, blob);
    }
  } catch (e) {
    // sendBeacon may throw in some environments
  }

  // Fallback: persist to localStorage for recovery on next page load
  if (!beaconSent) {
    _savePendingEvents(events);
  }
}

/**
 * Get pending events saved by a previous flushEventsSync fallback.
 * @returns {Array} Pending events from localStorage.
 */
export function _getPendingBeaconEvents() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PENDING_EVENTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}

/**
 * Recover pending events from localStorage and flush them via the async path.
 * Call this on page init to deliver events from a previous session's exit.
 */
export async function _recoverPendingEvents() {
  const pending = _getPendingBeaconEvents();
  if (pending.length === 0) return;

  // Clear immediately to prevent double-processing
  try {
    localStorage.removeItem(PENDING_EVENTS_KEY);
  } catch (e) {}

  // Re-queue and flush through the normal async path
  for (const event of pending) {
    _eventQueue.push(event);
  }
  await flushEvents();
}

function _savePendingEvents(events) {
  try {
    if (typeof localStorage !== 'undefined') {
      // Merge with any existing pending events
      const existing = _getPendingBeaconEvents();
      const merged = existing.concat(events);
      // Cap to prevent localStorage bloat
      if (merged.length > 200) merged.splice(0, merged.length - 200);
      localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(merged));
    }
  } catch (e) {}
}

// ── Page Unload Handler ──────────────────────────────────────────────
// Uses flushEventsSync (sendBeacon) instead of async flushEvents

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('beforeunload', () => {
      flushEventsSync();
    });
  } catch (e) {}
}

// ── Page Init: Recover Pending Events ────────────────────────────────
// On load, flush any events saved by a previous exit that couldn't sendBeacon

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('load', () => {
      _recoverPendingEvents();
    });
  } catch (e) {}
}

// ── Internal Helpers ─────────────────────────────────────────────────

const SESSION_EVENTS_KEY = 'cf_session_events';

function _getCurrentPage() {
  try {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
  } catch (e) {}
  return '/';
}

function _storeLocalEvent(event) {
  try {
    const stored = _getSessionEvents();
    stored.push(event);
    // Cap at 200 events per session
    if (stored.length > 200) stored.splice(0, stored.length - 200);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_EVENTS_KEY, JSON.stringify(stored));
    }
  } catch (e) {}
}

function _getSessionEvents() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_EVENTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {}
  return [];
}
