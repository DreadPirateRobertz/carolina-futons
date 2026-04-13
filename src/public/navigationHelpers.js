/**
 * Navigation, Layout & Footer Helpers
 *
 * Extracted from masterPage.js to provide testable, reusable navigation logic:
 * - Mega menu behavior (category dropdowns with featured images)
 * - Mobile drawer with category accordions
 * - Breadcrumb generation with JSON-LD schema
 * - Back-to-top button
 * - Announcement bar with dismiss + rotation
 * - Active page indicator
 * - Footer accordion (mobile)
 *
 * All functions accept $w selector and follow Wix Velo patterns.
 */

import { colors, spacing, shadows } from 'public/designTokens.js';
import { transitions } from 'public/sharedTokens';
import { announce, makeClickable, createFocusTrap } from 'public/a11yHelpers';
import { isMobile, getViewport } from 'public/mobileHelpers';

// ── Nav Link Map ─────────────────────────────────────────────────────

/**
 * Map of nav element IDs to their paths and category metadata.
 * Used for active state, mega menu, and breadcrumb generation.
 */
export const NAV_LINKS = {
  '#navHome': { path: '/', label: 'Home' },
  '#navShop': { path: '/shop-main', label: 'Shop All' },
  '#navFutonFrames': { path: '/futon-frames', label: 'Futon Frames', category: 'futon-frames' },
  '#navMattresses': { path: '/mattresses', label: 'Mattresses', category: 'mattresses' },
  '#navMurphy': { path: '/murphy-cabinet-beds', label: 'Murphy Cabinet Beds', category: 'murphy-cabinet-beds' },
  '#navPlatformBeds': { path: '/platform-beds', label: 'Platform Beds', category: 'platform-beds' },
  '#navSale': { path: '/sales', label: 'Sale' },
  '#navProductVideos': { path: '/product-videos', label: 'Product Videos' },
  '#navGettingItHome': { path: '/getting-it-home', label: 'Getting It Home' },
  '#navContact': { path: '/contact', label: 'Contact' },
  '#navFAQ': { path: '/faq', label: 'FAQ' },
  '#navAbout': { path: '/about', label: 'About' },
  '#navBlog': { path: '/blog', label: 'Blog' },
  '#navFreeSwatches': { path: '/free-swatches', label: 'Free Swatches' },
  '#navGiftCards': { path: '/gift-cards', label: 'Gift Cards' },
};

/**
 * Mega menu category groups for the desktop dropdown.
 * Each group contains nav items organized by product type.
 */
