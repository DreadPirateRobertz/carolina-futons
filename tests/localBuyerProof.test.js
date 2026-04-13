/**
 * localBuyerProof.test.js
 * CF-rhqm — ZIP-based social proof: backend + frontend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Backend tests ─────────────────────────────────────────────────────────────

import {
  __reset,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';

import { getLocalBuyerCount } from '../src/backend/socialProof.web.js';

describe('getLocalBuyerCount (CF-rhqm)', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
  });

  it('returns count of unique buyers for ZIP prefix', async () => {
    __seed('Stores/Orders', [
      { _createdDate: new Date(), buyerInfo: { email: 'a@test.com' }, shippingInfo: { shipmentDetails: { address: { postalCode: '28792', city: 'Hendersonville' } } } },
      { _createdDate: new Date(), buyerInfo: { email: 'b@test.com' }, shippingInfo: { shipmentDetails: { address: { postalCode: '28791', city: 'Hendersonville' } } } },
      { _createdDate: new Date(), buyerInfo: { email: 'a@test.com' }, shippingInfo: { shipmentDetails: { address: { postalCode: '28792', city: 'Hendersonville' } } } }, // duplicate
    ]);

    const result = await getLocalBuyerCount('287');
    expect(result).not.toBeNull();
    expect(result.count).toBe(2); // deduplicated
    expect(result.city).toBe('Hendersonville');
  });

  it('returns count 0 when no orders match', async () => {
    __seed('Stores/Orders', []);
    const result = await getLocalBuyerCount('999');
    expect(result).not.toBeNull();
    expect(result.count).toBe(0);
  });

  it('returns null for invalid ZIP prefix', async () => {
    expect(await getLocalBuyerCount('')).toBeNull();
    expect(await getLocalBuyerCount('12')).toBeNull();
    expect(await getLocalBuyerCount(null)).toBeNull();
  });

  it('strips non-digits and truncates to 3', async () => {
    __seed('Stores/Orders', [
      { _createdDate: new Date(), buyerInfo: { email: 'c@test.com' }, shippingInfo: { shipmentDetails: { address: { postalCode: '28701', city: 'Asheville' } } } },
    ]);
    const result = await getLocalBuyerCount('287-xx');
    expect(result).not.toBeNull();
    expect(result.count).toBe(1);
  });

  it('returns null on DB error', async () => {
    __setQueryError('Stores/Orders', new Error('DB down'));
    const result = await getLocalBuyerCount('287');
    expect(result).toBeNull();
  });

  it('returns title-cased city name', async () => {
    __seed('Stores/Orders', [
      { _createdDate: new Date(), buyerInfo: { email: 'd@test.com' }, shippingInfo: { shipmentDetails: { address: { postalCode: '28701', city: 'asheville' } } } },
    ]);
    const result = await getLocalBuyerCount('287');
    expect(result.city).toBe('Asheville');
  });
});

// ── Frontend tests ────────────────────────────────────────────────────────────

import { initLocalBuyerProof } from 'public/LocalBuyerProof.js';

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

function mock$w(sel) { return getEl(sel); }

describe('initLocalBuyerProof widget (CF-rhqm)', () => {
  let getLocalBuyerCountMock;

  beforeEach(() => {
    elements.clear();
    getLocalBuyerCountMock = vi.fn().mockResolvedValue({ count: 12, city: 'Hendersonville' });
  });

  async function init(zip = '287', overrides = {}) {
    await initLocalBuyerProof(zip, {
      $w: mock$w,
      getLocalBuyerCount: getLocalBuyerCountMock,
      ...overrides,
    });
  }

  it('shows buyer count with city name', async () => {
    await init();
    expect(getEl('#localBuyerProof').text).toBe('12 people near Hendersonville bought furniture this week');
    expect(getEl('#localBuyerProof').expand).toHaveBeenCalled();
  });

  it('uses singular for count of 1', async () => {
    getLocalBuyerCountMock.mockResolvedValue({ count: 1, city: 'Asheville' });
    await init();
    expect(getEl('#localBuyerProof').text).toBe('1 person near Asheville bought furniture this week');
  });

  it('uses "your area" when city is empty', async () => {
    getLocalBuyerCountMock.mockResolvedValue({ count: 5, city: '' });
    await init();
    expect(getEl('#localBuyerProof').text).toContain('your area');
  });

  it('collapses when count is 0', async () => {
    getLocalBuyerCountMock.mockResolvedValue({ count: 0, city: '' });
    await init();
    expect(getEl('#localBuyerProof').collapse).toHaveBeenCalled();
  });

  it('collapses when result is null', async () => {
    getLocalBuyerCountMock.mockResolvedValue(null);
    await init();
    expect(getEl('#localBuyerProof').collapse).toHaveBeenCalled();
  });

  it('collapses on error', async () => {
    getLocalBuyerCountMock.mockRejectedValue(new Error('fail'));
    await init();
    expect(getEl('#localBuyerProof').collapse).toHaveBeenCalled();
  });

  it('does not throw on any error path', async () => {
    getLocalBuyerCountMock.mockRejectedValue(new Error('fail'));
    await expect(init()).resolves.toBeUndefined();
  });

  it('uses globalThis.$w when $w not provided in opts', async () => {
    vi.stubGlobal('$w', mock$w);
    await initLocalBuyerProof('287', { getLocalBuyerCount: getLocalBuyerCountMock });
    expect(getEl('#localBuyerProof').text).toContain('Hendersonville');
    vi.unstubAllGlobals();
  });
});
