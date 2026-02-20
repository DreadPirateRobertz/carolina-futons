// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection,
// and product comparison bar
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getCompareList, removeFromCompare } from 'public/galleryHelpers';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {
  initNavigation();
  initAnnouncementBar();
  initSearch();
  initCompareBar();
  await injectBusinessSchema();
});

// ── Navigation ──────────────────────────────────────────────────────
// Handles sticky nav, mobile menu, and active state highlighting

function initNavigation() {
  // Highlight active nav link based on current page
  const currentPath = '/' + (wixLocationFrontend.path || []).join('/');

  // Map nav element IDs to their paths
  // Element IDs must match what's set in Wix Studio editor
  const navLinks = {
    '#navHome': '/',
    '#navShop': '/shop-main',
    '#navFutonFrames': '/futon-frames',
    '#navMattresses': '/mattresses',
    '#navMurphy': '/murphy-cabinet-beds',
    '#navPlatformBeds': '/platform-beds',
    '#navSale': '/sales',
    '#navProductVideos': '/product-videos',
    '#navGettingItHome': '/getting-it-home',
    '#navContact': '/contact',
    '#navFAQ': '/faq',
    '#navAbout': '/about',
    '#navBlog': '/blog',
  };

  Object.entries(navLinks).forEach(([elementId, path]) => {
    try {
      const el = $w(elementId);
      if (el) {
        if (currentPath === path || (path !== '/' && currentPath.startsWith(path))) {
          el.style.fontWeight = '700';
        }
      }
    } catch (e) {
      // Element may not exist on all pages
    }
  });

  // Mobile hamburger menu toggle
  try {
    const menuButton = $w('#mobileMenuButton');
    const mobileMenu = $w('#mobileMenuOverlay');
    const menuClose = $w('#mobileMenuClose');

    if (menuButton && mobileMenu) {
      menuButton.onClick(() => {
        mobileMenu.show('fade', { duration: 200 });
      });
    }
    if (menuClose && mobileMenu) {
      menuClose.onClick(() => {
        mobileMenu.hide('fade', { duration: 200 });
      });
    }
  } catch (e) {
    // Mobile elements may not exist
  }
}

// ── Announcement Bar ────────────────────────────────────────────────
// Rotating promotional messages at top of site

function initAnnouncementBar() {
  const messages = [
    'Free Shipping on Orders Over $999!',
    'Visit Our Showroom: 824 Locust St, Hendersonville NC',
    'Over 700 Fabric Swatches Available In-Store',
    'Request FREE fabric swatches — shipped to your door!',
    'Family Owned Since 1991 — Now Carolina Futons',
  ];

  let currentIndex = 0;

  try {
    const announcementText = $w('#announcementText');
    if (!announcementText) return;

    announcementText.text = messages[0];

    setInterval(() => {
      currentIndex = (currentIndex + 1) % messages.length;
      announcementText.hide('fade', { duration: 300 }).then(() => {
        announcementText.text = messages[currentIndex];
        announcementText.show('fade', { duration: 300 });
      });
    }, 5000);
  } catch (e) {
    // Announcement bar may not be on all pages
  }
}

// ── Search ──────────────────────────────────────────────────────────
// Enhanced search with autocomplete behavior

function initSearch() {
  try {
    const searchInput = $w('#headerSearchInput');
    if (!searchInput) return;

    searchInput.onKeyPress((event) => {
      if (event.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          import('wix-location').then(({ to }) => {
            to(`/search-results?q=${encodeURIComponent(query)}`);
          });
        }
      }
    });
  } catch (e) {
    // Search may not be on all pages
  }
}

// ── Product Comparison Bar ──────────────────────────────────────────
// Floating bottom bar showing products selected for comparison

function initCompareBar() {
  try {
    const compareBar = $w('#compareBar');
    if (!compareBar) return;

    // Render current state on page load
    refreshCompareBar();

    // "Compare Now" opens comparison lightbox
    try {
      $w('#compareNowBtn').onClick(() => openComparisonModal());
    } catch (e) {}
  } catch (e) {
    // Compare bar elements may not exist on all pages
  }
}

// Re-render the compare bar from session storage state.
// Called from this page and also exported-style via global for category page use.
function refreshCompareBar() {
  try {
    const compareBar = $w('#compareBar');
    if (!compareBar) return;

    const items = getCompareList();

    if (items.length === 0) {
      compareBar.hide('slide', { duration: 200, direction: 'bottom' });
      return;
    }

    const repeater = $w('#compareRepeater');
    if (repeater) {
      repeater.data = items.map(p => ({ ...p, _id: p._id }));
      repeater.onItemReady(($item, itemData) => {
        try { $item('#compareThumb').src = itemData.mainMedia; } catch (e) {}
        try { $item('#compareName').text = itemData.name; } catch (e) {}
        try { $item('#comparePrice').text = itemData.price; } catch (e) {}
        try {
          $item('#compareRemove').onClick(() => {
            removeFromCompare(itemData._id);
            refreshCompareBar();
          });
        } catch (e) {}
      });
    }

    compareBar.show('slide', { duration: 200, direction: 'bottom' });
  } catch (e) {}
}

// Comparison lightbox — side-by-side product details
function openComparisonModal() {
  try {
    const items = getCompareList();
    if (items.length < 2) return;

    const modal = $w('#comparisonModal');
    if (!modal) return;

    const grid = $w('#comparisonGrid');
    if (grid) {
      grid.data = items.map(p => ({ ...p, _id: p._id }));
      grid.onItemReady(($item, itemData) => {
        try { $item('#compImage').src = itemData.mainMedia; } catch (e) {}
        try { $item('#compName').text = itemData.name; } catch (e) {}
        try { $item('#compPrice').text = itemData.price; } catch (e) {}
        try {
          $item('#compAddToCart').onClick(async () => {
            try {
              const { default: wixStoresFrontend } = await import('wix-stores-frontend');
              await wixStoresFrontend.cart.addProducts([{ productId: itemData._id, quantity: 1 }]);
              $item('#compAddToCart').label = 'Added!';
            } catch (err) {
              console.error('Error adding comparison item to cart:', err);
            }
          });
        } catch (e) {}
        try {
          $item('#compViewBtn').onClick(() => {
            import('wix-location').then(({ to }) => {
              to(`/product-page/${itemData.slug}`);
            });
          });
        } catch (e) {}
      });
    }

    // Close button
    try {
      $w('#comparisonClose').onClick(() => {
        modal.hide('fade', { duration: 200 });
      });
    } catch (e) {}

    modal.show('fade', { duration: 200 });
  } catch (e) {}
}

// ── SEO Schema Injection ────────────────────────────────────────────
// Injects LocalBusiness JSON-LD on every page

async function injectBusinessSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#businessSchemaHtml').postMessage(schema);
    }
  } catch (e) {
    // Schema injection is non-critical
  }
}
