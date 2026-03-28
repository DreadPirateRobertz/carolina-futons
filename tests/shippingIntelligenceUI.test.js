/**
 * Tests for src/public/ShippingIntelligence.js
 * CF-ybcm: Shipping Intelligence Layer — product page frontend wiring
 *
 * Coverage:
 *   isLocalZone              — detects local-delivery or highlighted options
 *   getPrimaryOption         — returns highlighted or first shipping option
 *   initShippingIntelligence — wires all product page elements, calls backend, manages state
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock('backend/shippingIntelligence.web', () => ({
  getShippingEstimate: vi.fn(),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

import {
  isLocalZone,
  getPrimaryOption,
  initShippingIntelligence,
} from '../src/public/ShippingIntelligence.js';

import { getShippingEstimate } from 'backend/shippingIntelligence.web';
import { logError } from 'backend/errorMonitoring.web';
import { setupAccessibleDialog } from 'public/a11yHelpers';
import { session } from 'wix-storage-frontend';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onClick: vi.fn(),
    ...overrides,
  };
}

const POSTAL_CODE_KEY = 'cf_postal_code';

/**
 * Build a minimal $w selector map for ShippingIntelligence.
 */
function makeWixEnv(overrides = {}) {
  const els = {
    '#shippingEstimateBox':    makeEl(),
    '#deliveryEstimateText':   makeEl(),
    '#deliveryZoneText':       makeEl(),
    '#shippingRateBadge':      makeEl(),
    '#shippingEstimateSpinner': makeEl(),
    '#shippingEstimateError':  makeEl(),
    '#whiteGloveUpsellBanner': makeEl(),
    '#whiteGloveUpsellText':   makeEl(),
    '#whiteGloveLearnMoreBtn': makeEl(),
    '#whiteGloveModal':        makeEl(),
    '#whiteGloveModalClose':   makeEl(),
    '#whiteGloveModalContent': makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] || null);
  $w.__els = els;
  return $w;
}

const STANDARD_OPTIONS = [
  {
    code: 'ups-ground', title: 'UPS Ground', price: '49.00', currency: 'USD',
    deliveryTime: '3–5 business days', badge: null, upsellMessage: null, highlight: false, icon: '📦',
  },
  {
    code: 'ups-2day', title: 'UPS 2-Day', price: '89.00', currency: 'USD',
    deliveryTime: '2 business days', badge: null, upsellMessage: null, highlight: false, icon: '📦',
  },
];

const LOCAL_OPTION = {
  code: 'local-delivery-nc1', title: '🚚 Zone 1 Delivery (Free)', price: '0.00', currency: 'USD',
  deliveryTime: 'Wed Apr 2', badge: 'Free Delivery', upsellMessage: 'Upgrade to White Glove (+$99)',
  highlight: true, icon: '🚚',
};

const WHITE_GLOVE_OPTION = {
  code: 'white-glove-nc1', title: '✨ White Glove Delivery', price: '99.00', currency: 'USD',
  deliveryTime: 'Wed Apr 2', badge: 'White Glove', upsellMessage: null, highlight: false, icon: '✨',
};

beforeEach(() => {
  vi.clearAllMocks();
  session.clear();
  // Default setupAccessibleDialog returns a fresh dialog handle each call
  setupAccessibleDialog.mockReturnValue({ open: vi.fn(), close: vi.fn() });
});

// ── isLocalZone ───────────────────────────────────────────────────────────

describe('isLocalZone', () => {
  it('returns true when an option code starts with local-delivery-', () => {
    expect(isLocalZone(STANDARD_OPTIONS.concat(LOCAL_OPTION))).toBe(true);
  });

  it('returns true when any option has highlight: true', () => {
    const opts = [{ code: 'custom', title: '', price: '0', currency: 'USD',
      deliveryTime: '1 day', badge: null, upsellMessage: null, highlight: true, icon: '' }];
    expect(isLocalZone(opts)).toBe(true);
  });

  it('returns false when no local-delivery options and none highlighted', () => {
    expect(isLocalZone(STANDARD_OPTIONS)).toBe(false);
  });

  it('returns false for empty options array', () => {
    expect(isLocalZone([])).toBe(false);
  });
});

// ── getPrimaryOption ──────────────────────────────────────────────────────

describe('getPrimaryOption', () => {
  it('returns the first highlighted option when one exists', () => {
    const opts = [STANDARD_OPTIONS[0], LOCAL_OPTION, STANDARD_OPTIONS[1]];
    expect(getPrimaryOption(opts)).toBe(LOCAL_OPTION);
  });

  it('returns the first option when none are highlighted', () => {
    expect(getPrimaryOption(STANDARD_OPTIONS)).toBe(STANDARD_OPTIONS[0]);
  });

  it('returns null for an empty array', () => {
    expect(getPrimaryOption([])).toBeNull();
  });
});

// ── initShippingIntelligence ──────────────────────────────────────────────

