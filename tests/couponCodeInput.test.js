import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3A2518',
    sunsetCoral: '#E8845C',
    mountainBlue: '#5B8FA8',
    sand: '#E8D5B7',
    offWhite: '#FAF7F2',
    sandLight: '#F2E8D5',
  },
  spacing: { sm: '8px', md: '16px' },
  transitions: { fast: 150, medium: 250 },
}));

vi.mock('wix-stores-frontend', () => ({
  default: {
    cart: {
      applyCoupon: vi.fn(),
      removeCoupon: vi.fn(),
    },
  },
}));

import { initCouponCodeInput, applyCouponCode, removeCouponCode } from '../src/public/CouponCodeInput.js';
import { announce } from 'public/a11yHelpers.js';
import wixStoresFrontend from 'wix-stores-frontend';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '',
    value: '',
    label: '',
    html: '',
    style: {},
    accessibility: {},
    collapsed: false,
    hidden: false,
    enabled: true,
    collapse: vi.fn(function () { this.collapsed = true; return Promise.resolve(); }),
    expand: vi.fn(function () { this.collapsed = false; return Promise.resolve(); }),
    show: vi.fn(function () { this.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function () { this.hidden = true; return Promise.resolve(); }),
    enable: vi.fn(function () { this.enabled = true; }),
    disable: vi.fn(function () { this.enabled = false; }),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    ...overrides,
  };
}

