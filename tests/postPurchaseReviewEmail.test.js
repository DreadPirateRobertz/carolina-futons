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

// ── Template tests ──────────────────────────────────────────────────

describe('getPostPurchaseDay7ReviewTemplate', () => {
  it('generates email with product name in subject', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka Futon Frame',
      reviewUrl: 'https://www.carolinafutons.com/product-page/eureka#reviews',
    });

    expect(result.subject).toContain('Eureka Futon Frame');
    expect(result.html).toContain('Sarah');
    expect(result.html).toContain('Eureka Futon Frame');
  });

  it('includes 50 loyalty points incentive', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Tom',
      productNames: 'Monterey Frame',
      reviewUrl: 'https://example.com/review',
    });

    expect(result.html).toContain('50 loyalty points');
  });

  it('includes 25 photo bonus points', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Tom',
      productNames: 'Monterey Frame',
      reviewUrl: 'https://example.com/review',
    });

    expect(result.html).toContain('25 bonus points');
  });

  it('includes review CTA button with correct URL', () => {
    const url = 'https://www.carolinafutons.com/product-page/eureka#reviews';
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka',
      reviewUrl: url,
    });

    expect(result.html).toContain(url);
    expect(result.html).toContain('Write a Review');
  });

  it('includes product image when provided', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka',
      reviewUrl: 'https://example.com/review',
      productImage: 'https://example.com/eureka.jpg',
    });

    expect(result.html).toContain('https://example.com/eureka.jpg');
  });

  it('works without product image', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka',
      reviewUrl: 'https://example.com/review',
    });

    expect(result.html).not.toContain('<img');
  });

  it('allows custom points values', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka',
      reviewUrl: 'https://example.com/review',
      pointsReward: '100',
      photoBonusPoints: '50',
    });

    expect(result.html).toContain('100 loyalty points');
    expect(result.html).toContain('50 bonus points');
  });

  it('has preview text mentioning points', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      firstName: 'Sarah',
      productNames: 'Eureka',
      reviewUrl: 'https://example.com/review',
    });

    expect(result.previewText).toContain('50 loyalty points');
  });

  it('handles missing firstName gracefully', () => {
    const result = getPostPurchaseDay7ReviewTemplate({
      productNames: 'Eureka',
      reviewUrl: 'https://example.com/review',
    });

    expect(result.html).toContain("How's your new Eureka");
    expect(result.subject).toBeDefined();
  });
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
