/**
 * @module topicClusters
 * @description SEO topic cluster engine: organizes content into pillar/spoke
 * clusters, auto-generates internal links between related content, provides
 * comprehensive schema markup (Article, FAQ, HowTo, BreadcrumbList), and
 * calculates SEO readiness scores per page.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection `TopicClusters` with fields:
 *   pillarSlug (Text, indexed) - Pillar page slug
 *   pillarTitle (Text) - Pillar page title
 *   topic (Text, indexed) - Cluster topic keyword
 *   spokePages (Text) - JSON array of spoke page slugs
 *   keywords (Text) - JSON array of target keywords
 *   active (Boolean)
 *
 * Create CMS collection `InternalLinks` with fields:
 *   sourceSlug (Text, indexed) - Page the link appears on
 *   targetSlug (Text, indexed) - Page being linked to
 *   anchorText (Text) - Anchor text for the link
 *   context (Text) - 'inline'|'sidebar'|'footer'|'related'
 *   weight (Number) - Link importance (higher = more prominent)
 *   active (Boolean)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateSlug } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const PUBLISHER_NAME = 'Carolina Futons';

// ── Topic Cluster Definitions ─────────────────────────────────────────
// Inline cluster data for the 8 product categories. Each pillar page
// has spoke pages (buying guide sections, related blog posts, product pages)
// and a keyword target list.

const CLUSTERS = {
  'futon-frames': {
    pillarSlug: 'futon-frames',
    pillarTitle: 'The Complete Futon Frame Buying Guide',
    topic: 'futon frames',
    keywords: ['futon frame', 'best futon frame', 'wood futon frame', 'metal futon frame', 'wall hugger futon', 'futon frame sizes', 'Night & Day futon'],
    spokePages: [
      { slug: 'wood-vs-metal-frames', title: 'Wood vs Metal Futon Frames', type: 'comparison' },
      { slug: 'wall-hugger-guide', title: 'Wall Hugger Futon Guide', type: 'guide' },
      { slug: 'futon-frame-assembly', title: 'How to Assemble a Futon Frame', type: 'howto' },
      { slug: 'futon-frame-sizes', title: 'Futon Frame Size Guide', type: 'reference' },
    ],
  },
  'mattresses': {
    pillarSlug: 'mattresses',
    pillarTitle: 'Futon Mattress Buying Guide',
    topic: 'futon mattresses',
    keywords: ['futon mattress', 'best futon mattress', 'innerspring futon mattress', 'memory foam futon', 'futon mattress thickness', 'Otis Bed mattress'],
    spokePages: [
      { slug: 'mattress-fill-types', title: 'Futon Mattress Fill Types Compared', type: 'comparison' },
      { slug: 'mattress-thickness-guide', title: 'Futon Mattress Thickness Guide', type: 'guide' },
      { slug: 'mattress-care-tips', title: 'How to Care for Your Futon Mattress', type: 'howto' },
      { slug: 'mattress-firmness-guide', title: 'Futon Mattress Firmness Guide', type: 'reference' },
    ],
  },
  'covers': {
    pillarSlug: 'covers',
    pillarTitle: 'Futon Cover Guide: Fabrics, Fits & Style',
    topic: 'futon covers',
    keywords: ['futon cover', 'futon slipcover', 'futon cover fabric', 'microfiber futon cover', 'cotton futon cover', 'futon cover sizing'],
    spokePages: [
      { slug: 'cover-fabric-comparison', title: 'Futon Cover Fabrics Compared', type: 'comparison' },
      { slug: 'cover-sizing-guide', title: 'How to Measure for a Futon Cover', type: 'howto' },
      { slug: 'cover-care-instructions', title: 'Futon Cover Care & Washing Guide', type: 'howto' },
    ],
  },
  'pillows': {
    pillarSlug: 'pillows',
    pillarTitle: 'Futon Pillow & Bolster Guide',
    topic: 'futon pillows',
    keywords: ['futon pillows', 'futon bolsters', 'decorative futon pillows', 'futon back pillows'],
    spokePages: [
      { slug: 'pillow-styles-guide', title: 'Futon Pillow Styles & Uses', type: 'guide' },
      { slug: 'bolster-placement-tips', title: 'How to Arrange Futon Bolsters', type: 'howto' },
    ],
  },
  'storage': {
    pillarSlug: 'storage',
    pillarTitle: 'Futon Storage Solutions Guide',
    topic: 'futon storage',
    keywords: ['futon storage', 'under futon storage', 'futon drawers', 'storage ottoman futon'],
    spokePages: [
      { slug: 'drawer-options-guide', title: 'Futon Drawer Storage Options', type: 'guide' },
      { slug: 'small-space-storage', title: 'Storage Solutions for Small Spaces', type: 'guide' },
    ],
  },
  'outdoor': {
    pillarSlug: 'outdoor',
    pillarTitle: 'Outdoor Futon Guide',
    topic: 'outdoor futons',
    keywords: ['outdoor futon', 'patio futon', 'weather resistant futon', 'outdoor futon cover'],
    spokePages: [
      { slug: 'outdoor-material-guide', title: 'Weather-Resistant Futon Materials', type: 'guide' },
      { slug: 'outdoor-futon-care', title: 'How to Protect Your Outdoor Futon', type: 'howto' },
    ],
  },
  'accessories': {
    pillarSlug: 'accessories',
    pillarTitle: 'Futon Accessories Guide',
    topic: 'futon accessories',
    keywords: ['futon accessories', 'futon grip strips', 'futon arm covers', 'futon hardware'],
    spokePages: [
      { slug: 'essential-accessories', title: 'Essential Futon Accessories', type: 'guide' },
      { slug: 'grip-strip-installation', title: 'How to Install Futon Grip Strips', type: 'howto' },
    ],
  },
  'bundle-deals': {
    pillarSlug: 'bundle-deals',
    pillarTitle: 'Futon Bundle Deals Guide',
    topic: 'futon bundles',
    keywords: ['futon bundle', 'futon set deal', 'complete futon package', 'futon frame mattress bundle'],
    spokePages: [
      { slug: 'bundle-value-comparison', title: 'Futon Bundle vs Individual Purchase', type: 'comparison' },
      { slug: 'how-to-choose-bundle', title: 'How to Choose the Right Futon Bundle', type: 'guide' },
    ],
  },
};

// ── getTopicCluster ───────────────────────────────────────────────────

/**
 * Get a topic cluster with pillar page, spoke pages, and keywords.
 *
 * @param {string} pillarSlug - Pillar page slug.
 * @returns {Promise<{success: boolean, cluster: Object}>}
 */
