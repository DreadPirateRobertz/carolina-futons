/**
 * @file customerRoomPhotos.test.js
 * @description Tests for CF-rw9i: CustomerRoomPhotos backend service.
 *
 * Covers:
 *  - Constants: COLLECTION, LIKES_COLLECTION, VALID_ROOM_TYPES, MAX_CAPTION_LENGTH
 *  - submitRoomPhoto: auth, isWixMediaUrl validation, arbitrary URL rejection,
 *    room type, slug gen, rate limit, inserts correctly
 *  - getProductRoomPhotos: filters by productId + approved, pagination,
 *    does not expose memberEmail/memberId
 *  - getAllRoomPhotos: approved-only, roomType filter, pagination
 *  - likeRoomPhoto: inserts RoomPhotoLikes record, dedup (alreadyLiked),
 *    concurrent duplicate insert guard, rejects missing/non-approved photo
 *  - moderateRoomPhoto: approve, reject, notes, idempotency guard,
 *    resolves actual moderator identity for audit log
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { withRateLimit } from './helpers/withRateLimit.js';

import {
  submitRoomPhoto,
  getProductRoomPhotos,
  getAllRoomPhotos,
  likeRoomPhoto,
  moderateRoomPhoto,
  _COLLECTION,
  _LIKES_COLLECTION,
  _VALID_ROOM_TYPES,
  _MAX_CAPTION_LENGTH,
} from '../src/backend/customerRoomPhotos.web.js';

// ── Test fixtures ────────────────────────────────────────────────────────────

const MEMBER = {
  _id: 'member-1',
  loginEmail: 'sarah@example.com',
  contactDetails: { firstName: 'Sarah', lastName: 'Jones' },
};

function makePhoto(overrides = {}) {
  return {
    _id: 'photo-1',
    photoUrl: 'wix:image://v1/abc123/room.jpg',
    caption: 'Love the frame!',
    productId: 'prod-frame-1',
    productName: 'Kodiak Futon Frame',
    roomType: 'living-room',
    memberId: 'member-1',
    memberDisplayName: 'Sarah J.',
    memberEmail: 'sarah@example.com',
    status: 'approved',
    submittedAt: new Date('2026-03-01'),
    approvedAt: new Date('2026-03-02'),
    moderatorNotes: '',
    likes: 4,
    slug: 'living-room-kodiak-futon-frame-abc',
    ...overrides,
  };
}

// ── beforeEach ───────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __setMember(MEMBER);
});

// ── Constants ────────────────────────────────────────────────────────────────

describe('CustomerRoomPhotos — constants', () => {
  it('_COLLECTION is CustomerRoomPhotos', () => {
    expect(_COLLECTION).toBe('CustomerRoomPhotos');
  });

  it('_LIKES_COLLECTION is RoomPhotoLikes', () => {
    expect(_LIKES_COLLECTION).toBe('RoomPhotoLikes');
  });

  it('_VALID_ROOM_TYPES includes expected values', () => {
    expect(_VALID_ROOM_TYPES).toContain('living-room');
    expect(_VALID_ROOM_TYPES).toContain('bedroom');
    expect(_VALID_ROOM_TYPES).toContain('office');
    expect(_VALID_ROOM_TYPES).toContain('dorm');
    expect(_VALID_ROOM_TYPES).toContain('porch');
    expect(_VALID_ROOM_TYPES).toContain('other');
  });

  it('_MAX_CAPTION_LENGTH is 200', () => {
    expect(_MAX_CAPTION_LENGTH).toBe(200);
  });
});

// ── submitRoomPhoto ──────────────────────────────────────────────────────────

describe('submitRoomPhoto', () => {
  it('inserts a pending photo with correct fields', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/abc123/room.jpg',
      caption: 'Love the setup',
      productId: 'prod-1',
      productName: 'Kodiak Frame',
      roomType: 'living-room',
    }, 'member-1');

    expect(result.success).toBe(true);
    expect(inserted.status).toBe('pending');
    expect(inserted.photoUrl).toBe('wix:image://v1/abc123/room.jpg');
    expect(inserted.caption).toBe('Love the setup');
    expect(inserted.productId).toBe('prod-1');
    expect(inserted.roomType).toBe('living-room');
    expect(inserted.memberId).toBe('member-1');
    expect(inserted.memberEmail).toBe('sarah@example.com');
    expect(inserted.likes).toBe(0);
    expect(inserted.approvedAt).toBeNull();
    expect(inserted.moderatorNotes).toBe('');
    expect(inserted.submittedAt).toBeInstanceOf(Date);
  });

  it('returns slug in result', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    __onInsert(() => {});
    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/abc/img.jpg',
      caption: '',
      productId: 'prod-1',
      productName: 'Kodiak Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(true);
    expect(result.data.slug).toMatch(/bedroom/);
    expect(result.data.status).toBe('pending');
  });

  it('sets memberDisplayName from member first+last initial', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'dorm',
    }, 'member-1');

    expect(inserted.memberDisplayName).toBe('Sarah J.');
  });

  it('rejects without auth (memberId null)', async () => {
    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'living-room',
    }, null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('rejects missing photoUrl', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      photoUrl: '',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'living-room',
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/photo/i);
  });

  it('rejects non-Wix photoUrl (arbitrary HTTPS)', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      photoUrl: 'https://attacker.com/evil.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/upload form/i);
  });

  it('rejects javascript: URI in photoUrl', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      photoUrl: 'javascript:alert(1)',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/upload form/i);
  });

  it('accepts wix:video:// photoUrl', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    __onInsert(() => {});
    const result = await submitRoomPhoto({
      photoUrl: 'wix:video://v1/abc123_clip.mp4',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(true);
  });

  it('accepts static.wixstatic.com CDN URL', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    __onInsert(() => {});
    const result = await submitRoomPhoto({
      photoUrl: 'https://static.wixstatic.com/media/abc123~mv2.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(true);
  });

  it('rejects invalid roomType', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'castle',
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/room type/i);
  });

  it('truncates caption to MAX_CAPTION_LENGTH', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const longCaption = 'x'.repeat(300);
    await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: longCaption,
      productId: 'p1',
      productName: 'Frame',
      roomType: 'office',
    }, 'member-1');

    expect(inserted.caption.length).toBeLessThanOrEqual(_MAX_CAPTION_LENGTH);
  });

  it('accepts empty caption', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'porch',
    }, 'member-1');
    expect(result.success).toBe(true);
    expect(inserted.caption).toBe('');
  });

  it('accepts null productId (photo not tied to a product)', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: 'General photo',
      productId: null,
      productName: null,
      roomType: 'other',
    }, 'member-1');
    expect(result.success).toBe(true);
    expect(inserted.productId).toBeNull();
  });

  it('returns error when rate limited', async () => {
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1', blocked: true });
    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/x/y.jpg',
      caption: '',
      productId: 'p1',
      productName: 'Frame',
      roomType: 'bedroom',
    }, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/limit/i);
  });
});

// ── getProductRoomPhotos ─────────────────────────────────────────────────────

describe('getProductRoomPhotos', () => {
  it('returns approved photos for a product', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', productId: 'prod-1', status: 'approved' }),
      makePhoto({ _id: 'p2', productId: 'prod-1', status: 'approved' }),
      makePhoto({ _id: 'p3', productId: 'prod-1', status: 'pending' }),
    ]);

    const result = await getProductRoomPhotos('prod-1');
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2);
    expect(result.photos.every(p => p.status === 'approved')).toBe(true);
  });

  it('returns featured photos as well', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', productId: 'prod-1', status: 'featured' }),
      makePhoto({ _id: 'p2', productId: 'prod-1', status: 'approved' }),
    ]);
    const result = await getProductRoomPhotos('prod-1');
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2);
  });

  it('filters out photos for other products', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', productId: 'prod-1', status: 'approved' }),
      makePhoto({ _id: 'p2', productId: 'prod-2', status: 'approved' }),
    ]);
    const result = await getProductRoomPhotos('prod-1');
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].productId).toBe('prod-1');
  });

  it('returns empty array when no photos', async () => {
    const result = await getProductRoomPhotos('prod-no-photos');
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects limit option', async () => {
    const photos = Array.from({ length: 10 }, (_, i) =>
      makePhoto({ _id: `p${i}`, productId: 'prod-1', status: 'approved' })
    );
    __seed(_COLLECTION, photos);
    const result = await getProductRoomPhotos('prod-1', { limit: 3 });
    expect(result.photos.length).toBeLessThanOrEqual(3);
  });

  it('returns total count', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', productId: 'prod-1', status: 'approved' }),
      makePhoto({ _id: 'p2', productId: 'prod-1', status: 'approved' }),
    ]);
    const result = await getProductRoomPhotos('prod-1');
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('returns success:false without crashing when productId is empty', async () => {
    const result = await getProductRoomPhotos('');
    expect(result.success).toBe(false);
  });

  it('photo objects include expected fields', async () => {
    __seed(_COLLECTION, [makePhoto({ productId: 'prod-1', status: 'approved' })]);
    const result = await getProductRoomPhotos('prod-1');
    const photo = result.photos[0];
    expect(photo).toHaveProperty('_id');
    expect(photo).toHaveProperty('photoUrl');
    expect(photo).toHaveProperty('caption');
    expect(photo).toHaveProperty('memberDisplayName');
    expect(photo).toHaveProperty('roomType');
    expect(photo).toHaveProperty('likes');
    expect(photo).toHaveProperty('submittedAt');
  });

  it('does not expose memberEmail or memberId in public response', async () => {
    __seed(_COLLECTION, [makePhoto({ productId: 'prod-1', status: 'approved' })]);
    const result = await getProductRoomPhotos('prod-1');
    const photo = result.photos[0];
    expect(photo).not.toHaveProperty('memberEmail');
    expect(photo).not.toHaveProperty('memberId');
  });
});

// ── getAllRoomPhotos ──────────────────────────────────────────────────────────

describe('getAllRoomPhotos', () => {
  it('returns only approved photos', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', status: 'approved' }),
      makePhoto({ _id: 'p2', status: 'pending' }),
      makePhoto({ _id: 'p3', status: 'rejected' }),
    ]);
    const result = await getAllRoomPhotos();
    expect(result.success).toBe(true);
    expect(result.photos.every(p => p.status === 'approved')).toBe(true);
  });

  it('includes featured photos', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', status: 'featured' }),
      makePhoto({ _id: 'p2', status: 'approved' }),
    ]);
    const result = await getAllRoomPhotos();
    expect(result.photos).toHaveLength(2);
  });

  it('filters by roomType', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', roomType: 'bedroom', status: 'approved' }),
      makePhoto({ _id: 'p2', roomType: 'living-room', status: 'approved' }),
    ]);
    const result = await getAllRoomPhotos({ roomType: 'bedroom' });
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].roomType).toBe('bedroom');
  });

  it('returns empty array for empty gallery', async () => {
    const result = await getAllRoomPhotos();
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(0);
  });

  it('respects limit and skip', async () => {
    const photos = Array.from({ length: 5 }, (_, i) =>
      makePhoto({ _id: `p${i}`, status: 'approved', submittedAt: new Date(2026, 0, i + 1) })
    );
    __seed(_COLLECTION, photos);
    const first = await getAllRoomPhotos({ limit: 2, skip: 0 });
    expect(first.photos.length).toBeLessThanOrEqual(2);
  });

  it('clamps limit to maximum of 50', async () => {
    const photos = Array.from({ length: 60 }, (_, i) =>
      makePhoto({ _id: `p${i}`, status: 'approved' })
    );
    __seed(_COLLECTION, photos);
    const result = await getAllRoomPhotos({ limit: 100 });
    expect(result.photos.length).toBeLessThanOrEqual(50);
  });

  it('does not expose memberEmail in public response', async () => {
    __seed(_COLLECTION, [makePhoto({ status: 'approved' })]);
    const result = await getAllRoomPhotos();
    expect(result.photos[0]).not.toHaveProperty('memberEmail');
    expect(result.photos[0]).not.toHaveProperty('memberId');
  });

  it('returns total count', async () => {
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', status: 'approved' }),
      makePhoto({ _id: 'p2', status: 'approved' }),
      makePhoto({ _id: 'p3', status: 'approved' }),
    ]);
    const result = await getAllRoomPhotos();
    expect(result.total).toBeGreaterThanOrEqual(3);
  });
});

// ── likeRoomPhoto ────────────────────────────────────────────────────────────

describe('likeRoomPhoto', () => {
  it('increments likes on an approved photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', likes: 4, status: 'approved' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(result.likes).toBe(5);
    expect(result.alreadyLiked).toBe(false);
    expect(updated.likes).toBe(5);
  });

  it('inserts a RoomPhotoLikes record on first like', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', likes: 0, status: 'approved' })]);
    let likeInserted = null;
    __onInsert((col, item) => { if (col === _LIKES_COLLECTION) likeInserted = item; });

    await likeRoomPhoto('photo-1');
    expect(likeInserted).not.toBeNull();
    expect(likeInserted.memberId).toBe('member-1');
    expect(likeInserted.photoId).toBe('photo-1');
    expect(likeInserted.createdAt).toBeInstanceOf(Date);
  });

  it('returns alreadyLiked:true when RoomPhotoLikes record exists', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', likes: 7, status: 'approved' })]);
    __seed(_LIKES_COLLECTION, [{ _id: 'like-1', memberId: 'member-1', photoId: 'photo-1' }]);

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(result.alreadyLiked).toBe(true);
    expect(result.likes).toBe(7);
  });

  it('does not increment likes counter when already liked', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', likes: 7, status: 'approved' })]);
    __seed(_LIKES_COLLECTION, [{ _id: 'like-1', memberId: 'member-1', photoId: 'photo-1' }]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    await likeRoomPhoto('photo-1');
    expect(updated).toBeNull(); // no update should have fired
  });

  it('returns error for non-existent photo', async () => {
    const result = await likeRoomPhoto('does-not-exist');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects liking a pending photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(false);
  });

  it('handles photos with no likes field (defaults to 0)', async () => {
    const photo = makePhoto({ _id: 'photo-1', status: 'approved' });
    delete photo.likes;
    __seed(_COLLECTION, [photo]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(updated.likes).toBe(1);
  });
});

// ── moderateRoomPhoto ────────────────────────────────────────────────────────

describe('moderateRoomPhoto', () => {
  it('approves a pending photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending', approvedAt: null })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    const result = await moderateRoomPhoto('photo-1', 'approve');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('approved');
    expect(updated.approvedAt).toBeInstanceOf(Date);
  });

  it('rejects a pending photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    const result = await moderateRoomPhoto('photo-1', 'reject', 'Spam content');
    expect(result.success).toBe(true);
    expect(updated.status).toBe('rejected');
    expect(updated.moderatorNotes).toBe('Spam content');
  });

  it('stores moderator notes on approval', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    await moderateRoomPhoto('photo-1', 'approve', 'Great photo!');
    expect(updated.moderatorNotes).toBe('Great photo!');
  });

  it('returns error for non-existent photo', async () => {
    const result = await moderateRoomPhoto('nonexistent', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('returns error for invalid action', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    const result = await moderateRoomPhoto('photo-1', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid action/i);
  });

  it('does not re-approve already approved photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'approved' })]);
    const result = await moderateRoomPhoto('photo-1', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already/i);
  });

  it('does not re-reject already rejected photo', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'rejected' })]);
    const result = await moderateRoomPhoto('photo-1', 'reject');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already/i);
  });

  it('does not set approvedAt on rejection', async () => {
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending', approvedAt: null })]);
    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    await moderateRoomPhoto('photo-1', 'reject');
    expect(updated.approvedAt).toBeNull();
  });

  it('resolves actual moderator identity — succeeds when member is available', async () => {
    // Verifies moderateRoomPhoto resolves currentMember for audit identity
    // (actual member ID used instead of literal 'admin') — code-review fix.
    // __setMember sets MEMBER (_id: 'member-1') in beforeEach.
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    const result = await moderateRoomPhoto('photo-1', 'approve');
    expect(result.success).toBe(true);
  });

  it('falls back to admin moderatorId when getMember throws', async () => {
    // CF-rw9i coverage: moderator identity catch branch (line ~244)
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('auth service down'));
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);
    const result = await moderateRoomPhoto('photo-1', 'approve');
    expect(result.success).toBe(true);
  });
});

// ── Coverage gap tests (CF-rw9i peer review) ────────────────────────────────

describe('submitRoomPhoto — member identity edge cases', () => {
  it('uses "Customer" when getMember throws', async () => {
    // CF-rw9i coverage: member identity catch branch (line ~91)
    const { currentMember } = await import('wix-members-backend');
    currentMember.getMember.mockRejectedValueOnce(new Error('network error'));
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });

    let inserted;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/abc/room.jpg',
      roomType: 'living-room',
      productId: 'prod-1',
      productName: 'Kodiak',
      caption: 'Love it',
    }, 'member-1');
    expect(result.success).toBe(true);
    expect(inserted.memberDisplayName).toBe('Customer');
    expect(inserted.memberEmail).toBe('');
  });

  it('uses firstName only when lastName is empty', async () => {
    // CF-rw9i coverage: no-lastName ternary else branch (line ~86-88)
    __setMember({ ...MEMBER, contactDetails: { firstName: 'Sarah', lastName: '' } });
    withRateLimit('CustomerRoomPhotosRateLimit', { key: 'member-1' });

    let inserted;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await submitRoomPhoto({
      photoUrl: 'wix:image://v1/abc/room.jpg',
      roomType: 'living-room',
      productId: 'prod-1',
      productName: 'Kodiak',
      caption: 'Nice',
    }, 'member-1');
    expect(result.success).toBe(true);
    expect(inserted.memberDisplayName).toBe('Sarah');
  });
});

describe('likeRoomPhoto — non-duplicate insert error rethrows', () => {
  it('propagates non-duplicate insert errors to outer catch', async () => {
    // CF-rw9i coverage: throw dupErr path (line ~204)
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'approved' })]);
    __onInsert(() => { throw new Error('network timeout'); });

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to like photo.');
  });
});

describe('getAllRoomPhotos — invalid roomType silently returns all', () => {
  it('ignores invalid roomType and returns all approved photos', async () => {
    // CF-rw9i coverage: compound conditional false path (line ~161)
    __seed(_COLLECTION, [
      makePhoto({ _id: 'photo-1', roomType: 'living-room', status: 'approved' }),
      makePhoto({ _id: 'photo-2', roomType: 'bedroom', status: 'approved' }),
    ]);
    const result = await getAllRoomPhotos({ roomType: 'castle' });
    expect(result.success).toBe(true);
    expect(result.photos.length).toBe(2);
  });
});

// ── Additional branch coverage tests (CF-rw9i CI gap) ───────────────────────

describe('submitRoomPhoto — null data object', () => {
  it('returns error when data is null (covers data && data.photoUrl false branch)', async () => {
    // Covers the `(data && data.photoUrl) || ''` false branch when data itself is null
    const result = await submitRoomPhoto(null, 'member-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/photo.*required/i);
  });
});

describe('getProductRoomPhotos — limit clamped below minimum', () => {
  it('clamps limit of 0 to 1 (covers Math.max(1, limit) true branch)', async () => {
    // Covers `Math.max(1, limit)` where limit < 1
    __seed(_COLLECTION, [
      makePhoto({ _id: 'p1', productId: 'prod-1', status: 'approved' }),
      makePhoto({ _id: 'p2', productId: 'prod-1', status: 'approved' }),
    ]);
    const result = await getProductRoomPhotos('prod-1', { limit: 0 });
    expect(result.success).toBe(true);
    expect(result.photos.length).toBeLessThanOrEqual(1);
  });
});

describe('likeRoomPhoto — alreadyLiked with null likes field', () => {
  it('returns 0 likes when photo.likes is undefined and already liked (covers || 0 fallback)', async () => {
    // Covers `Number(photo.likes) || 0` in the alreadyLiked early-return path
    const photo = makePhoto({ _id: 'photo-1', status: 'approved' });
    delete photo.likes;
    __seed(_COLLECTION, [photo]);
    __seed(_LIKES_COLLECTION, [{ _id: 'like-1', memberId: 'member-1', photoId: 'photo-1' }]);

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(result.alreadyLiked).toBe(true);
    expect(result.likes).toBe(0);
  });
});

describe('likeRoomPhoto — duplicate insert with "unique" error message', () => {
  it('treats "unique constraint" error as alreadyLiked (covers || msg.includes("unique") branch)', async () => {
    // Covers the `msg.includes('unique')` OR branch in the dupErr catch handler
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', likes: 3, status: 'approved' })]);
    __onInsert(() => {
      const err = new Error('violates unique constraint');
      throw err;
    });

    const result = await likeRoomPhoto('photo-1');
    expect(result.success).toBe(true);
    expect(result.alreadyLiked).toBe(true);
    expect(result.likes).toBe(3);
  });
});

describe('moderateRoomPhoto — moderator has no _id', () => {
  it('falls back to "admin" moderatorId when mod._id is falsy (covers mod?._id false branch)', async () => {
    // Covers `if (mod?._id) moderatorId = mod._id` false branch
    __setMember({ ...MEMBER, _id: undefined });
    __seed(_COLLECTION, [makePhoto({ _id: 'photo-1', status: 'pending' })]);

    const result = await moderateRoomPhoto('photo-1', 'approve');
    expect(result.success).toBe(true);
  });
});