export const MEGA_MENU_CATEGORIES = [
  {
    title: 'Furniture',
    items: [
      { id: '#navFutonFrames', label: 'Futon Frames', path: '/futon-frames' },
      { id: '#navMurphy', label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' },
      { id: '#navPlatformBeds', label: 'Platform Beds', path: '/platform-beds' },
    ],
  },
  {
    title: 'Bedding',
    items: [
      { id: '#navMattresses', label: 'Mattresses', path: '/mattresses' },
    ],
  },
  {
    title: 'More',
    items: [
      { id: '#navSale', label: 'Sale', path: '/sales' },
      { id: '#navProductVideos', label: 'Product Videos', path: '/product-videos' },
      { id: '#navGettingItHome', label: 'Getting It Home', path: '/getting-it-home' },
      { id: '#navFreeSwatches', label: 'Free Swatches', path: '/free-swatches' },
      { id: '#navGiftCards', label: 'Gift Cards', path: '/gift-cards' },
    ],
  },
];

// ── Active Page Indicator ────────────────────────────────────────────

/**
 * Determine which nav link matches the current path.
 * @param {string} currentPath - Current URL path (e.g. '/futon-frames')
 * @returns {string|null} Matching nav element ID or null
 */
export function getActiveNavId(currentPath) {
  if (!currentPath) return null;
  const normalized = currentPath.replace(/\/$/, '') || '/';

  for (const [id, config] of Object.entries(NAV_LINKS)) {
    if (normalized === config.path) return id;
    if (config.path !== '/' && normalized.startsWith(config.path + '/')) return id;
  }
  return null;
}

/**
 * Apply active state styling to the matching nav link.
 * Sets font weight bold and Mountain Blue underline.
 *
 * @param {Function} $w - Wix selector
 * @param {string} currentPath - Current page path
 */
export function applyActiveNavState($w, currentPath) {
  const activeId = getActiveNavId(currentPath);
  if (!activeId) return;

  Object.keys(NAV_LINKS).forEach(id => {
    try {
      const el = $w(id);
      if (!el) return;
      if (id === activeId) {
        el.style.fontWeight = '700';
        el.style.color = colors.mountainBlue;
        try { el.accessibility.ariaCurrent = 'page'; } catch (e) { console.warn('[navigationHelpers] accessibility ariaCurrent:', e); }
      } else {
        el.style.fontWeight = '400';
        el.style.color = colors.espresso;
      }
    } catch (e) { console.error('[navigationHelpers] applyActiveNavState:', e); }
  });
}

// ── Mega Menu ────────────────────────────────────────────────────────

/**
 * Initialize mega menu behavior on desktop.
 * Shows category dropdown on hover/focus of #navShop.
 *
 * @param {Function} $w - Wix selector
 * @returns {{ open: Function, close: Function }} Control object
 */
export function initMegaMenu($w) {
  let isOpen = false;
  let closeTimer = null;

  function open() {
    clearTimeout(closeTimer);
    if (isOpen) return;
    isOpen = true;
    try {
      $w('#megaMenuPanel').show('fade', { duration: transitions.fast });
      try { $w('#navShop').accessibility.ariaExpanded = true; } catch (e) { console.warn('[navigationHelpers] megaMenu ariaExpanded open:', e); }
      announce($w, 'Shop menu expanded');
    } catch (e) { console.error('[navigationHelpers] megaMenu open:', e); }
  }

  function close() {
    closeTimer = setTimeout(() => {
      isOpen = false;
      try {
        $w('#megaMenuPanel').hide('fade', { duration: transitions.fast });
        try { $w('#navShop').accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] megaMenu ariaExpanded close:', e); }
      } catch (e) { console.error('[navigationHelpers] megaMenu close:', e); }
    }, 150);
  }

  function cancelClose() {
    clearTimeout(closeTimer);
  }

  // Wire up hover/focus triggers
  try {
    const shopLink = $w('#navShop');
    if (shopLink) {
      try { shopLink.accessibility.ariaHasPopup = 'true'; } catch (e) { console.warn('[navigationHelpers] megaMenu ariaHasPopup:', e); }
      try { shopLink.accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] megaMenu ariaExpanded init:', e); }
      shopLink.onMouseIn(() => open());
      shopLink.onMouseOut(() => close());
    }
  } catch (e) { console.error('[navigationHelpers] megaMenu shopLink setup:', e); }

  try {
    const panel = $w('#megaMenuPanel');
    if (panel) {
      panel.onMouseIn(() => cancelClose());
      panel.onMouseOut(() => close());
      try { panel.accessibility.role = 'menu'; } catch (e) { console.warn('[navigationHelpers] megaMenu panel role:', e); }
    }
  } catch (e) { console.error('[navigationHelpers] megaMenu panel setup:', e); }

  // Keyboard: Enter/Space on #navShop toggles menu
  try {
    $w('#navShop').onKeyPress((event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (isOpen) close();
        else open();
      }
    });
  } catch (e) { console.error('[navigationHelpers] megaMenu keyPress:', e); }

  return { open, close };
}

// ── Mobile Drawer ────────────────────────────────────────────────────

/**
 * Mobile nav link mapping — element IDs to their NAV_LINKS counterparts.
 * Used by initMobileDrawer to populate and style the mobile menu.
 */
const MOBILE_NAV_MAP = [
  { mobileId: '#mobileNavHome', desktopId: '#navHome' },
  { mobileId: '#mobileNavShop', desktopId: '#navShop' },
  { mobileId: '#mobileNavFutonFrames', desktopId: '#navFutonFrames' },
  { mobileId: '#mobileNavMattresses', desktopId: '#navMattresses' },
  { mobileId: '#mobileNavMurphy', desktopId: '#navMurphy' },
  { mobileId: '#mobileNavPlatformBeds', desktopId: '#navPlatformBeds' },
  { mobileId: '#mobileNavSale', desktopId: '#navSale' },
  { mobileId: '#mobileNavContact', desktopId: '#navContact' },
  { mobileId: '#mobileNavFAQ', desktopId: '#navFAQ' },
  { mobileId: '#mobileNavAbout', desktopId: '#navAbout' },
];

/**
 * Initialize mobile navigation drawer with slide-out animation,
 * category accordions, focus trap, scroll lock, and nav link population.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [currentPath] - Current page path for active link highlighting
 * @returns {{ open: Function, close: Function }} Control object
 */
