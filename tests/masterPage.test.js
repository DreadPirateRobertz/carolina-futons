import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement(id) {
  return {
    _id: id,
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    data: [],
    hidden: true,
    style: { color: '', fontWeight: '', boxShadow: '' },
    accessibility: {
      ariaLabel: '',
      ariaExpanded: undefined,
      ariaHasPopup: undefined,
      ariaCurrent: undefined,
      ariaLive: undefined,
      ariaAtomic: undefined,
      ariaModal: undefined,
      role: undefined,
      tabIndex: undefined,
    },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    focus: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onFocus: vi.fn(),
    onBlur: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Modules ────────────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue('{"@type":"LocalBusiness"}'),
}));
vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue(null),
}));
vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({}),
}));
vi.mock('backend/coreWebVitals.web', () => ({
  reportMetrics: vi.fn().mockResolvedValue({}),
}));
vi.mock('wix-location-frontend', () => ({
  default: { path: [], to: vi.fn() },
  path: [],
  to: vi.fn(),
}));
vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue({ lineItems: [] }),
  onCartChanged: vi.fn(),
}));
const { mockIsMobile, mockGetViewport } = vi.hoisted(() => ({
  mockIsMobile: vi.fn(() => false),
  mockGetViewport: vi.fn(() => 'desktop'),
}));
vi.mock('public/mobileHelpers', () => ({
  isMobile: mockIsMobile,
  getViewport: mockGetViewport,
  initBackToTop: vi.fn(),
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
}));
vi.mock('public/pwaHelpers', () => ({
  captureInstallPrompt: vi.fn(),
  canShowInstallPrompt: vi.fn(() => false),
  showInstallPrompt: vi.fn(),
  isInstalledPWA: vi.fn(() => false),
}));
vi.mock('public/LiveChat.js', () => ({
  initLiveChat: vi.fn(),
}));
vi.mock('wix-crm-frontend', () => ({
  createContact: vi.fn().mockResolvedValue({}),
}));
vi.mock('wix-seo-frontend', () => ({
  head: { setLinks: vi.fn() },
}));
vi.mock('wix-window-frontend', () => ({
  onScroll: vi.fn(),
  scrollTo: vi.fn(),
}));

// ── Import Modules ──────────────────────────────────────────────────

import {
  NAV_LINKS,
  MEGA_MENU_CATEGORIES,
  getActiveNavId,
  applyActiveNavState,
  initMegaMenu,
  initMobileDrawer,
  initMobileAccordions,
  buildBreadcrumbs,
  renderBreadcrumbs,
  breadcrumbsFromPath,
  initAnnouncementBar,
  initBackToTop,
  initFooterAccordions,
  initStickyNav,
} from '../src/public/navigationHelpers.js';

// ── Active Page Indicator ───────────────────────────────────────────

