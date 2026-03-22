// notificationPreferences.web.js — Notification Preferences backend web methods
// Provides a thin frontend-facing API for managing per-member notification opt-ins.
// Reads/writes the MemberNotificationPrefs CMS collection.
//
// @setup
// Create CMS collection `MemberNotificationPrefs` with fields:
//   memberId    (Text, indexed) — member ID
//   restock     (Boolean) — restock alerts
//   orderUpdate (Boolean) — order status updates
//   promo       (Boolean) — promotional emails
//   cfPlus      (Boolean) — CF+ membership updates
//   sms         (Boolean) — SMS notifications
//   updatedAt   (Date)    — last updated

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';

const COLLECTION = 'MemberNotificationPrefs';

// Default prefs shape returned when no record exists yet.
const DEFAULT_PREFS = {
  restock:     true,
  orderUpdate: true,
  promo:       false,
  cfPlus:      true,
  sms:         false,
};

// ── getNotificationPreferences ────────────────────────────────────────

/**
 * Load notification preferences for a member.
 * Returns defaults if no record exists.
 *
 * @param {string} memberId
 * @returns {Promise<{success: boolean, prefs: Object, error?: string}>}
 *   prefs: { restock, orderUpdate, promo, cfPlus, sms }
 */
export const getNotificationPreferences = webMethod(
  Permissions.Member,
  async (memberId) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID required' };
      const cleanId = validateId(memberId);
      if (!cleanId) return { success: false, error: 'Invalid member ID' };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: true, prefs: { ...DEFAULT_PREFS } };
      }

      const item = result.items[0];
      return {
        success: true,
        prefs: {
          restock:     Boolean(item.restock     ?? DEFAULT_PREFS.restock),
          orderUpdate: Boolean(item.orderUpdate ?? DEFAULT_PREFS.orderUpdate),
          promo:       Boolean(item.promo       ?? DEFAULT_PREFS.promo),
          cfPlus:      Boolean(item.cfPlus      ?? DEFAULT_PREFS.cfPlus),
          sms:         Boolean(item.sms         ?? DEFAULT_PREFS.sms),
        },
      };
    } catch (e) {
      console.error('[notificationPreferences] getNotificationPreferences failed:', e);
      return { success: false, error: 'Failed to load preferences' };
    }
  }
);

// ── saveNotificationPreferences ───────────────────────────────────────

/**
 * Save notification preferences for a member (upsert).
 *
 * @param {string} memberId
 * @param {Object} prefs - { restock, orderUpdate, promo, cfPlus, sms }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const saveNotificationPreferences = webMethod(
  Permissions.Member,
  async (memberId, prefs) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID required' };
      const cleanId = validateId(memberId);
      if (!cleanId) return { success: false, error: 'Invalid member ID' };
      if (!prefs || typeof prefs !== 'object') return { success: false, error: 'Preferences required' };

      const existing = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .limit(1)
        .find();

      const data = {
        memberId: cleanId,
        restock:     Boolean(prefs.restock),
        orderUpdate: Boolean(prefs.orderUpdate),
        promo:       Boolean(prefs.promo),
        cfPlus:      Boolean(prefs.cfPlus),
        sms:         Boolean(prefs.sms),
        updatedAt:   new Date(),
      };

      if (existing.items.length > 0) {
        await wixData.update(COLLECTION, { ...data, _id: existing.items[0]._id });
      } else {
        await wixData.insert(COLLECTION, data);
      }

      return { success: true };
    } catch (e) {
      console.error('[notificationPreferences] saveNotificationPreferences failed:', e);
      return { success: false, error: 'Failed to save preferences' };
    }
  }
);

// ── unsubscribeAll ────────────────────────────────────────────────────

/**
 * Opt a member out of all notification types at once.
 *
 * @param {string} memberId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const unsubscribeAll = webMethod(
  Permissions.Member,
  async (memberId) => {
    try {
      if (!memberId) return { success: false, error: 'Member ID required' };
      const cleanId = validateId(memberId);
      if (!cleanId) return { success: false, error: 'Invalid member ID' };

      const allOff = {
        restock:     false,
        orderUpdate: false,
        promo:       false,
        cfPlus:      false,
        sms:         false,
      };

      const existing = await wixData.query(COLLECTION)
        .eq('memberId', cleanId)
        .limit(1)
        .find();

      const data = {
        memberId:  cleanId,
        ...allOff,
        updatedAt: new Date(),
      };

      if (existing.items.length > 0) {
        await wixData.update(COLLECTION, { ...data, _id: existing.items[0]._id });
      } else {
        await wixData.insert(COLLECTION, data);
      }

      return { success: true };
    } catch (e) {
      console.error('[notificationPreferences] unsubscribeAll failed:', e);
      return { success: false, error: 'Failed to unsubscribe' };
    }
  }
);
