/**
 * @file challengeCompletion.test.js
 * @description Tests for cf-ipg: recordChallengeCompletionEvent() TOCTOU protection
 * via DB-level unique index on memberChallengeKey (memberId:challengeId).
 *
 * Covers:
 *  - ensureChallengeCompletionIndex: creates index when absent, skips when present, idempotent
 *  - recordChallengeCompletionEvent: writes memberChallengeKey, swallows duplicate key errors,
 *    re-throws non-duplicate errors, validates inputs
 *  - backfillChallengeLedger: skips rows with key, updates rows missing key, cursor pagination,
 *    skips bad rows, field preservation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __onUpdate,
  __setInsertError,
  __setUpdateError,
  __setUniqueField,
} from './__mocks__/wix-data.js';
import {
  __reset as resetIndexes,
  __seedIndexes,
  __getIndexes,
  __setListError,
  __setCreateError,
} from './__mocks__/wix-data-index-service-v2.js';
import { ensureChallengeCompletionIndex } from '../src/backend/cms/ensureIndexes.js';
import { recordChallengeCompletionEvent } from '../src/backend/loyaltyService.web.js';
import { backfillChallengeLedger } from '../src/backend/cms/backfillChallengeLedger.js';

beforeEach(() => {
  resetData();
  resetIndexes();
});

// ── ensureChallengeCompletionIndex ────────────────────────────────────────────

describe('ensureChallengeCompletionIndex', () => {
  it('creates memberChallengeKey_unique index when none exists', async () => {
    await ensureChallengeCompletionIndex();

    const created = __getIndexes('PointsLedger');
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('memberChallengeKey_unique');
    expect(created[0].unique).toBe(true);
    expect(created[0].fields).toEqual([{ path: 'memberChallengeKey', order: 'ASC' }]);
  });

  it('skips creation when index already exists', async () => {
    __seedIndexes('PointsLedger', [{ name: 'memberChallengeKey_unique', unique: true, fields: [] }]);

    await ensureChallengeCompletionIndex();

    expect(__getIndexes('PointsLedger')).toHaveLength(1);
  });

  it('is idempotent — calling twice creates the index exactly once', async () => {
    await ensureChallengeCompletionIndex();
    await ensureChallengeCompletionIndex();

    expect(__getIndexes('PointsLedger')).toHaveLength(1);
  });

  it('does not interfere with memberMilestoneKey_unique index', async () => {
    __seedIndexes('PointsLedger', [{ name: 'memberMilestoneKey_unique', unique: true, fields: [] }]);

    await ensureChallengeCompletionIndex();

    // Existing milestone index must be untouched; new challenge index added
    const indexes = __getIndexes('PointsLedger');
    expect(indexes.some(i => i.name === 'memberMilestoneKey_unique')).toBe(true);
    expect(indexes.some(i => i.name === 'memberChallengeKey_unique')).toBe(true);
  });
});

// ── ensureChallengeCompletionIndex — error paths ──────────────────────────────

describe('ensureChallengeCompletionIndex — error paths', () => {
  it('re-throws listIndexes errors', async () => {
    __setListError(new Error('Service unavailable'));

    await expect(ensureChallengeCompletionIndex()).rejects.toThrow('Service unavailable');
  });

  it('re-throws createIndex errors', async () => {
    __setCreateError(new Error('Quota exceeded'));

    await expect(ensureChallengeCompletionIndex()).rejects.toThrow('Quota exceeded');
    expect(__getIndexes('PointsLedger')).toHaveLength(0);
  });
});

// ── recordChallengeCompletionEvent — memberChallengeKey field ─────────────────

describe('recordChallengeCompletionEvent — memberChallengeKey', () => {
  it('writes memberChallengeKey on every insert', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordChallengeCompletionEvent('mem-1', 'challenge-abc', 50);

    expect(inserts[0].memberChallengeKey).toBe('mem-1:challenge-abc');
  });

  it('memberChallengeKey encodes memberId and challengeId unambiguously', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordChallengeCompletionEvent('mem-42', 'ch-xyz', 100);

    expect(inserts[0].memberChallengeKey).toBe('mem-42:ch-xyz');
  });

  it('writes type: challenge_completion to PointsLedger', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordChallengeCompletionEvent('mem-1', 'challenge-abc', 50);

    expect(inserts[0].type).toBe('challenge_completion');
  });

  it('writes memberId, challengeId, points, and earnedAt to PointsLedger', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordChallengeCompletionEvent('mem-1', 'ch-99', 75);

    const record = inserts[0];
    expect(record.memberId).toBe('mem-1');
    expect(record.challengeId).toBe('ch-99');
    expect(record.points).toBe(75);
    expect(record.earnedAt).toBeInstanceOf(Date);
  });
});

// ── recordChallengeCompletionEvent — idempotency (app-level) ─────────────────

describe('recordChallengeCompletionEvent — app-level idempotency', () => {
  it('skips insert when entry already exists for memberId + challengeId', async () => {
    __seed('PointsLedger', [
      { memberId: 'mem-1', challengeId: 'ch-abc', memberChallengeKey: 'mem-1:ch-abc', type: 'challenge_completion', points: 50 },
    ]);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordChallengeCompletionEvent('mem-1', 'ch-abc', 50);

    expect(inserts).toHaveLength(0);
  });
});

// ── recordChallengeCompletionEvent — DB-level duplicate rejection ─────────────

describe('recordChallengeCompletionEvent — DB-level duplicate rejection', () => {
  it('swallows a duplicate-key insert error (returns without throwing)', async () => {
    __seed('PointsLedger', []);
    __setUniqueField('PointsLedger', 'memberChallengeKey');

    // First call inserts successfully
    await recordChallengeCompletionEvent('mem-1', 'ch-abc', 50);

    // Simulate TOCTOU: reset store to empty but keep unique field so duplicate fires
    __seed('PointsLedger', []);
    __setUniqueField('PointsLedger', 'memberChallengeKey');
    __seed('PointsLedger', [{ memberChallengeKey: 'mem-1:ch-abc' }]);

    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', 50)).resolves.toBeUndefined();
  });

  it('still re-throws non-duplicate insert errors', async () => {
    __seed('PointsLedger', []);
    __setInsertError('PointsLedger', new Error('Connection timeout'));

    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', 50)).rejects.toThrow('Connection timeout');
  });

  it('swallows a WDE0025-prefixed error (Wix error code variant)', async () => {
    __seed('PointsLedger', []);
    __setInsertError('PointsLedger', new Error('WDE0025: unique constraint violation'));

    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', 50)).resolves.toBeUndefined();
  });
});

// ── recordChallengeCompletionEvent — input validation ────────────────────────

describe('recordChallengeCompletionEvent — input validation', () => {
  it('throws TypeError for invalid memberId', async () => {
    await expect(recordChallengeCompletionEvent('', 'ch-abc', 50)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non-string challengeId', async () => {
    await expect(recordChallengeCompletionEvent('mem-1', null, 50)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for empty challengeId', async () => {
    await expect(recordChallengeCompletionEvent('mem-1', '', 50)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non-positive points', async () => {
    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', 0)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', -10)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for non-finite points', async () => {
    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', Infinity)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompletionEvent('mem-1', 'ch-abc', NaN)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for memberId containing disallowed characters (validateId regex)', async () => {
    await expect(recordChallengeCompletionEvent('mem@evil', 'ch-abc', 50)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompletionEvent('mem/1', 'ch-abc', 50)).rejects.toThrow(TypeError);
  });

  it('throws TypeError for challengeId containing disallowed characters (validateId regex)', async () => {
    await expect(recordChallengeCompletionEvent('mem-1', 'ch@bad', 50)).rejects.toThrow(TypeError);
    await expect(recordChallengeCompletionEvent('mem-1', 'ch/bad', 50)).rejects.toThrow(TypeError);
  });
});

// ── backfillChallengeLedger ───────────────────────────────────────────────────

describe('backfillChallengeLedger', () => {
  it('returns { checked, updated, skipped } summary', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', type: 'challenge_completion' },
    ]);

    const result = await backfillChallengeLedger();

    expect(result).toHaveProperty('checked');
    expect(result).toHaveProperty('updated');
    expect(result).toHaveProperty('skipped');
  });

  it('backfills memberChallengeKey on rows missing it', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', type: 'challenge_completion' },
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    await backfillChallengeLedger();

    expect(updates[0].memberChallengeKey).toBe('mem-1:ch-a');
  });

  it('skips rows that already have memberChallengeKey', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', memberChallengeKey: 'mem-1:ch-a', type: 'challenge_completion' },
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    const result = await backfillChallengeLedger();

    expect(updates).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('skips rows where type is not challenge_completion', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', milestone: 30, type: 'streak_milestone' },
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    const result = await backfillChallengeLedger();

    expect(updates).toHaveLength(0);
    expect(result.skipped).toBe(1);
  });

  it('skips rows where memberId or challengeId is missing', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', challengeId: 'ch-a', type: 'challenge_completion' }, // no memberId
      { _id: 'r-2', memberId: 'mem-1', type: 'challenge_completion' },   // no challengeId
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    const result = await backfillChallengeLedger();

    expect(updates).toHaveLength(0);
    expect(result.skipped).toBe(2);
  });

  it('returns checked=0 for empty collection', async () => {
    __seed('PointsLedger', []);

    const result = await backfillChallengeLedger();

    expect(result).toEqual({ checked: 0, updated: 0, skipped: 0 });
  });

  it('is idempotent — running twice does not double-update', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', type: 'challenge_completion' },
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    await backfillChallengeLedger();
    await backfillChallengeLedger();

    // Second run sees memberChallengeKey already set → skips
    expect(updates.filter(u => u.memberChallengeKey === 'mem-1:ch-a')).toHaveLength(1);
  });

  it('preserves all other fields on updated rows', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', type: 'challenge_completion', points: 75, earnedAt: new Date('2025-01-01') },
    ]);
    const updates = [];
    __onUpdate((_col, item) => updates.push(item));

    await backfillChallengeLedger();

    const u = updates[0];
    expect(u.points).toBe(75);
    expect(u.type).toBe('challenge_completion');
    expect(u._id).toBe('r-1');
  });

  it('handles 101 rows across two pages (cursor pagination)', async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      _id: `r-${String(i).padStart(3, '0')}`,
      memberId: `mem-${i}`,
      challengeId: `ch-${i}`,
      type: 'challenge_completion',
    }));
    __seed('PointsLedger', rows);

    const result = await backfillChallengeLedger();

    expect(result.checked).toBe(101);
    expect(result.updated).toBe(101);
  });

  it('re-throws wixData.update errors (does not swallow)', async () => {
    __seed('PointsLedger', [
      { _id: 'r-1', memberId: 'mem-1', challengeId: 'ch-a', type: 'challenge_completion' },
    ]);
    __setUpdateError('PointsLedger', new Error('Write timeout'));

    await expect(backfillChallengeLedger()).rejects.toThrow('Write timeout');
  });
});
