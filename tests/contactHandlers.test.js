import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Mock infrastructure ──────────────────────────────────────────────
const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
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

// ── Mocks (must precede imports) ────────────────────────────────────
vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(() => Promise.resolve('{}')),
  getPageTitle: vi.fn(() => Promise.resolve('T')),
  getCanonicalUrl: vi.fn(() => Promise.resolve('U')),
  getPageMetaDescription: vi.fn(() => Promise.resolve('D')),
}));

vi.mock('backend/emailService.web', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/deliveryScheduling.web', () => ({
  getAvailableAppointmentSlots: vi.fn(() => Promise.resolve([])),
  bookAppointment: vi.fn(() => Promise.resolve({
    success: true,
    confirmation: {
      visitLabel: 'General',
      dayOfWeek: 'Mon',
      date: 'Mar 15',
      timeLabel: '10am',
      address: '824 Locust St',
      phone: '(828) 252-9449',
    },
  })),
  getVisitTypes: vi.fn(() => Promise.resolve([{ label: 'General', value: 'general', duration: 30 }])),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/validators', () => ({
  sanitizeText: vi.fn((v) => v || ''),
}));

vi.mock('public/aboutContactHelpers.js', () => ({
  validateContactFields: vi.fn(() => ({ valid: true, errors: [] })),
  getShowroomDetails: vi.fn(() => ({
    address: '824 Locust St',
    phone: '(828) 252-9449',
    features: ['Free parking'],
    directionsUrl: 'https://maps.google.com',
    telLink: 'tel:+18282529449',
  })),
  formatBusinessHours: vi.fn(() => ({
    todayStatus: 'Open until 6pm',
    schedule: [{ day: 'Monday', time: '10am-6pm' }],
  })),
  getSocialProofSnippets: vi.fn(() => [{ quote: 'Great service!', author: 'Bob', rating: 5 }]),
}));

vi.mock('public/contactIllustrations.js', () => ({
  initContactHeroSkyline: vi.fn(),
  initContactShowroomScene: vi.fn(),
}));

vi.mock('public/localBusinessSeo.js', () => ({
  injectContactSeoSsr: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(() => Promise.resolve()),
}));

// ── Import mock refs and page ────────────────────────────────────────
let trackEvent, initBackToTop, makeClickable, initPageSeo;
let initContactHeroSkyline, initContactShowroomScene;

beforeAll(async () => {
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ makeClickable } = await import('public/a11yHelpers.js'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ initContactHeroSkyline, initContactShowroomScene } = await import('public/contactIllustrations.js'));
  await import('../src/pages/Contact.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Contact page — SEO & tracking', () => {
  it('calls initPageSeo with "contact"', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('contact');
  });

  it('tracks page_view event with page: "contact"', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'contact' });
  });

  it('calls initBackToTop with $w', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith(globalThis.$w);
  });
});

describe('Contact page — illustrations', () => {
  it('calls initContactHeroSkyline with $w', async () => {
    await onReadyHandler();
    expect(initContactHeroSkyline).toHaveBeenCalledWith(globalThis.$w);
  });

  it('calls initContactShowroomScene with $w', async () => {
    await onReadyHandler();
    expect(initContactShowroomScene).toHaveBeenCalledWith(globalThis.$w);
  });
});

describe('Contact page — contact form', () => {
  it('sets ARIA label on #contactName', async () => {
    await onReadyHandler();
    expect(getEl('#contactName').accessibility.ariaLabel).toBe('Your name');
  });

  it('sets ARIA label on #contactEmail', async () => {
    await onReadyHandler();
    expect(getEl('#contactEmail').accessibility.ariaLabel).toBe('Your email address');
  });

  it('sets ARIA label on #contactPhone', async () => {
    await onReadyHandler();
    expect(getEl('#contactPhone').accessibility.ariaLabel).toBe('Your phone number (optional)');
  });

  it('sets ARIA label on #contactMessage', async () => {
    await onReadyHandler();
    expect(getEl('#contactMessage').accessibility.ariaLabel).toBe('Your message');
  });

  it('sets ARIA label on #contactSubmit', async () => {
    await onReadyHandler();
    expect(getEl('#contactSubmit').accessibility.ariaLabel).toBe('Send message to Carolina Futons');
  });

  it('registers onClick on #contactSubmit', async () => {
    await onReadyHandler();
    expect(getEl('#contactSubmit').onClick).toHaveBeenCalled();
  });
});