function createMock$w() {
  const elements = {};
  const $w = vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
  $w._elements = elements;
  return $w;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('CouponCodeInput', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
  });

  // ── initCouponCodeInput ─────────────────────────────────────────

  describe('initCouponCodeInput', () => {
    it('collapses error and success elements on init', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponError').hide).toHaveBeenCalled();
      expect($w('#couponSuccess').hide).toHaveBeenCalled();
    });

    it('sets ARIA label on the coupon input', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponInput').accessibility.ariaLabel).toBe('Enter coupon code');
    });

    it('sets ARIA label on the apply button', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponApplyBtn').accessibility.ariaLabel).toBe('Apply coupon code');
    });

    it('wires onClick on the apply button', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponApplyBtn').onClick).toHaveBeenCalled();
    });

    it('wires Enter key handler on the coupon input', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponInput').onKeyPress).toHaveBeenCalled();
    });

    it('does not throw when elements are missing', async () => {
      const broken$w = vi.fn(() => { throw new Error('Not found'); });
      await expect(initCouponCodeInput(broken$w)).resolves.not.toThrow();
    });

    it('shows coupon section when cart has no applied coupon', async () => {
      await initCouponCodeInput($w);

      expect($w('#couponSection').show).toHaveBeenCalled();
    });

    it('shows applied coupon when cart already has one', async () => {
      await initCouponCodeInput($w, { appliedCoupon: { code: 'SAVE10', name: '10% Off' } });

      expect($w('#couponSuccess').show).toHaveBeenCalled();
      expect($w('#couponSuccessText').text).toContain('SAVE10');
    });
  });

  // ── applyCouponCode ─────────────────────────────────────────────

  describe('applyCouponCode', () => {
    it('returns error for empty code', async () => {
      const result = await applyCouponCode($w, '');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/enter.*code/i);
    });

    it('returns error for whitespace-only code', async () => {
      const result = await applyCouponCode($w, '   ');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/enter.*code/i);
    });

    it('returns error for code exceeding max length', async () => {
      const longCode = 'A'.repeat(51);
      const result = await applyCouponCode($w, longCode);

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/too long|invalid/i);
    });

    it('returns error for code with invalid characters', async () => {
      const result = await applyCouponCode($w, '<script>alert("xss")</script>');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });

    it('trims and uppercases the code before applying', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, '  save10  ');

      expect(wixStoresFrontend.cart.applyCoupon).toHaveBeenCalledWith('SAVE10');
    });

    it('shows loading state while applying', async () => {
      let resolveApply;
      wixStoresFrontend.cart.applyCoupon.mockReturnValue(new Promise(r => { resolveApply = r; }));

      const promise = applyCouponCode($w, 'SAVE10');

      // During loading, button should be disabled
      expect($w('#couponApplyBtn').disable).toHaveBeenCalled();

      resolveApply({ applied: true });
      await promise;
    });

    it('shows success state on valid coupon', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      const result = await applyCouponCode($w, 'SAVE10');

      expect(result.success).toBe(true);
      expect($w('#couponSuccess').show).toHaveBeenCalled();
      expect($w('#couponError').hide).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('applied'));
    });

    it('shows error state on invalid coupon', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Coupon not found'));

      const result = await applyCouponCode($w, 'BADCODE');

      expect(result.success).toBe(false);
      expect($w('#couponError').show).toHaveBeenCalled();
      expect($w('#couponSuccess').hide).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('invalid'));
    });

    it('shows error on expired coupon', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Coupon expired'));

      const result = await applyCouponCode($w, 'EXPIRED');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/expired|invalid/i);
    });

    it('shows generic error on network failure', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Network error'));

      const result = await applyCouponCode($w, 'SAVE10');

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });

    it('re-enables button after success', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponApplyBtn').enable).toHaveBeenCalled();
    });

    it('re-enables button after failure', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('fail'));

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponApplyBtn').enable).toHaveBeenCalled();
    });

    it('hides error when a new code is submitted', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      // Error should be hidden at the start of apply
      expect($w('#couponError').hide).toHaveBeenCalled();
    });
  });

  // ── removeCouponCode ────────────────────────────────────────────

  describe('removeCouponCode', () => {
    it('calls wix removeCoupon API', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      await removeCouponCode($w, 'coupon-id-123');

      expect(wixStoresFrontend.cart.removeCoupon).toHaveBeenCalledWith('coupon-id-123');
    });

    it('hides success state and shows input after removal', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      await removeCouponCode($w, 'coupon-id-123');

      expect($w('#couponSuccess').hide).toHaveBeenCalled();
      expect($w('#couponInput').show).toHaveBeenCalled();
      expect($w('#couponApplyBtn').show).toHaveBeenCalled();
    });

    it('announces removal to screen readers', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      await removeCouponCode($w, 'coupon-id-123');

      expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('removed'));
    });

    it('does not throw on API failure', async () => {
      wixStoresFrontend.cart.removeCoupon.mockRejectedValue(new Error('fail'));

      await expect(removeCouponCode($w, 'bad-id')).resolves.not.toThrow();
    });

    it('shows error message on removal failure', async () => {
      wixStoresFrontend.cart.removeCoupon.mockRejectedValue(new Error('fail'));

      const result = await removeCouponCode($w, 'bad-id');

      expect(result.success).toBe(false);
      expect($w('#couponError').show).toHaveBeenCalled();
    });
  });

  // ── Input Validation Edge Cases ─────────────────────────────────

  describe('input validation', () => {
    it('rejects null input', async () => {
      const result = await applyCouponCode($w, null);
      expect(result.success).toBe(false);
    });

    it('rejects undefined input', async () => {
      const result = await applyCouponCode($w, undefined);
      expect(result.success).toBe(false);
    });

    it('rejects numeric input', async () => {
      const result = await applyCouponCode($w, 12345);
      expect(result.success).toBe(false);
    });

    it('accepts alphanumeric codes with hyphens', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      const result = await applyCouponCode($w, 'WELCOME-ABC123');

      expect(result.success).toBe(true);
      expect(wixStoresFrontend.cart.applyCoupon).toHaveBeenCalledWith('WELCOME-ABC123');
    });

    it('accepts codes with underscores', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      const result = await applyCouponCode($w, 'BDAY_SPECIAL');

      expect(result.success).toBe(true);
    });

    it('rejects SQL injection attempts', async () => {
      const result = await applyCouponCode($w, "'; DROP TABLE coupons; --");
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });

    it('rejects HTML/XSS injection', async () => {
      const result = await applyCouponCode($w, '<img src=x onerror=alert(1)>');
      expect(result.success).toBe(false);
    });
  });
});
