/**
 * @file cf-w3jc-review-moderation-admin.test.js
 * @description Tests for CF-w3jc: Review moderation queue — Stamped.io ingest,
 * auto-approve threshold, profanity filter, and audit logging.
 *
 * Covers:
 *  - containsProfanity detects keywords (case-insensitive)
 *  - isAutoApprovable: 4+ stars + no profanity → true
 *  - isAutoApprovable: <4 stars → false
 *  - isAutoApprovable: profanity in body → false
 *  - ingestStampedReview inserts into ProductReviews as pending
 *  - ingestStampedReview auto-approves 4+ star clean review
 *  - ingestStampedReview deduplicates by externalId
 *  - ingestStampedReview rejects invalid payload
 *  - autoApproveEligible approves 4+ star pending reviews
 *  - autoApproveEligible skips reviews below threshold
 *  - moderateReview logs audit event on approve and reject
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __getUpdated, __onInsert } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(),
}));

import {
  containsProfanity,
  isAutoApprovable,
  ingestStampedReview,
  autoApproveEligible,
} from '../src/backend/reviewModeration.web.js';

import { moderateReview } from '../src/backend/reviewsService.web.js';
import { logAuditEvent } from '../src/backend/utils/auditLog.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
});

// ── containsProfanity ────────────────────────────────────────────────

describe('containsProfanity', () => {
  it('returns false for clean text', () => {
    expect(containsProfanity('This futon is comfortable and well-made.')).toBe(false);
  });

  it('detects profanity keyword (case-insensitive)', () => {
    expect(containsProfanity('This is fucking amazing!')).toBe(true);
    expect(containsProfanity('What a SHIT product')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(containsProfanity('')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(containsProfanity(null)).toBe(false);
    expect(containsProfanity(undefined)).toBe(false);
  });
});

// ── isAutoApprovable ─────────────────────────────────────────────────

describe('isAutoApprovable', () => {
  it('returns true for 5-star clean review', () => {
    expect(isAutoApprovable({ rating: 5, title: 'Great futon', body: 'Very comfortable.' })).toBe(true);
  });

  it('returns true for 4-star clean review', () => {
    expect(isAutoApprovable({ rating: 4, body: 'Solid build, arrived on time.' })).toBe(true);
  });

  it('returns false for 3-star review', () => {
    expect(isAutoApprovable({ rating: 3, body: 'Decent product.' })).toBe(false);
  });

  it('returns false for 1-star review regardless of content', () => {
    expect(isAutoApprovable({ rating: 1, body: 'Loved it actually.' })).toBe(false);
  });

  it('returns false when body contains profanity (4+ stars)', () => {
    expect(isAutoApprovable({ rating: 5, body: 'Fucking amazing!' })).toBe(false);
  });

  it('returns false when title contains profanity', () => {
    expect(isAutoApprovable({ rating: 5, title: 'What a shit product', body: 'Actually ok.' })).toBe(false);
  });

  it('returns false for null review', () => {
    expect(isAutoApprovable(null)).toBe(false);
  });
});

// ── ingestStampedReview ──────────────────────────────────────────────

describe('ingestStampedReview', () => {
  const CLEAN_PAYLOAD = {
    id: 'stamped-001',
    productId: 'prod-eureka',
    author: 'Keiko S.',
    email: 'keiko@example.com',
    rating: 5,
    title: 'Love this futon',
    body: 'Great quality, easy to assemble.',
    isVerifiedBuyer: true,
    createdAt: '2026-03-28T10:00:00Z',
  };

  it('inserts review as pending when rating < 4', async () => {
    const payload = { ...CLEAN_PAYLOAD, id: 'stamped-002', rating: 3 };
    const result = await ingestStampedReview(payload);
    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');

    const inserted = __getInserted('ProductReviews');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].status).toBe('pending');
    expect(inserted[0].source).toBe('stamped');
  });

  it('auto-approves 4+ star clean review', async () => {
    const result = await ingestStampedReview(CLEAN_PAYLOAD);
    expect(result.success).toBe(true);
    expect(result.status).toBe('approved');

    const inserted = __getInserted('ProductReviews');
    expect(inserted[0].status).toBe('approved');
    expect(inserted[0].verifiedPurchase).toBe(true);
  });

  it('inserts as pending when review contains profanity (4+ stars)', async () => {
    const payload = { ...CLEAN_PAYLOAD, id: 'stamped-003', body: 'Fucking love it!' };
    const result = await ingestStampedReview(payload);
    expect(result.success).toBe(true);
    expect(result.status).toBe('pending');
  });

  it('deduplicates by externalId — returns duplicate status without inserting', async () => {
    __seed('ProductReviews', [{ _id: 'rev-existing', externalId: 'stamped-001', source: 'stamped' }]);

    const insertedViaCall = [];
    __onInsert((_col, item) => { insertedViaCall.push(item); });

    const result = await ingestStampedReview(CLEAN_PAYLOAD);
    expect(result.success).toBe(true);
    expect(result.status).toBe('duplicate');
    expect(insertedViaCall).toHaveLength(0);
  });

  it('returns { success: false } when productId is missing', async () => {
    const result = await ingestStampedReview({ rating: 5, body: 'Great.' });
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when rating is missing', async () => {
    const result = await ingestStampedReview({ productId: 'prod-1', body: 'Great.' });
    expect(result.success).toBe(false);
  });

  it('logs audit event on successful ingest', async () => {
    await ingestStampedReview(CLEAN_PAYLOAD);
    expect(logAuditEvent).toHaveBeenCalledWith(
      'ProductReviews', 'stamped_ingest', expect.any(String),
      expect.objectContaining({ rating: 5, autoApproved: true })
    );
  });
});

// ── autoApproveEligible ──────────────────────────────────────────────

describe('autoApproveEligible', () => {
  it('approves all 4+ star clean pending reviews', async () => {
    __seed('ProductReviews', [
      { _id: 'rev-1', status: 'pending', rating: 5, title: 'Great', body: 'Solid build.' },
      { _id: 'rev-2', status: 'pending', rating: 4, title: 'Good', body: 'Happy with it.' },
      { _id: 'rev-3', status: 'pending', rating: 2, title: 'Meh', body: 'Not impressed.' },
    ]);

    const result = await autoApproveEligible();
    expect(result.success).toBe(true);
    expect(result.scanned).toBe(3);
    expect(result.approved).toBe(2);
  });

  it('skips reviews with profanity even at 5 stars', async () => {
    __seed('ProductReviews', [
      { _id: 'rev-4', status: 'pending', rating: 5, body: 'Fucking love it!' },
    ]);

    const result = await autoApproveEligible();
    expect(result.approved).toBe(0);
  });

  it('returns zero counts when queue is empty', async () => {
    const result = await autoApproveEligible();
    expect(result.success).toBe(true);
    expect(result.scanned).toBe(0);
    expect(result.approved).toBe(0);
  });

  it('logs audit event with counts', async () => {
    __seed('ProductReviews', [
      { _id: 'rev-5', status: 'pending', rating: 5, body: 'Great product.' },
    ]);
    await autoApproveEligible();
    expect(logAuditEvent).toHaveBeenCalledWith(
      'ProductReviews', 'auto_approve_eligible', 'system',
      expect.objectContaining({ scanned: 1, approved: 1 })
    );
  });
});

// ── moderateReview: audit logging ────────────────────────────────────

describe('moderateReview: audit event logging', () => {
  it('logs moderate_approve on successful approve', async () => {
    __seed('Reviews', [{
      _id: 'rev-a1', status: 'pending', productId: 'prod-1',
      memberId: 'mbr-1', body: 'Great.', rating: 5,
    }]);

    const result = await moderateReview('rev-a1', 'approve');
    expect(result.success).toBe(true);
    expect(logAuditEvent).toHaveBeenCalledWith(
      'Reviews', 'moderate_approve', 'rev-a1',
      expect.objectContaining({ previousStatus: 'pending', newStatus: 'approved' })
    );
  });

  it('logs moderate_reject on successful reject', async () => {
    __seed('Reviews', [{
      _id: 'rev-a2', status: 'pending', productId: 'prod-1',
      memberId: 'mbr-1', body: 'Bad.', rating: 1,
    }]);

    const result = await moderateReview('rev-a2', 'reject');
    expect(result.success).toBe(true);
    expect(logAuditEvent).toHaveBeenCalledWith(
      'Reviews', 'moderate_reject', 'rev-a2',
      expect.objectContaining({ previousStatus: 'pending', newStatus: 'rejected' })
    );
  });

  it('does not log when review not found', async () => {
    const result = await moderateReview('nonexistent-id', 'approve');
    expect(result.success).toBe(false);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

// ── moderateReview: status transitions ───────────────────────────────

describe('moderateReview: status transitions', () => {
  it('blocks approving an already-approved review', async () => {
    __seed('Reviews', [{
      _id: 'rev-b1', status: 'approved', productId: 'prod-1', body: 'Great.', rating: 5,
    }]);

    const result = await moderateReview('rev-b1', 'approve');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot approve/i);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects invalid action string', async () => {
    __seed('Reviews', [{
      _id: 'rev-b2', status: 'pending', productId: 'prod-1', body: 'Ok.', rating: 3,
    }]);

    const result = await moderateReview('rev-b2', 'archive');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/approve.*reject/i);
  });
});

// ── post_stampedWebhook ──────────────────────────────────────────────

describe('post_stampedWebhook', () => {
  const WEBHOOK_SECRET = 'stamped-test-secret';
  const VALID_PAYLOAD = {
    productId: 'prod-123',
    author: 'Tester',
    email: 'test@example.com',
    rating: 5,
    title: 'Great futon',
    body: 'Very comfortable.',
  };

  function makeRequest({ secret, body, headers = {} }) {
    return {
      headers: { 'x-stamped-secret': secret, ...headers },
      body: {
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      },
    };
  }

  let post_stampedWebhook;
  beforeEach(async () => {
    ({ post_stampedWebhook } = await import('../src/backend/http-functions.js'));
  });

  it('returns 403 when STAMPED_WEBHOOK_SECRET is not configured', async () => {
    // No secret set — getSecret will throw
    const req = makeRequest({ secret: 'any', body: VALID_PAYLOAD });
    const res = await post_stampedWebhook(req);
    expect(res.status).toBe(403);
  });

  it('returns 403 when request secret does not match', async () => {
    __setSecrets({ STAMPED_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const req = makeRequest({ secret: 'wrong-secret', body: VALID_PAYLOAD });
    const res = await post_stampedWebhook(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when body is invalid JSON', async () => {
    __setSecrets({ STAMPED_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const req = makeRequest({ secret: WEBHOOK_SECRET, body: '{invalid json' });
    const res = await post_stampedWebhook(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/invalid json/i);
  });

  it('returns 400 when productId is missing', async () => {
    __setSecrets({ STAMPED_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const req = makeRequest({ secret: WEBHOOK_SECRET, body: { rating: 5, body: 'Nice.' } });
    const res = await post_stampedWebhook(req);
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/productId/i);
  });

  it('returns 200 and reviewId on successful ingestion', async () => {
    __setSecrets({ STAMPED_WEBHOOK_SECRET: WEBHOOK_SECRET });
    const req = makeRequest({ secret: WEBHOOK_SECRET, body: VALID_PAYLOAD });
    const res = await post_stampedWebhook(req);
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.success).toBe(true);
    expect(parsed.reviewId).toBeTruthy();
  });
});
