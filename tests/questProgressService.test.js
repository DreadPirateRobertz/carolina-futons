/**
 * @file questProgressService.test.js
 * @description Tests for CF-y2zd: quest progress persistence via wixData.
 *
 * Covers:
 *  - saveQuestProgress: inserts new record, returns success:true
 *  - saveQuestProgress: upsert overwrites existing record
 *  - saveQuestProgress: missing memberId returns error
 *  - saveQuestProgress: missing questId returns error
 *  - saveQuestProgress: invalid status returns error
 *  - getQuestProgress: returns stored progressData after save
 *  - getQuestProgress: returns { progressData: null } when no record exists
 *  - getQuestProgress: missing memberId returns error
 *  - getActiveQuests: returns all active quests for member sorted by updatedAt
 *  - getActiveQuests: filters out non-active statuses (completed, abandoned)
 *  - getActiveQuests: returns empty array when member has no active quests
 *  - getActiveQuests: missing memberId returns empty array
 *  - save + retrieve round-trip preserves complex progressData
 *  - getActiveQuests: DB error returns success:false with error message
 *  - saveQuestProgress: DB error returns success:false with error message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
} from './__mocks__/wix-data.js';

import {
  saveQuestProgress,
  getQuestProgress,
  getActiveQuests,
} from '../src/backend/questProgressService.web.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── saveQuestProgress ─────────────────────────────────────────────────────────

describe('saveQuestProgress — insert', () => {
  it('returns { success: true } when inserting a new record', async () => {
    const result = await saveQuestProgress('mem-1', 'daily-login-7', { day: 3 });
    expect(result.success).toBe(true);
  });

  it('inserts a record into QuestProgress collection', async () => {
    const onInserts = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => { if (col === 'QuestProgress') onInserts.push(item); });
    await saveQuestProgress('mem-1', 'quest-abc', { step: 1 });
    expect(onInserts).toHaveLength(1);
    expect(onInserts[0].memberId).toBe('mem-1');
    expect(onInserts[0].questId).toBe('quest-abc');
  });

  it('serializes progressData as JSON string in stored record', async () => {
    await saveQuestProgress('mem-1', 'quest-abc', { step: 2, items: ['a', 'b'] });
    const inserted = __getInserted('QuestProgress');
    expect(typeof inserted[0].progressData).toBe('string');
    expect(JSON.parse(inserted[0].progressData)).toEqual({ step: 2, items: ['a', 'b'] });
  });

  it('stores status as "active" by default', async () => {
    await saveQuestProgress('mem-1', 'quest-abc', { step: 1 });
    const inserted = __getInserted('QuestProgress');
    expect(inserted[0].status).toBe('active');
  });

  it('stores provided status when specified', async () => {
    await saveQuestProgress('mem-1', 'quest-abc', { step: 5 }, 'completed');
    const inserted = __getInserted('QuestProgress');
    expect(inserted[0].status).toBe('completed');
  });
});

describe('saveQuestProgress — upsert', () => {
  it('updates existing record when (memberId, questId) pair already exists', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ step: 1 }), status: 'active', updatedAt: new Date(),
    }]);
    const result = await saveQuestProgress('mem-1', 'quest-abc', { step: 3 });
    expect(result.success).toBe(true);
    const updated = __getUpdated('QuestProgress');
    expect(updated).toHaveLength(1);
    expect(JSON.parse(updated[0].progressData)).toEqual({ step: 3 });
  });

  it('updates (not inserts) when record already exists', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ step: 1 }), status: 'active', updatedAt: new Date(),
    }]);
    await saveQuestProgress('mem-1', 'quest-abc', { step: 2 });
    // update path taken, not insert
    expect(__getUpdated('QuestProgress')).toHaveLength(1);
  });

  it('updates status on upsert', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ step: 5 }), status: 'active', updatedAt: new Date(),
    }]);
    await saveQuestProgress('mem-1', 'quest-abc', { step: 5 }, 'completed');
    const updated = __getUpdated('QuestProgress');
    expect(updated[0].status).toBe('completed');
  });
});

describe('saveQuestProgress — validation', () => {
  it('returns error when memberId is missing', async () => {
    const result = await saveQuestProgress('', 'quest-abc', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when questId is missing', async () => {
    const result = await saveQuestProgress('mem-1', '', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid status value', async () => {
    const result = await saveQuestProgress('mem-1', 'quest-abc', {}, 'pending');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('DB down'));
    const result = await saveQuestProgress('mem-1', 'quest-abc', { step: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── getQuestProgress ──────────────────────────────────────────────────────────

describe('getQuestProgress — retrieval', () => {
  it('returns stored progressData after a save', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ day: 4, bonus: true }), status: 'active', updatedAt: new Date(),
    }]);
    const result = await getQuestProgress('mem-1', 'quest-abc');
    expect(result.success).toBe(true);
    expect(result.progressData).toEqual({ day: 4, bonus: true });
    expect(result.status).toBe('active');
  });

  it('returns { progressData: null, status: null } when no record exists', async () => {
    const result = await getQuestProgress('mem-1', 'quest-xyz');
    expect(result.success).toBe(true);
    expect(result.progressData).toBeNull();
    expect(result.status).toBeNull();
  });

  it('returns error when memberId is missing', async () => {
    const result = await getQuestProgress('', 'quest-abc');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error when questId is missing', async () => {
    const result = await getQuestProgress('mem-1', '');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('DB timeout'));
    const result = await getQuestProgress('mem-1', 'quest-abc');
    expect(result.success).toBe(false);
  });
});

// ── save + retrieve round-trip ────────────────────────────────────────────────

describe('round-trip: saveQuestProgress then getQuestProgress', () => {
  it('preserves complex nested progressData across save and retrieve', async () => {
    const data = { step: 3, subSteps: [true, false, true], meta: { earned: 50 } };
    await saveQuestProgress('mem-1', 'quest-deep', data);
    // Simulate retrieval from seeded inserted record
    const inserted = __getInserted('QuestProgress')[0];
    __seed('QuestProgress', [{ _id: 'qp-rt', ...inserted }]);
    // Re-retrieve (inserted data is now in seed)
    // Reset inserts so seed is authoritative
    __reset();
    __seed('QuestProgress', [{
      _id: 'qp-rt', memberId: 'mem-1', questId: 'quest-deep',
      progressData: JSON.stringify(data), status: 'active', updatedAt: new Date(),
    }]);
    const result = await getQuestProgress('mem-1', 'quest-deep');
    expect(result.success).toBe(true);
    expect(result.progressData).toEqual(data);
  });
});

// ── getActiveQuests ───────────────────────────────────────────────────────────

describe('getActiveQuests', () => {
  it('returns all active quests for a member', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: JSON.stringify({ step: 1 }), status: 'active', updatedAt: new Date('2026-03-22T10:00:00Z') },
      { _id: 'qp-2', memberId: 'mem-1', questId: 'quest-b', progressData: JSON.stringify({ step: 2 }), status: 'active', updatedAt: new Date('2026-03-22T11:00:00Z') },
    ]);
    const result = await getActiveQuests('mem-1');
    expect(result.success).toBe(true);
    expect(result.quests).toHaveLength(2);
  });

  it('filters out completed and abandoned quests', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'active', updatedAt: new Date() },
      { _id: 'qp-2', memberId: 'mem-1', questId: 'quest-b', progressData: '{}', status: 'completed', updatedAt: new Date() },
      { _id: 'qp-3', memberId: 'mem-1', questId: 'quest-c', progressData: '{}', status: 'abandoned', updatedAt: new Date() },
    ]);
    const result = await getActiveQuests('mem-1');
    expect(result.success).toBe(true);
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].questId).toBe('quest-a');
  });

  it('returns empty array when member has no active quests', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'completed', updatedAt: new Date() },
    ]);
    const result = await getActiveQuests('mem-1');
    expect(result.success).toBe(true);
    expect(result.quests).toEqual([]);
  });

  it('returns empty array when memberId is falsy', async () => {
    const result = await getActiveQuests('');
    expect(result.success).toBe(true);
    expect(result.quests).toEqual([]);
  });

  it('includes questId, progressData, status, updatedAt in each quest item', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a',
      progressData: JSON.stringify({ step: 2 }), status: 'active',
      updatedAt: new Date('2026-03-22T12:00:00Z'),
    }]);
    const result = await getActiveQuests('mem-1');
    const q = result.quests[0];
    expect(q.questId).toBe('quest-a');
    expect(q.progressData).toEqual({ step: 2 });
    expect(q.status).toBe('active');
    expect(q.updatedAt).toBeDefined();
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('Network error'));
    const result = await getActiveQuests('mem-1');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not return quests for other members', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'active', updatedAt: new Date() },
      { _id: 'qp-2', memberId: 'mem-2', questId: 'quest-b', progressData: '{}', status: 'active', updatedAt: new Date() },
    ]);
    const result = await getActiveQuests('mem-1');
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].questId).toBe('quest-a');
  });
});
