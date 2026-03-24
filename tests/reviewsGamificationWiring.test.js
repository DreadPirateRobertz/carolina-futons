/**
 * @file reviewsGamificationWiring.test.js
 * Tests: gamification_submit_review fires on review submission (cf-s911).
 *
 * Covers reviewsService.submitReview and photoReviews.submitPhotoReview.
 * Both fire receiveGamificationEvent non-blocking after insert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

// ── Gamification mock — vi.fn() inline to avoid TDZ with hoisted vi.mock ──────

vi.mock('backend/gamificationEventReceiver.web', () => ({
  receiveGamificationEvent: vi.fn().mockResolvedValue({ success: true }),
}));

// ── Source modules imported AFTER mocks ───────────────────────────────────────

import { submitReview } from '../src/backend/reviewsService.web.js';
import { submitPhotoReview } from '../src/backend/photoReviews.web.js';
import { receiveGamificationEvent } from 'backend/gamificationEventReceiver.web';

const mockFn = vi.mocked(receiveGamificationEvent);

// ── Test data ──────────────────────────────────────────────────────────────────

const MEMBER_ID = 'test-member-1';
const VALID_REVIEW = {
  productId: 'prod-abc123',
  rating: 5,
  title: 'Great futon',
  body: 'Really solid build, very comfortable and easy to set up.',
  photos: [],
};

const VALID_PHOTO_REVIEW = {
  productId: 'prod-abc123',
  productName: 'Test Futon',
  reviewText: 'Great photo review, solid product with excellent quality.',
  rating: 4,
  photoUrl: 'wix:image://v1/abc123~mv2.jpg/photo.jpg#originWidth=800&originHeight=600',
};

beforeEach(() => {
  resetData();
  resetMembers();
  vi.clearAllMocks();
  __setMember({ _id: MEMBER_ID, profile: { nickname: 'Tester' } });
  __seed('Reviews', []);
  __seed('PhotoReviews', []);
});

// ── reviewsService.submitReview ────────────────────────────────────────────────

describe('reviewsService.submitReview — gamification wiring', () => {
  it('fires gamification_submit_review after successful submit', async () => {
    const result = await submitReview(VALID_REVIEW);
    expect(result.success).toBe(true);
    expect(mockFn).toHaveBeenCalledWith(
      'gamification_submit_review',
      expect.objectContaining({ has_photo: false }),
      MEMBER_ID,
    );
  });

  it('passes has_photo: true when review includes photos', async () => {
    const reviewWithPhoto = {
      ...VALID_REVIEW,
      photos: ['wix:image://v1/abc~mv2.jpg/img.jpg#originWidth=800&originHeight=600'],
    };
    const result = await submitReview(reviewWithPhoto);
    expect(result.success).toBe(true);
    expect(mockFn).toHaveBeenCalledWith(
      'gamification_submit_review',
      { has_photo: true },
      MEMBER_ID,
    );
  });

  it('passes has_photo: false when review has no photos', async () => {
    await submitReview(VALID_REVIEW);
    expect(mockFn).toHaveBeenCalled();
    const [, payload] = mockFn.mock.calls[0];
    expect(payload.has_photo).toBe(false);
  });

  it('does NOT fire gamification event when review is a duplicate', async () => {
    __seed('Reviews', [
      { _id: 'existing', productId: 'prod-abc123', memberId: MEMBER_ID },
    ]);
    const result = await submitReview(VALID_REVIEW);
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('does NOT fire gamification event when validation fails (bad rating)', async () => {
    const result = await submitReview({ ...VALID_REVIEW, rating: 99 });
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('does NOT fire gamification event when body is too short', async () => {
    const result = await submitReview({ ...VALID_REVIEW, body: 'short' });
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('does NOT fire gamification event when unauthenticated', async () => {
    __setMember(null);
    const result = await submitReview(VALID_REVIEW);
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('still returns success when gamification event rejects', async () => {
    mockFn.mockRejectedValueOnce(new Error('gamif down'));
    const result = await submitReview(VALID_REVIEW);
    // Non-blocking: gamification failure must not break review submission
    expect(result.success).toBe(true);
  });
});

// ── photoReviews.submitPhotoReview ────────────────────────────────────────────

describe('photoReviews.submitPhotoReview — gamification wiring', () => {
  it('fires gamification_submit_review after successful submit', async () => {
    const result = await submitPhotoReview(VALID_PHOTO_REVIEW);
    expect(result.success).toBe(true);
    expect(mockFn).toHaveBeenCalledWith(
      'gamification_submit_review',
      { has_photo: true },
      MEMBER_ID,
    );
  });

  it('always passes has_photo: true (photo is required for photo reviews)', async () => {
    await submitPhotoReview(VALID_PHOTO_REVIEW);
    expect(mockFn).toHaveBeenCalled();
    const [event, payload] = mockFn.mock.calls[0];
    expect(event).toBe('gamification_submit_review');
    expect(payload.has_photo).toBe(true);
  });

  it('does NOT fire gamification event when photo URL is invalid', async () => {
    const result = await submitPhotoReview({
      ...VALID_PHOTO_REVIEW,
      photoUrl: 'https://malicious.example.com/evil.jpg',
    });
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('does NOT fire gamification event when review text is too short', async () => {
    const result = await submitPhotoReview({ ...VALID_PHOTO_REVIEW, reviewText: 'short' });
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('does NOT fire gamification event when unauthenticated', async () => {
    __setMember(null);
    const result = await submitPhotoReview(VALID_PHOTO_REVIEW);
    expect(result.success).toBe(false);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it('still returns success when gamification event rejects', async () => {
    mockFn.mockRejectedValueOnce(new Error('gamif down'));
    const result = await submitPhotoReview(VALID_PHOTO_REVIEW);
    // Non-blocking: gamification failure must not break review submission
    expect(result.success).toBe(true);
  });
});
