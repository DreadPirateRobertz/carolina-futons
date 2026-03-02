// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection,
// mega menu, breadcrumbs, back-to-top, and side cart auto-open on add-to-cart
import { getBusinessSchema, getWebSiteSchema } from 'backend/seoHelpers.web';
import { getActivePromotion } from 'backend/promotions.web';
import { submitContactForm } from 'backend/contactSubmissions.web';
import {
  shouldShowExitIntent,
  markExitIntentShown,
  markExitIntentDismissed,
  validateCaptureEmail,
  getExitIntentConfig,
} from 'public/exitIntentCapture';
import wixLocationFrontend from 'wix-location-frontend';
import { getCurrentCart, onCartChanged, getShippingProgress } from 'public/cartService';
import { isMobile } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';
import { typography } from 'public/designTokens.js';
import { captureInstallPrompt, canShowInstallPrompt, showInstallPrompt, isInstalledPWA } from 'public/pwaHelpers';
import { reportMetrics } from 'backend/coreWebVitals.web';
import { initFooter } from 'public/FooterSection';
import {
  applyActiveNavState,
  initMegaMenu,
  initMobileDrawer,
  initFooterAccordions,
  initAnnouncementBar as initAnnouncementBarHelper,
  initBackToTop as initBackToTopHelper,
  initStickyNav,
  breadcrumbsFromPath,
  renderBreadcrumbs,
} from 'public/navigationHelpers';

let _previousCartItemCount = null;
let _lastFocusedBeforeOverlay = null;

$w.onReady(async function () {
  captureInstallPrompt();
  initAccessibility();
  initNavigation();
  initEnhancedNavigation();
  initAnnouncementBar();
  initSearch();
  initSideCartAutoOpen();
  initFooter($w);
  initMountainSkylineHeader();
  initHeaderShippingProgress();
  initNewsletterModal();
  initInstallBanner();
  injectCanonicalUrl();
  await injectBusinessSchema();

  // Live chat widget — async loaded, 2s delay to avoid impacting page speed
  setTimeout(() => {
    import('public/LiveChat.js').then(({ initLiveChat }) => {
      const path = wixLocationFrontend.path?.join('/') || '';
      const page = path.includes('product-page') ? 'product'
        : path.includes('checkout') ? 'checkout'
        : undefined;
      initLiveChat($w, { page });
    }).catch(err => console.error('[masterPage] LiveChat init failed:', err.message));
  }, 2000);

  // Core Web Vitals — collect after page settles (5s)
  setTimeout(() => collectCoreWebVitals(), 5000);

  // Promotional lightbox — delayed 3s so page renders first
  setTimeout(() => initPromoLightbox(), 3000);

  // Exit-intent lead capture — delayed 10s to avoid premature trigger
  setTimeout(() => initExitIntent(), 10000);
});

// ── Accessibility ───────────────────────────────────────────────────
// Skip-to-content link, keyboard Escape for modals, focus management

