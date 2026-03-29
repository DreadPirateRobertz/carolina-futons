/**
 * Tests for src/pages/Virtual Consultation.js
 * Covers: init, designer picker, slot picker, booking form, confirmation, errors.
 *
 * CF-ym1x
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── $w mock ───────────────────────────────────────────────────────────

const elements = new Map();

function createEl(id) {
  return {
    id,
    text: '',
    src: '',
    label: '',
    value: '',
    link: '',
    target: '',
    _expanded: true,
    data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    expand:      vi.fn(function () { this._expanded = true;  return Promise.resolve(); }),
    collapse:    vi.fn(function () { this._expanded = false; return Promise.resolve(); }),
    enable:      vi.fn(function () { this.disabled = false; }),
    disable:     vi.fn(function () { this.disabled = true; }),
    onClick:     vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
    _triggerItemReady(items) {
      if (!this._itemReadyCb) return;
      for (const item of items) {
        const $item = (sel) => getEl(`${sel}_${item._id}`);
        this._itemReadyCb($item, item);
      }
    },
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createEl(key));
  return elements.get(key);
}

globalThis.$w = Object.assign((sel) => getEl(sel), { onReady: () => {} });

// ── Backend mocks ─────────────────────────────────────────────────────

const mockGetDesigners                  = vi.fn();
const mockGetAvailableConsultationSlots = vi.fn();
const mockBookConsultation              = vi.fn();

vi.mock('backend/virtualConsultation.web', () => ({
  getDesigners:                  (...a) => mockGetDesigners(...a),
  getAvailableConsultationSlots: (...a) => mockGetAvailableConsultationSlots(...a),
  bookConsultation:              (...a) => mockBookConsultation(...a),
}));

vi.mock('wix-location-frontend', () => ({ default: { to: vi.fn(), query: {} } }));
vi.mock('public/a11yHelpers', () => ({ announce: vi.fn() }));

// Dynamic import so $w global is available when the module executes
const mod = await import('../src/pages/Virtual Consultation.js');
const {
  _initPage,
  _renderDesignerPicker,
  _renderSlotPicker,
  _showTimeSlotPicker,
  _showBookingForm,
  _handleSubmitBooking,
  _renderConfirmation,
  _showSection,
  _formatDateShort,
  _formatDateFull,
  _formatSpecialty,
} = mod;

// ── Fixtures ──────────────────────────────────────────────────────────

const DESIGNERS = [
  { _id: 'd1', name: 'Alice', specialty: 'living-room', bio: 'Expert in living rooms.', avatarUrl: '' },
  { _id: 'd2', name: 'Bob',   specialty: 'bedroom',     bio: 'Bedroom specialist.',    avatarUrl: '' },
];

const SLOTS = [
  { date: '2026-04-10', timeSlot: '09:00' },
  { date: '2026-04-10', timeSlot: '10:00' },
  { date: '2026-04-11', timeSlot: '13:00' },
];

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── _showSection ──────────────────────────────────────────────────────

describe('_showSection', () => {
  it('expands the named section and collapses others', () => {
    _showSection('designers');
    expect(getEl('#vcDesignerSection')._expanded).toBe(true);
    expect(getEl('#vcLoadingSection')._expanded).toBe(false);
    expect(getEl('#vcErrorSection')._expanded).toBe(false);
  });

  it('collapses time slot sub-panels when switching away from slots', () => {
    _showSection('confirmation');
    expect(getEl('#timeSlotSection')._expanded).toBe(false);
    expect(getEl('#slotFormSection')._expanded).toBe(false);
  });
});

// ── _initPage ─────────────────────────────────────────────────────────

describe('_initPage', () => {
  it('shows loading then renders designers on success', async () => {
    mockGetDesigners.mockResolvedValue({ success: true, designers: DESIGNERS });

    await _initPage();

    expect(getEl('#vcDesignerSection')._expanded).toBe(true);
    const repeater = getEl('#designerRepeater');
    expect(repeater.data).toHaveLength(2);
  });

  it('shows error when getDesigners fails', async () => {
    mockGetDesigners.mockResolvedValue({ success: false, error: 'Service unavailable' });

    await _initPage();

    expect(getEl('#vcErrorSection')._expanded).toBe(true);
    expect(getEl('#vcErrorText').text).toBe('Service unavailable');
  });

  it('shows error when no designers available', async () => {
    mockGetDesigners.mockResolvedValue({ success: true, designers: [] });

    await _initPage();

    expect(getEl('#vcErrorSection')._expanded).toBe(true);
    expect(getEl('#vcErrorText').text).toContain('No designers');
  });

  it('shows error on unexpected throw', async () => {
    mockGetDesigners.mockRejectedValue(new Error('Network error'));

    await _initPage();

    expect(getEl('#vcErrorSection')._expanded).toBe(true);
  });
});

// ── _renderDesignerPicker ─────────────────────────────────────────────

describe('_renderDesignerPicker', () => {
  it('populates repeater with designer data', () => {
    _renderDesignerPicker(DESIGNERS);

    expect(getEl('#vcDesignerSection')._expanded).toBe(true);
    const repeater = getEl('#designerRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(repeater.data[0]._id).toBe('d1');
    expect(repeater.data[1]._id).toBe('d2');
  });

  it('fires slot load when designer selected', async () => {
    mockGetAvailableConsultationSlots.mockResolvedValue({ success: true, slots: SLOTS });

    _renderDesignerPicker(DESIGNERS);
    const repeater = getEl('#designerRepeater');

    // Trigger item ready for first designer
    repeater._triggerItemReady(DESIGNERS.map(d => ({ ...d })));

    // Click select button for designer d1
    const btn = getEl('#selectDesignerBtn_d1');
    expect(btn._clickHandler).toBeTruthy();
    await btn._clickHandler();

    expect(mockGetAvailableConsultationSlots).toHaveBeenCalledWith('d1');
  });
});

// ── _renderSlotPicker ─────────────────────────────────────────────────

describe('_renderSlotPicker', () => {
  it('shows slots section and groups by date', () => {
    _renderSlotPicker(SLOTS, 'Alice');

    expect(getEl('#vcSlotSection')._expanded).toBe(true);
    const repeater = getEl('#dateRepeater');
    // Two distinct dates
    expect(repeater.data).toHaveLength(2);
  });

  it('shows no-slots message when slots array is empty', () => {
    _renderSlotPicker([], 'Alice');

    expect(getEl('#noSlotsMessage')._expanded).toBe(true);
    expect(getEl('#dateRepeater')._expanded).toBe(false);
  });

  it('sets designer name in header', () => {
    _renderSlotPicker(SLOTS, 'Alice');
    expect(getEl('#slotPickerDesignerName').text).toContain('Alice');
  });
});

// ── _showTimeSlotPicker ───────────────────────────────────────────────

describe('_showTimeSlotPicker', () => {
  it('shows time slot section with correct date label', () => {
    const slotsForDate = [{ timeSlot: '09:00' }, { timeSlot: '10:00' }];
    _showTimeSlotPicker('2026-04-10', slotsForDate);

    expect(getEl('#timeSlotSection')._expanded).toBe(true);
    expect(getEl('#selectedDateLabel').text).toContain('2026');
  });

  it('populates time slot repeater', () => {
    const slotsForDate = [
      { timeSlot: '09:00' },
      { timeSlot: '10:00' },
      { timeSlot: '11:00' },
    ];
    _showTimeSlotPicker('2026-04-10', slotsForDate);

    const repeater = getEl('#timeSlotRepeater');
    expect(repeater.data).toHaveLength(3);
  });
});

// ── _showBookingForm ──────────────────────────────────────────────────

describe('_showBookingForm', () => {
  it('expands the form section with slot summary', () => {
    _showBookingForm('2026-04-10', '10:00');

    expect(getEl('#slotFormSection')._expanded).toBe(true);
    expect(getEl('#formSlotSummary').text).toContain('10:00 AM');
  });
});

// ── _handleSubmitBooking ──────────────────────────────────────────────

describe('_handleSubmitBooking', () => {
  beforeEach(() => {
    // Set up valid form state via showTimeSlotPicker + showBookingForm
    _showTimeSlotPicker('2026-04-10', [{ timeSlot: '09:00' }]);
    _showBookingForm('2026-04-10', '09:00');
    // Trigger time slot selection
    const timeRepeater = getEl('#timeSlotRepeater');
    timeRepeater._triggerItemReady([{ _id: '09:00', timeSlot: '09:00' }]);
    const selectBtn = getEl('#selectTimeBtn_09:00');
    if (selectBtn._clickHandler) selectBtn._clickHandler();
  });

  it('shows confirmation on successful booking', async () => {
    mockBookConsultation.mockResolvedValue({
      success: true,
      bookingId: 'bk-1',
      videoCallUrl: 'https://meet.carolinafutons.com/consultation/abc123',
    });

    // Inject type via phone button
    getEl('#typePhoneBtn')._clickHandler?.();
    getEl('#bookingNotesInput').value = 'Please recommend futons for studio.';
    getEl('#bookingEmailInput').value  = 'test@example.com';

    await _handleSubmitBooking();

    expect(getEl('#vcConfirmSection')._expanded).toBe(true);
  });

  it('shows error when booking returns failure', async () => {
    mockBookConsultation.mockResolvedValue({
      success: false,
      error: 'This time slot is no longer available.',
    });

    getEl('#typePhoneBtn')._clickHandler?.();
    await _handleSubmitBooking();

    expect(getEl('#vcErrorSection')._expanded).toBe(true);
    expect(getEl('#vcErrorText').text).toContain('no longer available');
  });

  it('shows auth error message when not authenticated', async () => {
    mockBookConsultation.mockResolvedValue({
      success: false,
      error: 'Authentication required.',
    });

    getEl('#typePhoneBtn')._clickHandler?.();
    await _handleSubmitBooking();

    expect(getEl('#vcErrorText').text).toContain('sign in');
  });
});

// ── _renderConfirmation ───────────────────────────────────────────────

describe('_renderConfirmation', () => {
  it('shows confirmation section with date and type', () => {
    _renderConfirmation({
      bookingId: 'bk-1',
      videoCallUrl: '',
      dateDisplay: 'Wed, Apr 10 at 9:00 AM',
      typeLabel: 'Phone Call',
      notes: '',
    });

    expect(getEl('#vcConfirmSection')._expanded).toBe(true);
    expect(getEl('#confirmSlotText').text).toContain('Apr 10');
    expect(getEl('#confirmTypeText').text).toBe('Phone Call');
    expect(getEl('#videoCallSection')._expanded).toBe(false);
  });

  it('shows video call link when videoCallUrl is present', () => {
    _renderConfirmation({
      bookingId: 'bk-2',
      videoCallUrl: 'https://meet.carolinafutons.com/consultation/xyz',
      dateDisplay: 'Thu, Apr 11 at 1:00 PM',
      typeLabel: 'Video Call',
      notes: '',
    });

    expect(getEl('#videoCallSection')._expanded).toBe(true);
    expect(getEl('#videoCallLink').link).toContain('meet.carolinafutons.com');
  });

  it('shows error when confirmation is null', () => {
    _renderConfirmation(null);
    expect(getEl('#vcErrorSection')._expanded).toBe(true);
  });
});

// ── Format helpers ────────────────────────────────────────────────────

describe('_formatDateShort', () => {
  it('formats YYYY-MM-DD to short date string', () => {
    const result = _formatDateShort('2026-04-10');
    expect(result).toMatch(/Apr/);
    expect(result).toMatch(/10/);
  });

  it('returns empty string for falsy input', () => {
    expect(_formatDateShort('')).toBe('');
    expect(_formatDateShort(null)).toBe('');
  });
});

describe('_formatDateFull', () => {
  it('formats YYYY-MM-DD to full date string', () => {
    const result = _formatDateFull('2026-04-10');
    expect(result).toContain('2026');
    expect(result).toContain('April');
  });

  it('returns empty string for falsy input', () => {
    expect(_formatDateFull('')).toBe('');
  });
});

describe('_formatSpecialty', () => {
  it('maps specialty keys to labels', () => {
    expect(_formatSpecialty('living-room')).toBe('Living Room');
    expect(_formatSpecialty('bedroom')).toBe('Bedroom');
    expect(_formatSpecialty('office')).toBe('Home Office');
    expect(_formatSpecialty('multi-room')).toBe('Multi-Room');
  });

  it('returns the raw value for unknown specialties', () => {
    expect(_formatSpecialty('nursery')).toBe('nursery');
  });

  it('returns empty string for falsy input', () => {
    expect(_formatSpecialty('')).toBe('');
    expect(_formatSpecialty(null)).toBe('');
  });
});
