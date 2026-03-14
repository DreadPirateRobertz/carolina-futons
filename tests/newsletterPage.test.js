import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
    accessibility: {},
    hidden: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    focus: vi.fn(),
    enable: vi.fn(), disable: vi.fn(),
    placeholder: '',
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

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(() =>
    Promise.resolve({ success: true, discountCode: 'WELCOME10' })
  ),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
  trackNewsletterSignup: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

// ── Import Mocks After Setup ────────────────────────────────────────

const { subscribeToNewsletter } = await import('backend/newsletterService.web');
const { trackEvent, trackNewsletterSignup } = await import('public/engagementTracker');
const { fireCustomEvent } = await import('public/ga4Tracking');
const { initBackToTop } = await import('public/mobileHelpers');
const { announce } = await import('public/a11yHelpers');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Load Page Module ────────────────────────────────────────────────

beforeAll(async () => {
  await import('../src/pages/Newsletter.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  subscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Newsletter Page — onReady', () => {
  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls onReady without throwing', () => {
    expect(() => onReadyHandler()).not.toThrow();
  });
});

describe('Newsletter Page — Hero Section', () => {
  beforeEach(async () => { await onReadyHandler(); });

  it('sets hero title text', () => {
    expect(getEl('#newsletterHeroTitle').text).toBe('Stay in the Loop');
  });

  it('sets hero subtitle text', () => {
    expect(getEl('#newsletterHeroSubtitle').text).toContain('exclusive deals');
  });
});

describe('Newsletter Page — Signup Form', () => {
  beforeEach(async () => { await onReadyHandler(); });

  it('sets ARIA label on email input', () => {
    expect(getEl('#nlEmailInput').accessibility.ariaLabel).toBe('Your email address');
  });

  it('sets ariaRequired on email input', () => {
    expect(getEl('#nlEmailInput').accessibility.ariaRequired).toBe(true);
  });

  it('sets ARIA label on name input', () => {
    expect(getEl('#nlNameInput').accessibility.ariaLabel).toBe('Your first name (optional)');
  });

  it('sets ARIA label on submit button', () => {
    expect(getEl('#nlSubmitBtn').accessibility.ariaLabel).toBe('Subscribe to newsletter');
  });

  it('sets placeholder on email input', () => {
    expect(getEl('#nlEmailInput').placeholder).toBe('your@email.com');
  });

  it('sets placeholder on name input', () => {
    expect(getEl('#nlNameInput').placeholder).toBe('First name (optional)');
  });

  it('hides success and error messages initially', () => {
    expect(getEl('#nlSuccessMessage').hide).toHaveBeenCalled();
    expect(getEl('#nlErrorMessage').hide).toHaveBeenCalled();
  });

  it('registers onClick handler on submit button', () => {
    expect(getEl('#nlSubmitBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe('Newsletter Page — Form Submission (valid email)', () => {
  let clickHandler;

  beforeEach(async () => {
    await onReadyHandler();
    clickHandler = getEl('#nlSubmitBtn').onClick.mock.calls[0][0];
    getEl('#nlEmailInput').value = 'test@example.com';
    vi.clearAllMocks();
    subscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'SAVE10' });
  });

  it('hides previous error message before submitting', async () => {
    await clickHandler();
    expect(getEl('#nlErrorMessage').hide).toHaveBeenCalled();
  });

  it('calls subscribeToNewsletter with email and source', async () => {
    await clickHandler();
    expect(subscribeToNewsletter).toHaveBeenCalledWith('test@example.com', { source: 'newsletter_page' });
  });

  it('disables submit button during submission', async () => {
    await clickHandler();
    expect(getEl('#nlSubmitBtn').disable).toHaveBeenCalled();
  });

  it('disables and relabels button before API call', async () => {
    let labelDuringCall;
    subscribeToNewsletter.mockImplementation(() => {
      labelDuringCall = getEl('#nlSubmitBtn').label;
      return Promise.resolve({ success: true, discountCode: 'SAVE10' });
    });
    await clickHandler();
    expect(labelDuringCall).toBe('Subscribing...');
  });

  it('tracks newsletter signup via engagement tracker', async () => {
    await clickHandler();
    expect(trackNewsletterSignup).toHaveBeenCalledWith('newsletter_page');
  });

  it('fires GA4 newsletter_signup event', async () => {
    await clickHandler();
    expect(fireCustomEvent).toHaveBeenCalledWith('newsletter_signup', {
      source: 'newsletter_page',
      value: 0,
      currency: 'USD',
    });
  });

  it('shows success message with discount code', async () => {
    await clickHandler();
    expect(getEl('#nlSuccessMessage').text).toContain('SAVE10');
    expect(getEl('#nlSuccessMessage').show).toHaveBeenCalled();
  });

  it('hides form inputs on success', async () => {
    await clickHandler();
    expect(getEl('#nlEmailInput').hide).toHaveBeenCalled();
    expect(getEl('#nlNameInput').hide).toHaveBeenCalled();
    expect(getEl('#nlSubmitBtn').hide).toHaveBeenCalled();
  });

  it('announces success for screen readers', async () => {
    await clickHandler();
    expect(announce).toHaveBeenCalledWith($w, 'Successfully subscribed to newsletter');
  });

  it('uses fallback discount code WELCOME10 when none returned', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: true });
    await clickHandler();
    expect(getEl('#nlSuccessMessage').text).toContain('WELCOME10');
  });
});

