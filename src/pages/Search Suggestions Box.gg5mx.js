// Search Suggestions Box.gg5mx.js - Search Autocomplete
// Live search suggestions as user types
import wixData from 'wix-data';

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
          suggestionsRepeater.onItemReady(($item, itemData) => {
            $item('#sugImage').src = itemData.image;
            $item('#sugName').text = itemData.name;
            $item('#sugPrice').text = itemData.price;

            $item('#sugImage').onClick(() => navigateTo(itemData.slug));
            $item('#sugName').onClick(() => navigateTo(itemData.slug));
          });
          try { suggestionsBox.expand(); } catch (e) {}
        } else {
          try { suggestionsBox.collapse(); } catch (e) {}
        }
      }, 300);

      // Submit on Enter
      if (event.key === 'Enter') {
        clearTimeout(debounceTimer);
        try { suggestionsBox.collapse(); } catch (e) {}
        import('wix-location').then(({ to }) => {
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
  import('wix-location').then(({ to }) => {
    to(`/product-page/${slug}`);
  });
}
