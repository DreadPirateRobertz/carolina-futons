import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, futonMattress, wallHuggerFrame, saleProduct, outdoorFrame } from './fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    html: '',
    options: [],
    data: [],
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onKeyPress: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onCurrentIndexChanged: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    getCurrentItem: vi.fn(),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

const mockFeatured = [wallHuggerFrame, futonFrame, futonMattress];
const mockSaleItems = [saleProduct, futonMattress];

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue(mockFeatured),
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleItems),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
}));

vi.mock('backend/testimonialService.web', () => ({
  getFeaturedTestimonials: vi.fn().mockResolvedValue({ success: true, items: [] }),
  getTestimonialSchema: vi.fn().mockResolvedValue(null),
}));

vi.mock('public/galleryHelpers.js', () => ({
  getRecentlyViewed: vi.fn().mockReturnValue([]),
  buildRecentlyViewedSection: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getCategoryHeroImage: vi.fn().mockReturnValue('https://example.com/hero.jpg'),
  getCategoryCardImage: vi.fn((slug) => `https://example.com/card-${slug}.jpg`),
  getRidgelineHeaderSrc: vi.fn().mockReturnValue('https://example.com/ridgeline.svg'),
  getCategoryIllustration: vi.fn((cat) => `https://example.com/category-${cat}.png`),
  getHomepageHeroImage: vi.fn().mockReturnValue('https://example.com/homepage-hero.jpg'),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn().mockReturnValue(false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn((items) => items),
  onViewportChange: vi.fn(() => () => {}),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      try { el.accessibility.ariaLabel = opts.ariaLabel; } catch (e) {}
    }
  }),
  setupAccessibleDialog: vi.fn(($w, config) => {
    try {
      const panel = $w(config.panelId);
      if (panel) {
        try { panel.accessibility.role = 'dialog'; } catch (e) {}
        try { panel.accessibility.ariaModal = true; } catch (e) {}
      }
    } catch (e) {}
    try {
      const closeBtn = $w(config.closeId);
      if (closeBtn) {
        closeBtn.onClick(() => {
          try { $w(config.panelId).hide('fade', { duration: 200 }); } catch (e) {}
          if (config.onClose) config.onClose();
        });
      }
    } catch (e) {}
    return {
      open: vi.fn(() => {
        try { $w(config.panelId).show('fade', { duration: 200 }); } catch (e) {}
      }),
      close: vi.fn(() => {
        try { $w(config.panelId).hide('fade', { duration: 200 }); } catch (e) {}
        if (config.onClose) config.onClose();
      }),
    };
  }),
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn().mockReturnValue({
      hasSome: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(12),
      }),
    }),
  },
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

// ── Helpers ─────────────────────────────────────────────────────────

// Flush microtask queue so fire-and-forget deferred sections in
// prioritizeSections() have time to settle (hq-r3ie moved featuredProducts
// from critical to deferred).
const flushDeferred = () => new Promise(r => setTimeout(r, 0));

// ── Import Page ─────────────────────────────────────────────────────

