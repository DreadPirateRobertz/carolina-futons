/**
 * spinWheelIntegration.test.js
 * CF-qjnv — spin wheel integration: bonus spin grants wired to loyalty thresholds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSpinWheel, hasBonusSpins } from '../src/public/SpinWheelIntegration.js';

// ── $w mock helpers ──────────────────────────────────────────────────────────

function makeEl() {
  return {
    text: '',
    _visible: false,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const els = {
    '#bonusSpinCTA':      makeEl(),
    '#spinWheelLightbox': makeEl(),
    '#spinWheelCloseBtn': makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

const MEMBER_ID = 'mem-spin-1';

function makeOpts($w, spins) {
  return {
    $w,
    getBonusSpinsAvailable: vi.fn().mockResolvedValue(spins),
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

  it('hides #bonusSpinCTA when bonusSpinsAvailable is 0 (explicit)', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 0));
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

  it('shows plural "N bonus spins" text for 5 spins', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 5));
    expect($w('#bonusSpinCTA').text).toBe('You have 5 bonus spins!');
  });
});

// ── Lightbox interaction ───────────────────────────────────────────────────

describe('initSpinWheel — lightbox', () => {
  let $w;
  beforeEach(() => { $w = make$w(); });

  it('CTA click opens spin wheel lightbox', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    const handler = $w('#bonusSpinCTA').onClick.mock.calls[0][0];
    handler();
    expect($w('#spinWheelLightbox').show).toHaveBeenCalled();
  });

  it('close button hides lightbox', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    const handler = $w('#spinWheelCloseBtn').onClick.mock.calls[0][0];
    handler();
    expect($w('#spinWheelLightbox').hide).toHaveBeenCalled();
  });

  it('wires CTA onClick when spins > 0', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 3));
    expect($w('#bonusSpinCTA').onClick).toHaveBeenCalled();
  });

  it('wires close button onClick when spins > 0', async () => {
    await initSpinWheel(MEMBER_ID, makeOpts($w, 1));
    expect($w('#spinWheelCloseBtn').onClick).toHaveBeenCalled();
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
    };
    await expect(initSpinWheel(MEMBER_ID, opts)).resolves.not.toThrow();
  });

  it('hides CTA on fetch error', async () => {
    const opts = {
      $w,
      getBonusSpinsAvailable: vi.fn().mockRejectedValue(new Error('Service down')),
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
