/**
 * @module contentImport
 * @description CMS content import service for non-product data.
 * Imports FAQ, shipping info, about page content, and category
 * descriptions into their respective CMS collections.
 * Supports dry-run preview, validation, and upsert logic.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *   FAQ - Frequently asked questions
 *     question (Text, indexed) - The question text
 *     answer (Text) - The answer text
 *     category (Text, indexed) - FAQ category (e.g., "Ordering & Shipping")
 *     sortOrder (Number) - Display order within category
 *
 *   ShippingInfo - Shipping methods and policies
 *     name (Text, indexed) - Method name
 *     description (Text) - Method description
 *     price (Number) - Cost (0 for free)
 *     timeline (Text) - Delivery timeline
 *     area (Text) - Service area
 *     freeThreshold (Number) - Order amount for free shipping
 *
 *   AboutContent - About page content sections
 *     sectionKey (Text, indexed) - Unique section identifier
 *     title (Text) - Section heading
 *     content (Text) - Section body text
 *     sortOrder (Number) - Display order
 *
 *   CategoryDescriptions - Category page content
 *     slug (Text, indexed) - Category slug
 *     title (Text) - Category display name
 *     heroText (Text) - Hero section headline
 *     description (Text) - Category description
 *     seoTitle (Text) - SEO page title
 *     seoDescription (Text) - SEO meta description
 *     productCount (Number) - Number of products
 *     priceRangeMin (Number) - Lowest price in category
 *     priceRangeMax (Number) - Highest price in category
 *
 *   ContentImports - Import history
 *     importId (Text, indexed) - Unique import identifier
 *     contentType (Text, indexed) - 'faq'|'shipping'|'about'|'categories'
 *     status (Text) - 'completed'|'failed'
 *     itemCount (Number) - Items imported
 *     dryRun (Boolean) - Whether this was a dry run
 *     completedAt (Date) - When import finished
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_ITEMS = 500;

const VALID_CONTENT_TYPES = ['faq', 'shipping', 'about', 'categories'];

const VALID_FAQ_CATEGORIES = [
  'Ordering & Shipping', 'Futon Frames', 'Mattresses', 'Platform Beds',
  'Murphy Cabinet Beds', 'Care & Maintenance', 'Returns & Warranty',
];

// ── Helpers ──────────────────────────────────────────────────────────

function generateImportId() {
  return `cimp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validateFaqItem(item, index) {
  const errors = [];
  if (!item.question || typeof item.question !== 'string' || item.question.trim().length === 0) {
    errors.push({ row: index, field: 'question', error: 'Question is required' });
  }
  if (!item.answer || typeof item.answer !== 'string' || item.answer.trim().length === 0) {
    errors.push({ row: index, field: 'answer', error: 'Answer is required' });
  }
  if (item.category && !VALID_FAQ_CATEGORIES.includes(item.category)) {
    errors.push({ row: index, field: 'category', error: `Invalid FAQ category: ${item.category}` });
  }
  return errors;
}

function validateShippingItem(item, index) {
  const errors = [];
  if (!item.name || typeof item.name !== 'string') {
    errors.push({ row: index, field: 'name', error: 'Shipping method name is required' });
  }
  if (item.price != null && (typeof item.price !== 'number' || item.price < 0)) {
    errors.push({ row: index, field: 'price', error: 'Price must be a non-negative number' });
  }
  return errors;
}

function validateAboutItem(item, index) {
  const errors = [];
  if (!item.sectionKey || typeof item.sectionKey !== 'string') {
    errors.push({ row: index, field: 'sectionKey', error: 'Section key is required' });
  }
  if (!item.title || typeof item.title !== 'string') {
    errors.push({ row: index, field: 'title', error: 'Title is required' });
  }
  return errors;
}

function validateCategoryItem(item, index) {
  const errors = [];
  if (!item.slug || typeof item.slug !== 'string') {
    errors.push({ row: index, field: 'slug', error: 'Category slug is required' });
  }
  if (!item.title || typeof item.title !== 'string') {
    errors.push({ row: index, field: 'title', error: 'Category title is required' });
  }
  return errors;
}

// ── importFAQ ────────────────────────────────────────────────────────

/**
 * Import FAQ entries from structured JSON.
 * Input format: { categories: [{ title, faqs: [{ question, answer }] }] }
 * @param {Object} data - FAQ data with categories array
 * @param {Object} opts - { dryRun: boolean }
 */