function initAccessibility() {
  // Skip-to-content link — visible on Tab focus for keyboard users
  try {
    const skipLink = $w('#skipToContent');
    if (skipLink) {
      try { skipLink.accessibility.ariaLabel = 'Skip to main content'; } catch (e) {}
      skipLink.onClick(() => {
        try { $w('#mainContent').scrollTo(); } catch (e) {}
      });
    }
  } catch (e) {}

  // aria-live region for screen reader announcements (used by a11yHelpers.announce)
  try {
    const liveRegion = $w('#a11yLiveRegion');
    if (liveRegion) {
      try { liveRegion.accessibility.ariaLive = 'polite'; } catch (e) {}
      try { liveRegion.accessibility.ariaAtomic = true; } catch (e) {}
      try { liveRegion.accessibility.role = 'status'; } catch (e) {}
    }
  } catch (e) {}

  // Global Escape key handler — closes any open overlay and restores focus
  try {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Close side cart
          try { $w('#sideCartPanel').hide('slide', { direction: 'right', duration: 200 }); } catch (e) {}
          // Close promo lightbox
          try { $w('#promoLightbox').hide('fade', { duration: 200 }); } catch (e) {}
          try { $w('#promoOverlay').hide('fade', { duration: 200 }); } catch (e) {}
          // Mobile menu Escape is handled by initMobileDrawer's own keydown handler
          // Close exit intent popup
          try { $w('#exitIntentPopup').hide('fade', { duration: 200 }); } catch (e) {}
          try { $w('#exitOverlay').hide('fade', { duration: 200 }); } catch (e) {}
          // Close newsletter modal
          try { $w('#newsletterModal').hide('fade', { duration: 200 }); } catch (e) {}
          try { $w('#newsletterModalOverlay').hide('fade', { duration: 200 }); } catch (e) {}
          // Restore focus to previously active element
          try {
            if (document.activeElement && document.activeElement !== document.body) {
              // Focus stays on current element
            } else if (_lastFocusedBeforeOverlay) {
              _lastFocusedBeforeOverlay.focus();
            }
          } catch (e) {}
        }
      });
    }
  } catch (e) {}

  // Set ARIA roles on key interactive elements
  try {
    $w('#announcementText').role = 'status';
    try { $w('#announcementText').accessibility.ariaLive = 'polite'; } catch (e) {}
  } catch (e) {}
  try {
    $w('#headerSearchInput').role = 'search';
  } catch (e) {}
}

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
          el.style.fontWeight = String(typography.h2.weight);
        }
      }
    } catch (e) {
      // Element may not exist on all pages
    }
  });

  // Mobile nav is handled by initMobileDrawer() in initEnhancedNavigation()
}

// ── Enhanced Navigation (Mega Menu, Breadcrumbs, Back-to-Top, Sticky) ──

function initEnhancedNavigation() {
  const currentPath = '/' + (wixLocationFrontend.path || []).join('/');

  // Active page indicator with Mountain Blue styling
  try { applyActiveNavState($w, currentPath); } catch (e) {}

  // Mega menu for desktop shop dropdown (skip on mobile — drawer handles it)
  try { if (!isMobile()) initMegaMenu($w); } catch (e) {}

  // Mobile drawer with focus trap, scroll lock, and accessible close
  try { initMobileDrawer($w, currentPath); } catch (e) {}

  // Breadcrumbs with schema.org JSON-LD
  try {
    const crumbs = breadcrumbsFromPath(currentPath);
    renderBreadcrumbs($w, crumbs);
  } catch (e) {}

  // Back-to-top button
  try { initBackToTopHelper($w); } catch (e) {}

  // Sticky nav shadow on scroll
  try { initStickyNav($w); } catch (e) {}

  // Footer columns → accordions on mobile
  try {
    initFooterAccordions($w, [
      { headerId: '#footerShopHeader', contentId: '#footerShopLinks', label: 'Shop' },
      { headerId: '#footerServiceHeader', contentId: '#footerServiceLinks', label: 'Customer Service' },
      { headerId: '#footerAboutHeader', contentId: '#footerAboutLinks', label: 'About Us' },
    ]);
  } catch (e) {}
}

// ── Announcement Bar ────────────────────────────────────────────────
// Rotating promotional messages at top of site

function initAnnouncementBar() {
  const messages = [
    'Free Shipping on Orders Over $999!',
    'Visit Our Showroom: Wed–Sat 10–5, Hendersonville NC',
    'Over 700 Fabric Swatches Available In-Store',
    'Request FREE fabric swatches — shipped to your door!',
    'Family Owned Since 1991 — Now Carolina Futons',
  ];

  try {
    initAnnouncementBarHelper($w, messages, { interval: 5000 });
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

    try { searchInput.accessibility.ariaLabel = 'Search Carolina Futons'; } catch (e) {}

    searchInput.onKeyPress((event) => {
      if (event.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          wixLocationFrontend.to(`/search-results?q=${encodeURIComponent(query)}`);
        }
      }
    });
  } catch (e) {
    // Search may not be on all pages
  }
}

// ── Side Cart Auto-Open ─────────────────────────────────────────────
// Automatically opens the side cart when a new item is added to cart