export const getTopicCluster = webMethod(
  Permissions.Anyone,
  async (pillarSlug) => {
    try {
      const slug = validateSlug(pillarSlug) || sanitize(pillarSlug, 100);
      if (!slug) {
        return { success: false, error: 'Pillar slug is required.', cluster: null };
      }

      const cluster = CLUSTERS[slug];
      if (!cluster) {
        return { success: true, cluster: null };
      }

      return {
        success: true,
        cluster: {
          pillarSlug: cluster.pillarSlug,
          pillarTitle: cluster.pillarTitle,
          pillarUrl: `${SITE_URL}/buying-guides/${cluster.pillarSlug}`,
          topic: cluster.topic,
          keywords: cluster.keywords,
          spokePages: cluster.spokePages.map(sp => ({
            ...sp,
            url: `${SITE_URL}/buying-guides/${sp.slug}`,
          })),
          spokeCount: cluster.spokePages.length,
        },
      };
    } catch (err) {
      console.error('[topicClusters] Error getting topic cluster:', err);
      return { success: false, error: 'Failed to load topic cluster.', cluster: null };
    }
  }
);

// ── generateInternalLinks ─────────────────────────────────────────────

/**
 * Generate internal link suggestions for a page based on topic cluster
 * relationships. Returns links to insert in content for SEO.
 *
 * @param {string} pageSlug - Current page slug.
 * @param {number} [maxLinks=5] - Maximum links to return.
 * @returns {Promise<{success: boolean, links: Array}>}
 */
