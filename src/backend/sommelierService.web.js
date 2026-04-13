/**
 * @module sommelierService
 * @description Backend service for the SommelierWidget — scores products against
 * a member's comfort/size/budget quiz preferences and returns the top 3 matches
 * for display on the PDP.
 *
 * Quiz params shape:
 *   { comfort: 'plush'|'medium'|'firm',
 *     size:    'twin'|'full'|'queen'|'king',
 *     budget:  'under-500'|'500-1000'|'1000-2000'|'over-2000' }
 *
 * @setup
 * MemberProfiles CMS collection — add field:
 *   sommelierPrefs (text) — JSON-serialised last-used quiz params
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * CF-d9s
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────────────

/** @public — consumed by SommelierWidget for dropdown population */
export const VALID_COMFORTS = ['plush', 'medium', 'firm'];
export const VALID_SIZES    = ['twin', 'full', 'queen', 'king'];
export const VALID_BUDGETS  = ['under-500', '500-1000', '1000-2000', 'over-2000'];

const BUDGET_RANGES = {
  'under-500':   { min: 0,    max: 500   },
  '500-1000':    { min: 500,  max: 1000  },
  '1000-2000':   { min: 1000, max: 2000  },
  'over-2000':   { min: 2000, max: 99999 },
};

// Comfort keywords: text in product name/description that signals feel preference.
// Why: Wix Stores/Products has no structured comfort field — keywords in the
// product name and description are the only reliable signal. (CF-d9s)
const COMFORT_KEYWORDS = {
  plush:  ['plush', 'soft', 'pillow-top', 'ultra', 'luxury'],
  medium: ['medium', 'balanced', 'versatile', 'all-purpose'],
  firm:   ['firm', 'supportive', 'orthopedic', 'durable', 'heavy-duty'],
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Score a single product against quiz params.
 * @param {Object} item       Wix Stores/Products CMS record
 * @param {Object} params     Validated quiz params
 * @returns {{ score: number, matchScore: string }}
 */
function scoreProduct(item, params) {
  let score = 0;

  // Budget fit (40 points) — products fetched within budget, so full points if in range
  // Why: budget is the strongest filter; users without budget fit won't be happy. (CF-d9s)
  const budget = BUDGET_RANGES[params.budget];
  if (item.price >= budget.min && item.price <= budget.max) {
    score += 40;
  }

  // Size match (30 points) — check availableSizes array for exact match
  const sizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
  if (sizes.some(s => s.toLowerCase() === params.size)) {
    score += 30;
  }

  // Comfort match (30 points) — keyword scan of name + description
  const text = `${item.name || ''} ${item.description || ''}`.toLowerCase();
  const keywords = COMFORT_KEYWORDS[params.comfort] || [];
  if (keywords.some(kw => text.includes(kw))) {
    score += 30;
  }

  // Tie-breaker bonuses (up to 10 extra)
  if (item.numericRating > 4) score += 5;
  if (item.inStock !== false) score += 5;

  return {
    score,
    matchScore: `${score}% match`,
  };
}

function formatProduct(item) {
  return {
    _id:          item._id,
    name:         item.name,
    slug:         item.slug,
    price:        item.price,
    formattedPrice: item.formattedPrice,
    mainMedia:    item.mainMedia,
  };
}

function validateParams(params) {
  if (!params || typeof params !== 'object') return null;
  const comfort = VALID_COMFORTS.includes(params.comfort) ? params.comfort : null;
  const size    = VALID_SIZES.includes(params.size)       ? params.size    : null;
  const budget  = VALID_BUDGETS.includes(params.budget)   ? params.budget  : null;
  if (!comfort || !size || !budget) return null;
  return { comfort, size, budget };
}

// ── getRecommendations ────────────────────────────────────────────────────────

/**
 * Score and return the top 3 product recommendations for the given quiz params.
 * Falls back to price-range-only results if no comfort/size match is found.
 *
 * @param {Object} quizParams
 * @param {string} quizParams.comfort  'plush' | 'medium' | 'firm'
 * @param {string} quizParams.size     'twin' | 'full' | 'queen' | 'king'
 * @param {string} quizParams.budget   'under-500' | '500-1000' | '1000-2000' | 'over-2000'
 * @returns {Promise<{
 *   success: boolean,
 *   recommendations: Array<{product: Object, score: number, matchScore: string}>,
 *   error?: string
 * }>}
 * @permission Anyone
 */
export const getRecommendations = webMethod(
  Permissions.Anyone,
  async (quizParams) => {
    try {
      const params = validateParams(quizParams);
      if (!params) {
        return { success: false, recommendations: [], error: 'Invalid quiz params.' };
      }

      const budget = BUDGET_RANGES[params.budget];

      const result = await wixData.query('Stores/Products')
        .ge('price', budget.min)
        .le('price', budget.max)
        .limit(20)
        .find();

      if (!result.items.length) {
        return { success: true, recommendations: [] };
      }

      // Score all products in budget range, sort, return top 3
      const scored = result.items
        .map(item => {
          const { score, matchScore } = scoreProduct(item, params);
          return { product: formatProduct(item), score, matchScore };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return { success: true, recommendations: scored };
    } catch (err) {
      console.error('[sommelierService] getRecommendations error:', err);
      return { success: false, recommendations: [], error: 'internal_error' };
    }
  }
);

// ── savePreferences ───────────────────────────────────────────────────────────

/**
 * Persist the member's Sommelier quiz preferences to their MemberProfiles record.
 * Derives memberId from the session — no IDOR risk. (CF-d9s)
 *
 * @param {Object} quizParams — same shape as getRecommendations
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission SiteMember
 */
export const savePreferences = webMethod(
  Permissions.SiteMember,
  async (quizParams) => {
    try {
      const params = validateParams(quizParams);
      if (!params) {
        return { success: false, error: 'Invalid quiz params.' };
      }

      const member = await currentMember.getMember();
      if (!member?._id) {
        return { success: false, error: 'Authentication required.' };
      }

      // Upsert MemberProfiles record — set sommelierPrefs field
      const existing = await wixData.query('MemberProfiles')
        .eq('memberId', member._id)
        .limit(1)
        .find({ suppressAuth: true });

      const prefsJson = JSON.stringify(params);

      if (existing.items.length) {
        await wixData.update('MemberProfiles', {
          ...existing.items[0],
          sommelierPrefs: prefsJson,
        }, { suppressAuth: true });
      } else {
        await wixData.insert('MemberProfiles', {
          memberId:       member._id,
          sommelierPrefs: prefsJson,
        }, { suppressAuth: true });
      }

      return { success: true };
    } catch (err) {
      console.error('[sommelierService] savePreferences error:', err);
      return { success: false, error: 'internal_error' };
    }
  }
);

// ── getMyPreferences ──────────────────────────────────────────────────────────

/**
 * Return the current member's saved Sommelier quiz preferences.
 * Derives memberId from the session.
 *
 * @returns {Promise<{success: boolean, prefs: Object|null, error?: string}>}
 * @permission SiteMember
 */
export const getMyPreferences = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) {
        return { success: false, prefs: null, error: 'Authentication required.' };
      }

      const result = await wixData.query('MemberProfiles')
        .eq('memberId', member._id)
        .limit(1)
        .find({ suppressAuth: true });

      if (!result.items.length || !result.items[0].sommelierPrefs) {
        return { success: true, prefs: null };
      }

      try {
        const prefs = JSON.parse(result.items[0].sommelierPrefs);
        return { success: true, prefs };
      } catch {
        return { success: true, prefs: null };
      }
    } catch (err) {
      console.error('[sommelierService] getMyPreferences error:', err);
      return { success: false, prefs: null, error: 'internal_error' };
    }
  }
);
