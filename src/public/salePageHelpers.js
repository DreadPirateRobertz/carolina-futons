/**
 * salePageHelpers.js — Content and formatting for the Sale page.
 * Handles sale item display, discount formatting, and sorting.
 */

const SALE_INTRO = 'Handcrafted furniture at great prices. Browse our current sale and clearance items — quality you can trust, savings you\'ll love.';

const PRICE_MATCH_NOTE = 'Ask us about our fair price-matching policy! All of our futon frames come with Otis GripStrips to keep your mattress in place (at no extra charge).';

/**
 * Get the sale page intro text.
 * @returns {string}
 */
export function getSaleIntro() {
  return SALE_INTRO;
}

/**
 * Get the price-match policy note.
 * @returns {string}
 */
export function getPriceMatchNote() {
  return PRICE_MATCH_NOTE;
}

/**
 * Format a discount amount as a savings string.
 * @param {number} originalPrice
 * @param {number} salePrice
 * @returns {string} e.g. "Save $200" or "20% off"
 */
export function formatDiscount(originalPrice, salePrice) {
  if (!originalPrice || !salePrice || salePrice >= originalPrice) return '';
  const savings = originalPrice - salePrice;
  const pct = Math.round((savings / originalPrice) * 100);
  if (pct >= 10) return `${pct}% off`;
  return `Save $${savings.toFixed(0)}`;
}

/**
 * Format a price display string showing original and sale price.
 * @param {Object} product - Product with price and discountedPrice
 * @returns {string} e.g. "Reg. $1,129 Sale $903"
 */
export function formatSalePrice(product) {
  if (!product || !product.price) return '';
  const orig = `$${product.price.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  if (!product.discountedPrice || product.discountedPrice >= product.price) {
    return orig;
  }
  const sale = `$${product.discountedPrice.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  return `Reg. ${orig} Sale ${sale}`;
}

/**
 * Sort sale items by discount percentage (largest first).
 * @param {Array<Object>} items - Products with price and discountedPrice
 * @returns {Array<Object>} Sorted copy
 */
export function sortByDiscount(items) {
  return [...items].sort((a, b) => {
    const pctA = a.price ? (a.price - (a.discountedPrice || a.price)) / a.price : 0;
    const pctB = b.price ? (b.price - (b.discountedPrice || b.price)) / b.price : 0;
    return pctB - pctA;
  });
}
