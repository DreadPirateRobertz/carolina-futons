/**
 * @module surveyService
 * @description NPS/CSAT post-purchase survey system.
 * Sends a survey link 7 days after delivery confirmation.
 * Captures a 0–10 NPS score and optional open-text comment.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `SurveyResponses` with fields:
 *   memberId    (Text, indexed) — member who responded
 *   orderId     (Text, indexed) — associated order
 *   npsScore    (Number)        — 0–10 NPS rating
 *   comment     (Text)          — optional open-text feedback (max 1000 chars)
 *   sentAt      (Date, indexed) — when the survey email was sent
 *   completedAt (Date, indexed) — when the member submitted the response
 *
 * CF-1mlj
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const SURVEY_COLLECTION = 'SurveyResponses';
const MAX_COMMENT_LENGTH = 1000;
const NPS_MIN = 0;
const NPS_MAX = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function resolveCurrentMemberId() {
  try {
    const member = await currentMember.getMember();
    return member?._id ?? null;
  } catch {
    return null;
  }
}

/**
 * Validate NPS score is an integer in [0, 10].
 * @param {unknown} score
 * @returns {boolean}
 */
function isValidNpsScore(score) {
  const n = Number(score);
  return Number.isInteger(n) && n >= NPS_MIN && n <= NPS_MAX;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Queue a survey for a member 7 days after delivery confirmation.
 * Inserts an EmailQueue entry and creates a pending SurveyResponse record.
 * Safe to call multiple times — skips if a survey was already sent for this order.
 *
 * @param {Object} data
 * @param {string} data.memberId     — member ID
 * @param {string} data.orderId      — order ID
 * @param {string} [data.email]      — recipient email
 * @param {Date}   [data.deliveredAt] — delivery date (defaults to now)
 * @returns {Promise<{success: boolean, scheduled?: boolean}>}
 */
export const scheduleSurvey = webMethod(
  Permissions.Admin,
  async (data) => {
    if (!data?.memberId || !data?.orderId) {
      return { success: false, error: 'memberId and orderId are required' };
    }

    const memberId = sanitize(data.memberId, 100);
    const orderId = sanitize(data.orderId, 100);

    if (!memberId || !orderId) {
      return { success: false, error: 'Invalid memberId or orderId' };
    }

    const email = data.email ? sanitize(String(data.email), 254) : '';

    const deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : new Date();
    const sendAt = new Date(deliveredAt);
    sendAt.setDate(sendAt.getDate() + 7);

    // Idempotency: use a deterministic _id to make the insert atomic.
    // If a concurrent request races through, the second insert will throw a
    // duplicate-ID error and we return success: false without double-scheduling.
    const surveyId = `survey_${memberId}_${orderId}`;

    try {
      await wixData.insert(SURVEY_COLLECTION, {
        _id: surveyId,
        memberId,
        orderId,
        npsScore: null,
        comment: null,
        sentAt: sendAt,
        completedAt: null,
      });
    } catch (err) {
      const msg = err?.message ?? '';
      if (msg.includes('duplicate') || msg.includes('already exists') || msg.includes('WD_DUPLICATE')) {
        return { success: true, scheduled: false };
      }
      logError('surveyService:scheduleSurvey:insert', err);
      return { success: false, error: 'Failed to create survey record' };
    }

    // Queue the email to send at sendAt
    try {
      await wixData.insert('EmailQueue', {
        templateId: 'nps_survey',
        recipientEmail: email,
        recipientContactId: memberId,
        variables: JSON.stringify({ orderId }),
        sequenceType: 'survey',
        sequenceStep: 1,
        scheduledFor: sendAt,
        status: 'pending',
        createdAt: new Date(),
      });
    } catch (emailErr) {
      console.warn('[surveyService] Email queue insert failed:', emailErr.message);
      // Non-fatal — survey record was created; email can be retried
    }

    return { success: true, scheduled: true };
  }
);

/**
 * Submit a survey response.
 * Members may only submit once per order.
 *
 * @param {Object} data
 * @param {string} data.orderId  — the order this survey is for
 * @param {number} data.npsScore — 0–10 NPS rating
 * @param {string} [data.comment] — optional open-text feedback
 * @returns {Promise<{success: boolean}>}
 */
export const submitSurveyResponse = webMethod(
  Permissions.SiteMember,
  async (data) => {
    const memberId = await resolveCurrentMemberId();
    if (!memberId) return { success: false, error: 'Authentication required' };

    if (!data?.orderId || typeof data.orderId !== 'string') {
      return { success: false, error: 'orderId is required' };
    }

    if (!isValidNpsScore(data.npsScore)) {
      return { success: false, error: 'npsScore must be an integer between 0 and 10' };
    }

    const orderId = sanitize(data.orderId, 100);
    if (!orderId) return { success: false, error: 'Invalid orderId' };

    const comment = data.comment
      ? sanitize(String(data.comment), MAX_COMMENT_LENGTH).trim()
      : null;

    // Find the pending survey record for this member + order
    let record;
    try {
      const result = await wixData.query(SURVEY_COLLECTION)
        .eq('memberId', memberId)
        .eq('orderId', orderId)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'No survey found for this order' };
      }

      record = result.items[0];
    } catch (err) {
      logError('surveyService:submitSurveyResponse:query', err);
      return { success: false, error: 'Survey lookup failed' };
    }

    // Prevent double submission
    if (record.completedAt != null) {
      return { success: false, error: 'Survey already completed' };
    }

    try {
      await wixData.update(SURVEY_COLLECTION, {
        ...record,
        npsScore: Number(data.npsScore),
        comment: comment || null,
        completedAt: new Date(),
      });
    } catch (err) {
      logError('surveyService:submitSurveyResponse:update', err);
      return { success: false, error: 'Failed to save survey response' };
    }

    return { success: true };
  }
);

