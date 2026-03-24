/**
 * pointsBalanceWidget.test.js
 * CF-ht7v — member dashboard tile: total points, tier, days-to-expiry
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initPointsBalanceWidget } from '../src/public/PointsBalanceWidget.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
  };
}

function make$w() {
  const els = {
    '#pointsBalanceTile':  makeEl(),
    '#pointsTierLabel':    makeEl(),
    '#pointsExpiryWarning': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

// ── Default injectable stubs ──────────────────────────────────────────────────

const DEFAULT_MEMBER_ID = 'mem-abc';

function makeOpts(expiryResult, configResult = { pointsPerDollar: 2 }) {
  return {
    getEarningConfig:  vi.fn().mockResolvedValue(configResult),
    getExpiryWarning:  vi.fn().mockResolvedValue(expiryResult),
  };
}

// ── Balance and tier rendering ─────────────────────────────────────────────

describe('initPointsBalanceWidget — balance and tier', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('renders total points from getExpiryWarning result', async () => {
    const opts = makeOpts({ totalPoints: 1250, daysUntilExpiry: 15 });
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsBalanceTile').text).toBe('1,250');
  });

  it('renders current tier derived from totalPoints', async () => {
    // 1250 pts → Mountain Guide (500–2000 range)
    const opts = makeOpts({ totalPoints: 1250, daysUntilExpiry: 15 });
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsTierLabel').text).toBe('Mountain Guide');
  });

  it('renders Trail Blazer tier for 0 points', async () => {
    const opts = makeOpts({ totalPoints: 0, daysUntilExpiry: 25 });
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsTierLabel').text).toBe('Trail Blazer');
  });

  it('renders 0 and Trail Blazer when getExpiryWarning returns null', async () => {
    const opts = makeOpts(null);
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsBalanceTile').text).toBe('0');
    expect($w('#pointsTierLabel').text).toBe('Trail Blazer');
  });
});

// ── Expiry warning rendering ───────────────────────────────────────────────

describe('initPointsBalanceWidget — expiry warning', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('shows expiry warning when daysUntilExpiry is present', async () => {
    const opts = makeOpts({ totalPoints: 1250, daysUntilExpiry: 15 });
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsExpiryWarning').show).toHaveBeenCalled();
    expect($w('#pointsExpiryWarning').text).toBe('Points expire in 15 days');
  });

  it('hides expiry warning when getExpiryWarning returns null', async () => {
    const opts = makeOpts(null);
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsExpiryWarning').hide).toHaveBeenCalled();
    expect($w('#pointsExpiryWarning').show).not.toHaveBeenCalled();
  });

  it('uses daysUntilExpiry in warning text', async () => {
    const opts = makeOpts({ totalPoints: 500, daysUntilExpiry: 28 });
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect($w('#pointsExpiryWarning').text).toBe('Points expire in 28 days');
  });
});

// ── Error handling ─────────────────────────────────────────────────────────

describe('initPointsBalanceWidget — error handling', () => {
  let $w;

  beforeEach(() => { $w = make$w(); });

  it('handles getExpiryWarning throwing — shows 0 pts and hides warning', async () => {
    const opts = makeOpts(null);
    opts.getExpiryWarning.mockRejectedValue(new Error('Service unavailable'));
    await expect(initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts)).resolves.not.toThrow();
    expect($w('#pointsBalanceTile').text).toBe('0');
    expect($w('#pointsExpiryWarning').hide).toHaveBeenCalled();
  });

  it('handles getEarningConfig throwing — still renders balance from expiry data', async () => {
    const opts = makeOpts({ totalPoints: 750, daysUntilExpiry: 10 });
    opts.getEarningConfig.mockRejectedValue(new Error('Config unavailable'));
    await expect(initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts)).resolves.not.toThrow();
    expect($w('#pointsBalanceTile').text).toBe('750');
  });

  it('passes memberId to getExpiryWarning', async () => {
    const opts = makeOpts(null);
    await initPointsBalanceWidget($w, 'specific-member-id', opts);
    expect(opts.getExpiryWarning).toHaveBeenCalledWith('specific-member-id');
  });

  it('calls getEarningConfig with no arguments', async () => {
    const opts = makeOpts(null);
    await initPointsBalanceWidget($w, DEFAULT_MEMBER_ID, opts);
    expect(opts.getEarningConfig).toHaveBeenCalledWith();
  });
});
