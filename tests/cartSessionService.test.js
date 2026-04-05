/**
 * @file cartSessionService.test.js
 * @description TDD tests for cartSessionService.web.js — CF-86gj
 *
 * Covers:
 *  - createSession: creates CartSessions record
 *  - getSession: retrieves by sessionToken
 *  - updateCartItems: updates items + updatedAt
 *  - mergeGuestCart: merges guest items into member session
 *  - CartSessions writes on each mutation (for mobile read)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setInsertError,
  __setQueryError,
  __setUpdateError,
} from './__mocks__/wix-data.js';

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import {
  createSession,
  getSession,
  updateCartItems,
  mergeGuestCart,
} from '../src/backend/cartSessionService.web.js';

const COLLECTION = 'CartSessions';

beforeEach(() => __reset());

const TOKEN_A = 'sess-token-aaa';
const TOKEN_B = 'sess-token-bbb';
const MEMBER_1 = 'mem-001';

const ITEMS_A = [
  { productId: 'prod-1', qty: 1, price: 699.00 },
  { productId: 'prod-2', qty: 2, price: 199.00 },
];

const ITEMS_B = [
  { productId: 'prod-3', qty: 1, price: 899.00 },
];

// ── createSession ──────────────────────────────────────────────────

describe('createSession', () => {
  it('inserts a CartSessions record with the correct fields', async () => {
    const result = await createSession(TOKEN_A, { items: ITEMS_A });
    expect(result.success).toBe(true);

    const rows = __getInserted(COLLECTION);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.sessionToken).toBe(TOKEN_A);
    expect(row.items).toEqual(ITEMS_A);
    expect(row.memberId).toBeNull();
    expect(row.source).toBe('web');
  });

  it('stores memberId when provided', async () => {
    await createSession(TOKEN_A, { memberId: MEMBER_1, items: [] });
    expect(__getInserted(COLLECTION)[0].memberId).toBe(MEMBER_1);
  });

  it('sets createdAt and updatedAt as Dates', async () => {
    await createSession(TOKEN_A, { items: [] });
    const row = __getInserted(COLLECTION)[0];
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it('uses sessionToken as _id for idempotent dedup', async () => {
    await createSession(TOKEN_A, { items: [] });
    expect(__getInserted(COLLECTION)[0]._id).toBe(TOKEN_A);
  });

  it('returns { success: false } when sessionToken is missing', async () => {
    const result = await createSession('', { items: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns { success: false } when sessionToken is null', async () => {
    const result = await createSession(null, { items: [] });
    expect(result.success).toBe(false);
  });

  it('defaults items to empty array when not provided', async () => {
    await createSession(TOKEN_A, {});
    expect(__getInserted(COLLECTION)[0].items).toEqual([]);
  });

  it('returns { success: false } on DB insert error', async () => {
    __setInsertError(COLLECTION, new Error('db error'));
    const result = await createSession(TOKEN_A, { items: [] });
    expect(result.success).toBe(false);
  });
});

// ── getSession ─────────────────────────────────────────────────────

describe('getSession', () => {
  it('retrieves a session by sessionToken', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);

    const result = await getSession(TOKEN_A);
    expect(result.success).toBe(true);
    expect(result.session.sessionToken).toBe(TOKEN_A);
    expect(result.session.items).toEqual(ITEMS_A);
  });

  it('returns { success: true, session: null } when token not found', async () => {
    const result = await getSession('nonexistent-token');
    expect(result.success).toBe(true);
    expect(result.session).toBeNull();
  });

  it('returns { success: false } on DB error', async () => {
    __setQueryError(COLLECTION, new Error('db down'));
    const result = await getSession(TOKEN_A);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when sessionToken is missing', async () => {
    const result = await getSession('');
    expect(result.success).toBe(false);
  });
});

// ── updateCartItems ────────────────────────────────────────────────

describe('updateCartItems', () => {
  beforeEach(() => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);
  });

  it('updates the items array for an existing session', async () => {
    const result = await updateCartItems(TOKEN_A, ITEMS_B);
    expect(result.success).toBe(true);

    const updated = __getUpdated(COLLECTION);
    expect(updated).toHaveLength(1);
    expect(updated[0].items).toEqual(ITEMS_B);
  });

  it('updates the updatedAt timestamp', async () => {
    const before = new Date();
    await updateCartItems(TOKEN_A, ITEMS_B);
    const updated = __getUpdated(COLLECTION)[0];
    expect(updated.updatedAt).toBeInstanceOf(Date);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('returns { success: false, error: "not_found" } when session not found', async () => {
    const result = await updateCartItems('ghost-token', ITEMS_B);
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns { success: false } when sessionToken is missing', async () => {
    const result = await updateCartItems('', ITEMS_B);
    expect(result.success).toBe(false);
  });

  it('accepts empty items array (cart cleared)', async () => {
    const result = await updateCartItems(TOKEN_A, []);
    expect(result.success).toBe(true);
    expect(__getUpdated(COLLECTION)[0].items).toEqual([]);
  });

  it('returns { success: false } on DB update error', async () => {
    __setUpdateError(COLLECTION, new Error('update failed'));
    const result = await updateCartItems(TOKEN_A, ITEMS_B);
    expect(result.success).toBe(false);
  });

  it('defaults to empty array when items argument is not an array', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);
    // Covers the FALSE branch of `Array.isArray(items) ? items : []`
    const result = await updateCartItems(TOKEN_A, undefined);
    expect(result.success).toBe(true);
    expect(__getUpdated(COLLECTION)[0].items).toEqual([]);
  });
});

// ── mergeGuestCart ─────────────────────────────────────────────────

describe('mergeGuestCart', () => {
  it('copies guest items to a new member session when member has no existing session', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);

    const result = await mergeGuestCart(TOKEN_A, MEMBER_1);
    expect(result.success).toBe(true);
    expect(result.merged).toBe(true);

    // A new record should be inserted for the member
    const rows = __getInserted(COLLECTION);
    const memberRow = rows.find(r => r.memberId === MEMBER_1);
    expect(memberRow).toBeDefined();
    expect(memberRow.items).toEqual(ITEMS_A);
  });

  it('merges guest items into an existing member session (dedup by productId)', async () => {
    const memberToken = 'member-token-xyz';
    __seed(COLLECTION, [
      // Guest session has prod-1 qty:2 and prod-2
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: [
        { productId: 'prod-1', qty: 2, price: 699.00 },
        { productId: 'prod-2', qty: 1, price: 199.00 },
      ], createdAt: new Date(), updatedAt: new Date(), source: 'web' },
      // Member already has prod-1 qty:1
      { _id: memberToken, sessionToken: memberToken, memberId: MEMBER_1, items: [
        { productId: 'prod-1', qty: 1, price: 699.00 },
      ], createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);

    const result = await mergeGuestCart(TOKEN_A, MEMBER_1);
    expect(result.success).toBe(true);

    const updated = __getUpdated(COLLECTION);
    expect(updated).toHaveLength(1);
    const mergedItems = updated[0].items;

    // prod-1 qty should be summed: 1 (member) + 2 (guest) = 3
    const prod1 = mergedItems.find(i => i.productId === 'prod-1');
    expect(prod1.qty).toBe(3);

    // prod-2 should be added
    const prod2 = mergedItems.find(i => i.productId === 'prod-2');
    expect(prod2).toBeDefined();
    expect(prod2.qty).toBe(1);
  });

  it('returns { success: true, merged: false } when guest session has no items', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: [], createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);

    const result = await mergeGuestCart(TOKEN_A, MEMBER_1);
    expect(result.success).toBe(true);
    expect(result.merged).toBe(false);
  });

  it('returns { success: false, error: "not_found" } when guest session not found', async () => {
    const result = await mergeGuestCart('no-such-token', MEMBER_1);
    expect(result.success).toBe(false);
    expect(result.error).toBe('not_found');
  });

  it('returns { success: false } when guestSessionToken is missing', async () => {
    const result = await mergeGuestCart('', MEMBER_1);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when memberId is missing', async () => {
    const result = await mergeGuestCart(TOKEN_A, '');
    expect(result.success).toBe(false);
  });

  it('assigns the memberId to the merged session record', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);

    await mergeGuestCart(TOKEN_A, MEMBER_1);

    const rows = __getInserted(COLLECTION);
    const memberRow = rows.find(r => r.memberId === MEMBER_1);
    expect(memberRow.memberId).toBe(MEMBER_1);
  });

  it('handles null items on member session (memberSession.items || [] fallback)', async () => {
    const memberToken = 'member-token-nullitems';
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_B, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
      { _id: memberToken, sessionToken: memberToken, memberId: MEMBER_1, items: null, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);
    // mergeItems(null || [], ITEMS_B) — exercises the `memberSession.items || []` branch
    const result = await mergeGuestCart(TOKEN_A, MEMBER_1);
    expect(result.success).toBe(true);
    expect(result.merged).toBe(true);
    const updated = __getUpdated(COLLECTION);
    expect(updated[0].items).toEqual(expect.arrayContaining([expect.objectContaining({ productId: 'prod-3' })]));
  });

  it('returns { success: false } on DB error during merge', async () => {
    __seed(COLLECTION, [
      { _id: TOKEN_A, sessionToken: TOKEN_A, memberId: null, items: ITEMS_A, createdAt: new Date(), updatedAt: new Date(), source: 'web' },
    ]);
    __setInsertError(COLLECTION, new Error('insert failed'));
    const result = await mergeGuestCart(TOKEN_A, MEMBER_1);
    expect(result.success).toBe(false);
  });
});

// ── eventBus utilities (branch coverage) ──────────────────────────

import {
  validateIncomingEvent,
  logEventTrace,
  BUS_SCHEMA_VERSION,
} from '../src/backend/utils/eventBus.js';

describe('validateIncomingEvent', () => {
  it('returns null for a valid event', () => {
    const result = validateIncomingEvent({
      eventId: 'evt-1', schemaVersion: BUS_SCHEMA_VERSION, event: 'streak_extended',
    });
    expect(result).toBeNull();
  });

  it('returns error when eventId is missing', () => {
    expect(validateIncomingEvent({ schemaVersion: BUS_SCHEMA_VERSION, event: 'badge_earned' })).toMatch(/eventId/);
  });

  it('returns error when schemaVersion is missing', () => {
    expect(validateIncomingEvent({ eventId: 'e1', event: 'badge_earned' })).toMatch(/schemaVersion/);
  });

  it('returns error when schemaVersion does not match', () => {
    expect(validateIncomingEvent({ eventId: 'e1', schemaVersion: '99.0', event: 'badge_earned' })).toMatch(/schemaVersion/);
  });

  it('returns error when event is missing', () => {
    expect(validateIncomingEvent({ eventId: 'e1', schemaVersion: BUS_SCHEMA_VERSION })).toMatch(/event/);
  });

  it('returns error for an unknown event name', () => {
    expect(validateIncomingEvent({ eventId: 'e1', schemaVersion: BUS_SCHEMA_VERSION, event: 'unknown_event' })).toMatch(/Unknown event/);
  });
});

describe('logEventTrace', () => {
  const TRACE_COLLECTION = 'EventTraceLog';

  it('inserts a new trace when eventId is not yet recorded', async () => {
    __seed(TRACE_COLLECTION, []);
    await logEventTrace({ eventId: 'evt-new', traceId: 'tr-1', event: 'streak_extended', userId: 'u1', source: 'mobile', ts: 12345, status: 'ok' });
    const inserted = __getInserted(TRACE_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].eventId).toBe('evt-new');
  });

  it('skips insert when eventId already recorded (idempotency)', async () => {
    __seed(TRACE_COLLECTION, [{ _id: 'evt-dup', eventId: 'evt-dup' }]);
    await logEventTrace({ eventId: 'evt-dup', traceId: 'tr-2', event: 'badge_earned', userId: 'u2', source: 'web', ts: 0, status: 'ok' });
    // Store should still have exactly 1 item (the seeded one — no new insert happened)
    expect(__getInserted(TRACE_COLLECTION)).toHaveLength(1);
  });

  it('defaults userId to null when not provided', async () => {
    __seed(TRACE_COLLECTION, []);
    await logEventTrace({ eventId: 'evt-no-user', traceId: 'tr-3', event: 'tier_changed', source: 'web', ts: 0, status: 'ok' });
    expect(__getInserted(TRACE_COLLECTION)[0].userId).toBeNull();
  });

  it('defaults source to null when not provided', async () => {
    __seed(TRACE_COLLECTION, []);
    await logEventTrace({ eventId: 'evt-no-src', traceId: 'tr-4', event: 'tier_changed', userId: 'u4', ts: 0, status: 'ok' });
    expect(__getInserted(TRACE_COLLECTION)[0].source).toBeNull();
  });

  it('uses provided ts when present', async () => {
    __seed(TRACE_COLLECTION, []);
    await logEventTrace({ eventId: 'evt-ts', traceId: 'tr-5', event: 'badge_earned', userId: 'u5', source: 'web', ts: 9999, status: 'ok' });
    expect(__getInserted(TRACE_COLLECTION)[0].ts).toBe(9999);
  });

  it('falls back to current time when ts is falsy', async () => {
    __seed(TRACE_COLLECTION, []);
    const before = Math.floor(Date.now() / 1000);
    await logEventTrace({ eventId: 'evt-no-ts', traceId: 'tr-6', event: 'badge_earned', userId: 'u6', source: 'web', ts: 0, status: 'ok' });
    const after = Math.floor(Date.now() / 1000) + 1;
    const ts = __getInserted(TRACE_COLLECTION)[0].ts;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});