export const importFAQ = webMethod(Permissions.Admin, async (data, opts = {}) => {
  try {
    if (!data || !Array.isArray(data.categories)) {
      return { success: false, error: 'Data must have a categories array' };
    }

    const dryRun = opts.dryRun === true;
    const importId = generateImportId();
    const allErrors = [];
    const items = [];
    let sortOrder = 0;

    for (const cat of data.categories) {
      if (!cat.title || !Array.isArray(cat.faqs)) continue;
      for (const faq of cat.faqs) {
        const item = { ...faq, category: cat.title, sortOrder: sortOrder++ };
        const itemErrors = validateFaqItem(item, items.length);
        allErrors.push(...itemErrors);
        items.push(item);
      }
    }

    if (items.length > MAX_ITEMS) {
      return { success: false, error: `Exceeds maximum of ${MAX_ITEMS} items` };
    }

    if (dryRun) {
      return {
        success: true,
        data: {
          importId, dryRun: true, contentType: 'faq',
          totalItems: items.length,
          validItems: items.length - new Set(allErrors.map(e => e.row)).size,
          errors: allErrors,
          categoryBreakdown: data.categories.map(c => ({ title: c.title, count: c.faqs.length })),
        },
      };
    }

    if (allErrors.length > 0) {
      return { success: false, error: 'Validation failed', data: { errors: allErrors } };
    }

    let successCount = 0;
    for (const item of items) {
      const sanitized = {
        question: sanitize(item.question, MAX_TEXT_LENGTH),
        answer: sanitize(item.answer, MAX_TEXT_LENGTH),
        category: sanitize(item.category, MAX_TITLE_LENGTH),
        sortOrder: item.sortOrder,
      };

      // Upsert by question text
      const existing = await wixData.query('FAQ')
        .eq('question', sanitized.question)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        await wixData.update('FAQ', { ...existing.items[0], ...sanitized });
      } else {
        await wixData.insert('FAQ', sanitized);
      }
      successCount++;
    }

    await wixData.insert('ContentImports', {
      importId, contentType: 'faq', status: 'completed',
      itemCount: successCount, dryRun: false, completedAt: new Date(),
    });

    return { success: true, data: { importId, contentType: 'faq', itemCount: successCount } };
  } catch (err) {
    return { success: false, error: 'FAQ import failed' };
  }
});

// ── importShippingInfo ───────────────────────────────────────────────

/**
 * Import shipping methods and policies.
 * Input format: { shippingPolicy: { methods: [{ name, description, price, timeline, area }] } }
 * @param {Object} data - Shipping info data
 * @param {Object} opts - { dryRun: boolean }
 */
export const importShippingInfo = webMethod(Permissions.Admin, async (data, opts = {}) => {
  try {
    if (!data || !data.shippingPolicy || !Array.isArray(data.shippingPolicy.methods)) {
      return { success: false, error: 'Data must have shippingPolicy.methods array' };
    }

    const dryRun = opts.dryRun === true;
    const importId = generateImportId();
    const methods = data.shippingPolicy.methods;
    const allErrors = [];

    for (let i = 0; i < methods.length; i++) {
      const itemErrors = validateShippingItem(methods[i], i);
      allErrors.push(...itemErrors);
    }

    if (dryRun) {
      return {
        success: true,
        data: {
          importId, dryRun: true, contentType: 'shipping',
          totalItems: methods.length,
          validItems: methods.length - new Set(allErrors.map(e => e.row)).size,
          errors: allErrors,
        },
      };
    }

    if (allErrors.length > 0) {
      return { success: false, error: 'Validation failed', data: { errors: allErrors } };
    }

    let successCount = 0;
    for (const method of methods) {
      const sanitized = {
        name: sanitize(method.name, MAX_TITLE_LENGTH),
        description: sanitize(method.description || '', MAX_TEXT_LENGTH),
        price: method.price || 0,
        timeline: sanitize(method.timeline || '', MAX_TITLE_LENGTH),
        area: sanitize(method.area || '', MAX_TITLE_LENGTH),
        freeThreshold: method.freeThreshold || null,
        note: sanitize(method.note || '', MAX_TEXT_LENGTH),
      };

      const existing = await wixData.query('ShippingInfo')
        .eq('name', sanitized.name)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        await wixData.update('ShippingInfo', { ...existing.items[0], ...sanitized });
      } else {
        await wixData.insert('ShippingInfo', sanitized);
      }
      successCount++;
    }

    // Also store the policy overview and delivery schedule
    if (data.shippingPolicy.overview) {
      const overviewItem = {
        name: '__policy_overview',
        description: sanitize(data.shippingPolicy.overview, MAX_TEXT_LENGTH),
        price: 0,
      };
      const existingOverview = await wixData.query('ShippingInfo')
        .eq('name', '__policy_overview')
        .limit(1)
        .find();
      if (existingOverview.items.length > 0) {
        await wixData.update('ShippingInfo', { ...existingOverview.items[0], ...overviewItem });
      } else {
        await wixData.insert('ShippingInfo', overviewItem);
      }
    }

    await wixData.insert('ContentImports', {
      importId, contentType: 'shipping', status: 'completed',
      itemCount: successCount, dryRun: false, completedAt: new Date(),
    });

    return { success: true, data: { importId, contentType: 'shipping', itemCount: successCount } };
  } catch (err) {
    return { success: false, error: 'Shipping info import failed' };
  }
});

