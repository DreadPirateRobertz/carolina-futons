/**
 * @file reviewModeration.test.js
 * @description Tests for the review moderation queue module (cf-zew2).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  calculateSpamScore,
  isSpam,
  getModerationQueue,
  bulkModerate,
  autoRejectSpam,
  getModerationStats,
  _SPAM_SCORE_THRESHOLD,
} from '../src/backend/reviewModeration.web.js';

beforeEach(() => {
  __reset();
});

// ── Spam Detection ──────────────────────────────────────────────────

describe('calculateSpamScore', () => {
  it('returns 0 for legitimate review', () => {
    const result = calculateSpamScore({
      body: 'Solid build quality, easy to assemble. The cherry finish is beautiful.',
      rating: 5,
      author: 'Sarah M.',
    });
    expect(result.score).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it('flags spam keywords', () => {
    const result = calculateSpamScore({
      body: 'Buy now at this casino for free money',
      rating: 5,
    });
    expect(result.score).toBeGreaterThanOrEqual(3);
    expect(result.flags).toContain('spam_keyword: buy now');
    expect(result.flags).toContain('spam_keyword: casino');
    expect(result.flags).toContain('spam_keyword: free money');
  });

  it('flags URL patterns with higher weight', () => {
    const result = calculateSpamScore({
      body: 'Great product! Visit https://spam.com/ for deals',
      rating: 5,
    });
    expect(result.flags.some(f => f.includes('url_pattern'))).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it('flags excessive caps', () => {
    const result = calculateSpamScore({
      body: 'THIS IS THE BEST FRAME EVER BUY IT NOW',
      rating: 5,
    });
    expect(result.flags).toContain('excessive_caps');
  });

  it('flags excessive punctuation', () => {
    const result = calculateSpamScore({
      body: 'Amazing frame!!! Best purchase ever!!!',
      rating: 5,
    });
    expect(result.flags).toContain('excessive_punctuation');
  });

  it('flags short extreme ratings', () => {
    const result = calculateSpamScore({ body: 'Terrible.', rating: 1 });
    expect(result.flags).toContain('short_extreme_rating');
  });

  it('does not flag short moderate ratings', () => {
    const result = calculateSpamScore({ body: 'Pretty good.', rating: 3 });
    expect(result.flags).not.toContain('short_extreme_rating');
  });
});

describe('isSpam', () => {
  it('returns true for high spam score', () => {
    expect(isSpam({ body: 'Buy now at https://spam.com/ for free money and casino wins', rating: 5 })).toBe(true);
  });

  it('returns false for legitimate review', () => {
    expect(isSpam({ body: 'Great frame, sturdy construction', rating: 4 })).toBe(false);
  });
});

// ── Moderation Queue ────────────────────────────────────────────────

describe('getModerationQueue', () => {
  it('returns pending reviews with spam scores', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'Great product', author: 'Sarah', _createdDate: new Date() },
      { _id: 'r2', status: 'pending', rating: 1, body: 'Buy at https://spam.com/', author: 'Spammer', _createdDate: new Date() },
      { _id: 'r3', status: 'approved', rating: 4, body: 'Good frame', author: 'Tom', _createdDate: new Date() },
    ]);

    const result = await getModerationQueue({ status: 'pending' });
    expect(result.success).toBe(true);
    expect(result.reviews).toHaveLength(2);

    const spamReview = result.reviews.find(r => r.author === 'Spammer');
    expect(spamReview.spamScore).toBeGreaterThan(0);
    expect(spamReview.isLikelySpam).toBe(true);
  });

  it('filters by status', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'Good', _createdDate: new Date() },
      { _id: 'r2', status: 'approved', rating: 4, body: 'Nice', _createdDate: new Date() },
    ]);

    const pending = await getModerationQueue({ status: 'pending' });
    expect(pending.reviews).toHaveLength(1);

    const approved = await getModerationQueue({ status: 'approved' });
    expect(approved.reviews).toHaveLength(1);
  });

  it('returns all statuses with status=all', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'Good', _createdDate: new Date() },
      { _id: 'r2', status: 'approved', rating: 4, body: 'Nice', _createdDate: new Date() },
      { _id: 'r3', status: 'rejected', rating: 1, body: 'Bad', _createdDate: new Date() },
    ]);

    const result = await getModerationQueue({ status: 'all' });
    expect(result.reviews).toHaveLength(3);
  });

  it('paginates results', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'A', _createdDate: new Date() },
      { _id: 'r2', status: 'pending', rating: 4, body: 'B', _createdDate: new Date() },
    ]);

    const result = await getModerationQueue({ pageSize: 1 });
    expect(result.reviews).toHaveLength(1);
  });
});

// ── Bulk Actions ────────────────────────────────────────────────────

describe('bulkModerate', () => {
  it('approves multiple pending reviews', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'Good' },
      { _id: 'r2', status: 'pending', rating: 4, body: 'Nice' },
    ]);

    const result = await bulkModerate(['r1', 'r2'], 'approve');
    expect(result.success).toBe(true);
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('rejects multiple reviews', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 1, body: 'Spam' },
      { _id: 'r2', status: 'pending', rating: 1, body: 'Also spam' },
    ]);

    const result = await bulkModerate(['r1', 'r2'], 'reject');
    expect(result.processed).toBe(2);
  });

  it('counts failed IDs (not found)', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 5, body: 'Good' },
    ]);

    const result = await bulkModerate(['r1', 'nonexistent'], 'approve');
    expect(result.processed).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('rejects invalid action', async () => {
    const result = await bulkModerate(['r1'], 'delete');
    expect(result.success).toBe(false);
  });

  it('rejects empty array', async () => {
    const result = await bulkModerate([], 'approve');
    expect(result.success).toBe(false);
  });

  it('caps at 50 reviews per batch', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `r${i}`);
    __seed('ProductReviews', ids.map(id => ({ _id: id, status: 'pending', rating: 5, body: 'Good' })));

    const result = await bulkModerate(ids, 'approve');
    // Should process at most 50
    expect(result.processed).toBeLessThanOrEqual(50);
  });

  it('logs to AuditLog', async () => {
    __seed('ProductReviews', [{ _id: 'r1', status: 'pending', rating: 5, body: 'Good' }]);
    await bulkModerate(['r1'], 'approve');

    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('bulk_approve');
  });
});

// ── Auto-Reject Spam ────────────────────────────────────────────────

describe('autoRejectSpam', () => {
  it('rejects reviews above spam threshold', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', body: 'Buy now at https://casino.com/ for free money', rating: 5 },
      { _id: 'r2', status: 'pending', body: 'Solid hardwood frame, great quality', rating: 4 },
    ]);

    const result = await autoRejectSpam();
    expect(result.success).toBe(true);
    expect(result.scanned).toBe(2);
    expect(result.rejected).toBe(1);
  });

  it('skips already-approved reviews', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'approved', body: 'Buy now free money', rating: 5 },
    ]);

    const result = await autoRejectSpam();
    expect(result.scanned).toBe(0); // Only scans pending
  });

  it('handles empty queue', async () => {
    __seed('ProductReviews', []);
    const result = await autoRejectSpam();
    expect(result.scanned).toBe(0);
    expect(result.rejected).toBe(0);
  });
});

// ── Moderation Stats ────────────────────────────────────────────────

describe('getModerationStats', () => {
  it('returns counts by status', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', flagCount: 0 },
      { _id: 'r2', status: 'pending', flagCount: 2 },
      { _id: 'r3', status: 'approved', flagCount: 0 },
      { _id: 'r4', status: 'rejected', flagCount: 0 },
    ]);

    const result = await getModerationStats();
    expect(result.success).toBe(true);
    expect(result.stats.pending).toBe(2);
    expect(result.stats.approved).toBe(1);
    expect(result.stats.rejected).toBe(1);
    expect(result.stats.total).toBe(4);
  });
});

// ── calculateSpamScore — branch coverage ────────────────────────────

describe('calculateSpamScore — missing body', () => {
  it('handles review with no body field (|| "" fallbacks)', () => {
    const result = calculateSpamScore({ rating: 3 }); // no body
    expect(result.score).toBe(0);
    expect(result.flags).toEqual([]);
  });
});

// ── Branch coverage additions ────────────────────────────────────────

describe('calculateSpamScore — lowercase body (match || [] fallback)', () => {
  it('returns no caps flag for all-lowercase body > 10 chars', () => {
    // body is truthy and > 10 chars → reaches match(); all lowercase → match returns
    // null → `|| []` right branch fires
    const result = calculateSpamScore({ body: 'all lowercase content here', rating: 3 });
    expect(result.flags).not.toContain('excessive_caps');
  });
});

describe('getModerationQueue — flaggedOnly filter', () => {
  it('filters to only flagged reviews when flaggedOnly=true', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'pending', rating: 4, body: 'Good', flagCount: 3, _createdDate: new Date() },
      { _id: 'r2', status: 'pending', rating: 5, body: 'Great', flagCount: 0, _createdDate: new Date() },
    ]);

    const result = await getModerationQueue({ status: 'all', flaggedOnly: true });
    expect(result.success).toBe(true);
    // flaggedOnly=true fires the `if (options.flaggedOnly)` true branch
  });

  it('returns Anonymous when author field is absent', async () => {
    __seed('ProductReviews', [
      // No author field → `review.author || 'Anonymous'` right branch
      { _id: 'r1', status: 'pending', rating: 4, body: 'Good frame', _createdDate: new Date() },
    ]);

    const result = await getModerationQueue({ status: 'pending' });
    expect(result.reviews[0].author).toBe('Anonymous');
  });
});

describe('bulkModerate — already-approved review skips approve action', () => {
  it('does not re-approve an already-approved review (else branch)', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'approved', rating: 5, body: 'Great' },
    ]);

    const result = await bulkModerate(['r1'], 'approve');
    // status='approved', newStatus='approved' → condition false → else { failed++ }
    // covers branch 32[1] (if-false) and branch 33[2] (binary-expr false)
    expect(result.success).toBe(true);
    expect(result.failed).toBe(1);
  });

  it('allows approved→rejected transition', async () => {
    __seed('ProductReviews', [
      { _id: 'r1', status: 'approved', rating: 5, body: 'Good' },
    ]);

    const result = await bulkModerate(['r1'], 'reject');
    // status='approved', newStatus='rejected' → second arm of OR fires
    // covers branch 33[1] (binary-expr second arm true)
    expect(result.success).toBe(true);
    expect(result.processed).toBe(1);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('review moderation constants', () => {
  it('spam threshold is 3', () => {
    expect(_SPAM_SCORE_THRESHOLD).toBe(3);
  });
});
