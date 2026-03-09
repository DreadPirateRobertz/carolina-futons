const catalog = require('../content/catalog-MASTER.json');
const fs = require('fs');

const folderMap = {
  'futon-frames': '/products/futon-frames',
  'mattresses': '/products/mattresses',
  'murphy-cabinet-beds': '/products/murphy-cabinet-beds',
  'platform-beds': '/products/platform-beds',
  'outdoor-furniture': '/products/outdoor-furniture',
  'casegoods-accessories': '/products/casegoods-accessories',
  'covers': '/products/covers',
  'pillows-702': '/products/pillows',
  'log-frames': '/products/log-frames',
};

let totalImages = 0;
const noImages = [];
const summary = {};

const manifest = catalog.products.map(p => {
  const folder = folderMap[p.category] || '/products/' + p.category;
  const images = p.images || [];
  totalImages += images.length;
  if (images.length === 0) noImages.push({ name: p.name, slug: p.slug, category: p.category });
  if (!summary[p.category]) summary[p.category] = { count: 0, images: 0, noImages: 0 };
  summary[p.category].count++;
  summary[p.category].images += images.length;
  if (images.length === 0) summary[p.category].noImages++;
  return { name: p.name, slug: p.slug, sku: p.sku, category: p.category, folder, imageCount: images.length, images };
});

console.log('=== SUMMARY ===');
console.log('Total products:', catalog.totalProducts);
console.log('Total images:', totalImages);
console.log('Products with no images:', noImages.length);
console.log('');
console.log('=== BY CATEGORY ===');
for (const [cat, s] of Object.entries(summary)) {
  console.log(`  ${cat}: ${s.count} products, ${s.images} images, ${s.noImages} missing`);
}
console.log('');
console.log('=== PRODUCTS WITH NO IMAGES ===');
noImages.forEach(p => console.log(`  ${p.slug} (${p.category})`));

// Check for duplicate image URLs
const allUrls = manifest.flatMap(p => p.images);
const urlCounts = {};
allUrls.forEach(u => { urlCounts[u] = (urlCounts[u] || 0) + 1; });
const dupes = Object.entries(urlCounts).filter(([, c]) => c > 1);
console.log('');
console.log('=== DUPLICATE IMAGES (shared across products) ===');
console.log('Duplicate URLs:', dupes.length);
dupes.forEach(([url, count]) => {
  const products = manifest.filter(p => p.images.includes(url)).map(p => p.slug);
  console.log(`  [${count}x] ${url.substring(0, 80)}... → ${products.join(', ')}`);
});

// Check for non-wix URLs
const nonWix = allUrls.filter(u => !u.includes('wixstatic.com'));
console.log('');
console.log('=== NON-WIX URLS ===');
console.log('Count:', nonWix.length);
nonWix.slice(0, 5).forEach(u => console.log(`  ${u}`));

// Check folder coverage vs mediaGallery expectations
console.log('');
console.log('=== FOLDER MAPPING ===');
for (const [cat, folder] of Object.entries(folderMap)) {
  const catProducts = manifest.filter(p => p.category === cat);
  const withImages = catProducts.filter(p => p.imageCount > 0).length;
  const totalImgs = catProducts.reduce((sum, p) => sum + p.imageCount, 0);
  console.log(`  ${folder}: ${catProducts.length} products, ${withImages} with images, ${totalImgs} total images`);
}

// Categories in catalog but not in mediaGallery folderMap
const unmappedCats = [...new Set(catalog.products.map(p => p.category))].filter(c => !folderMap[c]);
if (unmappedCats.length > 0) {
  console.log('');
  console.log('=== UNMAPPED CATEGORIES (not in mediaGallery.web.js) ===');
  unmappedCats.forEach(c => console.log(`  ${c} — needs folder /products/${c}`));
}

// Write manifest
fs.writeFileSync('docs/product-image-manifest.json', JSON.stringify(manifest, null, 2));
console.log('');
console.log('Full manifest written to docs/product-image-manifest.json');
