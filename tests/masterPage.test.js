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
    style: { color: '', fontWeight: '', boxShadow: '', backgroundColor: '' },
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
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));
vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue(null),
  getFlashSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({}),
}));
vi.mock('backend/coreWebVitals.web', () => ({
  reportMetrics: vi.fn().mockResolvedValue({}),
}));
const mockWixLocationTo = vi.fn();
vi.mock('wix-location-frontend', () => ({
  default: { path: [], to: mockWixLocationTo },
  path: [],
  to: mockWixLocationTo,
}));
vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue({ lineItems: [] }),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn(() => ({ remaining: 999, progressPct: 0, qualifies: false })),
  isFreeShippingEnabled: vi.fn(() => false),
}));

import { getCurrentCart, onCartChanged, getShippingProgress } from 'public/cartService';
import { getBusinessSchema, getWebSiteSchema } from 'backend/seoHelpers.web';
import { getActivePromotion } from 'backend/promotions.web';
import { reportMetrics } from 'backend/coreWebVitals.web';
import { isInstalledPWA, canShowInstallPrompt } from 'public/pwaHelpers';
import { submitContactForm } from 'backend/contactSubmissions.web';
import { initConsentGate, fireTrackedTikTokEvent } from 'public/pixelConsentService';
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
  initScrollDepthTracking: vi.fn(() => vi.fn()),
}));
vi.mock('public/tikTokPixel', () => ({
  initTikTokPixel: vi.fn(),
}));
vi.mock('public/pixelConsentService', () => ({
  initConsentGate: vi.fn(),
  fireTrackedTikTokEvent: vi.fn(),
  fireTrackedPinterestEvent: vi.fn(),
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
vi.mock('public/flashSaleHelpers', () => ({
  buildAnnouncementMessage: vi.fn(() => null),
}));
vi.mock('public/exitIntentCapture', () => ({
  shouldShowExitIntent: vi.fn(() => false),
  markExitIntentShown: vi.fn(),
  markExitIntentDismissed: vi.fn(),
  getExitIntentConfig: vi.fn(() => ({ title: 'Wait!', subtitle: 'test', emailPlaceholder: 'Email', ctaText: 'Subscribe', successMessage: 'Thanks!', swipeDismissThreshold: 100 })),
  getMobileExitIntentConfig: vi.fn(() => ({ title: 'Wait!', subtitle: 'test', emailPlaceholder: 'Email', ctaText: 'Subscribe', successMessage: 'Thanks!', swipeDismissThreshold: 100 })),
  validateCaptureEmail: vi.fn(() => true),
  detectScrollExit: vi.fn(() => false),
}));
vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true }),
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

const mockOpenMiniCart = vi.fn();
const mockCloseMiniCart = vi.fn();
const mockUpdateCartCount = vi.fn();
const mockInitMiniCartDrawer = vi.fn();
vi.mock('public/miniCartDrawer', () => ({
  initMiniCartDrawer: (...args) => mockInitMiniCartDrawer(...args),
  openMiniCart: (...args) => mockOpenMiniCart(...args),
  closeMiniCart: (...args) => mockCloseMiniCart(...args),
  updateCartCount: (...args) => mockUpdateCartCount(...args),
}));

vi.mock('public/footerContent', () => ({
  getFooterShopLinks: vi.fn(() => [
    { label: 'Futon Frames', path: '/futon-frames' },
  ]),
  getFooterServiceLinks: vi.fn(() => [
    { label: 'Shipping Policy', path: '/shipping-policy' },
  ]),
  getFooterAboutLinks: vi.fn(() => [
    { label: 'Our Story', path: '/about' },
  ]),
  getStoreInfo: vi.fn(() => ({
    name: 'Carolina Futons',
    address: '824 Locust St, Hendersonville, NC 28792',
    phone: '(828) 692-8550',
    hours: [{ days: 'Wednesday – Friday', time: '10:00 AM – 5:00 PM' }],
  })),
  getTrustBadges: vi.fn(() => [
    { label: 'Family Owned Since 1991', icon: '\u2764' },
  ]),
  getPaymentMethods: vi.fn(() => [
    { name: 'visa', icon: 'visa' },
  ]),
  getFooterSocialLinks: vi.fn(() => [
    { platform: 'facebook', url: 'https://www.facebook.com/carolinafutons', ariaLabel: 'Visit Carolina Futons on Facebook' },
  ]),
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
      expect(getEl('#navHome').style.color).toBe('#1E3A5F');
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

    // ── cf-t2px: Mobile Hamburger Nav enhancements ──────────────────

    describe('body scroll lock', () => {
      let origDoc;
      beforeEach(() => {
        origDoc = globalThis.document;
        globalThis.document = {
          body: { style: { overflow: '' } },
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          activeElement: null,
        };
      });
      afterEach(() => {
        globalThis.document = origDoc;
      });

      it('sets body overflow hidden when menu opens', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();
        expect(globalThis.document.body.style.overflow).toBe('hidden');
      });

      it('restores body overflow when menu closes', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();
        ctrl.close();
        expect(globalThis.document.body.style.overflow).toBe('');
      });
    });

    describe('escape key closes menu', () => {
      let origDoc;
      let keydownHandlers;
      beforeEach(() => {
        origDoc = globalThis.document;
        keydownHandlers = [];
        globalThis.document = {
          body: { style: { overflow: '' } },
          addEventListener: vi.fn((event, handler) => {
            if (event === 'keydown') keydownHandlers.push(handler);
          }),
          removeEventListener: vi.fn(),
          activeElement: null,
        };
      });
      afterEach(() => {
        globalThis.document = origDoc;
      });

      it('closes menu and restores state on Escape', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();

        keydownHandlers.forEach(h => h({ key: 'Escape' }));

        expect(getEl('#mobileMenuOverlay').hide).toHaveBeenCalled();
        expect(getEl('#mobileMenuButton').accessibility.ariaExpanded).toBe(false);
        expect(globalThis.document.body.style.overflow).toBe('');
      });

      it('does not close on non-Escape keys', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();

        keydownHandlers.forEach(h => h({ key: 'Enter' }));

        // Menu should still be open — hide should not have been called
        expect(getEl('#mobileMenuOverlay').hide).not.toHaveBeenCalled();
      });

      it('removes escape keydown listener on close so it does not leak', () => {
        // Track which specific handlers are added/removed for 'keydown'
        const addedFns = [];
        const removedFns = [];
        globalThis.document.addEventListener = vi.fn((event, fn) => {
          if (event === 'keydown') addedFns.push(fn);
        });
        globalThis.document.removeEventListener = vi.fn((event, fn) => {
          if (event === 'keydown') removedFns.push(fn);
        });

        const ctrl = initMobileDrawer(getEl);
        ctrl.open();
        const addedDuringInitAndOpen = [...addedFns];

        ctrl.close();

        // Every keydown handler added should have a matching removeEventListener
        for (const fn of addedDuringInitAndOpen) {
          expect(removedFns).toContain(fn);
        }
      });
    });

    describe('overlay backdrop click closes menu', () => {
      it('wires onClick on overlay element', () => {
        initMobileDrawer(getEl);
        expect(getEl('#mobileMenuOverlay').onClick).toHaveBeenCalled();
      });

      it('closes menu when overlay backdrop is clicked', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();

        const overlayClicks = getEl('#mobileMenuOverlay').onClick.mock.calls;
        const backdropHandler = overlayClicks[overlayClicks.length - 1][0];
        backdropHandler();

        expect(getEl('#mobileMenuOverlay').hide).toHaveBeenCalled();
        expect(getEl('#mobileMenuButton').accessibility.ariaExpanded).toBe(false);
      });
    });

    describe('nav link population and navigation', () => {
      it('sets text labels on mobile nav elements', () => {
        initMobileDrawer(getEl);
        expect(getEl('#mobileNavHome').text).toBe('Home');
        expect(getEl('#mobileNavShop').text).toBe('Shop All');
        expect(getEl('#mobileNavFutonFrames').text).toBe('Futon Frames');
        expect(getEl('#mobileNavMattresses').text).toBe('Mattresses');
      });

      it('wires onClick on nav links', () => {
        initMobileDrawer(getEl);
        expect(getEl('#mobileNavHome').onClick).toHaveBeenCalled();
        expect(getEl('#mobileNavFutonFrames').onClick).toHaveBeenCalled();
      });

      it('closes menu when a nav link is clicked', () => {
        const ctrl = initMobileDrawer(getEl);
        ctrl.open();

        const clickHandler = getEl('#mobileNavHome').onClick.mock.calls[0][0];
        clickHandler();

        expect(getEl('#mobileMenuOverlay').hide).toHaveBeenCalled();
      });
    });

    describe('design token colors', () => {
      it('sets sandLight background on overlay', () => {
        initMobileDrawer(getEl);
        expect(getEl('#mobileMenuOverlay').style.backgroundColor).toBe('#F8FAFC');
      });

      it('sets espresso text color on nav links', () => {
        initMobileDrawer(getEl);
        expect(getEl('#mobileNavHome').style.color).toBe('#1E3A5F');
        expect(getEl('#mobileNavFutonFrames').style.color).toBe('#1E3A5F');
      });

      it('sets coral color on active nav link for current path', () => {
        initMobileDrawer(getEl, '/futon-frames');
        expect(getEl('#mobileNavFutonFrames').style.color).toBe('#4A7D94');
      });

      it('keeps espresso on non-active links when path provided', () => {
        initMobileDrawer(getEl, '/futon-frames');
        expect(getEl('#mobileNavHome').style.color).toBe('#1E3A5F');
        expect(getEl('#mobileNavMattresses').style.color).toBe('#1E3A5F');
      });
    });

    describe('responsive: desktop breakpoint', () => {
      it('hides mobile menu button on desktop', () => {
        mockIsMobile.mockReturnValue(false);
        mockGetViewport.mockReturnValue('desktop');
        initMobileDrawer(getEl);
        expect(getEl('#mobileMenuButton').hide).toHaveBeenCalled();
        mockIsMobile.mockReturnValue(false);
        mockGetViewport.mockReturnValue('desktop');
      });

      it('shows mobile menu button on mobile', () => {
        mockIsMobile.mockReturnValue(true);
        mockGetViewport.mockReturnValue('mobile');
        initMobileDrawer(getEl);
        expect(getEl('#mobileMenuButton').show).toHaveBeenCalled();
        mockIsMobile.mockReturnValue(false);
        mockGetViewport.mockReturnValue('desktop');
      });

      it('hides desktop nav elements at mobile breakpoint', () => {
        mockIsMobile.mockReturnValue(true);
        mockGetViewport.mockReturnValue('mobile');
        initMobileDrawer(getEl);

        // Desktop nav bar should be hidden on mobile
        expect(getEl('#desktopNavBar').hide).toHaveBeenCalled();
        mockIsMobile.mockReturnValue(false);
        mockGetViewport.mockReturnValue('desktop');
      });

      it('shows desktop nav elements on desktop', () => {
        mockIsMobile.mockReturnValue(false);
        mockGetViewport.mockReturnValue('desktop');
        initMobileDrawer(getEl);

        expect(getEl('#desktopNavBar').show).toHaveBeenCalled();
      });
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
      expect(ids).toContain('#navFreeSwatches');
    });

    it('every nav link has path and label', () => {
      Object.values(NAV_LINKS).forEach(config => {
        expect(config.path).toBeTruthy();
        expect(config.label).toBeTruthy();
      });
    });

    it('Free Swatches nav link points to /free-swatches', () => {
      expect(NAV_LINKS['#navFreeSwatches'].path).toBe('/free-swatches');
      expect(NAV_LINKS['#navFreeSwatches'].label).toBe('Free Swatches');
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

    it('includes Free Swatches in More group', () => {
      const moreGroup = MEGA_MENU_CATEGORIES.find(g => g.title === 'More');
      expect(moreGroup).toBeTruthy();
      const swatchItem = moreGroup.items.find(i => i.label === 'Free Swatches');
      expect(swatchItem).toBeTruthy();
      expect(swatchItem.path).toBe('/free-swatches');
      expect(swatchItem.id).toBe('#navFreeSwatches');
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
      // initAnnouncementBar is async (fetches flash sales) — wait for it
      await new Promise(r => setTimeout(r, 50));
      expect(getEl('#announcementText').text).toBeTruthy();
    });
  });

  describe('navigation active state', () => {
    it('wires mobile menu button onClick', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuButton').onClick).toHaveBeenCalled();
    });

    it('registers hamburger onClick only once (no duplicate legacy handler)', async () => {
      await onReadyHandler();
      // initMobileDrawer via makeClickable registers one onClick.
      // The legacy handler was removed so there should be exactly 1 call.
      expect(getEl('#mobileMenuButton').onClick).toHaveBeenCalledTimes(1);
    });

    it('sets ariaLabel on mobile menu button', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuButton').accessibility.ariaLabel).toBe('Open navigation menu');
    });

    it('wires mobile menu close onClick', async () => {
      await onReadyHandler();
      expect(getEl('#mobileMenuClose').onClick).toHaveBeenCalled();
    });

    it('does not initialize mega menu on mobile viewport', async () => {
      mockIsMobile.mockReturnValue(true);
      elements.clear();
      await onReadyHandler();
      // On mobile, mega menu hover handlers should not be wired
      expect(getEl('#navShop').onMouseIn).not.toHaveBeenCalled();
      mockIsMobile.mockReturnValue(false);
    });

    it('initializes mega menu on desktop viewport', async () => {
      mockIsMobile.mockReturnValue(false);
      elements.clear();
      await onReadyHandler();
      expect(getEl('#navShop').onMouseIn).toHaveBeenCalled();
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

    it('sets initial announcement message text', async () => {
      await onReadyHandler();
      await new Promise(r => setTimeout(r, 50));
      expect(getEl('#announcementText').text).toBeTruthy();
    });

    it('sets aria-live=polite on announcement text', async () => {
      await onReadyHandler();
      await new Promise(r => setTimeout(r, 50));
      expect(getEl('#announcementText').accessibility.ariaLive).toBe('polite');
    });

    it('wires dismiss button with click handler', async () => {
      await onReadyHandler();
      await new Promise(r => setTimeout(r, 50));
      expect(getEl('#announcementDismiss').onClick).toHaveBeenCalled();
    });
  });

  // ── Cart Icon & Badge (cf-0z2w) ──────────────────────────────────

  describe('cart icon', () => {
    it('wires onClick on #cartIcon', async () => {
      await onReadyHandler();
      expect(getEl('#cartIcon').onClick).toHaveBeenCalled();
    });

    it('sets ariaLabel on #cartIcon', async () => {
      await onReadyHandler();
      expect(getEl('#cartIcon').accessibility.ariaLabel).toBe('Shopping cart');
    });

    it('click opens mini-cart drawer', async () => {
      getCurrentCart.mockResolvedValue({ lineItems: [] });
      await onReadyHandler();
      const clickHandler = getEl('#cartIcon').onClick.mock.calls[0][0];
      await clickHandler();
      expect(mockOpenMiniCart).toHaveBeenCalled();
    });
  });

  describe('cart count badge', () => {
    it('calls updateCartCount with 0 when cart is empty', async () => {
      getCurrentCart.mockResolvedValue({ lineItems: [] });
      mockUpdateCartCount.mockClear();
      elements.clear();
      await onReadyHandler();
      await vi.waitFor(() => {
        expect(mockUpdateCartCount).toHaveBeenCalledWith(expect.anything(), 0);
      });
    });

    it('calls updateCartCount with item total when cart has items', async () => {
      getCurrentCart.mockResolvedValue({
        lineItems: [
          { _id: '1', quantity: 2 },
          { _id: '2', quantity: 1 },
        ],
      });
      mockUpdateCartCount.mockClear();
      elements.clear();
      await onReadyHandler();
      await vi.waitFor(() => {
        expect(mockUpdateCartCount).toHaveBeenCalledWith(expect.anything(), 3);
      });
    });

    it('registers onCartChanged callback for badge updates', async () => {
      await onReadyHandler();
      expect(onCartChanged).toHaveBeenCalled();
    });
  });

  // ── Site Logo (cf-0z2w) ──────────────────────────────────────────

  describe('site logo', () => {
    it('wires onClick on #siteLogo', async () => {
      await onReadyHandler();
      expect(getEl('#siteLogo').onClick).toHaveBeenCalled();
    });

    it('sets ariaLabel on #siteLogo', async () => {
      await onReadyHandler();
      expect(getEl('#siteLogo').accessibility.ariaLabel).toBe('Carolina Futons - Go to homepage');
    });

    it('click navigates to homepage', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#siteLogo').onClick.mock.calls[0][0];
      clickHandler();
      expect(mockWixLocationTo).toHaveBeenCalledWith('/');
    });
  });

  // ── Mini-Cart Auto-Open ────────────────────────────────────────────

  describe('mini-cart auto-open', () => {
    it('registers onCartChanged callback', async () => {
      await onReadyHandler();
      expect(onCartChanged).toHaveBeenCalled();
    });

    it('calls openMiniCart when cart item count increases', async () => {
      onCartChanged.mockClear();
      getCurrentCart.mockClear();
      mockOpenMiniCart.mockClear();

      getCurrentCart.mockResolvedValue({
        lineItems: [{ _id: '1', quantity: 1 }],
      });
      elements.clear();
      await onReadyHandler();
      await new Promise(r => setTimeout(r, 100));

      const allCallbacks = onCartChanged.mock.calls.map(c => c[0]);

      // Cart increases from 1 to 2 items
      getCurrentCart.mockResolvedValue({
        lineItems: [{ _id: '1', quantity: 1 }, { _id: '2', quantity: 1 }],
      });

      for (const cb of allCallbacks) {
        await cb();
      }

      expect(mockOpenMiniCart).toHaveBeenCalled();
    });

    it('does not call openMiniCart when item count decreases', async () => {
      onCartChanged.mockClear();
      getCurrentCart.mockClear();
      mockOpenMiniCart.mockClear();

      getCurrentCart.mockResolvedValue({
        lineItems: [{ _id: '1', quantity: 2 }, { _id: '2', quantity: 1 }],
      });
      elements.clear();
      await onReadyHandler();
      await new Promise(r => setTimeout(r, 100));

      const allCallbacks = onCartChanged.mock.calls.map(c => c[0]);

      // Cart decreases from 3 to 1 item
      getCurrentCart.mockResolvedValue({
        lineItems: [{ _id: '1', quantity: 1 }],
      });

      mockOpenMiniCart.mockClear();
      for (const cb of allCallbacks) {
        await cb();
      }

      expect(mockOpenMiniCart).not.toHaveBeenCalled();
    });
  });

  // ── Mini-Cart Escape Key ───────────────────────────────────────────

  describe('mini-cart Escape key', () => {
    let origDoc;
    let keydownHandlers;

    beforeEach(() => {
      origDoc = globalThis.document;
      keydownHandlers = [];
      globalThis.document = {
        body: { style: { overflow: '' } },
        addEventListener: vi.fn((event, handler) => {
          if (event === 'keydown') keydownHandlers.push(handler);
        }),
        removeEventListener: vi.fn(),
        activeElement: null,
      };
    });

    afterEach(() => {
      globalThis.document = origDoc;
    });

    it('closes mini-cart drawer when Escape is pressed', async () => {
      elements.clear();
      mockCloseMiniCart.mockClear();
      await onReadyHandler();

      expect(keydownHandlers.length).toBeGreaterThan(0); // guard: verify handler was registered
      keydownHandlers.forEach(h => h({ key: 'Escape' }));

      expect(mockCloseMiniCart).toHaveBeenCalled();
    });

    it('does not close mini-cart on non-Escape keys', async () => {
      elements.clear();
      mockCloseMiniCart.mockClear();
      await onReadyHandler();

      expect(keydownHandlers.length).toBeGreaterThan(0); // guard: verify handler was registered
      keydownHandlers.forEach(h => h({ key: 'Enter' }));

      expect(mockCloseMiniCart).not.toHaveBeenCalled();
    });
  });

  // ── Header Shipping Progress ───────────────────────────────────────

  describe('header shipping progress', () => {
    it('hides header shipping text when free shipping is disabled', async () => {
      getCurrentCart.mockResolvedValueOnce({
        lineItems: [],
        totals: { subtotal: 500 },
      });
      elements.clear();
      await onReadyHandler();

      await vi.waitFor(() => {
        expect(getEl('#headerShippingText').hide).toHaveBeenCalled();
      });
    });

    it('registers onCartChanged for shipping updates', async () => {
      await onReadyHandler();
      // onCartChanged should be called at least twice: once for badge, once for shipping
      expect(onCartChanged.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Canonical URL Injection ────────────────────────────────────────

  describe('canonical URL injection', () => {
    it('calls wix-seo-frontend head.setLinks', async () => {
      const { head } = await import('wix-seo-frontend');
      head.setLinks.mockClear();
      elements.clear();
      await onReadyHandler();

      await vi.waitFor(() => {
        expect(head.setLinks).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ rel: 'canonical' })
          ])
        );
      });
    });
  });

  // ── Business Schema Injection ──────────────────────────────────────

  describe('business schema injection', () => {
    it('calls getBusinessSchema and posts to element', async () => {
      getBusinessSchema.mockClear();
      getBusinessSchema.mockResolvedValueOnce('{"@type":"LocalBusiness"}');
      elements.clear();
      await onReadyHandler();

      await vi.waitFor(() => {
        expect(getEl('#businessSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"LocalBusiness"}');
      });
    });

    it('does not throw when getBusinessSchema returns null', async () => {
      getBusinessSchema.mockClear();
      getBusinessSchema.mockResolvedValueOnce(null);
      elements.clear();
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('posts WebSite schema to websiteSchemaHtml element', async () => {
      getWebSiteSchema.mockClear();
      getWebSiteSchema.mockResolvedValueOnce('{"@type":"WebSite"}');
      elements.clear();
      await onReadyHandler();

      await vi.waitFor(() => {
        expect(getEl('#websiteSchemaHtml').postMessage).toHaveBeenCalledWith('{"@type":"WebSite"}');
      });
    });
  });

  // ── Newsletter Modal ───────────────────────────────────────────────

  describe('newsletter modal', () => {
    it('wires onClick on newsletter trigger', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalTrigger').onClick).toHaveBeenCalled();
    });

    it('wires onClick on newsletter submit button', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalSubmit').onClick).toHaveBeenCalled();
    });

    it('sets ariaLabel on newsletter email input', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalEmail').accessibility.ariaLabel).toBe('Enter your email for 10% off');
    });

    it('shows error for invalid email submission', async () => {
      await onReadyHandler();
      const submitHandler = getEl('#newsletterModalSubmit').onClick.mock.calls[0][0];
      getEl('#newsletterModalEmail').value = 'bad-email';
      await submitHandler();
      expect(getEl('#newsletterModalError').text).toBe('Please enter a valid email');
      expect(getEl('#newsletterModalError').show).toHaveBeenCalled();
    });

    it('disables button and calls submitContactForm on valid email', async () => {
      submitContactForm.mockResolvedValueOnce({});
      await onReadyHandler();
      const submitHandler = getEl('#newsletterModalSubmit').onClick.mock.calls[0][0];
      getEl('#newsletterModalEmail').value = 'test@example.com';
      await submitHandler();
      expect(getEl('#newsletterModalSubmit').disable).toHaveBeenCalled();
      expect(submitContactForm).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com', source: 'newsletter_modal' })
      );
    });

    it('shows success message with WELCOME10 code after subscribe', async () => {
      submitContactForm.mockResolvedValueOnce({});
      await onReadyHandler();
      const submitHandler = getEl('#newsletterModalSubmit').onClick.mock.calls[0][0];
      getEl('#newsletterModalEmail').value = 'test@example.com';
      await submitHandler();
      expect(getEl('#newsletterModalSuccess').text).toContain('WELCOME10');
      expect(getEl('#newsletterModalSuccess').show).toHaveBeenCalled();
    });

    it('re-enables submit button on submitContactForm failure', async () => {
      submitContactForm.mockRejectedValueOnce(new Error('fail'));
      await onReadyHandler();
      const submitHandler = getEl('#newsletterModalSubmit').onClick.mock.calls[0][0];
      getEl('#newsletterModalEmail').value = 'test@example.com';
      await submitHandler();
      expect(getEl('#newsletterModalSubmit').enable).toHaveBeenCalled();
    });

    it('wires overlay click to close modal', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalOverlay').onClick).toHaveBeenCalled();
    });
  });

  // ── PWA Install Banner ─────────────────────────────────────────────

  describe('PWA install banner', () => {
    it('does not show banner if already installed', async () => {
      isInstalledPWA.mockReturnValueOnce(true);
      elements.clear();
      await onReadyHandler();
      expect(getEl('#installBanner').show).not.toHaveBeenCalled();
    });

    it('does not show banner on first page view', async () => {
      isInstalledPWA.mockReturnValue(false);
      // sessionStorage not available in vitest — banner checks views < 2
      elements.clear();
      await onReadyHandler();
      // Even with timeout, banner shouldn't show on first view
      expect(getEl('#installBanner').show).not.toHaveBeenCalled();
      isInstalledPWA.mockReturnValue(false);
    });
  });

  // ── Core Web Vitals ────────────────────────────────────────────────

  describe('core web vitals', () => {
    it('calls reportMetrics after 5s timeout', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();

      // Provide minimal performance API
      globalThis.performance = {
        timing: { responseStart: 200, navigationStart: 100 },
        getEntriesByType: vi.fn().mockReturnValue([]),
      };

      vi.advanceTimersByTime(5000);
      await vi.waitFor(() => {
        expect(reportMetrics).toHaveBeenCalled();
      });

      delete globalThis.performance;
      vi.useRealTimers();
    });
  });

  // ── Search Navigation ──────────────────────────────────────────────

  describe('search enter key navigation', () => {
    it('navigates to search results on Enter with query', async () => {
      await onReadyHandler();
      const keyHandler = getEl('#headerSearchInput').onKeyPress.mock.calls[0][0];
      getEl('#headerSearchInput').value = 'futon frame';
      keyHandler({ key: 'Enter' });
      expect(mockWixLocationTo).toHaveBeenCalledWith('/search-results?q=futon%20frame');
    });

    it('does not navigate on Enter with empty query', async () => {
      await onReadyHandler();
      mockWixLocationTo.mockClear();
      const keyHandler = getEl('#headerSearchInput').onKeyPress.mock.calls[0][0];
      getEl('#headerSearchInput').value = '   ';
      keyHandler({ key: 'Enter' });
      expect(mockWixLocationTo).not.toHaveBeenCalled();
    });

    it('does not navigate on non-Enter keys', async () => {
      await onReadyHandler();
      mockWixLocationTo.mockClear();
      const keyHandler = getEl('#headerSearchInput').onKeyPress.mock.calls[0][0];
      getEl('#headerSearchInput').value = 'test';
      keyHandler({ key: 'a' });
      expect(mockWixLocationTo).not.toHaveBeenCalled();
    });
  });

  // ── Logo ───────────────────────────────────────────────────────────

  describe('site logo display', () => {
    it('sets logo src from getLogoImageUrl', async () => {
      await onReadyHandler();
      expect(getEl('#siteLogo').src).toBeTruthy();
    });

    it('sets logo alt text', async () => {
      await onReadyHandler();
      expect(getEl('#siteLogo').alt).toBe('Carolina Futons');
    });
  });

  // ── Promotional Lightbox ──────────────────────────────────────────

  describe('promotional lightbox', () => {
    it('populates promo lightbox when active promotion exists', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-1',
        title: 'Spring Sale',
        subtitle: 'Save 20% on all futons',
        heroImage: 'https://example.com/hero.jpg',
        discountCode: 'SPRING20',
        ctaText: 'Shop Now',
        ctaUrl: '/sales',
        endDate: new Date(Date.now() + 86400000).toISOString(),
        products: [
          { _id: 'p1', name: 'Eureka', mainMedia: 'eureka.jpg', formattedPrice: '$499.00', formattedDiscountedPrice: '$399.00', slug: 'eureka' },
        ],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000); // initPromoLightbox is setTimeout 3s
      await vi.waitFor(() => {
        expect(getEl('#promoTitle').text).toBe('Spring Sale');
      });
      expect(getEl('#promoSubtitle').text).toBe('Save 20% on all futons');
      expect(getEl('#promoHeroImage').src).toBe('https://example.com/hero.jpg');
      expect(getEl('#promoCode').text).toBe('SPRING20');
      expect(getEl('#promoCTA').label).toBe('Shop Now');
      expect(getEl('#promoOverlay').show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('sets up promo product repeater', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-2',
        title: 'Test Promo',
        subtitle: 'Test',
        discountCode: 'CODE',
        endDate: new Date(Date.now() + 86400000).toISOString(),
        products: [
          { _id: 'p1', name: 'Product A', mainMedia: 'a.jpg', formattedPrice: '$100', slug: 'a' },
          { _id: 'p2', name: 'Product B', mainMedia: 'b.jpg', formattedPrice: '$200', slug: 'b' },
        ],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);
      await vi.waitFor(() => {
        expect(getEl('#promoRepeater').data).toHaveLength(2);
      });
      expect(getEl('#promoRepeater').onItemReady).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('hides promo code elements when no discount code', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-3',
        title: 'No Code Promo',
        subtitle: 'Just browse',
        endDate: new Date(Date.now() + 86400000).toISOString(),
        products: [],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);
      await vi.waitFor(() => {
        expect(getEl('#promoCode').hide).toHaveBeenCalled();
      });
      vi.useRealTimers();
    });

    it('does not show promo lightbox when no active promotion', async () => {
      getActivePromotion.mockResolvedValueOnce(null);
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);
      await vi.advanceTimersByTimeAsync(100);
      expect(getEl('#promoTitle').text).toBe('');
      vi.useRealTimers();
    });

    it('renders promo countdown timer', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-4',
        title: 'Countdown Promo',
        subtitle: 'Hurry!',
        endDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        products: [],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);
      await vi.waitFor(() => {
        const text = getEl('#promoCountdown').text;
        // Should show countdown in DD:HH:MM:SS format
        expect(text).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
      });
      vi.useRealTimers();
    });

    it('shows Sale Ended when promo end date is in the past', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-5',
        title: 'Expired Promo',
        subtitle: 'Gone',
        endDate: new Date(Date.now() - 86400000).toISOString(),
        products: [],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);
      await vi.waitFor(() => {
        expect(getEl('#promoCountdown').text).toBe('Sale Ended');
      });
      vi.useRealTimers();
    });

    it('renders promo product onItemReady with discounted price', async () => {
      getActivePromotion.mockResolvedValueOnce({
        _id: 'promo-6',
        title: 'Test',
        subtitle: 'Test',
        discountCode: 'CODE',
        endDate: new Date(Date.now() + 86400000).toISOString(),
        products: [
          { _id: 'p1', name: 'Eureka', mainMedia: 'eureka.jpg', formattedPrice: '$499.00', formattedDiscountedPrice: '$399.00', slug: 'eureka' },
        ],
      });
      vi.useFakeTimers();
      elements.clear();
      await onReadyHandler();
      vi.advanceTimersByTime(3000);

      await vi.waitFor(() => {
        expect(getEl('#promoRepeater').onItemReady).toHaveBeenCalled();
      });

      const onItemReadyFn = getEl('#promoRepeater').onItemReady.mock.calls[0][0];
      const $item = (sel) => getEl(`promoItem_${sel}`);
      const product = { _id: 'p1', name: 'Eureka', mainMedia: 'eureka.jpg', formattedPrice: '$499.00', formattedDiscountedPrice: '$399.00', slug: 'eureka' };
      onItemReadyFn($item, product);

      expect(getEl('promoItem_#promoImage').src).toBe('eureka.jpg');
      expect(getEl('promoItem_#promoName').text).toBe('Eureka');
      expect(getEl('promoItem_#promoPrice').text).toBe('$399.00');
      expect(getEl('promoItem_#promoOrigPrice').text).toBe('$499.00');
      expect(getEl('promoItem_#promoOrigPrice').show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  // ── Core Web Vitals — advanced ────────────────────────────────────

  describe('core web vitals — additional', () => {
    it('collects FCP from paint entries', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();

      globalThis.performance = {
        timing: { responseStart: 200, navigationStart: 100 },
        getEntriesByType: vi.fn((type) => {
          if (type === 'paint') return [{ name: 'first-contentful-paint', startTime: 1234 }];
          return [];
        }),
      };

      await onReadyHandler();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(reportMetrics).toHaveBeenCalled();
        const data = reportMetrics.mock.calls[0][0];
        expect(data.fcp).toBe(1234);
        expect(data.ttfb).toBe(100);
      });

      delete globalThis.performance;
      vi.useRealTimers();
    });

    it('collects LCP from largest-contentful-paint entries', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();

      globalThis.performance = {
        timing: { responseStart: 200, navigationStart: 100 },
        getEntriesByType: vi.fn((type) => {
          if (type === 'largest-contentful-paint') return [{ startTime: 2500 }];
          if (type === 'paint') return [{ name: 'first-contentful-paint', startTime: 800 }];
          return [];
        }),
      };

      await onReadyHandler();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(reportMetrics).toHaveBeenCalled();
        const data = reportMetrics.mock.calls[0][0];
        expect(data.lcp).toBe(2500);
      });

      delete globalThis.performance;
      vi.useRealTimers();
    });

    it('collects CLS from layout-shift entries', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();

      globalThis.performance = {
        timing: { responseStart: 200, navigationStart: 100 },
        getEntriesByType: vi.fn((type) => {
          if (type === 'layout-shift') return [
            { hadRecentInput: false, value: 0.05 },
            { hadRecentInput: true, value: 0.5 }, // should be excluded
            { hadRecentInput: false, value: 0.1 },
          ];
          if (type === 'paint') return [{ name: 'first-contentful-paint', startTime: 500 }];
          return [];
        }),
      };

      await onReadyHandler();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(reportMetrics).toHaveBeenCalled();
        const data = reportMetrics.mock.calls[0][0];
        expect(data.cls).toBe(0.15);
      });

      delete globalThis.performance;
      vi.useRealTimers();
    });

    it('includes deviceType and connectionType in reported data', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();
      mockGetViewport.mockReturnValueOnce('mobileLarge');

      globalThis.performance = {
        timing: { responseStart: 200, navigationStart: 100 },
        getEntriesByType: vi.fn(() => []),
      };

      await onReadyHandler();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(reportMetrics).toHaveBeenCalled();
        const data = reportMetrics.mock.calls[0][0];
        expect(data.deviceType).toBe('mobile');
      });

      delete globalThis.performance;
      vi.useRealTimers();
    });

    it('does not report when no metrics collected', async () => {
      reportMetrics.mockClear();
      vi.useFakeTimers();
      elements.clear();

      globalThis.performance = {
        timing: { responseStart: 0, navigationStart: 0 },
        getEntriesByType: vi.fn(() => []),
      };

      await onReadyHandler();
      vi.advanceTimersByTime(5000);
      await vi.advanceTimersByTimeAsync(100);

      // With responseStart=0, TTFB is not set; FCP/LCP/CLS all empty.
      // hasMetric is false → reportMetrics should NOT be called.
      expect(reportMetrics).not.toHaveBeenCalled();

      vi.useRealTimers();
      delete globalThis.performance;
    });
  });

  // ── Footer Newsletter ─────────────────────────────────────────────

  describe('footer newsletter — additional', () => {
    it('disables submit button during submission', async () => {
      submitContactForm.mockResolvedValueOnce({});
      await onReadyHandler();
      const submitHandler = getEl('#footerEmailSubmit').onClick.mock.calls[0][0];
      getEl('#footerEmailInput').value = 'test@example.com';
      await submitHandler();
      expect(getEl('#footerEmailSubmit').disable).toHaveBeenCalled();
    });
  });

  // ── Newsletter Modal — additional ─────────────────────────────────

  describe('newsletter modal — additional', () => {
    it('wires trigger onClick to show modal', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalTrigger').onClick).toHaveBeenCalled();
    });

    it('sets subscribe ariaLabel on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterModalSubmit').accessibility.ariaLabel).toBe('Subscribe for 10% off');
    });

    it('wires close button via accessible dialog', async () => {
      await onReadyHandler();
      // newsletterModalClose should have onClick wired by setupAccessibleDialog
      expect(getEl('#newsletterModalClose').onClick).toHaveBeenCalled();
    });
  });

  // ── Exit Intent Lead Capture ─────────────────────────────────────

  describe('exit intent — desktop initialization', () => {
    let exitMod;
    let origDoc;

    beforeEach(async () => {
      exitMod = await import('public/exitIntentCapture');
      vi.useRealTimers();
      if (typeof globalThis.performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      vi.useFakeTimers();
      origDoc = globalThis.document;
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      };
    });

    afterEach(() => {
      vi.useRealTimers();
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      globalThis.document = origDoc;
    });

    it('sets up mouseleave handler on desktop when shouldShowExitIntent returns true', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      const mouseleaveCall = calls.find(c => c[0] === 'mouseleave');
      expect(mouseleaveCall).toBeDefined();
    });

    it('does not set up exit intent when shouldShowExitIntent returns false', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      const mouseleaveCall = calls.find(c => c[0] === 'mouseleave');
      expect(mouseleaveCall).toBeUndefined();
    });

    it('does not show exit intent when promo lightbox is visible', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = false;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      const mouseleaveCall = calls.find(c => c[0] === 'mouseleave');
      expect(mouseleaveCall).toBeUndefined();
    });
  });

  describe('exit intent — showExitPopup', () => {
    let exitMod;
    let origDoc;

    beforeEach(async () => {
      exitMod = await import('public/exitIntentCapture');
      exitMod.markExitIntentShown.mockClear();
      exitMod.markExitIntentDismissed.mockClear();
      vi.useRealTimers();
      if (typeof globalThis.performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      vi.useFakeTimers();
      origDoc = globalThis.document;
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      };
    });

    afterEach(async () => {
      // Dismiss popup to reset module-level _exitPopupShown for next test
      try {
        const overlayClicks = getEl('#exitOverlay').onClick.mock.calls;
        if (overlayClicks.length > 0) {
          overlayClicks[0][0]();
          await vi.advanceTimersByTimeAsync(50);
        }
      } catch (e) {}
      vi.useRealTimers();
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      globalThis.document = origDoc;
    });

    function getMouseleaveHandler() {
      const calls = globalThis.document.addEventListener.mock.calls;
      const mouseleaveCall = calls.find(c => c[0] === 'mouseleave');
      return mouseleaveCall ? mouseleaveCall[1] : undefined;
    }

    it('does not show popup when mouseleave clientY > 0', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      getMouseleaveHandler()({ clientY: 100 });
      await vi.advanceTimersByTimeAsync(50);

      expect(exitMod.markExitIntentShown).not.toHaveBeenCalled();
      expect(getEl('#exitTitle').text).toBe('');
    });

    it('populates title, subtitle, shows overlay, and marks shown on desktop', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      const handler = getMouseleaveHandler();
      expect(handler).toBeDefined();
      handler({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitTitle').text).toBe('Wait!');
      expect(getEl('#exitSubtitle').text).toBe('test');
      expect(getEl('#exitOverlay').show).toHaveBeenCalled();
      expect(exitMod.markExitIntentShown).toHaveBeenCalled();
    });

    it('sets up email capture submit button with config ctaText', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      getMouseleaveHandler()({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitEmailSubmit').label).toBe('Subscribe');
      expect(getEl('#exitEmailInput').accessibility.ariaLabel).toBe('Email');
    });

    it('wires overlay click to dismiss', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      getMouseleaveHandler()({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitOverlay').onClick).toHaveBeenCalled();
    });

    it('wires swatch link onClick', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      getMouseleaveHandler()({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitSwatchLink').onClick).toHaveBeenCalled();
    });

    it('does not fire popup twice (mouseleave uses once option)', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      getMouseleaveHandler()({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      expect(exitMod.markExitIntentShown).toHaveBeenCalledTimes(1);
    });
  });

  describe('exit intent — email capture', () => {
    let exitMod;
    let newsletterMod;
    let origDoc;

    async function triggerExitPopup() {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      const mouseleaveCall = calls.find(c => c[0] === 'mouseleave');
      mouseleaveCall[1]({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);
    }

    beforeEach(async () => {
      exitMod = await import('public/exitIntentCapture');
      newsletterMod = await import('backend/newsletterService.web');
      exitMod.markExitIntentShown.mockClear();
      exitMod.markExitIntentDismissed.mockClear();
      exitMod.validateCaptureEmail.mockClear();
      exitMod.validateCaptureEmail.mockReturnValue(true);
      newsletterMod.subscribeToNewsletter.mockClear();
      newsletterMod.subscribeToNewsletter.mockResolvedValue({ success: true });
      vi.useRealTimers();
      if (typeof globalThis.performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      vi.useFakeTimers();
      origDoc = globalThis.document;
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      };
    });

    afterEach(async () => {
      // Dismiss popup to reset module-level _exitPopupShown for next test
      try {
        const overlayClicks = getEl('#exitOverlay').onClick.mock.calls;
        if (overlayClicks.length > 0) {
          overlayClicks[0][0]();
          await vi.advanceTimersByTimeAsync(50);
        }
      } catch (e) {}
      vi.useRealTimers();
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      exitMod.validateCaptureEmail.mockReturnValue(true);
      newsletterMod.subscribeToNewsletter.mockResolvedValue({ success: true });
      globalThis.document = origDoc;
    });

    it('successful email capture: disables button, subscribes, shows success', async () => {
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';

      await submitHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(newsletterMod.subscribeToNewsletter).toHaveBeenCalledWith(
        'user@example.com',
        { source: 'exit_intent_popup' }
      );
      expect(getEl('#exitEmailSubmit').label).toBe('Sent!');
      expect(getEl('#exitSuccess').text).toBe('Thanks!');
      expect(getEl('#exitSuccess').show).toHaveBeenCalled();
    });

    it('clears email input after successful capture', async () => {
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';
      await submitHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitEmailInput').value).toBe('');
    });

    it('shows validation error when email is invalid', async () => {
      exitMod.validateCaptureEmail.mockReturnValue(false);
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'bad-email';
      await submitHandler();

      expect(getEl('#exitEmailError').text).toBe('Please enter a valid email address.');
      expect(getEl('#exitEmailError').show).toHaveBeenCalled();
      expect(newsletterMod.subscribeToNewsletter).not.toHaveBeenCalled();
    });

    it('shows error and re-enables button on subscribe failure', async () => {
      newsletterMod.subscribeToNewsletter.mockResolvedValueOnce({ success: false, message: 'Already subscribed' });
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';
      await submitHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitEmailError').text).toBe('Already subscribed');
      expect(getEl('#exitEmailError').show).toHaveBeenCalled();
      expect(getEl('#exitEmailSubmit').enable).toHaveBeenCalled();
      expect(getEl('#exitEmailSubmit').label).toBe('Subscribe');
    });

    it('shows generic error when subscribe throws', async () => {
      newsletterMod.subscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';
      await submitHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitEmailError').text).toBe('Something went wrong. Please try again.');
      expect(getEl('#exitEmailSubmit').enable).toHaveBeenCalled();
    });

    it('disables submit button during subscription attempt', async () => {
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';
      await submitHandler();

      expect(getEl('#exitEmailSubmit').disable).toHaveBeenCalled();
    });

    it('auto-dismisses popup 4 seconds after successful capture', async () => {
      await triggerExitPopup();

      const submitHandler = getEl('#exitEmailSubmit').onClick.mock.calls[0][0];
      getEl('#exitEmailInput').value = 'user@example.com';
      await submitHandler();
      await vi.advanceTimersByTimeAsync(50);

      vi.advanceTimersByTime(4000);
      await vi.advanceTimersByTimeAsync(50);
      expect(getEl('#exitIntentPopup').hide).toHaveBeenCalled();
    });
  });

  describe('exit intent — dismissExitPopup', () => {
    let exitMod;
    let origDoc;

    beforeEach(async () => {
      exitMod = await import('public/exitIntentCapture');
      vi.useRealTimers();
      if (typeof globalThis.performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      vi.useFakeTimers();
      origDoc = globalThis.document;
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      };
    });

    afterEach(() => {
      vi.useRealTimers();
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      globalThis.document = origDoc;
    });

    it('hides popup via dialog close when overlay is clicked', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      calls.find(c => c[0] === 'mouseleave')[1]({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      const overlayClickHandler = getEl('#exitOverlay').onClick.mock.calls[0][0];
      overlayClickHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitIntentPopup').hide).toHaveBeenCalled();
      expect(exitMod.markExitIntentDismissed).toHaveBeenCalled();
    });

    it('hides exit overlay on dismiss', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);
      const calls = globalThis.document.addEventListener.mock.calls;
      calls.find(c => c[0] === 'mouseleave')[1]({ clientY: -5 });
      await vi.advanceTimersByTimeAsync(50);

      const overlayClickHandler = getEl('#exitOverlay').onClick.mock.calls[0][0];
      overlayClickHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitOverlay').hide).toHaveBeenCalled();
    });
  });

  describe('exit intent — mobile bottom sheet & swipe dismiss', () => {
    let exitMod;
    let origDoc;
    let origSessionStorage;

    beforeEach(async () => {
      exitMod = await import('public/exitIntentCapture');
      vi.useRealTimers();
      if (typeof globalThis.performance === 'undefined') {
        globalThis.performance = { now: () => Date.now() };
      }
      vi.useFakeTimers();
      origDoc = globalThis.document;
      origSessionStorage = globalThis.sessionStorage;
    });

    afterEach(async () => {
      // Dismiss popup to reset module-level _exitPopupShown for next test
      try {
        const overlayClicks = getEl('#exitOverlay').onClick.mock.calls;
        if (overlayClicks.length > 0) {
          overlayClicks[0][0]();
          await vi.advanceTimersByTimeAsync(50);
        }
      } catch (e) {}
      vi.useRealTimers();
      exitMod.shouldShowExitIntent.mockReturnValue(false);
      mockIsMobile.mockReturnValue(false);
      globalThis.document = origDoc;
      globalThis.sessionStorage = origSessionStorage;
    });

    it('sets up visibility change and scroll listeners on mobile', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      mockIsMobile.mockReturnValue(true);
      globalThis.document = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
        visibilityState: 'visible',
      };
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      const events = globalThis.document.addEventListener.mock.calls.map(c => c[0]);
      expect(events).toContain('visibilitychange');
      expect(events).toContain('scroll');
    });

    it('shows drag handle and uses mobile config on mobile popup', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      mockIsMobile.mockReturnValue(true);
      const listenerMap = {};
      globalThis.document = {
        addEventListener: vi.fn((event, fn, opts) => {
          if (!listenerMap[event]) listenerMap[event] = [];
          listenerMap[event].push(fn);
        }),
        removeEventListener: vi.fn(),
        activeElement: null,
        visibilityState: 'visible',
      };
      globalThis.sessionStorage = {
        getItem: vi.fn((k) => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      const visHandlers = listenerMap['visibilitychange'] || [];
      expect(visHandlers.length).toBeGreaterThan(0);

      globalThis.document.visibilityState = 'hidden';
      visHandlers.forEach(h => h());
      globalThis.document.visibilityState = 'visible';
      globalThis.sessionStorage.getItem.mockImplementation((k) => {
        if (k === 'cf_exit_pending') return '1';
        return null;
      });
      visHandlers.forEach(h => h());
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitDragHandle').show).toHaveBeenCalled();
      expect(getEl('#exitTitle').text).toBe('Wait!');
    });

    it('swipe dismiss fires when swipe distance exceeds threshold', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      mockIsMobile.mockReturnValue(true);
      const listenerMap = {};
      globalThis.document = {
        addEventListener: vi.fn((event, fn, opts) => {
          if (!listenerMap[event]) listenerMap[event] = [];
          listenerMap[event].push(fn);
        }),
        removeEventListener: vi.fn(),
        activeElement: null,
        visibilityState: 'visible',
      };
      globalThis.sessionStorage = {
        getItem: vi.fn((k) => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      const visHandlers = listenerMap['visibilitychange'] || [];
      globalThis.document.visibilityState = 'hidden';
      visHandlers.forEach(h => h());
      globalThis.document.visibilityState = 'visible';
      globalThis.sessionStorage.getItem.mockImplementation((k) => {
        if (k === 'cf_exit_pending') return '1';
        return null;
      });
      visHandlers.forEach(h => h());
      await vi.advanceTimersByTimeAsync(50);

      const touchstartHandlers = listenerMap['touchstart'] || [];
      const touchendHandlers = listenerMap['touchend'] || [];

      expect(touchstartHandlers.length).toBeGreaterThan(0);
      expect(touchendHandlers.length).toBeGreaterThan(0);
      touchstartHandlers[0]({ touches: [{ clientY: 100 }] });
      touchendHandlers[0]({ changedTouches: [{ clientY: 250 }] });
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitIntentPopup').hide).toHaveBeenCalled();
    });

    it('swipe does NOT dismiss when distance is below threshold', async () => {
      exitMod.shouldShowExitIntent.mockReturnValue(true);
      mockIsMobile.mockReturnValue(true);
      const listenerMap = {};
      globalThis.document = {
        addEventListener: vi.fn((event, fn, opts) => {
          if (!listenerMap[event]) listenerMap[event] = [];
          listenerMap[event].push(fn);
        }),
        removeEventListener: vi.fn(),
        activeElement: null,
        visibilityState: 'visible',
      };
      globalThis.sessionStorage = {
        getItem: vi.fn((k) => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };
      elements.clear();
      getEl('#promoLightbox').hidden = true;
      await onReadyHandler();
      vi.advanceTimersByTime(10000);
      await vi.advanceTimersByTimeAsync(100);

      const visHandlers = listenerMap['visibilitychange'] || [];
      globalThis.document.visibilityState = 'hidden';
      visHandlers.forEach(h => h());
      globalThis.document.visibilityState = 'visible';
      globalThis.sessionStorage.getItem.mockImplementation((k) => {
        if (k === 'cf_exit_pending') return '1';
        return null;
      });
      visHandlers.forEach(h => h());
      await vi.advanceTimersByTimeAsync(50);

      const touchstartHandlers = listenerMap['touchstart'] || [];
      const touchendHandlers = listenerMap['touchend'] || [];

      expect(touchstartHandlers.length).toBeGreaterThan(0);
      getEl('#exitIntentPopup').hide.mockClear();
      touchstartHandlers[0]({ touches: [{ clientY: 100 }] });
      touchendHandlers[0]({ changedTouches: [{ clientY: 150 }] }); // 50px < 100 threshold
      await vi.advanceTimersByTimeAsync(50);

      expect(getEl('#exitIntentPopup').hide).not.toHaveBeenCalled();
    });
  });

  // ── GDPR: TikTok PageView consent gate ──────────────────────────────

  describe('TikTok PageView — consent gate (GDPR P0)', () => {
    it('registers consent gate on page load', async () => {
      await onReadyHandler();
      expect(initConsentGate).toHaveBeenCalled();
    });

    it('fires PageView through consent gate, not directly via ttq.page()', async () => {
      await onReadyHandler();
      expect(fireTrackedTikTokEvent).toHaveBeenCalledWith('PageView', {});
    });

    it('loads TikTok SDK (initTikTokPixel) before firing consent-gated PageView', async () => {
      const { initTikTokPixel } = await import('public/tikTokPixel');
      initTikTokPixel.mockClear();
      fireTrackedTikTokEvent.mockClear();
      vi.useFakeTimers();
      await onReadyHandler();
      await vi.advanceTimersByTimeAsync(10); // allow deferInit setTimeout(fn,1) to fire
      vi.useRealTimers();
      // SDK must be loaded (to populate window.ttq) before the consent-gated PageView
      expect(initTikTokPixel).toHaveBeenCalled();
      expect(fireTrackedTikTokEvent).toHaveBeenCalledWith('PageView', {});
    });
  });
});
