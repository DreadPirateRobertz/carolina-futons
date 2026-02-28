// Home.js - Homepage
// "Handcrafted Comfort, Mountain Inspired."
// Hero, categories, featured products, trust bar, newsletter, testimonials
import { getFeaturedProducts, getSaleProducts } from 'backend/productRecommendations.web';
import { getWebSiteSchema } from 'backend/seoHelpers.web';
import { getRecentlyViewed, buildRecentlyViewedSection } from 'public/galleryHelpers.js';
import { getCategoryHeroImage, getCategoryCardImage } from 'public/placeholderImages.js';
import { isMobile, collapseOnMobile, initBackToTop, limitForViewport } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { announce, makeClickable } from 'public/a11yHelpers';
import { colors } from 'public/designTokens.js';
import wixData from 'wix-data';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * Sanitize a product slug for safe URL construction.
 * Strips anything that isn't lowercase alphanumeric or hyphens.
 * @param {string} slug - Raw slug from product data
 * @returns {string} Sanitized slug safe for URL path segments
 */
function safeSlug(slug) {
  if (typeof slug !== 'string') return '';
  const cleaned = slug.trim().toLowerCase().slice(0, 100);
  return SLUG_RE.test(cleaned) ? cleaned : cleaned.replace(/[^a-z0-9-]/g, '');
}

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
    { name: 'newsletter', init: initNewsletterSection },
    { name: 'ridgeline', init: initRidgelineHeader },
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
      }).catch(err => console.error('[Home] Error logging failed:', err.message));
    }
  });

  initSmoothScroll();
  initBackToTop($w);
  trackEvent('page_view', { page: 'home' });

  // On mobile: defer non-critical sections for faster first paint
  collapseOnMobile($w, ['#testimonialSection', '#videoShowcaseSection']);
});

// ── Featured Products ("Our Favorite Finds") ────────────────────────

/**
 * Load and display featured product cards in the homepage grid.
 * Sets section heading, fetches products from backend, and wires
 * repeater with product data, sale badges, and ribbon badges.
 * @returns {Promise<void>}
 */
