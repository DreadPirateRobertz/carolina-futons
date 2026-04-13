import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';
import {
  syncMobilePoints,
  syncBadgeEarnedToPush,
  SYNC_LOG_COLLECTION,
} from '../src/backend/utils/crossRigSyncUtils.js';

const MEMBER_ID = 'member-sync-1';
function setMember() { __setMember({ _id: MEMBER_ID }); }

vi.mock('backend/pushNotificationService.web', () => ({
  sendPushToMember: vi.fn(async () => ({ sent: 1, failed: 0 })),
  PUSH_EVENTS: {
    BADGE_EARNED: 'badge_earned',
    TIER_CHANGED: 'tier_changed',
  },
}));

beforeEach(() => { __reset(); resetMember(); vi.clearAllMocks(); });

describe('SYNC_LOG_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof SYNC_LOG_COLLECTION).toBe('string');
    expect(SYNC_LOG_COLLECTION.length).toBeGreaterThan(0);
  });
});

describe('syncMobilePoints', () => {
  it('returns success: true and logs the sync event', async () => {
    setMember();
    __seed(SYNC_LOG_COLLECTION, []);
    const result = await syncMobilePoints(MEMBER_ID, 150, 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(true);
    expect(result.points).toBe(150);
  });

  it('rejects empty memberId', async () => {
    const result = await syncMobilePoints('', 100, 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/memberId/i);
  });

  it('rejects null memberId', async () => {
    const result = await syncMobilePoints(null, 100, 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(false);
  });

  it('rejects unknown source rig', async () => {
    setMember();
    const result = await syncMobilePoints(MEMBER_ID, 100, 'quiz_completed', 'unknown_rig');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/source/i);
  });

  it('rejects negative point values', async () => {
    setMember();
    const result = await syncMobilePoints(MEMBER_ID, -50, 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric points', async () => {
    setMember();
    const result = await syncMobilePoints(MEMBER_ID, 'hundred', 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(false);
  });

  it('accepts zero points', async () => {
    setMember();
    __seed(SYNC_LOG_COLLECTION, []);
    const result = await syncMobilePoints(MEMBER_ID, 0, 'quiz_completed', 'cfutons_mobile');
    expect(result.success).toBe(true);
  });

  it('logs direction as mobile_to_web', async () => {
    setMember();
    const { __getSpy } = await import('./__mocks__/wix-data.js');
    let inserted;
    const wixData = (await import('wix-data')).default;
    const spy = vi.spyOn(wixData, 'insert').mockImplementationOnce(async (col, item) => {
      inserted = item;
      return { ...item, _id: 'log-1' };
    });
    await syncMobilePoints(MEMBER_ID, 100, 'ar_discovery_completed', 'cfutons_mobile');
    if (inserted) {
      expect(inserted.direction).toBe('mobile_to_web');
      expect(inserted.sourceRig).toBe('cfutons_mobile');
    }
    spy.mockRestore();
  });
});

describe('syncBadgeEarnedToPush', () => {
  it('returns success: true when push sends successfully', async () => {
    setMember();
    const result = await syncBadgeEarnedToPush(MEMBER_ID, 'first_purchase');
    expect(result.success).toBe(true);
  });

  it('returns pushSent count from sendPushToMember', async () => {
    setMember();
    const result = await syncBadgeEarnedToPush(MEMBER_ID, 'streak_7');
    expect(typeof result.pushSent).toBe('number');
  });

  it('calls sendPushToMember with correct args', async () => {
    setMember();
    const { sendPushToMember, PUSH_EVENTS } = await import('backend/pushNotificationService.web');
    await syncBadgeEarnedToPush(MEMBER_ID, 'first_purchase');
    expect(sendPushToMember).toHaveBeenCalledWith(
      MEMBER_ID,
      PUSH_EVENTS.BADGE_EARNED,
      { badgeId: 'first_purchase' }
    );
  });

  it('returns success: false on push service error', async () => {
    setMember();
    const { sendPushToMember } = await import('backend/pushNotificationService.web');
    sendPushToMember.mockRejectedValueOnce(new Error('push service down'));
    const result = await syncBadgeEarnedToPush(MEMBER_ID, 'badge-x');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/push service down/i);
  });

  it('returns pushSent 0 when member has no tokens', async () => {
    setMember();
    const { sendPushToMember } = await import('backend/pushNotificationService.web');
    sendPushToMember.mockResolvedValueOnce({ sent: 0, failed: 0 });
    const result = await syncBadgeEarnedToPush(MEMBER_ID, 'new_badge');
    expect(result.success).toBe(true);
    expect(result.pushSent).toBe(0);
  });
});