function initSideCartAutoOpen() {
  // Capture initial cart count so we can detect additions
  getCurrentCart().then((cart) => {
    _previousCartItemCount = cart
      ? cart.lineItems.reduce((sum, item) => sum + item.quantity, 0)
      : 0;
  }).catch(() => {
    _previousCartItemCount = 0;
  });

  onCartChanged(async () => {
    try {
      const cart = await getCurrentCart();
      const newCount = cart
        ? cart.lineItems.reduce((sum, item) => sum + item.quantity, 0)
        : 0;

      // Only auto-open when item count increased (add, not remove)
      if (_previousCartItemCount !== null && newCount > _previousCartItemCount) {
        openSideCart(cart);
      }
      _previousCartItemCount = newCount;
    } catch (e) {
      // Non-critical — side cart just won't auto-open
    }
  });
}

function openSideCart(cart) {
  try {
    const panel = $w('#sideCartPanel');
    if (panel) {
      panel.show('slide', { direction: 'right', duration: 300 });
    }
  } catch (e) {}

  // Highlight the just-added item
  try {
    const highlight = $w('#justAddedHighlight');
    if (highlight && cart && cart.lineItems.length > 0) {
      const lastItem = cart.lineItems[cart.lineItems.length - 1];
      highlight.show('fade', { duration: 200 });
      // Auto-hide highlight after 3 seconds
      setTimeout(() => {
        try { highlight.hide('fade', { duration: 300 }); } catch (e) {}
      }, 3000);
    }
  } catch (e) {}
}

// ── SEO Schema Injection ────────────────────────────────────────────
// Injects LocalBusiness JSON-LD on every page

// ── Canonical URL ───────────────────────────────────────────────────
// Sets rel="canonical" on every page to prevent duplicate content issues.
// Strips query params (filters, sort) so search engines index the clean URL.

function injectCanonicalUrl() {
  try {
    const baseUrl = 'https://www.carolinafutons.com';
    const path = wixLocationFrontend.path.join('/');
    const canonicalUrl = path ? `${baseUrl}/${path}` : baseUrl;

    import('wix-seo-frontend').then(({ head }) => {
      head.setLinks([{ rel: 'canonical', href: canonicalUrl }]);
    }).catch(() => {});
  } catch (e) {}
}

