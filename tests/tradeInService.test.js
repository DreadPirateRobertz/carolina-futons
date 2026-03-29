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
} from './__mocks__/wix-data.js';
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

  it('returns success with requestId starting TI-', async () => {
    const result = await submitTradeInRequest(validRequest);
    expect(result.success).toBe(true);
    expect(result.requestId).toMatch(/^TI-[A-Z0-9]+$/);
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

describe('confirmTradeIn', () => {
  it('returns not_found when requestId does not exist', async () => {
    const result = await confirmTradeIn('TI-NONEXIST', 'good');
    expect(result).toEqual({ success: false, error: 'not_found' });
  });

  it('returns already_processed for non-pending request', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ status: 'confirmed' })]);
    const result = await confirmTradeIn('TI-ABCD1234', 'good');
    expect(result).toMatchObject({ success: false, error: 'already_processed', status: 'confirmed' });
  });

  it('returns invalid_condition for unknown condition', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const result = await confirmTradeIn('TI-ABCD1234', 'excellent');
    expect(result).toEqual({ success: false, error: 'invalid_condition' });
  });

  it('updates status to declined when declined', async () => {
    __seed('TradeInRequests', [makeTradeInRecord()]);
    const updated = [];
    __onUpdate((col, r) => { if (col === 'TradeInRequests') updated.push(r); });
    const result = await confirmTradeIn('TI-ABCD1234', 'declined', 'Poor structural condition');
    expect(result).toEqual({ success: true, status: 'declined' });
    expect(updated[0].status).toBe('declined');
    expect(updated[0].staffNotes).toBe('Poor structural condition');
  });

  it('returns creditAmount: 0 for poor-condition mattress (no credit)', async () => {
    __seed('TradeInRequests', [makeTradeInRecord({ productType: 'futon-mattress', condition: 'poor' })]);
    const result = await confirmTradeIn('TI-ABCD1234', 'poor');
    expect(result).toMatchObject({ success: true, status: 'confirmed', creditAmount: 0 });
  });

  it('returns invalid_request_id for empty requestId', async () => {
    const result = await confirmTradeIn('', 'good');
    expect(result).toEqual({ success: false, error: 'invalid_request_id' });
  });
});
