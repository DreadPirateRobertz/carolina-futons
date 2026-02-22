/**
 * @module catalogContent
 * @description Unified product content service for catalog pages.
 * Serves product descriptions, specs, FAQs, buying guides, and
 * category content. Designed for product detail pages, category
 * landing pages, and SEO content rendering.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *   Products/Stores - Standard Wix Stores collection (existing)
 *
 *   ProductSpecs - Extended product specifications
 *     productId (Text, indexed) - Wix product ID
 *     slug (Text, indexed) - Product URL slug
 *     materials (Text) - Material description
 *     weightCapacity (Number) - Max weight in lbs
 *     assemblyDifficulty (Text) - 'easy'|'moderate'|'difficult'
 *     assemblyNotes (Text) - Assembly instructions summary
 *     assemblyVideoUrl (Text) - YouTube/MP4 URL
 *     careGuide (Text) - Care and maintenance instructions
 *     warranty (Text) - Warranty description
 *     madeIn (Text) - Country/region of manufacture
 *     dimensions (Text) - JSON string of dimension details
 *     features (Text) - JSON array of feature strings
 *
 *   CategoryContent - Category-level marketing content
 *     category (Text, indexed) - Category slug
 *     title (Text) - Display title
 *     description (Text) - Category intro paragraph
 *     buyingGuideHtml (Text) - Rich text buying guide
 *     seoTitle (Text) - Meta title
 *     seoDescription (Text) - Meta description
 *     sortOrder (Number) - Display order
 *
 *   ProductFAQs - Frequently asked questions per product/category
 *     targetType (Text, indexed) - 'product'|'category'
 *     targetSlug (Text, indexed) - Product slug or category slug
 *     question (Text) - The question
 *     answer (Text) - The answer
 *     sortOrder (Number) - Display order
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
  'unfinished-wood', 'covers', 'outdoor-furniture', 'log-frames', 'pillows',
];

const VALID_TARGET_TYPES = ['product', 'category'];

// ── Helpers ──────────────────────────────────────────────────────────

function cleanSlug(slug) {
  if (!slug || typeof slug !== 'string') return '';
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 100);
}

function parseJsonField(val) {
  if (!val) return null;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch { return null; }
}

// ── getProductContent ────────────────────────────────────────────────

/**
 * Returns full product content for a product detail page.
 * Combines product data, specs, and FAQs in a single call.
 * @param {string} slug - Product URL slug
 */
