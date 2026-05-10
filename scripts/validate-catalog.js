#!/usr/bin/env node
/**
 * validate-catalog.js — CI integrity check for catalog data
 *
 * Validates:
 * 1. Category consistency: all VALID_CATEGORIES arrays and CATEGORY_FOLDERS
 *    keys across the codebase must match a canonical set
 * 2. SKU uniqueness: no duplicate SKUs in catalog-MASTER.json
 * 3. Price sanity: all prices > 0 and < 10000
 * 4. Required fields: every product has name, slug, sku, category, images
 * 5. Category validity: every product category is in the canonical set
 *
 * Exit 0 = clean, exit 1 = errors found
 *
 * Usage: node scripts/validate-catalog.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function error(check, msg) { errors.push(`[${check}] ${msg}`); }
function warn(check, msg) { warnings.push(`[${check}] ${msg}`); }

// ── 1. Parse VALID_CATEGORIES from all source files ─────────────────

/**
 * Extract array literal contents from a VALID_CATEGORIES = [...] declaration.
 * Handles multi-line arrays with single-quoted string elements.
 */
function extractCategories(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(/VALID_CATEGORIES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return null;
  const items = match[1].match(/'([^']+)'/g);
  if (!items) return [];
  return items.map(s => s.replace(/'/g, ''));
}

/**
 * Extract object keys from a CATEGORY_FOLDERS = {...} declaration.
 */
function extractFolderKeys(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const match = src.match(/CATEGORY_FOLDERS\s*=\s*\{([\s\S]*?)\}/);
  if (!match) return null;
  const keys = match[1].match(/'([^']+)'\s*:/g);
  if (!keys) return [];
  return keys.map(s => s.replace(/'|:/g, '').trim());
}

// Files that consume VALID_CATEGORIES (re-exporting via import). The
// canonical list now lives in `src/backend/utils/catalogCategories.js`
// (extracted in cf-dtu6 so the dead `catalogImport.web.js` could retire).
// Each consumer must import from the canonical module — we verify that
// by parsing the import statement, not the array literal itself.
const categoryFiles = [
  'src/backend/catalogContent.web.js',
  'src/backend/loadCatalogMaster.web.js',
  'src/backend/productVideos.web.js',
];

// File with CATEGORY_FOLDERS
const folderFile = 'src/backend/mediaGallery.web.js';

// The canonical source: src/backend/utils/catalogCategories.js
const canonicalRel = 'src/backend/utils/catalogCategories.js';
const canonicalPath = path.join(ROOT, canonicalRel);
const canonical = extractCategories(canonicalPath);
if (!canonical) {
  console.error('FATAL: Could not parse VALID_CATEGORIES from', canonicalRel);
  process.exit(1);
}
const canonicalSet = new Set(canonical);

console.log(`Canonical categories (${canonicalRel}): ${canonical.length}`);
console.log(`  ${canonical.join(', ')}\n`);

// Verify each consumer imports from the canonical module (no shadow constants)
const importLine = "import { VALID_CATEGORIES } from 'backend/utils/catalogCategories'";
for (const relPath of categoryFiles) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    error('category-sync', `File not found: ${relPath}`);
    continue;
  }
  const src = fs.readFileSync(fullPath, 'utf8');
  if (!src.includes(importLine)) {
    error('category-sync', `${relPath} does not import VALID_CATEGORIES from canonical module — must add: ${importLine}`);
  }
  if (/const\s+VALID_CATEGORIES\s*=\s*\[/.test(src)) {
    error('category-sync', `${relPath} still defines a local VALID_CATEGORIES — should import from canonical module instead`);
  }
}

// Check CATEGORY_FOLDERS keys
const folderFullPath = path.join(ROOT, folderFile);
if (fs.existsSync(folderFullPath)) {
  const folderKeys = extractFolderKeys(folderFullPath);
  if (folderKeys) {
    const folderSet = new Set(folderKeys);
    for (const c of canonical) {
      if (!folderSet.has(c)) {
        warn('folder-sync', `${folderFile} CATEGORY_FOLDERS missing key '${c}'`);
      }
    }
    for (const k of folderKeys) {
      if (!canonicalSet.has(k)) {
        // pillows-702 vs pillows mismatch is a known mapping, check for it
        warn('folder-sync', `${folderFile} CATEGORY_FOLDERS has key '${k}' not in VALID_CATEGORIES`);
      }
    }
  }
}

// ── 2. Validate catalog-MASTER.json ─────────────────────────────────

const catalogPath = path.join(ROOT, 'content/catalog-MASTER.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const products = catalog.products;

console.log(`Catalog: ${products.length} products\n`);

// Required fields
const REQUIRED = ['name', 'slug', 'sku', 'category'];
for (let i = 0; i < products.length; i++) {
  const p = products[i];
  for (const field of REQUIRED) {
    if (!p[field]) {
      error('required-field', `Product ${i} (${p.name || 'unnamed'}): missing '${field}'`);
    }
  }
  if (!Array.isArray(p.images)) {
    error('required-field', `Product ${i} (${p.name || 'unnamed'}): 'images' must be an array`);
  }
}

// Category validity
for (let i = 0; i < products.length; i++) {
  const p = products[i];
  if (p.category && !canonicalSet.has(p.category)) {
    error('category-valid', `Product ${i} (${p.name}): category '${p.category}' not in VALID_CATEGORIES`);
  }
}

// SKU uniqueness
const skuMap = new Map();
for (let i = 0; i < products.length; i++) {
  const sku = products[i].sku;
  if (!sku) continue;
  if (skuMap.has(sku)) {
    error('sku-unique', `Duplicate SKU '${sku}': products ${skuMap.get(sku)} and ${i} (${products[i].name})`);
  } else {
    skuMap.set(sku, i);
  }
}

// Price sanity
for (let i = 0; i < products.length; i++) {
  const p = products[i];
  if (p.price == null) {
    warn('price', `Product ${i} (${p.name}): null price`);
  } else if (p.price <= 0) {
    error('price', `Product ${i} (${p.name}): price ${p.price} <= 0`);
  } else if (p.price >= 10000) {
    error('price', `Product ${i} (${p.name}): price ${p.price} >= 10000`);
  }
}

// ── 3. Report ───────────────────────────────────────────────────────

console.log('=== Validation Results ===\n');

if (warnings.length > 0) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach(w => console.log(`  ⚠ ${w}`));
  console.log('');
}

if (errors.length > 0) {
  console.log(`Errors (${errors.length}):`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
  console.log('\nValidation FAILED');
  process.exit(1);
} else {
  console.log('✓ All checks passed');
  process.exit(0);
}
