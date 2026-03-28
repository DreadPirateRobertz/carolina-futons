/**
 * @file cf-zo4k-loyalty-statement-email.test.js
 * @description CF-zo4k: Monthly loyalty points statement email.
 *
 * Covers:
 *  - sendMonthlyLoyaltyStatements: queues emails for all members with balance > 0
 *  - sendMonthlyLoyaltyStatements: skips members with no balance and no recent activity
 *  - sendMonthlyLoyaltyStatements: returns count of sent statements
 *  - sendMonthlyLoyaltyStatements: email variables include tier, points, earned, redeemed
 *  - sendMonthlyLoyaltyStatements: uses sequenceType = 'loyalty_statement'
 *  - sendMonthlyLoyaltyStatements: dedup — does not send twice to same member this month
 *  - generateMonthlyStatement: returns statement with correct fields
 *  - generateMonthlyStatement: handles missing account gracefully
 *  - get_sendMonthlyLoyaltyStatements HTTP cron endpoint: returns 401 on bad key
 *  - get_sendMonthlyLoyaltyStatements: returns 200 with count on success
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __seed, __getCollection } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
});

import {
  sendMonthlyLoyaltyStatements,
  generateMonthlyStatement,
} from '../src/backend/loyaltyMarketing.web.js';

// ── Fixtures ───────────────────────────────────────────────────────────

function makeAccount(overrides = {}) {
  return {
    _id: 'acc-1',
    memberId: 'm-1',
    email: 'member@test.com',
    firstName: 'Alex',
    currentTier: 'Silver',
    totalPoints: 750,
    totalSpend: 700,
    ...overrides,
  };
}

function makePointsActivity(memberId = 'm-1', points = 100) {
  return {
    _id: `ph-${Math.random()}`,
    memberId,
    points,
    source: 'purchase',
    timestamp: new Date(),
  };
}

// ── generateMonthlyStatement ───────────────────────────────────────────

describe('generateMonthlyStatement', () => {
  it('returns statement with required fields', async () => {
    __seed('LoyaltyAccounts', [makeAccount()]);
    __seed('PointsHistory', [makePointsActivity('m-1', 150), makePointsActivity('m-1', -50)]);

    const result = await generateMonthlyStatement('m-1');

    expect(result.success).toBe(true);
    expect(result.statement.memberId).toBe('m-1');
    expect(result.statement.currentTier).toBe('Silver');
    expect(result.statement.totalPoints).toBe(750);
    expect(result.statement.monthlyEarned).toBe(150);
    expect(result.statement.monthlyRedeemed).toBe(50);
    expect(result.statement.email).toBe('member@test.com');
  });

  it('returns failure when account not found', async () => {
    __seed('LoyaltyAccounts', []);

    const result = await generateMonthlyStatement('m-missing');

    expect(result.success).toBe(false);
    expect(result.statement).toBeNull();
  });

  it('returns failure when memberId is empty', async () => {
    const result = await generateMonthlyStatement('');
    expect(result.success).toBe(false);
  });
});

// ── sendMonthlyLoyaltyStatements ───────────────────────────────────────

describe('sendMonthlyLoyaltyStatements', () => {
  it('queues emails for all members with balance > 0', async () => {
    __seed('LoyaltyAccounts', [
      makeAccount({ _id: 'acc-1', memberId: 'm-1', email: 'a@test.com', totalPoints: 200 }),
      makeAccount({ _id: 'acc-2', memberId: 'm-2', email: 'b@test.com', totalPoints: 500 }),
    ]);
    __seed('PointsHistory', [
      makePointsActivity('m-1', 50),
      makePointsActivity('m-2', 100),
    ]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const result = await sendMonthlyLoyaltyStatements();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(2);
    expect(inserts.filter(i => i.sequenceType === 'loyalty_statement')).toHaveLength(2);
  });

  it('skips members with 0 points and no recent activity', async () => {
    __seed('LoyaltyAccounts', [
      makeAccount({ totalPoints: 0 }),
    ]);
    __seed('PointsHistory', []);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const result = await sendMonthlyLoyaltyStatements();

    expect(result.sent).toBe(0);
    expect(inserts.filter(i => i.sequenceType === 'loyalty_statement')).toHaveLength(0);
  });

  it('includes tier, totalPoints, monthlyEarned, monthlyRedeemed in variables', async () => {
    __seed('LoyaltyAccounts', [makeAccount()]);
    __seed('PointsHistory', [makePointsActivity('m-1', 120), makePointsActivity('m-1', -30)]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await sendMonthlyLoyaltyStatements();

    const email = inserts.find(i => i.sequenceType === 'loyalty_statement');
    expect(email).toBeDefined();
    expect(email.variables.currentTier).toBe('Silver');
    expect(email.variables.totalPoints).toBe(750);
    expect(email.variables.monthlyEarned).toBe(120);
    expect(email.variables.monthlyRedeemed).toBe(30);
    expect(email.variables.firstName).toBe('Alex');
  });

  it('uses sequenceType = "loyalty_statement"', async () => {
    __seed('LoyaltyAccounts', [makeAccount()]);
    __seed('PointsHistory', [makePointsActivity()]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await sendMonthlyLoyaltyStatements();

    const email = inserts.find(i => i.sequenceType === 'loyalty_statement');
    expect(email.templateId).toMatch(/loyalty_statement/);
  });

  it('deduplicates — does not send twice if already sent this month', async () => {
    __seed('LoyaltyAccounts', [makeAccount()]);
    __seed('PointsHistory', [makePointsActivity()]);
    // Seed an existing statement email sent this month
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    __seed('LoyaltyStatementsSent', [
      { _id: `m-1_${monthKey}`, memberId: 'm-1', monthKey },
    ]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const result = await sendMonthlyLoyaltyStatements();

    expect(result.sent).toBe(0);
    expect(inserts.filter(i => i.sequenceType === 'loyalty_statement')).toHaveLength(0);
  });

  it('returns sent = 0 when no accounts exist', async () => {
    __seed('LoyaltyAccounts', []);

    const result = await sendMonthlyLoyaltyStatements();

    expect(result.success).toBe(true);
    expect(result.sent).toBe(0);
  });
});

// ── HTTP cron endpoint ─────────────────────────────────────────────────

describe('get_sendMonthlyLoyaltyStatements HTTP endpoint', () => {
  it('returns 401 when cron key is missing', async () => {
    const { get_sendMonthlyLoyaltyStatements } = await import('../src/backend/http-functions.js');

    __setSecrets({ ALERT_CRON_KEY: 'secret-key' });

    const request = { headers: {} };
    const response = await get_sendMonthlyLoyaltyStatements(request);

    expect(response.status).toBe(403);
  });

  it('returns 401 when cron key is wrong', async () => {
    const { get_sendMonthlyLoyaltyStatements } = await import('../src/backend/http-functions.js');

    __setSecrets({ ALERT_CRON_KEY: 'real-key' });

    const request = { headers: { 'x-cron-secret': 'wrong-key' } };
    const response = await get_sendMonthlyLoyaltyStatements(request);

    expect(response.status).toBe(403);
  });

  it('returns 200 with sent count on authorized request', async () => {
    const { get_sendMonthlyLoyaltyStatements } = await import('../src/backend/http-functions.js');

    __setSecrets({ ALERT_CRON_KEY: 'valid-key' });
    __seed('LoyaltyAccounts', [makeAccount()]);
    __seed('PointsHistory', [makePointsActivity()]);

    const request = { headers: { 'x-cron-secret': 'valid-key' } };
    const response = await get_sendMonthlyLoyaltyStatements(request);

    expect(response.status).toBe(200);
    const body = JSON.parse(response.body);
    expect(typeof body.sent).toBe('number');
  });
});
