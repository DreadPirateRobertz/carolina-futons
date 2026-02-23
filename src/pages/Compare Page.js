// Compare Page.js - Side-by-side product comparison
// Displays up to 4 products with specs, diff highlighting, winner badges
import { getComparisonData, buildShareableUrl, trackComparison } from 'backend/comparisonService.web';
import { getCompareList, removeFromCompare, addToCompare } from 'public/galleryHelpers.js';
import { colors } from 'public/designTokens.js';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { trackProductPageView } from 'public/engagementTracker';
import { announce, makeClickable } from 'public/a11yHelpers';
import wixLocationFrontend from 'wix-location-frontend';

let comparisonData = null;

$w.onReady(async function () {
  await initComparePage();
});

async function initComparePage() {
  try {
    // Get product IDs from URL query or session compare list
    const query = wixLocationFrontend.query;
    let productIds = [];

    if (query.ids) {
      productIds = query.ids.split(',').filter(Boolean).slice(0, 4);
    }

    // Fall back to session compare list
    if (productIds.length < 2) {
      const compareList = getCompareList();
      productIds = compareList.map(p => p._id);
    }

    if (productIds.length < 2) {
      showEmptyState();
      return;
    }

    // Show loading
    try { $w('#compareLoading').show(); } catch (e) {}
    try { $w('#compareContent').hide(); } catch (e) {}

    // Fetch comparison data
    comparisonData = await getComparisonData(productIds);

    try { $w('#compareLoading').hide(); } catch (e) {}

    if (!comparisonData?.success) {
      showEmptyState();
      return;
    }

    try { $w('#compareContent').show(); } catch (e) {}

    // Track page view and log comparison to CMS
    trackProductPageView({ name: 'Product Comparison', _id: 'compare-page' });
    trackComparison(productIds).catch(err => console.error('[Compare] trackComparison failed:', err.message));

    // Render
    renderProductHeaders();
    renderComparisonRows();
    renderWinnerBadges();
    initShareButton();
    initRemoveButtons();
    initAddProductButton();

    // Mobile: back-to-top
    collapseOnMobile($w, ['#compareShareSection']);
    initBackToTop($w);
  } catch (err) {
    console.error('Error initializing compare page:', err);
    showEmptyState();
  }
}

// ── Empty State ─────────────────────────────────────────────────

function showEmptyState() {
  try { $w('#compareLoading').hide(); } catch (e) {}
  try { $w('#compareContent').hide(); } catch (e) {}
  try { $w('#compareEmptyState').show(); } catch (e) {}
  try { $w('#compareEmptyState').expand(); } catch (e) {}
  try {
    $w('#emptyStateTitle').text = 'Compare Products';
    $w('#emptyStateTitle').accessibility.ariaLabel = 'No products to compare';
  } catch (e) {}
  try {
    $w('#emptyStateText').text = 'Add at least 2 products to compare. Browse our categories to find products you\'d like to compare side by side.';
  } catch (e) {}
  try {
    $w('#browseProductsBtn').onClick(() => {
      wixLocationFrontend.to('/futon-frames');
    });
    $w('#browseProductsBtn').accessibility.ariaLabel = 'Browse products to compare';
  } catch (e) {}
}

// ── Product Headers ─────────────────────────────────────────────

function renderProductHeaders() {
  if (!comparisonData?.products) return;

  const products = comparisonData.products;

  // Render up to 4 product header columns
  for (let i = 0; i < 4; i++) {
    const idx = i + 1;
    const product = products[i];

    if (!product) {
      try { $w(`#compareCol${idx}`).collapse(); } catch (e) {}
      continue;
    }

    try { $w(`#compareCol${idx}`).expand(); } catch (e) {}
    try {
      $w(`#compareImage${idx}`).src = product.mainMedia;
      $w(`#compareImage${idx}`).alt = `${product.name} - Carolina Futons`;
    } catch (e) {}
    try { $w(`#compareName${idx}`).text = product.name; } catch (e) {}
    try {
      if (product.formattedDiscountedPrice) {
        $w(`#comparePrice${idx}`).text = product.formattedDiscountedPrice;
      } else {
        $w(`#comparePrice${idx}`).text = product.formattedPrice;
      }
    } catch (e) {}

    // Ribbon badge
    if (product.ribbon) {
      try {
        $w(`#compareBadge${idx}`).text = product.ribbon;
        $w(`#compareBadge${idx}`).show();
      } catch (e) {}
    } else {
      try { $w(`#compareBadge${idx}`).hide(); } catch (e) {}
    }

    // Click to navigate to product
    try {
      const slug = product.slug;
      makeClickable($w(`#compareImage${idx}`), () => {
        wixLocationFrontend.to(`/product-page/${slug}`);
      }, { ariaLabel: `View ${product.name}` });
      makeClickable($w(`#compareName${idx}`), () => {
        wixLocationFrontend.to(`/product-page/${slug}`);
      }, { ariaLabel: `View ${product.name}` });
    } catch (e) {}

    // ARIA
    try { $w(`#compareCol${idx}`).accessibility.role = 'region'; } catch (e) {}
    try { $w(`#compareCol${idx}`).accessibility.ariaLabel = `Product ${idx}: ${product.name}`; } catch (e) {}
  }

  // Page title
  try {
    const count = products.length;
    $w('#comparePageTitle').text = `Comparing ${count} Products`;
    $w('#comparePageTitle').accessibility.ariaLabel = `Comparing ${count} products side by side`;
  } catch (e) {}
}