export const generateInternalLinks = webMethod(
  Permissions.Anyone,
  async (pageSlug, maxLinks = 5) => {
    try {
      const slug = validateSlug(pageSlug) || sanitize(pageSlug, 100);
      if (!slug) {
        return { success: false, error: 'Page slug is required.', links: [] };
      }

      const limit = Math.max(1, Math.min(20, Math.round(Number(maxLinks) || 5)));
      const links = [];

      // Check if this is a pillar page — link to its spokes
      if (CLUSTERS[slug]) {
        const cluster = CLUSTERS[slug];
        for (const spoke of cluster.spokePages.slice(0, limit)) {
          links.push({
            targetSlug: spoke.slug,
            targetUrl: `${SITE_URL}/buying-guides/${spoke.slug}`,
            anchorText: spoke.title,
            context: 'inline',
            relationship: 'pillar-to-spoke',
          });
        }
      }

      // Check if this is a spoke page — link back to pillar + sibling spokes
      for (const [pillarSlug, cluster] of Object.entries(CLUSTERS)) {
        const spoke = cluster.spokePages.find(sp => sp.slug === slug);
        if (spoke) {
          // Link back to pillar
          links.push({
            targetSlug: pillarSlug,
            targetUrl: `${SITE_URL}/buying-guides/${pillarSlug}`,
            anchorText: cluster.pillarTitle,
            context: 'inline',
            relationship: 'spoke-to-pillar',
          });

          // Link to sibling spokes
          for (const sibling of cluster.spokePages) {
            if (sibling.slug !== slug && links.length < limit) {
              links.push({
                targetSlug: sibling.slug,
                targetUrl: `${SITE_URL}/buying-guides/${sibling.slug}`,
                anchorText: sibling.title,
                context: 'related',
                relationship: 'spoke-to-spoke',
              });
            }
          }
          break;
        }
      }

      // Add cross-cluster links for pillar pages
      if (CLUSTERS[slug]) {
        const relatedClusters = CLUSTERS[slug].spokePages.length > 0
          ? Object.keys(CLUSTERS).filter(k => k !== slug).slice(0, 3)
          : [];

        for (const relSlug of relatedClusters) {
          if (links.length >= limit) break;
          links.push({
            targetSlug: relSlug,
            targetUrl: `${SITE_URL}/buying-guides/${relSlug}`,
            anchorText: CLUSTERS[relSlug].pillarTitle,
            context: 'sidebar',
            relationship: 'cross-cluster',
          });
        }
      }

      return { success: true, links: links.slice(0, limit) };
    } catch (err) {
      console.error('[topicClusters] Error generating internal links:', err);
      return { success: false, error: 'Failed to generate links.', links: [] };
    }
  }
);

// ── getSchemaMarkup ───────────────────────────────────────────────────

/**
 * Get comprehensive schema markup for a page (Article, FAQ, HowTo, Breadcrumb).
 * Determines schema types based on the page's cluster role and content type.
 *
 * @param {string} pageSlug - Page slug.
 * @param {Object} [pageData] - Optional page content for schema generation.
 * @param {string} [pageData.title] - Page title override.
 * @param {string} [pageData.description] - Page description.
 * @param {string} [pageData.image] - Hero image URL.
 * @param {Array}  [pageData.faqs] - FAQ items [{question, answer}].
 * @param {Array}  [pageData.steps] - HowTo steps [{name, text, image?}].
 * @returns {Promise<{success: boolean, schemas: Object}>}
 */
export const getSchemaMarkup = webMethod(
  Permissions.Anyone,
  async (pageSlug, pageData = {}) => {
    try {
      const slug = validateSlug(pageSlug) || sanitize(pageSlug, 100);
      if (!slug) {
        return { success: false, error: 'Page slug is required.', schemas: {} };
      }

      const schemas = {};
      const cluster = CLUSTERS[slug];
      let spokeInfo = null;
      let parentCluster = null;

      // Find if this is a spoke page
      if (!cluster) {
        for (const [pSlug, c] of Object.entries(CLUSTERS)) {
          const found = c.spokePages.find(sp => sp.slug === slug);
          if (found) {
            spokeInfo = found;
            parentCluster = { slug: pSlug, ...c };
            break;
          }
        }
      }

      const title = sanitize(pageData.title || (cluster ? cluster.pillarTitle : spokeInfo?.title || ''), 200);
      const description = sanitize(pageData.description || '', 500);
      const image = pageData.image || `${SITE_URL}/buying-guides/${slug}-hero.jpg`;
      const pageUrl = `${SITE_URL}/buying-guides/${slug}`;

      // Article schema (always generated)
      schemas.article = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        image,
        author: { '@type': 'Organization', name: PUBLISHER_NAME },
        publisher: {
          '@type': 'Organization',
          name: PUBLISHER_NAME,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
        },
        datePublished: '2026-02-20',
        dateModified: '2026-02-20',
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      });

      // Breadcrumb schema
      const breadcrumbItems = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Buying Guides', item: `${SITE_URL}/buying-guides` },
      ];

      if (cluster) {
        breadcrumbItems.push({ '@type': 'ListItem', position: 3, name: title, item: pageUrl });
      } else if (parentCluster) {
        breadcrumbItems.push({
          '@type': 'ListItem', position: 3,
          name: parentCluster.pillarTitle,
          item: `${SITE_URL}/buying-guides/${parentCluster.slug}`,
        });
        breadcrumbItems.push({ '@type': 'ListItem', position: 4, name: title, item: pageUrl });
      }

      schemas.breadcrumb = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      });

      // FAQ schema (if FAQs provided)
      if (Array.isArray(pageData.faqs) && pageData.faqs.length > 0) {
        schemas.faq = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: pageData.faqs.slice(0, 20).map(faq => ({
            '@type': 'Question',
            name: sanitize(faq.question, 200),
            acceptedAnswer: {
              '@type': 'Answer',
              text: sanitize(faq.answer, 2000),
            },
          })),
        });
      }

      // HowTo schema (if steps provided or page type is howto)
      const isHowTo = spokeInfo?.type === 'howto';
      if (isHowTo || (Array.isArray(pageData.steps) && pageData.steps.length > 0)) {
        const steps = Array.isArray(pageData.steps) ? pageData.steps : [];
        schemas.howTo = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: title,
          description,
          image,
          step: steps.slice(0, 20).map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: sanitize(step.name, 200),
            text: sanitize(step.text, 1000),
            ...(step.image ? { image: step.image } : {}),
          })),
        });
      }

      return { success: true, schemas };
    } catch (err) {
      console.error('[topicClusters] Error generating schema markup:', err);
      return { success: false, error: 'Failed to generate schemas.', schemas: {} };
    }
  }
);

