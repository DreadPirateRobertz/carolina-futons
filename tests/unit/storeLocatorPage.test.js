import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tests for Store Locator page data sources and wiring.
// Page files are $w-coupled; we test the helpers they consume + backend integration.

import {
  getShowroomPhotos,
  getShowroomFeaturesList,
  buildOpenStatusBadge,
  getHoursTableData,
  buildDirectionsCityCards,
  getShowroomAmenities,
  getMapConfig,
  getShowroomContactInfo,
  formatDriveTime,
  formatDistance,
} from '../../src/public/storeLocatorHelpers.js';

import {
  getShowroomInfo,
  getNearbyCities,
  getBusinessHours,
  getStoreLocatorSchema,
} from '../../src/backend/storeLocatorService.web.js';

// ── Store Locator Page — Map Section ───────────────────────────────────

describe('Store Locator page — map section wiring', () => {
  it('map config provides valid embed URL for iframe/HtmlComponent', () => {
    const config = getMapConfig();
    expect(config.embedUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/embed/);
  });

  it('map config provides a clickable link to open full Google Maps', () => {
    const config = getMapConfig();
    expect(config.mapsUrl).toMatch(/^https:\/\/maps\.google\.com/);
  });

  it('map config provides aria label for screen readers', () => {
    const config = getMapConfig();
    expect(config.ariaLabel).toContain('Carolina Futons');
  });
});

// ── Store Locator Page — Hours Section ─────────────────────────────────

describe('Store Locator page — hours section wiring', () => {
  it('hours table data maps to repeater items with _id', () => {
    const rows = getHoursTableData();
    const repeaterData = rows.map((r, i) => ({ ...r, _id: `hours-${i}` }));
    expect(repeaterData).toHaveLength(7);
    repeaterData.forEach(item => {
      expect(item._id).toMatch(/^hours-/);
      expect(item.day).toBeTruthy();
      expect(item.hours).toBeTruthy();
    });
  });

  it('backend getBusinessHours aligns with frontend hours table data', () => {
    const backendResult = getBusinessHours();
    const frontendRows = getHoursTableData();
    expect(backendResult.data.hours).toHaveLength(frontendRows.length);
    // Both should mark same days as open/closed
    for (let i = 0; i < 7; i++) {
      expect(frontendRows[i].isOpen).toBe(!backendResult.data.hours[i].closed);
    }
  });
});

// ── Store Locator Page — Open/Closed Status Badge ──────────────────────

describe('Store Locator page — status badge wiring', () => {
  it('badge returns well-formed data for open state', () => {
    const badge = buildOpenStatusBadge({ isOpen: true, todayHours: '10:00 AM - 5:00 PM' });
    expect(badge.status).toBe('open');
    expect(badge.label).toBeTruthy();
    expect(badge.hours).toBeTruthy();
  });

  it('badge returns well-formed data for closed state with next open', () => {
    const badge = buildOpenStatusBadge({
      isOpen: false,
      todayHours: 'Closed',
      nextOpenDay: 'Wednesday',
      nextOpenTime: '10:00 AM',
    });
    expect(badge.status).toBe('closed');
    expect(badge.nextOpen).toContain('Wednesday');
  });

  it('badge CSS class names are valid for styling', () => {
    const openBadge = buildOpenStatusBadge({ isOpen: true, todayHours: '10:00 AM - 5:00 PM' });
    const closedBadge = buildOpenStatusBadge({ isOpen: false, todayHours: 'Closed', nextOpenDay: 'Thursday', nextOpenTime: '10:00 AM' });
    expect(openBadge.cssClass).toMatch(/open/);
    expect(closedBadge.cssClass).toMatch(/closed/);
  });
});

// ── Store Locator Page — Directions Section ────────────────────────────

describe('Store Locator page — directions section wiring', () => {
  it('builds repeater data from backend nearby cities', () => {
    const { items } = getNearbyCities();
    const cards = buildDirectionsCityCards(items);
    expect(cards.length).toBe(items.length);
    cards.forEach(card => {
      expect(card._id).toBeTruthy();
      expect(card.label).toBeTruthy();
      expect(card.distance).toBeTruthy();
      expect(card.mapUrl).toBeTruthy();
    });
  });

  it('city cards are sorted closest first (matching backend order)', () => {
    const { items } = getNearbyCities();
    const cards = buildDirectionsCityCards(items);
    expect(cards[0].label).toContain('Asheville');
  });
});

// ── Store Locator Page — Photos Gallery ────────────────────────────────

describe('Store Locator page — photo gallery wiring', () => {
  it('photos map to gallery repeater items with _id', () => {
    const photos = getShowroomPhotos();
    const repeaterData = photos.map(p => ({ ...p, _id: p.id }));
    repeaterData.forEach(item => {
      expect(item._id).toBeTruthy();
      expect(item.alt).toBeTruthy();
    });
  });

  it('all photo alt texts are descriptive (not generic)', () => {
    const photos = getShowroomPhotos();
    photos.forEach(photo => {
      expect(photo.alt.length).toBeGreaterThan(15);
      expect(photo.alt).not.toMatch(/^image|^photo|^picture/i);
    });
  });
});

// ── Store Locator Page — Features Section ──────────────────────────────

describe('Store Locator page — features section wiring', () => {
  it('features map to repeater items with _id', () => {
    const features = getShowroomFeaturesList();
    const repeaterData = features.map((f, i) => ({ ...f, _id: `feature-${i}` }));
    repeaterData.forEach(item => {
      expect(item._id).toMatch(/^feature-/);
      expect(item.title).toBeTruthy();
      expect(item.description).toBeTruthy();
    });
  });
});

// ── Store Locator Page — Amenities Section ─────────────────────────────

describe('Store Locator page — amenities section wiring', () => {
  it('amenities map to repeater items with _id', () => {
    const amenities = getShowroomAmenities();
    const repeaterData = amenities.map((a, i) => ({ ...a, _id: `amenity-${i}` }));
    expect(repeaterData.length).toBeGreaterThanOrEqual(3);
    repeaterData.forEach(item => {
      expect(item._id).toMatch(/^amenity-/);
      expect(item.label).toBeTruthy();
    });
  });
});

// ── Store Locator Page — Contact Info ──────────────────────────────────

describe('Store Locator page — contact info wiring', () => {
  it('contact info provides all fields needed for display', () => {
    const info = getShowroomContactInfo();
    expect(info.phone).toBeTruthy();
    expect(info.telLink).toMatch(/^tel:/);
    expect(info.email).toMatch(/@/);
    expect(info.address).toContain('Hendersonville');
    expect(info.directionsUrl).toContain('maps');
  });
});

// ── Store Locator Page — Schema Integration ────────────────────────────

describe('Store Locator page — schema integration', () => {
  it('backend schema is valid JSON-LD that page can inject', () => {
    const schemaStr = getStoreLocatorSchema();
    const schema = JSON.parse(schemaStr);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FurnitureStore');
    expect(schema.name).toBe('Carolina Futons');
  });
});
