/**
 * @module styleQuizService
 * @description Persistence and sharing for Style Quiz results.
 * Saves completed quiz results for members, retrieves prior results on
 * re-visit, and resolves publicly-accessible share URLs.
 *
 * @setup
 * Create `Members/StyleQuizResults` CMS collection:
 *   memberId    (text)     — Wix member ID
 *   answers     (text)     — JSON-serialised quiz answers
 *   resultTag   (text)     — human-readable style profile title, e.g. "Your Modern Living Room Style"
 *   shareId     (text)     — URL-safe random token for the /style-quiz/result/[shareId] page
 *   completedAt (dateTime) — UTC timestamp
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const COLLECTION = 'Members/StyleQuizResults';
const BASE_URL = 'https://www.carolinafutons.com';
const SHARE_PATH = '/style-quiz/result';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateShareId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ── saveQuizResult ────────────────────────────────────────────────────────────

/**
 * Persist the current member's quiz result.
 * If the member already has a saved result it is replaced (upsert by memberId).
 *
 * @function saveQuizResult
 * @param {Object} answers   - Completed quiz answers object.
 * @param {string} resultTag - Human-readable style profile title (e.g. "Your Modern Living Room Style").
 * @returns {Promise<{shareId: string, shareUrl: string} | {error: string}>}
 * @permission SiteMember
 */
export const saveQuizResult = webMethod(
  Permissions.SiteMember,
  async (answers, resultTag) => {
    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error('[styleQuizService] getMember error:', err);
      return { error: 'auth_failed' };
    }

    if (!member || !member._id) {
      return { error: 'unauthenticated' };
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return { error: 'invalid_answers' };
    }

    const memberId = member._id;

    // Check for an existing result to upsert
    let existingId = null;
    try {
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find();
      if (existing.items.length > 0) {
        existingId = existing.items[0]._id;
      }
    } catch (err) {
      console.error('[styleQuizService] query error on upsert check:', err);
    }

    const shareId = existingId
      ? (await wixData.query(COLLECTION).eq('_id', existingId).limit(1).find()).items[0]?.shareId || generateShareId()
      : generateShareId();

    const record = {
      memberId,
      answers: JSON.stringify(answers),
      resultTag: resultTag || '',
      shareId,
      completedAt: new Date(),
    };

    try {
      if (existingId) {
        await wixData.update(COLLECTION, { ...record, _id: existingId });
      } else {
        await wixData.insert(COLLECTION, record);
      }
    } catch (err) {
      console.error('[styleQuizService] save error:', err);
      return { error: 'save_failed' };
    }

    return {
      shareId,
      shareUrl: `${BASE_URL}${SHARE_PATH}/${shareId}`,
    };
  }
);

// ── getMyResult ───────────────────────────────────────────────────────────────

/**
 * Get the current member's most recent quiz result, if any.
 *
 * @function getMyResult
 * @returns {Promise<
 *   { memberId: string, answers: Object, resultTag: string, shareId: string, shareUrl: string, completedAt: Date } |
 *   null |
 *   { error: string }
 * >}
 * @permission SiteMember
 */
export const getMyResult = webMethod(
  Permissions.SiteMember,
  async () => {
    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error('[styleQuizService] getMember error:', err);
      return { error: 'auth_failed' };
    }

    if (!member || !member._id) {
      return { error: 'unauthenticated' };
    }

    try {
      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('completedAt')
        .limit(1)
        .find();

      if (result.items.length === 0) return null;

      const item = result.items[0];
      return {
        memberId: item.memberId,
        answers: parseAnswers(item.answers),
        resultTag: item.resultTag,
        shareId: item.shareId,
        shareUrl: `${BASE_URL}${SHARE_PATH}/${item.shareId}`,
        completedAt: item.completedAt,
      };
    } catch (err) {
      console.error('[styleQuizService] getMyResult error:', err);
      return { error: 'fetch_failed' };
    }
  }
);

// ── getSharedResult ───────────────────────────────────────────────────────────

/**
 * Resolve a share URL to its quiz result. Publicly accessible.
 * Returns only fields safe for unauthenticated visitors (no memberId).
 *
 * @function getSharedResult
 * @param {string} shareId - The URL-safe token from /style-quiz/result/[shareId].
 * @returns {Promise<
 *   { answers: Object, resultTag: string, completedAt: Date } |
 *   null |
 *   { error: string }
 * >}
 * @permission Anyone
 */
export const getSharedResult = webMethod(
  Permissions.Anyone,
  async (shareId) => {
    if (!shareId || typeof shareId !== 'string') return null;

    try {
      const result = await wixData.query(COLLECTION)
        .eq('shareId', shareId)
        .limit(1)
        .find();

      if (result.items.length === 0) return null;

      const item = result.items[0];
      return {
        answers: parseAnswers(item.answers),
        resultTag: item.resultTag,
        completedAt: item.completedAt,
      };
    } catch (err) {
      console.error('[styleQuizService] getSharedResult error:', err);
      return { error: 'fetch_failed' };
    }
  }
);

// ── Private helpers ───────────────────────────────────────────────────────────

function parseAnswers(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