describe('initShippingIntelligence', () => {
  const PRODUCT_ID = 'prod-abc123';
  const POSTAL_CODE = '28739';

  // ── loading state ────────────────────────────────────────────────────

  it('shows spinner and hides box before the API resolves', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateSpinner'].show).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateBox'].hide).toHaveBeenCalled();
  });

  it('shows error and skips API call when no postal code is stored', async () => {
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect(getShippingEstimate).not.toHaveBeenCalled();
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateSpinner'].show).not.toHaveBeenCalled();
  });

  // ── API call ─────────────────────────────────────────────────────────

  it('calls getShippingEstimate with productId and stored postal code', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect(getShippingEstimate).toHaveBeenCalledWith(PRODUCT_ID, POSTAL_CODE);
  });

  // ── success state ────────────────────────────────────────────────────

  it('hides spinner and shows estimate box on success', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateSpinner'].hide).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateBox'].show).toHaveBeenCalled();
  });

  it('sets deliveryEstimateText from primary option deliveryTime', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#deliveryEstimateText'].text).toBe(STANDARD_OPTIONS[0].deliveryTime);
  });

  it('sets deliveryZoneText from primary option title', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#deliveryZoneText'].text).toBe(STANDARD_OPTIONS[0].title);
  });

  it('sets shippingRateBadge text and shows it when primary option has a badge', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    const opts = [{ ...STANDARD_OPTIONS[0], badge: 'Free Delivery' }];
    getShippingEstimate.mockResolvedValue({ success: true, options: opts });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingRateBadge'].text).toBe('Free Delivery');
    expect($w.__els['#shippingRateBadge'].show).toHaveBeenCalled();
  });

  it('hides shippingRateBadge when primary option has no badge', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingRateBadge'].hide).toHaveBeenCalled();
  });

  // ── white glove upsell ───────────────────────────────────────────────

  it('shows white glove upsell banner when local zone is detected', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({
      success: true,
      options: [LOCAL_OPTION, WHITE_GLOVE_OPTION],
    });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#whiteGloveUpsellBanner'].show).toHaveBeenCalled();
  });

  it('hides white glove upsell banner for standard (non-local) zone', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#whiteGloveUpsellBanner'].hide).toHaveBeenCalled();
  });

  it('sets whiteGloveUpsellText from the local option upsellMessage', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({
      success: true,
      options: [LOCAL_OPTION, WHITE_GLOVE_OPTION],
    });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#whiteGloveUpsellText'].text).toBe(LOCAL_OPTION.upsellMessage);
  });

  // ── white glove modal ────────────────────────────────────────────────

  it('wires white glove modal via setupAccessibleDialog', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({
        panelId: '#whiteGloveModal',
        closeId: '#whiteGloveModalClose',
      }),
    );
  });

  it('opens white glove modal when learn more button is clicked', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const mockOpen = vi.fn();
    setupAccessibleDialog.mockReturnValueOnce({ open: mockOpen, close: vi.fn() });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    const handler = $w.__els['#whiteGloveLearnMoreBtn'].onClick.mock.calls[0]?.[0];
    expect(handler).toBeDefined();
    handler();
    expect(mockOpen).toHaveBeenCalled();
  });

  // ── error state ──────────────────────────────────────────────────────

  it('shows error text and hides spinner on API rejection', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockRejectedValue(new Error('network timeout'));
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateSpinner'].hide).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
  });

  it('calls logError on API rejection', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockRejectedValue(new Error('network timeout'));
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ShippingIntelligence.init' }),
    );
  });

  it('sets a fallback error message in the catch block', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockRejectedValue(new Error('network timeout'));
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateError'].text).toBeTruthy();
  });

  it('shows error and hides spinner when API returns success:false', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({
      success: false,
      error: 'Rate limited — try again shortly',
      options: [],
    });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateSpinner'].hide).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
  });

  it('sets error text from API error message when success:false', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    const errorMsg = 'Rate limited — try again shortly';
    getShippingEstimate.mockResolvedValue({ success: false, error: errorMsg, options: [] });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateError'].text).toBe(errorMsg);
  });

  it('shows error when options array is empty on success:true', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: [] });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateBox'].show).not.toHaveBeenCalled();
  });

  it('shows error when API resolves to null', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue(null);
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
    expect($w.__els['#shippingEstimateBox'].show).not.toHaveBeenCalled();
  });

  it('shows error when result.options is absent', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateError'].show).toHaveBeenCalled();
  });

  it('shows white glove upsell banner without mutating text when local option has no upsellMessage', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    const noUpsellLocal = { ...LOCAL_OPTION, upsellMessage: null };
    getShippingEstimate.mockResolvedValue({ success: true, options: [noUpsellLocal] });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#whiteGloveUpsellBanner'].show).toHaveBeenCalled();
    expect($w.__els['#whiteGloveUpsellText'].text).toBe(''); // unchanged
  });

  it('calls logError when setupAccessibleDialog throws', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    setupAccessibleDialog.mockImplementationOnce(() => { throw new Error('Wix element not found'); });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ShippingIntelligence.dialogSetup' }),
    );
  });

  it('continues loading data even when setupAccessibleDialog throws', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    setupAccessibleDialog.mockImplementationOnce(() => { throw new Error('Wix element not found'); });
    const $w = makeWixEnv();
    await initShippingIntelligence($w, PRODUCT_ID, { storage: session });
    expect($w.__els['#shippingEstimateBox'].show).toHaveBeenCalled();
  });

  // ── guards ───────────────────────────────────────────────────────────

  it('does not throw when productId is absent', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    const $w = makeWixEnv();
    await expect(
      initShippingIntelligence($w, null, { storage: session }),
    ).resolves.not.toThrow();
  });

  it('does not throw when $w selector returns null for all elements', async () => {
    session.setItem(POSTAL_CODE_KEY, POSTAL_CODE);
    getShippingEstimate.mockResolvedValue({ success: true, options: STANDARD_OPTIONS });
    const $w = vi.fn(() => null);
    await expect(
      initShippingIntelligence($w, PRODUCT_ID, { storage: session }),
    ).resolves.not.toThrow();
  });
});
