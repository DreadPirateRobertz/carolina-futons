// Test product data for Carolina Futons
// Mock products for development/preview mode when Wix Stores data isn't available
// 3-4 products per category with realistic names, prices, descriptions, and multiple images

import { getPlaceholderProductImages } from 'public/placeholderImages';

function buildProducts(category, items) {
  return items.map((item, i) => {
    const images = getPlaceholderProductImages(category, 4);
    return {
      _id: `test-${category}-${i}`,
      name: item.name,
      slug: `${category}-${item.slug}`,
      description: item.description,
      price: item.price,
      formattedPrice: `$${item.price.toFixed(2)}`,
      formattedDiscountedPrice: item.salePrice ? `$${item.salePrice.toFixed(2)}` : null,
      mainMedia: images[0],
      mediaItems: images.map((src, idx) => ({
        src,
        type: 'image',
        title: `${item.name} - View ${idx + 1}`,
      })),
      collections: [category],
      ribbon: item.ribbon || '',
      inStock: item.inStock !== false,
      brand: item.brand,
      _createdDate: new Date().toISOString(),
    };
  });
}

// ── Futon Frames ────────────────────────────────────────────────────
const futonFrameItems = [
  {
    name: 'Autumn Rosewood Futon Frame',
    slug: 'autumn-rosewood',
    description: 'The Autumn Rosewood futon frame features a rich rosewood finish and front-loading design. Converts easily from sofa to bed with smooth gliding action. Solid hardwood construction by Night & Day Furniture.',
    price: 649.00,
    brand: 'Night & Day Furniture',
    ribbon: 'Best Seller',
  },
  {
    name: 'Winter Hardwood Futon Frame',
    slug: 'winter-hardwood',
    description: 'Clean Scandinavian lines in natural hardwood. The Winter frame features a nesting mechanism for compact storage. Full or queen size. Crafted by Night & Day Furniture with plantation-grown rubberwood.',
    price: 549.00,
    brand: 'Night & Day Furniture',
  },
  {
    name: 'Kingston Futon Frame - Cherry',
    slug: 'kingston-cherry',
    description: 'The Kingston frame blends mission-style warmth with modern comfort. Cherry finish on solid hardwood. Includes matching arm trays. Full size converts to standard full mattress sleeping surface.',
    price: 729.00,
    salePrice: 629.00,
    brand: 'Night & Day Furniture',
    ribbon: 'Sale',
  },
  {
    name: 'Brentwood Futon Frame - Walnut',
    slug: 'brentwood-walnut',
    description: 'Contemporary platform-style futon frame in dark walnut. Low-profile design sits 16" off the floor. Front-loading mechanism with 3-position recline. Night & Day Furniture quality construction.',
    price: 799.00,
    brand: 'Night & Day Furniture',
    ribbon: 'New',
  },
];

// ── Mattresses ──────────────────────────────────────────────────────
const mattressItems = [
  {
    name: 'Hazel 8" CertiPUR-US Futon Mattress',
    slug: 'hazel-8inch',
    description: 'The Hazel by Otis Bed features 8 inches of CertiPUR-US certified hypoallergenic foam. No springs, no flipping needed. Full or queen size. Made without chemical flame retardants.',
    price: 449.00,
    brand: 'Otis Bed',
    ribbon: 'Best Seller',
  },
  {
    name: 'Gateway 6" Futon Mattress',
    slug: 'gateway-6inch',
    description: 'Entry-level comfort from Otis Bed. 6 inches of layered foam provides firm support for sitting and sleeping. CertiPUR-US certified. Available in full and queen sizes.',
    price: 299.00,
    brand: 'Otis Bed',
  },
  {
    name: 'Moonshadow 10" Premium Futon Mattress',
    slug: 'moonshadow-10inch',
    description: 'Top-of-the-line comfort from Otis Bed. 10 inches of premium layered foam with cooling gel top layer. Designed for full-time sleepers. CertiPUR-US certified, hypoallergenic.',
    price: 649.00,
    salePrice: 549.00,
    brand: 'Otis Bed',
    ribbon: 'Sale',
  },
];