async function injectBusinessSchema() {
  try {
    const schema = await getBusinessSchema();
    if (schema) {
      $w('#businessSchemaHtml').postMessage(schema);
    }
  } catch (e) {
    // Schema injection is non-critical
  }

  // WebSite schema with SearchAction for sitelinks searchbox eligibility
  try {
    const websiteSchema = await getWebSiteSchema();
    if (websiteSchema) {
      $w('#websiteSchemaHtml').postMessage(websiteSchema);
    }
  } catch (e) {
    // WebSite schema is non-critical
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

    // Set dialog ARIA attributes
    try { lightbox.accessibility.role = 'dialog'; } catch (e) {}
    try { lightbox.accessibility.ariaModal = true; } catch (e) {}
    try { lightbox.accessibility.ariaLabel = 'Promotional offer'; } catch (e) {}

    // Store focus for restoration
    try { if (typeof document !== 'undefined') _lastFocusedBeforeOverlay = document.activeElement; } catch (e) {}

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
      try { $w('#promoHeroImage').alt = `${promo.title || 'Promotional offer'} - Carolina Futons`; } catch (e) {}
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
      try { $item('#promoImage').alt = `${itemData.name} - promotional product`; } catch (e) {}
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
          import('wix-location-frontend').then(({ to }) => {
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
    try { $w('#promoClose').accessibility.ariaLabel = 'Close promotion'; } catch (e) {}
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
    try { $w('#promoCopyCode').accessibility.ariaLabel = 'Copy discount code'; } catch (e) {}
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

    try { emailInput.accessibility.ariaLabel = 'Enter your email for promotion'; } catch (e) {}
    try { emailSubmit.accessibility.ariaLabel = 'Subscribe for promotion'; } catch (e) {}

    emailSubmit.onClick(async () => {
      const email = emailInput.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

      try {
        const wixCrm = await import('wix-crm-frontend');
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
      import('wix-location-frontend').then(({ to }) => {
        to(ctaUrl);
      });
    });
  } catch (e) {}
}

// ── PWA Install Banner ───────────────────────────────────────────
// Shows install prompt after 2+ page views, only on mobile, only if not already installed

function initInstallBanner() {
  try {
    if (isInstalledPWA()) return;

    // Track page views in sessionStorage
    let views = 1;
    if (typeof sessionStorage !== 'undefined') {
      try {
        views = parseInt(sessionStorage.getItem('cf_page_views') || '0', 10) + 1;
        sessionStorage.setItem('cf_page_views', String(views));
      } catch (e) {}
    }

    if (views < 2) return;

    // Wait a moment for the install prompt event to fire
    setTimeout(() => {
      try {
        if (!canShowInstallPrompt()) return;

        const banner = $w('#installBanner');
        if (!banner) return;

        try { $w('#installBannerText').text = 'Add Carolina Futons to your home screen for quick access'; } catch (e) {}
        try { $w('#installBannerBtn').accessibility.ariaLabel = 'Install Carolina Futons app'; } catch (e) {}

        $w('#installBannerBtn').onClick(async () => {
          const outcome = await showInstallPrompt();
          trackEvent('pwa_install_prompt', { outcome });
          banner.hide('fade', { duration: 200 });
        });

        try {
          $w('#installBannerDismiss').onClick(() => {
            banner.hide('fade', { duration: 200 });
            if (typeof sessionStorage !== 'undefined') {
              try { sessionStorage.setItem('cf_install_dismissed', '1'); } catch (e) {}
            }
          });
        } catch (e) {}

        // Don't show if already dismissed this session
        if (typeof sessionStorage !== 'undefined') {
          try {
            if (sessionStorage.getItem('cf_install_dismissed')) return;
          } catch (e) {}
        }

        banner.show('slide', { direction: 'bottom', duration: 300 });
        trackEvent('pwa_install_banner_shown', {});
      } catch (e) {}
    }, 2000);
  } catch (e) {}
}

// ── Exit-Intent Lead Capture ──────────────────────────────────────
// Uses testable exitIntentCapture module for logic, newsletterService for backend.
// Detects when user is about to leave and shows a lead capture popup.
// Only shows once per session, doesn't interrupt checkout/cart pages,
// and respects promo lightbox (only shows if promo didn't fire).

function initExitIntent() {
  try {
    const popup = $w('#exitIntentPopup');
    if (!popup) return;

    const path = wixLocationFrontend.path?.join('/') || '';
    if (!shouldShowExitIntent(path)) return;

    // Don't show if promo lightbox is already visible
    try {
      if (!$w('#promoLightbox').hidden) return;
    } catch (e) {}

    if (isMobile()) {
      // Mobile: detect back-button / tab-switch via visibility API
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            try { sessionStorage.setItem('cf_exit_pending', '1'); } catch (e) {}
          } else if (document.visibilityState === 'visible') {
            try {
              if (sessionStorage.getItem('cf_exit_pending') && !sessionStorage.getItem('cf_exit_shown')) {
                sessionStorage.removeItem('cf_exit_pending');
                showExitPopup();
              }
            } catch (e) {}
          }
        });
      }
    } else {
      // Desktop: mouse leave detection (cursor above viewport)
      if (typeof document !== 'undefined') {
        document.addEventListener('mouseleave', (e) => {
          if (e.clientY <= 0) {
            showExitPopup();
          }
        }, { once: true });
      }
    }
  } catch (e) {}
}

