/**
 * @module pinterestCatalogSync
 * @description Pinterest catalog validation, board mapping, and pin content generation.
 * Validates product data quality for the Pinterest catalog feed, maps products to
 * Pinterest boards per the social media strategy, and generates optimized pin content.
 *
 * Builds on pinterestRichPins.web.js (meta tags) and http-functions.js (feed endpoint).
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const FEED_URL = `${SITE_URL}/_functions/pinterestProductFeed`;
const MAX_TITLE_LEN = 150;
const MAX_DESC_LEN = 500;

// ── Board Structure (per SOCIAL-MEDIA-STRATEGY.md) ──────────────────

const BOARDS = [
  { name: 'Futon Living Rooms', contentType: 'Styled futon setups, customer photos', pinFrequency: '3-4/week' },
  { name: 'Small Space Solutions', contentType: 'Studio/apartment layouts with futons', pinFrequency: '2-3/week' },
  { name: 'Murphy & Cabinet Beds', contentType: 'Murphy bed transformations, before/after', pinFrequency: '2-3/week' },
  { name: 'Platform Bed Inspiration', contentType: 'Platform bed room setups', pinFrequency: '2-3/week' },
  { name: 'Handcrafted & Unfinished', contentType: 'DIY finish ideas, wood craftsmanship', pinFrequency: '1-2/week' },
  { name: 'Sale & Clearance', contentType: 'Current deals, limited-time offers', pinFrequency: '2-3/week' },
  { name: 'Customer Showcase', contentType: 'UGC repins from customers', pinFrequency: '1-2/week' },
];

// Collection → board mapping rules (first match wins)
const BOARD_RULES = [
  { match: c => c.includes('sales') || c.includes('sale') || c.includes('clearance'), board: 'Sale & Clearance', needsDiscount: true },
  { match: c => c.includes('murphy') || c.includes('cabinet-bed'), board: 'Murphy & Cabinet Beds' },
  { match: c => c.includes('platform'), board: 'Platform Bed Inspiration' },
  { match: c => c.includes('unfinished'), board: 'Handcrafted & Unfinished' },
  { match: c => c.includes('mattress'), board: 'Small Space Solutions' },
  { match: c => c.includes('casegood') || c.includes('accessor'), board: 'Small Space Solutions' },
  { match: c => c.includes('futon') || c.includes('wall-hugger'), board: 'Futon Living Rooms' },
];

// Category → hashtag mapping
const CATEGORY_HASHTAGS = {
  'futon-frames': ['#FutonLiving', '#FutonFrame'],
  'wall-huggers': ['#FutonLiving', '#WallHugger'],
  'mattresses': ['#FutonMattress', '#SmallSpaceLiving'],
  'murphy-cabinet-beds': ['#MurphyBed', '#SpaceSaving'],
  'platform-beds': ['#PlatformBed', '#BedroomDesign'],
  'unfinished-wood': ['#DIYFurniture', '#UnfinishedWood'],
  'casegoods-accessories': ['#FurnitureAccessories', '#HomeDecor'],
  'sales': ['#FurnitureSale', '#DealAlert'],
};

const BASE_HASHTAGS = ['#CarolinaFutons', '#HandcraftedFurniture', '#NCFurniture'];

// ── validateCatalogProduct ───────────────────────────────────────────

/**
 * Validate a single product meets Pinterest catalog requirements.
 * Returns issues (blockers) and warnings (non-blocking quality concerns).
 *
 * @param {Object} product - Wix product object.
 * @returns {Promise<{success: boolean, valid: boolean, issues: Array, warnings: Array, sanitizedName: string}>}
 */
