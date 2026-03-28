/**
 * @module collaborativePlanner
 * @description Real-time collaborative room planner — multiplayer session management.
 *
 * Enables two users to plan a room together in real-time. One user creates a
 * session and shares a URL; the other joins. Both see live cursor positions,
 * item placements, and can add products to a shared cart.
 *
 * Uses Wix Realtime API for live sync. Session state persisted to CMS for
 * reconnection and async collaboration.
 *
 * CMS Collections:
 *   PlannerSessions — session metadata and share tokens
 *   PlannerItems — items placed in the room (per-session)
 *
 * CF-8dbd
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { realtime } from 'wix-realtime-backend';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

const SESSIONS_COLLECTION = 'PlannerSessions';
const ITEMS_COLLECTION = 'PlannerItems';
const MAX_PARTICIPANTS = 4;
const SESSION_TTL_HOURS = 72;

// ── Session Management ──────────────────────────────────────────────

/**
 * Create a new collaborative planning session.
 *
 * @param {Object} params
 * @param {string} params.roomName - User-friendly room name ("Living Room", "Guest Room")
 * @param {number} [params.roomWidth=12] - Room width in feet
 * @param {number} [params.roomLength=15] - Room length in feet
 * @param {string} [params.creatorName] - Display name of session creator
 * @returns {Promise<{success: boolean, sessionId: string|null, shareToken: string|null}>}
 * @permission Anyone
 */
export const createSession = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const roomName = sanitize(params.roomName || 'My Room', 100);
      const roomWidth = Math.min(Math.max(6, params.roomWidth || 12), 50);
      const roomLength = Math.min(Math.max(6, params.roomLength || 15), 50);
      const creatorName = sanitize(params.creatorName || 'Host', 100);

      // Generate a URL-safe share token
      const shareToken = generateShareToken();

      const session = await wixData.insert(SESSIONS_COLLECTION, {
        roomName,
        roomWidth,
        roomLength,
        shareToken,
        creatorName,
        participants: [{ name: creatorName, joinedAt: new Date(), role: 'host' }],
        participantCount: 1,
        status: 'active',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000),
        itemCount: 0,
        lastActivity: new Date(),
      });

      logAuditEvent(SESSIONS_COLLECTION, 'create', 'anonymous', {
        sessionId: session._id, roomName,
      });

      return { success: true, sessionId: session._id, shareToken };
    } catch (err) {
      console.error('[collaborativePlanner] createSession error:', err);
      return { success: false, sessionId: null, shareToken: null };
    }
  }
);

/**
 * Join an existing session via share token.
 *
 * @param {string} shareToken
 * @param {string} [participantName]
 * @returns {Promise<{success: boolean, session: Object|null}>}
 * @permission Anyone
 */
export const joinSession = webMethod(
  Permissions.Anyone,
  async (shareToken, participantName) => {
    try {
      const cleanToken = sanitize(shareToken, 20);
      if (!cleanToken) return { success: false, session: null, error: 'Invalid token' };

      const result = await wixData.query(SESSIONS_COLLECTION)
        .eq('shareToken', cleanToken)
        .eq('status', 'active')
        .find();

      if (result.items.length === 0) {
        return { success: false, session: null, error: 'Session not found or expired' };
      }

      const session = result.items[0];

      if (session.participantCount >= MAX_PARTICIPANTS) {
        return { success: false, session: null, error: 'Session is full' };
      }

      // Add participant
      const name = sanitize(participantName || `Guest ${session.participantCount + 1}`, 100);
      const participants = session.participants || [];
      participants.push({ name, joinedAt: new Date(), role: 'guest' });

      session.participants = participants;
      session.participantCount = participants.length;
      session.lastActivity = new Date();
      await wixData.update(SESSIONS_COLLECTION, session);

      // Notify other participants via Realtime
      try {
        await realtime.publish(`planner_${session._id}`, {
          type: 'participant_joined',
          name,
          participantCount: session.participantCount,
        });
      } catch (e) {
        // Realtime is non-critical
      }

      return { success: true, session: formatSession(session) };
    } catch (err) {
      console.error('[collaborativePlanner] joinSession error:', err);
      return { success: false, session: null, error: 'Failed to join session' };
    }
  }
);

/**
 * Get session state including all placed items.
 *
 * @param {string} sessionId
 * @returns {Promise<{success: boolean, session: Object|null, items: Array}>}
 * @permission Anyone
 */
export const getSessionState = webMethod(
  Permissions.Anyone,
  async (sessionId) => {
    try {
      const cleanId = sanitize(sessionId, 50);
      if (!cleanId) return { success: false, session: null, items: [] };

      const session = await wixData.get(SESSIONS_COLLECTION, cleanId);
      if (!session) return { success: false, session: null, items: [] };

      const items = await wixData.query(ITEMS_COLLECTION)
        .eq('sessionId', cleanId)
        .limit(50)
        .find();

      return {
        success: true,
        session: formatSession(session),
        items: items.items.map(formatItem),
      };
    } catch (err) {
      console.error('[collaborativePlanner] getSessionState error:', err);
      return { success: false, session: null, items: [] };
    }
  }
);

// ── Item Management ─────────────────────────────────────────────────

/**
 * Place a product item in the room plan.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.productId
 * @param {string} params.productName
 * @param {number} params.price
 * @param {number} params.x - X position (feet from left wall)
 * @param {number} params.y - Y position (feet from top wall)
 * @param {number} [params.width] - Item width in feet
 * @param {number} [params.depth] - Item depth in feet
 * @param {number} [params.rotation=0] - Rotation in degrees
 * @param {string} [params.placedBy] - Name of participant who placed it
 * @returns {Promise<{success: boolean, itemId: string|null}>}
 * @permission Anyone
 */