// ── Comparison Rows ─────────────────────────────────────────────

function renderComparisonRows() {
  if (!comparisonData?.rows) return;

  try {
    const repeater = $w('#comparisonRowRepeater');
    if (!repeater) return;

    const rowData = comparisonData.rows.map((row, idx) => ({
      _id: `row-${idx}`,
      ...row,
    }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#rowLabel').text = itemData.label; } catch (e) {}

      // Render cells (up to 4)
      for (let i = 0; i < 4; i++) {
        const cell = itemData.cells[i];
        const cellId = `#rowCell${i + 1}`;

        if (!cell) {
          try { $item(cellId).collapse(); } catch (e) {}
          continue;
        }

        try { $item(cellId).expand(); } catch (e) {}
        try { $item(cellId).text = cell.value; } catch (e) {}

        // Highlight differing cells
        if (itemData.differs) {
          try { $item(cellId).style.backgroundColor = colors.sandLight || '#FFF8F0'; } catch (e) {}
        }
      }

      // ARIA for row
      try { $item('#rowLabel').accessibility.ariaLabel = `Attribute: ${itemData.label}`; } catch (e) {}
    });

    repeater.data = rowData;
  } catch (e) {}
}

// ── Winner Badges ───────────────────────────────────────────────

function renderWinnerBadges() {
  if (!comparisonData?.badges || !comparisonData?.products) return;

  const { badges, products } = comparisonData;

  for (let i = 0; i < products.length; i++) {
    const idx = i + 1;
    const productId = products[i]._id;
    const badgeTexts = [];

    if (badges.bestValue === productId) badgeTexts.push('Best Value');
    if (badges.bestRated === productId) badgeTexts.push('Best Rated');
    if (badges.mostPopular === productId) badgeTexts.push('Most Popular');

    if (badgeTexts.length > 0) {
      try {
        $w(`#winnerBadge${idx}`).text = badgeTexts.join(' | ');
        $w(`#winnerBadge${idx}`).show();
        $w(`#winnerBadge${idx}`).style.color = colors.mountainBlue;
        $w(`#winnerBadge${idx}`).accessibility.ariaLabel = `Awards: ${badgeTexts.join(', ')}`;
      } catch (e) {}
    } else {
      try { $w(`#winnerBadge${idx}`).hide(); } catch (e) {}
    }
  }
}

// ── Share Button ────────────────────────────────────────────────

async function initShareButton() {
  try {
    const ids = comparisonData.products.map(p => p._id);
    const shareUrl = await buildShareableUrl(ids);

    $w('#shareCompareBtn').onClick(async () => {
      try {
        const baseUrl = wixLocationFrontend.baseUrl;
        const fullUrl = `${baseUrl}${shareUrl}`;

        // Copy to clipboard via Wix
        $w('#shareCompareBtn').label = 'Link Copied!';
        try { $w('#shareUrlText').text = fullUrl; } catch (e) {}
        try { $w('#shareUrlText').show(); } catch (e) {}
        announce($w, 'Comparison link copied to clipboard');

        setTimeout(() => {
          try { $w('#shareCompareBtn').label = 'Share Comparison'; } catch (e) {}
        }, 3000);
      } catch (e) {}
    });

    try { $w('#shareCompareBtn').accessibility.ariaLabel = 'Copy shareable comparison link'; } catch (e) {}
  } catch (e) {}
}

// ── Remove Product Buttons ──────────────────────────────────────

function initRemoveButtons() {
  if (!comparisonData?.products) return;

  for (let i = 0; i < comparisonData.products.length; i++) {
    const idx = i + 1;
    const product = comparisonData.products[i];

    try {
      $w(`#removeProduct${idx}`).onClick(async () => {
        removeFromCompare(product._id);
        const remaining = comparisonData.products.filter(p => p._id !== product._id);

        if (remaining.length < 2) {
          showEmptyState();
          return;
        }

        // Reload with remaining products
        const ids = remaining.map(p => p._id).join(',');
        wixLocationFrontend.to(`/compare?ids=${ids}`);
      });
      $w(`#removeProduct${idx}`).accessibility.ariaLabel = `Remove ${product.name} from comparison`;
    } catch (e) {}
  }
}

// ── Add Product Button ──────────────────────────────────────────

function initAddProductButton() {
  if (!comparisonData?.products) return;

  if (comparisonData.products.length >= 4) {
    try { $w('#addProductBtn').collapse(); } catch (e) {}
    return;
  }

  try {
    $w('#addProductBtn').onClick(() => {
      // Navigate to category to pick more products
      const category = comparisonData.sharedCategory || 'futon-frames';
      wixLocationFrontend.to(`/${category}`);
    });
    $w('#addProductBtn').accessibility.ariaLabel = 'Add another product to comparison';
  } catch (e) {}
}