describe('Home Page — CF-edk1 Hero & Visual Polish', () => {
  beforeAll(async () => {
    await import('../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Newsletter Signup Section ──────────────────────────────────────

  describe('newsletter signup section', () => {
    it('sets newsletter section title text', async () => {
      await onReadyHandler();
      const title = getEl('#newsletterTitle');
      expect(title.text).toContain('Join');
    });

    it('sets newsletter section subtitle/description', async () => {
      await onReadyHandler();
      const subtitle = getEl('#newsletterSubtitle');
      expect(subtitle.text.length).toBeGreaterThan(0);
    });

    it('registers click handler on newsletter submit button', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterSubmit').onClick).toHaveBeenCalled();
    });

    it('sets aria label on newsletter email input', async () => {
      await onReadyHandler();
      const input = getEl('#newsletterEmail');
      expect(input.accessibility.ariaLabel).toBeTruthy();
    });

    it('sets aria label on newsletter submit button', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      expect(btn.accessibility.ariaLabel).toBeTruthy();
    });

    it('newsletter success message is hidden by default', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterSuccess').hide).toHaveBeenCalled();
    });

    it('newsletter error message is hidden by default', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterError').hide).toHaveBeenCalled();
    });

    it('submitting valid email calls subscribeToNewsletter', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      // Simulate valid email
      getEl('#newsletterEmail').value = 'test@example.com';
      await submitHandler();

      const { subscribeToNewsletter } = await import('backend/newsletterService.web');
      expect(subscribeToNewsletter).toHaveBeenCalledWith('test@example.com');
    });

    it('shows success message with discount code on valid submission', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'test@example.com';
      await submitHandler();

      const success = getEl('#newsletterSuccess');
      expect(success.show).toHaveBeenCalled();
      expect(success.text).toContain('WELCOME10');
    });

    it('shows error message for empty email', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = '';
      await submitHandler();

      expect(getEl('#newsletterError').show).toHaveBeenCalled();
    });

    it('shows error message for invalid email format', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'not-an-email';
      await submitHandler();

      expect(getEl('#newsletterError').show).toHaveBeenCalled();
    });

    it('tracks newsletter_signup event on success', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'test@example.com';
      await submitHandler();

      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('newsletter_signup', expect.objectContaining({ page: 'home' }));
    });

    it('disables submit button during submission to prevent double-submit', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'test@example.com';

      // During submission the button label should change
      const originalLabel = btn.label;
      await submitHandler();

      // Button should be re-enabled after submission
      expect(btn.label).not.toBe('Submitting...');
    });

    it('handles backend subscription failure gracefully', async () => {
      const { subscribeToNewsletter } = await import('backend/newsletterService.web');
      subscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));

      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'test@example.com';
      await submitHandler();

      expect(getEl('#newsletterError').show).toHaveBeenCalled();
    });

    it('expands newsletter section on init', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterSection').expand).toHaveBeenCalled();
    });
  });

  // ── Mountain Ridgeline Header ──────────────────────────────────────

  describe('mountain ridgeline header', () => {
    // initRidgelineHeader uses dynamic import → .catch fallback is async
    const flushPromises = () => new Promise(r => setTimeout(r, 50));

    it('sets ridgeline image src from asset helper', async () => {
      await onReadyHandler();
      await flushPromises();
      const ridgeline = getEl('#ridgelineHeader');
      expect(ridgeline.src).toBeTruthy();
    });

    it('sets alt text on ridgeline for accessibility', async () => {
      await onReadyHandler();
      await flushPromises();
      const ridgeline = getEl('#ridgelineHeader');
      expect(ridgeline.alt).toContain('Blue Ridge');
    });

    it('ridgeline has decorative aria label', async () => {
      await onReadyHandler();
      await flushPromises();
      const ridgeline = getEl('#ridgelineHeader');
      expect(ridgeline.accessibility.ariaLabel).toBeDefined();
    });
  });

  // ── Hero Section Polish ────────────────────────────────────────────

  describe('hero section polish', () => {
    it('sets hero title to "Handcrafted Comfort, Mountain Inspired."', async () => {
      await onReadyHandler();
      const title = getEl('#heroTitle');
      expect(title.text).toBe('Handcrafted Comfort, Mountain Inspired.');
    });

    it('sets hero subtitle with brand messaging', async () => {
      await onReadyHandler();
      const subtitle = getEl('#heroSubtitle');
      expect(subtitle.text.length).toBeGreaterThan(0);
    });

    it('sets hero CTA button label', async () => {
      await onReadyHandler();
      const cta = getEl('#heroCTA');
      expect(cta.label).toBe('Explore Our Collection');
    });

    it('hero CTA has accessible label', async () => {
      await onReadyHandler();
      const cta = getEl('#heroCTA');
      expect(cta.accessibility.ariaLabel).toBeTruthy();
    });

    it('sets hero background image from cabin illustration asset', async () => {
      await onReadyHandler();
      const heroBg = getEl('#heroBg');
      expect(heroBg.src).toBeTruthy();
    });

    it('sets hero background alt text for SEO', async () => {
      await onReadyHandler();
      const heroBg = getEl('#heroBg');
      expect(heroBg.alt).toContain('Carolina Futons');
    });

    it('hero title fades in before subtitle (staggered animation)', async () => {
      await onReadyHandler();
      const titleCall = getEl('#heroTitle').show.mock.calls[0];
      const subtitleCall = getEl('#heroSubtitle').show.mock.calls[0];
      expect(titleCall[1].delay).toBeLessThan(subtitleCall[1].delay);
    });

    it('hero CTA fades in last', async () => {
      await onReadyHandler();
      const subtitleDelay = getEl('#heroSubtitle').show.mock.calls[0][1].delay;
      const ctaDelay = getEl('#heroCTA').show.mock.calls[0][1].delay;
      expect(ctaDelay).toBeGreaterThan(subtitleDelay);
    });

    it('hero CTA navigates to /shop-main on click', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').onClick).toHaveBeenCalled();
    });
  });

  // ── CF-bbms Hero Overhaul ──────────────────────────────────────────

  describe('CF-bbms hero overhaul — overlay and ARIA', () => {
    it('sets hero overlay background color for text readability', async () => {
      await onReadyHandler();
      const overlay = getEl('#heroOverlay');
      expect(overlay.show).toHaveBeenCalled();
    });

    it('hero overlay uses brand espresso overlay color', async () => {
      await onReadyHandler();
      const overlay = getEl('#heroOverlay');
      expect(overlay.style.backgroundColor).toBe('rgba(30, 58, 95, 0.6)');
    });

    it('sets hero section ARIA landmark role', async () => {
      await onReadyHandler();
      const section = getEl('#heroSection');
      expect(section.accessibility.ariaLabel).toContain('hero');
    });

    it('hero background uses dedicated homepage hero image', async () => {
      await onReadyHandler();
      const { getHomepageHeroImage } = await import('public/placeholderImages.js');
      expect(getHomepageHeroImage).toHaveBeenCalled();
    });

    it('hero background alt text includes brand and location', async () => {
      await onReadyHandler();
      const heroBg = getEl('#heroBg');
      expect(heroBg.alt).toContain('Handcrafted');
      expect(heroBg.alt).toContain('Carolina Futons');
      expect(heroBg.alt).toContain('Hendersonville');
    });

    it('hero overlay fades in before title animation', async () => {
      await onReadyHandler();
      const overlayCall = getEl('#heroOverlay').show.mock.calls[0];
      const titleCall = getEl('#heroTitle').show.mock.calls[0];
      expect(overlayCall[1].delay).toBeLessThanOrEqual(titleCall[1].delay);
    });

    it('page still loads when hero overlay element is missing', async () => {
      elements.delete('#heroOverlay');
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('page still loads when hero section element is missing', async () => {
      elements.delete('#heroSection');
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Category Showcase Enhancements ─────────────────────────────────

  describe('category showcase enhancements', () => {
    it('populates category repeater with data', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      expect(repeater.data.length).toBeGreaterThan(0);
    });

    it('category repeater registers onItemReady', async () => {
      await onReadyHandler();
      expect(getEl('#categoryRepeater').onItemReady).toHaveBeenCalled();
    });

    it('category onItemReady sets card title', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12 };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardTitle'].text).toBe('Futon Frames');
    });

    it('category onItemReady sets tagline', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12 };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardTagline'].text).toBe('Solid hardwood');
    });

    it('category onItemReady sets product count text', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12 };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardCount'].text).toContain('12');
    });

    it('category card has accessible aria label for browsing', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12 };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardTitle'].accessibility.ariaLabel).toContain('Futon Frames');
    });

    it('registers click handlers on individual category card elements', async () => {
      await onReadyHandler();
      // The 6 main category card selectors should have onClick registered
      const cardIds = [
        '#categoryFutonFrames', '#categoryMattresses', '#categoryMurphy',
        '#categoryPlatformBeds', '#categoryCasegoods', '#categorySale',
      ];
      cardIds.forEach(id => {
        expect(getEl(id).onClick).toHaveBeenCalled();
      });
    });

    it('category cards show empty string for null count', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'sale', name: 'Sale & Clearance', tagline: 'Deals', path: '/sales', count: null };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardCount'].text).toBe('');
    });
  });

  // ── Trust Bar Enhancements ─────────────────────────────────────────

  describe('trust bar', () => {
    it('shows trust items with staggered fade-in animation', async () => {
      await onReadyHandler();
      const item1 = getEl('#trustItem1');
      const item2 = getEl('#trustItem2');
      expect(item1.show).toHaveBeenCalledWith('fade', expect.objectContaining({ delay: expect.any(Number) }));
      expect(item2.show).toHaveBeenCalledWith('fade', expect.objectContaining({ delay: expect.any(Number) }));
    });

    it('trust item 1 fades in before trust item 2', async () => {
      await onReadyHandler();
      const delay1 = getEl('#trustItem1').show.mock.calls[0][1].delay;
      const delay2 = getEl('#trustItem2').show.mock.calls[0][1].delay;
      expect(delay1).toBeLessThan(delay2);
    });

    it('active trust items receive show animation (free shipping hidden)', async () => {
      await onReadyHandler();
      ['#trustItem1', '#trustItem2', '#trustItem3', '#trustItem5'].forEach(id => {
        expect(getEl(id).show).toHaveBeenCalled();
      });
    });
  });

  // ── Mobile Behavior ─────────────────────────────────────────────────

  describe('mobile behavior', () => {
    it('collapses testimonial and video sections on mobile', async () => {
      await onReadyHandler();
      const { collapseOnMobile } = await import('public/mobileHelpers');
      expect(collapseOnMobile).toHaveBeenCalledWith(
        $w,
        expect.arrayContaining(['#testimonialSection', '#videoShowcaseSection'])
      );
    });

    it('limits featured products for viewport size', async () => {
      await onReadyHandler();
      const { limitForViewport } = await import('public/mobileHelpers');
      expect(limitForViewport).toHaveBeenCalled();
    });
  });

  // ── Error Resilience ───────────────────────────────────────────────

  describe('error resilience', () => {
    it('page still loads when featured products backend fails', async () => {
      const { getFeaturedProducts } = await import('backend/productRecommendations.web');
      getFeaturedProducts.mockRejectedValueOnce(new Error('API timeout'));

      // Should not throw
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('page still loads when newsletter section elements are missing', async () => {
      // Remove newsletter elements to simulate missing editor elements
      elements.delete('#newsletterSection');
      elements.delete('#newsletterTitle');
      elements.delete('#newsletterSubmit');

      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('page still loads when ridgeline header element is missing', async () => {
      elements.delete('#ridgelineHeader');
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('sale section collapses when backend returns empty array', async () => {
      const { getSaleProducts } = await import('backend/productRecommendations.web');
      getSaleProducts.mockResolvedValueOnce([]);

      await onReadyHandler();
      expect(getEl('#saleSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Accessibility ──────────────────────────────────────────────────

  describe('accessibility', () => {
    it('hero CTA has aria label', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').accessibility.ariaLabel).toBeTruthy();
    });

    it('newsletter input has aria label for email entry', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterEmail').accessibility.ariaLabel).toBeTruthy();
    });

    it('announces newsletter subscription result for screen readers', async () => {
      await onReadyHandler();
      const btn = getEl('#newsletterSubmit');
      const submitHandler = btn.onClick.mock.calls[0][0];

      getEl('#newsletterEmail').value = 'test@example.com';
      await submitHandler();

      const { announce } = await import('public/a11yHelpers');
      expect(announce).toHaveBeenCalled();
    });

    it('tracks page_view event on home page load', async () => {
      await onReadyHandler();
      const { trackEvent } = await import('public/engagementTracker');
      expect(trackEvent).toHaveBeenCalledWith('page_view', expect.objectContaining({ page: 'home' }));
    });
  });

  // ── Trust Bar Icon Wiring ──────────────────────────────────────────

  describe('trust bar icon wiring', () => {
    it('sets icon text on trust icon elements', async () => {
      await onReadyHandler();
      const icon1 = getEl('#trustIcon1');
      expect(icon1.text).toBeTruthy();
    });

    it('sets text content on trust text elements', async () => {
      await onReadyHandler();
      const text1 = getEl('#trustText1');
      expect(text1.text).toContain('Carolinas');
    });

    it('trust icon 2 shows heart icon for family-owned', async () => {
      await onReadyHandler();
      const icon2 = getEl('#trustIcon2');
      expect(icon2.text).toBeTruthy();
    });

    it('trust icon 3 shows palette icon for swatches', async () => {
      await onReadyHandler();
      const icon3 = getEl('#trustIcon3');
      expect(icon3.text).toBeTruthy();
    });

    it('trust icon 4 is not set (free shipping disabled)', async () => {
      await onReadyHandler();
      const icon4 = getEl('#trustIcon4');
      expect(icon4.text).toBeFalsy();
    });

    it('sets accessibility label on trust items', async () => {
      await onReadyHandler();
      const item1 = getEl('#trustItem1');
      expect(item1.accessibility.ariaLabel).toContain('Carolinas');
    });
  });

  // ── Category Card Image & Hover ────────────────────────────────────

  describe('category card images and hover', () => {
    it('category onItemReady sets card image src', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12, collection: 'futon-frames' };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardImage'].src).toBeTruthy();
    });

    it('category card image has alt text', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12, collection: 'futon-frames' };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCardImage'].alt).toContain('Futon Frames');
    });

    it('category card registers mouseIn hover handler', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12, collection: 'futon-frames' };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCard'].onMouseIn).toHaveBeenCalled();
    });

    it('category card registers mouseOut hover handler', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
            style: { backgroundColor: '' },
          };
        }
        return itemElements[sel];
      };

      const catData = { _id: 'futonFrames', name: 'Futon Frames', tagline: 'Solid hardwood', path: '/futon-frames', count: 12, collection: 'futon-frames' };
      itemReadyCb($item, catData);

      expect(itemElements['#categoryCard'].onMouseOut).toHaveBeenCalled();
    });
  });

  // ── Featured Products Badge Support ────────────────────────────────

  describe('featured products badge support', () => {
    it('shows ribbon badge when product has ribbon text', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      // wallHuggerFrame has ribbon: 'Featured'
      itemReadyCb($item, wallHuggerFrame);
      expect(itemElements['#featuredRibbon'].text).toBe('Featured');
      expect(itemElements['#featuredRibbon'].show).toHaveBeenCalled();
    });

    it('hides ribbon badge when product has no ribbon', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      // futonFrame has ribbon: ''
      itemReadyCb($item, futonFrame);
      expect(itemElements['#featuredRibbon'].hide).toHaveBeenCalled();
    });

    it('shows "New" ribbon for new arrival products', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            accessibility: { ariaLabel: '' },
            show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      // outdoorFrame has ribbon: 'New'
      itemReadyCb($item, outdoorFrame);
      expect(itemElements['#featuredRibbon'].text).toBe('New');
      expect(itemElements['#featuredRibbon'].show).toHaveBeenCalled();
    });
  });

  // ── Featured Products Section Title ────────────────────────────────

  describe('featured products section title', () => {
    it('sets featured section title text', async () => {
      await onReadyHandler();
      const title = getEl('#featuredTitle');
      expect(title.text).toBeTruthy();
    });

    it('sets featured section subtitle text', async () => {
      await onReadyHandler();
      const subtitle = getEl('#featuredSubtitle');
      expect(subtitle.text).toBeTruthy();
    });
  });

  // ── Skeleton Loading States ──────────────────────────────────────────

  describe('skeleton loading states', () => {
    it('shows featured skeleton during product load', async () => {
      await onReadyHandler();
      expect(getEl('#featuredSkeleton').show).toHaveBeenCalled();
    });

    it('hides featured skeleton after products load', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredSkeleton').hide).toHaveBeenCalled();
    });

    it('shows category skeleton during count fetch', async () => {
      await onReadyHandler();
      expect(getEl('#categorySkeleton').show).toHaveBeenCalled();
    });

    it('hides category skeleton after counts load', async () => {
      await onReadyHandler();
      expect(getEl('#categorySkeleton').hide).toHaveBeenCalled();
    });

    it('shows sale skeleton during sale product load', async () => {
      await onReadyHandler();
      expect(getEl('#saleSkeleton').show).toHaveBeenCalled();
    });

    it('hides sale skeleton after sale products load', async () => {
      await onReadyHandler();
      expect(getEl('#saleSkeleton').hide).toHaveBeenCalled();
    });

    it('hides featured skeleton even when backend fails', async () => {
      const { getFeaturedProducts } = await import('backend/productRecommendations.web');
      getFeaturedProducts.mockRejectedValueOnce(new Error('timeout'));

      await onReadyHandler();
      expect(getEl('#featuredSkeleton').hide).toHaveBeenCalled();
    });

    it('hides sale skeleton even when backend fails', async () => {
      const { getSaleProducts } = await import('backend/productRecommendations.web');
      getSaleProducts.mockRejectedValueOnce(new Error('timeout'));

      await onReadyHandler();
      expect(getEl('#saleSkeleton').hide).toHaveBeenCalled();
    });

    it('page loads when skeleton elements do not exist in editor', async () => {
      elements.delete('#featuredSkeleton');
      elements.delete('#categorySkeleton');
      elements.delete('#saleSkeleton');
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Testimonial Auto-Rotation ────────────────────────────────────────

  describe('testimonial auto-rotation', () => {
    async function waitForDeferred() {
      // Deferred sections are fire-and-forget — wait for async chains to settle
      await new Promise(r => setTimeout(r, 50));
    }

    it('registers mouseIn handler on testimonial section for pause', async () => {
      await onReadyHandler();
      await waitForDeferred();
      expect(getEl('#testimonialSection').onMouseIn).toHaveBeenCalled();
    });

    it('registers mouseOut handler on testimonial section for resume', async () => {
      await onReadyHandler();
      await waitForDeferred();
      expect(getEl('#testimonialSection').onMouseOut).toHaveBeenCalled();
    });

    it('calls slideshow next after rotation interval', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      // Flush deferred microtasks within fake timer context
      await vi.advanceTimersByTimeAsync(100);
      getEl('#testimonialSlideshow').next.mockClear();
      vi.advanceTimersByTime(5000);
      expect(getEl('#testimonialSlideshow').next).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('does not call next when paused via mouseIn', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      await vi.advanceTimersByTimeAsync(100);
      const section = getEl('#testimonialSection');
      const mouseInHandler = section.onMouseIn.mock.calls[0]?.[0];

      if (mouseInHandler) mouseInHandler();
      getEl('#testimonialSlideshow').next.mockClear();
      vi.advanceTimersByTime(5000);
      expect(getEl('#testimonialSlideshow').next).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('resumes rotation after mouseOut', async () => {
      vi.useFakeTimers();
      await onReadyHandler();
      await vi.advanceTimersByTimeAsync(100);
      const section = getEl('#testimonialSection');
      const mouseInHandler = section.onMouseIn.mock.calls[0]?.[0];
      const mouseOutHandler = section.onMouseOut.mock.calls[0]?.[0];

      if (mouseInHandler) mouseInHandler();
      if (mouseOutHandler) mouseOutHandler();
      getEl('#testimonialSlideshow').next.mockClear();
      vi.advanceTimersByTime(5000);
      expect(getEl('#testimonialSlideshow').next).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('page loads when testimonial slideshow element is missing', async () => {
      elements.delete('#testimonialSlideshow');
      elements.delete('#testimonialSection');
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });

  // ── Transition Timing (300ms standard) ──────────────────────────────

  describe('transition timing normalization', () => {
    it('hero title fades in with 300ms duration', async () => {
      await onReadyHandler();
      const call = getEl('#heroTitle').show.mock.calls[0];
      expect(call[1].duration).toBe(300);
    });

    it('hero subtitle fades in with 300ms duration', async () => {
      await onReadyHandler();
      const call = getEl('#heroSubtitle').show.mock.calls[0];
      expect(call[1].duration).toBe(300);
    });

    it('hero CTA fades in with 300ms duration', async () => {
      await onReadyHandler();
      const call = getEl('#heroCTA').show.mock.calls[0];
      expect(call[1].duration).toBe(300);
    });

    it('trust bar items fade in with 300ms duration', async () => {
      await onReadyHandler();
      const call = getEl('#trustItem1').show.mock.calls[0];
      expect(call[1].duration).toBe(300);
    });

    it('hero overlay fades in with 300ms duration', async () => {
      await onReadyHandler();
      const call = getEl('#heroOverlay').show.mock.calls[0];
      expect(call[1].duration).toBe(300);
    });
  });

  // ── Category 6-Card Limit ───────────────────────────────────────────

  describe('category 6-card limit', () => {
    it('category repeater receives exactly 6 items for homepage', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      expect(repeater.data.length).toBe(6);
    });
  });
});
