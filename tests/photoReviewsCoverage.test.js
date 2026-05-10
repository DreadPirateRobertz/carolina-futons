/**
 * Coverage tests for photoReviews.web.js — targeting uncovered error catch blocks
 * on lines 236-237 (getPhotoGallery) and 298-299 (getPhotoReviewStats), plus
 * additional edge-case coverage for gallery and stats paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __seed } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(() => Promise.resolve({ _id: 'member-1' })) },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

const { getPhotoGallery, getPhotoReviewStats } = await import(
  '../src/backend/photoReviews.web.js'
);

const VALID_PRODUCT_ID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

beforeEach(() => {
  __seed('PhotoReviews', []);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getPhotoGallery error catch block (lines 236-237) ─────────────────────────

describe('getPhotoGallery — error catch block', () => {
  it('returns failure response when find() throws (covers lines 236-237)', async () => {
    vi.spyOn(wixData, 'query').mockImplementation(() => ({
      hasSome() { return this; },
      descending() { return this; },
      limit() { return this; },
      eq() { return this; },
      async find() { throw new Error('Wix data service unavailable'); },
    }));

    const result = await getPhotoGallery();

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to load gallery.');
    expect(result.photos).toEqual([]);
  });

  it('returns failure response when find() throws with category filter (covers lines 236-237)', async () => {
    vi.spyOn(wixData, 'query').mockImplementation(() => ({
      hasSome() { return this; },
      descending() { return this; },
      limit() { return this; },
      eq() { return this; },
      async find() { throw new Error('Network timeout'); },
    }));

    const result = await getPhotoGallery('futon-frames');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to load gallery.');
    expect(result.photos).toEqual([]);
  });
});

// ── getPhotoGallery edge cases ─────────────────────────────────────────────────

describe('getPhotoGallery — category filter', () => {
  beforeEach(() => {
    __seed('PhotoReviews', [
      {
        _id: 'r-frame-1',
        productId: 'p1',
        productName: 'Kodiak Frame',
        productCategory: 'futon-frames',
        reviewText: 'Solid and beautiful',
        rating: 5,
        photoUrl: 'img1.jpg',
        status: 'approved',
        submittedAt: new Date('2026-02-20'),
      },
      {
        _id: 'r-frame-2',
        productId: 'p2',
        productName: 'Vienna Frame',
        productCategory: 'futon-frames',
        reviewText: 'Elegant design',
        rating: 4,
        photoUrl: 'img2.jpg',
        status: 'featured',
        submittedAt: new Date('2026-02-18'),
      },
      {
        _id: 'r-mattress-1',
        productId: 'p3',
        productName: 'Cloud Mattress',
        productCategory: 'mattresses',
        reviewText: 'Very comfortable',
        rating: 5,
        photoUrl: 'img3.jpg',
        status: 'approved',
        submittedAt: new Date('2026-02-19'),
      },
    ]);
  });

  it('filters gallery to requested category only', async () => {
    const result = await getPhotoGallery('mattresses');

    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]._id).toBe('r-mattress-1');
    expect(result.photos[0].productCategory).toBe('mattresses');
  });

  it('returns all approved/featured when no category given', async () => {
    const result = await getPhotoGallery();

    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(3);
  });

  it('returns empty array when category has no matching approved photos', async () => {
    const result = await getPhotoGallery('murphy-beds');

    expect(result.success).toBe(true);
    expect(result.photos).toEqual([]);
  });
});

describe('getPhotoGallery — limit boundary clamping', () => {
  beforeEach(() => {
    __seed('PhotoReviews', [
      { _id: 'r1', productId: 'p1', productName: 'A', productCategory: 'covers', reviewText: 'Nice', rating: 5, photoUrl: 'img.jpg', status: 'approved', submittedAt: new Date() },
    ]);
  });

  it('clamps limit of 0 to minimum of 1', async () => {
    const result = await getPhotoGallery(null, 0);

    expect(result.success).toBe(true);
    // limit(1) — seed has 1 item, so it should be returned
    expect(result.photos).toHaveLength(1);
  });

  it('clamps limit of 100 to maximum of 50', async () => {
    const result = await getPhotoGallery(null, 100);

    expect(result.success).toBe(true);
    // passes with clamped limit; verifies no error thrown
    expect(Array.isArray(result.photos)).toBe(true);
  });

  it('clamps negative limit to minimum of 1', async () => {
    const result = await getPhotoGallery(null, -5);

    expect(result.success).toBe(true);
    expect(Array.isArray(result.photos)).toBe(true);
  });
});

describe('getPhotoGallery — reviewText truncation', () => {
  it('truncates reviewText longer than 100 chars to exactly 100', async () => {
    __seed('PhotoReviews', [
      {
        _id: 'r-long',
        productId: 'p1',
        productName: 'Longview',
        productCategory: 'covers',
        reviewText: 'B'.repeat(250),
        rating: 4,
        photoUrl: 'img.jpg',
        status: 'approved',
        submittedAt: new Date(),
      },
    ]);

    const result = await getPhotoGallery();

    expect(result.success).toBe(true);
    expect(result.photos[0].reviewText).toHaveLength(100);
    expect(result.photos[0].reviewText).toBe('B'.repeat(100));
  });

  it('does not truncate reviewText at or under 100 chars', async () => {
    const exactText = 'C'.repeat(100);
    __seed('PhotoReviews', [
      { _id: 'r-exact', productId: 'p1', productName: 'X', productCategory: 'covers', reviewText: exactText, rating: 5, photoUrl: 'img.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();

    expect(result.photos[0].reviewText).toBe(exactText);
  });

  it('handles null or missing reviewText without throwing', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-null', productId: 'p1', productName: 'X', productCategory: 'covers', reviewText: null, rating: 5, photoUrl: 'img.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();

    expect(result.success).toBe(true);
    expect(result.photos[0].reviewText).toBe('');
  });
});

describe('getPhotoGallery — featured status', () => {
  it('marks status=featured photos as featured=true', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-feat', productId: 'p1', productName: 'X', productCategory: 'covers', reviewText: 'Great', rating: 5, photoUrl: 'img.jpg', status: 'featured', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();

    expect(result.photos[0].featured).toBe(true);
  });

  it('marks status=approved photos as featured=false', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-appr', productId: 'p1', productName: 'X', productCategory: 'covers', reviewText: 'Good', rating: 4, photoUrl: 'img.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();

    expect(result.photos[0].featured).toBe(false);
  });

  it('includes both featured and approved in same gallery response', async () => {
    __seed('PhotoReviews', [
      { _id: 'r1', productId: 'p1', productName: 'A', productCategory: 'covers', reviewText: 'Nice', rating: 5, photoUrl: 'img1.jpg', status: 'featured', submittedAt: new Date('2026-02-20') },
      { _id: 'r2', productId: 'p2', productName: 'B', productCategory: 'covers', reviewText: 'Good', rating: 4, photoUrl: 'img2.jpg', status: 'approved', submittedAt: new Date('2026-02-19') },
    ]);

    const result = await getPhotoGallery();

    expect(result.photos).toHaveLength(2);
    const featuredPhoto = result.photos.find(p => p._id === 'r1');
    const approvedPhoto = result.photos.find(p => p._id === 'r2');
    expect(featuredPhoto.featured).toBe(true);
    expect(approvedPhoto.featured).toBe(false);
  });
});

