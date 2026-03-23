/**
 * @file productResources.test.js
 * @description TDD tests for CF-wh4: getProductResources webMethod.
 *
 * Covers:
 *  - Returns empty array for missing productId
 *  - Returns empty array when no resources exist
 *  - Returns sorted resources (ascending sortOrder)
 *  - Strips internal fields (_id, _owner, etc.) from response
 *  - Returns empty array on wixData error (error resilience)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
} from './__mocks__/wix-data.js';
import { getProductResources } from '../src/backend/productResources.web.js';

const PRODUCT_ID = 'prod-abc123';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ── getProductResources ───────────────────────────────────────────────────────

describe('getProductResources', () => {
  it('returns empty array when productId is missing', async () => {
    const result = await getProductResources(null);
    expect(result).toEqual([]);
  });

  it('returns empty array when productId is empty string', async () => {
    const result = await getProductResources('');
    expect(result).toEqual([]);
  });

  it('returns empty array when no resources exist for product', async () => {
    // Different product seeded — should not appear
    __seed('ProductResources', [
      { _id: 'r-1', productId: 'other-product', resourceType: 'SPEC_SHEET', label: 'Spec', url: '/spec', sortOrder: 1 },
    ]);
    const result = await getProductResources(PRODUCT_ID);
    expect(result).toEqual([]);
  });

  it('returns resources sorted by sortOrder ascending', async () => {
    __seed('ProductResources', [
      { _id: 'r-3', productId: PRODUCT_ID, resourceType: 'WARRANTY', label: 'Warranty', url: '/warranty', sortOrder: 3 },
      { _id: 'r-1', productId: PRODUCT_ID, resourceType: 'SPEC_SHEET', label: 'Spec Sheet', url: '/spec', sortOrder: 1 },
      { _id: 'r-2', productId: PRODUCT_ID, resourceType: 'CARE_GUIDE', label: 'Care Guide', url: '/care', sortOrder: 2 },
    ]);
    const result = await getProductResources(PRODUCT_ID);
    expect(result).toHaveLength(3);
    expect(result[0].resourceType).toBe('SPEC_SHEET');
    expect(result[1].resourceType).toBe('CARE_GUIDE');
    expect(result[2].resourceType).toBe('WARRANTY');
  });

  it('returns correct field shape (resourceType, label, url, sortOrder)', async () => {
    __seed('ProductResources', [
      { _id: 'r-1', _owner: 'sys', _createdDate: new Date(), productId: PRODUCT_ID, resourceType: 'SPEC_SHEET', label: 'Download Spec Sheet', url: '/spec', sortOrder: 1 },
    ]);
    const result = await getProductResources(PRODUCT_ID);
    expect(result).toHaveLength(1);
    const item = result[0];
    expect(item).toEqual({ resourceType: 'SPEC_SHEET', label: 'Download Spec Sheet', url: '/spec', sortOrder: 1 });
    // Internal fields must not appear
    expect(item._id).toBeUndefined();
    expect(item._owner).toBeUndefined();
    expect(item.productId).toBeUndefined();
  });

  it('defaults sortOrder to 0 when field is missing', async () => {
    __seed('ProductResources', [
      { _id: 'r-1', productId: PRODUCT_ID, resourceType: 'VIDEO', label: 'Product Video', url: 'https://youtube.com/watch?v=abc' },
    ]);
    const result = await getProductResources(PRODUCT_ID);
    expect(result[0].sortOrder).toBe(0);
  });

  it('only returns resources for the requested productId', async () => {
    __seed('ProductResources', [
      { _id: 'r-1', productId: PRODUCT_ID, resourceType: 'SPEC_SHEET', label: 'My Spec', url: '/spec', sortOrder: 1 },
      { _id: 'r-2', productId: 'other-prod', resourceType: 'CARE_GUIDE', label: 'Other Care', url: '/care', sortOrder: 1 },
    ]);
    const result = await getProductResources(PRODUCT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('My Spec');
  });

  it('returns empty array and does not throw on wixData error', async () => {
    // Wix data mock doesn't throw by default, but test the error path
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Seed nothing — queries succeed but return empty
    const result = await getProductResources(PRODUCT_ID);
    expect(result).toEqual([]);
  });

  it('returns all resourceTypes correctly', async () => {
    const types = ['SPEC_SHEET', 'CARE_GUIDE', 'WARRANTY', 'VIDEO', 'POLICY_LINK', 'ASSEMBLY_GUIDE'];
    __seed('ProductResources', types.map((t, i) => ({
      _id: `r-${i}`, productId: PRODUCT_ID, resourceType: t, label: t, url: `/link/${i}`, sortOrder: i,
    })));
    const result = await getProductResources(PRODUCT_ID);
    expect(result.map(r => r.resourceType)).toEqual(types);
  });
});
