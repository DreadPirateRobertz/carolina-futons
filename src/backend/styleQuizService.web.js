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
import { sanitize } from 'backend/utils/sanitize';

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
    let existingShareId = null;
    try {
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find();
      if (existing.items.length > 0) {
        existingId = existing.items[0]._id;
        existingShareId = existing.items[0].shareId;
      }
    } catch (err) {
      console.error('[styleQuizService] query error on upsert check:', err);
    }

    const shareId = existingShareId || generateShareId();

    const record = {
      memberId,
      answers: JSON.stringify(answers),
      resultTag: sanitize(resultTag || '', 200),
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

// ── Quiz questions ────────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    text: 'How would you describe your room size?',
    options: [
      { value: 'small',  label: 'Small — studio, dorm, or compact room' },
      { value: 'medium', label: 'Medium — standard bedroom or living room' },
      { value: 'large',  label: 'Large — open floor plan or great room' },
    ],
  },
  {
    id: 'q2',
    text: 'What is your budget for this purchase?',
    options: [
      { value: 'budget',    label: 'Under $500' },
      { value: 'mid-range', label: '$500 – $1,000' },
      { value: 'premium',   label: '$1,000 – $2,000' },
      { value: 'luxury',    label: 'Over $2,000' },
    ],
  },
  {
    id: 'q3',
    text: 'How will you primarily use this piece?',
    options: [
      { value: 'sleep',  label: 'Mostly sleeping — it\'s my main or guest bed' },
      { value: 'lounge', label: 'Mostly lounging — sitting, relaxing, watching TV' },
      { value: 'both',   label: 'Both equally — I need it to do it all' },
    ],
  },
  {
    id: 'q4',
    text: 'Which aesthetic best describes your style?',
    options: [
      { value: 'modern',   label: 'Modern — clean lines, contemporary feel' },
      { value: 'rustic',   label: 'Rustic — natural wood, earthy character' },
      { value: 'classic',  label: 'Classic — timeless, traditional elegance' },
      { value: 'eclectic', label: 'Eclectic — mix of styles, bold personality' },
    ],
  },
  {
    id: 'q5',
    text: 'What mattress feel do you prefer?',
    options: [
      { value: 'soft',   label: 'Soft — plush, sink-in comfort' },
      { value: 'medium', label: 'Medium — balanced support and cushion' },
      { value: 'firm',   label: 'Firm — solid, supportive feel' },
    ],
  },
];

// ── Product scoring catalogue ─────────────────────────────────────────────────

