import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  PUSH_TOKENS_COLLECTION,
  registerToken,
  deactivateToken,
  getActiveTokensForMember,
} from '../src/backend/pushTokenRegistry.web.js';

const MEMBER_ID = 'member-push-1';
function setMember() { __setMember({ _id: MEMBER_ID }); }

beforeEach(() => { __reset(); resetMember(); });

// ── PUSH_TOKENS_COLLECTION ────────────────────────────────────────────────────

describe('PUSH_TOKENS_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof PUSH_TOKENS_COLLECTION).toBe('string');
    expect(PUSH_TOKENS_COLLECTION.length).toBeGreaterThan(0);
  });

  it('equals PushTokens', () => {
    expect(PUSH_TOKENS_COLLECTION).toBe('PushTokens');
  });
});

// ── registerToken ─────────────────────────────────────────────────────────────

describe('registerToken', () => {
  it('returns success: true on insert', async () => {
    setMember();
    const result = await registerToken(MEMBER_ID, 'tok-abc', 'ios');
    expect(result.success).toBe(true);
  });

  it('rejects invalid platform', async () => {
    setMember();
    const result = await registerToken(MEMBER_ID, 'tok-abc', 'fax');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/platform/i);
  });

  it('rejects empty token', async () => {
    setMember();
    const result = await registerToken(MEMBER_ID, '', 'android');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('rejects missing token (undefined)', async () => {
    setMember();
    const result = await registerToken(MEMBER_ID, undefined, 'ios');
    expect(result.success).toBe(false);
  });

  it('accepts all valid platforms: ios, android, web', async () => {
    setMember();
    for (const platform of ['ios', 'android', 'web']) {
      const result = await registerToken(MEMBER_ID, `tok-${platform}`, platform);
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing memberId', async () => {
    const result = await registerToken('', 'tok-abc', 'ios');
    expect(result.success).toBe(false);
  });

  it('inserts with active: true', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, []);
    await registerToken(MEMBER_ID, 'tok-xyz', 'android');
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].active).toBe(true);
    expect(tokens[0].token).toBe('tok-xyz');
  });
});

// ── getActiveTokensForMember ──────────────────────────────────────────────────

describe('getActiveTokensForMember', () => {
  it('returns empty array when no tokens', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, []);
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toEqual([]);
  });

  it('returns only active tokens for the member', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-1', platform: 'ios', active: true },
      { _id: 't2', memberId: MEMBER_ID, token: 'tok-2', platform: 'android', active: false },
      { _id: 't3', memberId: 'other', token: 'tok-3', platform: 'ios', active: true },
    ]);
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].token).toBe('tok-1');
  });

  it('returns multiple active tokens when member has several devices', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-ios', platform: 'ios', active: true },
      { _id: 't2', memberId: MEMBER_ID, token: 'tok-android', platform: 'android', active: true },
    ]);
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toHaveLength(2);
  });

  it('does not return another member\'s active tokens', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: 'other-member', token: 'tok-1', platform: 'ios', active: true },
    ]);
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toEqual([]);
  });
});

// ── deactivateToken ───────────────────────────────────────────────────────────

describe('deactivateToken', () => {
  it('sets active: false on matching token', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-1', platform: 'ios', active: true },
    ]);
    const result = await deactivateToken(MEMBER_ID, 'tok-1');
    expect(result.success).toBe(true);
  });

  it('returns success: false when token not found', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, []);
    const result = await deactivateToken(MEMBER_ID, 'tok-nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('token no longer returned by getActiveTokensForMember after deactivation', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: MEMBER_ID, token: 'tok-1', platform: 'ios', active: true },
    ]);
    await deactivateToken(MEMBER_ID, 'tok-1');
    const tokens = await getActiveTokensForMember(MEMBER_ID);
    expect(tokens).toEqual([]);
  });

  it('does not deactivate another member\'s token with same token value', async () => {
    setMember();
    __seed(PUSH_TOKENS_COLLECTION, [
      { _id: 't1', memberId: 'other-member', token: 'shared-tok', platform: 'ios', active: true },
    ]);
    const result = await deactivateToken(MEMBER_ID, 'shared-tok');
    expect(result.success).toBe(false);
  });
});
