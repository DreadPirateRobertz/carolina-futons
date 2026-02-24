#!/usr/bin/env node
/**
 * enrichProductImages.js — Enrich product data with manufacturer images and alt text
 *
 * Merges supplementary images from manufacturer catalogs (KD Frames, etc.)
 * into the Wix product data and generates SEO-friendly alt text.
 *
 * Usage:
 *   node scripts/enrichProductImages.js              # Full enrichment
 *   node scripts/enrichProductImages.js --alt-text    # Alt text only
 *   node scripts/enrichProductImages.js --images      # Images only
 *   node scripts/enrichProductImages.js --dry-run     # Preview changes
 *
 * Output: data/mcp-scrape/products-enriched.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ── Data loading ────────────────────────────────────────────────────

function loadJSON(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

function writeJSON(relPath, data) {
  const fullPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
  return fullPath;
}

// ── Manufacturer catalog loaders ────────────────────────────────────

function loadKDFramesCatalog() {
  const kd = loadJSON('data/kdframes-catalog.json');
  if (!kd) return {};
  const map = {};
  for (const product of kd) {
    const slug = product.slug || product.name.toLowerCase().replace(/\s+/g, '-');
    map[slug] = {
      name: product.name,
      images: product.images || [],
      manufacturer: 'KD Frames',
      materials: product.materials || '',
      category: product.category || '',
    };
  }
  return map;
}

// ── Product name matching ───────────────────────────────────────────

function normalizeForMatch(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findManufacturerMatch(productName, catalogs) {
  const normalized = normalizeForMatch(productName);
  if (!normalized) return null;
  for (const [slug, data] of Object.entries(catalogs)) {
    const catNorm = normalizeForMatch(data.name);
    if (normalized.includes(catNorm) || catNorm.includes(normalized)) {
      return { slug, ...data };
    }
    const catWords = catNorm.split(' ').filter(w => w.length > 3);
    const matched = catWords.filter(w => normalized.includes(w));
    if (matched.length >= 2 && matched.length >= catWords.length * 0.6) {
      return { slug, ...data };
    }
  }
  return null;
}

// ── Alt text generation ─────────────────────────────────────────────

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

/**
 * Generate SEO-friendly alt text for a product image.
 * @param {Object} product - Product data
 * @param {number} imageIndex - Index of the image (0 = main)
 * @param {Object} [imageData] - Optional image metadata
 * @returns {string} Alt text
 */
function generateAltText(product, imageIndex, imageData) {
  const name = product.name || 'Product';
  const brand = product.brand || product.manufacturer || '';

  // Determine category label
  let categoryLabel = '';
  if (product.collectionIds && product.collectionIds.length > 0) {
    categoryLabel = CATEGORY_LABELS[product.collectionIds[0]] || '';
  }

  // Build descriptive parts
  const parts = [];
  if (brand) parts.push(brand);
  parts.push(name);
  if (categoryLabel && !name.toLowerCase().includes(categoryLabel.toLowerCase())) {
    parts.push(categoryLabel);
  }

  // Add position context for non-main images
  if (imageIndex === 0) {
    parts.push('- Main Product Image');
  } else if (imageIndex === 1) {
    parts.push('- Alternate View');
  } else {
    parts.push(`- View ${imageIndex + 1}`);
  }

  // Add finish/color context from URL if available
  if (imageData && imageData.url) {
    const url = imageData.url.toLowerCase();
    if (url.includes('lifestyle') || url.includes('room')) {
      parts[parts.length - 1] = '- Lifestyle Room Setting';
    } else if (url.includes('detail') || url.includes('closeup')) {
      parts[parts.length - 1] = '- Detail Close-up';
    } else if (url.includes('dimension')) {
      parts[parts.length - 1] = '- Dimensions';
    } else if (url.includes('trundle') || url.includes('drawer')) {
      parts[parts.length - 1] = '- With Storage Option';
    }
  }

  return parts.join(' ');
}

/**
 * Generate alt text for a manufacturer-sourced image.
 * @param {string} productName - Product name
 * @param {string} imageUrl - Image URL for context
 * @param {number} index - Image position
 * @param {string} manufacturer - Manufacturer name
 * @returns {string} Alt text
 */
function generateManufacturerAltText(productName, imageUrl, index, manufacturer) {
  const url = (imageUrl || '').toLowerCase();
  const fileName = url.split('/').pop() || '';

  let suffix = `View ${index + 1}`;
  if (index === 0 || fileName.includes('lifestyle') || fileName.includes('main')) {
    suffix = 'Main Product Image';
  } else if (fileName.includes('trundle') || fileName.includes('drawer')) {
    suffix = 'With Storage Option';
  } else if (fileName.includes('front')) {
    suffix = 'Front View';
  } else if (fileName.includes('side')) {
    suffix = 'Side View';
  } else if (fileName.includes('detail') || fileName.includes('close')) {
    suffix = 'Detail Close-up';
  } else if (fileName.includes('dimension')) {
    suffix = 'Dimensions Diagram';
  }

  return `${manufacturer} ${productName} - ${suffix}`;
}