// ── getSEOScore ───────────────────────────────────────────────────────

/**
 * Calculate an SEO readiness score for a page. Checks for required
 * elements: title, description, schema types, internal links, keywords,
 * image alt text, and content length.
 *
 * @param {Object} pageData
 * @param {string} pageData.slug - Page slug.
 * @param {string} [pageData.title] - Page title.
 * @param {string} [pageData.description] - Meta description.
 * @param {string} [pageData.content] - Page content text.
 * @param {string} [pageData.image] - Hero image URL.
 * @param {string} [pageData.imageAlt] - Image alt text.
 * @param {Array}  [pageData.faqs] - FAQ items.
 * @param {number} [pageData.internalLinkCount] - Number of internal links on page.
 * @returns {Promise<{success: boolean, score: number, maxScore: number, checks: Array}>}
 */
export const getSEOScore = webMethod(
  Permissions.Anyone,
  async (pageData) => {
    try {
      if (!pageData || !pageData.slug) {
        return { success: false, error: 'Page data with slug is required.', score: 0, maxScore: 0, checks: [] };
      }

      const checks = [];
      let score = 0;
      const maxScore = 100;

      // Title (15 pts)
      const title = sanitize(pageData.title || '', 200);
      if (title && title.length >= 30 && title.length <= 60) {
        checks.push({ name: 'Title length (30-60 chars)', passed: true, points: 15 });
        score += 15;
      } else if (title) {
        checks.push({ name: 'Title length (30-60 chars)', passed: false, points: 0, tip: `Title is ${title.length} chars. Aim for 30-60.` });
      } else {
        checks.push({ name: 'Title exists', passed: false, points: 0, tip: 'Add a page title.' });
      }

      // Meta description (15 pts)
      const desc = sanitize(pageData.description || '', 500);
      if (desc && desc.length >= 120 && desc.length <= 160) {
        checks.push({ name: 'Meta description (120-160 chars)', passed: true, points: 15 });
        score += 15;
      } else if (desc) {
        checks.push({ name: 'Meta description (120-160 chars)', passed: false, points: 0, tip: `Description is ${desc.length} chars. Aim for 120-160.` });
      } else {
        checks.push({ name: 'Meta description exists', passed: false, points: 0, tip: 'Add a meta description.' });
      }

      // Content length (15 pts)
      const content = sanitize(pageData.content || '', 50000);
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 1500) {
        checks.push({ name: 'Content length (1500+ words)', passed: true, points: 15 });
        score += 15;
      } else if (wordCount >= 500) {
        checks.push({ name: 'Content length (1500+ words)', passed: false, points: 8, tip: `${wordCount} words. Aim for 1500+ for pillar content.` });
        score += 8;
      } else {
        checks.push({ name: 'Content length (1500+ words)', passed: false, points: 0, tip: `Only ${wordCount} words. Add more content.` });
      }

      // Hero image (10 pts)
      if (pageData.image) {
        checks.push({ name: 'Hero image', passed: true, points: 5 });
        score += 5;
        if (pageData.imageAlt && pageData.imageAlt.length >= 10) {
          checks.push({ name: 'Image alt text', passed: true, points: 5 });
          score += 5;
        } else {
          checks.push({ name: 'Image alt text', passed: false, points: 0, tip: 'Add descriptive alt text (10+ chars).' });
        }
      } else {
        checks.push({ name: 'Hero image', passed: false, points: 0, tip: 'Add a hero image.' });
        checks.push({ name: 'Image alt text', passed: false, points: 0, tip: 'No image to add alt text to.' });
      }

      // Topic cluster membership (10 pts)
      const slug = validateSlug(pageData.slug) || sanitize(pageData.slug, 100);
      const inCluster = Boolean(CLUSTERS[slug]) || Object.values(CLUSTERS).some(c => c.spokePages.some(sp => sp.slug === slug));
      if (inCluster) {
        checks.push({ name: 'Topic cluster membership', passed: true, points: 10 });
        score += 10;
      } else {
        checks.push({ name: 'Topic cluster membership', passed: false, points: 0, tip: 'Page is not in a topic cluster. Add to a cluster for better SEO.' });
      }

      // Internal links (10 pts)
      const linkCount = Number(pageData.internalLinkCount) || 0;
      if (linkCount >= 3) {
        checks.push({ name: 'Internal links (3+)', passed: true, points: 10 });
        score += 10;
      } else {
        checks.push({ name: 'Internal links (3+)', passed: false, points: 0, tip: `Only ${linkCount} internal links. Add at least 3.` });
      }

      // FAQ section (10 pts)
      if (Array.isArray(pageData.faqs) && pageData.faqs.length >= 3) {
        checks.push({ name: 'FAQ section (3+ questions)', passed: true, points: 10 });
        score += 10;
      } else {
        checks.push({ name: 'FAQ section (3+ questions)', passed: false, points: 0, tip: 'Add at least 3 FAQs for FAQ schema markup.' });
      }

      // Schema readiness (15 pts)
      const hasSchemaData = title && desc && pageData.image;
      if (hasSchemaData) {
        checks.push({ name: 'Schema markup ready', passed: true, points: 15 });
        score += 15;
      } else {
        checks.push({ name: 'Schema markup ready', passed: false, points: 0, tip: 'Need title, description, and image for schema.' });
      }

      return {
        success: true,
        score,
        maxScore,
        percentage: Math.round((score / maxScore) * 100),
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
        checks,
      };
    } catch (err) {
      console.error('[topicClusters] Error calculating SEO score:', err);
      return { success: false, error: 'Failed to calculate SEO score.', score: 0, maxScore: 0, checks: [] };
    }
  }
);

