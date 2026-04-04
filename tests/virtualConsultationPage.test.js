/**
 * Tests for src/pages/Virtual Consultation.js
 * Covers: $w.onReady init, designer repeater, slot loading, booking form,
 *         confirmation, error paths, book-another reset.
 *
 * CF-ym1x
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── $w mock infrastructure ───────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    options: [],
    data: [],
    disabled: false,
    _clickHandler: null,
    _changeCb: null,
    _itemReadyCb: null,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(function () { this.disabled = false; }),
    disable: vi.fn(function () { this.disabled = true; }),
    onClick: vi.fn(function (fn) { this._clickHandler = fn; }),
    onChange: vi.fn(function (fn) { this._changeCb = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createMockElement());
  return elements.get(key);
}

// Capture onReady handler so we can trigger it manually
let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Backend mocks (hoisted) ──────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  getDesigners: vi.fn(),
  getAvailableConsultationSlots: vi.fn(),
  bookConsultation: vi.fn(),
  validateConsultationForm: vi.fn(),
  formatSlotDisplay: vi.fn(),
  getConsultationTypeLabel: vi.fn(),
  groupSlotsByDate: vi.fn(),
  CONSULTATION_TYPES: {
    video: { label: 'Video Call', description: 'Face-to-face video consultation.' },
    phone: { label: 'Phone Call', description: 'Voice consultation.' },
  },
  trackEvent: vi.fn(),
}));

vi.mock('backend/virtualConsultation.web', () => ({
  getDesigners: mocks.getDesigners,
  getAvailableConsultationSlots: mocks.getAvailableConsultationSlots,
  bookConsultation: mocks.bookConsultation,
}));

vi.mock('public/consultationHelpers', () => ({
  validateConsultationForm: mocks.validateConsultationForm,
  formatSlotDisplay: mocks.formatSlotDisplay,
  getConsultationTypeLabel: mocks.getConsultationTypeLabel,
  groupSlotsByDate: mocks.groupSlotsByDate,
  CONSULTATION_TYPES: mocks.CONSULTATION_TYPES,
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: mocks.trackEvent,
}));

// ── Fixtures ─────────────────────────────────────────────────────────

const DESIGNERS = [
  { _id: 'd1', name: 'Sarah Mountain', specialty: 'living-room', bio: 'Expert in living rooms.', avatarUrl: 'https://example.com/sarah.jpg' },
  { _id: 'd2', name: 'Bob Creek',      specialty: 'bedroom',     bio: 'Bedroom specialist.',     avatarUrl: '' },
];

const SLOTS = [
  { date: '2026-04-10', timeSlot: '09:00' },
  { date: '2026-04-10', timeSlot: '10:00' },
  { date: '2026-04-11', timeSlot: '13:00' },
];

const SLOTS_BY_DATE = {
  '2026-04-10': [
    { date: '2026-04-10', timeSlot: '09:00' },
    { date: '2026-04-10', timeSlot: '10:00' },
  ],
  '2026-04-11': [
    { date: '2026-04-11', timeSlot: '13:00' },
  ],
};

// ── Import module (triggers $w.onReady registration) ─────────────────

await import('../src/pages/Virtual Consultation.js');

// ── Helpers ──────────────────────────────────────────────────────────

/** Run the captured onReady handler. */
async function fireOnReady() {
  if (onReadyHandler) await onReadyHandler();
}

/** Simulate repeater rendering: trigger onItemReady for each item in .data */
function renderRepeater(repeaterId) {
  const repeater = getEl(repeaterId);
  if (!repeater._itemReadyCb || !repeater.data.length) return;
  const itemEls = new Map();
  for (const item of repeater.data) {
    repeater._itemReadyCb(
      (sel) => {
        const key = `${repeaterId}_${item._id}_${sel}`;
        if (!itemEls.has(key)) itemEls.set(key, createMockElement());
        return itemEls.get(key);
      },
      item,
    );
  }
  return itemEls;
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();

  // Default mock returns
  mocks.getDesigners.mockResolvedValue({ success: true, designers: DESIGNERS });
  mocks.getAvailableConsultationSlots.mockResolvedValue({ success: true, slots: SLOTS });
  mocks.bookConsultation.mockResolvedValue({
    success: true,
    bookingId: 'bk-1',
    videoCallUrl: 'https://meet.carolinafutons.com/consultation/abc123',
  });

  mocks.validateConsultationForm.mockReturnValue({ valid: true, errors: [] });
  mocks.formatSlotDisplay.mockImplementation((d, t) => `Wed, Apr 10 at ${t === '09:00' ? '9:00 AM' : t === '10:00' ? '10:00 AM' : '1:00 PM'}`);
  mocks.getConsultationTypeLabel.mockImplementation((type) => type === 'video' ? 'Video Call' : 'Phone Call');
  mocks.groupSlotsByDate.mockReturnValue(SLOTS_BY_DATE);
});

