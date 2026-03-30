/**
 * Tests for src/pages/Admin Virtual Consultation.js
 * Covers: init, bookings render, notes form, error handling.
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
    value: '',
    label: '',
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

const mockWixDataFind = vi.fn();
const mockAddConsultationNotes = vi.fn();

vi.mock('wix-data', () => ({
  default: {
    query: () => ({
      ge: () => ({ le: () => ({ ne: () => ({ ascending: () => ({ ascending: () => ({ limit: () => ({ find: () => mockWixDataFind() }) }) }) }) }) }),
    }),
  },
}));

vi.mock('backend/virtualConsultation.web', () => ({
  addConsultationNotes: (...a) => mockAddConsultationNotes(...a),
}));

// Dynamic import so $w global is available when the module executes
const mod = await import('../src/pages/Admin Virtual Consultation.js');
const {
  _initAdminPage,
  _renderBookings,
  _openNotesForm,
  _handleSaveNotes,
  _showSection,
  _formatDate,
  _formatTime,
} = mod;

// ── Fixtures ──────────────────────────────────────────────────────────

function makeBooking(overrides = {}) {
  return {
    _id: 'bk-1',
    date: '2026-04-10',
    timeSlot: '10:00',
    consultationType: 'video',
    status: 'confirmed',
    notes: 'Looking for a futon.',
    videoCallUrl: 'https://meet.carolinafutons.com/abc',
    ...overrides,
  };
}

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── _showSection ──────────────────────────────────────────────────────

describe('_showSection', () => {
  it('expands named section and collapses others', () => {
    _showSection('bookings');
    expect(getEl('#avcBookingsSection')._expanded).toBe(true);
    expect(getEl('#avcLoadingSection')._expanded).toBe(false);
    expect(getEl('#avcErrorSection')._expanded).toBe(false);
  });
});

// ── _initAdminPage ────────────────────────────────────────────────────

describe('_initAdminPage', () => {
  it('loads and renders bookings on init', async () => {
    mockWixDataFind.mockResolvedValue({ items: [makeBooking()] });

    await _initAdminPage();

    expect(getEl('#avcBookingsSection')._expanded).toBe(true);
  });

  it('shows error when query throws', async () => {
    mockWixDataFind.mockRejectedValue(new Error('DB error'));

    await _initAdminPage();

    expect(getEl('#avcErrorSection')._expanded).toBe(true);
  });
});

// ── _renderBookings ───────────────────────────────────────────────────

describe('_renderBookings', () => {
  it('shows bookings repeater with count', () => {
    _renderBookings([makeBooking(), makeBooking({ _id: 'bk-2' })], '2026-04-10', '2026-04-24');

    expect(getEl('#avcBookingsSection')._expanded).toBe(true);
    expect(getEl('#bookingsCount').text).toBe('2 consultations');
    expect(getEl('#bookingsRepeater')._expanded).toBe(true);
  });

  it('shows empty state when no bookings', () => {
    _renderBookings([], '2026-04-10', '2026-04-24');

    expect(getEl('#bookingsEmpty')._expanded).toBe(true);
    expect(getEl('#bookingsRepeater')._expanded).toBe(false);
    expect(getEl('#bookingsCount').text).toBe('0 consultations');
  });

  it('populates repeater items correctly', () => {
    const booking = makeBooking();
    _renderBookings([booking], '2026-04-10', '2026-04-24');

    const repeater = getEl('#bookingsRepeater');
    repeater._triggerItemReady([booking]);

    expect(getEl('#bookingDate_bk-1').text).toContain('Apr');
    expect(getEl('#bookingTime_bk-1').text).toBe('10:00 AM');
    expect(getEl('#bookingType_bk-1').text).toBe('Video Call');
    expect(getEl('#bookingStatus_bk-1').text).toBe('Confirmed');
  });

  it('disables add notes button for completed bookings', () => {
    const booking = makeBooking({ status: 'completed' });
    _renderBookings([booking], '2026-04-10', '2026-04-24');

    const repeater = getEl('#bookingsRepeater');
    repeater._triggerItemReady([booking]);

    expect(getEl('#addNotesBtn_bk-1').disabled).toBe(true);
  });

  it('uses singular "consultation" for count of 1', () => {
    _renderBookings([makeBooking()], '2026-04-10', '2026-04-24');
    expect(getEl('#bookingsCount').text).toBe('1 consultation');
  });
});

// ── _openNotesForm ────────────────────────────────────────────────────

describe('_openNotesForm', () => {
  it('shows notes form and sets booking ID', () => {
    _openNotesForm('bk-42');

    expect(getEl('#notesFormSection')._expanded).toBe(true);
    expect(getEl('#notesBookingId').text).toBe('bk-42');
  });

  it('clears previous input values', () => {
    getEl('#notesInput').value      = 'old notes';
    getEl('#notesProductIds').value = 'old-id';

    _openNotesForm('bk-99');

    expect(getEl('#notesInput').value).toBe('');
    expect(getEl('#notesProductIds').value).toBe('');
  });
});

// ── _handleSaveNotes ──────────────────────────────────────────────────

describe('_handleSaveNotes', () => {
  it('calls addConsultationNotes with correct args', async () => {
    mockAddConsultationNotes.mockResolvedValue({ success: true });
    mockWixDataFind.mockResolvedValue({ items: [] });

    _openNotesForm('bk-1');
    getEl('#notesInput').value      = 'Great session!';
    getEl('#notesProductIds').value = 'prod-1, prod-2';

    await _handleSaveNotes();

    expect(mockAddConsultationNotes).toHaveBeenCalledWith(
      'bk-1',
      ['prod-1', 'prod-2'],
      'Great session!'
    );
  });

  it('collapses notes form on success', async () => {
    mockAddConsultationNotes.mockResolvedValue({ success: true });
    mockWixDataFind.mockResolvedValue({ items: [] });

    _openNotesForm('bk-1');
    await _handleSaveNotes();

    expect(getEl('#notesFormSection')._expanded).toBe(false);
    // _activeBookingId is now null — good state for "does nothing" test
  });

  it('does nothing when no active booking (state is null after successful save)', async () => {
    // Previous test left _activeBookingId null via successful save — verify guard holds
    await _handleSaveNotes();
    expect(mockAddConsultationNotes).not.toHaveBeenCalled();
  });

  it('shows error on failure', async () => {
    mockAddConsultationNotes.mockResolvedValue({ success: false, error: 'Booking not found.' });

    _openNotesForm('bk-1');
    await _handleSaveNotes();

    expect(getEl('#notesFormError').text).toBe('Booking not found.');
    expect(getEl('#notesFormError')._expanded).toBe(true);
    expect(getEl('#notesFormSection')._expanded).toBe(true);
  });

  it('limits product IDs to 5', async () => {
    mockAddConsultationNotes.mockResolvedValue({ success: true });
    mockWixDataFind.mockResolvedValue({ items: [] });

    _openNotesForm('bk-1');
    getEl('#notesProductIds').value = 'p1, p2, p3, p4, p5, p6, p7';

    await _handleSaveNotes();

    const [, productIds] = mockAddConsultationNotes.mock.calls[0];
    expect(productIds).toHaveLength(5);
  });
});

// ── Format helpers ────────────────────────────────────────────────────

describe('_formatDate', () => {
  it('formats YYYY-MM-DD to readable date', () => {
    const result = _formatDate('2026-04-10');
    expect(result).toContain('Apr');
    expect(result).toContain('2026');
  });

  it('returns empty string for falsy input', () => {
    expect(_formatDate('')).toBe('');
    expect(_formatDate(null)).toBe('');
  });
});

describe('_formatTime', () => {
  it('maps all valid time slots to 12-hour labels', () => {
    expect(_formatTime('09:00')).toBe('9:00 AM');
    expect(_formatTime('13:00')).toBe('1:00 PM');
    expect(_formatTime('16:00')).toBe('4:00 PM');
  });

  it('returns raw value for unknown time', () => {
    expect(_formatTime('22:00')).toBe('22:00');
  });

  it('returns empty string for falsy input', () => {
    expect(_formatTime('')).toBe('');
  });
});
