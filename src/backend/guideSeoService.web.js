/**
 * @module guideSeoService
 * @description SEO schema generators and internal link recommendations
 * for buying guide pages.
 *
 * Generates HowTo JSON-LD schema from guide sections and recommends
 * related products/guides based on category matching.
 *
 * CF-0je0
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const PUBLISHER = {
  name: 'Carolina Futons',
  logo: 'https://www.carolinafutons.com/logo.png',
};

// ── HowTo Schema ────────────────────────────────────────────────────

/**
 * Generate a HowTo JSON-LD schema from a buying guide's sections.
 * Each section becomes a HowToStep with name, text, and optional image.
 *
 * @param {Object} guide - Guide data with title, sections, heroImage
 * @param {string} guide.title
 * @param {string} guide.slug
 * @param {string} guide.metaDescription
 * @param {string} [guide.heroImage]
 * @param {Array} guide.sections - [{title, content, image?}]
 * @param {number} [guide.estimatedMinutes]
 * @returns {{success: boolean, schema: string|null}}
 * @permission Anyone
 */
export const getHowToSchema = webMethod(
  Permissions.Anyone,
  (guide) => {
    if (!guide || !guide.title || !Array.isArray(guide.sections) || guide.sections.length === 0) {
      return { success: false, schema: null };
    }

    const steps = guide.sections.map((section, i) => {
      const step = {
        '@type': 'HowToStep',
        position: i + 1,
        name: sanitize(section.title || `Step ${i + 1}`, 200),
        text: sanitize(section.content || '', 2000),
        url: `${SITE_URL}/buying-guides/${guide.slug}#step-${i + 1}`,
      };

      if (section.image) {
        step.image = {
          '@type': 'ImageObject',
          url: section.image,
        };
      }

      return step;
    });

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: sanitize(guide.title, 200),
      description: sanitize(guide.metaDescription || '', 500),
      image: guide.heroImage || undefined,
      totalTime: guide.estimatedMinutes ? `PT${guide.estimatedMinutes}M` : undefined,
      step: steps,
      author: {
        '@type': 'Organization',
        name: PUBLISHER.name,
      },
      publisher: {
        '@type': 'Organization',
        name: PUBLISHER.name,
        logo: { '@type': 'ImageObject', url: PUBLISHER.logo },
      },
    };

    return { success: true, schema: JSON.stringify(schema) };
  }
);

// ── Internal Link Recommendations ───────────────────────────────────

/**
 * Get related products for a buying guide based on category.
 *
 * @param {string} category - Product category slug (e.g., 'futon-frames')
 * @param {number} [limit=6] - Max products to return
 * @returns {Promise<{success: boolean, products: Array}>}
 * @permission Anyone
 */
export const getRelatedProducts = webMethod(
  Permissions.Anyone,
  async (category, limit) => {
    try {
      const cleanCategory = sanitize(category, 100);
      if (!cleanCategory) return { success: false, products: [] };

      const maxItems = Math.min(Math.max(1, limit || 6), 12);

      const result = await wixData.query('Products')
        .eq('category', cleanCategory)
        .descending('numericRating')
        .limit(maxItems)
        .find();

      return {
        success: true,
        products: result.items.map(p => ({
          productId: p._id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: p.mainMedia || (p.images && p.images[0]) || '',
          rating: p.numericRating || 0,
          url: `${SITE_URL}/product-page/${p.slug}`,
        })),
      };
    } catch (err) {
      console.error('[guideSeoService] getRelatedProducts error:', err);
      return { success: false, products: [] };
    }
  }
);

/**
 * Get related buying guides based on category affinity.
 * Returns guides that share category overlap or complement the given guide.
 *
 * @param {string} currentSlug - Current guide slug (excluded from results)
 * @param {string} category - Current guide's category
 * @param {Array} allGuides - All available guides [{slug, title, category, heroImage}]
 * @returns {{success: boolean, guides: Array}}
 * @permission Anyone
 */
export const getRelatedGuides = webMethod(
  Permissions.Anyone,
  (currentSlug, category, allGuides) => {
    if (!Array.isArray(allGuides) || !currentSlug) {
      return { success: false, guides: [] };
    }

    // Category affinity map: guides in related categories
    const CATEGORY_AFFINITY = {
      'futon-frames': ['mattresses', 'covers', 'casegoods-accessories'],
      'mattresses': ['futon-frames', 'covers', 'pillows'],
      'covers': ['futon-frames', 'mattresses'],
      'murphy-cabinet-beds': ['mattresses', 'platform-beds'],
      'platform-beds': ['mattresses', 'murphy-cabinet-beds'],
      'casegoods-accessories': ['futon-frames', 'covers'],
      'pillows': ['mattresses', 'covers'],
      'outdoor-furniture': ['covers', 'futon-frames'],
    };

    const related = allGuides
      .filter(g => g.slug !== currentSlug)
      .map(g => {
        let score = 0;
        // Same category = highest affinity
        if (g.category === category) score += 3;
        // Related category
        const affinities = CATEGORY_AFFINITY[category] || [];
        if (affinities.includes(g.category)) score += 2;
        // Any other guide gets base score
        if (score === 0) score = 1;

        return { ...g, score, url: `${SITE_URL}/buying-guides/${g.slug}` };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    return { success: true, guides: related };
  }
);

/**
 * Get complete SEO + linking data for a guide page in a single call.
 *
 * @param {Object} guide - Full guide data
 * @param {Array} allGuides - All guides for related recommendations
 * @returns {Promise<{success: boolean, howToSchema: string|null, relatedProducts: Array, relatedGuides: Array}>}
 * @permission Anyone
 */
export const getGuidePageSeoData = webMethod(
  Permissions.Anyone,
  async (guide, allGuides) => {
    try {
      if (!guide) return { success: false, howToSchema: null, relatedProducts: [], relatedGuides: [] };

      const howToResult = getHowToSchema(guide);
      const productsResult = await getRelatedProducts(guide.category, 6);
      const guidesResult = getRelatedGuides(guide.slug, guide.category, allGuides || []);

      return {
        success: true,
        howToSchema: howToResult.success ? howToResult.schema : null,
        relatedProducts: productsResult.success ? productsResult.products : [],
        relatedGuides: guidesResult.success ? guidesResult.guides : [],
      };
    } catch (err) {
      console.error('[guideSeoService] getGuidePageSeoData error:', err);
      return { success: false, howToSchema: null, relatedProducts: [], relatedGuides: [] };
    }
  }
);
