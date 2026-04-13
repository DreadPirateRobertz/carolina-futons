/**
 * @file warrantyStatusTracking.test.js
 * @description CF-46ct — Warranty auto-expire status tracking.
 *
 * Tests:
 *   - getMyWarranties auto-expires active warranties past expiresAt
 *   - getMyWarranties returns 'expired' status in response for past-due active warranties
 *   - getMyWarranties fires a DB update for auto-expired warranty
 *   - getMyWarranties does not auto-expire non-active warranties (claimed, cancelled)
 *   - getMyWarranties does not touch warranties that are still in date
 *   - getWarrantyDetails auto-expires active warranty past expiresAt
 *   - getWarrantyDetails does not auto-expire non-active or in-date warranty
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __getUpdated,
  __onUpdate,
  __setUpdateError,
} from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { getMyWarranties, getWarrantyDetails } from '../src/backend/warrantyService.web.js';

const MEMBER_ID = 'member-status-001';

const PAST = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year ahead

function makeWarranty(overrides = {}) {
  return {
    _id: 'wreg-status-001',
    memberId: MEMBER_ID,
    planId: 'plan-001',
    planName: 'Extended Protection',
    productId: 'prod-001',
    productName: 'Canby Frame',
    orderId: 'order-001',
    warrantyPrice: 39.92,
    status: 'active',
    purchasedAt: new Date('2023-01-01'),
    expiresAt: FUTURE,
    registeredAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
  __setMember({ _id: MEMBER_ID, loginEmail: 'status@example.com' });
});

// ── getMyWarranties — auto-expire ─────────────────────────────────────────────

describe('getMyWarranties — auto-expire', () => {
  it('returns "expired" status for an active warranty whose expiresAt is in the past', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: PAST })]);
    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties[0].status).toBe('expired');
  });

  it('triggers a DB update for the auto-expired warranty', async () => {
    const updates = [];
    __onUpdate((col, item) => { if (col === 'WarrantyRegistrations') updates.push(item); });
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: PAST })]);
    await getMyWarranties();
    // Give the fire-and-forget promise a tick to settle
    await new Promise(r => setTimeout(r, 0));
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].status).toBe('expired');
  });

  it('does not change status for a warranty still within coverage period', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: FUTURE })]);
    const result = await getMyWarranties();
    expect(result.warranties[0].status).toBe('active');
  });

  it('does not auto-expire a "claimed" warranty even if past expiresAt', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ status: 'claimed', expiresAt: PAST })]);
    const result = await getMyWarranties();
    expect(result.warranties[0].status).toBe('claimed');
  });

  it('does not auto-expire a "cancelled" warranty', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ status: 'cancelled', expiresAt: PAST })]);
    const result = await getMyWarranties();
    expect(result.warranties[0].status).toBe('cancelled');
  });

  it('does not auto-expire an already-expired warranty (no redundant update)', async () => {
    const updates = [];
    __onUpdate((col, item) => { if (col === 'WarrantyRegistrations') updates.push(item); });
    __seed('WarrantyRegistrations', [makeWarranty({ status: 'expired', expiresAt: PAST })]);
    await getMyWarranties();
    await new Promise(r => setTimeout(r, 0));
    // Status was already expired — no update needed
    expect(updates).toHaveLength(0);
  });

  it('handles mixed active/expired/future warranties correctly', async () => {
    __seed('WarrantyRegistrations', [
      makeWarranty({ _id: 'w-past',   status: 'active', expiresAt: PAST }),
      makeWarranty({ _id: 'w-future', status: 'active', expiresAt: FUTURE }),
      makeWarranty({ _id: 'w-done',   status: 'expired', expiresAt: PAST }),
    ]);
    const result = await getMyWarranties();
    const byId = Object.fromEntries(result.warranties.map(w => [w._id, w]));
    expect(byId['w-past'].status).toBe('expired');
    expect(byId['w-future'].status).toBe('active');
    expect(byId['w-done'].status).toBe('expired');
  });

  it('handles warranty with null expiresAt without throwing', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: null })]);
    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties[0].status).toBe('active');
  });

  it('still returns correct expired status even when auto-expire DB update fails', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: PAST })]);
    __setUpdateError('WarrantyRegistrations', new Error('DB write failed'));
    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties[0].status).toBe('expired');
  });
});

// ── getWarrantyDetails — auto-expire ──────────────────────────────────────────

describe('getWarrantyDetails — auto-expire', () => {
  beforeEach(() => {
    __seed('WarrantyPlans', [{
      _id: 'plan-001',
      name: 'Extended Protection',
      tierSlug: 'extended',
      durationYears: 3,
      coverageType: 'extended',
      priceMultiplier: 0.08,
      coveredItems: '["frame defects"]',
      excludedItems: '["cosmetic damage"]',
      priority: 1,
      active: true,
    }]);
  });

  it('returns "expired" status for active warranty past expiresAt', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: PAST })]);
    const result = await getWarrantyDetails('wreg-status-001');
    expect(result.success).toBe(true);
    expect(result.warranty.status).toBe('expired');
  });

  it('triggers a DB update for the auto-expired warranty in getWarrantyDetails', async () => {
    const updates = [];
    __onUpdate((col, item) => { if (col === 'WarrantyRegistrations') updates.push(item); });
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: PAST })]);
    await getWarrantyDetails('wreg-status-001');
    await new Promise(r => setTimeout(r, 0));
    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].status).toBe('expired');
  });

  it('does not change status for in-date active warranty in getWarrantyDetails', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ expiresAt: FUTURE })]);
    const result = await getWarrantyDetails('wreg-status-001');
    expect(result.warranty.status).toBe('active');
  });

  it('does not auto-expire already-expired warranty in getWarrantyDetails', async () => {
    const updates = [];
    __onUpdate((col, item) => { if (col === 'WarrantyRegistrations') updates.push(item); });
    __seed('WarrantyRegistrations', [makeWarranty({ status: 'expired', expiresAt: PAST })]);
    await getWarrantyDetails('wreg-status-001');
    await new Promise(r => setTimeout(r, 0));
    expect(updates).toHaveLength(0);
  });

  it('rejects warranty belonging to another member even with auto-expire logic', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ memberId: 'other-member', expiresAt: PAST })]);
    const result = await getWarrantyDetails('wreg-status-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
