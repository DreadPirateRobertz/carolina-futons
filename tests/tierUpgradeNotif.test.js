/**
 * tierUpgradeNotif.test.js
 * cf-1d3 — Post-upgrade tier email + push on tier_upgraded bus event.
 *
 * notifyTierUpgrade(memberId, newTier, previousTier) sends a
 * tier_upgrade_congratulations email and a TIER_CHANGED push to the
 * upgraded member. Idempotent via TierUpgradeNotifications dedup collection
 * on (memberId, newTier). Opt-out via MemberNotificationPrefs.tierUpdates.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  __reset as resetCrm,
  __getEmailLog,
  __failNextEmail,
} from './__mocks__/wix-crm-backend.js';

const mockSendPushToMember = vi.fn(async () => ({ sent: 1, failed: 0 }));

vi.mock('backend/pushNotificationService.web', () => ({
  sendPushToMember: (...args) => mockSendPushToMember(...args),
  PUSH_EVENTS: {
    TIER_CHANGED: 'tier_changed',
  },
}));

import { notifyTierUpgrade } from '../src/backend/gamificationNotifs.web.js';

const PREFS_COLLECTION = 'MemberNotificationPrefs';
const TIER_NOTIFS_COLLECTION = 'TierUpgradeNotifications';

beforeEach(() => {
  resetData();
  resetCrm();
  vi.clearAllMocks();
  mockSendPushToMember.mockResolvedValue({ sent: 1, failed: 0 });
});

describe('notifyTierUpgrade — happy path', () => {
  it('sends tier_upgrade_congratulations email to the upgraded member', async () => {
    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].templateId).toBe('tier_upgrade_congratulations');
    expect(log[0].memberId).toBe('mem-1');
    expect(log[0].options.variables.newTier).toBe('gold');
    expect(log[0].options.variables.previousTier).toBe('silver');
  });

  it('sends TIER_CHANGED push with the new tier', async () => {
    await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(mockSendPushToMember).toHaveBeenCalledOnce();
    expect(mockSendPushToMember).toHaveBeenCalledWith('mem-1', 'tier_changed', { tier: 'gold' });
  });

  it('records a dedup entry in TierUpgradeNotifications on success', async () => {
    await notifyTierUpgrade('mem-1', 'gold', 'silver');

    const inserted = __getInserted(TIER_NOTIFS_COLLECTION);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].memberId).toBe('mem-1');
    expect(inserted[0].newTier).toBe('gold');
    expect(inserted[0].sentAt).toBeDefined();
  });
});

describe('notifyTierUpgrade — idempotency', () => {
  it('skips when dedup record already exists for (memberId, newTier)', async () => {
    __seed(TIER_NOTIFS_COLLECTION, [
      { _id: 'tn-1', memberId: 'mem-1', newTier: 'gold', sentAt: new Date().toISOString() },
    ]);

    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('already_sent');
    expect(__getEmailLog()).toHaveLength(0);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
  });

  it('still sends when same member upgrades to a different tier', async () => {
    __seed(TIER_NOTIFS_COLLECTION, [
      { _id: 'tn-1', memberId: 'mem-1', newTier: 'silver', sentAt: new Date().toISOString() },
    ]);

    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(true);
    expect(__getEmailLog()).toHaveLength(1);
  });
});

describe('notifyTierUpgrade — opt-out', () => {
  it('skips when member has tierUpdates: false', async () => {
    __seed(PREFS_COLLECTION, [
      { _id: 'p-1', memberId: 'mem-1', tierUpdates: false, streakReminders: true },
    ]);

    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('opted_out');
    expect(__getEmailLog()).toHaveLength(0);
    expect(mockSendPushToMember).not.toHaveBeenCalled();
    expect(__getInserted(TIER_NOTIFS_COLLECTION)).toHaveLength(0);
  });

  it('defaults to opt-in when member has no prefs record', async () => {
    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');
    expect(result.sent).toBe(true);
  });

  it('sends when tierUpdates is explicitly true', async () => {
    __seed(PREFS_COLLECTION, [
      { _id: 'p-1', memberId: 'mem-1', tierUpdates: true },
    ]);
    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');
    expect(result.sent).toBe(true);
  });
});

describe('notifyTierUpgrade — failure modes', () => {
  it('returns { sent: false } and does not dedup when email fails', async () => {
    __failNextEmail();

    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('email_failed');
    expect(__getInserted(TIER_NOTIFS_COLLECTION)).toHaveLength(0);
  });

  it('treats push failure as non-fatal (email already sent, dedup still recorded)', async () => {
    mockSendPushToMember.mockRejectedValueOnce(new Error('push service down'));

    const result = await notifyTierUpgrade('mem-1', 'gold', 'silver');

    expect(result.sent).toBe(true);
    expect(__getEmailLog()).toHaveLength(1);
    expect(__getInserted(TIER_NOTIFS_COLLECTION)).toHaveLength(1);
  });

  it('returns { sent: false, reason: invalid_input } when memberId missing', async () => {
    const result = await notifyTierUpgrade('', 'gold', 'silver');
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });

  it('returns { sent: false, reason: invalid_input } when newTier missing', async () => {
    const result = await notifyTierUpgrade('mem-1', '', 'silver');
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('invalid_input');
  });
});
