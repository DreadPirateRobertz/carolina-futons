#!/usr/bin/env node
/**
 * enrich-master-catalog.js — Merge scraped JSON-LD data into catalog-MASTER.json
 * Fills in prices, descriptions, images, availability from real scrape data
 */

const fs = require('fs');
const path = require('path');

const MASTER_PATH = path.join(__dirname, '..', 'content', 'catalog-MASTER.json');
const SCRAPED_PATH = path.join(__dirname, '..', 'content', 'carolinafutons-products.json');
const OUTPUT_PATH = MASTER_PATH; // overwrite master

const master = JSON.parse(fs.readFileSync(MASTER_PATH, 'utf-8'));
const scraped = JSON.parse(fs.readFileSync(SCRAPED_PATH, 'utf-8'));

// Build lookup by URL slug
const scrapedBySlug = {};
for (const p of scraped.products) {
  const slug = p.url.split('/product-page/')[1] || p.url.split('/').pop();
  scrapedBySlug[slug] = p;
}

let enriched = 0;
let notFound = 0;

for (const mp of master.products) {
  const slug = mp.slug || (mp.url && mp.url.split('/product-page/')[1]) || '';
  const sp = scrapedBySlug[slug];

  if (!sp) {
    notFound++;
    console.log(`NOT FOUND in scrape: ${mp.name} (slug: ${slug})`);
    continue;
  }

  // Enrich with scraped data
  if (sp.price && (!mp.price || mp.price === 0)) mp.price = sp.price;
  if (sp.description && (!mp.description || mp.description === '')) mp.description = sp.description;
  if (sp.images && sp.images.length > 0 && (!mp.images || mp.images.length === 0)) mp.images = sp.images;
  if (sp.availability) mp.availability = sp.availability;
  if (sp.manufacturer && !mp.manufacturer) mp.manufacturer = sp.manufacturer;
  if (sp.swatches && sp.swatches.length > 0 && (!mp.swatches || mp.swatches.length === 0)) mp.swatches = sp.swatches;
  if (sp.sizes && sp.sizes.length > 0 && (!mp.sizes || mp.sizes.length === 0)) mp.sizes = sp.sizes;
  if (sp.category && sp.category !== 'uncategorized') mp.category = sp.category;
  if (sp.contactForPrice) mp.contactForPrice = sp.contactForPrice;
  if (sp.bundleCompatible !== undefined) mp.bundleCompatible = sp.bundleCompatible;

  // Enrich variants with swatch/size data if master has empty variants
  if (sp.variants && sp.variants.length > 0) {
    if (!mp.variants || mp.variants.length === 0 || mp.variants.every(v => !v.price)) {
      mp.variants = sp.variants;
    }
  }

  enriched++;
}

// Update metadata
master.enrichmentStatus = 'enriched-from-jsonld-scrape';
master.enrichedAt = new Date().toISOString();
master.enrichedBy = 'caesar/compile-catalog.js';
master.enrichmentNeeded = master.products.filter(p => !p.price && !p.contactForPrice).map(p => p.slug || p.name);

// Stats
const withPrice = master.products.filter(p => p.price > 0).length;
const withDesc = master.products.filter(p => p.description && p.description.length > 10).length;
const withImages = master.products.filter(p => p.images && p.images.length > 0).length;
const inStock = master.products.filter(p => p.availability === 'InStock').length;

console.log(`\nEnrichment results:`);
console.log(`  Matched & enriched: ${enriched}/${master.products.length}`);
console.log(`  Not found in scrape: ${notFound}`);
console.log(`  With price: ${withPrice}`);
console.log(`  With description: ${withDesc}`);
console.log(`  With images: ${withImages}`);
console.log(`  InStock: ${inStock}`);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(master, null, 2));
console.log(`\nWritten enriched master to: ${OUTPUT_PATH}`);

// Also copy to mayor/rig/content
const mayorPath = path.join(__dirname, '..', '..', '..', 'mayor', 'rig', 'content', 'catalog-MASTER.json');
fs.writeFileSync(mayorPath, JSON.stringify(master, null, 2));
console.log(`Written to: ${mayorPath}`);