// ── importAboutContent ───────────────────────────────────────────────

/**
 * Import about page content sections.
 * Input format: { about: { companyName, tagline, description, values: [{ title, description }] } }
 * @param {Object} data - About page data
 * @param {Object} opts - { dryRun: boolean }
 */
export const importAboutContent = webMethod(Permissions.Admin, async (data, opts = {}) => {
  try {
    if (!data || !data.about) {
      return { success: false, error: 'Data must have about object' };
    }

    const dryRun = opts.dryRun === true;
    const importId = generateImportId();
    const about = data.about;
    const items = [];
    let order = 0;

    // Main company info
    items.push({
      sectionKey: 'company-info',
      title: about.companyName || 'Carolina Futons',
      content: JSON.stringify({
        tagline: about.tagline || '',
        description: about.description || '',
        location: about.location || {},
      }),
      sortOrder: order++,
    });

    // Values
    if (Array.isArray(about.values)) {
      for (const val of about.values) {
        items.push({
          sectionKey: `value-${val.title.toLowerCase().replace(/\s+/g, '-')}`,
          title: val.title,
          content: val.description || '',
          sortOrder: order++,
        });
      }
    }

    // Manufacturers
    if (Array.isArray(about.manufacturers)) {
      for (const mfr of about.manufacturers) {
        items.push({
          sectionKey: `manufacturer-${mfr.name.toLowerCase().replace(/\s+/g, '-')}`,
          title: mfr.name,
          content: JSON.stringify(mfr),
          sortOrder: order++,
        });
      }
    }

    const allErrors = [];
    for (let i = 0; i < items.length; i++) {
      const itemErrors = validateAboutItem(items[i], i);
      allErrors.push(...itemErrors);
    }

    if (dryRun) {
      return {
        success: true,
        data: {
          importId, dryRun: true, contentType: 'about',
          totalItems: items.length,
          validItems: items.length - new Set(allErrors.map(e => e.row)).size,
          errors: allErrors,
          sections: items.map(i => i.sectionKey),
        },
      };
    }

    if (allErrors.length > 0) {
      return { success: false, error: 'Validation failed', data: { errors: allErrors } };
    }

    let successCount = 0;
    for (const item of items) {
      const sanitized = {
        sectionKey: sanitize(item.sectionKey, MAX_TITLE_LENGTH),
        title: sanitize(item.title, MAX_TITLE_LENGTH),
        content: sanitize(item.content, MAX_TEXT_LENGTH),
        sortOrder: item.sortOrder,
      };

      const existing = await wixData.query('AboutContent')
        .eq('sectionKey', sanitized.sectionKey)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        await wixData.update('AboutContent', { ...existing.items[0], ...sanitized });
      } else {
        await wixData.insert('AboutContent', sanitized);
      }
      successCount++;
    }

    await wixData.insert('ContentImports', {
      importId, contentType: 'about', status: 'completed',
      itemCount: successCount, dryRun: false, completedAt: new Date(),
    });

    return { success: true, data: { importId, contentType: 'about', itemCount: successCount } };
  } catch (err) {
    return { success: false, error: 'About content import failed' };
  }
});

// ── importCategoryDescriptions ───────────────────────────────────────

/**
 * Import category page descriptions and SEO content.
 * Input format: { categories: [{ slug, title, heroText, description, seoTitle, seoDescription, productCount, priceRange }] }
 * @param {Object} data - Category descriptions data
 * @param {Object} opts - { dryRun: boolean }
 */
