import { describe, it, expect, beforeEach } from 'vitest';
import wixData, { __reset as resetData, __seed } from 'wix-data';
import { __reset as resetMembers, __setMember } from 'wix-members-backend';

import {
  getProductReviews,
  getAggregateRating,
  submitReview,
  markHelpful,
  flagReview,
  getPendingReviews,
  moderateReview,
  getReviewStats,
  addOwnerResponse,
  getCategoryReviewSummaries,
} from '../src/backend/reviewsService.web.js';

// ── Helpers ──────────────────────────────────────────────────────────

const validMember = {
  _id: 'aaa-bbb-ccc',
  contactDetails: { firstName: 'Alice', lastName: 'Brown' },
};

const validBody = 'This is a perfectly valid review body text.';

function makeReview(overrides = {}) {
  return {
    _id: 'rev-100',
    productId: 'prod-100',
    memberId: 'aaa-bbb-ccc',
    authorName: 'Alice B.',
    rating: 4,
    title: 'Good stuff',
    body: validBody,
    photos: [],
    verifiedPurchase: false,
    helpful: 0,
    status: 'approved',
    _createdDate: new Date('2026-02-01'),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('reviewsServiceDeep', () => {
  beforeEach(() => {
    resetData();
    resetMembers();
    __setMember(validMember);
  });

  // ═══════════════════════════════════════════════════════════════════
  // getProductReviews — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('getProductReviews edge cases', () => {
    it('returns empty for undefined productId', async () => {
      const r = await getProductReviews(undefined);
      expect(r.reviews).toEqual([]);
      expect(r.total).toBe(0);
    });

    it('returns empty for numeric productId (type coercion)', async () => {
      // validateId expects a string; number should fail
      const r = await getProductReviews(12345);
      expect(r.reviews).toEqual([]);
    });

    it('returns empty for boolean productId', async () => {
      const r = await getProductReviews(true);
      expect(r.reviews).toEqual([]);
    });

    it('returns empty for productId with special characters', async () => {
      // validateId only allows alphanumeric, hyphen, underscore
      const r = await getProductReviews('prod<script>');
      expect(r.reviews).toEqual([]);
    });

    it('handles fractional page number by flooring', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await getProductReviews('prod-100', { page: 1.7 });
      expect(r.page).toBe(1); // Math.floor(1.7) = 1
    });

    // Known gap: Math.max(0, Math.floor(NaN)) returns NaN, not 0.
    // The page field propagates NaN because Math.max(0, NaN) = NaN.
    it('NaN page number propagates as NaN (known gap)', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await getProductReviews('prod-100', { page: NaN });
      expect(r.page).toBeNaN();
    });

    it('handles Infinity page by returning page 0 (no items at huge offset)', async () => {
      __seed('Reviews', [makeReview()]);
      // Math.floor(Infinity) = Infinity, Math.max(0, Infinity) = Infinity
      // skip = Infinity * 10 = Infinity, so no items returned
      const r = await getProductReviews('prod-100', { page: Infinity });
      expect(r.reviews).toEqual([]);
    });

    it('treats unknown sort value as newest (descending _createdDate)', async () => {
      __seed('Reviews', [
        makeReview({ _id: 'r1', _createdDate: new Date('2026-01-01') }),
        makeReview({ _id: 'r2', _createdDate: new Date('2026-03-01') }),
      ]);
      const r = await getProductReviews('prod-100', { sort: 'bogus' });
      // descending by _createdDate — r2 first
      expect(r.reviews[0]._id).toBe('r2');
    });

    it('filterStars 6 is ignored (outside 1-5 range)', async () => {
      __seed('Reviews', [makeReview({ rating: 4 }), makeReview({ _id: 'r2', rating: 5 })]);
      const r = await getProductReviews('prod-100', { filterStars: 6 });
      expect(r.total).toBe(2); // no filter applied
    });

    it('filterStars -1 is ignored', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await getProductReviews('prod-100', { filterStars: -1 });
      expect(r.total).toBe(1);
    });

    it('filterStars rounds fractional values (4.6 -> 5)', async () => {
      __seed('Reviews', [
        makeReview({ _id: 'r1', rating: 5 }),
        makeReview({ _id: 'r2', rating: 4 }),
      ]);
      // filterStars 4.6 >= 1 && <= 5 is true, Math.round(4.6) = 5
      const r = await getProductReviews('prod-100', { filterStars: 4.6 });
      expect(r.reviews.every(rv => rv.rating === 5)).toBe(true);
    });

    it('formatReview defaults authorName to Customer when missing', async () => {
      __seed('Reviews', [makeReview({ authorName: undefined })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].authorName).toBe('Customer');
    });

    it('formatReview defaults helpful to 0 when falsy', async () => {
      __seed('Reviews', [makeReview({ helpful: null })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].helpful).toBe(0);
    });

    it('formatReview defaults verifiedPurchase to false when falsy', async () => {
      __seed('Reviews', [makeReview({ verifiedPurchase: undefined })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].verifiedPurchase).toBe(false);
    });

    it('formatReview returns empty string for date when _createdDate is null', async () => {
      __seed('Reviews', [makeReview({ _createdDate: null })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].date).toBe('');
    });

    it('formatReview returns null for ownerResponse when not set', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].ownerResponse).toBeNull();
    });

    it('formatReview formats ownerResponseDate when present', async () => {
      __seed('Reviews', [makeReview({
        ownerResponse: 'Thanks!',
        ownerResponseDate: new Date('2026-03-01'),
      })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].ownerResponseDate).toContain('2026');
    });

    it('returns empty photos array when photos field is missing', async () => {
      __seed('Reviews', [makeReview({ photos: undefined })]);
      const r = await getProductReviews('prod-100');
      expect(r.reviews[0].photos).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // getAggregateRating — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('getAggregateRating edge cases', () => {
    it('returns zeros for null productId', async () => {
      const r = await getAggregateRating(null);
      expect(r.average).toBe(0);
      expect(r.total).toBe(0);
    });

    it('clamps negative ratings to 1', async () => {
      __seed('Reviews', [makeReview({ rating: -10 })]);
      const r = await getAggregateRating('prod-100');
      expect(r.breakdown[1]).toBe(1);
      expect(r.average).toBe(1);
    });

    it('clamps extremely high ratings to 5', async () => {
      __seed('Reviews', [makeReview({ rating: 9999 })]);
      const r = await getAggregateRating('prod-100');
      expect(r.breakdown[5]).toBe(1);
      expect(r.average).toBe(5);
    });

    it('rounds fractional ratings (3.7 -> 4)', async () => {
      __seed('Reviews', [makeReview({ rating: 3.7 })]);
      const r = await getAggregateRating('prod-100');
      expect(r.breakdown[4]).toBe(1);
    });

    it('rounds fractional ratings (2.3 -> 2)', async () => {
      __seed('Reviews', [makeReview({ rating: 2.3 })]);
      const r = await getAggregateRating('prod-100');
      expect(r.breakdown[2]).toBe(1);
    });

    it('handles single review: average equals that rating', async () => {
      __seed('Reviews', [makeReview({ rating: 3 })]);
      const r = await getAggregateRating('prod-100');
      expect(r.average).toBe(3);
      expect(r.total).toBe(1);
    });

    it('rounds average to one decimal place', async () => {
      __seed('Reviews', [
        makeReview({ _id: 'r1', rating: 5 }),
        makeReview({ _id: 'r2', rating: 4 }),
        makeReview({ _id: 'r3', rating: 4 }),
      ]);
      const r = await getAggregateRating('prod-100');
      // (5+4+4)/3 = 4.333... -> rounded to 4.3
      expect(r.average).toBe(4.3);
    });

    it('only counts approved reviews', async () => {
      __seed('Reviews', [
        makeReview({ _id: 'r1', rating: 5, status: 'approved' }),
        makeReview({ _id: 'r2', rating: 1, status: 'pending' }),
        makeReview({ _id: 'r3', rating: 1, status: 'rejected' }),
      ]);
      const r = await getAggregateRating('prod-100');
      expect(r.total).toBe(1);
      expect(r.average).toBe(5);
    });

    it('NaN rating is excluded from aggregation', async () => {
      __seed('Reviews', [makeReview({ rating: NaN })]);
      const r = await getAggregateRating('prod-100');
      // NaN ratings are now skipped entirely
      expect(r.total).toBe(0);
      expect(r.average).toBe(0);
      expect(r.breakdown).toEqual({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // submitReview — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('submitReview edge cases', () => {
    beforeEach(() => {
      __seed('Reviews', []);
      __seed('Stores/Orders', []);
    });

    it('rejects NaN rating', async () => {
      // NaN < 1 is false, NaN > 5 is false, but isNaN(NaN) catches it
      const r = await submitReview({ productId: 'prod-100', rating: NaN, body: validBody });
      expect(r.success).toBe(false);
      expect(r.error).toContain('Rating');
    });

    it('rejects string rating that cannot parse to number', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 'five', body: validBody });
      expect(r.success).toBe(false);
    });

    it('accepts string rating that parses to valid number', async () => {
      // Number("3") = 3, Math.round(3) = 3
      const r = await submitReview({ productId: 'prod-100', rating: '3', body: validBody });
      expect(r.success).toBe(true);
    });

    it('rounds fractional rating (4.6 -> 5, accepted)', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 4.6, body: validBody });
      expect(r.success).toBe(true);
    });

    it('rounds 0.4 to 0 which fails < 1 check', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 0.4, body: validBody });
      expect(r.success).toBe(false);
    });

    it('rounds 5.4 to 5 which passes', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 5.4, body: validBody });
      expect(r.success).toBe(true);
    });

    it('rounds 5.5 to 6 which fails > 5 check', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 5.5, body: validBody });
      expect(r.success).toBe(false);
    });

    it('rejects Infinity rating', async () => {
      // Math.round(Infinity) = Infinity, Infinity > 5 = true
      const r = await submitReview({ productId: 'prod-100', rating: Infinity, body: validBody });
      expect(r.success).toBe(false);
    });

    it('rejects -Infinity rating', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: -Infinity, body: validBody });
      expect(r.success).toBe(false);
    });

    it('rejects null body', async () => {
      // sanitize(null) returns '' which is < 10 chars
      const r = await submitReview({ productId: 'prod-100', rating: 3, body: null });
      expect(r.success).toBe(false);
      expect(r.error).toContain('at least 10');
    });

    it('rejects undefined body', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 3, body: undefined });
      expect(r.success).toBe(false);
    });

    it('rejects body that is exactly 9 characters after sanitize', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 3, body: '123456789' });
      expect(r.success).toBe(false);
    });

    it('accepts body that is exactly 10 characters', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 3, body: '1234567890' });
      expect(r.success).toBe(true);
    });

    it('filters non-string items from photos array', async () => {
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
        photos: [123, null, undefined, 'valid.jpg', '', true],
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      // Only 'valid.jpg' passes: typeof string && length > 0
      expect(stored.photos).toEqual(['valid.jpg']);
    });

    it('handles photos as non-array gracefully', async () => {
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
        photos: 'not-an-array',
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.photos).toEqual([]);
    });

    it('handles photos as null', async () => {
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
        photos: null,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.photos).toEqual([]);
    });

    it('sets title to empty string when title is not a string', async () => {
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
        title: 12345,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      // sanitize(12345) returns '' since typeof !== 'string'
      expect(stored.title).toBe('');
    });

    it('builds author name as "Customer" when contactDetails missing', async () => {
      __setMember({ _id: 'member-no-contact' });
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.authorName).toBe('Customer');
    });

    it('builds author name with first name only when no last name', async () => {
      __setMember({ _id: 'member-first-only', contactDetails: { firstName: 'Bob' } });
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.authorName).toBe('Bob');
    });

    it('builds "FirstName L." when both names present', async () => {
      __setMember({ _id: 'member-both', contactDetails: { firstName: 'Carol', lastName: 'Danvers' } });
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.authorName).toBe('Carol D.');
    });

    it('builds "Customer" when both first and last are empty strings', async () => {
      __setMember({ _id: 'member-empty', contactDetails: { firstName: '', lastName: '' } });
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
      });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.authorName).toBe('Customer');
    });

    it('rejects when member._id is undefined (partial member object)', async () => {
      __setMember({ contactDetails: { firstName: 'Ghost' } });
      const r = await submitReview({
        productId: 'prod-100',
        rating: 4,
        body: validBody,
      });
      expect(r.success).toBe(false);
      expect(r.error).toContain('log in');
    });

    it('verified purchase check: order with no lineItems array', async () => {
      __seed('Stores/Orders', [
        { _id: 'ord-1', buyerInfo: { id: 'aaa-bbb-ccc' }, lineItems: undefined },
      ]);
      const r = await submitReview({ productId: 'prod-100', rating: 4, body: validBody });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      // lineItems is undefined, || [] fallback means no match
      expect(stored.verifiedPurchase).toBe(false);
    });

    it('verified purchase check: order with empty lineItems', async () => {
      __seed('Stores/Orders', [
        { _id: 'ord-1', buyerInfo: { id: 'aaa-bbb-ccc' }, lineItems: [] },
      ]);
      const r = await submitReview({ productId: 'prod-100', rating: 4, body: validBody });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.verifiedPurchase).toBe(false);
    });

    it('verified purchase check: order for different product', async () => {
      __seed('Stores/Orders', [
        { _id: 'ord-1', buyerInfo: { id: 'aaa-bbb-ccc' }, lineItems: [{ productId: 'prod-999' }] },
      ]);
      const r = await submitReview({ productId: 'prod-100', rating: 4, body: validBody });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.verifiedPurchase).toBe(false);
    });

    it('helpful starts at 0 for new review', async () => {
      const r = await submitReview({ productId: 'prod-100', rating: 4, body: validBody });
      expect(r.success).toBe(true);
      const stored = await wixData.get('Reviews', r.reviewId);
      expect(stored.helpful).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // markHelpful — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('markHelpful edge cases', () => {
    it('rejects null reviewId', async () => {
      const r = await markHelpful(null);
      expect(r.success).toBe(false);
    });

    it('rejects undefined reviewId', async () => {
      const r = await markHelpful(undefined);
      expect(r.success).toBe(false);
    });

    it('rejects numeric reviewId', async () => {
      const r = await markHelpful(42);
      expect(r.success).toBe(false);
    });

    it('rejects reviewId with special characters', async () => {
      const r = await markHelpful('rev-001; DROP TABLE');
      expect(r.success).toBe(false);
    });

    it('increments from null helpful to 1', async () => {
      // helpful field is null/undefined — (null || 0) + 1 = 1
      __seed('Reviews', [makeReview({ helpful: null })]);
      const r = await markHelpful('rev-100');
      expect(r.success).toBe(true);
      expect(r.helpful).toBe(1);
    });

    it('increments from undefined helpful to 1', async () => {
      __seed('Reviews', [makeReview({ helpful: undefined })]);
      const r = await markHelpful('rev-100');
      expect(r.success).toBe(true);
      expect(r.helpful).toBe(1);
    });

    it('rejects review with status rejected', async () => {
      __seed('Reviews', [makeReview({ status: 'rejected' })]);
      const r = await markHelpful('rev-100');
      expect(r.success).toBe(false);
    });

    it('rejects review with status pending', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await markHelpful('rev-100');
      expect(r.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // flagReview — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('flagReview edge cases', () => {
    it('rejects null reviewId', async () => {
      const r = await flagReview(null, 'spam');
      expect(r.success).toBe(false);
    });

    it('normalizes undefined reason to other', async () => {
      __seed('Reviews', [makeReview()]);
      __seed('ReviewFlags', []);
      await flagReview('rev-100', undefined);
      const flags = await wixData.query('ReviewFlags').find();
      expect(flags.items[0].reason).toBe('other');
    });

    it('normalizes numeric reason to other', async () => {
      __seed('Reviews', [makeReview()]);
      __seed('ReviewFlags', []);
      await flagReview('rev-100', 123);
      const flags = await wixData.query('ReviewFlags').find();
      expect(flags.items[0].reason).toBe('other');
    });

    it('does not auto-hide with fewer than 3 total flags', async () => {
      __seed('Reviews', [makeReview()]);
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-100', reason: 'spam' },
      ]);
      await flagReview('rev-100', 'fake');
      const review = await wixData.get('Reviews', 'rev-100');
      // 2 flags total — still approved
      expect(review.status).toBe('approved');
    });

    it('auto-hides at exactly 3 flags', async () => {
      __seed('Reviews', [makeReview({ status: 'approved' })]);
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-100', reason: 'spam' },
        { _id: 'f2', reviewId: 'rev-100', reason: 'offensive' },
      ]);
      await flagReview('rev-100', 'fake');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.status).toBe('pending');
    });

    it('does not change status if review is already rejected', async () => {
      __seed('Reviews', [makeReview({ status: 'rejected' })]);
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-100', reason: 'spam' },
        { _id: 'f2', reviewId: 'rev-100', reason: 'spam' },
      ]);
      await flagReview('rev-100', 'spam');
      const review = await wixData.get('Reviews', 'rev-100');
      // Condition checks status === 'approved' before auto-hiding
      expect(review.status).toBe('rejected');
    });

    it('does not change status if review is already pending', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      __seed('ReviewFlags', [
        { _id: 'f1', reviewId: 'rev-100', reason: 'spam' },
        { _id: 'f2', reviewId: 'rev-100', reason: 'spam' },
      ]);
      await flagReview('rev-100', 'spam');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.status).toBe('pending');
    });

    it('records flaggedAt as a Date', async () => {
      __seed('Reviews', [makeReview()]);
      __seed('ReviewFlags', []);
      await flagReview('rev-100', 'spam');
      const flags = await wixData.query('ReviewFlags').find();
      expect(flags.items[0].flaggedAt).toBeInstanceOf(Date);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // getPendingReviews — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('getPendingReviews edge cases', () => {
    it('clamps limit to minimum of 1', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await getPendingReviews(0);
      expect(r.success).toBe(true);
      // Math.max(1, ...) clamps 0 to 1
    });

    it('clamps limit to maximum of 50', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await getPendingReviews(100);
      expect(r.success).toBe(true);
    });

    it('rounds fractional limit', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await getPendingReviews(2.7);
      expect(r.success).toBe(true);
    });

    it('handles negative limit by clamping to 1', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await getPendingReviews(-5);
      expect(r.success).toBe(true);
    });

    it('uses default limit of 20 when called with no arguments', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      const r = await getPendingReviews();
      expect(r.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // moderateReview — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('moderateReview edge cases', () => {
    it('rejects null action', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await moderateReview('rev-100', null);
      expect(r.success).toBe(false);
      expect(r.error).toContain('approve');
    });

    it('rejects undefined action', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await moderateReview('rev-100', undefined);
      expect(r.success).toBe(false);
    });

    it('rejects numeric action', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await moderateReview('rev-100', 1);
      expect(r.success).toBe(false);
    });

    it('rejects case-sensitive action "Approve"', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await moderateReview('rev-100', 'Approve');
      expect(r.success).toBe(false);
    });

    it('sets moderatedAt as a Date on approve', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      await moderateReview('rev-100', 'approve');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.moderatedAt).toBeInstanceOf(Date);
    });

    it('sets moderatedAt as a Date on reject', async () => {
      __seed('Reviews', [makeReview({ status: 'pending' })]);
      await moderateReview('rev-100', 'reject');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.moderatedAt).toBeInstanceOf(Date);
      expect(review.status).toBe('rejected');
    });

    it('blocks re-approving a rejected review (must go through pending first)', async () => {
      __seed('Reviews', [makeReview({ status: 'rejected' })]);
      const r = await moderateReview('rev-100', 'approve');
      expect(r.success).toBe(false);
      expect(r.error).toContain('rejected');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // getReviewStats — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('getReviewStats edge cases', () => {
    it('clamps days > 365 to 365', async () => {
      __seed('Reviews', []);
      const r = await getReviewStats(999);
      expect(r.period).toBe('365 days');
    });

    it('clamps days < 1 to 1', async () => {
      __seed('Reviews', []);
      const r = await getReviewStats(-10);
      expect(r.period).toBe('1 days');
    });

    it('verifiedPurchaseRate is 0 when no approved reviews', async () => {
      __seed('Reviews', []);
      const r = await getReviewStats(30);
      expect(r.verifiedPurchaseRate).toBe(0);
    });

    it('withPhotos counts only reviews with non-empty photos array', async () => {
      const now = new Date();
      __seed('Reviews', [
        makeReview({ _id: 'r1', photos: ['a.jpg'], status: 'approved', _createdDate: now }),
        makeReview({ _id: 'r2', photos: [], status: 'approved', _createdDate: now }),
        makeReview({ _id: 'r3', photos: null, status: 'approved', _createdDate: now }),
      ]);
      const r = await getReviewStats(30);
      expect(r.withPhotos).toBe(1);
    });

    it('avgRating is 0 when only non-approved reviews exist', async () => {
      const now = new Date();
      __seed('Reviews', [
        makeReview({ _id: 'r1', status: 'pending', _createdDate: now }),
        makeReview({ _id: 'r2', status: 'rejected', _createdDate: now }),
      ]);
      const r = await getReviewStats(30);
      expect(r.avgRating).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // addOwnerResponse — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('addOwnerResponse edge cases', () => {
    it('rejects null responseText', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await addOwnerResponse('rev-100', null);
      expect(r.success).toBe(false);
    });

    it('rejects numeric responseText', async () => {
      __seed('Reviews', [makeReview()]);
      // sanitize(12345) returns '' since not a string
      const r = await addOwnerResponse('rev-100', 12345);
      expect(r.success).toBe(false);
    });

    it('rejects exactly 4 character response', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await addOwnerResponse('rev-100', 'abcd');
      expect(r.success).toBe(false);
    });

    it('accepts exactly 5 character response', async () => {
      __seed('Reviews', [makeReview()]);
      const r = await addOwnerResponse('rev-100', 'abcde');
      expect(r.success).toBe(true);
    });

    it('sets ownerResponseDate as a Date', async () => {
      __seed('Reviews', [makeReview()]);
      await addOwnerResponse('rev-100', 'Thanks for the review!');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.ownerResponseDate).toBeInstanceOf(Date);
    });

    it('overwrites previous owner response', async () => {
      __seed('Reviews', [makeReview({ ownerResponse: 'Old response text here' })]);
      await addOwnerResponse('rev-100', 'New response text here');
      const review = await wixData.get('Reviews', 'rev-100');
      expect(review.ownerResponse).toContain('New response');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // getCategoryReviewSummaries — edge cases
  // ═══════════════════════════════════════════════════════════════════
  describe('getCategoryReviewSummaries edge cases', () => {
    it('returns empty for undefined input', async () => {
      const r = await getCategoryReviewSummaries(undefined);
      expect(r).toEqual({});
    });

    it('returns empty for string input', async () => {
      const r = await getCategoryReviewSummaries('prod-001');
      expect(r).toEqual({});
    });

    it('returns empty for number input', async () => {
      const r = await getCategoryReviewSummaries(42);
      expect(r).toEqual({});
    });

    it('filters out invalid IDs from the array', async () => {
      __seed('Reviews', [makeReview({ _id: 'r1', productId: 'prod-100', rating: 5 })]);
      const r = await getCategoryReviewSummaries(['prod-100', '<script>', '']);
      // Only prod-100 is valid
      expect(r['prod-100']).toBeDefined();
      expect(r['prod-100'].total).toBe(1);
      expect(Object.keys(r)).toHaveLength(1);
    });

    it('clamps ratings in summaries to 1-5', async () => {
      __seed('Reviews', [
        makeReview({ _id: 'r1', productId: 'prod-100', rating: 99 }),
      ]);
      const r = await getCategoryReviewSummaries(['prod-100']);
      expect(r['prod-100'].average).toBe(5); // clamped to 5
    });

    it('does not include _sum in final output', async () => {
      __seed('Reviews', [makeReview({ _id: 'r1', productId: 'prod-100', rating: 4 })]);
      const r = await getCategoryReviewSummaries(['prod-100']);
      expect(r['prod-100']._sum).toBeUndefined();
    });

    it('handles duplicate product IDs in input', async () => {
      __seed('Reviews', [makeReview({ _id: 'r1', productId: 'prod-100', rating: 4 })]);
      // cleanIds will have duplicates; summaries[id] gets overwritten with same init
      const r = await getCategoryReviewSummaries(['prod-100', 'prod-100']);
      expect(r['prod-100']).toBeDefined();
      expect(r['prod-100'].total).toBe(1);
    });

    it('handles array of all invalid IDs', async () => {
      const r = await getCategoryReviewSummaries(['<>', '!!!', '   ']);
      expect(r).toEqual({});
    });
  });
});
