import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import {
  submitPhotoReview,
  getPhotoReviews,
  moderatePhotoReview,
  getPhotoGallery,
  getPhotoReviewStats,
} from '../src/backend/photoReviews.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
  __setRoles([{ _id: 'admin' }]);
});

// ── submitPhotoReview ─────────────────────────────────────────────────

describe('submitPhotoReview', () => {
  it('creates a pending photo review', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-eureka',
      productName: 'Eureka Futon Frame',
      productCategory: 'futon-frames',
      reviewText: 'This frame looks amazing in our living room! Solid build quality.',
      rating: 5,
      photoUrl: 'https://static.wixstatic.com/media/user-photo-1.jpg',
      photoCaption: 'Our new Eureka in the den',
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it('requires a product ID', async () => {
    const result = await submitPhotoReview({
      productId: '',
      reviewText: 'Great product, love it!',
      rating: 5,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('requires review text of at least 10 characters', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'Great!',
      rating: 5,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 10');
  });

  it('requires a photo URL', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'This is a great product with excellent quality.',
      rating: 5,
      photoUrl: '',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Photo');
  });

  it('clamps rating to 1-5', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'This is a great product with excellent quality.',
      rating: 99,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('sanitizes HTML in review text', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: '<script>alert(1)</script>Great frame, solid quality build!',
      rating: 5,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'This should fail because not logged in.',
      rating: 5,
      photoUrl: 'https://example.com/photo.jpg',
    });

    expect(result.success).toBe(false);
  });
});

// ── getPhotoReviews ───────────────────────────────────────────────────

describe('getPhotoReviews', () => {
  it('returns approved reviews for a product', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Great!', rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date('2026-02-20'), helpfulCount: 3 },
      { _id: 'r-2', productId: 'prod-1', reviewText: 'Awesome!', rating: 4, photoUrl: 'img2.jpg', status: 'featured', submittedAt: new Date('2026-02-19'), helpfulCount: 7 },
      { _id: 'r-3', productId: 'prod-1', reviewText: 'Pending', rating: 3, photoUrl: 'img3.jpg', status: 'pending', submittedAt: new Date('2026-02-18') },
      { _id: 'r-4', productId: 'prod-2', reviewText: 'Wrong product', rating: 5, photoUrl: 'img4.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoReviews('prod-1');
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(2);
  });

  it('sorts by most recent by default', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Older', rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date('2026-02-15') },
      { _id: 'r-2', productId: 'prod-1', reviewText: 'Newer', rating: 4, photoUrl: 'img2.jpg', status: 'approved', submittedAt: new Date('2026-02-20') },
    ]);

    const result = await getPhotoReviews('prod-1', 10, 'recent');
    expect(result.reviews[0].reviewText).toBe('Newer');
  });

  it('sorts by helpful count', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Less helpful', rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date(), helpfulCount: 2 },
      { _id: 'r-2', productId: 'prod-1', reviewText: 'Most helpful', rating: 4, photoUrl: 'img2.jpg', status: 'approved', submittedAt: new Date(), helpfulCount: 15 },
    ]);

    const result = await getPhotoReviews('prod-1', 10, 'helpful');
    expect(result.reviews[0].reviewText).toBe('Most helpful');
  });

  it('sorts by highest rating', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Good', rating: 3, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date() },
      { _id: 'r-2', productId: 'prod-1', reviewText: 'Best', rating: 5, photoUrl: 'img2.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoReviews('prod-1', 10, 'highest');
    expect(result.reviews[0].rating).toBe(5);
  });

  it('requires valid product ID', async () => {
    const result = await getPhotoReviews('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('returns empty for product with no reviews', async () => {
    __seed('PhotoReviews', []);
    const result = await getPhotoReviews('prod-empty');
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(0);
  });
});

// ── moderatePhotoReview ───────────────────────────────────────────────

