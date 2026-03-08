import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks ──────────────────────────────────────────────────────

vi.mock('backend/liveChatService.web', () => ({
  isOnline: vi.fn().mockResolvedValue({ online: true, message: 'Online' }),
  getCannedResponses: vi.fn().mockResolvedValue([]),
  getCannedResponse: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue({}),
  getChatHistory: vi.fn().mockResolvedValue([]),
  createSupportTicket: vi.fn(),
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(), trackSocialShare: vi.fn(), trackProductPageView: vi.fn(),
  trackCartAdd: vi.fn(), trackNewsletterSignup: vi.fn(), trackReferralAction: vi.fn(),
  trackPurchaseComplete: vi.fn(),
}));
vi.mock('public/designTokens.js', () => ({
  colors: { successGreen: '#0f0', textMuted: '#999', mountainBlue: '#5B8FA8', success: '#0f0', mutedBrown: '#666', sunsetCoral: '#E8845C', error: '#f00' },
  typography: { h2: { weight: 600 } },
}));
vi.mock('public/a11yHelpers', () => ({
  makeClickable: vi.fn(), announce: vi.fn(),
}));
vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((arr) => arr), initBackToTop: vi.fn(),
}));
vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({}),
}));
vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn().mockResolvedValue(null),
  getBreadcrumbSchema: vi.fn().mockResolvedValue(null),
  getProductOgTags: vi.fn().mockResolvedValue(null),
  getProductFaqSchema: vi.fn().mockResolvedValue(null),
}));
vi.mock('public/productPageUtils.js', () => ({
  getCategoryFromCollections: vi.fn(() => ({ label: 'Shop', path: '/shop-main' })),
  addBusinessDays: vi.fn((d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; }),
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  HEART_FILLED_SVG: 'filled', HEART_OUTLINE_SVG: 'outline',
}));

// ── Test helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [], hidden: false,
    style: { color: '', fontWeight: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onKeyPress: vi.fn(),
    postMessage: vi.fn(), forEachItem: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    focus: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

// ======================================================================
// LiveChat.js — pre-chat form email validation
// ======================================================================

describe('LiveChat pre-chat email validation', () => {
  let initLiveChat;

  beforeEach(async () => {
    vi.resetModules();
    // re-import after reset so mocks are fresh
    const mod = await import('../../src/public/LiveChat.js');
    initLiveChat = mod.initLiveChat;
  });

  it('rejects email with only "@" (e.g. "@")', async () => {
    const $w = create$w();
    await initLiveChat($w);

    // Trigger the pre-chat start button handler
    const startCb = $w('#preChatStart').onClick.mock.calls[0][0];
    $w('#preChatName').value = 'Test User';
    $w('#preChatEmail').value = '@';
    startCb();

    expect($w('#preChatError').show).toHaveBeenCalled();
    expect($w('#preChatError').text).toMatch(/valid email/i);
  });

  it('rejects email missing domain (e.g. "foo@")', async () => {
    const $w = create$w();
    await initLiveChat($w);

    const startCb = $w('#preChatStart').onClick.mock.calls[0][0];
    $w('#preChatName').value = 'Test';
    $w('#preChatEmail').value = 'foo@';
    startCb();

    expect($w('#preChatError').show).toHaveBeenCalled();
  });

  it('rejects email missing TLD (e.g. "foo@bar")', async () => {
    const $w = create$w();
    await initLiveChat($w);

    const startCb = $w('#preChatStart').onClick.mock.calls[0][0];
    $w('#preChatName').value = 'Test';
    $w('#preChatEmail').value = 'foo@bar';
    startCb();

    expect($w('#preChatError').show).toHaveBeenCalled();
  });

  it('accepts valid email (e.g. "user@example.com")', async () => {
    const $w = create$w();
    await initLiveChat($w);

    const startCb = $w('#preChatStart').onClick.mock.calls[0][0];
    $w('#preChatName').value = 'Test User';
    $w('#preChatEmail').value = 'user@example.com';
    startCb();

    // preChatForm should be hidden on success
    expect($w('#preChatForm').hide).toHaveBeenCalled();
  });
});

// ======================================================================
// ProductDetails.js — swatch request email validation
// ======================================================================

describe('ProductDetails swatch request email validation', () => {
  let initSwatchRequest;
  let handleSwatchSubmitCb;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../src/public/ProductDetails.js');
    initSwatchRequest = mod.initSwatchRequest;
  });

  it('shows error for missing email format on swatch submit', async () => {
    const $w = create$w();
    const state = {
      product: {
        _id: 'p1', name: 'Test Futon',
        productOptions: [{ name: 'Fabric', choices: [{ value: 'blue', description: 'Blue' }] }],
      },
    };

    initSwatchRequest($w, state);

    // Trigger swatch submit handler
    const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];

    $w('#swatchName').value = 'John';
    $w('#swatchEmail').value = 'not-an-email';
    $w('#swatchAddress').value = '123 Main St';

    // Mock checkbox selection
    $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
      const $item = create$w();
      $item('#swatchCheckbox').checked = true;
      cb($item, { label: 'Blue' });
    });

    await submitCb();

    // Should show an error message, not silently submit
    expect($w('#swatchError').show).toHaveBeenCalled();
    expect($w('#swatchError').text).toMatch(/valid email/i);
  });

  it('shows error for empty email on swatch submit', async () => {
    const $w = create$w();
    const state = {
      product: {
        _id: 'p1', name: 'Test Futon',
        productOptions: [{ name: 'Fabric', choices: [{ value: 'blue', description: 'Blue' }] }],
      },
    };

    initSwatchRequest($w, state);
    const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];

    $w('#swatchName').value = 'John';
    $w('#swatchEmail').value = '';
    $w('#swatchAddress').value = '123 Main St';

    $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
      const $item = create$w();
      $item('#swatchCheckbox').checked = true;
      cb($item, { label: 'Blue' });
    });

    await submitCb();

    expect($w('#swatchError').show).toHaveBeenCalled();
    expect($w('#swatchError').text).toMatch(/valid email/i);
  });

  it('submits successfully with valid email', async () => {
    const $w = create$w();
    const state = {
      product: {
        _id: 'p1', name: 'Test Futon',
        productOptions: [{ name: 'Fabric', choices: [{ value: 'blue', description: 'Blue' }] }],
      },
    };

    initSwatchRequest($w, state);
    const submitCb = $w('#swatchSubmit').onClick.mock.calls[0][0];

    $w('#swatchName').value = 'John';
    $w('#swatchEmail').value = 'john@example.com';
    $w('#swatchAddress').value = '123 Main St';

    $w('#swatchOptions').forEachItem.mockImplementation((cb) => {
      const $item = create$w();
      $item('#swatchCheckbox').checked = true;
      cb($item, { label: 'Blue' });
    });

    await submitCb();

    expect($w('#swatchSuccess').show).toHaveBeenCalled();
  });
});

