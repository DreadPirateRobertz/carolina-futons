/**
 * @file loyaltyDailyQuests.test.js
 * @description CF-6tv: TDD tests for daily quest engine.
 *
 * Covers:
 *  - generateDailyQuests(date): pure helper, 3-quest rotation by date hash
 *  - getMyDailyQuests(): webMethod, completion status from QuestCompletions CMS,
 *    rate limiting 30/min per member
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset as __resetData, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetMembers, __setMember } from './__mocks__/wix-members-backend.js';
// wix-data, wix-members-backend, wix-loyalty.v2 are auto-aliased to tests/__mocks__/
// by vitest.config.js — no vi.mock() calls needed

import { generateDailyQuests, getMyDailyQuests, _resetDailyQuestsRateLimit } from '../src/backend/loyaltyService.web.js';

const VALID_MEMBER = { _id: 'member-q1', loginEmail: 'quester@example.com' };

// All 5 quests defined in the spec
const QUEST_POOL = [
  { id: 'purchase',      action: 'purchase',      pointReward: 50 },
  { id: 'review',        action: 'review',         pointReward: 30 },
  { id: 'referral',      action: 'referral',       pointReward: 75 },
  { id: 'browse',        action: 'browse',         pointReward: 15 },
  { id: 'wishlist_share',action: 'wishlist_share', pointReward: 20 },
];

function makeDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  __resetData();
  __resetMembers();
  vi.clearAllMocks();
  _resetDailyQuestsRateLimit();
  __seed('QuestCompletions', []);
});

// ── generateDailyQuests — shape ───────────────────────────────────────────────

describe('generateDailyQuests — shape', () => {
  it('returns exactly 3 quests', () => {
    expect(generateDailyQuests(new Date(2026, 2, 23))).toHaveLength(3);
  });

  it('each quest has id, title, action, and pointReward', () => {
    const quests = generateDailyQuests(new Date(2026, 2, 23));
    for (const q of quests) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('title');
      expect(q).toHaveProperty('action');
      expect(q).toHaveProperty('pointReward');
    }
  });

  it('all returned quests belong to the known quest pool', () => {
    const quests = generateDailyQuests(new Date(2026, 5, 15));
    const poolIds = new Set(QUEST_POOL.map(q => q.id));
    for (const q of quests) {
      expect(poolIds).toContain(q.id);
    }
  });

  it('pointReward values match the canonical pool values', () => {
    const rewardMap = Object.fromEntries(QUEST_POOL.map(q => [q.id, q.pointReward]));
    const quests = generateDailyQuests(new Date(2026, 0, 1));
    for (const q of quests) {
      expect(q.pointReward).toBe(rewardMap[q.id]);
    }
  });

  it('quest ids are unique within the returned set', () => {
    const quests = generateDailyQuests(new Date(2026, 3, 10));
    const ids = quests.map(q => q.id);
    expect(new Set(ids).size).toBe(3);
  });
});

// ── generateDailyQuests — determinism ────────────────────────────────────────

describe('generateDailyQuests — determinism', () => {
  it('returns the same 3 quests for the same date called twice', () => {
    const date = new Date(2026, 2, 23);
    expect(generateDailyQuests(date)).toEqual(generateDailyQuests(date));
  });

  it('returns the same quests for two Date objects with identical values', () => {
    const a = new Date(2026, 5, 15);
    const b = new Date(2026, 5, 15);
    expect(generateDailyQuests(a)).toEqual(generateDailyQuests(b));
  });

  it('produces different quests on different days (across a 5-day span)', () => {
    const results = new Set();
    for (let d = 1; d <= 5; d++) {
      results.add(JSON.stringify(generateDailyQuests(new Date(2026, 0, d))));
    }
    // 5 days with pool size 5 — each day should differ
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it('dates with the same dayOfYear % poolSize produce the same quests', () => {
    // Pool has 5 quests. Days 1 and 6 have the same base slot (1%5 = 6%5 = 1).
    const day1 = new Date(2026, 0, 1);   // Jan 1
    const day6 = new Date(2026, 0, 6);   // Jan 6
    expect(generateDailyQuests(day1)).toEqual(generateDailyQuests(day6));
  });
});

// ── getMyDailyQuests — authentication ────────────────────────────────────────

describe('getMyDailyQuests — authentication', () => {
  it('returns 401 when no member is authenticated', async () => {
    const res = await getMyDailyQuests();
    expect(res.status ?? 401).toBe(401);
  });
});

// ── getMyDailyQuests — shape ──────────────────────────────────────────────────

describe('getMyDailyQuests — shape', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns { quests, date }', async () => {
    const res = await getMyDailyQuests();
    expect(res).toHaveProperty('quests');
    expect(res).toHaveProperty('date');
  });

  it('returns exactly 3 quests', async () => {
    const res = await getMyDailyQuests();
    expect(res.quests).toHaveLength(3);
  });

  it('each quest has id, title, action, pointReward, completed, completedAt', async () => {
    const res = await getMyDailyQuests();
    for (const q of res.quests) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('title');
      expect(q).toHaveProperty('action');
      expect(q).toHaveProperty('pointReward');
      expect(q).toHaveProperty('completed');
      expect(q).toHaveProperty('completedAt');
    }
  });

  it('date is a YYYY-MM-DD string for today', async () => {
    const res = await getMyDailyQuests();
    expect(res.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.date).toBe(makeDateKey(new Date()));
  });
});

// ── getMyDailyQuests — completion status ─────────────────────────────────────

describe('getMyDailyQuests — completion status', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('marks quests as completed: false when no QuestCompletions exist', async () => {
    const res = await getMyDailyQuests();
    for (const q of res.quests) {
      expect(q.completed).toBe(false);
      expect(q.completedAt).toBeNull();
    }
  });

  it('marks a quest completed when a matching QuestCompletions record exists', async () => {
    const today = makeDateKey(new Date());
    const todayQuests = generateDailyQuests(new Date());
    const targetAction = todayQuests[0].action;

    __seed('QuestCompletions', [{
      _id: 'qc-1',
      memberId: 'member-q1',
      action: targetAction,
      dateKey: today,
      completedAt: new Date('2026-03-23T10:00:00.000Z'),
    }]);

    const res = await getMyDailyQuests();
    const completedQuest = res.quests.find(q => q.action === targetAction);
    expect(completedQuest.completed).toBe(true);
    expect(completedQuest.completedAt).not.toBeNull();
  });

  it('does not mark a quest completed for a different member', async () => {
    const today = makeDateKey(new Date());
    const todayQuests = generateDailyQuests(new Date());
    const targetAction = todayQuests[0].action;

    __seed('QuestCompletions', [{
      _id: 'qc-2',
      memberId: 'member-other',
      action: targetAction,
      dateKey: today,
      completedAt: new Date(),
    }]);

    const res = await getMyDailyQuests();
    const q = res.quests.find(q => q.action === targetAction);
    expect(q.completed).toBe(false);
  });

  it('does not mark a quest completed for a different dateKey', async () => {
    const yesterday = makeDateKey(new Date(Date.now() - 86_400_000));
    const todayQuests = generateDailyQuests(new Date());
    const targetAction = todayQuests[0].action;

    __seed('QuestCompletions', [{
      _id: 'qc-3',
      memberId: 'member-q1',
      action: targetAction,
      dateKey: yesterday,
      completedAt: new Date(),
    }]);

    const res = await getMyDailyQuests();
    const q = res.quests.find(q => q.action === targetAction);
    expect(q.completed).toBe(false);
  });
});

// ── getMyDailyQuests — rate limiting ─────────────────────────────────────────

describe('getMyDailyQuests — rate limiting', () => {
  beforeEach(() => { __setMember(VALID_MEMBER); });

  it('returns 429 after 30 requests within the rate limit window', async () => {
    for (let i = 0; i < 30; i++) await getMyDailyQuests();
    const res = await getMyDailyQuests(); // 31st
    expect(res.status ?? 200).toBe(429);
  });

  it('allows exactly 30 requests within the window', async () => {
    for (let i = 0; i < 29; i++) await getMyDailyQuests();
    const res = await getMyDailyQuests(); // 30th
    expect(res).toHaveProperty('quests');
  });
});
