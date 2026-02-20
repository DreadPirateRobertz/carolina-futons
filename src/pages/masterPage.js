// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection,
// and product comparison bar
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getCompareList, removeFromCompare } from 'public/galleryHelpers';
import wixLocationFrontend from 'wix-location-frontend';
import wixStoresFrontend from 'wix-stores-frontend';

let _previousCartItemCount = null;

$w.onReady(async function () {
  initNavigation();
  initAnnouncementBar();
  initSearch();
  initCompareBar();
  await injectBusinessSchema();

  // Promotional lightbox — delayed 3s so page renders first
  setTimeout(() => initPromoLightbox(), 3000);
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

// ── Promotional Lightbox ────────────────────────────────────────────
// Shows active campaign lightbox with products, countdown, and discount code

async function initPromoLightbox() {
  try {
    const lightbox = $w('#promoLightbox');
    if (!lightbox) return;

    const promo = await getActivePromotion();
    if (!promo) return;

    // Check if user already dismissed this promotion in this session
    const dismissKey = `promo_dismissed_${promo._id}`;
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem(dismissKey)) return;
      } catch (e) {
        // sessionStorage may not be available
      }
    }

    populatePromoLightbox(promo);
    initPromoCountdown(promo.endDate);
    initPromoProducts(promo.products);
    initPromoDismiss(promo._id, dismissKey);
    initPromoCopyCode(promo.discountCode);
    initPromoEmailCapture();
    initPromoCTA(promo.ctaUrl);

    // Show the lightbox
    $w('#promoOverlay').show('fade', { duration: 300 });
    lightbox.show('fade', { duration: 300 });
  } catch (e) {
    // Promo lightbox is non-critical — never block the page
  }
}

function populatePromoLightbox(promo) {
  try { $w('#promoTitle').text = promo.title || ''; } catch (e) {}
  try { $w('#promoSubtitle').text = promo.subtitle || ''; } catch (e) {}
  try {
    if (promo.heroImage) {
      $w('#promoHeroImage').src = promo.heroImage;
    }
  } catch (e) {}
  try {
    if (promo.discountCode) {
      $w('#promoCode').text = promo.discountCode;
    } else {
      $w('#promoCode').hide();
      $w('#promoCopyCode').hide();
    }
  } catch (e) {}
  try {
    if (promo.ctaText) {
      $w('#promoCTA').label = promo.ctaText;
    }
  } catch (e) {}
}

function initPromoCountdown(endDate) {
  try {
    const countdownEl = $w('#promoCountdown');
    if (!countdownEl || !endDate) {
      try { countdownEl.hide(); } catch (e) {}
      return;
    }

    const end = new Date(endDate).getTime();

    function updateCountdown() {
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        countdownEl.text = 'Sale Ended';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n) => String(n).padStart(2, '0');
      countdownEl.text = `${pad(days)}:${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
  } catch (e) {
    // Countdown is optional
  }
}

function initPromoProducts(products) {
  try {
    const repeater = $w('#promoRepeater');
    if (!repeater || !products || products.length === 0) {
      try { repeater.hide(); } catch (e) {}
      return;
    }

    repeater.data = products.map(p => ({ ...p, _id: p._id }));

    repeater.onItemReady(($item, itemData) => {
      try { $item('#promoImage').src = itemData.mainMedia; } catch (e) {}
      try { $item('#promoName').text = itemData.name; } catch (e) {}
      try {
        $item('#promoPrice').text = itemData.formattedDiscountedPrice || itemData.formattedPrice;
      } catch (e) {}
      try {
        if (itemData.formattedDiscountedPrice && itemData.formattedDiscountedPrice !== itemData.formattedPrice) {
          $item('#promoOrigPrice').text = itemData.formattedPrice;
          $item('#promoOrigPrice').show();
        } else {
          $item('#promoOrigPrice').hide();
        }
      } catch (e) {}
      try {
        $item('#promoQuickAdd').onClick(() => {
          import('wix-location').then(({ to }) => {
            to(`/product-page/${itemData.slug}`);
          });
        });
      } catch (e) {}
    });
  } catch (e) {
    // Product carousel is optional
  }
}

function dismissLightbox(dismissKey) {
  try {
    $w('#promoLightbox').hide('fade', { duration: 200 });
    $w('#promoOverlay').hide('fade', { duration: 200 });
  } catch (e) {}

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch (e) {}
  }
}

function initPromoDismiss(promoId, dismissKey) {
  try {
    $w('#promoClose').onClick(() => dismissLightbox(dismissKey));
  } catch (e) {}
  try {
    $w('#promoDismiss').onClick(() => dismissLightbox(dismissKey));
  } catch (e) {}
  try {
    $w('#promoOverlay').onClick(() => dismissLightbox(dismissKey));
  } catch (e) {}
}

function initPromoCopyCode(code) {
  try {
    if (!code) return;
    $w('#promoCopyCode').onClick(() => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          $w('#promoCopyCode').label = 'Copied!';
          setTimeout(() => {
            try { $w('#promoCopyCode').label = 'Copy Code'; } catch (e) {}
          }, 2000);
        });
      }
    });
  } catch (e) {}
}

function initPromoEmailCapture() {
  try {
    const emailInput = $w('#promoEmailInput');
    const emailSubmit = $w('#promoEmailSubmit');
    if (!emailInput || !emailSubmit) return;

    emailSubmit.onClick(async () => {
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) return;

      try {
        const wixCrm = await import('wix-crm');
        await wixCrm.createContact({ emails: [email] });
        emailInput.value = '';
        emailSubmit.label = 'Subscribed!';
        emailSubmit.disable();
      } catch (e) {
        // Email capture is best-effort
      }
    });
  } catch (e) {}
}

function initPromoCTA(ctaUrl) {
  try {
    if (!ctaUrl) return;
    $w('#promoCTA').onClick(() => {
      import('wix-location').then(({ to }) => {
        to(ctaUrl);
      });
    });
  } catch (e) {}
}
