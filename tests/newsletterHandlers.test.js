import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// $w mock infrastructure
// ---------------------------------------------------------------------------
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
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

// ---------------------------------------------------------------------------
// Mock ALL imports before importing the page
// ---------------------------------------------------------------------------
vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(() => Promise.resolve({ success: true, discountCode: 'WELCOME10' })),
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

// ---------------------------------------------------------------------------
// Import mocks & page module
// ---------------------------------------------------------------------------
let subscribeToNewsletter, trackEvent, trackNewsletterSignup,
  fireCustomEvent, initBackToTop, announce, initPageSeo;

beforeAll(async () => {
  const newsletterService = await import('backend/newsletterService.web');
  subscribeToNewsletter = newsletterService.subscribeToNewsletter;

  const engagement = await import('public/engagementTracker');
  trackEvent = engagement.trackEvent;
  trackNewsletterSignup = engagement.trackNewsletterSignup;

  const ga4 = await import('public/ga4Tracking');
  fireCustomEvent = ga4.fireCustomEvent;

  const mobile = await import('public/mobileHelpers');
  initBackToTop = mobile.initBackToTop;

  const a11y = await import('public/a11yHelpers');
  announce = a11y.announce;

  const seo = await import('public/pageSeo.js');
  initPageSeo = seo.initPageSeo;

  await import('../src/pages/Newsletter.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  subscribeToNewsletter.mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
});

// ---------------------------------------------------------------------------
// 1. Initialization
// ---------------------------------------------------------------------------
describe('Newsletter page — initialization', () => {
  beforeEach(async () => {
    await onReadyHandler();
  });

  it('calls initPageSeo with "newsletter"', () => {
    expect(initPageSeo).toHaveBeenCalledWith('newsletter');
  });

  it('calls initBackToTop with $w', () => {
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('tracks page_view via trackEvent', () => {
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'newsletter' });
  });

  it('fires page_view via fireCustomEvent', () => {
    expect(fireCustomEvent).toHaveBeenCalledWith('page_view', { page: 'newsletter' });
  });
});

// ---------------------------------------------------------------------------
// 2. Hero section
// ---------------------------------------------------------------------------
describe('Newsletter page — hero', () => {
  beforeEach(async () => {
    await onReadyHandler();
  });

  it('sets hero title to "Stay in the Loop"', () => {
    expect(getEl('#newsletterHeroTitle').text).toBe('Stay in the Loop');
  });

  it('sets hero subtitle with discount teaser', () => {
    expect(getEl('#newsletterHeroSubtitle').text).toContain('10% off your first order');
  });
});

// ---------------------------------------------------------------------------
// 3. Signup form — initial state
// ---------------------------------------------------------------------------
describe('Newsletter page — signup form init', () => {
  beforeEach(async () => {
    await onReadyHandler();
  });

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

  it('hides success message on init', () => {
    expect(getEl('#nlSuccessMessage').hide).toHaveBeenCalled();
  });

  it('hides error message on init', () => {
    expect(getEl('#nlErrorMessage').hide).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Signup — validation error
// ---------------------------------------------------------------------------
describe('Newsletter page — signup validation error', () => {
  it('shows error for empty email and announces it', async () => {
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const errorMsg = getEl('#nlErrorMessage');
    const emailInput = getEl('#nlEmailInput');
    emailInput.value = '';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(errorMsg.text).toBe('Please enter a valid email address.');
    expect(errorMsg.show).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith($w, 'Please enter a valid email address');
  });

  it('shows error for invalid email format', async () => {
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const errorMsg = getEl('#nlErrorMessage');
    const emailInput = getEl('#nlEmailInput');
    emailInput.value = 'not-an-email';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(errorMsg.text).toBe('Please enter a valid email address.');
    expect(errorMsg.show).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 5. Signup — success
// ---------------------------------------------------------------------------
describe('Newsletter page — signup success', () => {
  it('calls subscribeToNewsletter, tracks signup, shows success message', async () => {
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const emailInput = getEl('#nlEmailInput');
    const nameInput = getEl('#nlNameInput');
    const successMsg = getEl('#nlSuccessMessage');

    emailInput.value = 'test@example.com';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(subscribeToNewsletter).toHaveBeenCalledWith('test@example.com', { source: 'newsletter_page' });
    expect(trackNewsletterSignup).toHaveBeenCalledWith('newsletter_page');
    expect(fireCustomEvent).toHaveBeenCalledWith('newsletter_signup', {
      source: 'newsletter_page',
      value: 0,
      currency: 'USD',
    });

    expect(successMsg.text).toContain('WELCOME10');
    expect(successMsg.show).toHaveBeenCalledWith('fade', { duration: 300 });
    expect(emailInput.hide).toHaveBeenCalled();
    expect(nameInput.hide).toHaveBeenCalled();
    expect(submitBtn.hide).toHaveBeenCalled();
    expect(announce).toHaveBeenCalledWith($w, 'Successfully subscribed to newsletter');
  });
});

// ---------------------------------------------------------------------------
// 6. Signup — API failure (exception thrown)
// ---------------------------------------------------------------------------
describe('Newsletter page — signup API failure', () => {
  it('re-enables button and shows error on exception', async () => {
    subscribeToNewsletter.mockRejectedValueOnce(new Error('Network error'));
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const emailInput = getEl('#nlEmailInput');
    const errorMsg = getEl('#nlErrorMessage');

    emailInput.value = 'test@example.com';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(submitBtn.enable).toHaveBeenCalled();
    expect(submitBtn.label).toBe('Subscribe');
    expect(errorMsg.text).toBe('Something went wrong. Please try again.');
    expect(errorMsg.show).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. Signup — result.success false
// ---------------------------------------------------------------------------
describe('Newsletter page — signup result.success false', () => {
  it('shows result.message when provided', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({ success: false, message: 'Already subscribed.' });
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const emailInput = getEl('#nlEmailInput');
    const errorMsg = getEl('#nlErrorMessage');

    emailInput.value = 'test@example.com';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(submitBtn.enable).toHaveBeenCalled();
    expect(submitBtn.label).toBe('Subscribe');
    expect(errorMsg.text).toBe('Already subscribed.');
    expect(errorMsg.show).toHaveBeenCalled();
  });

  it('shows fallback error when result.message is absent', async () => {
    subscribeToNewsletter.mockResolvedValueOnce({ success: false });
    await onReadyHandler();

    const submitBtn = getEl('#nlSubmitBtn');
    const emailInput = getEl('#nlEmailInput');
    const errorMsg = getEl('#nlErrorMessage');

    emailInput.value = 'test@example.com';

    const clickHandler = submitBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(errorMsg.text).toBe('Something went wrong. Please try again.');
    expect(errorMsg.show).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 8. Benefits repeater
// ---------------------------------------------------------------------------
describe('Newsletter page — benefits', () => {
  it('sets repeater data with 4 benefit items', async () => {
    await onReadyHandler();

    const repeater = getEl('#benefitsRepeater');
    expect(repeater.data).toHaveLength(4);
    expect(repeater.data[0].title).toBe('Exclusive Deals');
    expect(repeater.data[1].title).toBe('New Arrivals');
    expect(repeater.data[2].title).toBe('Furniture Tips');
    expect(repeater.data[3].title).toBe('No Spam');
  });

  it('onItemReady sets title and description', async () => {
    await onReadyHandler();

    const repeater = getEl('#benefitsRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const $item = (sel) => getEl(`__benefit_item_${sel}`);
    const itemData = { title: 'Exclusive Deals', description: 'Subscriber-only discounts and early access to sales' };

    onItemReadyFn($item, itemData);

    expect(getEl('__benefit_item_#benefitTitle').text).toBe('Exclusive Deals');
    expect(getEl('__benefit_item_#benefitDescription').text).toBe('Subscriber-only discounts and early access to sales');
  });
});

// ---------------------------------------------------------------------------
// 9. Social links
// ---------------------------------------------------------------------------
describe('Newsletter page — social links', () => {
  beforeEach(async () => {
    await onReadyHandler();
  });

  it('sets social section title to "Follow Us"', () => {
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
});
