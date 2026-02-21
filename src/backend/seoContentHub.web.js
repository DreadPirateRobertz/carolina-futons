/**
 * @module seoContentHub
 * @description SEO content hub: pillar page architecture for buying guides.
 * Provides hub/spoke structure connecting all 8 category buying guides with
 * proper JSON-LD schema (CollectionPage, BreadcrumbList, ItemList, SiteNavigationElement),
 * internal linking, and sitemap metadata. Works with buyingGuides.web.js as the
 * content source and seoHelpers.web.js for business info.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize, validateSlug } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const HUB_PATH = '/buying-guides';
const PUBLISHER = {
  name: 'Carolina Futons',
  logo: `${SITE_URL}/logo.png`,
  url: SITE_URL,
};

// ── Pillar Guide Registry ─────────────────────────────────────────────
// Canonical metadata for all 8 pillar guides — source of truth for hub pages,
// sitemaps, breadcrumbs, and cross-linking.

const PILLAR_GUIDES = [
  {
    slug: 'futon-frames',
    title: 'The Complete Futon Frame Buying Guide for 2026',
    shortTitle: 'Futon Frames',
    description: 'Everything you need to know before buying a futon frame. Compare wood vs metal, sizes, styles, weight capacity, and top picks.',
    heroImage: `${SITE_URL}/buying-guides/futon-frames-hero.jpg`,
    category: 'futon-frames',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['mattresses', 'covers', 'accessories'],
    priority: 1,
  },
  {
    slug: 'mattresses',
    title: 'Futon Mattress Buying Guide: Thickness, Fill Types & Comfort',
    shortTitle: 'Mattresses',
    description: 'Choose the perfect futon mattress. Compare innerspring vs foam, understand thickness options, and find the right firmness.',
    heroImage: `${SITE_URL}/buying-guides/mattresses-hero.jpg`,
    category: 'mattresses',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'pillows', 'covers'],
    priority: 2,
  },
  {
    slug: 'covers',
    title: 'Futon Cover Guide: Fabrics, Fits & Style Tips',
    shortTitle: 'Covers',
    description: 'Find the perfect futon cover. Compare cotton, microfiber, and premium fabrics. Learn about sizing, care, and style coordination.',
    heroImage: `${SITE_URL}/buying-guides/covers-hero.jpg`,
    category: 'covers',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'mattresses', 'pillows'],
    priority: 3,
  },
  {
    slug: 'pillows',
    title: 'Futon Pillow & Bolster Guide: Comfort Accessories',
    shortTitle: 'Pillows',
    description: 'Complete your futon setup with the right pillows and bolsters. Decorative and functional options for every style.',
    heroImage: `${SITE_URL}/buying-guides/pillows-hero.jpg`,
    category: 'pillows',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['covers', 'mattresses', 'accessories'],
    priority: 4,
  },
  {
    slug: 'storage',
    title: 'Futon Storage Solutions: Drawers, Ottomans & Space Savers',
    shortTitle: 'Storage',
    description: 'Maximize your space with futon storage solutions. Under-frame drawers, storage ottomans, and organization accessories.',
    heroImage: `${SITE_URL}/buying-guides/storage-hero.jpg`,
    category: 'storage',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'accessories', 'outdoor'],
    priority: 5,
  },
  {
    slug: 'outdoor',
    title: 'Outdoor Futon Guide: Weather-Resistant Frames & Covers',
    shortTitle: 'Outdoor',
    description: 'Bring futon comfort outdoors. Weather-resistant frames, UV-protected covers, and patio-friendly mattress options.',
    heroImage: `${SITE_URL}/buying-guides/outdoor-hero.jpg`,
    category: 'outdoor',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'covers', 'storage'],
    priority: 6,
  },
  {
    slug: 'accessories',
    title: 'Futon Accessories Guide: Grip Strips, Arm Covers & More',
    shortTitle: 'Accessories',
    description: 'Essential futon accessories: grip strips, arm covers, hardware kits, and finishing touches for your setup.',
    heroImage: `${SITE_URL}/buying-guides/accessories-hero.jpg`,
    category: 'accessories',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'covers', 'pillows'],
    priority: 7,
  },
  {
    slug: 'bundle-deals',
    title: 'Futon Bundle Deals: Save on Complete Sets',
    shortTitle: 'Bundle Deals',
    description: 'Get the best value with curated futon bundles. Frame, mattress, and cover packages at bundle pricing.',
    heroImage: `${SITE_URL}/buying-guides/bundle-deals-hero.jpg`,
    category: 'bundle-deals',
    publishDate: '2026-02-20',
    updatedDate: '2026-02-20',
    relatedSlugs: ['futon-frames', 'mattresses', 'covers'],
    priority: 8,
  },
];

const GUIDE_MAP = {};
for (const g of PILLAR_GUIDES) {
  GUIDE_MAP[g.slug] = g;
}

// ── Hub Page Data ─────────────────────────────────────────────────────

/**
 * Get the full hub page data: all 8 pillar guides with metadata for the
 * buying guides index page. Includes CollectionPage + ItemList JSON-LD.
 *
 * @returns {Promise<{success: boolean, hub: Object}>}
 */
