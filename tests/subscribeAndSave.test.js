/**
 * @file subscribeAndSave.test.js
 * @description Tests for CF-wzv8: SubscribeAndSave — product page subscription widget.
 *
 * CF-wzv8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSubscribeAndSave } from '../src/public/SubscribeAndSave.js';

// ── $w mock helpers ───────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    checked: false,
    value: '',
    options: null,
    _visible: true,
    _onChangeCb: null,
    show:     vi.fn(function () { this._visible = true; }),
    hide:     vi.fn(function () { this._visible = false; }),
    onChange: vi.fn(function (cb) { this._onChangeCb = cb; }),
  };
}

function make$w() {
  const els = {
    '#subscribeSection':   makeEl(),
    '#subscribeToggle':    makeEl(),
    '#subscribeLabel':     makeEl(),
    '#subscribeFrequency': makeEl(),
    '#subscribeDiscount':  makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT_ID = 'prod-123';
const PRODUCT_NAME = 'Mattress Protector';
const PLANS = [
  { frequency: 'monthly', label: 'Every Month', intervalDays: 30, discount: 10 },
  { frequency: 'quarterly', label: 'Every 3 Months', intervalDays: 90, discount: 10 },
];

function makeOpts($w, overrides = {}) {
  return {
    $w,
    isProductSubscribable: vi.fn().mockResolvedValue({ subscribable: true, discount: 10 }),
    getSubscriptionPlans: vi.fn().mockResolvedValue(PLANS),
    createSubscription: vi.fn().mockResolvedValue({ success: true, subscription: { _id: 'sub-1' } }),
    ...overrides,
  };
}

// ── Eligibility ───────────────────────────────────────────────────────────────

describe('SubscribeAndSave — eligibility', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows section for eligible product', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect($w._els['#subscribeSection'].show).toHaveBeenCalled();
  });

  it('hides section for ineligible product', async () => {
    const opts = makeOpts($w, {
      isProductSubscribable: vi.fn().mockResolvedValue({ subscribable: false, discount: 0 }),
    });
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    expect($w._els['#subscribeSection'].hide).toHaveBeenCalled();
  });

  it('hides section when eligibility check fails', async () => {
    const opts = makeOpts($w, {
      isProductSubscribable: vi.fn().mockRejectedValue(new Error('network')),
    });
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    expect($w._els['#subscribeSection'].hide).toHaveBeenCalled();
  });

  it('sets label with discount percentage', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect($w._els['#subscribeLabel'].text).toBe('Subscribe & Save 10%');
  });

  it('passes productId to eligibility check', async () => {
    const opts = makeOpts($w);
    await initSubscribeAndSave('prod-xyz', PRODUCT_NAME, opts);
    expect(opts.isProductSubscribable).toHaveBeenCalledWith('prod-xyz');
  });
});

// ── Frequency dropdown ────────────────────────────────────────────────────────

describe('SubscribeAndSave — frequency dropdown', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('populates dropdown with plan options', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect($w._els['#subscribeFrequency'].options).toEqual([
      { label: 'Every Month', value: 'monthly' },
      { label: 'Every 3 Months', value: 'quarterly' },
    ]);
  });

  it('defaults to first plan frequency', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect($w._els['#subscribeFrequency'].value).toBe('monthly');
  });
});

// ── Toggle behavior ───────────────────────────────────────────────────────────

describe('SubscribeAndSave — toggle', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows frequency and discount when toggled on', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    $w._els['#subscribeToggle'].checked = true;
    $w._els['#subscribeToggle']._onChangeCb();
    expect($w._els['#subscribeFrequency'].show).toHaveBeenCalled();
    expect($w._els['#subscribeDiscount'].show).toHaveBeenCalled();
    expect($w._els['#subscribeDiscount'].text).toBe('You save 10% on every delivery');
  });

  it('hides frequency and discount when toggled off', async () => {
    await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    $w._els['#subscribeToggle'].checked = false;
    $w._els['#subscribeToggle']._onChangeCb();
    expect($w._els['#subscribeFrequency'].hide).toHaveBeenCalled();
    expect($w._els['#subscribeDiscount'].hide).toHaveBeenCalled();
  });
});

// ── Return value and createOnCheckout ─────────────────────────────────────────

describe('SubscribeAndSave — return API', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('returns subscribed=false initially', async () => {
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect(result.subscribed).toBe(false);
  });

  it('returns subscribed=true after toggle on', async () => {
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    $w._els['#subscribeToggle'].checked = true;
    $w._els['#subscribeToggle']._onChangeCb();
    expect(result.subscribed).toBe(true);
  });

  it('returns null from createOnCheckout when not subscribed', async () => {
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, makeOpts($w));
    expect(await result.createOnCheckout()).toBeNull();
  });

  it('calls createSubscription on checkout when subscribed', async () => {
    const opts = makeOpts($w);
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    $w._els['#subscribeToggle'].checked = true;
    $w._els['#subscribeToggle']._onChangeCb();
    await result.createOnCheckout();
    expect(opts.createSubscription).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      productName: PRODUCT_NAME,
      frequency: 'monthly',
      quantity: 1,
    });
  });

  it('uses selected frequency for subscription creation', async () => {
    const opts = makeOpts($w);
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    $w._els['#subscribeToggle'].checked = true;
    $w._els['#subscribeToggle']._onChangeCb();
    // Simulate frequency change
    $w._els['#subscribeFrequency'].value = 'quarterly';
    $w._els['#subscribeFrequency']._onChangeCb();
    await result.createOnCheckout();
    expect(opts.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'quarterly' }),
    );
  });

  it('handles createSubscription failure gracefully', async () => {
    const opts = makeOpts($w, {
      createSubscription: vi.fn().mockRejectedValue(new Error('network')),
    });
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    $w._els['#subscribeToggle'].checked = true;
    $w._els['#subscribeToggle']._onChangeCb();
    const res = await result.createOnCheckout();
    expect(res).toEqual({ success: false, message: 'Failed to create subscription' });
  });
});

// ── Ineligible product returns ────────────────────────────────────────────────

describe('SubscribeAndSave — ineligible return', () => {
  it('returns subscribed=false for ineligible product', async () => {
    const $w = make$w();
    const opts = makeOpts($w, {
      isProductSubscribable: vi.fn().mockResolvedValue({ subscribable: false, discount: 0 }),
    });
    const result = await initSubscribeAndSave(PRODUCT_ID, PRODUCT_NAME, opts);
    expect(result.subscribed).toBe(false);
  });
});
