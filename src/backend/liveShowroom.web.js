/**
 * @module liveShowroom
 * @description Live Showroom Camera — stream the Hendersonville display floor
 * to product pages. Customers see the actual physical item they're buying.
 *
 * CF-gt99: NOVEL — Live Showroom Camera
 *
 * Architecture:
 * - Webcams on display floor stream to a video hosting service (HLS/WebRTC)
 * - Each camera position is mapped to product IDs on display
 * - Backend provides stream URLs + display status per product
 * - "Reserve This Exact Piece" creates a time-limited hold with 5% discount
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-secrets-backend
 *
 * @setup
 * Create CMS collection "ShowroomCameras" with fields:
 * - cameraId (Text) - Unique camera identifier
 * - streamUrl (Text) - HLS/WebRTC stream URL
 * - productIds (Tags) - Products visible from this camera
 * - label (Text) - Human-readable label ("Front Display", "Bedroom Corner")
 * - isOnline (Boolean) - Camera currently streaming
 * - lastHeartbeat (DateTime) - Last successful frame
 *
 * Create CMS collection "ShowroomReservations" with fields:
 * - productId (Text) - Reserved product
 * - memberId (Text) - Reserving member (null for guest)
 * - sessionId (Text) - Session identifier for guest reservations
 * - reservedAt (DateTime) - Reservation timestamp
 * - expiresAt (DateTime) - Reservation expiry (30 min default)
 * - status (Text) - "active" | "purchased" | "expired" | "cancelled"
 * - discountCode (Text) - Auto-generated 5% discount code
 *
 * Add secret: SHOWROOM_STREAM_KEY — auth key for camera stream service
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const CAMERAS_COLLECTION = 'ShowroomCameras';
const RESERVATIONS_COLLECTION = 'ShowroomReservations';
const RESERVATION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RESERVATION_DISCOUNT_PERCENT = 5;

// ── Showroom Status ─────────────────────────────────────────────────

/**
 * Check if a product is currently on the showroom floor with a live camera.
 *
 * @param {string} productId - Wix product ID
 * @returns {Promise<{onDisplay: boolean, camera: Object|null, isLive: boolean}>}
 */
export const getShowroomStatus = webMethod(
  Permissions.Anyone,
  async (productId) => {
    if (!productId || typeof productId !== 'string') {
      return { onDisplay: false, camera: null, isLive: false };
    }

    try {
      const result = await wixData.query(CAMERAS_COLLECTION)
        .hasSome('productIds', [productId])
        .find();

      if (result.items.length === 0) {
        return { onDisplay: false, camera: null, isLive: false };
      }

      const camera = result.items[0];
      const isLive = camera.isOnline && camera.lastHeartbeat &&
        (Date.now() - new Date(camera.lastHeartbeat).getTime()) < 5 * 60 * 1000; // 5 min stale threshold

      return {
        onDisplay: true,
        camera: {
          cameraId: camera.cameraId,
          streamUrl: isLive ? camera.streamUrl : null,
          label: camera.label || 'Showroom Display',
        },
        isLive,
      };
    } catch (err) {
      console.error('[liveShowroom] getShowroomStatus failed:', err?.message);
      return { onDisplay: false, camera: null, isLive: false };
    }
  }
);

/**
 * Get all products currently on display with live cameras.
 * Used for "Live in Showroom" badge on product cards.
 *
 * @returns {Promise<{productIds: string[], cameras: Array}>}
 */
export const getLiveDisplayProducts = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query(CAMERAS_COLLECTION)
        .eq('isOnline', true)
        .find();

      const productIds = new Set();
      const cameras = [];

      for (const cam of result.items) {
        const isLive = cam.lastHeartbeat &&
          (Date.now() - new Date(cam.lastHeartbeat).getTime()) < 5 * 60 * 1000;

        if (!isLive) continue;

        cameras.push({
          cameraId: cam.cameraId,
          label: cam.label,
          productIds: cam.productIds || [],
        });

        for (const pid of (cam.productIds || [])) {
          productIds.add(pid);
        }
      }

      return { productIds: [...productIds], cameras };
    } catch (err) {
      console.error('[liveShowroom] getLiveDisplayProducts failed:', err?.message);
      return { productIds: [], cameras: [] };
    }
  }
);

// ── Reservation System ──────────────────────────────────────────────