export function initMobileDrawer($w, currentPath) {
  let isOpen = false;
  let focusTrap = null;
  let escHandler = null;

  function lockScroll() {
    try {
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = 'hidden';
      }
    } catch (e) { console.error('[navigationHelpers] lockScroll:', e); }
  }

  function unlockScroll() {
    try {
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.overflow = '';
      }
    } catch (e) { console.error('[navigationHelpers] unlockScroll:', e); }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    try {
      $w('#mobileMenuOverlay').show('fade', { duration: transitions.medium });
      try { $w('#mobileMenuButton').accessibility.ariaExpanded = true; } catch (e) { console.warn('[navigationHelpers] mobileDrawer ariaExpanded open:', e); }
      lockScroll();
      addEscHandler();

      // Create focus trap inside the drawer
      focusTrap = createFocusTrap($w, '#mobileMenuOverlay', [
        '#mobileMenuClose',
        '#mobileSearchInput',
        ...MOBILE_NAV_MAP.map(m => m.mobileId),
      ]);

      try { $w('#mobileMenuClose').focus(); } catch (e) { console.warn('[navigationHelpers] mobileDrawer focus mobileMenuClose:', e); }
      announce($w, 'Navigation menu opened');
    } catch (e) { console.error('[navigationHelpers] mobileDrawer open:', e); }
  }

  function addEscHandler() {
    try {
      if (typeof document !== 'undefined' && !escHandler) {
        escHandler = (e) => {
          if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', escHandler);
      }
    } catch (e) { console.error('[navigationHelpers] addEscHandler:', e); }
  }

  function removeEscHandler() {
    try {
      if (typeof document !== 'undefined' && escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
      }
    } catch (e) { console.error('[navigationHelpers] removeEscHandler:', e); }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    try {
      $w('#mobileMenuOverlay').hide('slide', { direction: 'left', duration: transitions.medium });
      try { $w('#mobileMenuButton').accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] mobileDrawer ariaExpanded close:', e); }
      unlockScroll();
      removeEscHandler();
      if (focusTrap) {
        focusTrap.release();
        focusTrap = null;
      }
      try { $w('#mobileMenuButton').focus(); } catch (e) { console.warn('[navigationHelpers] mobileDrawer focus mobileMenuButton:', e); }
      announce($w, 'Navigation menu closed');
    } catch (e) { console.error('[navigationHelpers] mobileDrawer close:', e); }
  }

  // Responsive: show/hide nav elements based on viewport.
  // Each element is wrapped in its own try/catch so a missing #mobileMenuButton
  // never silently prevents #desktopNavBar from being hidden (cf-3zs3).
  const _mobile = isMobile();
  try {
    if (_mobile) { $w('#mobileMenuButton').show(); } else { $w('#mobileMenuButton').hide(); }
  } catch (e) { console.warn('[navigationHelpers] mobileDrawer mobileMenuButton responsive:', e); }
  try {
    if (_mobile) { $w('#desktopNavBar').hide(); } else { $w('#desktopNavBar').show(); }
  } catch (e) { console.warn('[navigationHelpers] mobileDrawer desktopNavBar responsive:', e); }

  // Style overlay with design tokens
  try {
    $w('#mobileMenuOverlay').style.backgroundColor = colors.sandLight;
  } catch (e) { console.error('[navigationHelpers] mobileDrawer overlay style:', e); }

  // Populate nav links with labels, colors, and click handlers
  const activeNavId = currentPath ? getActiveNavId(currentPath) : null;
  MOBILE_NAV_MAP.forEach(({ mobileId, desktopId }) => {
    try {
      const el = $w(mobileId);
      const config = NAV_LINKS[desktopId];
      if (!el || !config) return;

      el.text = config.label;
      el.style.color = (desktopId === activeNavId) ? colors.sunsetCoral : colors.espresso;

      el.onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to(config.path);
        }).catch((e) => console.error('[navigationHelpers] mobileDrawer navigate to', config.path, e));
        close();
      });
    } catch (e) { console.error('[navigationHelpers] mobileDrawer navLink', mobileId, ':', e); }
  });

  // Wire menu button
  try {
    const btn = $w('#mobileMenuButton');
    if (btn) {
      try { btn.accessibility.ariaLabel = 'Open navigation menu'; } catch (e) { console.warn('[navigationHelpers] mobileMenuButton ariaLabel:', e); }
      try { btn.accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] mobileMenuButton ariaExpanded:', e); }
      makeClickable(btn, () => open(), { ariaLabel: 'Open navigation menu' });
    }
  } catch (e) { console.error('[navigationHelpers] mobileDrawer menuButton setup:', e); }

  // Wire close button
  try {
    const closeBtn = $w('#mobileMenuClose');
    if (closeBtn) {
      makeClickable(closeBtn, () => close(), { ariaLabel: 'Close navigation menu' });
    }
  } catch (e) { console.error('[navigationHelpers] mobileDrawer closeButton setup:', e); }

  // Wire overlay backdrop click to close
  try {
    $w('#mobileMenuOverlay').onClick(() => close());
  } catch (e) { console.error('[navigationHelpers] mobileDrawer overlayClick:', e); }

  return { open, close };
}