export const placeItem = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const sessionId = sanitize(params.sessionId, 50);
      const productId = sanitize(params.productId, 50);
      const productName = sanitize(params.productName, 200);
      const placedBy = sanitize(params.placedBy || 'Anonymous', 100);

      if (!sessionId || !productId || !productName) {
        return { success: false, itemId: null, error: 'Missing required fields' };
      }

      const price = typeof params.price === 'number' ? params.price : 0;
      const x = typeof params.x === 'number' ? params.x : 0;
      const y = typeof params.y === 'number' ? params.y : 0;
      const width = typeof params.width === 'number' ? params.width : 3;
      const depth = typeof params.depth === 'number' ? params.depth : 2;
      const rotation = typeof params.rotation === 'number' ? params.rotation : 0;

      const item = await wixData.insert(ITEMS_COLLECTION, {
        sessionId,
        productId,
        productName,
        price,
        x, y, width, depth, rotation,
        placedBy,
        placedAt: new Date(),
      });

      // Update session item count + activity
      const session = await wixData.get(SESSIONS_COLLECTION, sessionId);
      if (session) {
        session.itemCount = (session.itemCount || 0) + 1;
        session.lastActivity = new Date();
        await wixData.update(SESSIONS_COLLECTION, session);
      }

      // Broadcast to other participants
      try {
        await realtime.publish(`planner_${sessionId}`, {
          type: 'item_placed',
          item: formatItem(item),
          placedBy,
        });
      } catch (e) {}

      return { success: true, itemId: item._id };
    } catch (err) {
      console.error('[collaborativePlanner] placeItem error:', err);
      return { success: false, itemId: null, error: 'Failed to place item' };
    }
  }
);

/**
 * Move an existing item to a new position.
 *
 * @param {string} itemId
 * @param {number} x
 * @param {number} y
 * @param {number} [rotation]
 * @param {string} [movedBy]
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const moveItem = webMethod(
  Permissions.Anyone,
  async (itemId, x, y, rotation, movedBy) => {
    try {
      const cleanId = sanitize(itemId, 50);
      const item = await wixData.get(ITEMS_COLLECTION, cleanId);
      if (!item) return { success: false, error: 'Item not found' };

      item.x = typeof x === 'number' ? x : item.x;
      item.y = typeof y === 'number' ? y : item.y;
      if (typeof rotation === 'number') item.rotation = rotation;

      await wixData.update(ITEMS_COLLECTION, item);

      try {
        await realtime.publish(`planner_${item.sessionId}`, {
          type: 'item_moved',
          itemId: cleanId,
          x: item.x, y: item.y, rotation: item.rotation,
          movedBy: sanitize(movedBy || '', 100),
        });
      } catch (e) {}

      return { success: true };
    } catch (err) {
      console.error('[collaborativePlanner] moveItem error:', err);
      return { success: false, error: 'Failed to move item' };
    }
  }
);

/**
 * Remove an item from the room plan.
 *
 * @param {string} itemId
 * @param {string} [removedBy]
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const removeItem = webMethod(
  Permissions.Anyone,
  async (itemId, removedBy) => {
    try {
      const cleanId = sanitize(itemId, 50);
      const item = await wixData.get(ITEMS_COLLECTION, cleanId);
      if (!item) return { success: false, error: 'Item not found' };

      const sessionId = item.sessionId;
      await wixData.remove(ITEMS_COLLECTION, cleanId);

      // Update session item count
      const session = await wixData.get(SESSIONS_COLLECTION, sessionId);
      if (session) {
        session.itemCount = Math.max(0, (session.itemCount || 0) - 1);
        session.lastActivity = new Date();
        await wixData.update(SESSIONS_COLLECTION, session);
      }

      try {
        await realtime.publish(`planner_${sessionId}`, {
          type: 'item_removed',
          itemId: cleanId,
          removedBy: sanitize(removedBy || '', 100),
        });
      } catch (e) {}

      return { success: true };
    } catch (err) {
      console.error('[collaborativePlanner] removeItem error:', err);
      return { success: false, error: 'Failed to remove item' };
    }
  }
);

// ── Cart Summary ────────────────────────────────────────────────────

/**
 * Get the shared cart summary for a session (all placed items with prices).
 *
 * @param {string} sessionId
 * @returns {Promise<{success: boolean, items: Array, total: number}>}
 * @permission Anyone
 */
export const getSessionCart = webMethod(
  Permissions.Anyone,
  async (sessionId) => {
    try {
      const cleanId = sanitize(sessionId, 50);
      if (!cleanId) return { success: false, items: [], total: 0 };

      const result = await wixData.query(ITEMS_COLLECTION)
        .eq('sessionId', cleanId)
        .limit(50)
        .find();

      const items = result.items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        price: i.price,
        placedBy: i.placedBy,
      }));

      const total = items.reduce((sum, i) => sum + (i.price || 0), 0);

      return { success: true, items, total };
    } catch (err) {
      console.error('[collaborativePlanner] getSessionCart error:', err);
      return { success: false, items: [], total: 0 };
    }
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function generateShareToken() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

function formatSession(s) {
  return {
    sessionId: s._id,
    roomName: s.roomName,
    roomWidth: s.roomWidth,
    roomLength: s.roomLength,
    shareToken: s.shareToken,
    creatorName: s.creatorName,
    participants: s.participants || [],
    participantCount: s.participantCount,
    status: s.status,
    itemCount: s.itemCount || 0,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  };
}

function formatItem(i) {
  return {
    itemId: i._id,
    productId: i.productId,
    productName: i.productName,
    price: i.price,
    x: i.x, y: i.y,
    width: i.width, depth: i.depth,
    rotation: i.rotation,
    placedBy: i.placedBy,
  };
}