// ======================================================================
// AddToCart.js — back-in-stock shows error on invalid email
// ======================================================================

describe('AddToCart back-in-stock email validation error message', () => {
  let initBackInStockNotification;

  beforeEach(async () => {
    vi.resetModules();

    vi.mock('public/cartService', async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        getProductVariants: vi.fn().mockResolvedValue([{ inStock: true }]),
        addToCart: vi.fn().mockResolvedValue({}),
        onCartChanged: vi.fn(),
      };
    });
    vi.mock('public/ga4Tracking', () => ({
      fireAddToCart: vi.fn(), fireAddToWishlist: vi.fn(),
    }));
    vi.mock('wix-window-frontend', () => ({ default: { onScroll: vi.fn() } }));
    vi.mock('backend/productRecommendations.web', () => ({
      getBundleSuggestion: vi.fn().mockResolvedValue(null),
    }));

    const mod = await import('../../src/public/AddToCart.js');
    initBackInStockNotification = mod.initBackInStockNotification;
  });

  it('shows inline error for invalid email', async () => {
    const $w = create$w();
    const state = { product: { _id: 'p1', name: 'Test' } };

    await initBackInStockNotification($w, state);
    const submitCb = $w('#backInStockBtn').onClick.mock.calls[0][0];

    $w('#backInStockEmail').value = 'bad-email';
    await submitCb();

    expect($w('#backInStockError').show).toHaveBeenCalled();
    expect($w('#backInStockError').text).toMatch(/valid email/i);
  });

  it('shows inline error for empty email', async () => {
    const $w = create$w();
    const state = { product: { _id: 'p1', name: 'Test' } };

    await initBackInStockNotification($w, state);
    const submitCb = $w('#backInStockBtn').onClick.mock.calls[0][0];

    $w('#backInStockEmail').value = '';
    await submitCb();

    expect($w('#backInStockError').show).toHaveBeenCalled();
    expect($w('#backInStockError').text).toMatch(/valid email/i);
  });
});

// ======================================================================
// Thank You Page — newsletter signup email validation
// ======================================================================

describe('Thank You Page newsletter email validation', () => {
  // The Thank You Page uses $w.onReady which runs at import time.
  // We test the newsletter validation by checking that validateEmail is used
  // and that error messages are shown for invalid emails.
  // Since the page auto-initializes, we test the pattern:
  // the code should use validateEmail() from validators.js and show an error.

  it('validateEmail rejects weak emails that pass includes("@")', async () => {
    const { validateEmail } = await import('../../src/public/validators.js');

    // These all pass !email.includes('@') but should fail real validation
    expect(validateEmail('@')).toBe(false);
    expect(validateEmail('foo@')).toBe(false);
    expect(validateEmail('@bar')).toBe(false);
    expect(validateEmail('foo@bar')).toBe(false);
    expect(validateEmail('a @b.com')).toBe(false);

    // Valid emails should pass
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('first.last@company.co')).toBe(true);
  });
});
