// Home.c1dmp.js - Homepage
// "Handcrafted Comfort, Mountain Inspired."
// Featured products, category showcase, recently viewed, trust signals, testimonials
import { getFeaturedProducts, getSaleProducts } from 'backend/productRecommendations.web';
import { getWebSiteSchema } from 'backend/seoHelpers.web';
import { getRecentlyViewed, buildRecentlyViewedSection } from 'public/galleryHelpers.js';
import { getCategoryHeroImage, getCategoryCardImage } from 'public/placeholderImages.js';
import wixData from 'wix-data';

// ── Category metadata for all 8 categories ──────────────────────────
const CATEGORIES = [
  { _id: 'futonFrames', elementId: '#categoryFutonFrames', name: 'Futon Frames', tagline: 'Solid hardwood, built to last', path: '/futon-frames', collection: 'futon-frames' },
  { _id: 'mattresses', elementId: '#categoryMattresses', name: 'Futon Mattresses', tagline: 'CertiPUR-US certified comfort', path: '/mattresses', collection: 'mattresses' },
  { _id: 'murphy', elementId: '#categoryMurphy', name: 'Murphy Cabinet Beds', tagline: 'No wall mount needed', path: '/murphy-cabinet-beds', collection: 'murphy-cabinet-beds' },
  { _id: 'platformBeds', elementId: '#categoryPlatformBeds', name: 'Platform Beds', tagline: 'Clean lines, solid wood', path: '/platform-beds', collection: 'platform-beds' },
  { _id: 'casegoods', elementId: '#categoryCasegoods', name: 'Casegoods & Accessories', tagline: 'Complete the bedroom', path: '/casegoods-accessories', collection: 'casegoods-accessories' },
  { _id: 'sale', elementId: '#categorySale', name: 'Sale & Clearance', tagline: 'Handcrafted deals', path: '/sales', collection: null },
  { _id: 'wallHuggers', elementId: '#categoryWallHuggers', name: 'Wall Hugger Frames', tagline: 'Patented space-saving design', path: '/wall-huggers', collection: 'wall-huggers' },
  { _id: 'unfinished', elementId: '#categoryUnfinished', name: 'Unfinished Wood Furniture', tagline: 'Made in USA, ready to finish', path: '/unfinished-wood', collection: 'unfinished-wood' },
];

$w.onReady(async function () {
  await Promise.all([
    loadFeaturedProducts(),
    loadSaleHighlights(),
    initCategoryShowcase(),
    initHeroAnimation(),
    injectHomeSchemas(),
    initRecentlyViewed(),
    initTrustBar(),
    initTestimonials(),
  ]);
  initSmoothScroll();
});

// ── Featured Products ("Our Favorite Finds") ────────────────────────
// Displays curated product selection in a grid

async function loadFeaturedProducts() {
  try {
    const featured = await getFeaturedProducts(8);
    const repeater = $w('#featuredRepeater');
    if (!repeater || featured.length === 0) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#featuredImage').src = itemData.mainMedia;
      $item('#featuredImage').alt = buildProductAlt(itemData, 'featured');
      $item('#featuredName').text = itemData.name;
      $item('#featuredPrice').text = itemData.formattedPrice;

      // Show sale badge if discounted
      if (itemData.formattedDiscountedPrice) {
        $item('#featuredPrice').text = itemData.formattedDiscountedPrice;
        try {
          $item('#featuredOriginalPrice').text = itemData.formattedPrice;
          $item('#featuredOriginalPrice').show();
          $item('#featuredSaleBadge').show();
        } catch (e) { /* optional elements */ }
      }

      // Navigate to product page on click
      $item('#featuredImage').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });

      $item('#featuredName').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
    repeater.data = featured;
  } catch (err) {
    console.error('Error loading featured products:', err);
  }
}

// ── Sale Highlights ─────────────────────────────────────────────────
// Shows current sale items in a horizontal scroll section

