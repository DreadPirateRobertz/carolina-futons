// Placeholder image system for Carolina Futons
// Provides category-mapped placeholder images for layout testing
// Uses Unsplash free stock photos sized for furniture/home categories

// ── Category Hero Images (1920x600) ─────────────────────────────────
const categoryHeroImages = {
  'futon-frames': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&h=600&fit=crop&crop=center',
  'mattresses': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1920&h=600&fit=crop&crop=center',
  'murphy-cabinet-beds': 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1920&h=600&fit=crop&crop=center',
  'platform-beds': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1920&h=600&fit=crop&crop=center',
  'casegoods-accessories': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=1920&h=600&fit=crop&crop=center',
  'wall-huggers': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1920&h=600&fit=crop&crop=center',
  'unfinished-wood': 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=1920&h=600&fit=crop&crop=center',
};

// ── Category Card Images (600x400, 3:2 ratio for homepage) ──────────
const categoryCategoryCards = {
  'futon-frames': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop&crop=center',
  'mattresses': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop&crop=center',
  'murphy-cabinet-beds': 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&h=400&fit=crop&crop=center',
  'platform-beds': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&h=400&fit=crop&crop=center',
  'casegoods-accessories': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=600&h=400&fit=crop&crop=center',
  'wall-huggers': 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop&crop=center',
  'unfinished-wood': 'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=600&h=400&fit=crop&crop=center',
};

// ── Product Placeholder Images (400x400 grid, 800x800 detail) ───────
// Multiple images per category for gallery testing
const productImages = {
  'futon-frames': [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=800&fit=crop&crop=center',
  ],
  'mattresses': [
    'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1592229505726-ca121723b8ef?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=800&fit=crop&crop=center',
  ],
  'murphy-cabinet-beds': [
    'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1618220179428-22790b461013?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=800&fit=crop&crop=center',
  ],
  'platform-beds': [
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1588046130717-0eb0c9a3ba15?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1598928506311-c55ez637643e?w=800&h=800&fit=crop&crop=center',
  ],
  'casegoods-accessories': [
    'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1616627547584-bf28cee262db?w=800&h=800&fit=crop&crop=center',
  ],
  'wall-huggers': [
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&h=800&fit=crop&crop=center',
  ],
  'unfinished-wood': [
    'https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=800&h=800&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=800&h=800&fit=crop&crop=center',
  ],
};

// ── Fallback (generic furniture placeholder) ────────────────────────
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&h=800&fit=crop&crop=center';
const FALLBACK_HERO = 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920&h=600&fit=crop&crop=center';

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
 * Get placeholder product images for a given category.
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
 * Takes an 800x800 source URL and returns a 400x400 version.
 * @param {string} imageUrl - Source image URL
 * @returns {string} Resized URL (400x400)
 */
export function getGridThumbnail(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE.replace('w=800&h=800', 'w=400&h=400');
  return imageUrl.replace('w=800&h=800', 'w=400&h=400');
}

/**
 * Get a gallery thumbnail (100x100).
 * @param {string} imageUrl - Source image URL
 * @returns {string} Resized URL (100x100)
 */
export function getGalleryThumbnail(imageUrl) {
  if (!imageUrl) return FALLBACK_IMAGE.replace('w=800&h=800', 'w=100&h=100');
  return imageUrl.replace('w=800&h=800', 'w=100&h=100');
}