// ── Murphy Cabinet Beds ─────────────────────────────────────────────
const murphyBedItems = [
  {
    name: 'Sagebrush Murphy Cabinet Bed - White',
    slug: 'sagebrush-white',
    description: 'The Sagebrush by Night & Day Furniture is a freestanding murphy cabinet bed that requires no wall mounting. Queen mattress folds into an elegant white cabinet. Includes USB charging and storage drawer.',
    price: 1899.00,
    brand: 'Night & Day Furniture',
    ribbon: 'Best Seller',
  },
  {
    name: 'Clover Murphy Cabinet Bed - Chocolate',
    slug: 'clover-chocolate',
    description: 'Rich chocolate finish on the Clover murphy cabinet bed. Folds down to reveal a comfortable queen mattress in seconds. No tools, no wall bolts needed. Built-in nightstand surface.',
    price: 1799.00,
    brand: 'Night & Day Furniture',
  },
  {
    name: 'Orion Murphy Cabinet Bed - Cherry',
    slug: 'orion-cherry',
    description: 'The Orion features premium cherry wood finish and Night & Day Furniture\'s patented folding mechanism. Includes gel memory foam mattress, USB ports, and under-bed storage drawer.',
    price: 2199.00,
    brand: 'Night & Day Furniture',
    ribbon: 'New',
  },
];

// ── Platform Beds ───────────────────────────────────────────────────
const platformBedItems = [
  {
    name: 'Solstice Platform Bed - Natural',
    slug: 'solstice-natural',
    description: 'The Solstice platform bed by Night & Day Furniture features a clean low-profile design in natural hardwood. No box spring needed. Solid slat support for any mattress type. Queen size.',
    price: 599.00,
    brand: 'Night & Day Furniture',
  },
  {
    name: 'KD Nomad Platform Bed - Unfinished',
    slug: 'kd-nomad-unfinished',
    description: 'The Nomad platform bed by KD Frames ships flat and assembles without tools. Unfinished solid wood ready for stain or paint. Made in USA. Full, queen, and king sizes available.',
    price: 399.00,
    brand: 'KD Frames',
    ribbon: 'Made in USA',
  },
  {
    name: 'Rosemary Platform Bed - Espresso',
    slug: 'rosemary-espresso',
    description: 'Elegant espresso finish on the Rosemary platform bed. Features integrated headboard with bookcase shelf and 2 storage drawers. Night & Day Furniture quality. Queen size.',
    price: 849.00,
    salePrice: 749.00,
    brand: 'Night & Day Furniture',
    ribbon: 'Sale',
  },
];

// ── Casegoods & Accessories ─────────────────────────────────────────
const casegoodItems = [
  {
    name: 'Clove 3-Drawer Nightstand - Chocolate',
    slug: 'clove-nightstand-chocolate',
    description: 'The Clove nightstand by Night & Day Furniture matches the popular Clove bedroom collection. Three spacious drawers, solid hardwood construction. Chocolate finish.',
    price: 299.00,
    brand: 'Night & Day Furniture',
  },
  {
    name: 'Secrets 5-Drawer Dresser - Natural',
    slug: 'secrets-dresser-natural',
    description: 'The Secrets dresser offers generous storage in a compact footprint. Five smooth-glide drawers in natural hardwood finish. Part of the Night & Day Furniture bedroom collection.',
    price: 549.00,
    brand: 'Night & Day Furniture',
  },
  {
    name: 'Rosemary Armoire - White',
    slug: 'rosemary-armoire-white',
    description: 'The Rosemary armoire provides wardrobe storage with a hanging rod and adjustable shelf. Crisp white finish complements any bedroom. Solid hardwood by Night & Day Furniture.',
    price: 699.00,
    brand: 'Night & Day Furniture',
    ribbon: 'New',
  },
];

