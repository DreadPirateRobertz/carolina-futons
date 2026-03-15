/**
 * Tests for Thank You Page element hookup — CF-03jx
 * Covers: #testimonialSection, #testimonialTitle, #testimonialPrompt,
 * #testimonialNameInput, #testimonialStoryInput, #testimonialSubmitBtn,
 * #testimonialError, #testimonialSuccess, #step1-#step4 delivery timeline.
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
    if (!clickHandler) return;

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
    if (!clickHandler) return;

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
    if (!clickHandler) return;

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
    if (!clickHandler) return;

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
    if (!clickHandler) return;

    await clickHandler();

    const { announce } = await import('public/a11yHelpers');
    expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('testimonial'));
  });
});