function showExitPopup() {
  try {
    markExitIntentShown();

    const popup = $w('#exitIntentPopup');
    if (!popup) return;

    const config = getExitIntentConfig();

    // Store focus for restoration
    try { if (typeof document !== 'undefined') _lastFocusedBeforeOverlay = document.activeElement; } catch (e) {}

    // Populate content from config
    try { $w('#exitTitle').text = config.title; } catch (e) {}
    try { $w('#exitSubtitle').text = config.subtitle; } catch (e) {}

    // Set dialog ARIA attributes
    try { popup.accessibility.role = 'dialog'; } catch (e) {}
    try { popup.accessibility.ariaModal = true; } catch (e) {}
    try { popup.accessibility.ariaLabel = config.ariaLabel; } catch (e) {}

    popup.show('fade', { duration: 300 });
    try { $w('#exitOverlay').show('fade', { duration: 300 }); } catch (e) {}

    trackEvent('exit_intent_shown', { page: wixLocationFrontend.path?.join('/') || '' });

    // Escape key closes popup
    try {
      if (typeof document !== 'undefined') {
        const escHandler = (e) => {
          if (e.key === 'Escape') {
            dismissExitPopup();
            document.removeEventListener('keydown', escHandler);
          }
        };
        document.addEventListener('keydown', escHandler);
      }
    } catch (e) {}

    // Close handlers
    try {
      $w('#exitClose').onClick(() => dismissExitPopup());
      try { $w('#exitClose').accessibility.ariaLabel = config.closeAriaLabel; } catch (e) {}
    } catch (e) {}
    try {
      $w('#exitOverlay').onClick(() => dismissExitPopup());
    } catch (e) {}

    // Email capture form
    try {
      try { $w('#exitEmailInput').accessibility.ariaLabel = config.emailPlaceholder; } catch (e) {}
      try { $w('#exitEmailSubmit').accessibility.ariaLabel = config.ctaText; } catch (e) {}
      try { $w('#exitEmailSubmit').label = config.ctaText; } catch (e) {}
      $w('#exitEmailSubmit').onClick(async () => {
        const email = $w('#exitEmailInput').value?.trim();
        if (!validateCaptureEmail(email)) {
          try {
            $w('#exitEmailError').text = 'Please enter a valid email address.';
            $w('#exitEmailError').show('fade', { duration: 200 });
          } catch (e) {}
          return;
        }

        try {
          $w('#exitEmailSubmit').disable();
          $w('#exitEmailSubmit').label = 'Sending...';
          try { $w('#exitEmailError').hide(); } catch (e) {}

          const { subscribeToNewsletter } = await import('backend/newsletterService.web');
          const result = await subscribeToNewsletter(email, { source: 'exit_intent_popup' });

          if (!result.success) {
            $w('#exitEmailSubmit').enable();
            $w('#exitEmailSubmit').label = config.ctaText;
            try {
              $w('#exitEmailError').text = result.message || 'Something went wrong. Please try again.';
              $w('#exitEmailError').show('fade', { duration: 200 });
            } catch (e) {}
            return;
          }

          // Also add to Wix contacts for email marketing
          try {
            const wixCrm = await import('wix-crm-frontend');
            await wixCrm.createContact({ emails: [email] });
          } catch (e) {}

          trackEvent('exit_intent_capture', { email: 'captured' });
          fireCustomEvent('lead_capture', { source: 'exit_intent' });

          $w('#exitEmailInput').value = '';
          $w('#exitEmailSubmit').label = 'Sent!';
          try {
            $w('#exitSuccess').text = config.successMessage;
            $w('#exitSuccess').show('fade', { duration: 300 });
          } catch (e) {}

          setTimeout(() => dismissExitPopup(), 4000);
        } catch (err) {
          $w('#exitEmailSubmit').enable();
          $w('#exitEmailSubmit').label = config.ctaText;
          try {
            $w('#exitEmailError').text = 'Something went wrong. Please try again.';
            $w('#exitEmailError').show('fade', { duration: 200 });
          } catch (e) {}
        }
      });
    } catch (e) {}

    // "Request Swatches Instead" link → navigate to contact
    try {
      try { $w('#exitSwatchLink').accessibility.ariaLabel = 'Request free fabric swatches'; } catch (e) {}
      $w('#exitSwatchLink').onClick(() => {
        dismissExitPopup();
        import('wix-location-frontend').then(({ to }) => to('/contact'));
      });
    } catch (e) {}

    // Focus trap: keep focus within the popup dialog
    try {
      if (typeof document !== 'undefined') {
        const focusableSelector = 'input, button, [tabindex]:not([tabindex="-1"]), a[href]';
        popup.onViewportEnter(() => {
          try { $w('#exitEmailInput').focus(); } catch (e) {}
        });
      }
    } catch (e) {}
  } catch (e) {}
}

