/**
 * @module comparePageHelpers
 * Compare Page — testable business logic for CF-g0fo
 * All $w() wiring is in "Compare Page.js"; this module is pure functions only.
 */

import { business } from 'public/sharedTokens.js';

// ── XSS protection ───────────────────────────────────────────────────────────

/**
 * Escape HTML special characters to prevent XSS injection.
 * Applied to all attribute values before they are placed into .html strings.
 * @param {string} str
 * @returns {string}
 */
export function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── S1: URL param parsing ─────────────────────────────────────────────────────

/**
 * Parse ?ids= query param into an array of up to 4 product IDs.
 * @param {Object} query - wixLocation.query
 * @returns {string[]}
 */
export function parseProductIds(query) {
  const raw = query?.ids;
  if (!raw) return [];
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
    .slice(0, 4);
}

/**
 * Returns true when the ID list is too short to compare (< 2).
 * @param {string[]} ids
 * @returns {boolean}
 */
export function shouldShowEmpty(ids) {
  return ids.length < 2;
}

// ── S2: Column rendering ──────────────────────────────────────────────────────

/**
 * Build repeater data for the compare columns grid.
 * @param {Object[]} products
 * @returns {Object[]}
 */
export function buildColumnData(products) {
  return products.map(p => {
    const onSale = p.compareAtPrice != null && p.compareAtPrice > p.price;
    return {
      _id: p._id,
      name: p.name,
      slug: p.slug,
      image: p.mainMedia,
      price: p.formattedPrice,
      salePrice: onSale ? _formatPrice(p.price) : null,
      origPrice: onSale ? _formatPrice(p.compareAtPrice) : null,
      showOrigPrice: onSale,
      badge: p.ribbon || '',
      showBadge: Boolean(p.ribbon),
      inStock: p.inStock,
      productUrl: `/product-page/${p.slug}`,
    };
  });
}

function _formatPrice(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

// ── S3: Attributes table ──────────────────────────────────────────────────────

/**
 * The 9 comparison attributes surfaced in the attributes table.
 * `key` is used internally; `label` is displayed to the user.
 */
export const COMPARE_ATTRIBUTES = [
  { key: 'frameMaterial',    label: 'Frame Material' },
  { key: 'closedDimensions', label: 'Closed Dimensions' },
  { key: 'openDimensions',   label: 'Open Dimensions' },
  { key: 'weightCapacity',   label: 'Weight Capacity' },
  { key: 'mattressSize',     label: 'Mattress Size' },
  { key: 'seatHeight',       label: 'Seat Height' },
  { key: 'price',            label: 'Price' },
  { key: 'rating',           label: 'Rating' },
  { key: 'inStock',          label: 'In Stock' },
  { key: 'availableFabrics', label: 'Available Fabrics' },
];

/**
 * Extract a named attribute value from a product.
 * Handles the special cases: Price, Rating, In Stock (direct product fields).
 * Everything else comes from additionalInfoSections.
 * @param {Object} product
 * @param {string} attrName
 * @returns {string}
 */
export function getProductAttribute(product, attrName) {
  if (attrName === 'Price') {
    return product.formattedPrice || _formatPrice(product.price);
  }
  if (attrName === 'Rating') {
    return product.numericRating != null ? `${product.numericRating} / 5` : '—';
  }
  if (attrName === 'In Stock') {
    return product.inStock ? 'In Stock' : 'Out of Stock';
  }

  const sections = product.additionalInfoSections || [];
  const section = sections.find(
    s => s.title?.toLowerCase() === attrName.toLowerCase()
  );
  // user-editable CMS content — must escape to prevent XSS in .html contexts
  return htmlEscape(section?.description || '—');
}

/**
 * Returns true when not all values in the array are equal.
 * @param {string[]} values
 * @returns {boolean}
 */
export function isDiff(values) {
  if (values.length <= 1) return false;
  return values.some(v => v !== values[0]);
}

/**
 * Build repeater data for the attributes comparison table.
 * @param {Object[]} products
 * @returns {Object[]}
 */
export function buildAttributeRows(products) {
  return COMPARE_ATTRIBUTES.map(attr => {
    const values = products.map(p => getProductAttribute(p, attr.label));
    return {
      _id: `attr-${attr.key}`,
      label: attr.label,
      values,
      hasDiff: isDiff(values),
    };
  });
}

// ── S4: Mobile responsive ─────────────────────────────────────────────────────

/**
 * Returns CSS for horizontal scroll-snap on the compare grid.
 * Injected via an HtmlComponent embed on mobile.
 * @returns {string}
 */
export function buildMobileSnapCss() {
  return `
<style>
  #compareGridBox {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  #compareColRepeater > * {
    flex: 0 0 100%;
    scroll-snap-align: start;
  }
</style>
`.trim();
}

/**
 * Build dot indicator data for the mobile carousel.
 * @param {number} count - number of products
 * @param {number} activeIndex - currently visible product index
 * @returns {{ _id: string, active: boolean }[]}
 */
export function buildDotIndicatorData(count, activeIndex) {
  return Array.from({ length: count }, (_, i) => ({
    _id: `dot-${i}`,
    active: i === activeIndex,
  }));
}

// ── S5: SEO + schema ──────────────────────────────────────────────────────────

/**
 * Build the SEO page title for the compare page.
 * @param {Object[]} products
 * @returns {string}
 */
export function buildCompareTitle(products) {
  const names = products.map(p => p.name).join(' vs ');
  return `Compare ${names} | Carolina Futons`;
}

/**
 * Build the SEO meta description for the compare page.
 * Kept under 160 characters.
 * @param {Object[]} products
 * @returns {string}
 */
export function buildCompareDescription(products) {
  const names = products.map(p => p.name).join(' and ');
  const raw = `Side-by-side comparison of ${names} — dimensions, materials, pricing and more.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

/**
 * Build ItemList JSON-LD schema for the compare page.
 * @param {Object[]} products
 * @param {string} baseUrl
 * @returns {Object}
 */
export function buildItemListSchema(products, baseUrl) {
  const base = baseUrl || business.baseUrl;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: buildCompareTitle(products),
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${base}/product-page/${p.slug}`,
      item: {
        '@type': 'Product',
        name: p.name,
        slug: p.slug,
        url: `${base}/product-page/${p.slug}`,
      },
    })),
  };
}

// ── S6: Start Over + back-navigation ─────────────────────────────────────────

/**
 * Remove one product ID from the compare list.
 * @param {string[]} ids
 * @param {string} idToRemove
 * @returns {string[]}
 */
export function removeProductFromCompare(ids, idToRemove) {
  return ids.filter(id => id !== idToRemove);
}

/**
 * Build the /compare URL from an array of product IDs.
 * @param {string[]} ids
 * @returns {string}
 */
export function buildCompareUrl(ids) {
  if (ids.length === 0) return '/compare';
  return `/compare?ids=${ids.join(',')}`;
}
