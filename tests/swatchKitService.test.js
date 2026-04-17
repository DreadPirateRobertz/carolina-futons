/**
 * @file swatchKitService.test.js
 * @description Tests for swatchKitService.web.js — Swatch Kit micro-product backend.
 *
 * Covers:
 *  - orderContainsSwatchKit: line item SKU detection
 *  - isQualifyingOrder: $200+ threshold
 *  - recordSwatchKitPurchase: credit issuance, idempotency, CMS write
 *  - getSwatchKitCreditStatus: pending credit lookup, expiry
 *  - markCreditApplied: CMS update
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __onUpdate,
  __setInsertError,
  __setQueryError,
  __setUpdateError,
} from './__mocks__/wix-data.js';

const mockIssueStoreCredit = vi.fn();
vi.mock('backend/storeCreditService.web', () => ({
  issueStoreCredit: (...args) => mockIssueStoreCredit(...args),
}));

const mockGetMember = vi.fn();
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: () => mockGetMember() },
}));

import {
  orderContainsSwatchKit,
  isQualifyingOrder,
  recordSwatchKitPurchase,
  getSwatchKitCreditStatus,
  markCreditApplied,
  SWATCH_KIT_SKU,
  SWATCH_KIT_CREDIT_AMOUNT,
  QUALIFYING_ORDER_MIN,
  CREDIT_EXPIRY_DAYS,
} from '../src/backend/swatchKitService.web.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));
  resetData();
  mockIssueStoreCredit.mockClear();
  mockIssueStoreCredit.mockResolvedValue({ success: true, creditId: 'cred-swatch-001' });
  mockGetMember.mockClear();
  mockGetMember.mockResolvedValue({ _id: 'mem-1' });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// orderContainsSwatchKit
// ---------------------------------------------------------------------------

describe('orderContainsSwatchKit', () => {
  it('returns false for empty line items', () => {
    expect(orderContainsSwatchKit([])).toBe(false);
  });

  it('returns false for null input', () => {
    expect(orderContainsSwatchKit(null)).toBe(false);
  });

  it('returns true when catalogReference.catalogItemId matches SKU', () => {
    const items = [{ catalogReference: { catalogItemId: 'SWATCH-KIT-001' } }];
    expect(orderContainsSwatchKit(items)).toBe(true);
  });

  it('returns true when sku field matches (case insensitive)', () => {
    const items = [{ sku: 'swatch-kit-001' }];
    expect(orderContainsSwatchKit(items)).toBe(true);
  });

  it('returns false when no items match', () => {
    const items = [{ sku: 'SOFA-FRAME-001' }, { sku: 'MATTRESS-001' }];
    expect(orderContainsSwatchKit(items)).toBe(false);
  });

  it('matches in a mixed cart', () => {
    const items = [
      { sku: 'FUTON-FRAME-001' },
      { catalogReference: { catalogItemId: SWATCH_KIT_SKU } },
    ];
    expect(orderContainsSwatchKit(items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isQualifyingOrder
// ---------------------------------------------------------------------------

describe('isQualifyingOrder', () => {
  it('returns false for orders below $200', () => {
    expect(isQualifyingOrder(199.99)).toBe(false);
    expect(isQualifyingOrder(0)).toBe(false);
  });

  it('returns true for orders at exactly $200', () => {
    expect(isQualifyingOrder(200)).toBe(true);
  });

  it('returns true for orders above $200', () => {
    expect(isQualifyingOrder(250)).toBe(true);
  });

  it('parses string amounts', () => {
    expect(isQualifyingOrder('250.00')).toBe(true);
    expect(isQualifyingOrder('150')).toBe(false);
  });

  it('returns false for NaN / non-numeric', () => {
    expect(isQualifyingOrder('abc')).toBe(false);
    expect(isQualifyingOrder(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// recordSwatchKitPurchase — validation
// ---------------------------------------------------------------------------

describe('recordSwatchKitPurchase — validation', () => {
  it('returns invalid_order_id for empty orderId', async () => {
    const result = await recordSwatchKitPurchase('', 'mem-1', 'a@b.com');
    expect(result).toEqual({ success: false, error: 'invalid_order_id' });
  });

  it('returns invalid_email for bad email', async () => {
    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'not-email');
    expect(result).toEqual({ success: false, error: 'invalid_email' });
  });
});

// ---------------------------------------------------------------------------
// recordSwatchKitPurchase — happy path
// ---------------------------------------------------------------------------

describe('recordSwatchKitPurchase — happy path', () => {
  it('issues $5 store credit and inserts CMS record', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'SwatchKitOrders') inserted.push(r); });

    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com', ['sw-a', 'sw-b']);

    expect(result).toEqual({ success: true, creditId: 'cred-swatch-001' });
    expect(mockIssueStoreCredit).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 'mem-1',
      amount: SWATCH_KIT_CREDIT_AMOUNT,
      reason: 'promotion',
      orderReference: 'ORDER-001',
    }));
    expect(inserted.length).toBe(1);
    expect(inserted[0].orderId).toBe('ORDER-001');
    expect(inserted[0].creditId).toBe('cred-swatch-001');
    expect(inserted[0].creditApplied).toBe(false);
    expect(JSON.parse(inserted[0].swatchIds)).toEqual(['sw-a', 'sw-b']);
  });

  it('sets creditExpiresAt 90 days from now', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'SwatchKitOrders') inserted.push(r); });

    await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com');

    const expectedExpiry = new Date('2026-03-28T12:00:00Z');
    expectedExpiry.setDate(expectedExpiry.getDate() + CREDIT_EXPIRY_DAYS);
    expect(inserted[0].creditExpiresAt.getTime()).toBe(expectedExpiry.getTime());
  });

  it('falls back to email as memberId for guest orders', async () => {
    await recordSwatchKitPurchase('ORDER-001', '', 'guest@example.com');
    expect(mockIssueStoreCredit).toHaveBeenCalledWith(expect.objectContaining({
      memberId: 'guest@example.com',
    }));
  });

  it('caps swatchIds at 5', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'SwatchKitOrders') inserted.push(r); });

    await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com',
      ['a', 'b', 'c', 'd', 'e', 'f']);

    expect(JSON.parse(inserted[0].swatchIds)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// recordSwatchKitPurchase — idempotency
// ---------------------------------------------------------------------------

describe('recordSwatchKitPurchase — idempotency', () => {
  it('returns existing creditId without re-issuing on duplicate call', async () => {
    __seed('SwatchKitOrders', [{ _id: 'r1', orderId: 'ORDER-001', creditId: 'existing-credit' }]);

    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com');

    expect(result).toEqual({ success: true, creditId: 'existing-credit', alreadyIssued: true });
    expect(mockIssueStoreCredit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// recordSwatchKitPurchase — error paths
// ---------------------------------------------------------------------------

describe('recordSwatchKitPurchase — error paths', () => {
  it('returns credit_issuance_failed when issueStoreCredit throws', async () => {
    mockIssueStoreCredit.mockRejectedValue(new Error('credit system down'));
    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com');
    expect(result).toEqual({ success: false, error: 'credit_issuance_failed' });
  });

  it('returns credit_issuance_failed when issueStoreCredit returns failure', async () => {
    mockIssueStoreCredit.mockResolvedValue({ success: false, message: 'invalid amount' });
    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com');
    expect(result).toEqual({ success: false, error: 'credit_issuance_failed' });
  });

  it('returns success even when CMS insert fails after credit issued', async () => {
    __setInsertError('SwatchKitOrders', new Error('db error'));
    const result = await recordSwatchKitPurchase('ORDER-001', 'mem-1', 'buyer@example.com');
    expect(result).toEqual({ success: true, creditId: 'cred-swatch-001' });
  });
});

// ---------------------------------------------------------------------------
// getSwatchKitCreditStatus
// ---------------------------------------------------------------------------

function makeSwatchOrder(overrides = {}) {
  return {
    _id: 'rec-1',
    orderId: 'ORDER-001',
    memberId: 'mem-1',
    creditId: 'cred-001',
    creditApplied: false,
    creditExpiresAt: new Date('2026-06-26T12:00:00Z'), // 90 days from now
    ...overrides,
  };
}

describe('getSwatchKitCreditStatus', () => {
  it('returns hasPendingCredit: false when no records', async () => {
    const result = await getSwatchKitCreditStatus();
    expect(result).toEqual({ hasPendingCredit: false });
  });

  it('returns auth_required + warns when getMember returns null (cf-2ag)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetMember.mockResolvedValue(null);
    const result = await getSwatchKitCreditStatus();
    expect(result).toEqual({ hasPendingCredit: false, error: 'auth_required' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[swatchKitService] getSwatchKitCreditStatus: no member on session'),
    );
    warnSpy.mockRestore();
  });

  it('returns auth_required + warns when getMember resolves with no _id (cf-2ag)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetMember.mockResolvedValue({});
    const result = await getSwatchKitCreditStatus();
    expect(result).toEqual({ hasPendingCredit: false, error: 'auth_required' });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[swatchKitService] getSwatchKitCreditStatus: no member on session'),
    );
    warnSpy.mockRestore();
  });

  it('returns pending credit details when found', async () => {
    __seed('SwatchKitOrders', [makeSwatchOrder()]);
    const result = await getSwatchKitCreditStatus();
    expect(result.hasPendingCredit).toBe(true);
    expect(result.creditId).toBe('cred-001');
    expect(result.amount).toBe(SWATCH_KIT_CREDIT_AMOUNT);
  });

  it('returns expired: true when credit expiry has passed', async () => {
    __seed('SwatchKitOrders', [makeSwatchOrder({
      creditExpiresAt: new Date('2026-01-01T00:00:00Z'), // past
    })]);
    const result = await getSwatchKitCreditStatus();
    expect(result).toMatchObject({ hasPendingCredit: false, expired: true });
  });

  it('returns lookup_failed on query error', async () => {
    __setQueryError('SwatchKitOrders', new Error('db error'));
    const result = await getSwatchKitCreditStatus();
    expect(result).toMatchObject({ hasPendingCredit: false, error: 'lookup_failed' });
  });

  it('queries by the session memberId, not a caller-supplied id', async () => {
    __seed('SwatchKitOrders', [makeSwatchOrder({ memberId: 'mem-1' })]);
    mockGetMember.mockResolvedValue({ _id: 'mem-1' });
    const result = await getSwatchKitCreditStatus();
    expect(result.hasPendingCredit).toBe(true);
    // Verifies the session memberId (mem-1) was used, not any caller-provided value
    expect(mockGetMember).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// markCreditApplied
// ---------------------------------------------------------------------------

describe('markCreditApplied', () => {
  it('returns invalid_params for empty creditId', async () => {
    const result = await markCreditApplied('', 'ORDER-002');
    expect(result).toEqual({ success: false, error: 'invalid_params' });
  });

  it('returns invalid_params for empty appliedOrderId', async () => {
    const result = await markCreditApplied('cred-001', '');
    expect(result).toEqual({ success: false, error: 'invalid_params' });
  });

  it('returns not_found when no record matches creditId', async () => {
    const result = await markCreditApplied('cred-001', 'ORDER-002');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('marks the record as applied on success', async () => {
    __seed('SwatchKitOrders', [makeSwatchOrder()]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'SwatchKitOrders') updated.push(r); });

    const result = await markCreditApplied('cred-001', 'ORDER-002');

    expect(result).toEqual({ success: true });
    expect(updated[0].creditApplied).toBe(true);
    expect(updated[0].appliedOrderId).toBe('ORDER-002');
  });

  it('returns update_failed on CMS update error', async () => {
    __seed('SwatchKitOrders', [makeSwatchOrder()]);
    __setUpdateError('SwatchKitOrders', new Error('db error'));

    const result = await markCreditApplied('cred-001', 'ORDER-002');
    expect(result).toEqual({ success: false, error: 'update_failed' });
  });
});
