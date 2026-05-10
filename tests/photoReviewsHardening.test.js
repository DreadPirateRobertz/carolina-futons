import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  moderatePhotoReview,
  getPhotoGallery,
} from '../src/backend/photoReviews.web.js';

const ADMIN_MEMBER = { _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' };

function seedPhotoReviews(items) { __seed('PhotoReviews', items); }

beforeEach(() => {
  resetData();
  resetMembers();
  __setMember(ADMIN_MEMBER);
});

// ═══════════════════════════════════════════════════════════════════
// 1. PHOTO REVIEW MODERATION WORKFLOW
// ═══════════════════════════════════════════════════════════════════

describe('photoReviews moderation workflow', () => {
  const pendingReview = {
    _id: 'pr-001', productId: 'prod-1', memberId: 'member-x',
    reviewText: 'Great futon!', rating: 5, photoUrl: 'https://img/1.jpg',
    status: 'pending', submittedAt: new Date('2026-03-01'),
    helpfulCount: 0, reportCount: 0, photoCaption: '',
  };

  it('approves a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('approved');
  });

  it('rejects a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'reject');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('rejected');
  });

  it('features a pending photo review', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('featured');
  });

  it('features an already-approved review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('approved');
    expect(result.newStatus).toBe('featured');
  });

  it('blocks approving an already-approved review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'approved' }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('approved');
  });

  it('blocks featuring a rejected review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'rejected' }]);
    const result = await moderatePhotoReview('pr-001', 'feature');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rejected');
  });

  it('allows re-queuing a rejected review (reject → pending not exposed, but approve blocked)', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'rejected' }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(false);
  });

  it('rejects an invalid action', async () => {
    seedPhotoReviews([{ ...pendingReview }]);
    const result = await moderatePhotoReview('pr-001', 'delete');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid action');
  });

  it('rejects an invalid review ID', async () => {
    const result = await moderatePhotoReview('', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Valid review ID');
  });

  it('returns error for non-existent review', async () => {
    const result = await moderatePhotoReview('nonexistent', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('can demote featured back to approved', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'featured' }]);
    const result = await moderatePhotoReview('pr-001', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('featured');
    expect(result.newStatus).toBe('approved');
  });

  it('can reject a featured review', async () => {
    seedPhotoReviews([{ ...pendingReview, status: 'featured' }]);
    const result = await moderatePhotoReview('pr-001', 'reject');
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. MODERATION WITH MISSING/CORRUPT STATUS FIELDS
// ═══════════════════════════════════════════════════════════════════

describe('photo moderation with missing status field', () => {
  it('photo review with undefined status falls back to pending and can be approved', async () => {
    seedPhotoReviews([{
      _id: 'pr-nostatus', productId: 'prod-1', memberId: 'member-x',
      reviewText: 'Great futon!', rating: 5, photoUrl: 'https://img/1.jpg',
      status: undefined, submittedAt: new Date(),
    }]);
    const result = await moderatePhotoReview('pr-nostatus', 'approve');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
    expect(result.newStatus).toBe('approved');
  });

  it('photo review with null status falls back to pending', async () => {
    seedPhotoReviews([{
      _id: 'pr-null', productId: 'prod-1', memberId: 'member-x',
      reviewText: 'Nice!', rating: 4, photoUrl: 'https://img/2.jpg',
      status: null, submittedAt: new Date(),
    }]);
    const result = await moderatePhotoReview('pr-null', 'reject');
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. PHOTO MODERATION DATABASE STATE VERIFICATION
// ═══════════════════════════════════════════════════════════════════

describe('photo moderation persists state correctly', () => {
  const review = {
    _id: 'pr-persist', productId: 'prod-1', memberId: 'member-x',
    reviewText: 'Great futon!', rating: 5, photoUrl: 'https://img/1.jpg',
    status: 'pending', submittedAt: new Date(), moderatedAt: null, moderatedBy: '',
  };

  it('persists approved status and moderator info to database', async () => {
    seedPhotoReviews([{ ...review }]);
    await moderatePhotoReview('pr-persist', 'approve');
    const updated = await wixData.get('PhotoReviews', 'pr-persist');
    expect(updated.status).toBe('approved');
    expect(updated.moderatedAt).toBeInstanceOf(Date);
    expect(updated.moderatedBy).toBe(ADMIN_MEMBER._id);
  });

  it('persists featured status to database', async () => {
    seedPhotoReviews([{ ...review }]);
    await moderatePhotoReview('pr-persist', 'feature');
    const updated = await wixData.get('PhotoReviews', 'pr-persist');
    expect(updated.status).toBe('featured');
    expect(updated.moderatedBy).toBe(ADMIN_MEMBER._id);
  });

  it('persists rejected status to database', async () => {
    seedPhotoReviews([{ ...review }]);
    await moderatePhotoReview('pr-persist', 'reject');
    const updated = await wixData.get('PhotoReviews', 'pr-persist');
    expect(updated.status).toBe('rejected');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════════

describe('getPhotoGallery', () => {
  it('returns approved and featured photos', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', productName: 'Futon A', productCategory: 'frames',
        rating: 5, status: 'featured', photoUrl: 'img1.jpg', reviewText: 'Amazing!',
        submittedAt: new Date('2026-03-15') },
      { _id: 'pr2', productId: 'prod-2', productName: 'Futon B', productCategory: 'frames',
        rating: 4, status: 'approved', photoUrl: 'img2.jpg', reviewText: 'Good',
        submittedAt: new Date('2026-03-10') },
      { _id: 'pr3', productId: 'prod-3', productName: 'Futon C', productCategory: 'frames',
        rating: 2, status: 'rejected', photoUrl: 'bad.jpg', reviewText: 'No',
        submittedAt: new Date('2026-03-12') },
    ]);
    const result = await getPhotoGallery();
    expect(result.success).toBe(true);
    expect(result.photos).toHaveLength(2);
    expect(result.photos[0].featured).toBe(true);
  });

  it('filters by category', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', productCategory: 'frames', rating: 5,
        status: 'approved', photoUrl: 'img1.jpg', submittedAt: new Date() },
      { _id: 'pr2', productId: 'prod-2', productCategory: 'mattresses', rating: 4,
        status: 'approved', photoUrl: 'img2.jpg', submittedAt: new Date() },
    ]);
    const result = await getPhotoGallery('frames');
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].productId).toBe('prod-1');
  });

  it('truncates review text to 100 chars', async () => {
    seedPhotoReviews([
      { _id: 'pr1', productId: 'prod-1', rating: 5, status: 'approved',
        photoUrl: 'img.jpg', reviewText: 'X'.repeat(200), submittedAt: new Date() },
    ]);
    const result = await getPhotoGallery();
    expect(result.photos[0].reviewText.length).toBe(100);
  });
});
