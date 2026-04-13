/**
 * @module pixelConsentService
 * @description Consent gate for GA4, TikTok, and Pinterest pixel events.
 *
 * All pixel fires must pass through this module. Events fired before the
 * user grants the required consent are queued and flushed automatically
 * when consent is granted (via onCurrentConsentPolicyChanged).
 *
 * Consent model (wix-privacy-frontend):
 *   policy.analytics    — required for GA4 and analytics pixels
 *   policy.advertising  — additionally required for ad retargeting pixels
 *                         (TikTok, Pinterest are analytics + retargeting)
 *
 * Platform consent matrix:
 *   GA4       — analytics only (flushed as soon as analytics consent granted)
 *   TikTok    — analytics AND advertising (retargeting pixel)
 *   Pinterest — analytics AND advertising (retargeting pixel)
 *
 * Usage:
 *   import { initConsentGate, fireTrackedGA4Event, fireTrackedTikTokEvent, fireTrackedPinterestEvent } from 'public/pixelConsentService';
 *   $w.onReady(() => { initConsentGate(); });
 *   fireTrackedGA4Event('AddToCart', { value: 100 });
 */
import wixPrivacy from 'wix-privacy-frontend';
import { fireGA4Event } from 'public/ga4Tracking';
import { fireTikTokEvent } from 'public/tikTokPixel';
import { firePinterestEvent } from 'public/pinterestTag';

// ── Internal state ────────────────────────────────────────────────────

/** @type {Array<{platform: 'ga4'|'tiktok'|'pinterest', eventName: string, params: Object}>} */
let _queue = [];
let _listenerRegistered = false;

// Maximum queued events to prevent unbounded memory growth on pages where
// consent is never granted (e.g., EU users who decline all cookies).
const MAX_QUEUE_SIZE = 50;

// Deduplication: track order IDs that have already fired a Purchase event.
// Prevents double-firing when purchase confirmation is rendered multiple times
// (e.g., on page reload, server-side + client-side render both running).
/** @type {Set<string>} */
let _firedPurchaseOrderIds = new Set();

// ── Consent check ─────────────────────────────────────────────────────

function _hasConsent() {
  try {
    const { policy } = wixPrivacy.getCurrentConsentPolicy();
    // Require BOTH analytics AND advertising consent. TikTok and Pinterest
    // are used for both analytics and ad retargeting — partial consent is
    // insufficient and would violate the user's stated preferences.
    return policy.analytics === true && policy.advertising === true;
  } catch (e) {
    // If the privacy API is unavailable, default to not firing
    return false;
  }
}

function _hasAnalyticsConsent() {
  try {
    const { policy } = wixPrivacy.getCurrentConsentPolicy();
    // GA4 is analytics-only — advertising consent is not required.
    return policy.analytics === true;
  } catch (e) {
    return false;
  }
}

function _canFire(platform, policy) {
  if (platform === 'ga4') return policy.analytics === true;
  return policy.analytics === true && policy.advertising === true;
}

// ── Queue flush ────────────────────────────────────────────────────────

function _flushQueue(policy) {
  const remaining = [];
  for (const entry of _queue) {
    if (!_canFire(entry.platform, policy)) {
      remaining.push(entry);
      continue;
    }
    try {
      if (entry.platform === 'ga4') {
        fireGA4Event(entry.eventName, entry.params);
      } else if (entry.platform === 'tiktok') {
        fireTikTokEvent(entry.eventName, entry.params);
      } else if (entry.platform === 'pinterest') {
        firePinterestEvent(entry.eventName, entry.params);
      }
    } catch (e) {
      console.warn('[pixelConsentService] flush error for', entry.platform, entry.eventName, e);
    }
  }
  _queue = remaining;
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initialize the consent gate.
 * Registers a one-time listener for consent policy changes.
 * Safe to call multiple times — listener is registered only once per successful
 * registration. If the Wix Privacy API throws on registration, the flag is
 * reset so the next call can retry. In that failure mode, queued events will
 * not be flushed automatically until registration succeeds.
 * Call this in $w.onReady() on pages that fire pixel events.
 */
export function initConsentGate() {
  if (_listenerRegistered) return;
  _listenerRegistered = true; // optimistic lock — reset on failure below

  try {
    wixPrivacy.onCurrentConsentPolicyChanged((event) => {
      const policy = event?.policy ?? {};
      // Analytics-only grant flushes GA4; full grant also flushes retargeting pixels.
      if (policy.analytics === true) {
        _flushQueue(policy);
      }
    });
  } catch (e) {
    _listenerRegistered = false; // allow retry on next call
    console.warn('[pixelConsentService] failed to register consent listener:', e);
  }
}

/**
 * Check and record purchase deduplication by order_id.
 * Returns true if the event should be suppressed (already fired for this order).
 *
 * @param {string} eventName
 * @param {Object} params
 * @returns {boolean} true if the event is a duplicate and should be skipped
 */
function _isDuplicatePurchase(eventName, params) {
  const normalizedName = eventName.toLowerCase();
  if (normalizedName !== 'purchase') return false;
  const orderId = params && params.order_id;
  if (!orderId) return false;
  if (_firedPurchaseOrderIds.has(String(orderId))) return true;
  _firedPurchaseOrderIds.add(String(orderId));
  return false;
}

/**
 * Fire a GA4 event, gated by analytics consent only (not advertising).
 * If analytics consent is not yet granted, the event is queued until it is.
 * Purchase events with a duplicate order_id are silently dropped.
 *
 * @param {string} eventName - GA4 event name (e.g., 'ViewContent', 'AddToCart', 'Purchase')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTrackedGA4Event(eventName, params = {}) {
  if (_isDuplicatePurchase(eventName, params)) return;
  if (_hasAnalyticsConsent()) {
    fireGA4Event(eventName, params);
  } else if (_queue.length < MAX_QUEUE_SIZE) {
    _queue.push({ platform: 'ga4', eventName, params });
  }
}

/**
 * Fire a TikTok pixel event, gated by consent.
 * If consent is not yet granted, the event is queued until it is.
 * Purchase events with a duplicate order_id are silently dropped.
 *
 * @param {string} eventName - TikTok event name (e.g., 'ViewContent', 'AddToCart')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTrackedTikTokEvent(eventName, params = {}) {
  if (_isDuplicatePurchase(eventName, params)) return;
  if (_hasConsent()) {
    fireTikTokEvent(eventName, params);
  } else if (_queue.length < MAX_QUEUE_SIZE) {
    _queue.push({ platform: 'tiktok', eventName, params });
  }
}

/**
 * Fire a Pinterest Tag event, gated by consent.
 * If consent is not yet granted, the event is queued until it is.
 * Purchase events with a duplicate order_id are silently dropped.
 *
 * @param {string} eventName - Pinterest event name (e.g., 'viewcategory', 'addtocart')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTrackedPinterestEvent(eventName, params = {}) {
  if (_isDuplicatePurchase(eventName, params)) return;
  if (_hasConsent()) {
    firePinterestEvent(eventName, params);
  } else if (_queue.length < MAX_QUEUE_SIZE) {
    _queue.push({ platform: 'pinterest', eventName, params });
  }
}

// ── Test helpers (not for production use) ─────────────────────────────

/** @returns {number} Number of events currently in the queue */
export function getQueueLength() {
  return _queue.length;
}

/**
 * Clear the queue AND reset listener registration flag AND deduplication state.
 * Resets the module to its initial state. For test use only —
 * call in beforeEach before re-calling initConsentGate().
 */
export function clearQueue() {
  _queue = [];
  _listenerRegistered = false;
  _firedPurchaseOrderIds = new Set();
}
