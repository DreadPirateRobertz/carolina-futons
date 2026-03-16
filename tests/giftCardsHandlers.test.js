import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/giftCards.web', () => ({
  purchaseGiftCard: vi.fn(() => Promise.resolve({
    success: true,
    code: 'CF-1234-5678-9012-3456',
    amount: 50,
    expirationDate: '2027-03-14',
  })),
  checkBalance: vi.fn(() => Promise.resolve({
    found: true,
    balance: 35.00,
    initialAmount: 50,
    status: 'active',
    expirationDate: '2027-03-14',
  })),
  getGiftCardOptions: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

vi.mock('public/giftCardHelpers.js', () => ({
  GIFT_CARD_DENOMINATIONS: [
    { label: '$25', amount: 25 },
    { label: '$50', amount: 50 },
    { label: '$100', amount: 100 },
    { label: '$250', amount: 250 },
  ],
  validatePurchaseForm: vi.fn((data) => {
    if (!data.amount) return { valid: false, errors: [{ message: 'Select an amount' }] };
    if (!data.purchaserEmail) return { valid: false, errors: [{ message: 'Email required' }] };
    if (!data.recipientEmail) return { valid: false, errors: [{ message: 'Recipient email required' }] };
    return { valid: true, errors: [] };
  }),
  validateGiftCardCode: vi.fn((code) => /^CF-\d{4}-\d{4}-\d{4}-\d{4}$/.test(code)),
  formatBalance: vi.fn((amt) => `$${amt.toFixed(2)}`),
  formatExpirationDate: vi.fn((date) => date),
  getBalanceStatusDisplay: vi.fn(() => ({ label: 'Active', color: '#4A7C59' })),
  getCardUsageText: vi.fn((balance, initial) => `$${(initial - balance).toFixed(2)} used of $${initial.toFixed(2)}`),
  formatGiftCardCode: vi.fn((code) => code.toUpperCase()),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

const { trackEvent } = await import('public/engagementTracker');
const { announce } = await import('public/a11yHelpers');
const { initBackToTop } = await import('public/mobileHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { purchaseGiftCard, checkBalance } = await import('backend/giftCards.web');
const { validatePurchaseForm, validateGiftCardCode, formatGiftCardCode } = await import('public/giftCardHelpers.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Gift Cards Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Gift Cards.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with giftCards', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('giftCards');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'gift-cards' });
    });
  });

  // ── Denomination Picker ───────────────────────────────────────

  describe('denomination picker', () => {
    it('sets repeater data with 4 denominations', async () => {
      await onReadyHandler();
      expect(getEl('#gcDenomRepeater').data).toHaveLength(4);
    });

    it('sets ARIA label on repeater', async () => {
      await onReadyHandler();
      expect(getEl('#gcDenomRepeater').accessibility.ariaLabel).toBe('Gift card amount options');
    });

    it('registers onItemReady', async () => {
      await onReadyHandler();
      expect(getEl('#gcDenomRepeater').onItemReady).toHaveBeenCalled();
    });

    describe('denomination onItemReady', () => {
      async function setupDenomItem(itemData) {
        await onReadyHandler();
        const repeater = getEl('#gcDenomRepeater');
        const cb = repeater.onItemReady.mock.calls[0][0];
        const itemEls = new Map();
        const $item = (sel) => {
          if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
          return itemEls.get(sel);
        };
        cb($item, itemData);
        return $item;
      }

      it('sets denomination label text', async () => {
        const $item = await setupDenomItem({ _id: 'denom-0', label: '$50', amount: 50 });
        expect($item('#gcDenomLabel').text).toBe('$50');
      });

      it('sets ARIA role radio on label', async () => {
        const $item = await setupDenomItem({ _id: 'denom-0', label: '$50', amount: 50 });
        expect($item('#gcDenomLabel').accessibility.role).toBe('radio');
      });

      it('sets ARIA label with amount', async () => {
        const $item = await setupDenomItem({ _id: 'denom-0', label: '$100', amount: 100 });
        expect($item('#gcDenomLabel').accessibility.ariaLabel).toBe('Select $100 gift card');
      });

      it('clicking denomination announces selection', async () => {
        const $item = await setupDenomItem({ _id: 'denom-0', label: '$50', amount: 50 });
        $item('#gcDenomLabel').onClick.mock.calls[0][0]();
        expect(announce).toHaveBeenCalledWith($w, '$50 selected');
      });

      it('clicking denomination tracks event', async () => {
        const $item = await setupDenomItem({ _id: 'denom-0', label: '$50', amount: 50 });
        $item('#gcDenomLabel').onClick.mock.calls[0][0]();
        expect(trackEvent).toHaveBeenCalledWith('gift_card_amount_select', { amount: 50 });
      });
    });
  });

  // ── Purchase Form ─────────────────────────────────────────────

  describe('purchase form', () => {
    it('sets ARIA labels on form fields', async () => {
      await onReadyHandler();
      expect(getEl('#gcPurchaserEmail').accessibility.ariaLabel).toBe('Your email address');
      expect(getEl('#gcRecipientEmail').accessibility.ariaLabel).toBe('Recipient email address');
      expect(getEl('#gcRecipientName').accessibility.ariaLabel).toBe('Recipient name (optional)');
      expect(getEl('#gcMessage').accessibility.ariaLabel).toBe('Personal message (optional)');
    });

    it('sets ariaRequired on required fields', async () => {
      await onReadyHandler();
      expect(getEl('#gcPurchaserEmail').accessibility.ariaRequired).toBe(true);
      expect(getEl('#gcRecipientEmail').accessibility.ariaRequired).toBe(true);
    });

    it('registers onClick on purchase button', async () => {
      await onReadyHandler();
      expect(getEl('#gcPurchaseBtn').onClick).toHaveBeenCalled();
    });

    it('shows validation error when form is invalid', async () => {
      await onReadyHandler();
      // No amount selected, no emails
      getEl('#gcPurchaserEmail').value = '';
      getEl('#gcRecipientEmail').value = '';
      const clickHandler = getEl('#gcPurchaseBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#gcPurchaseError').show).toHaveBeenCalled();
      expect(announce).toHaveBeenCalledWith($w, 'Please fix the errors in the form');
    });

    it('calls purchaseGiftCard on valid submission', async () => {
      await onReadyHandler();
      // Select denomination first by triggering onItemReady click
      const repeater = getEl('#gcDenomRepeater');
      const denomCb = repeater.onItemReady.mock.calls[0][0];
      const denomEls = new Map();
      const $denomItem = (sel) => {
        if (!denomEls.has(sel)) denomEls.set(sel, createMockElement());
        return denomEls.get(sel);
      };
      denomCb($denomItem, { _id: 'denom-1', label: '$50', amount: 50 });
      $denomItem('#gcDenomLabel').onClick.mock.calls[0][0](); // select $50

      getEl('#gcPurchaserEmail').value = 'buyer@test.com';
      getEl('#gcRecipientEmail').value = 'friend@test.com';
      getEl('#gcRecipientName').value = 'Friend';
      getEl('#gcMessage').value = 'Enjoy!';

      const clickHandler = getEl('#gcPurchaseBtn').onClick.mock.calls[0][0];
      await clickHandler();

      expect(purchaseGiftCard).toHaveBeenCalledWith({
        amount: 50,
        purchaserEmail: 'buyer@test.com',
        recipientEmail: 'friend@test.com',
        recipientName: 'Friend',
        message: 'Enjoy!',
      });
    });

    it('tracks gift_card_purchase on success', async () => {
      await onReadyHandler();
      // Select denomination
      const repeater = getEl('#gcDenomRepeater');
      const denomCb = repeater.onItemReady.mock.calls[0][0];
      const denomEls = new Map();
      const $denomItem = (sel) => {
        if (!denomEls.has(sel)) denomEls.set(sel, createMockElement());
        return denomEls.get(sel);
      };
      denomCb($denomItem, { _id: 'denom-1', label: '$50', amount: 50 });
      $denomItem('#gcDenomLabel').onClick.mock.calls[0][0]();

      getEl('#gcPurchaserEmail').value = 'buyer@test.com';
      getEl('#gcRecipientEmail').value = 'friend@test.com';

      await getEl('#gcPurchaseBtn').onClick.mock.calls[0][0]();
      expect(trackEvent).toHaveBeenCalledWith('gift_card_purchase', { amount: 50 });
    });

    it('re-enables submit button after purchase', async () => {
      await onReadyHandler();
      const repeater = getEl('#gcDenomRepeater');
      const denomCb = repeater.onItemReady.mock.calls[0][0];
      const denomEls = new Map();
      const $denomItem = (sel) => {
        if (!denomEls.has(sel)) denomEls.set(sel, createMockElement());
        return denomEls.get(sel);
      };
      denomCb($denomItem, { _id: 'denom-1', label: '$50', amount: 50 });
      $denomItem('#gcDenomLabel').onClick.mock.calls[0][0]();

      getEl('#gcPurchaserEmail').value = 'buyer@test.com';
      getEl('#gcRecipientEmail').value = 'friend@test.com';

      await getEl('#gcPurchaseBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcPurchaseBtn').enable).toHaveBeenCalled();
      expect(getEl('#gcPurchaseBtn').label).toBe('Purchase Gift Card');
    });

    it('shows error on API failure', async () => {
      purchaseGiftCard.mockRejectedValueOnce(new Error('Network error'));
      await onReadyHandler();
      const repeater = getEl('#gcDenomRepeater');
      const denomCb = repeater.onItemReady.mock.calls[0][0];
      const denomEls = new Map();
      const $denomItem = (sel) => {
        if (!denomEls.has(sel)) denomEls.set(sel, createMockElement());
        return denomEls.get(sel);
      };
      denomCb($denomItem, { _id: 'denom-1', label: '$50', amount: 50 });
      $denomItem('#gcDenomLabel').onClick.mock.calls[0][0]();

      getEl('#gcPurchaserEmail').value = 'buyer@test.com';
      getEl('#gcRecipientEmail').value = 'friend@test.com';

      await getEl('#gcPurchaseBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcPurchaseError').text).toMatch(/went wrong/);
      expect(getEl('#gcPurchaseError').show).toHaveBeenCalled();
    });
  });

  // ── Balance Checker ───────────────────────────────────────────

  describe('balance checker', () => {
    it('sets ARIA labels on balance check inputs', async () => {
      await onReadyHandler();
      expect(getEl('#gcCodeInput').accessibility.ariaLabel).toBe('Enter gift card code');
      expect(getEl('#gcCodeInput').accessibility.ariaRequired).toBe(true);
      expect(getEl('#gcCheckBalanceBtn').accessibility.ariaLabel).toBe('Check gift card balance');
    });

    it('registers onClick on check balance button', async () => {
      await onReadyHandler();
      expect(getEl('#gcCheckBalanceBtn').onClick).toHaveBeenCalled();
    });

    it('shows error for invalid code format', async () => {
      await onReadyHandler();
      getEl('#gcCodeInput').value = 'invalid-code';
      formatGiftCardCode.mockReturnValueOnce('INVALID-CODE');
      validateGiftCardCode.mockReturnValueOnce(false);

      await getEl('#gcCheckBalanceBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcBalanceError').text).toMatch(/valid gift card code/);
      expect(announce).toHaveBeenCalledWith($w, 'Invalid gift card code format');
    });

    it('calls checkBalance with formatted code', async () => {
      await onReadyHandler();
      getEl('#gcCodeInput').value = 'cf-1234-5678-9012-3456';
      formatGiftCardCode.mockReturnValueOnce('CF-1234-5678-9012-3456');
      validateGiftCardCode.mockReturnValueOnce(true);

      await getEl('#gcCheckBalanceBtn').onClick.mock.calls[0][0]();
      expect(checkBalance).toHaveBeenCalledWith('CF-1234-5678-9012-3456');
    });

    it('displays balance result on found card', async () => {
      await onReadyHandler();
      getEl('#gcCodeInput').value = 'CF-1234-5678-9012-3456';
      formatGiftCardCode.mockReturnValueOnce('CF-1234-5678-9012-3456');
      validateGiftCardCode.mockReturnValueOnce(true);

      await getEl('#gcCheckBalanceBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcBalanceResult').show).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith('gift_card_balance_check', { status: 'active' });
    });

    it('shows error when card not found', async () => {
      checkBalance.mockResolvedValueOnce({ found: false });
      await onReadyHandler();
      getEl('#gcCodeInput').value = 'CF-0000-0000-0000-0000';
      formatGiftCardCode.mockReturnValueOnce('CF-0000-0000-0000-0000');
      validateGiftCardCode.mockReturnValueOnce(true);

      await getEl('#gcCheckBalanceBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcBalanceError').text).toMatch(/not found/);
      expect(announce).toHaveBeenCalledWith($w, 'Gift card not found');
    });

    it('re-enables check button after check', async () => {
      await onReadyHandler();
      getEl('#gcCodeInput').value = 'CF-1234-5678-9012-3456';
      formatGiftCardCode.mockReturnValueOnce('CF-1234-5678-9012-3456');
      validateGiftCardCode.mockReturnValueOnce(true);

      await getEl('#gcCheckBalanceBtn').onClick.mock.calls[0][0]();
      expect(getEl('#gcCheckBalanceBtn').enable).toHaveBeenCalled();
      expect(getEl('#gcCheckBalanceBtn').label).toBe('Check Balance');
    });
  });
});
