import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import { sendPushToMember, PUSH_EVENTS } from '../src/backend/pushNotificationService.web.js';
import { PUSH_TOKENS_COLLECTION } from '../src/backend/pushTokenRegistry.web.js';

const MEMBER_ID = 'member-push-2';
function setMember() { __setMember({ _id: MEMBER_ID }); }

beforeEach(() => { __reset(); resetMember(); vi.restoreAllMocks(); });

describe('PUSH_EVENTS', () => {
  it('defines BADGE_EARNED and TIER_CHANGED', () => {
    expect(typeof PUSH_EVENTS.BADGE_EARNED).toBe('string');
    expect(typeof PUSH_EVENTS.TIER_CHANGED).toBe('string');
  });

  it('defines all 5 event types', () => {
    expect(typeof PUSH_EVENTS.CHALLENGE_COMPLETE).toBe('string');
    expect(typeof PUSH_EVENTS.STREAK_MILESTONE).toBe('string');
    expect(typeof PUSH_EVENTS.PRICE_DROP).toBe('string');
  });
});

describe('sendPushToMember — no tokens', () => {
  it('returns sent: 0 when member has no push tokens', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, []);
    const result = await sendPushToMember(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED, { badgeId: 'first_purchase' });
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
  });
});

describe('sendPushToMember — with tokens', () => {
  it('returns sent count equal to active token count on FCM success', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-ios', platform: 'ios', active: true },
      { _id: 't2', memberId: MEMBER_ID, token: 'tok-android', platform: 'android', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'projects/x/messages/1' }),
    }));
    const result = await sendPushToMember(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED, { badgeId: 'streak_7' });
    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('counts FCM failures without throwing', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-bad', platform: 'ios', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { status: 'NOT_FOUND' } }),
    }));
    const result = await sendPushToMember(MEMBER_ID, PUSH_EVENTS.TIER_CHANGED, { tier: 'silver' });
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('deactivates stale tokens on FCM NOT_FOUND response', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'stale-tok', platform: 'android', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { status: 'NOT_FOUND' } }),
    }));
    await sendPushToMember(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED, { badgeId: 'x' });
    // After deactivation, getActiveTokensForMember should return empty
    const { getActiveTokensForMember } = await import('../src/backend/pushTokenRegistry.web.js');
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(0);
  });

  it('deactivates stale tokens on UNREGISTERED response', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't2', memberId: MEMBER_ID, token: 'unreg-tok', platform: 'ios', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: { status: 'UNREGISTERED' } }),
    }));
    await sendPushToMember(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED, { badgeId: 'y' });
    const { getActiveTokensForMember } = await import('../src/backend/pushTokenRegistry.web.js');
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(0);
  });

  it('does NOT deactivate on non-stale FCM errors', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't3', memberId: MEMBER_ID, token: 'rate-tok', platform: 'ios', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { status: 'QUOTA_EXCEEDED' } }),
    }));
    await sendPushToMember(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED, { badgeId: 'z' });
    const { getActiveTokensForMember } = await import('../src/backend/pushTokenRegistry.web.js');
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(1); // token still active
  });

  it('handles fetch exception without throwing', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't4', memberId: MEMBER_ID, token: 'err-tok', platform: 'ios', active: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await sendPushToMember(MEMBER_ID, PUSH_EVENTS.PRICE_DROP, { productName: 'Oak Futon' });
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });
});

describe('sendPushToMember — message building', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'msg/1' }),
    }));
  });

  it.each([
    [PUSH_EVENTS.BADGE_EARNED, { badgeId: 'first_purchase' }],
    [PUSH_EVENTS.TIER_CHANGED, { tier: 'gold' }],
    [PUSH_EVENTS.CHALLENGE_COMPLETE, { challengeName: 'Spring Challenge' }],
    [PUSH_EVENTS.STREAK_MILESTONE, { days: 30 }],
    [PUSH_EVENTS.PRICE_DROP, { productName: 'Futon Frame' }],
  ])('sends without error for event type %s', async (event, payload) => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 'tx', memberId: MEMBER_ID, token: 'tok-x', platform: 'ios', active: true },
    ]);
    const result = await sendPushToMember(MEMBER_ID, event, payload);
    expect(result.sent).toBe(1);
  });

  it('uses default message for unknown event type', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 'ty', memberId: MEMBER_ID, token: 'tok-y', platform: 'ios', active: true },
    ]);
    const result = await sendPushToMember(MEMBER_ID, 'unknown_event', {});
    expect(result.sent).toBe(1); // default message used
  });
});
