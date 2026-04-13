import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  MOBILE_CHALLENGE_TYPES,
  MOBILE_CHALLENGES_COLLECTION,
  completeMobileChallenge,
  getMobileChallengeProgress,
} from '../src/backend/mobileChallengeService.web.js';

const MEMBER_ID = 'member-mobile-1';
function setMember() { __setMember({ _id: MEMBER_ID }); }

beforeEach(() => { __reset(); resetMember(); vi.restoreAllMocks(); });

// ── MOBILE_CHALLENGE_TYPES ────────────────────────────────────────────────────

describe('MOBILE_CHALLENGE_TYPES', () => {
  it('defines AR_DISCOVERY, QUIZ_COMPLETION, SOCIAL_SHARE', () => {
    expect(typeof MOBILE_CHALLENGE_TYPES.AR_DISCOVERY).toBe('string');
    expect(typeof MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION).toBe('string');
    expect(typeof MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE).toBe('string');
  });

  it('all values are non-empty strings', () => {
    for (const val of Object.values(MOBILE_CHALLENGE_TYPES)) {
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it('all values are unique', () => {
    const vals = Object.values(MOBILE_CHALLENGE_TYPES);
    expect(new Set(vals).size).toBe(vals.length);
  });
});

// ── MOBILE_CHALLENGES_COLLECTION ─────────────────────────────────────────────

describe('MOBILE_CHALLENGES_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof MOBILE_CHALLENGES_COLLECTION).toBe('string');
    expect(MOBILE_CHALLENGES_COLLECTION.length).toBeGreaterThan(0);
  });
});

// ── completeMobileChallenge ───────────────────────────────────────────────────

describe('completeMobileChallenge — AR_DISCOVERY', () => {
  it('returns success: true with pointsAwarded > 0', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, { productId: 'prod-1' });
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);
  });

  it('alreadyAwarded is false on first completion', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, { productId: 'prod-1' });
    expect(result.alreadyAwarded).toBe(false);
  });
});

describe('completeMobileChallenge — QUIZ_COMPLETION', () => {
  it('returns success: true with pointsAwarded > 0', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION, { score: 3, total: 3 });
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);
  });
});

describe('completeMobileChallenge — SOCIAL_SHARE', () => {
  it('returns success: true with pointsAwarded > 0', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE, { platform: 'instagram' });
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBeGreaterThan(0);
  });
});

describe('completeMobileChallenge — idempotency', () => {
  it('does not double-award same AR challenge for same product same day', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, [
      {
        _id: 'mc-1',
        memberId: MEMBER_ID,
        challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY,
        completedAt: new Date(),
        productId: 'prod-1',
      },
    ]);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, { productId: 'prod-1' });
    expect(result.alreadyAwarded).toBe(true);
    expect(result.pointsAwarded).toBe(0);
  });

  it('allows AR challenge for a different product', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, [
      {
        _id: 'mc-1',
        memberId: MEMBER_ID,
        challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY,
        completedAt: new Date(),
        productId: 'prod-1',
      },
    ]);
    const result = await completeMobileChallenge(MEMBER_ID, MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, { productId: 'prod-2' });
    expect(result.alreadyAwarded).toBe(false);
    expect(result.pointsAwarded).toBeGreaterThan(0);
  });
});

describe('completeMobileChallenge — validation', () => {
  it('rejects unknown challenge type', async () => {
    setMember();
    const result = await completeMobileChallenge(MEMBER_ID, 'unknown_type', {});
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects missing memberId', async () => {
    const result = await completeMobileChallenge('', MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION, {});
    expect(result.success).toBe(false);
  });
});

// ── getMobileChallengeProgress ────────────────────────────────────────────────

describe('getMobileChallengeProgress', () => {
  it('returns success: true', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await getMobileChallengeProgress(MEMBER_ID);
    expect(result.success).toBe(true);
  });

  it('returns counts keyed by challenge type', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, [
      { _id: 'mc-1', memberId: MEMBER_ID, challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, completedAt: new Date() },
      { _id: 'mc-2', memberId: MEMBER_ID, challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, completedAt: new Date() },
      { _id: 'mc-3', memberId: MEMBER_ID, challengeType: MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION, completedAt: new Date() },
    ]);
    const result = await getMobileChallengeProgress(MEMBER_ID);
    expect(result.counts[MOBILE_CHALLENGE_TYPES.AR_DISCOVERY]).toBe(2);
    expect(result.counts[MOBILE_CHALLENGE_TYPES.QUIZ_COMPLETION]).toBe(1);
    expect(result.counts[MOBILE_CHALLENGE_TYPES.SOCIAL_SHARE]).toBe(0);
  });

  it('returns zero counts when member has no completions', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, []);
    const result = await getMobileChallengeProgress(MEMBER_ID);
    for (const val of Object.values(result.counts)) {
      expect(val).toBe(0);
    }
  });

  it('does not count another member\'s completions', async () => {
    setMember();
    __seed(MOBILE_CHALLENGES_COLLECTION, [
      { _id: 'mc-1', memberId: 'other-member', challengeType: MOBILE_CHALLENGE_TYPES.AR_DISCOVERY, completedAt: new Date() },
    ]);
    const result = await getMobileChallengeProgress(MEMBER_ID);
    expect(result.counts[MOBILE_CHALLENGE_TYPES.AR_DISCOVERY]).toBe(0);
  });
});