async function loadFeaturedProducts() {
  try {
    // Set section heading
    try { $w('#featuredTitle').text = 'Our Favorite Finds'; } catch (e) {}
    try { $w('#featuredSubtitle').text = 'Handpicked by the Carolina Futons family — quality you can feel.'; } catch (e) {}

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

      // Show ribbon badge (Featured, New, Clearance, etc.)
      try {
        if (itemData.ribbon) {
          $item('#featuredRibbon').text = itemData.ribbon;
          $item('#featuredRibbon').show();
        } else {
          $item('#featuredRibbon').hide();
        }
      } catch (e) { /* ribbon element optional */ }

      // Navigate to product page on click/keyboard
      const slug = safeSlug(itemData.slug);
      const navToProduct = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${slug}`));
      makeClickable($item('#featuredImage'), navToProduct, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#featuredName'), navToProduct, { ariaLabel: `View ${itemData.name} details` });
    });
    repeater.data = featured;
  } catch (err) {
    console.error('[Home] Error loading featured products:', err);
  }
}

// ── Sale Highlights ─────────────────────────────────────────────────

/**
 * Load and display sale product cards in a horizontal scroll section.
 * Collapses the section if no sale items are available.
 * @returns {Promise<void>}
 */
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

      const slug = safeSlug(itemData.slug);
      makeClickable($item('#saleImage'), () => {
        import('wix-location-frontend').then(({ to }) => to(`/product-page/${slug}`));
      }, { ariaLabel: `View ${itemData.name} on sale` });
    });
    repeater.data = saleItems;
  } catch (err) {
    console.error('[Home] Error loading sale highlights:', err);
  }
}

// ── Category Showcase ───────────────────────────────────────────────

/**
 * Initialize the category showcase grid with product counts,
 * card images, hover Coral accent, and click navigation.
 * Fetches live product counts from Wix Data in parallel.
 * @returns {Promise<void>}
 */
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
        // Category card image
        try {
          const cardImg = $item('#categoryCardImage');
          if (cardImg && itemData.collection) {
            cardImg.src = getCategoryCardImage(itemData.collection);
            cardImg.alt = `${itemData.name} - Carolina Futons`;
          }
        } catch (e) {}
        // Hover Coral accent on card
        try {
          const card = $item('#categoryCard');
          if (card) {
            card.onMouseIn(() => {
              try { card.style.backgroundColor = colors.sunsetCoral; } catch (e) {}
            });
            card.onMouseOut(() => {
              try { card.style.backgroundColor = ''; } catch (e) {}
            });
          }
        } catch (e) {}
        makeClickable($item('#categoryCardTitle'), () => {
          import('wix-location-frontend').then(({ to }) => to(itemData.path));
        }, { ariaLabel: `Browse ${itemData.name}` });
      });
    }
  } catch (e) {
    // Repeater may not exist
  }

  // Also wire up individual card click handlers (backward compatible)
  categoriesWithCounts.forEach((cat) => {
    try {
      makeClickable($w(cat.elementId), () => {
        import('wix-location-frontend').then(({ to }) => to(cat.path));
      }, { ariaLabel: `Browse ${cat.name}` });
    } catch (e) {
      // Card element may not exist in editor
    }
  });
}

// ── Recently Viewed ─────────────────────────────────────────────────

/**
 * Initialize the recently viewed products section.
 * Reads visitor browsing history from session and populates
 * a product card repeater. Collapses section if no history.
 * @returns {Promise<void>}
 */
async function initRecentlyViewed() {
  try {
    const recent = getRecentlyViewed();
    if (!recent || recent.length === 0) {
      try { $w('#recentSection').collapse(); } catch (e) {}
      return;
    }

    buildRecentlyViewedSection($w, '#recentRepeater', ($item, itemData) => {
      $item('#recentImage').src = itemData.mainMedia;
      $item('#recentImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#recentName').text = itemData.name;
      $item('#recentPrice').text = itemData.price;
      try { $item('#recentImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      try { $item('#recentName').accessibility.ariaLabel = `View ${itemData.name} details`; } catch (e) {}

      const slug = safeSlug(itemData.slug);
      const navRecent = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${slug}`));
      makeClickable($item('#recentImage'), navRecent, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#recentName'), navRecent, { ariaLabel: `View ${itemData.name} details` });
    });

    $w('#recentSection').expand();
  } catch (e) {
    console.error('[Home] Error loading recently viewed:', e);
    try { $w('#recentSection').collapse(); } catch (e2) {}
  }
}

// ── Trust Bar ───────────────────────────────────────────────────────

const TRUST_ICONS = { mountain: '\u26F0', heart: '\u2764', palette: '\uD83C\uDFA8', truck: '\uD83D\uDE9A', gloves: '\uD83E\uDDE4' };

/**
 * Initialize the trust bar with hand-drawn line icons and staggered fade-in.
 * Wires icon, text, and accessibility labels for each trust signal.
 */
function initTrustBar() {
  const trustSignals = [
    { id: '#trustItem1', iconId: '#trustIcon1', textId: '#trustText1', text: 'Largest Selection in the Carolinas', icon: 'mountain' },
    { id: '#trustItem2', iconId: '#trustIcon2', textId: '#trustText2', text: 'Family Owned Since 1991', icon: 'heart' },
    { id: '#trustItem3', iconId: '#trustIcon3', textId: '#trustText3', text: '700+ Fabric Swatches', icon: 'palette' },
    { id: '#trustItem4', iconId: '#trustIcon4', textId: '#trustText4', text: 'Free Shipping on Orders $999+', icon: 'truck' },
    { id: '#trustItem5', iconId: '#trustIcon5', textId: '#trustText5', text: 'White Glove Delivery', icon: 'gloves' },
  ];

  try {
    const trustBar = $w('#trustBar');
    if (!trustBar) return;

    trustSignals.forEach((signal, index) => {
      try {
        const element = $w(signal.id);
        if (element) {
          element.show('fade', { duration: 400, delay: 200 + (index * 150) });
          try { element.accessibility.ariaLabel = signal.text; } catch (e) {}
        }
      } catch (e) {}
      // Wire icon element
      try { $w(signal.iconId).text = TRUST_ICONS[signal.icon] || signal.icon; } catch (e) {}
      // Wire text element
      try { $w(signal.textId).text = signal.text; } catch (e) {}
    });
  } catch (e) {
    // Trust bar may not exist
  }
}

