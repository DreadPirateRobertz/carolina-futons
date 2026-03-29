/**
 * @file BNPLWidget.test.js
 * @description Tests for CF-nqb5.1: BNPLWidget — Buy Now Pay Later payment estimates on PDPs.
 *
 * Covers:
 *  - formatBNPLEstimates: Affirm = price/12 rounded to 2dp, "As low as $X/mo with Affirm"
 *  - formatBNPLEstimates: Klarna = price/4 rounded to 2dp, "4 payments of $X with Klarna"
 *  - whole-dollar amounts omit cents (e.g. "$25" not "$25.00")
 *  - fractional cents round to 2dp
 *  - price = 0 returns zero strings
 *  - negative price returns zero strings
 *  - non-numeric input returns zero strings
 *  - null/undefined input returns zero strings
 *  - initBNPLWidget: shows #bnplAffirm and #bnplKlarna with formatted strings
 *  - initBNPLWidget: hides #bnplContainer when price is invalid
 *  - initBNPLWidget: shows #bnplContainer when price is valid
 *
 * CF-nqb5.1
 */
import { describe, it, expect, vi } from 'vitest';
import { formatBNPLEstimates, initBNPLWidget } from '../src/public/BNPLWidget.js';

// ── formatBNPLEstimates ───────────────────────────────────────────────────────

describe('formatBNPLEstimates', () => {
  it('formats Affirm as price/12 with "As low as $X/mo with Affirm"', () => {
    const { affirm } = formatBNPLEstimates(120);
    expect(affirm).toBe('As low as $10/mo with Affirm');
  });

  it('formats Klarna as price/4 with "4 payments of $X with Klarna"', () => {
    const { klarna } = formatBNPLEstimates(100);
    expect(klarna).toBe('4 payments of $25 with Klarna');
  });

  it('rounds Affirm to 2 decimal places', () => {
    // 100 / 12 = 8.333... → $8.33
    const { affirm } = formatBNPLEstimates(100);
    expect(affirm).toBe('As low as $8.33/mo with Affirm');
  });

  it('rounds Klarna to 2 decimal places', () => {
    // 10 / 4 = 2.5 → $2.50
    const { klarna } = formatBNPLEstimates(10);
    expect(klarna).toBe('4 payments of $2.50 with Klarna');
  });

  it('omits trailing .00 for whole-dollar Affirm amount', () => {
    // 240 / 12 = 20 → $20 (not $20.00)
    const { affirm } = formatBNPLEstimates(240);
    expect(affirm).toBe('As low as $20/mo with Affirm');
  });

  it('omits trailing .00 for whole-dollar Klarna amount', () => {
    // 200 / 4 = 50 → $50 (not $50.00)
    const { klarna } = formatBNPLEstimates(200);
    expect(klarna).toBe('4 payments of $50 with Klarna');
  });

  it('handles string price input', () => {
    const { affirm } = formatBNPLEstimates('120');
    expect(affirm).toBe('As low as $10/mo with Affirm');
  });

  it('returns zero strings for price = 0', () => {
    const { affirm, klarna } = formatBNPLEstimates(0);
    expect(affirm).toBe('');
    expect(klarna).toBe('');
  });

  it('returns zero strings for negative price', () => {
    const { affirm, klarna } = formatBNPLEstimates(-50);
    expect(affirm).toBe('');
    expect(klarna).toBe('');
  });

  it('returns zero strings for non-numeric input', () => {
    const { affirm, klarna } = formatBNPLEstimates('abc');
    expect(affirm).toBe('');
    expect(klarna).toBe('');
  });

  it('returns zero strings for null', () => {
    const { affirm, klarna } = formatBNPLEstimates(null);
    expect(affirm).toBe('');
    expect(klarna).toBe('');
  });

  it('returns zero strings for undefined', () => {
    const { affirm, klarna } = formatBNPLEstimates(undefined);
    expect(affirm).toBe('');
    expect(klarna).toBe('');
  });
});

// ── initBNPLWidget ────────────────────────────────────────────────────────────

function makeEl(text = '') {
  return {
    text,
    _visible: true,
    show: vi.fn(function () { this._visible = true; }),
    hide: vi.fn(function () { this._visible = false; }),
  };
}

function make$w() {
  const els = {
    '#bnplContainer': makeEl(),
    '#bnplAffirm':    makeEl(),
    '#bnplKlarna':    makeEl(),
  };
  return (id) => els[id] ?? makeEl();
}

describe('initBNPLWidget', () => {
  it('sets #bnplAffirm text for valid price', () => {
    const $w = make$w();
    initBNPLWidget($w, 120);
    expect($w('#bnplAffirm').text).toBe('As low as $10/mo with Affirm');
  });

  it('sets #bnplKlarna text for valid price', () => {
    const $w = make$w();
    initBNPLWidget($w, 120);
    expect($w('#bnplKlarna').text).toBe('4 payments of $30 with Klarna');
  });

  it('shows #bnplContainer when price is valid', () => {
    const $w = make$w();
    initBNPLWidget($w, 100);
    expect($w('#bnplContainer').show).toHaveBeenCalled();
  });

  it('hides #bnplContainer when price is 0', () => {
    const $w = make$w();
    initBNPLWidget($w, 0);
    expect($w('#bnplContainer').hide).toHaveBeenCalled();
  });

  it('hides #bnplContainer when price is negative', () => {
    const $w = make$w();
    initBNPLWidget($w, -1);
    expect($w('#bnplContainer').hide).toHaveBeenCalled();
  });

  it('hides #bnplContainer when price is non-numeric', () => {
    const $w = make$w();
    initBNPLWidget($w, 'bad');
    expect($w('#bnplContainer').hide).toHaveBeenCalled();
  });

  it('does not throw when $w selector returns nothing', () => {
    expect(() => initBNPLWidget(() => null, 100)).not.toThrow();
  });
});
