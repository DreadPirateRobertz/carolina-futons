/**
 * @module deliveryTracker
 * @description Delivery Day Experience — GPS tracking, room-prep checklists,
 * door measurement validation, and real-time ETA notifications.
 *
 * CMS Collections:
 *   DeliveryTracking — active delivery tracking sessions
 *   DeliveryNotifications — notification log
 *
 * CF-0xun
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

const TRACKING_COLLECTION = 'DeliveryTracking';
const NOTIFICATIONS_COLLECTION = 'DeliveryNotifications';
const NOTIFICATION_THRESHOLDS = [30, 10, 5];

const STANDARD_DIMENSIONS = {
  frontDoor: { width: 36, height: 80 },
  interiorDoor: { width: 32, height: 80 },
  hallway: { width: 36 },
  stairway: { width: 36, clearance: 84 },
  elevator: { width: 36, depth: 54, height: 84 },
};

// ── Delivery Tracking ───────────────────────────────────────────────

/**
 * Create a delivery tracking session for an order.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.contactEmail
 * @param {string} params.deliveryAddress
 * @param {Date} params.estimatedDelivery
 * @param {Array} params.items - [{name, widthInches, depthInches, heightInches, weightLbs}]
 * @returns {Promise<{success: boolean, trackingId: string|null, trackingUrl: string|null}>}
 * @permission Admin
 */
export const createDeliveryTracking = webMethod(
  Permissions.Admin,
  async (params = {}) => {
    try {
      const orderId = sanitize(params.orderId, 50);
      const contactEmail = sanitize(params.contactEmail, 254).toLowerCase();
      const deliveryAddress = sanitize(params.deliveryAddress, 500);

      if (!orderId || !contactEmail || !deliveryAddress) {
        return { success: false, trackingId: null, trackingUrl: null, error: 'Missing required fields' };
      }

      const estimatedDelivery = new Date(params.estimatedDelivery);
      if (isNaN(estimatedDelivery.getTime())) {
        return { success: false, trackingId: null, trackingUrl: null, error: 'Invalid delivery date' };
      }

      const items = (params.items || []).map(i => ({
        name: sanitize(i.name || '', 200),
        widthInches: i.widthInches || 0,
        depthInches: i.depthInches || 0,
        heightInches: i.heightInches || 0,
        weightLbs: i.weightLbs || 0,
      }));

      const trackingToken = generateToken();

      const tracking = await wixData.insert(TRACKING_COLLECTION, {
        orderId,
        contactEmail,
        deliveryAddress,
        estimatedDelivery,
        items: JSON.stringify(items),
        trackingToken,
        status: 'scheduled',
        driverLat: null,
        driverLng: null,
        etaMinutes: null,
        notificationsSent: JSON.stringify([]),
        createdAt: new Date(),
      });

      logAuditEvent(TRACKING_COLLECTION, 'create', 'admin', { trackingId: tracking._id, orderId });

      return {
        success: true,
        trackingId: tracking._id,
        trackingUrl: `https://www.carolinafutons.com/delivery-tracker?t=${trackingToken}`,
      };
    } catch (err) {
      console.error('[deliveryTracker] createDeliveryTracking error:', err);
      return { success: false, trackingId: null, trackingUrl: null, error: 'Failed to create tracking' };
    }
  }
);

/**
 * Update driver GPS location + ETA. Triggers notifications at thresholds.
 *
 * @param {string} trackingId
 * @param {number} lat
 * @param {number} lng
 * @param {number} etaMinutes
 * @returns {Promise<{success: boolean, notificationsSent: string[]}>}
 * @permission Admin
 */
export const updateDriverLocation = webMethod(
  Permissions.Admin,
  async (trackingId, lat, lng, etaMinutes) => {
    try {
      const cleanId = sanitize(trackingId, 50);
      const tracking = await wixData.get(TRACKING_COLLECTION, cleanId);
      if (!tracking) return { success: false, notificationsSent: [] };

      tracking.driverLat = lat;
      tracking.driverLng = lng;
      tracking.etaMinutes = etaMinutes;
      tracking.lastLocationUpdate = new Date();

      if (etaMinutes <= 5) tracking.status = 'nearby';
      else if (tracking.status === 'scheduled') tracking.status = 'in_transit';

      const sent = JSON.parse(tracking.notificationsSent || '[]');
      const newNotifs = [];

      for (const threshold of NOTIFICATION_THRESHOLDS) {
        const key = `eta_${threshold}`;
        if (etaMinutes <= threshold && !sent.includes(key)) {
          await wixData.insert(NOTIFICATIONS_COLLECTION, {
            trackingId: cleanId,
            orderId: tracking.orderId,
            type: key,
            message: getEtaMessage(threshold),
            contactEmail: tracking.contactEmail,
            sentAt: new Date(),
          });
          sent.push(key);
          newNotifs.push(key);
        }
      }

      tracking.notificationsSent = JSON.stringify(sent);
      await wixData.update(TRACKING_COLLECTION, tracking);

      return { success: true, notificationsSent: newNotifs };
    } catch (err) {
      console.error('[deliveryTracker] updateDriverLocation error:', err);
      return { success: false, notificationsSent: [] };
    }
  }
);