// ── Mobile Category Accordions ───────────────────────────────────────

/**
 * Initialize accordion behavior for mobile category groups.
 * Each category header toggles its child links.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<{headerId: string, panelId: string, label: string}>} sections
 */
export function initMobileAccordions($w, sections) {
  if (!sections || sections.length === 0) return;

  sections.forEach(({ headerId, panelId, label }) => {
    try {
      const header = $w(headerId);
      const panel = $w(panelId);
      if (!header || !panel) return;

      let expanded = false;
      try { panel.collapse(); } catch (e) { console.warn('[navigationHelpers] accordion panel collapse:', e); }
      try { header.accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] accordion ariaExpanded init:', e); }
      try { header.accessibility.role = 'button'; } catch (e) { console.warn('[navigationHelpers] accordion role:', e); }

      function toggle() {
        expanded = !expanded;
        if (expanded) {
          try { panel.expand(); } catch (e) { console.warn('[navigationHelpers] accordion panel expand:', e); }
          try { header.accessibility.ariaExpanded = true; } catch (e) { console.warn('[navigationHelpers] accordion ariaExpanded true:', e); }
          announce($w, `${label} expanded`);
        } else {
          try { panel.collapse(); } catch (e) { console.warn('[navigationHelpers] accordion panel collapse toggle:', e); }
          try { header.accessibility.ariaExpanded = false; } catch (e) { console.warn('[navigationHelpers] accordion ariaExpanded false:', e); }
          announce($w, `${label} collapsed`);
        }
      }

      makeClickable(header, toggle, { ariaLabel: `Toggle ${label}` });
    } catch (e) { console.error('[navigationHelpers] accordion', headerId, ':', e); }
  });
}

// ── Breadcrumbs ──────────────────────────────────────────────────────

/**
 * Build breadcrumb trail from a path array.
 *
 * @param {Array<{label: string, path: string}>} crumbs - Breadcrumb items (first is Home)
 * @returns {{ items: Array<{label: string, path: string, isLast: boolean}>, schema: object }}
 */
export function buildBreadcrumbs(crumbs) {
  if (!crumbs || crumbs.length === 0) {
    crumbs = [{ label: 'Home', path: '/' }];
  }

  const items = crumbs.map((c, i) => ({
    label: c.label,
    path: c.path,
    isLast: i === crumbs.length - 1,
  }));

  const baseUrl = 'https://www.carolinafutons.com';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      item: item.isLast ? undefined : `${baseUrl}${item.path}`,
    })),
  };

  return { items, schema };
}

/**
 * Render breadcrumbs into Wix elements.
 * Uses #breadcrumb1, #breadcrumb2, #breadcrumb3 and #breadcrumbSchemaHtml.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<{label: string, path: string}>} crumbs
 */
export function renderBreadcrumbs($w, crumbs) {
  const { items, schema } = buildBreadcrumbs(crumbs);

  // Render crumb elements (up to 3 levels)
  const crumbIds = ['#breadcrumb1', '#breadcrumb2', '#breadcrumb3'];
  crumbIds.forEach((id, i) => {
    try {
      const el = $w(id);
      if (!el) return;
      if (i < items.length) {
        el.text = items[i].label;
        if (!items[i].isLast) {
          el.onClick(() => {
            import('wix-location-frontend').then(({ to }) => {
              to(items[i].path);
            });
          });
          try { el.accessibility.role = 'link'; } catch (e) { console.warn('[navigationHelpers] breadcrumb role:', e); }
        } else {
          try { el.accessibility.ariaCurrent = 'page'; } catch (e) { console.warn('[navigationHelpers] breadcrumb ariaCurrent:', e); }
        }
        try { el.show(); } catch (e) { console.warn('[navigationHelpers] breadcrumb show:', e); }
      } else {
        try { el.hide(); } catch (e) { console.warn('[navigationHelpers] breadcrumb hide:', e); }
      }
    } catch (e) { console.error('[navigationHelpers] renderBreadcrumbs', id, ':', e); }
  });

  // Inject schema
  try {
    $w('#breadcrumbSchemaHtml').postMessage(JSON.stringify(schema));
  } catch (e) { console.error('[navigationHelpers] breadcrumbSchema:', e); }
}

