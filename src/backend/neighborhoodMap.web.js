/**
 * @module neighborhoodMap
 * @description Neighborhood Furniture Map — opt-in customer pins with reviews
 * and photos, creating a distributed showroom network.
 *
 * Privacy-first: locations are fuzzed to neighborhood level (0.01° ~0.7mi),
 * only opt-in customers appear, and no exact addresses are stored.
 *
 * CMS Collections:
 *   NeighborhoodPins — opt-in customer map pins
 *
 * CF-zp8o
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

const PINS_COLLECTION = 'NeighborhoodPins';
const SEARCH_RADIUS_MILES = 5;
const FUZZ_DEGREES = 0.01; // ~0.7 miles at US latitudes
const MAX_PINS_PER_QUERY = 50;
const MAX_PHOTOS_PER_PIN = 3;

// ── Opt-In Pin Management ───────────────────────────────────────────

/**
 * Create or update an opt-in neighborhood pin.
 * Location is fuzzed for privacy — no exact address stored.
 *
 * @param {Object} params
 * @param {number} params.lat - Approximate latitude (will be fuzzed)
 * @param {number} params.lng - Approximate longitude (will be fuzzed)
 * @param {string} params.neighborhood - Neighborhood/area name ("West Asheville")
 * @param {string} params.productName - Primary product owned
 * @param {string} params.productId
 * @param {string} [params.reviewText] - Short review (max 500 chars)
 * @param {number} [params.rating] - 1-5 star rating
 * @param {Array}  [params.photoUrls] - Up to 3 photos of the product in their home
 * @param {string} [params.displayName] - First name or nickname
 * @returns {Promise<{success: boolean, pinId: string|null}>}
 * @permission SiteMember
 */
export const createPin = webMethod(
  Permissions.SiteMember,
  async (params = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, pinId: null, error: 'Not authenticated' };

      const lat = typeof params.lat === 'number' ? params.lat : null;
      const lng = typeof params.lng === 'number' ? params.lng : null;
      if (lat === null || lng === null) {
        return { success: false, pinId: null, error: 'Location is required' };
      }

      const productName = sanitize(params.productName || '', 200);
      const productId = sanitize(params.productId || '', 50);
      if (!productName || !productId) {
        return { success: false, pinId: null, error: 'Product is required' };
      }

      const neighborhood = sanitize(params.neighborhood || '', 200);
      const reviewText = sanitize(params.reviewText || '', 500);
      const rating = Math.min(5, Math.max(1, Math.round(params.rating || 5)));
      const displayName = sanitize(params.displayName || member.contactDetails?.firstName || 'A Customer', 100);

      const photos = (params.photoUrls || [])
        .slice(0, MAX_PHOTOS_PER_PIN)
        .map(url => sanitize(url, 500))
        .filter(Boolean);

      // Fuzz location for privacy
      const fuzzedLat = fuzzLocation(lat);
      const fuzzedLng = fuzzLocation(lng);

      // Check for existing pin by this member (update instead of duplicate)
      const existing = await wixData.query(PINS_COLLECTION)
        .eq('memberId', member._id)
        .eq('productId', productId)
        .find();

      let pinId;
      if (existing.items.length > 0) {
        const pin = existing.items[0];
        pin.lat = fuzzedLat;
        pin.lng = fuzzedLng;
        pin.neighborhood = neighborhood;
        pin.reviewText = reviewText;
        pin.rating = rating;
        pin.photoUrls = JSON.stringify(photos);
        pin.displayName = displayName;
        pin.updatedAt = new Date();
        await wixData.update(PINS_COLLECTION, pin);
        pinId = pin._id;
      } else {
        const pin = await wixData.insert(PINS_COLLECTION, {
          memberId: member._id,
          lat: fuzzedLat,
          lng: fuzzedLng,
          neighborhood,
          productId,
          productName,
          reviewText,
          rating,
          photoUrls: JSON.stringify(photos),
          displayName,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        pinId = pin._id;
      }

      logAuditEvent(PINS_COLLECTION, 'opt_in', member._id, {
        pinId, productName, neighborhood,
      });

      return { success: true, pinId };
    } catch (err) {
      console.error('[neighborhoodMap] createPin error:', err);
      return { success: false, pinId: null, error: 'Failed to create pin' };
    }
  }
);

/**
 * Remove own pin (opt-out).
 *
 * @param {string} pinId
 * @returns {Promise<{success: boolean}>}
 * @permission SiteMember
 */
