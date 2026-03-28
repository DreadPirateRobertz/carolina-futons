// Local SEO Page.js — City landing page at /near/[city]
// Renders city-specific headline, local product grid, Google Maps embed,
// directions text, directions CTA, and nearby area links for local SEO targeting.
import { getLocalPage, getFeaturedProductsForCity, getRelatedCityLinks } from 'backend/localSeoService.web';
import wixLocationFrontend from 'wix-location-frontend';
import wixSeo from 'wix-seo';
import { announce } from 'public/a11yHelpers';
import { renderSimplePrice } from 'public/productCardHelpers.js';

$w.onReady(async function () {
  try {
    const path = wixLocationFrontend.path;
    const slug = path && path.length > 0 ? path[path.length - 1] : null;

    if (!slug) {
      showNotFound();
      return;
    }

    const [pageResult, productsResult, crossLinksResult] = await Promise.all([
      getLocalPage(slug),
      getFeaturedProductsForCity(slug),
      getRelatedCityLinks(slug),
    ]);

    if (!pageResult.success || !pageResult.page) {
      showNotFound();
      return;
    }

    const { page } = pageResult;
    const products = productsResult.success ? productsResult.products : [];

    initSeo(page);
    initBreadcrumbs(page.breadcrumbs);
    initHero(page);
    initStoreHours(page.storeHours);
    initCategoryRecommendations(page.categoryRecommendations);
    initFeaturedProducts(products);
    initFaq(page.faqs);
    initDirections(page);
    initNearbyAreas(page.nearbyAreas);
    initCrossLinks(crossLinksResult.success ? crossLinksResult.links : []);
    announce(`Loaded ${page.city}, ${page.state}`);
  } catch (err) {
    console.error('Local SEO Page init error:', err);
    showNotFound();
  }
});

// ── SEO ────────────────────────────────────────────────────────────────

function initSeo(page) {
  try {
    wixSeo.setTitle(page.metaTitle);
    wixSeo.setDescription(page.metaDescription);
    wixSeo.setLinks([{ rel: 'canonical', href: page.canonicalUrl }]);
    const schemas = [page.jsonLd, page.breadcrumbSchema, page.faqSchema].filter(Boolean);
    if (schemas.length > 0) {
      wixSeo.setStructuredData(schemas);
    }
  } catch (e) {
    console.error('Local SEO Page SEO init error:', e);
  }
}

// ── Breadcrumbs ─────────────────────────────────────────────────────────

function initBreadcrumbs(breadcrumbs) {
  try {
    const items = Array.isArray(breadcrumbs) ? breadcrumbs : [];
    if (items.length === 0) return;

    const repeater = $w('#breadcrumbsRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      try { $item('#breadcrumbLabel').text = itemData.label; } catch (e) {}
      if (!itemData.isCurrentPage) {
        try {
          $item('#breadcrumbLink').onClick(() => {
            wixLocationFrontend.to(itemData.url);
          });
        } catch (e) {}
      } else {
        try { $item('#breadcrumbLink').disable(); } catch (e) {}
      }
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `bc-${i}` }));
  } catch (e) {
    console.warn('Local SEO Page: initBreadcrumbs error:', e);
  }
}

// ── Hero / City Header ──────────────────────────────────────────────────

function initHero(page) {
  try {
    try { $w('#cityTitle').text = `${page.city}, ${page.state}`; } catch (e) {}
    try { $w('#cityHeadline').text = page.headline; } catch (e) {}
    if (page.heroDescription) {
      try { $w('#cityHeroDescription').text = page.heroDescription; } catch (e) {}
    }
    if (page.neighborhoodContext) {
      try { $w('#neighborhoodContext').text = page.neighborhoodContext; } catch (e) {}
    }
    if (page.isHomeCity) {
      try { $w('#homeCityBadge').show(); } catch (e) {}
    }
  } catch (e) {
    console.warn('Local SEO Page: initHero error:', e);
  }
}

// ── Store Hours ─────────────────────────────────────────────────────────

function initStoreHours(storeHoursDisplay) {
  try {
    const hours = Array.isArray(storeHoursDisplay) ? storeHoursDisplay : [];
    if (hours.length === 0) return;
    try { $w('#storeHoursText').text = hours.join('\n'); } catch (e) {}
  } catch (e) {
    console.warn('Local SEO Page: initStoreHours error:', e);
  }
}

// ── Category Recommendations ────────────────────────────────────────────

