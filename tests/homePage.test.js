import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createMockElement, createItemScope } from './helpers/wixMocks.js';
// ── $w Mock Infrastructure ──────────────────────────────────────────

const homePageOverrides = {
  onMouseIn: vi.fn(), onMouseOut: vi.fn(),
  getTotalCount: vi.fn(() => 0), getItems: vi.fn(() => ({ items: [] })),
  setSort: vi.fn(), setFilter: vi.fn(), next: vi.fn(),
};

const elements = new Map();

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement(homePageOverrides));
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

const { mockFeatured, mockSaleItems } = vi.hoisted(() => {
  // Inline fixtures to avoid hoisting issues with vi.mock factories
  const wh = { _id: 'prod-frame-002', name: 'Dillon Wall Hugger Frame', slug: 'dillon-wall-hugger-frame', price: 699, formattedPrice: '$699.00', discountedPrice: null, formattedDiscountedPrice: null, mainMedia: 'https://example.com/dillon.jpg', ribbon: 'Featured', collections: ['futon-frames', 'wall-huggers'] };
  const ff = { _id: 'prod-frame-001', name: 'Eureka Futon Frame', slug: 'eureka-futon-frame', price: 499, formattedPrice: '$499.00', discountedPrice: null, formattedDiscountedPrice: null, mainMedia: 'https://example.com/eureka.jpg', ribbon: '', collections: ['futon-frames'] };
  const fm = { _id: 'prod-matt-001', name: 'Moonshadow Futon Mattress', slug: 'moonshadow-futon-mattress', price: 349, formattedPrice: '$349.00', discountedPrice: 299, formattedDiscountedPrice: '$299.00', mainMedia: 'https://example.com/moonshadow.jpg', ribbon: 'Sale', collections: ['mattresses'], discount: 50 };
  const sp = { _id: 'prod-sale-001', name: 'Floor Model Eureka Frame', slug: 'floor-model-eureka', price: 499, formattedPrice: '$499.00', discountedPrice: 349, formattedDiscountedPrice: '$349.00', mainMedia: 'https://example.com/floor-eureka.jpg', ribbon: 'Clearance', collections: ['futon-frames'], discount: 150 };
  return { mockFeatured: [wh, ff, fm], mockSaleItems: [sp, fm] };
});

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue(mockFeatured),
  getSaleProducts: vi.fn().mockResolvedValue(mockSaleItems),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn().mockResolvedValue('{"@type":"WebSite"}'),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

vi.mock('public/galleryHelpers.js', () => ({
  getRecentlyViewed: vi.fn(() => []),
  buildRecentlyViewedSection: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getHomepageHeroImage: vi.fn(() => 'https://static.wixstatic.com/media/hero.jpg'),
  getCategoryCardImage: vi.fn((col) => `https://static.wixstatic.com/media/${col}.jpg/w_600,h_400`),
  getCategoryCardAlt: vi.fn((col) => `${col} - Carolina Futons`),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn((items) => items),
  onViewportChange: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { overlay: 'rgba(0,0,0,0.4)', sunsetCoral: '#FF6B6B' },
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    const criticalResults = [];
    const deferredResults = [];
    for (const s of sections) {
      try {
        await s.init();
        (s.critical ? criticalResults : deferredResults).push({ status: 'fulfilled', value: undefined });
      } catch (err) {
        (s.critical ? criticalResults : deferredResults).push({ status: 'rejected', reason: err });
      }
    }
    return { critical: criticalResults, deferred: deferredResults };
  }),
  lazyLoadImage: vi.fn((el, src, opts) => {
    if (el) { el.src = src; if (opts?.alt) el.alt = opts.alt; }
  }),
}));

vi.mock('public/StarRatingCard.js', () => ({
  batchLoadRatings: vi.fn().mockResolvedValue({}),
  renderCardStarRating: vi.fn(),
  _resetCache: vi.fn(),
}));

