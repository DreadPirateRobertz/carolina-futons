import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GIFT_CARD_DENOMINATIONS,
  validatePurchaseForm,
  validateGiftCardCode,
  formatBalance,
  formatExpirationDate,
  getBalanceStatusDisplay,
  getCardUsageText,
  formatGiftCardCode,
  buildGiftCardAppliedText,
  calculateGiftCardDiscount,
  getCheckoutGiftCardState,
  getBalanceCheckError,
  initCheckoutGiftCard,
  finalizeGiftCardRedemption,
  resetCheckoutGiftCard,
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

// ── initCheckoutGiftCard — deferred redemption (CF-sy7r fix) ──────

const mockCheckBalance = vi.fn();
const mockRedeemGiftCard = vi.fn();

vi.mock('backend/giftCards.web', () => ({
  checkBalance: (...args) => mockCheckBalance(...args),
  redeemGiftCard: (...args) => mockRedeemGiftCard(...args),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    focus: vi.fn(),
    accessibility: { ariaLabel: '' },
  };
}

function createMock$w(overrides = {}) {
  const elements = {};
  const $w = (selector) => {
    if (overrides[selector] === null) return null;
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  };
  for (const [sel, val] of Object.entries(overrides)) {
    if (val !== null) elements[sel] = val;
  }
  return $w;
}

describe('initCheckoutGiftCard — Apply button only checks balance (no deduction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCheckoutGiftCard();
    mockCheckBalance.mockResolvedValue({ found: true, status: 'active', balance: 100 });
    mockRedeemGiftCard.mockResolvedValue({ success: true, amountApplied: 50, remainingBalance: 50 });
  });

  it('calls checkBalance but NOT redeemGiftCard on Apply click', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';

    await initCheckoutGiftCard($w, () => 50);

    const applyBtn = $w('#giftCardApplyBtn');
    const clickHandler = applyBtn.onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCheckBalance).toHaveBeenCalledWith('CF-AAAA-BBBB-CCCC-DDDD');
    expect(mockRedeemGiftCard).not.toHaveBeenCalled();
  });

  it('sets state to pending (not applied) after successful balance check', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';

    await initCheckoutGiftCard($w, () => 50);

    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const state = getCheckoutGiftCardState();
    expect(state.pending).toBe(true);
    expect(state.applied).toBe(false);
    expect(state.amountToApply).toBe(50);
    expect(state.code).toBe('CF-AAAA-BBBB-CCCC-DDDD');
  });

  it('does not set pending state when balance check fails', async () => {
    mockCheckBalance.mockResolvedValue({ found: false });

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';

    await initCheckoutGiftCard($w, () => 50);

    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const state = getCheckoutGiftCardState();
    expect(state.pending).toBe(false);
    expect(state.applied).toBe(false);
  });

  it('does not set pending state when card is expired', async () => {
    mockCheckBalance.mockResolvedValue({ found: true, status: 'expired', balance: 0 });

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';

    await initCheckoutGiftCard($w, () => 50);

    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const state = getCheckoutGiftCardState();
    expect(state.pending).toBe(false);
  });

  it('shows applied UI even though redemption is deferred', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';

    await initCheckoutGiftCard($w, () => 50);

    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect($w('#giftCardAppliedSection').show).toHaveBeenCalled();
  });

  it('does not call redeemGiftCard when code is invalid', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'INVALID';

    await initCheckoutGiftCard($w, () => 50);

    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCheckBalance).not.toHaveBeenCalled();
    expect(mockRedeemGiftCard).not.toHaveBeenCalled();
  });
});

// ── finalizeGiftCardRedemption — called on order completion ───────

