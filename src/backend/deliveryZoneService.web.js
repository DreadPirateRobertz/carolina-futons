// deliveryZoneService.web.js — Delivery zone resolution for /getting-it-home.
// Zip → distance (Haversine) → zone tier + rate.
// cf-3qt.4.4: exposes getDeliveryZone for both Velo pages and HTTP endpoint.
import { Permissions, webMethod } from 'wix-web-module';

// Store location: 824 Locust St Ste 200, Hendersonville, NC 28792
const STORE = { lat: 35.3187, lon: -82.4612 };

// Zone tier definitions (distance in miles from store)
const ZONES = [
  { zone: 'local',    label: 'Local',    minMi: 0,  maxMi: 10,  rate: 25, eta: '1-2 business days' },
  { zone: 'regional', label: 'Regional', minMi: 11, maxMi: 30,  rate: 45, eta: '1-2 business days' },
  { zone: 'extended', label: 'Extended', minMi: 31, maxMi: 60,  rate: 65, eta: '2-3 business days' },
];

// Static lookup: western NC zip codes with approximate centroids.
// Covers the realistic delivery service area. Unknown zips use outofrange.
const ZIP_COORDS = {
  '28792': { lat: 35.3187, lon: -82.4612 }, // Hendersonville (store)
  '28791': { lat: 35.3280, lon: -82.4712 }, // Hendersonville N
  '28790': { lat: 35.2600, lon: -82.4850 }, // Tuxedo
  '28731': { lat: 35.2945, lon: -82.4305 }, // East Flat Rock
  '28739': { lat: 35.4290, lon: -82.4966 }, // Fletcher
  '28726': { lat: 35.2677, lon: -82.5500 }, // Columbus
  '28748': { lat: 35.5050, lon: -82.8180 }, // Leicester
  '28715': { lat: 35.5229, lon: -82.6776 }, // Candler
  '28756': { lat: 35.3530, lon: -82.2050 }, // Mill Spring
  '28772': { lat: 35.2270, lon: -82.2970 }, // Saluda
  '28787': { lat: 35.5020, lon: -82.4270 }, // Weaverville
  '28801': { lat: 35.5951, lon: -82.5515 }, // Asheville downtown
  '28803': { lat: 35.5421, lon: -82.5321 }, // Asheville S
  '28804': { lat: 35.6309, lon: -82.5549 }, // Asheville N
  '28805': { lat: 35.5782, lon: -82.4693 }, // Asheville E
  '28806': { lat: 35.5657, lon: -82.6085 }, // Asheville W
  '28711': { lat: 35.4530, lon: -82.3270 }, // Black Mountain
  '28730': { lat: 35.4400, lon: -82.3380 }, // Fairview
  '28734': { lat: 35.1450, lon: -83.3850 }, // Franklin
  '28779': { lat: 35.3080, lon: -83.1900 }, // Sylva
  '28786': { lat: 35.4580, lon: -82.9930 }, // Waynesville
  '28202': { lat: 35.2271, lon: -80.8431 }, // Charlotte downtown — out of range
  '28204': { lat: 35.2063, lon: -80.8314 }, // Charlotte E
  '28205': { lat: 35.2201, lon: -80.7928 }, // Charlotte NE
  '28206': { lat: 35.2452, lon: -80.8375 }, // Charlotte N
  '28226': { lat: 35.0762, lon: -80.8451 }, // Charlotte S
};

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

function resolveZone(miles) {
  for (const tier of ZONES) {
    if (miles >= tier.minMi && miles <= tier.maxMi) return tier;
  }
  return null;
}

/**
 * Resolve a 5-digit zip code to a delivery zone, rate, and ETA.
 *
 * @param {string} zip - 5-digit US zip code
 * @returns {{ zone: string, label: string, rate: number|null, eta: string|null,
 *             distanceMiles: number, message?: string, error?: string }}
 */
export const getDeliveryZone = webMethod(
  Permissions.Anyone,
  async (zip) => {
    const clean = String(zip || '').trim().replace(/\D/g, '').slice(0, 5);
    if (!clean || clean.length !== 5) {
      return { error: 'Please enter a valid 5-digit zip code.' };
    }

    const coords = ZIP_COORDS[clean];
    if (!coords) {
      return {
        zone: 'outofrange',
        label: 'Out of Range',
        rate: null,
        eta: null,
        distanceMiles: null,
        message: 'We deliver within 60 miles of our Hendersonville, NC showroom. Contact us for a delivery quote.',
      };
    }

    const distanceMiles = Math.round(haversineMiles(STORE.lat, STORE.lon, coords.lat, coords.lon));
    const tier = resolveZone(distanceMiles);

    if (!tier) {
      return {
        zone: 'outofrange',
        label: 'Out of Range',
        rate: null,
        eta: null,
        distanceMiles,
        message: 'We deliver within 60 miles of our Hendersonville, NC showroom. Contact us for a delivery quote.',
      };
    }

    return {
      zone: tier.zone,
      label: tier.label,
      rate: tier.rate,
      eta: tier.eta,
      distanceMiles,
    };
  }
);
