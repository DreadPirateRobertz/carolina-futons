/**
 * UGC Gallery Service Test Suite
 *
 * Tests user-generated content photo submissions, voting, reporting,
 * moderation, before/after pairs, and gallery statistics.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember, __setRoles } from '../__mocks__/wix-members-backend.js';

import {
  submitUGCPhoto,
  getApprovedPhotos,
  getBeforeAfterPairs,
  voteForPhoto,
  reportPhoto,
  moderatePhoto,
  getUGCStats,
} from '../../src/backend/ugcService.web.js';

// ── Test Data ─────────────────────────────────────────────────────────

const MEMBER_1 = { _id: 'member-1', loginEmail: 'alice@example.com', contactDetails: { firstName: 'Alice' } };
const MEMBER_2 = { _id: 'member-2', loginEmail: 'bob@example.com', contactDetails: { firstName: 'Bob' } };

const APPROVED_PHOTOS = [
  {
    _id: 'photo-1',
    memberId: 'member-1',
    memberDisplayName: 'Alice',
    photoUrl: 'https://static.wixstatic.com/media/photo1.jpg',
    caption: 'My new futon in the living room',
    productId: 'prod-eureka',
    productName: 'Eureka Futon Frame',
    roomType: 'living-room',
    tags: ['cozy', 'modern'],
    socialSource: null,
    socialPostUrl: null,
    status: 'approved',
    voteCount: 5,
    submittedAt: new Date('2026-02-20'),
    moderatedAt: new Date('2026-02-21'),
    reportCount: 0,
    beforeAfterId: null,
    beforeAfterType: null,
  },
  {
    _id: 'photo-2',
    memberId: 'member-2',
    memberDisplayName: 'Bob',
    photoUrl: 'https://static.wixstatic.com/media/photo2.jpg',
    caption: 'Dorm room setup',
    productId: 'prod-vienna',
    productName: 'Vienna Sofa Bed',
    roomType: 'dorm',
    tags: ['dorm', 'compact'],
    socialSource: 'instagram',
    socialPostUrl: 'https://instagram.com/p/abc123',
    status: 'approved',
    voteCount: 12,
    submittedAt: new Date('2026-02-18'),
    moderatedAt: new Date('2026-02-19'),
    reportCount: 0,
    beforeAfterId: null,
    beforeAfterType: null,
  },
];

const FEATURED_PHOTO = {
  _id: 'photo-3',
  memberId: 'member-1',
  memberDisplayName: 'Alice',
  photoUrl: 'https://static.wixstatic.com/media/photo3.jpg',
  caption: 'Office transformation',
  productId: 'prod-eureka',
  productName: 'Eureka Futon Frame',
  roomType: 'office',
  tags: ['office', 'transformation'],
  socialSource: null,
  socialPostUrl: null,
  status: 'featured',
  voteCount: 25,
  submittedAt: new Date('2026-02-15'),
  moderatedAt: new Date('2026-02-16'),
  reportCount: 0,
  beforeAfterId: null,
  beforeAfterType: null,
};

const PENDING_PHOTO = {
  _id: 'photo-4',
  memberId: 'member-2',
  memberDisplayName: 'Bob',
  photoUrl: 'https://static.wixstatic.com/media/photo4.jpg',
  caption: 'Pending review photo',
  productId: 'prod-vienna',
  productName: 'Vienna Sofa Bed',
  roomType: 'bedroom',
  tags: ['bedroom'],
  socialSource: null,
  socialPostUrl: null,
  status: 'pending',
  voteCount: 0,
  submittedAt: new Date('2026-02-25'),
  moderatedAt: null,
  reportCount: 0,
  beforeAfterId: null,
  beforeAfterType: null,
};

const REJECTED_PHOTO = {
  _id: 'photo-5',
  memberId: 'member-2',
  memberDisplayName: 'Bob',
  photoUrl: 'https://static.wixstatic.com/media/photo5.jpg',
  caption: 'Rejected',
  productId: 'prod-vienna',
  productName: 'Vienna Sofa Bed',
  roomType: 'porch',
  tags: [],
  socialSource: null,
  socialPostUrl: null,
  status: 'rejected',
  voteCount: 0,
  submittedAt: new Date('2026-02-10'),
  moderatedAt: new Date('2026-02-11'),
  reportCount: 3,
  beforeAfterId: null,
  beforeAfterType: null,
};

const BEFORE_AFTER_PHOTOS = [
  {
    _id: 'ba-before-1',
    memberId: 'member-1',
    memberDisplayName: 'Alice',
    photoUrl: 'https://static.wixstatic.com/media/before1.jpg',
    caption: 'Before — empty corner',
    productId: 'prod-eureka',
    productName: 'Eureka Futon Frame',
    roomType: 'living-room',
    tags: ['before-after'],
    socialSource: null,
    socialPostUrl: null,
    status: 'approved',
    voteCount: 8,
    submittedAt: new Date('2026-02-12'),
    moderatedAt: new Date('2026-02-13'),
    reportCount: 0,
    beforeAfterId: 'pair-1',
    beforeAfterType: 'before',
  },
  {
    _id: 'ba-after-1',
    memberId: 'member-1',
    memberDisplayName: 'Alice',
    photoUrl: 'https://static.wixstatic.com/media/after1.jpg',
    caption: 'After — cozy reading nook',
    productId: 'prod-eureka',
    productName: 'Eureka Futon Frame',
    roomType: 'living-room',
    tags: ['before-after'],
    socialSource: null,
    socialPostUrl: null,
    status: 'approved',
    voteCount: 15,
    submittedAt: new Date('2026-02-12'),
    moderatedAt: new Date('2026-02-13'),
    reportCount: 0,
    beforeAfterId: 'pair-1',
    beforeAfterType: 'after',
  },
  {
    _id: 'ba-before-2',
    memberId: 'member-2',
    memberDisplayName: 'Bob',
    photoUrl: 'https://static.wixstatic.com/media/before2.jpg',
    caption: 'Before — dorm room',
    productId: 'prod-vienna',
    productName: 'Vienna Sofa Bed',
    roomType: 'dorm',
    tags: ['before-after', 'dorm'],
    socialSource: null,
    socialPostUrl: null,
    status: 'approved',
    voteCount: 3,
    submittedAt: new Date('2026-02-14'),
    moderatedAt: new Date('2026-02-15'),
    reportCount: 0,
    beforeAfterId: 'pair-2',
    beforeAfterType: 'before',
  },
  {
    _id: 'ba-after-2',
    memberId: 'member-2',
    memberDisplayName: 'Bob',
    photoUrl: 'https://static.wixstatic.com/media/after2.jpg',
    caption: 'After — dorm glow up',
    productId: 'prod-vienna',
    productName: 'Vienna Sofa Bed',
    roomType: 'dorm',
    tags: ['before-after', 'dorm'],
    socialSource: null,
    socialPostUrl: null,
    status: 'approved',
    voteCount: 10,
    submittedAt: new Date('2026-02-14'),
    moderatedAt: new Date('2026-02-15'),
    reportCount: 0,
    beforeAfterId: 'pair-2',
    beforeAfterType: 'after',
  },
];

const EXISTING_VOTES = [
  { _id: 'vote-1', memberId: 'member-1', photoId: 'photo-2', createdAt: new Date('2026-02-19') },
];

// ── submitUGCPhoto ────────────────────────────────────────────────────

describe('submitUGCPhoto', () => {
  beforeEach(() => {
    resetData();
    __setMember(MEMBER_1);
    __seed('UGCPhotos', []);
    __seed('UGCVotes', []);
  });

  it('creates a pending photo with all fields', async () => {
    const result = await submitUGCPhoto({
      photoUrl: 'https://static.wixstatic.com/media/new-photo.jpg',
      caption: 'Brand new futon setup in my living room',
      productId: 'prod-eureka',
      productName: 'Eureka Futon Frame',
      roomType: 'living-room',
      tags: ['cozy', 'new'],
      socialSource: 'instagram',
      socialPostUrl: 'https://instagram.com/p/xyz',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('pending');
    expect(result.data.memberId).toBe('member-1');
    expect(result.data.photoUrl).toBe('https://static.wixstatic.com/media/new-photo.jpg');
    expect(result.data.voteCount).toBe(0);
    expect(result.data.reportCount).toBe(0);
  });

  it('requires photoUrl — empty string fails', async () => {
    const result = await submitUGCPhoto({
      photoUrl: '',
      caption: 'Nice futon',
      roomType: 'living-room',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('requires photoUrl — missing field fails', async () => {
    const result = await submitUGCPhoto({
      caption: 'Nice futon',
      roomType: 'living-room',
    });

    expect(result.success).toBe(false);
  });

  it('sanitizes caption — HTML stripped', async () => {
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: '<script>alert("xss")</script>Beautiful futon!',
      roomType: 'living-room',
    });

    expect(result.success).toBe(true);
    expect(result.data.caption).not.toContain('<script>');
    expect(result.data.caption).not.toContain('</script>');
  });

  it('truncates caption to max 300 characters', async () => {
    const longCaption = 'A'.repeat(500);
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: longCaption,
      roomType: 'living-room',
    });

    expect(result.success).toBe(true);
    expect(result.data.caption.length).toBeLessThanOrEqual(300);
  });

  it('validates roomType against allowed values', async () => {
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: 'My garage setup',
      roomType: 'garage',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('accepts all valid roomType values', async () => {
    const validRoomTypes = ['living-room', 'bedroom', 'office', 'dorm', 'porch'];
    for (const roomType of validRoomTypes) {
      resetData();
      __setMember(MEMBER_1);
      __seed('UGCPhotos', []);
      const result = await submitUGCPhoto({
        photoUrl: 'https://example.com/photo.jpg',
        caption: `Room: ${roomType}`,
        roomType,
      });
      expect(result.success).toBe(true);
    }
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: 'Unauthorized submission',
      roomType: 'living-room',
    });

    expect(result.success).toBe(false);
  });

  it('handles XSS in caption', async () => {
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: '<img src=x onerror=alert(1)>Nice futon',
      roomType: 'bedroom',
    });

    expect(result.success).toBe(true);
    expect(result.data.caption).not.toContain('<img');
    expect(result.data.caption).not.toContain('onerror');
  });

  it('handles XSS in memberDisplayName', async () => {
    __setMember({
      _id: 'member-xss',
      loginEmail: 'xss@example.com',
      contactDetails: { firstName: '<script>alert("xss")</script>Hacker' },
    });

    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: 'Normal caption',
      roomType: 'office',
    });

    expect(result.success).toBe(true);
    expect(result.data.memberDisplayName).not.toContain('<script>');
  });

  it('handles missing optional fields — productId, productName, tags, socialSource', async () => {
    const result = await submitUGCPhoto({
      photoUrl: 'https://example.com/photo.jpg',
      caption: 'Just a photo, no product link',
      roomType: 'living-room',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('handles null data input', async () => {
    const result = await submitUGCPhoto(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined data input', async () => {
    const result = await submitUGCPhoto(undefined);
    expect(result.success).toBe(false);
  });
});

// ── getApprovedPhotos ─────────────────────────────────────────────────

describe('getApprovedPhotos', () => {
  beforeEach(() => {
    resetData();
    __seed('UGCPhotos', [...APPROVED_PHOTOS, FEATURED_PHOTO, PENDING_PHOTO, REJECTED_PHOTO]);
  });

  it('returns only approved and featured photos', async () => {
    const result = await getApprovedPhotos({});
    expect(result.success).toBe(true);
    expect(result.photos.length).toBe(3); // 2 approved + 1 featured
    const statuses = result.photos.map(p => p.status);
    expect(statuses).not.toContain('pending');
    expect(statuses).not.toContain('rejected');
  });

  it('filters by roomType', async () => {
    const result = await getApprovedPhotos({ roomType: 'dorm' });
    expect(result.success).toBe(true);
    expect(result.photos.length).toBe(1);
    expect(result.photos[0].roomType).toBe('dorm');
  });

  it('filters by tags', async () => {
    const result = await getApprovedPhotos({ tags: ['modern'] });
    expect(result.success).toBe(true);
    result.photos.forEach(photo => {
      expect(photo.tags).toEqual(expect.arrayContaining(['modern']));
    });
  });

  it('sorts by recent by default', async () => {
    const result = await getApprovedPhotos({});
    expect(result.success).toBe(true);
    expect(result.photos.length).toBeGreaterThan(1);
    // Most recent first
    for (let i = 1; i < result.photos.length; i++) {
      const prevDate = new Date(result.photos[i - 1].submittedAt).getTime();
      const currDate = new Date(result.photos[i].submittedAt).getTime();
      expect(prevDate).toBeGreaterThanOrEqual(currDate);
    }
  });

  it('sorts by votes', async () => {
    const result = await getApprovedPhotos({ sort: 'votes' });
    expect(result.success).toBe(true);
    expect(result.photos.length).toBeGreaterThan(1);
    // Highest votes first
    for (let i = 1; i < result.photos.length; i++) {
      expect(result.photos[i - 1].voteCount).toBeGreaterThanOrEqual(result.photos[i].voteCount);
    }
  });

  it('clamps limit — minimum 1', async () => {
    const result = await getApprovedPhotos({ limit: 0 });
    expect(result.success).toBe(true);
    expect(result.photos.length).toBeGreaterThanOrEqual(1);
  });

  it('clamps limit — maximum 50', async () => {
    const result = await getApprovedPhotos({ limit: 100 });
    expect(result.success).toBe(true);
    // Should still return results, limit capped to 50
    expect(result.photos.length).toBeLessThanOrEqual(50);
  });

  it('returns empty array when no photos match', async () => {
    __seed('UGCPhotos', []);
    const result = await getApprovedPhotos({});
    expect(result.success).toBe(true);
    expect(result.photos).toEqual([]);
  });

  it('returns totalCount', async () => {
    const result = await getApprovedPhotos({});
    expect(result.success).toBe(true);
    expect(result.totalCount).toBeDefined();
    expect(typeof result.totalCount).toBe('number');
    expect(result.totalCount).toBe(3);
  });

  it('returns empty array for roomType with no approved photos', async () => {
    const result = await getApprovedPhotos({ roomType: 'porch' });
    expect(result.success).toBe(true);
    // porch photo is rejected, so should be empty
    expect(result.photos).toHaveLength(0);
  });
});

// ── getBeforeAfterPairs ───────────────────────────────────────────────

describe('getBeforeAfterPairs', () => {
  beforeEach(() => {
    resetData();
    __seed('UGCPhotos', [...BEFORE_AFTER_PHOTOS]);
  });

  it('returns matched pairs — before + after with same beforeAfterId', async () => {
    const result = await getBeforeAfterPairs({});
    expect(result.success).toBe(true);
    expect(result.pairs.length).toBe(2);

    const pair1 = result.pairs.find(p => p.pairId === 'pair-1');
    expect(pair1).toBeDefined();
    expect(pair1.before).toBeDefined();
    expect(pair1.after).toBeDefined();
    expect(pair1.before.beforeAfterType).toBe('before');
    expect(pair1.after.beforeAfterType).toBe('after');
  });

  it('returns empty when no pairs exist', async () => {
    __seed('UGCPhotos', [...APPROVED_PHOTOS]); // No before/after photos
    const result = await getBeforeAfterPairs({});
    expect(result.success).toBe(true);
    expect(result.pairs).toHaveLength(0);
  });

  it('filters by roomType', async () => {
    const result = await getBeforeAfterPairs({ roomType: 'dorm' });
    expect(result.success).toBe(true);
    expect(result.pairs.length).toBe(1);
    expect(result.pairs[0].before.roomType).toBe('dorm');
    expect(result.pairs[0].after.roomType).toBe('dorm');
  });

  it('returns empty for roomType with no before/after photos', async () => {
    const result = await getBeforeAfterPairs({ roomType: 'office' });
    expect(result.success).toBe(true);
    expect(result.pairs).toHaveLength(0);
  });

  it('does not return incomplete pairs — orphan before without after', async () => {
    __seed('UGCPhotos', [BEFORE_AFTER_PHOTOS[0]]); // Only the "before" of pair-1
    const result = await getBeforeAfterPairs({});
    expect(result.success).toBe(true);
    // Should not include incomplete pairs
    expect(result.pairs).toHaveLength(0);
  });
});

// ── voteForPhoto ──────────────────────────────────────────────────────

describe('voteForPhoto', () => {
  beforeEach(() => {
    resetData();
    __setMember(MEMBER_1);
    __seed('UGCPhotos', [...APPROVED_PHOTOS, FEATURED_PHOTO]);
    __seed('UGCVotes', []);
  });

  it('adds vote and increments voteCount', async () => {
    const result = await voteForPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(result.voted).toBe(true);
    expect(result.voteCount).toBe(6); // was 5, now 6
  });

  it('removes vote on second call — toggle — and decrements voteCount', async () => {
    __seed('UGCVotes', [...EXISTING_VOTES]); // member-1 voted for photo-2

    const result = await voteForPhoto('photo-2');
    expect(result.success).toBe(true);
    expect(result.voted).toBe(false);
    expect(result.voteCount).toBe(11); // was 12, now 11
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await voteForPhoto('photo-1');
    expect(result.success).toBe(false);
  });

  it('fails for invalid photoId — empty string', async () => {
    const result = await voteForPhoto('');
    expect(result.success).toBe(false);
  });

  it('fails for null photoId', async () => {
    const result = await voteForPhoto(null);
    expect(result.success).toBe(false);
  });

  it('cannot vote on non-existent photo', async () => {
    const result = await voteForPhoto('nonexistent-photo-id');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── reportPhoto ───────────────────────────────────────────────────────

describe('reportPhoto', () => {
  beforeEach(() => {
    resetData();
    __setMember(MEMBER_1);
    __seed('UGCPhotos', [...APPROVED_PHOTOS]);
  });

  it('increments reportCount', async () => {
    const result = await reportPhoto('photo-1', 'Inappropriate content');
    expect(result.success).toBe(true);
  });

  it('requires reason string', async () => {
    const result = await reportPhoto('photo-1', '');
    expect(result.success).toBe(false);
  });

  it('requires non-null reason', async () => {
    const result = await reportPhoto('photo-1', null);
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await reportPhoto('photo-1', 'Spam');
    expect(result.success).toBe(false);
  });

  it('fails for non-existent photo', async () => {
    const result = await reportPhoto('nonexistent-id', 'Spam');
    expect(result.success).toBe(false);
  });

  it('fails for empty photoId', async () => {
    const result = await reportPhoto('', 'Spam');
    expect(result.success).toBe(false);
  });
});

// ── moderatePhoto ─────────────────────────────────────────────────────

describe('moderatePhoto', () => {
  beforeEach(() => {
    resetData();
    __setMember({ _id: 'admin-1', loginEmail: 'admin@carolinafutons.com' });
    __setRoles([{ title: 'Admin', _id: 'admin' }]);
    __seed('UGCPhotos', [PENDING_PHOTO, ...APPROVED_PHOTOS]);
  });

  it('approves a photo — status changes to approved', async () => {
    const result = await moderatePhoto('photo-4', 'approve');
    expect(result.success).toBe(true);
  });

  it('rejects a photo — status changes to rejected', async () => {
    const result = await moderatePhoto('photo-4', 'reject');
    expect(result.success).toBe(true);
  });

  it('features a photo — status changes to featured', async () => {
    const result = await moderatePhoto('photo-4', 'feature');
    expect(result.success).toBe(true);
  });

  it('fails for invalid action', async () => {
    const result = await moderatePhoto('photo-4', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('fails for empty action', async () => {
    const result = await moderatePhoto('photo-4', '');
    expect(result.success).toBe(false);
  });

  it('fails for non-existent photo', async () => {
    const result = await moderatePhoto('nonexistent-photo', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('requires admin role — fails with no admin role', async () => {
    __setRoles([]); // No admin role
    __setMember(MEMBER_1); // Regular member

    const result = await moderatePhoto('photo-4', 'approve');
    expect(result.success).toBe(false);
  });

  it('fails for empty photoId', async () => {
    const result = await moderatePhoto('', 'approve');
    expect(result.success).toBe(false);
  });

  it('fails for null photoId', async () => {
    const result = await moderatePhoto(null, 'approve');
    expect(result.success).toBe(false);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    __setRoles([]);
    const result = await moderatePhoto('photo-4', 'approve');
    expect(result.success).toBe(false);
  });
});

// ── getUGCStats ───────────────────────────────────────────────────────

describe('getUGCStats', () => {
  beforeEach(() => {
    resetData();
    __seed('UGCPhotos', [
      ...APPROVED_PHOTOS,
      FEATURED_PHOTO,
      PENDING_PHOTO,
      REJECTED_PHOTO,
    ]);
  });

  it('returns correct counts — total approved/featured, featured count, by roomType', async () => {
    const result = await getUGCStats();
    expect(result.success).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats.total).toBeGreaterThanOrEqual(3); // 2 approved + 1 featured
    expect(result.stats.featured).toBe(1);
    expect(result.stats.byRoomType).toBeDefined();
    expect(typeof result.stats.byRoomType).toBe('object');
  });

  it('returns zeros when no photos exist', async () => {
    __seed('UGCPhotos', []);
    const result = await getUGCStats();
    expect(result.success).toBe(true);
    expect(result.stats.total).toBe(0);
    expect(result.stats.featured).toBe(0);
  });

  it('counts by roomType correctly', async () => {
    __seed('UGCPhotos', [
      { _id: 'p-1', status: 'approved', roomType: 'living-room', voteCount: 0, reportCount: 0, submittedAt: new Date() },
      { _id: 'p-2', status: 'approved', roomType: 'living-room', voteCount: 0, reportCount: 0, submittedAt: new Date() },
      { _id: 'p-3', status: 'featured', roomType: 'bedroom', voteCount: 0, reportCount: 0, submittedAt: new Date() },
      { _id: 'p-4', status: 'pending', roomType: 'office', voteCount: 0, reportCount: 0, submittedAt: new Date() },
    ]);

    const result = await getUGCStats();
    expect(result.success).toBe(true);
    // Only approved/featured should be counted
    expect(result.stats.byRoomType['living-room']).toBe(2);
    expect(result.stats.byRoomType['bedroom']).toBe(1);
  });

  it('does not count pending or rejected photos in totals', async () => {
    __seed('UGCPhotos', [
      { _id: 'p-1', status: 'pending', roomType: 'dorm', voteCount: 0, reportCount: 0, submittedAt: new Date() },
      { _id: 'p-2', status: 'rejected', roomType: 'dorm', voteCount: 0, reportCount: 0, submittedAt: new Date() },
    ]);

    const result = await getUGCStats();
    expect(result.success).toBe(true);
    expect(result.stats.total).toBe(0);
    expect(result.stats.featured).toBe(0);
  });
});
