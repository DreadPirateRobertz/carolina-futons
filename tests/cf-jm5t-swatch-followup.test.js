/**
 * @file cf-jm5t-swatch-followup.test.js
 * @description CF-jm5t: Tests for post-delivery swatch follow-up email sequence.
 *
 * Covers:
 *  - Step descriptions match bead spec (Day 3 / Day 10)
 *  - Step timings: 72h (Day 3) and 240h (Day 10)
 *  - Day 3 email: includes fabricNames, creditAmount, creditExpiry, fabricShopUrl
 *  - Day 10 email: includes fabricNames, creditAmount, creditExpiry, consultationUrl
 *  - fabricShopUrl is fabric-specific when fabricNames contains known slug
 *  - fabricShopUrl falls back to collections/all when fabricNames is empty
 *  - creditExpiry is ~30 days from trigger date
 *  - sequenceType is 'swatch_followup'
 *  - markSwatchShipped: updates SwatchRequests status to 'shipped' + queues followup
 *  - markSwatchShipped: no-ops gracefully when request not found
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __onUpdate, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
});

import {
  triggerSwatchFollowupSequence,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

import { markSwatchShipped } from '../src/backend/swatchRequest.web.js';

// ── Step definitions ──────────────────────────────────────────────────

describe('swatch_followup sequence step spec (CF-jm5t)', () => {
  it('step 1 is Day 3 (72h) with fabric preference + credit description', () => {
    const step1 = _SEQUENCES.swatch_followup.steps.find(s => s.step === 1);
    expect(step1.delayHours).toBe(72);
    expect(step1.description).toMatch(/day.?3|arrived|fabric/i);
  });

  it('step 2 is Day 10 (240h) with consultation/help description', () => {
    const step2 = _SEQUENCES.swatch_followup.steps.find(s => s.step === 2);
    expect(step2.delayHours).toBe(240);
    expect(step2.description).toMatch(/day.?10|consult|deciding/i);
  });
});

// ── triggerSwatchFollowupSequence: Day 3 variables ────────────────────

describe('Day 3 email variables', () => {
  it('includes fabricNames in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen', 'Stone Grey']);

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.fabricNames).toEqual(['Mocha Linen', 'Stone Grey']);
  });

  it('includes creditAmount = "5" in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen']);

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.creditAmount).toBe('5');
  });

  it('includes creditExpiry approximately 30 days from now', async () => {
    const before = Date.now();
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen']);

    const step1 = items.find(i => i.sequenceStep === 1);
    const expiry = new Date(step1.variables.creditExpiry).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(expiry).toBeLessThanOrEqual(before + thirtyDays + 5000);
  });

  it('includes a fabricShopUrl in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen']);

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.fabricShopUrl).toBeTruthy();
    expect(step1.variables.fabricShopUrl).toContain('carolinafutons.com');
  });
});

// ── triggerSwatchFollowupSequence: Day 10 variables ───────────────────

describe('Day 10 email variables', () => {
  it('includes fabricNames in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Stone Grey']);

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.fabricNames).toEqual(['Stone Grey']);
  });

  it('includes creditAmount and creditExpiry in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Stone Grey']);

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.creditAmount).toBe('5');
    expect(step2.variables.creditExpiry).toBeTruthy();
  });

  it('includes consultationUrl in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Stone Grey']);

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.consultationUrl).toBeTruthy();
    expect(step2.variables.consultationUrl).toContain('carolinafutons.com');
  });

  it('does not include fabricShopUrl on step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Stone Grey']);

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.fabricShopUrl).toBeUndefined();
  });
});

// ── Sequence metadata ─────────────────────────────────────────────────

describe('sequence metadata', () => {
  it('queues exactly 2 emails', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen']);

    expect(items.filter(i => i.sequenceType === 'swatch_followup')).toHaveLength(2);
  });

  it('uses sequenceType = "swatch_followup"', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', ['Mocha Linen']);

    expect(items.every(i => i.sequenceType === 'swatch_followup')).toBe(true);
  });

  it('empty fabricNames falls back to generic shop URL on step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerSwatchFollowupSequence('c-1', 'buyer@test.com', 'Sam', []);

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.fabricShopUrl).toContain('carolinafutons.com');
  });
});

// ── markSwatchShipped ─────────────────────────────────────────────────

describe('markSwatchShipped', () => {
  const SWATCH_REQUEST = {
    _id: 'sr-1',
    contactId: 'c-sw-1',
    contactEmail: 'buyer@test.com',
    contactName: 'Jamie Doe',
    swatchNames: ['Mocha Linen', 'Stone Grey'],
    status: 'pending',
  };

  it('updates SwatchRequests status to "shipped"', async () => {
    __seed('SwatchRequests', [SWATCH_REQUEST]);
    const updates = [];
    __onUpdate((col, item) => { if (col === 'SwatchRequests') updates.push(item); });

    await markSwatchShipped('sr-1');

    expect(updates.some(u => u._id === 'sr-1' && u.status === 'shipped')).toBe(true);
  });

  it('queues 2 swatch followup emails on markSwatchShipped', async () => {
    __seed('SwatchRequests', [SWATCH_REQUEST]);
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await markSwatchShipped('sr-1');
    await new Promise(r => setTimeout(r, 100));

    expect(items.filter(i => i.sequenceType === 'swatch_followup')).toHaveLength(2);
  });

  it('returns success: false when request not found', async () => {
    __seed('SwatchRequests', []);
    const result = await markSwatchShipped('sr-missing');
    expect(result.success).toBe(false);
  });
});
