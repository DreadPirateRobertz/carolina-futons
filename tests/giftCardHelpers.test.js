import { describe, it, expect } from 'vitest';
import {
  GIFT_CARD_DENOMINATIONS,
  validatePurchaseForm,
  validateGiftCardCode,
  formatBalance,
  formatExpirationDate,
  getBalanceStatusDisplay,
  getCardUsageText,
  formatGiftCardCode,
  maskGiftCardCode,
  buildGiftCardAppliedText,
  calculateGiftCardDiscount,
  getCheckoutGiftCardState,
  getBalanceCheckError,
} from '../src/public/giftCardHelpers.js';

// ── GIFT_CARD_DENOMINATIONS ─────────────────────────────────────────

describe('GIFT_CARD_DENOMINATIONS', () => {
  it('has six denominations', () => {
    expect(GIFT_CARD_DENOMINATIONS).toHaveLength(6);
  });

  it('contains expected amounts', () => {
    const amounts = GIFT_CARD_DENOMINATIONS.map(d => d.amount);
    expect(amounts).toEqual([25, 50, 100, 150, 200, 500]);
  });

  it('each denomination has label and amount', () => {
    for (const d of GIFT_CARD_DENOMINATIONS) {
      expect(d).toHaveProperty('amount');
      expect(d).toHaveProperty('label');
      expect(typeof d.amount).toBe('number');
      expect(typeof d.label).toBe('string');
      expect(d.label).toMatch(/^\$/);
    }
  });
});

// ── validatePurchaseForm ────────────────────────────────────────────