export const getContentHub = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const guides = PILLAR_GUIDES.map(g => ({
        slug: g.slug,
        title: g.title,
        shortTitle: g.shortTitle,
        description: g.description,
        heroImage: g.heroImage,
        category: g.category,
        url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
        publishDate: g.publishDate,
        updatedDate: g.updatedDate,
      }));

      return {
        success: true,
        hub: {
          title: 'Futon Buying Guides — Expert Advice from Carolina Futons',
          metaDescription: 'Browse our complete collection of futon buying guides. Expert advice on frames, mattresses, covers, pillows, storage, outdoor options, accessories, and bundle deals.',
          url: `${SITE_URL}${HUB_PATH}`,
          guides,
          guideCount: guides.length,
        },
      };
    } catch (err) {
      console.error('[seoContentHub] Error getting content hub:', err);
      return { success: false, error: 'Failed to load content hub.', hub: null };
    }
  }
);

/**
 * Get a single pillar guide's metadata with related guides for cross-linking.
 *
 * @param {string} slug - Guide slug.
 * @returns {Promise<{success: boolean, guide: Object, relatedGuides: Array}>}
 */
export const getPillarGuide = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) {
        return { success: false, error: 'Guide slug is required.', guide: null, relatedGuides: [] };
      }

      const guide = GUIDE_MAP[cleanSlug];
      if (!guide) {
        return { success: true, guide: null, relatedGuides: [] };
      }

      const relatedGuides = (guide.relatedSlugs || [])
        .map(s => GUIDE_MAP[s])
        .filter(Boolean)
        .map(g => ({
          slug: g.slug,
          title: g.title,
          shortTitle: g.shortTitle,
          description: g.description,
          heroImage: g.heroImage,
          url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
        }));

      return {
        success: true,
        guide: {
          slug: guide.slug,
          title: guide.title,
          shortTitle: guide.shortTitle,
          description: guide.description,
          heroImage: guide.heroImage,
          category: guide.category,
          url: `${SITE_URL}${HUB_PATH}/${guide.slug}`,
          publishDate: guide.publishDate,
          updatedDate: guide.updatedDate,
        },
        relatedGuides,
      };
    } catch (err) {
      console.error('[seoContentHub] Error getting pillar guide:', err);
      return { success: false, error: 'Failed to load guide.', guide: null, relatedGuides: [] };
    }
  }
);

/**
 * Get all pillar guide slugs for static site generation / sitemap.
 *
 * @returns {Promise<{success: boolean, slugs: string[]}>}
 */
export const getPillarGuideSlugs = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      return {
        success: true,
        slugs: PILLAR_GUIDES.map(g => g.slug),
      };
    } catch (err) {
      console.error('[seoContentHub] Error getting slugs:', err);
      return { success: false, error: 'Failed to load slugs.', slugs: [] };
    }
  }
);

// ── JSON-LD Schema Methods ────────────────────────────────────────────

/**
 * Get CollectionPage + ItemList JSON-LD for the hub index page.
 * This tells Google the hub page is a curated collection of buying guides.
 *
 * @returns {Promise<{success: boolean, collectionSchema: string, itemListSchema: string, breadcrumbSchema: string}>}
 */