// ── Testimonials ────────────────────────────────────────────────────

const FALLBACK_TESTIMONIALS = [
  { _id: 'test1', story: 'The quality of our Night & Day futon frame is outstanding. It looks like a real piece of furniture, not a dorm room couch. Love it!', name: 'Sarah M., Asheville NC', rating: 5 },
  { _id: 'test2', story: 'Brenda helped us find the perfect Murphy cabinet bed for our guest room. The whole experience — from browsing to delivery — was wonderful.', name: 'James & Linda K., Hendersonville NC', rating: 5 },
  { _id: 'test3', story: 'We drove from Charlotte just to see the fabric swatches in person. So glad we did — our futon mattress is exactly what we wanted.', name: 'Michelle T., Charlotte NC', rating: 5 },
  { _id: 'test4', story: 'Best furniture shopping experience we\'ve had. Knowledgeable staff, beautiful showroom, and the platform bed we bought is solid as a rock.', name: 'David R., Greenville SC', rating: 5 },
];

/**
 * Load and display customer testimonials from CMS.
 * Falls back to hardcoded testimonials if CMS is unavailable.
 * Injects testimonial JSON-LD schema for SEO.
 * @returns {Promise<void>}
 */
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
      } catch (e) {
        console.error('[Home] Testimonial schema injection failed:', e);
      }
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
    console.error('[Home] Testimonials section failed:', e);
  }
}

// ── Video Showcase ──────────────────────────────────────────────────

/**
 * Initialize the "See Our Furniture in Action" video section.
 * Wires 3 video thumbnails and a "View All Videos" CTA button.
 */
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
        makeClickable($w(id), () => {
          import('wix-location-frontend').then(({ to }) => to('/product-videos'));
        }, { ariaLabel: `Watch product video ${i + 1}` });
      } catch (e) {}
    });

    // "View All Videos" button — uses makeClickable for keyboard a11y
    try {
      makeClickable($w('#viewAllVideosCTA'), () => {
        import('wix-location-frontend').then(({ to }) => to('/product-videos'));
      }, { ariaLabel: 'View all product videos' });
    } catch (e) {}

    section.expand();
  } catch (e) {
    // Video section is optional
    try { $w('#videoShowcaseSection').collapse(); } catch (e2) {}
  }
}

// ── Style Quiz CTA ────────────────────────────────────────────────

/**
 * Initialize the style quiz call-to-action section.
 * Links to /style-quiz for the "Find Your Perfect Futon" quiz.
 */
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

/**
 * Wire up smooth scroll anchor links for in-page section navigation.
 */
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

/**
 * Initialize the hero section with mountain cabin illustration,
 * Playfair Display title, brand subtitle, and CTA with staggered fade-in.
 */
function initHeroAnimation() {
  try {
    // Set hero background — mountain cabin illustration
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

    // Set hero content — Playfair Display title, brand tagline, CTA
    if (heroTitle) {
      heroTitle.text = 'Handcrafted Comfort, Mountain Inspired.';
      heroTitle.show('fade', { duration: 600, delay: 200 });
    }
    if (heroSubtitle) {
      heroSubtitle.text = 'Hendersonville\'s largest selection of futons, Murphy beds & platform beds since 1991.';
      heroSubtitle.show('fade', { duration: 600, delay: 500 });
    }
    if (heroCta) {
      heroCta.label = 'Explore Our Collection';
      heroCta.show('fade', { duration: 400, delay: 800 });
      try { heroCta.accessibility.ariaLabel = 'Explore our furniture collection'; } catch (e) {}
      heroCta.onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/shop-main'));
      });
    }
  } catch (e) {
    // Hero elements may not exist
  }
}

// ── Homepage Schema Injection ───────────────────────────────────────

/**
 * Inject WebSite JSON-LD schema into the page for Google sitelinks searchbox.
 * @returns {Promise<void>}
 */
