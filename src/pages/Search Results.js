// Search Results.js - Search Results Page
// Full-text search with autocomplete, filters, sorting via searchService backend
import wixLocationFrontend from 'wix-location-frontend';
import { trackEvent } from 'public/engagementTracker';
import { fireSearch, fireViewItemList } from 'public/ga4Tracking';
import { addToCart } from 'public/cartService';
import { limitForViewport, initBackToTop, getViewport, onViewportChange } from 'public/mobileHelpers';
import {
  fullTextSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
  getFilterValues,
} from 'backend/searchService.web';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { batchCheckWishlistStatus, initCardWishlistButton } from 'public/WishlistCardButton.js';
import { buildProductBadgeOverlay } from 'public/galleryHelpers';
import { getSwatchPreviewColors } from 'backend/swatchService.web';
import { buildSkeletonData, getActiveFilterCount, buildSearchChips } from 'public/SearchResultsHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';

let _debounceTimer = null;
let _currentQuery = '';
let _currentSort = 'relevance';
let _currentCategory = '';
let _currentPriceRange = '';
let _currentMaterial = '';
let _currentColor = '';
let _currentOffset = 0;
const PAGE_SIZE = 24;

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('searchResults');

  const query = wixLocationFrontend.query?.q || '';
  _currentQuery = query;

  setupAutocomplete();
  setupFilters();
  setupSorting();

  if (query) {
    try { $w('#searchInput').value = query; } catch (e) {}
    await performSearch(query);
  } else {
    showEmptyState();
  }

  // Re-render results when viewport changes (e.g. device rotation)
  onViewportChange(() => {
    if (_currentQuery) {
      try { performSearch(_currentQuery); } catch (e) {}
    }
  });
});

// ─── Search ──────────────────────────────────────────────────────

async function performSearch(query) {
  try {
    _currentQuery = query;
    _currentOffset = 0;

    try { $w('#searchQuery').text = `Results for "${query}"`; } catch (e) {}
    showSkeletonGrid();

    trackEvent('page_view', { page: 'search', query });

    const result = await fullTextSearch({
      query,
      category: _currentCategory,
      priceRange: _currentPriceRange,
      material: _currentMaterial,
      color: _currentColor,
      sortBy: _currentSort,
      limit: PAGE_SIZE,
      offset: 0,
    });

    hideSkeletonGrid();

    if (!result?.products || result.products.length === 0) {
      trackEvent('search_no_results', { query });
      showNoResults(query);
      return;
    }

    trackEvent('search_results', { query, resultCount: result.total });
    fireSearch(query, result.total).catch(() => {});
    fireViewItemList(result.products, 'search_results').catch(() => {});

    try {
      $w('#resultCount').text = `${result.total} product${result.total !== 1 ? 's' : ''} found`;
      try { $w('#resultCount').accessibility.ariaLive = 'polite'; } catch (e) {}
    } catch (e) {}

    announce($w, `${result.total} product${result.total !== 1 ? 's' : ''} found for "${query}"`);

    try { $w('#noResultsBox').hide(); } catch (e) {}

    await renderResults(result.products, query);

    // Show load more if there are additional pages
    try {
      if (result.total > PAGE_SIZE) {
        $w('#loadMoreBtn').show();
        $w('#loadMoreBtn').enable();
        $w('#loadMoreBtn').label = 'Load More';
      } else {
        $w('#loadMoreBtn').hide();
      }
    } catch (e) {}
  } catch (err) {
    console.error('Search error:', err);
    hideSkeletonGrid();
    showNoResults(query);
  }
}

