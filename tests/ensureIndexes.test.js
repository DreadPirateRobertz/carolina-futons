/**
 * @file ensureIndexes.test.js
 * @description Tests for cf-7mr: ensurePointsLedgerIndex() and the DB-level
 * duplicate-key handling in recordStreakMilestoneEvent().
 *
 * Covers:
 *  - ensurePointsLedgerIndex: creates index when absent, skips when present
 *  - recordStreakMilestoneEvent: DB-level duplicate rejected and swallowed
 *  - memberMilestoneKey field written on every insert
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __setInsertError,
  __setUniqueField,
} from './__mocks__/wix-data.js';
import {
  __reset as resetIndexes,
  __seedIndexes,
  __getIndexes,
  __setListError,
  __setCreateError,
} from './__mocks__/wix-data-index-service-v2.js';
import { ensurePointsLedgerIndex } from '../src/backend/cms/ensureIndexes.js';
import { recordStreakMilestoneEvent } from '../src/backend/loyaltyService.web.js';

beforeEach(() => {
  resetData();
  resetIndexes();
});

// ── ensurePointsLedgerIndex ───────────────────────────────────────────────────

describe('ensurePointsLedgerIndex', () => {
  it('creates memberMilestoneKey_unique index when none exists', async () => {
    await ensurePointsLedgerIndex();

    const created = __getIndexes('PointsLedger');
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('memberMilestoneKey_unique');
    expect(created[0].unique).toBe(true);
    expect(created[0].fields).toEqual([{ path: 'memberMilestoneKey', order: 'ASC' }]);
  });

  it('skips creation when index already exists', async () => {
    __seedIndexes('PointsLedger', [{ name: 'memberMilestoneKey_unique', unique: true, fields: [] }]);

    await ensurePointsLedgerIndex();

    // Only the seeded index — no second copy created
    expect(__getIndexes('PointsLedger')).toHaveLength(1);
  });

  it('is idempotent — calling twice creates the index exactly once', async () => {
    await ensurePointsLedgerIndex();
    await ensurePointsLedgerIndex();

    expect(__getIndexes('PointsLedger')).toHaveLength(1);
  });
});

// ── recordStreakMilestoneEvent — memberMilestoneKey field ─────────────────────

describe('recordStreakMilestoneEvent — memberMilestoneKey', () => {
  it('writes memberMilestoneKey on every insert', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-1', 30, 60);

    expect(inserts[0].memberMilestoneKey).toBe('mem-1:30');
  });

  it('memberMilestoneKey encodes memberId and milestone unambiguously', async () => {
    __seed('PointsLedger', []);
    const inserts = [];
    __onInsert((_col, item) => inserts.push(item));

    await recordStreakMilestoneEvent('mem-42', 7, 14);

    expect(inserts[0].memberMilestoneKey).toBe('mem-42:7');
  });
});

// ── recordStreakMilestoneEvent — DB-level duplicate rejection ─────────────────

describe('recordStreakMilestoneEvent — DB-level duplicate rejection', () => {
  it('swallows a duplicate-key insert error (returns without throwing)', async () => {
    __seed('PointsLedger', []);
    __setUniqueField('PointsLedger', 'memberMilestoneKey');

    // First call inserts successfully.
    await recordStreakMilestoneEvent('mem-1', 30, 60);

    // Second call: app-level guard is bypassed by resetting the store to appear
    // empty but the unique field constraint fires — this simulates the TOCTOU
    // scenario where two concurrent calls both pass the read check and then one
    // loses the race at the DB level.
    __seed('PointsLedger', []);
    __setUniqueField('PointsLedger', 'memberMilestoneKey');
    // Seed the unique field value that already "exists" in the DB so the mock fires.
    __seed('PointsLedger', [{ memberMilestoneKey: 'mem-1:30' }]);

    // Should return silently, not throw.
    await expect(recordStreakMilestoneEvent('mem-1', 30, 60)).resolves.toBeUndefined();
  });

  it('still re-throws non-duplicate insert errors', async () => {
    __seed('PointsLedger', []);
    __setInsertError('PointsLedger', new Error('Connection timeout'));

    await expect(recordStreakMilestoneEvent('mem-1', 30, 60)).rejects.toThrow('Connection timeout');
  });

  it('swallows a WDE0025-prefixed error (Wix error code variant)', async () => {
    __seed('PointsLedger', []);
    __setInsertError('PointsLedger', new Error('WDE0025: unique constraint violation'));

    await expect(recordStreakMilestoneEvent('mem-1', 30, 60)).resolves.toBeUndefined();
  });
});

// ── ensurePointsLedgerIndex — error paths ─────────────────────────────────────

describe('ensurePointsLedgerIndex — error paths', () => {
  it('re-throws listIndexes errors', async () => {
    __setListError(new Error('Service unavailable'));

    await expect(ensurePointsLedgerIndex()).rejects.toThrow('Service unavailable');
  });

  it('re-throws createIndex errors', async () => {
    __setCreateError(new Error('Quota exceeded'));

    await expect(ensurePointsLedgerIndex()).rejects.toThrow('Quota exceeded');
    expect(__getIndexes('PointsLedger')).toHaveLength(0);
  });
});