describe('Contact page — business info', () => {
  it('sets address text on #infoAddress', async () => {
    await onReadyHandler();
    expect(getEl('#infoAddress').text).toBe('824 Locust St');
  });

  it('sets phone text on #infoPhone', async () => {
    await onReadyHandler();
    expect(getEl('#infoPhone').text).toBe('(828) 252-9449');
  });

  it('sets repeater data on #contactFeatures', async () => {
    await onReadyHandler();
    const data = getEl('#contactFeatures').data;
    expect(data.length).toBe(1);
    expect(data[0].text).toBe('Free parking');
    expect(data[0]._id).toBe('cf-0');
  });

  it('registers onItemReady on #contactFeatures', async () => {
    await onReadyHandler();
    expect(getEl('#contactFeatures').onItemReady).toHaveBeenCalled();
  });

  it('registers onClick on #infoPhoneLink', async () => {
    await onReadyHandler();
    expect(getEl('#infoPhoneLink').onClick).toHaveBeenCalled();
  });

  it('registers onClick on #directionsBtn', async () => {
    await onReadyHandler();
    expect(getEl('#directionsBtn').onClick).toHaveBeenCalled();
  });
});

describe('Contact page — business hours', () => {
  it('sets today status text on #todayStatus', async () => {
    await onReadyHandler();
    expect(getEl('#todayStatus').text).toBe('Open until 6pm');
  });

  it('sets repeater data on #hoursRepeater', async () => {
    await onReadyHandler();
    const data = getEl('#hoursRepeater').data;
    expect(data.length).toBe(1);
    expect(data[0].day).toBe('Monday');
    expect(data[0].time).toBe('10am-6pm');
    expect(data[0]._id).toBe('hr-0');
  });

  it('onItemReady on #hoursRepeater sets #hourDay and #hourTime', async () => {
    await onReadyHandler();
    const repeater = getEl('#hoursRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();

    // Invoke the registered callback
    const callback = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`hoursItem${sel}`);
    callback($item, { day: 'Tuesday', time: '11am-5pm', _id: 'hr-1' });

    expect(getEl('hoursItem#hourDay').text).toBe('Tuesday');
    expect(getEl('hoursItem#hourTime').text).toBe('11am-5pm');
  });
});

describe('Contact page — appointment booking', () => {
  it('sets ARIA label on #appointmentName', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentName').accessibility.ariaLabel).toBe('Your name');
  });

  it('sets ARIA label on #appointmentEmail', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentEmail').accessibility.ariaLabel).toBe('Your email address');
  });

  it('sets ARIA label on #appointmentVisitType', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentVisitType').accessibility.ariaLabel).toBe('Type of visit');
  });

  it('sets ARIA label on #appointmentBookBtn', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentBookBtn').accessibility.ariaLabel).toBe('Book showroom appointment');
  });

  it('registers onClick on #appointmentBookBtn', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentBookBtn').onClick).toHaveBeenCalled();
  });
});

describe('Contact page — social proof', () => {
  it('sets repeater data on #contactTestimonials', async () => {
    await onReadyHandler();
    const data = getEl('#contactTestimonials').data;
    expect(data.length).toBe(1);
    expect(data[0].quote).toBe('Great service!');
    expect(data[0].author).toBe('Bob');
    expect(data[0].rating).toBe(5);
    expect(data[0]._id).toBe('ct-0');
  });

  it('onItemReady on #contactTestimonials sets quote, author, and stars', async () => {
    await onReadyHandler();
    const repeater = getEl('#contactTestimonials');
    expect(repeater.onItemReady).toHaveBeenCalled();

    const callback = repeater.onItemReady.mock.calls[0][0];
    const $item = (sel) => getEl(`testimonialItem${sel}`);
    callback($item, { quote: 'Loved it!', author: 'Alice', rating: 4, _id: 'ct-1' });

    expect(getEl('testimonialItem#testimonialQuote').text).toBe('"Loved it!"');
    expect(getEl('testimonialItem#testimonialAuthor').text).toBe('— Alice');
    expect(getEl('testimonialItem#testimonialStars').text).toBe('★★★★☆');
  });
});

describe('Contact page — FAQ link', () => {
  it('calls makeClickable on #contactFaqLink', async () => {
    await onReadyHandler();
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#contactFaqLink'),
      expect.any(Function),
      expect.objectContaining({ ariaLabel: expect.stringContaining('frequently asked questions') })
    );
  });
});

describe('Contact page — schema injection', () => {
  it('posts schema JSON to #contactSchemaHtml', async () => {
    await onReadyHandler();
    expect(getEl('#contactSchemaHtml').postMessage).toHaveBeenCalledWith('{}');
  });
});
