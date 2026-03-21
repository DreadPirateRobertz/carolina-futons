/**
 * @module pixelConsentService
 * @description Consent gate for TikTok and Pinterest pixel events.
 *
 * All pixel fires must pass through this module. Events fired before the
 * user grants analytics/advertising consent are queued and flushed
 * automatically when consent is granted (via onCurrentConsentPolicyChanged).
 *
 * Consent model (wix-privacy-frontend):
 *   policy.analytics    — required for analytics pixels (TikTok, Pinterest)
 *   policy.advertising  — required for ad retargeting pixels
 *
 * Usage:
 *   import { initConsentGate, fireTrackedTikTokEvent, fireTrackedPinterestEvent } from 'public/pixelConsentService';
 *   $w.onReady(() => { initConsentGate(); });
 *   fireTrackedTikTokEvent('ViewContent', { value: 100 });
 */
import wixPrivacy from 'wix-privacy-frontend';
import { fireTikTokEvent } from 'public/tikTokPixel';
import { firePinterestEvent } from 'public/pinterestTag';

// ── Internal state ────────────────────────────────────────────────────

/** @type {Array<{platform: 'tiktok'|'pinterest', eventName: string, params: Object}>} */
let _queue = [];
let _listenerRegistered = false;

// Maximum queued events to prevent unbounded memory growth on pages where
// consent is never granted (e.g., EU users who decline all cookies).
const MAX_QUEUE_SIZE = 50;

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

// ── Queue flush ────────────────────────────────────────────────────────

function _flushQueue() {
  const pending = _queue.splice(0);
  for (const entry of pending) {
    try {
      if (entry.platform === 'tiktok') {
        fireTikTokEvent(entry.eventName, entry.params);
      } else if (entry.platform === 'pinterest') {
        firePinterestEvent(entry.eventName, entry.params);
      }
    } catch (e) {
      console.warn('[pixelConsentService] flush error for', entry.platform, entry.eventName, e);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Initialize the consent gate.
 * Registers a one-time listener for consent policy changes.
 * Safe to call multiple times — listener is registered only once.
 * Call this in $w.onReady() on pages that fire pixel events.
 */
export function initConsentGate() {
  if (_listenerRegistered) return;
  _listenerRegistered = true;

  try {
    wixPrivacy.onCurrentConsentPolicyChanged((event) => {
      const policy = event?.policy ?? {};
      if (policy.analytics === true && policy.advertising === true) {
        _flushQueue();
      }
    });
  } catch (e) {
    console.warn('[pixelConsentService] failed to register consent listener:', e);
  }
}

/**
 * Fire a TikTok pixel event, gated by consent.
 * If consent is not yet granted, the event is queued until it is.
 *
 * @param {string} eventName - TikTok event name (e.g., 'ViewContent', 'AddToCart')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTrackedTikTokEvent(eventName, params = {}) {
  if (_hasConsent()) {
    fireTikTokEvent(eventName, params);
  } else if (_queue.length < MAX_QUEUE_SIZE) {
    _queue.push({ platform: 'tiktok', eventName, params });
  }
}

/**
 * Fire a Pinterest Tag event, gated by consent.
 * If consent is not yet granted, the event is queued until it is.
 *
 * @param {string} eventName - Pinterest event name (e.g., 'viewcategory', 'addtocart')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTrackedPinterestEvent(eventName, params = {}) {
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

/** Clear the queue and reset listener registration (test use only) */
export function clearQueue() {
  _queue = [];
  _listenerRegistered = false;
}
