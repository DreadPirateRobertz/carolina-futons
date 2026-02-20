// Category Page.u0gn0.js - Product Category / Collection Pages
// Handles filtering, sorting, and product grid with engagement features
// Used for: Futon Frames, Mattresses, Murphy Beds, Platform Beds, etc.
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { getCollectionSchema, getBreadcrumbSchema } from 'backend/seoHelpers.web';

let currentSort = 'name-asc';
let currentFilters = {};
let currentQuickViewProduct = null;

$w.onReady(async function () {
  initSortControls();
  initFilterControls();
  initProductGrid();
  initQuickViewHandlers();
  updateResultCount();
  await injectCategorySchema();
});

// ── Sort Controls ───────────────────────────────────────────────────

function initSortControls() {
  try {
    const sortDropdown = $w('#sortDropdown');
    if (!sortDropdown) return;

    sortDropdown.options = [
      { label: 'Name (A-Z)', value: 'name-asc' },
      { label: 'Name (Z-A)', value: 'name-desc' },
      { label: 'Price: Low to High', value: 'price-asc' },
      { label: 'Price: High to Low', value: 'price-desc' },
      { label: 'Newest First', value: 'date-desc' },
    ];

    sortDropdown.value = 'name-asc';

    sortDropdown.onChange(() => {
      currentSort = sortDropdown.value;
      applySort();
    });
  } catch (e) {}
}

function applySort() {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    let sort;
    switch (currentSort) {
      case 'name-asc':
        sort = wixData.sort().ascending('name');
        break;
      case 'name-desc':
        sort = wixData.sort().descending('name');
        break;
      case 'price-asc':
        sort = wixData.sort().ascending('price');
        break;
      case 'price-desc':
        sort = wixData.sort().descending('price');
        break;
      case 'date-desc':
        sort = wixData.sort().descending('_createdDate');
        break;
      default:
        sort = wixData.sort();
    }
    dataset.setSort(sort);
  } catch (e) {
    console.error('Error applying sort:', e);
  }
}

// ── Filter Controls ─────────────────────────────────────────────────
// Filter by brand, price range, size, finish

