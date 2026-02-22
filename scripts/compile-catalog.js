#!/usr/bin/env node
/**
 * compile-catalog.js — Parse JSON-LD scrape output into CMS-ready catalog JSON
 * For cf-k73 and cf-41p: Carolina Futons product catalog scrape
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '/private/tmp/claude-501/-Users-hal-gt-cfutons-crew-caesar/tasks/b0dd167.output';
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'mayor', 'rig', 'content');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'catalog-scrape-carolinafutons.json');
const CONTENT_DIR = path.join(__dirname, '..', 'content');

// Manual category overrides for products with generic names
const CATEGORY_OVERRIDES = {
  'portofino': 'futon-frames',
  'monterey': 'futon-frames',
  'sunrise': 'futon-frames',
  'autumn': 'futon-frames',
  'key-west': 'futon-frames',
  'winter': 'futon-frames',
  'solstice': 'futon-frames',
  'albany': 'futon-frames',
  'venice': 'futon-frames',
  'rosemary': 'platform-beds',
  'tamarind': 'platform-beds',
  'nutmeg-platform-bed': 'platform-beds',
  'solstice-1': 'platform-beds',
  'mesa-3000': 'mattresses',
  'cambridge': 'mattresses',
  'canby': 'wall-hugger-frames',
  'durango': 'wall-hugger-frames',
  'denali': 'wall-hugger-frames',
  'rockwell': 'wall-hugger-frames',
  'pagoda': 'wall-hugger-frames',
  'tozi': 'wall-hugger-frames',
  'galena': 'wall-hugger-frames',
  'dillon': 'wall-hugger-frames',
  'tiro': 'wall-hugger-frames',
  'lambton': 'wall-hugger-frames',
  'bali': 'front-loading-nesting',
  'raleigh': 'front-loading-nesting',
};

// Category classification rules
function classifyCategory(name, description, url) {
  const n = (name || '').toLowerCase();
  const d = (description || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const slug = (u.split('/').pop() || '').toLowerCase();

  // Check manual overrides first
  if (CATEGORY_OVERRIDES[slug]) return CATEGORY_OVERRIDES[slug];

  if (n.includes('murphy') || n.includes('cabinet bed')) return 'murphy-cabinet-beds';
  if (n.includes('log futon')) return 'futon-frames';
  if (n.includes('futon frame') || (n.includes('futon') && !n.includes('mattress') && !n.includes('protector'))) {
    if (d.includes('wall hugger') || d.includes('wall-hugger')) return 'wall-hugger-frames';
    if (d.includes('nesting') || d.includes('front-loading') || d.includes('front loading')) return 'front-loading-nesting';
    return 'futon-frames';
  }
  if (n.includes('platform bed') || n.includes('basic bed') || (d.includes('platform bed') && !n.includes('drawer') && !n.includes('leg'))) return 'platform-beds';
  if (n.includes('lounger')) return 'futon-frames';
  if (n.includes('studio frame')) return 'futon-frames';
  if (n.includes('mattress') || n.includes('haley') || n.includes('moonshadow')) return 'mattresses';
  if (n.includes('chest') || n.includes('dresser') || n.includes('nightstand') || n.includes('drawer') ||
      n.includes('protector') || n.includes('accessories') || n.includes('center legs') ||
      n.includes('leg length') || n.includes('trundle')) return 'casegoods-accessories';
  // Check description for frame indicators
  if (d.includes('futon frame') || d.includes('moonglider') || d.includes('moon glider') ||
      d.includes('loveseat w/ottoman') || d.includes('sofa to bed') || d.includes('sofa, reclined, and bed')) return 'futon-frames';
  if (d.includes('wall hugger') || d.includes('wall-hugger')) return 'wall-hugger-frames';
  if (d.includes('platform bed') || d.includes('bed rails')) return 'platform-beds';
  if (d.includes('mattress') || d.includes('foam') || d.includes('innerspring')) return 'mattresses';
  return 'uncategorized';
}

// Extract finishes/swatches from description
function extractSwatches(description) {
  const swatches = new Set();
  const finishPatterns = [
    /available in[^.]*?(?:finishes?)?[:\s]+([^.]+)/gi,
    /(?:cherry|chocolate|natural|stonewash|white|black walnut|dark chocolate|espresso|warm cherry|dark cherry|honey pine|clear|gray|brushed driftwood|skye|antique blue|buttercream|vintage white|seafoam|white bark|harvest brown|wildwood brown|normandy|provence|heritage brown|alpine rustic grey)/gi,
  ];
  const knownFinishes = [
    'Cherry', 'Chocolate', 'Natural', 'Stonewash Gray', 'White',
    'Black Walnut', 'Dark Chocolate', 'Espresso', 'Warm Cherry', 'Dark Cherry',
    'Honey Pine', 'Clear', 'Gray', 'Brushed Driftwood', 'Skye',
    'Antique Blue', 'Buttercream', 'Vintage White', 'Seafoam', 'White Bark',
    'Harvest Brown', 'Wildwood Brown', 'Normandy', 'Provence',
    'Heritage Brown', 'Alpine Rustic Grey'
  ];
  for (const finish of knownFinishes) {
    if (description && description.toLowerCase().includes(finish.toLowerCase())) {
      swatches.add(finish);
    }
  }
  return [...swatches];
}

// Extract sizes from description
function extractSizes(description) {
  const sizes = [];
  const sizePatterns = /(?:available in[^.]*?)?(twin|full|queen|king|cal king|california king|twin xl)/gi;
  const found = new Set();
  let match;
  while ((match = sizePatterns.exec(description || '')) !== null) {
    const size = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (!found.has(size.toLowerCase())) {
      found.add(size.toLowerCase());
      sizes.push(size);
    }
  }
  return sizes;
}

// Determine manufacturer from product data
function inferManufacturer(name, description) {
  const d = (description || '').toLowerCase();
  const n = (name || '').toLowerCase();
  if (d.includes('kd frames') || d.includes('kd lounger') || n.includes('kd ') ||
      d.includes('tulip poplar') || d.includes('made in the usa') || d.includes('athens, ga') ||
      d.includes('mountains of virginia')) return 'KD Frames';
  if (d.includes('strata') || d.includes('wall hugger') || d.includes('carriage collection')) return 'Strata Furniture';
  if (d.includes('otis bed') || d.includes('otis')) return 'Otis Bed';
  if (d.includes('norway pine') || d.includes('log futon') || n.includes('log futon')) return 'Rocky Top Log Furniture';
  if (d.includes('night & day') || d.includes('night &amp; day') || d.includes('moonglider') ||
      d.includes('moon glider') || d.includes('spices bedroom') || d.includes('spices bed') ||
      d.includes('plantation-grown') || d.includes('rubberwood') ||
      d.includes('murphy cabinet bed') || d.includes('cabinet bed')) return 'Night & Day Furniture';
  if (d.includes('arizona boutique')) return 'Arizona Premium Mattress';
  if (n.includes('mesa') || n.includes('flagstaff') || n.includes('chandler') || n.includes('sedona') ||
      n.includes('northampton') || n.includes('cambridge') || n.includes('yuma') || n.includes('gemini') ||
      n.includes('maricopa') || n.includes('mountainaire') || n.includes('asheville')) return 'Otis Bed';
  // Most furniture is Night & Day
  if (d.includes('futon') || d.includes('platform bed') || d.includes('chest') || d.includes('nightstand') ||
      d.includes('dresser')) return 'Night & Day Furniture';
  return null;
}

// Decode HTML entities
function decodeEntities(text) {
  if (!text) return text;
  return text
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#009;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse the raw output file
function parseJsonLdOutput(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const products = [];
  const lines = raw.split('\n');
  let currentSlug = null;

  for (const line of lines) {
    const slugMatch = line.match(/^===([a-z0-9-]+)===$/);
    if (slugMatch) {
      currentSlug = slugMatch[1];
      continue;
    }
    if (currentSlug && line.startsWith('{')) {
      try {
        const jsonLd = JSON.parse(line);
        if (jsonLd['@type'] === 'Product') {
          products.push({ slug: currentSlug, jsonLd });
        }
      } catch (e) {
        console.error(`Failed to parse JSON-LD for ${currentSlug}: ${e.message}`);
      }
      currentSlug = null;
    }
  }
  return products;
}

// Convert JSON-LD product to CMS schema format
function toCmsFormat(slug, jsonLd) {
  const name = decodeEntities(jsonLd.name);
  const description = decodeEntities(jsonLd.description);
  const offer = jsonLd.Offers || {};
  const price = parseFloat(offer.price) || null;
  const url = offer.url || `https://www.carolinafutons.com/product-page/${slug}`;
  const availability = (offer.Availability || '').includes('InStock') ? 'InStock' : 'OutOfStock';
  const category = classifyCategory(name, description, url);
  const swatches = extractSwatches(description);
  const sizes = extractSizes(description);
  const manufacturer = inferManufacturer(name, description);

  // Extract images (contentUrl from image array)
  const images = [];
  if (Array.isArray(jsonLd.image)) {
    for (const img of jsonLd.image) {
      if (img.contentUrl) {
        // Use higher resolution URLs
        const highRes = img.contentUrl.replace(/w_500,h_500/, 'w_2000,h_2000');
        images.push(highRes);
      }
    }
  }

  // Build variants from sizes + swatches
  const variants = [];
  if (sizes.length > 0 && swatches.length > 0) {
    for (const size of sizes) {
      for (const swatch of swatches) {
        variants.push({ label: `${size} / ${swatch}`, sku: null, price: null });
      }
    }
  } else if (sizes.length > 0) {
    for (const size of sizes) {
      variants.push({ label: size, sku: null, price: null });
    }
  } else if (swatches.length > 0) {
    for (const swatch of swatches) {
      variants.push({ label: swatch, sku: null, price: null });
    }
  }

  return {
    name,
    sku: null,
    price: price === 0 ? null : price,
    description,
    category,
    manufacturer,
    url,
    availability,
    variants,
    images,
    dimensions: { width: null, depth: null, height: null, weight: null },
    swatches,
    sizes,
    bundleCompatible: category !== 'murphy-cabinet-beds',
    sustainability: { materialSource: null, recyclable: null },
    careGuide: null,
    assemblyDifficulty: null,
    contactForPrice: price === 0 || (description && description.toLowerCase().includes('contact for')),
  };
}

// Main
function main() {
  console.log('Parsing JSON-LD output...');
  const parsed = parseJsonLdOutput(INPUT_FILE);
  console.log(`Parsed ${parsed.length} products from JSON-LD`);

  const catalog = parsed.map(p => toCmsFormat(p.slug, p.jsonLd));

  // Category stats
  const categories = {};
  for (const p of catalog) {
    categories[p.category] = (categories[p.category] || 0) + 1;
  }
  console.log('\nCategory breakdown:');
  for (const [cat, count] of Object.entries(categories).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Availability stats
  const inStock = catalog.filter(p => p.availability === 'InStock').length;
  const outOfStock = catalog.filter(p => p.availability === 'OutOfStock').length;
  console.log(`\nAvailability: ${inStock} InStock, ${outOfStock} OutOfStock`);

  // Price range
  const priced = catalog.filter(p => p.price > 0);
  const prices = priced.map(p => p.price);
  console.log(`Price range: $${Math.min(...prices)} - $${Math.max(...prices)} (${priced.length} priced, ${catalog.length - priced.length} contact-for-price or null)`);

  // Write output
  const output = {
    _meta: {
      source: 'carolinafutons.com',
      scrapeDate: new Date().toISOString(),
      totalProducts: catalog.length,
      method: 'JSON-LD structured data extraction from Wix site',
      categories,
      availability: { inStock, outOfStock },
    },
    products: catalog
  };

  // Write to mayor/rig/content
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWritten to: ${OUTPUT_FILE}`);

  // Write to local content dir
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const localFile = path.join(CONTENT_DIR, 'carolinafutons-products.json');
  fs.writeFileSync(localFile, JSON.stringify(output, null, 2));
  console.log(`Written to: ${localFile}`);

  return output;
}

main();
