/**
 * @module futonSommelier
 * @description Futon Sommelier — conversational AI decision engine.
 *
 * Goes beyond the style quiz by asking about lifestyle factors that affect
 * furniture choice: pets, back issues, sun exposure, guest frequency,
 * room size, budget. Cross-references the full catalog (materials, firmness,
 * durability, price) to deliver personalized recommendations with reasoning.
 *
 * Architecture:
 *   1. Client sends lifestyle answers as structured data
 *   2. Backend scores products using rule-based trait matching against descriptions
 *   3. Returns top matches with per-product reasoning
 *   4. Results cached per session to avoid redundant scoring
 *
 * This is NOT a chat — it's a single-turn recommendation engine.
 * The style quiz asks "what do you like?"; the Sommelier asks "how do you live?"
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * 1. Create CMS collection `SommelierSessions`:
 *      sessionKey (Text, indexed), memberId (Text), answers (Text/JSON),
 *      recommendations (Text/JSON), reasoning (Text),
 *      createdAt (DateTime), feedbackRating (Number)
 *
 * 3. Create CMS collection `SommelierRateLimit`:
 *      key (Text), count (Number), windowStart (DateTime)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const SESSIONS_COLLECTION = 'SommelierSessions';
const MAX_RECOMMENDATIONS = 5;

// ── Lifestyle Factors ───────────────────────────────────────────────

/**
 * Lifestyle question definitions with valid options.
 * Each factor affects product recommendation scoring.
 */
export const LIFESTYLE_FACTORS = {
  primaryUse: {
    question: 'What will this primarily be used for?',
    options: ['daily_sleeping', 'occasional_guests', 'lounging', 'home_office', 'dorm'],
  },
  pets: {
    question: 'Do you have pets that will use the furniture?',
    options: ['no_pets', 'cat', 'dog_small', 'dog_large', 'multiple'],
  },
  backIssues: {
    question: 'Do you have any back or joint concerns?',
    options: ['none', 'mild_lower_back', 'chronic_back', 'joint_pain', 'prefer_firm'],
  },
  sunExposure: {
    question: 'How much direct sunlight does the room get?',
    options: ['minimal', 'moderate', 'heavy_direct', 'south_facing'],
  },
  guestFrequency: {
    question: 'How often do guests stay overnight?',
    options: ['rarely', 'monthly', 'weekly', 'live_in'],
  },
  roomSize: {
    question: 'What best describes your room size?',
    options: ['small_under_120sqft', 'medium_120_200sqft', 'large_over_200sqft'],
  },
  budget: {
    question: 'What is your approximate budget?',
    options: ['under_500', '500_to_1000', '1000_to_1500', 'over_1500', 'flexible'],
  },
  style: {
    question: 'What style do you prefer?',
    options: ['modern', 'rustic', 'transitional', 'minimalist', 'traditional'],
  },
};

// ── Product Scoring Rules ───────────────────────────────────────────

/**
 * Score adjustments based on lifestyle answers.
 * Positive = boost, negative = penalize.
 */
const SCORING_RULES = {
  // Pets → favor durable hardwood frames, avoid light fabrics
  pets: {
    dog_large: { durability: 20, hardwood: 15, fabric_dark: 10 },
    dog_small: { durability: 10, hardwood: 10 },
    cat: { durability: 10, scratch_resistant: 15 },
    multiple: { durability: 25, hardwood: 20, fabric_dark: 15 },
  },
  // Back issues → favor firmer mattresses, specific frame types
  backIssues: {
    chronic_back: { firmness_high: 25, mattress_thick: 15 },
    mild_lower_back: { firmness_medium: 15, mattress_thick: 10 },
    joint_pain: { firmness_medium: 10, comfort_layer: 15 },
    prefer_firm: { firmness_high: 20 },
  },
  // Sun exposure → avoid light-colored fabrics, favor UV-resistant
  sunExposure: {
    heavy_direct: { fabric_dark: 15, uv_resistant: 20, wood_finish_dark: 10 },
    south_facing: { fabric_dark: 10, uv_resistant: 15 },
  },
  // Primary use → affects frame type and mattress preferences
  primaryUse: {
    daily_sleeping: { mattress_thick: 20, firmness_medium: 10, queen_size: 15 },
    occasional_guests: { easy_convert: 15, storage: 10 },
    lounging: { comfort_layer: 15, reclining: 10 },
    dorm: { compact: 20, budget_friendly: 15 },
    home_office: { wall_hugger: 15, compact: 10 },
  },
  // Guest frequency → affects durability and ease of conversion
  guestFrequency: {
    weekly: { durability: 15, easy_convert: 20 },
    live_in: { durability: 20, mattress_thick: 15, queen_size: 10 },
  },
};

