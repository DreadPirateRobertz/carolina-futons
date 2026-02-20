// Search Results.evr2j.js - Search Results Page
// Displays search results with product cards, highlighting, and suggestions
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {
  const query = wixLocationFrontend.query?.q || '';
  if (query) {
    await performSearch(query);
  } else {
    showEmptyState();
  }
});

async function performSearch(query) {
  try {
    $w('#searchQuery').text = `Results for "${query}"`;

    // Search products
    const results = await wixData.query('Stores/Products')
      .contains('name', query)
      .or(wixData.query('Stores/Products').contains('description', query))
      .limit(24)
      .find();

    if (results.items.length === 0) {
      showNoResults(query);
      return;
    }

    try {
      $w('#resultCount').text = `${results.totalCount} product${results.totalCount !== 1 ? 's' : ''} found`;
    } catch (e) {}

    const repeater = $w('#searchRepeater');
    if (!repeater) return;

    repeater.data = results.items.map(item => ({
      _id: item._id,
      name: item.name,
      slug: item.slug,
      price: item.formattedPrice,
      image: item.mainMedia,
      description: stripHtml(item.description || '').substring(0, 120) + '...',
    }));

    repeater.onItemReady(($item, itemData) => {
      $item('#searchImage').src = itemData.image;
      $item('#searchImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#searchName').text = itemData.name;
      $item('#searchPrice').text = itemData.price;
      try { $item('#searchDesc').text = itemData.description; } catch (e) {}

      const navigate = () => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#searchImage').onClick(navigate);
      $item('#searchName').onClick(navigate);
    });
  } catch (err) {
    console.error('Search error:', err);
    showNoResults(query);
  }
}

function showNoResults(query) {
  try {
    $w('#searchQuery').text = `No results for "${query}"`;
    $w('#noResultsBox').show();
    $w('#searchRepeater').collapse();

    // Show search suggestions
    $w('#noResultsText').text = 'Try searching for: futon frames, mattresses, murphy beds, platform beds, or accessories';
  } catch (e) {}
}

function showEmptyState() {
  try {
    $w('#searchQuery').text = 'Search Carolina Futons';
    $w('#searchRepeater').collapse();
  } catch (e) {}
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}
