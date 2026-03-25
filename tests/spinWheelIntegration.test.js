/**
 * spinWheelIntegration.test.js
 * CF-qjnv, CF-4tal — spin wheel integration: bonus spin grants + email capture gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSpinWheel, hasBonusSpins } from '../src/public/SpinWheelIntegration.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    value: '',
    _visible: false,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#bonusSpinCTA':       makeEl(),
    '#spinWheelLightbox':  makeEl(),
    '#spinWheelCloseBtn':  makeEl(),
    '#spinEmailGate':      makeEl(),
    '#spinEmailInput':     makeEl(),
    '#spinEmailSubmitBtn': makeEl(),
    '#spinEmailError':     makeEl(),
  };
  const $w = (id) => els[id] ?? makeEl();
  $w._els = els;
  return $w;
}

function makeStorage(captured = false) {
  const store = {};
  if (captured) store['cf_spin_email_captured'] = 'true';
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
  };
}

const MEMBER_ID = 'mem-spin-1';

function makeOpts($w, spins, overrides = {}) {
  return {
    $w,
    getBonusSpinsAvailable: vi.fn().mockResolvedValue(spins),
    captureSpinEmail: vi.fn().mockResolvedValue({ success: true }),
    validateEmail: vi.fn((e) => typeof e === 'string' && e.includes('@')),
    storage: makeStorage(overrides.alreadyCaptured || false),
    ...overrides,
  };
}

// ── CTA visibility ─────────────────────────────────────────────────────────

describe('initSpinWheel — CTA visibility', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows #bonusSpinCTA when bonusSpinsAvailable > 0', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 2));
    expect($w('#bonusSpinCTA').show).toHaveBeenCalled();
  });

  it('hides #bonusSpinCTA when bonusSpinsAvailable is 0', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 0));
    expect($w('#bonusSpinCTA').show).not.toHaveBeenCalled();
    expect($w('#bonusSpinCTA').hide).toHaveBeenCalled();
  });
});

// ── CTA text pluralization ─────────────────────────────────────────────────

describe('initSpinWheel — CTA text', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('shows singular "1 bonus spin" text', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    expect($w('#bonusSpinCTA').text).toBe('You have 1 bonus spin!');
  });

  it('shows plural "N bonus spins" text for 2 spins', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 2));
    expect($w('#bonusSpinCTA').text).toBe('You have 2 bonus spins!');
  });
});

// ── Email gate (CF-4tal) ─────────────────────────────────────────────────

describe('initSpinWheel — email gate (first-time)', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('CTA click shows email gate (not lightbox) for first-time visitor', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    const handler = $w('#bonusSpinCTA').onClick.mock.calls[0][0];
    handler();
    expect($w._els['#spinEmailGate'].show).toHaveBeenCalled();
    expect($w._els['#spinWheelLightbox'].show).not.toHaveBeenCalled();
  });

  it('shows email error for invalid email', async () => {
    const opts = makeOpts($w, 1, { validateEmail: vi.fn(() => false) });
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'bad-email';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w._els['#spinEmailError'].show).toHaveBeenCalled();
    expect($w._els['#spinEmailError'].text).toBe('Please enter a valid email address.');
  });

  it('calls captureSpinEmail with valid email', async () => {
    const opts = makeOpts($w, 1);
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'test@example.com';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(opts.captureSpinEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('hides email gate and shows lightbox after successful capture', async () => {
    const opts = makeOpts($w, 1);
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'test@example.com';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w._els['#spinEmailGate'].hide).toHaveBeenCalled();
    expect($w._els['#spinWheelLightbox'].show).toHaveBeenCalled();
  });

  it('stores email captured flag in localStorage after success', async () => {
    const opts = makeOpts($w, 1);
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'test@example.com';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(opts.storage.setItem).toHaveBeenCalledWith('cf_spin_email_captured', 'true');
  });

  it('shows error when captureSpinEmail fails', async () => {
    const opts = makeOpts($w, 1, {
      captureSpinEmail: vi.fn().mockResolvedValue({ success: false, error: 'CAPTURE_FAILED' }),
    });
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'test@example.com';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w._els['#spinEmailError'].show).toHaveBeenCalled();
    expect($w._els['#spinWheelLightbox'].show).not.toHaveBeenCalled();
  });

  it('shows error when captureSpinEmail rejects', async () => {
    const opts = makeOpts($w, 1, {
      captureSpinEmail: vi.fn().mockRejectedValue(new Error('network')),
    });
    await initSpinWheel(MEMBER_ID, opts);
    $w._els['#spinEmailInput'].value = 'test@example.com';
    const handler = $w._els['#spinEmailSubmitBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w._els['#spinEmailError'].show).toHaveBeenCalled();
  });
});

describe('initSpinWheel — repeat visitor (email already captured)', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('CTA click shows lightbox directly (skips email gate)', async () => {
    const opts = makeOpts($w, 1, { alreadyCaptured: true });
    await initSpinWheel(MEMBER_ID, opts);
    const handler = $w('#bonusSpinCTA').onClick.mock.calls[0][0];
    handler();
    expect($w._els['#spinWheelLightbox'].show).toHaveBeenCalled();
    expect($w._els['#spinEmailGate'].show).not.toHaveBeenCalled();
  });
});

// ── Lightbox interaction ───────────────────────────────────────────────────

describe('initSpinWheel — lightbox', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('close button hides lightbox', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    const handler = $w('#spinWheelCloseBtn').onClick.mock.calls[0][0];
    handler();
    expect($w('#spinWheelLightbox').hide).toHaveBeenCalled();
  });

  it('does not wire onClick handlers when spins are 0', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 0));
    expect($w('#bonusSpinCTA').onClick).not.toHaveBeenCalled();
    expect($w('#spinWheelCloseBtn').onClick).not.toHaveBeenCalled();
  });
});

// ── Error handling ─────────────────────────────────────────────────────────

describe('initSpinWheel — error handling', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('does not throw when getBonusSpinsAvailable rejects', async () => {
    const opts = {
      $w,
      getBonusSpinsAvailable: vi.fn().mockRejectedValue(new Error('Service down')),
      storage: makeStorage(),
    };
    await expect(initSpinWheel(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('hides CTA on fetch error', async () => {
    const opts = {
      $w,
      getBonusSpinsAvailable: vi.fn().mockRejectedValue(new Error('Service down')),
      storage: makeStorage(),
    };
    await initSpinWheel(MEMBER_ID, opts);
    expect($w('#bonusSpinCTA').hide).toHaveBeenCalled();
  });

  it('passes memberId to getBonusSpinsAvailable', async () => {
    const opts = makeOpts($w, 0);
    await initSpinWheel('specific-member', opts);
    expect(opts.getBonusSpinsAvailable).toHaveBeenCalledWith('specific-member');
  });
});

// ── hasBonusSpins guard ────────────────────────────────────────────────────

describe('hasBonusSpins', () => {
  it('returns true when bonusSpinsAvailable > 0', async () => {
    const opts = { getBonusSpinsAvailable: vi.fn().mockResolvedValue(2) };
    expect(await hasBonusSpins(MEMBER_ID, opts)).toBe(true);
  });

  it('returns false when bonusSpinsAvailable is 0', async () => {
    const opts = { getBonusSpinsAvailable: vi.fn().mockResolvedValue(0) };
    expect(await hasBonusSpins(MEMBER_ID, opts)).toBe(false);
  });

  it('returns false on fetch error', async () => {
    const opts = { getBonusSpinsAvailable: vi.fn().mockRejectedValue(new Error('err')) };
    expect(await hasBonusSpins(MEMBER_ID, opts)).toBe(false);
  });
});
