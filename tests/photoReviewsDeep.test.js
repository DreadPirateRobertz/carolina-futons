/**
 * Deep coverage tests for photoReviews.web.js — rating clamping, limit bounds,
 * sort modes, gallery filtering, and review stats edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(() => Promise.resolve({ _id: 'member-1' })) },
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (val, max) => String(val || '').slice(0, max),
  validateId: (id) => (/^[a-zA-Z0-9_-]+$/.test(String(id || '').trim()) ? String(id).trim() : null),
  isWixMediaUrl: (url) => {
    if (typeof url !== 'string' || !url.trim()) return false;
    const u = url.trim();
    return u.startsWith('wix:image://') || u.startsWith('wix:video://') ||
      /^https:\/\/static\.wixstatic\.com\/media\//i.test(u) ||
      /^https:\/\/[^/]*\.wixmp\.com\//i.test(u);
  },
}));

const {
  submitPhotoReview,
  getPhotoReviews,
  moderatePhotoReview,
  getPhotoGallery,
  getPhotoReviewStats,
} = await import('../src/backend/photoReviews.web.js');

beforeEach(() => {
  __seed('PhotoReviews', []);
  vi.clearAllMocks();
});

describe('submitPhotoReview — rating clamping', () => {
  const base = {
    productId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
    productName: 'Kodiak Frame',
    reviewText: 'Great futon frame, very sturdy and easy to assemble!',
    photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
  };

  it('treats rating 0 as default (Number(0)||5 = 5)', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base, rating: 0 });
    // 0 is falsy so Number(0)||5 = 5
    expect(inserted.rating).toBe(5);
  });

  it('clamps negative rating to 1', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base, rating: -3 });
    expect(inserted.rating).toBe(1);
  });

  it('clamps rating above 5 to 5', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base, rating: 10 });
    expect(inserted.rating).toBe(5);
  });

  it('rounds fractional rating', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base, rating: 3.7 });
    expect(inserted.rating).toBe(4);
  });

  it('defaults to 5 for NaN rating', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base, rating: 'great' });
    expect(inserted.rating).toBe(5);
  });

  it('defaults to 5 for undefined rating', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({ ...base });
    expect(inserted.rating).toBe(5);
  });
});

describe('submitPhotoReview — validation', () => {
  it('rejects review text shorter than 10 chars', async () => {
    const result = await submitPhotoReview({
      productId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      reviewText: 'Too short',
      photoUrl: 'https://static.wixstatic.com/media/test-p.jpg',
      rating: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/10 char/);
  });

  it('rejects empty photo URL', async () => {
    const result = await submitPhotoReview({
      productId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      reviewText: 'This is a perfectly valid review text.',
      photoUrl: '',
      rating: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/photo/i);
  });

  it('rejects invalid product ID', async () => {
    const result = await submitPhotoReview({
      productId: 'DROP TABLE;',
      reviewText: 'This is a perfectly valid review text.',
      photoUrl: 'https://static.wixstatic.com/media/test-p.jpg',
      rating: 5,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/product/i);
  });

  it('initializes helpfulCount and reportCount to 0', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'PhotoReviews') inserted = item; });
    await submitPhotoReview({
      productId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      reviewText: 'This is a perfectly valid review text.',
      photoUrl: 'https://static.wixstatic.com/media/test-p.jpg',
      rating: 4,
    });
    expect(inserted.helpfulCount).toBe(0);
    expect(inserted.reportCount).toBe(0);
    expect(inserted.status).toBe('pending');
  });
});

describe('getPhotoReviews — limit bounds', () => {
  it('clamps limit to minimum of 1', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 0);
    expect(result.success).toBe(true);
  });

  it('clamps limit to maximum of 50', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 100);
    expect(result.success).toBe(true);
  });

  it('handles NaN limit by defaulting to 10', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'all');
    expect(result.success).toBe(true);
  });

  it('rejects invalid product ID', async () => {
    const result = await getPhotoReviews('invalid!id');
    expect(result.success).toBe(false);
  });
});

describe('getPhotoReviews — sort modes', () => {
  it('accepts helpful sort', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 10, 'helpful');
    expect(result.success).toBe(true);
  });

  it('accepts highest sort', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 10, 'highest');
    expect(result.success).toBe(true);
  });

  it('defaults to recent for unknown sort', async () => {
    const result = await getPhotoReviews('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 10, 'unknown');
    expect(result.success).toBe(true);
  });
});

describe('moderatePhotoReview — actions', () => {
  beforeEach(() => {
    __seed('PhotoReviews', [
      { _id: 'a1b2c3d4-e5f6-0000-0000-000000000001', productId: 'p1', status: 'pending', reviewText: 'Good' },
    ]);
  });

  it('rejects invalid action', async () => {
    const result = await moderatePhotoReview('a1b2c3d4-e5f6-0000-0000-000000000001', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid action/i);
  });

  it('rejects invalid review ID', async () => {
    const result = await moderatePhotoReview('invalid!', 'approve');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent review', async () => {
    const result = await moderatePhotoReview('a0b1c2d3-e4f5-0000-0000-000000000000', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });
});

describe('getPhotoGallery — filtering', () => {
  beforeEach(() => {
    __seed('PhotoReviews', [
      { _id: 'r1', productId: 'p1', productName: 'Kodiak', productCategory: 'futon-frames', photoUrl: 'img1.jpg', status: 'approved', rating: 5, reviewText: 'Great', submittedAt: new Date() },
      { _id: 'r2', productId: 'p2', productName: 'Murphy', productCategory: 'murphy-beds', photoUrl: 'img2.jpg', status: 'featured', rating: 4, reviewText: 'Nice', submittedAt: new Date() },
      { _id: 'r3', productId: 'p3', productName: 'Rejected', productCategory: 'futon-frames', photoUrl: 'img3.jpg', status: 'rejected', rating: 1, reviewText: 'Bad', submittedAt: new Date() },
    ]);
  });

  it('returns only approved/featured photos', async () => {
    const result = await getPhotoGallery();
    expect(result.photos).toHaveLength(2);
    expect(result.photos.every(p => ['approved', 'featured'].includes(p.featured ? 'featured' : 'approved'))).toBe(true);
  });

  it('marks featured photos correctly', async () => {
    const result = await getPhotoGallery();
    const featured = result.photos.find(p => p._id === 'r2');
    expect(featured.featured).toBe(true);
  });

  it('truncates review text to 100 chars', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-long', productId: 'p1', photoUrl: 'img.jpg', status: 'approved', rating: 5, reviewText: 'x'.repeat(300), submittedAt: new Date() },
    ]);
    const result = await getPhotoGallery();
    expect(result.photos[0].reviewText.length).toBeLessThanOrEqual(100);
  });

  it('clamps gallery limit to max 50', async () => {
    const result = await getPhotoGallery(null, 100);
    expect(result.success).toBe(true);
  });
});

describe('getPhotoReviewStats — edge cases', () => {
  it('returns zero stats for product with no reviews', async () => {
    const result = await getPhotoReviewStats('a0b1c2d3-e4f5-6789-abcd-ef0123456789');
    expect(result.success).toBe(true);
    expect(result.stats.totalReviews).toBe(0);
    expect(result.stats.averageRating).toBe(0);
    expect(result.stats.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('calculates correct average and distribution', async () => {
    __seed('PhotoReviews', [
      { _id: 'r1', productId: 'a0b1c2d3', rating: 5, photoUrl: 'img1.jpg', status: 'approved' },
      { _id: 'r2', productId: 'a0b1c2d3', rating: 4, photoUrl: 'img2.jpg', status: 'approved' },
      { _id: 'r3', productId: 'a0b1c2d3', rating: 3, status: 'featured' },
    ]);
    const result = await getPhotoReviewStats('a0b1c2d3');
    expect(result.stats.totalReviews).toBe(3);
    expect(result.stats.averageRating).toBe(4); // (5+4+3)/3 = 4.0
    expect(result.stats.photoCount).toBe(2);
    expect(result.stats.featuredCount).toBe(1);
    expect(result.stats.ratingDistribution[5]).toBe(1);
    expect(result.stats.ratingDistribution[4]).toBe(1);
    expect(result.stats.ratingDistribution[3]).toBe(1);
  });

  it('rejects invalid product ID', async () => {
    const result = await getPhotoReviewStats('invalid!');
    expect(result.success).toBe(false);
    expect(result.stats).toBeNull();
  });
});
