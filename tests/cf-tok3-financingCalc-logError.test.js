/**
 * @file cf-tok3-financingCalc-logError.test.js
 * @description cf-tok3 financingCalc batch: pin the source migration from
 * console.error to canonical logError.
 *
 * Note: financingCalc's 4 catch blocks are functionally unreachable from
 * external input — toNumber() gates every public method's parameter and
 * the downstream helpers (calculateAllTerms, calculateAfterpay, amortize)
 * are pure math over a hardcoded TERM_PLANS table. So the meaningful
 * regression pin here is the source-scan guard plus happy-path snapshots
 * confirming the success path didn't change. If the catch DOES fire in
 * production (unforeseen runtime error), the logError path will now route
 * structured context to Wix runtime logs / Sentry-ingest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));

import {
  getFinancingWidget,
  calculateForTerm,
  getAfterpayBreakdown,
  getCartFinancing,
} from '../src/backend/financingCalc.web.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cf-tok3 financingCalc — console.error → logError migration', () => {
  it('source file contains zero raw console.error calls (canonical logError only)', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../src/backend/financingCalc.web.js', import.meta.url),
      'utf8',
    );
    const stripped = src.replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/console\.error/);
  });

  it('source file imports logError from backend/utils/errorHandler', async () => {
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(
      new URL('../src/backend/financingCalc.web.js', import.meta.url),
      'utf8',
    );
    expect(src).toMatch(
      /import\s+\{\s*logError\s*\}\s+from\s+['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('getFinancingWidget happy path unchanged after migration', async () => {
    const result = await getFinancingWidget(1000);
    expect(result.success).toBe(true);
    expect(result.price).toBe(1000);
    expect(result.eligible).toBe(true);
    expect(Array.isArray(result.terms)).toBe(true);
  });

  it('calculateForTerm happy path unchanged after migration', async () => {
    const result = await calculateForTerm(1200, 12);
    expect(result.success).toBe(true);
    expect(result.months).toBe(12);
    expect(result.isZeroInterest).toBe(true);
  });

  it('getAfterpayBreakdown happy path unchanged after migration', async () => {
    const result = await getAfterpayBreakdown(400);
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.installments).toBe(4);
  });

  it('getCartFinancing happy path unchanged after migration', async () => {
    const result = await getCartFinancing(800);
    expect(result.success).toBe(true);
    expect(result.cartTotal).toBe(800);
    expect(result.afterpay.eligible).toBe(true);
  });
});