// ── Wall Huggers ────────────────────────────────────────────────────
const wallHuggerItems = [
  {
    name: 'Strata Wall Hugger Futon Frame - Espresso',
    slug: 'strata-wall-hugger-espresso',
    description: 'Strata Furniture\'s patented wall hugger mechanism keeps the frame against the wall as it reclines. No need to pull out from the wall to convert. Espresso finish on solid hardwood.',
    price: 699.00,
    brand: 'Strata Furniture',
    ribbon: 'Best Seller',
  },
  {
    name: 'Strata Wall Hugger Futon Frame - Natural',
    slug: 'strata-wall-hugger-natural',
    description: 'Space-saving wall hugger design in warm natural finish. Strata Furniture\'s patented glide-forward mechanism. Converts in seconds without moving from the wall. Full size.',
    price: 699.00,
    brand: 'Strata Furniture',
  },
  {
    name: 'Strata Wall Hugger Futon Frame - Cherry',
    slug: 'strata-wall-hugger-cherry',
    description: 'Rich cherry wood finish on Strata Furniture\'s popular wall hugger frame. Space-efficient design perfect for smaller rooms, dorms, and guest rooms. Full size mattress surface.',
    price: 749.00,
    brand: 'Strata Furniture',
  },
];

// ── Unfinished Wood ─────────────────────────────────────────────────
const unfinishedWoodItems = [
  {
    name: 'KD Lounger Futon Frame - Unfinished',
    slug: 'kd-lounger-unfinished',
    description: 'The KD Lounger is a solid wood futon frame ready for your custom finish. Sanded smooth for staining or painting. Made in the USA by KD Frames. Full size with front-loading mechanism.',
    price: 349.00,
    brand: 'KD Frames',
    ribbon: 'Made in USA',
  },
  {
    name: 'KD Armless Futon Frame - Unfinished',
    slug: 'kd-armless-unfinished',
    description: 'Minimalist armless design in unfinished solid wood. Perfect for tight spaces or paired with side tables. KD Frames quality, made in USA. Sanded and ready for your finish.',
    price: 279.00,
    brand: 'KD Frames',
  },
  {
    name: 'KD Mission Futon Frame - Unfinished',
    slug: 'kd-mission-unfinished',
    description: 'Classic mission-style futon frame in raw solid wood. Wide armrests and clean lines. Paint, stain, or leave natural. Made in USA by KD Frames. Full or queen size.',
    price: 449.00,
    salePrice: 399.00,
    brand: 'KD Frames',
    ribbon: 'Sale',
  },
];

// ── Exports ─────────────────────────────────────────────────────────

export const testProductsByCategory = {
  'futon-frames': buildProducts('futon-frames', futonFrameItems),
  'mattresses': buildProducts('mattresses', mattressItems),
  'murphy-cabinet-beds': buildProducts('murphy-cabinet-beds', murphyBedItems),
  'platform-beds': buildProducts('platform-beds', platformBedItems),
  'casegoods-accessories': buildProducts('casegoods-accessories', casegoodItems),
  'wall-huggers': buildProducts('wall-huggers', wallHuggerItems),
  'unfinished-wood': buildProducts('unfinished-wood', unfinishedWoodItems),
};

/**
 * Get test products for a specific category.
 * @param {string} categorySlug
 * @returns {object[]} Array of mock product objects
 */
export function getTestProducts(categorySlug) {
  return testProductsByCategory[categorySlug] || [];
}

/**
 * Get all test products across all categories.
 * @returns {object[]} Flat array of all mock products
 */
export function getAllTestProducts() {
  return Object.values(testProductsByCategory).flat();
}

/**
 * Get a random selection of test products for featured display.
 * @param {number} count
 * @returns {object[]}
 */
export function getFeaturedTestProducts(count) {
  const all = getAllTestProducts();
  const featured = all.filter(p => p.ribbon === 'Best Seller' || p.ribbon === 'New');
  // If not enough featured, fill from all
  while (featured.length < count && featured.length < all.length) {
    const next = all.find(p => !featured.includes(p));
    if (next) featured.push(next);
    else break;
  }
  return featured.slice(0, count);
}

/**
 * Get sale test products for homepage highlights.
 * @param {number} count
 * @returns {object[]}
 */
export function getSaleTestProducts(count) {
  const all = getAllTestProducts();
  return all.filter(p => p.formattedDiscountedPrice).slice(0, count);
}
