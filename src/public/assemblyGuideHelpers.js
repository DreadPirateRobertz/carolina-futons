/**
 * Assembly Guide Page Helpers
 *
 * Frontend utility functions for the Assembly Guides page.
 * Handles category definitions, filtering, video embed URLs,
 * and HowTo schema generation for SEO.
 *
 * @module assemblyGuideHelpers
 */

// ── Category Definitions ──────────────────────────────────────────────

const GUIDE_CATEGORIES = [
  { id: 'futon-frames', label: 'Futon Frames', description: 'Wood and metal futon frame assembly guides', icon: '\u{1FA91}' },
  { id: 'mattresses', label: 'Mattresses', description: 'Mattress setup and unboxing instructions', icon: '\u{1F6CF}\uFE0F' },
  { id: 'murphy-cabinet-beds', label: 'Murphy Cabinet Beds', description: 'Murphy bed and cabinet bed installation', icon: '\u{1F3E0}' },
  { id: 'platform-beds', label: 'Platform Beds', description: 'Platform bed frame assembly guides', icon: '\u{1F6CF}\uFE0F' },
];

const CATEGORY_MAP = Object.fromEntries(GUIDE_CATEGORIES.map(c => [c.id, c]));

/**
 * Get all guide categories with labels and descriptions.
 * @returns {Array<{id: string, label: string, description: string, icon: string}>}
 */
export function getGuideCategories() {
  return [...GUIDE_CATEGORIES];
}

/**
 * Get the display label for a category ID.
 * @param {string|null} categoryId
 * @returns {string}
 */
export function getCategoryLabel(categoryId) {
  if (!categoryId) return '';
  if (CATEGORY_MAP[categoryId]) return CATEGORY_MAP[categoryId].label;
  return categoryId
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Get the icon/emoji for a category ID.
 * @param {string|null} categoryId
 * @returns {string}
 */
export function getCategoryIcon(categoryId) {
  if (CATEGORY_MAP[categoryId]) return CATEGORY_MAP[categoryId].icon;
  return '\u{1F4D6}';
}

// ── Grouping & Filtering ──────────────────────────────────────────────

/**
 * Group guides by their category field.
 * @param {Array|null} guides - Array of guide summary objects
 * @returns {Object<string, Array>} Guides grouped by category key
 */
export function groupGuidesByCategory(guides) {
  if (!guides || !Array.isArray(guides)) return {};
  const grouped = {};
  for (const guide of guides) {
    const cat = guide.category || 'uncategorized';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(guide);
  }
  return grouped;
}

/**
 * Filter guides by category and/or search query.
 * @param {Array|null} guides - Array of guide summary objects
 * @param {string|null} category - Category ID to filter by, or null for all
 * @param {string} query - Search query string
 * @returns {Array} Filtered guides
 */
export function filterGuides(guides, category, query) {
  if (!guides || !Array.isArray(guides)) return [];

  let filtered = guides;

  if (category) {
    filtered = filtered.filter(g => g.category === category);
  }

  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(g => {
      const searchable = [
        g.title || '',
        g.sku || '',
        g.category || '',
      ].join(' ').toLowerCase();
      return searchable.includes(q);
    });
  }

  return filtered;
}

// ── Video Embed ───────────────────────────────────────────────────────

/**
 * Convert a YouTube URL to an embeddable URL.
 * Supports youtube.com/watch?v=ID, youtu.be/ID formats.
 * Non-YouTube URLs are returned as-is.
 *
 * @param {string|null} videoUrl
 * @returns {string|null} Embed-ready URL or null
 */
export function buildVideoEmbedUrl(videoUrl) {
  if (!videoUrl) return null;

  let videoId = null;

  // youtube.com/watch?v=ID or www.youtube.com/watch?v=ID
  const watchMatch = videoUrl.match(/(?:youtube\.com|www\.youtube\.com)\/watch\?v=([^&]+)/);
  if (watchMatch) {
    videoId = watchMatch[1];
  }

  // youtu.be/ID
  if (!videoId) {
    const shortMatch = videoUrl.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Non-YouTube URL — return as-is
  return videoUrl;
}

// ── Formatting ────────────────────────────────────────────────────────

/**
 * Format estimated assembly time for display.
 * @param {string|null} time
 * @returns {string}
 */
export function formatEstimatedTime(time) {
  if (!time) return '';
  return time.trim();
}

// ── SEO Schema ────────────────────────────────────────────────────────

/**
 * Build a HowTo JSON-LD schema object for a guide.
 * @param {Object|null} guide - Full guide object with steps
 * @returns {Object|null} HowTo schema or null
 */
export function buildHowToSchema(guide) {
  if (!guide) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: `Step-by-step assembly instructions for ${guide.title}`,
    totalTime: guide.estimatedTime ? `PT${parseMinutes(guide.estimatedTime)}M` : undefined,
    step: parseSteps(guide.steps),
  };

  if (guide.videoUrl) {
    schema.video = {
      '@type': 'VideoObject',
      name: `${guide.title} - Video Tutorial`,
      contentUrl: guide.videoUrl,
    };
  }

  return schema;
}

/**
 * Parse an estimated time string to extract minutes.
 * @param {string} timeStr - e.g. "30 minutes"
 * @returns {number}
 */
function parseMinutes(timeStr) {
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse HTML ordered list steps into HowToStep schema objects.
 * @param {string} stepsHtml - HTML string with <ol><li>...</li></ol>
 * @returns {Array<Object>} Array of HowToStep objects
 */
function parseSteps(stepsHtml) {
  if (!stepsHtml) return [];

  const steps = [];
  const liRegex = /<li>(.*?)<\/li>/gi;
  let match;
  let position = 1;

  while ((match = liRegex.exec(stepsHtml)) !== null) {
    steps.push({
      '@type': 'HowToStep',
      position,
      text: match[1].replace(/<[^>]*>/g, '').trim(),
    });
    position++;
  }

  return steps;
}