async function injectHomeSchemas() {
  try {
    const schema = await getWebSiteSchema();
    if (schema) {
      $w('#websiteSchemaHtml').postMessage(schema);
    }
  } catch (e) {
    console.error('[Home] Schema injection failed:', e);
  }
}

// ── Newsletter Signup Section ────────────────────────────────────────

/**
 * Initialize the newsletter signup section with email validation,
 * backend subscription via newsletterService, and discount code display.
 */
function initNewsletterSection() {
  try {
    const section = $w('#newsletterSection');
    if (!section) return;

    try { $w('#newsletterTitle').text = 'Join the Carolina Futons Family'; } catch (e) {}
    try {
      $w('#newsletterSubtitle').text =
        'Get exclusive deals, new arrivals & furniture tips — plus 10% off your first order.';
    } catch (e) {}

    // Hide feedback messages initially
    try { $w('#newsletterSuccess').hide(); } catch (e) {}
    try { $w('#newsletterError').hide(); } catch (e) {}

    // Set accessibility labels
    try { $w('#newsletterEmail').accessibility.ariaLabel = 'Enter your email address'; } catch (e) {}
    try { $w('#newsletterSubmit').accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}

    // Wire submit handler
    try {
      $w('#newsletterSubmit').onClick(async () => {
        const email = $w('#newsletterEmail').value?.trim() || '';

        // Validate email
        if (!email || !EMAIL_RE.test(email)) {
          try {
            $w('#newsletterError').text = 'Please enter a valid email address.';
            $w('#newsletterError').show();
          } catch (e) {}
          try { $w('#newsletterSuccess').hide(); } catch (e) {}
          try { announce('Please enter a valid email address.'); } catch (e) {}
          return;
        }

        // Submit
        try {
          $w('#newsletterSubmit').label = 'Submitting...';
          const { subscribeToNewsletter } = await import('backend/newsletterService.web');
          const result = await subscribeToNewsletter(email);

          $w('#newsletterSuccess').text =
            `Welcome! Use code ${result.discountCode || 'WELCOME10'} for 10% off your first order.`;
          $w('#newsletterSuccess').show();
          try { $w('#newsletterError').hide(); } catch (e) {}

          trackEvent('newsletter_signup', { page: 'home', email });
          announce('Successfully subscribed! Check your email for your discount code.');
        } catch (err) {
          try {
            $w('#newsletterError').text = 'Something went wrong. Please try again.';
            $w('#newsletterError').show();
          } catch (e) {}
          try { $w('#newsletterSuccess').hide(); } catch (e) {}
          announce('Subscription failed. Please try again.');
        } finally {
          try { $w('#newsletterSubmit').label = 'Subscribe'; } catch (e) {}
        }
      });
    } catch (e) {}

    section.expand();
  } catch (e) {
    // Newsletter section is optional
  }
}

// ── Mountain Ridgeline Header ───────────────────────────────────────

/**
 * Wire the decorative Blue Ridge ridgeline SVG into the page header.
 */
function initRidgelineHeader() {
  try {
    const ridgeline = $w('#ridgelineHeader');
    if (!ridgeline) return;

    ridgeline.src = 'https://static.wixstatic.com/media/cf-asset-01-ridgeline-header.svg';
    ridgeline.alt = 'Blue Ridge Mountain ridgeline decoration';
    try { ridgeline.accessibility.ariaLabel = 'Decorative mountain ridgeline'; } catch (e) {}
  } catch (e) {
    // Ridgeline header is decorative, non-critical
  }
}

// ── Alt Text Helpers ────────────────────────────────────────────────

/**
 * Build descriptive alt text for a product image including brand and category.
 * Truncates to 125 characters for SEO best practices.
 * @param {Object} product - Product data from Wix Stores
 * @param {string} context - Context for alt text ('featured', 'sale', etc.)
 * @returns {string} Formatted alt text
 */
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

/**
 * Detect brand name from a product's collection memberships.
 * @param {Object} product - Product data with collections array
 * @returns {string} Brand name or default 'Night & Day Furniture'
 */
function detectBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

/**
 * Detect product category from a product's collection memberships.
 * @param {Object} product - Product data with collections array
 * @returns {string} Category name or default 'Furniture'
 */
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
