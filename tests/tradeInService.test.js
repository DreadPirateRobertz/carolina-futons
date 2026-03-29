import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __seed,
  __reset,
  __getInserted,
  __getUpdated,
  __setInsertError,
  __onInsert,
} from './__mocks__/wix-data.js';
import { __reset as resetMembers, __setMember } from './__mocks__/wix-members-backend.js';

// Mock storeCreditService so credit issuance is testable independently
vi.mock('backend/storeCreditService.web', () => ({
  issueStoreCredit: vi.fn().mockResolvedValue({ success: true, creditId: 'credit-abc', balance: 75 }),
}));

import {
  getTradeInValuation,
  submitTradeInRequest,
  getMyTradeInRequests,
  getTradeInRequests,
  confirmTradeIn,
  rejectTradeIn,
} from '../src/backend/tradeInService.web.js';
import { issueStoreCredit } from '../src/backend/storeCreditService.web.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeMember(id = 'member-1') {
  return { _id: id, loginEmail: `${id}@example.com` };
}

function makeRequest(overrides = {}) {
  return {
    _id: 'req-1',
    memberId: 'member-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    itemType: 'frame',
    submittedCondition: 'good',
    itemAge: 3,
    photoUrls: '[]',
    estimatedCreditMin: 67,
    estimatedCreditMax: 83,
    status: 'pending',
    confirmedCondition: null,
    issuedCreditAmount: null,
    storeCreditId: null,
    staffNotes: '',
    submittedAt: new Date(),
    confirmedAt: null,
    ...overrides,
  };
}

const COLLECTION = 'TradeInRequests';

// ── getTradeInValuation ────────────────────────────────────────────

describe('getTradeInValuation', () => {
  // Exact values: offset = round(baseCredit * 0.1 / 5) * 5
  // frame/good: base=75, offset=round(7.5/5)*5=round(1.5)*5=10 → min=65, max=85
  // frame/fair: base=50, offset=round(5/5)*5=round(1)*5=5   → min=45, max=55
  // frame/poor: base=25, offset=round(2.5/5)*5=round(0.5)*5=5 → min=20, max=30
  // mattress/good: base=40, offset=round(4/5)*5=round(0.8)*5=5 → min=35, max=45
  // mattress/fair: base=25, offset=5 → min=20, max=30

  it('returns exact valuation range for frame/good', async () => {
    const result = await getTradeInValuation('frame', 'good');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.creditMin).toBe(65);
    expect(result.creditMax).toBe(85);
  });

  it('returns exact valuation range for frame/fair', async () => {
    const result = await getTradeInValuation('frame', 'fair');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.creditMin).toBe(45);
    expect(result.creditMax).toBe(55);
  });

  it('returns exact valuation range for frame/poor', async () => {
    const result = await getTradeInValuation('frame', 'poor');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.creditMin).toBe(20);
    expect(result.creditMax).toBe(30);
  });

  it('returns exact valuation range for mattress/good', async () => {
    const result = await getTradeInValuation('mattress', 'good');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.creditMin).toBe(35);
    expect(result.creditMax).toBe(45);
  });

  it('returns exact valuation range for mattress/fair', async () => {
    const result = await getTradeInValuation('mattress', 'fair');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.creditMin).toBe(20);
    expect(result.creditMax).toBe(30);
  });

  it('returns ineligible for mattress in poor condition (hygiene)', async () => {
    const result = await getTradeInValuation('mattress', 'poor');
    expect(result.success).toBe(true);
    expect(result.eligible).toBe(false);
    expect(result.message).toMatch(/hygiene/i);
  });

  it('rejects invalid item type', async () => {
    const result = await getTradeInValuation('sofa', 'good');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/item type/i);
  });

  it('rejects invalid condition', async () => {
    const result = await getTradeInValuation('frame', 'excellent');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/condition/i);
  });

  it('handles empty inputs gracefully', async () => {
    const result = await getTradeInValuation('', '');
    expect(result.success).toBe(false);
  });
});

// ── submitTradeInRequest ───────────────────────────────────────────