// ── $w.onReady ───────────────────────────────────────────────────────

describe('$w.onReady', () => {
  it('registers an onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls getDesigners on init', async () => {
    await fireOnReady();
    expect(mocks.getDesigners).toHaveBeenCalledOnce();
  });

  it('tracks page_view event', async () => {
    await fireOnReady();
    expect(mocks.trackEvent).toHaveBeenCalledWith('page_view', { page: 'virtual_consultation' });
  });

  it('hides bookingFormSection and confirmationSection on init', async () => {
    await fireOnReady();
    // showSection('designers') hides the others
    expect(getEl('#bookingFormSection').hide).toHaveBeenCalled();
    expect(getEl('#confirmationSection').hide).toHaveBeenCalled();
  });

  it('shows designerRepeater on init', async () => {
    await fireOnReady();
    expect(getEl('#designerRepeater').show).toHaveBeenCalled();
  });

  it('hides bookingError on init', async () => {
    await fireOnReady();
    expect(getEl('#bookingError').hide).toHaveBeenCalled();
  });
});

// ── loadDesigners ────────────────────────────────────────────────────

describe('loadDesigners — success', () => {
  it('sets repeater data from getDesigners result', async () => {
    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('d1');
    expect(repeater.data[0].name).toBe('Sarah Mountain');
  });

  it('wires onItemReady on the designer repeater', async () => {
    await fireOnReady();
    expect(getEl('#designerRepeater').onItemReady).toHaveBeenCalled();
  });

  it('maps specialty to human-readable labels in repeater data', async () => {
    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    expect(repeater.data[0].specialty).toBe('Living Room Expert');
    expect(repeater.data[1].specialty).toBe('Bedroom Specialist');
  });

  it('falls back to empty string for missing bio', async () => {
    mocks.getDesigners.mockResolvedValueOnce({
      success: true,
      designers: [{ _id: 'd3', name: 'No Bio', specialty: 'office', avatarUrl: '' }],
    });
    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    expect(repeater.data[0].bio).toBe('');
  });

  it('hides loading spinner after designers load', async () => {
    await fireOnReady();
    expect(getEl('#loadingSpinner').hide).toHaveBeenCalled();
  });
});

describe('loadDesigners — empty', () => {
  it('shows error when no designers returned', async () => {
    mocks.getDesigners.mockResolvedValueOnce({ success: true, designers: [] });
    await fireOnReady();
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/No designers/);
  });
});

describe('loadDesigners — failure', () => {
  it('shows error when getDesigners returns success:false', async () => {
    mocks.getDesigners.mockResolvedValueOnce({ success: false, designers: [] });
    await fireOnReady();
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/No designers|Could not load/);
  });

  it('shows error when getDesigners throws', async () => {
    mocks.getDesigners.mockRejectedValueOnce(new Error('Network error'));
    await fireOnReady();
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/Could not load designers/);
  });

  it('hides loading spinner even on failure', async () => {
    mocks.getDesigners.mockRejectedValueOnce(new Error('fail'));
    await fireOnReady();
    expect(getEl('#loadingSpinner').hide).toHaveBeenCalled();
  });
});

// ── selectDesigner (via repeater click) ──────────────────────────────