async function renderResults(products, query) {
  const repeater = $w('#searchRepeater');
  if (!repeater) return;

  try { repeater.expand(); } catch (e) {}

  let wishlistedIds = new Set();
  try {
    wishlistedIds = await batchCheckWishlistStatus(products.map(p => p._id));
  } catch (e) {}

  repeater.onItemReady(($item, itemData) => {
    $item('#searchImage').src = itemData.mainMedia;
    $item('#searchImage').alt = `${itemData.name} - Carolina Futons`;
    $item('#searchName').text = itemData.name;
    $item('#searchPrice').text = itemData.formattedPrice;
    try {
      const desc = stripHtml(itemData.description || '').substring(0, 120);
      $item('#searchDesc').text = desc ? desc + '...' : '';
    } catch (e) {}

    // ── Badge overlay ──
    try {
      const badge = buildProductBadgeOverlay(itemData);
      if (badge) {
        $item('#searchRibbon').text = badge.text;
        $item('#searchRibbon').show();
      } else {
        $item('#searchRibbon').hide();
      }
    } catch (e) {}

    // Show discounted price
    try {
      if (itemData.discountedPrice && itemData.discountedPrice < itemData.price) {
        $item('#searchOrigPrice').text = itemData.formattedPrice;
        $item('#searchOrigPrice').show();
        $item('#searchPrice').text = itemData.formattedDiscountedPrice;
      } else {
        $item('#searchOrigPrice').hide();
      }
    } catch (e) {}

    const navigate = () => {
      trackEvent('search_click', { query, productId: itemData._id, productName: itemData.name });
      import('wix-location-frontend').then(({ to }) => {
        to(`/product-page/${itemData.slug}`);
      });
    };
    makeClickable($item('#searchImage'), navigate, { ariaLabel: `View ${itemData.name}` });
    makeClickable($item('#searchName'), navigate, { ariaLabel: `View ${itemData.name} details` });

    // Quick add to cart
    try {
      try { $item('#searchAddBtn').accessibility.ariaLabel = `Add ${itemData.name} to cart`; } catch (e) {}
      $item('#searchAddBtn').label = 'Add to Cart';
      $item('#searchAddBtn').enable();
      $item('#searchAddBtn').onClick(async () => {
        try {
          $item('#searchAddBtn').label = 'Adding...';
          $item('#searchAddBtn').disable();
          await addToCart(itemData._id);
          $item('#searchAddBtn').label = 'Added!';
          trackEvent('add_to_cart', { productId: itemData._id, source: 'search' });
          setTimeout(() => {
            try {
              $item('#searchAddBtn').label = 'Add to Cart';
              $item('#searchAddBtn').enable();
            } catch (e) {}
          }, 3000);
        } catch (err) {
          console.error('Error adding from search:', err);
          $item('#searchAddBtn').label = 'Error';
          setTimeout(() => {
            try {
              $item('#searchAddBtn').label = 'Add to Cart';
              $item('#searchAddBtn').enable();
            } catch (e) {}
          }, 3000);
        }
      });
    } catch (e) {}

    // ── Wishlist heart ──
    try {
      const isWishlisted = wishlistedIds.has(itemData._id);
      initCardWishlistButton($item, itemData, isWishlisted);
    } catch (e) {}

    // ── Swatch preview dots ──
    initGridSwatchPreview($item, itemData);
  });

  const mapped = products.map(p => ({
    ...p,
    _id: p._id,
  }));
  repeater.data = limitForViewport(mapped, { mobile: 8, tablet: 12, desktop: 24 });
}

function showSkeletonGrid() {
  try {
    const repeater = $w('#searchRepeater');
    if (!repeater) return;

    const viewport = getViewport();
    const count = (viewport === 'mobile' || viewport === 'mobileLarge') ? 4 : viewport === 'tablet' ? 6 : 8;
    const skeletons = buildSkeletonData(count);

    repeater.onItemReady(($item, itemData) => {
      if (!itemData.isSkeleton) return;
      try { $item('#searchName').text = ''; } catch (e) {}
      try { $item('#searchPrice').text = ''; } catch (e) {}
      try { $item('#searchDesc').text = ''; } catch (e) {}
      try { $item('#searchRibbon').hide(); } catch (e) {}
      try { $item('#searchAddBtn').hide(); } catch (e) {}
      try { $item('#searchImage').src = ''; } catch (e) {}
    });

    repeater.data = skeletons;
    repeater.expand();
  } catch (e) {}
  try { $w('#loadMoreBtn').hide(); } catch (e) {}
}

