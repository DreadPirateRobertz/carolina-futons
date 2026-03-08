import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShowroomPhotos,
  getShowroomFeaturesList,
  formatDriveTime,
  formatDistance,
  buildOpenStatusBadge,
  getHoursTableData,
  buildDirectionsCityCards,
  getShowroomAmenities,
  getMapConfig,
  getShowroomContactInfo,
} from '../../src/public/storeLocatorHelpers.js';

describe('storeLocatorHelpers', () => {
  // ── getShowroomPhotos ──────────────────────────────────────────────
  describe('getShowroomPhotos', () => {
    it('returns an array of photo objects', () => {
      const photos = getShowroomPhotos();
      expect(Array.isArray(photos)).toBe(true);
      expect(photos.length).toBeGreaterThanOrEqual(4);
    });

    it('each photo has required fields', () => {
      const photos = getShowroomPhotos();
      photos.forEach(photo => {
        expect(photo.id).toBeDefined();
        expect(typeof photo.alt).toBe('string');
        expect(photo.alt.length).toBeGreaterThan(0);
        expect(typeof photo.caption).toBe('string');
      });
    });

    it('each photo has a unique id', () => {
      const photos = getShowroomPhotos();
      const ids = photos.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('photos include showroom interior and exterior shots', () => {
      const photos = getShowroomPhotos();
      const captions = photos.map(p => p.caption.toLowerCase()).join(' ');
      expect(captions).toMatch(/showroom|interior|exterior|display|entrance/i);
    });
  });

  // ── getShowroomFeaturesList ────────────────────────────────────────
  describe('getShowroomFeaturesList', () => {
    it('returns an array of feature objects', () => {
      const features = getShowroomFeaturesList();
      expect(Array.isArray(features)).toBe(true);
      expect(features.length).toBeGreaterThanOrEqual(4);
    });

    it('each feature has icon, title, and description', () => {
      const features = getShowroomFeaturesList();
      features.forEach(f => {
        expect(typeof f.icon).toBe('string');
        expect(typeof f.title).toBe('string');
        expect(typeof f.description).toBe('string');
        expect(f.title.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThan(0);
      });
    });

    it('includes try-before-you-buy feature', () => {
      const features = getShowroomFeaturesList();
      const hasFeature = features.some(f =>
        f.title.toLowerCase().includes('try') || f.description.toLowerCase().includes('try before')
      );
      expect(hasFeature).toBe(true);
    });

    it('includes free parking feature', () => {
      const features = getShowroomFeaturesList();
      const hasParking = features.some(f =>
        f.title.toLowerCase().includes('parking') || f.description.toLowerCase().includes('parking')
      );
      expect(hasParking).toBe(true);
    });
  });

  // ── formatDriveTime ────────────────────────────────────────────────
  describe('formatDriveTime', () => {
    it('formats minutes under 60', () => {
      expect(formatDriveTime(30)).toBe('30 min');
    });

    it('formats exactly 60 minutes', () => {
      expect(formatDriveTime(60)).toBe('1 hr');
    });

    it('formats over 60 minutes with hours and minutes', () => {
      expect(formatDriveTime(90)).toBe('1 hr 30 min');
    });

    it('formats exactly 120 minutes', () => {
      expect(formatDriveTime(120)).toBe('2 hr');
    });

    it('returns empty string for zero', () => {
      expect(formatDriveTime(0)).toBe('');
    });

    it('returns empty string for negative', () => {
      expect(formatDriveTime(-10)).toBe('');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatDriveTime(null)).toBe('');
      expect(formatDriveTime(undefined)).toBe('');
    });

    it('handles non-integer minutes', () => {
      const result = formatDriveTime(75);
      expect(result).toBe('1 hr 15 min');
    });
  });

  // ── formatDistance ─────────────────────────────────────────────────
  describe('formatDistance', () => {
    it('formats distance in miles', () => {
      expect(formatDistance(22)).toBe('22 mi');
    });

    it('formats large distance', () => {
      expect(formatDistance(105)).toBe('105 mi');
    });

    it('returns empty string for zero', () => {
      expect(formatDistance(0)).toBe('');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatDistance(null)).toBe('');
      expect(formatDistance(undefined)).toBe('');
    });

    it('returns empty string for negative values', () => {
      expect(formatDistance(-5)).toBe('');
    });
  });

  // ── buildOpenStatusBadge ───────────────────────────────────────────
  describe('buildOpenStatusBadge', () => {
    it('returns open badge when isOpen is true', () => {
      const badge = buildOpenStatusBadge({ isOpen: true, todayHours: '10:00 AM - 5:00 PM' });
      expect(badge.status).toBe('open');
      expect(badge.label).toMatch(/open/i);
      expect(badge.hours).toBe('10:00 AM - 5:00 PM');
    });

    it('returns closed badge when isOpen is false with hours today', () => {
      const badge = buildOpenStatusBadge({ isOpen: false, todayHours: '10:00 AM - 5:00 PM', nextOpenDay: 'Wednesday', nextOpenTime: '10:00 AM' });
      expect(badge.status).toBe('closed');
      expect(badge.label).toMatch(/closed/i);
    });

    it('shows next open day when closed today', () => {
      const badge = buildOpenStatusBadge({ isOpen: false, todayHours: 'Closed', nextOpenDay: 'Wednesday', nextOpenTime: '10:00 AM' });
      expect(badge.nextOpen).toContain('Wednesday');
      expect(badge.nextOpen).toContain('10:00 AM');
    });

    it('handles missing data gracefully', () => {
      const badge = buildOpenStatusBadge({});
      expect(badge.status).toBe('closed');
      expect(badge.label).toBeDefined();
    });

    it('handles null input gracefully', () => {
      const badge = buildOpenStatusBadge(null);
      expect(badge.status).toBe('closed');
    });
  });

  // ── getHoursTableData ──────────────────────────────────────────────
  describe('getHoursTableData', () => {
    it('returns 7 rows for each day of week', () => {
      const rows = getHoursTableData();
      expect(rows).toHaveLength(7);
    });

    it('each row has day, hours, and isOpen properties', () => {
      const rows = getHoursTableData();
      rows.forEach(row => {
        expect(typeof row.day).toBe('string');
        expect(typeof row.hours).toBe('string');
        expect(typeof row.isOpen).toBe('boolean');
      });
    });

    it('marks Sun-Tue as closed', () => {
      const rows = getHoursTableData();
      expect(rows[0].isOpen).toBe(false); // Sunday
      expect(rows[0].hours).toBe('Closed');
      expect(rows[1].isOpen).toBe(false); // Monday
      expect(rows[2].isOpen).toBe(false); // Tuesday
    });

    it('marks Wed-Sat as open', () => {
      const rows = getHoursTableData();
      for (let i = 3; i <= 6; i++) {
        expect(rows[i].isOpen).toBe(true);
        expect(rows[i].hours).toContain('AM');
        expect(rows[i].hours).toContain('PM');
      }
    });

    it('starts with Sunday', () => {
      const rows = getHoursTableData();
      expect(rows[0].day).toBe('Sunday');
    });

    it('ends with Saturday', () => {
      const rows = getHoursTableData();
      expect(rows[6].day).toBe('Saturday');
    });
  });

  // ── buildDirectionsCityCards ───────────────────────────────────────
  describe('buildDirectionsCityCards', () => {
    const mockCities = [
      { city: 'Asheville', state: 'NC', distanceMiles: 22, driveTimeMinutes: 30, directions: 'Take I-26 East...', mapUrl: 'https://maps.google.com/...' },
      { city: 'Greenville', state: 'SC', distanceMiles: 60, driveTimeMinutes: 70, directions: 'Take I-26 West...', mapUrl: 'https://maps.google.com/...' },
    ];

    it('transforms cities into card data', () => {
      const cards = buildDirectionsCityCards(mockCities);
      expect(cards).toHaveLength(2);
    });

    it('each card has _id, label, distance, time, directions, mapUrl', () => {
      const cards = buildDirectionsCityCards(mockCities);
      cards.forEach(card => {
        expect(card._id).toBeDefined();
        expect(typeof card.label).toBe('string');
        expect(typeof card.distance).toBe('string');
        expect(typeof card.time).toBe('string');
        expect(typeof card.directions).toBe('string');
        expect(typeof card.mapUrl).toBe('string');
      });
    });

    it('formats city label as "City, ST"', () => {
      const cards = buildDirectionsCityCards(mockCities);
      expect(cards[0].label).toBe('Asheville, NC');
      expect(cards[1].label).toBe('Greenville, SC');
    });

    it('formats distance and time using helper functions', () => {
      const cards = buildDirectionsCityCards(mockCities);
      expect(cards[0].distance).toBe('22 mi');
      expect(cards[0].time).toBe('30 min');
    });

    it('returns empty array for null/undefined input', () => {
      expect(buildDirectionsCityCards(null)).toEqual([]);
      expect(buildDirectionsCityCards(undefined)).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      expect(buildDirectionsCityCards([])).toEqual([]);
    });

    it('handles cities with missing fields gracefully', () => {
      const cards = buildDirectionsCityCards([{ city: 'Test' }]);
      expect(cards).toHaveLength(1);
      expect(cards[0].label).toContain('Test');
    });
  });

  // ── getShowroomAmenities ───────────────────────────────────────────
  describe('getShowroomAmenities', () => {
    it('returns array of amenity objects', () => {
      const amenities = getShowroomAmenities();
      expect(Array.isArray(amenities)).toBe(true);
      expect(amenities.length).toBeGreaterThanOrEqual(3);
    });

    it('each amenity has icon, label, and detail', () => {
      const amenities = getShowroomAmenities();
      amenities.forEach(a => {
        expect(typeof a.icon).toBe('string');
        expect(typeof a.label).toBe('string');
        expect(typeof a.detail).toBe('string');
      });
    });

    it('includes parking info', () => {
      const amenities = getShowroomAmenities();
      const parking = amenities.find(a => a.label.toLowerCase().includes('parking'));
      expect(parking).toBeDefined();
    });

    it('includes wheelchair accessibility', () => {
      const amenities = getShowroomAmenities();
      const wheelchair = amenities.find(a =>
        a.label.toLowerCase().includes('accessible') || a.label.toLowerCase().includes('wheelchair')
      );
      expect(wheelchair).toBeDefined();
    });
  });

  // ── getMapConfig ───────────────────────────────────────────────────
  describe('getMapConfig', () => {
    it('returns map embed URL', () => {
      const config = getMapConfig();
      expect(config.embedUrl).toContain('google.com/maps/embed');
    });

    it('returns link to open in Google Maps', () => {
      const config = getMapConfig();
      expect(config.mapsUrl).toContain('maps.google.com');
    });

    it('returns geo coordinates', () => {
      const config = getMapConfig();
      expect(typeof config.latitude).toBe('number');
      expect(typeof config.longitude).toBe('number');
      expect(config.latitude).toBeCloseTo(35.3187, 2);
      expect(config.longitude).toBeCloseTo(-82.4612, 2);
    });

    it('returns aria label for the map', () => {
      const config = getMapConfig();
      expect(typeof config.ariaLabel).toBe('string');
      expect(config.ariaLabel.length).toBeGreaterThan(0);
    });
  });

  // ── getShowroomContactInfo ─────────────────────────────────────────
  describe('getShowroomContactInfo', () => {
    it('returns phone number', () => {
      const info = getShowroomContactInfo();
      expect(info.phone).toBe('(828) 252-9449');
    });

    it('returns tel link', () => {
      const info = getShowroomContactInfo();
      expect(info.telLink).toBe('tel:+18282529449');
    });

    it('returns email', () => {
      const info = getShowroomContactInfo();
      expect(info.email).toBe('info@carolinafutons.com');
    });

    it('returns formatted address', () => {
      const info = getShowroomContactInfo();
      expect(info.address).toContain('824 Locust St');
      expect(info.address).toContain('Hendersonville');
      expect(info.address).toContain('NC');
      expect(info.address).toContain('28792');
    });

    it('returns directions URL', () => {
      const info = getShowroomContactInfo();
      expect(info.directionsUrl).toContain('maps.google.com');
    });
  });
});