const QUIZ_PRODUCTS = [
  {
    productId: 'essential-futon-twin',
    productName: 'Essential Twin Futon Frame',
    reason: 'Ideal for small spaces on a tight budget — compact, functional, and easy to move.',
    scores: {
      q1: { small: 5, medium: 2, large: 0 },
      q2: { budget: 5, 'mid-range': 2, premium: 0, luxury: 0 },
      q3: { sleep: 2, lounge: 3, both: 4 },
      q4: { modern: 2, rustic: 3, classic: 3, eclectic: 2 },
      q5: { soft: 3, medium: 3, firm: 1 },
    },
  },
  {
    productId: 'classic-full-futon',
    productName: 'Classic Full Futon Frame',
    reason: 'The everyday workhorse — comfortable for lounging and reliable for overnight guests.',
    scores: {
      q1: { small: 2, medium: 4, large: 2 },
      q2: { budget: 2, 'mid-range': 5, premium: 2, luxury: 0 },
      q3: { sleep: 2, lounge: 4, both: 5 },
      q4: { modern: 1, rustic: 3, classic: 5, eclectic: 3 },
      q5: { soft: 4, medium: 5, firm: 2 },
    },
  },
  {
    productId: 'wall-hugger-queen',
    productName: 'Wall Hugger Queen Frame',
    reason: 'Space-saving design that reclines without stealing floor space — modern style, everyday comfort.',
    scores: {
      q1: { small: 4, medium: 4, large: 1 },
      q2: { budget: 0, 'mid-range': 5, premium: 3, luxury: 1 },
      q3: { sleep: 1, lounge: 5, both: 4 },
      q4: { modern: 5, rustic: 1, classic: 2, eclectic: 3 },
      q5: { soft: 2, medium: 4, firm: 3 },
    },
  },
  {
    productId: 'murphy-cabinet-bed-queen',
    productName: 'Murphy Cabinet Bed Queen',
    reason: 'Maximum space efficiency — folds completely away when not in use, ideal for dedicated sleep in small rooms.',
    scores: {
      q1: { small: 5, medium: 3, large: 0 },
      q2: { budget: 0, 'mid-range': 1, premium: 5, luxury: 4 },
      q3: { sleep: 5, lounge: 0, both: 2 },
      q4: { modern: 5, rustic: 1, classic: 2, eclectic: 3 },
      q5: { soft: 1, medium: 3, firm: 5 },
    },
  },
  {
    productId: 'luxury-queen-futon',
    productName: 'Luxury Queen Futon',
    reason: 'Premium comfort with high-end upholstery — the best of both worlds for lounging and sleeping.',
    scores: {
      q1: { small: 1, medium: 4, large: 5 },
      q2: { budget: 0, 'mid-range': 2, premium: 4, luxury: 5 },
      q3: { sleep: 3, lounge: 4, both: 5 },
      q4: { modern: 3, rustic: 2, classic: 4, eclectic: 5 },
      q5: { soft: 5, medium: 4, firm: 2 },
    },
  },
  {
    productId: 'platform-bed-queen',
    productName: 'Platform Bed Queen',
    reason: 'A dedicated sleep solution built to last — solid platform base with natural wood character.',
    scores: {
      q1: { small: 0, medium: 3, large: 5 },
      q2: { budget: 0, 'mid-range': 2, premium: 4, luxury: 5 },
      q3: { sleep: 5, lounge: 0, both: 1 },
      q4: { modern: 2, rustic: 5, classic: 3, eclectic: 2 },
      q5: { soft: 1, medium: 3, firm: 5 },
    },
  },
];

const ANSWER_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'];

function scoreProduct(product, answers) {
  return ANSWER_KEYS.reduce((total, key) => {
    const answerValue = answers[key];
    const dimensionScores = product.scores[key] || {};
    return total + (dimensionScores[answerValue] || 0);
  }, 0);
}

// ── getQuizQuestions ──────────────────────────────────────────────────────────

/**
 * Return the 5 sleep/lifestyle quiz questions with their answer options.
 *
 * @function getQuizQuestions
 * @returns {Array<{id: string, text: string, options: Array<{value: string, label: string}>}>}
 * @permission Anyone
 */
export const getQuizQuestions = webMethod(
  Permissions.Anyone,
  () => QUIZ_QUESTIONS,
);

// ── getRecommendation ─────────────────────────────────────────────────────────

/**
 * Score all products against the supplied quiz answers and return the best match.
 * Ties are broken by catalogue order (first product wins).
 *
 * @function getRecommendation
 * @param {{ q1: string, q2: string, q3: string, q4: string, q5: string }} answers
 * @returns {{ productId: string, productName: string, reason: string, score: number }
 *           | { error: 'missing_answers' }}
 * @permission Anyone
 */
export const getRecommendation = webMethod(
  Permissions.Anyone,
  (answers) => {
    if (
      !answers ||
      typeof answers !== 'object' ||
      Array.isArray(answers) ||
      !ANSWER_KEYS.every(k => k in answers)
    ) {
      return { error: 'missing_answers' };
    }

    let best = null;
    let bestScore = -1;

    for (const product of QUIZ_PRODUCTS) {
      const score = scoreProduct(product, answers);
      if (score > bestScore) {
        bestScore = score;
        best = product;
      }
    }

    return {
      productId:   best.productId,
      productName: best.productName,
      reason:      best.reason,
      score:       bestScore,
    };
  },
);
