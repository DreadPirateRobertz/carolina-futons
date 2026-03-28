/**
 * @file cf-nkau-post-purchase-care.test.js
 * @description CF-nkau: Tests for post-purchase care sequence — Day 3 care
 * guide, Day 7 review request with 50pts, Day 30 cross-sell recommendations.
 *
 * Covers:
 *  - Sequence step descriptions match care/review/cross-sell spec
 *  - Day 3 (step 1) includes fabricCareUrl and warrantyUrl
 *  - Day 7 (step 2) includes pointsReward = '50'
 *  - Day 30 (step 3) includes crossSellUrl and crossSellLabel
 *  - crossSellLabel is 'futon-mattresses' for frame purchases
 *  - crossSellLabel is 'futon-covers' for mattress purchases
 *  - crossSellLabel defaults to 'accessories' for unknown products
 *  - wixEcom_onOrderDelivered triggers post-purchase care sequence
 *  - Existing post_purchase steps retain common variables (assemblyGuideUrl, reviewUrl)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

vi.mock('backend/emailService.web', () => ({
  sendDeliveryConfirmation: vi.fn().mockResolvedValue({ success: true }),
  sendOrderConfirmation: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/referralService.web', () => ({
  _getReferralLinkForMember: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/couponsService.web', () => ({
  createCartRecoveryCoupon: vi.fn().mockResolvedValue({ code: 'TEST5' }),
}));

import {
  triggerPostPurchaseSequence,
  wixEcom_onOrderDelivered,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

const LINE_ITEMS_FRAME = [
  { name: 'Seattle Futon Frame', quantity: 1, price: 599, slug: 'seattle-futon-frame' },
];
const LINE_ITEMS_MATTRESS = [
  { name: 'Eureka Mattress', quantity: 1, price: 299, slug: 'eureka-futon-mattress' },
];
const LINE_ITEMS_UNKNOWN = [
  { name: 'Mystery Product', quantity: 1, price: 99, slug: 'mystery-product' },
];

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10', RECOVERY_DISCOUNT_CODE: 'COMEBACK15' });
  vi.clearAllMocks();
});

// ── Step definitions ──────────────────────────────────────────────────

describe('post_purchase sequence step spec', () => {
  it('has step 1 described as care guide (Day 3)', () => {
    const step1 = _SEQUENCES.post_purchase.steps.find(s => s.step === 1);
    expect(step1.delayHours).toBe(72);
    expect(step1.description).toMatch(/care guide/i);
  });

  it('has step 2 described as review request (Day 7)', () => {
    const step2 = _SEQUENCES.post_purchase.steps.find(s => s.step === 2);
    expect(step2.delayHours).toBe(168);
    expect(step2.description).toMatch(/review/i);
  });

  it('has step 3 described as cross-sell recommendations (Day 30)', () => {
    const step3 = _SEQUENCES.post_purchase.steps.find(s => s.step === 3);
    expect(step3.delayHours).toBe(720);
    expect(step3.description).toMatch(/cross.sell|complete.*room/i);
  });
});

// ── Day 3 care guide variables ────────────────────────────────────────

describe('Day 3 care guide variables', () => {
  it('includes fabricCareUrl in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.fabricCareUrl).toBeTruthy();
    expect(step1.variables.fabricCareUrl).toContain('carolinafutons.com');
  });

  it('includes warrantyUrl in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.warrantyUrl).toBeTruthy();
    expect(step1.variables.warrantyUrl).toContain('carolinafutons.com');
  });

  it('step 1 also has assemblyGuideUrl (retained from existing)', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.assemblyGuideUrl).toBeTruthy();
  });
});

// ── Day 7 review request variables ───────────────────────────────────

describe('Day 7 review request variables', () => {
  it('includes pointsReward = "50" in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.pointsReward).toBe('50');
  });

  it('includes reviewUrl in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.reviewUrl).toBeTruthy();
    expect(step2.variables.reviewUrl).toContain('seattle-futon-frame');
  });
});

// ── Day 30 cross-sell variables ───────────────────────────────────────

describe('Day 30 cross-sell variables', () => {
  it('includes crossSellUrl in step 3', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.crossSellUrl).toBeTruthy();
    expect(step3.variables.crossSellUrl).toContain('carolinafutons.com');
  });

  it('includes crossSellLabel in step 3', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.crossSellLabel).toBeTruthy();
  });

  it('recommends futon-mattresses when customer bought a frame', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.crossSellLabel).toBe('futon-mattresses');
    expect(step3.variables.crossSellUrl).toContain('futon-mattresses');
  });

  it('recommends futon-covers when customer bought a mattress', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 299, LINE_ITEMS_MATTRESS
    );

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.crossSellLabel).toBe('futon-covers');
    expect(step3.variables.crossSellUrl).toContain('futon-covers');
  });

  it('defaults cross-sell to accessories for unknown product type', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 99, LINE_ITEMS_UNKNOWN
    );

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.crossSellLabel).toBe('accessories');
  });

  it('step 3 does not include care guide variables (wrong step)', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerPostPurchaseSequence(
      'c-1', 'buyer@test.com', 'Alex', 'ORD-01', 599, LINE_ITEMS_FRAME
    );

    // crossSellUrl/crossSellLabel should only be on step 3
    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.crossSellUrl).toBeUndefined();
    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.crossSellUrl).toBeUndefined();
  });
});

// ── Trigger: wixEcom_onOrderDelivered ─────────────────────────────────

describe('wixEcom_onOrderDelivered triggers care sequence', () => {
  it('queues post-purchase care emails on delivery', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    wixEcom_onOrderDelivered({
      entity: {
        buyerInfo: { email: 'customer@test.com', contactId: 'c-123' },
        billingInfo: { firstName: 'Jordan' },
        number: 'ORD-999',
        lineItems: LINE_ITEMS_FRAME,
        priceSummary: { total: { amount: 599 } },
      },
    });
    await new Promise(r => setTimeout(r, 100));

    const careSteps = items.filter(i => i.sequenceType === 'post_purchase');
    expect(careSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('queues step 1 (Day 3 care guide) on delivery', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    wixEcom_onOrderDelivered({
      entity: {
        buyerInfo: { email: 'customer@test.com', contactId: 'c-123' },
        billingInfo: { firstName: 'Jordan' },
        number: 'ORD-999',
        lineItems: LINE_ITEMS_FRAME,
        priceSummary: { total: { amount: 599 } },
      },
    });
    await new Promise(r => setTimeout(r, 100));

    const step1 = items.find(i => i.sequenceType === 'post_purchase' && i.sequenceStep === 1);
    expect(step1).toBeDefined();
    expect(step1.variables.fabricCareUrl).toBeTruthy();
    expect(step1.variables.warrantyUrl).toBeTruthy();
  });

  it('does not queue care emails when email is missing', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    wixEcom_onOrderDelivered({ entity: { buyerInfo: {}, lineItems: [] } });
    await new Promise(r => setTimeout(r, 50));

    const careSteps = items.filter(i => i.sequenceType === 'post_purchase');
    expect(careSteps).toHaveLength(0);
  });
});
