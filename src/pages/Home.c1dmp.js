// Home.c1dmp.js - Homepage
// "Handcrafted Comfort, Mountain Inspired."
// Featured products grid, category showcases, and testimonials
import { getFeaturedProducts, getSaleProducts } from 'backend/productRecommendations.web';
import { getWebSiteSchema } from 'backend/seoHelpers.web';

$w.onReady(async function () {
  await Promise.all([
    loadFeaturedProducts(),
    loadSaleHighlights(),
    initCategoryShowcase(),
    initHeroAnimation(),
    injectHomeSchemas(),
  ]);
});

// ── Featured Products ("Our Favorite Finds") ────────────────────────
// Displays curated product selection in a grid

async function loadFeaturedProducts() {
  try {
    const featured = await getFeaturedProducts(8);
    const repeater = $w('#featuredRepeater');
    if (!repeater || featured.length === 0) return;

    repeater.data = featured;
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
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });

      $item('#featuredName').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
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

    repeater.data = saleItems;
    repeater.onItemReady(($item, itemData) => {
      $item('#saleImage').src = itemData.mainMedia;
      $item('#saleImage').alt = buildProductAlt(itemData, 'sale');
      $item('#saleName').text = itemData.name;
      $item('#salePrice').text = itemData.formattedDiscountedPrice || itemData.formattedPrice;
      try {
        $item('#saleOrigPrice').text = itemData.formattedPrice;
      } catch (e) {}

      $item('#saleImage').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
  } catch (err) {
    console.error('Error loading sale highlights:', err);
  }
}

// ── Category Showcase ───────────────────────────────────────────────
// Large clickable category cards: Futon Frames, Mattresses, Murphy Beds, etc.

function initCategoryShowcase() {
  const categoryLinks = {
    '#categoryFutonFrames': '/futon-frames',
    '#categoryMattresses': '/mattresses',
    '#categoryMurphy': '/murphy-cabinet-beds',
    '#categoryPlatformBeds': '/platform-beds',
    '#categoryCasegoods': '/casegoods-accessories',
    '#categorySale': '/sales',
  };

  Object.entries(categoryLinks).forEach(([elementId, path]) => {
    try {
      $w(elementId).onClick(() => {
        import('wix-location').then(({ to }) => to(path));
      });
    } catch (e) {
      // Category card may not exist
    }
  });
}

// ── Hero Animation ──────────────────────────────────────────────────
// Subtle entrance animations for the mountain illustration hero

function initHeroAnimation() {
  try {
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
        import('wix-location').then(({ to }) => to('/shop-main'));
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