function dismissExitPopup() {
  markExitIntentDismissed();
  try { $w('#exitIntentPopup').hide('fade', { duration: 200 }); } catch (e) {}
  try { $w('#exitOverlay').hide('fade', { duration: 200 }); } catch (e) {}
  // Restore focus to element that was focused before popup
  try {
    if (_lastFocusedBeforeOverlay && typeof _lastFocusedBeforeOverlay.focus === 'function') {
      _lastFocusedBeforeOverlay.focus();
    }
  } catch (e) {}
}

// ── Header Shipping Progress Bar ─────────────────────────────────
// Persistent bar showing distance to $999 free shipping threshold

function initHeaderShippingProgress() {
  async function updateHeaderShipping() {
    try {
      const cart = await getCurrentCart();
      const subtotal = cart?.totals?.subtotal || 0;
      const { remaining, progressPct, qualifies } = getShippingProgress(subtotal);

      try {
        const bar = $w('#headerShippingBar');
        if (bar) bar.value = Math.max(0, progressPct);
      } catch (e) {}

      try {
        const text = $w('#headerShippingText');
        if (text) {
          text.text = qualifies
            ? 'FREE shipping!'
            : `$${remaining.toFixed(2)} away from free shipping`;
          try { text.accessibility.ariaLive = 'polite'; } catch (e) {}
        }
      } catch (e) {}
    } catch (e) {}
  }

  updateHeaderShipping();
  onCartChanged(() => updateHeaderShipping());
}

// ── Newsletter Modal ────────────────────────────────────────────────
// Dedicated newsletter signup modal with Mountain-themed design + 10% offer

function initNewsletterModal() {
  try {
    const trigger = $w('#newsletterModalTrigger');
    const modal = $w('#newsletterModal');
    if (!trigger && !modal) return;

    // Open modal on trigger click (e.g., CTA button in hero or footer)
    if (trigger) {
      trigger.onClick(() => showNewsletterModal());
    }

    // Close handlers
    try {
      $w('#newsletterModalClose').onClick(() => dismissNewsletterModal());
      try { $w('#newsletterModalClose').accessibility.ariaLabel = 'Close newsletter signup'; } catch (e) {}
    } catch (e) {}
    try {
      $w('#newsletterModalOverlay').onClick(() => dismissNewsletterModal());
    } catch (e) {}

    // Email submission
    try {
      const emailInput = $w('#newsletterModalEmail');
      const submitBtn = $w('#newsletterModalSubmit');
      if (!emailInput || !submitBtn) return;

      try { emailInput.accessibility.ariaLabel = 'Enter your email for 10% off'; } catch (e) {}
      try { submitBtn.accessibility.ariaLabel = 'Subscribe for 10% off'; } catch (e) {}

      submitBtn.onClick(async () => {
        const email = emailInput.value?.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          try { $w('#newsletterModalError').text = 'Please enter a valid email'; } catch (e) {}
          try { $w('#newsletterModalError').show(); } catch (e) {}
          return;
        }

        try { $w('#newsletterModalError').hide(); } catch (e) {}
        submitBtn.disable();
        submitBtn.label = 'Subscribing...';

        try {
          await submitContactForm({
            email,
            source: 'newsletter_modal',
            status: 'newsletter_signup',
            notes: 'Subscribed via newsletter modal — 10% welcome offer',
          });

          try {
            const wixCrm = await import('wix-crm-frontend');
            await wixCrm.createContact({ emails: [email] });
          } catch (e) {}

          trackEvent('newsletter_signup', { source: 'modal' });
          fireCustomEvent('newsletter_signup', { source: 'modal' });

          emailInput.value = '';
          submitBtn.label = 'Subscribed!';
          try {
            $w('#newsletterModalSuccess').text = 'Use code WELCOME10 for 10% off your first order!';
            $w('#newsletterModalSuccess').show('fade', { duration: 300 });
          } catch (e) {}

          setTimeout(() => dismissNewsletterModal(), 4000);
        } catch (err) {
          submitBtn.enable();
          submitBtn.label = 'Get 10% Off';
        }
      });
    } catch (e) {}
  } catch (e) {}
}

