/**
 * fitScoreEngine.js — Personalized Futon Fit Score (0-100)
 *
 * Computes a per-product match score for the current visitor using
 * session signals: quiz answers, browsing history, price sensitivity,
 * and room dimensions. No login required — all data from sessionStorage.
 *
 * CF-hx8m: NOVEL — Futon Fit Score
 *
 * Score breakdown (100 pts total):
 * - Category match: 25 pts (product in visitor's preferred categories)
 * - Price fit:      25 pts (product within visitor's observed price range)
 * - Style match:    20 pts (style keywords in product name/description)
 * - Use case fit:   15 pts (sitting/sleeping/both matches product type)
 * - Size fit:       15 pts (product dimensions fit room/stated needs)
 */
import { session } from 'wix-storage-frontend';

const FIT_SCORE_KEY = 'cf_fit_profile';

// ── Scoring Weights ─────────────────────────────────────────────────

const WEIGHTS = {
  categoryMatch: 25,
  priceFit: 25,
  styleMatch: 20,
  useCaseFit: 15,
  sizeFit: 15,
};

// ── Category Mappings ───────────────────────────────────────────────

const ROOM_CATEGORIES = {
  'living-room': ['futon-frames', 'wall-huggers'],
  'guest-room': ['futon-frames', 'murphy-cabinet-beds'],
  'dorm': ['futon-frames'],
  'office': ['murphy-cabinet-beds', 'wall-huggers'],
  'bedroom': ['platform-beds', 'murphy-cabinet-beds'],
};

const USE_CATEGORIES = {
  'sitting': ['futon-frames', 'wall-huggers'],
  'sleeping': ['platform-beds', 'mattresses'],
  'both': ['futon-frames', 'murphy-cabinet-beds', 'wall-huggers', 'mattresses'],
};

const STYLE_KEYWORDS = {
  'modern': ['contemporary', 'modern', 'clean', 'minimalist', 'sleek'],
  'rustic': ['wood', 'hardwood', 'natural', 'unfinished', 'handcrafted', 'solid'],
  'classic': ['traditional', 'classic', 'elegant', 'timeless'],
};

const SIZE_MAP = {
  'twin': { maxWidth: 42 },
  'full': { maxWidth: 58 },
  'queen': { maxWidth: 65 },
};

// ── Visitor Profile ─────────────────────────────────────────────────

/**
 * Get or create the visitor's fit profile from session storage.
 * Profile accumulates signals across the session without login.
 *
 * @returns {Object} Fit profile with quiz answers and browsing signals
 */
export function getProfile() {
  try {
    const raw = session.getItem(FIT_SCORE_KEY);
    return raw ? JSON.parse(raw) : createDefaultProfile();
  } catch {
    return createDefaultProfile();
  }
}

function createDefaultProfile() {
  return {
    // Quiz answers (null = not taken)
    roomType: null,
    primaryUse: null,
    stylePreference: null,
    sizeNeeds: null,
    budgetRange: null,
    // Browsing signals (accumulated)
    viewedCategories: [],    // ['futon-frames', 'mattresses', ...]
    viewedPriceRange: null,  // { min, max } from browsed products
    viewedProductCount: 0,
    timeOnSite: 0,           // seconds (rough)
    // Room dimensions (from Will-It-Fit widget)
    roomWidth: null,
    roomLength: null,
  };
}

/**
 * Save the visitor's fit profile to session storage.
 * @param {Object} profile
 */
function saveProfile(profile) {
  try {
    session.setItem(FIT_SCORE_KEY, JSON.stringify(profile));
  } catch { /* storage unavailable */ }
}

/**
 * Record quiz answers into the fit profile.
 * @param {Object} answers - { roomType, primaryUse, stylePreference, sizeNeeds, budgetRange }
 */
export function recordQuizAnswers(answers) {
  if (!answers) return;
  const profile = getProfile();
  if (answers.roomType) profile.roomType = answers.roomType;
  if (answers.primaryUse) profile.primaryUse = answers.primaryUse;
  if (answers.stylePreference) profile.stylePreference = answers.stylePreference;
  if (answers.sizeNeeds) profile.sizeNeeds = answers.sizeNeeds;
  if (answers.budgetRange) profile.budgetRange = answers.budgetRange;
  saveProfile(profile);
}

/**
 * Record a product view to build browsing signal profile.
 * @param {Object} product - Product with price, collections
 */
export function recordProductView(product) {
  if (!product) return;
  const profile = getProfile();

  // Track categories
  if (Array.isArray(product.collections)) {
    for (const col of product.collections) {
      if (col && !profile.viewedCategories.includes(col)) {
        profile.viewedCategories.push(col);
      }
    }
  }

  // Track price range
  const price = Number(product.price);
  if (price > 1) { // exclude call-for-price placeholders
    if (!profile.viewedPriceRange) {
      profile.viewedPriceRange = { min: price, max: price };
    } else {
      profile.viewedPriceRange.min = Math.min(profile.viewedPriceRange.min, price);
      profile.viewedPriceRange.max = Math.max(profile.viewedPriceRange.max, price);
    }
  }

  profile.viewedProductCount++;
  saveProfile(profile);
}

/**
 * Record room dimensions from the Will-It-Fit widget.
 * @param {number} width - Room width in inches
 * @param {number} length - Room length in inches
 */
export function recordRoomDimensions(width, length) {
  const profile = getProfile();
  profile.roomWidth = Number(width) || null;
  profile.roomLength = Number(length) || null;
  saveProfile(profile);
}

// ── Score Computation ───────────────────────────────────────────────

