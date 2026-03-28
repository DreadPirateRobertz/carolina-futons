/**
 * Tests for CF-2zr3: guestCheckout.web.js
 *
 * Covers:
 * - saveGuestSession: success, update existing, validation (missing fields, bad email)
 * - linkGuestOrdersToMember: links pending records, skips expired, returns count
 * - getGuestOrdersByEmail: returns orders, empty case, bad email
 * - getSoftPromptConfig: returns required fields
 * - SESSION_TTL_MS constant
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __getInserted, __getUpdated } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  saveGuestSession,
  linkGuestOrdersToMember,
  getGuestOrdersByEmail,
  getSoftPromptConfig,
  _SESSION_TTL_MS,
} from '../src/backend/guestCheckout.web.js';

beforeEach(() => {
  __seed('GuestOrders', []);
  __setMember(null);
});

// ── saveGuestSession ───────────────────────────────────────────────

describe('saveGuestSession', () => {
  it('saves a new guest session and returns _id', async () => {
    const result = await saveGuestSession({
      sessionId: 'sess-001',
      email: 'alice@example.com',
      firstName: 'Alice',
    });
    expect(result.success).toBe(true);
    expect(result._id).toBeTruthy();
  });

  it('stores sanitized and lowercased email', async () => {
    await saveGuestSession({ sessionId: 'sess-002', email: 'Bob@Example.COM' });
    const items = __getInserted('GuestOrders');
    const saved = items.find(i => i.sessionId === 'sess-002');
    expect(saved?.email).toBe('bob@example.com');
  });

  it('updates an existing session with same sessionId', async () => {
    await saveGuestSession({ sessionId: 'sess-same', email: 'first@example.com' });
    const result = await saveGuestSession({ sessionId: 'sess-same', email: 'second@example.com', orderId: 'order-001' });
    expect(result.success).toBe(true);
    // The second call should update not insert
    const updated = __getUpdated('GuestOrders').find(i => i.orderId === 'order-001');
    expect(updated).toBeTruthy();
  });

  it('preserves original createdAt on upsert update', async () => {
    const originalDate = new Date(Date.now() - 5000);
    __seed('GuestOrders', [
      { _id: 'go-orig', sessionId: 'sess-preserve', email: 'x@y.com', createdAt: originalDate, status: 'pending' },
    ]);
    await saveGuestSession({ sessionId: 'sess-preserve', email: 'x@y.com', orderId: 'order-new' });
    const updated = __getUpdated('GuestOrders').find(i => i.sessionId === 'sess-preserve');
    expect(updated).toBeTruthy();
    expect(updated.createdAt).toBe(originalDate);
  });

  it('returns error for empty sessionId', async () => {
    const result = await saveGuestSession({ sessionId: '', email: 'a@b.com' });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for empty email', async () => {
    const result = await saveGuestSession({ sessionId: 'sess-003', email: '' });
    expect(result.success).toBe(false);
  });

  it('returns error for invalid email (no @)', async () => {
    const result = await saveGuestSession({ sessionId: 'sess-004', email: 'notanemail' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email');
  });

  it('returns error for invalid email (@ only, no domain)', async () => {
    const result = await saveGuestSession({ sessionId: 'sess-004b', email: 'user@' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email');
  });

  it('returns error for invalid email (no TLD dot)', async () => {
    const result = await saveGuestSession({ sessionId: 'sess-004c', email: 'user@nodot' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid email');
  });

  it('defaults orderTotal to 0 when not provided', async () => {
    await saveGuestSession({ sessionId: 'sess-005', email: 'x@y.com' });
    const items = __getInserted('GuestOrders');
    const saved = items.find(i => i.sessionId === 'sess-005');
    expect(saved?.orderTotal).toBe(0);
  });

  it('saves provided orderTotal', async () => {
    await saveGuestSession({ sessionId: 'sess-006', email: 'x@y.com', orderTotal: 349.99 });
    const items = __getInserted('GuestOrders');
    const saved = items.find(i => i.sessionId === 'sess-006');
    expect(saved?.orderTotal).toBe(349.99);
  });

  it('sets status to pending', async () => {
    await saveGuestSession({ sessionId: 'sess-007', email: 'x@y.com' });
    const items = __getInserted('GuestOrders');
    const saved = items.find(i => i.sessionId === 'sess-007');
    expect(saved?.status).toBe('pending');
  });

  it('returns error when missing params entirely', async () => {
    const result = await saveGuestSession({});
    expect(result.success).toBe(false);
  });
});

// ── linkGuestOrdersToMember ────────────────────────────────────────

describe('linkGuestOrdersToMember', () => {
  it('links pending guest orders to authenticated member', async () => {
    __setMember({ _id: 'mem-001' });
    __seed('GuestOrders', [
      { _id: 'go-1', email: 'alice@example.com', status: 'pending', createdAt: new Date() },
      { _id: 'go-2', email: 'alice@example.com', status: 'pending', createdAt: new Date() },
    ]);

    const result = await linkGuestOrdersToMember('alice@example.com');
    expect(result.success).toBe(true);
    expect(result.linkedCount).toBe(2);
  });

  it('does not link already-linked orders', async () => {
    __setMember({ _id: 'mem-002' });
    __seed('GuestOrders', [
      { _id: 'go-3', email: 'bob@example.com', status: 'linked', linkedMemberId: 'mem-old', createdAt: new Date() },
    ]);

    const result = await linkGuestOrdersToMember('bob@example.com');
    expect(result.success).toBe(true);
    expect(result.linkedCount).toBe(0);
  });

  it('does not link expired orders (older than TTL)', async () => {
    __setMember({ _id: 'mem-003' });
    const expired = new Date(Date.now() - _SESSION_TTL_MS - 1000);
    __seed('GuestOrders', [
      { _id: 'go-4', email: 'carol@example.com', status: 'pending', createdAt: expired },
    ]);

    const result = await linkGuestOrdersToMember('carol@example.com');
    expect(result.success).toBe(true);
    expect(result.linkedCount).toBe(0);
  });

  it('returns success: false for empty email', async () => {
    __setMember({ _id: 'mem-004' });
    const result = await linkGuestOrdersToMember('');
    expect(result.success).toBe(false);
    expect(result.linkedCount).toBe(0);
  });

  it('returns success: false when no authenticated member', async () => {
    __setMember(null);
    const result = await linkGuestOrdersToMember('x@y.com');
    expect(result.success).toBe(false);
  });

  it('returns linkedCount: 0 when no matching orders', async () => {
    __setMember({ _id: 'mem-006' });
    const result = await linkGuestOrdersToMember('nobody@example.com');
    expect(result.success).toBe(true);
    expect(result.linkedCount).toBe(0);
  });
});

// ── getGuestOrdersByEmail ──────────────────────────────────────────

describe('getGuestOrdersByEmail', () => {
  it('returns orders for authenticated member with matching email', async () => {
    __setMember({ _id: 'mem-d1', loginEmail: 'diana@example.com' });
    __seed('GuestOrders', [
      { _id: 'go-10', email: 'diana@example.com', orderId: 'order-A', orderTotal: 199, status: 'pending', createdAt: new Date() },
    ]);

    const result = await getGuestOrdersByEmail('diana@example.com');
    expect(result.success).toBe(true);
    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders[0].orderId).toBe('order-A');
  });

  it('returns empty orders for unknown email (own email, no records)', async () => {
    __setMember({ _id: 'mem-u1', loginEmail: 'unknown@example.com' });
    const result = await getGuestOrdersByEmail('unknown@example.com');
    expect(result.success).toBe(true);
    expect(result.orders).toHaveLength(0);
  });

  it('returns success: false for empty email', async () => {
    __setMember({ _id: 'mem-e1', loginEmail: 'x@y.com' });
    const result = await getGuestOrdersByEmail('');
    expect(result.success).toBe(false);
    expect(result.orders).toHaveLength(0);
  });

  it('rejects IDOR — member cannot read another member\'s orders', async () => {
    __setMember({ _id: 'mem-attacker', loginEmail: 'attacker@example.com' });
    __seed('GuestOrders', [
      { _id: 'go-victim', email: 'victim@example.com', orderId: 'order-V', orderTotal: 99, status: 'pending', createdAt: new Date() },
    ]);
    const result = await getGuestOrdersByEmail('victim@example.com');
    expect(result.success).toBe(false);
    expect(result.orders).toHaveLength(0);
  });

  it('returned orders have expected shape', async () => {
    __setMember({ _id: 'mem-e2', loginEmail: 'eve@example.com' });
    __seed('GuestOrders', [
      { _id: 'go-11', email: 'eve@example.com', orderId: 'order-B', orderTotal: 299, status: 'pending', createdAt: new Date() },
    ]);

    const result = await getGuestOrdersByEmail('eve@example.com');
    const order = result.orders[0];
    expect(order).toHaveProperty('_id');
    expect(order).toHaveProperty('orderId');
    expect(order).toHaveProperty('orderTotal');
    expect(order).toHaveProperty('status');
    expect(order).toHaveProperty('createdAt');
    // memberId should NOT be in response (not exposed)
    expect(order).not.toHaveProperty('linkedMemberId');
  });
});

// ── getSoftPromptConfig ────────────────────────────────────────────

describe('getSoftPromptConfig', () => {
  it('returns title, description, ctaLabel, skipLabel', () => {
    const config = getSoftPromptConfig();
    expect(config).toHaveProperty('title');
    expect(config).toHaveProperty('description');
    expect(config).toHaveProperty('ctaLabel');
    expect(config).toHaveProperty('skipLabel');
  });

  it('title and description are non-empty strings', () => {
    const config = getSoftPromptConfig();
    expect(typeof config.title).toBe('string');
    expect(config.title.length).toBeGreaterThan(0);
    expect(config.description.length).toBeGreaterThan(0);
  });

  it('ctaLabel and skipLabel are non-empty strings', () => {
    const config = getSoftPromptConfig();
    expect(config.ctaLabel.length).toBeGreaterThan(0);
    expect(config.skipLabel.length).toBeGreaterThan(0);
  });
});

// ── Constants ──────────────────────────────────────────────────────

describe('SESSION_TTL_MS', () => {
  it('is 90 days in milliseconds', () => {
    expect(_SESSION_TTL_MS).toBe(90 * 24 * 60 * 60 * 1000);
  });
});
