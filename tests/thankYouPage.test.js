import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress } from './fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn((effect, opts) => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
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

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn().mockResolvedValue([]),
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

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7',
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    coral: '#E8845C',
    success: '#28a745',
    mutedBrown: '#8B7355',
  },
  typography: {
    h2: { weight: 700 },
  },
}));

vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((products) => products),
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  sanitizeText: vi.fn((text, maxLen) => {
    if (!text) return '';
    return String(text).slice(0, maxLen);
  }),
}));

vi.mock('backend/browseAbandonment.web', () => ({
  markSessionConverted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn().mockResolvedValue({ success: true, referralCode: 'ABC12345' }),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/dataService.web', () => ({
  scheduleReviewRequest: vi.fn().mockResolvedValue(undefined),
  submitReview: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/testimonialService.web', () => ({
  submitTestimonial: vi.fn().mockResolvedValue({ success: true }),
}));

import { getFeaturedProducts } from 'backend/productRecommendations.web';
import { trackPurchaseComplete, trackSocialShare, trackNewsletterSignup, trackReferralAction } from 'public/engagementTracker';
import { firePurchase, fireCustomEvent } from 'public/ga4Tracking';
import { validateEmail, sanitizeText } from 'public/validators.js';
import { markSessionConverted } from 'backend/browseAbandonment.web';
import { submitContactForm } from 'backend/contactSubmissions.web';
import { submitTestimonial } from 'backend/testimonialService.web';
import { makeClickable } from 'public/a11yHelpers';
import { limitForViewport } from 'public/mobileHelpers';
import { getReferralLink } from 'backend/referralService.web';
import { submitReview } from 'backend/dataService.web';

// Mock data defined after imports (vi.mock factories are hoisted above const)
const mockFeaturedProducts = [futonFrame, wallHuggerFrame, futonMattress];

const mockOrderContext = {
  orderId: 'order-12345',
  total: 899.00,
  lineItems: [
    { _id: 'item-1', name: 'Eureka Futon Frame', price: 499, quantity: 1 },
    { _id: 'item-2', name: 'Moonshadow Mattress', price: 400, quantity: 1 },
  ],
};

// Override the wix-window-frontend mock to include lightbox context
vi.mock('wix-window-frontend', () => ({
  default: {
    openLightbox: vi.fn(() => Promise.resolve()),
    scrollTo: vi.fn(() => Promise.resolve()),
    trackEvent: vi.fn(),
    copyToClipboard: vi.fn(() => Promise.resolve()),
    getBoundingRect: vi.fn(() => Promise.resolve({ window: { width: 1024, height: 768 } })),
    formFactor: 'Desktop',
    viewMode: 'Site',
    rendering: { env: 'browser' },
    locale: 'en',
    lightbox: {
      getContext: () => mockOrderContext,
    },
  },
  openLightbox: vi.fn(() => Promise.resolve()),
  scrollTo: vi.fn(() => Promise.resolve()),
  trackEvent: vi.fn(),
  copyToClipboard: vi.fn(() => Promise.resolve()),
  getBoundingRect: vi.fn(() => Promise.resolve({ window: { width: 1024, height: 768 } })),
  formFactor: 'Desktop',
  viewMode: 'Site',
  rendering: { env: 'browser' },
  locale: 'en',
  lightbox: {
    getContext: () => mockOrderContext,
  },
  openUrl: vi.fn(),
}));

// Mock wix-crm-frontend
vi.mock('wix-crm-frontend', () => ({
  contacts: {
    appendOrCreateContact: vi.fn().mockResolvedValue({ contactId: 'c-001' }),
  },
}));

// Mock newsletterService.web (used by newsletter signup section)
vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
}));

// Mock wix-members-frontend
vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn().mockResolvedValue({
      loginEmail: 'buyer@example.com',
      contactDetails: { emails: ['buyer@example.com'] },
    }),
  },
}));

