import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __getInserted, __getUpdated, __setQueryError, __onInsert } from './__mocks__/wix-data.js';
import { __setMember, __reset as __resetMember } from './__mocks__/wix-members-backend.js';

const { saveQuizResult, getMyResult, getSharedResult } = await import('../src/backend/styleQuizService.web.js');

const COLLECTION = 'Members/StyleQuizResults';

const MEMBER = { _id: 'member-abc', profile: { nickname: 'Alice' } };
const ANSWERS = { roomType: 'living-room', primaryUse: 'both', stylePreference: 'modern', sizeNeeds: 'queen', budgetRange: '500-1000' };
const RESULT_TAG = 'Your Modern Living Room Style';

beforeEach(() => {
  __reset();
  __resetMember();
});

// ── saveQuizResult ────────────────────────────────────────────────────────────

describe('saveQuizResult', () => {
  it('saves a new result and returns shareId + shareUrl', async () => {
    __setMember(MEMBER);

    const res = await saveQuizResult(ANSWERS, RESULT_TAG);

    expect(res.shareId).toBeTruthy();
    expect(res.shareUrl).toContain('/style-quiz/result/');
    expect(res.shareUrl).toContain(res.shareId);
  });

  it('inserts a record into the collection', async () => {
    __setMember(MEMBER);

    await saveQuizResult(ANSWERS, RESULT_TAG);

    const inserted = __getInserted(COLLECTION);
    expect(inserted.length).toBe(1);
    expect(inserted[0].memberId).toBe(MEMBER._id);
    expect(inserted[0].resultTag).toBe(RESULT_TAG);
  });

  it('serialises answers as JSON string', async () => {
    __setMember(MEMBER);

    await saveQuizResult(ANSWERS, RESULT_TAG);

    const inserted = __getInserted(COLLECTION);
    const parsed = JSON.parse(inserted[0].answers);
    expect(parsed.roomType).toBe('living-room');
    expect(parsed.sizeNeeds).toBe('queen');
  });

  it('stores a completedAt timestamp', async () => {
    __setMember(MEMBER);
    const before = new Date();

    await saveQuizResult(ANSWERS, RESULT_TAG);

    const inserted = __getInserted(COLLECTION);
    const completedAt = new Date(inserted[0].completedAt);
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('upserts on second save — updates existing record', async () => {
    __setMember(MEMBER);

    await saveQuizResult(ANSWERS, RESULT_TAG);
    const firstInserted = __getInserted(COLLECTION);
    const firstShareId = firstInserted[0].shareId;

    // Second save — should update not insert
    const res2 = await saveQuizResult({ ...ANSWERS, roomType: 'guest-room' }, 'New Tag');

    // shareId preserved
    expect(res2.shareId).toBe(firstShareId);
    // Only one record in collection
    expect(__getInserted(COLLECTION).length).toBe(1);
    // Updated record has new resultTag
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].resultTag).toBe('New Tag');
  });

  it('returns error:unauthenticated when getMember returns null', async () => {
    __setMember(null);

    const res = await saveQuizResult(ANSWERS, RESULT_TAG);

    expect(res.error).toBe('unauthenticated');
  });

  it('returns error:auth_failed when getMember throws', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('network'));

    const res = await saveQuizResult(ANSWERS, RESULT_TAG);

    expect(res.error).toBe('auth_failed');
  });

  it('returns error:invalid_answers when answers is null', async () => {
    __setMember(MEMBER);

    const res = await saveQuizResult(null, RESULT_TAG);

    expect(res.error).toBe('invalid_answers');
  });

  it('returns error:invalid_answers when answers is a string', async () => {
    __setMember(MEMBER);

    const res = await saveQuizResult('roomType=living-room', RESULT_TAG);

    expect(res.error).toBe('invalid_answers');
  });

  it('returns error:invalid_answers when answers is an array', async () => {
    __setMember(MEMBER);

    const res = await saveQuizResult(['living-room'], RESULT_TAG);

    expect(res.error).toBe('invalid_answers');
  });

  it('shareId is URL-safe (no +, /, = chars)', async () => {
    __setMember(MEMBER);

    const res = await saveQuizResult(ANSWERS, RESULT_TAG);

    expect(res.shareId).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('generates a unique shareId on each new save', async () => {
    __setMember(MEMBER);
    const res1 = await saveQuizResult(ANSWERS, RESULT_TAG);

    __reset();
    __setMember({ _id: 'member-xyz' });
    const res2 = await saveQuizResult(ANSWERS, RESULT_TAG);

    expect(res1.shareId).not.toBe(res2.shareId);
  });
});

// ── getMyResult ───────────────────────────────────────────────────────────────

