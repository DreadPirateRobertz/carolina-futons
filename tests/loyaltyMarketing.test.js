/**
 * @file loyaltyMarketing.test.js
 * @description Tests for the loyalty program marketing module (cf-a2o4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  getTierExplainerData,
  getEnrollmentPrompt,
  checkTierUpNotifications,
  generateMonthlyStatement,
  calculatePointsFromSpend,
  getLoyaltyFaq,
  _TIER_THRESHOLDS,
  _TIER_BENEFITS,
  _TIER_UP_THRESHOLD_PERCENT,
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

// ── Tier-Up Notifications ───────────────────────────────────────────

describe('checkTierUpNotifications', () => {
  it('notifies Bronze members at 80% of Silver threshold ($400+)', async () => {
    __seed('LoyaltyAccounts', [
      { email: 'close@example.com', memberId: 'mem-1', currentTier: 'Bronze', totalSpend: 420, firstName: 'Sarah' },
    ]);
    __seed('EmailQueue', []);

    const result = await checkTierUpNotifications();
    expect(result.success).toBe(true);
    expect(result.notified).toBe(1);

    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('tier_up_notification');

    const vars = JSON.parse(emails[0].variables);
    expect(vars.nextTier).toBe('Silver');
    expect(vars.remainingSpend).toBe('80.00');
  });

  it('does not notify members below 80% threshold', async () => {
    __seed('LoyaltyAccounts', [
      { email: 'far@example.com', memberId: 'mem-2', currentTier: 'Bronze', totalSpend: 200 },
    ]);
    __seed('EmailQueue', []);

    const result = await checkTierUpNotifications();
    expect(result.notified).toBe(0);
  });

  it('does not notify Gold members (max tier)', async () => {
    __seed('LoyaltyAccounts', [
      { email: 'gold@example.com', memberId: 'mem-3', currentTier: 'Gold', totalSpend: 2000 },
    ]);
    __seed('EmailQueue', []);

    const result = await checkTierUpNotifications();
    expect(result.notified).toBe(0);
  });

  it('does not double-notify for same tier transition', async () => {
    __seed('LoyaltyAccounts', [
      { email: 'close@example.com', memberId: 'mem-1', currentTier: 'Bronze', totalSpend: 420 },
    ]);
    __seed('EmailQueue', [
      { recipientEmail: 'close@example.com', templateId: 'tier_up_notification', checkoutId: 'Silver' },
    ]);

    const result = await checkTierUpNotifications();
    expect(result.notified).toBe(0);
  });

  it('notifies Silver members approaching Gold', async () => {
    __seed('LoyaltyAccounts', [
      { email: 'silver@example.com', memberId: 'mem-4', currentTier: 'Silver', totalSpend: 1250 },
    ]);
    __seed('EmailQueue', []);

    const result = await checkTierUpNotifications();
    expect(result.notified).toBe(1);

    const vars = JSON.parse(__getInserted('EmailQueue')[0].variables);
    expect(vars.nextTier).toBe('Gold');
  });

  it('logs to AuditLog', async () => {
    __seed('LoyaltyAccounts', []);
    __seed('EmailQueue', []);

    await checkTierUpNotifications();
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].collection).toBe('LoyaltyMarketing');
  });
});

// ── Monthly Statement ───────────────────────────────────────────────

describe('generateMonthlyStatement', () => {
  it('generates statement with points summary', async () => {
    const now = new Date();
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-1', email: 'member@example.com', firstName: 'Sarah', currentTier: 'Silver', totalPoints: 750, totalSpend: 600 },
    ]);
    __seed('PointsHistory', [
      { memberId: 'mem-1', points: 100, source: 'purchase', timestamp: now },
      { memberId: 'mem-1', points: 50, source: 'review', timestamp: now },
      { memberId: 'mem-1', points: -25, source: 'redemption', timestamp: now },
    ]);

    const result = await generateMonthlyStatement('mem-1');
    expect(result.success).toBe(true);
    expect(result.statement.monthlyEarned).toBe(150);
    expect(result.statement.monthlyRedeemed).toBe(25);
    expect(result.statement.netChange).toBe(125);
  });

  it('includes tier and progression info', async () => {
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-1', email: 'member@example.com', currentTier: 'Silver', totalSpend: 800 },
    ]);
    __seed('PointsHistory', []);

    const result = await generateMonthlyStatement('mem-1');
    expect(result.statement.currentTier).toBe('Silver');
    expect(result.statement.nextTier).toBe('Gold');
    expect(result.statement.spendToNextTier).toBe(700);
  });

  it('Gold members have null next tier', async () => {
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-1', email: 'gold@example.com', currentTier: 'Gold', totalSpend: 2000 },
    ]);
    __seed('PointsHistory', []);

    const result = await generateMonthlyStatement('mem-1');
    expect(result.statement.nextTier).toBeNull();
    expect(result.statement.spendToNextTier).toBeNull();
  });

  it('includes points breakdown by source', async () => {
    const now = new Date();
    __seed('LoyaltyAccounts', [
      { memberId: 'mem-1', email: 'm@example.com', currentTier: 'Bronze', totalPoints: 200 },
    ]);
    __seed('PointsHistory', [
      { memberId: 'mem-1', points: 80, source: 'purchase', timestamp: now },
      { memberId: 'mem-1', points: 50, source: 'purchase', timestamp: now },
      { memberId: 'mem-1', points: 25, source: 'referral', timestamp: now },
    ]);

    const result = await generateMonthlyStatement('mem-1');
    expect(result.statement.breakdown[0].source).toBe('purchase');
    expect(result.statement.breakdown[0].points).toBe(130);
    expect(result.statement.breakdown[1].source).toBe('referral');
  });

  it('returns failure for unknown member', async () => {
    __seed('LoyaltyAccounts', []);
    const result = await generateMonthlyStatement('nonexistent');
    expect(result.success).toBe(false);
  });

  it('returns failure for empty memberId', async () => {
    const result = await generateMonthlyStatement('');
    expect(result.success).toBe(false);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('loyalty marketing constants', () => {
  it('tier-up threshold is 80%', () => {
    expect(_TIER_UP_THRESHOLD_PERCENT).toBe(0.8);
  });

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
