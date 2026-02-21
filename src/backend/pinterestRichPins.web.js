/**
 * @module pinterestRichPins
 * @description Pinterest Rich Pin support: Open Graph and product pin metadata.
 * Generates OG meta tags for product pages, buying guide pages, and category
 * pages. Supports Pinterest Product Pins (price, availability, buy link),
 * Article Pins (for guides), and validation helpers.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize, validateSlug, validateId } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const PINTEREST_DOMAIN = 'carolinafutons';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;
const CURRENCY = 'USD';

// ── Product Pin Data ──────────────────────────────────────────────────

/**
 * Generate Pinterest Product Rich Pin metadata for a product.
 * Returns Open Graph tags and Pinterest-specific product attributes.
 *
 * @param {Object} product
 * @param {string} product.name - Product name.
 * @param {string} product.slug - Product URL slug.
 * @param {string} [product.description] - Product description.
 * @param {string} [product.image] - Primary product image URL.
 * @param {number} product.price - Product price.
 * @param {number} [product.salePrice] - Sale price if on sale.
 * @param {string} [product.currency] - Currency code (default USD).
 * @param {boolean} [product.inStock] - Whether product is in stock.
 * @param {string} [product.brand] - Brand name.
 * @param {string} [product.category] - Product category.
 * @param {string} [product.sku] - Product SKU.
 * @returns {Promise<{success: boolean, meta: Object}>}
 */
export const getProductPinData = webMethod(
  Permissions.Anyone,
  async (product) => {
    try {
      if (!product || !product.name) {
        return { success: false, error: 'Product data with name is required.', meta: null };
      }

      const name = sanitize(product.name, 200);
      const slug = validateSlug(product.slug) || sanitize(product.slug || '', 100);
      const description = sanitize(product.description || '', 500);
      const image = product.image || DEFAULT_IMAGE;
      const price = Math.max(0, Number(product.price) || 0);
      const salePrice = product.salePrice ? Math.max(0, Number(product.salePrice)) : null;
      const currency = sanitize(product.currency || CURRENCY, 3).toUpperCase() || CURRENCY;
      const inStock = product.inStock !== false;
      const brand = sanitize(product.brand || SITE_NAME, 100);
      const category = sanitize(product.category || '', 100);
      const sku = sanitize(product.sku || '', 50);

      const productUrl = slug ? `${SITE_URL}/product-page/${slug}` : SITE_URL;

      const meta = {
        // Core Open Graph
        'og:type': 'product',
        'og:title': name,
        'og:description': description || `${name} — Shop at ${SITE_NAME}`,
        'og:url': productUrl,
        'og:image': image,
        'og:site_name': SITE_NAME,

        // Product-specific OG
        'product:price:amount': price.toFixed(2),
        'product:price:currency': currency,
        'product:availability': inStock ? 'instock' : 'oos',
        'product:brand': brand,
        'product:retailer_item_id': sku,

        // Pinterest-specific
        'pinterest:description': description || `${name} from ${SITE_NAME}`,
        'pinterest-rich-pin': 'true',
      };

      if (salePrice && salePrice < price) {
        meta['product:sale_price:amount'] = salePrice.toFixed(2);
        meta['product:sale_price:currency'] = currency;
      }

      if (category) {
        meta['product:category'] = category;
      }

      return { success: true, meta };
    } catch (err) {
      console.error('[pinterestRichPins] Error generating product pin data:', err);
      return { success: false, error: 'Failed to generate product pin data.', meta: null };
    }
  }
);

// ── Guide Pin Data ────────────────────────────────────────────────────

/**
 * Generate Pinterest Article Rich Pin metadata for a buying guide.
 * Returns Open Graph tags optimized for Pinterest Article Pins.
 *
 * @param {Object} guide
 * @param {string} guide.slug - Guide URL slug.
 * @param {string} guide.title - Guide title.
 * @param {string} [guide.description] - Guide description.
 * @param {string} [guide.heroImage] - Guide hero image URL.
 * @param {string} [guide.publishDate] - ISO date published.
 * @param {string} [guide.author] - Author name.
 * @returns {Promise<{success: boolean, meta: Object}>}
 */
