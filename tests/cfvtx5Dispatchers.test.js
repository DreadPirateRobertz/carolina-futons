/**
 * @file cfvtx5Dispatchers.test.js
 * @description cf-vtx5 follow-on coverage for the 4 module dispatchers +
 * 2 concrete wrappers godfrey added on top of rennala's wishlistService
 * reference (PR #1164 / tests/wishlistServiceDispatcher.cfvtx5.test.js).
 *
 * Same contract as the reference:
 *   - 200 on success with bare result body (cfw `velo-client.ts` casts
 *     response body to T directly — no envelope on success)
 *   - 200 with the webMethod's `{success:false, error}` envelope on
 *     soft failure (cfw branches on body.success, NOT res.ok)
 *   - 404 unknown_method when path[0] is missing or not in the allowlist
 *   - 400 invalid_json on body parse failure
 *   - 400 args_must_be_array when body lacks args[]
 *   - 500 server_error + errorId on unexpected throw, errorId in console.error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/gamificationCore.web', () => ({
  getActiveChallenges: vi.fn(),
  getActivityFeed: vi.fn(),
  getLeaderboard: vi.fn(),
  getMemberTier: vi.fn(),
  getStreakData: vi.fn(),
  receiveGamificationEvent: vi.fn(),
  recordChallengeProgress: vi.fn(),
  recoverStreak: vi.fn(),
}));
vi.mock('backend/loyaltyService.web', () => ({
  getAvailableRewards: vi.fn(),
  getChallengeCatalog: vi.fn(),
  getChallengeLeaderboard: vi.fn(),
  getLeaderboard: vi.fn(),
  getLoyaltyTiers: vi.fn(),
  getMyAchievements: vi.fn(),
  getMyActivity: vi.fn(),
  getMyBurnRate: vi.fn(),
  getMyDailyQuests: vi.fn(),
  getMyLoyaltyAccount: vi.fn(),
  getMyStreakData: vi.fn(),
  redeemReward: vi.fn(),
}));
vi.mock('backend/pushNotificationService.web', () => ({
  getMyPushPreferences: vi.fn(),
  managePushPreferences: vi.fn(),
}));
vi.mock('backend/styleQuiz.web', () => ({
  captureQuizLead: vi.fn(),
  getPersonalizedCopy: vi.fn(),
  getQuizOptions: vi.fn(),
  getQuizRecommendations: vi.fn(),
}));
vi.mock('backend/surveyService.web', () => ({
  submitSurveyResponse: vi.fn(),
}));
vi.mock('backend/spinRedemptionService.web', () => ({
  grantSpin: vi.fn(),
}));

import {
  post_gamificationCore,
  options_gamificationCore,
  post_loyaltyService,
  options_loyaltyService,
  post_pushNotificationService,
  options_pushNotificationService,
  post_styleQuiz,
  options_styleQuiz,
  post_recordSpinGrant,
  options_recordSpinGrant,
  post_submitSurvey,
  options_submitSurvey,
} from '../src/backend/http-functions.js';
import { getActiveChallenges, getLeaderboard as gamificationGetLeaderboard, recordChallengeProgress } from 'backend/gamificationCore.web';
import { getMyLoyaltyAccount, redeemReward } from 'backend/loyaltyService.web';
import { getMyPushPreferences } from 'backend/pushNotificationService.web';
import { captureQuizLead } from 'backend/styleQuiz.web';
import { submitSurveyResponse } from 'backend/surveyService.web';
import { grantSpin } from 'backend/spinRedemptionService.web';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { __seed, __reset as __resetData } from './__mocks__/wix-data.js';

const goodOrigin = 'https://carolina-futons-web.vercel.app';

function dispatcherReq(method, body = { args: [] }) {
  return {
    path: method ? [method] : [],
    body: { json: async () => body },
    headers: { origin: goodOrigin },
  };
}

function flatReq(body) {
  return {
    body: { json: async () => body },
    headers: { origin: goodOrigin },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetData();
  __setMember(null);
});

// ── post_gamificationCore ─────────────────────────────────────────────────────

describe('cf-vtx5 · post_gamificationCore dispatcher', () => {
  it('routes path[0] to the matching webMethod and returns its envelope verbatim', async () => {
    vi.mocked(getActiveChallenges).mockResolvedValue({ success: true, challenges: [{ id: 'c1' }] });
    const res = await post_gamificationCore(dispatcherReq('getActiveChallenges'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, challenges: [{ id: 'c1' }] });
  });

  it('spreads body.args positionally', async () => {
    vi.mocked(recordChallengeProgress).mockResolvedValue({ success: true });
    await post_gamificationCore(dispatcherReq('recordChallengeProgress', { args: ['member-1', 'cha-2', 5] }));
    expect(vi.mocked(recordChallengeProgress)).toHaveBeenCalledWith('member-1', 'cha-2', 5);
  });

  it('returns 404 unknown_method for a method not in the allowlist', async () => {
    const res = await post_gamificationCore(dispatcherReq('updateStreakState'));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ error: 'unknown_method', method: 'updateStreakState' });
  });

  it('cf-yvs4: maps {success:false} envelopes to the matching 4xx status', async () => {
    // Default soft-fail → 400; "rate_limit" string → 429; "Authentication
    // required" → 401. cf-89xn lying-status removal applied to all 22
    // dispatchers per radahn's audit (cf-yvs4).
    vi.mocked(gamificationGetLeaderboard).mockResolvedValue({ success: false, error: 'rate_limit' });
    const res = await post_gamificationCore(dispatcherReq('getLeaderboard'));
    expect(res.status).toBe(429);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'rate_limit' });
  });

  it('cf-mgnh: unclassified soft-fail (business-logic outcome) stays 200 + envelope', async () => {
    // cf-yvs4 originally defaulted unclassified strings to 400. cf-mgnh
    // refined the mapper: unrecognised strings are presumed to be
    // business-logic outcomes and pass through as 200 so cfw doesn't
    // throw VeloRpcError on routine outcomes. Real validation errors
    // (start with "Invalid ", "must be", "is required") are still 400.
    vi.mocked(gamificationGetLeaderboard).mockResolvedValue({ success: false, error: 'something else broke' });
    const res = await post_gamificationCore(dispatcherReq('getLeaderboard'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'something else broke' });
  });

  it('cf-mgnh: validation-shaped error string ("Invalid product ID.") still maps to 400', async () => {
    // Validation-class strings have a recognisable prefix/suffix; those
    // remain 400 so cfw can branch on schema-level failure correctly.
    vi.mocked(gamificationGetLeaderboard).mockResolvedValue({ success: false, error: 'Invalid product ID.' });
    const res = await post_gamificationCore(dispatcherReq('getLeaderboard'));
    expect(res.status).toBe(400);
  });

  it('cf-yvs4: maps "Authentication required" soft-fail to 401', async () => {
    vi.mocked(gamificationGetLeaderboard).mockResolvedValue({ success: false, error: 'Authentication required' });
    const res = await post_gamificationCore(dispatcherReq('getLeaderboard'));
    expect(res.status).toBe(401);
  });

  it('returns 500 with errorId + console-correlated log on unexpected throw', async () => {
    vi.mocked(getActiveChallenges).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_gamificationCore(dispatcherReq('getActiveChallenges'));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    expect(body.errorId.length).toBeGreaterThan(0);
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain(body.errorId);
    expect(logged).toContain('post_gamificationCore:getActiveChallenges');
    consoleErr.mockRestore();
  });

  it('options preflight responds with a CORS envelope', () => {
    const res = options_gamificationCore({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_loyaltyService ───────────────────────────────────────────────────────

describe('cf-vtx5 · post_loyaltyService dispatcher', () => {
  it('routes getMyLoyaltyAccount with empty args', async () => {
    vi.mocked(getMyLoyaltyAccount).mockResolvedValue({ success: true, account: { points: 1234 } });
    const res = await post_loyaltyService(dispatcherReq('getMyLoyaltyAccount', { args: [] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, account: { points: 1234 } });
    expect(vi.mocked(getMyLoyaltyAccount)).toHaveBeenCalledWith();
  });

  it('routes redeemReward with positional args', async () => {
    vi.mocked(redeemReward).mockResolvedValue({ success: true });
    await post_loyaltyService(dispatcherReq('redeemReward', { args: ['reward-9'] }));
    expect(vi.mocked(redeemReward)).toHaveBeenCalledWith('reward-9');
  });

  it('returns 400 args_must_be_array when body has no args field', async () => {
    const res = await post_loyaltyService(dispatcherReq('getMyLoyaltyAccount', { foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
  });

  it('returns 400 invalid_json on parse failure', async () => {
    const req = {
      path: ['getMyLoyaltyAccount'],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_loyaltyService(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('options preflight responds', () => {
    const res = options_loyaltyService({ headers: { origin: goodOrigin } });
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_pushNotificationService ──────────────────────────────────────────────

describe('cf-vtx5 · post_pushNotificationService dispatcher', () => {
  it('routes getMyPushPreferences', async () => {
    vi.mocked(getMyPushPreferences).mockResolvedValue({ success: true, preferences: {} });
    const res = await post_pushNotificationService(dispatcherReq('getMyPushPreferences'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, preferences: {} });
  });

  it('returns 404 for an unknown method', async () => {
    const res = await post_pushNotificationService(dispatcherReq('sendPushToMember'));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_method');
  });

  it('options preflight responds', () => {
    expect(options_pushNotificationService({ headers: { origin: goodOrigin } }).status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_styleQuiz ────────────────────────────────────────────────────────────

describe('cf-vtx5 · post_styleQuiz dispatcher', () => {
  it('routes captureQuizLead with positional args', async () => {
    vi.mocked(captureQuizLead).mockResolvedValue({ success: true, leadId: 'lead-1' });
    await post_styleQuiz(dispatcherReq('captureQuizLead', { args: [{ email: 'a@b.com', score: 90 }] }));
    expect(vi.mocked(captureQuizLead)).toHaveBeenCalledWith({ email: 'a@b.com', score: 90 });
  });

  it('returns 404 for a method not in the allowlist', async () => {
    const res = await post_styleQuiz(dispatcherReq('upsertQuizConfig'));
    expect(res.status).toBe(404);
  });

  it('options preflight responds', () => {
    expect(options_styleQuiz({ headers: { origin: goodOrigin } }).status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_recordSpinGrant ──────────────────────────────────────────────────────

describe('cf-vtx5 · post_recordSpinGrant', () => {
  it('returns 200 with the grantSpin result on authenticated call', async () => {
    __setMember({ _id: 'member-77', loginEmail: 'm@e.com' });
    vi.mocked(grantSpin).mockResolvedValue({ success: true, spinId: 'spin-9' });
    const res = await post_recordSpinGrant(flatReq({}));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, spinId: 'spin-9' });
    expect(vi.mocked(grantSpin)).toHaveBeenCalledWith('member-77');
  });

  it('cf-yvs4: returns 401 + {success:false, "Authentication required"} when no member', async () => {
    __setMember(null);
    const res = await post_recordSpinGrant(flatReq({}));
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'Authentication required' });
    expect(vi.mocked(grantSpin)).not.toHaveBeenCalled();
  });

  it('returns 500 server_error + errorId when grantSpin throws unexpectedly', async () => {
    __setMember({ _id: 'member-77', loginEmail: 'm@e.com' });
    vi.mocked(grantSpin).mockRejectedValue(new Error('Wix Data down'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_recordSpinGrant(flatReq({}));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    consoleErr.mockRestore();
  });

  it('options preflight responds', () => {
    expect(options_recordSpinGrant({ headers: { origin: goodOrigin } }).status).toBeGreaterThanOrEqual(200);
  });
});

// ── post_submitSurvey ─────────────────────────────────────────────────────────

describe('cf-vtx5 · post_submitSurvey', () => {
  beforeEach(() => {
    // Default: authenticated member + a Survey row owned by them at order-1.
    __setMember({ _id: 'member-77', loginEmail: 'm@e.com' });
    __seed('Survey', [{ _id: 'srv-1', memberId: 'member-77', orderId: 'order-1' }]);
  });

  it('shims cfw shape {score, comments, orderId} → webMethod {orderId, npsScore, comment}', async () => {
    vi.mocked(submitSurveyResponse).mockResolvedValue({ success: true });
    await post_submitSurvey(flatReq({ score: 8, orderId: 'order-1', comments: 'Liked it' }));
    expect(vi.mocked(submitSurveyResponse)).toHaveBeenCalledWith({
      orderId: 'order-1',
      npsScore: 8,
      comment: 'Liked it',
    });
  });

  it('forwards the webMethod envelope verbatim as 200 on success', async () => {
    vi.mocked(submitSurveyResponse).mockResolvedValue({ success: true });
    const res = await post_submitSurvey(flatReq({ score: 10, orderId: 'order-1' }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true });
  });

  it('cf-mgnh: business-logic soft-failure ("Survey already completed") stays 200 + envelope', async () => {
    // Idempotent business outcome — the survey row exists, the caller owns
    // it, and the system enforced the once-only rule. Returning 4xx would
    // force cfw to wrap a routine outcome in try/catch. 200 + envelope lets
    // cfw branch on body.success.
    vi.mocked(submitSurveyResponse).mockResolvedValue({ success: false, error: 'Survey already completed' });
    const res = await post_submitSurvey(flatReq({ score: 5, orderId: 'order-1' }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: false, error: 'Survey already completed' });
  });

  it('cf-yvs4: security-class soft-failure ("Authentication required") still maps to 401', async () => {
    // The 401 mapping for security-class strings survives cf-mgnh — only the
    // unclassified business-logic default-400 changed. This pin guards
    // against the regression "we made everything 200 again".
    vi.mocked(submitSurveyResponse).mockResolvedValue({ success: false, error: 'Authentication required' });
    // Pre-check passes (caller has a member + matching orderId), so the
    // webMethod is invoked and surfaces its own auth_required envelope.
    __setMember({ _id: 'member-77', loginEmail: 'm@e.com' });
    __seed('Survey', [{ _id: 'sv-1', memberId: 'member-77', orderId: 'order-1' }]);
    const res = await post_submitSurvey(flatReq({ score: 5, orderId: 'order-1' }));
    expect(res.status).toBe(401);
  });

  it('cf-yvs4 IDOR: returns 404 when the orderId does not belong to the caller', async () => {
    // Pre-check pulls a Survey row scoped to the caller's memberId — a
    // different member's orderId returns no rows → 404.
    __setMember({ _id: 'attacker-99', loginEmail: 'a@e.com' });
    const res = await post_submitSurvey(flatReq({ score: 8, orderId: 'order-1' }));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: expect.stringMatching(/no survey/i) });
    expect(vi.mocked(submitSurveyResponse)).not.toHaveBeenCalled();
  });

  it('cf-yvs4: returns 401 when no SiteMember context', async () => {
    __setMember(null);
    const res = await post_submitSurvey(flatReq({ score: 5, orderId: 'order-1' }));
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'Authentication required' });
    expect(vi.mocked(submitSurveyResponse)).not.toHaveBeenCalled();
  });

  it('cf-yvs4: rejects non-number score type (string "5", boolean true, null)', async () => {
    // Number(…) coerced these to valid integers in the old code; tighten to
    // typeof === 'number' so JSON-typed inputs are required.
    const res1 = await post_submitSurvey(flatReq({ score: '5', orderId: 'order-1' }));
    expect(res1.status).toBe(400);
    const res2 = await post_submitSurvey(flatReq({ score: true, orderId: 'order-1' }));
    expect(res2.status).toBe(400);
    const res3 = await post_submitSurvey(flatReq({ score: null, orderId: 'order-1' }));
    expect(res3.status).toBe(400);
    expect(vi.mocked(submitSurveyResponse)).not.toHaveBeenCalled();
  });

  it('returns 400 when score is out of range', async () => {
    const res1 = await post_submitSurvey(flatReq({ score: 11, orderId: 'order-1' }));
    expect(res1.status).toBe(400);
    const res2 = await post_submitSurvey(flatReq({ score: 5.5, orderId: 'order-1' }));
    expect(res2.status).toBe(400);
    const res3 = await post_submitSurvey(flatReq({ score: -1, orderId: 'order-1' }));
    expect(res3.status).toBe(400);
    expect(vi.mocked(submitSurveyResponse)).not.toHaveBeenCalled();
  });

  it('returns 400 when orderId is missing', async () => {
    const res = await post_submitSurvey(flatReq({ score: 8 }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/orderId/i);
  });

  it('returns 400 invalid_json on parse failure', async () => {
    const req = {
      body: { json: async () => { throw new SyntaxError('bad'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_submitSurvey(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('options preflight responds', () => {
    expect(options_submitSurvey({ headers: { origin: goodOrigin } }).status).toBeGreaterThanOrEqual(200);
  });
});