/**
 * Auto-generate breadcrumbs from the current path using NAV_LINKS.
 * For product pages, includes the category level when a collection slug
 * is provided or falls back to "Shop".
 *
 * @param {string} currentPath - Current URL path
 * @param {Object} [opts] - Options
 * @param {string} [opts.category] - Category collection slug (e.g. 'futon-frames')
 * @returns {Array<{label: string, path: string}>}
 */
export function breadcrumbsFromPath(currentPath, opts) {
  const crumbs = [{ label: 'Home', path: '/' }];
  if (!currentPath || currentPath === '/') return crumbs;

  // Product pages: /product-page/<slug> — inject category level
  const isProductPage = currentPath.startsWith('/product-page/');
  if (isProductPage) {
    const categorySlug = opts?.category;
    const categoryNav = categorySlug
      ? Object.values(NAV_LINKS).find(c => c.category === categorySlug)
      : null;
    if (categoryNav) {
      crumbs.push({ label: categoryNav.label, path: categoryNav.path });
    } else {
      crumbs.push({ label: 'Shop', path: '/shop-main' });
    }
    // Add the product name from the slug
    const segments = currentPath.split('/').filter(Boolean);
    const productSlug = segments[segments.length - 1];
    const prettyName = productSlug
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label: prettyName, path: currentPath });
    return crumbs;
  }

  // Find matching nav link
  for (const config of Object.values(NAV_LINKS)) {
    if (config.path !== '/' && (currentPath === config.path || currentPath.startsWith(config.path + '/'))) {
      crumbs.push({ label: config.label, path: config.path });
      break;
    }
  }

  // If path has additional segments beyond the matched nav link, add them
  const lastCrumb = crumbs[crumbs.length - 1];
  if (lastCrumb.path !== currentPath && currentPath !== '/') {
    // Extract last segment as page name
    const segments = currentPath.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const prettyName = lastSegment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label: prettyName, path: currentPath });
  }

  return crumbs;
}

// ── Announcement Bar ─────────────────────────────────────────────────

/**
 * Initialize announcement bar with rotating messages and dismiss.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<string>} messages - Messages to rotate
 * @param {Object} [opts]
 * @param {number} [opts.interval=5000] - Rotation interval in ms
 * @returns {{ dismiss: Function, pause: Function, resume: Function }}
 */
export function initAnnouncementBar($w, messages, opts = {}) {
  const interval = opts.interval || 5000;
  let currentIndex = 0;
  let timer = null;
  let dismissed = false;

  function updateMessage() {
    try {
      const el = $w('#announcementText');
      if (!el) return;
      el.hide('fade', { duration: 200 }).then(() => {
        el.text = messages[currentIndex];
        el.show('fade', { duration: 200 });
      });
    } catch (e) { console.error('[navigationHelpers] announcementBar updateMessage:', e); }
  }

  function rotate() {
    currentIndex = (currentIndex + 1) % messages.length;
    updateMessage();
  }

  function startRotation() {
    if (timer || dismissed) return;
    timer = setInterval(rotate, interval);
  }

  function pause() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resume() {
    if (!dismissed) startRotation();
  }

  function dismiss() {
    pause();
    dismissed = true;
    try { $w('#announcementBar').hide('slide', { direction: 'top', duration: transitions.medium }); } catch (e) { console.error('[navigationHelpers] announcementBar dismiss hide:', e); }
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('cf_announcement_dismissed', '1');
      }
    } catch (e) { console.warn('[navigationHelpers] announcementBar sessionStorage set:', e); }
  }

  // Check if already dismissed this session
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('cf_announcement_dismissed')) {
      try { $w('#announcementBar').hide(); } catch (e) { console.warn('[navigationHelpers] announcementBar hide on dismissed:', e); }
      return { dismiss, pause, resume };
    }
  } catch (e) { console.warn('[navigationHelpers] announcementBar sessionStorage check:', e); }

  // Set initial message
  try {
    if (messages && messages.length > 0) {
      $w('#announcementText').text = messages[0];
      try { $w('#announcementText').accessibility.ariaLive = 'polite'; } catch (e) { console.warn('[navigationHelpers] announcementBar ariaLive:', e); }
      try { $w('#announcementText').accessibility.role = 'status'; } catch (e) { console.warn('[navigationHelpers] announcementBar role:', e); }
    }
  } catch (e) { console.error('[navigationHelpers] announcementBar init message:', e); }

  // Wire dismiss button
  try {
    makeClickable($w('#announcementDismiss'), dismiss, { ariaLabel: 'Dismiss announcement' });
  } catch (e) { console.error('[navigationHelpers] announcementBar dismissButton:', e); }

  startRotation();

  return { dismiss, pause, resume };
}

