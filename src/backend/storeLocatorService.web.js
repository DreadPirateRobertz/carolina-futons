// Backend web module for Store Locator
// Provides showroom info, hours, directions, and LocalBusiness schema
// Setup: Import functions from 'backend/storeLocatorService.web' in page code
import { Permissions, webMethod } from 'wix-web-module';

// ── Showroom Data ──────────────────────────────────────────────────
const SHOWROOM = {
  name: 'Carolina Futons',
  address: {
    street: '824 Locust St, Ste 200',
    city: 'Hendersonville',
    state: 'NC',
    zip: '28792',
    country: 'US',
    formatted: '824 Locust St, Ste 200, Hendersonville, NC 28792',
  },
  geo: {
    latitude: 35.3187,
    longitude: -82.4612,
  },
  phone: '(828) 252-9449',
  phoneRaw: '+18282529449',
  email: 'info@carolinafutons.com',
  url: 'https://www.carolinafutons.com',
  mapUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3270.5!2d-82.4634!3d35.3187!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzXCsDE5JzA3LjMiTiA4MsKwMjcnNDAuMyJX!5e0!3m2!1sen!2sus!4v1',
  foundingDate: '1991',
  description: 'The largest selection of quality futon furniture in the Carolinas. Family-owned in Hendersonville, NC since 1991.',
  parking: {
    available: true,
    type: 'Free lot parking',
    details: 'Free parking available in the building lot. Accessible parking spaces near the entrance.',
  },
  accessibility: {
    wheelchairAccessible: true,
    details: 'Ground-floor showroom with wheelchair-accessible entrance. Wide aisles between displays.',
  },
  hours: [
    { day: 'Sunday', open: null, close: null, closed: true },
    { day: 'Monday', open: null, close: null, closed: true },
    { day: 'Tuesday', open: null, close: null, closed: true },
    { day: 'Wednesday', open: '10:00', close: '17:00', closed: false },
    { day: 'Thursday', open: '10:00', close: '17:00', closed: false },
    { day: 'Friday', open: '10:00', close: '17:00', closed: false },
    { day: 'Saturday', open: '10:00', close: '17:00', closed: false },
  ],
};

