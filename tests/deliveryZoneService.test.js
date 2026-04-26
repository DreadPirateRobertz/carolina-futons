/**
 * @file deliveryZoneService.test.js
 * @description TDD unit tests for the getDeliveryZone webMethod.
 *
 * cf-3qt.4.4: AC — zip input returns correct zone for Hendersonville, Asheville, Charlotte.
 */
import { describe, it, expect } from 'vitest';
import { getDeliveryZone } from '../src/backend/deliveryZoneService.web.js';

describe('getDeliveryZone — Hendersonville (store city, zone 1)', () => {
  it('resolves zip 28792 to zone "local"', async () => {
    const result = await getDeliveryZone('28792');
    expect(result.zone).toBe('local');
  });

  it('returns a positive rate for local zone', async () => {
    const result = await getDeliveryZone('28792');
    expect(result.rate).toBeGreaterThan(0);
  });

  it('returns an ETA for local zone', async () => {
    const result = await getDeliveryZone('28792');
    expect(result.eta).toBeTruthy();
  });

  it('returns distanceMiles of 0 for store zip', async () => {
    const result = await getDeliveryZone('28792');
    expect(result.distanceMiles).toBe(0);
  });
});

describe('getDeliveryZone — Asheville (regional, zone 2)', () => {
  it('resolves zip 28801 to zone "regional"', async () => {
    const result = await getDeliveryZone('28801');
    expect(result.zone).toBe('regional');
  });

  it('returns a positive rate for regional zone', async () => {
    const result = await getDeliveryZone('28801');
    expect(result.rate).toBeGreaterThan(0);
  });

  it('distance from store to Asheville is 11-30 miles', async () => {
    const result = await getDeliveryZone('28801');
    expect(result.distanceMiles).toBeGreaterThan(10);
    expect(result.distanceMiles).toBeLessThanOrEqual(30);
  });
});

describe('getDeliveryZone — Charlotte (out of range)', () => {
  it('resolves zip 28202 to zone "outofrange"', async () => {
    const result = await getDeliveryZone('28202');
    expect(result.zone).toBe('outofrange');
  });

  it('returns null rate for out-of-range zone', async () => {
    const result = await getDeliveryZone('28202');
    expect(result.rate).toBeNull();
  });

  it('returns a contact message for out-of-range', async () => {
    const result = await getDeliveryZone('28202');
    expect(result.message).toBeTruthy();
  });
});

describe('getDeliveryZone — validation', () => {
  it('returns error for empty zip', async () => {
    const result = await getDeliveryZone('');
    expect(result.error).toBeTruthy();
  });

  it('returns error for non-numeric zip', async () => {
    const result = await getDeliveryZone('ABCDE');
    expect(result.error).toBeTruthy();
  });

  it('returns outofrange for unknown US zip', async () => {
    const result = await getDeliveryZone('90210');
    expect(result.zone).toBe('outofrange');
  });

  it('returns outofrange for a Charlotte zip', async () => {
    const result = await getDeliveryZone('28204');
    expect(result.zone).toBe('outofrange');
  });
});