export const validateCatalogProduct = webMethod(
  Permissions.Anyone,
  async (product) => {
    try {
      if (!product || typeof product !== 'object') {
        return { success: false, error: 'Product object is required.', valid: false, issues: [], warnings: [] };
      }

      const issues = [];
      const warnings = [];
      const name = sanitize(product.name || '', MAX_TITLE_LEN);

      // Required fields — issues (blockers)
      if (!name) {
        issues.push({ field: 'name', type: 'required', message: 'Product name is required.' });
      }

      if (!product.slug) {
        issues.push({ field: 'slug', type: 'required', message: 'Product slug is required for URL generation.' });
      }

      const price = Number(product.price);
      if (!price || price <= 0) {
        issues.push({ field: 'price', type: 'required', message: 'Product price must be a positive number.' });
      }

      // Optional fields — warnings (quality concerns)
      if (!product.description) {
        warnings.push({ field: 'description', type: 'missing', message: 'Missing description — pin quality reduced.' });
      } else if (product.description.length > MAX_DESC_LEN) {
        warnings.push({ field: 'description', type: 'length', message: `Description exceeds ${MAX_DESC_LEN} chars — will be truncated.` });
      }

      if (!product.mainMedia) {
        warnings.push({ field: 'mainMedia', type: 'missing', message: 'Missing product image — default image will be used.' });
      } else if (typeof product.mainMedia === 'string' && !product.mainMedia.startsWith('http')) {
        warnings.push({ field: 'mainMedia', type: 'format', message: 'Image URL should be absolute (https://).' });
      }

      if (product.name && product.name.length > MAX_TITLE_LEN) {
        warnings.push({ field: 'name', type: 'length', message: `Title exceeds ${MAX_TITLE_LEN} chars — may be truncated on Pinterest.` });
      }

      return {
        success: true,
        valid: issues.length === 0,
        issues,
        warnings,
        sanitizedName: name,
      };
    } catch (err) {
      console.error('[pinterestCatalogSync] validateCatalogProduct error:', err);
      return { success: false, error: 'Validation failed.', valid: false, issues: [], warnings: [] };
    }
  }
);

// ── auditCatalog ─────────────────────────────────────────────────────

/**
 * Audit all products in the catalog for Pinterest feed readiness.
 * Queries Stores/Products and validates each one.
 *
 * @returns {Promise<{success: boolean, totalProducts: number, validCount: number, invalidCount: number, warningCount: number, issues: Array}>}
 */
export const auditCatalog = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const PAGE_SIZE = 1000;
      let allProducts = [];
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const result = await wixData.query('Stores/Products')
          .limit(PAGE_SIZE)
          .skip(skip)
          .find();
        allProducts = allProducts.concat(result.items);
        skip += PAGE_SIZE;
        hasMore = result.items.length === PAGE_SIZE;
      }

      let validCount = 0;
      let invalidCount = 0;
      let warningCount = 0;
      const issues = [];

      for (const product of allProducts) {
        const validation = await validateCatalogProduct(product);

        if (validation.valid) {
          validCount++;
        } else {
          invalidCount++;
          for (const issue of validation.issues) {
            issues.push({
              productId: product._id,
              productName: sanitize(product.name || '', 100),
              ...issue,
            });
          }
        }

        warningCount += (validation.warnings || []).length;
      }

      return {
        success: true,
        totalProducts: allProducts.length,
        validCount,
        invalidCount,
        warningCount,
        issues,
      };
    } catch (err) {
      console.error('[pinterestCatalogSync] auditCatalog error:', err);
      return {
        success: false,
        error: 'Catalog audit failed.',
        totalProducts: 0,
        validCount: 0,
        invalidCount: 0,
        warningCount: 0,
        issues: [],
      };
    }
  }
);

// ── getCatalogSyncStatus ─────────────────────────────────────────────

/**
 * Get Pinterest catalog feed health status.
 * Returns feed URL, product count, and health score.
 *
 * @returns {Promise<{success: boolean, feedUrl: string, feedFormat: string, productCount: number, healthScore: number}>}
 */
export const getCatalogSyncStatus = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const audit = await auditCatalog();

      const healthScore = audit.totalProducts > 0
        ? Math.round((audit.validCount / audit.totalProducts) * 100)
        : 0;

      return {
        success: true,
        feedUrl: FEED_URL,
        feedFormat: 'TSV',
        productCount: audit.totalProducts,
        validCount: audit.validCount,
        invalidCount: audit.invalidCount,
        warningCount: audit.warningCount,
        healthScore,
        issues: audit.issues,
      };
    } catch (err) {
      console.error('[pinterestCatalogSync] getCatalogSyncStatus error:', err);
      return {
        success: false,
        error: 'Failed to get catalog sync status.',
        feedUrl: FEED_URL,
        feedFormat: 'TSV',
        productCount: 0,
        healthScore: 0,
      };
    }
  }
);

// ── mapProductToBoard ────────────────────────────────────────────────