function hideSkeletonGrid() {
  try { $w('#loadingIndicator').hide(); } catch (e) {}
}

async function initGridSwatchPreview($item, itemData) {
  try {
    const preview = $item('#searchSwatchPreview');
    if (!preview) return;

    const colls = Array.isArray(itemData.collections) ? itemData.collections : [];
    const hasFabricOptions = colls.some(c =>
      c.includes('futon') || c.includes('frame') || c.includes('wall-hugger') ||
      c.includes('sofa') || c.includes('loveseat') || c.includes('sleeper')
    );

    if (!hasFabricOptions) {
      preview.collapse();
      return;
    }

    const swatchColors = await getSwatchPreviewColors(itemData._id, 4);
    if (!swatchColors || swatchColors.length === 0) {
      preview.collapse();
      return;
    }

    const dotIds = ['#searchSwatchDot1', '#searchSwatchDot2', '#searchSwatchDot3', '#searchSwatchDot4'];
    dotIds.forEach((dotId, i) => {
      try {
        const dot = $item(dotId);
        if (i < swatchColors.length) {
          dot.style.backgroundColor = swatchColors[i].colorHex;
          dot.show();
        } else {
          dot.hide();
        }
      } catch (e) {}
    });

    preview.expand();
  } catch (e) {}
}

// ─── Autocomplete ────────────────────────────────────────────────