// Driving directions from major nearby cities
const NEARBY_CITIES = [
  {
    city: 'Asheville',
    state: 'NC',
    distanceMiles: 22,
    driveTimeMinutes: 30,
    directions: 'Take I-26 East to Exit 49A, then US-64 West to downtown Hendersonville. Turn right on Locust St.',
    mapUrl: 'https://maps.google.com/maps?saddr=Asheville,+NC&daddr=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  },
  {
    city: 'Greenville',
    state: 'SC',
    distanceMiles: 60,
    driveTimeMinutes: 70,
    directions: 'Take I-26 West to Exit 49A, then US-64 West to downtown Hendersonville. Turn right on Locust St.',
    mapUrl: 'https://maps.google.com/maps?saddr=Greenville,+SC&daddr=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  },
  {
    city: 'Charlotte',
    state: 'NC',
    distanceMiles: 105,
    driveTimeMinutes: 120,
    directions: 'Take I-85 South to I-26 West. Exit 49A to US-64 West into Hendersonville. Turn right on Locust St.',
    mapUrl: 'https://maps.google.com/maps?saddr=Charlotte,+NC&daddr=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  },
  {
    city: 'Knoxville',
    state: 'TN',
    distanceMiles: 115,
    driveTimeMinutes: 130,
    directions: 'Take I-40 East to I-26 East. Exit 49A to US-64 West into Hendersonville. Turn right on Locust St.',
    mapUrl: 'https://maps.google.com/maps?saddr=Knoxville,+TN&daddr=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  },
  {
    city: 'Spartanburg',
    state: 'SC',
    distanceMiles: 50,
    driveTimeMinutes: 60,
    directions: 'Take I-26 West to Exit 49A, then US-64 West to downtown Hendersonville. Turn right on Locust St.',
    mapUrl: 'https://maps.google.com/maps?saddr=Spartanburg,+SC&daddr=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  },
];

// ── Public API ─────────────────────────────────────────────────────

/**
 * Get complete showroom information.
 * @returns {{ success: boolean, data: Object }}
 */
export const getShowroomInfo = webMethod(
  Permissions.Anyone,
  () => {
    return {
      success: true,
      data: {
        ...SHOWROOM,
        nearbyCities: NEARBY_CITIES,
      },
    };
  }
);

/**
 * Check if the showroom is currently open.
 * Uses Eastern Time (America/New_York).
 * @returns {{ success: boolean, data: { isOpen: boolean, currentDay: string, todayHours: string, nextOpenDay: string, nextOpenTime: string } }}
 */
export const isShowroomOpen = webMethod(
  Permissions.Anyone,
  () => {
    const now = getEasternTime();
    const dayIndex = now.getDay(); // 0=Sun
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinutes = hours * 60 + minutes;

    const todaySchedule = SHOWROOM.hours[dayIndex];
    const dayName = todaySchedule.day;

    let isOpen = false;
    let todayHours = 'Closed';

    if (!todaySchedule.closed) {
      const [openH, openM] = todaySchedule.open.split(':').map(Number);
      const [closeH, closeM] = todaySchedule.close.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      todayHours = `${formatTime(todaySchedule.open)} - ${formatTime(todaySchedule.close)}`;
    }

    // Find next open day
    let nextOpen = findNextOpenDay(dayIndex, todaySchedule.closed ? 0 : (isOpen ? 1 : 0));

    return {
      success: true,
      data: {
        isOpen,
        currentDay: dayName,
        todayHours,
        nextOpenDay: nextOpen.day,
        nextOpenTime: nextOpen.time,
      },
    };
  }
);

/**
 * Get driving directions from a specific nearby city.
 * @param {string} cityName - City name (case-insensitive)
 * @returns {{ success: boolean, data: Object|null, error: string|undefined }}
 */
export const getDirectionsFromCity = webMethod(
  Permissions.Anyone,
  (cityName) => {
    if (!cityName || typeof cityName !== 'string') {
      return { success: false, error: 'City name is required' };
    }

    const normalized = cityName.trim().toLowerCase();
    const city = NEARBY_CITIES.find(c => c.city.toLowerCase() === normalized);

    if (!city) {
      return {
        success: false,
        error: `Directions not available from "${cityName}". Available cities: ${NEARBY_CITIES.map(c => c.city).join(', ')}`,
      };
    }

    return { success: true, data: city };
  }
);

/**
 * Get all nearby cities with driving directions.
 * @returns {{ success: boolean, items: Object[] }}
 */
export const getNearbyCities = webMethod(
  Permissions.Anyone,
  () => {
    return {
      success: true,
      items: NEARBY_CITIES,
    };
  }
);

/**
 * Get the Google Maps URL for directions from a custom origin address.
 * @param {string} originAddress - Customer's address or location
 * @returns {{ success: boolean, data: { directionsUrl: string } }}
 */
export const getDirectionsUrl = webMethod(
  Permissions.Anyone,
  (originAddress) => {
    if (!originAddress || typeof originAddress !== 'string') {
      return { success: false, error: 'Origin address is required' };
    }

    const origin = encodeURIComponent(originAddress.trim());
    const dest = encodeURIComponent(SHOWROOM.address.formatted);
    const directionsUrl = `https://maps.google.com/maps?saddr=${origin}&daddr=${dest}`;

    return { success: true, data: { directionsUrl } };
  }
);

/**
 * Get formatted business hours for display.
 * @returns {{ success: boolean, data: { hours: Object[], summary: string } }}
 */
export const getBusinessHours = webMethod(
  Permissions.Anyone,
  () => {
    const formatted = SHOWROOM.hours.map(h => ({
      day: h.day,
      hours: h.closed ? 'Closed' : `${formatTime(h.open)} - ${formatTime(h.close)}`,
      closed: h.closed,
    }));

    return {
      success: true,
      data: {
        hours: formatted,
        summary: 'Wednesday - Saturday, 10:00 AM - 5:00 PM',
      },
    };
  }
);

/**
 * Get LocalBusiness JSON-LD schema for store locator page.
 * Enhanced version with geo, hours specification, parking, and accessibility.
 * @returns {string} JSON-LD schema string
 */
export const getStoreLocatorSchema = webMethod(
  Permissions.Anyone,
  () => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FurnitureStore',
      '@id': `${SHOWROOM.url}/#business`,
      name: SHOWROOM.name,
      url: SHOWROOM.url,
      description: SHOWROOM.description,
      telephone: SHOWROOM.phoneRaw,
      address: {
        '@type': 'PostalAddress',
        streetAddress: SHOWROOM.address.street,
        addressLocality: SHOWROOM.address.city,
        addressRegion: SHOWROOM.address.state,
        postalCode: SHOWROOM.address.zip,
        addressCountry: SHOWROOM.address.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: SHOWROOM.geo.latitude,
        longitude: SHOWROOM.geo.longitude,
      },
      openingHoursSpecification: SHOWROOM.hours
        .filter(h => !h.closed)
        .map(h => ({
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: h.day,
          opens: h.open,
          closes: h.close,
        })),
      hasMap: SHOWROOM.mapUrl,
      foundingDate: SHOWROOM.foundingDate,
      priceRange: '$$',
      paymentAccepted: ['Cash', 'Credit Card', 'Debit Card'],
      currenciesAccepted: 'USD',
      amenityFeature: [
        {
          '@type': 'LocationFeatureSpecification',
          name: 'Parking',
          value: true,
        },
        {
          '@type': 'LocationFeatureSpecification',
          name: 'Wheelchair Accessible',
          value: true,
        },
      ],
      sameAs: [
        'https://www.facebook.com/carolinafutons',
        'https://www.instagram.com/carolinafutons',
      ],
    };

    return JSON.stringify(schema);
  }
);

// ── Helpers ────────────────────────────────────────────────────────

function getEasternTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  // Eastern = UTC-5 (EST) or UTC-4 (EDT)
  // Simple DST check: second Sunday of March to first Sunday of November
  const year = now.getUTCFullYear();
  const marchSecondSun = getNthSunday(year, 2, 2); // March, 2nd Sunday
  const novFirstSun = getNthSunday(year, 10, 1);   // November, 1st Sunday
  const isDST = utc >= marchSecondSun.getTime() && utc < novFirstSun.getTime();
  const offset = isDST ? -4 : -5;
  return new Date(utc + offset * 3600000);
}

function getNthSunday(year, month, n) {
  const d = new Date(Date.UTC(year, month, 1, 2)); // 2AM local
  let count = 0;
  while (count < n) {
    if (d.getUTCDay() === 0) count++;
    if (count < n) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function formatTime(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function findNextOpenDay(currentDayIndex, startOffset) {
  for (let i = startOffset; i < 7; i++) {
    const idx = (currentDayIndex + i) % 7;
    const schedule = SHOWROOM.hours[idx];
    if (!schedule.closed) {
      return {
        day: schedule.day,
        time: formatTime(schedule.open),
      };
    }
  }
  // Shouldn't happen — at least some days are open
  return { day: 'Wednesday', time: '10:00 AM' };
}
