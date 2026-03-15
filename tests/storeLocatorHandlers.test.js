import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}
let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock data ────────────────────────────────────────────────────────

const mockContactInfo = {
  address: '123 Main St, Hendersonville, NC',
  phone: '(828) 252-9449',
  email: 'info@carolinafutons.com',
  telLink: 'tel:+18282529449',
  directionsUrl: 'https://maps.google.com/...',
};

const mockMapConfig = {
  ariaLabel: 'Carolina Futons showroom location',
  embedUrl: 'https://maps.google.com/embed',
  mapsUrl: 'https://maps.google.com/place',
};

const mockHoursData = [
  { day: 'Wednesday', hours: '10 AM - 5 PM' },
  { day: 'Thursday', hours: '10 AM - 5 PM' },
];

const mockOpenStatus = {
  success: true,
  data: { isOpen: true, currentHours: '10 AM - 5 PM' },
};

const mockFeatures = [
  { title: 'Try Before You Buy', description: 'Test all products in person' },
];

const mockPhotos = [
  { id: 'photo-1', alt: 'Showroom interior', caption: 'Main display area' },
];

const mockAmenities = [
  { label: 'Free Parking', detail: 'Ample parking available' },
];

const mockNearbyCities = {
  success: true,
  items: [{ city: 'Asheville' }],
};

const mockSchema = { '@type': 'LocalBusiness' };

const mockDirectionsUrl = {
  success: true,
  data: { directionsUrl: 'https://maps.google.com/directions' },
};

// ── Module mocks ─────────────────────────────────────────────────────

const mockBuildOpenStatusBadge = vi.fn(() => ({
  label: 'Open Now', hours: '10 AM - 5 PM', nextOpen: '', isOpen: true,
}));

const mockBuildDirectionsCityCards = vi.fn((items) =>
  items.map((item, i) => ({
    _id: `city-${i}`,
    label: item.city,
    distance: '25 mi',
    time: '30 min',
    directions: 'Take I-26',
    mapUrl: 'https://maps.google.com',
  }))
);

const mockInjectSeoSsr = vi.fn(() => Promise.resolve());
const mockMakeClickable = vi.fn();
const mockAnnounce = vi.fn();
const mockTrackEvent = vi.fn();
const mockInitBackToTop = vi.fn();
const mockInitPageSeo = vi.fn(() => Promise.resolve());

vi.mock('backend/storeLocatorService.web', () => ({
  getStoreLocatorSchema: vi.fn(() => Promise.resolve(mockSchema)),
  isShowroomOpen: vi.fn(() => Promise.resolve(mockOpenStatus)),
  getNearbyCities: vi.fn(() => Promise.resolve(mockNearbyCities)),
  getDirectionsUrl: vi.fn((addr) => Promise.resolve(mockDirectionsUrl)),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: mockInitBackToTop,
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: mockAnnounce,
  makeClickable: mockMakeClickable,
}));

vi.mock('public/storeLocatorHelpers.js', () => ({
  getShowroomPhotos: vi.fn(() => mockPhotos),
  getShowroomFeaturesList: vi.fn(() => mockFeatures),
  buildOpenStatusBadge: mockBuildOpenStatusBadge,
  getHoursTableData: vi.fn(() => mockHoursData),
  buildDirectionsCityCards: mockBuildDirectionsCityCards,
  getShowroomAmenities: vi.fn(() => mockAmenities),
  getMapConfig: vi.fn(() => mockMapConfig),
  getShowroomContactInfo: vi.fn(() => mockContactInfo),
}));