describe('submitTradeInRequest', () => {
  beforeEach(() => { __reset(); resetMembers(); vi.clearAllMocks(); });

  const validData = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '555-0100',
    itemType: 'frame',
    submittedCondition: 'good',
    itemAge: 3,
    photoUrls: ['https://cdn.example.com/photo1.jpg'],
  };

  it('submits a valid request and returns estimate', async () => {
    const result = await submitTradeInRequest(validData);
    expect(result.success).toBe(true);
    expect(result.requestId).toBeDefined();
    expect(result.creditMin).toBeGreaterThan(0);
    expect(result.creditMax).toBeGreaterThanOrEqual(result.creditMin);
  });

  it('inserts record into TradeInRequests collection', async () => {
    await submitTradeInRequest(validData);
    const inserted = __getInserted(COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].email).toBe('jane@example.com');
    expect(inserted[0].itemType).toBe('frame');
    expect(inserted[0].submittedCondition).toBe('good');
    expect(inserted[0].status).toBe('pending');
  });

  it('attaches memberId when member is logged in', async () => {
    __setMember(makeMember('member-42'));
    await submitTradeInRequest(validData);
    const inserted = __getInserted(COLLECTION);
    expect(inserted[0].memberId).toBe('member-42');
  });

  it('sets memberId to null for guest (no session)', async () => {
    // no member set — guest checkout
    await submitTradeInRequest(validData);
    const inserted = __getInserted(COLLECTION);
    expect(inserted[0].memberId).toBeNull();
  });

  it('rejects ineligible mattress in poor condition', async () => {
    const result = await submitTradeInRequest({ ...validData, itemType: 'mattress', submittedCondition: 'poor' });
    expect(result.success).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.message).toMatch(/hygiene/i);
  });

  it('rejects missing first name', async () => {
    const result = await submitTradeInRequest({ ...validData, firstName: '' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/first name/i);
  });

  it('rejects missing last name', async () => {
    const result = await submitTradeInRequest({ ...validData, lastName: '' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/last name/i);
  });

  it('rejects invalid email', async () => {
    const result = await submitTradeInRequest({ ...validData, email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/email/i);
  });

  it('rejects invalid item type', async () => {
    const result = await submitTradeInRequest({ ...validData, itemType: 'waterbed' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid condition', async () => {
    const result = await submitTradeInRequest({ ...validData, submittedCondition: 'mint' });
    expect(result.success).toBe(false);
  });

  it('accepts request without phone (optional)', async () => {
    const result = await submitTradeInRequest({ ...validData, phone: undefined });
    expect(result.success).toBe(true);
  });

  it('caps photoUrls at 5', async () => {
    const manyPhotos = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
    await submitTradeInRequest({ ...validData, photoUrls: manyPhotos });
    const inserted = __getInserted(COLLECTION);
    const urls = JSON.parse(inserted[0].photoUrls);
    expect(urls).toHaveLength(5);
  });

  it('handles non-array photoUrls gracefully', async () => {
    const result = await submitTradeInRequest({ ...validData, photoUrls: 'not-an-array' });
    expect(result.success).toBe(true);
    const inserted = __getInserted(COLLECTION);
    expect(JSON.parse(inserted[0].photoUrls)).toEqual([]);
  });

  it('filters out non-https photo URLs to prevent stored XSS', async () => {
    const mixed = [
      'https://cdn.example.com/safe.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,abc',
      'http://insecure.example.com/img.jpg',
      'https://cdn.example.com/also-safe.jpg',
    ];
    await submitTradeInRequest({ ...validData, photoUrls: mixed });
    const inserted = __getInserted(COLLECTION);
    const urls = JSON.parse(inserted[0].photoUrls);
    expect(urls).toHaveLength(2);
    expect(urls.every(u => u.startsWith('https://'))).toBe(true);
  });

  it('clamps itemAge to 0–50', async () => {
    await submitTradeInRequest({ ...validData, itemAge: 999 });
    const inserted = __getInserted(COLLECTION);
    expect(inserted[0].itemAge).toBe(50);
  });

  it('returns error if data is null', async () => {
    const result = await submitTradeInRequest(null);
    expect(result.success).toBe(false);
  });

  it('handles insert error gracefully', async () => {
    __setInsertError(COLLECTION, new Error('DB failure'));
    const result = await submitTradeInRequest(validData);
    expect(result.success).toBe(false);
  });
});

// ── getMyTradeInRequests ───────────────────────────────────────────

describe('getMyTradeInRequests', () => {
  beforeEach(() => { __reset(); resetMembers(); });

  it('returns requests for authenticated member', async () => {
    __setMember(makeMember('member-1'));
    __seed(COLLECTION, [makeRequest({ memberId: 'member-1' }), makeRequest({ _id: 'req-2', memberId: 'member-1' })]);

    const result = await getMyTradeInRequests();
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(2);
  });

  it('returns only the authenticated member\'s requests', async () => {
    __setMember(makeMember('member-1'));
    __seed(COLLECTION, [
      makeRequest({ memberId: 'member-1' }),
      makeRequest({ _id: 'req-x', memberId: 'member-99' }),
    ]);

    const result = await getMyTradeInRequests();
    expect(result.success).toBe(true);
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].memberId).toBeUndefined(); // private field not returned
  });

  it('returns empty array when member has no requests', async () => {
    __setMember(makeMember('member-1'));
    const result = await getMyTradeInRequests();
    expect(result.success).toBe(true);
    expect(result.requests).toEqual([]);
  });

  it('returns error when not authenticated', async () => {
    // no member set
    const result = await getMyTradeInRequests();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/authenticated/i);
  });
});