function initFilterControls() {
  // Brand filter
  try {
    const brandFilter = $w('#filterBrand');
    if (brandFilter) {
      brandFilter.options = [
        { label: 'All Brands', value: '' },
        { label: 'Night & Day Furniture', value: 'Night & Day' },
        { label: 'Strata Furniture', value: 'Strata' },
        { label: 'KD Frames', value: 'KD Frames' },
        { label: 'Otis Bed', value: 'Otis' },
      ];
      brandFilter.value = '';
      brandFilter.onChange(() => {
        currentFilters.brand = brandFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Price range filter
  try {
    const priceFilter = $w('#filterPrice');
    if (priceFilter) {
      priceFilter.options = [
        { label: 'All Prices', value: '' },
        { label: 'Under $300', value: '0-300' },
        { label: '$300 - $500', value: '300-500' },
        { label: '$500 - $800', value: '500-800' },
        { label: '$800 - $1200', value: '800-1200' },
        { label: 'Over $1200', value: '1200-99999' },
      ];
      priceFilter.value = '';
      priceFilter.onChange(() => {
        currentFilters.price = priceFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Size filter
  try {
    const sizeFilter = $w('#filterSize');
    if (sizeFilter) {
      sizeFilter.options = [
        { label: 'All Sizes', value: '' },
        { label: 'Full', value: 'Full' },
        { label: 'Queen', value: 'Queen' },
        { label: 'Twin', value: 'Twin' },
      ];
      sizeFilter.value = '';
      sizeFilter.onChange(() => {
        currentFilters.size = sizeFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Clear all filters button
  try {
    $w('#clearFilters').onClick(() => {
      currentFilters = {};
      try { $w('#filterBrand').value = ''; } catch (e) {}
      try { $w('#filterPrice').value = ''; } catch (e) {}
      try { $w('#filterSize').value = ''; } catch (e) {}
      applyFilters();
    });
  } catch (e) {}
}

function applyFilters() {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    let filter = wixData.filter();

    if (currentFilters.brand) {
      filter = filter.contains('brand', currentFilters.brand);
    }

    if (currentFilters.price) {
      const [min, max] = currentFilters.price.split('-').map(Number);
      filter = filter.ge('price', min).le('price', max);
    }

    if (currentFilters.size) {
      filter = filter.hasSome('productOptions.Size', [currentFilters.size]);
    }

    dataset.setFilter(filter);
    updateResultCount();
  } catch (e) {
    console.error('Error applying filters:', e);
  }
}

// ── Product Grid ────────────────────────────────────────────────────
// Enhanced product cards with hover effects and quick-view

function initProductGrid() {
  try {
    const repeater = $w('#productGridRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      // Set product image with SEO alt text
      $item('#gridImage').src = itemData.mainMedia;
      $item('#gridImage').alt = buildAltText(itemData);

      // Product info
      $item('#gridName').text = itemData.name;
      $item('#gridPrice').text = itemData.formattedPrice;

      // Sale pricing
      if (itemData.formattedDiscountedPrice) {
        $item('#gridPrice').text = itemData.formattedDiscountedPrice;
        try {
          $item('#gridOrigPrice').text = itemData.formattedPrice;
          $item('#gridOrigPrice').show();
          $item('#gridSaleBadge').show();
        } catch (e) {}
      }

      // Brand label
      try {
        const brand = detectBrand(itemData);
        if (brand) {
          $item('#gridBrand').text = brand;
          $item('#gridBrand').show();
        }
      } catch (e) {}

      // Ribbon badge (Featured, New, etc.)
      if (itemData.ribbon) {
        try {
          $item('#gridRibbon').text = itemData.ribbon;
          $item('#gridRibbon').show();
        } catch (e) {}
      }

      // Click to product page
      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      $item('#gridImage').onClick(navigateToProduct);
      $item('#gridName').onClick(navigateToProduct);

      // Quick view button
      try {
        $item('#quickViewBtn').onClick(() => {
          openQuickView(itemData);
        });
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error initializing product grid:', e);
  }
}

// ── Quick View Modal ────────────────────────────────────────────────

// Register quick view handlers once to avoid accumulation
function initQuickViewHandlers() {
  try {
    $w('#qvViewFull').onClick(() => {
      if (currentQuickViewProduct) {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${currentQuickViewProduct.slug}`);
        });
      }
    });

    $w('#qvAddToCart').onClick(async () => {
      if (!currentQuickViewProduct) return;
      try {
        const { default: wixStoresFrontend } = await import('wix-stores-frontend');
        await wixStoresFrontend.cart.addProducts([{ productId: currentQuickViewProduct._id, quantity: 1 }]);
        $w('#qvAddToCart').label = 'Added!';
        setTimeout(() => {
          $w('#quickViewModal').hide('fade', { duration: 200 });
        }, 1000);
      } catch (err) {
        console.error('Error adding to cart from quick view:', err);
      }
    });

    $w('#qvClose').onClick(() => {
      $w('#quickViewModal').hide('fade', { duration: 200 });
    });
  } catch (e) {}
}

function openQuickView(product) {
  try {
    currentQuickViewProduct = product;
    $w('#qvImage').src = product.mainMedia;
    $w('#qvImage').alt = buildAltText(product);
    $w('#qvName').text = product.name;
    $w('#qvPrice').text = product.formattedPrice;
    $w('#qvDescription').text = stripHtml(product.description || '');
    $w('#qvAddToCart').label = 'Add to Cart';
    $w('#quickViewModal').show('fade', { duration: 200 });
  } catch (e) {}
}

// ── Result Count ────────────────────────────────────────────────────

function updateResultCount() {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    dataset.onReady(() => {
      const count = dataset.getTotalCount();
      try {
        $w('#resultCount').text = `${count} product${count !== 1 ? 's' : ''}`;
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildAltText(product) {
  const brand = detectBrand(product);
  const category = detectCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons Hendersonville NC');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

function detectBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];

  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

function detectCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];

  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return '';
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ── Category Schema Injection ─────────────────────────────────────

async function injectCategorySchema() {
  try {
    const currentPath = wixLocationFrontend.path?.[0] || '';
    const categoryMap = {
      'futon-frames': { slug: 'futon-frames', title: 'Futon Frames' },
      'mattresses': { slug: 'mattresses', title: 'Futon Mattresses' },
      'murphy-cabinet-beds': { slug: 'murphy-cabinet-beds', title: 'Murphy Cabinet Beds' },
      'platform-beds': { slug: 'platform-beds', title: 'Platform Beds' },
      'casegoods-accessories': { slug: 'casegoods-accessories', title: 'Casegoods & Accessories' },
      'wall-huggers': { slug: 'wall-huggers', title: 'Wall Hugger Futon Frames' },
      'unfinished-wood': { slug: 'unfinished-wood', title: 'Unfinished Wood Futon Frames' },
    };

    const categoryInfo = categoryMap[currentPath];
    if (!categoryInfo) return;

    // Collect visible products from the dataset for ItemList
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    await dataset.onReady();
    const products = [];
    const total = Math.min(dataset.getTotalCount(), 30);
    for (let i = 0; i < total; i++) {
      const result = await dataset.getItems(i, 1);
      const item = result?.items?.[0];
      if (item) {
        products.push({
          slug: item.slug,
          name: item.name,
          mainMedia: item.mainMedia,
        });
      }
    }

    const schema = await getCollectionSchema(categoryInfo, products);
    if (schema) {
      try {
        $w('#categorySchemaHtml').postMessage(schema);
      } catch (e) {}
    }

    // Inject breadcrumb schema
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: categoryInfo.title, url: null },
    ];
    const breadcrumbSchema = await getBreadcrumbSchema(breadcrumbs);
    if (breadcrumbSchema) {
      try {
        $w('#categoryBreadcrumbSchemaHtml').postMessage(breadcrumbSchema);
      } catch (e) {}
    }
  } catch (e) {}
}
