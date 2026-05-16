/**
 * cf-44qt sibling — ups-shipping.web.js observability cleanup.
 *
 * Pins post-migration contract: catches call logError instead of raw
 * console.error. UPS shipping is the carrier-pricing surface — silent
 * fails (OAuth blip, rate-API outage) silently strand orders.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (k) => {
    if (k === 'UPS_CLIENT_ID') return 'client_test';
    if (k === 'UPS_CLIENT_SECRET') return 'secret_test';
    return '';
  }),
}));
vi.mock('public/sharedTokens.js', () => ({
  brand: { name: 'Carolina Futons' },
  business: { address: { street: '824 Locust', city: 'Hendersonville', state: 'NC', zip: '28792' } },
  shippingConfig: { freeThreshold: 999999 },
}));

vi.mock('wix-fetch', () => ({
  fetch: vi.fn(async () => ({ ok: false, status: 500, text: async () => 'ups api error' })),
}));

describe('cf-44qt sibling — ups-shipping.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
  });

  it('getUPSRates wires logError on UPS API failure', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    await mod.getUPSRates(
      { street: '1 Test', city: 'Asheville', state: 'NC', zip: '28801', country: 'US' },
      [{ weight: 10 }],
    );
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ups-shipping/);
  });

  it('createShipment wires logError on UPS Shipment API failure', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    await mod.createShipment(
      { street: '1 Test', city: 'Asheville', state: 'NC', zip: '28801', country: 'US' },
      [{ weight: 10 }],
      '03', // GROUND
    );
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ups-shipping/);
  });

  it('trackShipment wires logError on UPS Tracking API failure', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    await mod.trackShipment('1Z9999999999999999');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ups-shipping/);
  });

  it('validateAddress wires logError on UPS Address Validation API failure', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    await mod.validateAddress({
      street: '1 Test',
      city: 'Asheville',
      state: 'NC',
      zip: '28801',
      country: 'US',
    });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map(c => c[0]).join('|');
    expect(allTags).toMatch(/ups-shipping/);
  });
});