describe('selectDesigner', () => {
  async function clickDesigner(designerIndex = 0) {
    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    const itemEls = renderRepeater('#designerRepeater');

    // Find the select button for the target designer
    const designerId = repeater.data[designerIndex]._id;
    const btnKey = `#designerRepeater_${designerId}_#selectDesignerBtn`;
    const btn = itemEls.get(btnKey);
    if (btn && btn._clickHandler) {
      await btn._clickHandler();
    }
    return { itemEls, designerId };
  }

  it('calls getAvailableConsultationSlots with the designer ID', async () => {
    await clickDesigner(0);
    expect(mocks.getAvailableConsultationSlots).toHaveBeenCalledWith('d1');
  });

  it('shows the booking form section after selecting a designer', async () => {
    await clickDesigner(0);
    expect(getEl('#bookingFormSection').show).toHaveBeenCalled();
  });

  it('hides designer repeater when form is shown', async () => {
    await clickDesigner(0);
    expect(getEl('#designerRepeater').hide).toHaveBeenCalled();
  });

  it('sets the selected designer name text', async () => {
    await clickDesigner(0);
    expect(getEl('#selectedDesignerName').text).toBe('Booking with Sarah Mountain');
  });

  it('populates date dropdown from grouped slots', async () => {
    await clickDesigner(0);
    const opts = getEl('#slotDateDropdown').options;
    expect(opts).toHaveLength(2);
    expect(opts[0].value).toBe('2026-04-10');
    expect(opts[1].value).toBe('2026-04-11');
  });

  it('populates consultation type dropdown with video and phone', async () => {
    await clickDesigner(0);
    const opts = getEl('#consultationTypeDropdown').options;
    expect(opts).toHaveLength(2);
    expect(opts.map(o => o.value)).toContain('video');
    expect(opts.map(o => o.value)).toContain('phone');
  });

  it('defaults consultation type to video', async () => {
    await clickDesigner(0);
    expect(getEl('#consultationTypeDropdown').value).toBe('video');
  });

  it('tracks consultation_designer_selected event', async () => {
    await clickDesigner(0);
    expect(mocks.trackEvent).toHaveBeenCalledWith('consultation_designer_selected', { designerId: 'd1' });
  });

  it('shows error when no slots available', async () => {
    mocks.getAvailableConsultationSlots.mockResolvedValueOnce({ success: true, slots: [] });
    await clickDesigner(0);
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/No slots|try another/i);
  });

  it('shows error when slot fetch fails', async () => {
    mocks.getAvailableConsultationSlots.mockResolvedValueOnce({
      success: false,
      slots: [],
      error: 'Designer unavailable',
    });
    await clickDesigner(0);
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toBe('Designer unavailable');
  });

  it('shows error when getAvailableConsultationSlots throws', async () => {
    mocks.getAvailableConsultationSlots.mockRejectedValueOnce(new Error('Network'));
    await clickDesigner(0);
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/Could not load available slots/);
  });
});

// ── Date dropdown change populates time dropdown ─────────────────────

describe('date dropdown change', () => {
  async function setupFormAndSelectDate(dateValue) {
    await fireOnReady();
    renderRepeater('#designerRepeater');
    // Simulate designer click
    const repeater = getEl('#designerRepeater');
    const itemEls = new Map();
    repeater._itemReadyCb(
      (sel) => {
        const key = `selectDesigner_${sel}`;
        if (!itemEls.has(key)) itemEls.set(key, createMockElement());
        return itemEls.get(key);
      },
      repeater.data[0],
    );
    const btn = itemEls.get('selectDesigner_#selectDesignerBtn');
    if (btn && btn._clickHandler) await btn._clickHandler();

    // Now trigger date dropdown onChange
    const dateDropdown = getEl('#slotDateDropdown');
    dateDropdown.value = dateValue;
    if (dateDropdown._changeCb) dateDropdown._changeCb();
    return getEl('#timeSlotDropdown');
  }

  it('populates time dropdown with slots for the selected date', async () => {
    const timeDropdown = await setupFormAndSelectDate('2026-04-10');
    expect(timeDropdown.options).toHaveLength(2);
    expect(timeDropdown.options[0].value).toBe('09:00');
    expect(timeDropdown.options[1].value).toBe('10:00');
  });

  it('sets time dropdown value to empty on date change', async () => {
    const timeDropdown = await setupFormAndSelectDate('2026-04-11');
    expect(timeDropdown.value).toBe('');
  });
});

// ── Booking submission ───────────────────────────────────────────────

