/**
 * Backend tests for src/backend/notificationPreferences.web.js
 *
 * Tests all three web methods directly using wix-data and wix-members-backend mocks:
 *   getNotificationPreferences, saveNotificationPreferences, unsubscribeAll
 *
 * See CF-n3px for original specification.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __setQueryError, __setInsertError, __setUpdateError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  unsubscribeAll,
} from '../src/backend/notificationPreferences.web.js';
import { __getInserted, __getUpdated } from './__mocks__/wix-data.js';

const COLLECTION = 'MemberNotificationPrefs';
const MEMBER_ID = 'member-abc123';
const MEMBER = { _id: MEMBER_ID };

const DEFAULT_PREFS = {
  restock:     true,
  orderUpdate: true,
  promo:       false,
  cfPlus:      true,
  sms:         false,
};

beforeEach(() => {
  resetData();
  resetMember();
});

// ── getNotificationPreferences ────────────────────────────────────────

describe('getNotificationPreferences', () => {
  it('returns defaults when no record exists', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    const result = await getNotificationPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual(DEFAULT_PREFS);
  });

  it('returns stored prefs when record exists', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      restock:     false,
      orderUpdate: true,
      promo:       true,
      cfPlus:      false,
      sms:         true,
    }]);
    const result = await getNotificationPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual({
      restock:     false,
      orderUpdate: true,
      promo:       true,
      cfPlus:      false,
      sms:         true,
    });
  });

  it('falls back to DEFAULT_PREFS for null fields via ??', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      restock:     null,
      orderUpdate: null,
      promo:       null,
      cfPlus:      null,
      sms:         null,
    }]);
    const result = await getNotificationPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual(DEFAULT_PREFS);
  });

  it('preserves stored false values (does not overwrite with defaults)', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-1',
      memberId: MEMBER_ID,
      restock:     false,
      orderUpdate: false,
      promo:       false,
      cfPlus:      false,
      sms:         false,
    }]);
    const result = await getNotificationPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs.restock).toBe(false);
    expect(result.prefs.cfPlus).toBe(false);
  });

  it('returns success: false when not authenticated', async () => {
    __setMember(null);
    const result = await getNotificationPreferences();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── saveNotificationPreferences ───────────────────────────────────────

describe('saveNotificationPreferences', () => {
  it('inserts a new record when none exists', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    const prefs = { restock: true, orderUpdate: false, promo: true, cfPlus: false, sms: true };
    const result = await saveNotificationPreferences(prefs);
    expect(result.success).toBe(true);
    const saved = __getInserted(COLLECTION);
    expect(saved).toHaveLength(1);
    expect(saved[0].memberId).toBe(MEMBER_ID);
    expect(saved[0].restock).toBe(true);
    expect(saved[0].promo).toBe(true);
    expect(saved[0].sms).toBe(true);
  });

  it('updates an existing record (upsert — update path)', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-existing',
      memberId: MEMBER_ID,
      restock: true, orderUpdate: true, promo: false, cfPlus: true, sms: false,
    }]);
    const prefs = { restock: false, orderUpdate: false, promo: true, cfPlus: false, sms: true };
    const result = await saveNotificationPreferences(prefs);
    expect(result.success).toBe(true);
    const saved = __getInserted(COLLECTION);
    // Still only one record — no duplicate inserted
    expect(saved).toHaveLength(1);
    expect(saved[0]._id).toBe('rec-existing');
    expect(saved[0].restock).toBe(false);
    expect(saved[0].promo).toBe(true);
  });

  it('coerces truthy/falsy values to Boolean', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    const result = await saveNotificationPreferences({
      restock: 1, orderUpdate: 0, promo: 'yes', cfPlus: '', sms: null,
    });
    expect(result.success).toBe(true);
    const saved = __getInserted(COLLECTION);
    expect(saved[0].restock).toBe(true);
    expect(saved[0].orderUpdate).toBe(false);
    expect(saved[0].promo).toBe(true);
    expect(saved[0].cfPlus).toBe(false);
    expect(saved[0].sms).toBe(false);
  });

  it('returns success: false when prefs is missing', async () => {
    __setMember(MEMBER);
    const result = await saveNotificationPreferences(null);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns success: false when prefs is not an object', async () => {
    __setMember(MEMBER);
    const result = await saveNotificationPreferences('bad');
    expect(result.success).toBe(false);
  });

  it('returns success: false when not authenticated', async () => {
    __setMember(null);
    const result = await saveNotificationPreferences({ restock: true });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── unsubscribeAll ────────────────────────────────────────────────────

describe('unsubscribeAll', () => {
  it('sets all prefs to false when existing record exists (update path)', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{
      _id: 'rec-existing',
      memberId: MEMBER_ID,
      restock: true, orderUpdate: true, promo: true, cfPlus: true, sms: true,
    }]);
    const result = await unsubscribeAll();
    expect(result.success).toBe(true);
    const saved = __getInserted(COLLECTION);
    expect(saved).toHaveLength(1);
    expect(saved[0].restock).toBe(false);
    expect(saved[0].orderUpdate).toBe(false);
    expect(saved[0].promo).toBe(false);
    expect(saved[0].cfPlus).toBe(false);
    expect(saved[0].sms).toBe(false);
  });

  it('inserts all-false record when no prior record exists', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    const result = await unsubscribeAll();
    expect(result.success).toBe(true);
    const saved = __getInserted(COLLECTION);
    expect(saved).toHaveLength(1);
    expect(saved[0].memberId).toBe(MEMBER_ID);
    expect(saved[0].restock).toBe(false);
    expect(saved[0].sms).toBe(false);
  });

  it('does not create duplicate records on second call', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    await unsubscribeAll();
    await unsubscribeAll();
    const saved = __getInserted(COLLECTION);
    expect(saved).toHaveLength(1);
  });

  it('returns success: false when not authenticated', async () => {
    __setMember(null);
    const result = await unsubscribeAll();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── wixData error paths ───────────────────────────────────────────────

describe('getNotificationPreferences — wixData error', () => {
  it('returns success: false when wixData.query throws', async () => {
    __setMember(MEMBER);
    __setQueryError(COLLECTION, new Error('DB unavailable'));
    const result = await getNotificationPreferences();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('saveNotificationPreferences — wixData error', () => {
  it('returns success: false when wixData.insert throws', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    __setInsertError(COLLECTION, new Error('Insert failed'));
    const result = await saveNotificationPreferences({ restock: true, orderUpdate: true, promo: false, cfPlus: true, sms: false });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns success: false when wixData.update throws', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, [{ _id: 'rec-1', memberId: MEMBER_ID, restock: true, orderUpdate: true, promo: false, cfPlus: true, sms: false }]);
    __setUpdateError(COLLECTION, new Error('Update failed'));
    const result = await saveNotificationPreferences({ restock: false, orderUpdate: false, promo: true, cfPlus: false, sms: true });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('unsubscribeAll — wixData error', () => {
  it('returns success: false when wixData.insert throws', async () => {
    __setMember(MEMBER);
    __seed(COLLECTION, []);
    __setInsertError(COLLECTION, new Error('Insert failed'));
    const result = await unsubscribeAll();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
