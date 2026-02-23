// Search Suggestions Box.js - Search Autocomplete
// Live search suggestions as user types
import wixData from 'wix-data';
import { trackEvent } from 'public/engagementTracker';
import { announce } from 'public/a11yHelpers';

$w.onReady(function () {
  initSearchSuggestions();
});

function initSearchSuggestions() {
  try {
    const searchInput = $w('#searchInput');
    const suggestionsRepeater = $w('#suggestionsRepeater');
    const suggestionsBox = $w('#suggestionsBox');

    if (!searchInput || !suggestionsRepeater) return;

    let debounceTimer;

    // Register onItemReady once, before any data assignment
    try { searchInput.accessibility.ariaLabel = 'Search products'; } catch (e) {}

    suggestionsRepeater.onItemReady(($item, itemData) => {
      $item('#sugImage').src = itemData.image;
      try { $item('#sugImage').alt = `${itemData.name}`; } catch (e) {}
      $item('#sugName').text = itemData.name;
      $item('#sugPrice').text = itemData.price;

      try { $item('#sugImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      try { $item('#sugName').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      $item('#sugImage').onClick(() => navigateTo(itemData.slug));
      $item('#sugName').onClick(() => navigateTo(itemData.slug));
    });

    searchInput.onKeyPress((event) => {
      clearTimeout(debounceTimer);
      const query = searchInput.value?.trim();

      if (!query || query.length < 2) {
        try { suggestionsBox.collapse(); } catch (e) {}
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await searchProducts(query);
        if (results.length > 0) {
          suggestionsRepeater.data = results;
          try { suggestionsBox.expand(); } catch (e) {}
          announce($w, `${results.length} suggestion${results.length !== 1 ? 's' : ''} found`);
        } else {
          try { suggestionsBox.collapse(); } catch (e) {}
          announce($w, 'No suggestions found');
        }
      }, 300);

      // Submit on Enter
      if (event.key === 'Enter') {
        clearTimeout(debounceTimer);
        try { suggestionsBox.collapse(); } catch (e) {}
        import('wix-location-frontend').then(({ to }) => {
          to(`/search-results?q=${encodeURIComponent(query)}`);
        });
      }
    });

    // Close suggestions when clicking outside
    searchInput.onBlur(() => {
      setTimeout(() => {
        try { suggestionsBox.collapse(); } catch (e) {}
      }, 200);
    });
  } catch (e) {}
}

async function searchProducts(query) {
  try {
    const results = await wixData.query('Stores/Products')
      .contains('name', query)
      .limit(5)
      .find();

    return results.items.map(item => ({
      _id: item._id,
      name: item.name,
      slug: item.slug,
      price: item.formattedPrice,
      image: item.mainMedia,
    }));
  } catch (e) {
    return [];
  }
}

function navigateTo(slug) {
  trackEvent('search_suggestion_click', { slug });
  import('wix-location-frontend').then(({ to }) => {
    to(`/product-page/${slug}`);
  });
}
