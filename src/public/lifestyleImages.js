// Lifestyle room-staged photography for Carolina Futons
// Curated Unsplash lifestyle scenes showing furniture in real room settings.
// Priority categories: futon frames, Murphy beds, platform beds — 4+ scenes each.
// Other categories get 2-3 scenes. Unknown categories get fallback scenes.

// ── Scene Data ───────────────────────────────────────────────────────

const lifestyleScenes = {
  'futon-frames': [
    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Futon in cozy living room with warm lighting', room: 'living room', style: 'modern farmhouse' },
    { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Futon styled in guest room with natural light', room: 'guest room', style: 'minimalist' },
    { url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Futon in compact studio apartment', room: 'studio', style: 'contemporary' },
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Futon in comfortable den with bookshelves', room: 'den', style: 'rustic' },
    { url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=600&fit=crop', alt: 'Futon in sunlit loft space', room: 'loft', style: 'industrial' },
  ],
  'mattresses': [
    { url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop', alt: 'Comfortable mattress in serene bedroom', room: 'bedroom', style: 'scandinavian' },
    { url: 'https://images.unsplash.com/photo-1616627561839-074385245ff6?w=800&h=600&fit=crop', alt: 'Mattress in bright guest room', room: 'guest room', style: 'minimalist' },
    { url: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&h=600&fit=crop', alt: 'Mattress in cozy loft bedroom', room: 'loft', style: 'modern farmhouse' },
  ],
  'murphy-cabinet-beds': [
    { url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Murphy bed in compact home office', room: 'office', style: 'contemporary' },
    { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Cabinet bed in welcoming guest room', room: 'guest room', style: 'transitional' },
    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Murphy bed in stylish studio apartment', room: 'studio', style: 'modern' },
    { url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=600&fit=crop', alt: 'Cabinet bed in cozy den retreat', room: 'den', style: 'rustic' },
  ],
  'platform-beds': [
    { url: 'https://images.unsplash.com/photo-1616627561839-074385245ff6?w=800&h=600&fit=crop', alt: 'Platform bed in minimalist bedroom', room: 'bedroom', style: 'minimalist' },
    { url: 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&h=600&fit=crop', alt: 'Platform bed in bright sunroom', room: 'sunroom', style: 'contemporary' },
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Platform bed in spacious loft', room: 'loft', style: 'industrial' },
    { url: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop', alt: 'Platform bed in guest room with soft linens', room: 'guest room', style: 'scandinavian' },
  ],
  'casegoods-accessories': [
    { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Accent furniture in styled living room', room: 'living room', style: 'eclectic' },
    { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Side table and accessories in bedroom', room: 'bedroom', style: 'modern farmhouse' },
  ],
  'wall-huggers': [
    { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Wall hugger futon in small living room', room: 'living room', style: 'contemporary' },
    { url: 'https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop', alt: 'Wall hugger futon in cozy den', room: 'den', style: 'rustic' },
  ],
  'unfinished-wood': [
    { url: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=800&h=600&fit=crop', alt: 'Unfinished wood frame in sunlit studio', room: 'studio', style: 'natural' },
    { url: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=600&fit=crop', alt: 'Natural wood furniture in bright bedroom', room: 'bedroom', style: 'minimalist' },
  ],
};

const fallbackScenes = [
  { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Furniture in cozy living room', room: 'living room', style: 'modern farmhouse' },
  { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop', alt: 'Furniture in bright bedroom', room: 'bedroom', style: 'contemporary' },
  { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Styled room with furniture', room: 'guest room', style: 'minimalist' },
];

/**
 * All supported lifestyle categories.
 * @type {string[]}
 */
export const LIFESTYLE_CATEGORIES = Object.keys(lifestyleScenes);

/**
 * Get lifestyle room scenes for a product category.
 * @param {string} category - Category slug (e.g. 'futon-frames')
 * @param {number} [count] - Max scenes to return. Returns all if omitted or exceeds available.
 * @returns {Array<{url: string, alt: string, room: string, style: string}>}
 */
export function getLifestyleScenes(category, count) {
  const scenes = lifestyleScenes[category] || fallbackScenes;
  if (count != null && count < scenes.length) {
    return scenes.slice(0, count);
  }
  return scenes;
}

/**
 * Get a single lifestyle scene by index (wraps around).
 * @param {string} category - Category slug
 * @param {number} [index=0] - Scene index (wraps if out of range)
 * @returns {{url: string, alt: string, room: string, style: string}}
 */
export function getLifestyleScene(category, index = 0) {
  const scenes = lifestyleScenes[category] || fallbackScenes;
  return scenes[index % scenes.length];
}

/**
 * Get a thumbnail-sized lifestyle image URL for category cards.
 * @param {string} category - Category slug
 * @param {{width?: number, height?: number}} [options]
 * @returns {string} Unsplash URL with thumbnail dimensions
 */
export function getLifestyleThumbnail(category, options) {
  const scene = getLifestyleScene(category);
  const w = options?.width || 400;
  const h = options?.height || 300;
  return scene.url.replace(/w=\d+/, `w=${w}`).replace(/h=\d+/, `h=${h}`);
}

/**
 * Get overlay data for the "See It In a Room" product card badge.
 * @param {string} category - Category slug
 * @returns {{imageUrl: string, label: string, alt: string}}
 */
export function getLifestyleOverlay(category) {
  const thumb = getLifestyleThumbnail(category);
  const scene = getLifestyleScene(category);
  return {
    imageUrl: thumb,
    label: 'See It In a Room',
    alt: scene.alt,
  };
}