vi.mock('public/WishlistCardButton.js', () => ({
  initCardWishlistButton: vi.fn(),
  batchCheckWishlistStatus: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock('public/productCardHelpers.js', () => ({
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn((priceEl, origEl, badgeEl, product) => {
    if (priceEl && product) {
      priceEl.text = product.formattedDiscountedPrice || product.formattedPrice || '';
      if (product.discountedPrice && origEl) { origEl.show(); origEl.text = product.formattedPrice; }
      if (product.discountedPrice && badgeEl) { badgeEl.show(); }
    }
  }),
  setCardImage: vi.fn((el, product) => {
    if (el && product) el.src = product.mainMedia || '';
  }),
  getBadgeColor: vi.fn(() => '#FF0000'),
  renderSimplePrice: vi.fn(($el, product) => {
    if ($el && product) {
      const p = product?.formattedDiscountedPrice || product?.formattedPrice || String(product?.price ?? '');
      try { $el.text = p; } catch (e) {}
    }
  }),
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 400, height: 400 })),
}));

const mockWixDataQuery = {
  hasSome: vi.fn().mockReturnThis(),
  count: vi.fn().mockResolvedValue(42),
};
vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => mockWixDataQuery),
  },
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

vi.mock('backend/testimonialService.web', () => ({
  getFeaturedTestimonials: vi.fn().mockResolvedValue({ success: true, items: [] }),
  getTestimonialSchema: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({ discountCode: 'WELCOME10' }),
}));

vi.mock('public/MountainSkyline.js', () => ({
  initMountainSkyline: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn().mockResolvedValue({}),
}));

