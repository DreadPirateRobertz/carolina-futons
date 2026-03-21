// tikTokPixel.js - TikTok Pixel initialization
// Loads the TikTok tracking pixel for conversion tracking and retargeting.
// Fires a PageView event on initialization. Additional events (ViewContent,
// AddToCart, Purchase) can be fired via fireTikTokEvent().
//
// Setup: Set your TikTok Pixel ID in the PIXEL_ID constant below, or
// configure it via Wix Dashboard > Marketing Integrations.

let PIXEL_ID = ''; // Set TikTok Pixel ID here when obtained

/**
 * Set the TikTok Pixel ID at runtime (useful for tests and dynamic config).
 * @param {string} id - TikTok Pixel ID
 */
export function setPixelId(id) {
  PIXEL_ID = id || '';
}

/**
 * Initialize TikTok Pixel tracking script (library load only).
 * Does NOT fire PageView — callers must use pixelConsentService.fireTrackedTikTokEvent('PageView', {})
 * after consent is granted.
 * Safe to call on every page — guards against re-initialization and missing browser globals.
 */
export function initTikTokPixel() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.ttq) return; // Already initialized

    if (!PIXEL_ID) return; // No pixel ID configured

    /* eslint-disable */
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+"-"+n]=+new Date;(function(t,a){var s=d.createElement(t);s.src=i+"?sdkid="+e+"&lib="+t;s.async=!0;var r=d.getElementsByTagName(t)[0];r.parentNode.insertBefore(s,r)})(t,e)};
      ttq.load(PIXEL_ID);
      // ttq.page() intentionally omitted — PageView fired via consent gate only
    }(window, document, 'ttq');
    /* eslint-enable */
  } catch (e) {
    // TikTok Pixel is non-critical — never break the page
    console.warn('[tikTokPixel] init failed:', e?.message ?? e);
  }
}

// PII fields that must never be sent to TikTok without explicit advanced-matching
// consent. Defence-in-depth: stripped even if a caller accidentally passes them.
const _PII_FIELDS = new Set([
  'email', 'phone', 'phone_number',
  'userId', 'user_id', 'external_id',
  'sha256_email', 'sha256_phone',
]);

/**
 * Fire a TikTok Pixel event.
 * PII fields (email, phone, userId, etc.) are stripped from params before firing.
 * @param {string} eventName - TikTok event name (e.g., 'ViewContent', 'AddToCart', 'Purchase')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTikTokEvent(eventName, params = {}) {
  try {
    if (typeof window === 'undefined' || !window.ttq) return;
    const safeParams = Object.fromEntries(
      Object.entries(params).filter(([k]) => !_PII_FIELDS.has(k))
    );
    window.ttq.track(eventName, safeParams);
  } catch (e) {
    // Non-critical — log for observability
    console.warn('[tikTokPixel] fireTikTokEvent failed:', eventName, e?.message ?? e);
  }
}
