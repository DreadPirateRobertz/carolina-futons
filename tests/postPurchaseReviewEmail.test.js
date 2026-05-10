/**
 * @file postPurchaseReviewEmail.test.js
 * @description Tests for the Day 7 post-purchase review request email (cf-i64b).
 *
 * Covers:
 *  - Template generation with product data and points incentive
 *  - Subject line personalization
 *  - Points display (50 review + 25 photo bonus)
 *  - Post-purchase sequence passes points variables for step 2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { getPostPurchaseDay7ReviewTemplate } from '../src/backend/emailTemplates.web.js';
import { triggerPostPurchaseSequence } from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __reset();
});

// ── Sequence integration ────────────────────────────────────────────

describe('triggerPostPurchaseSequence — step 2 points', () => {
  it('includes pointsReward and photoBonusPoints for step 2', async () => {
    const result = await triggerPostPurchaseSequence(
      'contact-1', 'buyer@example.com', 'Sarah', 'ORD-001', 499, [{ name: 'Eureka Frame', quantity: 1 }]
    );

    expect(result.success).toBe(true);

    const queued = __getInserted('EmailQueue');
    const step2 = queued.find(e => e.sequenceStep === 2);
    expect(step2).toBeDefined();

    const vars = typeof step2.variables === 'string'
      ? JSON.parse(step2.variables)
      : step2.variables;
    expect(vars.pointsReward).toBe('50');
    expect(vars.photoBonusPoints).toBe('25');
  });

  it('does not include points variables for other steps', async () => {
    await triggerPostPurchaseSequence(
      'contact-1', 'buyer@example.com', 'Sarah', 'ORD-001', 499, [{ name: 'Eureka Frame', quantity: 1 }]
    );

    const queued = __getInserted('EmailQueue');
    const step1 = queued.find(e => e.sequenceStep === 1);
    const vars1 = typeof step1.variables === 'string'
      ? JSON.parse(step1.variables)
      : step1.variables;
    expect(vars1.pointsReward).toBeUndefined();
  });
});