export const getProductContent = webMethod(Permissions.Anyone, async (slug) => {
  try {
    const cleanedSlug = cleanSlug(slug);
    if (!cleanedSlug) {
      return { success: false, error: 'Invalid product slug' };
    }

    // Parallel queries for product, specs, and FAQs
    const [productResult, specsResult, faqsResult] = await Promise.all([
      wixData.query('Stores/Products')
        .eq('slug', cleanedSlug)
        .limit(1)
        .find(),
      wixData.query('ProductSpecs')
        .eq('slug', cleanedSlug)
        .limit(1)
        .find(),
      wixData.query('ProductFAQs')
        .eq('targetType', 'product')
        .eq('targetSlug', cleanedSlug)
        .ascending('sortOrder')
        .limit(50)
        .find(),
    ]);

    if (productResult.items.length === 0) {
      return { success: false, error: 'Product not found' };
    }

    const product = productResult.items[0];
    const specs = specsResult.items[0] || null;
    const faqs = faqsResult.items;

    return {
      success: true,
      data: {
        name: product.name,
        slug: cleanedSlug,
        description: product.description || '',
        price: product.price || null,
        formattedPrice: product.formattedPrice || null,
        sku: product.sku || null,
        category: product.category || null,
        manufacturer: product.manufacturer || null,
        inStock: product.inStock !== false,
        images: product.images || [],
        variants: product.variants || [],
        specs: specs ? {
          materials: specs.materials || null,
          weightCapacity: specs.weightCapacity || null,
          assemblyDifficulty: specs.assemblyDifficulty || null,
          assemblyNotes: specs.assemblyNotes || null,
          assemblyVideoUrl: specs.assemblyVideoUrl || null,
          careGuide: specs.careGuide || null,
          warranty: specs.warranty || null,
          madeIn: specs.madeIn || null,
          dimensions: parseJsonField(specs.dimensions),
          features: parseJsonField(specs.features) || [],
        } : null,
        faqs: faqs.map(f => ({
          question: f.question,
          answer: f.answer,
        })),
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load product content' };
  }
});

// ── getProductSpecs ──────────────────────────────────────────────────

/**
 * Returns just the specs for a product. Lighter call for spec tabs.
 * @param {string} slug - Product URL slug
 */
export const getProductSpecs = webMethod(Permissions.Anyone, async (slug) => {
  try {
    const cleanedSlug = cleanSlug(slug);
    if (!cleanedSlug) {
      return { success: false, error: 'Invalid product slug' };
    }

    const result = await wixData.query('ProductSpecs')
      .eq('slug', cleanedSlug)
      .limit(1)
      .find();

    if (result.items.length === 0) {
      return { success: true, data: null };
    }

    const specs = result.items[0];
    return {
      success: true,
      data: {
        slug: cleanedSlug,
        materials: specs.materials || null,
        weightCapacity: specs.weightCapacity || null,
        assemblyDifficulty: specs.assemblyDifficulty || null,
        assemblyNotes: specs.assemblyNotes || null,
        assemblyVideoUrl: specs.assemblyVideoUrl || null,
        careGuide: specs.careGuide || null,
        warranty: specs.warranty || null,
        madeIn: specs.madeIn || null,
        dimensions: parseJsonField(specs.dimensions),
        features: parseJsonField(specs.features) || [],
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load product specs' };
  }
});

// ── getCategoryContent ───────────────────────────────────────────────

/**
 * Returns category-level content for category landing pages.
 * Includes intro text, buying guide, SEO meta, and category FAQs.
 * @param {string} category - Category slug
 */
export const getCategoryContent = webMethod(Permissions.Anyone, async (category) => {
  try {
    if (!category || typeof category !== 'string') {
      return { success: false, error: 'Invalid category' };
    }

    const cleanCategory = sanitize(category, 50).toLowerCase();
    if (!VALID_CATEGORIES.includes(cleanCategory)) {
      return { success: false, error: 'Unknown category' };
    }

    const [contentResult, faqsResult] = await Promise.all([
      wixData.query('CategoryContent')
        .eq('category', cleanCategory)
        .limit(1)
        .find(),
      wixData.query('ProductFAQs')
        .eq('targetType', 'category')
        .eq('targetSlug', cleanCategory)
        .ascending('sortOrder')
        .limit(50)
        .find(),
    ]);

    const content = contentResult.items[0];
    if (!content) {
      return {
        success: true,
        data: {
          category: cleanCategory,
          title: cleanCategory.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: '',
          buyingGuide: null,
          seoTitle: null,
          seoDescription: null,
          faqs: faqsResult.items.map(f => ({ question: f.question, answer: f.answer })),
        },
      };
    }

    return {
      success: true,
      data: {
        category: cleanCategory,
        title: content.title || cleanCategory,
        description: content.description || '',
        buyingGuide: content.buyingGuideHtml || null,
        seoTitle: content.seoTitle || null,
        seoDescription: content.seoDescription || null,
        faqs: faqsResult.items.map(f => ({ question: f.question, answer: f.answer })),
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load category content' };
  }
});

// ── getAllCategories ──────────────────────────────────────────────────

/**
 * Returns all category definitions with content summaries.
 * Used for navigation, sitemaps, and category listing pages.
 */
export const getAllCategories = webMethod(Permissions.Anyone, async () => {
  try {
    const result = await wixData.query('CategoryContent')
      .ascending('sortOrder')
      .limit(50)
      .find();

    if (result.items.length === 0) {
      // Return default categories from constant
      return {
        success: true,
        data: VALID_CATEGORIES.map((cat, i) => ({
          category: cat,
          title: cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          description: '',
          sortOrder: i,
        })),
      };
    }

    return {
      success: true,
      data: result.items.map(c => ({
        category: c.category,
        title: c.title || c.category,
        description: c.description || '',
        sortOrder: c.sortOrder || 0,
      })),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load categories' };
  }
});

// ── saveFAQ (admin) ──────────────────────────────────────────────────

/**
 * Creates or updates an FAQ entry. Admin only.
 * @param {Object} faq - FAQ data
 * @param {string} faq.targetType - 'product' or 'category'
 * @param {string} faq.targetSlug - Product or category slug
 * @param {string} faq.question - The question
 * @param {string} faq.answer - The answer
 * @param {number} [faq.sortOrder] - Display order (default 0)
 * @param {string} [faq._id] - Existing FAQ ID for updates
 */
export const saveFAQ = webMethod(Permissions.Admin, async (faq) => {
  try {
    if (!faq || typeof faq !== 'object') {
      return { success: false, error: 'Invalid FAQ data' };
    }

    const { targetType, targetSlug, question, answer, sortOrder, _id } = faq;

    if (!VALID_TARGET_TYPES.includes(targetType)) {
      return { success: false, error: 'targetType must be "product" or "category"' };
    }
    if (!targetSlug || typeof targetSlug !== 'string') {
      return { success: false, error: 'Invalid target slug' };
    }
    if (!question || typeof question !== 'string') {
      return { success: false, error: 'Question is required' };
    }
    if (!answer || typeof answer !== 'string') {
      return { success: false, error: 'Answer is required' };
    }

    const record = {
      targetType,
      targetSlug: cleanSlug(targetSlug),
      question: sanitize(question, 500),
      answer: sanitize(answer, 2000),
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    };

    let saved;
    if (_id) {
      record._id = _id;
      saved = await wixData.update('ProductFAQs', record);
    } else {
      saved = await wixData.insert('ProductFAQs', record);
    }

    return {
      success: true,
      data: {
        _id: saved._id,
        targetType: saved.targetType,
        targetSlug: saved.targetSlug,
        question: saved.question,
        answer: saved.answer,
        sortOrder: saved.sortOrder,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to save FAQ' };
  }
});

// ── saveProductSpecs (admin) ─────────────────────────────────────────

/**
 * Creates or updates product specifications. Admin only.
 * @param {Object} specs - Spec data
 * @param {string} specs.slug - Product URL slug
 * @param {string} [specs.materials] - Material description
 * @param {number} [specs.weightCapacity] - Max weight in lbs
 * @param {string} [specs.assemblyDifficulty] - easy|moderate|difficult
 * @param {string} [specs.assemblyNotes] - Assembly summary
 * @param {string} [specs.assemblyVideoUrl] - Video URL
 * @param {string} [specs.careGuide] - Care instructions
 * @param {string} [specs.warranty] - Warranty info
 * @param {string} [specs.madeIn] - Origin
 * @param {Object} [specs.dimensions] - Dimension object
 * @param {Array} [specs.features] - Feature list
 */
export const saveProductSpecs = webMethod(Permissions.Admin, async (specs) => {
  try {
    if (!specs || typeof specs !== 'object') {
      return { success: false, error: 'Invalid specs data' };
    }

    const slug = cleanSlug(specs.slug);
    if (!slug) {
      return { success: false, error: 'Product slug is required' };
    }

    const VALID_DIFFICULTY = ['easy', 'moderate', 'difficult'];
    if (specs.assemblyDifficulty && !VALID_DIFFICULTY.includes(specs.assemblyDifficulty)) {
      return { success: false, error: 'assemblyDifficulty must be easy, moderate, or difficult' };
    }

    // Check if specs already exist for this slug
    const existing = await wixData.query('ProductSpecs')
      .eq('slug', slug)
      .limit(1)
      .find();

    const record = {
      slug,
      materials: specs.materials ? sanitize(specs.materials, 500) : null,
      weightCapacity: typeof specs.weightCapacity === 'number' ? specs.weightCapacity : null,
      assemblyDifficulty: specs.assemblyDifficulty || null,
      assemblyNotes: specs.assemblyNotes ? sanitize(specs.assemblyNotes, 1000) : null,
      assemblyVideoUrl: specs.assemblyVideoUrl ? sanitize(specs.assemblyVideoUrl, 500) : null,
      careGuide: specs.careGuide ? sanitize(specs.careGuide, 1000) : null,
      warranty: specs.warranty ? sanitize(specs.warranty, 500) : null,
      madeIn: specs.madeIn ? sanitize(specs.madeIn, 100) : null,
      dimensions: specs.dimensions ? JSON.stringify(specs.dimensions) : null,
      features: Array.isArray(specs.features) ? JSON.stringify(specs.features) : null,
    };

    let saved;
    if (existing.items.length > 0) {
      record._id = existing.items[0]._id;
      saved = await wixData.update('ProductSpecs', record);
    } else {
      saved = await wixData.insert('ProductSpecs', record);
    }

    return {
      success: true,
      data: {
        _id: saved._id,
        slug: saved.slug,
        materials: saved.materials,
        weightCapacity: saved.weightCapacity,
        assemblyDifficulty: saved.assemblyDifficulty,
        warranty: saved.warranty,
        madeIn: saved.madeIn,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to save product specs' };
  }
});