// ── getSitemapData ────────────────────────────────────────────────────

/**
 * Get complete sitemap data for all topic cluster content.
 * Returns hub, pillar pages, and spoke pages with proper priority/frequency.
 *
 * @returns {Promise<{success: boolean, entries: Array, stats: Object}>}
 */
export const getSitemapData = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const entries = [
        {
          url: `${SITE_URL}/buying-guides`,
          title: 'Futon Buying Guides Hub',
          type: 'hub',
          lastmod: '2026-02-20',
          changefreq: 'weekly',
          priority: 0.9,
        },
      ];

      let totalSpokes = 0;

      for (const cluster of Object.values(CLUSTERS)) {
        entries.push({
          url: `${SITE_URL}/buying-guides/${cluster.pillarSlug}`,
          title: cluster.pillarTitle,
          type: 'pillar',
          topic: cluster.topic,
          lastmod: '2026-02-20',
          changefreq: 'monthly',
          priority: 0.8,
        });

        for (const spoke of cluster.spokePages) {
          entries.push({
            url: `${SITE_URL}/buying-guides/${spoke.slug}`,
            title: spoke.title,
            type: 'spoke',
            contentType: spoke.type,
            parentPillar: cluster.pillarSlug,
            lastmod: '2026-02-20',
            changefreq: 'monthly',
            priority: 0.7,
          });
          totalSpokes++;
        }
      }

      return {
        success: true,
        entries,
        stats: {
          totalPages: entries.length,
          hubPages: 1,
          pillarPages: Object.keys(CLUSTERS).length,
          spokePages: totalSpokes,
          clusters: Object.keys(CLUSTERS).length,
        },
      };
    } catch (err) {
      console.error('[topicClusters] Error generating sitemap data:', err);
      return { success: false, error: 'Failed to generate sitemap.', entries: [], stats: null };
    }
  }
);
