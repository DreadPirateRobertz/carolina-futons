#!/usr/bin/env node
/**
 * assign-skus.mjs — CF-1ytq
 *
 * Part 1: Assign SKUs (CF-[CATEGORY]-[MODEL]) to all 88 Wix Stores products.
 * Part 2: Generate ProductShippingProfiles rows (one per product).
 *
 * Usage (dry run):
 *   node scripts/assign-skus.mjs --dry-run
 *
 * Usage (apply, requires WIX_API_KEY env var):
 *   WIX_API_KEY=<key> WIX_SITE_ID=3af610bf-06fb-410d-a406-c1258fa84372 \
 *     node scripts/assign-skus.mjs
 *
 * WIX_API_KEY can be found in Dashboard > Settings > API Keys (needs Stores + CMS write scope).
 * WIX_SITE_ID defaults to the staging site.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const CONTENT = join(ROOT, 'content');

const DRY_RUN = process.argv.includes('--dry-run');
const WIX_API_KEY = process.env.WIX_API_KEY;
const SITE_ID = process.env.WIX_SITE_ID || '3af610bf-06fb-410d-a406-c1258fa84372';

if (!DRY_RUN && !WIX_API_KEY) {
  console.error('ERROR: WIX_API_KEY is required. Set it or use --dry-run.');
  process.exit(1);
}

// ── Load data ──────────────────────────────────────────────────────────────

const audit = JSON.parse(readFileSync(join(CONTENT, 'live-site-audit.json'), 'utf8'));
const liveData = JSON.parse(readFileSync(join(CONTENT, 'live-products-full.json'), 'utf8'));
const products = liveData.products;

// Build collection name map
const colMap = {};
audit.collections.forEach(c => { colMap[c.id] = c.name; });

// ── SKU logic ──────────────────────────────────────────────────────────────

/**
 * Classify a product into a category for the SKU prefix.
 * Returns: MURPHY | BED | FRAME | MATTRESS | LOG | CASE | ACCESSORY
 */
function classifyCategory(product) {
  const name = product.name.toLowerCase();
  const cols = (product.collectionIds || []).map(id => colMap[id] || '');

  // Murphy Cabinet Beds
  if (cols.includes('Murphy Cabinet Beds') || name.includes('murphy')) return 'MURPHY';

  // Mattresses
  if (cols.includes('Mattresses') || cols.includes('Mattresses - In-Store')) return 'MATTRESS';

  // Rustic Log Futons
  if (cols.includes('Rustic Log Futons') || name.includes('log futon')) return 'LOG';

  // Casegoods / Accessories (dressers, nightstands, chests, drawers)
  const isCase =
    cols.includes('Casegoods & Accessories') ||
    cols.some(c => c.startsWith('Accessories')) ||
    /\bdresser\b/.test(name) ||
    /\bnightstand\b/.test(name) ||
    /\bchest\b/.test(name) ||        // whole word — avoid "winchester"
    /\bdrawers\b/.test(name) ||
    /\bcenter legs\b/.test(name) ||
    /\bmattress protector\b/.test(name) ||
    /\bleg length options\b/.test(name) ||
    /\brolling drawers\b/.test(name) ||
    /\btrundle\b/.test(name);
  if (isCase) return 'CASE';

  // Platform Beds (explicit or by known model name)
  const platformBedNames = [
    'platform bed', 'ekko', 'nomad', 'charleston', 'lexington', 'folding platform',
  ];
  const isPlatformBed =
    name.includes('platform bed') ||
    (cols.some(c => c.startsWith('Bedroom')) &&
      platformBedNames.some(n => name.includes(n)));

  if (isPlatformBed) return 'BED';

  // Everything else in Bedroom collections = futon frame (finished/unfinished wood)
  if (cols.some(c => c.startsWith('Bedroom'))) return 'FRAME';

  // Wall Huggers and Front Loading & Nesting = futon frames
  if (cols.includes('Wall Huggers') || cols.includes('Front Loading & Nesting')) return 'FRAME';

  // Unfinished Wood = KD-style futon frames
  if (cols.includes('Unfinished Wood')) return 'FRAME';

  // Contains "futon frame" in name
  if (name.includes('futon frame')) return 'FRAME';

  // Fallback: if name contains common frame words
  if (name.includes('studio frame')) return 'FRAME';

  return 'CASE'; // default for miscellaneous accessories
}

