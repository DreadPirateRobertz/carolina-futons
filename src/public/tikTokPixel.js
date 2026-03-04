// tikTokPixel.js - TikTok Pixel initialization
// Loads the TikTok tracking pixel for conversion tracking and retargeting.
// Fires a PageView event on initialization. Additional events (ViewContent,
// AddToCart, Purchase) can be fired via fireTikTokEvent().
//
// Setup: Set your TikTok Pixel ID in the PIXEL_ID constant below, or
// configure it via Wix Dashboard > Marketing Integrations.

const PIXEL_ID = ''; // Set TikTok Pixel ID here when obtained

/**
 * Initialize TikTok Pixel tracking script and fire initial PageView.
 * Safe to call on every page — guards against re-initialization and
 * missing browser globals.
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
      ttq.page();
    }(window, document, 'ttq');
    /* eslint-enable */
  } catch (e) {
    // TikTok Pixel is non-critical — never break the page
  }
}

/**
 * Fire a TikTok Pixel event.
 * @param {string} eventName - TikTok event name (e.g., 'ViewContent', 'AddToCart', 'Purchase')
 * @param {Object} [params={}] - Event parameters
 */
export function fireTikTokEvent(eventName, params = {}) {
  try {
    if (typeof window === 'undefined' || !window.ttq) return;
    window.ttq.track(eventName, params);
  } catch (e) {
    // Non-critical
  }
}
