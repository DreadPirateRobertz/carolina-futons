#!/usr/bin/env node
/**
 * auditProductMedia.js — Audit product image coverage across all data sources
 *
 * Cross-references:
 * - data/mcp-scrape/products-full.json (Wix MCP API scrape, 88 products)
 * - data/kdframes-catalog.json (KD Frames manufacturer images)
 * - content/carolinafutons-products.json (JSON-LD scrape)
 *
 * Outputs a report showing:
 * - Products with insufficient images (<3 for gallery display)
 * - Products missing alt text
 * - Available supplementary images from manufacturer catalogs
 * - Image dimension / quality issues
 *
 * Usage: node scripts/auditProductMedia.js [--json] [--fix-plan]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Load data sources ───────────────────────────────────────────────

function loadJSON(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

// ── Image quality thresholds ────────────────────────────────────────

const MIN_GALLERY_IMAGES = 3;  // Gallery displays 3-6 thumbnails
const MIN_WIDTH = 400;         // Below this is too small for product cards
const IDEAL_WIDTH = 800;       // Product page main image target
const MIN_ALT_LENGTH = 10;     // Reasonable alt text minimum

// ── Manufacturer image sources ──────────────────────────────────────

function loadKDFramesImages() {
  const kd = loadJSON('data/kdframes-catalog.json');
  if (!kd) return {};
  const map = {};
  for (const product of kd) {
    const slug = product.slug || product.name.toLowerCase().replace(/\s+/g, '-');
    map[slug] = {
      name: product.name,
      images: product.images || [],
      pdfs: product.pdfs || [],
    };
  }
  return map;
}

// ── Name matching ───────────────────────────────────────────────────

function normalizeProductName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findKDMatch(productName, kdMap) {
  const normalized = normalizeProductName(productName);
  if (!normalized) return null;
  for (const [slug, data] of Object.entries(kdMap)) {
    const kdNormalized = normalizeProductName(data.name);
    if (normalized.includes(kdNormalized) || kdNormalized.includes(normalized)) {
      return { slug, ...data };
    }
    // Partial match on key words
    const kdWords = kdNormalized.split(' ').filter(w => w.length > 3);
    const matchedWords = kdWords.filter(w => normalized.includes(w));
    if (matchedWords.length >= 2 && matchedWords.length >= kdWords.length * 0.6) {
      return { slug, ...data };
    }
  }
  return null;
}

// ── Audit logic ─────────────────────────────────────────────────────

function auditProducts() {
  const wixProducts = loadJSON('data/mcp-scrape/products-full.json');
  if (!wixProducts) {
    console.error('ERROR: data/mcp-scrape/products-full.json not found');
    process.exit(1);
  }

  const kdMap = loadKDFramesImages();
  const products = wixProducts.products;

  const report = {
    summary: {
      totalProducts: products.length,
      productsWithSufficientImages: 0,
      productsWithInsufficientImages: 0,
      productsMissingAltText: 0,
      productsWithSmallImages: 0,
      supplementarySourcesAvailable: 0,
      totalImages: 0,
      totalSupplementaryImages: 0,
    },
    insufficient: [],
    missingAlt: [],
    smallImages: [],
    supplementary: [],
    byCategory: {},
  };

  for (const product of products) {
    const media = product.media || [];
    const imageCount = media.length;
    report.summary.totalImages += imageCount;

    // Category tracking
    const category = product.collectionIds?.[0] || 'unknown';
    if (!report.byCategory[category]) {
      report.byCategory[category] = { total: 0, sufficient: 0, insufficient: 0, totalImages: 0 };
    }
    report.byCategory[category].total++;
    report.byCategory[category].totalImages += imageCount;

    // Check image sufficiency
    if (imageCount >= MIN_GALLERY_IMAGES) {
      report.summary.productsWithSufficientImages++;
      report.byCategory[category].sufficient++;
    } else {
      report.summary.productsWithInsufficientImages++;
      report.byCategory[category].insufficient++;
      report.insufficient.push({
        name: product.name,
        slug: product.slug,
        imageCount,
        needed: MIN_GALLERY_IMAGES - imageCount,
      });
    }

    // Check alt text
    const missingAlt = media.filter(m => !m.alt || m.alt.length < MIN_ALT_LENGTH);
    if (missingAlt.length > 0) {
      report.summary.productsMissingAltText++;
      report.missingAlt.push({
        name: product.name,
        slug: product.slug,
        totalImages: imageCount,
        missingAltCount: missingAlt.length,
      });
    }

    // Check image dimensions
    const smallImages = media.filter(m => m.width > 0 && m.width < MIN_WIDTH);
    if (smallImages.length > 0) {
      report.summary.productsWithSmallImages++;
      report.smallImages.push({
        name: product.name,
        slug: product.slug,
        smallImages: smallImages.map(m => ({
          url: m.url,
          width: m.width,
          height: m.height,
        })),
      });
    }

    // Check for supplementary manufacturer images
    const kdMatch = findKDMatch(product.name, kdMap);
    if (kdMatch && kdMatch.images.length > 0) {
      const newImages = kdMatch.images.length;
      report.summary.supplementarySourcesAvailable++;
      report.summary.totalSupplementaryImages += newImages;
      report.supplementary.push({
        name: product.name,
        slug: product.slug,
        currentImages: imageCount,
        manufacturer: 'KD Frames',
        manufacturerSlug: kdMatch.slug,
        availableImages: newImages,
        imageUrls: kdMatch.images,
      });
    }
  }

  return report;
}

// ── Output formatting ───────────────────────────────────────────────

function printReport(report) {
  const s = report.summary;
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PRODUCT IMAGE AUDIT — Carolina Futons');
  console.log('═══════════════════════════════════════════════════════════');
  console.log();
  console.log(`Total products:              ${s.totalProducts}`);
  console.log(`Total images:                ${s.totalImages}`);
  console.log(`Avg images/product:          ${(s.totalImages / s.totalProducts).toFixed(1)}`);
  console.log(`Sufficient images (≥${MIN_GALLERY_IMAGES}):     ${s.productsWithSufficientImages}`);
  console.log(`Insufficient images (<${MIN_GALLERY_IMAGES}):   ${s.productsWithInsufficientImages}`);
  console.log(`Missing alt text:            ${s.productsMissingAltText}`);
  console.log(`Small images (<${MIN_WIDTH}px):      ${s.productsWithSmallImages}`);
  console.log(`Supplementary sources:       ${s.supplementarySourcesAvailable} products`);
  console.log(`Supplementary images:        ${s.totalSupplementaryImages} images`);
  console.log();

  if (report.insufficient.length > 0) {
    console.log('── Products with insufficient images ──────────────────────');
    for (const p of report.insufficient) {
      console.log(`  ${p.name}: ${p.imageCount} images (need ${p.needed} more)`);
    }
    console.log();
  }

  if (report.supplementary.length > 0) {
    console.log('── Available supplementary images ─────────────────────────');
    for (const p of report.supplementary) {
      console.log(`  ${p.name}: ${p.currentImages} current + ${p.availableImages} from ${p.manufacturer}`);
    }
    console.log();
  }

  if (report.smallImages.length > 0) {
    console.log('── Products with small images ─────────────────────────────');
    for (const p of report.smallImages) {
      for (const img of p.smallImages) {
        console.log(`  ${p.name}: ${img.width}x${img.height}`);
      }
    }
    console.log();
  }
}

function printFixPlan(report) {
  console.log();
  console.log('── FIX PLAN ──────────────────────────────────────────────');
  console.log();
  console.log('1. ENRICH FROM MANUFACTURER CATALOGS');
  console.log(`   Run: node scripts/enrichProductImages.js`);
  console.log(`   Effect: Add ${report.summary.totalSupplementaryImages} images from KD Frames`);
  console.log();
  console.log('2. GENERATE ALT TEXT');
  console.log(`   Run: node scripts/enrichProductImages.js --alt-text`);
  console.log(`   Effect: Generate SEO alt text for ${report.summary.productsMissingAltText} products`);
  console.log();
  console.log('3. REMAINING GAPS');
  const remaining = report.insufficient.filter(p =>
    !report.supplementary.find(s => s.slug === p.slug)
  );
  if (remaining.length > 0) {
    console.log(`   ${remaining.length} products still need images after enrichment:`);
    for (const p of remaining) {
      console.log(`     - ${p.name} (${p.imageCount} images)`);
    }
    console.log('   Action: Source images from manufacturer websites or request from store owner');
  } else {
    console.log('   All gaps can be filled from manufacturer catalogs.');
  }
  console.log();
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const showFixPlan = args.includes('--fix-plan');

  const report = auditProducts();

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
    if (showFixPlan) {
      printFixPlan(report);
    }
  }

  return report;
}

// Support both CLI and require/import
if (require.main === module) {
  main();
}

module.exports = { auditProducts, findKDMatch, normalizeProductName };
