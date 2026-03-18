// Compare Page.js — /compare
// CF-g0fo: Side-by-side product comparison page
// Stories: S1 URL parsing + fetch, S2 columns, S3 attributes,
//          S4 mobile, S5 SEO/schema, S6 start-over

import wixLocation from 'wix-location-frontend';
import { products } from 'wix-stores-frontend';
import { seo } from 'wix-seo';
import {
  parseProductIds,
  shouldShowEmpty,
  buildColumnData,
  buildAttributeRows,
  buildCompareTitle,
  buildCompareDescription,
  buildItemListSchema,
  buildMobileSnapCss,
  removeProductFromCompare,
  buildCompareUrl,
} from 'public/comparePageHelpers.js';
import { colors } from 'public/designTokens.js';
import { business } from 'public/sharedTokens.js';
import { isMobile } from 'public/mobileHelpers';
import { initPageSeo } from 'public/pageSeo.js';

$w.onReady(async () => {
  // S5: static SEO defaults (overridden with dynamic values after products load)
  initPageSeo('compareProducts').catch(() => {});

  // S1: Parse URL params
  const ids = parseProductIds(wixLocation.query);

  if (shouldShowEmpty(ids)) {
    _showEmptyState();
    return;
  }

  // S1: Fetch products in parallel — skeleton opacity while loading
  let fetchedProducts;
  try {
    $w('#compareGridSection').style.opacity = '0.4';
    fetchedProducts = await Promise.all(
      ids.map(id => products.getProduct(id))
    );
    $w('#compareGridSection').style.opacity = '1';
  } catch (err) {
    console.error('[ComparePage] Failed to fetch products:', err);
    _showErrorState('Unable to load products. Please try again.');
    return;
  }

  const validProducts = fetchedProducts.filter(Boolean);
  if (shouldShowEmpty(validProducts.map(p => p._id))) {
    _showEmptyState();
    return;
  }

  // S5: SEO
  _applySeo(validProducts);

  // S2: Render columns
  _renderColumns(validProducts);

  // S3: Render attributes table
  _renderAttributeRows(validProducts);

  // S4: Mobile snap CSS (only inject when on mobile)
  if (isMobile()) {
    try {
      $w('#compareMobileSnapHtml').postMessage(buildMobileSnapCss());
    } catch (e) {}
  }

  // S6: Reset / Start Over
  $w('#compareResetBtn').onClick(() => {
    wixLocation.to('/shop-main');
  });

  $w('#compareEmptyShopBtn').onClick(() => {
    wixLocation.to('/shop-main');
  });
});

// ── S2: Column rendering ─────────────────────────────────────────────────────

function _renderColumns(prods) {
  const colData = buildColumnData(prods);

  $w('#compareSubtitle').text = `Comparing ${prods.length} product${prods.length > 1 ? 's' : ''}`;

  $w('#compareColRepeater').data = colData;
  $w('#compareColRepeater').onItemReady(($item, itemData) => {
    $item('#compareColImage').src = itemData.image;
    $item('#compareColName').text = itemData.name;
    $item('#compareColName').onClick(() => {
      wixLocation.to(itemData.productUrl);
    });

    $item('#compareColPrice').text = itemData.showOrigPrice
      ? itemData.salePrice
      : itemData.price;

    if (itemData.showOrigPrice) {
      $item('#compareColOrigPrice').text = itemData.origPrice;
      try { $item('#compareColOrigPrice').style.textDecoration = 'line-through'; } catch (e) {}
      try { $item('#compareColOrigPrice').show(); } catch (e) {}
    } else {
      try { $item('#compareColOrigPrice').hide(); } catch (e) {}
    }

    if (itemData.showBadge) {
      $item('#compareColBadge').text = itemData.badge;
      try { $item('#compareColBadge').show(); } catch (e) {}
    } else {
      try { $item('#compareColBadge').hide(); } catch (e) {}
    }

    // Add to cart cycle: Add → Adding… → Added! → (2s) → Add to Cart
    $item('#compareColAddCart').onClick(async () => {
      try {
        $item('#compareColAddCart').disable();
        $item('#compareColAddCart').label = 'Adding...';
        const { addToCart } = await import('public/cartService');
        await addToCart(itemData._id);
        $item('#compareColAddCart').label = 'Added!';
        setTimeout(() => {
          try {
            $item('#compareColAddCart').label = 'Add to Cart';
            $item('#compareColAddCart').enable();
          } catch (e) {}
        }, 2000);
      } catch (err) {
        console.error('[ComparePage] Add to cart failed:', err);
        $item('#compareColAddCart').label = 'Error — Try Again';
        $item('#compareColAddCart').enable();
      }
    });

    $item('#compareColViewBtn').onClick(() => {
      wixLocation.to(itemData.productUrl);
    });

    // Remove from compare — updates URL params, no full navigation
    $item('#compareColRemoveBtn').onClick(() => {
      const currentIds = parseProductIds(wixLocation.query);
      const newIds = removeProductFromCompare(currentIds, itemData._id);
      wixLocation.to(buildCompareUrl(newIds));
    });
  });
}

// ── S3: Attributes table ─────────────────────────────────────────────────────

function _renderAttributeRows(prods) {
  const rows = buildAttributeRows(prods);
  $w('#compareAttrRepeater').data = rows;

  $w('#compareAttrRepeater').onItemReady(($item, itemData) => {
    $item('#compareAttrLabel').text = itemData.label;

    const cellWidth = Math.floor(100 / itemData.values.length);
    const diffBg = itemData.hasDiff
      ? `background-color:rgba(168,204,216,0.15);`
      : '';

    const cellsHtml = itemData.values
      .map(val =>
        `<div style="display:inline-block;width:${cellWidth}%;${diffBg}padding:4px 8px;box-sizing:border-box;">${val}</div>`
      )
      .join('');

    try {
      $item('#compareAttrRow').html = cellsHtml;
    } catch (e) {
      try { $item('#compareAttrRow').text = itemData.values.join(' | '); } catch (_) {}
    }
  });
}

// ── S5: SEO ──────────────────────────────────────────────────────────────────

function _applySeo(prods) {
  try {
    seo.setTitle(buildCompareTitle(prods));
    seo.setMetaTag({ name: 'description', content: buildCompareDescription(prods) });
    seo.setLinks([{ rel: 'canonical', href: `${business.baseUrl}/compare` }]);

    const schema = buildItemListSchema(prods, business.baseUrl);
    try {
      $w('#compareSchemaHtml').postMessage(
        `<script type="application/ld+json">${JSON.stringify(schema)}<\/script>`
      );
    } catch (e) {}
  } catch (e) {
    console.warn('[ComparePage] SEO setup failed:', e);
  }
}

// ── State helpers ─────────────────────────────────────────────────────────────

function _showEmptyState() {
  try { $w('#compareEmptySection').show(); } catch (e) {}
  try { $w('#compareGridSection').hide(); } catch (e) {}
  try { $w('#compareAttrSection').hide(); } catch (e) {}
  try { $w('#compareErrorSection').hide(); } catch (e) {}
}

function _showErrorState(msg) {
  try { $w('#compareErrorSection').show(); } catch (e) {}
  try { $w('#compareErrorText').text = msg; } catch (e) {}
  try { $w('#compareGridSection').hide(); } catch (e) {}
  try { $w('#compareAttrSection').hide(); } catch (e) {}
  try { $w('#compareEmptySection').hide(); } catch (e) {}
  try { $w('#compareGridSection').style.opacity = '1'; } catch (e) {}
}