function showNewsletterModal() {
  try {
    // Don't show if already subscribed this session
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem('cf_newsletter_modal_shown')) return;
        sessionStorage.setItem('cf_newsletter_modal_shown', '1');
      } catch (e) {}
    }

    try { if (typeof document !== 'undefined') _lastFocusedBeforeOverlay = document.activeElement; } catch (e) {}

    const modal = $w('#newsletterModal');
    if (!modal) return;

    try { modal.accessibility.role = 'dialog'; } catch (e) {}
    try { modal.accessibility.ariaModal = true; } catch (e) {}
    try { modal.accessibility.ariaLabel = 'Newsletter signup — 10% off your first order'; } catch (e) {}

    try { $w('#newsletterModalOverlay').show('fade', { duration: 300 }); } catch (e) {}
    modal.show('fade', { duration: 300 });
  } catch (e) {}
}

function dismissNewsletterModal() {
  try { $w('#newsletterModal').hide('fade', { duration: 200 }); } catch (e) {}
  try { $w('#newsletterModalOverlay').hide('fade', { duration: 200 }); } catch (e) {}
}

// ── Mountain Skyline Header ──────────────────────────────────────
// Signature Blue Ridge mountain silhouette SVG in the global header border

function initMountainSkylineHeader() {
  try {
    import('public/MountainSkyline.js').then(({ initMountainSkyline }) => {
      initMountainSkyline($w, { variant: 'silhouette', containerId: '#headerSkyline' });
    }).catch(() => {
      // MountainSkyline module not yet available — silently skip
    });
  } catch (e) {
    // Non-critical decorative element
  }
}

// ── Core Web Vitals Collection ────────────────────────────────────
// Collects performance metrics after page load and reports to CMS

function collectCoreWebVitals() {
  try {
    if (typeof performance === 'undefined') return;

    // Generate or retrieve session ID
    let sessionId = '';
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionId = sessionStorage.getItem('cf_cwv_session') || '';
        if (!sessionId) {
          sessionId = 'cwv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem('cf_cwv_session', sessionId);
        }
      } catch (e) {}
    }
    if (!sessionId) sessionId = 'cwv_' + Date.now();

    const page = '/' + (wixLocationFrontend.path || []).join('/');

    // Detect device type
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

    // Detect connection type
    let connectionType = 'unknown';
    try {
      if (typeof navigator !== 'undefined' && navigator.connection) {
        connectionType = navigator.connection.effectiveType || 'unknown';
      }
    } catch (e) {}

    const data = { sessionId, page, deviceType, connectionType };

    // Collect TTFB and FCP from performance.timing (navigation timing)
    try {
      const timing = performance.timing;
      if (timing && timing.responseStart > 0) {
        data.ttfb = timing.responseStart - timing.navigationStart;
      }
    } catch (e) {}

    // Collect paint timing entries (FCP)
    try {
      const paintEntries = performance.getEntriesByType('paint');
      for (const entry of paintEntries) {
        if (entry.name === 'first-contentful-paint') {
          data.fcp = Math.round(entry.startTime);
        }
      }
    } catch (e) {}

    // Collect LCP from PerformanceObserver buffered entries
    try {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries && lcpEntries.length > 0) {
        data.lcp = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
      }
    } catch (e) {}

    // CLS from layout-shift entries
    try {
      const layoutShifts = performance.getEntriesByType('layout-shift');
      if (layoutShifts && layoutShifts.length > 0) {
        let cls = 0;
        for (const shift of layoutShifts) {
          if (!shift.hadRecentInput) cls += shift.value;
        }
        data.cls = Math.round(cls * 1000) / 1000;
      }
    } catch (e) {}

    // Only report if we have at least one metric
    const hasMetric = data.lcp || data.fcp || data.ttfb || data.cls !== undefined;
    if (!hasMetric) return;

    reportMetrics(data).catch(err => console.error('[masterPage] CWV reportMetrics failed:', err.message));
  } catch (e) {
    // CWV collection is non-critical
  }
}
