/**
 * @file loyaltyMarketing.test.js
 * @description Tests for the loyalty program marketing module (cf-a2o4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  getTierExplainerData,
  getEnrollmentPrompt,
  calculatePointsFromSpend,
  getLoyaltyFaq,
  _TIER_THRESHOLDS,
  _TIER_BENEFITS,
} from '../src/backend/loyaltyMarketing.web.js';

beforeEach(() => {
  __reset();
});

// ── Tier Explainer ──────────────────────────────────────────────────

describe('getTierExplainerData', () => {
  it('returns all 3 tiers with benefits', async () => {
    const result = await getTierExplainerData();
    expect(result.success).toBe(true);
    expect(result.tiers).toHaveLength(3);
    expect(result.tiers.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold']);
  });

  it('includes spend thresholds', async () => {
    const result = await getTierExplainerData();
    expect(result.tiers[0].minSpend).toBe(0);
    expect(result.tiers[1].minSpend).toBe(500);
    expect(result.tiers[2].minSpend).toBe(1500);
  });

  it('includes discount percentages', async () => {
    const result = await getTierExplainerData();
    expect(result.tiers[0].discount).toBe('0%');
    expect(result.tiers[1].discount).toBe('5%');
    expect(result.tiers[2].discount).toBe('10%');
  });

  it('includes free shipping thresholds', async () => {
    const result = await getTierExplainerData();
    expect(result.tiers[0].freeShipping).toBe('$150+');
    expect(result.tiers[2].freeShipping).toBe('$50+');
  });

  it('Gold has early access', async () => {
    const result = await getTierExplainerData();
    expect(result.tiers[2].earlyAccess).toBe(true);
    expect(result.tiers[0].earlyAccess).toBe(false);
  });

  it('includes points multipliers', async () => {
    const result = await getTierExplainerData();
    expect(result.tiers[0].pointsMultiplier).toBe('1x');
    expect(result.tiers[2].pointsMultiplier).toBe('2x');
  });
});

// ── Enrollment Prompt ───────────────────────────────────────────────

describe('getEnrollmentPrompt', () => {
  it('prompts unenrolled users', async () => {
    __seed('LoyaltyAccounts', []);
    const result = await getEnrollmentPrompt('new@example.com');
    expect(result.shouldPrompt).toBe(true);
    expect(result.benefits.tier).toBe('Bronze');
    expect(result.benefits.welcomePoints).toBe(50);
  });

  it('does not prompt already-enrolled users', async () => {
    __seed('LoyaltyAccounts', [{ email: 'existing@example.com', currentTier: 'Bronze' }]);
    const result = await getEnrollmentPrompt('existing@example.com');
    expect(result.shouldPrompt).toBe(false);
  });

  it('does not prompt without email', async () => {
    const result = await getEnrollmentPrompt('');
    expect(result.shouldPrompt).toBe(false);
  });

  it('includes next tier info', async () => {
    __seed('LoyaltyAccounts', []);
    const result = await getEnrollmentPrompt('new@example.com');
    expect(result.benefits.nextTier).toBe('Silver');
    expect(result.benefits.nextTierSpend).toBe(500);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('loyalty marketing constants', () => {
  it('thresholds match loyaltyTiers.web.js values', () => {
    expect(_TIER_THRESHOLDS.Bronze.nextMin).toBe(500);
    expect(_TIER_THRESHOLDS.Silver.nextMin).toBe(1500);
    expect(_TIER_THRESHOLDS.Gold.next).toBeNull();
  });
});

// ── Points Calculator (CF-h3li) ─────────────────────────────────────

describe('calculatePointsFromSpend', () => {
  it('returns Bronze tier for spend under $500', () => {
    const result = calculatePointsFromSpend(300);
    expect(result.success).toBe(true);
    expect(result.result.tier).toBe('Bronze');
    expect(result.result.multiplier).toBe('1x');
    expect(result.result.basePoints).toBe(300);
    expect(result.result.bonusPoints).toBe(0);
    expect(result.result.totalPoints).toBe(300);
  });

  it('returns Silver tier with 1.5x multiplier for $500-$1499', () => {
    const result = calculatePointsFromSpend(800);
    expect(result.result.tier).toBe('Silver');
    expect(result.result.multiplier).toBe('1.5x');
    expect(result.result.basePoints).toBe(800);
    expect(result.result.bonusPoints).toBe(400); // 800 * 0.5
    expect(result.result.totalPoints).toBe(1200);
  });

  it('returns Gold tier with 2x multiplier for $1500+', () => {
    const result = calculatePointsFromSpend(2000);
    expect(result.result.tier).toBe('Gold');
    expect(result.result.multiplier).toBe('2x');
    expect(result.result.totalPoints).toBe(4000);
  });

  it('includes next tier spend info', () => {
    const result = calculatePointsFromSpend(300);
    expect(result.result.nextTier).toBe('Silver');
    expect(result.result.spendToNextTier).toBe(200);
  });

  it('Gold has null next tier', () => {
    const result = calculatePointsFromSpend(2000);
    expect(result.result.nextTier).toBeNull();
    expect(result.result.spendToNextTier).toBeNull();
  });

  it('handles zero spend', () => {
    const result = calculatePointsFromSpend(0);
    expect(result.result.totalPoints).toBe(0);
    expect(result.result.tier).toBe('Bronze');
  });

  it('includes tier benefits', () => {
    const result = calculatePointsFromSpend(800);
    expect(result.result.benefits).toBeDefined();
    expect(result.result.benefits.discount).toBe('5%');
  });
});

// ── Loyalty FAQ (CF-h3li) ───────────────────────────────────────────

describe('getLoyaltyFaq', () => {
  it('returns array of FAQ items', () => {
    const result = getLoyaltyFaq();
    expect(result.success).toBe(true);
    expect(result.faqs.length).toBeGreaterThanOrEqual(5);
  });

  it('each FAQ has question and answer', () => {
    const result = getLoyaltyFaq();
    for (const faq of result.faqs) {
      expect(faq.question).toBeTruthy();
      expect(faq.answer).toBeTruthy();
      expect(faq.answer.length).toBeGreaterThan(20);
    }
  });

  it('covers key topics', () => {
    const result = getLoyaltyFaq();
    const questions = result.faqs.map(f => f.question.toLowerCase());
    expect(questions.some(q => q.includes('earn'))).toBe(true);
    expect(questions.some(q => q.includes('tier'))).toBe(true);
    expect(questions.some(q => q.includes('redeem'))).toBe(true);
    expect(questions.some(q => q.includes('birthday'))).toBe(true);
  });
});