/**
 * Get the survey response for a specific order (for the current member).
 *
 * @param {string} orderId
 * @returns {Promise<{success: boolean, survey: Object|null}>}
 */
export const getSurveyForOrder = webMethod(
  Permissions.SiteMember,
  async (orderId) => {
    const memberId = await resolveCurrentMemberId();
    if (!memberId) return { success: false, error: 'Authentication required' };

    if (!orderId || typeof orderId !== 'string') {
      return { success: false, error: 'orderId is required' };
    }

    const cleanId = sanitize(orderId, 100);
    if (!cleanId) return { success: false, error: 'Invalid orderId' };

    try {
      const result = await wixData.query(SURVEY_COLLECTION)
        .eq('memberId', memberId)
        .eq('orderId', cleanId)
        .find();

      if (result.items.length === 0) return { success: true, survey: null };

      const item = result.items[0];
      return {
        success: true,
        survey: {
          _id: item._id,
          orderId: item.orderId,
          npsScore: item.npsScore,
          comment: item.comment,
          sentAt: item.sentAt,
          completedAt: item.completedAt,
          isCompleted: item.completedAt != null,
        },
      };
    } catch (err) {
      logError('surveyService:getSurveyForOrder', err);
      return { success: false, error: 'Survey lookup failed' };
    }
  }
);

/**
 * Get detailed survey response aggregation for the admin analytics dashboard.
 * Returns score distribution histogram, completion rate, and recent open comments.
 *
 * @param {Object} [opts]
 * @param {number} [opts.days=90]       — look-back window in days (1–365)
 * @param {number} [opts.commentLimit=10] — max recent comments to return
 * @returns {Promise<{success: boolean, aggregation: Object}>}
 */
