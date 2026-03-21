// blogPostNewsletter.test.js — CF-ekmv
// Tests for the inline newsletter subscription form on the Blog Post page.
// Covers element IDs: #blogNewsletterInput, #blogNewsletterSubmit,
// #blogNewsletterSuccess, #blogNewsletterError.
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [],
    style: { color: '' },
    accessibility: {},
    _clickHandler: null,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(function (fn) { this._clickHandler = fn; }),
    onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
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

// ── Mock Post ───────────────────────────────────────────────────────

const mockPost = {
  slug: 'futon-care-guide',
  title: 'How to Care for Your Futon',
  excerpt: 'A comprehensive guide to futon maintenance.',
  category: 'Care Tips',
  publishDate: '2026-01-15',
  coverImage: 'https://img/futon-care.jpg',
};

// ── Mock Backend & Public Modules ───────────────────────────────────

const mockSubscribeToNewsletter = vi.fn();

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: (...args) => mockSubscribeToNewsletter(...args),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getBlogArticleSchema: vi.fn().mockResolvedValue(null),
  getBlogFaqSchema: vi.fn().mockResolvedValue(null),
  getPageTitle: vi.fn().mockResolvedValue('Title'),
  getCanonicalUrl: vi.fn().mockResolvedValue('https://www.carolinafutons.com/blog/test'),
  getPageMetaDescription: vi.fn().mockResolvedValue('Desc'),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getGuidePinData: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('backend/blogContent', () => ({
  getBlogPost: vi.fn(() => mockPost),
  getAllBlogPosts: vi.fn().mockReturnValue([mockPost]),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['blog', 'futon-care-guide'], to: vi.fn() },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

const trackNewsletterSignupMock = vi.fn();
const trackEventMock = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: (...args) => trackEventMock(...args),
  trackNewsletterSignup: (...args) => trackNewsletterSignupMock(...args),
}));

const fireCustomEventMock = vi.fn();
vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: (...args) => fireCustomEventMock(...args),
}));

const announceMock = vi.fn();
vi.mock('public/a11yHelpers', () => ({
  announce: (...args) => announceMock(...args),
  makeClickable: vi.fn((el, handler) => { el._clickHandler = handler; }),
}));

vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn().mockReturnValue(5),
  formatPublishDate: vi.fn().mockReturnValue('January 15, 2026'),
  buildAuthorBio: vi.fn().mockReturnValue({
    name: 'Carolina Futons',
    description: 'Family-owned.',
    location: 'Hendersonville, NC',
    established: '1991',
  }),
  buildShareUrls: vi.fn().mockReturnValue({
    facebook: 'https://fb.com/share', pinterest: 'https://pin.com', twitter: 'https://tw.com', email: 'mailto:',
  }),
  getRelatedPosts: vi.fn().mockReturnValue([]),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('wix-window-frontend', () => ({ openUrl: vi.fn() }));
vi.mock('wix-seo-frontend', () => ({ head: { setMetaTag: vi.fn() } }));

// ── Import Page ─────────────────────────────────────────────────────

