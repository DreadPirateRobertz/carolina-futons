/**
 * @file tradeInService.test.js
 * @description Tests for tradeInService.web.js — Trade-In / Trade-Up backend.
 *
 * Covers:
 *  - estimateTradeIn: valid/invalid product types and conditions, credit matrix, ranges
 *  - submitTradeInRequest: validation, rate limiting, CMS insert, requestId format
 *  - getTradeInRequest: lookup, email verification, not found
 *  - confirmTradeIn: staff confirmation, credit issuance, decline, already-processed guard
 *  - creditRange: base calculation, floor at zero
 *  - CONDITION_MATRIX shape
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

// Mock storeCreditService so confirmTradeIn can be tested without a live credit system.
const mockIssueStoreCredit = vi.fn();
vi.mock('backend/storeCreditService.web', () => ({
  issueStoreCredit: (...args) => mockIssueStoreCredit(...args),
}));
import {
  estimateTradeIn,
  submitTradeInRequest,
  getTradeInRequest,
  confirmTradeIn,
  creditRange,
  CONDITION_MATRIX,
  VALID_PRODUCT_TYPES,
  VALID_CONDITIONS,
} from '../src/backend/tradeInService.web.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-28T15:00:00Z'));
  resetData();
  mockIssueStoreCredit.mockResolvedValue({ creditId: 'cred-test-123' });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// creditRange
// ---------------------------------------------------------------------------

describe('creditRange', () => {
  it('returns min=0 max=0 for base <= 0', () => {
    expect(creditRange(0)).toEqual({ min: 0, max: 0 });
    expect(creditRange(-10)).toEqual({ min: 0, max: 0 });
  });

  it('returns ±15% range for positive base', () => {
    const { min, max } = creditRange(100);
    expect(min).toBe(85);
    expect(max).toBe(115);
  });

  it('floors min at 0', () => {
    // base=5, delta=1 → min=4, max=6
    const { min } = creditRange(5);
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it('returns symmetric range for futon-frame good ($75)', () => {
    const { min, max } = creditRange(75);
    expect(min).toBe(64); // 75 - round(75*0.15)=11
    expect(max).toBe(86);
  });
});

// ---------------------------------------------------------------------------
// CONDITION_MATRIX
// ---------------------------------------------------------------------------

describe('CONDITION_MATRIX', () => {
  it('covers all VALID_PRODUCT_TYPES', () => {
    for (const type of VALID_PRODUCT_TYPES) {
      expect(CONDITION_MATRIX).toHaveProperty(type);
    }
  });

  it('covers all VALID_CONDITIONS for each type', () => {
    for (const type of VALID_PRODUCT_TYPES) {
      for (const cond of VALID_CONDITIONS) {
        expect(typeof CONDITION_MATRIX[type][cond]).toBe('number');
      }
    }
  });

  it('futon-mattress poor has 0 credit (hygiene)', () => {
    expect(CONDITION_MATRIX['futon-mattress']['poor']).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// estimateTradeIn
// ---------------------------------------------------------------------------

describe('estimateTradeIn', () => {
  it('returns { eligible: false } for unknown product type', async () => {
    const result = await estimateTradeIn('dishwasher', 'good');
    expect(result).toEqual({ eligible: false });
  });

  it('returns { eligible: false, error: invalid_condition } for bad condition', async () => {
    const result = await estimateTradeIn('futon-frame', 'mint');
    expect(result).toMatchObject({ eligible: false, error: 'invalid_condition' });
  });

  it('returns estimate with min/max/base for futon-frame good', async () => {
    const result = await estimateTradeIn('futon-frame', 'good');
    expect(result.eligible).toBe(true);
    expect(result.base).toBe(75);
    expect(result.min).toBeLessThan(result.base);
    expect(result.max).toBeGreaterThan(result.base);
  });

  it('returns min=0 max=0 for futon-mattress poor (hygiene)', async () => {
    const result = await estimateTradeIn('futon-mattress', 'poor');
    expect(result.eligible).toBe(true);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
  });

  it('sanitizes and lowercases inputs', async () => {
    const result = await estimateTradeIn('  Futon-Frame  ', '  GOOD  ');
    expect(result.eligible).toBe(true);
  });

  it('returns correct productType and condition in response', async () => {
    const result = await estimateTradeIn('murphy-bed', 'fair');
    expect(result.productType).toBe('murphy-bed');
    expect(result.condition).toBe('fair');
  });
});

// ---------------------------------------------------------------------------
// submitTradeInRequest — validation
// ---------------------------------------------------------------------------

describe('submitTradeInRequest — validation', () => {
  it('returns invalid_request for non-object input', async () => {
    const result = await submitTradeInRequest(null);
    expect(result).toEqual({ success: false, error: 'invalid_request' });
  });

  it('returns name_required when name is empty', async () => {
    const result = await submitTradeInRequest({
      name: '', email: 'a@b.com', productType: 'futon-frame', condition: 'good',
    });
    expect(result).toEqual({ success: false, error: 'name_required' });
  });

  it('returns invalid_email for malformed email', async () => {
    const result = await submitTradeInRequest({
      name: 'Alice', email: 'not-an-email', productType: 'futon-frame', condition: 'good',
    });
    expect(result).toEqual({ success: false, error: 'invalid_email' });
  });

  it('returns invalid_product_type for unknown type', async () => {
    const result = await submitTradeInRequest({
      name: 'Alice', email: 'a@b.com', productType: 'blender', condition: 'good',
    });
    expect(result).toEqual({ success: false, error: 'invalid_product_type' });
  });

  it('returns invalid_condition for unknown condition', async () => {
    const result = await submitTradeInRequest({
      name: 'Alice', email: 'a@b.com', productType: 'futon-frame', condition: 'excellent',
    });
    expect(result).toEqual({ success: false, error: 'invalid_condition' });
  });
});

// ---------------------------------------------------------------------------
// submitTradeInRequest — happy path
// ---------------------------------------------------------------------------

const validRequest = {
  name: 'Alice Futon',
  email: 'alice@example.com',
  productType: 'futon-frame',
  condition: 'good',
};

describe('submitTradeInRequest — happy path', () => {
  it('inserts a TradeInRequests record on success', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'TradeInRequests') inserted.push(r); });
    await submitTradeInRequest(validRequest);
    expect(inserted.length).toBe(1);
    expect(inserted[0].productType).toBe('futon-frame');
    expect(inserted[0].condition).toBe('good');
    expect(inserted[0].status).toBe('pending');
  });

  it('returns success with collision-safe UUID-based requestId', async () => {
    const result = await submitTradeInRequest(validRequest);
    expect(result.success).toBe(true);
    expect(result.requestId).toMatch(/^TI-[A-F0-9]{12}$/);
  });

  it('returns estimatedCredit matching the condition matrix', async () => {
    const result = await submitTradeInRequest(validRequest);
    expect(result.estimatedCredit).toBe(CONDITION_MATRIX['futon-frame']['good']);
  });

  it('returns estimatedMin and estimatedMax in response', async () => {
    const result = await submitTradeInRequest(validRequest);
    expect(result.estimatedMin).toBeLessThan(result.estimatedCredit);
    expect(result.estimatedMax).toBeGreaterThan(result.estimatedCredit);
  });

  it('returns submission_failed when CMS insert throws', async () => {
    __setInsertError('TradeInRequests', new Error('db error'));
    const result = await submitTradeInRequest(validRequest);
    expect(result).toEqual({ success: false, error: 'submission_failed' });
  });
});

// ---------------------------------------------------------------------------
// submitTradeInRequest — rate limiting
// ---------------------------------------------------------------------------

describe('submitTradeInRequest — rate limiting', () => {
  it('allows up to 3 submissions per email in 24h', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await submitTradeInRequest(validRequest);
      expect(r.success).toBe(true);
    }
  });

  it('blocks the 4th submission within 24h', async () => {
    for (let i = 0; i < 3; i++) {
      await submitTradeInRequest(validRequest);
    }
    const result = await submitTradeInRequest(validRequest);
    expect(result).toEqual({ success: false, error: 'rate_limited' });
  });

  it('resets rate limit after 24h window', async () => {
    for (let i = 0; i < 3; i++) {
      await submitTradeInRequest(validRequest);
    }
    // Advance past the 24h window
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    const result = await submitTradeInRequest(validRequest);
    expect(result.success).toBe(true);
  });

  it('allows request when rate limit DB query fails (fail-open)', async () => {
    __setQueryError('TradeInRateLimit', new Error('db error'));
    const result = await submitTradeInRequest(validRequest);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTradeInRequest
// ---------------------------------------------------------------------------

function makeTradeInRecord(overrides = {}) {
  return {
    _id: 'rec-1',
    requestId: 'TI-ABCD1234',
    email: 'alice@example.com',
    name: 'Alice',
    productType: 'futon-frame',
    condition: 'good',
    status: 'pending',
    estimatedMin: 64,
    estimatedMax: 86,
    createdAt: new Date('2026-03-28T10:00:00Z'),
    expiresAt: new Date('2026-04-27T10:00:00Z'),
    ...overrides,
  };
}

describe('getTradeInRequest', () => {
  it('returns not_found when no match exists', async () => {
    const result = await getTradeInRequest('TI-ABCD1234', 'alice@example.com');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('returns not_found when email does not match', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const result = await getTradeInRequest('TI-ABCD1234', 'other@example.com');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('returns request details on valid lookup', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const result = await getTradeInRequest('TI-ABCD1234', 'alice@example.com');
    expect(result.success).toBe(true);
    expect(result.request.requestId).toBe('TI-ABCD1234');
    expect(result.request.status).toBe('pending');
    expect(result.request.estimatedMin).toBe(64);
  });

  it('returns invalid_request for empty requestId', async () => {
    const result = await getTradeInRequest('', 'alice@example.com');
    expect(result).toMatchObject({ success: false, error: 'invalid_request' });
  });

  it('returns invalid_request for invalid email', async () => {
    const result = await getTradeInRequest('TI-ABCD1234', 'not-email');
    expect(result).toMatchObject({ success: false, error: 'invalid_request' });
  });
});

// ---------------------------------------------------------------------------
// confirmTradeIn
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = 'alice@example.com'; // matches makeTradeInRecord default

describe('confirmTradeIn', () => {
  it('returns invalid_request_id for empty requestId', async () => {
    const result = await confirmTradeIn('', ADMIN_EMAIL, 'good');
    expect(result).toEqual({ success: false, error: 'invalid_request_id' });
  });

  it('returns invalid_email for missing customerEmail', async () => {
    const result = await confirmTradeIn('TI-ABCD1234', '', 'good');
    expect(result).toEqual({ success: false, error: 'invalid_email' });
  });

  it('returns not_found when requestId does not exist', async () => {
    const result = await confirmTradeIn('TI-NONEXIST', ADMIN_EMAIL, 'good');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('returns not_found when email does not match (IDOR prevention)', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const result = await confirmTradeIn('TI-ABCD1234', 'staff-typo@example.com', 'good');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('returns already_processed for non-pending request', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ status: 'confirmed' })]);
    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good');
    expect(result).toMatchObject({ success: false, error: 'already_processed', status: 'confirmed' });
  });

  it('returns already_processed for processing status (concurrent retry blocked)', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ status: 'processing' })]);
    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good');
    expect(result).toMatchObject({ success: false, error: 'already_processed', status: 'processing' });
  });

  it('returns invalid_condition for unknown condition', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'excellent');
    expect(result).toEqual({ success: false, error: 'invalid_condition' });
  });

  it('updates status to declined when declined', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'TradeInRequests') updated.push(r); });
    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'declined', 'Poor structural condition');
    expect(result).toEqual({ success: true, status: 'declined' });
    expect(updated[0].status).toBe('declined');
    expect(updated[0].staffNotes).toBe('Poor structural condition');
  });

  it('returns creditAmount: 0 for poor-condition mattress (no credit)', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-mattress', condition: 'poor' })]);
    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'poor');
    expect(result).toMatchObject({ success: true, status: 'confirmed', creditAmount: 0 });
  });

  it('issues store credit and updates CMS on happy path', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-frame', condition: 'good' })]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'TradeInRequests') updated.push(r); });

    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good', 'Looks great');

    expect(result).toMatchObject({ success: true, status: 'confirmed', creditAmount: 75, creditId: 'cred-test-123' });
    expect(mockIssueStoreCredit).toHaveBeenCalledWith(expect.objectContaining({
      amount: 75,
      reason: 'promotion',
      orderReference: 'TI-ABCD1234',
    }));
    // First update: processing lock. Second update: confirmed with creditId.
    const confirmUpdate = updated.find(r => r.status === 'confirmed');
    expect(confirmUpdate.creditId).toBe('cred-test-123');
    expect(confirmUpdate.staffNotes).toBe('Looks great');
  });

  it('sets processing status before credit issuance (double-issue lock)', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-frame', condition: 'good' })]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'TradeInRequests') updated.push(r); });

    await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good');

    expect(updated[0].status).toBe('processing'); // processing lock first
    expect(updated[1].status).toBe('confirmed');  // then confirmed
  });

  it('returns credit_issuance_failed when issueStoreCredit throws', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-frame', condition: 'good' })]);
    mockIssueStoreCredit.mockRejectedValue(new Error('credit service down'));

    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good');
    expect(result).toEqual({ success: false, error: 'credit_issuance_failed' });
  });

  it('returns update_failed when processing-lock CMS update throws', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-frame', condition: 'good' })]);
    __setUpdateError('TradeInRequests', new Error('db error'));

    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'good');
    expect(result).toEqual({ success: false, error: 'update_failed' });
  });

  it('returns update_failed when declined CMS update throws', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    __setUpdateError('TradeInRequests', new Error('db error'));

    const result = await confirmTradeIn('TI-ABCD1234', ADMIN_EMAIL, 'declined');
    expect(result).toEqual({ success: false, error: 'update_failed' });
  });
});

// ---------------------------------------------------------------------------
// getTradeInRequest — error path
// ---------------------------------------------------------------------------

describe('getTradeInRequest — error path', () => {
  it('returns lookup_failed when wixData query throws', async () => {
    __setQueryError('TradeInRequests', new Error('db error'));
    const result = await getTradeInRequest('TI-ABCD1234', 'alice@example.com');
    expect(result).toEqual({ success: false, error: 'lookup_failed' });
  });
});

// ---------------------------------------------------------------------------
// submitTradeInRequest — photo URL filtering
// ---------------------------------------------------------------------------

describe('submitTradeInRequest — photo URL filtering', () => {
  it('filters out non-Wix media URLs', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'TradeInRequests') inserted.push(r); });

    await submitTradeInRequest({
      ...validRequest,
      photoUrls: [
        'wix:image://v1/abc123.jpg/img.jpg', // valid Wix media
        'https://evil.com/bad.jpg',           // invalid
        'javascript:alert(1)',                // invalid
        'wix:image://v1/def456.png/img.png', // valid
      ],
    });

    const stored = JSON.parse(inserted[0].photoUrls);
    expect(stored).toHaveLength(2);
    expect(stored.every(u => u.startsWith('wix:'))).toBe(true);
  });

  it('allows an empty photoUrls array', async () => {
    const result = await submitTradeInRequest({ ...validRequest, photoUrls: [] });
    expect(result.success).toBe(true);
  });

  it('handles missing photoUrls field gracefully', async () => {
    const result = await submitTradeInRequest(validRequest); // no photoUrls
    expect(result.success).toBe(true);
  });

  it('caps photo list at 5', async () => {
    const inserted = [];
    __onInsert((col, r) => { if (col === 'TradeInRequests') inserted.push(r); });

    const sixPhotos = Array.from({ length: 6 }, (_, i) => `wix:image://v1/img${i}.jpg/img.jpg`);
    await submitTradeInRequest({ ...validRequest, photoUrls: sixPhotos });

    const stored = JSON.parse(inserted[0].photoUrls);
    expect(stored).toHaveLength(5);
  });
});