// ── Back to Top ──────────────────────────────────────────────────────

/**
 * Initialize back-to-top button with scroll detection.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [buttonId='#backToTop'] - Button element ID
 * @param {number} [threshold=600] - Scroll threshold in px
 */
export function initBackToTop($w, buttonId = '#backToTop', threshold = 600) {
  try {
    const btn = $w(buttonId);
    if (!btn) return;

    try { btn.hide(); } catch (e) { console.warn('[navigationHelpers] backToTop hide init:', e); }
    try { btn.accessibility.ariaLabel = 'Back to top'; } catch (e) { console.warn('[navigationHelpers] backToTop ariaLabel:', e); }

    makeClickable(btn, () => {
      import('wix-window-frontend').then(({ scrollTo }) => {
        if (scrollTo) scrollTo(0, 0, { scrollAnimation: true });
      }).catch((e) => console.error('[navigationHelpers] backToTop scrollTo:', e));
      announce($w, 'Scrolled to top');
    }, { ariaLabel: 'Back to top' });

    import('wix-window-frontend').then(({ onScroll }) => {
      if (onScroll) {
        onScroll((event) => {
          if (event.scrollY > threshold) {
            try { btn.show('fade', { duration: 200 }); } catch (e) { console.warn('[navigationHelpers] backToTop show:', e); }
          } else {
            try { btn.hide('fade', { duration: 200 }); } catch (e) { console.warn('[navigationHelpers] backToTop hide:', e); }
          }
        });
      }
    }).catch((e) => console.error('[navigationHelpers] backToTop onScroll:', e));
  } catch (e) { console.error('[navigationHelpers] initBackToTop:', e); }
}

// ── Footer Mobile Accordions ─────────────────────────────────────────

/**
 * Collapse footer columns to accordions on mobile.
 *
 * @param {Function} $w - Wix selector
 * @param {Array<{headerId: string, contentId: string, label: string}>} columns
 */
export function initFooterAccordions($w, columns) {
  if (!isMobile()) return;

  initMobileAccordions($w, columns.map(c => ({
    headerId: c.headerId,
    panelId: c.contentId,
    label: c.label,
  })));
}

// ── Sticky Nav on Scroll ─────────────────────────────────────────────

/**
 * Make the header sticky with shadow on scroll.
 * Adds/removes visual shadow to indicate stickiness.
 *
 * @param {Function} $w - Wix selector
 * @param {string} [headerId='#headerStrip'] - Header container ID
 */
export function initStickyNav($w, headerId = '#headerStrip') {
  try {
    import('wix-window-frontend').then(({ onScroll }) => {
      if (!onScroll) return;

      onScroll((event) => {
        try {
          const header = $w(headerId);
          if (!header) return;
          if (event.scrollY > 50) {
            // Wix Studio handles CSS sticky; we add a visual shadow class
            try { header.style.boxShadow = shadows.nav; } catch (e) { console.warn('[navigationHelpers] stickyNav boxShadow set:', e); }
          } else {
            try { header.style.boxShadow = 'none'; } catch (e) { console.warn('[navigationHelpers] stickyNav boxShadow clear:', e); }
          }
        } catch (e) { console.error('[navigationHelpers] stickyNav scroll handler:', e); }
      });
    }).catch((e) => console.error('[navigationHelpers] stickyNav onScroll import:', e));
  } catch (e) { console.error('[navigationHelpers] initStickyNav:', e); }
}
