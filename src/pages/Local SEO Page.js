// Local SEO Page.js — City landing page at /near/[city]
// Renders city-specific headline, local product grid, Google Maps embed,
// directions text, directions CTA, and nearby area links for local SEO targeting.
import { getLocalPage } from 'backend/localSeoService.web';
import wixLocationFrontend from 'wix-location-frontend';
import wixSeo from 'wix-seo';
import { announce } from 'public/a11yHelpers';

$w.onReady(async function () {
  try {
    const routerData = $w('#routerData');
    const slug = routerData && routerData.slug ? routerData.slug : null;

    if (!slug) {
      showNotFound();
      return;
    }

    const result = await getLocalPage(slug);

    if (!result.success || !result.page) {
      showNotFound();
      return;
    }

    const { page } = result;

    initSeo(page);
    initHero(page);
    initDirections(page);
    initNearbyAreas(page.nearbyAreas);
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
    if (page.jsonLd) {
      wixSeo.setStructuredData([page.jsonLd]);
    }
  } catch (e) {
    console.error('Local SEO Page SEO init error:', e);
  }
}

// ── Hero / City Header ──────────────────────────────────────────────────

function initHero(page) {
  try {
    try { $w('#cityTitle').text = `${page.city}, ${page.state}`; } catch (e) {}
    try { $w('#cityHeadline').text = page.headline; } catch (e) {}
    if (page.isHomeCity) {
      try { $w('#homeCityBadge').show(); } catch (e) {}
    }
  } catch (e) {}
}

// ── Directions ─────────────────────────────────────────────────────────

function initDirections(page) {
  try {
    try { $w('#directionsText').text = page.directions || ''; } catch (e) {}

    // Map embed — HtmlComponent renders the Google Maps iframe
    if (page.mapEmbedUrl) {
      try { $w('#mapEmbed').src = page.mapEmbedUrl; } catch (e) {}
    }

    // Directions CTA — opens Google Maps directions to the store
    if (page.directionsUrl) {
      try {
        $w('#directionsBtn').onClick(() => {
          wixLocationFrontend.to(page.directionsUrl);
        });
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Nearby Areas ───────────────────────────────────────────────────────

function initNearbyAreas(nearbyAreas) {
  try {
    const items = Array.isArray(nearbyAreas) ? nearbyAreas : [];
    const repeater = $w('#nearbyAreasRepeater');
    if (!repeater || items.length === 0) return;

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

// ── Not Found ───────────────────────────────────────────────────────────

function showNotFound() {
  try { $w('#localPageContent').hide(); } catch (e) {}
  try { $w('#notFoundMessage').show(); } catch (e) {}
}
