/**
 * @file wishlistShareToken.test.js
 * @description TDD tests for addShareToken webMethod (CF-pvxf S4)
 *
 * addShareToken: SiteMember webMethod that generates a URL-safe share token,
 * stores it in WishlistShareTokens CMS with 30-day default expiry, and returns
 * { token, shareUrl, expiresAt } for the member to copy to clipboard.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { addShareToken } from '../src/backend/wishlistShare.web.js';
import {
  __seed,
  __reset,
  __onInsert,
  __getInserted,
} from './__mocks__/wix-data.js';
import {
  __setMember,
  __reset as resetMembers,
} from './__mocks__/wix-members-backend.js';

// ── Fixtures ────────────────────────────────────────────────────────

const MEMBER = { _id: 'mem-123', loginEmail: 'alice@example.com', profile: { nickname: 'Alice' } };

const BASE_URL = 'https://www.carolinafutons.com';
const SHARE_PATH = '/wishlist-share';

// ── Helpers ─────────────────────────────────────────────────────────

function isUrlSafeToken(token) {
  return typeof token === 'string' && /^[a-z0-9_-]+$/i.test(token) && token.length >= 16;
}

// ═══════════════════════════════════════════════════════════════════
// addShareToken — basic functionality
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — happy path', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
    __setMember(MEMBER);
  });

  it('returns token, shareUrl, and expiresAt on success', async () => {
    const result = await addShareToken();
    expect(result.token).toBeTruthy();
    expect(result.shareUrl).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it('token is URL-safe (alphanumeric, dash, underscore only)', async () => {
    const result = await addShareToken();
    expect(isUrlSafeToken(result.token)).toBe(true);
  });

  it('token has no base64 padding (no = chars)', async () => {
    const result = await addShareToken();
    expect(result.token).not.toContain('=');
  });

  it('token has no + or / chars', async () => {
    const result = await addShareToken();
    expect(result.token).not.toContain('+');
    expect(result.token).not.toContain('/');
  });

  it('shareUrl includes the token as ?share= param', async () => {
    const result = await addShareToken();
    expect(result.shareUrl).toContain(`?share=${result.token}`);
  });

  it('shareUrl uses carolinafutons.com base', async () => {
    const result = await addShareToken();
    expect(result.shareUrl.startsWith(BASE_URL)).toBe(true);
  });

  it('shareUrl includes /shared-wishlist path', async () => {
    const result = await addShareToken();
    expect(result.shareUrl).toContain(SHARE_PATH);
  });

  it('default expiry is 30 days from now', async () => {
    const before = Date.now();
    const result = await addShareToken();
    const after = Date.now();

    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    const actualMs = result.expiresAt.getTime() - before;

    expect(actualMs).toBeGreaterThanOrEqual(expectedMs - 1000); // allow 1s drift
    expect(actualMs).toBeLessThanOrEqual(expectedMs + (after - before) + 1000);
  });

  it('stores record in WishlistShareTokens collection', async () => {
    await addShareToken();
    const records = __getInserted('WishlistShareTokens');
    expect(records).toHaveLength(1);
  });

  it('stored record has token, memberId, expiresAt, createdAt', async () => {
    const result = await addShareToken();
    const records = __getInserted('WishlistShareTokens');
    const record = records[0];
    expect(record.token).toBe(result.token);
    expect(record.memberId).toBe(MEMBER._id);
    expect(record.expiresAt).toBeInstanceOf(Date);
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it('stored record includes memberName from profile nickname', async () => {
    await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.memberName).toBe('Alice'); // MEMBER.profile.nickname
  });

  it('stored token matches returned token', async () => {
    const result = await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.token).toBe(result.token);
  });

  it('createdAt is approximately now', async () => {
    const before = Date.now();
    await addShareToken();
    const after = Date.now();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(record.createdAt.getTime()).toBeLessThanOrEqual(after + 100);
  });
});

// ═══════════════════════════════════════════════════════════════════
// addShareToken — custom expiryDays
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — custom expiryDays', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
    __setMember(MEMBER);
  });

  it('accepts expiryDays: 7 for a 7-day token', async () => {
    const before = Date.now();
    const result = await addShareToken({ expiryDays: 7 });
    const expectedMs = 7 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(result.expiresAt.getTime() - before).toBeLessThan(expectedMs + 5000);
  });

  it('accepts expiryDays: 365 for a 1-year token', async () => {
    const before = Date.now();
    const result = await addShareToken({ expiryDays: 365 });
    const expectedMs = 365 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 1000);
    expect(result.expiresAt.getTime() - before).toBeLessThan(expectedMs + 5000);
  });

  it('clamps expiryDays to minimum 1', async () => {
    const result = await addShareToken({ expiryDays: 0 });
    expect(result.token).toBeTruthy();
    const expectedMs = 1 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThan(0);
    expect(result.expiresAt.getTime() - Date.now()).toBeLessThan(expectedMs + 5000);
  });

  it('clamps expiryDays to maximum 365', async () => {
    const result = await addShareToken({ expiryDays: 9999 });
    const maxMs = 365 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(maxMs + 5000);
  });

  it('handles negative expiryDays by clamping to 1', async () => {
    const result = await addShareToken({ expiryDays: -10 });
    expect(result.token).toBeTruthy();
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('handles NaN expiryDays by using default 30', async () => {
    const before = Date.now();
    const result = await addShareToken({ expiryDays: NaN });
    const expectedMs = 30 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - before).toBeGreaterThanOrEqual(expectedMs - 1000);
  });

  it('handles string expiryDays by coercing to number', async () => {
    const result = await addShareToken({ expiryDays: '14' });
    const expectedMs = 14 * 24 * 60 * 60 * 1000;
    expect(result.expiresAt.getTime() - Date.now()).toBeGreaterThanOrEqual(expectedMs - 1000);
  });
});

// ═══════════════════════════════════════════════════════════════════
// addShareToken — authentication
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — authentication', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
  });

  it('returns error when member is not authenticated', async () => {
    // No member set — getMember() returns null
    const result = await addShareToken();
    expect(result.error).toBeTruthy();
    expect(result.token).toBeUndefined();
  });

  it('returns error when member has no _id', async () => {
    __setMember({ loginEmail: 'anon@example.com' }); // no _id
    const result = await addShareToken();
    expect(result.error).toBeTruthy();
  });

  it('does not insert a record when unauthenticated', async () => {
    await addShareToken();
    const records = __getInserted('WishlistShareTokens');
    expect(records).toHaveLength(0);
  });

  it('succeeds after member is set', async () => {
    __setMember(MEMBER);
    const result = await addShareToken();
    expect(result.token).toBeTruthy();
    expect(result.error).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// addShareToken — token uniqueness
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — token uniqueness', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
    __setMember(MEMBER);
  });

  it('generates different tokens on each call', async () => {
    const r1 = await addShareToken();
    const r2 = await addShareToken();
    expect(r1.token).not.toBe(r2.token);
  });

  it('generates distinct shareUrls on each call', async () => {
    const r1 = await addShareToken();
    const r2 = await addShareToken();
    expect(r1.shareUrl).not.toBe(r2.shareUrl);
  });

  it('multiple calls store multiple records', async () => {
    await addShareToken();
    await addShareToken();
    const records = __getInserted('WishlistShareTokens');
    expect(records).toHaveLength(2);
    expect(records[0].token).not.toBe(records[1].token);
  });
});

// ═══════════════════════════════════════════════════════════════════
// addShareToken — error resilience
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — error resilience', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
    __setMember(MEMBER);
  });

  it('returns graceful error when DB insert fails', async () => {
    // Override insert to throw
    const wixData = (await import('./__mocks__/wix-data.js'));
    const realInsert = wixData.default.insert;
    wixData.default.insert = async () => { throw new Error('DB unavailable'); };

    const result = await addShareToken();
    expect(result.error).toBeTruthy();
    expect(result.token).toBeUndefined();

    wixData.default.insert = realInsert;
  });

  it('returns auth_failed when getMember throws', async () => {
    const membersMod = await import('./__mocks__/wix-members-backend.js');
    const realGetMember = membersMod.currentMember.getMember;
    membersMod.currentMember.getMember = async () => { throw new Error('auth error'); };

    const result = await addShareToken();
    expect(result.error).toBe('auth_failed');
    expect(result.token).toBeUndefined();

    membersMod.currentMember.getMember = realGetMember;
  });
});

// ═══════════════════════════════════════════════════════════════════
// addShareToken — memberName fallback logic
// ═══════════════════════════════════════════════════════════════════
describe('addShareToken — memberName fallbacks', () => {
  beforeEach(() => {
    __reset();
    resetMembers();
  });

  it('uses profile.nickname as memberName when available', async () => {
    __setMember({ _id: 'mem-1', profile: { nickname: 'Alice' }, loginEmail: 'alice@example.com' });
    await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.memberName).toBe('Alice');
  });

  it('falls back to contactDetails.firstName when no nickname', async () => {
    __setMember({ _id: 'mem-2', profile: {}, contactDetails: { firstName: 'Bob' }, loginEmail: 'bob@example.com' });
    await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.memberName).toBe('Bob');
  });

  it('falls back to loginEmail when no nickname or firstName', async () => {
    __setMember({ _id: 'mem-3', profile: {}, contactDetails: {}, loginEmail: 'carol@example.com' });
    await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.memberName).toBe('carol@example.com');
  });

  it('stores empty string when no name data is available', async () => {
    __setMember({ _id: 'mem-4' });
    await addShareToken();
    const record = __getInserted('WishlistShareTokens')[0];
    expect(record.memberName).toBe('');
  });
});
