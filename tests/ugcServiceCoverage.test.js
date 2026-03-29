/**
 * ugcServiceCoverage.test.js
 *
 * Targets uncovered lines in ugcService.web.js:
 *   - 377-378: catch block in moderatePhoto
 *   - 414-415: catch block in getUGCStats
 *
 * Also covers edge cases:
 *   - moderatePhoto success path with status/moderatedAt verification
 *   - moderatePhoto with 'feature' action
 *   - getUGCStats with mixed room types (byRoomType breakdown)
 *   - getUGCStats with no photos (empty result)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __setRoles, __reset as resetMember } from './__mocks__/wix-members-backend.js';

import { moderatePhoto, getUGCStats } from '../src/backend/ugcService.web.js';

// ── Helpers ────────────────────────────────────────────────────────────

function setAdmin() {
  __setMember({ _id: 'admin-1', contactDetails: { firstName: 'Admin' } });
  __setRoles([{ title: 'Admin', _id: 'admin' }]);
}

const PHOTO_APPROVED = {
  _id: 'photo-mod-1',
  memberId: 'member-1',
  memberDisplayName: 'Alice',
  photoUrl: 'https://static.wixstatic.com/media/photo1.jpg',
  caption: 'My cozy futon',
  roomType: 'living-room',
  status: 'approved',
  voteCount: 3,
  reportCount: 0,
  submittedAt: new Date('2026-01-10'),
  moderatedAt: null,
};

// ── beforeEach / afterEach ─────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetMember();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── moderatePhoto: catch block (lines 377-378) ─────────────────────────

describe('moderatePhoto — error catch block', () => {
  it('returns failure when wixData.get throws', async () => {
    setAdmin();
    __seed('UGCPhotos', [PHOTO_APPROVED]);

    vi.spyOn(wixData, 'get').mockRejectedValueOnce(new Error('DB connection lost'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await moderatePhoto('photo-mod-1', 'approve');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to moderate photo.');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ugcService] Error moderating photo:',
      expect.any(Error)
    );
  });

  it('returns failure when wixData.update throws', async () => {
    setAdmin();
    __seed('UGCPhotos', [PHOTO_APPROVED]);

    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('Write failed'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await moderatePhoto('photo-mod-1', 'approve');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to moderate photo.');
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ugcService] Error moderating photo:',
      expect.any(Error)
    );
  });
});

// ── moderatePhoto: success paths ───────────────────────────────────────

describe('moderatePhoto — success paths', () => {
  it('sets status to approved and moderatedAt on approve action', async () => {
    setAdmin();
    __seed('UGCPhotos', [{ ...PHOTO_APPROVED, status: 'pending' }]);

    const updateSpy = vi.spyOn(wixData, 'update');
    const before = Date.now();

    const result = await moderatePhoto('photo-mod-1', 'approve');

    const after = Date.now();
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();

    const updated = updateSpy.mock.calls[0]?.[1];
    expect(updated.status).toBe('approved');
    expect(updated.moderatedAt).toBeInstanceOf(Date);
    expect(updated.moderatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(updated.moderatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('sets status to featured on feature action', async () => {
    setAdmin();
    __seed('UGCPhotos', [{ ...PHOTO_APPROVED, status: 'approved' }]);

    const updateSpy = vi.spyOn(wixData, 'update');

    const result = await moderatePhoto('photo-mod-1', 'feature');

    expect(result.success).toBe(true);
    const updated = updateSpy.mock.calls[0]?.[1];
    expect(updated.status).toBe('featured');
    expect(updated.moderatedAt).toBeInstanceOf(Date);
  });

  it('sets status to rejected on reject action', async () => {
    setAdmin();
    __seed('UGCPhotos', [{ ...PHOTO_APPROVED, status: 'pending' }]);

    const updateSpy = vi.spyOn(wixData, 'update');

    const result = await moderatePhoto('photo-mod-1', 'reject');

    expect(result.success).toBe(true);
    const updated = updateSpy.mock.calls[0]?.[1];
    expect(updated.status).toBe('rejected');
  });
});

// ── getUGCStats: catch block (lines 414-415) ──────────────────────────

describe('getUGCStats — error catch block', () => {
  it('returns failure when wixData.query find throws', async () => {
    const fakeQuery = {
      hasSome: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockRejectedValueOnce(new Error('Query timeout')),
    };
    vi.spyOn(wixData, 'query').mockReturnValueOnce(fakeQuery);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getUGCStats();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to load stats.');
    expect(result.stats).toEqual({ total: 0, featured: 0, byRoomType: {} });
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ugcService] Error getting UGC stats:',
      expect.any(Error)
    );
  });
});

// ── getUGCStats: edge cases ────────────────────────────────────────────

describe('getUGCStats — edge cases', () => {
  it('returns zero counts when no photos exist', async () => {
    __seed('UGCPhotos', []);

    const result = await getUGCStats();

    expect(result.success).toBe(true);
    expect(result.stats.total).toBe(0);
    expect(result.stats.featured).toBe(0);
    expect(result.stats.byRoomType).toEqual({});
  });

  it('computes byRoomType breakdown across mixed room types', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'living-room' },
      { _id: 'p2', status: 'approved', roomType: 'bedroom' },
      { _id: 'p3', status: 'featured', roomType: 'living-room' },
      { _id: 'p4', status: 'approved', roomType: 'office' },
      { _id: 'p5', status: 'featured', roomType: 'bedroom' },
      { _id: 'p6', status: 'pending', roomType: 'dorm' },   // excluded: not approved/featured
    ]);

    const result = await getUGCStats();

    expect(result.success).toBe(true);
    expect(result.stats.total).toBe(5);
    expect(result.stats.featured).toBe(2);
    expect(result.stats.byRoomType).toEqual({
      'living-room': 2,
      bedroom: 2,
      office: 1,
    });
  });

  it('counts featured photos in total and featured separately', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'dorm' },
      { _id: 'p2', status: 'featured', roomType: 'dorm' },
      { _id: 'p3', status: 'featured', roomType: 'porch' },
    ]);

    const result = await getUGCStats();

    expect(result.stats.total).toBe(3);
    expect(result.stats.featured).toBe(2);
  });

  it('ignores photos without a roomType in byRoomType breakdown', async () => {
    __seed('UGCPhotos', [
      { _id: 'p1', status: 'approved', roomType: 'office' },
      { _id: 'p2', status: 'approved', roomType: null },
      { _id: 'p3', status: 'approved' },
    ]);

    const result = await getUGCStats();

    expect(result.stats.total).toBe(3);
    expect(result.stats.byRoomType).toEqual({ office: 1 });
  });
});
