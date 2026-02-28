// Product image fallback system for Carolina Futons
// Category hero/card images use Unsplash placeholders (replaced when real assets uploaded to Wix Media Manager)
// Product fallback images use real wixstatic.com URLs from the live catalog

// ── Category Hero Images (1920x600) ─────────────────────────────────
// These are page-level decorative images — replace with Wix Media uploads per MEDIA_MANIFEST.md
// Curated lifestyle room scenes — warm interiors, styled rooms matching Blue Ridge aesthetic
const categoryHeroImages = {
  'futon-frames': 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=1920&h=600&fit=crop&crop=center',
  'mattresses': 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1920&h=600&fit=crop&crop=center',
  'murphy-cabinet-beds': 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=1920&h=600&fit=crop&crop=center',
  'platform-beds': 'https://images.unsplash.com/photo-1616627561839-074385245ff6?w=1920&h=600&fit=crop&crop=center',
  'casegoods-accessories': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&h=600&fit=crop&crop=center',
  'wall-huggers': 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=1920&h=600&fit=crop&crop=center',
  'unfinished-wood': 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=1920&h=600&fit=crop&crop=center',
};

// ── Category Card Images (600x400, 3:2 ratio for homepage) ──────────
// Curated lifestyle room scenes — Castlery/Article style (warm, styled rooms)
const categoryCategoryCards = {
  'futon-frames': 'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&h=400&fit=crop&crop=center',
  'mattresses': 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=400&fit=crop&crop=center',
  'murphy-cabinet-beds': 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=600&h=400&fit=crop&crop=center',
  'platform-beds': 'https://images.unsplash.com/photo-1616627561839-074385245ff6?w=600&h=400&fit=crop&crop=center',
  'casegoods-accessories': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop&crop=center',
  'wall-huggers': 'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=600&h=400&fit=crop&crop=center',
  'unfinished-wood': 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?w=600&h=400&fit=crop&crop=center',
  'sales': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop&crop=center',
};

// ── Product Fallback Images (real wixstatic.com catalog images) ──────
// Used when a product has no mainMedia. Sourced from catalog-MASTER.json.
// Each category uses real product photos from the live carolinafutons.com site.
const productImages = {
  'futon-frames': [
    'https://static.wixstatic.com/media/e04e89_bd61c37885e04934b0d219eb23c5d36f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_677c5e7ae28c42f79c25fd5182191e21~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_9d703e0c25444946ab49296181d9ca2c~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_8d3bd05dd2a94ac698cc7d301fb6b4b0~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_db236e3df36f405d9e1a3f7cd8423f2f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'mattresses': [
    'https://static.wixstatic.com/media/e04e89_0c35989bde4d4ece9f0c91eed30a4aad~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_6f77fe2498b34c4295b48e0677300a19~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_07621d698bdd4ab6a62b372d433fdb22~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_354d2b79d3004c6e95e629a6d99d2e8e~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_0eb04eaa5f7f4ebfb28e59ac8dbc7372~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'murphy-cabinet-beds': [
    'https://static.wixstatic.com/media/e04e89_3887b1acf16f4360979b0a66479934ac~mv2.png/v1/fit/w_800,h_800,q_90/file.png',
    'https://static.wixstatic.com/media/e04e89_229fba0bcb404fda873a0552e7e39089~mv2.png/v1/fit/w_800,h_800,q_90/file.png',
    'https://static.wixstatic.com/media/e04e89_431e9254845144ce8ee4baed220b643e~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_d1838922ab7f4ed983c3c99e0fe95ff7~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_08a15287a88145c899f30248a02eb10a~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_4681ba492fcf41a4a7e967a932b01a22~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'platform-beds': [
    'https://static.wixstatic.com/media/e04e89_1dd7f840025044478981e6e883863d55~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_8bb00365ccdc4f33b899c2832e00832d~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_b9d4cf76a1a84bf5bb4821edc53f6df2~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_73b01be3988f4e1db8bc8d8cdf05eee3~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_5d529812f06b498f92066d0d83ab5da8~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'casegoods-accessories': [
    'https://static.wixstatic.com/media/e04e89_b32fbaec605244aa9809db1db8f92a31~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_5d98d248177a4954899d45797a23d81c~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_f5b83ac9a7204d5b95192a314749de6f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_c69e4321e4624ad6a498f79e3b95fb7a~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'wall-huggers': [
    'https://static.wixstatic.com/media/e04e89_241b8a589d964e41a3094fbcd1597728~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_a1f34879775849259ca38821606c1733~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_9368fd12e5be4002852bc42c6f81cda5~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_b9f7b2d45dac4fb7bc05533c0c3e6a6e~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
  'unfinished-wood': [
    'https://static.wixstatic.com/media/e04e89_bd61c37885e04934b0d219eb23c5d36f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_9234577e395e4eb180cb2c9bc936d65f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_677c5e7ae28c42f79c25fd5182191e21~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
    'https://static.wixstatic.com/media/e04e89_9d703e0c25444946ab49296181d9ca2c~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg',
  ],
};

// ── Homepage Hero Image (1920x800, Blue Ridge cabin lifestyle) ────────
// Full-bleed lifestyle hero — warm wood, natural light, mountain cabin aesthetic
// Replace with Wix Media upload per MEDIA_MANIFEST.md when real asset is ready
const HOMEPAGE_HERO = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&h=800&fit=crop&crop=center';

// ── Fallback (generic product image from catalog) ────────────────────
const FALLBACK_IMAGE = 'https://static.wixstatic.com/media/e04e89_bd61c37885e04934b0d219eb23c5d36f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg';
const FALLBACK_HERO = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&h=600&fit=crop&crop=center';

/**
 * Get the homepage hero image — full-bleed Blue Ridge cabin lifestyle photo.
 * @returns {string} Image URL sized 1920x800
 */
export function getHomepageHeroImage() {
  return HOMEPAGE_HERO;
}

/**
 * Get a hero image URL for a category page header.
 * @param {string} categorySlug - e.g. 'futon-frames', 'mattresses'
 * @returns {string} Image URL sized 1920x600
 */
export function getCategoryHeroImage(categorySlug) {
  return categoryHeroImages[categorySlug] || FALLBACK_HERO;
}

/**
 * Get a category card image for homepage showcase.
 * @param {string} categorySlug
 * @returns {string} Image URL sized 600x400 (3:2)
 */
export function getCategoryCardImage(categorySlug) {
  return categoryCategoryCards[categorySlug] || FALLBACK_IMAGE;
}

/**
 * Get fallback product images for a given category.
 * Uses real product photos from the live catalog on Wix CDN.
 * @param {string} categorySlug - e.g. 'futon-frames'
 * @param {number} count - Number of images to return (cycles if > available)
 * @returns {string[]} Array of image URLs sized 800x800
 */
export function getPlaceholderProductImages(categorySlug, count) {
  const images = productImages[categorySlug] || productImages['futon-frames'];
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(images[i % images.length]);
  }
  return result;
}

