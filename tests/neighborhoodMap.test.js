/**
 * @file neighborhoodMap.test.js
 * @description Tests for the neighborhood furniture map module (cf-zp8o).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  getNearbyPins,
  getMapStats,
  _fuzzLocation,
  _FUZZ_DEGREES,
  _SEARCH_RADIUS_MILES,
} from '../src/backend/neighborhoodMap.web.js';

beforeEach(() => {
  __reset();
});

// ── Location Fuzzing ────────────────────────────────────────────────

describe('fuzzLocation', () => {
  it('returns a value within FUZZ_DEGREES of the input', () => {
    const original = 35.3187;
    for (let i = 0; i < 50; i++) {
      const fuzzed = _fuzzLocation(original);
      expect(Math.abs(fuzzed - original)).toBeLessThanOrEqual(_FUZZ_DEGREES);
    }
  });

  it('rounds to 4 decimal places', () => {
    const fuzzed = _fuzzLocation(35.3187);
    const decimals = String(fuzzed).split('.')[1] || '';
    expect(decimals.length).toBeLessThanOrEqual(4);
  });

  it('produces different values (not deterministic)', () => {
    const results = new Set();
    for (let i = 0; i < 20; i++) {
      results.add(_fuzzLocation(35.3187));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

// ── Nearby Pins Query ───────────────────────────────────────────────

describe('getNearbyPins', () => {
  it('returns pins within search radius', async () => {
    __seed('NeighborhoodPins', [
      { _id: 'pin-1', lat: 35.32, lng: -82.46, status: 'active', productName: 'Eureka Frame', productId: 'p1', neighborhood: 'Downtown', displayName: 'Sarah', rating: 5, photoUrls: '[]' },
      { _id: 'pin-2', lat: 35.33, lng: -82.45, status: 'active', productName: 'Monterey Frame', productId: 'p2', neighborhood: 'West Side', displayName: 'Tom', rating: 4, photoUrls: '["img.jpg"]' },
    ]);

    const result = await getNearbyPins(35.32, -82.46, 5);
    expect(result.success).toBe(true);
    expect(result.pins.length).toBeGreaterThanOrEqual(1);
    expect(result.pins[0].productName).toBeTruthy();
    expect(result.pins[0].displayName).toBeTruthy();
  });

  it('filters out inactive pins', async () => {
    __seed('NeighborhoodPins', [
      { _id: 'pin-1', lat: 35.32, lng: -82.46, status: 'active', productName: 'Frame', productId: 'p1', photoUrls: '[]' },
      { _id: 'pin-2', lat: 35.32, lng: -82.46, status: 'removed', productName: 'Old Frame', productId: 'p2', photoUrls: '[]' },
    ]);

    const result = await getNearbyPins(35.32, -82.46);
    expect(result.pins).toHaveLength(1);
  });

  it('rejects non-numeric coordinates', async () => {
    const result = await getNearbyPins('not-a-number', -82.46);
    expect(result.success).toBe(false);
  });

  it('clamps radius to 1-25 miles', async () => {
    __seed('NeighborhoodPins', []);
    // Just verify it doesn't error with extreme values
    const result = await getNearbyPins(35.32, -82.46, 100);
    expect(result.success).toBe(true);
  });

  it('parses photo URLs from JSON string', async () => {
    __seed('NeighborhoodPins', [
      { _id: 'pin-1', lat: 35.32, lng: -82.46, status: 'active', productName: 'Frame', productId: 'p1', photoUrls: '["photo1.jpg","photo2.jpg"]', displayName: 'Sarah', rating: 5 },
    ]);

    const result = await getNearbyPins(35.32, -82.46);
    expect(result.pins[0].photoUrls).toEqual(['photo1.jpg', 'photo2.jpg']);
  });

  it('returns pin metadata without exact address', async () => {
    __seed('NeighborhoodPins', [
      { _id: 'pin-1', lat: 35.32, lng: -82.46, status: 'active', productName: 'Frame', productId: 'p1', neighborhood: 'Downtown Hendersonville', reviewText: 'Love it!', rating: 5, displayName: 'Sarah M.', photoUrls: '[]' },
    ]);

    const result = await getNearbyPins(35.32, -82.46);
    const pin = result.pins[0];
    expect(pin.neighborhood).toBe('Downtown Hendersonville');
    expect(pin.reviewText).toBe('Love it!');
    expect(pin.rating).toBe(5);
    // No address field exposed
    expect(pin.address).toBeUndefined();
  });
});

// ── Map Stats ───────────────────────────────────────────────────────

describe('getMapStats', () => {
  it('computes totals and averages', async () => {
    __seed('NeighborhoodPins', [
      { _id: 'p1', status: 'active', neighborhood: 'Downtown', productName: 'Eureka', rating: 5 },
      { _id: 'p2', status: 'active', neighborhood: 'West Side', productName: 'Monterey', rating: 4 },
      { _id: 'p3', status: 'active', neighborhood: 'Downtown', productName: 'Eureka', rating: 3 },
    ]);

    const result = await getMapStats();
    expect(result.success).toBe(true);
    expect(result.stats.totalPins).toBe(3);
    expect(result.stats.neighborhoods).toBe(2);
    expect(result.stats.uniqueProducts).toBe(2);
    expect(result.stats.avgRating).toBe(4);
  });

  it('handles empty map', async () => {
    __seed('NeighborhoodPins', []);
    const result = await getMapStats();
    expect(result.stats.totalPins).toBe(0);
    expect(result.stats.avgRating).toBe(0);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('neighborhood map constants', () => {
  it('fuzz radius is 0.01 degrees (~0.7 miles)', () => {
    expect(_FUZZ_DEGREES).toBe(0.01);
  });

  it('default search radius is 5 miles', () => {
    expect(_SEARCH_RADIUS_MILES).toBe(5);
  });
});
