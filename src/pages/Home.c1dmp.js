// Home.c1dmp.js - Homepage
// "Handcrafted Comfort, Mountain Inspired."
// Featured products grid, category showcases, and testimonials
import { getFeaturedProducts, getSaleProducts } from 'backend/productRecommendations.web';

$w.onReady(async function () {
  await Promise.all([
    loadFeaturedProducts(),
    loadSaleHighlights(),
    initCategoryShowcase(),
    initHeroAnimation(),
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
      $item('#featuredImage').alt = `${itemData.name} - Carolina Futons`;
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
      $item('#saleImage').alt = `${itemData.name} on sale - Carolina Futons`;
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