export const removePin = webMethod(
  Permissions.SiteMember,
  async (pinId) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      const cleanId = sanitize(pinId, 50);
      const pin = await wixData.get(PINS_COLLECTION, cleanId);
      if (!pin || pin.memberId !== member._id) {
        return { success: false, error: 'Pin not found or not owned' };
      }

      await wixData.remove(PINS_COLLECTION, cleanId);

      logAuditEvent(PINS_COLLECTION, 'opt_out', member._id, { pinId: cleanId });

      return { success: true };
    } catch (err) {
      console.error('[neighborhoodMap] removePin error:', err);
      return { success: false, error: 'Failed to remove pin' };
    }
  }
);

// ── Map Queries ─────────────────────────────────────────────────────

/**
 * Get pins near a location (within search radius).
 * Returns fuzzed locations — never exact addresses.
 *
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} [radiusMiles=5] - Search radius
 * @returns {Promise<{success: boolean, pins: Array, total: number}>}
 * @permission Anyone
 */
export const getNearbyPins = webMethod(
  Permissions.Anyone,
  async (lat, lng, radiusMiles) => {
    try {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { success: false, pins: [], total: 0 };
      }

      const { allowed } = await checkRateLimit(
        'MapQueryRateLimit', `${Math.round(lat)}_${Math.round(lng)}`,
        { max: 20, windowMs: 60_000 }
      );
      if (!allowed) return { success: false, pins: [], total: 0 };

      const radius = Math.min(Math.max(1, radiusMiles || SEARCH_RADIUS_MILES), 25);
      const degreeRadius = radius / 69; // ~69 miles per degree latitude

      const result = await wixData.query(PINS_COLLECTION)
        .eq('status', 'active')
        .ge('lat', lat - degreeRadius)
        .le('lat', lat + degreeRadius)
        .limit(MAX_PINS_PER_QUERY)
        .find();

      // Filter by longitude (Wix Data doesn't support compound geo queries)
      const lngRadius = degreeRadius / Math.cos(lat * Math.PI / 180);
      const filtered = result.items.filter(pin =>
        pin.lng >= lng - lngRadius && pin.lng <= lng + lngRadius
      );

      return {
        success: true,
        pins: filtered.map(formatPin),
        total: filtered.length,
      };
    } catch (err) {
      console.error('[neighborhoodMap] getNearbyPins error:', err);
      return { success: false, pins: [], total: 0 };
    }
  }
);

/**
 * Get map stats: total pins, cities represented, products shown.
 *
 * @returns {Promise<{success: boolean, stats: Object}>}
 * @permission Anyone
 */
export const getMapStats = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const total = await wixData.query(PINS_COLLECTION)
        .eq('status', 'active')
        .count();

      const sample = await wixData.query(PINS_COLLECTION)
        .eq('status', 'active')
        .limit(1000)
        .find();

      const neighborhoods = new Set(sample.items.map(p => p.neighborhood).filter(Boolean));
      const products = new Set(sample.items.map(p => p.productName).filter(Boolean));
      const avgRating = sample.items.length > 0
        ? Math.round(sample.items.reduce((sum, p) => sum + (p.rating || 0), 0) / sample.items.length * 10) / 10
        : 0;

      return {
        success: true,
        stats: {
          totalPins: total,
          neighborhoods: neighborhoods.size,
          uniqueProducts: products.size,
          avgRating,
        },
      };
    } catch (err) {
      console.error('[neighborhoodMap] getMapStats error:', err);
      return { success: false, stats: null };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Fuzz a coordinate by ±FUZZ_DEGREES (~0.7 miles) for privacy.
 */
function fuzzLocation(coord) {
  const offset = (Math.random() - 0.5) * 2 * FUZZ_DEGREES;
  return Math.round((coord + offset) * 10000) / 10000;
}

function formatPin(pin) {
  let photos = [];
  try { photos = JSON.parse(pin.photoUrls || '[]'); } catch (e) {}

  return {
    pinId: pin._id,
    lat: pin.lat,
    lng: pin.lng,
    neighborhood: pin.neighborhood,
    productName: pin.productName,
    productId: pin.productId,
    reviewText: pin.reviewText,
    rating: pin.rating,
    photoUrls: photos,
    displayName: pin.displayName,
  };
}

export const _FUZZ_DEGREES = FUZZ_DEGREES;
export const _SEARCH_RADIUS_MILES = SEARCH_RADIUS_MILES;
export const _fuzzLocation = fuzzLocation;
