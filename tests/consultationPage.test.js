/**
 * consultationPage.test.js — Virtual Consultation booking page
 * Tests for src/pages/Consultation.js
 *
 * Covers:
 *   - loadDesigners: renders designer repeater, empty state
 *   - selectDesigner: marks selected, loads time slots
 *   - loadTimeSlots: populates date/time dropdowns, no-slots state
 *   - initConsultationPage: onReady wiring
 *   - submitBooking: validates fields, calls bookConsultation, shows confirmation
 *   - submitBooking + intake: calls submitConsultationIntake after successful booking
 *   - error paths: backend failures, double booking, unauthenticated
 *   - consultation type selection
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    data: [],
    options: [],
    checked: false,
    collapsed: false,
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
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

// ── Mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getDesigners: vi.fn(),
  getAvailableConsultationSlots: vi.fn(),
  bookConsultation: vi.fn(),
  submitConsultationIntake: vi.fn(),
  trackEvent: vi.fn(),
  announce: vi.fn(),
  to: vi.fn(),
}));

vi.mock('backend/virtualConsultation.web', () => ({
  getDesigners: mocks.getDesigners,
  getAvailableConsultationSlots: mocks.getAvailableConsultationSlots,
  bookConsultation: mocks.bookConsultation,
  submitConsultationIntake: mocks.submitConsultationIntake,
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: mocks.trackEvent,
}));

vi.mock('public/a11yHelpers', () => ({
  announce: mocks.announce,
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) el.accessibility.ariaLabel = opts.ariaLabel;
  }),
}));

vi.mock('wix-location-frontend', () => ({
  to: mocks.to,
}));

// ── Fixtures ─────────────────────────────────────────────────────────

const DESIGNERS = [
  { _id: 'd-brenda', name: 'Brenda', specialty: 'living-room', bio: 'Expert in living rooms', avatarUrl: 'https://example.com/brenda.jpg' },
  { _id: 'd-alex', name: 'Alex', specialty: 'bedroom', bio: 'Bedroom specialist', avatarUrl: '' },
];

const SLOTS = [
  { date: '2026-04-02', timeSlot: '10:00' },
  { date: '2026-04-02', timeSlot: '11:00' },
  { date: '2026-04-03', timeSlot: '09:00' },
  { date: '2026-04-03', timeSlot: '14:00' },
];

// ── Import module ─────────────────────────────────────────────────────

let initConsultationPage, loadDesigners, loadTimeSlots, submitBooking;

beforeAll(async () => {
  const mod = await import('../src/pages/Consultation.js');
  initConsultationPage = mod.initConsultationPage;
  loadDesigners = mod.loadDesigners;
  loadTimeSlots = mod.loadTimeSlots;
  submitBooking = mod.submitBooking;
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  onReadyHandler = null;
  mocks.getDesigners.mockResolvedValue({ success: true, designers: DESIGNERS });
  mocks.getAvailableConsultationSlots.mockResolvedValue({ success: true, slots: SLOTS });
  mocks.bookConsultation.mockResolvedValue({
    success: true,
    bookingId: 'booking-001',
    videoCallUrl: 'https://meet.carolinafutons.com/consultation/abc123',
  });
  mocks.submitConsultationIntake.mockResolvedValue({ success: true, intakeId: 'intake-001' });
});

// ── initConsultationPage — $w.onReady wiring ─────────────────────────

describe('initConsultationPage', () => {
  it('registers $w.onReady handler', () => {
    initConsultationPage($w);
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls loadDesigners when onReady fires', async () => {
    initConsultationPage($w);
    await onReadyHandler();
    expect(mocks.getDesigners).toHaveBeenCalledOnce();
  });

  it('wires book button onClick', async () => {
    initConsultationPage($w);
    await onReadyHandler();
    expect(getEl('#bookBtn').onClick).toHaveBeenCalled();
  });

  it('wires date/time dropdowns onChange for slot loading', async () => {
    initConsultationPage($w);
    await onReadyHandler();
    expect(getEl('#dateDropdown').onChange).toHaveBeenCalled();
  });
});

// ── loadDesigners ─────────────────────────────────────────────────────

describe('loadDesigners — success', () => {
  it('sets #designerRepeater data with all designers', async () => {
    await loadDesigners($w);
    const data = getEl('#designerRepeater').data;
    expect(data).toHaveLength(2);
    expect(data[0]._id).toBe('d-brenda');
    expect(data[0].name).toBe('Brenda');
    expect(data[0].specialty).toBe('living-room');
    expect(data[0].bio).toBe('Expert in living rooms');
    expect(data[0].avatarUrl).toBe('https://example.com/brenda.jpg');
  });

  it('falls back to empty avatarUrl string when not provided', async () => {
    await loadDesigners($w);
    const data = getEl('#designerRepeater').data;
    expect(data[1].avatarUrl).toBe('');
  });

  it('hides #loadingIndicator and shows #designerSection after loading', async () => {
    await loadDesigners($w);
    expect(getEl('#loadingIndicator').hide).toHaveBeenCalled();
    expect(getEl('#designerSection').show).toHaveBeenCalled();
  });
});

describe('loadDesigners — empty', () => {
  it('shows #noDesignersMsg when no designers returned', async () => {
    mocks.getDesigners.mockResolvedValueOnce({ success: true, designers: [] });
    await loadDesigners($w);
    expect(getEl('#noDesignersMsg').show).toHaveBeenCalled();
  });
});

describe('loadDesigners — failure', () => {
  it('shows #bookingErrorMsg on backend failure', async () => {
    mocks.getDesigners.mockResolvedValueOnce({ success: false, error: 'DB unavailable', designers: [] });
    await loadDesigners($w);
    expect(getEl('#bookingErrorMsg').text).toMatch(/unable to load/i);
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });

  it('shows #bookingErrorMsg on thrown exception', async () => {
    mocks.getDesigners.mockRejectedValueOnce(new Error('Network error'));
    await loadDesigners($w);
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });
});

// ── loadTimeSlots ─────────────────────────────────────────────────────

describe('loadTimeSlots — success', () => {
  it('populates #dateDropdown with unique dates from slots', async () => {
    await loadTimeSlots($w, 'd-brenda');
    const opts = getEl('#dateDropdown').options;
    expect(opts).toHaveLength(2);
    expect(opts[0].value).toBe('2026-04-02');
    expect(opts[1].value).toBe('2026-04-03');
  });

  it('populates #timeSlotDropdown with slots for the first date', async () => {
    await loadTimeSlots($w, 'd-brenda');
    const opts = getEl('#timeSlotDropdown').options;
    expect(opts.length).toBeGreaterThan(0);
  });

  it('calls getAvailableConsultationSlots with designerId', async () => {
    await loadTimeSlots($w, 'd-brenda');
    expect(mocks.getAvailableConsultationSlots).toHaveBeenCalledWith('d-brenda');
  });

  it('shows #slotSection after loading', async () => {
    await loadTimeSlots($w, 'd-brenda');
    expect(getEl('#slotSection').show).toHaveBeenCalled();
  });
});

describe('loadTimeSlots — no slots', () => {
  it('shows #noSlotsMsg when no slots available', async () => {
    mocks.getAvailableConsultationSlots.mockResolvedValueOnce({ success: true, slots: [] });
    await loadTimeSlots($w, 'd-brenda');
    expect(getEl('#noSlotsMsg').show).toHaveBeenCalled();
    expect(getEl('#slotSection').show).not.toHaveBeenCalled();
  });
});

describe('loadTimeSlots — failure', () => {
  it('shows #bookingErrorMsg when backend fails', async () => {
    mocks.getAvailableConsultationSlots.mockResolvedValueOnce({ success: false, error: 'Unavailable', slots: [] });
    await loadTimeSlots($w, 'd-brenda');
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });

  it('returns early without crashing when no designerId provided', async () => {
    await expect(loadTimeSlots($w, '')).resolves.toBeUndefined();
    expect(mocks.getAvailableConsultationSlots).not.toHaveBeenCalled();
  });
});

// ── submitBooking ─────────────────────────────────────────────────────

function populateValidForm() {
  getEl('#dateDropdown').value = '2026-04-02';
  getEl('#timeSlotDropdown').value = '10:00';
  getEl('#consultTypeVideo').checked = true;
  getEl('#consultTypePhone').checked = false;
  // Intake fields
  getEl('#roomTypeDropdown').value = 'living-room';
  getEl('#roomSizeDropdown').value = 'medium';
  getEl('#primaryUseDropdown').value = 'daily-sleeping';
  getEl('#styleDropdown').value = 'modern';
  getEl('#budgetDropdown').value = '500-1000';
  getEl('#timelineDropdown').value = 'within-month';
  getEl('#descriptionInput').value = 'Looking for a sleeper sofa';
  // Designer set via internal selection state
}

describe('submitBooking — success (video)', () => {
  beforeEach(() => populateValidForm());

  it('calls bookConsultation with correct arguments', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.bookConsultation).toHaveBeenCalledWith(
      expect.objectContaining({
        designerId: 'd-brenda',
        date: '2026-04-02',
        timeSlot: '10:00',
        consultationType: 'video',
      })
    );
  });

  it('shows #confirmationSection on success', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#confirmationSection').show).toHaveBeenCalled();
    expect(getEl('#bookingForm').hide).toHaveBeenCalled();
  });

  it('displays video call URL in #confirmCallUrl', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#confirmCallUrl').text).toBe('https://meet.carolinafutons.com/consultation/abc123');
    expect(getEl('#confirmCallSection').show).toHaveBeenCalled();
  });

  it('calls submitConsultationIntake with bookingId and intake fields', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.submitConsultationIntake).toHaveBeenCalledWith(
      'booking-001',
      expect.objectContaining({
        roomType: 'living-room',
        roomSize: 'medium',
        primaryUse: 'daily-sleeping',
        stylePreference: 'modern',
        budget: '500-1000',
        timeline: 'within-month',
        description: 'Looking for a sleeper sofa',
      })
    );
  });

  it('fires consultation_booked analytics event', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'consultation_booked',
      expect.objectContaining({ consultationType: 'video', date: '2026-04-02' })
    );
  });

  it('disables then re-enables #bookBtn around submission', async () => {
    const btn = getEl('#bookBtn');
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(btn.disable).toHaveBeenCalled();
    expect(btn.enable).toHaveBeenCalled();
  });
});

describe('submitBooking — success (phone)', () => {
  beforeEach(() => {
    populateValidForm();
    getEl('#consultTypeVideo').checked = false;
    getEl('#consultTypePhone').checked = true;
    mocks.bookConsultation.mockResolvedValueOnce({
      success: true,
      bookingId: 'booking-002',
      videoCallUrl: '',
    });
  });

  it('sends consultationType:phone to backend', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.bookConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ consultationType: 'phone' })
    );
  });

  it('hides #confirmCallSection for phone bookings', async () => {
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#confirmCallSection').hide).toHaveBeenCalled();
  });
});

describe('submitBooking — validation failures', () => {
  it('shows error and returns early when no designer selected', async () => {
    populateValidForm();
    await submitBooking($w, { selectedDesignerId: '' });
    expect(mocks.bookConsultation).not.toHaveBeenCalled();
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
    expect(getEl('#bookingErrorMsg').text).toMatch(/select a designer/i);
  });

  it('shows error when no date selected', async () => {
    populateValidForm();
    getEl('#dateDropdown').value = '';
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.bookConsultation).not.toHaveBeenCalled();
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });

  it('shows error when no time slot selected', async () => {
    populateValidForm();
    getEl('#timeSlotDropdown').value = '';
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.bookConsultation).not.toHaveBeenCalled();
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });

  it('shows error when no intake room type selected', async () => {
    populateValidForm();
    getEl('#roomTypeDropdown').value = '';
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(mocks.bookConsultation).not.toHaveBeenCalled();
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });
});

describe('submitBooking — backend failures', () => {
  beforeEach(() => populateValidForm());

  it('shows #bookingErrorMsg when booking returns success:false', async () => {
    mocks.bookConsultation.mockResolvedValueOnce({
      success: false,
      error: 'This time slot is no longer available.',
    });
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#bookingErrorMsg').text).toMatch(/no longer available/i);
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
    expect(getEl('#confirmationSection').show).not.toHaveBeenCalled();
  });

  it('shows #bookingErrorMsg when bookConsultation throws', async () => {
    mocks.bookConsultation.mockRejectedValueOnce(new Error('Network timeout'));
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#bookingErrorMsg').show).toHaveBeenCalled();
  });

  it('does not throw when submitConsultationIntake fails after booking', async () => {
    mocks.submitConsultationIntake.mockRejectedValueOnce(new Error('Intake error'));
    await expect(submitBooking($w, { selectedDesignerId: 'd-brenda' })).resolves.not.toThrow();
    // Booking confirmation should still show
    expect(getEl('#confirmationSection').show).toHaveBeenCalled();
  });

  it('shows auth error message when backend returns Authentication required', async () => {
    mocks.bookConsultation.mockResolvedValueOnce({
      success: false,
      error: 'Authentication required.',
    });
    await submitBooking($w, { selectedDesignerId: 'd-brenda' });
    expect(getEl('#bookingErrorMsg').text).toMatch(/sign in/i);
  });
});

// ── Consultation type selection ────────────────────────────────────────

describe('consultation type UI', () => {
  it('defaults to video type when initConsultationPage runs', async () => {
    initConsultationPage($w);
    await onReadyHandler();
    // Video checkbox should be set to checked by default
    expect(getEl('#consultTypeVideo').checked).toBe(true);
  });
});

// ── Time slot filtering by date ───────────────────────────────────────

describe('date change reloads time slots', () => {
  it('populates #timeSlotDropdown with slots for newly selected date', async () => {
    await loadTimeSlots($w, 'd-brenda');
    // Simulate user selecting the second date
    getEl('#dateDropdown').value = '2026-04-03';
    // Trigger the onChange handler manually
    const onChangeFn = getEl('#dateDropdown').onChange.mock.calls[0]?.[0];
    if (onChangeFn) onChangeFn();
    // After filtering, only slots for 2026-04-03 should appear
    const opts = getEl('#timeSlotDropdown').options;
    const values = opts.map(o => o.value);
    expect(values).toContain('09:00');
    expect(values).toContain('14:00');
    expect(values).not.toContain('10:00');
  });
});
