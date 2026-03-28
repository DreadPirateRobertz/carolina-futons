/**
 * @module styleQuiz
 * @description Backend web module for the "Find Your Perfect Futon" style quiz.
 * Takes quiz answers and returns personalized product recommendations
 * with match scores and explanations. Also provides email lead capture
 * after Q3 with CRM sync via Klaviyo.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

// Map quiz answers to product collection queries and scoring criteria
const ROOM_CATEGORY_MAP = {
  'living-room': ['futon-frames', 'wall-huggers'],
  'guest-room': ['futon-frames', 'murphy-cabinet-beds'],
  'dorm': ['futon-frames'],
  'office': ['murphy-cabinet-beds', 'wall-huggers'],
  'bedroom': ['platform-beds', 'murphy-cabinet-beds'],
};

const USE_CATEGORY_MAP = {
  'sitting': ['futon-frames', 'wall-huggers'],
  'sleeping': ['platform-beds', 'mattresses'],
  'both': ['futon-frames', 'murphy-cabinet-beds', 'wall-huggers'],
};

const STYLE_KEYWORDS = {
  'modern': ['contemporary', 'modern', 'clean', 'minimalist'],
  'rustic': ['wood', 'hardwood', 'natural', 'unfinished', 'handcrafted'],
  'classic': ['traditional', 'classic', 'elegant', 'timeless'],
};

const BUDGET_RANGES = {
  'under-500': { min: 0, max: 500 },
  '500-1000': { min: 500, max: 1000 },
  '1000-2000': { min: 1000, max: 2000 },
  'over-2000': { min: 2000, max: 99999 },
};

/**
 * Get personalized product recommendations based on quiz answers.
 *
 * @function getQuizRecommendations
 * @param {Object} answers - Quiz answer selections.
 * @param {string} answers.roomType - living-room, guest-room, dorm, office, bedroom
 * @param {string} answers.primaryUse - sitting, sleeping, both
 * @param {string} answers.stylePreference - modern, rustic, classic
 * @param {string} [answers.sizeNeeds] - twin, full, queen — omit to skip size scoring (20 pts)
 * @param {string} answers.budgetRange - under-500, 500-1000, 1000-2000, over-2000
 * @returns {Promise<Array<{product: Object, score: number, reason: string}>>}
 *   Sorted by score descending, up to 5 results.
 * @permission Anyone
 */
export const getQuizRecommendations = webMethod(
  Permissions.Anyone,
  async (answers) => {
    try {
      if (!answers) return [];

      // Determine target collections from room type + use
      const roomCollections = ROOM_CATEGORY_MAP[answers.roomType] || ['futon-frames'];
      const useCollections = USE_CATEGORY_MAP[answers.primaryUse] || ['futon-frames'];

      // Merge and deduplicate target collections (intersection preferred, union as fallback)
      const intersection = roomCollections.filter(c => useCollections.includes(c));
      const targetCollections = intersection.length > 0
        ? intersection
        : [...new Set([...roomCollections, ...useCollections])];

      // Build query with price range
      const budget = BUDGET_RANGES[answers.budgetRange] || BUDGET_RANGES['500-1000'];
      let query = wixData.query('Stores/Products')
        .hasSome('collections', targetCollections)
        .ge('price', budget.min)
        .le('price', budget.max)
        .limit(20);

      const results = await query.find();

      if (results.items.length === 0) {
        // Fallback: broaden search to all categories within budget
        const fallbackResults = await wixData.query('Stores/Products')
          .ge('price', budget.min)
          .le('price', budget.max)
          .limit(10)
          .find();

        return fallbackResults.items.slice(0, 5).map(item => ({
          product: formatQuizProduct(item),
          score: 50,
          reason: buildReason(item, answers, false),
        }));
      }

      // Score each product based on how well it matches all criteria
      const scored = results.items.map(item => {
        let score = 0;
        const matchReasons = [];

        // Room type match (30 points)
        const itemCollections = Array.isArray(item.collections) ? item.collections : [];
        const roomMatch = itemCollections.some(c => roomCollections.includes(c));
        if (roomMatch) {
          score += 30;
          matchReasons.push('room');
        }

        // Use match (30 points)
        const useMatch = itemCollections.some(c => useCollections.includes(c));
        if (useMatch) {
          score += 30;
          matchReasons.push('use');
        }

        // Style match (20 points) — check product name/description for style keywords
        const keywords = STYLE_KEYWORDS[answers.stylePreference] || [];
        const productText = `${item.name} ${item.description || ''}`.toLowerCase();
        const styleMatch = keywords.some(kw => productText.includes(kw));
        if (styleMatch) {
          score += 20;
          matchReasons.push('style');
        }

        // Size compatibility (20 points)
        const availableSizes = Array.isArray(item.availableSizes) ? item.availableSizes : [];
        const sizeNeed = answers.sizeNeeds ? answers.sizeNeeds.toLowerCase() : null;
        if (sizeNeed && availableSizes.some(s => s.toLowerCase() === sizeNeed)) {
          score += 20;
        }

        // Budget fit (10 points) — closer to budget midpoint scores higher
        const budgetMid = (budget.min + budget.max) / 2;
        const priceDistance = Math.abs(item.price - budgetMid) / (budget.max - budget.min || 1);
        score += Math.round((1 - priceDistance) * 10);

        // Bonus: products with reviews/ratings
        if (item.numericRating > 4) score += 5;

        // Bonus: in-stock products
        if (item.inStock !== false) score += 5;

        return {
          product: formatQuizProduct(item),
          score,
          reason: buildReason(item, answers, roomMatch && useMatch),
        };
      });

      // Sort by score and return top 5
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, 5);
    } catch (err) {
      console.error('Error getting quiz recommendations:', err);
      return [];
    }
  }
);

