/**
 * Tests for Thank You Page element hookup — CF-03jx
 * Covers: #deliveryTimeline, #deliveryEstimateText, #step1–#step4,
 * #testimonialSection/Title/Prompt/NameInput/StoryInput/SubmitBtn/Error/Success,
 * #thankYouTitle, #thankYouMessage, #orderContactInfo,
 * #brendaMessageSection, #brendaTitle, #brendaMessage,
 * #shareText, #shareFacebook, #sharePinterest, #shareInstagram, #shareTwitter,
 * #newsletterPrompt, #newsletterEmail, #newsletterSignup, #newsletterError, #newsletterSuccess,
 * #referralSection, #referralTitle, #referralMessage, #referralCopyBtn, #referralEmailBtn,
 * #assemblyGuideSection, #assemblyGuideTitle, #assemblyGuideText, #assemblyGuideBtn,
 * #reviewSection, #reviewTitle, #reviewPrompt, #reviewStar1–#reviewStar5,
 * #reviewRating, #reviewSubmitBtn, #reviewError, #reviewSuccess,
 * #postPurchaseHeading, #postPurchaseRepeater
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
    accessibility: { ariaLabel: '', ariaCurrent: '', role: '' },
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn(() => Promise.resolve([])),
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
    sand: '#E8D5B7', espresso: '#3A2518', mountainBlue: '#5B8FA8',
    coral: '#E8845C', success: '#28a745', mutedBrown: '#8B7355',
  },
  typography: { h2: { weight: 700 } },
}));

vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((p) => p),
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /\S+@\S+\.\S+/.test(email)),
  sanitizeText: vi.fn((text, maxLen) => (text || '').substring(0, maxLen)),
}));

vi.mock('backend/analyticsHelpers.web', () => ({
  trackPurchase: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/browseAbandonment.web', () => ({
  markSessionConverted: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/referralService.web', () => ({
  getReferralLink: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('backend/reviewsService.web', () => ({
  submitReview: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  finalizeGiftCardRedemption: vi.fn(() => Promise.resolve({ success: true, amountApplied: 0 })),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('backend/testimonialService.web', () => ({
  submitTestimonial: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/dataService.web', () => ({
  scheduleReviewRequest: vi.fn(() => Promise.resolve()),
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: { getMember: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

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
  },
  lightbox: { getContext: vi.fn(() => null) },
  openUrl: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

async function loadPage() {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
  await import('../src/pages/Thank You Page.js');
  if (onReadyHandler) await onReadyHandler();
  await new Promise(r => setTimeout(r, 50));
}

// ── Delivery Timeline Steps ─────────────────────────────────────────

describe('Thank You Page — delivery timeline (#step1–#step4)', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets text on all 4 delivery steps', async () => {
    await loadPage();

    expect(getEl('#step1').text).toBe('Order confirmed');
    expect(getEl('#step2').text).toBe('Preparing your items');
    expect(getEl('#step3').text).toBe('Shipped with tracking');
    expect(getEl('#step4').text).toBe('Delivered to your door');
  });

  it('styles step1 as complete (green/success)', async () => {
    await loadPage();
    expect(getEl('#step1').style.color).toBe('#28a745');
  });

  it('styles step2 as active (mountain blue, bold)', async () => {
    await loadPage();
    expect(getEl('#step2').style.color).toBe('#5B8FA8');
    expect(getEl('#step2').style.fontWeight).toBe('700');
  });

  it('styles step3 and step4 as pending (muted brown)', async () => {
    await loadPage();
    expect(getEl('#step3').style.color).toBe('#8B7355');
    expect(getEl('#step4').style.color).toBe('#8B7355');
  });

  it('sets ARIA labels with step position on all steps', async () => {
    await loadPage();

    expect(getEl('#step1').accessibility.ariaLabel).toContain('Step 1 of 4');
    expect(getEl('#step1').accessibility.ariaLabel).toContain('completed');
    expect(getEl('#step2').accessibility.ariaLabel).toContain('Step 2 of 4');
    expect(getEl('#step2').accessibility.ariaLabel).toContain('in progress');
    expect(getEl('#step3').accessibility.ariaLabel).toContain('Step 3 of 4');
    expect(getEl('#step3').accessibility.ariaLabel).toContain('pending');
    expect(getEl('#step4').accessibility.ariaLabel).toContain('Step 4 of 4');
  });

  it('sets ariaCurrent=step on active step (step2)', async () => {
    await loadPage();
    expect(getEl('#step2').accessibility.ariaCurrent).toBe('step');
  });

  it('expands delivery timeline section', async () => {
    await loadPage();
    expect(getEl('#deliveryTimeline').expand).toHaveBeenCalled();
  });
});

// ── Testimonial Section ─────────────────────────────────────────────

describe('Thank You Page — testimonial elements', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets testimonial title and prompt text', async () => {
    await loadPage();

    expect(getEl('#testimonialTitle').text).toBe('Share Your Experience');
    expect(getEl('#testimonialPrompt').text).toContain('Love your new furniture');
  });

  it('sets ARIA labels on testimonial inputs', async () => {
    await loadPage();

    expect(getEl('#testimonialNameInput').accessibility.ariaLabel).toBe('Your name');
    expect(getEl('#testimonialStoryInput').accessibility.ariaLabel).toBe('Your testimonial');
    expect(getEl('#testimonialSubmitBtn').accessibility.ariaLabel).toBe('Submit testimonial');
  });

  it('registers click handler on submit button', async () => {
    await loadPage();
    expect(getEl('#testimonialSubmitBtn').onClick).toHaveBeenCalled();
  });

  it('shows error when story is too short', async () => {
    await loadPage();

    getEl('#testimonialNameInput').value = 'Test User';
    getEl('#testimonialStoryInput').value = 'Short';

    const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#testimonialError').text).toContain('10 characters');
    expect(getEl('#testimonialError').show).toHaveBeenCalled();
  });

  it('shows success and hides inputs on successful submission', async () => {
    await loadPage();

    // Mock the dynamic import
    vi.doMock('backend/testimonialService.web', () => ({
      submitTestimonial: vi.fn(() => Promise.resolve({ success: true })),
    }));

    getEl('#testimonialNameInput').value = 'Jane Doe';
    getEl('#testimonialStoryInput').value = 'Absolutely love my new futon frame! Great quality and fast delivery.';

    const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#testimonialSuccess').text).toContain('Thank you');
    expect(getEl('#testimonialSuccess').show).toHaveBeenCalled();
    expect(getEl('#testimonialSubmitBtn').hide).toHaveBeenCalled();
    expect(getEl('#testimonialNameInput').hide).toHaveBeenCalled();
    expect(getEl('#testimonialStoryInput').hide).toHaveBeenCalled();
  });

  it('shows error message and re-enables button on failed submission', async () => {
    await loadPage();

    vi.doMock('backend/testimonialService.web', () => ({
      submitTestimonial: vi.fn(() => Promise.resolve({
        success: false,
        error: 'Submission failed. Please try again.',
      })),
    }));

    getEl('#testimonialNameInput').value = 'Jane';
    getEl('#testimonialStoryInput').value = 'This is a great product with wonderful quality!';

    const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#testimonialError').text).toContain('try again');
    expect(getEl('#testimonialError').show).toHaveBeenCalled();
    expect(getEl('#testimonialSubmitBtn').enable).toHaveBeenCalled();
  });

  it('disables submit button during submission', async () => {
    await loadPage();

    vi.doMock('backend/testimonialService.web', () => ({
      submitTestimonial: vi.fn(() => Promise.resolve({ success: true })),
    }));

    getEl('#testimonialStoryInput').value = 'Amazing furniture, great service, would recommend to everyone!';

    const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#testimonialSubmitBtn').disable).toHaveBeenCalled();
    expect(getEl('#testimonialSubmitBtn').label).toBe('Submitting...');
  });

  it('expands testimonial section', async () => {
    await loadPage();
    expect(getEl('#testimonialSection').expand).toHaveBeenCalled();
  });

  it('announces success via a11y helper', async () => {
    await loadPage();

    vi.doMock('backend/testimonialService.web', () => ({
      submitTestimonial: vi.fn(() => Promise.resolve({ success: true })),
    }));

    getEl('#testimonialStoryInput').value = 'Beautiful futon, exactly what I was looking for. Fast delivery too!';

    const clickHandler = getEl('#testimonialSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    const { announce } = await import('public/a11yHelpers');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('testimonial'));
  });
});

// ── Order Summary Section ───────────────────────────────────────────

describe('Thank You Page — order summary element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets thank you title text', async () => {
    await loadPage();
    expect(getEl('#thankYouTitle').text).toBe('Thank You for Your Order!');
  });

  it('sets thank you message with shipping info', async () => {
    await loadPage();
    expect(getEl('#thankYouMessage').text).toContain('confirmed');
    expect(getEl('#thankYouMessage').text).toContain('shipping confirmation');
  });

  it('sets contact info with phone number', async () => {
    await loadPage();
    expect(getEl('#orderContactInfo').text).toContain('(828) 252-9449');
  });
});

// ── Brenda's Message Section ────────────────────────────────────────

describe('Thank You Page — Brenda message element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets Brenda title and message text', async () => {
    await loadPage();
    expect(getEl('#brendaTitle').text).toBe('A Note from Brenda');
    expect(getEl('#brendaMessage').text).toContain('Carolina Futons');
    expect(getEl('#brendaMessage').text).toContain('Brenda Deal');
  });

  it('expands Brenda message section', async () => {
    await loadPage();
    expect(getEl('#brendaMessageSection').expand).toHaveBeenCalled();
  });
});

// ── Social Sharing Section ──────────────────────────────────────────

describe('Thank You Page — social sharing element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets share text prompt', async () => {
    await loadPage();
    expect(getEl('#shareText').text).toContain('Share with friends');
  });

  it('sets ARIA labels on all social share buttons', async () => {
    await loadPage();
    expect(getEl('#shareFacebook').accessibility.ariaLabel).toContain('Facebook');
    expect(getEl('#sharePinterest').accessibility.ariaLabel).toContain('Pinterest');
    expect(getEl('#shareInstagram').accessibility.ariaLabel).toContain('Instagram');
    expect(getEl('#shareTwitter').accessibility.ariaLabel).toContain('Twitter');
  });

  it('registers click handlers on all share buttons', async () => {
    await loadPage();
    expect(getEl('#shareFacebook').onClick).toHaveBeenCalled();
    expect(getEl('#sharePinterest').onClick).toHaveBeenCalled();
    expect(getEl('#shareInstagram').onClick).toHaveBeenCalled();
    expect(getEl('#shareTwitter').onClick).toHaveBeenCalled();
  });
});

// ── Newsletter Section ──────────────────────────────────────────────

describe('Thank You Page — newsletter element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets newsletter prompt text', async () => {
    await loadPage();
    expect(getEl('#newsletterPrompt').text).toContain('updates');
  });

  it('sets ARIA labels on newsletter email and signup button', async () => {
    await loadPage();
    expect(getEl('#newsletterEmail').accessibility.ariaLabel).toContain('email');
    expect(getEl('#newsletterSignup').accessibility.ariaLabel).toContain('Subscribe');
  });

  it('registers click handler on newsletter signup button', async () => {
    await loadPage();
    expect(getEl('#newsletterSignup').onClick).toHaveBeenCalled();
  });

  it('shows error for invalid email', async () => {
    await loadPage();

    getEl('#newsletterEmail').value = 'not-an-email';

    const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#newsletterError').text).toContain('valid email');
    expect(getEl('#newsletterError').show).toHaveBeenCalled();
  });

  it('shows success and disables button on successful signup', async () => {
    await loadPage();

    getEl('#newsletterEmail').value = 'test@example.com';

    const clickHandler = getEl('#newsletterSignup').onClick.mock.calls[0]?.[0];
    expect(clickHandler).toBeDefined();

    await clickHandler();

    expect(getEl('#newsletterSuccess').text).toContain('subscribed');
    expect(getEl('#newsletterSuccess').show).toHaveBeenCalled();
    expect(getEl('#newsletterSignup').disable).toHaveBeenCalled();
  });
});

// ── Referral Section ────────────────────────────────────────────────

describe('Thank You Page — referral element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets referral title text', async () => {
    await loadPage();
    expect(getEl('#referralTitle').text).toBe('Share the Love');
  });

  it('sets referral message text', async () => {
    await loadPage();
    expect(getEl('#referralMessage').text).toContain('Carolina Futons');
  });

  it('sets ARIA labels on referral buttons', async () => {
    await loadPage();
    expect(getEl('#referralCopyBtn').accessibility.ariaLabel).toContain('Copy');
    expect(getEl('#referralEmailBtn').accessibility.ariaLabel).toContain('email');
  });

  it('registers click handlers on referral buttons', async () => {
    await loadPage();
    expect(getEl('#referralCopyBtn').onClick).toHaveBeenCalled();
    expect(getEl('#referralEmailBtn').onClick).toHaveBeenCalled();
  });

  it('expands referral section', async () => {
    await loadPage();
    expect(getEl('#referralSection').expand).toHaveBeenCalled();
  });
});

// ── Assembly Guide Section ──────────────────────────────────────────

describe('Thank You Page — assembly guide element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets assembly guide title and text', async () => {
    await loadPage();
    expect(getEl('#assemblyGuideTitle').text).toBe('Assembly & Care Guides');
    expect(getEl('#assemblyGuideText').text).toContain('assembly guides');
  });

  it('sets ARIA label on assembly guide button', async () => {
    await loadPage();
    expect(getEl('#assemblyGuideBtn').accessibility.ariaLabel).toContain('assembly');
  });

  it('registers click handler on assembly guide button', async () => {
    await loadPage();
    expect(getEl('#assemblyGuideBtn').onClick).toHaveBeenCalled();
  });

  it('expands assembly guide section', async () => {
    await loadPage();
    expect(getEl('#assemblyGuideSection').expand).toHaveBeenCalled();
  });
});

// ── Review Request Section ──────────────────────────────────────────

describe('Thank You Page — review request element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets review title and prompt text', async () => {
    await loadPage();
    expect(getEl('#reviewTitle').text).toBe('Rate Your Experience');
    expect(getEl('#reviewPrompt').text).toContain('rating');
  });

  it('sets ARIA labels on star buttons', async () => {
    await loadPage();
    expect(getEl('#reviewStar1').accessibility.ariaLabel).toBe('1 star');
    expect(getEl('#reviewStar2').accessibility.ariaLabel).toBe('2 stars');
    expect(getEl('#reviewStar3').accessibility.ariaLabel).toBe('3 stars');
    expect(getEl('#reviewStar4').accessibility.ariaLabel).toBe('4 stars');
    expect(getEl('#reviewStar5').accessibility.ariaLabel).toBe('5 stars');
  });

  it('registers click handlers on all 5 star buttons', async () => {
    await loadPage();
    for (let i = 1; i <= 5; i++) {
      expect(getEl(`#reviewStar${i}`).onClick).toHaveBeenCalled();
    }
  });

  it('updates rating text and star colors when star is clicked', async () => {
    await loadPage();

    const star3Handler = getEl('#reviewStar3').onClick.mock.calls[0]?.[0];
    expect(star3Handler).toBeDefined();
    star3Handler();

    expect(getEl('#reviewRating').text).toBe('3 of 5 stars');
    // Stars 1-3 should be coral, 4-5 muted brown
    expect(getEl('#reviewStar1').style.color).toBe('#E8845C');
    expect(getEl('#reviewStar3').style.color).toBe('#E8845C');
    expect(getEl('#reviewStar4').style.color).toBe('#8B7355');
    expect(getEl('#reviewStar5').style.color).toBe('#8B7355');
  });

  it('sets ARIA label on submit button', async () => {
    await loadPage();
    expect(getEl('#reviewSubmitBtn').accessibility.ariaLabel).toContain('Submit');
  });

  it('registers click handler on submit button', async () => {
    await loadPage();
    expect(getEl('#reviewSubmitBtn').onClick).toHaveBeenCalled();
  });

  it('shows error when submitting without rating', async () => {
    await loadPage();

    const submitHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(submitHandler).toBeDefined();

    await submitHandler();

    expect(getEl('#reviewError').text).toContain('select a rating');
    expect(getEl('#reviewError').show).toHaveBeenCalled();
  });

  it('shows success on successful review submission', async () => {
    await loadPage();

    // Select a rating first
    const star4Handler = getEl('#reviewStar4').onClick.mock.calls[0]?.[0];
    expect(star4Handler).toBeDefined();
    star4Handler();

    const submitHandler = getEl('#reviewSubmitBtn').onClick.mock.calls[0]?.[0];
    expect(submitHandler).toBeDefined();

    await submitHandler();

    expect(getEl('#reviewSuccess').text).toContain('Thank you');
    expect(getEl('#reviewSuccess').show).toHaveBeenCalled();
    expect(getEl('#reviewSubmitBtn').hide).toHaveBeenCalled();
  });

  it('expands review section', async () => {
    await loadPage();
    expect(getEl('#reviewSection').expand).toHaveBeenCalled();
  });
});

// ── Delivery Estimate Text ──────────────────────────────────────────

describe('Thank You Page — #deliveryEstimateText element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets delivery estimate text with date range', async () => {
    await loadPage();
    const text = getEl('#deliveryEstimateText').text;
    expect(text).toContain('Estimated delivery');
    expect(text).toContain('–');
  });
});

// ── Post-Purchase Repeater ──────────────────────────────────────────

describe('Thank You Page — #postPurchaseRepeater element hookup', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  it('sets heading text for post-purchase suggestions', async () => {
    const { getFeaturedProducts } = await import('backend/productRecommendations.web');
    getFeaturedProducts.mockResolvedValue([
      { _id: 'p1', name: 'Vienna Frame', mainMedia: 'v.jpg', formattedPrice: '$399', slug: 'vienna' },
    ]);

    await loadPage();
    expect(getEl('#postPurchaseHeading').text).toBe('You Might Also Love');
  });

  it('registers onItemReady on post-purchase repeater', async () => {
    const { getFeaturedProducts } = await import('backend/productRecommendations.web');
    getFeaturedProducts.mockResolvedValue([
      { _id: 'p1', name: 'Vienna Frame', mainMedia: 'v.jpg', formattedPrice: '$399', slug: 'vienna' },
    ]);

    await loadPage();
    expect(getEl('#postPurchaseRepeater').onItemReady).toHaveBeenCalled();
  });
});