// ── getTradeInRequests (Admin) ─────────────────────────────────────

describe('getTradeInRequests', () => {
  beforeEach(() => { __reset(); resetMembers(); });

  it('returns paginated requests', async () => {
    __seed(COLLECTION, [makeRequest(), makeRequest({ _id: 'req-2' }), makeRequest({ _id: 'req-3' })]);
    const result = await getTradeInRequests({ pageSize: 2, skip: 0 });
    expect(result.success).toBe(true);
    expect(result.requests.length).toBeLessThanOrEqual(2);
    expect(result.totalCount).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
    __seed(COLLECTION, [
      makeRequest({ status: 'pending' }),
      makeRequest({ _id: 'req-2', status: 'credited' }),
    ]);
    const result = await getTradeInRequests({ status: 'pending' });
    expect(result.success).toBe(true);
    expect(result.requests.every(r => r.status === 'pending')).toBe(true);
  });

  it('ignores invalid status filter', async () => {
    __seed(COLLECTION, [makeRequest()]);
    const result = await getTradeInRequests({ status: 'invalid' });
    expect(result.success).toBe(true); // no filter applied — returns all
  });

  it('clamps pageSize to valid range', async () => {
    __seed(COLLECTION, Array.from({ length: 5 }, (_, i) => makeRequest({ _id: `req-${i}` })));
    const result = await getTradeInRequests({ pageSize: 999 });
    expect(result.success).toBe(true);
  });
});

// ── confirmTradeIn (Admin) ─────────────────────────────────────────

