/**
 * @module referralShareLinks
 * @description Social sharing deep links for referral codes — generates
 * platform-specific share URLs with embedded referral codes and UTM params.
 *
 * Supports: Facebook, Twitter/X, SMS, Email, WhatsApp, Pinterest, Copy Link,
 * Instagram (clipboard), and mobile app deep links.
 *
 * CF-ctzo, CF-73zw
 */

const SITE_URL = 'https://www.carolinafutons.com';
const APP_SCHEME = 'carolinafutons';
const UTM_CAMPAIGN = 'referral';

/**
 * Build the canonical referral URL for the /referral page.
 * This is the shareable URL used in OG tags and direct sharing.
 * Format: https://www.carolinafutons.com/referral?ref=CODE
 *
 * @param {string} referralCode
 * @returns {string} Canonical referral page URL, or base URL if code is empty
 */
export function getCanonicalReferralUrl(referralCode) {
  if (!referralCode) return `${SITE_URL}/referral`;
  const cleanCode = referralCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleanCode) return `${SITE_URL}/referral`;
  return `${SITE_URL}/referral?ref=${cleanCode}`;
}

/**
 * Build a mobile app deep link for the CF mobile app.
 * If the app is installed, this opens it and applies the referral code.
 * If not installed, the OS falls back to the canonical web URL.
 *
 * Deep link format: carolinafutons://referral?code=CODE
 * Cross-rig contract: dallas defines the deep link scheme.
 *
 * @param {string} referralCode
 * @returns {string} App deep link URI, or empty string if code is empty
 */
export function getAppDeepLink(referralCode) {
  if (!referralCode) return '';
  const cleanCode = referralCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!cleanCode) return '';
  return `${APP_SCHEME}://referral?code=${cleanCode}`;
}

/**
 * Get the Instagram share content — just the canonical URL for clipboard copy.
 * Instagram has no web share API; users copy to bio or stories manually.
 *
 * @param {string} referralCode
 * @returns {{ url: string, message: string }} URL and pre-written caption
 */
export function getInstagramShareContent(referralCode) {
  const url = getCanonicalReferralUrl(referralCode);
  return {
    url,
    message: `Check out Carolina Futons — handcrafted mountain furniture! Use my referral link in bio: ${url}`,
  };
}

/**
 * Build a referral landing URL with UTM parameters.
 *
 * @param {string} referralCode - The referrer's unique code
 * @param {string} source - Platform name (facebook, twitter, sms, email, whatsapp, pinterest)
 * @param {string} [path='/shop'] - Landing page path
 * @returns {string} Full URL with ref code + UTM params
 */
export function buildReferralUrl(referralCode, source, path) {
  if (!referralCode) return `${SITE_URL}${path || '/shop'}`;

  const cleanCode = referralCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const landingPath = path || '/shop';

  const params = new URLSearchParams({
    ref: cleanCode,
    utm_source: source || 'direct',
    utm_medium: source === 'email' ? 'email' : source === 'sms' ? 'sms' : 'social',
    utm_campaign: UTM_CAMPAIGN,
    utm_content: cleanCode,
  });

  return `${SITE_URL}${landingPath}?${params.toString()}`;
}

/**
 * Generate a Facebook share URL.
 *
 * @param {string} referralCode
 * @param {string} [path]
 * @returns {string} Facebook share dialog URL
 */
export function getFacebookShareUrl(referralCode, path) {
  const url = buildReferralUrl(referralCode, 'facebook', path);
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

/**
 * Generate a Twitter/X share URL.
 *
 * @param {string} referralCode
 * @param {string} [message] - Tweet text
 * @param {string} [path]
 * @returns {string} Twitter intent URL
 */
export function getTwitterShareUrl(referralCode, message, path) {
  const url = buildReferralUrl(referralCode, 'twitter', path);
  const text = message || 'Check out Carolina Futons — handcrafted mountain furniture! Use my referral link for a discount:';
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/**
 * Generate an SMS share link (mobile deep link).
 *
 * @param {string} referralCode
 * @param {string} [message]
 * @param {string} [path]
 * @returns {string} sms: URI
 */
export function getSmsShareUrl(referralCode, message, path) {
  const url = buildReferralUrl(referralCode, 'sms', path);
  const text = message || `Check out Carolina Futons! Use my referral link for a discount: ${url}`;
  // Use & for iOS, ? for Android — &body= works on both modern platforms
  return `sms:?&body=${encodeURIComponent(text)}`;
}

/**
 * Generate a mailto: share link.
 *
 * @param {string} referralCode
 * @param {string} [subject]
 * @param {string} [body]
 * @param {string} [path]
 * @returns {string} mailto: URI
 */
export function getEmailShareUrl(referralCode, subject, body, path) {
  const url = buildReferralUrl(referralCode, 'email', path);
  const emailSubject = subject || 'Check out Carolina Futons — handcrafted mountain furniture';
  const emailBody = body || `I thought you'd love Carolina Futons. They have amazing handcrafted futons and furniture.\n\nUse my referral link to get a discount on your first order:\n${url}`;

  return `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
}

/**
 * Generate a WhatsApp share URL.
 *
 * @param {string} referralCode
 * @param {string} [message]
 * @param {string} [path]
 * @returns {string} WhatsApp share URL
 */
export function getWhatsAppShareUrl(referralCode, message, path) {
  const url = buildReferralUrl(referralCode, 'whatsapp', path);
  const text = message || `Check out Carolina Futons! Handcrafted mountain furniture. Use my referral link: ${url}`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

/**
 * Generate a Pinterest pin URL.
 *
 * @param {string} referralCode
 * @param {string} [imageUrl] - Product image to pin
 * @param {string} [description]
 * @param {string} [path]
 * @returns {string} Pinterest create pin URL
 */
export function getPinterestShareUrl(referralCode, imageUrl, description, path) {
  const url = buildReferralUrl(referralCode, 'pinterest', path);
  const desc = description || 'Carolina Futons — handcrafted mountain furniture';
  const params = new URLSearchParams({
    url,
    description: desc,
  });
  if (imageUrl) params.set('media', imageUrl);
  return `https://pinterest.com/pin/create/button/?${params.toString()}`;
}

/**
 * Get all share links for a referral code (for rendering share buttons).
 *
 * @param {string} referralCode
 * @param {Object} [options]
 * @param {string} [options.path] - Landing page path (default: /shop)
 * @param {string} [options.productImage] - For Pinterest
 * @param {string} [options.message] - Custom share message
 * @returns {Object} Map of platform → share URL or content
 */
export function getAllShareLinks(referralCode, options = {}) {
  const { path, productImage, message } = options;

  return {
    copyLink: buildReferralUrl(referralCode, 'copy', path),
    canonical: getCanonicalReferralUrl(referralCode),
    deepLink: getAppDeepLink(referralCode),
    facebook: getFacebookShareUrl(referralCode, path),
    twitter: getTwitterShareUrl(referralCode, message, path),
    sms: getSmsShareUrl(referralCode, message, path),
    email: getEmailShareUrl(referralCode, undefined, undefined, path),
    whatsapp: getWhatsAppShareUrl(referralCode, message, path),
    pinterest: getPinterestShareUrl(referralCode, productImage, undefined, path),
    instagram: getInstagramShareContent(referralCode).url,
  };
}