/**
 * Derive a short model token from the product name (max 10 chars, uppercase).
 * Strips category-specific words that would be redundant.
 */
function modelToken(name, category) {
  const stripWords = [
    'futon frame', 'futon', 'platform bed', 'murphy cabinet bed', 'cabinet bed',
    'murphy', 'log',
  ];
  let model = name.toLowerCase();
  stripWords.forEach(w => { model = model.replace(w, ''); });

  // Remove content in parentheses, special chars
  model = model.replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s]/g, '');

  // Collapse whitespace, trim
  model = model.replace(/\s+/g, ' ').trim();

  // Special clean-ups
  model = model.replace(/^the\s+/i, '').replace(/\s+/g, '');

  // Uppercase and cap at 10 chars
  model = model.toUpperCase().slice(0, 10);

  // Remove trailing numbers that aren't part of the model (e.g. "110" in "Haley 110" → keep as HALEY110)
  return model || 'UNKNOWN';
}

/**
 * Generate a unique SKU for a product.
 * Format: CF-[CATEGORY]-[MODEL]
 */
function generateSku(product, usedSkus) {
  const category = classifyCategory(product);
  const base = `CF-${category}-${modelToken(product.name, category)}`;

  // Ensure uniqueness
  if (!usedSkus.has(base)) {
    usedSkus.add(base);
    return base;
  }
  // Append a suffix for collisions
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base.slice(0, 18)}-${i}`;
    if (!usedSkus.has(candidate)) {
      usedSkus.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Could not generate unique SKU for ${product.name}`);
}

// ── Shipping profile defaults ──────────────────────────────────────────────

const SHIPPING_DEFAULTS = {
  MURPHY:    { weight: 200, length: 84, width: 44, height: 12, requiresFreight: true,  requiresPallet: false },
  BED:       { weight: 120, length: 80, width: 60, height: 8,  requiresFreight: true,  requiresPallet: false },
  MATTRESS:  { weight: 55,  length: 78, width: 54, height: 14, requiresFreight: false, requiresPallet: false },
  LOG:       { weight: 85,  length: 80, width: 12, height: 30, requiresFreight: false, requiresPallet: false },
  FRAME:     { weight: 85,  length: 80, width: 12, height: 30, requiresFreight: false, requiresPallet: false },
  CASE:      { weight: 45,  length: 36, width: 20, height: 36, requiresFreight: false, requiresPallet: false },
  ACCESSORY: { weight: 15,  length: 24, width: 18, height: 12, requiresFreight: false, requiresPallet: false },
};

// ── Generate assignments ───────────────────────────────────────────────────

const usedSkus = new Set();
const assignments = products.map(product => {
  const sku = generateSku(product, usedSkus);
  const category = classifyCategory(product);
  const shipping = SHIPPING_DEFAULTS[category] || SHIPPING_DEFAULTS.ACCESSORY;
  return {
    productId: product.id,
    name: product.name,
    currentSku: product.sku || '',
    sku,
    category,
    shipping,
  };
});

// ── Print report ───────────────────────────────────────────────────────────

console.log('\n=== SKU Assignment Plan ===\n');
const byCategory = {};
assignments.forEach(a => {
  if (!byCategory[a.category]) byCategory[a.category] = [];
  byCategory[a.category].push(a);
});

Object.entries(byCategory).sort().forEach(([cat, items]) => {
  console.log(`\n[${cat}] — ${items.length} products`);
  items.forEach(a => {
    const note = a.currentSku && a.currentSku !== a.sku ? ` (was: ${a.currentSku})` : '';
    console.log(`  ${a.sku.padEnd(30)} ${a.name}${note}`);
  });
});

console.log(`\nTotal: ${assignments.length} products`);
const withExisting = assignments.filter(a => a.currentSku).length;
if (withExisting) console.log(`(${withExisting} already had a SKU — will be overwritten)`);

