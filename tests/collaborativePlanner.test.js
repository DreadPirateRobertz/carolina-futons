/**
 * @file collaborativePlanner.test.js
 * @description Tests for the collaborative room planner module (cf-8dbd).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { withRateLimit } from './helpers/withRateLimit.js';
import {
  createSession,
  joinSession,
  getSessionState,
  placeItem,
  moveItem,
  removeItem,
  getSessionCart,
} from '../src/backend/collaborativePlanner.web.js';

beforeEach(() => {
  __reset();
});

// ── Session Creation ────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with share token', async () => {
    const result = await createSession({
      roomName: 'Living Room',
      roomWidth: 14,
      roomLength: 18,
      creatorName: 'Sarah',
    });

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeTruthy();
    expect(result.shareToken).toBeTruthy();
    expect(result.shareToken).toHaveLength(8);

    const inserted = __getInserted('PlannerSessions');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].roomName).toBe('Living Room');
    expect(inserted[0].status).toBe('active');
    expect(inserted[0].participantCount).toBe(1);
    expect(inserted[0].participants[0].role).toBe('host');
  });

  it('defaults room to 12x15', async () => {
    const result = await createSession({ roomName: 'Test' });
    expect(result.success).toBe(true);

    const inserted = __getInserted('PlannerSessions');
    expect(inserted[0].roomWidth).toBe(12);
    expect(inserted[0].roomLength).toBe(15);
  });

  it('clamps room dimensions to 6-50', async () => {
    await createSession({ roomName: 'Tiny', roomWidth: 2, roomLength: 100 });
    const inserted = __getInserted('PlannerSessions');
    expect(inserted[0].roomWidth).toBe(6);
    expect(inserted[0].roomLength).toBe(50);
  });

  it('sets 72-hour expiry', async () => {
    await createSession({ roomName: 'Test' });
    const inserted = __getInserted('PlannerSessions');
    const expiresAt = new Date(inserted[0].expiresAt);
    const hoursFromNow = (expiresAt - Date.now()) / (60 * 60 * 1000);
    expect(hoursFromNow).toBeCloseTo(72, 0);
  });
});

// ── Join Session ────────────────────────────────────────────────────

describe('joinSession', () => {
  it('joins via share token', async () => {
    __seed('PlannerSessions', [{
      _id: 'sess-1',
      shareToken: 'abc12345',
      status: 'active',
      participants: [{ name: 'Sarah', role: 'host' }],
      participantCount: 1,
    }]);

    const result = await joinSession('abc12345', 'Tom');
    expect(result.success).toBe(true);
    expect(result.session.participantCount).toBe(2);
  });

  it('rejects invalid token', async () => {
    __seed('PlannerSessions', []);
    const result = await joinSession('nonexistent');
    expect(result.success).toBe(false);
  });

  it('rejects full session (max 4)', async () => {
    __seed('PlannerSessions', [{
      _id: 'sess-1',
      shareToken: 'full1234',
      status: 'active',
      participants: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
      participantCount: 4,
    }]);

    const result = await joinSession('full1234', 'Fifth');
    expect(result.success).toBe(false);
    expect(result.error).toContain('full');
  });

  it('rejects empty token', async () => {
    const result = await joinSession('');
    expect(result.success).toBe(false);
  });
});

// ── Session State ───────────────────────────────────────────────────

describe('getSessionState', () => {
  it('returns session with placed items', async () => {
    __seed('PlannerSessions', [{
      _id: 'sess-1', roomName: 'Living Room', status: 'active', itemCount: 2,
    }]);
    __seed('PlannerItems', [
      { _id: 'item-1', sessionId: 'sess-1', productName: 'Eureka Frame', price: 499, x: 3, y: 5 },
      { _id: 'item-2', sessionId: 'sess-1', productName: 'Mesa Mattress', price: 299, x: 3, y: 5 },
    ]);

    const result = await getSessionState('sess-1');
    expect(result.success).toBe(true);
    expect(result.session.roomName).toBe('Living Room');
    expect(result.items).toHaveLength(2);
  });

  it('returns empty items for new session', async () => {
    __seed('PlannerSessions', [{ _id: 'sess-1', roomName: 'Empty', status: 'active' }]);
    __seed('PlannerItems', []);

    const result = await getSessionState('sess-1');
    expect(result.items).toEqual([]);
  });
});

// ── Item Placement ──────────────────────────────────────────────────

describe('placeItem', () => {
  it('places a product in the room', async () => {
    __seed('PlannerSessions', [{ _id: 'sess-1', status: 'active', itemCount: 0 }]);

    const result = await placeItem({
      sessionId: 'sess-1',
      productId: 'prod-001',
      productName: 'Eureka Futon Frame',
      price: 499,
      x: 3, y: 5,
      width: 6, depth: 3,
      rotation: 0,
      placedBy: 'Sarah',
    });

    expect(result.success).toBe(true);
    expect(result.itemId).toBeTruthy();

    const inserted = __getInserted('PlannerItems');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].productName).toBe('Eureka Futon Frame');
    expect(inserted[0].x).toBe(3);
    expect(inserted[0].placedBy).toBe('Sarah');
  });

  it('requires sessionId, productId, productName', async () => {
    const result = await placeItem({ sessionId: 'sess-1' });
    expect(result.success).toBe(false);
  });
});

describe('moveItem', () => {
  it('updates item position', async () => {
    __seed('PlannerItems', [
      { _id: 'item-1', sessionId: 'sess-1', x: 0, y: 0, rotation: 0 },
    ]);

    const result = await moveItem('item-1', 5, 8, 90, 'Tom');
    expect(result.success).toBe(true);
  });

  it('returns error for unknown item', async () => {
    __seed('PlannerItems', []);
    const result = await moveItem('nonexistent', 5, 8);
    expect(result.success).toBe(false);
  });
});

describe('removeItem', () => {
  it('removes item and decrements count', async () => {
    __seed('PlannerItems', [
      { _id: 'item-1', sessionId: 'sess-1', productName: 'Frame' },
    ]);
    __seed('PlannerSessions', [
      { _id: 'sess-1', itemCount: 1 },
    ]);

    const result = await removeItem('item-1', 'Sarah');
    expect(result.success).toBe(true);
  });

  it('returns error for unknown item', async () => {
    __seed('PlannerItems', []);
    const result = await removeItem('nonexistent');
    expect(result.success).toBe(false);
  });
});

// ── Session Cart ────────────────────────────────────────────────────

describe('getSessionCart', () => {
  it('returns all items with total price', async () => {
    __seed('PlannerItems', [
      { _id: 'i1', sessionId: 'sess-1', productId: 'p1', productName: 'Frame', price: 499, placedBy: 'Sarah' },
      { _id: 'i2', sessionId: 'sess-1', productId: 'p2', productName: 'Mattress', price: 299, placedBy: 'Tom' },
    ]);

    const result = await getSessionCart('sess-1');
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(798);
  });

  it('shows who placed each item', async () => {
    __seed('PlannerItems', [
      { _id: 'i1', sessionId: 'sess-1', productName: 'Frame', price: 499, placedBy: 'Sarah' },
    ]);

    const result = await getSessionCart('sess-1');
    expect(result.items[0].placedBy).toBe('Sarah');
  });

  it('returns empty for session with no items', async () => {
    __seed('PlannerItems', []);
    const result = await getSessionCart('sess-1');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ── F3 rate-limit (cf-32u1.1) ──────────────────────────────────────
// Each of the 5 mutators uses a different key prefix on the same
// CollabPlannerRateLimit collection (create:/join:/place:/move:/remove:).
// The withRateLimit helper seeds a single record at the limit; we set
// `key:` to match the prefix used by the mutator under test.
describe('collaborativePlanner — rate limits (cf-32u1.1 F3)', () => {
  // checkRateLimit lowercases the key before hashing, so the seeded key
  // here MUST match the lowercased form to land in the same bucket.
  it('createSession blocks when create:<creator> bucket is at limit', async () => {
    withRateLimit('CollabPlannerRateLimit', { blocked: true, max: 60, key: 'create:host' });
    const result = await createSession({ roomName: 'Spam Room', creatorName: 'Host' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many|try again/i);
    expect(result.sessionId).toBeNull();
  });

  it('joinSession blocks when join:<token> bucket is at limit', async () => {
    __seed('PlannerSessions', [{
      _id: 'sess-1', shareToken: 'tok-abc', status: 'active',
      participantCount: 1, participants: [{ name: 'Host', role: 'host' }],
    }]);
    withRateLimit('CollabPlannerRateLimit', { blocked: true, max: 60, key: 'join:tok-abc' });
    const result = await joinSession('tok-abc', 'Bot');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many|try again/i);
  });

  it('placeItem blocks when place:<sessionId> bucket is at limit', async () => {
    __seed('PlannerSessions', [{ _id: 'sess-1', status: 'active', itemCount: 0 }]);
    withRateLimit('CollabPlannerRateLimit', { blocked: true, max: 60, key: 'place:sess-1' });
    const result = await placeItem({
      sessionId: 'sess-1', productId: 'prod-1', productName: 'Sofa',
    });
    expect(result.success).toBe(false);
    expect(result.itemId).toBeNull();
    // No item written.
    expect(__getInserted('PlannerItems')).toEqual([]);
  });

  it('moveItem blocks when move:<sessionId> bucket is at limit', async () => {
    __seed('PlannerItems', [{ _id: 'item-1', sessionId: 'sess-1', x: 0, y: 0, rotation: 0 }]);
    withRateLimit('CollabPlannerRateLimit', { blocked: true, max: 60, key: 'move:sess-1' });
    const result = await moveItem('item-1', 5, 5, 90, 'Bot');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many|try again/i);
  });

  it('removeItem blocks when remove:<sessionId> bucket is at limit', async () => {
    __seed('PlannerItems', [{ _id: 'item-1', sessionId: 'sess-1' }]);
    __seed('PlannerSessions', [{ _id: 'sess-1', status: 'active', itemCount: 1 }]);
    withRateLimit('CollabPlannerRateLimit', { blocked: true, max: 60, key: 'remove:sess-1' });
    const result = await removeItem('item-1', 'Bot');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many|try again/i);
  });
});
