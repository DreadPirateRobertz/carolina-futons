// buyingGuidesHelpers.js — Testable helpers for Buying Guides hub + detail pages
// Pure functions for data transformation, formatting, and display logic.

const SITE_URL = 'https://www.carolinafutons.com';

// ── Guide Categories ──────────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'futon-frames', label: 'Futon Frames', description: 'Compare wood vs metal frames, sizes, styles, and top picks' },
  { slug: 'mattresses', label: 'Mattresses', description: 'Thickness, fill types, firmness levels, and comfort ratings' },
  { slug: 'covers', label: 'Covers', description: 'Fabrics, fits, care instructions, and style coordination' },
  { slug: 'pillows', label: 'Pillows', description: 'Decorative and functional pillow and bolster options' },
  { slug: 'storage', label: 'Storage', description: 'Under-frame drawers, ottomans, and space-saving solutions' },
  { slug: 'outdoor', label: 'Outdoor', description: 'Weather-resistant frames, UV covers, and patio options' },
  { slug: 'accessories', label: 'Accessories', description: 'Grip strips, arm covers, hardware kits, and finishing touches' },
  { slug: 'bundle-deals', label: 'Bundle Deals', description: 'Save on complete frame, mattress, and cover packages' },
];

const CATEGORY_ICONS = {
  'futon-frames': 'sofa',
  'mattresses': 'bed',
  'covers': 'fabric',
  'pillows': 'pillow',
  'storage': 'drawer',
  'outdoor': 'sun',
  'accessories': 'wrench',
  'bundle-deals': 'package',
};

/**
 * Returns all 8 buying guide categories.
 * @returns {Array<{slug: string, label: string, description: string}>}
 */
export function getGuideCategories() {
  return [...CATEGORIES];
}

// ── Date Formatting ───────────────────────────────────────────────────

/**
 * Formats an ISO date string (YYYY-MM-DD) to human-readable.
 * @param {string} dateStr - ISO date string.
 * @returns {string} Formatted date or empty string.
 */
export function formatGuideDate(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';
    if (month < 0 || month > 11 || day < 1 || day > 31) return '';
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Breadcrumbs ───────────────────────────────────────────────────────

/**
 * Builds breadcrumb trail for hub or detail page.
 * @param {string} [slug] - Guide slug (omit for hub page).
 * @param {string} [label] - Guide display label.
 * @returns {Array<{label: string, url: string}>}
 */
export function buildBreadcrumbs(slug, label) {
  const crumbs = [
    { label: 'Home', url: '/' },
    { label: 'Buying Guides', url: '/buying-guides' },
  ];
  if (slug) {
    const displayLabel = label || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label: displayLabel, url: `/buying-guides/${slug}` });
  }
  return crumbs;
}

// ── Table of Contents ─────────────────────────────────────────────────

/**
 * Builds table of contents from guide sections.
 * @param {Array<{heading: string, body: string}>} sections
 * @returns {Array<{id: string, label: string}>}
 */
export function buildTableOfContents(sections) {
  if (!sections || !sections.length) return [];
  return sections.map(s => ({
    id: s.heading.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
    label: s.heading,
  }));
}

// ── Comparison Table ──────────────────────────────────────────────────

/**
 * Builds structured row objects from comparison table data.
 * @param {Object} table - { title, headers, rows }
 * @returns {Array<{_id: string, feature: string, values: string[]}>}
 */
export function buildComparisonRows(table) {
  if (!table || !table.rows || !table.rows.length) return [];
  return table.rows.map((row, i) => ({
    _id: `row-${i}`,
    feature: row[0],
    values: row.slice(1),
  }));
}

// ── Reading Time ──────────────────────────────────────────────────────

const WORDS_PER_MINUTE = 200;

/**
 * Estimates reading time in minutes from guide sections.
 * @param {Array<{heading: string, body: string}>} sections
 * @returns {number} Minutes (minimum 1, or 0 if no content).
 */