// Save assignments to a JSON file for reference
const outPath = join(CONTENT, 'sku-assignments.json');
writeFileSync(outPath, JSON.stringify(assignments, null, 2));
console.log(`\nAssignments saved to: ${outPath}`);

if (DRY_RUN) {
  console.log('\n[DRY RUN] No changes made. Remove --dry-run to apply.');
  process.exit(0);
}

// ── Apply via Wix Stores API ───────────────────────────────────────────────

const HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': WIX_API_KEY,
  'wix-site-id': SITE_ID,
};

async function wixRequest(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

console.log('\n=== Part 1: Updating product SKUs ===\n');
let skuOk = 0, skuErr = 0;
for (const a of assignments) {
  try {
    await wixRequest(
      `https://www.wixapis.com/stores/v1/products/${a.productId}`,
      'PATCH',
      { product: { sku: a.sku } }
    );
    console.log(`✓ ${a.name} → ${a.sku}`);
    skuOk++;
  } catch (err) {
    console.error(`✗ ${a.name}: ${err.message}`);
    skuErr++;
  }
  // Rate limit: 5 req/sec max
  await new Promise(r => setTimeout(r, 210));
}
console.log(`\nSKU update: ${skuOk} ok, ${skuErr} errors`);

// ── Part 2: Populate ProductShippingProfiles CMS collection ───────────────

console.log('\n=== Part 2: Populating ProductShippingProfiles ===\n');

// Check if collection exists by trying to query it
let collectionExists = true;
try {
  await wixRequest(
    `https://www.wixapis.com/wix-data/v2/items/query`,
    'POST',
    { dataCollectionId: 'ProductShippingProfiles', query: { paging: { limit: 1 } } }
  );
} catch (err) {
  if (err.message.includes('404') || err.message.includes('not found') || err.message.includes('does not exist')) {
    collectionExists = false;
    console.error('ERROR: ProductShippingProfiles collection does not exist.');
    console.error('Please create it in Wix Studio CMS first with fields:');
    console.error('  productId (text), sku (text), weight (number), length (number),');
    console.error('  width (number), height (number), requiresFreight (boolean), requiresPallet (boolean)');
    console.error('\nShipping profile data has been saved to content/sku-assignments.json for reference.');
    process.exit(1);
  }
}

// Bulk upsert shipping profiles
let cmsOk = 0, cmsErr = 0;
for (const a of assignments) {
  const item = {
    productId: a.productId,
    sku: a.sku,
    weight: a.shipping.weight,
    length: a.shipping.length,
    width: a.shipping.width,
    height: a.shipping.height,
    requiresFreight: a.shipping.requiresFreight,
    requiresPallet: a.shipping.requiresPallet,
  };

  try {
    // Try to find existing row by productId
    const existing = await wixRequest(
      `https://www.wixapis.com/wix-data/v2/items/query`,
      'POST',
      {
        dataCollectionId: 'ProductShippingProfiles',
        query: { filter: { productId: { $eq: a.productId } } },
      }
    );

    const existingItem = existing?.dataItems?.[0];
    if (existingItem) {
      // Update existing row
      await wixRequest(
        `https://www.wixapis.com/wix-data/v2/items/${existingItem._id}`,
        'PATCH',
        { dataCollectionId: 'ProductShippingProfiles', dataItem: { data: item } }
      );
      console.log(`↑ Updated: ${a.name}`);
    } else {
      // Insert new row
      await wixRequest(
        `https://www.wixapis.com/wix-data/v2/items`,
        'POST',
        { dataCollectionId: 'ProductShippingProfiles', dataItem: { data: item } }
      );
      console.log(`+ Inserted: ${a.name}`);
    }
    cmsOk++;
  } catch (err) {
    console.error(`✗ ${a.name}: ${err.message}`);
    cmsErr++;
  }
  await new Promise(r => setTimeout(r, 210));
}

console.log(`\nCMS update: ${cmsOk} ok, ${cmsErr} errors`);
console.log('\nDone. Review any errors above and re-run as needed.');
