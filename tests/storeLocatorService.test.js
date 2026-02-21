import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShowroomInfo,
  isShowroomOpen,
  getDirectionsFromCity,
  getNearbyCities,
  getDirectionsUrl,
  getBusinessHours,
  getStoreLocatorSchema,
} from '../src/backend/storeLocatorService.web.js';

describe('storeLocatorService', () => {
  // ── getShowroomInfo ──────────────────────────────────────────────
  describe('getShowroomInfo', () => {
    it('returns success with showroom data', () => {
      const result = getShowroomInfo();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('includes correct address', () => {
      const { data } = getShowroomInfo();
      expect(data.address.street).toBe('824 Locust St, Ste 200');
      expect(data.address.city).toBe('Hendersonville');
      expect(data.address.state).toBe('NC');
      expect(data.address.zip).toBe('28792');
    });

    it('includes geo coordinates', () => {
      const { data } = getShowroomInfo();
      expect(data.geo.latitude).toBe(35.3187);
      expect(data.geo.longitude).toBe(-82.4612);
    });

    it('includes phone number', () => {
      const { data } = getShowroomInfo();
      expect(data.phone).toBe('(828) 252-9449');
      expect(data.phoneRaw).toBe('+18282529449');
    });

    it('includes Google Maps URL', () => {
      const { data } = getShowroomInfo();
      expect(data.mapUrl).toContain('maps.google.com');
      expect(data.mapUrl).toContain('Hendersonville');
    });

    it('includes map embed URL', () => {
      const { data } = getShowroomInfo();
      expect(data.mapEmbedUrl).toContain('google.com/maps/embed');
    });

    it('includes parking info', () => {
      const { data } = getShowroomInfo();
      expect(data.parking.available).toBe(true);
      expect(data.parking.type).toContain('Free');
    });

    it('includes accessibility info', () => {
      const { data } = getShowroomInfo();
      expect(data.accessibility.wheelchairAccessible).toBe(true);
      expect(data.accessibility.details).toContain('wheelchair');
    });

    it('includes business hours array', () => {
      const { data } = getShowroomInfo();
      expect(data.hours).toHaveLength(7);
      expect(data.hours[0].day).toBe('Sunday');
    });

    it('includes nearby cities', () => {
      const { data } = getShowroomInfo();
      expect(data.nearbyCities).toBeDefined();
      expect(data.nearbyCities.length).toBeGreaterThan(0);
    });

    it('marks Sun-Tue as closed', () => {
      const { data } = getShowroomInfo();
      expect(data.hours[0].closed).toBe(true); // Sunday
      expect(data.hours[1].closed).toBe(true); // Monday
      expect(data.hours[2].closed).toBe(true); // Tuesday
    });

    it('marks Wed-Sat as open 10-5', () => {
      const { data } = getShowroomInfo();
      for (let i = 3; i <= 6; i++) {
        expect(data.hours[i].closed).toBe(false);
        expect(data.hours[i].open).toBe('10:00');
        expect(data.hours[i].close).toBe('17:00');
      }
    });
  });

  // ── isShowroomOpen ───────────────────────────────────────────────
  describe('isShowroomOpen', () => {
    it('returns success with open/closed status', () => {
      const result = isShowroomOpen();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.isOpen).toBe('boolean');
    });

    it('includes current day name', () => {
      const { data } = isShowroomOpen();
      const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      expect(validDays).toContain(data.currentDay);
    });

    it('includes today hours string', () => {
      const { data } = isShowroomOpen();
      expect(typeof data.todayHours).toBe('string');
      // Either "Closed" or a time range
      expect(data.todayHours === 'Closed' || data.todayHours.includes('AM') || data.todayHours.includes('PM')).toBe(true);
    });

    it('includes next open day info', () => {
      const { data } = isShowroomOpen();
      expect(data.nextOpenDay).toBeDefined();
      expect(data.nextOpenTime).toBeDefined();
    });

    it('next open day is always Wed-Sat', () => {
      const { data } = isShowroomOpen();
      const openDays = ['Wednesday', 'Thursday', 'Friday', 'Saturday'];
      expect(openDays).toContain(data.nextOpenDay);
    });
  });

  // ── getDirectionsFromCity ────────────────────────────────────────
  describe('getDirectionsFromCity', () => {
    it('returns directions for Asheville', () => {
      const result = getDirectionsFromCity('Asheville');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Asheville');
      expect(result.data.state).toBe('NC');
      expect(result.data.distanceMiles).toBe(22);
      expect(result.data.driveTimeMinutes).toBe(30);
    });

    it('returns directions for Greenville', () => {
      const result = getDirectionsFromCity('Greenville');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Greenville');
      expect(result.data.distanceMiles).toBe(60);
    });

    it('returns directions for Charlotte', () => {
      const result = getDirectionsFromCity('Charlotte');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Charlotte');
      expect(result.data.distanceMiles).toBe(105);
    });

    it('returns directions for Knoxville', () => {
      const result = getDirectionsFromCity('Knoxville');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Knoxville');
    });

    it('returns directions for Spartanburg', () => {
      const result = getDirectionsFromCity('Spartanburg');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Spartanburg');
    });

    it('is case-insensitive', () => {
      const result = getDirectionsFromCity('asheville');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Asheville');
    });

    it('trims whitespace', () => {
      const result = getDirectionsFromCity('  Charlotte  ');
      expect(result.success).toBe(true);
      expect(result.data.city).toBe('Charlotte');
    });

    it('fails for unknown city', () => {
      const result = getDirectionsFromCity('Miami');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Miami');
      expect(result.error).toContain('Available cities');
    });

    it('fails for empty string', () => {
      const result = getDirectionsFromCity('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('fails for null input', () => {
      const result = getDirectionsFromCity(null);
      expect(result.success).toBe(false);
    });

    it('fails for numeric input', () => {
      const result = getDirectionsFromCity(123);
      expect(result.success).toBe(false);
    });

    it('includes map URL for directions', () => {
      const result = getDirectionsFromCity('Asheville');
      expect(result.data.mapUrl).toContain('maps.google.com');
      expect(result.data.mapUrl).toContain('Asheville');
    });

    it('includes driving directions text', () => {
      const result = getDirectionsFromCity('Asheville');
      expect(result.data.directions).toContain('I-26');
    });
  });

  // ── getNearbyCities ──────────────────────────────────────────────
  describe('getNearbyCities', () => {
    it('returns all nearby cities', () => {
      const result = getNearbyCities();
      expect(result.success).toBe(true);
      expect(result.items.length).toBeGreaterThanOrEqual(5);
    });

    it('each city has required fields', () => {
      const { items } = getNearbyCities();
      items.forEach(city => {
        expect(city.city).toBeDefined();
        expect(city.state).toBeDefined();
        expect(city.distanceMiles).toBeGreaterThan(0);
        expect(city.driveTimeMinutes).toBeGreaterThan(0);
        expect(city.directions).toBeDefined();
        expect(city.mapUrl).toBeDefined();
      });
    });

    it('cities are sorted by distance (closest first)', () => {
      const { items } = getNearbyCities();
      // Asheville should be first (22mi)
      expect(items[0].city).toBe('Asheville');
    });

    it('includes cities from multiple states', () => {
      const { items } = getNearbyCities();
      const states = [...new Set(items.map(c => c.state))];
      expect(states.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── getDirectionsUrl ─────────────────────────────────────────────
  describe('getDirectionsUrl', () => {
    it('generates directions URL from custom address', () => {
      const result = getDirectionsUrl('123 Main St, Anytown, NC');
      expect(result.success).toBe(true);
      expect(result.data.directionsUrl).toContain('maps.google.com');
      expect(result.data.directionsUrl).toContain('saddr=');
      expect(result.data.directionsUrl).toContain('daddr=');
    });

    it('encodes origin address', () => {
      const result = getDirectionsUrl('123 Main St, Anytown, NC');
      expect(result.data.directionsUrl).toContain(encodeURIComponent('123 Main St, Anytown, NC'));
    });

    it('includes destination in URL', () => {
      const result = getDirectionsUrl('Anytown');
      expect(result.data.directionsUrl).toContain('Hendersonville');
    });

    it('trims whitespace from address', () => {
      const result = getDirectionsUrl('  123 Main St  ');
      expect(result.success).toBe(true);
      expect(result.data.directionsUrl).toContain(encodeURIComponent('123 Main St'));
    });

    it('fails for empty address', () => {
      const result = getDirectionsUrl('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('fails for null address', () => {
      const result = getDirectionsUrl(null);
      expect(result.success).toBe(false);
    });

    it('fails for non-string address', () => {
      const result = getDirectionsUrl(42);
      expect(result.success).toBe(false);
    });
  });

  // ── getBusinessHours ─────────────────────────────────────────────
  describe('getBusinessHours', () => {
    it('returns formatted hours', () => {
      const result = getBusinessHours();
      expect(result.success).toBe(true);
      expect(result.data.hours).toHaveLength(7);
    });

    it('shows Closed for Sun-Tue', () => {
      const { data } = getBusinessHours();
      expect(data.hours[0].hours).toBe('Closed');
      expect(data.hours[1].hours).toBe('Closed');
      expect(data.hours[2].hours).toBe('Closed');
    });

    it('shows formatted times for Wed-Sat', () => {
      const { data } = getBusinessHours();
      expect(data.hours[3].hours).toBe('10:00 AM - 5:00 PM');
      expect(data.hours[4].hours).toBe('10:00 AM - 5:00 PM');
      expect(data.hours[5].hours).toBe('10:00 AM - 5:00 PM');
      expect(data.hours[6].hours).toBe('10:00 AM - 5:00 PM');
    });

    it('includes human-readable summary', () => {
      const { data } = getBusinessHours();
      expect(data.summary).toContain('Wednesday');
      expect(data.summary).toContain('Saturday');
      expect(data.summary).toContain('10:00 AM');
      expect(data.summary).toContain('5:00 PM');
    });

    it('each day has closed flag', () => {
      const { data } = getBusinessHours();
      data.hours.forEach(h => {
        expect(typeof h.closed).toBe('boolean');
      });
    });
  });

  // ── getStoreLocatorSchema ────────────────────────────────────────
  describe('getStoreLocatorSchema', () => {
    let schema;

    beforeEach(() => {
      schema = JSON.parse(getStoreLocatorSchema());
    });

    it('returns valid JSON-LD', () => {
      expect(schema['@context']).toBe('https://schema.org');
    });

    it('uses FurnitureStore type', () => {
      expect(schema['@type']).toBe('FurnitureStore');
    });

    it('includes business name', () => {
      expect(schema.name).toBe('Carolina Futons');
    });

    it('includes URL', () => {
      expect(schema.url).toBe('https://www.carolinafutons.com');
    });

    it('includes postal address', () => {
      expect(schema.address['@type']).toBe('PostalAddress');
      expect(schema.address.streetAddress).toBe('824 Locust St, Ste 200');
      expect(schema.address.addressLocality).toBe('Hendersonville');
      expect(schema.address.addressRegion).toBe('NC');
      expect(schema.address.postalCode).toBe('28792');
    });

    it('includes geo coordinates', () => {
      expect(schema.geo['@type']).toBe('GeoCoordinates');
      expect(schema.geo.latitude).toBe(35.3187);
      expect(schema.geo.longitude).toBe(-82.4612);
    });

    it('includes opening hours specification', () => {
      expect(schema.openingHoursSpecification).toBeDefined();
      expect(schema.openingHoursSpecification.length).toBe(4); // Wed-Sat
      schema.openingHoursSpecification.forEach(spec => {
        expect(spec['@type']).toBe('OpeningHoursSpecification');
        expect(spec.opens).toBe('10:00');
        expect(spec.closes).toBe('17:00');
      });
    });

    it('opening hours are for correct days', () => {
      const days = schema.openingHoursSpecification.map(s => s.dayOfWeek);
      expect(days).toContain('Wednesday');
      expect(days).toContain('Thursday');
      expect(days).toContain('Friday');
      expect(days).toContain('Saturday');
      expect(days).not.toContain('Sunday');
      expect(days).not.toContain('Monday');
      expect(days).not.toContain('Tuesday');
    });

    it('includes hasMap link', () => {
      expect(schema.hasMap).toContain('maps.google.com');
    });

    it('includes telephone', () => {
      expect(schema.telephone).toBe('+18282529449');
    });

    it('includes founding date', () => {
      expect(schema.foundingDate).toBe('1991');
    });

    it('includes payment methods', () => {
      expect(schema.paymentAccepted).toContain('Cash');
      expect(schema.paymentAccepted).toContain('Credit Card');
    });

    it('includes amenity features', () => {
      expect(schema.amenityFeature).toBeDefined();
      const parking = schema.amenityFeature.find(a => a.name === 'Parking');
      expect(parking).toBeDefined();
      expect(parking.value).toBe(true);
    });

    it('includes wheelchair accessibility', () => {
      const wheelchair = schema.amenityFeature.find(a => a.name === 'Wheelchair Accessible');
      expect(wheelchair).toBeDefined();
      expect(wheelchair.value).toBe(true);
    });

    it('includes social media links', () => {
      expect(schema.sameAs).toBeDefined();
      expect(schema.sameAs.length).toBeGreaterThan(0);
    });

    it('includes ID reference', () => {
      expect(schema['@id']).toContain('/#business');
    });
  });
});
