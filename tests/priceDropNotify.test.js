import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));

vi.mock('public/cartService', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, onCartChanged: vi.fn() };
});

vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: '',
  HEART_FILLED_SVG: 'filled',
  HEART_OUTLINE_SVG: 'outline',
}));

vi.mock('public/ga4Tracking', () => ({ fireAddToCart: vi.fn(), fireAddToWishlist: vi.fn() }));
vi.mock('public/engagementTracker', () => ({ trackCartAdd: vi.fn() }));
vi.mock('wix-window-frontend', () => ({ default: { onScroll: vi.fn() } }));

const mockSubscribe = vi.fn();
vi.mock('backend/priceAlertService.web', () => ({
  subscribe: (...args) => mockSubscribe(...args),
}));

import { initPriceDropNotify } from '../src/public/AddToCart.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    value: '',
    label: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    disable: vi.fn(),
    enable: vi.fn(),
    focus: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('initPriceDropNotify', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = { product: { ...futonFrame, _id: 'prod-123' }, selectedQuantity: 1 };
    mockSubscribe.mockReset();
    vi.clearAllMocks();
    // Re-wire onClick mocks after clearAllMocks
    $w = create$w();
  });

  it('collapses the popover on init', async () => {
    await initPriceDropNotify($w, state);
    expect($w('#priceDropNotifyPopover').collapse).toHaveBeenCalled();
  });

  it('hides success and error elements on init', async () => {
    await initPriceDropNotify($w, state);
    expect($w('#priceDropNotifySuccess').hide).toHaveBeenCalled();
    expect($w('#priceDropNotifyError').hide).toHaveBeenCalled();
  });

  it('expands popover and disables trigger button on click', async () => {
    await initPriceDropNotify($w, state);
    const btn = $w('#priceDropNotifyBtn');
    const [clickHandler] = btn.onClick.mock.calls[0];
    clickHandler();
    expect($w('#priceDropNotifyPopover').expand).toHaveBeenCalled();
    expect(btn.disable).toHaveBeenCalled();
  });

  it('collapses popover and re-enables button on close', async () => {
    await initPriceDropNotify($w, state);
    const closeBtn = $w('#priceDropNotifyClose');
    const [closeHandler] = closeBtn.onClick.mock.calls[0];
    closeHandler();
    expect($w('#priceDropNotifyPopover').collapse).toHaveBeenCalledTimes(2); // init + close
    expect($w('#priceDropNotifyBtn').enable).toHaveBeenCalled();
  });

  it('clears email field on close', async () => {
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'test@example.com';
    const [closeHandler] = $w('#priceDropNotifyClose').onClick.mock.calls[0];
    closeHandler();
    expect($w('#priceDropNotifyEmail').value).toBe('');
  });

  it('shows validation error for empty email', async () => {
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = '';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifyError').text).toBe('Please enter a valid email address.');
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('shows validation error for malformed email', async () => {
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'not-an-email';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifyError').text).toBe('Please enter a valid email address.');
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('calls subscribe with productId and trimmed email on valid submit', async () => {
    mockSubscribe.mockResolvedValue({ success: true });
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = '  alice@example.com  ';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect(mockSubscribe).toHaveBeenCalledWith('prod-123', 'alice@example.com');
  });

  it('shows success message and hides form elements on successful subscribe', async () => {
    mockSubscribe.mockResolvedValue({ success: true });
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'alice@example.com';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifySuccess').text).toBe("Done! We'll email you if the price drops.");
    expect($w('#priceDropNotifySuccess').show).toHaveBeenCalled();
    expect($w('#priceDropNotifyEmail').hide).toHaveBeenCalled();
    expect($w('#priceDropNotifySubmit').hide).toHaveBeenCalled();
  });

  it('shows already-subscribed success message when reason is already_subscribed', async () => {
    mockSubscribe.mockResolvedValue({ success: false, reason: 'already_subscribed' });
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'alice@example.com';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifySuccess').text).toBe(
      "You're already on the list! We'll email you when the price drops."
    );
    expect($w('#priceDropNotifySuccess').show).toHaveBeenCalled();
  });

  it('shows generic error on API failure result', async () => {
    mockSubscribe.mockResolvedValue({ success: false, error: 'internal_error' });
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'alice@example.com';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifyError').text).toBe('Something went wrong. Please try again.');
    expect($w('#priceDropNotifySubmit').enable).toHaveBeenCalled();
  });

  it('shows generic error on thrown exception', async () => {
    mockSubscribe.mockRejectedValue(new Error('network failure'));
    await initPriceDropNotify($w, state);
    $w('#priceDropNotifyEmail').value = 'alice@example.com';
    const [submitHandler] = $w('#priceDropNotifySubmit').onClick.mock.calls[0];
    await submitHandler();
    expect($w('#priceDropNotifyError').text).toBe('Something went wrong. Please try again.');
    expect($w('#priceDropNotifySubmit').enable).toHaveBeenCalled();
  });

  it('returns early without error when required elements are missing', async () => {
    // $w returns no-op for missing elements; initPriceDropNotify wraps in try/catch
    const sparse$w = (sel) => {
      if (sel === '#priceDropNotifyBtn') return null;
      return createMockElement();
    };
    await expect(initPriceDropNotify(sparse$w, state)).resolves.toBeUndefined();
  });
});
