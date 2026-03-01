// Search Results.js - Search Results Page
// Full-text search with autocomplete, filters, sorting via searchService backend
import wixLocationFrontend from 'wix-location-frontend';
import { trackEvent } from 'public/engagementTracker';
import { addToCart } from 'public/cartService';
import { limitForViewport, initBackToTop } from 'public/mobileHelpers';
import {
  fullTextSearch,
  getAutocompleteSuggestions,
  getPopularSearches,
} from 'backend/searchService.web';
import { announce, makeClickable } from 'public/a11yHelpers.js';

let _debounceTimer = null;
let _currentQuery = '';
let _currentSort = 'relevance';
let _currentCategory = '';
let _currentPriceRange = '';
let _currentOffset = 0;
const PAGE_SIZE = 24;

$w.onReady(async function () {
  initBackToTop($w);

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
});

// ─── Search ──────────────────────────────────────────────────────

async function performSearch(query) {
  try {
    _currentQuery = query;
    _currentOffset = 0;

    try { $w('#searchQuery').text = `Results for "${query}"`; } catch (e) {}
    try { $w('#loadingIndicator').show(); } catch (e) {}

    trackEvent('page_view', { page: 'search', query });

    const result = await fullTextSearch({
      query,
      category: _currentCategory,
      priceRange: _currentPriceRange,
      sortBy: _currentSort,
      limit: PAGE_SIZE,
      offset: 0,
    });

    try { $w('#loadingIndicator').hide(); } catch (e) {}

    if (!result?.products || result.products.length === 0) {
      trackEvent('search_no_results', { query });
      showNoResults(query);
      return;
    }

    trackEvent('search_results', { query, resultCount: result.total });

    try {
      $w('#resultCount').text = `${result.total} product${result.total !== 1 ? 's' : ''} found`;
      try { $w('#resultCount').accessibility.ariaLive = 'polite'; } catch (e) {}
    } catch (e) {}

    announce($w, `${result.total} product${result.total !== 1 ? 's' : ''} found for "${query}"`);

    try { $w('#noResultsBox').hide(); } catch (e) {}

    renderResults(result.products, query);

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
    try { $w('#loadingIndicator').hide(); } catch (e) {}
    showNoResults(query);
  }
}

function renderResults(products, query) {
  const repeater = $w('#searchRepeater');
  if (!repeater) return;

  try { repeater.expand(); } catch (e) {}

  repeater.onItemReady(($item, itemData) => {
    $item('#searchImage').src = itemData.mainMedia;
    $item('#searchImage').alt = `${itemData.name} - Carolina Futons`;
    $item('#searchName').text = itemData.name;
    $item('#searchPrice').text = itemData.formattedPrice;
    try {
      $item('#searchDesc').text = stripHtml(itemData.description || '').substring(0, 120) + '...';
    } catch (e) {}

    // Show sale ribbon
    try {
      if (itemData.ribbon) {
        $item('#searchRibbon').text = itemData.ribbon;
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
  });

  const mapped = products.map(p => ({
    ...p,
    _id: p._id,
  }));
  repeater.data = limitForViewport(mapped, { mobile: 8, tablet: 12, desktop: 24 });
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
          sortBy: _currentSort,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        _currentOffset = nextOffset;
        const products = result?.products || [];
        if (products.length > 0) {
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
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#categoryFilter').accessibility.ariaLabel = 'Filter by category'; } catch (e) {}
  } catch (e) {}

  // Price range filter dropdown
  try {
    $w('#priceFilter').onChange((event) => {
      _currentPriceRange = event.target.value || '';
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#priceFilter').accessibility.ariaLabel = 'Filter by price range'; } catch (e) {}
  } catch (e) {}

  // Clear filters button
  try {
    $w('#clearFiltersBtn').onClick(() => {
      _currentCategory = '';
      _currentPriceRange = '';
      _currentSort = 'relevance';
      try { $w('#categoryFilter').value = ''; } catch (e) {}
      try { $w('#priceFilter').value = ''; } catch (e) {}
      try { $w('#sortDropdown').value = 'relevance'; } catch (e) {}
      if (_currentQuery) performSearch(_currentQuery);
    });
    try { $w('#clearFiltersBtn').accessibility.ariaLabel = 'Clear all filters'; } catch (e) {}
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

  // Show popular searches as suggestions
  loadPopularSuggestions();
}

async function showEmptyState() {
  try {
    $w('#searchQuery').text = 'Search Carolina Futons';
    $w('#searchRepeater').collapse();
    $w('#loadMoreBtn').hide();
  } catch (e) {}

  loadPopularSuggestions();
}

async function loadPopularSuggestions() {
  try {
    const { queries = [] } = await getPopularSearches(6) || {};
    if (queries.length > 0) {
      const labels = queries.map(q => q.query).join(', ');
      $w('#noResultsText').text = `Try searching for: ${labels}`;
    } else {
      $w('#noResultsText').text = 'Try searching for: futon frames, mattresses, murphy beds, platform beds, or accessories';
    }
  } catch (e) {
    try {
      $w('#noResultsText').text = 'Try searching for: futon frames, mattresses, murphy beds, platform beds, or accessories';
    } catch (e2) {}
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}
