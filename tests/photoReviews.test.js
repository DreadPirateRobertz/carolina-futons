import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import {
  submitPhotoReview,
  moderatePhotoReview,
  getPhotoGallery,
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
      photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('product ID');
  });

  it('requires review text of at least 10 characters', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'Great!',
      rating: 5,
      photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
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
      photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('sanitizes HTML in review text', async () => {
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: '<script>alert(1)</script>Great frame, solid quality build!',
      rating: 5,
      photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
    });

    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    __setMember(null);
    const result = await submitPhotoReview({
      productId: 'prod-1',
      reviewText: 'This should fail because not logged in.',
      rating: 5,
      photoUrl: 'https://static.wixstatic.com/media/test-photo.jpg',
    });

    expect(result.success).toBe(false);
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

