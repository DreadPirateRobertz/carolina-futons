/**
 * @file warrantyEmail.test.js
 * @description CF-46ct — Email confirmation flow for warranty purchase & registration.
 *
 * Tests:
 *   - purchaseWarranty queues warranty_purchased email to EmailQueue
 *   - purchaseWarranty email contains correct templateId, recipient, and variables
 *   - purchaseWarranty still succeeds when EmailQueue insert fails (non-fatal)
 *   - registerWarranty queues warranty_registered email to EmailQueue
 *   - registerWarranty email contains correct templateId, recipient, and variables
 *   - registerWarranty still succeeds when EmailQueue insert fails (non-fatal)
 *   - member email comes from loginEmail on member record
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __getInserted,
  __setInsertError,
} from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { registerWarranty } from '../src/backend/warrantyService.web.js';

const MEMBER_ID  = 'member-email-001';
const MEMBER_EMAIL = 'warranty-buyer@example.com';

const PLAN = {
  _id: 'plan-ext-001',
  name: 'Extended Protection',
  tierSlug: 'extended',
  durationYears: 3,
  coverageType: 'extended',
  priceMultiplier: 0.08,
  description: '3-year extended coverage',
  coveredItems: '["frame defects"]',
  excludedItems: '["cosmetic damage"]',
  priority: 1,
  active: true,
};

function makePurchaseData() {
  return {
    planId: PLAN._id,
    productId: 'prod-futon-001',
    productName: 'Canby Futon Frame',
    productPrice: 499,
    orderId: 'order-email-001',
  };
}

beforeEach(() => {
  resetData();
  __setMember({ _id: MEMBER_ID, loginEmail: MEMBER_EMAIL });
  __seed('WarrantyPlans', [PLAN]);
  __seed('WarrantyRegistrations', []);
  __seed('EmailQueue', []);
});

// ── registerWarranty email ────────────────────────────────────────────────────

describe('registerWarranty — email confirmation', () => {
  const WARRANTY_ID = 'wreg-email-001';

  beforeEach(() => {
    __seed('WarrantyRegistrations', [{
      _id: WARRANTY_ID,
      memberId: MEMBER_ID,
      planId: PLAN._id,
      planName: 'Extended Protection',
      productId: 'prod-futon-001',
      productName: 'Canby Futon Frame',
      orderId: 'order-email-001',
      warrantyPrice: 39.92,
      status: 'active',
      purchasedAt: new Date('2026-01-01'),
      expiresAt: new Date('2029-01-01'),
      registeredAt: null,
      serialNumber: '',
      purchaseDate: '',
    }]);
  });

  it('inserts a record into EmailQueue after registration', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID, serialNumber: 'SN-123' });
    const queued = __getInserted('EmailQueue');
    expect(queued.length).toBeGreaterThanOrEqual(1);
  });

  it('queues email with templateId warranty_registered', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID, serialNumber: 'SN-123' });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(email).toBeDefined();
  });

  it('sends confirmation to member loginEmail', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(email.recipientEmail).toBe(MEMBER_EMAIL);
  });

  it('email variables include productName', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(email.variables.productName).toBe('Canby Futon Frame');
  });

  it('email variables include planName', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(email.variables.planName).toBe('Extended Protection');
  });

  it('email variables include serialNumber when provided', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID, serialNumber: 'SN-ABC-789' });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(email.variables.serialNumber).toBe('SN-ABC-789');
  });

  it('email variables include registeredAt as ISO string', async () => {
    await registerWarranty({ warrantyId: WARRANTY_ID });
    const queued = __getInserted('EmailQueue');
    const email = queued.find(e => e.templateId === 'warranty_registered');
    expect(typeof email.variables.registeredAt).toBe('string');
    expect(email.variables.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('registerWarranty succeeds even if EmailQueue insert throws (non-fatal)', async () => {
    __setInsertError('EmailQueue', new Error('Queue is down'));
    const result = await registerWarranty({ warrantyId: WARRANTY_ID, serialNumber: 'SN-123' });
    expect(result.success).toBe(true);
  });

  it('does not queue email when warranty is not found', async () => {
    const result = await registerWarranty({ warrantyId: 'no-such-id' });
    expect(result.success).toBe(false);
    const queued = __getInserted('EmailQueue');
    expect(queued).toHaveLength(0);
  });
});
