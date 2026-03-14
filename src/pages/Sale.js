// Sale.js - Sale & Clearance Page
// Promotional banners, sale product listings, discount formatting,
// and price-match policy with engagement tracking
import { getSaleProducts } from 'backend/productRecommendations.web';
import { getActivePromotion } from 'backend/promotions.web';
import { initPageSeo } from 'public/pageSeo.js';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import { getPriceMatchNote, formatSalePrice } from 'public/salePageHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initPriceMatchNote();
  initShopLink();
  await initPromotion();
  await initSaleProducts();
  initPageSeo('sale');
  trackEvent('page_view', { page: 'sale' });
});

// ── Promotion Banner ─────────────────────────────────────────────────

async function initPromotion() {
  try {
    const promo = await getActivePromotion();
    if (!promo) return;
    try { $w('#salePromoTitle').text = promo.title; } catch (e) {}
    try { $w('#salePromoBanner').text = promo.bannerMessage; } catch (e) {}
  } catch (e) {}
}

// ── Price Match Note ─────────────────────────────────────────────────

function initPriceMatchNote() {
  try { $w('#salePriceMatchNote').text = getPriceMatchNote(); } catch (e) {}
}

// ── Sale Products Repeater ───────────────────────────────────────────

async function initSaleProducts() {
  try {
    const products = await getSaleProducts();
    const repeater = $w('#saleProductRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'Products on sale'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#saleProductName').text = itemData.name; } catch (e) {}
      try { $item('#saleProductPrice').text = formatSalePrice(itemData); } catch (e) {}
    });
    repeater.data = products.map((p, i) => ({ ...p, _id: p._id || String(i) }));
  } catch (e) {}
}

// ── Navigation ───────────────────────────────────────────────────────

function initShopLink() {
  try {
    const shopLink = $w('#saleShopLink');
    if (!shopLink) return;
    makeClickable(shopLink, () => {
      import('wix-location-frontend').then(({ to }) => to('/shop'));
    }, { ariaLabel: 'Browse all products' });
  } catch (e) {}
}
