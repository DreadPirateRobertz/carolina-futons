/**
 * reviewsServiceErrorPaths.test.js — CF-672y
 * Fills remaining coverage gaps in reviewsService backend module.
 * Focuses on: catch blocks and category summary edge paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import wixData, { __seed, __reset as resetData } from 'wix-data';
import { __setMember, __reset as resetMembers } from 'wix-members-backend';

import {
  submitReview,
  markHelpful,
  flagReview,
  getPendingReviews,
  moderateReview,
  getReviewStats,
  addOwnerResponse,
  getCategoryReviewSummaries,
} from '../src/backend/reviewsService.web.js';

beforeEach(() => {
  resetData();
  resetMembers();
});

describe('reviewsService — error catch paths', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  beforeEach(() => {
    __setMember({
      _id: 'member-err',
      contactDetails: { firstName: 'Test', lastName: 'User' },
    });
  });

  it('submitReview returns error on DB insert failure', async () => {
    __seed('Reviews', []);
    __seed('Stores/Orders', []);
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await submitReview({
      productId: 'prod-001',
      rating: 5,
      body: 'A perfectly valid review body text here.',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to submit');
  });

  it('markHelpful returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-err', productId: 'p1', status: 'approved', helpful: 5 },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await markHelpful('rev-err');
    expect(result.success).toBe(false);
  });

  it('flagReview returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-flag', productId: 'p1', status: 'approved' },
    ]);
    __seed('ReviewFlags', []);
    vi.spyOn(wixData, 'insert').mockRejectedValueOnce(new Error('DB down'));
    const result = await flagReview('rev-flag', 'spam');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to flag');
  });

  it('getPendingReviews returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getPendingReviews();
    expect(result.success).toBe(false);
    expect(result.reviews).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('moderateReview returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-mod', productId: 'p1', status: 'pending' },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await moderateReview('rev-mod', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to moderate');
  });

  it('getReviewStats returns failure on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getReviewStats(30);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });

  it('addOwnerResponse returns failure on DB error', async () => {
    __seed('Reviews', [
      { _id: 'rev-owner', productId: 'p1', status: 'approved' },
    ]);
    vi.spyOn(wixData, 'update').mockRejectedValueOnce(new Error('DB down'));
    const result = await addOwnerResponse('rev-owner', 'Thank you for your review!');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to add');
  });

  it('getCategoryReviewSummaries returns {} on DB error', async () => {
    vi.spyOn(wixData, 'query').mockImplementationOnce(() => {
      throw new Error('DB down');
    });
    const result = await getCategoryReviewSummaries(['prod-001']);
    expect(result).toEqual({});
  });

  it('getCategoryReviewSummaries skips reviews with unrecognized productIds', async () => {
    __seed('Reviews', [
      { _id: 'r1', productId: 'prod-001', rating: 5, status: 'approved' },
      { _id: 'r2', productId: 'prod-unknown', rating: 3, status: 'approved' },
    ]);
    const result = await getCategoryReviewSummaries(['prod-001']);
    // prod-unknown is not in the requested productIds, so its review is excluded
    expect(result['prod-001'].total).toBe(1);
    expect(result['prod-001'].average).toBe(5);
  });
});