/**
 * Get a single product fallback image (for products without mainMedia).
 * @param {string} [categorySlug] - Optional category for category-specific fallback
 * @returns {string} Image URL sized 800x800
 */
export function getProductFallbackImage(categorySlug) {
  if (categorySlug && productImages[categorySlug]) {
    return productImages[categorySlug][0];
  }
  return FALLBACK_IMAGE;
}

/**
 * Get a grid-sized thumbnail for a product card.
 * Adjusts Wix Media transform params for 400x400 output.
 * @param {string} imageUrl - Source image URL
 * @returns {string} Resized URL (400x400)
 */
export function getGridThumbnail(imageUrl) {
  if (!imageUrl) return resizeWixImage(FALLBACK_IMAGE, 400, 400);
  return resizeWixImage(imageUrl, 400, 400);
}

/**
 * Get a gallery thumbnail (100x100).
 * @param {string} imageUrl - Source image URL
 * @returns {string} Resized URL (100x100)
 */
export function getGalleryThumbnail(imageUrl) {
  if (!imageUrl) return resizeWixImage(FALLBACK_IMAGE, 100, 100);
  return resizeWixImage(imageUrl, 100, 100);
}

/**
 * Resize a wixstatic.com image URL by replacing transform params.
 * Falls back to string replacement for non-Wix URLs.
 * @param {string} url - Image URL
 * @param {number} w - Target width
 * @param {number} h - Target height
 * @returns {string} Resized URL
 */
function resizeWixImage(url, w, h) {
  if (!url) return FALLBACK_IMAGE;
  // Handle wixstatic.com URLs — replace w_/h_ params in transform path
  if (url.includes('static.wixstatic.com')) {
    return url.replace(/w_\d+/, `w_${w}`).replace(/h_\d+/, `h_${h}`);
  }
  // Fallback for Unsplash-style URLs
  return url.replace(/w=\d+/, `w=${w}`).replace(/h=\d+/, `h=${h}`);
}
