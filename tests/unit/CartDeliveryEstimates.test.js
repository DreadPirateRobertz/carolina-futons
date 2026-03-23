/**
 * @file CartDeliveryEstimates.test.js
 * @description Unit tests for CartDeliveryEstimates.js — per-item delivery estimate
 * display in cart repeaters (Side Cart + Cart Page).
 *
 * Covers:
 *  - initCartDelivery: input validation (null/empty items, invalid zip)
 *  - State: no-zip → prompt text
 *  - State: local zone → local delivery window
 *  - State: freight item (Murphy/Platform Bed) → freight message
 *  - State: parcel (national/regional) → Est. arrival
 *  - Multiple items each updated independently
 *  - deliveryZoneText set to origin text when zip present
 *  - opts.repeaterSelector overrides default repeater ID
 *  - catch block coverage: setItemText + initCartDelivery warn on error (CF-tv2p)
 *  - ZIP validation: only-digit < 5 chars rejected before API call (CF-tv2p)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('public/DeliveryEstimator.js', () => ({
  getShippingZone: vi.fn().mockReturnValue('national'),
}));

vi.mock('public/sharedTokens.js', () => ({
  shippingConfig: {
    zones: {
      local: { prefixMin: 270, prefixMax: 289, deliveryDays: '3-5 business days' },
      regional: { prefixMin: 290, prefixMax: 399, deliveryDays: '5-8 business days' },
      national: { deliveryDays: '7-12 business days' },
    },
  },
}));

import { initCartDelivery } from '../../src/public/CartDeliveryEstimates.js';
import { getShippingZone } from 'public/DeliveryEstimator.js';

// ── Test helpers ────────────────────────────────────────────────────────────

/** Build a mock repeater that tracks forEachItem calls and element state. */
function makeRepeater(itemDataList = []) {
  const elementsByItem = itemDataList.map(() => ({
    '#deliveryEstimateText': { text: '' },
    '#deliveryZoneText': { text: '' },
  }));

  const repeater = {
    forEachItem: vi.fn((fn) => {
      itemDataList.forEach((data, i) => {
        const $item = (sel) => elementsByItem[i][sel] ?? { text: '' };
        fn($item, data, i);
      });
    }),
    _elements: elementsByItem,
  };

  return repeater;
}

/** Build a mock $w that serves a repeater at the given selector. */
function make$w(repeaterSelector, repeater) {
  return (sel) => {
    if (sel === repeaterSelector) return repeater;
    return { text: '', forEachItem: vi.fn() };
  };
}

const PARCEL_ITEM = { _id: 'item-1', name: 'Classic Futon Frame', quantity: 1, price: 299 };
const MURPHY_ITEM = { _id: 'item-2', name: 'Murphy Bed Queen', quantity: 1, price: 1299 };
const PLATFORM_ITEM = { _id: 'item-3', name: 'Platform Bed Full', quantity: 1, price: 799 };
const VALID_ZIP_NATIONAL = '10001'; // NYC — national
const VALID_ZIP_LOCAL = '28701';   // Asheville NC — local
const VALID_ZIP_REGIONAL = '29401'; // Charleston SC — regional

beforeEach(() => {
  vi.clearAllMocks();
  getShippingZone.mockReturnValue('national');
});

// ── Input validation ──────────────────────────────────────────────────────

describe('initCartDelivery — input validation', () => {
  it('returns without error when cartItems is null', () => {
    const repeater = makeRepeater([]);
    const $w = make$w('#sideCartRepeater', repeater);
    expect(() => initCartDelivery($w, null, VALID_ZIP_NATIONAL)).not.toThrow();
    expect(repeater.forEachItem).not.toHaveBeenCalled();
  });

  it('returns without error when cartItems is empty array', () => {
    const repeater = makeRepeater([]);
    const $w = make$w('#sideCartRepeater', repeater);
    expect(() => initCartDelivery($w, [], VALID_ZIP_NATIONAL)).not.toThrow();
    expect(repeater.forEachItem).not.toHaveBeenCalled();
  });

  it('returns without error when cartItems is not an array', () => {
    const repeater = makeRepeater([]);
    const $w = make$w('#sideCartRepeater', repeater);
    expect(() => initCartDelivery($w, 'not-an-array', VALID_ZIP_NATIONAL)).not.toThrow();
    expect(repeater.forEachItem).not.toHaveBeenCalled();
  });

  it('calls forEachItem when cartItems has items', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater.forEachItem).toHaveBeenCalledOnce();
  });
});