async function loadSaleHighlights() {
  try {
    const saleItems = await getSaleProducts(6);
    const repeater = $w('#saleRepeater');
    if (!repeater || saleItems.length === 0) {
      try { $w('#saleSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      $item('#saleImage').src = itemData.mainMedia;
      $item('#saleImage').alt = buildProductAlt(itemData, 'sale');
      $item('#saleName').text = itemData.name;
      $item('#salePrice').text = itemData.formattedDiscountedPrice || itemData.formattedPrice;
      try {
        $item('#saleOrigPrice').text = itemData.formattedPrice;
      } catch (e) {}

      $item('#saleImage').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
    repeater.data = saleItems;
  } catch (err) {
    console.error('Error loading sale highlights:', err);
  }
}

// ── Category Showcase ───────────────────────────────────────────────
// All 8 categories with content injection (name, tagline, product count)

async function initCategoryShowcase() {
  // Fetch product counts for all categories in parallel
  const countPromises = CATEGORIES.map(async (cat) => {
    if (!cat.collection) return { ...cat, count: null };
    try {
      const count = await wixData.query('Stores/Products')
        .hasSome('collections', [cat.collection])
        .count();
      return { ...cat, count };
    } catch (e) {
      return { ...cat, count: null };
    }
  });

  const categoriesWithCounts = await Promise.all(countPromises);

  // Set up repeater if it exists (preferred: shared element IDs per card)
  try {
    const repeater = $w('#categoryRepeater');
    if (repeater) {
      repeater.data = categoriesWithCounts;
      repeater.onItemReady(($item, itemData) => {
        try { $item('#categoryCardTitle').text = itemData.name; } catch (e) {}
        try { $item('#categoryCardTagline').text = itemData.tagline; } catch (e) {}
        try {
          $item('#categoryCardCount').text = itemData.count != null
            ? `${itemData.count} Products` : '';
        } catch (e) {}
        $item('#categoryCardTitle').onClick(() => {
          import('wix-location').then(({ to }) => to(itemData.path));
        });
      });
    }
  } catch (e) {
    // Repeater may not exist
  }

  // Also wire up individual card click handlers (backward compatible)
  categoriesWithCounts.forEach((cat) => {
    try {
      $w(cat.elementId).onClick(() => {
        import('wix-location').then(({ to }) => to(cat.path));
      });
    } catch (e) {
      // Card element may not exist in editor
    }
  });
}

// ── Recently Viewed ─────────────────────────────────────────────────
// Shows products the visitor has browsed this session

async function initRecentlyViewed() {
  try {
    const recent = getRecentlyViewed();
    if (!recent || recent.length === 0) {
      try { $w('#recentSection').collapse(); } catch (e) {}
      return;
    }

    // Use buildRecentlyViewedSection from galleryHelpers (added by cf-vw0)
    buildRecentlyViewedSection('#recentRepeater', ($item, itemData) => {
      $item('#recentImage').src = itemData.mainMedia;
      $item('#recentImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#recentName').text = itemData.name;
      $item('#recentPrice').text = itemData.price;

      $item('#recentImage').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
      $item('#recentName').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });

    $w('#recentSection').expand();
  } catch (e) {
    // Recently viewed section may not exist or galleryHelpers not ready
    try { $w('#recentSection').collapse(); } catch (e2) {}
  }
}

// ── Trust Bar ───────────────────────────────────────────────────────
// Animated trust signals strip with key selling points

function initTrustBar() {
  const trustSignals = [
    { id: '#trustItem1', text: 'Largest Selection in the Carolinas', icon: 'mountain' },
    { id: '#trustItem2', text: 'Family Owned Since 1991', icon: 'heart' },
    { id: '#trustItem3', text: '700+ Fabric Swatches', icon: 'palette' },
    { id: '#trustItem4', text: 'Free Shipping Over $999', icon: 'truck' },
  ];

  try {
    const trustBar = $w('#trustBar');
    if (!trustBar) return;

    // Staggered fade-in for each trust item
    trustSignals.forEach((signal, index) => {
      try {
        const element = $w(signal.id);
        if (element) {
          element.show('fade', { duration: 400, delay: 200 + (index * 150) });
        }
      } catch (e) {}
    });
  } catch (e) {
    // Trust bar may not exist
  }
}

// ── Testimonials ────────────────────────────────────────────────────
// Customer reviews section with rotating quotes

function initTestimonials() {
  const testimonials = [
    {
      _id: 'test1',
      quote: 'The quality of our Night & Day futon frame is outstanding. It looks like a real piece of furniture, not a dorm room couch. Love it!',
      name: 'Sarah M., Asheville NC',
    },
    {
      _id: 'test2',
      quote: 'Brenda helped us find the perfect Murphy cabinet bed for our guest room. The whole experience — from browsing to delivery — was wonderful.',
      name: 'James & Linda K., Hendersonville NC',
    },
    {
      _id: 'test3',
      quote: 'We drove from Charlotte just to see the fabric swatches in person. So glad we did — our futon mattress is exactly what we wanted.',
      name: 'Michelle T., Charlotte NC',
    },
    {
      _id: 'test4',
      quote: 'Best furniture shopping experience we\'ve had. Knowledgeable staff, beautiful showroom, and the platform bed we bought is solid as a rock.',
      name: 'David R., Greenville SC',
    },
  ];

  try {
    const repeater = $w('#testimonialRepeater');
    if (!repeater) return;

    repeater.data = testimonials;
    repeater.onItemReady(($item, itemData) => {
      try { $item('#testimonialQuote').text = `"${itemData.quote}"`; } catch (e) {}
      try { $item('#testimonialName').text = `— ${itemData.name}`; } catch (e) {}
    });
  } catch (e) {
    // Testimonials section may not exist
  }
}

// ── Smooth Scroll ───────────────────────────────────────────────────
// Smooth scroll anchors for in-page navigation between sections

function initSmoothScroll() {
  const scrollTargets = {
    '#scrollToFeatured': '#featuredRepeater',
    '#scrollToCategories': '#categoryRepeater',
    '#scrollToSale': '#saleSection',
    '#scrollToReviews': '#testimonialRepeater',
  };

  Object.entries(scrollTargets).forEach(([triggerId, targetId]) => {
    try {
      $w(elementId).onClick(() => {
        import('wix-location-frontend').then(({ to }) => to(path));
      });

      // Set category card background image from placeholders
      if (slug) {
        try {
          const imgId = elementId.replace('#category', '#categoryImg');
          $w(imgId).src = getCategoryCardImage(slug);
        } catch (e) {
          // Image element may not exist or use different naming
        }
      }
    } catch (e) {
      // Scroll trigger may not exist
    }
  });

  // Set hero section background image
  try {
    $w('#heroBackground').src = getCategoryHeroImage('futon-frames');
  } catch (e) {
    // Hero background element may not exist
  }
}

// ── Hero Animation ──────────────────────────────────────────────────
// Subtle entrance animations for the mountain illustration hero

function initHeroAnimation() {
  try {
    // Set hero background from Media Manager
    try {
      const heroBg = $w('#heroBg');
      if (heroBg) {
        heroBg.src = HERO_CABIN_SCENE;
        heroBg.alt = 'Handcrafted Comfort, Mountain Inspired - Carolina Futons Hendersonville NC';
      }
    } catch (e) {}

    const heroTitle = $w('#heroTitle');
    const heroSubtitle = $w('#heroSubtitle');
    const heroCta = $w('#heroCTA');

    // Staggered fade-in
    if (heroTitle) {
      heroTitle.show('fade', { duration: 600, delay: 200 });
    }
    if (heroSubtitle) {
      heroSubtitle.show('fade', { duration: 600, delay: 500 });
    }
    if (heroCta) {
      heroCta.show('fade', { duration: 400, delay: 800 });
      heroCta.onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/shop-main'));
      });
    }
  } catch (e) {
    // Hero elements may not exist
  }
}

// ── Homepage Schema Injection ───────────────────────────────────────
// WebSite schema with SearchAction enables sitelinks searchbox in Google

async function injectHomeSchemas() {
  try {
    const schema = await getWebSiteSchema();
    if (schema) {
      $w('#websiteSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}

// ── Alt Text Helpers ────────────────────────────────────────────────

function buildProductAlt(product, context) {
  const brand = detectBrand(product);
  const category = detectCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  if (context === 'sale') parts.push('on sale');
  parts.push('Carolina Futons Hendersonville NC');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

function detectBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

function detectCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}
