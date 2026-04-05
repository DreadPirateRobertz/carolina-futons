/**
 * @file BNPLCalculatorWidget.test.js
 * @description Tests for CF-zpf: BNPLCalculatorWidget — interactive multi-provider
 * BNPL comparison widget using real backend calculations.
 *
 * Covers:
 *  formatDollar:
 *   - whole dollars omit cents
 *   - fractional amounts show 2dp
 *   - negative / non-finite return empty string
 *   - zero returns '$0'
 *
 *  buildComparisonRows:
 *   - returns [] for failed/ineligible backend result
 *   - includes in-house term rows with 0% APR note
 *   - includes in-house term rows with non-zero APR note
 *   - includes Afterpay row when eligible
 *   - omits Afterpay when ineligible
 *   - includes Affirm estimate when price >= 50
 *   - omits Affirm when price < 50
 *   - includes Klarna when price is 35–1000
 *   - omits Klarna when price > 1000
 *   - omits Klarna when price < 35
 *   - row _id values are unique
 *   - skips in-house terms with invalid monthly amount
 *
 *  initBNPLCalculator:
 *   - hides container for price = 0
 *   - hides container for negative price
 *   - hides container for non-finite price
 *   - hides container when backend returns ineligible
 *   - shows container with rows when backend succeeds
 *   - sets lowestMonthly text on #bnplCalcLowest
 *   - passes rows to repeater.data
 *   - hides container on backend error
 *   - tolerates missing #bnplCalcContainer via safeGet
 *   - tolerates missing #bnplCalcLowest
 *   - tolerates missing #bnplCalcRepeater
 *
 *  initBNPLCalculator — toggle:
 *   - initialises #bnplCalcDetails collapsed
 *   - sets #bnplCalcToggle label to "See all options"
 *   - expands details and updates toggle label on first click
 *   - collapses details and resets toggle label on second click
 *   - tolerates missing #bnplCalcToggle or #bnplCalcDetails
 *
 *  updateBNPLCalculatorPrice:
 *   - delegates to initBNPLCalculator
 *   - hides when new price is invalid
 *
 * CF-zpf
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatDollar, buildComparisonRows, initBNPLCalculator, updateBNPLCalculatorPrice } from '../src/public/BNPLCalculatorWidget.js';

// ── $w mock infrastructure ─────────────────────────────────────────────────────

const elements = new Map();
function createMockElement() {
  return {
    text: '', label: '', data: [], collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    onClick: vi.fn(function (fn) { this._clickFn = fn; }),
    onItemReady: vi.fn(),
    _clickFn: null,
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Backend mock ───────────────────────────────────────────────────────────────

const mockGetFinancingWidget = vi.fn();
vi.mock('backend/financingCalc.web', () => ({
  getFinancingWidget: (...args) => mockGetFinancingWidget(...args),
}));

function makeSuccessResult(overrides = {}) {
  return {
    success: true,
    eligible: true,
    lowestMonthly: 'As low as $42/mo',
    terms: [
      { months: 12, monthly: 42, apr: 0 },
      { months: 24, monthly: 25, apr: 9.99 },
    ],
    afterpay: { eligible: true, installmentAmount: 125, schedule: [] },
    ...overrides,
  };
}

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  mockGetFinancingWidget.mockResolvedValue(makeSuccessResult());
});

// ── formatDollar ───────────────────────────────────────────────────────────────

describe('formatDollar', () => {
  it('returns $X for whole-dollar amounts', () => {
    expect(formatDollar(25)).toBe('$25');
    expect(formatDollar(100)).toBe('$100');
    expect(formatDollar(0)).toBe('$0');
  });

  it('returns $X.XX for fractional amounts', () => {
    expect(formatDollar(8.33)).toBe('$8.33');
    expect(formatDollar(2.50)).toBe('$2.50');
    expect(formatDollar(99.99)).toBe('$99.99');
  });

  it('returns empty string for negative amounts', () => {
    expect(formatDollar(-1)).toBe('');
  });

  it('returns empty string for non-finite values', () => {
    expect(formatDollar(Infinity)).toBe('');
    expect(formatDollar(NaN)).toBe('');
  });
});

// ── buildComparisonRows ────────────────────────────────────────────────────────

describe('buildComparisonRows', () => {
  it('returns [] when backend result is null', () => {
    expect(buildComparisonRows(500, null)).toEqual([]);
  });

  it('returns [] when success is false', () => {
    expect(buildComparisonRows(500, { success: false, eligible: false })).toEqual([]);
  });

  it('returns [] when eligible is false', () => {
    expect(buildComparisonRows(500, { success: true, eligible: false, terms: [], afterpay: { eligible: false } })).toEqual([]);
  });

  it('includes in-house term rows', () => {
    const result = makeSuccessResult();
    const rows = buildComparisonRows(500, result);
    const names = rows.map(r => r.name);
    expect(names).toContain('In-house 12 mo');
    expect(names).toContain('In-house 24 mo');
  });

  it('shows 0% APR note for zero-interest terms', () => {
    const result = makeSuccessResult({ terms: [{ months: 12, monthly: 42, apr: 0 }] });
    const rows = buildComparisonRows(500, result);
    const term12 = rows.find(r => r.name === 'In-house 12 mo');
    expect(term12.note).toBe('0% APR');
  });

  it('shows APR percentage note for non-zero-interest terms', () => {
    const result = makeSuccessResult({ terms: [{ months: 24, monthly: 25, apr: 9.99 }] });
    const rows = buildComparisonRows(500, result);
    const term24 = rows.find(r => r.name === 'In-house 24 mo');
    expect(term24.note).toBe('9.99% APR');
  });

  it('formats in-house monthly amount correctly', () => {
    const result = makeSuccessResult({ terms: [{ months: 12, monthly: 42, apr: 0 }] });
    const rows = buildComparisonRows(500, result);
    expect(rows.find(r => r.name === 'In-house 12 mo').amount).toBe('$42/mo');
  });

  it('includes Afterpay row when eligible', () => {
    const result = makeSuccessResult({ afterpay: { eligible: true, installmentAmount: 125 } });
    const rows = buildComparisonRows(500, result);
    const ap = rows.find(r => r.name === 'Afterpay');
    expect(ap).toBeTruthy();
    expect(ap.amount).toBe('4 × $125');
  });

  it('omits Afterpay when ineligible', () => {
    const result = makeSuccessResult({ afterpay: { eligible: false, installmentAmount: 0 } });
    const rows = buildComparisonRows(500, result);
    expect(rows.find(r => r.name === 'Afterpay')).toBeUndefined();
  });

  it('includes Affirm estimate when price >= 50', () => {
    const rows = buildComparisonRows(600, makeSuccessResult({ terms: [], afterpay: { eligible: false } }));
    const affirm = rows.find(r => r.name === 'Affirm (est.)');
    expect(affirm).toBeTruthy();
    // 600 / 12 = 50
    expect(affirm.amount).toBe('$50/mo');
  });

  it('omits Affirm when price < 50', () => {
    const rows = buildComparisonRows(49, makeSuccessResult({ terms: [], afterpay: { eligible: false } }));
    expect(rows.find(r => r.name === 'Affirm (est.)')).toBeUndefined();
  });

  it('includes Klarna when price is between $35 and $1000', () => {
    const rows = buildComparisonRows(500, makeSuccessResult({ terms: [], afterpay: { eligible: false } }));
    const klarna = rows.find(r => r.name === 'Klarna');
    expect(klarna).toBeTruthy();
    // 500 / 4 = 125
    expect(klarna.amount).toBe('4 × $125');
  });

  it('omits Klarna when price > 1000', () => {
    const rows = buildComparisonRows(1001, makeSuccessResult({ terms: [], afterpay: { eligible: false } }));
    expect(rows.find(r => r.name === 'Klarna')).toBeUndefined();
  });

  it('omits Klarna when price < 35', () => {
    const rows = buildComparisonRows(34, makeSuccessResult({ terms: [], afterpay: { eligible: false } }));
    expect(rows.find(r => r.name === 'Klarna')).toBeUndefined();
  });

  it('produces unique _id values for all rows', () => {
    const rows = buildComparisonRows(500, makeSuccessResult());
    const ids = rows.map(r => r._id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips in-house terms when monthly amount is invalid', () => {
    const result = makeSuccessResult({ terms: [{ months: 12, monthly: NaN, apr: 0 }] });
    const rows = buildComparisonRows(500, result);
    expect(rows.find(r => r.name === 'In-house 12 mo')).toBeUndefined();
  });
});

// ── initBNPLCalculator ─────────────────────────────────────────────────────────

describe('initBNPLCalculator', () => {
  it('hides container for price = 0', async () => {
    await initBNPLCalculator($w, 0);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('hides container for negative price', async () => {
    await initBNPLCalculator($w, -100);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('hides container for non-finite price', async () => {
    await initBNPLCalculator($w, Infinity);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('hides container for NaN price', async () => {
    await initBNPLCalculator($w, NaN);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('hides container when backend returns ineligible', async () => {
    mockGetFinancingWidget.mockResolvedValueOnce({ success: true, eligible: false, terms: [], afterpay: { eligible: false } });
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('shows container when backend succeeds', async () => {
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcContainer').show).toHaveBeenCalled();
  });

  it('sets lowestMonthly text on #bnplCalcLowest', async () => {
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcLowest').text).toBe('As low as $42/mo');
  });

  it('passes rows to #bnplCalcRepeater.data', async () => {
    await initBNPLCalculator($w, 500);
    const data = getEl('#bnplCalcRepeater').data;
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('hides container on backend error', async () => {
    mockGetFinancingWidget.mockRejectedValueOnce(new Error('network fail'));
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('tolerates missing #bnplCalcContainer (does not throw)', async () => {
    // Override $w to return null for container
    const nullContainerW = (sel) => sel === '#bnplCalcContainer' ? null : getEl(sel);
    await expect(initBNPLCalculator(nullContainerW, 500)).resolves.not.toThrow();
  });

  it('tolerates missing #bnplCalcLowest (does not throw)', async () => {
    const nullLowestW = (sel) => sel === '#bnplCalcLowest' ? null : getEl(sel);
    await expect(initBNPLCalculator(nullLowestW, 500)).resolves.not.toThrow();
  });

  it('tolerates missing #bnplCalcRepeater (does not throw)', async () => {
    const nullRepeaterW = (sel) => sel === '#bnplCalcRepeater' ? null : getEl(sel);
    await expect(initBNPLCalculator(nullRepeaterW, 500)).resolves.not.toThrow();
  });
});

// ── initBNPLCalculator — toggle behaviour ──────────────────────────────────────

describe('initBNPLCalculator — toggle', () => {
  it('initialises #bnplCalcDetails collapsed', async () => {
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcDetails').collapse).toHaveBeenCalled();
  });

  it('sets #bnplCalcToggle label to "See all options"', async () => {
    await initBNPLCalculator($w, 500);
    expect(getEl('#bnplCalcToggle').label).toBe('See all options');
  });

  it('expands details and updates label on first click', async () => {
    await initBNPLCalculator($w, 500);
    const details = getEl('#bnplCalcDetails');
    const btn = getEl('#bnplCalcToggle');

    // details is collapsed after init
    details.collapsed = true;
    btn._clickFn();

    expect(details.expand).toHaveBeenCalled();
    expect(btn.label).toBe('Hide options');
  });

  it('collapses details and resets label on second click', async () => {
    await initBNPLCalculator($w, 500);
    const details = getEl('#bnplCalcDetails');
    const btn = getEl('#bnplCalcToggle');

    // Simulate expand, then collapse
    details.collapsed = true;
    btn._clickFn();   // expand
    details.collapsed = false;
    btn._clickFn();   // collapse

    expect(details.collapse).toHaveBeenCalled();
    expect(btn.label).toBe('See all options');
  });

  it('tolerates missing #bnplCalcToggle (does not throw)', async () => {
    const nullToggleW = (sel) => sel === '#bnplCalcToggle' ? null : getEl(sel);
    await expect(initBNPLCalculator(nullToggleW, 500)).resolves.not.toThrow();
  });

  it('tolerates missing #bnplCalcDetails (does not throw)', async () => {
    const nullDetailsW = (sel) => sel === '#bnplCalcDetails' ? null : getEl(sel);
    await expect(initBNPLCalculator(nullDetailsW, 500)).resolves.not.toThrow();
  });
});

// ── updateBNPLCalculatorPrice ──────────────────────────────────────────────────

describe('updateBNPLCalculatorPrice', () => {
  it('shows container when new price is valid', async () => {
    await updateBNPLCalculatorPrice($w, 800);
    expect(getEl('#bnplCalcContainer').show).toHaveBeenCalled();
  });

  it('hides container when new price is invalid', async () => {
    await updateBNPLCalculatorPrice($w, -1);
    expect(getEl('#bnplCalcContainer').hide).toHaveBeenCalled();
  });

  it('calls backend with the new price', async () => {
    await updateBNPLCalculatorPrice($w, 999);
    expect(mockGetFinancingWidget).toHaveBeenCalledWith(999);
  });
});
