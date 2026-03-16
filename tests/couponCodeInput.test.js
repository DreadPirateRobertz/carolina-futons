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

    it('Enter key triggers applyCouponCode with input value', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });
      $w('#couponInput').value = 'ENTER10';

      await initCouponCodeInput($w);

      // Get the keypress handler and simulate Enter
      const keyHandler = $w('#couponInput').onKeyPress.mock.calls[0][0];
      await keyHandler({ key: 'Enter' });

      expect(wixStoresFrontend.cart.applyCoupon).toHaveBeenCalledWith('ENTER10');
    });

    it('Enter key does not trigger apply for non-Enter keys', async () => {
      await initCouponCodeInput($w);

      const keyHandler = $w('#couponInput').onKeyPress.mock.calls[0][0];
      await keyHandler({ key: 'a' });

      expect(wixStoresFrontend.cart.applyCoupon).not.toHaveBeenCalled();
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

    it('logs raw API error before parsing user-facing message', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Server 500'));

      await applyCouponCode($w, 'SAVE10');

      expect(spy).toHaveBeenCalledWith(
        '[CouponCodeInput] applyCoupon API error:',
        'Server 500',
      );
      spy.mockRestore();
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

    it('returns error for null couponId', async () => {
      const result = await removeCouponCode($w, null);

      expect(result.success).toBe(false);
      expect(wixStoresFrontend.cart.removeCoupon).not.toHaveBeenCalled();
    });

    it('returns error for undefined couponId', async () => {
      const result = await removeCouponCode($w, undefined);

      expect(result.success).toBe(false);
      expect(wixStoresFrontend.cart.removeCoupon).not.toHaveBeenCalled();
    });

    it('returns error for empty string couponId', async () => {
      const result = await removeCouponCode($w, '');

      expect(result.success).toBe(false);
      expect(wixStoresFrontend.cart.removeCoupon).not.toHaveBeenCalled();
    });

    it('returns error for non-string couponId', async () => {
      const result = await removeCouponCode($w, 12345);

      expect(result.success).toBe(false);
      expect(wixStoresFrontend.cart.removeCoupon).not.toHaveBeenCalled();
    });
  });

  // ── parseCouponError branches ──────────────────────────────────

  describe('parseCouponError (via applyCouponCode)', () => {
    it('returns minimum order message for "minimum" error', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Cart minimum not met'));
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.message).toContain('minimum');
    });

    it('returns minimum order message for "subtotal" error', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Subtotal too low'));
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.message).toContain('minimum');
    });

    it('returns already-applied message for "already applied" error', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Coupon already applied'));
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.message).toContain('already applied');
    });

    it('returns already-applied message for "duplicate" error', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Duplicate coupon'));
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.message).toContain('already applied');
    });

    it('returns "does not exist" variant of not-found message', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Coupon does not exist'));
      const result = await applyCouponCode($w, 'GONE');
      expect(result.message).toContain('not found');
    });

    it('returns generic message for unknown errors', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('Something weird'));
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.message).toContain('Could not apply');
    });

    it('handles error with no message property', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue({});
      const result = await applyCouponCode($w, 'SAVE10');
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  // ── initCouponCodeInput — callbacks and deep branches ────────────

  describe('initCouponCodeInput — callbacks', () => {
    it('onClick calls onApplied callback on successful apply', async () => {
      const onApplied = vi.fn();
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await initCouponCodeInput($w, { onApplied });
      $w('#couponInput').value = 'SAVE10';

      const clickHandler = $w('#couponApplyBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(onApplied).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('onClick does not call onApplied on failed apply', async () => {
      const onApplied = vi.fn();
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('fail'));

      await initCouponCodeInput($w, { onApplied });
      $w('#couponInput').value = 'BAD';

      const clickHandler = $w('#couponApplyBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(onApplied).not.toHaveBeenCalled();
    });

    it('Enter key calls onApplied callback on success', async () => {
      const onApplied = vi.fn();
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await initCouponCodeInput($w, { onApplied });
      $w('#couponInput').value = 'ENTER10';

      const keyHandler = $w('#couponInput').onKeyPress.mock.calls[0][0];
      await keyHandler({ key: 'Enter' });

      expect(onApplied).toHaveBeenCalled();
    });

    it('remove button calls onRemoved callback on success', async () => {
      const onRemoved = vi.fn();
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      $w('#couponRemoveBtn').getAttribute = vi.fn(() => 'coupon-123');
      await initCouponCodeInput($w, { onRemoved });

      const removeHandler = $w('#couponRemoveBtn').onClick.mock.calls[0][0];
      await removeHandler();

      expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('remove button does not call onRemoved on failure', async () => {
      const onRemoved = vi.fn();
      wixStoresFrontend.cart.removeCoupon.mockRejectedValue(new Error('fail'));

      $w('#couponRemoveBtn').getAttribute = vi.fn(() => 'bad-id');
      await initCouponCodeInput($w, { onRemoved });

      const removeHandler = $w('#couponRemoveBtn').onClick.mock.calls[0][0];
      await removeHandler();

      expect(onRemoved).not.toHaveBeenCalled();
    });

    it('remove button falls back to options.appliedCoupon._id when getAttribute returns null', async () => {
      const onRemoved = vi.fn();
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      $w('#couponRemoveBtn').getAttribute = vi.fn(() => null);
      await initCouponCodeInput($w, {
        appliedCoupon: { code: 'SAVE10', _id: 'fallback-id' },
        onRemoved,
      });

      const removeHandler = $w('#couponRemoveBtn').onClick.mock.calls[0][0];
      await removeHandler();

      expect(wixStoresFrontend.cart.removeCoupon).toHaveBeenCalledWith('fallback-id');
    });

    it('remove button falls back when getAttribute is undefined', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      // No getAttribute method at all
      delete $w('#couponRemoveBtn').getAttribute;
      await initCouponCodeInput($w, {
        appliedCoupon: { code: 'SAVE10', _id: 'fb-id' },
      });

      const removeHandler = $w('#couponRemoveBtn').onClick.mock.calls[0][0];
      await removeHandler();

      expect(wixStoresFrontend.cart.removeCoupon).toHaveBeenCalledWith('fb-id');
    });

    it('does not call onApplied when it is not a function', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await initCouponCodeInput($w, { onApplied: 'not-a-function' });
      $w('#couponInput').value = 'SAVE10';

      const clickHandler = $w('#couponApplyBtn').onClick.mock.calls[0][0];
      await expect(clickHandler()).resolves.not.toThrow();
    });
  });

  // ── showAppliedState branches ─────────────────────────────────────

  describe('showAppliedState (via applyCouponCode)', () => {
    it('hides input and apply button on success', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponInput').hide).toHaveBeenCalled();
      expect($w('#couponApplyBtn').hide).toHaveBeenCalled();
    });

    it('sets success text with code', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponSuccessText').text).toContain('SAVE10');
    });
  });

  // ── showError edge case ───────────────────────────────────────────

  describe('showError (via applyCouponCode)', () => {
    it('survives when error elements throw on validation failure', async () => {
      // Empty code triggers showError → both $w calls in showError throw
      const broken$w = vi.fn(() => { throw new Error('no el'); });
      const result = await applyCouponCode(broken$w, '');
      expect(result.success).toBe(false);
    });

    it('survives when error elements throw on API failure', async () => {
      wixStoresFrontend.cart.applyCoupon.mockRejectedValue(new Error('fail'));
      const broken$w = vi.fn(() => { throw new Error('no el'); });
      const result = await applyCouponCode(broken$w, 'SAVE10');
      expect(result.success).toBe(false);
    });
  });

  // ── applyCouponCode — loading icon ────────────────────────────────

  describe('applyCouponCode — loading state', () => {
    it('shows and hides loading icon', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponLoadingIcon').show).toHaveBeenCalled();
      expect($w('#couponLoadingIcon').hide).toHaveBeenCalled();
    });

    it('sets and resets button label', async () => {
      wixStoresFrontend.cart.applyCoupon.mockResolvedValue({ applied: true });

      await applyCouponCode($w, 'SAVE10');

      expect($w('#couponApplyBtn').label).toBe('Apply');
    });
  });

  // ── removeCouponCode — success state cleanup ──────────────────────

  describe('removeCouponCode — success cleanup', () => {
    it('clears input value after removal', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      await removeCouponCode($w, 'coupon-123');

      expect($w('#couponInput').value).toBe('');
    });

    it('shows apply button after removal', async () => {
      wixStoresFrontend.cart.removeCoupon.mockResolvedValue({});

      await removeCouponCode($w, 'coupon-123');

      expect($w('#couponApplyBtn').show).toHaveBeenCalled();
    });
  });

  // ── ARIA branches ─────────────────────────────────────────────────

  describe('ARIA setup', () => {
    it('sets ariaLive assertive on error element', async () => {
      await initCouponCodeInput($w);
      expect($w('#couponError').accessibility.ariaLive).toBe('assertive');
    });

    it('sets role alert on error element', async () => {
      await initCouponCodeInput($w);
      expect($w('#couponError').accessibility.role).toBe('alert');
    });

    it('sets ariaLive polite on success element', async () => {
      await initCouponCodeInput($w);
      expect($w('#couponSuccess').accessibility.ariaLive).toBe('polite');
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
