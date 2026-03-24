/**
 * @file questProgressService.test.js
 * @description Tests for CF-y2zd: quest progress persistence via wixData.
 *
 * memberId is derived server-side from the authenticated session.
 * Covers:
 *  - saveQuestProgress: inserts new record, returns success:true
 *  - saveQuestProgress: upsert updates existing record
 *  - saveQuestProgress: missing questId returns error
 *  - saveQuestProgress: invalid status returns error
 *  - saveQuestProgress: auth_required when no session
 *  - getQuestProgress: returns stored progressData after save
 *  - getQuestProgress: returns { progressData: null } when no record exists
 *  - getQuestProgress: missing questId returns error
 *  - getQuestProgress: auth_required when no session
 *  - getQuestProgress: corrupt stored JSON returns null with warn log
 *  - getActiveQuests: returns all active quests for member
 *  - getActiveQuests: filters out non-active statuses (completed, abandoned)
 *  - getActiveQuests: returns empty array when member has no active quests
 *  - getActiveQuests: auth_required when no session
 *  - getActiveQuests: DB error returns success:false with error message
 *  - saveQuestProgress: DB error returns success:false with error message
 *  - round-trip: complex progressData preserved across save and retrieve
 *  - saveQuestProgress: null progressData stored as "null" and retrieved as null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getUpdated,
  __setQueryError,
} from './__mocks__/wix-data.js';

const memberMocks = vi.hoisted(() => ({ getMember: vi.fn() }));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: memberMocks.getMember },
}));

import {
  saveQuestProgress,
  getQuestProgress,
  getActiveQuests,
} from '../src/backend/questProgressService.web.js';

const MEMBER = {
  _id: 'mem-1',
  contactDetails: { firstName: 'Jane', emails: ['jane@test.com'], addresses: [] },
};

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  memberMocks.getMember.mockResolvedValue(MEMBER);
});

// ── saveQuestProgress — insert ────────────────────────────────────────────────

describe('saveQuestProgress — insert', () => {
  it('returns { success: true } when inserting a new record', async () => {
    const result = await saveQuestProgress('daily-login-7', { day: 3 });
    expect(result.success).toBe(true);
  });

  it('serializes progressData as JSON string in stored record', async () => {
    const onInserts = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => { if (col === 'QuestProgress') onInserts.push(item); });
    await saveQuestProgress('quest-abc', { step: 2, items: ['a', 'b'] });
    expect(onInserts).toHaveLength(1);
    expect(JSON.parse(onInserts[0].progressData)).toEqual({ step: 2, items: ['a', 'b'] });
  });

  it('stores status as "active" by default', async () => {
    const onInserts = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => { if (col === 'QuestProgress') onInserts.push(item); });
    await saveQuestProgress('quest-abc', { step: 1 });
    expect(onInserts[0].status).toBe('active');
  });

  it('stores provided status when specified', async () => {
    const onInserts = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => { if (col === 'QuestProgress') onInserts.push(item); });
    await saveQuestProgress('quest-abc', { step: 5 }, 'completed');
    expect(onInserts[0].status).toBe('completed');
  });

  it('stores null progressData when passed null', async () => {
    const onInserts = [];
    const { __onInsert } = await import('./__mocks__/wix-data.js');
    __onInsert((col, item) => { if (col === 'QuestProgress') onInserts.push(item); });
    await saveQuestProgress('quest-abc', null);
    expect(onInserts[0].progressData).toBe('null');
  });
});

// ── saveQuestProgress — upsert ────────────────────────────────────────────────

describe('saveQuestProgress — upsert', () => {
  it('updates existing record when questId already exists for member', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ step: 1 }), status: 'active', updatedAt: new Date(),
    }]);
    const result = await saveQuestProgress('quest-abc', { step: 3 });
    expect(result.success).toBe(true);
    const updated = __getUpdated('QuestProgress');
    expect(updated).toHaveLength(1);
    expect(JSON.parse(updated[0].progressData)).toEqual({ step: 3 });
  });

  it('updates status on upsert', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ step: 5 }), status: 'active', updatedAt: new Date(),
    }]);
    await saveQuestProgress('quest-abc', { step: 5 }, 'completed');
    const updated = __getUpdated('QuestProgress');
    expect(updated[0].status).toBe('completed');
  });
});

// ── saveQuestProgress — validation ────────────────────────────────────────────

describe('saveQuestProgress — validation', () => {
  it('returns auth_required when member session is absent', async () => {
    memberMocks.getMember.mockResolvedValue(null);
    const result = await saveQuestProgress('quest-abc', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('returns error when questId is missing', async () => {
    const result = await saveQuestProgress('', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for invalid status value', async () => {
    const result = await saveQuestProgress('quest-abc', {}, 'pending');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid status');
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('DB down'));
    const result = await saveQuestProgress('quest-abc', { step: 1 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── getQuestProgress ──────────────────────────────────────────────────────────

describe('getQuestProgress — retrieval', () => {
  it('returns stored progressData', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-abc',
      progressData: JSON.stringify({ day: 4, bonus: true }), status: 'active', updatedAt: new Date(),
    }]);
    const result = await getQuestProgress('quest-abc');
    expect(result.success).toBe(true);
    expect(result.progressData).toEqual({ day: 4, bonus: true });
    expect(result.status).toBe('active');
  });

  it('returns { progressData: null, status: null } when no record exists', async () => {
    const result = await getQuestProgress('quest-xyz');
    expect(result.success).toBe(true);
    expect(result.progressData).toBeNull();
    expect(result.status).toBeNull();
  });

  it('returns null progressData for corrupt stored JSON (with warn log)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __seed('QuestProgress', [{
      _id: 'qp-bad', memberId: 'mem-1', questId: 'quest-corrupt',
      progressData: 'NOT_VALID_JSON', status: 'active', updatedAt: new Date(),
    }]);
    const result = await getQuestProgress('quest-corrupt');
    expect(result.success).toBe(true);
    expect(result.progressData).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('corrupt'), expect.anything());
    warnSpy.mockRestore();
  });

  it('returns auth_required when member session is absent', async () => {
    memberMocks.getMember.mockResolvedValue(null);
    const result = await getQuestProgress('quest-abc');
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('returns error when questId is missing', async () => {
    const result = await getQuestProgress('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('DB timeout'));
    const result = await getQuestProgress('quest-abc');
    expect(result.success).toBe(false);
  });
});

// ── getActiveQuests ───────────────────────────────────────────────────────────

describe('getActiveQuests', () => {
  it('returns all active quests for authenticated member', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: JSON.stringify({ step: 1 }), status: 'active', updatedAt: new Date('2026-03-22T10:00:00Z') },
      { _id: 'qp-2', memberId: 'mem-1', questId: 'quest-b', progressData: JSON.stringify({ step: 2 }), status: 'active', updatedAt: new Date('2026-03-22T11:00:00Z') },
    ]);
    const result = await getActiveQuests();
    expect(result.success).toBe(true);
    expect(result.quests).toHaveLength(2);
  });

  it('filters out completed and abandoned quests', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'active', updatedAt: new Date() },
      { _id: 'qp-2', memberId: 'mem-1', questId: 'quest-b', progressData: '{}', status: 'completed', updatedAt: new Date() },
      { _id: 'qp-3', memberId: 'mem-1', questId: 'quest-c', progressData: '{}', status: 'abandoned', updatedAt: new Date() },
    ]);
    const result = await getActiveQuests();
    expect(result.success).toBe(true);
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].questId).toBe('quest-a');
  });

  it('returns empty array when member has no active quests', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'completed', updatedAt: new Date(),
    }]);
    const result = await getActiveQuests();
    expect(result.success).toBe(true);
    expect(result.quests).toEqual([]);
  });

  it('returns auth_required when member session is absent', async () => {
    memberMocks.getMember.mockResolvedValue(null);
    const result = await getActiveQuests();
    expect(result.success).toBe(false);
    expect(result.error).toBe('auth_required');
  });

  it('includes questId, progressData, status, updatedAt in each quest item', async () => {
    __seed('QuestProgress', [{
      _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a',
      progressData: JSON.stringify({ step: 2 }), status: 'active',
      updatedAt: new Date('2026-03-22T12:00:00Z'),
    }]);
    const result = await getActiveQuests();
    const q = result.quests[0];
    expect(q.questId).toBe('quest-a');
    expect(q.progressData).toEqual({ step: 2 });
    expect(q.status).toBe('active');
    expect(q.updatedAt).toBeDefined();
  });

  it('returns error on DB failure', async () => {
    __setQueryError('QuestProgress', new Error('Network error'));
    const result = await getActiveQuests();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('does not return quests for other members', async () => {
    __seed('QuestProgress', [
      { _id: 'qp-1', memberId: 'mem-1', questId: 'quest-a', progressData: '{}', status: 'active', updatedAt: new Date() },
      { _id: 'qp-2', memberId: 'mem-2', questId: 'quest-b', progressData: '{}', status: 'active', updatedAt: new Date() },
    ]);
    const result = await getActiveQuests();
    expect(result.quests).toHaveLength(1);
    expect(result.quests[0].questId).toBe('quest-a');
  });
});

// ── round-trip ────────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('preserves complex nested progressData', async () => {
    const data = { step: 3, subSteps: [true, false, true], meta: { earned: 50 } };
    __seed('QuestProgress', [{
      _id: 'qp-rt', memberId: 'mem-1', questId: 'quest-deep',
      progressData: JSON.stringify(data), status: 'active', updatedAt: new Date(),
    }]);
    const result = await getQuestProgress('quest-deep');
    expect(result.success).toBe(true);
    expect(result.progressData).toEqual(data);
  });
});