describe('handleBookingSubmit', () => {
  async function setupAndSubmit(overrides = {}) {
    await fireOnReady();
    const repeater = getEl('#designerRepeater');

    // Trigger onItemReady + click select for first designer
    const itemEls = new Map();
    repeater._itemReadyCb(
      (sel) => {
        const key = `submit_${sel}`;
        if (!itemEls.has(key)) itemEls.set(key, createMockElement());
        return itemEls.get(key);
      },
      repeater.data[0],
    );
    const selectBtn = itemEls.get('submit_#selectDesignerBtn');
    if (selectBtn && selectBtn._clickHandler) await selectBtn._clickHandler();

    // Set form values
    getEl('#slotDateDropdown').value = overrides.date ?? '2026-04-10';
    getEl('#timeSlotDropdown').value = overrides.timeSlot ?? '09:00';
    getEl('#consultationTypeDropdown').value = overrides.consultationType ?? 'video';
    getEl('#notesInput').value = overrides.notes ?? 'Need help with living room';

    // Click book button
    const bookBtn = getEl('#bookBtn');
    if (bookBtn._clickHandler) await bookBtn._clickHandler();
  }

  it('calls bookConsultation with form data', async () => {
    await setupAndSubmit();
    expect(mocks.bookConsultation).toHaveBeenCalledWith(expect.objectContaining({
      designerId: 'd1',
      date: '2026-04-10',
      timeSlot: '09:00',
      consultationType: 'video',
      notes: 'Need help with living room',
    }));
  });

  it('shows confirmation section on success', async () => {
    await setupAndSubmit();
    expect(getEl('#confirmationSection').show).toHaveBeenCalled();
  });

  it('sets confirmation summary text', async () => {
    await setupAndSubmit();
    expect(getEl('#confirmationSummary').text).toContain('Confirmed:');
    expect(getEl('#confirmationSummary').text).toContain('Video Call');
  });

  it('shows video call section with URL for video type', async () => {
    await setupAndSubmit({ consultationType: 'video' });
    expect(getEl('#videoCallSection').show).toHaveBeenCalled();
    expect(getEl('#videoCallLinkText').text).toBe('https://meet.carolinafutons.com/consultation/abc123');
  });

  it('hides video call section for phone type', async () => {
    mocks.bookConsultation.mockResolvedValueOnce({
      success: true,
      bookingId: 'bk-2',
      videoCallUrl: '',
    });
    await setupAndSubmit({ consultationType: 'phone' });
    expect(getEl('#videoCallSection').hide).toHaveBeenCalled();
  });

  it('tracks consultation_booked event', async () => {
    await setupAndSubmit();
    expect(mocks.trackEvent).toHaveBeenCalledWith('consultation_booked', {
      designerId: 'd1',
      consultationType: 'video',
    });
  });

  it('truncates notes to 1000 characters', async () => {
    const longNotes = 'x'.repeat(1500);
    await setupAndSubmit({ notes: longNotes });
    const callArg = mocks.bookConsultation.mock.calls[0][0];
    expect(callArg.notes.length).toBe(1000);
  });

  it('disables then re-enables book button around submission', async () => {
    const bookBtn = getEl('#bookBtn');
    await setupAndSubmit();
    expect(bookBtn.disable).toHaveBeenCalled();
    expect(bookBtn.enable).toHaveBeenCalled();
  });

  it('hides loading spinner after booking', async () => {
    await setupAndSubmit();
    expect(getEl('#loadingSpinner').hide).toHaveBeenCalled();
  });
});

// ── Booking validation failure ───────────────────────────────────────

describe('handleBookingSubmit — validation failure', () => {
  it('shows first validation error and does not call bookConsultation', async () => {
    mocks.validateConsultationForm.mockReturnValueOnce({
      valid: false,
      errors: ['Please select a date'],
    });

    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    const itemEls = new Map();
    repeater._itemReadyCb(
      (sel) => {
        const key = `val_${sel}`;
        if (!itemEls.has(key)) itemEls.set(key, createMockElement());
        return itemEls.get(key);
      },
      repeater.data[0],
    );
    const selectBtn = itemEls.get('val_#selectDesignerBtn');
    if (selectBtn && selectBtn._clickHandler) await selectBtn._clickHandler();

    getEl('#slotDateDropdown').value = '';
    const bookBtn = getEl('#bookBtn');
    if (bookBtn._clickHandler) await bookBtn._clickHandler();

    expect(mocks.bookConsultation).not.toHaveBeenCalled();
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toBe('Please select a date');
  });
});

// ── Booking backend failure ──────────────────────────────────────────