function setupAutocomplete() {
  try {
    const input = $w('#searchInput');
    if (!input) return;

    try { input.accessibility.ariaLabel = 'Search products'; } catch (e) {}
    try { $w('#suggestionsBox').accessibility.role = 'listbox'; } catch (e) {}

    input.onInput((event) => {
      const value = event.target.value || '';
      clearTimeout(_debounceTimer);
      if (value.length < 2) {
        hideSuggestions();
        return;
      }
      _debounceTimer = setTimeout(async () => {
        try {
          const { suggestions } = await getAutocompleteSuggestions(value, 6);
          showSuggestions(suggestions);
        } catch (e) {
          hideSuggestions();
        }
      }, 250);
    });

    input.onKeyPress((event) => {
      if (event.key === 'Enter') {
        hideSuggestions();
        const value = input.value || '';
        if (value.trim()) {
          performSearch(value.trim());
        }
      }
    });
  } catch (e) {}

  // Search button
  try {
    $w('#searchBtn').onClick(() => {
      hideSuggestions();
      const value = $w('#searchInput').value || '';
      if (value.trim()) {
        performSearch(value.trim());
      }
    });
    try { $w('#searchBtn').accessibility.ariaLabel = 'Search products'; } catch (e) {}
  } catch (e) {}

  // Load more button
  try {
    $w('#loadMoreBtn').onClick(async () => {
      try {
        $w('#loadMoreBtn').label = 'Loading...';
        $w('#loadMoreBtn').disable();
      } catch (e) {}
      const nextOffset = _currentOffset + PAGE_SIZE;
      try {
        const result = await fullTextSearch({
          query: _currentQuery,
          category: _currentCategory,
          priceRange: _currentPriceRange,
          material: _currentMaterial,
          color: _currentColor,
          sortBy: _currentSort,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        const products = result?.products || [];
        if (products.length > 0) {
          _currentOffset = nextOffset;
          const repeater = $w('#searchRepeater');
          if (repeater) {
            const existing = Array.isArray(repeater.data) ? repeater.data : [];
            repeater.data = [...existing, ...products.map(p => ({ ...p, _id: p._id }))];
          }
        }
        try {
          if (_currentOffset + PAGE_SIZE >= result.total) {
            $w('#loadMoreBtn').hide();
          } else {
            $w('#loadMoreBtn').label = 'Load More';
            $w('#loadMoreBtn').enable();
          }
        } catch (e) {}
      } catch (err) {
        console.error('Load more failed:', err);
        try {
          $w('#loadMoreBtn').label = 'Load More';
          $w('#loadMoreBtn').enable();
        } catch (e) {}
      }
    });
  } catch (e) {}
}

function showSuggestions(suggestions) {
  try {
    const box = $w('#suggestionsBox');
    const repeater = $w('#suggestionsRepeater');
    if (!box || !repeater || suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      $item('#suggestionText').text = itemData.text;
      try {
        const typeLabel = itemData.type === 'category' ? 'Category' : itemData.type === 'popular' ? 'Trending' : 'Product';
        $item('#suggestionType').text = typeLabel;
      } catch (e) {}
      try { $item('#suggestionText').accessibility.ariaLabel = `Search for ${itemData.text}`; } catch (e) {}
      $item('#suggestionText').onClick(() => {
        hideSuggestions();
        if (itemData.type === 'category') {
          import('wix-location-frontend').then(({ to }) => {
            to(`/${itemData.slug}`);
          });
        } else {
          try { $w('#searchInput').value = itemData.text; } catch (e) {}
          performSearch(itemData.text);
        }
      });
    });

    repeater.data = suggestions.map((s, i) => ({ _id: `sug-${i}`, ...s }));
    box.show();
  } catch (e) {}
}

function hideSuggestions() {
  try { $w('#suggestionsBox').hide(); } catch (e) {}
}

// ─── Filters ─────────────────────────────────────────────────────

function setupFilters() {
  // Category filter dropdown
  try {
    $w('#categoryFilter').onChange((event) => {
      _currentCategory = event.target.value || '';
      updateFilterBadge();
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#categoryFilter').accessibility.ariaLabel = 'Filter by category'; } catch (e) {}
  } catch (e) {}

  // Price range filter dropdown
  try {
    $w('#priceFilter').onChange((event) => {
      _currentPriceRange = event.target.value || '';
      updateFilterBadge();
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#priceFilter').accessibility.ariaLabel = 'Filter by price range'; } catch (e) {}
  } catch (e) {}

  // Material filter dropdown
  try {
    $w('#materialFilter').onChange((event) => {
      _currentMaterial = event.target.value || '';
      updateFilterBadge();
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#materialFilter').accessibility.ariaLabel = 'Filter by material'; } catch (e) {}
  } catch (e) {}

  // Color filter dropdown
  try {
    $w('#colorFilter').onChange((event) => {
      _currentColor = event.target.value || '';
      updateFilterBadge();
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#colorFilter').accessibility.ariaLabel = 'Filter by color'; } catch (e) {}
  } catch (e) {}

  // Mobile filter sidebar toggle
  try {
    $w('#filterToggleBtn').onClick(() => {
      try {
        const sidebar = $w('#filterSidebar');
        if (sidebar.hidden) {
          sidebar.show();
        } else {
          sidebar.hide();
        }
      } catch (e) {}
    });
    try { $w('#filterToggleBtn').accessibility.ariaLabel = 'Toggle filters'; } catch (e) {}
  } catch (e) {}

  // Clear filters button
  try {
    $w('#clearFiltersBtn').onClick(() => {
      _currentCategory = '';
      _currentPriceRange = '';
      _currentMaterial = '';
      _currentColor = '';
      _currentSort = 'relevance';
      try { $w('#categoryFilter').value = ''; } catch (e) {}
      try { $w('#priceFilter').value = ''; } catch (e) {}
      try { $w('#materialFilter').value = ''; } catch (e) {}
      try { $w('#colorFilter').value = ''; } catch (e) {}
      try { $w('#sortDropdown').value = 'relevance'; } catch (e) {}
      updateFilterBadge();
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#clearFiltersBtn').accessibility.ariaLabel = 'Clear all filters'; } catch (e) {}
  } catch (e) {}

  // Load facet data for filter dropdowns
  loadFilterFacets();
}

async function loadFilterFacets() {
  try {
    const facets = await getFilterValues();
    if (!facets) return;

    if (facets.materials && facets.materials.length > 0) {
      try {
        $w('#materialFilter').options = [
          { label: 'All Materials', value: '' },
          ...facets.materials.map(m => ({ label: `${m.value} (${m.count})`, value: m.value })),
        ];
      } catch (e) {}
    }

    if (facets.colors && facets.colors.length > 0) {
      try {
        $w('#colorFilter').options = [
          { label: 'All Colors', value: '' },
          ...facets.colors.map(c => ({ label: `${c.value} (${c.count})`, value: c.value })),
        ];
      } catch (e) {}
    }
  } catch (e) {}
}

function updateFilterBadge() {
  try {
    const count = getActiveFilterCount({
      category: _currentCategory,
      priceRange: _currentPriceRange,
      material: _currentMaterial,
      color: _currentColor,
    });
    const badge = $w('#filterBadge');
    if (count > 0) {
      badge.text = String(count);
      badge.show();
    } else {
      badge.hide();
    }
  } catch (e) {}
}

// ─── Sorting ─────────────────────────────────────────────────────

function setupSorting() {
  try {
    $w('#sortDropdown').onChange((event) => {
      _currentSort = event.target.value || 'relevance';
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#sortDropdown').accessibility.ariaLabel = 'Sort results'; } catch (e) {}
  } catch (e) {}
}

// ─── Empty / No Results States ───────────────────────────────────

function showNoResults(query) {
  try {
    $w('#searchQuery').text = `No results for "${query}"`;
    $w('#noResultsBox').show();
    try { $w('#noResultsBox').accessibility.role = 'status'; } catch (e) {}
    $w('#searchRepeater').collapse();
    $w('#loadMoreBtn').hide();
    announce($w, `No results found for "${query}". Try a different search.`);
  } catch (e) {}

  try { $w('#noResultsText').text = 'Try one of these popular searches:'; } catch (e) {}
  loadPopularChips();
}

async function showEmptyState() {
  try {
    $w('#searchQuery').text = 'Search Carolina Futons';
    $w('#searchRepeater').collapse();
    $w('#loadMoreBtn').hide();
  } catch (e) {}

  try { $w('#noResultsText').text = 'Popular searches:'; } catch (e) {}
  loadPopularChips();
}

async function loadPopularChips() {
  const fallbackQueries = ['futon frames', 'mattresses', 'murphy beds', 'platform beds', 'accessories'];
  try {
    const { queries = [] } = await getPopularSearches(8) || {};
    const queryStrings = queries.length > 0
      ? queries.map(q => q.query)
      : fallbackQueries;
    const chips = buildSearchChips(queryStrings, 8);

    const chipsRepeater = $w('#searchChipsRepeater');
    if (!chipsRepeater) return;

    chipsRepeater.onItemReady(($item, itemData) => {
      try { $item('#chipLabel').text = itemData.label; } catch (e) {}
      try {
        $item('#chipLabel').accessibility.ariaLabel = `Search for ${itemData.label}`;
      } catch (e) {}
      try {
        makeClickable($item('#chipLabel'), () => {
          try { $w('#searchInput').value = itemData.query; } catch (e) {}
          performSearch(itemData.query);
        }, { ariaLabel: `Search for ${itemData.label}` });
      } catch (e) {}
    });

    chipsRepeater.data = chips;
    try { chipsRepeater.expand(); } catch (e) {}
  } catch (e) {
    // Fallback: show chips from defaults
    try {
      const chips = buildSearchChips(fallbackQueries, 8);
      const chipsRepeater = $w('#searchChipsRepeater');
      if (!chipsRepeater) return;

      chipsRepeater.onItemReady(($item, itemData) => {
        try { $item('#chipLabel').text = itemData.label; } catch (e2) {}
        try {
          makeClickable($item('#chipLabel'), () => {
            try { $w('#searchInput').value = itemData.query; } catch (e2) {}
            performSearch(itemData.query);
          }, { ariaLabel: `Search for ${itemData.label}` });
        } catch (e2) {}
      });

      chipsRepeater.data = chips;
      try { chipsRepeater.expand(); } catch (e2) {}
    } catch (e2) {}
  }
}

function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