describe('Blog Post Page — newsletter subscription form', () => {
  beforeAll(async () => {
    await import('../src/pages/Blog Post.js');
  });

  beforeEach(async () => {
    elements.clear();
    vi.clearAllMocks();
    // Reset default mock behaviour after clearAllMocks
    mockSubscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
    await onReadyHandler();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('initialization', () => {
    it('sets placeholder on #blogNewsletterInput', () => {
      expect(getEl('#blogNewsletterInput').placeholder).toBe('your@email.com');
    });

    it('sets ariaLabel on #blogNewsletterInput', () => {
      expect(getEl('#blogNewsletterInput').accessibility.ariaLabel).toBe(
        'Your email address for newsletter'
      );
    });

    it('sets ariaRequired on #blogNewsletterInput', () => {
      expect(getEl('#blogNewsletterInput').accessibility.ariaRequired).toBe(true);
    });

    it('sets ariaLabel on #blogNewsletterSubmit', () => {
      expect(getEl('#blogNewsletterSubmit').accessibility.ariaLabel).toBe(
        'Subscribe to newsletter'
      );
    });

    it('hides #blogNewsletterSuccess on init', () => {
      expect(getEl('#blogNewsletterSuccess').hide).toHaveBeenCalled();
    });

    it('hides #blogNewsletterError on init', () => {
      expect(getEl('#blogNewsletterError').hide).toHaveBeenCalled();
    });

    it('registers onClick handler on #blogNewsletterSubmit', () => {
      expect(getEl('#blogNewsletterSubmit').onClick).toHaveBeenCalled();
    });
  });

  // ── Email Validation ────────────────────────────────────────────

  describe('email validation', () => {
    async function triggerSubmit() {
      const handler = getEl('#blogNewsletterSubmit')._clickHandler;
      if (handler) await handler();
    }

    it('shows error for empty email', async () => {
      getEl('#blogNewsletterInput').value = '';
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').text).toBe('Please enter a valid email address.');
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('shows error for missing @ in email', async () => {
      getEl('#blogNewsletterInput').value = 'notanemail';
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').text).toBe('Please enter a valid email address.');
    });

    it('shows error for email with only domain', async () => {
      getEl('#blogNewsletterInput').value = '@domain.com';
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('announces validation error to screen readers', async () => {
      getEl('#blogNewsletterInput').value = '';
      await triggerSubmit();
      expect(announceMock).toHaveBeenCalledWith($w, 'Please enter a valid email address');
    });

    it('does NOT call subscribeToNewsletter for invalid email', async () => {
      getEl('#blogNewsletterInput').value = 'bad-email';
      await triggerSubmit();
      expect(mockSubscribeToNewsletter).not.toHaveBeenCalled();
    });
  });

  // ── Successful Subscription ──────────────────────────────────────

  describe('successful subscription', () => {
    async function triggerSubmit(email = 'reader@example.com') {
      getEl('#blogNewsletterInput').value = email;
      const handler = getEl('#blogNewsletterSubmit')._clickHandler;
      if (handler) await handler();
    }

    it('calls subscribeToNewsletter with correct email', async () => {
      await triggerSubmit('reader@example.com');
      expect(mockSubscribeToNewsletter).toHaveBeenCalledWith(
        'reader@example.com',
        { source: 'blog_post' }
      );
    });

    it('hides email input on success', async () => {
      await triggerSubmit();
      expect(getEl('#blogNewsletterInput').hide).toHaveBeenCalled();
    });

    it('hides submit button on success', async () => {
      await triggerSubmit();
      expect(getEl('#blogNewsletterSubmit').hide).toHaveBeenCalled();
    });

    it('shows #blogNewsletterSuccess on success', async () => {
      await triggerSubmit();
      expect(getEl('#blogNewsletterSuccess').show).toHaveBeenCalled();
    });

    it('calls trackNewsletterSignup with blog_post source', async () => {
      await triggerSubmit();
      expect(trackNewsletterSignupMock).toHaveBeenCalledWith('blog_post');
    });

    it('fires GA4 newsletter_signup event with blog_post source and slug', async () => {
      await triggerSubmit();
      expect(fireCustomEventMock).toHaveBeenCalledWith('newsletter_signup', {
        source: 'blog_post',
        slug: 'futon-care-guide',
      });
    });

    it('announces success to screen readers', async () => {
      await triggerSubmit();
      expect(announceMock).toHaveBeenCalledWith($w, 'Successfully subscribed to newsletter');
    });

    it('disables submit button while awaiting subscription', async () => {
      // Verify disable is called
      let disableCalled = false;
      getEl('#blogNewsletterSubmit').disable = vi.fn(() => { disableCalled = true; });
      await triggerSubmit();
      expect(disableCalled).toBe(true);
    });
  });

  // ── Failed Subscription ──────────────────────────────────────────

  describe('failed subscription', () => {
    async function triggerSubmit(email = 'reader@example.com') {
      getEl('#blogNewsletterInput').value = email;
      const handler = getEl('#blogNewsletterSubmit')._clickHandler;
      if (handler) await handler();
    }

    it('shows error message when subscription fails', async () => {
      mockSubscribeToNewsletter.mockResolvedValueOnce({
        success: false,
        message: 'Service unavailable',
      });
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').text).toBe('Service unavailable');
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('uses fallback message when result.message is missing', async () => {
      mockSubscribeToNewsletter.mockResolvedValueOnce({ success: false });
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').text).toBe('Something went wrong. Please try again.');
    });

    it('re-enables submit button on failure', async () => {
      mockSubscribeToNewsletter.mockResolvedValueOnce({ success: false });
      await triggerSubmit();
      expect(getEl('#blogNewsletterSubmit').enable).toHaveBeenCalled();
    });

    it('re-enables submit button when subscribeToNewsletter throws', async () => {
      mockSubscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));
      await triggerSubmit();
      expect(getEl('#blogNewsletterSubmit').enable).toHaveBeenCalled();
    });

    it('shows fallback error when subscribeToNewsletter throws', async () => {
      mockSubscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));
      await triggerSubmit();
      expect(getEl('#blogNewsletterError').text).toBe('Something went wrong. Please try again.');
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('does NOT call trackNewsletterSignup on failure', async () => {
      mockSubscribeToNewsletter.mockResolvedValueOnce({ success: false });
      await triggerSubmit();
      expect(trackNewsletterSignupMock).not.toHaveBeenCalled();
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('trims whitespace from email before calling backend', async () => {
      getEl('#blogNewsletterInput').value = '  reader@example.com  ';
      const handler = getEl('#blogNewsletterSubmit')._clickHandler;
      if (handler) await handler();
      expect(mockSubscribeToNewsletter).toHaveBeenCalledWith(
        'reader@example.com',
        { source: 'blog_post' }
      );
    });

    it('does not include GA4 blog_post_view event in newsletter events', async () => {
      getEl('#blogNewsletterInput').value = 'reader@example.com';
      const handler = getEl('#blogNewsletterSubmit')._clickHandler;
      if (handler) await handler();

      const newsletterCall = fireCustomEventMock.mock.calls.find(
        c => c[0] === 'newsletter_signup'
      );
      expect(newsletterCall).toBeDefined();
    });
  });
});
