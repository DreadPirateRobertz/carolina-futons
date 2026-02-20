// Search Results.js - Search Results Page
// Displays search results with product cards, highlighting, and suggestions
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { trackEvent } from 'public/engagementTracker';
import { addToCart } from 'public/cartService';

$w.onReady(async function () {
  const query = wixLocationFrontend.query?.q || '';
  trackEvent('page_view', { page: 'search', query });
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
      trackEvent('search_no_results', { query });
      showNoResults(query);
      return;
    }

    trackEvent('search_results', { query, resultCount: results.totalCount });

    try {
      $w('#resultCount').text = `${results.totalCount} product${results.totalCount !== 1 ? 's' : ''} found`;
    } catch (e) {}

    const repeater = $w('#searchRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      $item('#searchImage').src = itemData.image;
      $item('#searchImage').alt = `${itemData.name} - Carolina Futons`;
      $item('#searchName').text = itemData.name;
      $item('#searchPrice').text = itemData.price;
      try { $item('#searchDesc').text = itemData.description; } catch (e) {}

      const navigate = () => {
        trackEvent('search_click', { query, productId: itemData._id, productName: itemData.name });
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#searchImage').onClick(navigate);
      $item('#searchName').onClick(navigate);
      try { $item('#searchImage').accessibility.ariaLabel = `View ${itemData.name}`; } catch (e) {}
      try { $item('#searchName').accessibility.ariaLabel = `View ${itemData.name} details`; } catch (e) {}

      // Quick add to cart from search results
      try {
        try { $item('#searchAddBtn').accessibility.ariaLabel = `Add ${itemData.name} to cart`; } catch (e) {}
        $item('#searchAddBtn').onClick(async () => {
          try {
            await addToCart(itemData._id);
            $item('#searchAddBtn').label = 'Added!';
            $item('#searchAddBtn').disable();
            trackEvent('add_to_cart', { productId: itemData._id, source: 'search' });
          } catch (err) {
            console.error('Error adding from search:', err);
          }
        });
      } catch (e) {}
    });
    repeater.data = results.items.map(item => ({
      _id: item._id,
      name: item.name,
      slug: item.slug,
      price: item.formattedPrice,
      image: item.mainMedia,
      description: stripHtml(item.description || '').substring(0, 120) + '...',
    }));
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
