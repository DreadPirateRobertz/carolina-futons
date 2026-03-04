// Store Locator.js - Showroom Finder Page
// Interactive showroom finder with hours, directions, photos, amenities,
// embedded Google Map, and LocalBusiness JSON-LD schema for SEO
import { getStoreLocatorSchema } from 'backend/storeLocatorService.web';
import { isShowroomOpen, getNearbyCities } from 'backend/storeLocatorService.web';
import { getDirectionsUrl } from 'backend/storeLocatorService.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import {
  getShowroomPhotos,
  getShowroomFeaturesList,
  buildOpenStatusBadge,
  getHoursTableData,
  buildDirectionsCityCards,
  getShowroomAmenities,
  getMapConfig,
  getShowroomContactInfo,
} from 'public/storeLocatorHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initContactInfo();
  initMapSection();
  initHoursTable();
  initShowroomFeatures();
  initShowroomPhotos();
  initAmenities();
  initDirectionsInput();
  await Promise.allSettled([
    initOpenStatus(),
    initDirectionsCities(),
    injectStoreSchema(),
  ]);
  trackEvent('page_view', { page: 'store-locator' });
});

// ── Contact Info ──────────────────────────────────────────────────────
// Address, phone, email displayed in the hero/sidebar

function initContactInfo() {
  try {
    const info = getShowroomContactInfo();
    try { $w('#storeAddress').text = info.address; } catch (e) {}
    try { $w('#storePhone').text = info.phone; } catch (e) {}
    try { $w('#storeEmail').text = info.email; } catch (e) {}

    // Phone call button
    try {
      const phoneBtn = $w('#storePhoneBtn');
      if (phoneBtn) {
        makeClickable(phoneBtn, () => {
          import('wix-window-frontend').then(({ openUrl }) => openUrl(info.telLink));
        }, { ariaLabel: `Call Carolina Futons at ${info.phone}` });
      }
    } catch (e) {}

    // Email button
    try {
      const emailBtn = $w('#storeEmailBtn');
      if (emailBtn) {
        makeClickable(emailBtn, () => {
          import('wix-window-frontend').then(({ openUrl }) => openUrl(`mailto:${info.email}`));
        }, { ariaLabel: `Email Carolina Futons at ${info.email}` });
      }
    } catch (e) {}

    // Directions button
    try {
      const dirBtn = $w('#storeDirectionsBtn');
      if (dirBtn) {
        makeClickable(dirBtn, () => {
          import('wix-window-frontend').then(({ openUrl }) => openUrl(info.directionsUrl));
          trackEvent('store_locator_directions_click', { source: 'hero' });
        }, { ariaLabel: 'Get directions to our showroom' });
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Google Map Embed ──────────────────────────────────────────────────

function initMapSection() {
  try {
    const mapConfig = getMapConfig();
    const mapHtml = $w('#storeMapHtml');
    if (!mapHtml) return;

    try { mapHtml.accessibility.ariaLabel = mapConfig.ariaLabel; } catch (e) {}
    mapHtml.postMessage(mapConfig.embedUrl);

    // "Open in Google Maps" link
    try {
      const mapLink = $w('#openInMapsBtn');
      if (mapLink) {
        makeClickable(mapLink, () => {
          import('wix-window-frontend').then(({ openUrl }) => openUrl(mapConfig.mapsUrl));
          trackEvent('store_locator_map_click', { type: 'open_in_maps' });
        }, { ariaLabel: 'Open location in Google Maps' });
      }
    } catch (e) {}
  } catch (e) {}
}

// ── Business Hours Table ──────────────────────────────────────────────

function initHoursTable() {
  try {
    const hoursRepeater = $w('#hoursRepeater');
    if (!hoursRepeater) return;

    const rows = getHoursTableData();
    try { hoursRepeater.accessibility.ariaLabel = 'Weekly business hours'; } catch (e) {}
    hoursRepeater.onItemReady(($item, itemData) => {
      try { $item('#hoursDay').text = itemData.day; } catch (e) {}
      try { $item('#hoursTime').text = itemData.hours; } catch (e) {}
    });
    hoursRepeater.data = rows.map((r, i) => ({ ...r, _id: `hours-${i}` }));
  } catch (e) {}
}

// ── Open/Closed Status ────────────────────────────────────────────────

async function initOpenStatus() {
  try {
    const result = await isShowroomOpen();
    if (!result.success) return;

    const badge = buildOpenStatusBadge(result.data);

    try { $w('#statusBadge').text = badge.label; } catch (e) {}
    try { $w('#statusHours').text = badge.hours; } catch (e) {}
    try { $w('#statusNextOpen').text = badge.nextOpen; } catch (e) {}

    // Show/hide next open info
    if (badge.nextOpen) {
      try { $w('#statusNextOpen').show(); } catch (e) {}
    } else {
      try { $w('#statusNextOpen').hide(); } catch (e) {}
    }

    try { announce($w, badge.isOpen ? 'Showroom is currently open' : `Showroom is currently closed. ${badge.nextOpen}`); } catch (e) {}
  } catch (e) {}
}

// ── Showroom Features Grid ────────────────────────────────────────────

function initShowroomFeatures() {
  try {
    const featuresRepeater = $w('#featuresRepeater');
    if (!featuresRepeater) return;

    const features = getShowroomFeaturesList();
    try { featuresRepeater.accessibility.ariaLabel = 'Showroom features and services'; } catch (e) {}
    featuresRepeater.onItemReady(($item, itemData) => {
      try { $item('#featureTitle').text = itemData.title; } catch (e) {}
      try { $item('#featureDesc').text = itemData.description; } catch (e) {}
    });
    featuresRepeater.data = features.map((f, i) => ({ ...f, _id: `feature-${i}` }));
  } catch (e) {}
}

// ── Showroom Photo Gallery ────────────────────────────────────────────

function initShowroomPhotos() {
  try {
    const gallery = $w('#showroomGallery');
    if (!gallery) return;

    const photos = getShowroomPhotos();
    try { gallery.accessibility.ariaLabel = 'Showroom photo gallery'; } catch (e) {}
    gallery.onItemReady(($item, itemData) => {
      try { $item('#galleryImage').alt = itemData.alt; } catch (e) {}
      try { $item('#galleryCaption').text = itemData.caption; } catch (e) {}
    });
    gallery.data = photos.map(p => ({ ...p, _id: p.id }));
  } catch (e) {}
}

// ── Amenities Section ─────────────────────────────────────────────────

function initAmenities() {
  try {
    const amenitiesRepeater = $w('#amenitiesRepeater');
    if (!amenitiesRepeater) return;

    const amenities = getShowroomAmenities();
    try { amenitiesRepeater.accessibility.ariaLabel = 'Showroom amenities'; } catch (e) {}
    amenitiesRepeater.onItemReady(($item, itemData) => {
      try { $item('#amenityLabel').text = itemData.label; } catch (e) {}
      try { $item('#amenityDetail').text = itemData.detail; } catch (e) {}
    });
    amenitiesRepeater.data = amenities.map((a, i) => ({ ...a, _id: `amenity-${i}` }));
  } catch (e) {}
}

// ── Directions — Nearby Cities ────────────────────────────────────────

async function initDirectionsCities() {
  try {
    const result = await getNearbyCities();
    if (!result.success) return;

    const repeater = $w('#directionsRepeater');
    if (!repeater) return;

    const cards = buildDirectionsCityCards(result.items);
    try { repeater.accessibility.ariaLabel = 'Driving directions from nearby cities'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#cityLabel').text = itemData.label; } catch (e) {}
      try { $item('#cityDistance').text = itemData.distance; } catch (e) {}
      try { $item('#cityDriveTime').text = itemData.time; } catch (e) {}
      try { $item('#cityDirections').text = itemData.directions; } catch (e) {}

      try {
        const mapBtn = $item('#cityMapBtn');
        if (mapBtn) {
          makeClickable(mapBtn, () => {
            import('wix-window-frontend').then(({ openUrl }) => openUrl(itemData.mapUrl));
            trackEvent('store_locator_directions_click', { city: itemData.label });
          }, { ariaLabel: `Get directions from ${itemData.label}` });
        }
      } catch (e) {}
    });
    repeater.data = cards;
  } catch (e) {}
}

// ── Directions — Custom Address Input ─────────────────────────────────

function initDirectionsInput() {
  try {
    const input = $w('#directionsAddressInput');
    const goBtn = $w('#directionsGoBtn');
    if (!input || !goBtn) return;

    try { input.accessibility.ariaLabel = 'Enter your address for directions'; } catch (e) {}
    try { goBtn.accessibility.ariaLabel = 'Get directions from your address'; } catch (e) {}

    goBtn.onClick(async () => {
      const address = (input.value || '').trim();
      if (!address) {
        try { announce($w, 'Please enter an address to get directions'); } catch (e) {}
        return;
      }

      try {
        const result = await getDirectionsUrl(address);
        if (result.success) {
          const { openUrl } = await import('wix-window-frontend');
          openUrl(result.data.directionsUrl);
          trackEvent('store_locator_directions_click', { source: 'custom_address' });
        }
      } catch (err) {
        try { announce($w, 'Unable to get directions. Please try again.'); } catch (e) {}
      }
    });
  } catch (e) {}
}

// ── JSON-LD Schema Injection ──────────────────────────────────────────

async function injectStoreSchema() {
  try {
    const schema = await getStoreLocatorSchema();
    if (schema) {
      $w('#storeSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
