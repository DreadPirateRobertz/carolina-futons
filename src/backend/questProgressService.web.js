/**
 * @module questProgressService
 * @description Quest progress persistence — save and restore quest state across
 * sessions via wixData. Stores per-member, per-quest progress snapshots so
 * that page reloads do not lose in-progress quest state.
 *
 * memberId is always derived server-side from the authenticated session; it is
 * never accepted as a caller-supplied parameter to prevent cross-member access.
 *
 * @setup
 * Create CMS collection "QuestProgress" with fields:
 * - memberId    (Text)     — Wix member ID
 * - questId     (Text)     — Quest identifier (e.g. "daily-login-7")
 * - progressData (Text)    — JSON-serialized progress snapshot
 * - status      (Text)     — "active" | "completed" | "abandoned"
 * - updatedAt   (DateTime) — Written explicitly by service on every save
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const COLLECTION = 'QuestProgress';
const ACTIVE_QUESTS_LIMIT = 50;

function parseOrNull(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

/**
 * Save (upsert) quest progress for the authenticated member.
 * If a record for (memberId, questId) already exists it is overwritten.
 *
 * @param {string} questId
 * @param {Object} progressData - Arbitrary JSON-serializable progress snapshot
 * @param {string} [status]     - "active" | "completed" | "abandoned" (default "active")
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const saveQuestProgress = webMethod(
  Permissions.SiteMember,
  async (questId, progressData, status = 'active') => {
    const member = await currentMember.getMember();
    if (!member || !member._id) return { success: false, error: 'auth_required' };
    const memberId = member._id;

    if (!questId) {
      return { success: false, error: 'questId is required' };
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
 * Retrieve stored progress for the authenticated member + questId pair.
 *
 * @param {string} questId
 * @returns {Promise<{ success: boolean, progressData?: any, status?: string|null, error?: string }>}
 *   progressData and status are null when no record exists.
 */
export const getQuestProgress = webMethod(
  Permissions.SiteMember,
  async (questId) => {
    const member = await currentMember.getMember();
    if (!member || !member._id) return { success: false, error: 'auth_required' };
    const memberId = member._id;

    if (!questId) {
      return { success: false, error: 'questId is required' };
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
      const parsed = parseOrNull(record.progressData);
      if (parsed === null && record.progressData !== 'null') {
        console.warn('[questProgressService] getQuestProgress: corrupt progressData for record', record._id);
      }
      return { success: true, progressData: parsed, status: record.status };
    } catch (err) {
      console.error('[questProgressService] getQuestProgress failed:', err);
      return { success: false, error: 'Unable to retrieve quest progress' };
    }
  }
);

/**
 * Return all active (in-progress) quests for the authenticated member,
 * sorted by updatedAt descending. Capped at ACTIVE_QUESTS_LIMIT (50).
 *
 * @returns {Promise<{ success: boolean, quests?: Array, error?: string }>}
 *   quests is an empty array when the member has no active quests.
 */
export const getActiveQuests = webMethod(
  Permissions.SiteMember,
  async () => {
    const member = await currentMember.getMember();
    if (!member || !member._id) return { success: false, error: 'auth_required' };
    const memberId = member._id;

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('status', 'active')
        .descending('updatedAt')
        .limit(ACTIVE_QUESTS_LIMIT)
        .find({ suppressAuth: true });

      const quests = result.items.map((record) => ({
        questId: record.questId,
        progressData: parseOrNull(record.progressData),
        status: record.status,
        updatedAt: record.updatedAt,
      }));

      return { success: true, quests };
    } catch (err) {
      console.error('[questProgressService] getActiveQuests failed:', err);
      return { success: false, error: 'Unable to retrieve active quests' };
    }
  }
);
