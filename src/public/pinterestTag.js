// pinterestTag.js - Pinterest Tag (Conversion Tag) initialization
// Loads the Pinterest tracking tag for conversion tracking and audience building.
// Fires a pagevisit event on initialization. Additional events (viewcategory,
// addtocart, checkout, purchase) can be fired via firePinterestEvent().
//
// Setup: Set your Pinterest Tag ID in the TAG_ID constant below, or
// configure it via Wix Dashboard > Marketing Integrations.

let TAG_ID = ''; // Set Pinterest Tag ID here when obtained

/**
 * Set the Pinterest Tag ID at runtime (useful for tests and dynamic config).
 * @param {string} id - Pinterest Tag ID
 */
export function setPinterestTagId(id) {
  TAG_ID = id || '';
}

/**
 * Initialize Pinterest Tag and fire initial pagevisit.
 * Safe to call on every page — guards against re-initialization and
 * missing browser globals.
 */
export function initPinterestTag() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.pintrk) return; // Already initialized

    if (!TAG_ID) return; // No tag ID configured

    /* eslint-disable */
    !function (e) {
      if (!window.pintrk) {
        window.pintrk = function () {
          window.pintrk.queue.push(Array.prototype.slice.call(arguments));
        };
        var n = window.pintrk;
        n.queue = []; n.version = '3.0';
        var t = document.createElement('script');
        t.async = true; t.src = e;
        var r = document.getElementsByTagName('script')[0];
        r.parentNode.insertBefore(t, r);
      }
    }('https://s.pinimg.com/ct/core.js');
    /* eslint-enable */

    window.pintrk('load', TAG_ID, { np: 'wix' });
    window.pintrk('page');
  } catch (e) {
    // Pinterest Tag is non-critical — never break the page
  }
}

/**
 * Fire a Pinterest Tag event.
 * @param {string} eventName - Pinterest event name (e.g., 'viewcategory', 'addtocart', 'checkout', 'purchase')
 * @param {Object} [params={}] - Event parameters (e.g., { value, order_quantity, currency, line_items })
 */
export function firePinterestEvent(eventName, params = {}) {
  try {
    if (typeof window === 'undefined' || !window.pintrk) return;
    window.pintrk('track', eventName, params);
  } catch (e) {
    // Non-critical
  }
}
