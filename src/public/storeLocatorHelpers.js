// storeLocatorHelpers.js — Testable helpers for the Store Locator page
// Showroom photos, features, hours table, directions cards, amenities, map config

// ── Showroom Photos ──────────────────────────────────────────────────

/**
 * Get showroom photo data for the gallery section.
 * @returns {Array<{id: string, alt: string, caption: string}>}
 */
export function getShowroomPhotos() {
  return [
    {
      id: 'photo-exterior',
      alt: 'Carolina Futons showroom exterior on Locust Street in downtown Hendersonville, NC',
      caption: 'Our Hendersonville showroom entrance on Locust Street',
    },
    {
      id: 'photo-interior-main',
      alt: 'Main showroom interior with futon displays arranged for browsing at Carolina Futons',
      caption: 'Spacious interior with every piece on display to try',
    },
    {
      id: 'photo-futon-display',
      alt: 'Futon frame and mattress display wall showing multiple styles and finishes',
      caption: 'Browse our curated selection of frames and mattresses',
    },
    {
      id: 'photo-murphy-beds',
      alt: 'Murphy cabinet bed demonstration area showing open and closed configurations',
      caption: 'Murphy Cabinet Beds — see the transformation in person',
    },
    {
      id: 'photo-consultation',
      alt: 'Customer receiving a personalized furniture consultation in the Carolina Futons showroom',
      caption: 'Free design consultations with our furniture experts',
    },
    {
      id: 'photo-delivery',
      alt: 'Carolina Futons white-glove delivery team setting up furniture in a customer home',
      caption: 'White-glove delivery and setup included with local orders',
    },
  ];
}

// ── Showroom Features ────────────────────────────────────────────────

/**
 * Get showroom feature highlights for the features grid.
 * @returns {Array<{icon: string, title: string, description: string}>}
 */
export function getShowroomFeaturesList() {
  return [
    {
      icon: 'sofa',
      title: 'Try Before You Buy',
      description: 'Every piece on our floor is ready to sit on, sleep on, and experience firsthand. No guessing — feel the comfort yourself.',
    },
    {
      icon: 'car',
      title: 'Free Parking',
      description: 'Complimentary lot parking right at the building with accessible spaces near the entrance.',
    },
    {
      icon: 'chat',
      title: 'Expert Guidance',
      description: 'Our team offers honest, no-pressure advice to help you find the perfect fit for your space and budget.',
    },
    {
      icon: 'truck',
      title: 'White-Glove Delivery',
      description: 'Local delivery with full setup included. We handle everything so you can enjoy your furniture from day one.',
    },
    {
      icon: 'dollar',
      title: 'Financing Available',
      description: 'Flexible financing options with affordable monthly payments. Ask us about current promotions.',
    },
    {
      icon: 'swatch',
      title: 'Free Swatches',
      description: 'Can\'t visit? We ship free fabric swatches nationwide so you can match colors and textures at home.',
    },
  ];
}

// ── Drive Time / Distance Formatting ─────────────────────────────────

/**
 * Format drive time in minutes to a human-readable string.
 * @param {number|null|undefined} minutes
 * @returns {string}
 */
