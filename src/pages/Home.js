// Home.js - Homepage
// "Handcrafted Comfort, Mountain Inspired."
// Featured products, category showcase, recently viewed, trust signals, testimonials
import { getFeaturedProducts, getSaleProducts } from 'backend/productRecommendations.web';
import { getWebSiteSchema } from 'backend/seoHelpers.web';
import { getRecentlyViewed, buildRecentlyViewedSection } from 'public/galleryHelpers.js';
import { getCategoryHeroImage } from 'public/placeholderImages.js';
import { isMobile, collapseOnMobile, initBackToTop, limitForViewport } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';
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
  const sections = [
    { name: 'featuredProducts', init: loadFeaturedProducts },
    { name: 'saleHighlights', init: loadSaleHighlights },
    { name: 'categoryShowcase', init: initCategoryShowcase },
    { name: 'heroAnimation', init: initHeroAnimation },
    { name: 'homeSchemas', init: injectHomeSchemas },
    { name: 'recentlyViewed', init: initRecentlyViewed },
    { name: 'trustBar', init: initTrustBar },
    { name: 'testimonials', init: initTestimonials },
    { name: 'videoShowcase', init: initVideoShowcase },
    { name: 'quizCTA', init: initQuizCTA },
  ];

  const results = await Promise.allSettled(sections.map(s => s.init()));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[Home] Section "${sections[i].name}" failed:`, result.reason);
      import('backend/errorMonitoring.web').then(({ logError }) => {
        logError({
          message: `Home page section "${sections[i].name}" failed to load`,
          stack: result.reason?.stack || String(result.reason),
          page: 'Home',
          context: `onReady/${sections[i].name}`,
          severity: 'error',
        });
      }).catch(() => {});
    }
  });

  initSmoothScroll();
  initBackToTop($w);
  trackEvent('page_view', { page: 'home' });

  // On mobile: defer non-critical sections for faster first paint
  collapseOnMobile($w, ['#testimonialSection', '#videoShowcaseSection']);
});

// ── Featured Products ("Our Favorite Finds") ────────────────────────
// Displays curated product selection in a grid

async function loadFeaturedProducts() {
  try {
    const allFeatured = await getFeaturedProducts(8);
    const featured = limitForViewport(allFeatured, { mobile: 4, tablet: 6, desktop: 8 });
    const repeater = $w('#featuredRepeater');
    if (!repeater || featured.length === 0) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#featuredImage').src = itemData.mainMedia;
      $item('#featuredImage').alt = buildProductAlt(itemData, 'featured');
      $item('#featuredName').text = itemData.name;
      $item('#featuredPrice').text = itemData.formattedPrice;
      try { $item('#featuredImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      try { $item('#featuredName').accessibility.ariaLabel = `View ${itemData.name} details`; } catch (e) {}

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
      try { $item('#saleImage').accessibility.ariaLabel = `View ${itemData.name} on sale`; } catch (e) {}
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
        try { $item('#categoryCardTitle').accessibility.ariaLabel = `Browse ${itemData.name}`; } catch (e) {}
        $item('#categoryCardTitle').onClick(() => {
          import('wix-location-frontend').then(({ to }) => to(itemData.path));
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
        import('wix-location-frontend').then(({ to }) => to(cat.path));
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
      try { $item('#recentImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      try { $item('#recentName').accessibility.ariaLabel = `View ${itemData.name} details`; } catch (e) {}

      $item('#recentImage').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
      $item('#recentName').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
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
    { id: '#trustItem4', text: 'Free Shipping on Orders $999+', icon: 'truck' },
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
// Customer testimonials — loads featured from CMS, falls back to hardcoded

const FALLBACK_TESTIMONIALS = [
  { _id: 'test1', story: 'The quality of our Night & Day futon frame is outstanding. It looks like a real piece of furniture, not a dorm room couch. Love it!', name: 'Sarah M., Asheville NC', rating: 5 },
  { _id: 'test2', story: 'Brenda helped us find the perfect Murphy cabinet bed for our guest room. The whole experience — from browsing to delivery — was wonderful.', name: 'James & Linda K., Hendersonville NC', rating: 5 },
  { _id: 'test3', story: 'We drove from Charlotte just to see the fabric swatches in person. So glad we did — our futon mattress is exactly what we wanted.', name: 'Michelle T., Charlotte NC', rating: 5 },
  { _id: 'test4', story: 'Best furniture shopping experience we\'ve had. Knowledgeable staff, beautiful showroom, and the platform bed we bought is solid as a rock.', name: 'David R., Greenville SC', rating: 5 },
];

async function initTestimonials() {
  try {
    const repeater = $w('#testimonialRepeater');
    if (!repeater) return;

    // Try loading dynamic testimonials from CMS
    let testimonials = FALLBACK_TESTIMONIALS;
    try {
      const { getFeaturedTestimonials, getTestimonialSchema } = await import('backend/testimonialService.web');
      const result = await getFeaturedTestimonials(6);
      if (result.success && result.items.length > 0) {
        testimonials = result.items;
      }

      // Inject testimonial JSON-LD schema for SEO
      try {
        const schemaJson = await getTestimonialSchema();
        if (schemaJson) {
          const head = $w('#testimonialSchemaScript');
          if (head) head.postMessage(schemaJson);
        }
      } catch (e) {}
    } catch (e) {
      // CMS unavailable — use fallback
    }

    repeater.data = testimonials;
    repeater.onItemReady(($item, itemData) => {
      try { $item('#testimonialQuote').text = `"${itemData.story || itemData.quote}"`; } catch (e) {}
      try { $item('#testimonialName').text = `— ${itemData.name}`; } catch (e) {}
      try {
        const photoEl = $item('#testimonialPhoto');
        if (photoEl && itemData.photo) { photoEl.src = itemData.photo; photoEl.show(); }
        else if (photoEl) { photoEl.hide(); }
      } catch (e) {}
      try {
        const ratingEl = $item('#testimonialRating');
        if (ratingEl && itemData.rating) { ratingEl.text = '\u2605'.repeat(itemData.rating); }
      } catch (e) {}
    });
  } catch (e) {
    // Testimonials section is non-critical
  }
}

// ── Smooth Scroll ───────────────────────────────────────────────────
// Smooth scroll anchors for in-page navigation between sections

// ── Video Showcase ──────────────────────────────────────────────────
// "See Our Furniture in Action" — 3 featured video thumbnails

function initVideoShowcase() {
  try {
    const section = $w('#videoShowcaseSection');
    if (!section) return;

    try {
      $w('#videoShowcaseTitle').text = 'See Our Furniture in Action';
    } catch (e) {}

    try {
      $w('#videoShowcaseSubtitle').text =
        'Watch product demos and room inspiration videos';
    } catch (e) {}

    // Video thumbnails link to the Product Videos page
    const videoLinks = ['#videoThumb1', '#videoThumb2', '#videoThumb3'];
    videoLinks.forEach((id, i) => {
      try {
        $w(id).onClick(() => {
          import('wix-location-frontend').then(({ to }) => {
            to('/product-videos');
          });
        });
        try { $w(id).accessibility.ariaLabel = `Watch product video ${i + 1}`; } catch (e) {}
      } catch (e) {}
    });

    // "View All Videos" button
    try {
      $w('#viewAllVideosCTA').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/product-videos');
        });
      });
      try { $w('#viewAllVideosCTA').accessibility.ariaLabel = 'View all product videos'; } catch (e) {}
    } catch (e) {}

    section.expand();
  } catch (e) {
    // Video section is optional
    try { $w('#videoShowcaseSection').collapse(); } catch (e2) {}
  }
}

// ── Style Quiz CTA ────────────────────────────────────────────────
// "Find Your Perfect Futon" call-to-action on homepage

function initQuizCTA() {
  try {
    const section = $w('#quizCTASection');
    if (!section) return;

    try {
      $w('#quizCTATitle').text = 'Not Sure Where to Start?';
    } catch (e) {}

    try {
      $w('#quizCTASubtitle').text =
        'Take our 60-second style quiz and we\'ll match you with the perfect futon.';
    } catch (e) {}

    try {
      $w('#quizCTAButton').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/style-quiz');
        });
      });
      try { $w('#quizCTAButton').accessibility.ariaLabel = 'Take the style quiz'; } catch (e) {}
    } catch (e) {}

    section.expand();
  } catch (e) {
    // Quiz CTA is optional
    try { $w('#quizCTASection').collapse(); } catch (e2) {}
  }
}

// ── Smooth Scroll ──────────────────────────────────────────────────

function initSmoothScroll() {
  const scrollTargets = {
    '#scrollToFeatured': { target: '#featuredRepeater', label: 'Scroll to featured products' },
    '#scrollToCategories': { target: '#categoryRepeater', label: 'Scroll to categories' },
    '#scrollToSale': { target: '#saleSection', label: 'Scroll to sale items' },
    '#scrollToReviews': { target: '#testimonialRepeater', label: 'Scroll to reviews' },
  };

  Object.entries(scrollTargets).forEach(([triggerId, { target, label }]) => {
    try {
      $w(triggerId).onClick(() => {
        try { $w(target).scrollTo(); } catch (e) {}
      });
      try { $w(triggerId).accessibility.ariaLabel = label; } catch (e) {}
    } catch (e) {
      // Scroll trigger may not exist
    }
  });
}

// ── Hero Animation ──────────────────────────────────────────────────
// Subtle entrance animations for the mountain illustration hero

function initHeroAnimation() {
  try {
    // Set hero background from Media Manager
    try {
      const heroBg = $w('#heroBg');
      if (heroBg) {
        heroBg.src = getCategoryHeroImage('futon-frames');
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
      try { heroCta.accessibility.ariaLabel = 'Shop all furniture'; } catch (e) {}
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