describe('finalizeGiftCardRedemption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCheckoutGiftCard();
    mockCheckBalance.mockResolvedValue({ found: true, status: 'active', balance: 100 });
    mockRedeemGiftCard.mockResolvedValue({ success: true, amountApplied: 50, remainingBalance: 50 });
  });

  it('calls redeemGiftCard with pending code and amount', async () => {
    // Set up pending state via Apply flow
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    // Now finalize on order completion
    const result = await finalizeGiftCardRedemption();

    expect(mockRedeemGiftCard).toHaveBeenCalledWith('CF-AAAA-BBBB-CCCC-DDDD', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(50);
  });

  it('re-calculates amountToApply from currentSubtotal when provided', async () => {
    mockCheckBalance.mockResolvedValue({ found: true, status: 'active', balance: 100 });
    mockRedeemGiftCard.mockResolvedValue({ success: true, amountApplied: 30, remainingBalance: 70 });

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    // Apply with subtotal of 50
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    // Cart changed — subtotal is now 30
    const result = await finalizeGiftCardRedemption(30);

    // Should use recalculated amount (min(balance=100, subtotal=30) = 30), not stale 50
    expect(mockRedeemGiftCard).toHaveBeenCalledWith('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(result.amountApplied).toBe(30);
  });

  it('uses stored amountToApply when no currentSubtotal provided', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const result = await finalizeGiftCardRedemption();

    // Falls back to stored amountToApply
    expect(mockRedeemGiftCard).toHaveBeenCalledWith('CF-AAAA-BBBB-CCCC-DDDD', 50);
  });

  it('sets state to applied after successful finalization', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    await finalizeGiftCardRedemption();

    const state = getCheckoutGiftCardState();
    expect(state.applied).toBe(true);
    expect(state.pending).toBe(false);
    expect(state.amountApplied).toBe(50);
  });

  it('returns no-op result when no gift card is pending', async () => {
    const result = await finalizeGiftCardRedemption();

    expect(mockRedeemGiftCard).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(0);
  });

  it('returns failure and clears state when redeemGiftCard fails', async () => {
    mockRedeemGiftCard.mockResolvedValue({ success: false, message: 'Concurrent modification' });

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const result = await finalizeGiftCardRedemption();

    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();

    const state = getCheckoutGiftCardState();
    expect(state.applied).toBe(false);
    expect(state.pending).toBe(false);
  });

  it('handles redeemGiftCard throwing an error', async () => {
    mockRedeemGiftCard.mockRejectedValue(new Error('Network error'));

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    const result = await finalizeGiftCardRedemption();

    expect(result.success).toBe(false);
    const state = getCheckoutGiftCardState();
    expect(state.applied).toBe(false);
  });

  it('prevents double finalization (sequential)', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    await finalizeGiftCardRedemption();
    const result2 = await finalizeGiftCardRedemption();

    // Second call is a no-op since state is no longer pending
    expect(mockRedeemGiftCard).toHaveBeenCalledTimes(1);
    expect(result2.success).toBe(true);
    expect(result2.amountApplied).toBe(0);
  });

  it('prevents double finalization (concurrent — race condition)', async () => {
    // Simulate slow redeemGiftCard to expose race window
    const resolvers = [];
    mockRedeemGiftCard.mockImplementation(() => new Promise(resolve => {
      resolvers.push(resolve);
    }));

    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    // Fire two concurrent finalizations (double-click "Place Order")
    const promise1 = finalizeGiftCardRedemption();
    const promise2 = finalizeGiftCardRedemption();

    // Let microtasks settle so dynamic import resolves and redeemGiftCard is called
    await new Promise(r => setTimeout(r, 10));

    // Resolve any pending redeemGiftCard calls
    resolvers.forEach(r => r({ success: true, amountApplied: 50, remainingBalance: 50 }));
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Only ONE call to redeemGiftCard — pending must be cleared synchronously
    expect(mockRedeemGiftCard).toHaveBeenCalledTimes(1);
    // One succeeds, one is a no-op
    const successCount = [result1, result2].filter(r => r.amountApplied > 0).length;
    expect(successCount).toBe(1);
  });
});

// ── resetCheckoutGiftCard — abandon/reinit ────────────────────────

describe('resetCheckoutGiftCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCheckoutGiftCard();
    mockCheckBalance.mockResolvedValue({ found: true, status: 'active', balance: 100 });
  });

  it('clears pending state without calling redeemGiftCard', async () => {
    const $w = createMock$w();
    $w('#giftCardCodeInput').value = 'CF-AAAA-BBBB-CCCC-DDDD';
    await initCheckoutGiftCard($w, () => 50);
    const clickHandler = $w('#giftCardApplyBtn').onClick.mock.calls[0][0];
    await clickHandler();

    resetCheckoutGiftCard();

    expect(mockRedeemGiftCard).not.toHaveBeenCalled();
    const state = getCheckoutGiftCardState();
    expect(state.pending).toBe(false);
    expect(state.applied).toBe(false);
    expect(state.amountToApply).toBe(0);
    expect(state.code).toBe('');
  });

  it('is safe to call when no gift card is pending', () => {
    resetCheckoutGiftCard();
    const state = getCheckoutGiftCardState();
    expect(state.pending).toBe(false);
    expect(state.applied).toBe(false);
  });
});
