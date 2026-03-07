/**
 * @module BrowseReminder
 * Browse abandonment tracking and "Remind Me" popup for product pages.
 * Tracks product view sessions and captures email for browse recovery emails.
 */
import { trackBrowseSession, captureRemindMeRequest } from 'backend/browseAbandonment.web';
import { validateEmail } from 'public/validators.js';
import { createFocusTrap, announce } from 'public/a11yHelpers.js';
import wixLocationFrontend from 'wix-location-frontend';

/**
 * Create a fresh browse state object.
 * @returns {{ sessionId: string, startTime: number, productsViewed: Array }}
 */
export function _createBrowseState() {
  return {
    sessionId: '',
    startTime: Date.now(),
    productsViewed: [],
  };
}

/**
 * Initialize browse abandonment tracking for the current product page visit.
 * Records product views, schedules the remind-me popup after 2 minutes,
 * and sends session data on page visibility change or navigation.
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} state - Shared product page state
 * @param {Object} state.product - Current product with _id, name, price
 * @param {Object} browseState - Mutable browse tracking state
 * @returns {void}
 */
export function initBrowseTracking($w, state, browseState) {
  try {
    if (!state.product) return;

    // Generate or retrieve session ID
    if (typeof sessionStorage !== 'undefined') {
      try {
        browseState.sessionId = sessionStorage.getItem('cf_browse_session') || '';
        if (!browseState.sessionId) {
          browseState.sessionId = 'bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem('cf_browse_session', browseState.sessionId);
        }
      } catch (e) {}
    }
    if (!browseState.sessionId) {
      browseState.sessionId = 'bs_' + Date.now();
    }

    // Record this product view
    browseState.productsViewed.push({
      productId: state.product._id,
      productName: state.product.name || '',
      price: state.product.price || 0,
      viewStart: Date.now(),
    });

    // Send session data on page visibility change or navigate away
    let _browseSessionSent = false;
    const sendOnce = () => {
      if (_browseSessionSent) return;
      _browseSessionSent = true;
      sendBrowseSession(browseState);
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sendOnce();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', sendOnce);
    }

    // Show "Remind Me" popup after 2 minutes of viewing
    setTimeout(() => {
      showRemindMePopup($w, browseState);
    }, 2 * 60 * 1000);
  } catch (e) {
    // Browse tracking is non-critical
  }
}

/**
 * Send the accumulated browse session data to the backend.
 * @param {Object} browseState - Browse tracking state
 * @returns {void}
 */
function sendBrowseSession(browseState) {
  try {
    const now = Date.now();
    const products = browseState.productsViewed.map(p => ({
      productId: p.productId,
      productName: p.productName,
      price: p.price,
      viewDuration: now - p.viewStart,
    }));

    const currentPath = '/' + (wixLocationFrontend.path || []).join('/');

    trackBrowseSession({
      sessionId: browseState.sessionId,
      productsViewed: products,
      totalDuration: now - browseState.startTime,
      entryPage: currentPath,
      exitPage: currentPath,
    }).catch(err => console.error('[BrowseReminder] trackBrowseSession failed:', err.message));
  } catch (e) {}
}

/**
 * Show the "Remind Me" popup for browse abandonment email capture.
 * Validates email, captures via backend, shows success/error states.
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} browseState - Browse tracking state with sessionId
 * @returns {void}
 */
export function showRemindMePopup($w, browseState) {
  try {
    const popup = $w('#remindMePopup');
    if (!popup) return;

    // Don't show if already dismissed this session
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem('cf_remind_shown')) return;
      } catch (e) {}
    }

    try { $w('#remindMeTitle').text = 'Still deciding?'; } catch (e) {}
    try { $w('#remindMeSubtitle').text = "We'll remind you about this item — no spam, just a gentle nudge."; } catch (e) {}
    try { $w('#remindMeEmailInput').accessibility.ariaLabel = 'Enter your email for reminder'; } catch (e) {}
    try { $w('#remindMeSubmit').accessibility.ariaLabel = 'Get reminded about this product'; } catch (e) {}
    try { $w('#remindMeClose').accessibility.ariaLabel = 'Close reminder popup'; } catch (e) {}

    // Set dialog ARIA attributes
    try { popup.accessibility.role = 'dialog'; } catch (e) {}
    try { popup.accessibility.ariaModal = true; } catch (e) {}
    try { popup.accessibility.ariaLabel = 'Product reminder signup'; } catch (e) {}

    popup.show('fade', { duration: 300 });

    // Focus trap for modal accessibility
    let trap = null;
    try {
      trap = createFocusTrap($w, '#remindMePopup', ['#remindMeEmailInput', '#remindMeSubmit', '#remindMeClose']);
      $w('#remindMeEmailInput').focus();
    } catch (e) {}

    // Escape key dismiss
    const onEscape = (e) => {
      if (e.key === 'Escape') {
        if (trap) trap.release();
        popup.hide('fade', { duration: 200 });
        if (typeof document !== 'undefined') document.removeEventListener('keydown', onEscape);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onEscape);
    }

    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem('cf_remind_shown', '1'); } catch (e) {}
    }

    // Close handler
    try {
      $w('#remindMeClose').onClick(() => {
        if (trap) trap.release();
        popup.hide('fade', { duration: 200 });
        if (typeof document !== 'undefined') document.removeEventListener('keydown', onEscape);
      });
    } catch (e) {}

    // Submit handler
    try {
      $w('#remindMeSubmit').onClick(async () => {
        const email = $w('#remindMeEmailInput').value?.trim();
        if (!email || !validateEmail(email)) {
          try {
            const errEl = $w('#remindMeError');
            if (errEl) { errEl.text = 'Please enter a valid email address.'; errEl.show('fade', { duration: 300 }); }
          } catch (e) {}
          announce($w, 'Please enter a valid email address.');
          return;
        }

        try {
          $w('#remindMeSubmit').disable();
          $w('#remindMeSubmit').label = 'Saving...';

          await captureRemindMeRequest(browseState.sessionId, email);

          $w('#remindMeSubmit').label = 'Saved!';
          try { $w('#remindMeSuccess').text = "We'll send you a reminder."; } catch (e) {}
          try { $w('#remindMeSuccess').show('fade', { duration: 300 }); } catch (e) {}

          setTimeout(() => {
            try {
              if (trap) trap.release();
              popup.hide('fade', { duration: 200 });
              if (typeof document !== 'undefined') document.removeEventListener('keydown', onEscape);
            } catch (e) {}
          }, 3000);
        } catch (err) {
          $w('#remindMeSubmit').enable();
          $w('#remindMeSubmit').label = 'Remind Me';
          try {
            const errEl = $w('#remindMeError');
            if (errEl) { errEl.text = 'Something went wrong. Please try again.'; errEl.show('fade', { duration: 300 }); }
          } catch (e) {}
          announce($w, 'Something went wrong. Please try again.');
        }
      });
    } catch (e) {}
  } catch (e) {
    // Remind Me popup is non-critical
  }
}
