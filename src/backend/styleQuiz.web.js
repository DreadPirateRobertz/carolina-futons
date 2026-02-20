/**
 * @module styleQuiz
 * @description Backend web module for the "Find Your Perfect Futon" style quiz.
 * Takes quiz answers and returns personalized product recommendations
 * with match scores and explanations.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

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
 * @param {string} answers.sizeNeeds - twin, full, queen
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
  const parts = [];

  if (isStrongMatch) {
    parts.push(`Perfect for your ${formatRoomType(answers.roomType)}`);
  } else {
    parts.push(`A great option for ${formatRoomType(answers.roomType)}`);
  }

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