// ── No-zip state ─────────────────────────────────────────────────────────

describe('initCartDelivery — no-zip state', () => {
  it('shows prompt when zip is null', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], null);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
  });

  it('shows prompt when zip is empty string', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '');
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
  });

  it('shows prompt when zip is invalid (non-5-digit)', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '287');
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
  });

  it('shows prompt when zip is 6 digits', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '287010');
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
  });

  it('clears deliveryZoneText when no zip', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], null);
    expect(repeater._elements[0]['#deliveryZoneText'].text).toBe('');
  });

  it('does not call getShippingZone when zip is missing', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], null);
    expect(getShippingZone).not.toHaveBeenCalled();
  });
});

// ── Local zone state ──────────────────────────────────────────────────────

describe('initCartDelivery — local zone state', () => {
  beforeEach(() => {
    getShippingZone.mockReturnValue('local');
  });

  it('shows local delivery text for WNC zip', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_LOCAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toContain('3-5 business days');
  });

  it('local delivery text includes "Local delivery"', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_LOCAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toMatch(/local delivery/i);
  });

  it('sets deliveryZoneText to origin message for local zone', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_LOCAL);
    expect(repeater._elements[0]['#deliveryZoneText'].text)
      .toBe('Ships from Hendersonville, NC');
  });
});

// ── Freight state ─────────────────────────────────────────────────────────

describe('initCartDelivery — freight state', () => {
  it('shows freight message for Murphy Bed item', () => {
    const repeater = makeRepeater([MURPHY_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [MURPHY_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Freight: 10-14 business days (carrier will call to schedule)');
  });

  it('shows freight message for Platform Bed item', () => {
    const repeater = makeRepeater([PLATFORM_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PLATFORM_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Freight: 10-14 business days (carrier will call to schedule)');
  });

  it('sets deliveryZoneText to origin message for freight items', () => {
    const repeater = makeRepeater([MURPHY_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [MURPHY_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryZoneText'].text)
      .toBe('Ships from Hendersonville, NC');
  });

  it('freight detection is case-insensitive', () => {
    const item = { _id: 'x', name: 'murphy bed twin', quantity: 1, price: 999 };
    const repeater = makeRepeater([item]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [item], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toContain('Freight');
  });

  // CF-ieq1: Murphy bed in local zone — CF truck handles it, NOT freight
  // Intentional behaviour: local zone short-circuits before freight check.
  // If this ever changes, update setItemText() ordering too.
  it('Murphy bed in local zone shows Local delivery, not freight', () => {
    getShippingZone.mockReturnValue('local');
    const repeater = makeRepeater([MURPHY_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [MURPHY_ITEM], VALID_ZIP_LOCAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toMatch(/local delivery/i);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .not.toContain('Freight');
  });

  // CF-ieq1: item with no name property — isFreightItem guard (item?.name || '')
  it('item with undefined name does not throw and shows parcel text', () => {
    const noNameItem = { _id: 'nn', quantity: 1, price: 199 }; // name absent
    const repeater = makeRepeater([noNameItem]);
    const $w = make$w('#sideCartRepeater', repeater);
    expect(() => initCartDelivery($w, [noNameItem], VALID_ZIP_NATIONAL)).not.toThrow();
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .not.toContain('Freight');
  });
});

// ── Parcel state ──────────────────────────────────────────────────────────

describe('initCartDelivery — parcel state', () => {
  it('shows "Est. arrival:" text for national parcel item', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toMatch(/Est\. arrival:/);
  });

  it('includes delivery days in parcel text', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toContain('business days');
  });

  it('shows regional delivery time for regional zip', () => {
    getShippingZone.mockReturnValue('regional');
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_REGIONAL);
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toContain('5-8 business days');
  });

  it('sets deliveryZoneText to origin for parcel items', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater._elements[0]['#deliveryZoneText'].text)
      .toBe('Ships from Hendersonville, NC');
  });

  it('calls getShippingZone with the provided zip', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(getShippingZone).toHaveBeenCalledWith(VALID_ZIP_NATIONAL);
  });
});

// ── Multi-item ───────────────────────────────────────────────────────────

describe('initCartDelivery — multiple items', () => {
  it('updates each item independently (parcel + freight)', () => {
    getShippingZone.mockReturnValue('national');
    const items = [PARCEL_ITEM, MURPHY_ITEM];
    const repeater = makeRepeater(items);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, items, VALID_ZIP_NATIONAL);

    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toMatch(/Est\. arrival:/);
    expect(repeater._elements[1]['#deliveryEstimateText'].text)
      .toContain('Freight');
  });

  it('both items get zone text when zip is valid', () => {
    const items = [PARCEL_ITEM, MURPHY_ITEM];
    const repeater = makeRepeater(items);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, items, VALID_ZIP_NATIONAL);

    expect(repeater._elements[0]['#deliveryZoneText'].text)
      .toBe('Ships from Hendersonville, NC');
    expect(repeater._elements[1]['#deliveryZoneText'].text)
      .toBe('Ships from Hendersonville, NC');
  });

  it('all items show no-zip prompt when zip missing', () => {
    const items = [PARCEL_ITEM, MURPHY_ITEM];
    const repeater = makeRepeater(items);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, items, null);

    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
    expect(repeater._elements[1]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
  });
});

// ── opts.repeaterSelector ────────────────────────────────────────────────

describe('initCartDelivery — opts.repeaterSelector', () => {
  it('uses #cartItemsRepeater when specified', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#cartItemsRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL, { repeaterSelector: '#cartItemsRepeater' });
    expect(repeater.forEachItem).toHaveBeenCalledOnce();
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toMatch(/Est\. arrival:/);
  });

  it('defaults to #sideCartRepeater when opts not provided', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL);
    expect(repeater.forEachItem).toHaveBeenCalledOnce();
  });
});

