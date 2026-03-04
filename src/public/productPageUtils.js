// productPageUtils.js - Shared utilities for Product Page components
import { colors } from 'public/designTokens.js';
import { supportedCurrencies } from 'public/sharedTokens.js';

/**
 * Format an amount as currency. Supports multi-currency via optional currencyCode param.
 * @param {number} amount - Amount to format.
 * @param {string} [currencyCode='USD'] - ISO 4217 currency code.
 * @returns {string} Formatted currency string.
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  const code = String(currencyCode || 'USD').toUpperCase();
  const info = supportedCurrencies[code];
  const locale = info?.locale || 'en-US';
  const currency = info ? code : 'USD';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }
}

export function buildGridAlt(product) {
  const brand = detectProductBrand(product);
  const category = detectProductCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

export function detectProductBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

export function detectProductCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

export function getCategoryFromCollections(collections) {
  if (!collections) return { label: 'Shop', path: '/shop-main' };
  const collArr = Array.isArray(collections) ? collections : [collections];
  if (collArr.some(c => c.includes('murphy'))) return { label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' };
  if (collArr.some(c => c.includes('platform'))) return { label: 'Platform Beds', path: '/platform-beds' };
  if (collArr.some(c => c.includes('mattress'))) return { label: 'Mattresses', path: '/mattresses' };
  if (collArr.some(c => c.includes('wall-hugger'))) return { label: 'Wall Hugger Frames', path: '/wall-huggers' };
  if (collArr.some(c => c.includes('unfinished'))) return { label: 'Unfinished Wood', path: '/unfinished-wood' };
  if (collArr.some(c => c.includes('casegood') || c.includes('accessor'))) return { label: 'Casegoods & Accessories', path: '/casegoods-accessories' };
  if (collArr.some(c => c.includes('futon') || c.includes('frame'))) return { label: 'Futon Frames', path: '/futon-frames' };
  return { label: 'Shop', path: '/shop-main' };
}

export function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

export const HEART_FILLED_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors.sunsetCoral}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;

export const HEART_OUTLINE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.espresso}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;
