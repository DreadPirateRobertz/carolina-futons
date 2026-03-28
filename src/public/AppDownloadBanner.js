/**
 * @module AppDownloadBanner
 * @description Smart app download banner for mobile web visitors.
 *
 * iOS: native Smart App Banner via <meta name="apple-itunes-app"> — Safari
 *   renders it natively, no custom UI needed.
 * Android: custom sticky banner linking to Google Play Store.
 *
 * Detection: localStorage flag (set by app on first launch via web bridge),
 *   supplemented by navigator.getInstalledRelatedApps() on Android.
 * Dismissal: 7-day cooldown via localStorage.
 * Deferred deep link: current page URL stored before redirect so the app
 *   can open the same page after install.
 *
 * CF-e2ib
 *
 * @requires wix-seo-frontend (dynamic import, iOS only)
 * @requires wix-location-frontend (dynamic import, Android only)
 *
 * @setup
 * 1. Replace IOS_APP_ID and ANDROID_PACKAGE with real values from dallas.
 * 2. Add #appDownloadBanner, #appDownloadBannerText, #appDownloadBannerBtn,
 *    #appDownloadBannerDismiss elements to Wix Editor (Android path only).
 * 3. Call initAppDownloadBanner($w, currentUrl) from masterPage.js onReady.
 */

// ── App constants (TODO: replace with real values from dallas, CF-e2ib) ──────
export const IOS_APP_ID = 'PENDING_IOS_APP_ID';       // e.g. '6478912345'
export const ANDROID_PACKAGE = 'PENDING_ANDROID_PKG'; // e.g. 'com.carolinafutons.app'
export const APP_SCHEME = 'cfutons';                   // custom URL scheme
// ─────────────────────────────────────────────────────────────────────────────

export const BANNER_MESSAGE =
  'Get the CF App — track orders, earn 50 bonus points, AR room view';
export const DISMISS_KEY = 'cf_app_banner_dismissed';
export const INSTALLED_KEY = 'cf_native_app_installed';
export const DEFERRED_DEEP_LINK_KEY = 'cf_deferred_deep_link';
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Platform detection ────────────────────────────────────────────────────────

/**
 * Detect the current mobile platform.
 * @param {string} [_ua] - User-agent string override (for testing)
 * @returns {'ios' | 'android' | null} null means desktop or unknown
 */
export function detectPlatform(_ua) {
  const ua = _ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return null;
  // /iPad|iPhone|iPod/ catches all Apple mobile; exclude Windows Phone (legacy IE UA quirk)
  if (/iPad|iPhone|iPod/.test(ua) && !/Windows Phone/.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return null;
}

// ── Dismissal ─────────────────────────────────────────────────────────────────

/**
 * Check if banner was dismissed within the 7-day cooldown.
 * @returns {boolean}
 */
export function isBannerDismissed() {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
    return ts > 0 && Date.now() - ts < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Record banner dismissal timestamp.
 */
export function recordDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

// ── App-installed detection ───────────────────────────────────────────────────

/**
 * Check if the native CF app is already installed.
 *
 * Primary: localStorage flag set by the app on first launch (via URL scheme
 * web bridge: cfutons://set-installed → web page sets the flag).
 * Secondary: navigator.getInstalledRelatedApps() (Android Chrome 73+).
 *
 * @returns {Promise<boolean>}
 */
export async function isNativeAppInstalled() {
  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') return true;
  } catch {}

  try {
    if ('getInstalledRelatedApps' in navigator) {
      const apps = await navigator.getInstalledRelatedApps();
      return apps.length > 0;
    }
  } catch {}

  return false;
}

// ── Deferred deep link ────────────────────────────────────────────────────────

/**
 * Store current page URL as deferred deep link.
 * The app reads this on first launch to navigate to the same page.
 * @param {string} url
 */
export function storeDeferredDeepLink(url) {
  try {
    localStorage.setItem(DEFERRED_DEEP_LINK_KEY, url);
  } catch {}
}

// ── Store URLs ────────────────────────────────────────────────────────────────

/**
 * iOS App Store URL for the CF app.
 * @returns {string}
 */
export function getIOSStoreUrl() {
  return `https://apps.apple.com/app/id${IOS_APP_ID}`;
}

/**
 * Google Play Store URL for the CF app.
 * @param {string} [utmSource='web_banner'] - UTM source tag for attribution
 * @returns {string}
 */
export function getAndroidStoreUrl(utmSource = 'web_banner') {
  const base = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
  const referrer = encodeURIComponent(
    `utm_source=${utmSource}&utm_medium=banner&utm_campaign=app_install`
  );
  return `${base}&referrer=${referrer}`;
}

// ── iOS Smart Banner meta tag ─────────────────────────────────────────────────

/**
 * Build the meta tag descriptor for wix-seo-frontend head.setMetaTags().
 * Safari renders a native Smart App Banner at top of viewport when this tag
 * is present — no custom UI needed on iOS.
 *
 * @param {string} appArgument - Current page URL (deferred deep link)
 * @returns {Array<{name: string, content: string}>}
 */
export function buildIOSMetaTags(appArgument) {
  return [
    { name: 'apple-itunes-app', content: `app-id=${IOS_APP_ID},app-argument=${appArgument}` },
  ];
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Initialize the app download banner for mobile web visitors.
 *
 * iOS path: injects <meta name="apple-itunes-app"> so Safari shows its
 *   native Smart App Banner — no Wix Editor element required.
 * Android path: shows custom sticky #appDownloadBanner with Play Store link.
 *
 * @param {Function} $w - Wix element selector
 * @param {string} currentUrl - Current page URL (for deferred deep link / app-argument)
 * @param {Object} [opts] - Overrides for testing
 * @param {Function} [opts.setMetaTags] - Replacement for wix-seo-frontend head.setMetaTags
 * @param {Function} [opts.navigateTo] - Replacement for wix-location-frontend navigation
 * @param {string} [opts.userAgent] - UA string override (for testing)
 */
export async function initAppDownloadBanner($w, currentUrl, opts = {}) {
  try {
    const platform = detectPlatform(opts.userAgent);
    if (!platform) return;

    if (isBannerDismissed()) return;
    if (await isNativeAppInstalled()) return;

    storeDeferredDeepLink(currentUrl);

    if (platform === 'ios') {
      _injectIOSBanner(currentUrl, opts.setMetaTags);
      return;
    }

    // Android
    _showAndroidBanner($w, opts.navigateTo);
  } catch {}
}

function _injectIOSBanner(currentUrl, setMetaTagsFn) {
  const tags = buildIOSMetaTags(currentUrl);
  if (setMetaTagsFn) {
    setMetaTagsFn(tags);
    return;
  }
  import('wix-seo-frontend').then(({ head }) => {
    head.setMetaTags(tags);
  }).catch(() => {});
}

function _showAndroidBanner($w, navigateFn) {
  let banner;
  try {
    banner = $w('#appDownloadBanner');
  } catch {
    return;
  }

  try {
    $w('#appDownloadBannerText').text = BANNER_MESSAGE;
  } catch {}

  try {
    $w('#appDownloadBannerBtn').onClick(() => {
      recordDismissal();
      const storeUrl = getAndroidStoreUrl();
      if (navigateFn) {
        navigateFn(storeUrl);
      } else {
        import('wix-location-frontend').then(({ to }) => to(storeUrl)).catch(() => {});
      }
    });
  } catch {}

  try {
    $w('#appDownloadBannerDismiss').onClick(() => {
      recordDismissal();
      banner.hide('fade', { duration: 200 });
    });
  } catch {}

  banner.show('slide', { direction: 'top', duration: 300 });
}
