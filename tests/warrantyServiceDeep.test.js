/**
 * Deep coverage tests for warrantyService.web.js — edge cases in input
 * validation, price calculation boundaries, date/expiration handling,
 * claim status transitions, and defensive behavior against invalid inputs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getWarrantyPlans,
  calculateWarrantyPrice,
  purchaseWarranty,
  registerWarranty,
  getMyWarranties,
  getWarrantyDetails,
  submitClaim,
  getClaimStatus,
  getMyClaims,
} from '../src/backend/warrantyService.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'a0b1c2d3-0001-0001-0001-000000000001', loginEmail: 'deep@example.com' });
});

const PLAN_BASIC = {
  _id: 'a0b1c2d3-plan-0001-0001-000000000001',
  name: 'Basic Protection',
  tierSlug: 'basic',
  durationYears: 1,
  coverageType: 'manufacturer',
  priceMultiplier: 0,
  description: 'Standard manufacturer warranty',
  coveredItems: '["frame defects"]',
  excludedItems: '["normal wear"]',
  priority: 1,
  active: true,
};

const PLAN_EXTENDED = {
  _id: 'a0b1c2d3-plan-0002-0002-000000000002',
  name: 'Extended Protection',
  tierSlug: 'extended',
  durationYears: 3,
  coverageType: 'extended',
  priceMultiplier: 0.08,
  description: '3-year extended coverage',
  coveredItems: '["frame defects","fabric tears","mechanism failure"]',
  excludedItems: '["cosmetic damage"]',
  priority: 2,
  active: true,
};

const PLAN_PREMIUM = {
  _id: 'a0b1c2d3-plan-0003-0003-000000000003',
  name: 'Premium Protection',
  tierSlug: 'premium',
  durationYears: 5,
  coverageType: 'comprehensive',
  priceMultiplier: 0.12,
  description: '5-year comprehensive',
  coveredItems: '["frame defects","fabric tears","mechanism failure","accidental damage","stains"]',
  excludedItems: '["intentional damage"]',
  priority: 3,
  active: true,
};

const ALL_PLANS = [PLAN_BASIC, PLAN_EXTENDED, PLAN_PREMIUM];

const MEMBER_ID = 'a0b1c2d3-0001-0001-0001-000000000001';

function makeWarranty(overrides = {}) {
  return {
    _id: 'a0b1c2d3-wr01-0001-0001-000000000001',
    memberId: MEMBER_ID,
    planId: PLAN_EXTENDED._id,
    planName: 'Extended Protection',
    productId: 'a0b1c2d3-prod-0001-0001-000000000001',
    productName: 'Classic Futon Frame',
    orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    warrantyPrice: 40,
    status: 'active',
    purchasedAt: new Date('2026-01-01'),
    expiresAt: new Date('2029-01-01'),
    registeredAt: null,
    serialNumber: '',
    purchaseDate: '',
    ...overrides,
  };
}

// ── calculateWarrantyPrice — NaN/Infinity/null/string edge cases ─────

describe('calculateWarrantyPrice — invalid numeric inputs', () => {
  it('rejects NaN productPrice', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const result = await calculateWarrantyPrice(PLAN_EXTENDED._id, NaN);
    expect(result.success).toBe(false);
    expect(result.error).toContain('price');
  });

  it('caps Infinity productPrice at MAX_PRODUCT_PRICE', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const result = await calculateWarrantyPrice(PLAN_EXTENDED._id, Infinity);
    expect(result.success).toBe(true);
    expect(result.price).toBe(Math.round(25000 * 0.08 * 100) / 100);
  });

  it('rejects null and undefined productPrice', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const r1 = await calculateWarrantyPrice(PLAN_EXTENDED._id, null);
    expect(r1.success).toBe(false);
    const r2 = await calculateWarrantyPrice(PLAN_EXTENDED._id, undefined);
    expect(r2.success).toBe(false);
  });

  it('coerces numeric strings but rejects non-numeric strings', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const r1 = await calculateWarrantyPrice(PLAN_EXTENDED._id, '500');
    expect(r1.success).toBe(true);
    expect(r1.price).toBe(40); // 500 * 0.08

    const r2 = await calculateWarrantyPrice(PLAN_EXTENDED._id, 'abc');
    expect(r2.success).toBe(false);
  });

  it('caps at MAX_PRODUCT_PRICE boundary (25001 capped, 25000 exact)', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const r1 = await calculateWarrantyPrice(PLAN_EXTENDED._id, 25001);
    expect(r1.success).toBe(true);
    expect(r1.price).toBe(Math.round(25000 * 0.08 * 100) / 100);

    const r2 = await calculateWarrantyPrice(PLAN_EXTENDED._id, 25000);
    expect(r2.success).toBe(true);
    expect(r2.price).toBe(2000); // 25000 * 0.08
  });

  it('rejects null planId and planId with special characters', async () => {
    const r1 = await calculateWarrantyPrice(null, 500);
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('plan ID');

    const r2 = await calculateWarrantyPrice('plan<script>', 500);
    expect(r2.success).toBe(false);
  });
});

// ── getWarrantyPlans — edge cases ────────────────────────────────────

describe('getWarrantyPlans — deep edge cases', () => {
  it('rejects undefined and numeric category inputs', async () => {
    const r1 = await getWarrantyPlans(undefined);
    expect(r1.success).toBe(false);
    expect(r1.plans).toEqual([]);

    const r2 = await getWarrantyPlans(12345);
    expect(r2.success).toBe(false);
  });

  it('parseJsonArray returns [] for non-array JSON values', async () => {
    __seed('WarrantyPlans', [{
      ...PLAN_BASIC,
      _id: 'a0b1c2d3-plan-0099-0099-000000000099',
      coveredItems: '"just a string"',
      excludedItems: '42',
    }]);

    const result = await getWarrantyPlans('futons');
    expect(result.success).toBe(true);
    expect(result.plans[0].coveredItems).toEqual([]);
    expect(result.plans[0].excludedItems).toEqual([]);
  });

  it('does not expose active field to client in plan response', async () => {
    __seed('WarrantyPlans', [PLAN_EXTENDED]);
    const result = await getWarrantyPlans('futons');
    expect(result.success).toBe(true);
    const plan = result.plans[0];
    expect(plan).toHaveProperty('_id');
    expect(plan).toHaveProperty('name');
    expect(plan).toHaveProperty('tierSlug');
    expect(plan).toHaveProperty('priceMultiplier');
    expect(plan).not.toHaveProperty('active');
  });
});

// ── purchaseWarranty — edge cases ────────────────────────────────────

describe('purchaseWarranty — deep edge cases', () => {
  it('rejects NaN productPrice', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    const result = await purchaseWarranty({
      planId: PLAN_EXTENDED._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productName: 'Test Frame',
      productPrice: NaN,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('price');
  });

  it('caps productPrice at MAX_PRODUCT_PRICE for warranty price calculation', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'WarrantyRegistrations') insertedItem = item;
    });

    const result = await purchaseWarranty({
      planId: PLAN_EXTENDED._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productName: 'Luxury Frame',
      productPrice: 50000,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });

    expect(result.success).toBe(true);
    expect(result.warranty.warrantyPrice).toBe(Math.round(25000 * 0.08 * 100) / 100);
  });

  it('handles missing productName gracefully (defaults to empty)', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'WarrantyRegistrations') insertedItem = item;
    });

    const result = await purchaseWarranty({
      planId: PLAN_BASIC._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productPrice: 500,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });

    expect(result.success).toBe(true);
    expect(insertedItem.productName).toBe('');
  });

  it('sets initial registeredAt to null and serialNumber/purchaseDate to empty', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'WarrantyRegistrations') insertedItem = item;
    });

    await purchaseWarranty({
      planId: PLAN_BASIC._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productName: 'Frame',
      productPrice: 500,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });

    expect(insertedItem.registeredAt).toBeNull();
    expect(insertedItem.serialNumber).toBe('');
    expect(insertedItem.purchaseDate).toBe('');
  });

  it('sets expiresAt exactly N years from purchasedAt based on plan durationYears', async () => {
    __seed('WarrantyPlans', ALL_PLANS);
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'WarrantyRegistrations') insertedItem = item;
    });

    await purchaseWarranty({
      planId: PLAN_PREMIUM._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productName: 'Frame',
      productPrice: 1000,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });

    const purchasedYear = insertedItem.purchasedAt.getFullYear();
    const expiresYear = insertedItem.expiresAt.getFullYear();
    expect(expiresYear - purchasedYear).toBe(5);
  });

  it('returns purchasedAt and expiresAt as ISO strings in response', async () => {
    __seed('WarrantyPlans', ALL_PLANS);

    const result = await purchaseWarranty({
      planId: PLAN_BASIC._id,
      productId: 'a0b1c2d3-prod-0001-0001-000000000001',
      productName: 'Frame',
      productPrice: 500,
      orderId: 'a0b1c2d3-ordr-0001-0001-000000000001',
    });

    expect(result.success).toBe(true);
    expect(typeof result.warranty.purchasedAt).toBe('string');
    expect(typeof result.warranty.expiresAt).toBe('string');
    expect(result.warranty.purchasedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── registerWarranty — edge cases ────────────────────────────────────

describe('registerWarranty — deep edge cases', () => {
  it('defaults serialNumber and purchaseDate to empty when omitted', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'WarrantyRegistrations') updatedItem = item;
    });

    await registerWarranty({ warrantyId: makeWarranty()._id });

    expect(updatedItem.serialNumber).toBe('');
    expect(updatedItem.purchaseDate).toBe('');
  });

  it('sets registeredAt to current date on registration', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'WarrantyRegistrations') updatedItem = item;
    });

    const before = new Date();
    await registerWarranty({
      warrantyId: makeWarranty()._id,
      serialNumber: 'SN-99999',
      purchaseDate: '2026-01-15',
    });
    const after = new Date();

    expect(updatedItem.registeredAt).toBeInstanceOf(Date);
    expect(updatedItem.registeredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatedItem.registeredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('rejects null warrantyId', async () => {
    const result = await registerWarranty({ warrantyId: null });
    expect(result.success).toBe(false);
    expect(result.error).toContain('warranty ID');
  });

  it('truncates serialNumber to maxLen=100', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'WarrantyRegistrations') updatedItem = item;
    });

    await registerWarranty({
      warrantyId: makeWarranty()._id,
      serialNumber: 'A'.repeat(200),
    });

    expect(updatedItem.serialNumber.length).toBeLessThanOrEqual(100);
  });

  it('truncates purchaseDate to maxLen=20', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'WarrantyRegistrations') updatedItem = item;
    });

    await registerWarranty({
      warrantyId: makeWarranty()._id,
      purchaseDate: '2026-01-15T00:00:00.000Z-extra-extra-extra',
    });

    expect(updatedItem.purchaseDate.length).toBeLessThanOrEqual(20);
  });
});

// ── getWarrantyDetails — edge cases ──────────────────────────────────

describe('getWarrantyDetails — deep edge cases', () => {
  it('returns empty serialNumber when field is missing from record', async () => {
    const wr = makeWarranty();
    delete wr.serialNumber;
    __seed('WarrantyRegistrations', [wr]);
    __seed('WarrantyPlans', ALL_PLANS);

    const result = await getWarrantyDetails(wr._id);
    expect(result.success).toBe(true);
    expect(result.warranty.serialNumber).toBe('');
  });

  it('returns coveredItems and excludedItems from plan lookup', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    __seed('WarrantyPlans', ALL_PLANS);

    const result = await getWarrantyDetails(makeWarranty()._id);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.warranty.coveredItems)).toBe(true);
    expect(result.warranty.coveredItems.length).toBeGreaterThan(0);
  });

  it('returns empty coveredItems/excludedItems when planId is falsy', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ planId: '' })]);
    __seed('WarrantyPlans', ALL_PLANS);

    const result = await getWarrantyDetails(makeWarranty()._id);
    expect(result.success).toBe(true);
    expect(result.warranty.coveredItems).toEqual([]);
    expect(result.warranty.excludedItems).toEqual([]);
  });

  it('rejects non-string warrantyId (null and numeric)', async () => {
    const r1 = await getWarrantyDetails(null);
    expect(r1.success).toBe(false);
    const r2 = await getWarrantyDetails(99999);
    expect(r2.success).toBe(false);
  });
});

// ── submitClaim — deep edge cases ────────────────────────────────────

describe('submitClaim — deep edge cases', () => {
  it('rejects description at MIN_DESCRIPTION_LENGTH - 1 (9 chars)', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'structural',
      description: '123456789',
      contactEmail: 'deep@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('description');
  });

  it('accepts description exactly at MIN_DESCRIPTION_LENGTH (10 chars)', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'structural',
      description: '1234567890',
      contactEmail: 'deep@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('generates claim number in CLM-YYYYMMDD-NNNN format', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'fabric',
      description: 'Fabric tearing on left armrest section.',
      contactEmail: 'deep@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.claim.claimNumber).toMatch(/^CLM-\d{8}-\d{4}$/);
  });

  it('accepts all six valid issue types', async () => {
    const validTypes = ['structural', 'fabric', 'mechanism', 'accidental', 'stain', 'other'];

    for (const issueType of validTypes) {
      resetData();
      __setMember({ _id: MEMBER_ID, loginEmail: 'deep@example.com' });
      __seed('WarrantyRegistrations', [makeWarranty()]);

      const result = await submitClaim({
        warrantyId: makeWarranty()._id,
        issueType,
        description: `Testing issue type: ${issueType} is valid`,
        contactEmail: 'deep@example.com',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects claim when warranty.status is expired even if expiresAt is future', async () => {
    __seed('WarrantyRegistrations', [
      makeWarranty({ status: 'expired', expiresAt: new Date('2099-01-01') }),
    ]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'structural',
      description: 'Should fail because warranty status is expired.',
      contactEmail: 'deep@example.com',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  });

  it('allows claim when warranty expires far in the future', async () => {
    __seed('WarrantyRegistrations', [
      makeWarranty({ status: 'active', expiresAt: new Date('2099-12-31') }),
    ]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'mechanism',
      description: 'Mechanism is stuck and will not fold properly.',
      contactEmail: 'deep@example.com',
    });

    expect(result.success).toBe(true);
  });

  it('sets default claim fields: contactPhone empty, status submitted, resolvedAt null', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);
    let insertedClaim = null;
    __onInsert((collection, item) => {
      if (collection === 'WarrantyClaims') insertedClaim = item;
    });

    await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'stain',
      description: 'Large coffee stain on cushion surface.',
      contactEmail: 'deep@example.com',
    });

    expect(insertedClaim.contactPhone).toBe('');
    expect(insertedClaim.status).toBe('submitted');
    expect(insertedClaim.resolvedAt).toBeNull();
    expect(insertedClaim.resolution).toBe('');
  });

  it('rejects null issueType and null contactEmail', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);

    const r1 = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: null,
      description: 'Some issue description here that is long enough.',
      contactEmail: 'deep@example.com',
    });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain('issue type');

    const r2 = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'structural',
      description: 'Frame cracked under normal use conditions.',
      contactEmail: null,
    });
    expect(r2.success).toBe(false);
    expect(r2.error).toContain('email');
  });

  it('returns submittedAt as ISO string in response', async () => {
    __seed('WarrantyRegistrations', [makeWarranty()]);

    const result = await submitClaim({
      warrantyId: makeWarranty()._id,
      issueType: 'accidental',
      description: 'Accidentally dropped something heavy on the frame.',
      contactEmail: 'deep@example.com',
    });

    expect(result.success).toBe(true);
    expect(typeof result.claim.submittedAt).toBe('string');
    expect(result.claim.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── getClaimStatus — edge cases ──────────────────────────────────────

describe('getClaimStatus — deep edge cases', () => {
  it('returns empty resolution string when resolution field is missing', async () => {
    __seed('WarrantyClaims', [{
      _id: 'a0b1c2d3-clm1-0001-0001-000000000001',
      memberId: MEMBER_ID,
      warrantyId: 'a0b1c2d3-wr01-0001-0001-000000000001',
      claimNumber: 'CLM-20260301-0001',
      issueType: 'structural',
      description: 'Frame broke',
      status: 'submitted',
      contactEmail: 'deep@example.com',
      submittedAt: new Date(),
      resolvedAt: null,
    }]);

    const result = await getClaimStatus('a0b1c2d3-clm1-0001-0001-000000000001');
    expect(result.success).toBe(true);
    expect(result.claim.resolution).toBe('');
  });

  it('returns resolution and resolvedAt when claim is resolved', async () => {
    __seed('WarrantyClaims', [{
      _id: 'a0b1c2d3-clm1-0001-0001-000000000001',
      memberId: MEMBER_ID,
      warrantyId: 'a0b1c2d3-wr01-0001-0001-000000000001',
      claimNumber: 'CLM-20260301-0001',
      issueType: 'fabric',
      description: 'Tear in upholstery',
      status: 'resolved',
      contactEmail: 'deep@example.com',
      submittedAt: new Date('2026-03-01'),
      resolvedAt: new Date('2026-03-10'),
      resolution: 'Replacement cushion shipped.',
    }]);

    const result = await getClaimStatus('a0b1c2d3-clm1-0001-0001-000000000001');
    expect(result.success).toBe(true);
    expect(result.claim.status).toBe('resolved');
    expect(result.claim.resolution).toBe('Replacement cushion shipped.');
    expect(result.claim.resolvedAt).toBeDefined();
  });

  it('rejects SQL-injection-style claimId', async () => {
    const result = await getClaimStatus('"; DROP TABLE WarrantyClaims; --');
    expect(result.success).toBe(false);
  });
});

// ── getMyClaims — edge cases ─────────────────────────────────────────

describe('getMyClaims — deep edge cases', () => {
  it('does not expose memberId or contactEmail in returned claims', async () => {
    __seed('WarrantyClaims', [{
      _id: 'a0b1c2d3-clm1-0001-0001-000000000001',
      memberId: MEMBER_ID,
      warrantyId: 'a0b1c2d3-wr01-0001-0001-000000000001',
      claimNumber: 'CLM-20260301-0001',
      issueType: 'structural',
      description: 'Frame issue',
      status: 'submitted',
      contactEmail: 'deep@example.com',
      submittedAt: new Date(),
      resolvedAt: null,
    }]);

    const result = await getMyClaims();
    expect(result.success).toBe(true);
    expect(result.claims[0]).not.toHaveProperty('memberId');
    expect(result.claims[0]).not.toHaveProperty('contactEmail');
  });

  it('includes resolvedAt as null for pending claims', async () => {
    __seed('WarrantyClaims', [{
      _id: 'a0b1c2d3-clm1-0001-0001-000000000001',
      memberId: MEMBER_ID,
      warrantyId: 'a0b1c2d3-wr01-0001-0001-000000000001',
      claimNumber: 'CLM-20260301-0001',
      issueType: 'stain',
      description: 'Coffee stain on cushion',
      status: 'under_review',
      contactEmail: 'deep@example.com',
      submittedAt: new Date(),
      resolvedAt: null,
    }]);

    const result = await getMyClaims();
    expect(result.success).toBe(true);
    expect(result.claims[0].resolvedAt).toBeNull();
    expect(result.claims[0].status).toBe('under_review');
  });
});

// ── getMyWarranties — edge cases ─────────────────────────────────────

describe('getMyWarranties — deep edge cases', () => {
  it('does not expose memberId or serialNumber in list response', async () => {
    __seed('WarrantyRegistrations', [makeWarranty({ serialNumber: 'SN-SECRET' })]);

    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties[0]).not.toHaveProperty('memberId');
    expect(result.warranties[0]).not.toHaveProperty('serialNumber');
  });

  it('includes registeredAt as null when unregistered, as Date when registered', async () => {
    const regDate = new Date('2026-02-01');
    __seed('WarrantyRegistrations', [
      makeWarranty({ _id: 'a0b1c2d3-wr01-0001-0001-000000000011', registeredAt: null }),
      makeWarranty({ _id: 'a0b1c2d3-wr01-0001-0001-000000000012', registeredAt: regDate }),
    ]);

    const result = await getMyWarranties();
    expect(result.success).toBe(true);
    expect(result.warranties).toHaveLength(2);
    const unreg = result.warranties.find(w => w._id === 'a0b1c2d3-wr01-0001-0001-000000000011');
    const reg = result.warranties.find(w => w._id === 'a0b1c2d3-wr01-0001-0001-000000000012');
    expect(unreg.registeredAt).toBeNull();
    expect(reg.registeredAt).toEqual(regDate);
  });
});