describe('moderatePhotoReview', () => {
  it('approves a pending review', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Pending review', status: 'pending' },
    ]);

    const result = await moderatePhotoReview('r-1', 'approve');
    expect(result.success).toBe(true);
  });

  it('rejects a review', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Bad review', status: 'pending' },
    ]);

    const result = await moderatePhotoReview('r-1', 'reject');
    expect(result.success).toBe(true);
  });

  it('features a review', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Great review', status: 'approved' },
    ]);

    const result = await moderatePhotoReview('r-1', 'feature');
    expect(result.success).toBe(true);
  });

  it('requires valid review ID', async () => {
    const result = await moderatePhotoReview('', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('review ID');
  });

  it('rejects invalid moderation action', async () => {
    const result = await moderatePhotoReview('r-1', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid action');
  });

  it('handles non-existent review', async () => {
    __seed('PhotoReviews', []);
    const result = await moderatePhotoReview('nonexistent-id', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── getPhotoGallery ───────────────────────────────────────────────────

describe('getPhotoGallery', () => {
  it('returns approved/featured photos across products', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', productName: 'Eureka', productCategory: 'futon-frames', reviewText: 'Great!', rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date() },
      { _id: 'r-2', productId: 'prod-2', productName: 'Vienna', productCategory: 'futon-frames', reviewText: 'Beautiful!', rating: 4, photoUrl: 'img2.jpg', status: 'featured', submittedAt: new Date() },
      { _id: 'r-3', productId: 'prod-3', productName: 'Test', productCategory: 'mattresses', reviewText: 'Comfy!', rating: 5, photoUrl: 'img3.jpg', status: 'pending', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2);
  });

  it('filters by category', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', productName: 'Frame', productCategory: 'futon-frames', reviewText: 'Great frame', rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date() },
      { _id: 'r-2', productId: 'prod-2', productName: 'Mattress', productCategory: 'mattresses', reviewText: 'Comfy mattress', rating: 4, photoUrl: 'img2.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery('futon-frames');
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].productCategory).toBe('futon-frames');
  });

  it('marks featured photos', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', productName: 'Test', productCategory: 'covers', reviewText: 'Nice cover', rating: 5, photoUrl: 'img1.jpg', status: 'featured', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();
    expect(result.photos[0].featured).toBe(true);
  });

  it('truncates review text to 100 chars', async () => {
    const longText = 'A'.repeat(200);
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', productName: 'Test', productCategory: 'covers', reviewText: longText, rating: 5, photoUrl: 'img1.jpg', status: 'approved', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();
    expect(result.photos[0].reviewText.length).toBe(100);
  });

  it('returns empty when no approved photos', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', reviewText: 'Pending', rating: 5, photoUrl: 'img1.jpg', status: 'pending', submittedAt: new Date() },
    ]);

    const result = await getPhotoGallery();
    expect(result.photos).toHaveLength(0);
  });
});

// ── getPhotoReviewStats ───────────────────────────────────────────────

describe('getPhotoReviewStats', () => {
  it('returns review statistics for a product', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', rating: 5, photoUrl: 'img1.jpg', status: 'approved' },
      { _id: 'r-2', productId: 'prod-1', rating: 4, photoUrl: 'img2.jpg', status: 'approved' },
      { _id: 'r-3', productId: 'prod-1', rating: 5, photoUrl: 'img3.jpg', status: 'featured' },
      { _id: 'r-4', productId: 'prod-1', rating: 3, photoUrl: '', status: 'approved' },
      { _id: 'r-5', productId: 'prod-1', rating: 2, photoUrl: 'img5.jpg', status: 'pending' },
    ]);

    const result = await getPhotoReviewStats('prod-1');
    expect(result.success).toBe(true);
    expect(result.stats.totalReviews).toBe(4); // excludes pending
    expect(result.stats.averageRating).toBeCloseTo(4.3, 0);
    expect(result.stats.photoCount).toBe(3); // 3 with photoUrl among approved
    expect(result.stats.featuredCount).toBe(1);
    expect(result.stats.ratingDistribution[5]).toBe(2);
    expect(result.stats.ratingDistribution[4]).toBe(1);
    expect(result.stats.ratingDistribution[3]).toBe(1);
  });

  it('returns zero stats for product with no reviews', async () => {
    __seed('PhotoReviews', []);
    const result = await getPhotoReviewStats('prod-empty');
    expect(result.success).toBe(true);
    expect(result.stats.totalReviews).toBe(0);
    expect(result.stats.averageRating).toBe(0);
    expect(result.stats.photoCount).toBe(0);
  });

  it('requires valid product ID', async () => {
    const result = await getPhotoReviewStats('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('calculates correct rating distribution', async () => {
    __seed('PhotoReviews', [
      { _id: 'r-1', productId: 'prod-1', rating: 5, photoUrl: 'img.jpg', status: 'approved' },
      { _id: 'r-2', productId: 'prod-1', rating: 5, photoUrl: 'img.jpg', status: 'approved' },
      { _id: 'r-3', productId: 'prod-1', rating: 1, photoUrl: 'img.jpg', status: 'approved' },
    ]);

    const result = await getPhotoReviewStats('prod-1');
    expect(result.stats.ratingDistribution[5]).toBe(2);
    expect(result.stats.ratingDistribution[1]).toBe(1);
    expect(result.stats.ratingDistribution[3]).toBe(0);
  });
});
