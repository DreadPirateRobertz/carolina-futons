/**
 * Pure utility functions for the Topic Cluster page (/guides/{slug}).
 * Used by Topic Cluster.js for rendering cluster overview pages with
 * spoke page cards, breadcrumbs, SEO meta, and internal link sections.
 */

const SITE_URL = 'https://www.carolinafutons.com';
const GUIDES_URL = `${SITE_URL}/guides`;

const SPOKE_TYPE_LABELS = {
  comparison: 'Comparison',
  guide: 'Guide',
  howto: 'How-To',
  reference: 'Reference',
};

/**
 * Build breadcrumb items for a topic cluster page.
 * @param {string} clusterTitle - The pillar title for the current cluster.
 * @returns {{ label: string, url: string|null, isLast: boolean }[]}
 */
export function buildClusterBreadcrumbs(clusterTitle) {
  if (!clusterTitle || typeof clusterTitle !== 'string') {
    return [{ label: 'Home', url: SITE_URL, isLast: false }];
  }
  return [
    { label: 'Home', url: SITE_URL, isLast: false },
    { label: 'Buying Guides', url: `${SITE_URL}/buying-guides`, isLast: false },
    { label: clusterTitle, url: null, isLast: true },
  ];
}

/**
 * Build the meta title for a topic cluster page.
 * @param {string} pillarTitle
 * @returns {string}
 */
export function buildClusterMetaTitle(pillarTitle) {
  if (!pillarTitle || typeof pillarTitle !== 'string') return 'Buying Guides | Carolina Futons';
  return `${pillarTitle} | Carolina Futons`;
}

/**
 * Build the meta description for a topic cluster page.
 * Falls back to a generic description if no content is provided.
 * @param {{ topic: string }} cluster
 * @param {{ metaDescription?: string }|null} content
 * @returns {string}
 */
export function buildClusterMetaDescription(cluster, content) {
  if (content && content.metaDescription) return content.metaDescription;
  if (cluster && cluster.topic) {
    return `Everything about ${cluster.topic} — compare options, find the right fit, and shop Carolina Futons' complete selection.`;
  }
  return 'Expert buying guides from Carolina Futons — family-owned since 1991.';
}

/**
 * Return the human-readable label for a spoke page type.
 * @param {string} type - 'comparison' | 'guide' | 'howto' | 'reference'
 * @returns {string}
 */
export function getSpokeTypeLabel(type) {
  return SPOKE_TYPE_LABELS[type] || 'Article';
}

/**
 * Build card data for each spoke page in a cluster.
 * @param {Array<{ slug: string, title: string, type: string }>} spokePages
 * @returns {{ _id: string, slug: string, title: string, type: string, typeLabel: string, url: string }[]}
 */
export function buildSpokeCards(spokePages) {
  if (!Array.isArray(spokePages)) return [];
  return spokePages.map((sp, i) => ({
    _id: sp.slug || `spoke-${i}`,
    slug: sp.slug || '',
    title: sp.title || '',
    type: sp.type || '',
    typeLabel: getSpokeTypeLabel(sp.type),
    url: `${SITE_URL}/buying-guides/${sp.slug}`,
  }));
}

/**
 * Filter spoke pages by type.
 * @param {Array} spokePages
 * @param {string} type
 * @returns {Array}
 */
export function getSpokesByType(spokePages, type) {
  if (!Array.isArray(spokePages) || !type) return [];
  return spokePages.filter(sp => sp.type === type);
}

/**
 * Group spoke pages by their type.
 * @param {Array<{ type: string }>} spokePages
 * @returns {Object.<string, Array>} Map of type → spokes
 */
export function groupSpokesByType(spokePages) {
  if (!Array.isArray(spokePages)) return {};
  const result = {};
  for (const sp of spokePages) {
    const t = sp.type || 'other';
    if (!result[t]) result[t] = [];
    result[t].push(sp);
  }
  return result;
}

/**
 * Build nav items for other topic clusters (for sidebar navigation).
 * @param {string} currentSlug - Slug of the current cluster (excluded from nav).
 * @param {Object.<string, { pillarTitle: string }>} allClusters
 * @returns {{ slug: string, title: string, url: string }[]}
 */
export function buildRelatedClusterNav(currentSlug, allClusters) {
  if (!allClusters || typeof allClusters !== 'object') return [];
  return Object.entries(allClusters)
    .filter(([slug]) => slug !== currentSlug)
    .map(([slug, cluster]) => ({
      slug,
      title: cluster.pillarTitle || slug,
      url: `${GUIDES_URL}/${slug}`,
    }));
}