/**
 * Get available quiz options (for dynamic quiz rendering).
 * Returns all valid answer choices for each question.
 *
 * @function getQuizOptions
 * @returns {Promise<Object>} Quiz option sets.
 * @permission Anyone
 */
export const getQuizOptions = webMethod(
  Permissions.Anyone,
  async () => {
    return {
      roomTypes: [
        { value: 'living-room', label: 'Living Room', icon: 'sofa' },
        { value: 'guest-room', label: 'Guest Room', icon: 'bed' },
        { value: 'dorm', label: 'Dorm / Small Space', icon: 'apartment' },
        { value: 'office', label: 'Home Office', icon: 'desk' },
        { value: 'bedroom', label: 'Bedroom', icon: 'moon' },
      ],
      primaryUses: [
        { value: 'sitting', label: 'Primarily Sitting', description: 'Couch by day' },
        { value: 'sleeping', label: 'Primarily Sleeping', description: 'Bed by night' },
        { value: 'both', label: 'Both Equally', description: 'Versatile day and night' },
      ],
      stylePreferences: [
        { value: 'modern', label: 'Modern / Contemporary', description: 'Clean lines, minimal design' },
        { value: 'rustic', label: 'Rustic / Natural', description: 'Warm wood, handcrafted feel' },
        { value: 'classic', label: 'Classic / Traditional', description: 'Timeless elegance' },
      ],
      sizeOptions: [
        { value: 'twin', label: 'Twin', description: 'Great for one person' },
        { value: 'full', label: 'Full', description: 'Our most popular size' },
        { value: 'queen', label: 'Queen', description: 'Maximum comfort' },
      ],
      budgetRanges: [
        { value: 'under-500', label: 'Under $500', description: 'Budget-friendly options' },
        { value: '500-1000', label: '$500 - $1,000', description: 'Our sweet spot' },
        { value: '1000-2000', label: '$1,000 - $2,000', description: 'Premium selections' },
        { value: 'over-2000', label: 'Over $2,000', description: 'Top of the line' },
      ],
    };
  }
);

// ── Profile-based personalized copy ───────────────────────────────────

/**
 * Derive a profile type string from quiz answers.
 * Used to select the tone variant for personalized copy.
 *
 * Profiles (3 base + style sub-variant):
 *   compact     — dorm/office room types; space efficiency is paramount
 *   comfort     — primary use is sleeping; sleep quality drives selection
 *   versatile   — both uses; day-to-night flexibility is the priority
 *   style       — default/fallback; covers all other room/use combinations
 *                 (living room, guest room, bedroom, unrecognized values, etc.)
 *
 * @param {Object} answers - Quiz answers
 * @returns {string} Profile key: 'compact' | 'comfort' | 'versatile' | 'style'
 */
function deriveProfileType(answers) {
  if (!answers) return 'style';
  if (answers.roomType === 'dorm' || answers.roomType === 'office') return 'compact';
  if (answers.primaryUse === 'sleeping') return 'comfort';
  if (answers.primaryUse === 'both') return 'versatile';
  return 'style';
}

const STYLE_TONE = {
  modern:  'clean, contemporary aesthetic',
  rustic:  'warm, natural character',
  classic: 'timeless, classic appeal',
};

const ROOM_LABEL = {
  'living-room': 'living room',
  'guest-room':  'guest room',
  'dorm':        'small space',
  'office':      'home office',
  'bedroom':     'bedroom',
};

/**
 * Build a personalized recommendation blurb from quiz answers and profile type.
 * Missing or unrecognized roomType/stylePreference fall back to 'space' / 'your unique style'.
 *
 * @param {Object} answers - Quiz answers
 * @param {string} profileType - From deriveProfileType()
 * @returns {string} Personalized copy string
 */
