/**
 * @file referralServiceDispatcher.test.js
 * @description cf-hpb2 coverage for the referralService dispatcher.
 * cfw's actions/referral.ts uses `r(method) = referralService/${method}`
 * to call 4 webMethods whose names don't match backend exports verbatim
 * (Stilgar combo b+c — see docs/cf-hpb2-referralservice-comparison.md).
 *
 * Verifies (cf-yvs4 / cf-mgnh contract):
 *   - getMyReferralCode / getMyReferralStats — pure rename aliases
 *   - getReferralByCode — shape shim wrapping {referrerName} → {referral: {referrerName}}
 *   - claimReferral — alias for redeemReferralCode (post Stilgar Q2 refactor)
 *   - allowlist 404 for unknown methods
 *   - cf-yvs4 4xx mapping on {success:false} envelopes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/referralService.web', () => ({
  // cfw-aliased
  getReferralLink: vi.fn(),
  getReferralStats: vi.fn(),
  getReferralLinkOwnerName: vi.fn(),
  redeemReferralCode: vi.fn(),
  // NOT exposed via dispatcher — must 404 from cfw
  completeReferral: vi.fn(),
  getMyReferrals: vi.fn(),
  getMyCredits: vi.fn(),
  applyCredit: vi.fn(),
  getReferralLinkOwnerName2: vi.fn(),
  getPostPurchaseRewardSummary: vi.fn(),
  _getReferralLinkForMember: vi.fn(),
  _processReferralOnOrderCreated: vi.fn(),
}));

import {
  post_referralService,
  options_referralService,
} from '../src/backend/http-functions.js';
import {
  getReferralLink,
  getReferralStats,
  getReferralLinkOwnerName,
  redeemReferralCode,
  completeReferral,
  applyCredit,
} from 'backend/referralService.web';

const goodOrigin = 'https://carolina-futons-web.vercel.app';
const makeRequest = (method, body = { args: [] }) => ({
  path: method ? [method] : [],
  body: { json: async () => body },
  headers: { origin: goodOrigin },
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Pure-rename aliases ───────────────────────────────────────────────────────

describe('cf-hpb2 · pure-rename aliases', () => {
  it('routes getMyReferralCode → getReferralLink', async () => {
    vi.mocked(getReferralLink).mockResolvedValue({ success: true, code: 'ABCD1234', link: 'https://…' });
    const res = await post_referralService(makeRequest('getMyReferralCode'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, code: 'ABCD1234', link: 'https://…' });
    expect(vi.mocked(getReferralLink)).toHaveBeenCalledWith();
  });

  it('routes getMyReferralStats → getReferralStats', async () => {
    vi.mocked(getReferralStats).mockResolvedValue({ success: true, stats: { pending: 2, signedUp: 1 } });
    const res = await post_referralService(makeRequest('getMyReferralStats'));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, stats: { pending: 2, signedUp: 1 } });
  });
});

// ── getReferralByCode shape shim (Stilgar Q1: keep PublicReferral thin) ──────

describe('cf-hpb2 · getReferralByCode shape shim', () => {
  it('reshapes {success, referrerName} → {success, referral: {referrerName}}', async () => {
    vi.mocked(getReferralLinkOwnerName).mockResolvedValue({ success: true, referrerName: 'Alice' });
    const res = await post_referralService(makeRequest('getReferralByCode', { args: ['ABCD1234'] }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ success: true, referral: { referrerName: 'Alice' } });
    expect(vi.mocked(getReferralLinkOwnerName)).toHaveBeenCalledWith('ABCD1234');
  });

  it('forwards {success: false} verbatim (no reshape on the failure path)', async () => {
    vi.mocked(getReferralLinkOwnerName).mockResolvedValue({ success: false });
    const res = await post_referralService(makeRequest('getReferralByCode', { args: ['BADCODE'] }));
    // cf-mgnh: {success:false} with NO error string falls through to the
    // business-logic default (null → 200) so cfw branches on body.success
    // without a VeloRpcError throw on a routine "not found" outcome.
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: false });
  });

  it('synthesizes a sensible error envelope when backend returns null/undefined', async () => {
    vi.mocked(getReferralLinkOwnerName).mockResolvedValue(null);
    const res = await post_referralService(makeRequest('getReferralByCode', { args: ['NULLCASE'] }));
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: expect.stringMatching(/not found/i) });
  });
});

// ── claimReferral alias (post Stilgar Q2: identity from currentMember) ───────

describe('cf-hpb2 · claimReferral alias', () => {
  it('routes claimReferral → redeemReferralCode with the code arg only', async () => {
    vi.mocked(redeemReferralCode).mockResolvedValue({ success: true, refereeDiscount: 25 });
    const res = await post_referralService(makeRequest('claimReferral', { args: ['ABCD1234'] }));
    expect(res.status).toBe(200);
    expect(vi.mocked(redeemReferralCode)).toHaveBeenCalledWith('ABCD1234');
  });
});

// ── Allowlist gating (defense — methods NOT exposed to cfw) ───────────────────

describe('cf-hpb2 · allowlist gating', () => {
  it('404 for completeReferral (backend export, but NOT exposed to cfw)', async () => {
    const res = await post_referralService(makeRequest('completeReferral'));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ success: false, error: 'unknown_method', method: 'completeReferral' });
    expect(vi.mocked(completeReferral)).not.toHaveBeenCalled();
  });

  it('404 for applyCredit / getReferralLink (backend names not in cfw alias map)', async () => {
    expect((await post_referralService(makeRequest('applyCredit'))).status).toBe(404);
    expect((await post_referralService(makeRequest('getReferralLink'))).status).toBe(404);
    expect(vi.mocked(applyCredit)).not.toHaveBeenCalled();
  });

  it('404 when path is empty', async () => {
    const res = await post_referralService(makeRequest(null));
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_method');
  });
});

// ── cf-yvs4 contract ──────────────────────────────────────────────────────────

describe('cf-hpb2 · cf-yvs4 contract', () => {
  it('400 invalid_json on body parse failure', async () => {
    const req = {
      path: ['getMyReferralCode'],
      body: { json: async () => { throw new SyntaxError('Bad JSON'); } },
      headers: { origin: goodOrigin },
    };
    const res = await post_referralService(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('invalid_json');
  });

  it('400 args_must_be_array when body lacks args[]', async () => {
    const res = await post_referralService(makeRequest('getMyReferralCode', { foo: 'bar' }));
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toBe('args_must_be_array');
  });

  it('cf-yvs4: maps Authentication required {success:false} to 401', async () => {
    vi.mocked(getReferralLink).mockResolvedValue({ success: false, error: 'Authentication required' });
    const res = await post_referralService(makeRequest('getMyReferralCode'));
    expect(res.status).toBe(401);
  });

  it('cf-yvs4: maps "Invalid or expired" soft-fail to 400', async () => {
    vi.mocked(redeemReferralCode).mockResolvedValue({ success: false, error: 'Invalid or expired referral code' });
    const res = await post_referralService(makeRequest('claimReferral', { args: ['BAD'] }));
    expect(res.status).toBe(400);
  });

  it('cf-mgnh: business-logic outcome ("own referral") falls through to 200', async () => {
    vi.mocked(redeemReferralCode).mockResolvedValue({ success: false, error: 'You cannot use your own referral code' });
    const res = await post_referralService(makeRequest('claimReferral', { args: ['SELF'] }));
    // 'You cannot use your own…' doesn't match any 4xx bucket → null → 200
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ success: false });
  });

  it('500 server_error + errorId on unexpected throw', async () => {
    vi.mocked(getReferralStats).mockRejectedValue(new Error('Wix Data unavailable'));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post_referralService(makeRequest('getMyReferralStats'));
    expect(res.status).toBe(500);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ success: false, error: 'server_error' });
    expect(typeof body.errorId).toBe('string');
    const logged = consoleErr.mock.calls.flat().map(String).join('\n');
    expect(logged).toContain(body.errorId);
    expect(logged).toContain('post_referralService:getMyReferralStats');
    consoleErr.mockRestore();
  });

  it('options preflight responds', () => {
    const res = options_referralService({ headers: { origin: goodOrigin } });
    expect(res).toBeDefined();
    expect(res.status).toBeGreaterThanOrEqual(200);
  });
});