// ── catch block coverage (CF-tv2p) ──────────────────────────────────────

describe('initCartDelivery — catch block coverage', () => {
  it('warns via console.warn when repeater.forEachItem throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const brokenRepeater = {
      forEachItem: vi.fn(() => { throw new Error('repeater exploded'); }),
    };
    const $w = () => brokenRepeater;
    expect(() => initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CartDeliveryEstimates]'),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('warns via console.warn when $w(selector) throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwing$w = () => { throw new Error('$w boom'); };
    expect(() => initCartDelivery(throwing$w, [PARCEL_ITEM], VALID_ZIP_NATIONAL)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CartDeliveryEstimates]'),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it('warns via console.warn when element setter throws inside setItemText', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Element that throws on .text assignment
    const throwingElement = {
      get text() { return ''; },
      set text(_v) { throw new Error('element unavailable'); },
    };
    const brokenRepeater = {
      forEachItem: vi.fn((fn) => {
        const $item = (_sel) => throwingElement;
        fn($item, PARCEL_ITEM, 0);
      }),
    };
    const $w = () => brokenRepeater;
    expect(() => initCartDelivery($w, [PARCEL_ITEM], VALID_ZIP_NATIONAL)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[CartDeliveryEstimates]'),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });
});

// ── ZIP validation: digits-only < 5 chars (CF-tv2p) ─────────────────────

describe('initCartDelivery — ZIP validation edge cases', () => {
  it('treats 4-digit all-numeric ZIP as invalid → shows no-zip prompt', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '2870'); // 4 digits, no letters
    // zone resolves to null → no-zip prompt, not API call
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
    expect(getShippingZone).not.toHaveBeenCalled();
  });

  it('treats 3-digit all-numeric ZIP as invalid → shows no-zip prompt', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '287');
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
    expect(getShippingZone).not.toHaveBeenCalled();
  });

  it('treats 1-digit ZIP as invalid → shows no-zip prompt', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '2');
    expect(repeater._elements[0]['#deliveryEstimateText'].text)
      .toBe('Enter your zip for delivery estimate');
    expect(getShippingZone).not.toHaveBeenCalled();
  });

  it('accepts 5-digit all-numeric ZIP → calls getShippingZone', () => {
    const repeater = makeRepeater([PARCEL_ITEM]);
    const $w = make$w('#sideCartRepeater', repeater);
    initCartDelivery($w, [PARCEL_ITEM], '28701');
    expect(getShippingZone).toHaveBeenCalledWith('28701');
  });
});
