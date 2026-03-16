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
let sendEmail, submitContactForm, bookAppointment, getVisitTypes, getAvailableAppointmentSlots;
let validateContactFields, announce;
let getPageTitle, getCanonicalUrl, getPageMetaDescription;

beforeAll(async () => {
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ makeClickable } = await import('public/a11yHelpers.js'));
  ({ announce } = await import('public/a11yHelpers.js'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ initContactHeroSkyline, initContactShowroomScene } = await import('public/contactIllustrations.js'));
  ({ sendEmail } = await import('backend/emailService.web'));
  ({ submitContactForm } = await import('backend/contactSubmissions.web'));
  ({ bookAppointment, getVisitTypes, getAvailableAppointmentSlots } = await import('backend/deliveryScheduling.web'));
  ({ validateContactFields } = await import('public/aboutContactHelpers.js'));
  ({ getPageTitle, getCanonicalUrl, getPageMetaDescription } = await import('backend/seoHelpers.web'));
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

// ── Contact form submission tests ──────────────────────────────────

describe('Contact page — form submission success', () => {
  async function triggerSubmit(fields = {}) {
    await onReadyHandler();
    const submitBtn = getEl('#contactSubmit');
    const handler = submitBtn.onClick.mock.calls[0][0];
    // Set field values
    getEl('#contactName').value = fields.name ?? 'Jane Doe';
    getEl('#contactEmail').value = fields.email ?? 'jane@test.com';
    getEl('#contactPhone').value = fields.phone ?? '555-1234';
    getEl('#contactSubject').value = fields.subject ?? 'Question';
    getEl('#contactMessage').value = fields.message ?? 'Hello there';
    await handler();
  }

  it('calls sendEmail with sanitized form data', async () => {
    await triggerSubmit();
    expect(sendEmail).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@test.com',
      phone: '555-1234',
      subject: 'Question',
      message: 'Hello there',
    });
  });

  it('calls submitContactForm for CMS save', async () => {
    await triggerSubmit();
    expect(submitContactForm).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jane Doe',
      email: 'jane@test.com',
      source: 'contact_page',
      status: 'new',
    }));
  });

  it('tracks contact_form_submit event', async () => {
    await triggerSubmit();
    expect(trackEvent).toHaveBeenCalledWith('contact_form_submit', { subject: 'Question' });
  });

  it('shows success and hides form on success', async () => {
    await triggerSubmit();
    expect(getEl('#contactSuccess').show).toHaveBeenCalled();
    expect(getEl('#contactForm').hide).toHaveBeenCalled();
  });

  it('announces success message', async () => {
    await triggerSubmit();
    expect(announce).toHaveBeenCalledWith(globalThis.$w, 'Message sent successfully. We will respond within 24 hours.');
  });

  it('disables then re-enables submit button', async () => {
    await triggerSubmit();
    const btn = getEl('#contactSubmit');
    expect(btn.disable).toHaveBeenCalled();
    expect(btn.enable).toHaveBeenCalled();
    expect(btn.label).toBe('Send Message');
  });

  it('uses default subject when none provided', async () => {
    await triggerSubmit({ subject: '' });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      subject: 'Website Contact Form',
    }));
  });

  it('uses default phone when none provided', async () => {
    await triggerSubmit({ phone: '' });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      phone: 'Not provided',
    }));
  });
});

describe('Contact page — form submission failure', () => {
  it('shows error message when sendEmail fails', async () => {
    sendEmail.mockRejectedValueOnce(new Error('Network error'));
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    getEl('#contactName').value = 'Jane';
    getEl('#contactEmail').value = 'jane@test.com';
    getEl('#contactMessage').value = 'Hello';
    await handler();
    expect(getEl('#contactError').text).toBe('Something went wrong. Please call us at (828) 252-9449.');
    expect(getEl('#contactError').show).toHaveBeenCalled();
  });

  it('re-enables submit button after failure', async () => {
    sendEmail.mockRejectedValueOnce(new Error('fail'));
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    getEl('#contactName').value = 'Jane';
    getEl('#contactEmail').value = 'jane@test.com';
    getEl('#contactMessage').value = 'Hello';
    await handler();
    const btn = getEl('#contactSubmit');
    expect(btn.enable).toHaveBeenCalled();
    expect(btn.label).toBe('Send Message');
  });
});