function initCategoryRecommendations(categoryRecommendations) {
  try {
    const items = Array.isArray(categoryRecommendations) ? categoryRecommendations : [];
    const repeater = $w('#categoryRecsRepeater');
    if (!repeater || items.length === 0) {
      try { $w('#categoryRecsSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      try { $item('#catRecLabel').text = itemData.label; } catch (e) {}
      try { $item('#catRecReason').text = itemData.reason; } catch (e) {}
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `cat-${i}` }));
  } catch (e) {
    console.warn('Local SEO Page: initCategoryRecommendations error:', e);
  }
}

// ── Featured Products ───────────────────────────────────────────────────

function initFeaturedProducts(products) {
  try {
    const items = Array.isArray(products) ? products : [];
    const repeater = $w('#featuredProductsRepeater');
    if (!repeater || items.length === 0) return;

    // onItemReady must be registered before .data to avoid the Wix race condition
    repeater.onItemReady(($item, itemData) => {
      try { $item('#productImage').src = itemData.imageUrl; } catch (e) {}
      try { $item('#productName').text = itemData.name; } catch (e) {}
      renderSimplePrice($item('#productPrice'), itemData);
      try {
        $item('#viewProductBtn').onClick(() => {
          wixLocationFrontend.to(itemData.productPageUrl);
        });
      } catch (e) {}
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `product-${i}` }));
  } catch (e) {}
}

// ── Directions ─────────────────────────────────────────────────────────

function initDirections(page) {
  try {
    try { $w('#directionsText').text = page.directions || ''; } catch (e) {}

    // Map embed — sets src on the existing #mapEmbed HtmlComponent
    if (page.mapEmbedUrl) {
      try { $w('#mapEmbed').src = page.mapEmbedUrl; } catch (e) {
        console.warn('Local SEO Page: failed to set #mapEmbed src:', e);
      }
    }

    // Directions CTA — opens Google Maps directions to the store
    if (page.directionsUrl) {
      try {
        $w('#directionsBtn').onClick(() => {
          wixLocationFrontend.to(page.directionsUrl);
        });
      } catch (e) {
        console.warn('Local SEO Page: failed to wire #directionsBtn:', e);
      }
    }
  } catch (e) {
    console.warn('Local SEO Page: initDirections error:', e);
  }
}

// ── Nearby Areas ───────────────────────────────────────────────────────

function initNearbyAreas(nearbyAreas) {
  try {
    const items = Array.isArray(nearbyAreas) ? nearbyAreas : [];
    const repeater = $w('#nearbyAreasRepeater');
    if (!repeater || items.length === 0) return;

    // onItemReady must be registered before .data to avoid the Wix race condition
    repeater.onItemReady(($item, itemData) => {
      try { $item('#nearbyAreaLabel').text = `${itemData.city}, ${itemData.state}`; } catch (e) {}
      try {
        $item('#nearbyAreaLink').onClick(() => {
          wixLocationFrontend.to(itemData.url);
        });
      } catch (e) {}
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `area-${i}` }));
  } catch (e) {}
}

// ── Cross-Links (All Other City Pages) ─────────────────────────────────
// Provides internal SEO cross-links to every other defined city page.
// Nearby cities appear first; remaining cities are sorted alphabetically.

function initCrossLinks(links) {
  try {
    const items = Array.isArray(links) ? links : [];
    if (items.length === 0) {
      try { $w('#crossLinksSection').collapse(); } catch (e) {}
      return;
    }

    try { $w('#crossLinksHeading').text = 'More Areas We Serve'; } catch (e) {}

    const repeater = $w('#crossLinksRepeater');
    // onItemReady must be registered before .data to avoid the Wix race condition
    repeater.onItemReady(($item, itemData) => {
      try { $item('#crossLinkLabel').text = `${itemData.city}, ${itemData.state}`; } catch (e) {}
      try {
        $item('#crossLinkBtn').onClick(() => {
          wixLocationFrontend.to(itemData.url);
        });
      } catch (e) {}
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `cl-${i}` }));
  } catch (e) {}
}

// ── FAQ Section ─────────────────────────────────────────────────────────

function initFaq(faqs) {
  try {
    const items = Array.isArray(faqs) ? faqs : [];
    const repeater = $w('#faqRepeater');
    if (!repeater || items.length === 0) {
      try { $w('#faqSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      try { $item('#faqQuestion').text = itemData.question; } catch (e) {}
      try { $item('#faqAnswer').text = itemData.answer; } catch (e) {}
    });
    repeater.data = items.map((item, i) => ({ ...item, _id: `faq-${i}` }));
  } catch (e) {
    console.warn('Local SEO Page: initFaq error:', e);
  }
}

// ── Not Found ───────────────────────────────────────────────────────────

function showNotFound() {
  try { $w('#localPageContent').hide(); } catch (e) {}
  try { $w('#notFoundMessage').show(); } catch (e) {}
}