export function getReadingTime(sections) {
  if (!sections || !sections.length) return 0;
  let wordCount = 0;
  for (const s of sections) {
    if (s.body) {
      wordCount += s.body.split(/\s+/).filter(Boolean).length;
    }
    if (s.heading) {
      wordCount += s.heading.split(/\s+/).filter(Boolean).length;
    }
  }
  if (wordCount === 0) return 0;
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

// ── Share Links ───────────────────────────────────────────────────────

/**
 * Builds social share URLs for a buying guide.
 * @param {string} slug - Guide slug.
 * @param {string} title - Guide title.
 * @returns {Object} Share URLs keyed by platform.
 */
export function buildShareLinks(slug, title) {
  if (!slug) return {};
  const pageUrl = encodeURIComponent(`${SITE_URL}/buying-guides/${slug}`);
  const encodedTitle = encodeURIComponent(title || '');
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${pageUrl}&text=${encodedTitle}`,
    pinterest: `https://pinterest.com/pin/create/button/?url=${pageUrl}&description=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${pageUrl}`,
  };
}

// ── Related Guide Cards ───────────────────────────────────────────────

/**
 * Returns related guide cards excluding the current guide.
 * @param {string} currentSlug - Slug to exclude.
 * @param {Array} allGuides - All guide summaries.
 * @param {number} limit - Max cards to return.
 * @returns {Array<{slug: string, title: string, url: string, categoryLabel: string, heroImage: string}>}
 */
export function getRelatedGuideCards(currentSlug, allGuides, limit) {
  if (!allGuides || !allGuides.length) return [];
  return allGuides
    .filter(g => g.slug !== currentSlug)
    .slice(0, limit)
    .map(g => ({
      slug: g.slug,
      title: g.title,
      categoryLabel: g.categoryLabel,
      heroImage: g.heroImage,
      url: `/buying-guides/${g.slug}`,
    }));
}

// ── Text Truncation ───────────────────────────────────────────────────

/**
 * Truncates text at word boundary with ellipsis.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateDescription(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const cutPoint = lastSpace > 0 ? lastSpace : maxLength;
  return truncated.substring(0, cutPoint) + '...';
}

// ── Category Icon ─────────────────────────────────────────────────────

/**
 * Returns icon identifier for a category slug.
 * @param {string} slug
 * @returns {string}
 */
export function getCategoryIcon(slug) {
  return CATEGORY_ICONS[slug] || 'guide';
}

// ── FAQ Accordion Data ────────────────────────────────────────────────

/**
 * Builds accordion-ready data from FAQ array.
 * @param {Array<{question: string, answer: string}>} faqs
 * @returns {Array<{_id: string, question: string, answer: string}>}
 */
export function buildFaqAccordionData(faqs) {
  if (!faqs || !faqs.length) return [];
  return faqs.map((faq, i) => ({
    _id: `faq-${i}`,
    question: faq.question,
    answer: faq.answer,
  }));
}

// ── Filter By Category ───────────────────────────────────────────────

/**
 * Filters guide summaries by category slug.
 * @param {Array} guides - Guide summaries with category field.
 * @param {string} [category] - Category slug to filter by, or null/'all' for all.
 * @returns {Array}
 */
export function filterGuidesByCategory(guides, category) {
  if (!guides || !guides.length) return [];
  if (!category || category === 'all') return guides;
  return guides.filter(g => g.category === category);
}

// ── Hub Card Data ─────────────────────────────────────────────────────

/**
 * Builds card display data from guide summaries for the hub page.
 * @param {Array} guides - Guide summaries from getAllBuyingGuides.
 * @returns {Array}
 */
export function buildHubCardData(guides) {
  if (!guides || !guides.length) return [];
  return guides.map(g => ({
    _id: `guide-${g.slug}`,
    slug: g.slug,
    title: g.title,
    description: truncateDescription(g.metaDescription, 160),
    category: g.category,
    categoryLabel: g.categoryLabel,
    heroImage: g.heroImage,
    url: `/buying-guides/${g.slug}`,
    publishDate: g.publishDate,
    readingTime: g.readingTime || 0,
  }));
}