export const getHubSchema = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const collectionSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Futon Buying Guides',
        description: 'Expert buying guides covering futon frames, mattresses, covers, pillows, storage, outdoor options, accessories, and bundle deals.',
        url: `${SITE_URL}${HUB_PATH}`,
        publisher: {
          '@type': 'Organization',
          name: PUBLISHER.name,
          logo: { '@type': 'ImageObject', url: PUBLISHER.logo },
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: PILLAR_GUIDES.length,
          itemListElement: PILLAR_GUIDES.map((g, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
            name: g.title,
          })),
        },
      });

      const itemListSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Futon Buying Guides',
        numberOfItems: PILLAR_GUIDES.length,
        itemListElement: PILLAR_GUIDES.map((g, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
          name: g.title,
          image: g.heroImage,
          description: g.description,
        })),
      });

      const breadcrumbSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Buying Guides', item: `${SITE_URL}${HUB_PATH}` },
        ],
      });

      return { success: true, collectionSchema, itemListSchema, breadcrumbSchema };
    } catch (err) {
      console.error('[seoContentHub] Error generating hub schema:', err);
      return { success: false, error: 'Failed to generate hub schema.', collectionSchema: '', itemListSchema: '', breadcrumbSchema: '' };
    }
  }
);

/**
 * Get BreadcrumbList JSON-LD for an individual guide page.
 * Provides Home > Buying Guides > [Guide Name] breadcrumb trail.
 *
 * @param {string} slug - Guide slug.
 * @returns {Promise<{success: boolean, breadcrumbSchema: string, navigationSchema: string}>}
 */
export const getGuideSchema = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug) || sanitize(slug, 100);
      if (!cleanSlug) {
        return { success: false, error: 'Guide slug is required.', breadcrumbSchema: '', navigationSchema: '' };
      }

      const guide = GUIDE_MAP[cleanSlug];
      if (!guide) {
        return { success: true, breadcrumbSchema: '', navigationSchema: '' };
      }

      const breadcrumbSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Buying Guides', item: `${SITE_URL}${HUB_PATH}` },
          { '@type': 'ListItem', position: 3, name: guide.shortTitle, item: `${SITE_URL}${HUB_PATH}/${guide.slug}` },
        ],
      });

      // SiteNavigationElement — links to related guides from this page
      const relatedItems = (guide.relatedSlugs || [])
        .map(s => GUIDE_MAP[s])
        .filter(Boolean);

      const navigationSchema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SiteNavigationElement',
        name: 'Related Buying Guides',
        hasPart: relatedItems.map(g => ({
          '@type': 'WebPage',
          name: g.title,
          url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
        })),
      });

      return { success: true, breadcrumbSchema, navigationSchema };
    } catch (err) {
      console.error('[seoContentHub] Error generating guide schema:', err);
      return { success: false, error: 'Failed to generate guide schema.', breadcrumbSchema: '', navigationSchema: '' };
    }
  }
);

/**
 * Get sitemap entries for all pillar content (hub + 8 guides).
 * Returns structured data suitable for XML sitemap generation.
 *
 * @returns {Promise<{success: boolean, entries: Array}>}
 */
export const getSitemapEntries = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const entries = [
        {
          url: `${SITE_URL}${HUB_PATH}`,
          lastmod: PILLAR_GUIDES.reduce((latest, g) =>
            g.updatedDate > latest ? g.updatedDate : latest, '2026-01-01'),
          changefreq: 'weekly',
          priority: 0.9,
          title: 'Futon Buying Guides',
        },
        ...PILLAR_GUIDES.map(g => ({
          url: `${SITE_URL}${HUB_PATH}/${g.slug}`,
          lastmod: g.updatedDate,
          changefreq: 'monthly',
          priority: 0.8,
          title: g.title,
        })),
      ];

      return { success: true, entries };
    } catch (err) {
      console.error('[seoContentHub] Error generating sitemap entries:', err);
      return { success: false, error: 'Failed to generate sitemap.', entries: [] };
    }
  }
);
