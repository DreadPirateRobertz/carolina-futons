import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset, __getInserted } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  managePushPreferences,
  getMyPushPreferences,
  skipIfOptedOut,
  PUSH_PREFERENCES_COLLECTION,
  PUSH_EVENTS,
} from '../src/backend/pushNotificationService.web.js';

const MEMBER_ID = 'member-prefs-1';
const OTHER_MEMBER = 'member-prefs-2';

function setMember(id = MEMBER_ID) { __setMember({ _id: id }); }

beforeEach(() => { __reset(); resetMember(); });

// ── managePushPreferences ─────────────────────────────────────────────────

describe('managePushPreferences', () => {
  it('creates a new record with defaults + overrides on first call', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await managePushPreferences({ marketing: false });
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual({
      challenges: true,
      streak: true,
      marketing: false,
      tier: true,
      badges: true,
    });
  });

  it('updates a single category without changing others', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: true, streak: true, marketing: true, tier: true },
      updatedAt: new Date('2026-01-01'),
    }]);
    const result = await managePushPreferences({ streak: false });
    expect(result.success).toBe(true);
    expect(result.prefs.streak).toBe(false);
    expect(result.prefs.challenges).toBe(true);
    expect(result.prefs.marketing).toBe(true);
    expect(result.prefs.tier).toBe(true);
  });

  it('handles bulk update of multiple categories', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await managePushPreferences({
      challenges: false,
      streak: false,
      marketing: false,
      tier: false,
      badges: false,
    });
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual({
      challenges: false,
      streak: false,
      marketing: false,
      tier: false,
      badges: false,
    });
  });

  it('rejects unknown category names', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await managePushPreferences({ sms: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain('unknown category');
  });

  it('rejects non-boolean category values', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await managePushPreferences({ marketing: 'yes' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be boolean');
  });

  it('rejects null/missing prefs argument', async () => {
    setMember();
    const result = await managePushPreferences(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('prefs object is required');
  });

  it('returns unauthenticated when no session', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await managePushPreferences({ marketing: false });
    expect(result.success).toBe(false);
    expect(result.error).toBe('unauthenticated');
  });

  it('IDOR guard — uses session memberId, not request data', async () => {
    setMember(MEMBER_ID);
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    await managePushPreferences({ marketing: false });
    const inserted = __getInserted(PUSH_PREFERENCES_COLLECTION);
    expect(inserted.length).toBe(1);
    expect(inserted[0].memberId).toBe(MEMBER_ID);
  });
});

// ── getMyPushPreferences ──────────────────────────────────────────────────

describe('getMyPushPreferences', () => {
  it('returns default all-true when no record exists', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const result = await getMyPushPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual({
      challenges: true,
      streak: true,
      marketing: true,
      tier: true,
      badges: true,
    });
  });

  it('returns stored preferences merged with defaults', async () => {
    setMember();
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { marketing: false },
    }]);
    const result = await getMyPushPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs.marketing).toBe(false);
    expect(result.prefs.challenges).toBe(true);
  });

  it('returns unauthenticated when no session', async () => {
    const result = await getMyPushPreferences();
    expect(result.success).toBe(false);
    expect(result.error).toBe('unauthenticated');
  });
});

// ── skipIfOptedOut ────────────────────────────────────────────────────────

describe('skipIfOptedOut', () => {
  it('returns false (do not skip) when no preferences record exists', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, []);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.TIER_CHANGED);
    expect(skip).toBe(false);
  });

  it('maps BADGE_EARNED to badges category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { badges: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED);
    expect(skip).toBe(true);
  });

  it('does not skip BADGE_EARNED when no badges pref is set (defaults opt-in)', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: false, streak: false, marketing: false, tier: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.BADGE_EARNED);
    expect(skip).toBe(false);
  });

  it('returns true when member opted out of the event category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: true, streak: true, marketing: false, tier: true },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.PRICE_DROP);
    expect(skip).toBe(true);
  });

  it('returns false when member opted in to the event category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: true, streak: true, marketing: true, tier: true },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.PRICE_DROP);
    expect(skip).toBe(false);
  });

  it('maps CHALLENGE_REMINDER to challenges category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.CHALLENGE_REMINDER);
    expect(skip).toBe(true);
  });

  it('maps CHALLENGE_COMPLETE to challenges category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { challenges: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.CHALLENGE_COMPLETE);
    expect(skip).toBe(true);
  });

  it('maps STREAK_MILESTONE to streak category', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: MEMBER_ID,
      categoryPrefs: { streak: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.STREAK_MILESTONE);
    expect(skip).toBe(true);
  });

  it('does not cross-contaminate between members', async () => {
    __seed(PUSH_PREFERENCES_COLLECTION, [{
      _id: 'pref-1',
      memberId: OTHER_MEMBER,
      categoryPrefs: { tier: false },
    }]);
    const skip = await skipIfOptedOut(MEMBER_ID, PUSH_EVENTS.TIER_CHANGED);
    expect(skip).toBe(false);
  });
});