// Mock wix-location-frontend (for post-purchase suggestions navigation)
vi.mock('wix-location-frontend', () => ({
  default: {
    to: vi.fn(),
    baseUrl: 'https://www.carolinafutons.com',
    path: [],
    query: {},
  },
  to: vi.fn(),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Thank You Page', () => {
  beforeAll(async () => {
    // Provide sessionStorage mock
    globalThis.sessionStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
      writable: true,
      configurable: true,
    });
    await import('../src/pages/Thank You Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    getFeaturedProducts.mockResolvedValue([...mockFeaturedProducts]);
    submitTestimonial.mockResolvedValue({ success: true });
    getReferralLink.mockResolvedValue({ success: true, referralCode: 'ABC12345' });
    submitReview.mockResolvedValue({ success: true });
    globalThis.sessionStorage.getItem.mockReturnValue(null);
  });

  // ── Order Summary ─────────────────────────────────────────────

  describe('order summary', () => {
    it('sets thank you title', async () => {
      await onReadyHandler();
      expect(getEl('#thankYouTitle').text).toBe('Thank You for Your Order!');
    });

    it('sets order confirmation message', async () => {
      await onReadyHandler();
      expect(getEl('#thankYouMessage').text).toContain('order has been confirmed');
      expect(getEl('#thankYouMessage').text).toContain('shipping confirmation email');
    });

    it('sets contact info for questions', async () => {
      await onReadyHandler();
      expect(getEl('#orderContactInfo').text).toContain('(828) 252-9449');
      expect(getEl('#orderContactInfo').text).toContain('Wed-Sat');
    });

    it('sets order number from context', async () => {
      await onReadyHandler();
      expect(getEl('#orderNumber').text).toContain('order-12345');
    });
  });

  // ── Purchase Tracking ─────────────────────────────────────────

  describe('purchase tracking', () => {
    it('tracks purchase completion with order ID and total', async () => {
      await onReadyHandler();
      expect(trackPurchaseComplete).toHaveBeenCalledWith('order-12345', 899.00);
    });

    it('fires GA4 purchase event', async () => {
      await onReadyHandler();
      expect(firePurchase).toHaveBeenCalledWith(expect.objectContaining({
        _id: 'order-12345',
        totals: { total: 899.00 },
      }));
    });

    it('passes line items to GA4 purchase event', async () => {
      await onReadyHandler();
      expect(firePurchase).toHaveBeenCalledWith(expect.objectContaining({
        lineItems: mockOrderContext.lineItems,
      }));
    });
  });

  // ── Browse Abandonment Conversion ─────────────────────────────

  describe('browse abandonment conversion', () => {
    it('marks session as converted when browse session exists', async () => {
      globalThis.sessionStorage.getItem.mockReturnValue('session-abc');
      await onReadyHandler();
      expect(markSessionConverted).toHaveBeenCalledWith('session-abc');
    });

    it('removes browse session from storage after marking converted', async () => {
      globalThis.sessionStorage.getItem.mockReturnValue('session-abc');
      await onReadyHandler();
      expect(globalThis.sessionStorage.removeItem).toHaveBeenCalledWith('cf_browse_session');
    });

    it('skips conversion marking when no browse session exists', async () => {
      globalThis.sessionStorage.getItem.mockReturnValue(null);
      await onReadyHandler();
      expect(markSessionConverted).not.toHaveBeenCalled();
    });
  });

  // ── Brenda's Message ──────────────────────────────────────────

  describe('Brenda message section', () => {
    it('sets Brenda section title', async () => {
      await onReadyHandler();
      expect(getEl('#brendaTitle').text).toBe('A Note from Brenda');
    });

    it('sets Brenda personal message with signature', async () => {
      await onReadyHandler();
      expect(getEl('#brendaMessage').text).toContain('Carolina Futons');
      expect(getEl('#brendaMessage').text).toContain('Brenda Deal, Owner');
    });

    it('expands Brenda message section', async () => {
      await onReadyHandler();
      expect(getEl('#brendaMessageSection').expand).toHaveBeenCalled();
    });
  });

  // ── Delivery Timeline ─────────────────────────────────────────

  describe('delivery timeline', () => {
    it('sets delivery estimate text with date range', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryEstimateText').text).toContain('Estimated delivery');
      // Should contain month names (business day calculation)
      expect(getEl('#deliveryEstimateText').text).toMatch(/\w+ \d+/);
    });

    it('sets order confirmed step as complete', async () => {
      await onReadyHandler();
      const step1 = getEl('#step1');
      expect(step1.text).toBe('Order confirmed');
      expect(step1.accessibility.ariaLabel).toContain('completed');
    });

    it('sets preparing step as active', async () => {
      await onReadyHandler();
      const step2 = getEl('#step2');
      expect(step2.text).toBe('Preparing your items');
      expect(step2.accessibility.ariaLabel).toContain('in progress');
      expect(step2.accessibility.ariaCurrent).toBe('step');
    });

    it('sets shipped and delivered steps as pending', async () => {
      await onReadyHandler();
      expect(getEl('#step3').text).toBe('Shipped with tracking');
      expect(getEl('#step3').accessibility.ariaLabel).toContain('pending');
      expect(getEl('#step4').text).toBe('Delivered to your door');
      expect(getEl('#step4').accessibility.ariaLabel).toContain('pending');
    });

    it('includes step numbers in ARIA labels', async () => {
      await onReadyHandler();
      expect(getEl('#step1').accessibility.ariaLabel).toContain('Step 1 of 4');
      expect(getEl('#step4').accessibility.ariaLabel).toContain('Step 4 of 4');
    });

    it('expands delivery timeline section', async () => {
      await onReadyHandler();
      expect(getEl('#deliveryTimeline').expand).toHaveBeenCalled();
    });
  });

  // ── Social Sharing ────────────────────────────────────────────

  describe('social sharing', () => {
    it('sets share prompt text', async () => {
      await onReadyHandler();
      expect(getEl('#shareText').text).toContain('Love your new');
    });

    it('sets ARIA labels on social share buttons', async () => {
      await onReadyHandler();
      expect(getEl('#shareFacebook').accessibility.ariaLabel).toContain('Facebook');
      expect(getEl('#sharePinterest').accessibility.ariaLabel).toContain('Pinterest');
      expect(getEl('#shareInstagram').accessibility.ariaLabel).toContain('Instagram');
    });

    it('ARIA labels indicate external links', async () => {
      await onReadyHandler();
      expect(getEl('#shareFacebook').accessibility.ariaLabel).toContain('opens in new window');
      expect(getEl('#sharePinterest').accessibility.ariaLabel).toContain('opens in new window');
    });

    it('registers click handlers on all social buttons', async () => {
      await onReadyHandler();
      expect(getEl('#shareFacebook').onClick).toHaveBeenCalled();
      expect(getEl('#sharePinterest').onClick).toHaveBeenCalled();
      expect(getEl('#shareInstagram').onClick).toHaveBeenCalled();
    });

    it('tracks Facebook share on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareFacebook').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('facebook', 'purchase');
    });

    it('tracks Pinterest share on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#sharePinterest').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('pinterest', 'purchase');
    });

    it('tracks Instagram share on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareInstagram').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('instagram', 'purchase');
    });
  });

  // ── Twitter/X Share ─────────────────────────────────────────

  describe('Twitter/X share', () => {
    it('sets ARIA label on Twitter share button', async () => {
      await onReadyHandler();
      expect(getEl('#shareTwitter').accessibility.ariaLabel).toContain('Twitter');
      expect(getEl('#shareTwitter').accessibility.ariaLabel).toContain('opens in new window');
    });

    it('registers click handler on Twitter share button', async () => {
      await onReadyHandler();
      expect(getEl('#shareTwitter').onClick).toHaveBeenCalled();
    });

    it('tracks Twitter share on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#shareTwitter').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackSocialShare).toHaveBeenCalledWith('twitter', 'purchase');
    });
  });

  // ── Dynamic Share Content ──────────────────────────────────────

  describe('dynamic share content', () => {
    it('includes product names in share text when order context has line items', async () => {
      await onReadyHandler();
      const shareText = getEl('#shareText').text;
      expect(shareText).toContain('Eureka Futon Frame');
    });

    it('falls back to generic share text when no line items', async () => {
      // Mock empty order context
      const wixWindowMod = await import('wix-window-frontend');
      const origGetContext = wixWindowMod.lightbox.getContext;
      wixWindowMod.lightbox.getContext = () => ({ orderId: 'order-999', total: 100, lineItems: [] });
      await onReadyHandler();
      expect(getEl('#shareText').text).toContain('furniture');
      wixWindowMod.lightbox.getContext = origGetContext;
    });
  });

  // ── Newsletter Signup ─────────────────────────────────────────

  describe('newsletter signup', () => {
    it('sets newsletter prompt text', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterPrompt').text).toContain('updates on new products');
    });

    it('sets ARIA labels on newsletter input and button', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterEmail').accessibility.ariaLabel).toContain('email');
      expect(getEl('#newsletterSignup').accessibility.ariaLabel).toContain('newsletter');
    });

    it('registers click handler on signup button', async () => {
      await onReadyHandler();
      expect(getEl('#newsletterSignup').onClick).toHaveBeenCalled();
    });

    it('shows error for empty email', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = '';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#newsletterError').text).toContain('valid email');
      expect(getEl('#newsletterError').show).toHaveBeenCalled();
    });

    it('shows error for invalid email format', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = 'not-an-email';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#newsletterError').text).toContain('valid email');
    });

    it('shows error for whitespace-only email', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = '   ';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#newsletterError').text).toContain('valid email');
    });

    it('tracks newsletter signup on success', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackNewsletterSignup).toHaveBeenCalledWith('thank_you_page');
    });

    it('fires GA4 newsletter signup event', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(fireCustomEvent).toHaveBeenCalledWith('newsletter_signup', { source: 'thank_you_page' });
    });

    it('shows success message and disables button after signup', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#newsletterSuccess').text).toContain('subscribed');
      expect(getEl('#newsletterSuccess').show).toHaveBeenCalled();
      expect(getEl('#newsletterSignup').disable).toHaveBeenCalled();
    });

    it('trims whitespace from email before validation', async () => {
      await onReadyHandler();
      getEl('#newsletterEmail').value = '  test@example.com  ';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackNewsletterSignup).toHaveBeenCalled();
    });

    it('handles newsletter service failure silently without showing success', async () => {
      const { subscribeToNewsletter } = await import('backend/newsletterService.web');
      subscribeToNewsletter.mockRejectedValueOnce(new Error('Service unavailable'));
      await onReadyHandler();
      getEl('#newsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0][0];
      await clickHandler();
      // Service failure is caught — success message should NOT be shown
      expect(getEl('#newsletterSuccess').show).not.toHaveBeenCalled();
      // Tracking should NOT fire since signup didn't complete
      expect(trackNewsletterSignup).not.toHaveBeenCalled();
    });
  });

  // ── Referral Section ──────────────────────────────────────────

  describe('referral section', () => {
    it('sets referral title and message', async () => {
      await onReadyHandler();
      expect(getEl('#referralTitle').text).toBe('Share the Love');
      expect(getEl('#referralMessage').text).toContain('mountain-town prices');
    });

    it('sets ARIA labels on referral buttons', async () => {
      await onReadyHandler();
      expect(getEl('#referralCopyBtn').accessibility.ariaLabel).toContain('referral link');
      expect(getEl('#referralEmailBtn').accessibility.ariaLabel).toContain('referral via email');
    });

    it('registers click handlers on referral buttons', async () => {
      await onReadyHandler();
      expect(getEl('#referralCopyBtn').onClick).toHaveBeenCalled();
      expect(getEl('#referralEmailBtn').onClick).toHaveBeenCalled();
    });

    it('tracks copy link action on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#referralCopyBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(trackReferralAction).toHaveBeenCalledWith('copy_link');
    });

    it('tracks email share action on click', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#referralEmailBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(trackReferralAction).toHaveBeenCalledWith('email_share');
    });

    it('copies referral link to clipboard', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#referralCopyBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('carolinafutons.com')
      );
    });

    it('expands referral section', async () => {
      await onReadyHandler();
      expect(getEl('#referralSection').expand).toHaveBeenCalled();
    });
  });

  // ── Referral Unique Codes ────────────────────────────────────

  describe('referral unique codes', () => {
    it('calls getReferralLink on init for logged-in users', async () => {
      await onReadyHandler();
      expect(getReferralLink).toHaveBeenCalled();
    });

    it('displays unique referral code in message', async () => {
      await onReadyHandler();
      expect(getEl('#referralMessage').text).toContain('ABC12345');
    });

    it('copy button copies unique referral URL', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#referralCopyBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('ref=ABC12345')
      );
    });

    it('shows referral incentive amounts', async () => {
      await onReadyHandler();
      // Should mention the credit amounts
      expect(getEl('#referralMessage').text).toMatch(/\$\d+/);
    });

    it('falls back to generic link when getReferralLink fails', async () => {
      getReferralLink.mockRejectedValue(new Error('Not logged in'));
      await onReadyHandler();
      const clickHandler = getEl('#referralCopyBtn').onClick.mock.calls[0][0];
      clickHandler();
      // Should still copy a link (generic fallback)
      expect(globalThis.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('carolinafutons.com')
      );
    });

    it('falls back when getReferralLink returns failure', async () => {
      getReferralLink.mockResolvedValue({ success: false, error: 'Not a member' });
      await onReadyHandler();
      // Should still show section with generic message
      expect(getEl('#referralSection').expand).toHaveBeenCalled();
    });
  });

  // ── Star Rating Review Request ──────────────────────────────

  describe('review request', () => {
    it('sets review section title and prompt', async () => {
      await onReadyHandler();
      expect(getEl('#reviewTitle').text).toContain('Rate');
      expect(getEl('#reviewPrompt').text).toContain('experience');
    });

    it('registers click handlers on 5 star buttons', async () => {
      await onReadyHandler();
      for (let i = 1; i <= 5; i++) {
        expect(getEl(`#reviewStar${i}`).onClick).toHaveBeenCalled();
      }
    });

    it('sets ARIA labels on star buttons', async () => {
      await onReadyHandler();
      expect(getEl('#reviewStar1').accessibility.ariaLabel).toContain('1');
      expect(getEl('#reviewStar5').accessibility.ariaLabel).toContain('5');
    });

    it('clicking star updates rating display', async () => {
      await onReadyHandler();
      const starHandler = getEl('#reviewStar4').onClick.mock.calls[0][0];
      starHandler();
      expect(getEl('#reviewRating').text).toContain('4');
    });

    it('registers click handler on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#reviewSubmitBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#reviewSubmitBtn').accessibility.ariaLabel).toContain('Submit');
    });

    it('shows error when submitting without rating', async () => {
      await onReadyHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewError').text).toContain('select a rating');
      expect(getEl('#reviewError').show).toHaveBeenCalled();
    });

    it('submits review with rating and order ID', async () => {
      await onReadyHandler();
      // Select 4 stars first
      const starHandler = getEl('#reviewStar4').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(submitReview).toHaveBeenCalledWith('order-12345', 4, '');
    });

    it('disables submit button while submitting', async () => {
      await onReadyHandler();
      const starHandler = getEl('#reviewStar4').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewSubmitBtn').disable).toHaveBeenCalled();
    });

    it('shows success message on successful review', async () => {
      await onReadyHandler();
      const starHandler = getEl('#reviewStar5').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewSuccess').text).toContain('Thank you');
      expect(getEl('#reviewSuccess').show).toHaveBeenCalled();
    });

    it('hides form on successful submission', async () => {
      await onReadyHandler();
      const starHandler = getEl('#reviewStar4').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewSubmitBtn').hide).toHaveBeenCalled();
    });

    it('shows error on submitReview failure', async () => {
      submitReview.mockResolvedValue({ success: false, error: 'Server error' });
      await onReadyHandler();
      const starHandler = getEl('#reviewStar3').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewError').text).toBe('Server error');
      expect(getEl('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('shows generic error when no specific error provided', async () => {
      submitReview.mockResolvedValue({ success: false });
      await onReadyHandler();
      const starHandler = getEl('#reviewStar3').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewError').text).toContain('Something went wrong');
    });

    it('re-enables button on exception during submission', async () => {
      submitReview.mockRejectedValue(new Error('Network failure'));
      await onReadyHandler();
      const starHandler = getEl('#reviewStar4').onClick.mock.calls[0][0];
      starHandler();
      const clickHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('expands review section', async () => {
      await onReadyHandler();
      expect(getEl('#reviewSection').expand).toHaveBeenCalled();
    });
  });

  // ── Post-Purchase Suggestions ─────────────────────────────────

  describe('post-purchase suggestions', () => {
    it('fetches 4 featured products', async () => {
      await onReadyHandler();
      expect(getFeaturedProducts).toHaveBeenCalledWith(4);
    });

    it('sets suggestions heading', async () => {
      await onReadyHandler();
      expect(getEl('#postPurchaseHeading').text).toBe('You Might Also Love');
    });

    it('registers onItemReady for product repeater', async () => {
      await onReadyHandler();
      expect(getEl('#postPurchaseRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets product image, name, and price', async () => {
      await onReadyHandler();
      const repeater = getEl('#postPurchaseRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', src: '', alt: '', onClick: vi.fn() };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#ppImage'].src).toBe(futonFrame.mainMedia);
      expect(itemElements['#ppImage'].alt).toContain('Eureka Futon Frame');
      expect(itemElements['#ppName'].text).toBe(futonFrame.name);
      expect(itemElements['#ppPrice'].text).toBe(futonFrame.formattedPrice);
    });

    it('makes product images clickable with navigation', async () => {
      await onReadyHandler();
      const repeater = getEl('#postPurchaseRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', src: '', alt: '', onClick: vi.fn() };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(makeClickable).toHaveBeenCalledWith(
        itemElements['#ppImage'],
        expect.any(Function),
        expect.objectContaining({ ariaLabel: expect.stringContaining('Eureka Futon Frame') })
      );
    });

    it('applies viewport limit to repeater data', async () => {
      await onReadyHandler();
      expect(limitForViewport).toHaveBeenCalledWith(
        mockFeaturedProducts,
        { mobile: 2, tablet: 3, desktop: 4 }
      );
    });

    it('handles empty product list gracefully', async () => {
      getFeaturedProducts.mockResolvedValue([]);
      await onReadyHandler();
      // Should not crash, repeater should not be populated
      // (repeater check: products.length === 0 returns early)
    });

    it('handles backend error gracefully', async () => {
      getFeaturedProducts.mockRejectedValue(new Error('Network error'));
      await onReadyHandler();
      // Should not crash — error is caught in the page
    });
  });

  // ── Assembly Guide Link ───────────────────────────────────────

  describe('assembly guide link', () => {
    it('sets assembly guide title and text', async () => {
      await onReadyHandler();
      expect(getEl('#assemblyGuideTitle').text).toBe('Assembly & Care Guides');
      expect(getEl('#assemblyGuideText').text).toContain('step-by-step instructions');
    });

    it('sets ARIA label on assembly guide button', async () => {
      await onReadyHandler();
      expect(getEl('#assemblyGuideBtn').accessibility.ariaLabel).toContain('assembly');
    });

    it('registers click handler on assembly guide button', async () => {
      await onReadyHandler();
      expect(getEl('#assemblyGuideBtn').onClick).toHaveBeenCalled();
    });

    it('expands assembly guide section', async () => {
      await onReadyHandler();
      expect(getEl('#assemblyGuideSection').expand).toHaveBeenCalled();
    });
  });

  // ── Testimonial Submission ────────────────────────────────────

  describe('testimonial submission', () => {
    it('sets testimonial section title and prompt', async () => {
      await onReadyHandler();
      expect(getEl('#testimonialTitle').text).toBe('Share Your Experience');
      expect(getEl('#testimonialPrompt').text).toContain('Love your new furniture');
    });

    it('sets ARIA labels on testimonial inputs', async () => {
      await onReadyHandler();
      expect(getEl('#testimonialNameInput').accessibility.ariaLabel).toContain('name');
      expect(getEl('#testimonialStoryInput').accessibility.ariaLabel).toContain('testimonial');
      expect(getEl('#testimonialSubmitBtn').accessibility.ariaLabel).toContain('Submit');
    });

    it('registers click handler on submit button', async () => {
      await onReadyHandler();
      expect(getEl('#testimonialSubmitBtn').onClick).toHaveBeenCalled();
    });

    it('rejects story shorter than 10 characters', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'Short';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialError').text).toContain('at least 10 characters');
      expect(getEl('#testimonialError').show).toHaveBeenCalled();
    });

    it('rejects empty story', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = '';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialError').show).toHaveBeenCalled();
    });

    it('submits testimonial with sanitized input', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John Doe';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(submitTestimonial).toHaveBeenCalledWith(expect.objectContaining({
        source: 'thank_you',
      }));
      expect(sanitizeText).toHaveBeenCalled();
    });

    it('disables submit button while submitting', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialSubmitBtn').disable).toHaveBeenCalled();
    });

    it('shows success message on successful submission', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialSuccess').text).toContain('Thank you');
      expect(getEl('#testimonialSuccess').show).toHaveBeenCalled();
    });

    it('hides form fields on successful submission', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialNameInput').hide).toHaveBeenCalled();
      expect(getEl('#testimonialStoryInput').hide).toHaveBeenCalled();
      expect(getEl('#testimonialSubmitBtn').hide).toHaveBeenCalled();
    });

    it('shows error and re-enables button on failed submission', async () => {
      submitTestimonial.mockResolvedValue({ success: false, error: 'Server error' });
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialError').text).toBe('Server error');
      expect(getEl('#testimonialError').show).toHaveBeenCalled();
      expect(getEl('#testimonialSubmitBtn').enable).toHaveBeenCalled();
    });

    it('shows generic error message when no specific error provided', async () => {
      submitTestimonial.mockResolvedValue({ success: false });
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialError').text).toContain('Something went wrong');
    });

    it('re-enables button on exception during submission', async () => {
      submitTestimonial.mockRejectedValue(new Error('Network failure'));
      await onReadyHandler();
      getEl('#testimonialNameInput').value = 'John';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#testimonialSubmitBtn').enable).toHaveBeenCalled();
    });

    it('expands testimonial section', async () => {
      await onReadyHandler();
      expect(getEl('#testimonialSection').expand).toHaveBeenCalled();
    });

    it('submits with undefined name when name is empty', async () => {
      await onReadyHandler();
      getEl('#testimonialNameInput').value = '';
      getEl('#testimonialStoryInput').value = 'This is a wonderful futon frame, very comfortable!';
      const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(submitTestimonial).toHaveBeenCalledWith(expect.objectContaining({
        name: undefined,
      }));
    });
  });

  // ── Section Resilience ────────────────────────────────────────

  describe('section resilience', () => {
    it('page initializes even if individual sections fail', async () => {
      // Make getFeaturedProducts fail — other sections should still init
      getFeaturedProducts.mockRejectedValue(new Error('Network error'));
      await onReadyHandler();
      // Core sections should still initialize
      expect(getEl('#thankYouTitle').text).toBe('Thank You for Your Order!');
      expect(getEl('#brendaTitle').text).toBe('A Note from Brenda');
    });

    it('uses Promise.allSettled so one failure does not block others', async () => {
      // All sections should attempt initialization even if one fails
      getFeaturedProducts.mockRejectedValue(new Error('fail'));
      await onReadyHandler();
      // Delivery timeline should still work
      expect(getEl('#step1').text).toBe('Order confirmed');
      // Social sharing should still work
      expect(getEl('#shareText').text).toContain('Love your new');
    });
  });
});
