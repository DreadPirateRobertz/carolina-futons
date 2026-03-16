import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/storeLocatorService.web.js');
});

// ── getShowroomInfo ────────────────────────────────────────────────

describe('getShowroomInfo', () => {
  it('returns success', () => {
    const r = mod.getShowroomInfo();
    expect(r.success).toBe(true);
  });

  it('includes showroom name', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.name).toBe('Carolina Futons');
  });

  it('includes address', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.address.city).toBe('Hendersonville');
    expect(r.data.address.state).toBe('NC');
    expect(r.data.address.zip).toBe('28792');
  });

  it('includes geo coordinates', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.geo.latitude).toBeCloseTo(35.3187, 2);
    expect(r.data.geo.longitude).toBeCloseTo(-82.4612, 2);
  });

  it('includes nearby cities', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.nearbyCities.length).toBeGreaterThan(0);
    const cities = r.data.nearbyCities.map(c => c.city);
    expect(cities).toContain('Asheville');
    expect(cities).toContain('Charlotte');
  });

  it('includes hours', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.hours).toHaveLength(7);
  });

  it('includes phone', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.phoneRaw).toBe('+18282529449');
  });

  it('includes parking info', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.parking.available).toBe(true);
  });

  it('includes accessibility info', () => {
    const r = mod.getShowroomInfo();
    expect(r.data.accessibility.wheelchairAccessible).toBe(true);
  });
});

// ── isShowroomOpen ─────────────────────────────────────────────────

describe('isShowroomOpen', () => {
  it('returns success with open status', () => {
    const r = mod.isShowroomOpen();
    expect(r.success).toBe(true);
    expect(typeof r.data.isOpen).toBe('boolean');
  });

  it('includes current day name', () => {
    const r = mod.isShowroomOpen();
    const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(validDays).toContain(r.data.currentDay);
  });

  it('includes today hours', () => {
    const r = mod.isShowroomOpen();
    expect(typeof r.data.todayHours).toBe('string');
  });

  it('includes next open day', () => {
    const r = mod.isShowroomOpen();
    expect(r.data.nextOpenDay).toBeTruthy();
    expect(r.data.nextOpenTime).toBeTruthy();
  });
});

// ── getDirectionsFromCity ──────────────────────────────────────────

describe('getDirectionsFromCity', () => {
  it('rejects null city', () => {
    const r = mod.getDirectionsFromCity(null);
    expect(r.success).toBe(false);
  });

  it('rejects empty string', () => {
    const r = mod.getDirectionsFromCity('');
    expect(r.success).toBe(false);
  });

  it('returns directions for Asheville', () => {
    const r = mod.getDirectionsFromCity('Asheville');
    expect(r.success).toBe(true);
    expect(r.data.city).toBe('Asheville');
    expect(r.data.distanceMiles).toBe(22);
    expect(r.data.driveTimeMinutes).toBe(30);
    expect(r.data.directions).toBeTruthy();
    expect(r.data.mapUrl).toBeTruthy();
  });

  it('is case-insensitive', () => {
    const r = mod.getDirectionsFromCity('asheville');
    expect(r.success).toBe(true);
    expect(r.data.city).toBe('Asheville');
  });

  it('trims whitespace', () => {
    const r = mod.getDirectionsFromCity('  Charlotte  ');
    expect(r.success).toBe(true);
    expect(r.data.city).toBe('Charlotte');
  });

  it('returns error for unknown city', () => {
    const r = mod.getDirectionsFromCity('New York');
    expect(r.success).toBe(false);
    expect(r.error).toContain('not available');
    expect(r.error).toContain('Available cities');
  });

  it('returns directions for all known cities', () => {
    for (const city of ['Asheville', 'Greenville', 'Charlotte', 'Knoxville', 'Spartanburg']) {
      const r = mod.getDirectionsFromCity(city);
      expect(r.success).toBe(true);
      expect(r.data.distanceMiles).toBeGreaterThan(0);
    }
  });
});

// ── getNearbyCities ────────────────────────────────────────────────