describe('getMyResult', () => {
  it('returns null when member has no saved result', async () => {
    __setMember(MEMBER);

    const res = await getMyResult();

    expect(res).toBeNull();
  });

  it('returns the member\'s saved result with parsed answers', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER._id,
      answers: JSON.stringify(ANSWERS),
      resultTag: RESULT_TAG,
      shareId: 'abc123',
      completedAt: new Date('2026-01-15'),
    }]);

    const res = await getMyResult();

    expect(res).not.toBeNull();
    expect(res.resultTag).toBe(RESULT_TAG);
    expect(res.answers.roomType).toBe('living-room');
    expect(res.shareId).toBe('abc123');
    expect(res.shareUrl).toContain('abc123');
  });

  it('does not return other members\' results', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-other',
      memberId: 'other-member',
      answers: JSON.stringify(ANSWERS),
      resultTag: 'Other Style',
      shareId: 'xyz789',
      completedAt: new Date(),
    }]);

    const res = await getMyResult();

    expect(res).toBeNull();
  });

  it('returns error:unauthenticated when getMember returns null', async () => {
    __setMember(null);

    const res = await getMyResult();

    expect(res.error).toBe('unauthenticated');
  });

  it('returns error:auth_failed when getMember throws', async () => {
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('timeout'));

    const res = await getMyResult();

    expect(res.error).toBe('auth_failed');
  });

  it('returns error:fetch_failed when wixData query throws', async () => {
    __setMember(MEMBER);
    __setQueryError(COLLECTION, new Error('db error'));

    const res = await getMyResult();

    expect(res.error).toBe('fetch_failed');
  });

  it('includes memberId in the returned result', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-1', memberId: MEMBER._id,
      answers: JSON.stringify(ANSWERS), resultTag: RESULT_TAG,
      shareId: 'tok1', completedAt: new Date(),
    }]);

    const res = await getMyResult();

    expect(res.memberId).toBe(MEMBER._id);
  });
});

// ── getSharedResult ───────────────────────────────────────────────────────────

describe('getSharedResult', () => {
  it('returns the result for a valid shareId', async () => {
    __seed(COLLECTION, [{
      _id: 'rec-1', memberId: 'member-abc',
      answers: JSON.stringify(ANSWERS), resultTag: RESULT_TAG,
      shareId: 'valid-token', completedAt: new Date('2026-02-01'),
    }]);

    const res = await getSharedResult('valid-token');

    expect(res).not.toBeNull();
    expect(res.resultTag).toBe(RESULT_TAG);
    expect(res.answers.stylePreference).toBe('modern');
  });

  it('does not expose memberId to unauthenticated callers', async () => {
    __seed(COLLECTION, [{
      _id: 'rec-1', memberId: 'member-abc',
      answers: JSON.stringify(ANSWERS), resultTag: RESULT_TAG,
      shareId: 'valid-token', completedAt: new Date(),
    }]);

    const res = await getSharedResult('valid-token');

    expect(res).not.toHaveProperty('memberId');
  });

  it('returns null for an unknown shareId', async () => {
    const res = await getSharedResult('unknown-token');
    expect(res).toBeNull();
  });

  it('returns null for a null shareId', async () => {
    const res = await getSharedResult(null);
    expect(res).toBeNull();
  });

  it('returns null for an empty string shareId', async () => {
    const res = await getSharedResult('');
    expect(res).toBeNull();
  });

  it('returns null for a non-string shareId', async () => {
    const res = await getSharedResult(42);
    expect(res).toBeNull();
  });

  it('returns error:fetch_failed when wixData query throws', async () => {
    __setQueryError(COLLECTION, new Error('db error'));

    const res = await getSharedResult('any-token');

    expect(res.error).toBe('fetch_failed');
  });

  it('returns answers as a parsed object (not raw JSON string)', async () => {
    __seed(COLLECTION, [{
      _id: 'rec-1', memberId: 'member-abc',
      answers: JSON.stringify(ANSWERS), resultTag: RESULT_TAG,
      shareId: 'tok-abc', completedAt: new Date(),
    }]);

    const res = await getSharedResult('tok-abc');

    expect(typeof res.answers).toBe('object');
    expect(res.answers.budgetRange).toBe('500-1000');
  });

  it('handles already-parsed answers object gracefully', async () => {
    __seed(COLLECTION, [{
      _id: 'rec-1', memberId: 'member-abc',
      answers: ANSWERS, // stored as object (not string)
      resultTag: RESULT_TAG, shareId: 'tok-obj', completedAt: new Date(),
    }]);

    const res = await getSharedResult('tok-obj');

    expect(res.answers.roomType).toBe('living-room');
  });
});
