// proactiveChatTriggers.js — Proactive chat nudges on Product Page & Checkout
// Triggers a bubble prompt after a configurable delay, with frequency capping,
// offline fallback messaging, mobile detection, and full keyboard accessibility.
// Integrated from LiveChat.js via initProactiveTriggers() after chat widget init.

import { trackEvent } from 'public/engagementTracker';
import { breakpoints } from 'public/designTokens.js';

// ── Constants ───────────────────────────────────────────────────────
const MAX_IMPRESSIONS_PER_SESSION = 2;
const SESSION_KEY_DISMISSED = 'cf_chat_proactive_dismissed';
const SESSION_KEY_IMPRESSIONS = 'cf_chat_proactive_impressions';

const DEFAULT_DELAYS = {
  product: 30000,
  checkout: 10000,
};

const PAGE_MESSAGES = {
  product: {
    online: 'Need help choosing? Chat with us!',
    offline: 'Leave us a message — we\'ll get back to you within 1 business day!',
  },
  checkout: {
    online: 'Need help completing your order? Chat with us!',
    offline: 'Questions about your order? Leave a message and we\'ll follow up!',
  },
};

// ── State ───────────────────────────────────────────────────────────

let _state = {
  initialized: false,
  isMobile: false,
  timerId: null,
  keydownHandler: null,
  $w: null,
};

// ── Public API ──────────────────────────────────────────────────────

/**
 * Initialize proactive chat triggers for the current page.
 * @param {Function} $w - Wix $w selector
 * @param {Object} options
 * @param {string} options.page - Page type: 'product' | 'checkout'
 * @param {number} [options.delayMs] - Override trigger delay in ms
 * @param {boolean} [options.isOnline=true] - Whether chat agents are currently online
 */
export function initProactiveTriggers($w, options = {}) {
  // Clean up any previous init (SPA navigation — page changed but same session)
  cleanupProactiveTriggers();

  const { page, delayMs, isOnline = true } = options;

  // Only trigger on supported pages
  if (!PAGE_MESSAGES[page]) return;

  _state.initialized = true;
  _state.$w = $w;
  _state.isMobile = _detectMobile();

  // Set ARIA labels immediately
  _setAriaLabels($w);

  // Register dismiss and bubble click handlers
  _registerHandlers($w, isOnline);

  // Register keyboard listener
  _registerKeyboard($w);

  // Check eligibility before scheduling
  if (!shouldShowTrigger(page)) return;

  const rawDelay = delayMs ?? DEFAULT_DELAYS[page];
  const delay = typeof rawDelay === 'number' && rawDelay >= 0 ? rawDelay : DEFAULT_DELAYS[page];

  _state.timerId = setTimeout(() => {
    _showBubble($w, page, isOnline);
  }, delay);
}

/**
 * Clean up all proactive trigger listeners and timers.
 * Safe to call multiple times or without prior init.
 */
export function cleanupProactiveTriggers() {
  if (_state.timerId !== null) {
    clearTimeout(_state.timerId);
    _state.timerId = null;
  }

  if (_state.keydownHandler && typeof document !== 'undefined') {
    try {
      document.removeEventListener('keydown', _state.keydownHandler);
    } catch (e) {}
  }

  _state = {
    initialized: false,
    isMobile: false,
    timerId: null,
    keydownHandler: null,
    $w: null,
  };
}

/**
 * Check if a proactive trigger should fire for the given page.
 * @param {string} page
 * @returns {boolean}
 */
export function shouldShowTrigger(page) {
  if (!PAGE_MESSAGES[page]) return false;
  if (_isDismissed()) return false;
  if (_getImpressionCount() >= MAX_IMPRESSIONS_PER_SESSION) return false;
  return true;
}

/**
 * Get the proactive message for a page type.
 * @param {string} page
 * @param {boolean} [isOnline=true]
 * @returns {string|null}
 */
export function getPageMessage(page, isOnline = true) {
  const messages = PAGE_MESSAGES[page];
  if (!messages) return null;
  return isOnline ? messages.online : messages.offline;
}

/**
 * Record a user dismissal of the proactive bubble.
 */
export function recordDismissal() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY_DISMISSED, '1');
    }
  } catch (e) {}
}

/**
 * Reset dismissal flag (e.g., on new page navigation within same session).
 * Impressions count is NOT reset — that persists for the session.
 */
export function resetDismissals() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY_DISMISSED);
    }
  } catch (e) {}
}

/**
 * Test-only: inspect internal state.
 * @returns {Object}
 */
export function _getState() {
  return { ..._state };
}

// ── Internal ────────────────────────────────────────────────────────

function _showBubble($w, page, isOnline) {
  try {
    // Don't show if chat widget is already open
    try {
      if (!$w('#chatWidget').hidden) return;
    } catch (e) {}

    const message = getPageMessage(page, isOnline);
    if (!message) return;

    try {
      const bubble = $w('#proactiveBubble');
      bubble.text = message;
      bubble.show();
    } catch (e) {
      return; // bubble element missing — silently bail
    }

    _incrementImpressions();

    try {
      trackEvent('proactive_chat_shown', { page, isOnline, isMobile: _state.isMobile });
    } catch (e) {}
  } catch (e) {}
}

function _setAriaLabels($w) {
  try {
    $w('#proactiveBubble').accessibility.ariaLabel = 'Chat with us — click to open live chat';
    $w('#proactiveBubble').accessibility.role = 'alert';
  } catch (e) {}
  try {
    $w('#proactiveDismissBtn').accessibility.ariaLabel = 'Dismiss chat prompt';
  } catch (e) {}
}

function _registerHandlers($w, isOnline) {
  // Dismiss button
  try {
    $w('#proactiveDismissBtn').onClick(() => {
      try { $w('#proactiveBubble').hide(); } catch (e) {}
      recordDismissal();
    });
  } catch (e) {}

  // Bubble click opens chat
  try {
    $w('#proactiveBubble').onClick(() => {
      try { $w('#proactiveBubble').hide(); } catch (e) {}
      try {
        $w('#chatWidget').show('slide', { direction: 'bottom', duration: 300 });
      } catch (e) {}
      try {
        trackEvent('proactive_chat_clicked', { isOnline, isMobile: _state.isMobile });
      } catch (e) {}
    });
  } catch (e) {}
}

function _registerKeyboard($w) {
  if (typeof document === 'undefined') return;

  try {
    _state.keydownHandler = (e) => {
      if (e.key === 'Escape') {
        try {
          const bubble = $w('#proactiveBubble');
          if (!bubble.hidden) {
            bubble.hide();
            recordDismissal();
          }
        } catch (err) {}
      }
    };
    document.addEventListener('keydown', _state.keydownHandler);
  } catch (e) {}
}

function _detectMobile() {
  try {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= breakpoints.tablet;
    }
  } catch (e) {}
  return false;
}

function _isDismissed() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(SESSION_KEY_DISMISSED) === '1';
    }
  } catch (e) {}
  return false;
}

function _getImpressionCount() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return parseInt(sessionStorage.getItem(SESSION_KEY_IMPRESSIONS) || '0', 10);
    }
  } catch (e) {}
  return 0;
}

function _incrementImpressions() {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const count = _getImpressionCount() + 1;
      sessionStorage.setItem(SESSION_KEY_IMPRESSIONS, String(count));
    }
  } catch (e) {}
}