describe('handleBookingSubmit — backend failure', () => {
  async function setupAndSubmitWithMock(mockReturn) {
    if (mockReturn instanceof Error) {
      mocks.bookConsultation.mockRejectedValueOnce(mockReturn);
    } else {
      mocks.bookConsultation.mockResolvedValueOnce(mockReturn);
    }

    await fireOnReady();
    const repeater = getEl('#designerRepeater');
    const itemEls = new Map();
    repeater._itemReadyCb(
      (sel) => {
        const key = `fail_${sel}`;
        if (!itemEls.has(key)) itemEls.set(key, createMockElement());
        return itemEls.get(key);
      },
      repeater.data[0],
    );
    const selectBtn = itemEls.get('fail_#selectDesignerBtn');
    if (selectBtn && selectBtn._clickHandler) await selectBtn._clickHandler();

    getEl('#slotDateDropdown').value = '2026-04-10';
    getEl('#timeSlotDropdown').value = '09:00';
    getEl('#consultationTypeDropdown').value = 'video';

    const bookBtn = getEl('#bookBtn');
    if (bookBtn._clickHandler) await bookBtn._clickHandler();
  }

  it('shows error when booking returns success:false', async () => {
    await setupAndSubmitWithMock({ success: false, error: 'Slot no longer available.' });
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toBe('Slot no longer available.');
    expect(getEl('#confirmationSection').show).not.toHaveBeenCalled();
  });

  it('shows fallback error when booking returns success:false without message', async () => {
    await setupAndSubmitWithMock({ success: false });
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/Booking failed/);
  });

  it('shows error when bookConsultation throws', async () => {
    await setupAndSubmitWithMock(new Error('Network timeout'));
    expect(getEl('#bookingError').show).toHaveBeenCalled();
    expect(getEl('#bookingError').text).toMatch(/Unable to complete booking/);
  });

  it('re-enables book button after failure', async () => {
    await setupAndSubmitWithMock({ success: false, error: 'fail' });
    expect(getEl('#bookBtn').enable).toHaveBeenCalled();
  });
});

// ── Book Another reset ───────────────────────────────────────────────

describe('bookAnotherBtn reset', () => {
  it('returns to designers section when clicked', async () => {
    await fireOnReady();
    const bookAnotherBtn = getEl('#bookAnotherBtn');
    expect(bookAnotherBtn.onClick).toHaveBeenCalled();
    if (bookAnotherBtn._clickHandler) bookAnotherBtn._clickHandler();

    expect(getEl('#designerRepeater').show).toHaveBeenCalled();
    expect(getEl('#bookingFormSection').hide).toHaveBeenCalled();
    expect(getEl('#confirmationSection').hide).toHaveBeenCalled();
    expect(getEl('#bookingError').hide).toHaveBeenCalled();
  });
});

// ── specialtyLabel mapping ───────────────────────────────────────────

describe('specialty label mapping', () => {
  it('maps known specialties to labels in repeater data', async () => {
    mocks.getDesigners.mockResolvedValueOnce({
      success: true,
      designers: [
        { _id: 'd-off', name: 'Office', specialty: 'office', bio: '', avatarUrl: '' },
        { _id: 'd-multi', name: 'Multi', specialty: 'multi-room', bio: '', avatarUrl: '' },
      ],
    });
    await fireOnReady();
    const data = getEl('#designerRepeater').data;
    expect(data[0].specialty).toBe('Home Office Design');
    expect(data[1].specialty).toBe('Whole-Home Design');
  });

  it('passes through unknown specialty values', async () => {
    mocks.getDesigners.mockResolvedValueOnce({
      success: true,
      designers: [
        { _id: 'd-x', name: 'Unknown', specialty: 'nursery', bio: '', avatarUrl: '' },
      ],
    });
    await fireOnReady();
    expect(getEl('#designerRepeater').data[0].specialty).toBe('nursery');
  });
});

// ── Loading spinner ──────────────────────────────────────────────────

describe('loading spinner', () => {
  it('shows spinner while loading designers', async () => {
    let resolveDesigners;
    mocks.getDesigners.mockReturnValueOnce(new Promise(r => { resolveDesigners = r; }));

    const readyPromise = fireOnReady();
    expect(getEl('#loadingSpinner').show).toHaveBeenCalled();

    resolveDesigners({ success: true, designers: DESIGNERS });
    await readyPromise;
    expect(getEl('#loadingSpinner').hide).toHaveBeenCalled();
  });
});
