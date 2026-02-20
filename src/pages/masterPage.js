// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection
import { getBusinessSchema } from 'backend/seoHelpers.web';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {
  initNavigation();
  initAnnouncementBar();
  initSearch();
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
