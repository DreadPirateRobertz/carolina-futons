/**
 * Tests for the trimmed dataService.web.js. cf-4x7e Pass 2 chunk 6
 * retired everything except scheduleReviewRequest; this file follows
 * the same shape with a single describe block.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { reviewRequests } from './fixtures/engagement.js';
import {
  scheduleReviewRequest,
  getPendingReviewRequests,
  submitReview,
} from '../src/backend/dataService.web.js';

beforeEach(() => {
  __seed('ReviewRequests', reviewRequests);
  __setMember(null);
});

function loginAs(id) {
  __setMember({ _id: id });
}

describe('scheduleReviewRequest', () => {
  it('creates a review request for authenticated member', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({
      orderId: 'order-100',
      customerEmail: 'test@example.com',
      productIds: 'prod-frame-001',
    });
    expect(result.success).toBe(true);
    expect(result.requestId).toBeTruthy();
  });

  it('fails without required fields', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({ orderId: 'order-100' });
    expect(result.success).toBe(false);
  });

  it('fails for unauthenticated users', async () => {
    const result = await scheduleReviewRequest({
      orderId: 'order-100',
      customerEmail: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('fails without customerEmail', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({ orderId: 'order-100' });
    expect(result.success).toBe(false);
  });

  it('fails without orderId', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({ customerEmail: 'a@b.com' });
    expect(result.success).toBe(false);
  });

  it('fails with null input', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest(null);
    expect(result.success).toBe(false);
  });

  it('accepts custom scheduledDate', async () => {
    loginAs('member-001');
    const result = await scheduleReviewRequest({
      orderId: 'order-200',
      customerEmail: 'test2@example.com',
      productIds: 'prod-001',
      scheduledDate: new Date(Date.now() + 86400000),
    });
    expect(result.success).toBe(true);
  });
});