/**
 * Mark delivery arrived or delivered.
 *
 * @param {string} trackingId
 * @param {string} status - 'arrived' | 'delivered'
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const markDeliveryStatus = webMethod(
  Permissions.Admin,
  async (trackingId, status) => {
    try {
      const cleanId = sanitize(trackingId, 50);
      if (!['arrived', 'delivered'].includes(status)) {
        return { success: false, error: 'Invalid status' };
      }

      const tracking = await wixData.get(TRACKING_COLLECTION, cleanId);
      if (!tracking) return { success: false, error: 'Tracking not found' };

      tracking.status = status;
      if (status === 'arrived') tracking.arrivedAt = new Date();
      if (status === 'delivered') tracking.deliveredAt = new Date();

      await wixData.update(TRACKING_COLLECTION, tracking);

      await wixData.insert(NOTIFICATIONS_COLLECTION, {
        trackingId: cleanId,
        orderId: tracking.orderId,
        type: status,
        message: status === 'arrived'
          ? 'Your delivery has arrived!'
          : 'Your furniture has been delivered. Enjoy!',
        contactEmail: tracking.contactEmail,
        sentAt: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('[deliveryTracker] markDeliveryStatus error:', err);
      return { success: false, error: 'Failed to update status' };
    }
  }
);

/**
 * Get tracking status for customer view.
 *
 * @param {string} trackingToken
 * @returns {Promise<{success: boolean, tracking: Object|null}>}
 * @permission Anyone
 */
export const getTrackingByToken = webMethod(
  Permissions.Anyone,
  async (trackingToken) => {
    try {
      const cleanToken = sanitize(trackingToken, 30);
      if (!cleanToken) return { success: false, tracking: null };

      const { allowed } = await checkRateLimit(
        'TrackingViewRateLimit', cleanToken, { max: 30, windowMs: 60_000 }
      );
      if (!allowed) return { success: false, tracking: null };

      const result = await wixData.query(TRACKING_COLLECTION)
        .eq('trackingToken', cleanToken)
        .find();

      if (result.items.length === 0) return { success: false, tracking: null };

      const t = result.items[0];
      const showLocation = t.status === 'in_transit' || t.status === 'nearby';

      return {
        success: true,
        tracking: {
          orderId: t.orderId,
          status: t.status,
          estimatedDelivery: t.estimatedDelivery,
          etaMinutes: t.etaMinutes,
          driverLat: showLocation ? t.driverLat : null,
          driverLng: showLocation ? t.driverLng : null,
          arrivedAt: t.arrivedAt || null,
          deliveredAt: t.deliveredAt || null,
        },
      };
    } catch (err) {
      console.error('[deliveryTracker] getTrackingByToken error:', err);
      return { success: false, tracking: null };
    }
  }
);

// ── Door Fit Validator ──────────────────────────────────────────────

/**
 * Check if a product fits through specified entry points.
 *
 * @param {Object} product - {widthInches, depthInches, heightInches}
 * @param {Array} entryPoints - [{type, width, height}]
 * @returns {{success: boolean, fits: boolean, issues: Array}}
 * @permission Anyone
 */
export const checkDoorFit = webMethod(
  Permissions.Anyone,
  (product, entryPoints) => {
    if (!product || !Array.isArray(entryPoints)) {
      return { success: false, fits: false, issues: [] };
    }

    const dims = [
      product.widthInches || 0,
      product.depthInches || 0,
      product.heightInches || 0,
    ].sort((a, b) => a - b);

    const minTwo = [dims[0], dims[1]];
    const issues = [];
    let allFit = true;

    for (const entry of entryPoints) {
      const w = entry.width || STANDARD_DIMENSIONS[entry.type]?.width || 36;
      const h = entry.height || STANDARD_DIMENSIONS[entry.type]?.height || 80;

      const fitsA = minTwo[0] <= w && minTwo[1] <= h;
      const fitsB = minTwo[1] <= w && minTwo[0] <= h;

      if (!fitsA && !fitsB) {
        allFit = false;
        issues.push({
          entryPoint: entry.type,
          entryWidth: w,
          entryHeight: h,
          message: `Product may not fit through ${entry.type} (${w}"×${h}").`,
        });
      }
    }

    return { success: true, fits: allFit, issues };
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 10; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function getEtaMessage(minutes) {
  if (minutes <= 5) return 'Your delivery driver is just 5 minutes away!';
  if (minutes <= 10) return 'Almost there! Your delivery arrives in about 10 minutes.';
  return `Your furniture delivery is about ${minutes} minutes away!`;
}

export const _NOTIFICATION_THRESHOLDS = NOTIFICATION_THRESHOLDS;
export const _STANDARD_DIMENSIONS = STANDARD_DIMENSIONS;