/**
 * Map a product to the appropriate Pinterest board based on its collections.
 * Uses the board structure from SOCIAL-MEDIA-STRATEGY.md.
 *
 * @param {Object} product - Product with collections array.
 * @returns {Promise<{success: boolean, board: string}>}
 */
export const mapProductToBoard = webMethod(
  Permissions.Anyone,
  async (product) => {
    try {
      if (!product || typeof product !== 'object') {
        return { success: false, error: 'Product object is required.', board: null };
      }

      const collections = (product.collections || []).map(c =>
        (typeof c === 'string' ? c : c.id || '').toLowerCase()
      );

      // Check for sale items first (needs discountedPrice)
      if (product.discountedPrice && collections.some(c => c.includes('sale') || c.includes('clearance'))) {
        return { success: true, board: 'Sale & Clearance' };
      }

      // Match against board rules
      for (const rule of BOARD_RULES) {
        if (rule.needsDiscount) continue; // Skip sale rule — already handled above
        if (collections.some(rule.match)) {
          return { success: true, board: rule.board };
        }
      }

      // Default board
      return { success: true, board: 'Futon Living Rooms' };
    } catch (err) {
      console.error('[pinterestCatalogSync] mapProductToBoard error:', err);
      return { success: false, error: 'Board mapping failed.', board: null };
    }
  }
);

// ── generatePinContent ───────────────────────────────────────────────

/**
 * Generate optimized pin content for a product.
 * Includes title, description with price, hashtags, and UTM-tagged link.
 *
 * @param {Object} product - Wix product object.
 * @returns {Promise<{success: boolean, title: string, description: string, hashtags: string[], link: string}>}
 */
export const generatePinContent = webMethod(
  Permissions.Anyone,
  async (product) => {
    try {
      if (!product || !product.name) {
        return { success: false, error: 'Product with name is required.', title: '', description: '', hashtags: [], link: '' };
      }

      const name = sanitize(product.name, MAX_TITLE_LEN);
      const slug = sanitize(product.slug || '', 100);
      const rawDesc = sanitize(product.description || '', 300);
      const price = Number(product.price) || 0;
      const salePrice = product.discountedPrice ? Number(product.discountedPrice) : null;
      const collections = (product.collections || []).map(c =>
        (typeof c === 'string' ? c : c.id || '').toLowerCase()
      );

      // Title
      const title = name;

      // Price display
      const displayPrice = salePrice && salePrice < price
        ? `$${salePrice.toFixed(2)} (was $${price.toFixed(2)})`
        : `$${price.toFixed(2)}`;

      // Description — keyword-rich, includes price, brand
      const descParts = [
        `${name} — ${displayPrice} at ${SITE_NAME}.`,
      ];
      if (rawDesc) {
        descParts.push(rawDesc);
      }
      descParts.push(`Shop handcrafted furniture made in the USA.`);

      let description = descParts.join(' ');
      if (description.length > MAX_DESC_LEN) {
        description = description.slice(0, MAX_DESC_LEN - 3) + '...';
      }

      // Hashtags — category-specific + base
      const hashtags = [...BASE_HASHTAGS];
      for (const col of collections) {
        const catTags = CATEGORY_HASHTAGS[col];
        if (catTags) {
          for (const tag of catTags) {
            if (!hashtags.includes(tag)) {
              hashtags.push(tag);
            }
          }
        }
      }

      // UTM-tagged link (per SOCIAL-MEDIA-STRATEGY.md)
      const link = slug
        ? `${SITE_URL}/product-page/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=product`
        : `${SITE_URL}?utm_source=pinterest&utm_medium=social&utm_campaign=product`;

      return {
        success: true,
        title,
        description,
        hashtags,
        link,
      };
    } catch (err) {
      console.error('[pinterestCatalogSync] generatePinContent error:', err);
      return { success: false, error: 'Pin content generation failed.', title: '', description: '', hashtags: [], link: '' };
    }
  }
);

// ── getBoardStructure ────────────────────────────────────────────────

/**
 * Return the configured Pinterest board structure.
 *
 * @returns {Promise<{success: boolean, boards: Array}>}
 */
export const getBoardStructure = webMethod(
  Permissions.Anyone,
  async () => {
    return {
      success: true,
      boards: BOARDS.map(b => ({ ...b })),
    };
  }
);