export const importCategoryDescriptions = webMethod(Permissions.Admin, async (data, opts = {}) => {
  try {
    if (!data || !Array.isArray(data.categories)) {
      return { success: false, error: 'Data must have categories array' };
    }

    const dryRun = opts.dryRun === true;
    const importId = generateImportId();
    const categories = data.categories;
    const allErrors = [];

    for (let i = 0; i < categories.length; i++) {
      const itemErrors = validateCategoryItem(categories[i], i);
      allErrors.push(...itemErrors);
    }

    if (dryRun) {
      return {
        success: true,
        data: {
          importId, dryRun: true, contentType: 'categories',
          totalItems: categories.length,
          validItems: categories.length - new Set(allErrors.map(e => e.row)).size,
          errors: allErrors,
          slugs: categories.map(c => c.slug),
        },
      };
    }

    if (allErrors.length > 0) {
      return { success: false, error: 'Validation failed', data: { errors: allErrors } };
    }

    let successCount = 0;
    for (const cat of categories) {
      const sanitized = {
        slug: sanitize(cat.slug, MAX_TITLE_LENGTH),
        title: sanitize(cat.title, MAX_TITLE_LENGTH),
        heroText: sanitize(cat.heroText || '', MAX_TEXT_LENGTH),
        description: sanitize(cat.description || '', MAX_TEXT_LENGTH),
        seoTitle: sanitize(cat.seoTitle || '', MAX_TITLE_LENGTH),
        seoDescription: sanitize(cat.seoDescription || '', MAX_TEXT_LENGTH),
        productCount: cat.productCount || 0,
        priceRangeMin: cat.priceRange ? cat.priceRange.min : 0,
        priceRangeMax: cat.priceRange ? cat.priceRange.max : 0,
      };

      const existing = await wixData.query('CategoryDescriptions')
        .eq('slug', sanitized.slug)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        await wixData.update('CategoryDescriptions', { ...existing.items[0], ...sanitized });
      } else {
        await wixData.insert('CategoryDescriptions', sanitized);
      }
      successCount++;
    }

    await wixData.insert('ContentImports', {
      importId, contentType: 'categories', status: 'completed',
      itemCount: successCount, dryRun: false, completedAt: new Date(),
    });

    return { success: true, data: { importId, contentType: 'categories', itemCount: successCount } };
  } catch (err) {
    return { success: false, error: 'Category descriptions import failed' };
  }
});

// ── importAllContent ─────────────────────────────────────────────────

/**
 * Import all content types at once. Runs each importer in sequence.
 * @param {Object} data - { faq, shipping, about, categories } objects
 * @param {Object} opts - { dryRun: boolean }
 */
export const importAllContent = webMethod(Permissions.Admin, async (data, opts = {}) => {
  try {
    const results = {};
    const dryRun = opts.dryRun === true;

    if ('faq' in data) {
      results.faq = await importFAQ(data.faq, { dryRun });
    }
    if ('shipping' in data) {
      results.shipping = await importShippingInfo(data.shipping, { dryRun });
    }
    if ('about' in data) {
      results.about = await importAboutContent(data.about, { dryRun });
    }
    if ('categories' in data) {
      results.categories = await importCategoryDescriptions(data.categories, { dryRun });
    }

    const allSuccess = Object.values(results).every(r => r.success);

    return {
      success: allSuccess,
      data: {
        dryRun,
        contentTypes: Object.keys(results),
        results,
      },
    };
  } catch (err) {
    return { success: false, error: 'Bulk content import failed' };
  }
});

// ── getContentImportHistory ──────────────────────────────────────────

/**
 * Returns content import history.
 * @param {Object} opts - { contentType, page, pageSize }
 */
export const getContentImportHistory = webMethod(Permissions.Admin, async (opts = {}) => {
  try {
    const page = Math.max(1, Math.round(Number(opts.page) || 1));
    const pageSize = Math.min(50, Math.max(1, Math.round(Number(opts.pageSize) || 10)));

    let query = wixData.query('ContentImports')
      .descending('completedAt');

    if (opts.contentType && VALID_CONTENT_TYPES.includes(opts.contentType)) {
      query = query.eq('contentType', opts.contentType);
    }

    const result = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .find();

    return {
      success: true,
      data: {
        imports: result.items.map(i => ({
          importId: i.importId,
          contentType: i.contentType,
          status: i.status,
          itemCount: i.itemCount,
          dryRun: i.dryRun || false,
          completedAt: i.completedAt,
        })),
        page,
        pageSize,
        totalCount: result.totalCount,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load import history' };
  }
});
