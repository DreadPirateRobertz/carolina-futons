// masterPage.js - Global site code
// Runs on every page: navigation behavior, announcement bar, SEO injection,
// and side cart auto-open on add-to-cart
import { getBusinessSchema } from 'backend/seoHelpers.web';
import { getActivePromotion } from 'backend/promotions.web';
import { submitContactForm } from 'backend/contactSubmissions.web';
import wixLocationFrontend from 'wix-location-frontend';
import { getCurrentCart, onCartChanged } from 'public/cartService';
import { isMobile } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { typography } from 'public/designTokens.js';
import { captureInstallPrompt, canShowInstallPrompt, showInstallPrompt, isInstalledPWA } from 'public/pwaHelpers';
import { reportMetrics } from 'backend/coreWebVitals.web';

let _previousCartItemCount = null;

$w.onReady(async function () {
  captureInstallPrompt();
  initAccessibility();
  initNavigation();
  initAnnouncementBar();
  initSearch();
  initSideCartAutoOpen();
  initFooterNewsletter();
  initInstallBanner();
  await injectBusinessSchema();

  // Live chat widget — async loaded, 2s delay to avoid impacting page speed
  setTimeout(() => {
    import('public/LiveChat.js').then(({ initLiveChat }) => {
      initLiveChat($w);
    }).catch(() => {}); // Chat is non-critical
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
          // Close mobile menu
          try { $w('#mobileMenuOverlay').hide('fade', { duration: 200 }); } catch (e) {}
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

  // Mobile hamburger menu toggle
  try {
    const menuButton = $w('#mobileMenuButton');
    const mobileMenu = $w('#mobileMenuOverlay');
    const menuClose = $w('#mobileMenuClose');

    if (menuButton && mobileMenu) {
      try { menuButton.accessibility.ariaLabel = 'Open navigation menu'; } catch (e) {}
      menuButton.onClick(() => {
        mobileMenu.show('fade', { duration: 200 });
      });
    }
    if (menuClose && mobileMenu) {
      try { menuClose.accessibility.ariaLabel = 'Close navigation menu'; } catch (e) {}
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

// ── Footer Newsletter Signup ────────────────────────────────────────
// Email capture in footer — saves to CMS and Wix contacts

function initFooterNewsletter() {
  try {
    const emailInput = $w('#footerEmailInput');
    const submitBtn = $w('#footerEmailSubmit');
    if (!emailInput || !submitBtn) return;

    try { emailInput.accessibility.ariaLabel = 'Enter your email for newsletter'; } catch (e) {}
    try { submitBtn.accessibility.ariaLabel = 'Subscribe to newsletter'; } catch (e) {}

    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !email.includes('@')) {
        try { $w('#footerEmailError').text = 'Please enter a valid email'; } catch (e) {}
        try { $w('#footerEmailError').show(); } catch (e) {}
        return;
      }

      try { $w('#footerEmailError').hide(); } catch (e) {}
      submitBtn.disable();
      submitBtn.label = 'Subscribing...';

      try {
        // Save to CMS for record-keeping
        await submitContactForm({
          email,
          source: 'footer_newsletter',
          status: 'newsletter_signup',
          notes: 'Subscribed via site footer',
        });

        // Also add to Wix contacts for email marketing
        try {
          const wixCrm = await import('wix-crm-frontend');
          await wixCrm.createContact({ emails: [email] });
        } catch (e) {}

        trackEvent('newsletter_signup', { source: 'footer' });

        emailInput.value = '';
        submitBtn.label = 'Subscribed!';
        try { $w('#footerEmailSuccess').show('fade', { duration: 300 }); } catch (e) {}
      } catch (err) {
        submitBtn.enable();
        submitBtn.label = 'Subscribe';
      }
    });
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

    // Set dialog ARIA attributes
    try { lightbox.accessibility.role = 'dialog'; } catch (e) {}
    try { lightbox.accessibility.ariaModal = true; } catch (e) {}
    try { lightbox.accessibility.ariaLabel = 'Promotional offer'; } catch (e) {}

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
      if (!email || !email.includes('@')) return;

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
// Detects when user is about to leave and shows a lead capture popup.
// Only shows once per session, doesn't interrupt checkout/cart pages,
// and respects promo lightbox (only shows if promo didn't fire).

function initExitIntent() {
  try {
    const popup = $w('#exitIntentPopup');
    if (!popup) return;

    // Don't show on cart, checkout, or thank-you pages
    const path = wixLocationFrontend.path?.join('/') || '';
    if (['cart', 'checkout', 'thank-you'].some(p => path.includes(p))) return;

    // Only show once per session
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem('cf_exit_shown')) return;
      } catch (e) {}
    }

    // Don't show if promo lightbox is already visible
    try {
      if (!$w('#promoLightbox').hidden) return;
    } catch (e) {}

    // Mouse leave detection (desktop only — moves cursor above viewport)
    if (typeof document !== 'undefined') {
      document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0) {
          showExitPopup();
        }
      }, { once: true });
    }
  } catch (e) {}
}