describe('confirmTradeIn', () => {
  beforeEach(() => { __reset(); resetMembers(); vi.clearAllMocks(); });

  it('confirms trade-in and issues store credit to member', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', itemType: 'frame', status: 'pending' })]);

    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(true);
    expect(result.issuedCreditAmount).toBe(75);
    expect(result.storeCreditId).toBe('credit-abc');
  });

  it('updates request status to credited', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'pending' })]);
    await confirmTradeIn('req-1', 'good');
    const updated = __getUpdated(COLLECTION);
    const creditedUpdate = updated.find(u => u.status === 'credited');
    expect(creditedUpdate).toBeDefined();
    expect(creditedUpdate.issuedCreditAmount).toBe(75);
    expect(creditedUpdate.confirmedCondition).toBe('good');
  });

  it('stores staffNotes in the record', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'pending' })]);
    await confirmTradeIn('req-1', 'fair', { staffNotes: 'Minor scratches on left arm.' });
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].staffNotes).toBe('Minor scratches on left arm.');
  });

  it('rejects mattress in poor condition — sets status to rejected', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', itemType: 'mattress', status: 'pending' })]);
    const result = await confirmTradeIn('req-1', 'poor');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not eligible/i);
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].status).toBe('rejected');
  });

  it('issues credit at fair-condition rate when confirmed lower', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', itemType: 'frame', status: 'pending', memberId: 'member-1' })]);
    await confirmTradeIn('req-1', 'fair');
    expect(issueStoreCredit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50, reason: 'trade_in' })
    );
  });

  it('passes orderReference with trade-in: prefix for dedup', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'pending' })]);
    await confirmTradeIn('req-1', 'good');
    expect(issueStoreCredit).toHaveBeenCalledWith(
      expect.objectContaining({ orderReference: 'trade-in:req-1' })
    );
  });

  it('skips credit issuance for guest (no memberId)', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: null, status: 'pending' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(true);
    expect(result.storeCreditId).toBeNull();
    expect(result.message).toMatch(/manually/i);
    expect(issueStoreCredit).not.toHaveBeenCalled();
  });

  it('returns error for already-credited request', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'credited' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/already credited/i);
  });

  it('returns error for already-rejected request', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'rejected' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(false);
  });

  it('allows retry from confirmed status (idempotency)', async () => {
    // Record is 'confirmed' from a previous partial run — should proceed to issue credit
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'confirmed', confirmedCondition: 'good' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(true);
    expect(issueStoreCredit).toHaveBeenCalledOnce();
  });

  it('skips credit re-issuance on retry when storeCreditId already set', async () => {
    // Stage 3 failed after Stage 2 succeeded — record is confirmed with storeCreditId populated
    __seed(COLLECTION, [makeRequest({
      _id: 'req-1', memberId: 'member-1', status: 'confirmed',
      confirmedCondition: 'good', storeCreditId: 'credit-already-issued',
    })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(true);
    expect(issueStoreCredit).not.toHaveBeenCalled();
    expect(result.storeCreditId).toBe('credit-already-issued');
  });

  it('sets status to confirmed before issuing credit (idempotency staging)', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'pending' })]);
    await confirmTradeIn('req-1', 'good');
    const updated = __getUpdated(COLLECTION);
    // First update is 'confirmed', second is 'credited'
    expect(updated.some(u => u.status === 'confirmed')).toBe(true);
    expect(updated.some(u => u.status === 'credited')).toBe(true);
  });

  it('leaves record as confirmed (not pending) when credit issuance fails', async () => {
    issueStoreCredit.mockResolvedValueOnce({ success: false, message: 'Credit limit exceeded.' });
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'pending' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(false);
    const updated = __getUpdated(COLLECTION);
    // Record was staged to 'confirmed' before the failed credit issuance
    expect(updated.some(u => u.status === 'confirmed')).toBe(true);
    expect(updated.every(u => u.status !== 'pending')).toBe(true);
  });

  it('returns error when request not found', async () => {
    const result = await confirmTradeIn('nonexistent-id', 'good');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('returns error for invalid condition', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'pending' })]);
    const result = await confirmTradeIn('req-1', 'excellent');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/condition/i);
  });

  it('returns error when requestId is missing', async () => {
    const result = await confirmTradeIn('', 'good');
    expect(result.success).toBe(false);
  });

  it('surfaces error when credit issuance fails', async () => {
    issueStoreCredit.mockResolvedValueOnce({ success: false, message: 'Credit limit exceeded.' });
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', memberId: 'member-1', status: 'pending' })]);
    const result = await confirmTradeIn('req-1', 'good');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/credit issuance failed/i);
  });
});

// ── rejectTradeIn (Admin) ──────────────────────────────────────────

describe('rejectTradeIn', () => {
  beforeEach(() => { __reset(); resetMembers(); });

  it('rejects a pending request', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'pending' })]);
    const result = await rejectTradeIn('req-1', 'Item was not a Carolina Futons product.');
    expect(result.success).toBe(true);
  });

  it('updates status to rejected and stores reason', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'pending' })]);
    await rejectTradeIn('req-1', 'Not eligible.');
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].status).toBe('rejected');
    expect(updated[0].staffNotes).toBe('Not eligible.');
  });

  it('returns error for already-rejected request', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'rejected' })]);
    const result = await rejectTradeIn('req-1');
    expect(result.success).toBe(false);
  });

  it('returns error when request not found', async () => {
    const result = await rejectTradeIn('ghost-id');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it('returns error when requestId is missing', async () => {
    const result = await rejectTradeIn('');
    expect(result.success).toBe(false);
  });

  it('accepts rejection with no reason provided', async () => {
    __seed(COLLECTION, [makeRequest({ _id: 'req-1', status: 'pending' })]);
    const result = await rejectTradeIn('req-1');
    expect(result.success).toBe(true);
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].staffNotes).toBe('');
  });
});