describe('Contact page — form validation errors', () => {
  it('shows field errors when validation fails', async () => {
    validateContactFields.mockReturnValueOnce({
      valid: false,
      errors: [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email' },
      ],
    });
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    getEl('#contactName').value = '';
    getEl('#contactEmail').value = 'bad';
    getEl('#contactMessage').value = '';
    await handler();
    expect(getEl('#contactNameError').text).toBe('Name is required');
    expect(getEl('#contactNameError').show).toHaveBeenCalled();
    expect(getEl('#contactEmailError').text).toBe('Invalid email');
    expect(getEl('#contactEmailError').show).toHaveBeenCalled();
  });

  it('does not call sendEmail when validation fails', async () => {
    validateContactFields.mockReturnValueOnce({
      valid: false,
      errors: [{ field: 'message', message: 'Message is required' }],
    });
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('announces form errors', async () => {
    validateContactFields.mockReturnValueOnce({
      valid: false,
      errors: [{ field: 'name', message: 'Required' }],
    });
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    await handler();
    expect(announce).toHaveBeenCalledWith(globalThis.$w, 'Please fix the errors in the form');
  });

  it('hides previous errors before re-validating', async () => {
    await onReadyHandler();
    const handler = getEl('#contactSubmit').onClick.mock.calls[0][0];
    getEl('#contactName').value = 'Jane';
    getEl('#contactEmail').value = 'jane@test.com';
    getEl('#contactMessage').value = 'Hello';
    await handler();
    // hideAllErrors hides all five error elements
    expect(getEl('#contactNameError').hide).toHaveBeenCalled();
    expect(getEl('#contactEmailError').hide).toHaveBeenCalled();
    expect(getEl('#contactMessageError').hide).toHaveBeenCalled();
    expect(getEl('#contactPhoneError').hide).toHaveBeenCalled();
    expect(getEl('#contactError').hide).toHaveBeenCalled();
  });
});

// ── Appointment booking submission tests ───────────────────────────

describe('Contact page — appointment booking success', () => {
  async function triggerBooking(fields = {}) {
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = fields.name || 'John Doe';
    getEl('#appointmentEmail').value = fields.email || 'john@test.com';
    getEl('#appointmentPhone').value = fields.phone || '555-9999';
    getEl('#appointmentVisitType').value = fields.visitType || 'general';
    getEl('#appointmentDate').value = fields.date || '2026-03-20';
    getEl('#appointmentTimeSlot').value = fields.timeSlot || '10:00';
    getEl('#appointmentInterests').value = fields.interests || 'Futons';
    await handler();
  }

  it('calls bookAppointment with form data', async () => {
    await triggerBooking();
    expect(bookAppointment).toHaveBeenCalledWith({
      date: '2026-03-20',
      timeSlot: '10:00',
      visitType: 'general',
      customerName: 'John Doe',
      customerEmail: 'john@test.com',
      customerPhone: '555-9999',
      productInterests: 'Futons',
    });
  });

  it('tracks appointment_booked event on success', async () => {
    await triggerBooking();
    expect(trackEvent).toHaveBeenCalledWith('appointment_booked', { visitType: 'general', date: '2026-03-20' });
  });

  it('populates confirmation text on success', async () => {
    await triggerBooking();
    const text = getEl('#appointmentConfirmation').text;
    expect(text).toContain('General');
    expect(text).toContain('Mon');
    expect(text).toContain('Mar 15');
    expect(text).toContain('10am');
  });

  it('shows appointment success and hides form', async () => {
    await triggerBooking();
    expect(getEl('#appointmentForm').hide).toHaveBeenCalled();
    expect(getEl('#appointmentSuccess').show).toHaveBeenCalled();
  });

  it('disables then re-enables book button', async () => {
    await triggerBooking();
    const btn = getEl('#appointmentBookBtn');
    expect(btn.disable).toHaveBeenCalled();
    expect(btn.enable).toHaveBeenCalled();
    expect(btn.label).toBe('Book Visit');
  });
});

describe('Contact page — appointment booking failure', () => {
  it('shows error when result.success is false', async () => {
    bookAppointment.mockResolvedValueOnce({ success: false, message: 'Slot taken' });
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = 'John';
    getEl('#appointmentEmail').value = 'john@test.com';
    getEl('#appointmentVisitType').value = 'general';
    getEl('#appointmentDate').value = '2026-03-20';
    getEl('#appointmentTimeSlot').value = '10:00';
    await handler();
    expect(getEl('#appointmentError').text).toBe('Slot taken');
    expect(getEl('#appointmentError').show).toHaveBeenCalled();
  });

  it('uses default error when result has no message', async () => {
    bookAppointment.mockResolvedValueOnce({ success: false });
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = 'John';
    getEl('#appointmentEmail').value = 'john@test.com';
    getEl('#appointmentVisitType').value = 'general';
    getEl('#appointmentDate').value = '2026-03-20';
    getEl('#appointmentTimeSlot').value = '10:00';
    await handler();
    expect(getEl('#appointmentError').text).toBe('Unable to book. Please call (828) 252-9449.');
  });

  it('shows error when bookAppointment throws', async () => {
    bookAppointment.mockRejectedValueOnce(new Error('Server error'));
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = 'John';
    getEl('#appointmentEmail').value = 'john@test.com';
    getEl('#appointmentVisitType').value = 'general';
    getEl('#appointmentDate').value = '2026-03-20';
    getEl('#appointmentTimeSlot').value = '10:00';
    await handler();
    expect(getEl('#appointmentError').text).toBe('Something went wrong. Please call us at (828) 252-9449.');
  });

  it('re-enables book button after exception', async () => {
    bookAppointment.mockRejectedValueOnce(new Error('fail'));
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = 'John';
    getEl('#appointmentEmail').value = 'john@test.com';
    getEl('#appointmentVisitType').value = 'general';
    getEl('#appointmentDate').value = '2026-03-20';
    getEl('#appointmentTimeSlot').value = '10:00';
    await handler();
    expect(getEl('#appointmentBookBtn').enable).toHaveBeenCalled();
    expect(getEl('#appointmentBookBtn').label).toBe('Book Visit');
  });
});

describe('Contact page — appointment validation', () => {
  it('shows error when required fields missing', async () => {
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    // Leave all fields empty (default mock value is '')
    await handler();
    expect(getEl('#appointmentError').text).toBe('Please fill in all required fields.');
    expect(getEl('#appointmentError').show).toHaveBeenCalled();
    expect(bookAppointment).not.toHaveBeenCalled();
  });

  it('announces missing fields error', async () => {
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    await handler();
    expect(announce).toHaveBeenCalledWith(globalThis.$w, 'Please fill in all required fields.');
  });

  it('shows email error when email validation fails', async () => {
    validateContactFields.mockReturnValueOnce({
      valid: false,
      errors: [{ field: 'email', message: 'Invalid email' }],
    });
    await onReadyHandler();
    const handler = getEl('#appointmentBookBtn').onClick.mock.calls[0][0];
    getEl('#appointmentName').value = 'John';
    getEl('#appointmentEmail').value = 'bad-email';
    getEl('#appointmentVisitType').value = 'general';
    getEl('#appointmentDate').value = '2026-03-20';
    getEl('#appointmentTimeSlot').value = '10:00';
    await handler();
    expect(getEl('#appointmentError').text).toBe('Please enter a valid email address.');
    expect(bookAppointment).not.toHaveBeenCalled();
  });
});

// ── loadVisitTypes tests ───────────────────────────────────────────

describe('Contact page — loadVisitTypes', () => {
  it('populates visit type dropdown options', async () => {
    await onReadyHandler();
    // loadVisitTypes is called during initAppointmentBooking, which is async
    // We need to wait for it to resolve
    await vi.waitFor(() => {
      expect(getEl('#appointmentVisitType').options).toEqual([
        { label: 'General (30 min)', value: 'general' },
      ]);
    });
  });

  it('does not set options when getVisitTypes returns empty', async () => {
    getVisitTypes.mockResolvedValueOnce([]);
    elements.clear();
    vi.clearAllMocks();
    await onReadyHandler();
    await new Promise(r => setTimeout(r, 10));
    expect(getEl('#appointmentVisitType').options).toEqual([]);
  });
});

// ── loadAppointmentSlots tests ─────────────────────────────────────

describe('Contact page — loadAppointmentSlots', () => {
  it('registers onChange on #appointmentVisitType', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentVisitType').onChange).toHaveBeenCalled();
  });

  it('registers onChange on #appointmentDate', async () => {
    await onReadyHandler();
    expect(getEl('#appointmentDate').onChange).toHaveBeenCalled();
  });

  it('populates date and time slot options when slots available', async () => {
    getAvailableAppointmentSlots.mockResolvedValueOnce([
      { date: '2026-03-20', dayOfWeek: 'Fri', timeLabel: '10am', timeSlot: '10:00', spotsLeft: 3 },
      { date: '2026-03-20', dayOfWeek: 'Fri', timeLabel: '2pm', timeSlot: '14:00', spotsLeft: 1 },
      { date: '2026-03-21', dayOfWeek: 'Sat', timeLabel: '11am', timeSlot: '11:00', spotsLeft: 5 },
    ]);
    await onReadyHandler();
    // Trigger the onChange handler for visitType
    const visitTypeEl = getEl('#appointmentVisitType');
    visitTypeEl.value = 'general';
    const onChangeHandler = visitTypeEl.onChange.mock.calls[0][0];
    await onChangeHandler();

    expect(getEl('#appointmentDate').options).toEqual([
      { label: 'Fri, 2026-03-20', value: '2026-03-20' },
      { label: 'Sat, 2026-03-21', value: '2026-03-21' },
    ]);
    expect(getEl('#appointmentTimeSlot').options).toEqual([
      { label: '10am (3 spots left)', value: '10:00' },
      { label: '2pm (1 spot left)', value: '14:00' },
    ]);
  });

  it('shows "No slots available" when no slots returned', async () => {
    getAvailableAppointmentSlots.mockResolvedValueOnce([]);
    await onReadyHandler();
    const visitTypeEl = getEl('#appointmentVisitType');
    visitTypeEl.value = 'general';
    const onChangeHandler = visitTypeEl.onChange.mock.calls[0][0];
    await onChangeHandler();
    expect(getEl('#appointmentTimeSlot').options).toEqual([{ label: 'No slots available', value: '' }]);
  });
});

// ── Meta injection tests ───────────────────────────────────────────

describe('Contact page — meta injection', () => {
  it('posts meta JSON to #contactMetaHtml', async () => {
    await onReadyHandler();
    expect(getEl('#contactMetaHtml').postMessage).toHaveBeenCalledWith(
      JSON.stringify({ title: 'T', description: 'D', canonical: 'U' })
    );
  });
});