export const getSurveyResponseAggregation = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const days = (opts.days != null && Number.isFinite(Number(opts.days)))
      ? Math.min(Math.max(1, Number(opts.days)), 365)
      : 90;
    const commentLimit = (opts.commentLimit != null && Number.isFinite(Number(opts.commentLimit)))
      ? Math.min(Math.max(1, Number(opts.commentLimit)), 100)
      : 10;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      // Fetch all scheduled surveys (total) and completed ones for the period.
      // Both queries anchor on sentAt so the denominator and numerator share the
      // same cohort (surveys sent in the window), avoiding mixed date-axis skew.
      const [completedResult, scheduledResult] = await Promise.all([
        wixData.query(SURVEY_COLLECTION)
          .ge('sentAt', since)
          .isNotEmpty('completedAt')
          .limit(1000)
          .find(),
        wixData.query(SURVEY_COLLECTION)
          .ge('sentAt', since)
          .limit(1000)
          .find(),
      ]);

      const completed = completedResult.items;
      const scheduled = scheduledResult.items;

      // Score distribution histogram: keys 0–10
      const scoreDistribution = {};
      for (let i = NPS_MIN; i <= NPS_MAX; i++) scoreDistribution[i] = 0;
      for (const r of completed) {
        const s = r.npsScore;
        if (s != null && s >= NPS_MIN && s <= NPS_MAX) {
          scoreDistribution[s]++;
        }
      }

      // Completion rate: completed / scheduled (in period)
      const completionRate = scheduled.length > 0
        ? Math.round((completed.length / scheduled.length) * 100)
        : 0;

      // Recent comments: most recent non-empty comments up to commentLimit
      const recentComments = completed
        .filter(r => r.comment && r.comment.trim().length > 0)
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, commentLimit)
        .map(r => ({
          npsScore: r.npsScore,
          comment: r.comment,
          completedAt: r.completedAt,
        }));

      return {
        success: true,
        aggregation: {
          totalScheduled: scheduled.length,
          totalCompleted: completed.length,
          completionRate,
          scoreDistribution,
          recentComments,
          periodDays: days,
        },
      };
    } catch (err) {
      logError('surveyService:getSurveyResponseAggregation', err);
      return { success: false, error: 'Failed to compute survey aggregation' };
    }
  }
);

/**
 * Get aggregate NPS statistics for the admin analytics dashboard.
 *
 * @param {Object} [opts]
 * @param {number} [opts.days=90] — look-back window in days
 * @returns {Promise<{success: boolean, stats: Object}>}
 */
export const getNpsStats = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const days = (opts.days != null && Number.isFinite(Number(opts.days)))
      ? Math.min(Math.max(1, Number(opts.days)), 365)
      : 90;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
      // TODO: paginate when SurveyResponse volume exceeds 1000
      const result = await wixData.query(SURVEY_COLLECTION)
        .ge('completedAt', since)
        .isNotEmpty('completedAt')
        .limit(1000)
        .find();

      const responses = result.items;
      if (responses.length === 0) {
        return { success: true, stats: { count: 0, npsScore: null, promoters: 0, passives: 0, detractors: 0 } };
      }

      let promoters = 0;
      let passives = 0;
      let detractors = 0;

      for (const r of responses) {
        const score = r.npsScore;
        // Skip rows with null/non-finite score — don't count as detractors
        if (score == null || !Number.isFinite(score)) continue;
        if (score >= 9) promoters++;
        else if (score >= 7) passives++;
        else detractors++;
      }

      const total = promoters + passives + detractors;
      if (total === 0) {
        return { success: true, stats: { count: 0, npsScore: null, promoters: 0, passives: 0, detractors: 0 } };
      }
      const npsScore = Math.round(((promoters - detractors) / total) * 100);

      return {
        success: true,
        stats: {
          count: total,
          npsScore,
          promoters,
          passives,
          detractors,
          promoterPct: Math.round((promoters / total) * 100),
          detractorPct: Math.round((detractors / total) * 100),
          periodDays: days,
        },
      };
    } catch (err) {
      logError('surveyService:getNpsStats', err);
      return { success: false, error: 'Failed to compute NPS stats' };
    }
  }
);