function buildPersonalizedCopy(answers, profileType) {
  const room   = ROOM_LABEL[answers?.roomType]  || 'space';
  const style  = STYLE_TONE[answers?.stylePreference] || 'your unique style';

  switch (profileType) {
    case 'compact':
      return `Your ${room} deserves furniture that works harder without taking over. Based on your space efficiency needs and ${style}, we've selected pieces engineered to maximize every square foot.`;

    case 'comfort':
      return `A great night's sleep changes everything. Based on your priority for restful, dedicated sleep in your ${room} and love of ${style}, we've curated our top comfort-rated picks designed for serious sleepers.`;

    case 'versatile':
      return `Day-to-night flexibility is your superpower. Based on your need for seamless sitting and sleeping in your ${room} and appreciation for ${style}, these picks perform beautifully in both modes.`;

    case 'style':
    default:
      return `Your ${room} is a reflection of who you are. Based on your preference for ${style} and your vision for the space, we've hand-picked options that make a statement while delivering lasting comfort.`;
  }
}

/**
 * Get personalized recommendation copy based on quiz answers.
 * Intended to be called alongside getQuizRecommendations on the result page.
 *
 * @function getPersonalizedCopy
 * @param {Object} answers - Quiz answer selections (same shape as getQuizRecommendations)
 * @returns {Promise<{copy: string, profileType: string}>}
 *   copy — personalized blurb to display above recommendations
 *   profileType — 'compact' | 'comfort' | 'versatile' | 'style'
 * @permission Anyone
 */
export const getPersonalizedCopy = webMethod(
  Permissions.Anyone,
  (answers) => {
    if (!answers) return { copy: '', profileType: 'style' };
    const profileType = deriveProfileType(answers);
    const copy = buildPersonalizedCopy(answers, profileType);
    return { copy, profileType };
  }
);

/**
 * Capture a quiz lead email after Q3 and sync to CRM (Klaviyo).
 * Persists to NewsletterSubscribers with source='style_quiz' and stores
 * partial quiz answers (roomType, primaryUse, stylePreference) for
 * segmentation. Silent dedup — returns success for existing subscribers.
 *
 * @function captureQuizLead
 * @param {string} email - Visitor email from quiz email gate.
 * @param {Object} [partialAnswers] - Answers collected so far (Q1–Q3).
 * @param {string} [partialAnswers.roomType]
 * @param {string} [partialAnswers.primaryUse]
 * @param {string} [partialAnswers.stylePreference]
 * @returns {Promise<{success: boolean, message?: string}>}
 * @permission Anyone — captures from anonymous quiz visitors.
 */
export const captureQuizLead = webMethod(
  Permissions.Anyone,
  async (email, partialAnswers = {}) => {
    try {
      if (!email || typeof email !== 'string' || !email.trim()) {
        return { success: false, message: 'Email is required' };
      }

      const cleaned = sanitize(email, 254).toLowerCase().trim();
      if (!validateEmail(cleaned)) {
        return { success: false, message: 'Invalid email format' };
      }

      const { allowed } = await checkRateLimit('QuizLeadRateLimit', cleaned);
      if (!allowed) return { success: false, message: 'Too many requests. Please try again later.' };

      // Delegate to newsletterService for CMS insert + Klaviyo sync.
      // subscribeToNewsletter deduplicates silently and triggers the welcome flow.
      const { subscribeToNewsletter } = await import('backend/newsletterService.web');
      await subscribeToNewsletter(cleaned, { source: 'style_quiz' });

      // Enrich the subscriber record with partial quiz answers for segmentation.
      const existing = await wixData.query('NewsletterSubscribers')
        .eq('email', cleaned)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        // Only write quiz fields if not already set (don't overwrite on repeat visits)
        if (!record.quizRoomType) {
          await wixData.update('NewsletterSubscribers', {
            ...record,
            quizRoomType: sanitize(partialAnswers.roomType || '', 50),
            quizPrimaryUse: sanitize(partialAnswers.primaryUse || '', 50),
            quizStylePreference: sanitize(partialAnswers.stylePreference || '', 50),
          });
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Quiz lead capture error:', err);
      return { success: false, message: 'Capture failed. Please try again.' };
    }
  }
);

function formatQuizProduct(item) {
  return {
    _id: item._id,
    name: item.name,
    slug: item.slug,
    price: item.price,
    formattedPrice: item.formattedPrice,
    mainMedia: item.mainMedia,
    collections: item.collections,
    description: item.description,
  };
}

function buildReason(item, answers, isStrongMatch) {
  const room = formatRoomType(answers.roomType);
  const parts = [
    isStrongMatch ? `Perfect for your ${room}` : `A great option for ${room}`,
  ];

  if (answers.primaryUse === 'both') {
    parts.push('versatile for sitting and sleeping');
  } else if (answers.primaryUse === 'sleeping') {
    parts.push('designed with comfort for sleep');
  }

  if (item.price < 500) {
    parts.push('budget-friendly');
  } else if (item.price > 1500) {
    parts.push('premium quality');
  }

  return parts.join(' — ');
}

function formatRoomType(roomType) {
  const labels = {
    'living-room': 'living room',
    'guest-room': 'guest room',
    'dorm': 'dorm or small space',
    'office': 'home office',
    'bedroom': 'bedroom',
  };
  return labels[roomType] || 'room';
}
