/**
 * showroomService.web.js — Showroom / Physical-Digital Bridge
 * CF-4cls: S1 CTA, S2 badge, S3 QR mode, S4 home section
 *
 * Wix Bookings integration for "Book a Showroom Visit" scheduling.
 * Showroom eligibility via product tags or CMS field.
 */
import { webMethod, Permissions } from 'wix-web-module';
import { getSecret } from 'wix-secrets-backend';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Wix Bookings service slug for showroom visits */
export const SHOWROOM_SERVICE_SLUG = 'showroom-visit';

/** Product tag that marks a product as showroom-eligible */
export const SHOWROOM_TAG = 'showroom-eligible';

/** Showroom physical location info */
export const SHOWROOM_INFO = {
  name: 'Carolina Futons Showroom',
  address: '824 Locust St',
  city: 'Hendersonville',
  state: 'NC',
  zip: '28792',
  phone: '(828) 252-9449',
  email: 'carolinafutons@gmail.com',
  hours: [
    { days: 'Wednesday – Friday', hours: '10:00 AM – 5:00 PM' },
    { days: 'Saturday', hours: '10:00 AM – 4:00 PM' },
    { days: 'Sunday – Tuesday', hours: 'Closed' },
  ],
  mapEmbedQuery: '824+Locust+St+Hendersonville+NC+28792',
};

// ── S1: Showroom CTA — get booking URL ───────────────────────────────────────

/**
 * Returns the Wix Bookings URL for the showroom visit service.
 * @returns {{ url: string, serviceName: string } | { error: string }}
 */
export const getShowroomBookingUrl = webMethod(Permissions.Anyone, async () => {
  try {
    return {
      url: `/booking-calendar/${SHOWROOM_SERVICE_SLUG}`,
      serviceName: 'Book a Showroom Visit',
    };
  } catch (err) {
    console.error('[showroomService] getShowroomBookingUrl failed:', err);
    return { error: 'Unable to load booking URL. Please try again.' };
  }
});

// ── S2: See It In Store — product eligibility ─────────────────────────────────

/**
 * Returns whether a product is eligible for in-showroom display.
 * Checks product tags for SHOWROOM_TAG.
 * @param {object} product — Wix Stores product object
 * @returns {boolean}
 */
export function isShowroomEligible(product) {
  if (!product || !Array.isArray(product.ribbons)) return false;
  // Check product tags (stored as ribbons in some Wix configs) or custom fields
  const tags = product.customFields?.showroomEligible;
  if (tags === true || tags === 'true') return true;
  // Also check product ribbon text
  return (product.ribbons || []).some(r =>
    (r.text || '').toLowerCase() === SHOWROOM_TAG
  );
}

/**
 * Returns a list of showroom-eligible product IDs from a product list.
 * @param {Array} products
 * @returns {string[]} eligible product IDs
 */
export const getShowroomEligibleIds = webMethod(Permissions.Anyone, async (productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  try {
    const { products } = await import('wix-stores-backend');
    const fetched = await Promise.all(
      productIds.map(id => products.getProduct(id).catch(() => null))
    );
    return fetched
      .filter(p => p && isShowroomEligible(p))
      .map(p => p._id);
  } catch (err) {
    console.error('[showroomService] getShowroomEligibleIds failed:', err);
    return [];
  }
});

// ── S3: QR mode detection ─────────────────────────────────────────────────────

/**
 * Returns true if the URL query contains qr=1 (staff/in-store mode).
 * Pure utility — runs client-side via query object from wix-location-frontend.
 * @param {object} query — wixLocation.query
 * @returns {boolean}
 */
export function isQrMode(query) {
  return query?.qr === '1' || query?.qr === 1;
}

/**
 * Builds the store-mode banner text for staff UX.
 * @returns {string}
 */
export function buildStoreModeText() {
  return '🏪 Store Mode — Prices shown to customer. Staff: use manager app for overrides.';
}

// ── S4: Home showroom section data ───────────────────────────────────────────

/**
 * Returns formatted showroom section data for the Home page.
 * @returns {{ info: object, bookingUrl: string, mapUrl: string }}
 */
export const getShowroomSectionData = webMethod(Permissions.Anyone, async () => {
  try {
    return {
      info: SHOWROOM_INFO,
      bookingUrl: `/booking-calendar/${SHOWROOM_SERVICE_SLUG}`,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOWROOM_INFO.mapEmbedQuery)}`,
    };
  } catch (err) {
    console.error('[showroomService] getShowroomSectionData failed:', err);
    return { error: 'Unable to load showroom info.' };
  }
});

/**
 * Formats showroom hours for display (array → formatted string).
 * @param {Array<{days: string, hours: string}>} hoursArr
 * @returns {string}
 */
export function formatShowroomHours(hoursArr) {
  if (!Array.isArray(hoursArr)) return '';
  return hoursArr
    .map(h => `${h.days}: ${h.hours}`)
    .join('\n');
}