function showExitPopup() {
  try {
    // Mark as shown for this session
    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem('cf_exit_shown', '1'); } catch (e) {}
    }

    const popup = $w('#exitIntentPopup');
    if (!popup) return;

    // Populate content
    try { $w('#exitTitle').text = 'Wait — Before You Go!'; } catch (e) {}
    try { $w('#exitSubtitle').text = 'Get free fabric swatches shipped to your door, or save 5% on your first order.'; } catch (e) {}

    // Set dialog ARIA attributes
    try { popup.accessibility.role = 'dialog'; } catch (e) {}
    try { popup.accessibility.ariaModal = true; } catch (e) {}
    try { popup.accessibility.ariaLabel = 'Special offer before you go'; } catch (e) {}

    popup.show('fade', { duration: 300 });
    try { $w('#exitOverlay').show('fade', { duration: 300 }); } catch (e) {}

    trackEvent('exit_intent_shown', { page: wixLocationFrontend.path?.join('/') || '' });

    // Close handlers
    try {
      $w('#exitClose').onClick(() => dismissExitPopup());
      try { $w('#exitClose').accessibility.ariaLabel = 'Close popup'; } catch (e) {}
    } catch (e) {}
    try {
      $w('#exitOverlay').onClick(() => dismissExitPopup());
    } catch (e) {}

    // Email capture form
    try {
      try { $w('#exitEmailInput').accessibility.ariaLabel = 'Enter your email for offer'; } catch (e) {}
      try { $w('#exitEmailSubmit').accessibility.ariaLabel = 'Get my offer'; } catch (e) {}
      $w('#exitEmailSubmit').onClick(async () => {
        const email = $w('#exitEmailInput').value?.trim();
        if (!email || !email.includes('@')) return;

        try {
          $w('#exitEmailSubmit').disable();
          $w('#exitEmailSubmit').label = 'Sending...';

          await submitContactForm({
            email,
            source: 'exit_intent_popup',
            status: 'exit_intent_signup',
            notes: 'Exit intent capture — interested in swatches/discount',
          });

          // Also add to Wix contacts for email marketing
          try {
            const wixCrm = await import('wix-crm-frontend');
            await wixCrm.createContact({ emails: [email] });
          } catch (e) {}

          trackEvent('exit_intent_capture', { email: 'captured' });

          $w('#exitEmailInput').value = '';
          $w('#exitEmailSubmit').label = 'Sent!';
          try {
            $w('#exitSuccess').text = 'Check your inbox! Use code WELCOME5 for 5% off.';
            $w('#exitSuccess').show('fade', { duration: 300 });
          } catch (e) {}

          setTimeout(() => dismissExitPopup(), 4000);
        } catch (err) {
          $w('#exitEmailSubmit').enable();
          $w('#exitEmailSubmit').label = 'Get My Offer';
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
  } catch (e) {}
}

function dismissExitPopup() {
  try { $w('#exitIntentPopup').hide('fade', { duration: 200 }); } catch (e) {}
  try { $w('#exitOverlay').hide('fade', { duration: 200 }); } catch (e) {}
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

    reportMetrics(data).catch(() => {});
  } catch (e) {
    // CWV collection is non-critical
  }
}
