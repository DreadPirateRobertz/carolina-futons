/**
 * @module imageAltText
 * @description Generate SEO-friendly alt text for product images at runtime.
 * Uses product metadata (name, brand, category, variant) to build descriptive
 * alt text compliant with WCAG 2.1 AA and optimized for search engines.
 *
 * @requires wix-web-module
 *
 * @example
 * import { getProductAltText, getBatchAltText } from 'backend/imageAltText.web';
 * const alt = await getProductAltText({ name: 'Nomad Platform Bed', brand: 'KD Frames' }, 0);
 * // => "KD Frames Nomad Platform Bed - Main Product Image"
 */
import { Permissions, webMethod } from 'wix-web-module';

// ── Category display labels ─────────────────────────────────────────

const CATEGORY_LABELS = {
  'futon-frames': 'Futon Frame',
  'mattresses': 'Futon Mattress',
  'murphy-cabinet-beds': 'Murphy Cabinet Bed',
  'platform-beds': 'Platform Bed',
  'casegoods-accessories': 'Furniture Accessory',
  'wall-hugger-frames': 'Wall Hugger Futon Frame',
  'wall-huggers': 'Wall Hugger Futon Frame',
  'unfinished-wood': 'Unfinished Wood Furniture',
  'front-loading-nesting': 'Front-Loading Futon Frame',
  'covers': 'Futon Cover',
  'pillows': 'Pillow',
};

// ── Image position labels ───────────────────────────────────────────

const POSITION_LABELS = [
  'Main Product Image',
  'Alternate View',
  'Detail View',
  'Additional View',
];

// ── URL-based context detection ─────────────────────────────────────

function detectImageContext(url) {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  const fileName = lower.split('/').pop() || '';

  if (fileName.includes('lifestyle') || fileName.includes('room') || fileName.includes('scene')) {
    return 'Lifestyle Room Setting';
  }
  if (fileName.includes('detail') || fileName.includes('closeup') || fileName.includes('close_up')) {
    return 'Detail Close-up';
  }
  if (fileName.includes('dimension') || fileName.includes('spec')) {
    return 'Dimensions Diagram';
  }
  if (fileName.includes('trundle') || fileName.includes('drawer') || fileName.includes('storage')) {
    return 'With Storage Option';
  }
  if (fileName.includes('front')) return 'Front View';
  if (fileName.includes('side')) return 'Side View';
  if (fileName.includes('back') || fileName.includes('rear')) return 'Back View';
  if (fileName.includes('assembly')) return 'Assembly Reference';

  return null;
}

// ── Alt text generation ─────────────────────────────────────────────

/**
 * Build alt text from product metadata.
 * @param {Object} product - Product data object
 * @param {string} product.name - Product name
 * @param {string} [product.brand] - Brand/manufacturer name
 * @param {string[]} [product.collections] - Collection/category slugs
 * @param {Object} [product.options] - Selected variant options
 * @param {number} imageIndex - Image position (0 = main)
 * @param {string} [imageUrl] - Image URL for context detection
 * @returns {string} SEO-friendly alt text
 */
function buildAltText(product, imageIndex, imageUrl) {
  if (!product || !product.name) return 'Product image';

  const name = product.name;
  const brand = product.brand || '';
  const parts = [];

  // Brand prefix
  if (brand && !name.toLowerCase().startsWith(brand.toLowerCase())) {
    parts.push(brand);
  }

  // Product name
  parts.push(name);

  // Category suffix (if not redundant with name)
  const categorySlug = (product.collections || [])[0] || '';
  const categoryLabel = CATEGORY_LABELS[categorySlug] || '';
  if (categoryLabel && !name.toLowerCase().includes(categoryLabel.toLowerCase().split(' ')[0])) {
    parts.push(categoryLabel);
  }

  // Variant info
  if (product.options) {
    const variantParts = [];
    if (product.options.finish) variantParts.push(product.options.finish);
    if (product.options.size) variantParts.push(product.options.size);
    if (product.options.color) variantParts.push(product.options.color);
    if (variantParts.length > 0) {
      parts.push(`in ${variantParts.join(', ')}`);
    }
  }

  // Position / context suffix
  const urlContext = detectImageContext(imageUrl);
  if (urlContext) {
    parts.push(`- ${urlContext}`);
  } else if (imageIndex === 0) {
    parts.push(`- ${POSITION_LABELS[0]}`);
  } else if (imageIndex < POSITION_LABELS.length) {
    parts.push(`- ${POSITION_LABELS[imageIndex]}`);
  } else {
    parts.push(`- View ${imageIndex + 1}`);
  }

  return parts.join(' ');
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Generate alt text for a single product image.
 * @param {Object} product - Product data
 * @param {number} [imageIndex=0] - Image position
 * @param {string} [imageUrl] - Image URL for context hints
 * @returns {string} Generated alt text
 */
export const getProductAltText = webMethod(
  Permissions.Anyone,
  async (product, imageIndex = 0, imageUrl = '') => {
    try {
      return buildAltText(product, imageIndex, imageUrl);
    } catch {
      return product?.name || 'Product image';
    }
  }
);

/**
 * Generate alt text for all images in a product's media array.
 * @param {Object} product - Product data with media array
 * @returns {string[]} Array of alt text strings
 */
export const getBatchAltText = webMethod(
  Permissions.Anyone,
  async (product) => {
    try {
      if (!product) return [];
      const media = product.mediaItems || product.media || [];
      return media.map((m, i) =>
        buildAltText(product, i, m.src || m.url || m.image || '')
      );
    } catch {
      return [];
    }
  }
);

// Exported for testing
export { buildAltText, detectImageContext, CATEGORY_LABELS, POSITION_LABELS };
