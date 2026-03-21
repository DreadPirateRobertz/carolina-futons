/**
 * @module localSeoHelpers
 * @description Pure helpers for /near/[city] local SEO page rendering.
 * Builds structured data schemas (BreadcrumbList, FAQPage) and
 * breadcrumb display arrays. No DOM dependencies — fully testable.
 */

// ── BreadcrumbList schema ────────────────────────────────────────────────

/**
 * Build a BreadcrumbList JSON-LD schema for a city landing page.
 * Breadcrumb path: Home › Local Stores › {City}
 *
 * @param {{ city: string, slug: string }} cityData - City name and URL slug.
 * @param {string} siteUrl - Base site URL (e.g. 'https://www.carolinafutons.com').
 * @returns {Object} BreadcrumbList JSON-LD schema object.
 */
export function buildBreadcrumbSchema(cityData, siteUrl) {
  const base = siteUrl || 'https://www.carolinafutons.com';
  const city = cityData && cityData.city ? String(cityData.city) : 'City';
  const slug = cityData && cityData.slug ? String(cityData.slug) : '';

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: base,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Local Stores',
        item: `${base}/near`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: city,
        item: slug ? `${base}/near/${slug}` : `${base}/near`,
      },
    ],
  };
}

/**
 * Build a plain breadcrumb list for UI rendering.
 * Each item: { label: string, url: string, isCurrentPage: boolean }
 *
 * @param {{ city: string, slug: string }} cityData
 * @param {string} siteUrl - Base site URL.
 * @returns {Array<{ label: string, url: string, isCurrentPage: boolean }>}
 */
export function buildBreadcrumbList(cityData, siteUrl) {
  const base = siteUrl || 'https://www.carolinafutons.com';
  const city = cityData && cityData.city ? String(cityData.city) : 'City';
  const slug = cityData && cityData.slug ? String(cityData.slug) : '';

  return [
    { label: 'Home', url: base, isCurrentPage: false },
    { label: 'Local Stores', url: `${base}/near`, isCurrentPage: false },
    { label: city, url: slug ? `${base}/near/${slug}` : `${base}/near`, isCurrentPage: true },
  ];
}

// ── FAQPage schema ───────────────────────────────────────────────────────

/**
 * Build a FAQPage JSON-LD schema from an array of question/answer pairs.
 *
 * @param {Array<{ question: string, answer: string }>} faqs
 * @returns {Object} FAQPage JSON-LD schema object. Returns minimal valid
 *   schema (empty mainEntity) if faqs is empty or not an array.
 */
export function buildFaqSchema(faqs) {
  const items = Array.isArray(faqs) ? faqs : [];

  const mainEntity = items
    .filter(faq => faq && typeof faq.question === 'string' && typeof faq.answer === 'string')
    .map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    }));

  // Return null when empty so callers can filter(Boolean) to exclude from structured data
  if (mainEntity.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
}

// ── JSON-LD script serializer ─────────────────────────────────────────────

/**
 * Serialize a JSON-LD schema object into a <script> tag string suitable
 * for injection into a Wix HtmlComponent or page head.
 *
 * @param {Object} schema - Valid JSON-LD schema object.
 * @returns {string} HTML script tag string, or empty string if schema is null.
 */
export function buildJsonLdScript(schema) {
  if (!schema || typeof schema !== 'object') return '';
  try {
    const json = JSON.stringify(schema);
    return `<script type="application/ld+json">${json}</script>`;
  } catch {
    return '';
  }
}