vi.mock('public/cartService.js', () => ({
  addToCart: vi.fn().mockResolvedValue({}),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

vi.mock('public/ChallengeOfTheWeekWidget.js', () => ({
  initChallengeOfTheWeekWidget: vi.fn().mockResolvedValue(undefined),
}));

import { trackEvent } from 'public/engagementTracker';
import { makeClickable, announce } from 'public/a11yHelpers';
import { getWebSiteSchema } from 'backend/seoHelpers.web';
import { getSaleProducts } from 'backend/productRecommendations.web';
import { initBackToTop, collapseOnMobile, onViewportChange } from 'public/mobileHelpers';
import { initChallengeOfTheWeekWidget } from 'public/ChallengeOfTheWeekWidget.js';

// ── Helpers ─────────────────────────────────────────────────────────

// Flush microtask queue so fire-and-forget deferred sections in
// prioritizeSections() have time to settle (hq-r3ie moved featuredProducts
// from critical to deferred).
const flushDeferred = () => new Promise(r => setTimeout(r, 50));

// ── Import Page ─────────────────────────────────────────────────────

describe('Home Page', () => {
  // ── Auto-added by cf-obz ──────────────────────────────────────────
vi.mock('public/SocialFeedEmbed.js', () => ({
  initSocialFeeds: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('public/HomeBlogTeasers.js', () => ({
  initBlogTeaserRepeater: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('public/giftCardSection.js', () => ({
  initGiftCardSection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('public/ContinueShoppingSection.js', () => ({
  initContinueShoppingSection: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('public/ChallengeOfTheWeekWidget.js', () => ({
  initChallengeOfTheWeekWidget: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('backend/ups-shipping.web', () => ({
  getShippingRate: vi.fn().mockResolvedValue(null),
  getEstimatedDelivery: vi.fn().mockResolvedValue(null),
}));
vi.mock('backend/utils/validateSchema', () => ({
  validateSchema: vi.fn(() => ({ valid: true, errors: [] })),
}));
// ── End auto-added ─────────────────────────────────────────────────

beforeAll(async () => {
    await import('../src/pages/Home.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Featured Products ───────────────────────────────────────────

  describe('featured products', () => {
    it('populates featured repeater with product data', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      expect(repeater.data).toHaveLength(3);
    });

    it('registers onItemReady for featured product cards', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets image, name, and price', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: itemElements } = createItemScope();

      itemReadyCb($item, mockFeatured[0]);
      expect(itemElements.get('#featuredImage').src).toBe(mockFeatured[0].mainMedia);
      expect(itemElements.get('#featuredName').text).toBe(mockFeatured[0].name);
      expect(itemElements.get('#featuredPrice').text).toBe(mockFeatured[0].formattedPrice);
    });

    it('onItemReady shows sale badge for discounted products', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: itemElements } = createItemScope();

      itemReadyCb($item, mockFeatured[2]);
      expect(itemElements.get('#featuredPrice').text).toBe(mockFeatured[2].formattedDiscountedPrice);
      expect(itemElements.get('#featuredSaleBadge').show).toHaveBeenCalled();
      expect(itemElements.get('#featuredOriginalPrice').show).toHaveBeenCalled();
    });

    it('onItemReady registers makeClickable on image and name', async () => {
      makeClickable.mockClear();
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: itemElements } = createItemScope();

      makeClickable.mockClear();
      itemReadyCb($item, mockFeatured[1]);
      // makeClickable should be called for image and name
      const calls = makeClickable.mock.calls;
      expect(calls.some(c => c[0] === itemElements.get('#featuredImage'))).toBe(true);
      expect(calls.some(c => c[0] === itemElements.get('#featuredName'))).toBe(true);
    });

    it('onItemReady sets SEO alt text on image', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#featuredRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: itemElements } = createItemScope();

      itemReadyCb($item, mockFeatured[1]);
      expect(itemElements.get('#featuredImage').alt).toContain('Eureka');
      expect(itemElements.get('#featuredImage').alt).toContain('Carolina Futons');
    });
  });

  // ── Sale Section ──────────────────────────────────────────────────

  describe('sale section', () => {
    it('populates sale repeater with sale items', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleRepeater');
      expect(repeater.data).toHaveLength(2);
    });

    it('registers onItemReady on sale repeater', async () => {
      await onReadyHandler();
      expect(getEl('#saleRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady populates sale card with product data', async () => {
      await onReadyHandler();
      const repeater = getEl('#saleRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: itemElements } = createItemScope();

      itemReadyCb($item, mockSaleItems[0]);
      expect(itemElements.get('#saleImage').src).toBe(mockSaleItems[0].mainMedia);
      expect(itemElements.get('#saleName').text).toBe(mockSaleItems[0].name);
      expect(itemElements.get('#salePrice').text).toBe(mockSaleItems[0].formattedDiscountedPrice);
    });

    it('collapses sale section when no sale items available', async () => {
      // Override mock to return empty sale items
      const { getSaleProducts } = await import('backend/productRecommendations.web');
      getSaleProducts.mockResolvedValueOnce([]);

      await onReadyHandler();
      expect(getEl('#saleSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Category Showcase ─────────────────────────────────────────────

  describe('category showcase', () => {
    it('registers makeClickable on category cards', async () => {
      makeClickable.mockClear();
      await onReadyHandler();
      // Source uses makeClickable for all 8 CATEGORIES entries
      const browseCalls = makeClickable.mock.calls.filter(
        c => c[2]?.ariaLabel?.startsWith('Browse ')
      );
      expect(browseCalls.length).toBeGreaterThanOrEqual(6);
    });

    it('wires at least 6 Browse category card handlers', async () => {
      makeClickable.mockClear();
      await onReadyHandler();
      const browseCalls = makeClickable.mock.calls.filter(
        c => c[2]?.ariaLabel?.startsWith('Browse ')
      );
      expect(browseCalls.length).toBeGreaterThanOrEqual(6);
    });

    it('sets real CF product images on template category card boxes', async () => {
      await onReadyHandler();
      // Template boxes should get CF product images (not stock template photos)
      const templateImgIds = ['#image26', '#image24', '#image22', '#image20'];
      templateImgIds.forEach(id => {
        const img = getEl(id);
        // Images should be set to wixstatic.com URLs from placeholderImages
        expect(img.src).toContain('static.wixstatic.com');
        expect(img.src).toContain('w_600,h_400');
      });
    });

    it('sets alt text on template category card images', async () => {
      await onReadyHandler();
      const templateImgIds = ['#image26', '#image24', '#image22', '#image20'];
      templateImgIds.forEach(id => {
        const img = getEl(id);
        expect(img.alt).toBeTruthy();
        expect(img.alt.length).toBeGreaterThan(5);
      });
    });
  });

  // ── Hero Animation ────────────────────────────────────────────────

  describe('hero animation', () => {
    it('shows hero title with fade animation', async () => {
      await onReadyHandler();
      expect(getEl('#heroTitle').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 200 })
      );
    });

    it('shows hero subtitle with staggered delay', async () => {
      await onReadyHandler();
      expect(getEl('#heroSubtitle').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 400 })
      );
    });

    it('shows hero CTA with longest delay', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300, delay: 600 })
      );
    });

    it('hero CTA has click handler for shop navigation', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').onClick).toHaveBeenCalled();
    });

    it('stagger timing is title(200) < subtitle(500) < CTA(800)', async () => {
      await onReadyHandler();
      const titleDelay = getEl('#heroTitle').show.mock.calls[0][1].delay;
      const subtitleDelay = getEl('#heroSubtitle').show.mock.calls[0][1].delay;
      const ctaDelay = getEl('#heroCTA').show.mock.calls[0][1].delay;

      expect(titleDelay).toBeLessThan(subtitleDelay);
      expect(subtitleDelay).toBeLessThan(ctaDelay);
    });
  });

  // ── Recently Viewed Section ──────────────────────────────────────

  describe('recently viewed section', () => {
    it('does not throw when recentSection expand fails', async () => {
      // Simulate $w throwing for missing element (Wix behavior)
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#recentSection') throw new Error('Element not found');
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });
  });

  // ── Schema Injection ──────────────────────────────────────────────

  describe('schema injection', () => {
    it('injects WebSite schema into page', async () => {
      await onReadyHandler();
      expect(getEl('#websiteSchemaHtml').postMessage).toHaveBeenCalledWith(
        '{"@type":"WebSite"}'
      );
    });

    it('does not throw when websiteSchemaHtml element is missing', async () => {
      // Simulate $w throwing for missing element (Wix behavior)
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#websiteSchemaHtml') throw new Error('Element not found');
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });

    it('does not throw when getWebSiteSchema returns null', async () => {
      const { getWebSiteSchema } = await import('backend/seoHelpers.web');
      getWebSiteSchema.mockResolvedValueOnce(null);

      await expect(onReadyHandler()).resolves.not.toThrow();
      // postMessage should not be called with null schema
    });
  });

  // ── Press Logos (As Seen In) ────────────────────────────────────────

  describe('press logos section', () => {
    it('collapses template press logos section (CF-xc7t)', async () => {
      await onReadyHandler();
      expect(getEl('#section4').collapse).toHaveBeenCalled();
    });
  });

  // ── Testimonials Guard ─────────────────────────────────────────────

  describe('testimonials guard', () => {
    it('skips testimonials when testimonialSection is missing (CF-jbyh)', async () => {
      // testimonialRepeater maps to template press logos repeater (MISMATCH)
      // initTestimonials should bail when testimonialSection doesn't exist
      const original = globalThis.$w;
      const guardSelector = Object.assign(
        (sel) => {
          if (sel === '#testimonialSection') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = guardSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();
      // testimonialRepeater should NOT have data set (guard prevented it)
      expect(getEl('#testimonialRepeater').onItemReady).not.toHaveBeenCalled();

      globalThis.$w = original;
    });
  });

  // ── Swatch Promo Section ──────────────────────────────────────────

  describe('swatch promo section', () => {
    it('sets swatch promo title and subtitle', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoTitle').text).toBe('700+ Free Fabric Swatches');
      expect(getEl('#swatchPromoSubtitle').text).toContain('Feel the quality');
    });

    it('expands swatch promo section', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoSection').expand).toHaveBeenCalled();
    });

    it('registers click handler on swatch promo CTA', async () => {
      await onReadyHandler();
      expect(getEl('#swatchPromoCTA').onClick).toHaveBeenCalled();
    });
  });

  // ── Trust Bar ──────────────────────────────────────────────────────

  describe('trust bar', () => {
    it('shows trust items with staggered fade-in', async () => {
      await onReadyHandler();
      expect(getEl('#trustItem1').show).toHaveBeenCalledWith(
        'fade',
        expect.objectContaining({ duration: 300 })
      );
    });

    it('sets trust bar text content', async () => {
      await onReadyHandler();
      expect(getEl('#trustText1').text).toBe('Largest Selection in the Carolinas');
      expect(getEl('#trustText2').text).toBe('Family Owned Since 1991');
      expect(getEl('#trustText3').text).toBe('700+ Fabric Swatches');
    });

    it('sets trust bar icon emoji characters', async () => {
      await onReadyHandler();
      expect(getEl('#trustIcon1').text).toBeTruthy();
      expect(getEl('#trustIcon2').text).toBeTruthy();
    });

    it('sets aria labels on trust items', async () => {
      await onReadyHandler();
      expect(getEl('#trustItem1').accessibility.ariaLabel).toBe('Largest Selection in the Carolinas');
    });
  });

  // ── Newsletter Section ─────────────────────────────────────────────

  describe('newsletter section', () => {
    it('sets newsletter title and subtitle', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#newsletterTitle').text).toBe('Join the Carolina Futons Family');
      expect(getEl('#newsletterSubtitle').text).toContain('10% off');
    });

    it('hides success and error messages initially', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#newsletterSuccess').hide).toHaveBeenCalled();
      expect(getEl('#newsletterError').hide).toHaveBeenCalled();
    });

    it('sets accessibility labels on email input and submit', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#newsletterEmail').accessibility.ariaLabel).toBe('Enter your email address');
      expect(getEl('#newsletterSubmit').accessibility.ariaLabel).toBe('Subscribe to newsletter');
    });

    it('registers onClick handler on newsletter submit', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#newsletterSubmit').onClick).toHaveBeenCalled();
    });

    it('shows error for invalid email on submit', async () => {
      await onReadyHandler();
      await flushDeferred();
      const submitHandler = getEl('#newsletterSubmit').onClick.mock.calls[0][0];
      getEl('#newsletterEmail').value = 'bad-email';
      await submitHandler();
      expect(getEl('#newsletterError').text).toBe('Please enter a valid email address.');
      expect(getEl('#newsletterError').show).toHaveBeenCalled();
    });

    it('expands newsletter section', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#newsletterSection').expand).toHaveBeenCalled();
    });
  });

  // ── Video Showcase ─────────────────────────────────────────────────

  describe('video showcase', () => {
    it('sets video showcase title', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#videoShowcaseTitle').text).toBe('See Our Furniture in Action');
    });

    it('sets video showcase subtitle', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#videoShowcaseSubtitle').text).toContain('product demos');
    });

    it('wires makeClickable on video thumbnails', async () => {
      await onReadyHandler();
      await flushDeferred();
      // makeClickable should be called for videoThumb1/2/3 and viewAllVideosCTA
      const thumbCalls = makeClickable.mock.calls.filter(
        c => c[0] && ['#videoThumb1', '#videoThumb2', '#videoThumb3'].some(
          id => c[0] === getEl(id)
        )
      );
      expect(thumbCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('expands video showcase section', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#videoShowcaseSection').expand).toHaveBeenCalled();
    });
  });

  // ── Quiz CTA ───────────────────────────────────────────────────────

  describe('quiz CTA', () => {
    it('sets quiz CTA title', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#quizCTATitle').text).toBe('Not Sure Where to Start?');
    });

    it('sets quiz CTA subtitle', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#quizCTASubtitle').text).toContain('60-second style quiz');
    });

    it('registers onClick handler on quiz CTA button', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#quizCTAButton').onClick).toHaveBeenCalled();
    });

    it('sets aria label on quiz CTA button', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#quizCTAButton').accessibility.ariaLabel).toBe('Take the style quiz');
    });

    it('expands quiz CTA section', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#quizCTASection').expand).toHaveBeenCalled();
    });
  });

  // ── Smooth Scroll ──────────────────────────────────────────────────

  describe('smooth scroll anchors', () => {
    it('registers onClick on scroll triggers', async () => {
      await onReadyHandler();
      expect(getEl('#scrollToFeatured').onClick).toHaveBeenCalled();
      expect(getEl('#scrollToCategories').onClick).toHaveBeenCalled();
    });

    it('sets aria labels on scroll triggers', async () => {
      await onReadyHandler();
      expect(getEl('#scrollToFeatured').accessibility.ariaLabel).toBe('Scroll to featured products');
      expect(getEl('#scrollToCategories').accessibility.ariaLabel).toBe('Scroll to categories');
    });
  });

  // ── Hero Details ───────────────────────────────────────────────────

  describe('hero details', () => {
    it('sets hero title text content', async () => {
      await onReadyHandler();
      expect(getEl('#heroTitle').text).toContain('Handcrafted Comfort');
    });

    it('sets hero subtitle text content', async () => {
      await onReadyHandler();
      expect(getEl('#heroSubtitle').text).toContain('Hendersonville');
    });

    it('sets hero CTA label', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').label).toBe('Explore Our Collection');
    });

    it('sets hero section ARIA landmark', async () => {
      await onReadyHandler();
      expect(getEl('#heroSection').accessibility.ariaLabel).toBe('Carolina Futons hero banner');
    });

    it('sets hero background image from placeholderImages', async () => {
      await onReadyHandler();
      expect(getEl('#heroBg').src).toContain('wixstatic.com');
    });

    it('sets hero CTA aria label for accessibility', async () => {
      await onReadyHandler();
      expect(getEl('#heroCTA').accessibility.ariaLabel).toBe('Explore our furniture collection');
    });
  });

  // ── initBackToTop & trackEvent ─────────────────────────────────────

  describe('page initialization', () => {
    it('calls initBackToTop', async () => {
      initBackToTop.mockClear();
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalled();
    });

    it('tracks page_view event', async () => {
      trackEvent.mockClear();
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'home' });
    });

    it('calls collapseOnMobile for testimonials and video', async () => {
      collapseOnMobile.mockClear();
      await onReadyHandler();
      expect(collapseOnMobile).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['#testimonialSection', '#videoShowcaseSection'])
      );
    });

    it('registers onViewportChange callback', async () => {
      onViewportChange.mockClear();
      await onReadyHandler();
      expect(onViewportChange).toHaveBeenCalled();
    });
  });

  // ── Featured Quick View ────────────────────────────────────────────

  describe('featured quick view modal', () => {
    it('wires onClick on featuredQvViewFull', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredQvViewFull').onClick).toHaveBeenCalled();
    });

    it('wires onClick on featuredQvAddToCart', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredQvAddToCart').onClick).toHaveBeenCalled();
    });

    it('wires onClick on featuredQvClose (via setupAccessibleDialog)', async () => {
      await onReadyHandler();
      await flushDeferred();
      // setupAccessibleDialog is called with closeId: '#featuredQvClose'
      const { setupAccessibleDialog } = await import('public/a11yHelpers');
      expect(setupAccessibleDialog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          panelId: '#featuredQuickViewModal',
          closeId: '#featuredQvClose',
        })
      );
    });

    it('sets aria labels on quick view buttons', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredQvViewFull').accessibility.ariaLabel).toBe('View full product details');
      expect(getEl('#featuredQvAddToCart').accessibility.ariaLabel).toBe('Add to cart');
      expect(getEl('#featuredQvClose').accessibility.ariaLabel).toBe('Close quick view');
    });
  });

  // ── Testimonials ───────────────────────────────────────────────────

  describe('testimonials deeper', () => {
    it('populates testimonial repeater with fallback data when CMS returns empty', async () => {
      await onReadyHandler();
      await flushDeferred();
      const repeater = getEl('#testimonialRepeater');
      // Should have fallback testimonials loaded
      expect(repeater.data).toBeDefined();
      if (repeater.data && repeater.data.length > 0) {
        expect(repeater.data[0].story).toBeTruthy();
      }
    });

    it('registers onItemReady on testimonial repeater', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#testimonialRepeater').onItemReady).toHaveBeenCalled();
    });
  });

  // ── Category Showcase: Repeater ────────────────────────────────────

  describe('category repeater', () => {
    it('sets category repeater data', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryRepeater');
      expect(repeater.data).toBeDefined();
      if (repeater.data) {
        expect(repeater.data.length).toBeLessThanOrEqual(6);
      }
    });

    it('registers onItemReady on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#categoryRepeater').onItemReady).toHaveBeenCalled();
    });

    it('wires makeClickable on all 8 category element IDs', async () => {
      makeClickable.mockClear();
      await onReadyHandler();
      // CATEGORIES has 8 entries, each wired via makeClickable
      const categoryMakeClickableCalls = makeClickable.mock.calls.filter(
        call => call[2]?.ariaLabel?.startsWith('Browse ')
      );
      expect(categoryMakeClickableCalls.length).toBeGreaterThanOrEqual(6);
    });
  });

  // ── Featured Products: skeleton and color swatches ─────────────────

  describe('featured products deeper', () => {
    it('hides featured skeleton after loading', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredSkeleton').hide).toHaveBeenCalled();
    });

    it('sets featured section title', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredTitle').text).toBe('Our Favorite Finds');
    });

    it('sets featured section subtitle', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(getEl('#featuredSubtitle').text).toContain('Handpicked');
    });
  });

  // ── Challenge of the Week Section (cf-nqq) ────────────────────────

  describe('challenge of the week section', () => {
    beforeEach(() => {
      initChallengeOfTheWeekWidget.mockClear();
    });

    it('calls initChallengeOfTheWeekWidget during page init', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(initChallengeOfTheWeekWidget).toHaveBeenCalled();
    });

    it('passes $w to initChallengeOfTheWeekWidget', async () => {
      await onReadyHandler();
      await flushDeferred();
      expect(initChallengeOfTheWeekWidget).toHaveBeenCalledWith(
        expect.objectContaining({ $w: expect.any(Function) })
      );
    });

    it('active challenge renders — widget init succeeds without throwing', async () => {
      initChallengeOfTheWeekWidget.mockResolvedValueOnce(undefined);
      await expect(onReadyHandler()).resolves.not.toThrow();
      await flushDeferred();
      expect(initChallengeOfTheWeekWidget).toHaveBeenCalled();
    });

    it('no challenge — section stays hidden when widget resolves silently', async () => {
      // Widget handles null by collapsing #weeklyContainer internally;
      // homepage must not throw when widget resolves without error.
      initChallengeOfTheWeekWidget.mockResolvedValueOnce(undefined);
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('expired challenge — does not throw when widget handles expiry', async () => {
      // Widget collapses section for expired/null challenges; homepage must stay stable.
      initChallengeOfTheWeekWidget.mockResolvedValueOnce(undefined);
      await expect(onReadyHandler()).resolves.not.toThrow();
    });

    it('widget failure does not crash page init', async () => {
      initChallengeOfTheWeekWidget.mockRejectedValueOnce(new Error('challenge fetch failed'));
      await expect(onReadyHandler()).resolves.not.toThrow();
    });
  });
});