// ── Dedup helper ────────────────────────────────────────────────────

function deduplicateImages(existingMedia, newUrls) {
  const existingUrls = new Set(
    existingMedia.map(m => extractMediaId(m.url || ''))
  );

  return newUrls.filter(url => {
    const id = extractMediaId(url);
    if (existingUrls.has(id)) return false;
    existingUrls.add(id);
    return true;
  });
}

function extractMediaId(url) {
  // Extract Wix media ID: ed8a72_abc123~mv2.png
  const wixMatch = url.match(/media\/([^/]+?)(?:\/|$)/);
  if (wixMatch) return wixMatch[1];
  // For Shopify/external: use filename
  const segments = url.split('/');
  return segments[segments.length - 1].split('?')[0];
}

// ── Enrichment pipeline ─────────────────────────────────────────────

function enrichProducts(options = {}) {
  const { altTextOnly = false, imagesOnly = false, dryRun = false } = options;

  const wixData = loadJSON('data/mcp-scrape/products-full.json');
  if (!wixData) {
    console.error('ERROR: data/mcp-scrape/products-full.json not found');
    process.exit(1);
  }

  const catalogs = loadKDFramesCatalog();
  const products = wixData.products;

  const stats = {
    totalProducts: products.length,
    imagesAdded: 0,
    altTextGenerated: 0,
    productsEnriched: 0,
    manufacturerMatches: 0,
  };

  const enriched = products.map(product => {
    const result = { ...product };
    let modified = false;

    // ── Image enrichment ──────────────────────────────────────
    if (!altTextOnly) {
      const match = findManufacturerMatch(product.name, catalogs);
      if (match && match.images.length > 0) {
        stats.manufacturerMatches++;
        const currentMedia = result.media || [];
        const newUrls = deduplicateImages(currentMedia, match.images);

        if (newUrls.length > 0) {
          const newMedia = newUrls.map((url, i) => ({
            type: 'image',
            url,
            width: 0,  // Unknown for external — Wix will detect on upload
            height: 0,
            alt: generateManufacturerAltText(
              product.name, url, currentMedia.length + i, match.manufacturer
            ),
            source: match.manufacturer,
          }));

          result.media = [...currentMedia, ...newMedia];
          stats.imagesAdded += newUrls.length;
          modified = true;
        }
      }
    }

    // ── Alt text generation ───────────────────────────────────
    if (!imagesOnly) {
      const media = result.media || [];
      for (let i = 0; i < media.length; i++) {
        if (!media[i].alt || media[i].alt.length < 10) {
          media[i].alt = generateAltText(result, i, media[i]);
          stats.altTextGenerated++;
          modified = true;
        }
      }
      result.media = media;
    }

    if (modified) stats.productsEnriched++;
    return result;
  });

  const output = {
    ...wixData,
    products: enriched,
    _enrichment: {
      enrichedAt: new Date().toISOString(),
      stats,
      options: { altTextOnly, imagesOnly, dryRun },
    },
  };

  return { output, stats };
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const altTextOnly = args.includes('--alt-text');
  const imagesOnly = args.includes('--images');
  const dryRun = args.includes('--dry-run');

  console.log('Enriching product images...');
  if (altTextOnly) console.log('  Mode: alt text only');
  if (imagesOnly) console.log('  Mode: images only');
  if (dryRun) console.log('  Mode: dry run (no write)');

  const { output, stats } = enrichProducts({ altTextOnly, imagesOnly, dryRun });

  console.log();
  console.log(`Products processed:     ${stats.totalProducts}`);
  console.log(`Products enriched:      ${stats.productsEnriched}`);
  console.log(`Manufacturer matches:   ${stats.manufacturerMatches}`);
  console.log(`Images added:           ${stats.imagesAdded}`);
  console.log(`Alt text generated:     ${stats.altTextGenerated}`);

  if (!dryRun) {
    const outPath = writeJSON('data/mcp-scrape/products-enriched.json', output);
    console.log(`\nWritten to: ${outPath}`);
  } else {
    console.log('\nDry run — no files written.');
  }

  return { output, stats };
}

if (require.main === module) {
  main();
}

module.exports = {
  enrichProducts,
  generateAltText,
  generateManufacturerAltText,
  findManufacturerMatch,
  deduplicateImages,
  extractMediaId,
  normalizeForMatch,
  CATEGORY_LABELS,
};
