/**
 * @file freightTracking.test.js
 * @description Tests for freightTracking.web.js — LTL carrier detection,
 * tracking URL construction, freight shipping option detection, and
 * end-to-end payload building.
 *
 * Covers:
 *   - detectLTLCarrier: XPO variants, Estes variants, WWEX variants, parcel carriers, edge cases
 *   - buildLTLTrackingUrl: URL per carrier, missing PRO number, unknown carrier
 *   - isFreightShippingOption: code and title variants
 *   - buildFreightTrackingPayload: integration, parcel passthrough
 */

import { describe, it, expect } from 'vitest';
import {
  detectLTLCarrier,
  buildLTLTrackingUrl,
  isFreightShippingOption,
  buildFreightTrackingPayload,
  LTL_CARRIER,
} from '../src/backend/freightTracking.web.js';

// ── detectLTLCarrier ─────────────────────────────────────────────────────────

describe('detectLTLCarrier', () => {
  // XPO variants
  it('detects "xpo" → xpo', () => {
    expect(detectLTLCarrier('xpo')).toBe(LTL_CARRIER.XPO);
  });

  it('detects "XPO" (uppercase) → xpo', () => {
    expect(detectLTLCarrier('XPO')).toBe(LTL_CARRIER.XPO);
  });

  it('detects "XPO Logistics" → xpo', () => {
    expect(detectLTLCarrier('XPO Logistics')).toBe(LTL_CARRIER.XPO);
  });

  it('detects "XPO Freight" → xpo', () => {
    expect(detectLTLCarrier('XPO Freight')).toBe(LTL_CARRIER.XPO);
  });

  // Estes variants
  it('detects "estes" → estes', () => {
    expect(detectLTLCarrier('estes')).toBe(LTL_CARRIER.ESTES);
  });

  it('detects "Estes Express" → estes', () => {
    expect(detectLTLCarrier('Estes Express')).toBe(LTL_CARRIER.ESTES);
  });

  it('detects "ESTES EXPRESS LINES" (all caps) → estes', () => {
    expect(detectLTLCarrier('ESTES EXPRESS LINES')).toBe(LTL_CARRIER.ESTES);
  });

  // WWEX / unknown LTL
  it('detects "WWEX" → unknown (LTL but specific carrier not yet known)', () => {
    expect(detectLTLCarrier('WWEX')).toBe(LTL_CARRIER.UNKNOWN);
  });

  it('detects "WWEX Freight" → unknown', () => {
    expect(detectLTLCarrier('WWEX Freight')).toBe(LTL_CARRIER.UNKNOWN);
  });

  it('detects "UPS Freight" → unknown (rebranded TFI/LTL)', () => {
    expect(detectLTLCarrier('UPS Freight')).toBe(LTL_CARRIER.UNKNOWN);
  });

  it('detects "ltl" keyword → unknown', () => {
    expect(detectLTLCarrier('ltl carrier')).toBe(LTL_CARRIER.UNKNOWN);
  });

  // Parcel carriers — should return null
  it('returns null for "UPS" (parcel)', () => {
    expect(detectLTLCarrier('UPS')).toBeNull();
  });

  it('returns null for "FedEx"', () => {
    expect(detectLTLCarrier('FedEx')).toBeNull();
  });

  it('returns null for "USPS"', () => {
    expect(detectLTLCarrier('USPS')).toBeNull();
  });

  // Edge cases
  it('returns null for empty string', () => {
    expect(detectLTLCarrier('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(detectLTLCarrier(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(detectLTLCarrier(undefined)).toBeNull();
  });
});

// ── buildLTLTrackingUrl ──────────────────────────────────────────────────────

describe('buildLTLTrackingUrl', () => {
  it('builds XPO URL with PRO number', () => {
    const url = buildLTLTrackingUrl(LTL_CARRIER.XPO, '123456789');
    expect(url).toBe('https://www.xpo.com/track/123456789');
  });

  it('builds Estes URL with PRO number', () => {
    const url = buildLTLTrackingUrl(LTL_CARRIER.ESTES, '1234567890');
    expect(url).toBe('https://www.estes-express.com/tools/tracking?query=1234567890');
  });

  it('URL-encodes PRO numbers with spaces', () => {
    const url = buildLTLTrackingUrl(LTL_CARRIER.XPO, '123 456');
    expect(url).toBe('https://www.xpo.com/track/123456');
  });

  it('returns null for UNKNOWN carrier (no link to build)', () => {
    expect(buildLTLTrackingUrl(LTL_CARRIER.UNKNOWN, '999')).toBeNull();
  });

  it('returns null when PRO number is empty', () => {
    expect(buildLTLTrackingUrl(LTL_CARRIER.XPO, '')).toBeNull();
  });

  it('returns null when PRO number is null', () => {
    expect(buildLTLTrackingUrl(LTL_CARRIER.XPO, null)).toBeNull();
  });
});

// ── isFreightShippingOption ──────────────────────────────────────────────────

describe('isFreightShippingOption', () => {
  it('detects wwex-ltl-std code', () => {
    expect(isFreightShippingOption('wwex-ltl-std', '')).toBe(true);
  });

  it('detects wwex-ltl-gtd code', () => {
    expect(isFreightShippingOption('wwex-ltl-gtd', '')).toBe(true);
  });

  it('detects title containing "LTL Freight"', () => {
    expect(isFreightShippingOption('', '🚛 LTL Freight (WWEX)')).toBe(true);
  });

  it('detects title containing "Freight" (case insensitive)', () => {
    expect(isFreightShippingOption('', 'Standard freight delivery')).toBe(true);
  });

  it('detects wwex-ltl-est (fallback estimate code)', () => {
    expect(isFreightShippingOption('wwex-ltl-est', '')).toBe(true);
  });

  it('returns false for UPS parcel code', () => {
    expect(isFreightShippingOption('ups-ground', 'UPS Ground')).toBe(false);
  });

  it('returns false for free shipping code', () => {
    expect(isFreightShippingOption('free-shipping', 'Free Shipping')).toBe(false);
  });

  it('returns false for empty strings', () => {
    expect(isFreightShippingOption('', '')).toBe(false);
  });
});

// ── buildFreightTrackingPayload ──────────────────────────────────────────────

describe('buildFreightTrackingPayload', () => {
  it('returns isLTL:true and XPO tracking URL for XPO carrier', () => {
    const payload = buildFreightTrackingPayload({ carrierName: 'XPO Logistics', proNumber: '987654321' });
    expect(payload.isLTL).toBe(true);
    expect(payload.carrier).toBe(LTL_CARRIER.XPO);
    expect(payload.proNumber).toBe('987654321');
    expect(payload.trackingUrl).toBe('https://www.xpo.com/track/987654321');
    expect(payload.displayCarrier).toBe('XPO Logistics');
  });

  it('returns isLTL:true and Estes tracking URL for Estes carrier', () => {
    const payload = buildFreightTrackingPayload({ carrierName: 'Estes Express', proNumber: '1234567890' });
    expect(payload.isLTL).toBe(true);
    expect(payload.carrier).toBe(LTL_CARRIER.ESTES);
    expect(payload.trackingUrl).toContain('estes-express.com');
    expect(payload.displayCarrier).toBe('Estes Express');
  });

  it('returns isLTL:true and null trackingUrl for WWEX carrier (unknown final carrier)', () => {
    const payload = buildFreightTrackingPayload({ carrierName: 'WWEX', proNumber: '555555' });
    expect(payload.isLTL).toBe(true);
    expect(payload.carrier).toBe(LTL_CARRIER.UNKNOWN);
    expect(payload.trackingUrl).toBeNull();
    expect(payload.displayCarrier).toBe('WWEX Freight');
  });

  it('returns isLTL:false for UPS parcel carrier', () => {
    const payload = buildFreightTrackingPayload({ carrierName: 'UPS', proNumber: '1Z999AA10123456784' });
    expect(payload.isLTL).toBe(false);
    expect(payload.carrier).toBeNull();
    expect(payload.trackingUrl).toBeNull();
  });

  it('handles empty carrierName and proNumber gracefully', () => {
    const payload = buildFreightTrackingPayload({ carrierName: '', proNumber: '' });
    expect(payload.isLTL).toBe(false);
    expect(payload.proNumber).toBe('');
  });

  it('trims whitespace from proNumber', () => {
    const payload = buildFreightTrackingPayload({ carrierName: 'XPO', proNumber: '  123456  ' });
    expect(payload.proNumber).toBe('123456');
    expect(payload.trackingUrl).toBe('https://www.xpo.com/track/123456');
  });
});