export const getGuidePinData = webMethod(
  Permissions.Anyone,
  async (guide) => {
    try {
      if (!guide || !guide.title) {
        return { success: false, error: 'Guide data with title is required.', meta: null };
      }

      const title = sanitize(guide.title, 200);
      const slug = validateSlug(guide.slug) || sanitize(guide.slug || '', 100);
      const description = sanitize(guide.description || '', 500);
      const heroImage = guide.heroImage || DEFAULT_IMAGE;
      const publishDate = sanitize(guide.publishDate || '', 20);
      const author = sanitize(guide.author || SITE_NAME, 100);

      const guideUrl = slug ? `${SITE_URL}/buying-guides/${slug}` : `${SITE_URL}/buying-guides`;

      const meta = {
        // Core Open Graph
        'og:type': 'article',
        'og:title': title,
        'og:description': description || `${title} — Expert guide from ${SITE_NAME}`,
        'og:url': guideUrl,
        'og:image': heroImage,
        'og:site_name': SITE_NAME,

        // Article-specific OG
        'article:author': author,
        'article:publisher': SITE_URL,

        // Pinterest-specific
        'pinterest:description': description || title,
        'pinterest-rich-pin': 'true',
      };

      if (publishDate) {
        meta['article:published_time'] = publishDate;
      }

      return { success: true, meta };
    } catch (err) {
      console.error('[pinterestRichPins] Error generating guide pin data:', err);
      return { success: false, error: 'Failed to generate guide pin data.', meta: null };
    }
  }
);

// ── Meta Tag HTML Generator ───────────────────────────────────────────

/**
 * Convert a meta object into HTML meta tag strings for page head injection.
 * Returns an array of <meta> tag strings ready for $w('html').postMessage or
 * Wix SEO API setMetaTags.
 *
 * @param {Object} meta - Key-value pairs of meta tag properties.
 * @returns {Promise<{success: boolean, tags: string[], tagString: string}>}
 */
export const getPinterestMetaTags = webMethod(
  Permissions.Anyone,
  async (meta) => {
    try {
      if (!meta || typeof meta !== 'object') {
        return { success: false, error: 'Meta object is required.', tags: [], tagString: '' };
      }

      const tags = [];
      for (const [property, content] of Object.entries(meta)) {
        if (content === null || content === undefined || content === '') continue;
        const safeProperty = sanitize(String(property), 100);
        const safeContent = sanitize(String(content), 1000);
        tags.push(`<meta property="${safeProperty}" content="${safeContent}" />`);
      }

      return {
        success: true,
        tags,
        tagString: tags.join('\n'),
      };
    } catch (err) {
      console.error('[pinterestRichPins] Error generating meta tags:', err);
      return { success: false, error: 'Failed to generate meta tags.', tags: [], tagString: '' };
    }
  }
);

// ── Pin Markup Validator ──────────────────────────────────────────────

/**
 * Validate that a meta object has the required fields for Pinterest Rich Pins.
 * Checks for required OG tags and Pinterest-specific attributes.
 *
 * @param {Object} meta - Meta object to validate.
 * @param {string} [type='product'] - Pin type: 'product' or 'article'.
 * @returns {Promise<{success: boolean, valid: boolean, errors: string[]}>}
 */
export const validatePinMarkup = webMethod(
  Permissions.Anyone,
  async (meta, type = 'product') => {
    try {
      if (!meta || typeof meta !== 'object') {
        return { success: false, error: 'Meta object is required.', valid: false, errors: [] };
      }

      const errors = [];
      const pinType = sanitize(type, 20);

      // Required for all pin types
      const requiredBase = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:site_name'];
      for (const field of requiredBase) {
        if (!meta[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }

      // Product-specific requirements
      if (pinType === 'product') {
        const requiredProduct = ['product:price:amount', 'product:price:currency', 'product:availability'];
        for (const field of requiredProduct) {
          if (!meta[field]) {
            errors.push(`Missing required product field: ${field}`);
          }
        }

        if (meta['og:type'] !== 'product') {
          errors.push('og:type must be "product" for product pins');
        }

        const price = parseFloat(meta['product:price:amount']);
        if (isNaN(price) || price <= 0) {
          errors.push('product:price:amount must be a positive number');
        }

        const validAvailability = ['instock', 'oos', 'preorder'];
        if (meta['product:availability'] && !validAvailability.includes(meta['product:availability'])) {
          errors.push('product:availability must be instock, oos, or preorder');
        }
      }

      // Article-specific requirements
      if (pinType === 'article') {
        if (meta['og:type'] !== 'article') {
          errors.push('og:type must be "article" for article pins');
        }
        if (!meta['article:author']) {
          errors.push('Missing required article field: article:author');
        }
      }

      // Image validation
      if (meta['og:image']) {
        const imageUrl = meta['og:image'];
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          errors.push('og:image must be an absolute URL');
        }
      }

      return {
        success: true,
        valid: errors.length === 0,
        errors,
      };
    } catch (err) {
      console.error('[pinterestRichPins] Error validating pin markup:', err);
      return { success: false, error: 'Failed to validate markup.', valid: false, errors: [] };
    }
  }
);