describe('validatePurchaseForm', () => {
  const validForm = {
    amount: 100,
    purchaserEmail: 'buyer@example.com',
    recipientEmail: 'friend@example.com',
  };

  it('accepts valid form data', () => {
    const result = validatePurchaseForm(validForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid form with optional fields', () => {
    const result = validatePurchaseForm({
      ...validForm,
      recipientName: 'Jane',
      message: 'Happy birthday!',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects missing amount', () => {
    const result = validatePurchaseForm({ ...validForm, amount: null });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects zero amount', () => {
    const result = validatePurchaseForm({ ...validForm, amount: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects invalid denomination', () => {
    const result = validatePurchaseForm({ ...validForm, amount: 75 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = validatePurchaseForm({ ...validForm, amount: -50 });
    expect(result.valid).toBe(false);
  });

  it('rejects NaN amount', () => {
    const result = validatePurchaseForm({ ...validForm, amount: NaN });
    expect(result.valid).toBe(false);
  });

  it('rejects missing purchaserEmail', () => {
    const result = validatePurchaseForm({ ...validForm, purchaserEmail: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'purchaserEmail')).toBe(true);
  });

  it('rejects invalid purchaserEmail', () => {
    const result = validatePurchaseForm({ ...validForm, purchaserEmail: 'not-email' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'purchaserEmail')).toBe(true);
  });

  it('rejects missing recipientEmail', () => {
    const result = validatePurchaseForm({ ...validForm, recipientEmail: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'recipientEmail')).toBe(true);
  });

  it('rejects invalid recipientEmail', () => {
    const result = validatePurchaseForm({ ...validForm, recipientEmail: '@bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'recipientEmail')).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validatePurchaseForm({ amount: 0, purchaserEmail: '', recipientEmail: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('handles null input', () => {
    const result = validatePurchaseForm(null);
    expect(result.valid).toBe(false);
  });

  it('handles undefined input', () => {
    const result = validatePurchaseForm(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects XSS in email fields', () => {
    const result = validatePurchaseForm({
      ...validForm,
      purchaserEmail: '<script>alert("xss")</script>@test.com',
    });
    expect(result.valid).toBe(false);
  });

  it('trims whitespace from emails before validation', () => {
    const result = validatePurchaseForm({
      ...validForm,
      purchaserEmail: '  buyer@example.com  ',
      recipientEmail: ' friend@example.com ',
    });
    expect(result.valid).toBe(true);
  });
});

// ── validateGiftCardCode ────────────────────────────────────────────

describe('validateGiftCardCode', () => {
  it('accepts valid CF code format', () => {
    expect(validateGiftCardCode('CF-ABCD-EFGH-JKLM-NPQR')).toBe(true);
  });

  it('accepts lowercase input', () => {
    expect(validateGiftCardCode('cf-abcd-efgh-jklm-npqr')).toBe(true);
  });

  it('accepts mixed case', () => {
    expect(validateGiftCardCode('Cf-AbCd-EfGh-JkLm-NpQr')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateGiftCardCode('')).toBe(false);
  });

  it('rejects null', () => {
    expect(validateGiftCardCode(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateGiftCardCode(undefined)).toBe(false);
  });

  it('rejects code without CF prefix', () => {
    expect(validateGiftCardCode('XX-ABCD-EFGH-JKLM-NPQR')).toBe(false);
  });

  it('rejects code with wrong segment count', () => {
    expect(validateGiftCardCode('CF-ABCD-EFGH')).toBe(false);
  });

  it('rejects code with wrong segment length', () => {
    expect(validateGiftCardCode('CF-ABC-EFGH-JKLM-NPQR')).toBe(false);
  });

  it('rejects XSS input', () => {
    expect(validateGiftCardCode('<script>alert(1)</script>')).toBe(false);
  });

  it('rejects SQL injection attempt', () => {
    expect(validateGiftCardCode("'; DROP TABLE GiftCards; --")).toBe(false);
  });
});

// ── formatBalance ──────────────────────────────────────────────────

describe('formatBalance', () => {
  it('formats whole number', () => {
    expect(formatBalance(100)).toBe('$100.00');
  });

  it('formats decimal', () => {
    expect(formatBalance(75.5)).toBe('$75.50');
  });

  it('formats zero', () => {
    expect(formatBalance(0)).toBe('$0.00');
  });

  it('handles null', () => {
    expect(formatBalance(null)).toBe('$0.00');
  });

  it('handles undefined', () => {
    expect(formatBalance(undefined)).toBe('$0.00');
  });

  it('handles negative (returns $0.00)', () => {
    expect(formatBalance(-10)).toBe('$0.00');
  });

  it('handles NaN', () => {
    expect(formatBalance(NaN)).toBe('$0.00');
  });

  it('handles string number', () => {
    expect(formatBalance('50')).toBe('$50.00');
  });
});

// ── formatExpirationDate ───────────────────────────────────────────

describe('formatExpirationDate', () => {
  it('formats valid date string', () => {
    const result = formatExpirationDate('2027-01-15T00:00:00.000Z');
    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2027');
  });

  it('formats Date object', () => {
    const result = formatExpirationDate(new Date('2027-06-01'));
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty for null', () => {
    expect(formatExpirationDate(null)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(formatExpirationDate(undefined)).toBe('');
  });

  it('returns empty for invalid date', () => {
    expect(formatExpirationDate('not-a-date')).toBe('');
  });
});

// ── getBalanceStatusDisplay ────────────────────────────────────────

describe('getBalanceStatusDisplay', () => {
  it('returns active display for active card with balance', () => {
    const result = getBalanceStatusDisplay({ found: true, balance: 50, status: 'active' });
    expect(result.label).toBe('Active');
    expect(result.color).toBeTruthy();
  });

  it('returns expired display', () => {
    const result = getBalanceStatusDisplay({ found: true, balance: 0, status: 'expired' });
    expect(result.label).toBe('Expired');
  });

  it('returns redeemed display', () => {
    const result = getBalanceStatusDisplay({ found: true, balance: 0, status: 'redeemed' });
    expect(result.label).toBe('Fully Redeemed');
  });

  it('returns not found display', () => {
    const result = getBalanceStatusDisplay({ found: false });
    expect(result.label).toBe('Not Found');
  });

  it('handles null input', () => {
    const result = getBalanceStatusDisplay(null);
    expect(result.label).toBe('Not Found');
  });

  it('handles undefined status', () => {
    const result = getBalanceStatusDisplay({ found: true, balance: 0 });
    expect(result.label).toBeTruthy();
  });
});

// ── getCardUsageText ───────────────────────────────────────────────

describe('getCardUsageText', () => {
  it('shows remaining from initial', () => {
    const text = getCardUsageText(75, 100);
    expect(text).toContain('$75.00');
    expect(text).toContain('$100.00');
  });

  it('shows full balance when unused', () => {
    const text = getCardUsageText(100, 100);
    expect(text).toContain('$100.00');
  });

  it('shows zero remaining', () => {
    const text = getCardUsageText(0, 50);
    expect(text).toContain('$0.00');
  });

  it('handles null values', () => {
    const text = getCardUsageText(null, null);
    expect(text).toBeTruthy();
  });
});

// ── formatGiftCardCode ─────────────────────────────────────────────

describe('formatGiftCardCode', () => {
  it('uppercases code', () => {
    expect(formatGiftCardCode('cf-abcd-efgh-jklm-npqr')).toBe('CF-ABCD-EFGH-JKLM-NPQR');
  });

  it('trims whitespace', () => {
    expect(formatGiftCardCode('  CF-ABCD-EFGH-JKLM-NPQR  ')).toBe('CF-ABCD-EFGH-JKLM-NPQR');
  });

  it('handles empty string', () => {
    expect(formatGiftCardCode('')).toBe('');
  });

  it('handles null', () => {
    expect(formatGiftCardCode(null)).toBe('');
  });
});

// ── maskGiftCardCode ──────────────────────────────────────────────

describe('maskGiftCardCode', () => {
  it('masks middle segments', () => {
    expect(maskGiftCardCode('CF-ABCD-EFGH-JKLM-NPQR')).toBe('CF-****-****-****-NPQR');
  });

  it('handles lowercase input', () => {
    expect(maskGiftCardCode('cf-abcd-efgh-jklm-npqr')).toBe('CF-****-****-****-NPQR');
  });

  it('returns empty for null', () => {
    expect(maskGiftCardCode(null)).toBe('');
  });

  it('returns empty for undefined', () => {
    expect(maskGiftCardCode(undefined)).toBe('');
  });

  it('returns empty for invalid format', () => {
    expect(maskGiftCardCode('not-a-code')).toBe('');
  });

  it('returns empty for empty string', () => {
    expect(maskGiftCardCode('')).toBe('');
  });
});

// ── buildGiftCardAppliedText ──────────────────────────────────────

describe('buildGiftCardAppliedText', () => {
  it('formats applied amount', () => {
    expect(buildGiftCardAppliedText(50)).toBe('-$50.00 Gift Card');
  });

  it('handles zero', () => {
    expect(buildGiftCardAppliedText(0)).toBe('-$0.00 Gift Card');
  });

  it('handles null', () => {
    expect(buildGiftCardAppliedText(null)).toBe('-$0.00 Gift Card');
  });

  it('handles decimal', () => {
    expect(buildGiftCardAppliedText(25.5)).toBe('-$25.50 Gift Card');
  });
});

// ── calculateGiftCardDiscount ─────────────────────────────────────

describe('calculateGiftCardDiscount', () => {
  it('applies full card when balance < subtotal', () => {
    const result = calculateGiftCardDiscount(50, 100);
    expect(result.amountToApply).toBe(50);
    expect(result.remainingSubtotal).toBe(50);
  });

  it('caps at subtotal when balance > subtotal', () => {
    const result = calculateGiftCardDiscount(200, 100);
    expect(result.amountToApply).toBe(100);
    expect(result.remainingSubtotal).toBe(0);
  });

  it('handles exact match', () => {
    const result = calculateGiftCardDiscount(100, 100);
    expect(result.amountToApply).toBe(100);
    expect(result.remainingSubtotal).toBe(0);
  });

  it('handles zero balance', () => {
    const result = calculateGiftCardDiscount(0, 100);
    expect(result.amountToApply).toBe(0);
    expect(result.remainingSubtotal).toBe(100);
  });

  it('handles null inputs', () => {
    const result = calculateGiftCardDiscount(null, null);
    expect(result.amountToApply).toBe(0);
    expect(result.remainingSubtotal).toBe(0);
  });

  it('handles negative balance gracefully', () => {
    const result = calculateGiftCardDiscount(-10, 100);
    expect(result.amountToApply).toBe(0);
    expect(result.remainingSubtotal).toBe(100);
  });
});

// ── getCheckoutGiftCardState ──────────────────────────────────────

describe('getCheckoutGiftCardState', () => {
  it('returns default state before any gift card is applied', () => {
    const state = getCheckoutGiftCardState();
    expect(state.applied).toBe(false);
    expect(state.amountApplied).toBe(0);
    expect(state.code).toBe('');
  });

  it('returns a copy, not a reference', () => {
    const state1 = getCheckoutGiftCardState();
    const state2 = getCheckoutGiftCardState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});

// ── getBalanceCheckError ──────────────────────────────────────────

describe('getBalanceCheckError', () => {
  it('returns not found message', () => {
    expect(getBalanceCheckError({ found: false })).toBe('Gift card not found.');
  });

  it('returns expired message', () => {
    expect(getBalanceCheckError({ found: true, status: 'expired' })).toBe('This gift card has expired.');
  });

  it('returns no balance message for redeemed', () => {
    expect(getBalanceCheckError({ found: true, status: 'redeemed' })).toBe('This gift card has no remaining balance.');
  });

  it('returns no balance message for active with zero', () => {
    expect(getBalanceCheckError({ found: true, status: 'active', balance: 0 })).toBe('This gift card has no remaining balance.');
  });
});