/**
 * Reserve a specific showroom display piece for 30 minutes.
 * Generates a unique 5% discount code tied to this reservation.
 *
 * @param {string} productId - Product to reserve
 * @param {string} [sessionId] - Session identifier for guest tracking
 * @returns {Promise<{success: boolean, reservation: Object|null, error?: string}>}
 */
export const reserveShowroomPiece = webMethod(
  Permissions.Anyone,
  async (productId, sessionId) => {
    if (!productId || typeof productId !== 'string') {
      return { success: false, reservation: null, error: 'Product ID required' };
    }

    try {
      // Check if product is on display
      const status = await getShowroomStatus(productId);
      if (!status.onDisplay) {
        return { success: false, reservation: null, error: 'Product is not currently on showroom display' };
      }

      // Check for existing active reservation on this product
      const existing = await wixData.query(RESERVATIONS_COLLECTION)
        .eq('productId', productId)
        .eq('status', 'active')
        .gt('expiresAt', new Date())
        .find();

      if (existing.items.length > 0) {
        return { success: false, reservation: null, error: 'This piece is already reserved. Try again in 30 minutes.' };
      }

      // Get member ID if logged in
      let memberId = null;
      try {
        const { currentMember } = await import('wix-members-backend');
        const member = await currentMember.getMember();
        memberId = member?._id || null;
      } catch { /* guest user */ }

      // Generate discount code
      const discountCode = generateDiscountCode(productId);

      const now = new Date();
      const reservation = {
        productId,
        memberId,
        sessionId: sessionId || null,
        reservedAt: now,
        expiresAt: new Date(now.getTime() + RESERVATION_DURATION_MS),
        status: 'active',
        discountCode,
        discountPercent: RESERVATION_DISCOUNT_PERCENT,
      };

      const inserted = await wixData.insert(RESERVATIONS_COLLECTION, reservation);

      return {
        success: true,
        reservation: {
          _id: inserted._id,
          expiresAt: reservation.expiresAt,
          discountCode,
          discountPercent: RESERVATION_DISCOUNT_PERCENT,
          minutesRemaining: RESERVATION_DURATION_MS / 60000,
        },
      };
    } catch (err) {
      console.error('[liveShowroom] reserveShowroomPiece failed:', err?.message);
      return { success: false, reservation: null, error: err?.message || 'Reservation failed' };
    }
  }
);

/**
 * Check the status of an existing reservation.
 *
 * @param {string} reservationId
 * @returns {Promise<{active: boolean, minutesRemaining: number, discountCode: string}>}
 */
export const checkReservation = webMethod(
  Permissions.Anyone,
  async (reservationId) => {
    try {
      const reservation = await wixData.get(RESERVATIONS_COLLECTION, reservationId);
      if (!reservation) return { active: false, minutesRemaining: 0, discountCode: '' };

      const now = Date.now();
      const expires = new Date(reservation.expiresAt).getTime();
      const active = reservation.status === 'active' && expires > now;
      const minutesRemaining = active ? Math.ceil((expires - now) / 60000) : 0;

      // Auto-expire if past due
      if (reservation.status === 'active' && !active) {
        try {
          await wixData.update(RESERVATIONS_COLLECTION, { ...reservation, status: 'expired' });
        } catch { /* non-critical */ }
      }

      return {
        active,
        minutesRemaining,
        discountCode: active ? reservation.discountCode : '',
      };
    } catch {
      return { active: false, minutesRemaining: 0, discountCode: '' };
    }
  }
);

// ── Camera Heartbeat ────────────────────────────────────────────────

/**
 * Camera heartbeat — called by the showroom camera system to report online status.
 * Requires admin permissions (called from showroom hardware, not customer-facing).
 *
 * @param {string} cameraId
 * @returns {Promise<{success: boolean}>}
 */
export const cameraHeartbeat = webMethod(
  Permissions.Admin,
  async (cameraId) => {
    try {
      const result = await wixData.query(CAMERAS_COLLECTION)
        .eq('cameraId', cameraId)
        .find();

      if (result.items.length === 0) return { success: false };

      const camera = result.items[0];
      await wixData.update(CAMERAS_COLLECTION, {
        ...camera,
        isOnline: true,
        lastHeartbeat: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('[liveShowroom] cameraHeartbeat failed:', err?.message);
      return { success: false };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Generate a unique discount code for a showroom reservation.
 * Format: SHOWROOM-{productSlug}-{random}
 */
function generateDiscountCode(productId) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  const shortId = productId.slice(-6).toUpperCase();
  return `SHOWROOM-${shortId}-${random}`;
}
