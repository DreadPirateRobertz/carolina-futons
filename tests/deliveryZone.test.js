/**
 * @file deliveryZone.test.js
 * @description TDD tests for GET /_functions/deliveryZone HTTP endpoint.
 *
 * cf-3qt.4.4: Next.js GET /api/delivery-zone?zip= proxies to this Velo endpoint.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('backend/deliveryZoneService.web', () => ({
  getDeliveryZone: vi.fn(),
}));

import { getDeliveryZone } from 'backend/deliveryZoneService.web';
import { get_deliveryZone, options_deliveryZone } from '../src/backend/http-functions.js';

function makeRequest(query = {}) {
  return {
    query,
    headers: { origin: 'https://carolina-futons-web.vercel.app' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('get_deliveryZone — success', () => {
  it('returns 200 with zone data on valid zip', async () => {
    getDeliveryZone.mockResolvedValue({ zone: 'local', rate: 25, eta: '1-2 business days', distanceMiles: 0 });
    const res = await get_deliveryZone(makeRequest({ zip: '28792' }));
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.zone).toBe('local');
  });

  it('returns CORS headers', async () => {
    getDeliveryZone.mockResolvedValue({ zone: 'local', rate: 25, eta: '1-2 business days', distanceMiles: 0 });
    const res = await get_deliveryZone(makeRequest({ zip: '28792' }));
    expect(res.headers).toHaveProperty('Access-Control-Allow-Origin');
  });

  it('includes rate in response body', async () => {
    getDeliveryZone.mockResolvedValue({ zone: 'regional', rate: 45, eta: '1-2 business days', distanceMiles: 22 });
    const res = await get_deliveryZone(makeRequest({ zip: '28801' }));
    const body = JSON.parse(res.body);
    expect(body.rate).toBe(45);
  });

  it('includes distanceMiles in response body', async () => {
    getDeliveryZone.mockResolvedValue({ zone: 'regional', rate: 45, eta: '1-2 business days', distanceMiles: 22 });
    const res = await get_deliveryZone(makeRequest({ zip: '28801' }));
    const body = JSON.parse(res.body);
    expect(body.distanceMiles).toBe(22);
  });

  it('includes success:true in response body', async () => {
    getDeliveryZone.mockResolvedValue({ zone: 'local', rate: 25, eta: '1-2 business days', distanceMiles: 0 });
    const res = await get_deliveryZone(makeRequest({ zip: '28792' }));
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});

describe('get_deliveryZone — validation', () => {
  it('returns 400 when zip is missing', async () => {
    const res = await get_deliveryZone(makeRequest({}));
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/zip/i);
  });

  it('returns 400 when zip is empty string', async () => {
    const res = await get_deliveryZone(makeRequest({ zip: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when zip is not 5 digits', async () => {
    const res = await get_deliveryZone(makeRequest({ zip: '123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when zip contains letters', async () => {
    const res = await get_deliveryZone(makeRequest({ zip: 'ABCDE' }));
    expect(res.status).toBe(400);
  });
});

describe('get_deliveryZone — error handling', () => {
  it('returns 500 when webMethod throws', async () => {
    getDeliveryZone.mockRejectedValue(new Error('DB error'));
    const res = await get_deliveryZone(makeRequest({ zip: '28792' }));
    expect(res.status).toBe(500);
  });

  it('returns 400 + success:false when service returns { error } envelope (cf-89xn lying-status)', async () => {
    // The webMethod has its own input-validation branch that returns
    // { error: 'Please enter a valid 5-digit zip code.' }. Spreading that
    // into the 200 envelope used to produce { success: true, error: '...' } —
    // exact cf-tvbi lying-status pattern. Wrapper now surfaces 400.
    getDeliveryZone.mockResolvedValue({ error: 'Please enter a valid 5-digit zip code.' });
    const res = await get_deliveryZone(makeRequest({ zip: '28792' }));
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/5-digit zip/i);
  });
});

describe('options_deliveryZone — CORS preflight', () => {
  it('returns 204 for preflight', async () => {
    const res = await options_deliveryZone(makeRequest());
    expect(res.status).toBe(204);
  });
});
