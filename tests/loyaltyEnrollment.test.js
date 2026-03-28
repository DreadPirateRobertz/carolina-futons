/**
 * @file loyaltyEnrollment.test.js
 * @description Tests for loyalty enrollment + points calculation (cf-nru7).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  enrollMember,
  calculatePointsForOrder,
  getEnrollmentPrompt,
} from '../src/backend/loyaltyMarketing.web.js';

beforeEach(() => {
  __reset();
  __setMember({ _id: 'member-1' });
});

// ── enrollMember ────────────────────────────────────────────────────

describe('enrollMember', () => {
  it('creates a loyalty account with welcome points', async () => {
    __seed('LoyaltyAccounts', []);

    const result = await enrollMember({
      memberId: 'member-1',
      email: 'buyer@example.com',
      firstName: 'Sarah',
    });

    expect(result.success).toBe(true);
    expect(result.welcomePoints).toBe(50);

    const accounts = __getInserted('LoyaltyAccounts');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].currentTier).toBe('Bronze');
    expect(accounts[0].totalPoints).toBe(50);
    expect(accounts[0].email).toBe('buyer@example.com');
  });

  it('awards bonus points for providing birthday', async () => {
    __seed('LoyaltyAccounts', []);

    const result = await enrollMember({
      memberId: 'member-1',
      email: 'buyer@example.com',
      birthday: '1990-06-15',
    });

    expect(result.success).toBe(true);
    expect(result.welcomePoints).toBe(100); // 50 welcome + 50 birthday

    const pointsHistory = __getInserted('PointsHistory');
    expect(pointsHistory.length).toBeGreaterThanOrEqual(2);
    const birthdayEntry = pointsHistory.find(p => p.source === 'birthday_enrollment');
    expect(birthdayEntry).toBeDefined();
    expect(birthdayEntry.points).toBe(50);
  });

  it('rejects duplicate enrollment', async () => {
    __seed('LoyaltyAccounts', [
      { memberId: 'member-1', email: 'buyer@example.com', currentTier: 'Bronze' },
    ]);

    const result = await enrollMember({
      memberId: 'member-1',
      email: 'buyer@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Already enrolled');
  });

  it('requires memberId and email', async () => {
    const result = await enrollMember({ memberId: '', email: '' });
    expect(result.success).toBe(false);
  });

  it('logs to AuditLog', async () => {
    __seed('LoyaltyAccounts', []);

    await enrollMember({ memberId: 'mem-1', email: 'buyer@example.com' });

    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('enroll');
  });

  it('ignores invalid birthday format', async () => {
    __seed('LoyaltyAccounts', []);

    const result = await enrollMember({
      memberId: 'mem-1',
      email: 'buyer@example.com',
      birthday: 'not-a-date',
    });

    expect(result.welcomePoints).toBe(50); // no birthday bonus
  });
});

// ── calculatePointsForOrder ─────────────────────────────────────────

describe('calculatePointsForOrder', () => {
  it('calculates 1x points for Bronze', () => {
    const result = calculatePointsForOrder(500, 'Bronze');
    expect(result.points).toBe(500);
    expect(result.multiplier).toBe('1x');
  });

  it('calculates 1.5x points for Silver', () => {
    const result = calculatePointsForOrder(500, 'Silver');
    expect(result.points).toBe(750);
    expect(result.multiplier).toBe('1.5x');
  });

  it('calculates 2x points for Gold', () => {
    const result = calculatePointsForOrder(500, 'Gold');
    expect(result.points).toBe(1000);
    expect(result.multiplier).toBe('2x');
  });

  it('defaults to Bronze when no tier provided', () => {
    const result = calculatePointsForOrder(300);
    expect(result.points).toBe(300);
    expect(result.tier).toBe('Bronze');
  });

  it('handles zero total', () => {
    expect(calculatePointsForOrder(0).points).toBe(0);
  });

  it('handles negative total', () => {
    expect(calculatePointsForOrder(-100).points).toBe(0);
  });
});

// ── getEnrollmentPrompt (integration) ───────────────────────────────

describe('getEnrollmentPrompt — Thank You page integration', () => {
  it('prompts unenrolled first-time buyer', async () => {
    __seed('LoyaltyAccounts', []);
    const result = await getEnrollmentPrompt('new@example.com');
    expect(result.shouldPrompt).toBe(true);
    expect(result.benefits.welcomePoints).toBe(50);
  });

  it('does not prompt already-enrolled buyer', async () => {
    __seed('LoyaltyAccounts', [{ email: 'existing@example.com' }]);
    const result = await getEnrollmentPrompt('existing@example.com');
    expect(result.shouldPrompt).toBe(false);
  });
});
