#!/usr/bin/env node
/**
 * validate-catalog.js — Integrity check for catalog-MASTER.json
 *
 * Prints a validation report to stdout covering:
 * - Missing or zero prices
 * - Unknown/invalid categories (against VALID_CATEGORIES)
 * - Missing required fields (SKU, slug, name, images)
 * - Category and price distribution stats
 *
 * Usage: node scripts/validate-catalog.js
 * No arguments. Reads from content/catalog-MASTER.json.
 */
const catalog = require('../content/catalog-MASTER.json');

/**
 * Canonical category slugs accepted by catalogImport.web.js and Wix Stores.
 * Any product with a category not in this list will be flagged as invalid.
 * Must stay in sync with VALID_CATEGORIES in src/backend/catalogImport.web.js.
 */
const VALID_CATEGORIES = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'front-loading-nesting', 'wall-huggers',
  'wall-hugger-frames', 'unfinished-wood', 'covers', 'outdoor-furniture', 'pillows-702', 'log-frames',
];

const products = catalog.products;
const nullPrices = products.filter(p => p.price == null);
const zeroPrices = products.filter(p => p.price === 0);
const invalidCats = products.filter(p => !VALID_CATEGORIES.includes(p.category));
const missingSku = products.filter(p => !p.sku);
const missingSlug = products.filter(p => !p.slug);
const missingName = products.filter(p => !p.name);
const missingImages = products.filter(p => !Array.isArray(p.images));
const noImages = products.filter(p => Array.isArray(p.images) && p.images.length === 0);

console.log('=== Catalog Validation Report ===');
console.log('Total products:', products.length);
console.log('');
console.log('Null prices:', nullPrices.length, nullPrices.map(p => p.name));
console.log('Zero prices:', zeroPrices.length, zeroPrices.map(p => p.name));
console.log('Invalid category:', invalidCats.length, invalidCats.map(p => p.category + ': ' + p.name));
console.log('Missing SKU:', missingSku.length, missingSku.map(p => p.name));
console.log('Missing slug:', missingSlug.length);
console.log('Missing name:', missingName.length);
console.log('Missing images array:', missingImages.length);
console.log('Empty images:', noImages.length, noImages.map(p => p.name));

// Category distribution
const cats = {};
products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
console.log('\nCategory distribution:');
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + k + ': ' + v));

// Price distribution
const withPrice = products.filter(p => p.price > 0);
const prices = withPrice.map(p => p.price).sort((a, b) => a - b);
console.log('\nPrice stats (products with price > 0):');
console.log('  Count:', withPrice.length);
console.log('  Min:', prices[0]);
console.log('  Max:', prices[prices.length - 1]);
console.log('  Median:', prices[Math.floor(prices.length / 2)]);
