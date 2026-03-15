import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks – declared BEFORE any page import                           */
/* ------------------------------------------------------------------ */

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn(() => Promise.resolve([
    { _id: 'p1', name: 'Test Product', mainMedia: 'img.jpg', formattedPrice: '$199', slug: 'test-product' },
  ])),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('public/engagementTracker', () => ({
  trackPurchaseComplete: vi.fn(),
  trackSocialShare: vi.fn(),
  trackNewsletterSignup: vi.fn(),
  trackReferralAction: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  firePurchase: vi.fn(),
  fireCustomEvent: vi.fn(),
}));

vi.mock('backend/analyticsHelpers.web', () => ({
  trackPurchase: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { success: '#28a745', mountainBlue: '#4a7c9b', coral: '#e76f51', mutedBrown: '#a68a6e' },
  typography: { h2: { weight: 700 } },
}));

vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((arr) => arr),
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn(() => true),
  sanitizeText: vi.fn((t) => t),
}));

vi.mock('backend/browseAbandonment.web', () => ({
  markSessionConverted: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn(() => Promise.resolve({ success: true, referralCode: 'REF123' })),
}));

vi.mock('backend/reviewsService.web', () => ({
  submitReview: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  finalizeGiftCardRedemption: vi.fn(() => Promise.resolve({ success: true, amountApplied: 0 })),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  default: {
    lightbox: {
      getContext: vi.fn(() => ({
        orderId: 'ORD-123',
        total: 299.99,
        lineItems: [{ name: 'Futon Frame', catalogItemId: 'prod-1' }],
      })),
    },
  },
  lightbox: {
    getContext: vi.fn(() => ({
      orderId: 'ORD-123',
      total: 299.99,
      lineItems: [{ name: 'Futon Frame', catalogItemId: 'prod-1' }],
    })),
  },
  openUrl: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

vi.mock('backend/testimonialService.web', () => ({
  submitTestimonial: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('backend/dataService.web', () => ({
  scheduleReviewRequest: vi.fn(() => Promise.resolve()),
}));

/* ------------------------------------------------------------------ */
/*  $w mock                                                           */
/* ------------------------------------------------------------------ */

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

/* ------------------------------------------------------------------ */
/*  Import page under test & run onReady                              */
/* ------------------------------------------------------------------ */

beforeAll(async () => {
  await import('../src/pages/Thank You Page.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

async function runOnReady() {
  await onReadyHandler();
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('Thank You Page', () => {
  // ── 1. Initialization ──────────────────────────────────────────────

  describe('initialization', () => {
    it('calls initBackToTop on ready', async () => {
      const { initBackToTop } = await import('public/mobileHelpers');
      await runOnReady();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with thankYou', async () => {
      const { initPageSeo } = await import('public/pageSeo.js');
      await runOnReady();
      expect(initPageSeo).toHaveBeenCalledWith('thankYou');
    });

    it('calls finalizeGiftCardRedemption before sections init', async () => {
      const { finalizeGiftCardRedemption } = await import('public/giftCardHelpers.js');
      await runOnReady();
      expect(finalizeGiftCardRedemption).toHaveBeenCalled();
    });

    it('calls trackPurchaseComplete with order data', async () => {
      const { trackPurchaseComplete } = await import('public/engagementTracker');
      await runOnReady();
      expect(trackPurchaseComplete).toHaveBeenCalledWith('ORD-123', 299.99);
    });

    it('calls firePurchase with order details', async () => {
      const { firePurchase } = await import('public/ga4Tracking');
      await runOnReady();
      expect(firePurchase).toHaveBeenCalledWith(expect.objectContaining({
        _id: 'ORD-123',
        totals: { total: 299.99 },
      }));
    });

    it('calls trackPurchase for each line item', async () => {
      const { trackPurchase } = await import('backend/analyticsHelpers.web');
      await runOnReady();
      expect(trackPurchase).toHaveBeenCalledWith('prod-1');
    });
  });

  // ── 2. Order Summary ──────────────────────────────────────────────

  describe('order summary', () => {
    it('sets thankYouTitle text', async () => {
      await runOnReady();
      expect(getEl('#thankYouTitle').text).toBe('Thank You for Your Order!');
    });

    it('sets thankYouMessage with confirmation text', async () => {
      await runOnReady();
      expect(getEl('#thankYouMessage').text).toContain('Your order has been confirmed');
    });

    it('sets orderNumber text from context', async () => {
      await runOnReady();
      expect(getEl('#orderNumber').text).toBe('Order #ORD-123');
    });

    it('sets orderContactInfo text with phone number', async () => {
      await runOnReady();
      expect(getEl('#orderContactInfo').text).toContain('(828) 252-9449');
    });
  });

  // ── 3. Brenda's Message ────────────────────────────────────────────

  describe('Brenda message', () => {
    it('sets brendaTitle text', async () => {
      await runOnReady();
      expect(getEl('#brendaTitle').text).toBe('A Note from Brenda');
    });

    it('sets brendaMessage with personal text', async () => {
      await runOnReady();
      expect(getEl('#brendaMessage').text).toContain('Thank you for choosing Carolina Futons');
    });

    it('expands brendaMessageSection', async () => {
      await runOnReady();
      expect(getEl('#brendaMessageSection').expand).toHaveBeenCalled();
    });
  });

  // ── 4. Delivery Timeline ──────────────────────────────────────────

  describe('delivery timeline', () => {
    it('sets deliveryEstimateText with date range', async () => {
      await runOnReady();
      expect(getEl('#deliveryEstimateText').text).toMatch(/Estimated delivery:/);
    });

    it('sets step1 text to Order confirmed', async () => {
      await runOnReady();
      expect(getEl('#step1').text).toBe('Order confirmed');
    });

    it('sets step2 text to Preparing your items', async () => {
      await runOnReady();
      expect(getEl('#step2').text).toBe('Preparing your items');
    });

    it('sets step3 text to Shipped with tracking', async () => {
      await runOnReady();
      expect(getEl('#step3').text).toBe('Shipped with tracking');
    });

    it('sets step4 text to Delivered to your door', async () => {
      await runOnReady();
      expect(getEl('#step4').text).toBe('Delivered to your door');
    });

    it('colors completed step with success color', async () => {
      await runOnReady();
      expect(getEl('#step1').style.color).toBe('#28a745');
    });

    it('colors active step with mountainBlue and bold weight', async () => {
      await runOnReady();
      expect(getEl('#step2').style.color).toBe('#4a7c9b');
      expect(getEl('#step2').style.fontWeight).toBe('700');
    });
  });

  // ── 5. Social Sharing ─────────────────────────────────────────────

  describe('social sharing', () => {
    it('sets ARIA label on shareFacebook', async () => {
      await runOnReady();
      expect(getEl('#shareFacebook').accessibility.ariaLabel).toBe('Share on Facebook (opens in new window)');
    });

    it('sets ARIA label on sharePinterest', async () => {
      await runOnReady();
      expect(getEl('#sharePinterest').accessibility.ariaLabel).toBe('Share on Pinterest (opens in new window)');
    });

    it('sets ARIA label on shareInstagram', async () => {
      await runOnReady();
      expect(getEl('#shareInstagram').accessibility.ariaLabel).toBe('Follow us on Instagram (opens in new window)');
    });

    it('sets ARIA label on shareTwitter', async () => {
      await runOnReady();
      expect(getEl('#shareTwitter').accessibility.ariaLabel).toBe('Share on Twitter (opens in new window)');
    });

    it('registers onClick on all 4 share buttons', async () => {
      await runOnReady();
      expect(getEl('#shareFacebook').onClick).toHaveBeenCalled();
      expect(getEl('#sharePinterest').onClick).toHaveBeenCalled();
      expect(getEl('#shareInstagram').onClick).toHaveBeenCalled();
      expect(getEl('#shareTwitter').onClick).toHaveBeenCalled();
    });
  });

  // ── 6. Newsletter Signup ──────────────────────────────────────────

  describe('newsletter signup', () => {
    it('sets newsletterPrompt text', async () => {
      await runOnReady();
      expect(getEl('#newsletterPrompt').text).toBe('Get updates on new products and exclusive deals');
    });

    it('sets ARIA label on newsletterEmail input', async () => {
      await runOnReady();
      expect(getEl('#newsletterEmail').accessibility.ariaLabel).toBe('Enter your email for newsletter');
    });

    it('sets ARIA label on newsletterSignup button', async () => {
      await runOnReady();
      expect(getEl('#newsletterSignup').accessibility.ariaLabel).toBe('Subscribe to newsletter');
    });

    it('registers onClick on newsletterSignup button', async () => {
      await runOnReady();
      expect(getEl('#newsletterSignup').onClick).toHaveBeenCalled();
    });
  });

  // ── 7. Referral Section ───────────────────────────────────────────

  describe('referral section', () => {
    it('sets referralTitle text', async () => {
      await runOnReady();
      expect(getEl('#referralTitle').text).toBe('Share the Love');
    });

    it('sets referralMessage with referral code', async () => {
      await runOnReady();
      expect(getEl('#referralMessage').text).toContain('REF123');
    });

    it('registers onClick on referralCopyBtn', async () => {
      await runOnReady();
      expect(getEl('#referralCopyBtn').onClick).toHaveBeenCalled();
    });

    it('registers onClick on referralEmailBtn', async () => {
      await runOnReady();
      expect(getEl('#referralEmailBtn').onClick).toHaveBeenCalled();
    });

    it('expands referralSection', async () => {
      await runOnReady();
      expect(getEl('#referralSection').expand).toHaveBeenCalled();
    });
  });

  // ── 8. Post-Purchase Suggestions ──────────────────────────────────

  describe('post-purchase suggestions', () => {
    it('sets postPurchaseHeading text', async () => {
      await runOnReady();
      expect(getEl('#postPurchaseHeading').text).toBe('You Might Also Love');
    });

    it('registers onItemReady on postPurchaseRepeater', async () => {
      await runOnReady();
      expect(getEl('#postPurchaseRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets repeater data from getFeaturedProducts', async () => {
      await runOnReady();
      expect(getEl('#postPurchaseRepeater').data).toEqual(
        expect.arrayContaining([expect.objectContaining({ _id: 'p1' })]),
      );
    });
  });

  // ── 9. Assembly Guide ─────────────────────────────────────────────

  describe('assembly guide', () => {
    it('sets assemblyGuideTitle text', async () => {
      await runOnReady();
      expect(getEl('#assemblyGuideTitle').text).toBe('Assembly & Care Guides');
    });

    it('sets assemblyGuideText with instructions message', async () => {
      await runOnReady();
      expect(getEl('#assemblyGuideText').text).toContain('step-by-step instructions');
    });

    it('registers onClick on assemblyGuideBtn', async () => {
      await runOnReady();
      expect(getEl('#assemblyGuideBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on assemblyGuideBtn', async () => {
      await runOnReady();
      expect(getEl('#assemblyGuideBtn').accessibility.ariaLabel).toBe('View assembly and care guides');
    });
  });

  // ── 10. Testimonial Prompt ────────────────────────────────────────

  describe('testimonial prompt', () => {
    it('sets testimonialTitle text', async () => {
      await runOnReady();
      expect(getEl('#testimonialTitle').text).toBe('Share Your Experience');
    });

    it('sets testimonialPrompt text', async () => {
      await runOnReady();
      expect(getEl('#testimonialPrompt').text).toContain('Love your new furniture');
    });

    it('sets ARIA label on testimonialNameInput', async () => {
      await runOnReady();
      expect(getEl('#testimonialNameInput').accessibility.ariaLabel).toBe('Your name');
    });

    it('sets ARIA label on testimonialStoryInput', async () => {
      await runOnReady();
      expect(getEl('#testimonialStoryInput').accessibility.ariaLabel).toBe('Your testimonial');
    });

    it('sets ARIA label on testimonialSubmitBtn', async () => {
      await runOnReady();
      expect(getEl('#testimonialSubmitBtn').accessibility.ariaLabel).toBe('Submit testimonial');
    });

    it('registers onClick on testimonialSubmitBtn', async () => {
      await runOnReady();
      expect(getEl('#testimonialSubmitBtn').onClick).toHaveBeenCalled();
    });
  });

  // ── 11. Review Request ────────────────────────────────────────────

  describe('review request', () => {
    it('sets reviewTitle text', async () => {
      await runOnReady();
      expect(getEl('#reviewTitle').text).toBe('Rate Your Experience');
    });

    it('sets reviewPrompt text', async () => {
      await runOnReady();
      expect(getEl('#reviewPrompt').text).toContain('How was your shopping experience');
    });

    it('sets ARIA labels on star buttons', async () => {
      await runOnReady();
      expect(getEl('#reviewStar1').accessibility.ariaLabel).toBe('1 star');
      expect(getEl('#reviewStar2').accessibility.ariaLabel).toBe('2 stars');
      expect(getEl('#reviewStar5').accessibility.ariaLabel).toBe('5 stars');
    });

    it('registers onClick on all 5 star buttons', async () => {
      await runOnReady();
      for (let i = 1; i <= 5; i++) {
        expect(getEl(`#reviewStar${i}`).onClick).toHaveBeenCalled();
      }
    });

    it('sets ARIA label on reviewSubmitBtn', async () => {
      await runOnReady();
      expect(getEl('#reviewSubmitBtn').accessibility.ariaLabel).toBe('Submit your rating');
    });

    it('registers onClick on reviewSubmitBtn', async () => {
      await runOnReady();
      expect(getEl('#reviewSubmitBtn').onClick).toHaveBeenCalled();
    });
  });
});