vi.mock('public/localBusinessSeo.js', () => ({
  injectStoreLocatorSeoSsr: mockInjectSeoSsr,
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: mockInitPageSeo,
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

// ── Tests ────────────────────────────────────────────────────────────

describe('Store Locator page', () => {
  beforeAll(async () => {
    await import('../src/pages/Store Locator.js');
    await onReadyHandler();
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // 1. Init
  it('calls initBackToTop on ready', async () => {
    await onReadyHandler();
    expect(mockInitBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls initPageSeo with storeLocator', async () => {
    await onReadyHandler();
    expect(mockInitPageSeo).toHaveBeenCalledWith('storeLocator');
  });

  it('tracks page_view event', async () => {
    await onReadyHandler();
    expect(mockTrackEvent).toHaveBeenCalledWith('page_view', { page: 'store-locator' });
  });

  // 2. Contact info
  it('sets address, phone, and email text from contact info', async () => {
    await onReadyHandler();
    expect(getEl('#storeAddress').text).toBe('123 Main St, Hendersonville, NC');
    expect(getEl('#storePhone').text).toBe('(828) 252-9449');
    expect(getEl('#storeEmail').text).toBe('info@carolinafutons.com');
  });

  // 3. Contact buttons
  it('calls makeClickable for phone, email, and directions buttons', async () => {
    await onReadyHandler();
    const calls = mockMakeClickable.mock.calls;
    const targets = calls.map(c => c[0]);
    expect(targets).toContain(getEl('#storePhoneBtn'));
    expect(targets).toContain(getEl('#storeEmailBtn'));
    expect(targets).toContain(getEl('#storeDirectionsBtn'));
  });

  // 4. Map section
  it('posts embedUrl to storeMapHtml and sets ARIA label', async () => {
    await onReadyHandler();
    const mapHtml = getEl('#storeMapHtml');
    expect(mapHtml.postMessage).toHaveBeenCalledWith('https://maps.google.com/embed');
    expect(mapHtml.accessibility.ariaLabel).toBe('Carolina Futons showroom location');
  });

  // 5. Open in Maps
  it('calls makeClickable on openInMapsBtn', async () => {
    await onReadyHandler();
    const calls = mockMakeClickable.mock.calls;
    const targets = calls.map(c => c[0]);
    expect(targets).toContain(getEl('#openInMapsBtn'));
  });

  // 6. Hours table
  it('sets hours repeater ARIA label and data from getHoursTableData', async () => {
    await onReadyHandler();
    const repeater = getEl('#hoursRepeater');
    expect(repeater.accessibility.ariaLabel).toBe('Weekly business hours');
    expect(repeater.data).toEqual([
      { day: 'Wednesday', hours: '10 AM - 5 PM', _id: 'hours-0' },
      { day: 'Thursday', hours: '10 AM - 5 PM', _id: 'hours-1' },
    ]);
  });

  it('hours onItemReady sets day and hours text', async () => {
    await onReadyHandler();
    const repeater = getEl('#hoursRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, { day: 'Wednesday', hours: '10 AM - 5 PM' });
    expect($item('#hoursDay').text).toBe('Wednesday');
    expect($item('#hoursTime').text).toBe('10 AM - 5 PM');
  });

  // 7. Open status
  it('calls isShowroomOpen and sets status badge and hours text', async () => {
    const { isShowroomOpen: mockIsOpen } = await import('backend/storeLocatorService.web');
    await onReadyHandler();
    expect(mockIsOpen).toHaveBeenCalled();
    expect(mockBuildOpenStatusBadge).toHaveBeenCalledWith({ isOpen: true, currentHours: '10 AM - 5 PM' });
    expect(getEl('#statusBadge').text).toBe('Open Now');
    expect(getEl('#statusHours').text).toBe('10 AM - 5 PM');
  });

  // 8. Open status announces
  it('announces open status', async () => {
    await onReadyHandler();
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Showroom is currently open');
  });

  it('announces closed status when showroom is closed', async () => {
    mockBuildOpenStatusBadge.mockReturnValueOnce({
      label: 'Closed', hours: '', nextOpen: 'Opens Monday at 10 AM', isOpen: false,
    });
    await onReadyHandler();
    expect(mockAnnounce).toHaveBeenCalledWith(
      $w,
      'Showroom is currently closed. Opens Monday at 10 AM'
    );
  });

  // 9. Features
  it('sets features repeater ARIA label, data, and onItemReady sets title/description', async () => {
    await onReadyHandler();
    const repeater = getEl('#featuresRepeater');
    expect(repeater.accessibility.ariaLabel).toBe('Showroom features and services');
    expect(repeater.data).toEqual([
      { title: 'Try Before You Buy', description: 'Test all products in person', _id: 'feature-0' },
    ]);
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, { title: 'Try Before You Buy', description: 'Test all products in person' });
    expect($item('#featureTitle').text).toBe('Try Before You Buy');
    expect($item('#featureDesc').text).toBe('Test all products in person');
  });

  // 10. Photos
  it('sets gallery ARIA label, data from getShowroomPhotos, and onItemReady sets alt/caption', async () => {
    await onReadyHandler();
    const gallery = getEl('#showroomGallery');
    expect(gallery.accessibility.ariaLabel).toBe('Showroom photo gallery');
    expect(gallery.data).toEqual([
      { id: 'photo-1', alt: 'Showroom interior', caption: 'Main display area', _id: 'photo-1' },
    ]);
    const itemReadyCb = gallery.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, { alt: 'Showroom interior', caption: 'Main display area' });
    expect($item('#galleryImage').alt).toBe('Showroom interior');
    expect($item('#galleryCaption').text).toBe('Main display area');
  });

  // 11. Amenities
  it('sets amenities repeater ARIA label, data, and onItemReady sets label/detail', async () => {
    await onReadyHandler();
    const repeater = getEl('#amenitiesRepeater');
    expect(repeater.accessibility.ariaLabel).toBe('Showroom amenities');
    expect(repeater.data).toEqual([
      { label: 'Free Parking', detail: 'Ample parking available', _id: 'amenity-0' },
    ]);
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, { label: 'Free Parking', detail: 'Ample parking available' });
    expect($item('#amenityLabel').text).toBe('Free Parking');
    expect($item('#amenityDetail').text).toBe('Ample parking available');
  });

  // 12. Directions cities
  it('calls getNearbyCities and sets directions repeater data via buildDirectionsCityCards', async () => {
    const { getNearbyCities: mockGetCities } = await import('backend/storeLocatorService.web');
    await onReadyHandler();
    expect(mockGetCities).toHaveBeenCalled();
    expect(mockBuildDirectionsCityCards).toHaveBeenCalledWith([{ city: 'Asheville' }]);
    const repeater = getEl('#directionsRepeater');
    expect(repeater.accessibility.ariaLabel).toBe('Driving directions from nearby cities');
    expect(repeater.data).toEqual([
      { _id: 'city-0', label: 'Asheville', distance: '25 mi', time: '30 min', directions: 'Take I-26', mapUrl: 'https://maps.google.com' },
    ]);
  });

  it('directions onItemReady sets label, distance, time, and directions', async () => {
    await onReadyHandler();
    const repeater = getEl('#directionsRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, {
      label: 'Asheville', distance: '25 mi', time: '30 min',
      directions: 'Take I-26', mapUrl: 'https://maps.google.com',
    });
    expect($item('#cityLabel').text).toBe('Asheville');
    expect($item('#cityDistance').text).toBe('25 mi');
    expect($item('#cityDriveTime').text).toBe('30 min');
    expect($item('#cityDirections').text).toBe('Take I-26');
  });

  // 13. City map button
  it('calls makeClickable on cityMapBtn and tracks directions click', async () => {
    await onReadyHandler();
    const repeater = getEl('#directionsRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    itemReadyCb($item, {
      label: 'Asheville', distance: '25 mi', time: '30 min',
      directions: 'Take I-26', mapUrl: 'https://maps.google.com',
    });
    expect(mockMakeClickable).toHaveBeenCalledWith(
      $item('#cityMapBtn'),
      expect.any(Function),
      { ariaLabel: 'Get directions from Asheville' }
    );
  });

  // 14. Directions input ARIA labels
  it('sets ARIA labels on directions input and go button', async () => {
    await onReadyHandler();
    expect(getEl('#directionsAddressInput').accessibility.ariaLabel).toBe('Enter your address for directions');
    expect(getEl('#directionsGoBtn').accessibility.ariaLabel).toBe('Get directions from your address');
  });

  // 15. Directions go button
  it('onClick calls getDirectionsUrl with the entered address', async () => {
    const { getDirectionsUrl: mockGetDir } = await import('backend/storeLocatorService.web');
    await onReadyHandler();
    const goBtn = getEl('#directionsGoBtn');
    const clickHandler = goBtn.onClick.mock.calls[0][0];
    getEl('#directionsAddressInput').value = '456 Elm St';
    await clickHandler();
    expect(mockGetDir).toHaveBeenCalledWith('456 Elm St');
  });

  // 16. Directions empty address
  it('announces "please enter address" when input is empty', async () => {
    await onReadyHandler();
    const goBtn = getEl('#directionsGoBtn');
    const clickHandler = goBtn.onClick.mock.calls[0][0];
    getEl('#directionsAddressInput').value = '';
    await clickHandler();
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Please enter an address to get directions');
  });

  // 17. Schema
  it('calls getStoreLocatorSchema and posts to storeSchemaHtml', async () => {
    const { getStoreLocatorSchema: mockGetSchema } = await import('backend/storeLocatorService.web');
    await onReadyHandler();
    expect(mockGetSchema).toHaveBeenCalled();
    expect(getEl('#storeSchemaHtml').postMessage).toHaveBeenCalledWith({ '@type': 'LocalBusiness' });
  });

  // 18. SSR SEO
  it('calls injectStoreLocatorSeoSsr', async () => {
    await onReadyHandler();
    expect(mockInjectSeoSsr).toHaveBeenCalled();
  });
});