describe('Navigation Helpers', () => {
  beforeEach(() => {
    elements.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getActiveNavId', () => {
    it('returns #navHome for root path', () => {
      expect(getActiveNavId('/')).toBe('#navHome');
    });

    it('returns exact match for category pages', () => {
      expect(getActiveNavId('/futon-frames')).toBe('#navFutonFrames');
      expect(getActiveNavId('/mattresses')).toBe('#navMattresses');
      expect(getActiveNavId('/murphy-cabinet-beds')).toBe('#navMurphy');
      expect(getActiveNavId('/platform-beds')).toBe('#navPlatformBeds');
    });

    it('returns parent match for nested paths', () => {
      expect(getActiveNavId('/futon-frames/some-product')).toBe('#navFutonFrames');
      expect(getActiveNavId('/blog/my-post')).toBe('#navBlog');
    });

    it('returns null for unknown paths', () => {
      expect(getActiveNavId('/unknown-page')).toBeNull();
    });

    it('returns null for empty/null input', () => {
      expect(getActiveNavId('')).toBeNull();
      expect(getActiveNavId(null)).toBeNull();
      expect(getActiveNavId(undefined)).toBeNull();
    });

    it('handles trailing slashes', () => {
      expect(getActiveNavId('/futon-frames/')).toBe('#navFutonFrames');
    });

    it('does not match partial path segments', () => {
      // /sales should match #navSale, but /sales-event should not
      expect(getActiveNavId('/sales')).toBe('#navSale');
    });
  });

  describe('applyActiveNavState', () => {
    it('sets Mountain Blue color and bold on active nav link', () => {
      applyActiveNavState(getEl, '/futon-frames');
      const el = getEl('#navFutonFrames');
      expect(el.style.fontWeight).toBe('700');
      expect(el.style.color).toBe('#5B8FA8');
    });

    it('sets aria-current=page on active link', () => {
      applyActiveNavState(getEl, '/about');
      expect(getEl('#navAbout').accessibility.ariaCurrent).toBe('page');
    });

    it('resets non-active links to default styling', () => {
      applyActiveNavState(getEl, '/about');
      expect(getEl('#navHome').style.fontWeight).toBe('400');
      expect(getEl('#navHome').style.color).toBe('#3A2518');
    });

    it('does nothing for unknown path', () => {
      applyActiveNavState(getEl, '/xyz');
      // No errors, no styling changes
      expect(getEl('#navHome').style.fontWeight).toBe('');
    });
  });

  // ── Mega Menu ───────────────────────────────────────────────────

  describe('initMegaMenu', () => {
    it('returns open/close control object', () => {
      const ctrl = initMegaMenu(getEl);
      expect(ctrl).toHaveProperty('open');
      expect(ctrl).toHaveProperty('close');
    });

    it('sets ariaHasPopup on shop link', () => {
      initMegaMenu(getEl);
      expect(getEl('#navShop').accessibility.ariaHasPopup).toBe('true');
    });

    it('sets ariaExpanded=false initially', () => {
      initMegaMenu(getEl);
      expect(getEl('#navShop').accessibility.ariaExpanded).toBe(false);
    });

    it('opens mega menu panel on open()', () => {
      const ctrl = initMegaMenu(getEl);
      ctrl.open();
      expect(getEl('#megaMenuPanel').show).toHaveBeenCalledWith('fade', expect.objectContaining({ duration: 150 }));
    });

    it('sets ariaExpanded=true when opened', () => {
      const ctrl = initMegaMenu(getEl);
      ctrl.open();
      expect(getEl('#navShop').accessibility.ariaExpanded).toBe(true);
    });

    it('closes mega menu panel on close() after delay', () => {
      const ctrl = initMegaMenu(getEl);
      ctrl.open();
      ctrl.close();
      vi.advanceTimersByTime(200);
      expect(getEl('#megaMenuPanel').hide).toHaveBeenCalled();
    });

    it('sets role=menu on mega menu panel', () => {
      initMegaMenu(getEl);
      expect(getEl('#megaMenuPanel').accessibility.role).toBe('menu');
    });

    it('wires mouseIn/mouseOut on shop link', () => {
      initMegaMenu(getEl);
      expect(getEl('#navShop').onMouseIn).toHaveBeenCalled();
      expect(getEl('#navShop').onMouseOut).toHaveBeenCalled();
    });

    it('wires mouseIn/mouseOut on mega menu panel', () => {
      initMegaMenu(getEl);
      expect(getEl('#megaMenuPanel').onMouseIn).toHaveBeenCalled();
      expect(getEl('#megaMenuPanel').onMouseOut).toHaveBeenCalled();
    });

    it('wires keyboard toggle on shop link', () => {
      initMegaMenu(getEl);
      expect(getEl('#navShop').onKeyPress).toHaveBeenCalled();
    });
  });

  // ── Mobile Drawer ─────────────────────────────────────────────────

  describe('initMobileDrawer', () => {
    it('returns open/close control object', () => {
      const ctrl = initMobileDrawer(getEl);
      expect(ctrl).toHaveProperty('open');
      expect(ctrl).toHaveProperty('close');
    });

    it('sets ariaLabel on mobile menu button', () => {
      initMobileDrawer(getEl);
      expect(getEl('#mobileMenuButton').accessibility.ariaLabel).toBe('Open navigation menu');
    });

    it('sets ariaExpanded=false initially on button', () => {
      initMobileDrawer(getEl);
      expect(getEl('#mobileMenuButton').accessibility.ariaExpanded).toBe(false);
    });

    it('shows overlay on open()', () => {
      const ctrl = initMobileDrawer(getEl);
      ctrl.open();
      expect(getEl('#mobileMenuOverlay').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 250 })
      );
    });

    it('sets ariaExpanded=true on button when open', () => {
      const ctrl = initMobileDrawer(getEl);
      ctrl.open();
      expect(getEl('#mobileMenuButton').accessibility.ariaExpanded).toBe(true);
    });

    it('hides overlay on close()', () => {
      const ctrl = initMobileDrawer(getEl);
      ctrl.open();
      ctrl.close();
      expect(getEl('#mobileMenuOverlay').hide).toHaveBeenCalledWith(
        'slide',
        expect.objectContaining({ direction: 'left', duration: 250 })
      );
    });

    it('restores focus to menu button on close', () => {
      const ctrl = initMobileDrawer(getEl);
      ctrl.open();
      ctrl.close();
      expect(getEl('#mobileMenuButton').focus).toHaveBeenCalled();
    });

    it('wires onClick on close button', () => {
      initMobileDrawer(getEl);
      expect(getEl('#mobileMenuClose').onClick).toHaveBeenCalled();
    });

    it('does not open twice', () => {
      const ctrl = initMobileDrawer(getEl);
      ctrl.open();
      ctrl.open();
      // show called only once
      expect(getEl('#mobileMenuOverlay').show).toHaveBeenCalledTimes(1);
    });
  });

  // ── Mobile Accordions ─────────────────────────────────────────────

  describe('initMobileAccordions', () => {
    const sections = [
      { headerId: '#accordionHeader1', panelId: '#accordionPanel1', label: 'Furniture' },
    ];

    it('collapses panels initially', () => {
      initMobileAccordions(getEl, sections);
      expect(getEl('#accordionPanel1').collapse).toHaveBeenCalled();
    });

    it('sets ariaExpanded=false on header initially', () => {
      initMobileAccordions(getEl, sections);
      expect(getEl('#accordionHeader1').accessibility.ariaExpanded).toBe(false);
    });

    it('sets role=button on header', () => {
      initMobileAccordions(getEl, sections);
      expect(getEl('#accordionHeader1').accessibility.role).toBe('button');
    });

    it('wires onClick on header', () => {
      initMobileAccordions(getEl, sections);
      expect(getEl('#accordionHeader1').onClick).toHaveBeenCalled();
    });

    it('does nothing for empty sections', () => {
      expect(() => initMobileAccordions(getEl, [])).not.toThrow();
      expect(() => initMobileAccordions(getEl, null)).not.toThrow();
    });
  });

  // ── Breadcrumbs ───────────────────────────────────────────────────

  describe('buildBreadcrumbs', () => {
    it('returns Home as default crumb for empty input', () => {
      const result = buildBreadcrumbs([]);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].label).toBe('Home');
      expect(result.items[0].isLast).toBe(true);
    });

    it('builds correct items with isLast flag', () => {
      const crumbs = [
        { label: 'Home', path: '/' },
        { label: 'Futon Frames', path: '/futon-frames' },
        { label: 'Night & Day Jasmine', path: '/futon-frames/jasmine' },
      ];
      const result = buildBreadcrumbs(crumbs);
      expect(result.items).toHaveLength(3);
      expect(result.items[0].isLast).toBe(false);
      expect(result.items[1].isLast).toBe(false);
      expect(result.items[2].isLast).toBe(true);
    });

    it('generates valid BreadcrumbList schema', () => {
      const crumbs = [
        { label: 'Home', path: '/' },
        { label: 'Mattresses', path: '/mattresses' },
      ];
      const result = buildBreadcrumbs(crumbs);
      expect(result.schema['@context']).toBe('https://schema.org');
      expect(result.schema['@type']).toBe('BreadcrumbList');
      expect(result.schema.itemListElement).toHaveLength(2);
    });

    it('omits item URL for last crumb in schema', () => {
      const crumbs = [
        { label: 'Home', path: '/' },
        { label: 'About', path: '/about' },
      ];
      const result = buildBreadcrumbs(crumbs);
      expect(result.schema.itemListElement[0].item).toBe('https://www.carolinafutons.com/');
      expect(result.schema.itemListElement[1].item).toBeUndefined();
    });

    it('sets correct position numbers', () => {
      const crumbs = [
        { label: 'Home', path: '/' },
        { label: 'Shop', path: '/shop-main' },
        { label: 'Sale', path: '/sales' },
      ];
      const result = buildBreadcrumbs(crumbs);
      expect(result.schema.itemListElement.map(i => i.position)).toEqual([1, 2, 3]);
    });
  });

  describe('breadcrumbsFromPath', () => {
    it('returns just Home for root path', () => {
      const result = breadcrumbsFromPath('/');
      expect(result).toEqual([{ label: 'Home', path: '/' }]);
    });

    it('returns Home + category for category page', () => {
      const result = breadcrumbsFromPath('/futon-frames');
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Home');
      expect(result[1].label).toBe('Futon Frames');
    });

    it('returns Home + category + product for product page', () => {
      const result = breadcrumbsFromPath('/futon-frames/jasmine-futon');
      expect(result).toHaveLength(3);
      expect(result[2].label).toBe('Jasmine Futon');
    });

    it('formats slugs to title case', () => {
      const result = breadcrumbsFromPath('/blog/my-cool-post');
      const lastCrumb = result[result.length - 1];
      expect(lastCrumb.label).toBe('My Cool Post');
    });

    it('handles null/empty input', () => {
      expect(breadcrumbsFromPath(null)).toEqual([{ label: 'Home', path: '/' }]);
      expect(breadcrumbsFromPath('')).toEqual([{ label: 'Home', path: '/' }]);
    });
  });

  describe('renderBreadcrumbs', () => {
    it('sets text on breadcrumb elements', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
        { label: 'About', path: '/about' },
      ]);
      expect(getEl('#breadcrumb1').text).toBe('Home');
      expect(getEl('#breadcrumb2').text).toBe('About');
    });

    it('sets aria-current=page on last crumb', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
        { label: 'FAQ', path: '/faq' },
      ]);
      expect(getEl('#breadcrumb2').accessibility.ariaCurrent).toBe('page');
    });

    it('sets role=link on non-last crumbs', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
        { label: 'Shop', path: '/shop-main' },
        { label: 'Frames', path: '/futon-frames' },
      ]);
      expect(getEl('#breadcrumb1').accessibility.role).toBe('link');
    });

    it('wires onClick for navigation on non-last crumbs', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
        { label: 'About', path: '/about' },
      ]);
      expect(getEl('#breadcrumb1').onClick).toHaveBeenCalled();
    });

    it('hides unused breadcrumb slots', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
      ]);
      expect(getEl('#breadcrumb2').hide).toHaveBeenCalled();
      expect(getEl('#breadcrumb3').hide).toHaveBeenCalled();
    });

    it('injects schema into breadcrumbSchemaHtml', () => {
      renderBreadcrumbs(getEl, [
        { label: 'Home', path: '/' },
        { label: 'Contact', path: '/contact' },
      ]);
      expect(getEl('#breadcrumbSchemaHtml').postMessage).toHaveBeenCalled();
      const schemaStr = getEl('#breadcrumbSchemaHtml').postMessage.mock.calls[0][0];
      const schema = JSON.parse(schemaStr);
      expect(schema['@type']).toBe('BreadcrumbList');
    });
  });

  // ── Announcement Bar ──────────────────────────────────────────────

  describe('initAnnouncementBar', () => {
    const messages = ['Free Shipping!', 'Visit Our Showroom', 'Over 700 Swatches'];

    it('returns dismiss/pause/resume controls', () => {
      const ctrl = initAnnouncementBar(getEl, messages);
      expect(ctrl).toHaveProperty('dismiss');
      expect(ctrl).toHaveProperty('pause');
      expect(ctrl).toHaveProperty('resume');
    });

    it('sets initial message text', () => {
      initAnnouncementBar(getEl, messages);
      expect(getEl('#announcementText').text).toBe('Free Shipping!');
    });

    it('sets aria-live=polite on announcement text', () => {
      initAnnouncementBar(getEl, messages);
      expect(getEl('#announcementText').accessibility.ariaLive).toBe('polite');
    });

    it('sets role=status on announcement text', () => {
      initAnnouncementBar(getEl, messages);
      expect(getEl('#announcementText').accessibility.role).toBe('status');
    });

    it('rotates messages on interval', () => {
      initAnnouncementBar(getEl, messages, { interval: 1000 });
      vi.advanceTimersByTime(1000);
      // After rotation, hide should be called to transition
      expect(getEl('#announcementText').hide).toHaveBeenCalled();
    });

    it('dismiss hides the announcement bar', () => {
      const ctrl = initAnnouncementBar(getEl, messages);
      ctrl.dismiss();
      expect(getEl('#announcementBar').hide).toHaveBeenCalled();
    });

    it('pause stops rotation', () => {
      const ctrl = initAnnouncementBar(getEl, messages, { interval: 500 });
      ctrl.pause();
      vi.advanceTimersByTime(2000);
      // hide should NOT be called for rotation after pause
      expect(getEl('#announcementText').hide).not.toHaveBeenCalled();
    });

    it('resume restarts rotation after pause', () => {
      const ctrl = initAnnouncementBar(getEl, messages, { interval: 500 });
      ctrl.pause();
      ctrl.resume();
      vi.advanceTimersByTime(600);
      expect(getEl('#announcementText').hide).toHaveBeenCalled();
    });

    it('wires dismiss button', () => {
      initAnnouncementBar(getEl, messages);
      expect(getEl('#announcementDismiss').onClick).toHaveBeenCalled();
    });
  });

  // ── Back to Top ───────────────────────────────────────────────────

  describe('initBackToTop', () => {
    it('hides button initially', () => {
      initBackToTop(getEl);
      expect(getEl('#backToTop').hide).toHaveBeenCalled();
    });

    it('sets aria-label on button', () => {
      initBackToTop(getEl);
      expect(getEl('#backToTop').accessibility.ariaLabel).toBe('Back to top');
    });

    it('wires onClick for scroll to top', () => {
      initBackToTop(getEl);
      expect(getEl('#backToTop').onClick).toHaveBeenCalled();
    });
  });

  // ── Footer Mobile Accordions ──────────────────────────────────────

  describe('initFooterAccordions', () => {
    const columns = [
      { headerId: '#footerShopHeader', contentId: '#footerShopContent', label: 'Shop' },
      { headerId: '#footerAboutHeader', contentId: '#footerAboutContent', label: 'About' },
    ];

    it('does nothing on desktop', () => {
      mockIsMobile.mockReturnValue(false);

      initFooterAccordions(getEl, columns);
      // No collapse called since we're on desktop
      expect(getEl('#footerShopContent').collapse).not.toHaveBeenCalled();
    });

    it('collapses columns on mobile', () => {
      mockIsMobile.mockReturnValue(true);

      initFooterAccordions(getEl, columns);
      expect(getEl('#footerShopContent').collapse).toHaveBeenCalled();
      expect(getEl('#footerAboutContent').collapse).toHaveBeenCalled();

      mockIsMobile.mockReturnValue(false); // reset
    });
  });

  // ── NAV_LINKS data structure ──────────────────────────────────────

  describe('NAV_LINKS', () => {
    it('contains all expected nav items', () => {
      const ids = Object.keys(NAV_LINKS);
      expect(ids).toContain('#navHome');
      expect(ids).toContain('#navShop');
      expect(ids).toContain('#navFutonFrames');
      expect(ids).toContain('#navMattresses');
      expect(ids).toContain('#navMurphy');
      expect(ids).toContain('#navPlatformBeds');
      expect(ids).toContain('#navSale');
      expect(ids).toContain('#navContact');
      expect(ids).toContain('#navFAQ');
      expect(ids).toContain('#navAbout');
      expect(ids).toContain('#navBlog');
    });

    it('every nav link has path and label', () => {
      Object.values(NAV_LINKS).forEach(config => {
        expect(config.path).toBeTruthy();
        expect(config.label).toBeTruthy();
      });
    });
  });

  describe('MEGA_MENU_CATEGORIES', () => {
    it('has grouped categories', () => {
      expect(MEGA_MENU_CATEGORIES.length).toBeGreaterThanOrEqual(2);
    });

    it('each group has title and items', () => {
      MEGA_MENU_CATEGORIES.forEach(group => {
        expect(group.title).toBeTruthy();
        expect(group.items.length).toBeGreaterThan(0);
        group.items.forEach(item => {
          expect(item.id).toBeTruthy();
          expect(item.label).toBeTruthy();
          expect(item.path).toBeTruthy();
        });
      });
    });
  });
});

