/**
 * shippingZones.test.js — Unit tests for backend/utils/shippingZones.js.
 *
 * Covers:
 *  - matchLocalZone: exact zip match (zone1)
 *  - matchLocalZone: zip3 + state match (zones 2–4)
 *  - matchLocalZone: state mismatch → null (guards against FL/AL bleed)
 *  - matchLocalZone: unknown zip → null
 *  - matchLocalZone: mountain terrain ZIPs land in zone1
 *  - getTerrainSurcharge: terrain zip → $75
 *  - getTerrainSurcharge: non-terrain zip → $0
 *  - getTerrainSurcharge: null/undefined input → $0
 *
 * The matchLocalZone tests indirectly verify the guessStateFromZip ZIP3
 * ranges (270–289 NC, 290–299 SC, 300–319 GA, 370–385 TN, 220–246 VA)
 * are correct and not duplicated — regression for the dead-code removal
 * (duplicate `if z >= 270 && z <= 289 return 'NC'`) made in CF-q8s2.
 */

import { describe, it, expect } from 'vitest';
import { matchLocalZone, getTerrainSurcharge } from '../src/backend/utils/shippingZones.js';

// ── matchLocalZone — exact zip (zone1) ───────────────────────────────────────

describe('matchLocalZone — exact zip match', () => {
  it('matches zone1 for Hendersonville core zip 28792', () => {
    const zone = matchLocalZone('28792', 'NC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone1');
  });

  it('matches zone1 for Flat Rock zip 28739', () => {
    const zone = matchLocalZone('28739', 'NC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone1');
  });

  it('matches zone1 for Brevard zip 28712', () => {
    const zone = matchLocalZone('28712', 'NC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone1');
  });
});

// ── matchLocalZone — zip3 + state match ─────────────────────────────────────

describe('matchLocalZone — zip3 + state match', () => {
  // NC zip3 range 287–289 → zone2 (WNC Extended)
  it('matches zone2 for Asheville NC (28801, zip3=288, state NC)', () => {
    const zone = matchLocalZone('28801', 'NC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone2');
  });

  // SC zip3 range 293 → zone2 (Greenville/Spartanburg)
  it('matches zone2 for Greenville SC (29301, zip3=293, state SC)', () => {
    const zone = matchLocalZone('29301', 'SC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone2');
  });

  // NC zip3 range 270–286 → zone3 (Charlotte, Raleigh, etc.)
  it('matches zone3 for Charlotte NC (28201, zip3=282, state NC)', () => {
    const zone = matchLocalZone('28201', 'NC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone3');
  });

  // SC zip3 range 290 → zone3 (Columbia)
  it('matches zone3 for Columbia SC (29201, zip3=292, state SC)', () => {
    const zone = matchLocalZone('29201', 'SC');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone3');
  });

  // GA zip3 range 300–310 → zone3 (Atlanta metro)
  it('matches zone3 for Atlanta GA (30301, zip3=303, state GA)', () => {
    const zone = matchLocalZone('30301', 'GA');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone3');
  });

  // TN zip3 range 376–379 → zone3 (Knoxville)
  it('matches zone3 for Knoxville TN (37901, zip3=379, state TN)', () => {
    const zone = matchLocalZone('37901', 'TN');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone3');
  });

  // GA zip3 range 311–319 → zone4 (Savannah, South Georgia)
  it('matches zone4 for Savannah GA (31401, zip3=314, state GA)', () => {
    const zone = matchLocalZone('31401', 'GA');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone4');
  });

  // TN zip3 range 370–375 → zone4 (Nashville)
  it('matches zone4 for Nashville TN (37201, zip3=372, state TN)', () => {
    const zone = matchLocalZone('37201', 'TN');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone4');
  });

  // VA zip3 range 220–246 → zone4
  it('matches zone4 for Arlington VA (22201, zip3=222, state VA)', () => {
    const zone = matchLocalZone('22201', 'VA');
    expect(zone).not.toBeNull();
    expect(zone.code).toBe('zone4');
  });
});

// ── matchLocalZone — state mismatch / out of zone ────────────────────────────

describe('matchLocalZone — no match', () => {
  it('returns null for FL zip (excluded from SE delivery zone)', () => {
    expect(matchLocalZone('33101', 'FL')).toBeNull();
  });

  it('returns null for NY zip (out of range)', () => {
    expect(matchLocalZone('10001', 'NY')).toBeNull();
  });

  it('returns null when zip3 matches but state does not (prevents prefix bleed)', () => {
    // zip3=288 is in zone2.zip3Prefixes, but AL is not in zone2.states
    expect(matchLocalZone('28801', 'AL')).toBeNull();
  });

  it('returns null for empty postalCode', () => {
    expect(matchLocalZone('', 'NC')).toBeNull();
  });

  it('returns null for null postalCode', () => {
    expect(matchLocalZone(null, 'NC')).toBeNull();
  });
});

// ── getTerrainSurcharge ───────────────────────────────────────────────────────

describe('getTerrainSurcharge', () => {
  it('returns $75 for Highlands NC (28741) — steep Blue Ridge access', () => {
    expect(getTerrainSurcharge('28741')).toBe(75);
  });

  it('returns $75 for Cashiers NC (28717) — winding Hwy 107/64', () => {
    expect(getTerrainSurcharge('28717')).toBe(75);
  });

  it('returns $75 for Chimney Rock NC (28718)', () => {
    expect(getTerrainSurcharge('28718')).toBe(75);
  });

  it('returns $0 for Hendersonville core zip (not a terrain surcharge zip)', () => {
    expect(getTerrainSurcharge('28792')).toBe(0);
  });

  it('returns $0 for Asheville (28801)', () => {
    expect(getTerrainSurcharge('28801')).toBe(0);
  });

  it('returns $0 for null input', () => {
    expect(getTerrainSurcharge(null)).toBe(0);
  });

  it('returns $0 for undefined input', () => {
    expect(getTerrainSurcharge(undefined)).toBe(0);
  });

  it('returns $0 for empty string', () => {
    expect(getTerrainSurcharge('')).toBe(0);
  });
});