describe('Newsletter Page — Form Submission (invalid email)', () => {
  let clickHandler;

  beforeEach(async () => {
    await onReadyHandler();
    clickHandler = getEl('#nlSubmitBtn').onClick.mock.calls[0][0];
    vi.clearAllMocks();
  });

  it('shows error for empty email', async () => {
    getEl('#nlEmailInput').value = '';
    await clickHandler();
    expect(getEl('#nlErrorMessage').text).toBe('Please enter a valid email address.');
    expect(getEl('#nlErrorMessage').show).toHaveBeenCalled();
  });

  it('shows error for malformed email', async () => {
    getEl('#nlEmailInput').value = 'notanemail';
    await clickHandler();
    expect(getEl('#nlErrorMessage').show).toHaveBeenCalled();
  });

  it('announces validation error for a11y', async () => {
    getEl('#nlEmailInput').value = '';
    await clickHandler();
    expect(announce).toHaveBeenCalledWith($w, 'Please enter a valid email address');
  });

  it('does not call subscribeToNewsletter for invalid email', async () => {
    getEl('#nlEmailInput').value = 'bad@';
    await clickHandler();
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });
});

describe('Newsletter Page — Form Submission (API failure)', () => {
  let clickHandler;

  beforeEach(async () => {
    await onReadyHandler();
    clickHandler = getEl('#nlSubmitBtn').onClick.mock.calls[0][0];
    getEl('#nlEmailInput').value = 'test@example.com';
    vi.clearAllMocks();
  });

  it('shows error message when API returns failure', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false, message: 'Already subscribed' });
    await clickHandler();
    expect(getEl('#nlErrorMessage').text).toBe('Already subscribed');
    expect(getEl('#nlErrorMessage').show).toHaveBeenCalled();
  });

  it('re-enables button on API failure', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false });
    await clickHandler();
    expect(getEl('#nlSubmitBtn').enable).toHaveBeenCalled();
    expect(getEl('#nlSubmitBtn').label).toBe('Subscribe');
  });

  it('shows generic error on API exception', async () => {
    subscribeToNewsletter.mockRejectedValue(new Error('Network error'));
    await clickHandler();
    expect(getEl('#nlErrorMessage').text).toBe('Something went wrong. Please try again.');
    expect(getEl('#nlErrorMessage').show).toHaveBeenCalled();
  });

  it('re-enables button on API exception', async () => {
    subscribeToNewsletter.mockRejectedValue(new Error('fail'));
    await clickHandler();
    expect(getEl('#nlSubmitBtn').enable).toHaveBeenCalled();
    expect(getEl('#nlSubmitBtn').label).toBe('Subscribe');
  });

  it('uses fallback message when API returns failure without message', async () => {
    subscribeToNewsletter.mockResolvedValue({ success: false });
    await clickHandler();
    expect(getEl('#nlErrorMessage').text).toBe('Something went wrong. Please try again.');
  });
});

describe('Newsletter Page — Benefits Repeater', () => {
  beforeEach(async () => { await onReadyHandler(); });

  it('sets benefits data on repeater', () => {
    const repeater = getEl('#benefitsRepeater');
    expect(repeater.data).toHaveLength(4);
    expect(repeater.data[0].title).toBe('Exclusive Deals');
  });

  it('registers onItemReady callback', () => {
    expect(getEl('#benefitsRepeater').onItemReady).toHaveBeenCalledWith(expect.any(Function));
  });

  it('onItemReady sets title and description', () => {
    const callback = getEl('#benefitsRepeater').onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`benefit-item-${sel}`);
    const itemData = { title: 'Test Title', description: 'Test Desc' };
    callback($item, itemData);
    expect(getEl('benefit-item-#benefitTitle').text).toBe('Test Title');
    expect(getEl('benefit-item-#benefitDescription').text).toBe('Test Desc');
  });
});

describe('Newsletter Page — Social Links', () => {
  beforeEach(async () => { await onReadyHandler(); });

  it('sets social section title', () => {
    expect(getEl('#nlSocialTitle').text).toBe('Follow Us');
  });

  it('registers onClick on Pinterest button', () => {
    expect(getEl('#nlPinterestBtn').onClick).toHaveBeenCalled();
  });

  it('registers onClick on Instagram button', () => {
    expect(getEl('#nlInstagramBtn').onClick).toHaveBeenCalled();
  });

  it('registers onClick on Facebook button', () => {
    expect(getEl('#nlFacebookBtn').onClick).toHaveBeenCalled();
  });

  it('sets ARIA labels on social buttons', () => {
    expect(getEl('#nlPinterestBtn').accessibility.ariaLabel).toBe('Follow us on Pinterest');
    expect(getEl('#nlInstagramBtn').accessibility.ariaLabel).toBe('Follow us on Instagram');
    expect(getEl('#nlFacebookBtn').accessibility.ariaLabel).toBe('Follow us on Facebook');
  });

  it('tracks social follow event on click', async () => {
    const clickHandler = getEl('#nlPinterestBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(trackEvent).toHaveBeenCalledWith('social_follow', { platform: 'Follow us on Pinterest' });
  });
});

describe('Newsletter Page — Analytics & SEO', () => {
  beforeEach(async () => { await onReadyHandler(); });

  it('initializes page SEO for newsletter', () => {
    expect(initPageSeo).toHaveBeenCalledWith('newsletter');
  });

  it('tracks page_view via engagement tracker', () => {
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'newsletter' });
  });

  it('fires GA4 page_view event', () => {
    expect(fireCustomEvent).toHaveBeenCalledWith('page_view', { page: 'newsletter' });
  });

  it('initializes back-to-top', () => {
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });
});
