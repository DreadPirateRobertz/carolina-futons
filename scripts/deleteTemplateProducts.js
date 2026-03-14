#!/usr/bin/env node
/**
 * deleteTemplateProducts.js — Remove Furniture Store template products from Wix Store.
 *
 * The Furniture Store template (#3563) ships with ~24 sample products (MODO, NYX,
 * RAVEN, etc.). This script queries all products, identifies template products
 * (those NOT in our Carolina Futons catalog), and deletes them via the Wix Stores
 * REST API.
 *
 * Usage:
 *   WIX_BACKEND_KEY=IST.xxx WIX_SITE_ID=xxx node scripts/deleteTemplateProducts.js [--dry-run]
 *
 * Or load from secrets.env:
 *   source scripts/secrets.env && node scripts/deleteTemplateProducts.js --dry-run
 *
 * @module deleteTemplateProducts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WIX_STORES_API = 'https://www.wixapis.com/stores/v1';
const DRY_RUN = process.argv.includes('--dry-run');

// ── Known CF product names (from our scraped catalog) ──────────────
// Products with these names are OURS — do NOT delete them.

function loadCFProductNames() {
  const names = new Set();
  const catalogFiles = [
    resolve(__dirname, '..', 'content', 'scraped-products-16-30.json'),
    resolve(__dirname, '..', 'content', 'scraped-products-31-45.json'),
  ];

  for (const file of catalogFiles) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      for (const product of data) {
        if (product.name) names.add(product.name.trim().toLowerCase());
      }
    } catch (e) {
      // File may not exist — that's ok, we'll be conservative
    }
  }

  // Also add any manually-known CF products
  const manualCF = [
    'Eureka', 'Flagstaff', 'Rosemary', 'Bali', 'Chandler', 'Pagoda',
    'Monterey', 'Venice', 'Phoenix', 'Tucson', 'Sedona', 'Boulder',
    'Big Sur', 'Durango', 'Kingston', 'Moonshadow', 'Dreamweaver',
    'Cloud Nine', 'Serenity', 'Cascade',
  ];
  for (const name of manualCF) {
    names.add(name.trim().toLowerCase());
  }

  return names;
}

// ── Known template product name patterns ───────────────────────────
// These are products from the Furniture Store template #3563.

const TEMPLATE_PRODUCT_PATTERNS = [
  'modo', 'nyx', 'raven', 'oslo', 'aria', 'luna', 'nova', 'zen',
  'cleo', 'milo', 'otto', 'vega', 'aura', 'echo', 'iris', 'onyx',
  'jade', 'opal', 'ruby', 'sage', 'teak', 'wren', 'yuma', 'zara',
];

/**
 * Query all products from Wix Stores.
 * @param {string} apiKey - Wix API key
 * @param {string} siteId - Wix site ID
 * @returns {Promise<Array>} All products
 */
async function queryAllProducts(apiKey, siteId) {
  const products = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const res = await fetch(`${WIX_STORES_API}/products/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'wix-site-id': siteId,
      },
      body: JSON.stringify({
        query: {
          paging: { limit, offset },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Query failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const items = data.products || [];
    products.push(...items);

    if (items.length < limit) break;
    offset += limit;
  }

  return products;
}

/**
 * Delete a product by ID.
 * @param {string} productId
 * @param {string} apiKey
 * @param {string} siteId
 */
async function deleteProduct(productId, apiKey, siteId) {
  const res = await fetch(`${WIX_STORES_API}/products/${productId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': apiKey,
      'wix-site-id': siteId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete failed for ${productId} (${res.status}): ${text}`);
  }
}

/**
 * Identify template products vs CF products.
 * @param {Array} products - All products from Wix
 * @param {Set<string>} cfNames - Known CF product names (lowercase)
 * @returns {{ template: Array, cf: Array }}
 */
function classifyProducts(products, cfNames) {
  const template = [];
  const cf = [];

  for (const product of products) {
    const name = (product.name || '').trim();
    const nameLower = name.toLowerCase();

    // Check if it's a known CF product
    const isCF = cfNames.has(nameLower) ||
      // Also check partial matches for multi-word CF names
      [...cfNames].some(cfName => nameLower.includes(cfName) && cfName.length > 3);

    // Check if it matches template patterns
    const isTemplateMatch = TEMPLATE_PRODUCT_PATTERNS.some(pattern =>
      nameLower === pattern || nameLower.startsWith(pattern + ' ')
    );

    if (isCF) {
      cf.push(product);
    } else if (isTemplateMatch) {
      template.push(product);
    } else {
      // Unknown — err on the side of caution, classify as CF (don't delete)
      console.log(`  ⚠ Unknown product (keeping): "${name}" (${product.id})`);
      cf.push(product);
    }
  }

  return { template, cf };
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.WIX_BACKEND_KEY;
  const siteId = process.env.WIX_SITE_ID;

  if (!apiKey || !siteId) {
    console.error('Missing WIX_BACKEND_KEY or WIX_SITE_ID environment variables.');
    console.error('Usage: WIX_BACKEND_KEY=IST.xxx WIX_SITE_ID=xxx node scripts/deleteTemplateProducts.js [--dry-run]');
    process.exit(1);
  }

  console.log(DRY_RUN ? '🔍 DRY RUN — no products will be deleted\n' : '🗑️  LIVE RUN — products WILL be deleted\n');

  // Load CF product names
  const cfNames = loadCFProductNames();
  console.log(`Loaded ${cfNames.size} known CF product names\n`);

  // Query all products
  console.log('Querying all products from Wix Stores...');
  const allProducts = await queryAllProducts(apiKey, siteId);
  console.log(`Found ${allProducts.length} total products\n`);

  // Classify
  const { template, cf } = classifyProducts(allProducts, cfNames);

  console.log(`\nClassification:`);
  console.log(`  ✅ CF products (keeping): ${cf.length}`);
  console.log(`  🗑️  Template products (deleting): ${template.length}\n`);

  if (template.length === 0) {
    console.log('No template products found. Nothing to delete.');
    return;
  }

  // List template products
  console.log('Template products to delete:');
  for (const p of template) {
    console.log(`  - "${p.name}" (${p.id})`);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('Dry run complete. Run without --dry-run to delete these products.');
    return;
  }

  // Delete template products
  let deleted = 0;
  let failed = 0;

  for (const p of template) {
    try {
      await deleteProduct(p.id, apiKey, siteId);
      deleted++;
      console.log(`  ✅ Deleted "${p.name}" (${p.id})`);
    } catch (err) {
      failed++;
      console.error(`  ❌ Failed to delete "${p.name}": ${err.message}`);
    }
  }

  console.log(`\nDone. Deleted: ${deleted}, Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
