// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection, exit-intent popup
import { getBusinessSchema } from 'backend/seoHelpers.web';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {
  initNavigation();
  initAnnouncementBar();
  initSearch();
  initExitIntentPopup();
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

// ── Exit-Intent Popup ──────────────────────────────────────────────
// Detects mouse leaving viewport (desktop) or back-button intent (mobile)
// Shows 10% discount offer for first-time visitors with email capture

function initExitIntentPopup() {
  try {
    const modal = $w('#exitIntentModal');
    const overlay = $w('#exitIntentOverlay');
    if (!modal || !overlay) return;

    // Check if user has already seen the popup (not a first-time visitor)
    const hasSeenPopup = local.get('cf_has_seen_popup');
    if (hasSeenPopup) return;

    // Check if already dismissed this session
    const dismissedThisSession = session.get('cf_exit_dismissed');
    if (dismissedThisSession) return;

    let popupShown = false;

    // Desktop: detect mouse leaving viewport (mouseleave on document)
    if (typeof document !== 'undefined') {
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !popupShown) {
          showExitPopup();
        }
      });
    }

    // Mobile: detect back-button intent via popstate
    if (typeof window !== 'undefined') {
      // Push a state so we can intercept back button
      window.history.pushState({ exitIntent: true }, '');
      window.addEventListener('popstate', (e) => {
        if (!popupShown) {
          showExitPopup();
          // Re-push state to keep them on page
          window.history.pushState({ exitIntent: true }, '');
        }
      });
    }

    function showExitPopup() {
      popupShown = true;
      overlay.show('fade', { duration: 200 });
      modal.show('fade', { duration: 300 });
    }

    function hideExitPopup() {
      modal.hide('fade', { duration: 200 });
      overlay.hide('fade', { duration: 200 });
      session.set('cf_exit_dismissed', 'true');
      local.set('cf_has_seen_popup', 'true');
    }

    // Overlay click dismisses
    overlay.onClick(() => hideExitPopup());

    // Dismiss link
    try {
      const dismissBtn = $w('#exitDismiss');
      if (dismissBtn) {
        dismissBtn.onClick(() => hideExitPopup());
      }
    } catch (e) {}

    // Email submit
    try {
      const submitBtn = $w('#exitSubmit');
      const emailInput = $w('#exitEmail');
      if (submitBtn && emailInput) {
        submitBtn.onClick(async () => {
          const email = emailInput.value?.trim();
          if (!email || !email.includes('@')) return;

          try {
            // Store email capture via backend
            const { submitContactForm } = await import('backend/contactSubmissions.web');
            await submitContactForm({
              email,
              source: 'exit_intent_popup',
              status: 'exit_intent_signup',
              notes: '10% discount offer',
            });

            // Show success state
            submitBtn.label = 'Check Your Email!';
            submitBtn.disable();
            setTimeout(() => hideExitPopup(), 2000);
          } catch (err) {
            console.error('Exit intent email submit error:', err);
          }
        });
      }
    } catch (e) {}

    // Load bestseller carousel
    try {
      const carousel = $w('#exitProductCarousel');
      if (carousel) {
        loadExitCarouselProducts(carousel);
      }
    } catch (e) {}
  } catch (e) {
    // Exit intent popup is non-critical
  }
}

async function loadExitCarouselProducts(carousel) {
  try {
    const { getBestsellers } = await import('backend/productRecommendations.web');
    const bestsellers = await getBestsellers(3);
    if (!bestsellers || bestsellers.length === 0) return;

    carousel.data = bestsellers;
    carousel.onItemReady(($item, itemData) => {
      try {
        $item('#exitProductImage').src = itemData.mainMedia;
        $item('#exitProductName').text = itemData.name;
        $item('#exitProductPrice').text = itemData.formattedPrice;
        $item('#exitProductImage').onClick(() => {
          import('wix-location').then(({ to }) => {
            to(`/product-page/${itemData.slug}`);
          });
        });
      } catch (e) {}
    });
  } catch (e) {}
}

// Session and local storage wrappers (Wix Velo API)
const session = {
  get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
  set(key, val) { try { sessionStorage.setItem(key, val); } catch (e) {} },
};
const local = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(key, val); } catch (e) {} },
};

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
