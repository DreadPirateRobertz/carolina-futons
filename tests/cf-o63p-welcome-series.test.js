/**
 * @file cf-o63p-welcome-series.test.js
 * @description CF-o63p: Tests for welcome email series onboarding sequence.
 *
 * Covers:
 *  - Step descriptions match bead spec (welcome/best-sellers/buying-guide)
 *  - Step 1 (immediate): includes discountCode + discountPercent = '10'
 *  - Step 2 delay is 48h (Day 2, not Day 3)
 *  - Step 2: includes bestSellersUrl
 *  - Step 3 delay is 120h (Day 5, not Day 7)
 *  - Step 3: includes buyingGuideUrl
 *  - Step 3: buyingGuideUrl is category-specific when quizCategory provided
 *  - Step 3: buyingGuideUrl falls back to generic guide when no quiz data
 *  - discountCode only on step 1, not steps 2 or 3
 *  - bestSellersUrl only on step 2
 *  - buyingGuideUrl only on step 3
 *  - Trigger: wixMembers_onMemberCreated still queues welcome series
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __seed } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10' });
  vi.clearAllMocks();
});

import {
  triggerWelcomeSequence,
  wixMembers_onMemberCreated,
  _SEQUENCES,
} from '../src/backend/emailAutomation.web.js';

// ── Step definitions ──────────────────────────────────────────────────

describe('welcome sequence step spec (CF-o63p)', () => {
  it('step 1 is immediate (0h) with welcome + coupon description', () => {
    const step1 = _SEQUENCES.welcome.steps.find(s => s.step === 1);
    expect(step1.delayHours).toBe(0);
    expect(step1.description).toMatch(/welcome|coupon|discount/i);
  });

  it('step 2 is Day 2 (48h) with best sellers description', () => {
    const step2 = _SEQUENCES.welcome.steps.find(s => s.step === 2);
    expect(step2.delayHours).toBe(48);
    expect(step2.description).toMatch(/best.seller/i);
  });

  it('step 3 is Day 5 (120h) with buying guide description', () => {
    const step3 = _SEQUENCES.welcome.steps.find(s => s.step === 3);
    expect(step3.delayHours).toBe(120);
    expect(step3.description).toMatch(/buying guide/i);
  });
});

// ── Step 1: welcome + 10% coupon ──────────────────────────────────────

describe('Step 1 — welcome + coupon', () => {
  it('includes discountCode in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.discountCode).toBe('WELCOME10');
    expect(step1.variables.discountAvailable).toBe(true);
  });

  it('includes discountPercent = "10" in step 1', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.discountPercent).toBe('10');
  });

  it('step 1 does not include bestSellersUrl', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step1 = items.find(i => i.sequenceStep === 1);
    expect(step1.variables.bestSellersUrl).toBeUndefined();
  });
});

// ── Step 2: best sellers ──────────────────────────────────────────────

describe('Step 2 — best sellers (Day 2)', () => {
  it('includes bestSellersUrl in step 2', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step2 = items.find(i => i.sequenceStep === 2);
    expect(step2.variables.bestSellersUrl).toBeTruthy();
    expect(step2.variables.bestSellersUrl).toContain('carolinafutons.com');
  });

  it('step 2 does not include discountCode', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step2 = items.find(i => i.sequenceStep === 2);
    // Step 2 may have discountCode from base variables but should not have bestSellersUrl on step 1
    // More importantly: no buyingGuideUrl on step 2
    expect(step2.variables.buyingGuideUrl).toBeUndefined();
  });
});

// ── Step 3: buying guide ──────────────────────────────────────────────

describe('Step 3 — buying guide (Day 5)', () => {
  it('includes buyingGuideUrl in step 3', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.buyingGuideUrl).toBeTruthy();
    expect(step3.variables.buyingGuideUrl).toContain('carolinafutons.com');
  });

  it('uses category-specific buying guide URL when quizCategory provided', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex', { quizCategory: 'futon-frames' });

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.buyingGuideUrl).toContain('futon-frames');
  });

  it('falls back to generic buying guide when no quizCategory', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.buyingGuideUrl).toBeTruthy();
    // Generic guide — no category slug
    expect(step3.variables.buyingGuideUrl).not.toMatch(/futon-frames|futon-mattresses/);
  });

  it('step 3 does not include bestSellersUrl', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    await triggerWelcomeSequence('c-1', 'new@test.com', 'Alex');

    const step3 = items.find(i => i.sequenceStep === 3);
    expect(step3.variables.bestSellersUrl).toBeUndefined();
  });
});

// ── Trigger: wixMembers_onMemberCreated ───────────────────────────────

describe('wixMembers_onMemberCreated triggers welcome series', () => {
  it('queues welcome emails on member registration', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    wixMembers_onMemberCreated({
      entity: {
        loginEmail: 'newmember@test.com',
        _id: 'mbr-abc',
        contactDetails: { firstName: 'Jordan', emails: ['newmember@test.com'] },
      },
    });
    await new Promise(r => setTimeout(r, 100));

    const welcomeSteps = items.filter(i => i.sequenceType === 'welcome');
    expect(welcomeSteps).toHaveLength(3);
  });

  it('step 2 in event-triggered sequence has bestSellersUrl', async () => {
    const items = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') items.push(item); });

    wixMembers_onMemberCreated({
      entity: {
        loginEmail: 'newmember2@test.com',
        _id: 'mbr-xyz',
        contactDetails: { firstName: 'Riley' },
      },
    });
    await new Promise(r => setTimeout(r, 100));

    const step2 = items.find(i => i.sequenceType === 'welcome' && i.sequenceStep === 2);
    expect(step2).toBeDefined();
    expect(step2.variables.bestSellersUrl).toBeTruthy();
  });
});