// ── Get Recommendation ──────────────────────────────────────────────

/**
 * Get personalized futon recommendations based on lifestyle answers.
 *
 * @param {Object} answers - Lifestyle factor answers keyed by factor ID
 * @param {string} [sessionKey] - Optional session key for caching
 * @returns {Promise<{success: boolean, recommendations?: Array, reasoning?: string,
 *   sessionKey?: string, error?: string}>}
 * @permission Anyone — anonymous visitors can use the sommelier
 */
export const getRecommendation = webMethod(
  Permissions.Anyone,
  async (answers, sessionKey = '') => {
    try {
      if (!answers || typeof answers !== 'object') {
        return { success: false, error: 'Lifestyle answers are required.' };
      }

      const cleanSession = sessionKey ? sanitize(sessionKey, 100) : `som_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const { allowed } = await checkRateLimit('SommelierRateLimit', cleanSession, { max: 5 });
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

      // Check cache
      if (sessionKey) {
        const cached = await wixData.query(SESSIONS_COLLECTION)
          .eq('sessionKey', cleanSession)
          .limit(1)
          .find({ suppressAuth: true });

        if (cached.items.length > 0) {
          const session = cached.items[0];
          return {
            success: true,
            recommendations: safeParseArray(session.recommendations),
            reasoning: session.reasoning || '',
            sessionKey: cleanSession,
            cached: true,
          };
        }
      }

      // Validate and sanitize answers
      const cleanAnswers = {};
      for (const [factor, value] of Object.entries(answers)) {
        if (LIFESTYLE_FACTORS[factor]) {
          const cleanValue = sanitize(String(value), 50);
          if (LIFESTYLE_FACTORS[factor].options.includes(cleanValue)) {
            cleanAnswers[factor] = cleanValue;
          }
        }
      }

      if (Object.keys(cleanAnswers).length < 3) {
        return { success: false, error: 'Please answer at least 3 lifestyle questions.' };
      }

      // Fetch catalog products
      const products = await fetchCatalogProducts();
      if (products.length === 0) {
        return { success: false, error: 'Product catalog is temporarily unavailable.' };
      }

      // Score products based on lifestyle answers
      const scoredProducts = scoreProducts(products, cleanAnswers);

      // Take top recommendations
      const topProducts = scoredProducts
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECOMMENDATIONS);

      // Build recommendations with reasoning
      const recommendations = topProducts.map(p => ({
        productId: p._id,
        name: p.name,
        slug: p.slug,
        category: p.category,
        price: p.price,
        score: p.score,
        matchReasons: p.matchReasons,
        image: p.mainImage || '',
      }));

      // Generate overall reasoning summary
      const reasoning = generateReasoning(cleanAnswers, recommendations);

      // Cache the result
      try {
        await wixData.insert(SESSIONS_COLLECTION, {
          sessionKey: cleanSession,
          memberId: '',
          answers: JSON.stringify(cleanAnswers),
          recommendations: JSON.stringify(recommendations),
          reasoning,
          createdAt: new Date(),
          feedbackRating: 0,
        }, { suppressAuth: true });
      } catch (cacheErr) {
        logError('futonSommelier.cacheResult', cacheErr);
      }

      logAuditEvent('SommelierSessions', 'recommendation', cleanSession, {
        answerCount: Object.keys(cleanAnswers).length,
        resultCount: recommendations.length,
      });

      return {
        success: true,
        recommendations,
        reasoning,
        sessionKey: cleanSession,
        cached: false,
      };
    } catch (err) {
      logError('futonSommelier.getRecommendation', err);
      return { success: false, error: 'Unable to generate recommendations.' };
    }
  }
);

// ── Rate Recommendation (feedback) ──────────────────────────────────

/**
 * Rate a sommelier recommendation for feedback learning.
 *
 * @param {string} sessionKey - Session key from getRecommendation
 * @param {number} rating - 1-5 rating
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const rateRecommendation = webMethod(
  Permissions.Anyone,
  async (sessionKey, rating) => {
    try {
      if (!sessionKey) return { success: false, error: 'Session key required' };
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return { success: false, error: 'Rating must be between 1 and 5' };
      }

      const cleanKey = sanitize(sessionKey, 100);
      const result = await wixData.query(SESSIONS_COLLECTION)
        .eq('sessionKey', cleanKey)
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) return { success: false, error: 'Session not found' };

      await wixData.update(SESSIONS_COLLECTION, {
        ...result.items[0],
        feedbackRating: Math.round(rating),
      }, { suppressAuth: true });

      logAuditEvent('SommelierSessions', 'feedback', cleanKey, { rating });
      return { success: true };
    } catch (err) {
      logError('futonSommelier.rateRecommendation', err);
      return { success: false, error: 'Unable to save feedback' };
    }
  }
);

// ── Get Lifestyle Questions ─────────────────────────────────────────

/**
 * Get the lifestyle questions and options for the UI.
 * @returns {{ questions: Array }}
 * @permission Anyone
 */
export const getLifestyleQuestions = webMethod(
  Permissions.Anyone,
  () => {
    return {
      questions: Object.entries(LIFESTYLE_FACTORS).map(([id, factor]) => ({
        id,
        question: factor.question,
        options: factor.options,
      })),
    };
  }
);

// ── Internal: Product Scoring ───────────────────────────────────────

/**
 * Score products against lifestyle answers using rule-based scoring.
 */
function scoreProducts(products, answers) {
  return products.map(product => {
    let score = 50; // Base score
    const matchReasons = [];
    const desc = (product.description || '').toLowerCase();
    const name = (product.name || '').toLowerCase();

    for (const [factor, answer] of Object.entries(answers)) {
      const rules = SCORING_RULES[factor]?.[answer];
      if (!rules) continue;

      for (const [trait, points] of Object.entries(rules)) {
        if (matchesTrait(product, desc, name, trait)) {
          score += points;
          matchReasons.push(traitToReason(trait, factor, answer));
        }
      }
    }

    // Budget filter
    if (answers.budget && product.price) {
      const budgetMatch = matchesBudget(product.price, answers.budget);
      score += budgetMatch;
      if (budgetMatch > 0) matchReasons.push('Within your budget');
      if (budgetMatch < 0) matchReasons.push('Above budget — consider financing');
    }

    // Room size adjustments
    if (answers.roomSize === 'small_under_120sqft') {
      if (desc.includes('compact') || desc.includes('space-sav') || name.includes('twin')) {
        score += 15;
        matchReasons.push('Compact size fits your space');
      }
    }

    return { ...product, score, matchReasons: [...new Set(matchReasons)] };
  });
}

/**
 * Check if a product matches a scoring trait.
 */
function matchesTrait(product, desc, name, trait) {
  const traitMatchers = {
    durability: () => desc.includes('durable') || desc.includes('hardwood') || desc.includes('solid'),
    hardwood: () => desc.includes('hardwood') || desc.includes('solid wood') || desc.includes('oak'),
    fabric_dark: () => desc.includes('dark') || desc.includes('espresso') || desc.includes('chocolate'),
    scratch_resistant: () => desc.includes('microfiber') || desc.includes('leather') || desc.includes('durable'),
    firmness_high: () => desc.includes('firm') || desc.includes('high-density'),
    firmness_medium: () => desc.includes('medium') || desc.includes('balanced'),
    mattress_thick: () => desc.includes('thick') || desc.includes('10"') || desc.includes('12"') || desc.includes('8"'),
    comfort_layer: () => desc.includes('foam') || desc.includes('pillow') || desc.includes('comfort'),
    easy_convert: () => desc.includes('easy') || desc.includes('convert') || desc.includes('fold'),
    storage: () => desc.includes('storage') || desc.includes('drawer'),
    compact: () => desc.includes('compact') || desc.includes('space') || product.category === 'murphy-cabinet-beds',
    queen_size: () => desc.includes('queen') || (product.variants || []).some(v => (v.label || '').toLowerCase().includes('queen')),
    wall_hugger: () => name.includes('wall') || desc.includes('wall hugger') || product.category === 'murphy-cabinet-beds',
    budget_friendly: () => product.price && product.price < 500,
    reclining: () => desc.includes('reclin') || desc.includes('adjustable'),
    uv_resistant: () => desc.includes('uv') || desc.includes('fade') || desc.includes('outdoor'),
    wood_finish_dark: () => desc.includes('dark') || desc.includes('walnut') || desc.includes('espresso'),
  };

  return traitMatchers[trait]?.() ?? false;
}

/**
 * Convert a trait match to a human-readable reason.
 */
function traitToReason(trait, factor, answer) {
  const reasons = {
    durability: 'Built with durable materials',
    hardwood: 'Solid hardwood construction',
    fabric_dark: 'Dark fabric resists visible wear',
    scratch_resistant: 'Scratch-resistant material',
    firmness_high: 'Firm support for back health',
    firmness_medium: 'Medium firmness for balanced comfort',
    mattress_thick: 'Thick mattress for daily sleeping comfort',
    comfort_layer: 'Extra comfort layer for lounging',
    easy_convert: 'Easy sofa-to-bed conversion',
    storage: 'Built-in storage for linens',
    compact: 'Space-efficient design',
    queen_size: 'Queen size available for comfortable sleeping',
    wall_hugger: 'Wall-hugger design saves floor space',
    budget_friendly: 'Budget-friendly option',
    reclining: 'Adjustable reclining positions',
    uv_resistant: 'UV-resistant for sun-exposed rooms',
    wood_finish_dark: 'Dark finish reduces visible sun fading',
  };
  return reasons[trait] || trait;
}

/**
 * Score budget compatibility.
 */
function matchesBudget(price, budget) {
  const ranges = {
    under_500: [0, 500],
    '500_to_1000': [500, 1000],
    '1000_to_1500': [1000, 1500],
    over_1500: [1500, Infinity],
    flexible: [0, Infinity],
  };
  const [min, max] = ranges[budget] || [0, Infinity];
  if (price >= min && price <= max) return 15;
  if (price < min) return 5; // Under budget is fine
  if (price <= max * 1.2) return -5; // Slightly over
  return -15; // Well over budget
}

/**
 * Generate a human-readable reasoning summary.
 */
function generateReasoning(answers, recommendations) {
  const parts = [];

  if (answers.primaryUse) {
    const useLabels = {
      daily_sleeping: 'daily sleeping',
      occasional_guests: 'hosting occasional guests',
      lounging: 'lounging and relaxation',
      home_office: 'home office use',
      dorm: 'dorm living',
    };
    parts.push(`Based on your need for ${useLabels[answers.primaryUse] || answers.primaryUse}`);
  }

  if (answers.pets && answers.pets !== 'no_pets') {
    parts.push('pet-friendly durability');
  }
  if (answers.backIssues && answers.backIssues !== 'none') {
    parts.push('back support requirements');
  }
  if (answers.sunExposure && answers.sunExposure !== 'minimal') {
    parts.push('sun-resistant materials');
  }

  let intro;
  if (parts.length === 0) {
    intro = 'Based on your preferences, here are our top picks:';
  } else if (parts.length === 1) {
    intro = `${parts[0]}, here are our top picks:`;
  } else {
    intro = `${parts[0]}, considering ${parts.slice(1).join(', ')}, here are our top picks:`;
  }

  const topPick = recommendations[0];
  const detail = topPick
    ? ` Our #1 recommendation is the ${topPick.name} (${topPick.matchReasons.slice(0, 2).join(', ')}).`
    : '';

  return intro + detail;
}

// ── Internal: Catalog Fetch ─────────────────────────────────────────

async function fetchCatalogProducts() {
  try {
    const result = await wixData.query('Stores/Products')
      .limit(1000)
      .find({ suppressAuth: true });
    return (result.items ?? []).filter(p => p.visible !== false);
  } catch (err) {
    logError('futonSommelier.fetchCatalog', err);
    return [];
  }
}

function safeParseArray(jsonStr) {
  if (!jsonStr) return [];
  if (Array.isArray(jsonStr)) return jsonStr;
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logError('futonSommelier.safeParseArray', err);
    return [];
  }
}

// ── SommelierResults — Cross-Platform Quiz Sync (CF-a220) ──────────

const RESULTS_COLLECTION = 'SommelierResults';

/**
 * Record or update a style quiz result for a member.
 * Upserts into SommelierResults CMS collection. Called by mobile app
 * after style quiz completion to sync results to web.
 *
 * @param {string} memberId - Wix member ID (must match session member)
 * @param {Object} result
 * @param {string} result.topCategory - Primary style category (e.g. 'modern', 'rustic')
 * @param {string[]} result.flavors - Style flavor tags (e.g. ['minimalist', 'warm'])
 * @param {Array<{productId: string, productName: string, score: number}>} result.recommendations
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const recordSommelierResult = webMethod(
  Permissions.SiteMember,
  async (memberId, { topCategory, flavors, recommendations } = {}) => {
    try {
      if (!memberId) return { success: false, error: 'memberId is required' };

      // Ownership check — prevent IDOR
      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      if (!caller?._id || caller._id !== memberId) {
        return { success: false, error: 'Unauthorized — memberId does not match session' };
      }

      // Validate payload
      const cleanCategory = sanitize(topCategory, 100);
      if (!cleanCategory) return { success: false, error: 'topCategory is required' };

      const cleanFlavors = (Array.isArray(flavors) ? flavors : [])
        .slice(0, 10)
        .map(f => sanitize(f, 50))
        .filter(Boolean);

      const cleanRecs = (Array.isArray(recommendations) ? recommendations : [])
        .slice(0, MAX_RECOMMENDATIONS)
        .map(r => ({
          productId: sanitize(r.productId, 50),
          productName: sanitize(r.productName, 200),
          score: typeof r.score === 'number' ? Math.round(r.score * 100) / 100 : 0,
        }))
        .filter(r => r.productId);

      // Upsert — update if exists, insert if new
      const existing = await wixData.query(RESULTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      const data = {
        memberId,
        topCategory: cleanCategory,
        flavors: JSON.stringify(cleanFlavors),
        recommendations: JSON.stringify(cleanRecs),
        updatedAt: new Date(),
      };

      if (existing.items.length > 0) {
        await wixData.update(RESULTS_COLLECTION, {
          ...existing.items[0],
          ...data,
        }, { suppressAuth: true });
      } else {
        await wixData.insert(RESULTS_COLLECTION, {
          ...data,
          createdAt: new Date(),
        }, { suppressAuth: true });
      }

      logAuditEvent(RESULTS_COLLECTION, 'record', memberId, {
        topCategory: cleanCategory,
        flavorCount: cleanFlavors.length,
        recCount: cleanRecs.length,
      });

      return { success: true };
    } catch (err) {
      logError('futonSommelier.recordSommelierResult', err);
      return { success: false, error: 'Failed to record result' };
    }
  }
);

/**
 * Get stored quiz results for a member.
 * @param {string} memberId
 * @returns {Promise<{success: boolean, result?: Object}>}
 */
export const getSommelierResults = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    try {
      if (!memberId) return { success: false };

      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      if (!caller?._id || caller._id !== memberId) return { success: false };

      const existing = await wixData.query(RESULTS_COLLECTION)
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });

      if (existing.items.length === 0) return { success: true, result: null };

      const item = existing.items[0];
      return {
        success: true,
        result: {
          topCategory: item.topCategory,
          flavors: safeParse(item.flavors),
          recommendations: safeParse(item.recommendations),
          updatedAt: item.updatedAt,
        },
      };
    } catch (err) {
      logError('futonSommelier.getSommelierResults', err);
      return { success: false };
    }
  }
);

function safeParse(str) {
  try { return typeof str === 'string' ? JSON.parse(str) : (str || []); } catch (_) { return []; }
}

// ── Exports for testing ─────────────────────────────────────────────
export { scoreProducts as _scoreProducts };
export { matchesTrait as _matchesTrait };
export { matchesBudget as _matchesBudget };
export { generateReasoning as _generateReasoning };
export const _RESULTS_COLLECTION = RESULTS_COLLECTION;