export function formatDriveTime(minutes) {
  if (!minutes || typeof minutes !== 'number' || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

/**
 * Format distance in miles to a display string.
 * @param {number|null|undefined} miles
 * @returns {string}
 */
export function formatDistance(miles) {
  if (!miles || typeof miles !== 'number' || miles <= 0) return '';
  return `${miles} mi`;
}

// ── Open/Closed Status Badge ─────────────────────────────────────────

/**
 * Build the open/closed status badge data from isShowroomOpen result.
 * @param {Object|null} statusData - { isOpen, todayHours, nextOpenDay, nextOpenTime }
 * @returns {{ status: string, label: string, hours: string, nextOpen: string, cssClass: string }}
 */
export function buildOpenStatusBadge(statusData) {
  if (!statusData) {
    return { status: 'closed', label: 'Currently Closed', hours: '', nextOpen: '', cssClass: 'status-closed' };
  }

  const { isOpen, todayHours, nextOpenDay, nextOpenTime } = statusData;

  if (isOpen) {
    return {
      status: 'open',
      label: 'Open Now',
      hours: todayHours || '',
      nextOpen: '',
      cssClass: 'status-open',
    };
  }

  const nextOpen = nextOpenDay && nextOpenTime
    ? `Opens ${nextOpenDay} at ${nextOpenTime}`
    : '';

  return {
    status: 'closed',
    label: 'Currently Closed',
    hours: todayHours || '',
    nextOpen,
    cssClass: 'status-closed',
  };
}

// ── Hours Table Data ─────────────────────────────────────────────────

/**
 * Get hours table data for the weekly schedule display.
 * @returns {Array<{day: string, hours: string, isOpen: boolean}>}
 */
export function getHoursTableData() {
  const schedule = [
    { day: 'Sunday', open: null, close: null, closed: true },
    { day: 'Monday', open: null, close: null, closed: true },
    { day: 'Tuesday', open: null, close: null, closed: true },
    { day: 'Wednesday', open: '10:00', close: '17:00', closed: false },
    { day: 'Thursday', open: '10:00', close: '17:00', closed: false },
    { day: 'Friday', open: '10:00', close: '17:00', closed: false },
    { day: 'Saturday', open: '10:00', close: '17:00', closed: false },
  ];

  return schedule.map(s => ({
    day: s.day,
    hours: s.closed ? 'Closed' : `${formatTime12(s.open)} - ${formatTime12(s.close)}`,
    isOpen: !s.closed,
  }));
}

function formatTime12(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// ── Directions City Cards ────────────────────────────────────────────

/**
 * Transform nearby cities array into repeater-ready card data.
 * @param {Array|null|undefined} cities
 * @returns {Array<{_id: string, label: string, distance: string, time: string, directions: string, mapUrl: string}>}
 */
export function buildDirectionsCityCards(cities) {
  if (!Array.isArray(cities) || cities.length === 0) return [];

  return cities.map((c, i) => ({
    _id: `city-${(c.city || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${i}`,
    label: c.state ? `${c.city}, ${c.state}` : (c.city || ''),
    distance: formatDistance(c.distanceMiles),
    time: formatDriveTime(c.driveTimeMinutes),
    directions: c.directions || '',
    mapUrl: c.mapUrl || '',
  }));
}

// ── Showroom Amenities ───────────────────────────────────────────────

/**
 * Get showroom amenity data for display.
 * @returns {Array<{icon: string, label: string, detail: string}>}
 */
export function getShowroomAmenities() {
  return [
    {
      icon: 'parking',
      label: 'Free Parking',
      detail: 'Free lot parking available with accessible spaces near the entrance.',
    },
    {
      icon: 'accessible',
      label: 'Wheelchair Accessible',
      detail: 'Ground-floor showroom with wheelchair-accessible entrance and wide aisles.',
    },
    {
      icon: 'wifi',
      label: 'Family Friendly',
      detail: 'Comfortable browsing environment. Take your time — no pressure.',
    },
    {
      icon: 'card',
      label: 'All Payment Methods',
      detail: 'Cash, credit cards, debit cards, and financing options accepted.',
    },
  ];
}

// ── Map Config ───────────────────────────────────────────────────────

/**
 * Get Google Maps configuration for the map embed and link.
 * @returns {{ embedUrl: string, mapsUrl: string, latitude: number, longitude: number, ariaLabel: string }}
 */
export function getMapConfig() {
  return {
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3270.5!2d-82.4634!3d35.3187!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzXCsDE5JzA3LjMiTiA4MsKwMjcnNDAuMyJX!5e0!3m2!1sen!2sus!4v1',
    mapsUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
    latitude: 35.3187,
    longitude: -82.4612,
    ariaLabel: 'Map showing Carolina Futons showroom location at 824 Locust St, Hendersonville, NC',
  };
}

// ── Contact Info ─────────────────────────────────────────────────────

/**
 * Get showroom contact information for display.
 * @returns {{ phone: string, telLink: string, email: string, address: string, directionsUrl: string }}
 */
export function getShowroomContactInfo() {
  return {
    phone: '(828) 252-9449',
    telLink: 'tel:+18282529449',
    email: 'info@carolinafutons.com',
    address: '824 Locust St, Ste 200\nHendersonville, NC 28792',
    directionsUrl: 'https://maps.google.com/?q=824+Locust+St+Ste+200+Hendersonville+NC+28792',
  };
}