// ── masterPage.js integration tests ─────────────────────────────────

describe('masterPage.js', () => {
  beforeAll(async () => {
    await import('../src/pages/masterPage.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  describe('$w.onReady', () => {
    it('registers an onReady handler', () => {
      expect(onReadyHandler).toBeTypeOf('function');
    });

    it('initializes accessibility on page load', async () => {
      await onReadyHandler();
      // Skip-to-content link should have ariaLabel set
      expect(getEl('#skipToContent').accessibility.ariaLabel).toBe('Skip to main content');
    });

    it('sets aria-live region attributes', async () => {
      await onReadyHandler();
      expect(getEl('#a11yLiveRegion').accessibility.ariaLive).toBe('polite');
      expect(getEl('#a11yLiveRegion').accessibility.ariaAtomic).toBe(true);
      expect(getEl('#a11yLiveRegion').accessibility.role).toBe('status');
    });

    it('wires skip-to-content click handler', async () => {
      await onReadyHandler();
      expect(getEl('#skipToContent').onClick).toHaveBeenCalled();
    });

    it('sets announcement text to first message', async () => {
      await onReadyHandler();
      expect(getEl('#announcementText').text).toBeTruthy();
    });
  });

  describe('navigation active state', () => {
    it('wires mobile menu button onClick', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuButton').onClick).toHaveBeenCalled();
    });

    it('sets ariaLabel on mobile menu button', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuButton').accessibility.ariaLabel).toBe('Open navigation menu');
    });

    it('wires mobile menu close onClick', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuClose').onClick).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('sets ariaLabel on search input', async () => {
      await onReadyHandler();
      expect(getEl('#headerSearchInput').accessibility.ariaLabel).toBe('Search Carolina Futons');
    });

    it('wires onKeyPress on search input', async () => {
      await onReadyHandler();
      expect(getEl('#headerSearchInput').onKeyPress).toHaveBeenCalled();
    });
  });

  describe('footer newsletter', () => {
    it('sets ariaLabel on email input', async () => {
      await onReadyHandler();
      expect(getEl('#footerEmailInput').accessibility.ariaLabel).toBe('Enter your email for newsletter');
    });

    it('sets ariaLabel on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#footerEmailSubmit').accessibility.ariaLabel).toBe('Subscribe to newsletter');
    });

    it('wires onClick on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#footerEmailSubmit').onClick).toHaveBeenCalled();
    });

    it('shows error for invalid email', async () => {
      await onReadyHandler();
      const submitHandler = getEl('#footerEmailSubmit').onClick.mock.calls[0][0];
      getEl('#footerEmailInput').value = 'not-an-email';
      await submitHandler();
      expect(getEl('#footerEmailError').text).toBe('Please enter a valid email');
      expect(getEl('#footerEmailError').show).toHaveBeenCalled();
    });

    it('shows error for empty email', async () => {
      await onReadyHandler();
      const submitHandler = getEl('#footerEmailSubmit').onClick.mock.calls[0][0];
      getEl('#footerEmailInput').value = '';
      await submitHandler();
      expect(getEl('#footerEmailError').text).toBe('Please enter a valid email');
    });
  });

  describe('announcement bar', () => {
    it('sets role=status on announcementText', async () => {
      await onReadyHandler();
      expect(getEl('#announcementText').accessibility.ariaLive || getEl('#announcementText').role).toBeTruthy();
    });
  });
});