/**
 * Compute the Fit Score (0-100) for a product against the visitor's profile.
 *
 * @param {Object} product - Product data
 * @param {string} product.name - Product name
 * @param {number} product.price - Product price
 * @param {Array} [product.collections] - Product category slugs
 * @param {string} [product.description] - Product description
 * @param {Object} [profile] - Override profile (defaults to session profile)
 * @returns {number} Score 0-100
 */
export function computeFitScore(product, profile) {
  if (!product) return 0;
  const p = profile || getProfile();

  let score = 0;
  score += scoreCategoryMatch(product, p);
  score += scorePriceFit(product, p);
  score += scoreStyleMatch(product, p);
  score += scoreUseCaseFit(product, p);
  score += scoreSizeFit(product, p);

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Batch compute Fit Scores for an array of products.
 *
 * @param {Array} products - Products to score
 * @param {Object} [profile] - Override profile
 * @returns {Array<{product: Object, fitScore: number}>} Sorted by score desc
 */
export function batchComputeFitScores(products, profile) {
  if (!Array.isArray(products)) return [];
  const p = profile || getProfile();

  return products
    .map(product => ({
      product,
      fitScore: computeFitScore(product, p),
    }))
    .sort((a, b) => b.fitScore - a.fitScore);
}

/**
 * Get a human-readable label for a fit score.
 * @param {number} score - 0-100
 * @returns {string}
 */
export function getFitScoreLabel(score) {
  if (score >= 90) return 'Perfect Match';
  if (score >= 75) return 'Great Match';
  if (score >= 60) return 'Good Match';
  if (score >= 40) return 'Fair Match';
  return '';
}

// ── Individual Score Components ─────────────────────────────────────

function scoreCategoryMatch(product, profile) {
  const collections = product.collections || [];
  if (collections.length === 0) return WEIGHTS.categoryMatch * 0.5; // neutral

  // Quiz-based category preference
  const preferredCats = new Set();
  if (profile.roomType && ROOM_CATEGORIES[profile.roomType]) {
    ROOM_CATEGORIES[profile.roomType].forEach(c => preferredCats.add(c));
  }

  // Browsing-based category affinity
  for (const cat of profile.viewedCategories || []) {
    preferredCats.add(cat);
  }

  if (preferredCats.size === 0) return WEIGHTS.categoryMatch * 0.5; // no signal

  const matchCount = collections.filter(c => preferredCats.has(c)).length;
  const matchRatio = matchCount / collections.length;
  return WEIGHTS.categoryMatch * matchRatio;
}

function scorePriceFit(product, profile) {
  const price = Number(product.price);
  if (!price || price <= 1) return 0; // call-for-price

  // Quiz budget range
  const budgetRanges = {
    'under-500': { min: 0, max: 500 },
    '500-1000': { min: 500, max: 1000 },
    '1000-2000': { min: 1000, max: 2000 },
    'over-2000': { min: 2000, max: 99999 },
  };

  let targetRange = null;
  if (profile.budgetRange && budgetRanges[profile.budgetRange]) {
    targetRange = budgetRanges[profile.budgetRange];
  } else if (profile.viewedPriceRange) {
    // Infer budget from browsing — expand range by 20%
    const spread = profile.viewedPriceRange.max - profile.viewedPriceRange.min;
    targetRange = {
      min: Math.max(0, profile.viewedPriceRange.min - spread * 0.2),
      max: profile.viewedPriceRange.max + spread * 0.2,
    };
  }

  if (!targetRange) return WEIGHTS.priceFit * 0.5; // no signal

  if (price >= targetRange.min && price <= targetRange.max) {
    return WEIGHTS.priceFit; // perfect fit
  }

  // Penalize proportionally to distance from range
  const distance = price < targetRange.min
    ? (targetRange.min - price) / targetRange.min
    : (price - targetRange.max) / targetRange.max;

  return WEIGHTS.priceFit * Math.max(0, 1 - distance);
}

function scoreStyleMatch(product, profile) {
  if (!profile.stylePreference) return WEIGHTS.styleMatch * 0.5; // no signal

  const keywords = STYLE_KEYWORDS[profile.stylePreference] || [];
  if (keywords.length === 0) return WEIGHTS.styleMatch * 0.5;

  const searchable = `${product.name || ''} ${product.description || ''}`.toLowerCase();
  const matchCount = keywords.filter(kw => searchable.includes(kw)).length;
  const matchRatio = matchCount / keywords.length;

  return WEIGHTS.styleMatch * Math.min(1, matchRatio * 2); // boost partial matches
}

function scoreUseCaseFit(product, profile) {
  if (!profile.primaryUse) return WEIGHTS.useCaseFit * 0.5; // no signal

  const useCats = USE_CATEGORIES[profile.primaryUse] || [];
  if (useCats.length === 0) return WEIGHTS.useCaseFit * 0.5;

  const collections = product.collections || [];
  const matches = collections.some(c => useCats.includes(c));

  return matches ? WEIGHTS.useCaseFit : 0;
}

function scoreSizeFit(product, profile) {
  // Size from quiz answer
  if (profile.sizeNeeds) {
    const name = (product.name || '').toLowerCase();
    const sizeKeywords = {
      'twin': ['twin'],
      'full': ['full'],
      'queen': ['queen'],
    };
    const keywords = sizeKeywords[profile.sizeNeeds] || [];
    if (keywords.length > 0) {
      const matches = keywords.some(kw => name.includes(kw));
      return matches ? WEIGHTS.sizeFit : WEIGHTS.sizeFit * 0.3;
    }
  }

  // Room dimensions from Will-It-Fit (future enhancement)
  // For now, neutral score when no size signal
  return WEIGHTS.sizeFit * 0.5;
}
