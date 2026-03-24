/**
 * @module questProgressService
 * @description Quest progress persistence — save and restore quest state across
 * sessions via wixData. Stores per-member, per-quest progress snapshots so
 * that page reloads do not lose in-progress quest state.
 *
 * @setup
 * Create CMS collection "QuestProgress" with fields:
 * - memberId    (Text)     — Wix member ID
 * - questId     (Text)     — Quest identifier (e.g. "daily-login-7")
 * - progressData (Text)    — JSON-serialized progress snapshot
 * - status      (Text)     — "active" | "completed" | "abandoned"
 * - updatedAt   (DateTime) — Last write time (auto-maintained by upsert)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const COLLECTION = 'QuestProgress';

/**
 * Save (upsert) quest progress for a member.
 * If a record for (memberId, questId) already exists it is overwritten.
 *
 * @param {string} memberId
 * @param {string} questId
 * @param {Object} progressData - Arbitrary JSON-serializable progress snapshot
 * @param {string} [status]     - "active" | "completed" | "abandoned" (default "active")
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const saveQuestProgress = webMethod(
  Permissions.SiteMember,
  async (memberId, questId, progressData, status = 'active') => {
    if (!memberId || !questId) {
      return { success: false, error: 'memberId and questId are required' };
    }
    const validStatuses = new Set(['active', 'completed', 'abandoned']);
    if (!validStatuses.has(status)) {
      return { success: false, error: `Invalid status "${status}"` };
    }

    let serialized;
    try {
      serialized = JSON.stringify(progressData ?? null);
    } catch (_) {
      return { success: false, error: 'progressData must be JSON-serializable' };
    }

    try {
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('questId', questId)
        .limit(1)
        .find({ suppressAuth: true });

      const now = new Date();
      if (existing.items.length > 0) {
        await wixData.update(COLLECTION, {
          ...existing.items[0],
          progressData: serialized,
          status,
          updatedAt: now,
        }, { suppressAuth: true });
      } else {
        await wixData.insert(COLLECTION, {
          memberId,
          questId,
          progressData: serialized,
          status,
          updatedAt: now,
        }, { suppressAuth: true });
      }
      return { success: true };
    } catch (err) {
      console.error('[questProgressService] saveQuestProgress failed:', err);
      return { success: false, error: 'Unable to save quest progress' };
    }
  }
);

/**
 * Retrieve stored progress for a specific (memberId, questId) pair.
 *
 * @param {string} memberId
 * @param {string} questId
 * @returns {Promise<{ success: boolean, progressData?: any, status?: string, error?: string }>}
 *   progressData is null when no record exists.
 */
export const getQuestProgress = webMethod(
  Permissions.SiteMember,
  async (memberId, questId) => {
    if (!memberId || !questId) {
      return { success: false, error: 'memberId and questId are required' };
    }

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('questId', questId)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) {
        return { success: true, progressData: null, status: null };
      }

      const record = result.items[0];
      let parsed;
      try {
        parsed = JSON.parse(record.progressData);
      } catch (_) {
        parsed = null;
      }
      return { success: true, progressData: parsed, status: record.status };
    } catch (err) {
      console.error('[questProgressService] getQuestProgress failed:', err);
      return { success: false, error: 'Unable to retrieve quest progress' };
    }
  }
);

/**
 * Return all active (in-progress) quests for a member, sorted by updatedAt desc.
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, quests?: Array, error?: string }>}
 *   quests is an empty array when member has no active quests.
 */
export const getActiveQuests = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      return { success: true, quests: [] };
    }

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('status', 'active')
        .descending('updatedAt')
        .find({ suppressAuth: true });

      const quests = result.items.map((record) => {
        let progressData;
        try {
          progressData = JSON.parse(record.progressData);
        } catch (_) {
          progressData = null;
        }
        return {
          questId: record.questId,
          progressData,
          status: record.status,
          updatedAt: record.updatedAt,
        };
      });

      return { success: true, quests };
    } catch (err) {
      console.error('[questProgressService] getActiveQuests failed:', err);
      return { success: false, error: 'Unable to retrieve active quests' };
    }
  }
);
