/**
 * reEngagementWinBack.test.js
 * cf-bpt — Multi-step win-back + non-purchaser re-engagement.
 *
 * Gap 1: triggerReengagement previously seeded only from EmailQueue
 * (post_purchase step 1 sentAt <= 90d ago). Browse-only members who never
 * purchased — quiz takers, wishlist adders, streak earners — were invisible.
 * Fix: seed from MemberPoints.lastActivityAt (cf-bvn).
 *
 * Gap 2: SEQUENCES.reengagement was 1 step. Win-back is now 3 steps —
 * day 0 "we miss you", day 7 "here's a deal", day 21 "last chance".
 * All 3 steps queue on the same invocation with appropriate scheduledFor
 * offsets, mirroring the welcome/cart_recovery multi-step pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __reset as __resetData } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  triggerReengagement,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

const NOW = Date.now();
const HUNDRED_DAYS_AGO = new Date(NOW - 100 * 24 * 60 * 60 * 1000);
const NINETY_ONE_DAYS_AGO = new Date(NOW - 91 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_AGO = new Date(NOW - 30 * 24 * 60 * 60 * 1000);

function seedMember(memberId, email, firstName = '') {
  __seed('Members/PrivateMembersData', [
    { _id: memberId, loginEmail: email, contactId: `contact-${memberId}`, firstName },
  ]);
}

beforeEach(() => {
  __resetData();
  __setSecrets({ RECOVERY_DISCOUNT_CODE: 'COMEBACK15' });
});

describe('SEQUENCES.reengagement — multi-step win-back definition', () => {
  it('has 3 steps: day 0, day 7, day 21', () => {
    expect(_SEQUENCES.reengagement.steps).toHaveLength(3);
    expect(_SEQUENCES.reengagement.steps[0].delayHours).toBe(0);
    expect(_SEQUENCES.reengagement.steps[1].delayHours).toBe(168);
    expect(_SEQUENCES.reengagement.steps[2].delayHours).toBe(504);
  });

  it('has step numbering 1/2/3 with distinct template ids', () => {
    const steps = _SEQUENCES.reengagement.steps;
    expect(steps.map(s => s.step)).toEqual([1, 2, 3]);
    expect(steps.map(s => s.templateId)).toEqual(['reengagement_1', 'reengagement_2', 'reengagement_3']);
  });
});

describe('triggerReengagement — non-purchaser seeding from MemberPoints', () => {
  it('reaches a browse-only member (wishlist/quiz, no purchase) with dormant lastActivityAt', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-browse', lastActivityAt: HUNDRED_DAYS_AGO, totalPoints: 25 },
    ]);
    seedMember('mem-browse', 'browse@test.com', 'Browser');

    const result = await triggerReengagement();

    expect(result.success).toBe(true);
    expect(result.contacted).toBe(1);
  });

  it('does NOT reach a member active within the 90-day window', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-active', lastActivityAt: THIRTY_DAYS_AGO, totalPoints: 100 },
    ]);
    seedMember('mem-active', 'active@test.com', 'Active');

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('skips MemberPoints records with no lastActivityAt (pre-cf-bvn rows)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-legacy', totalPoints: 10 },
    ]);
    seedMember('mem-legacy', 'legacy@test.com');

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('skips members whose PrivateMembersData lookup yields no email', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-noemail', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });
});

describe('triggerReengagement — queues all 3 steps with correct delays', () => {
  function captureInserts() {
    const inserted = [];
    __onInsert((_collection, item) => {
      if (item.sequenceType === 'reengagement') inserted.push(item);
    });
    return inserted;
  }

  it('queues all 3 win-back steps for a dormant member in one pass', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'm1@test.com', 'Alice');
    const inserts = captureInserts();

    const result = await triggerReengagement();

    expect(result.contacted).toBe(1);
    expect(inserts).toHaveLength(3);
    expect(inserts.map(i => i.sequenceStep).sort()).toEqual([1, 2, 3]);
  });

  it('each queued step has the correct scheduledFor offset (0h, 168h, 504h)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'm1@test.com');
    const inserts = captureInserts();
    const before = Date.now();

    await triggerReengagement();

    const after = Date.now();
    const byStep = Object.fromEntries(inserts.map(i => [i.sequenceStep, i]));
    const step1Time = new Date(byStep[1].scheduledFor).getTime();
    const step2Time = new Date(byStep[2].scheduledFor).getTime();
    const step3Time = new Date(byStep[3].scheduledFor).getTime();

    expect(step1Time).toBeGreaterThanOrEqual(before);
    expect(step1Time).toBeLessThanOrEqual(after);
    const HOUR = 60 * 60 * 1000;
    expect(step2Time - step1Time).toBeCloseTo(168 * HOUR, -3);
    expect(step3Time - step1Time).toBeCloseTo(504 * HOUR, -3);
  });

  it('each queued step carries the distinct templateId from SEQUENCES', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'm1@test.com');
    const inserts = captureInserts();

    await triggerReengagement();

    const byStep = Object.fromEntries(inserts.map(i => [i.sequenceStep, i]));
    expect(byStep[1].templateId).toBe('reengagement_1');
    expect(byStep[2].templateId).toBe('reengagement_2');
    expect(byStep[3].templateId).toBe('reengagement_3');
  });

  it('propagates discount code to every step', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'm1@test.com', 'Alice');
    const inserts = captureInserts();

    await triggerReengagement();

    for (const item of inserts) {
      expect(item.variables.discountCode).toBe('COMEBACK15');
      expect(item.variables.discountAvailable).toBe(true);
      expect(item.variables.firstName).toBe('Alice');
    }
  });
});

describe('triggerReengagement — dedup across multi-step runs', () => {
  it('skips a member who already has a queued reengagement step (any step)', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'm1@test.com');
    __seed('EmailQueue', [
      { _id: 'eq-dup', recipientEmail: 'm1@test.com', sequenceType: 'reengagement', sequenceStep: 1, status: 'sent' },
    ]);

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('skips unsubscribed members even when lastActivityAt is dormant', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
    ]);
    seedMember('mem-1', 'unsub@test.com');
    __seed('Unsubscribes', [
      { email: 'unsub@test.com', sequenceType: 'reengagement', unsubscribedAt: new Date() },
    ]);

    const result = await triggerReengagement();
    expect(result.contacted).toBe(0);
  });

  it('queues all 3 steps for each of multiple dormant members', async () => {
    __seed('MemberPoints', [
      { _id: 'mp-1', memberId: 'mem-1', lastActivityAt: HUNDRED_DAYS_AGO },
      { _id: 'mp-2', memberId: 'mem-2', lastActivityAt: NINETY_ONE_DAYS_AGO },
    ]);
    __seed('Members/PrivateMembersData', [
      { _id: 'mem-1', loginEmail: 'm1@test.com', contactId: 'c1' },
      { _id: 'mem-2', loginEmail: 'm2@test.com', contactId: 'c2' },
    ]);

    const inserts = [];
    __onInsert((_c, item) => { if (item.sequenceType === 'reengagement') inserts.push(item); });

    const result = await triggerReengagement();
    expect(result.contacted).toBe(2);
    expect(inserts).toHaveLength(6); // 3 steps × 2 members
  });
});