describe('getNearbyCities', () => {
  it('returns all nearby cities', () => {
    const r = mod.getNearbyCities();
    expect(r.success).toBe(true);
    expect(r.items.length).toBe(5);
  });

  it('each city has required fields', () => {
    const r = mod.getNearbyCities();
    for (const city of r.items) {
      expect(city.city).toBeTruthy();
      expect(city.state).toBeTruthy();
      expect(city.distanceMiles).toBeGreaterThan(0);
      expect(city.driveTimeMinutes).toBeGreaterThan(0);
      expect(city.directions).toBeTruthy();
      expect(city.mapUrl).toBeTruthy();
    }
  });
});

// ── getDirectionsUrl ───────────────────────────────────────────────

describe('getDirectionsUrl', () => {
  it('rejects null origin', () => {
    const r = mod.getDirectionsUrl(null);
    expect(r.success).toBe(false);
  });

  it('rejects empty string', () => {
    const r = mod.getDirectionsUrl('');
    expect(r.success).toBe(false);
  });

  it('generates directions URL', () => {
    const r = mod.getDirectionsUrl('123 Main St, Asheville, NC');
    expect(r.success).toBe(true);
    expect(r.data.directionsUrl).toContain('maps.google.com');
    expect(r.data.directionsUrl).toContain('Hendersonville');
  });

  it('encodes special characters in origin', () => {
    const r = mod.getDirectionsUrl('123 Main St & Elm Ave');
    expect(r.success).toBe(true);
    expect(r.data.directionsUrl).toContain(encodeURIComponent('123 Main St & Elm Ave'));
  });
});

// ── getBusinessHours ───────────────────────────────────────────────

describe('getBusinessHours', () => {
  it('returns 7 days', () => {
    const r = mod.getBusinessHours();
    expect(r.success).toBe(true);
    expect(r.data.hours).toHaveLength(7);
  });

  it('Sunday is closed', () => {
    const r = mod.getBusinessHours();
    const sunday = r.data.hours.find(h => h.day === 'Sunday');
    expect(sunday.closed).toBe(true);
    expect(sunday.hours).toBe('Closed');
  });

  it('Wednesday is open', () => {
    const r = mod.getBusinessHours();
    const wed = r.data.hours.find(h => h.day === 'Wednesday');
    expect(wed.closed).toBe(false);
    expect(wed.hours).toContain('10:00 AM');
    expect(wed.hours).toContain('5:00 PM');
  });

  it('includes summary', () => {
    const r = mod.getBusinessHours();
    expect(r.data.summary).toContain('Wednesday');
    expect(r.data.summary).toContain('Saturday');
  });
});

// ── getStoreLocatorSchema ──────────────────────────────────────────

describe('getStoreLocatorSchema', () => {
  it('returns valid JSON string', () => {
    const result = mod.getStoreLocatorSchema();
    const schema = JSON.parse(result);
    expect(schema).toBeTruthy();
  });

  it('includes FurnitureStore type', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema['@type']).toBe('FurnitureStore');
  });

  it('includes schema.org context', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema['@context']).toBe('https://schema.org');
  });

  it('includes address', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.address['@type']).toBe('PostalAddress');
    expect(schema.address.addressLocality).toBe('Hendersonville');
  });

  it('includes geo coordinates', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.geo['@type']).toBe('GeoCoordinates');
    expect(schema.geo.latitude).toBeCloseTo(35.3187, 2);
  });

  it('includes opening hours for open days only', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.openingHoursSpecification.length).toBe(4); // Wed-Sat
    expect(schema.openingHoursSpecification[0].dayOfWeek).toBe('Wednesday');
  });

  it('includes amenity features', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.amenityFeature).toHaveLength(2);
    const names = schema.amenityFeature.map(a => a.name);
    expect(names).toContain('Parking');
    expect(names).toContain('Wheelchair Accessible');
  });

  it('includes payment info', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.paymentAccepted).toContain('Credit Card');
    expect(schema.currenciesAccepted).toBe('USD');
  });

  it('includes social media links', () => {
    const schema = JSON.parse(mod.getStoreLocatorSchema());
    expect(schema.sameAs.length).toBeGreaterThan(0);
  });
});
