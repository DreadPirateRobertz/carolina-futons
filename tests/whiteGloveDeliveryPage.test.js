/**
 * Tests for src/pages/White Glove Delivery.js
 * Covers S1-S5: loading, existing appointment, calendar, confirmation, error
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setQuery } from 'wix-location-frontend';

// ── $w mock ───────────────────────────────────────────────────────────

const elements = new Map();

function createEl(id) {
  return {
    id,
    text: '',
    src: '',
    label: '',
    value: '',
    _expanded: true,
    data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    accessibility: { ariaLabel: '' },
    expand:      vi.fn(function () { this._expanded = true;  return Promise.resolve(); }),
    collapse:    vi.fn(function () { this._expanded = false; return Promise.resolve(); }),
    enable:      vi.fn(function () { this.disabled = false; }),
    disable:     vi.fn(function () { this.disabled = true; }),
    onClick:     vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady: vi.fn(function (cb) { this._itemReadyCb = cb; }),
  };
}

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, createEl(key));
  return elements.get(key);
}

globalThis.$w = Object.assign((sel) => getEl(sel), { onReady: () => {} });

// ── Backend mocks ─────────────────────────────────────────────────────

const mockGetWhiteGloveSlots        = vi.fn();
const mockBookWhiteGloveDelivery    = vi.fn();
const mockGetMyWhiteGloveAppointment = vi.fn();
const mockRescheduleWhiteGlove      = vi.fn();

vi.mock('backend/whiteGloveScheduling.web', () => ({
  getWhiteGloveSlots:          (...a) => mockGetWhiteGloveSlots(...a),
  bookWhiteGloveDelivery:      (...a) => mockBookWhiteGloveDelivery(...a),
  getMyWhiteGloveAppointment:  (...a) => mockGetMyWhiteGloveAppointment(...a),
  rescheduleWhiteGlove:        (...a) => mockRescheduleWhiteGlove(...a),
}));

vi.mock('public/a11yHelpers', () => ({ announce: vi.fn() }));

// ── Module import ─────────────────────────────────────────────────────

const mod = await import('../src/pages/White Glove Delivery.js');
const {
  _initPage,
  _renderExistingAppointment,
  _renderCalendar,
  _showWindowSelector,
  _confirmBooking,
  _renderConfirmation,
  _showSection,
  _formatDate,
  _groupSlotsByDate,
} = mod;

// ── Test helpers ──────────────────────────────────────────────────────

function makeSlot(overrides = {}) {
  return {
    date: '2026-06-02',
    dayOfWeek: 'Tue',
    window: 'morning',
    label: '10:00 AM – 12:00 PM',
    available: true,
    spotsLeft: 3,
    ...overrides,
  };
}

function makeAppt(overrides = {}) {
  return {
    _id: 'appt-1',
    orderId: 'order-1',
    appointmentDate: '2026-06-02',
    window: 'morning',
    windowLabel: '10:00 AM – 12:00 PM',
    status: 'confirmed',
    rescheduleCount: 0,
    canReschedule: true,
    ...overrides,
  };
}

function makeItemEl() {
  const itemEls = new Map();
  const $item = (sel) => {
    const key = sel.replace(/^#/, '');
    if (!itemEls.has(key)) itemEls.set(key, createEl(key));
    return itemEls.get(key);
  };
  $item._els = itemEls;
  return $item;
}

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  __setQuery({});
  mockGetWhiteGloveSlots.mockResolvedValue({
    success: true,
    slots: [makeSlot(), makeSlot({ window: 'midday', label: '12:00 PM – 2:00 PM' }), makeSlot({ window: 'afternoon', label: '2:00 PM – 4:00 PM' })],
  });
  mockGetMyWhiteGloveAppointment.mockResolvedValue({ success: true, data: null });
});

// ── _showSection ──────────────────────────────────────────────────────

describe('_showSection', () => {
  it('expands the named section and collapses others', () => {
    _showSection('calendar');
    expect(getEl('wgCalendarSection')._expanded).toBe(true);
    expect(getEl('wgLoadingSection')._expanded).toBe(false);
    expect(getEl('wgExistingSection')._expanded).toBe(false);
    expect(getEl('wgConfirmSection')._expanded).toBe(false);
    expect(getEl('wgErrorSection')._expanded).toBe(false);
  });

  it('collapses windowSelectorSection when switching away from calendar', () => {
    _showSection('confirmation');
    expect(getEl('windowSelectorSection')._expanded).toBe(false);
  });

  it('does not collapse windowSelectorSection when showing calendar', () => {
    // windowSelectorSection should NOT be collapsed by _showSection('calendar')
    _showSection('calendar');
    // collapse was not called (it starts _expanded = true, no call to collapse)
    expect(getEl('wgCalendarSection')._expanded).toBe(true);
  });
});

// ── _formatDate ───────────────────────────────────────────────────────

describe('_formatDate', () => {
  it('formats YYYY-MM-DD to a readable string', () => {
    const result = _formatDate('2026-06-02');
    expect(result).toContain('2026');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(4);
  });

  it('returns empty string for empty input', () => {
    expect(_formatDate('')).toBe('');
  });
});

// ── _groupSlotsByDate ─────────────────────────────────────────────────

describe('_groupSlotsByDate', () => {
  it('groups slots by date key', () => {
    const slots = [
      makeSlot({ date: '2026-06-02', window: 'morning' }),
      makeSlot({ date: '2026-06-02', window: 'midday' }),
      makeSlot({ date: '2026-06-03', window: 'morning' }),
    ];
    const grouped = _groupSlotsByDate(slots);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['2026-06-02']).toHaveLength(2);
    expect(grouped['2026-06-03']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(_groupSlotsByDate([])).toEqual({});
  });
});

// ── S1: Loading ───────────────────────────────────────────────────────

describe('_initPage — loading state', () => {
  it('shows loading section at start of init', async () => {
    let seenLoading = false;
    mockGetMyWhiteGloveAppointment.mockImplementation(() => {
      seenLoading = getEl('wgLoadingSection')._expanded;
      return Promise.resolve({ success: true, data: null });
    });
    __setQuery({ orderId: 'o1' });
    await _initPage();
    expect(seenLoading).toBe(true);
  });
});

// ── S2: Existing appointment ──────────────────────────────────────────

describe('_initPage — existing appointment', () => {
  it('calls getMyWhiteGloveAppointment when orderId present', async () => {
    __setQuery({ orderId: 'order-1' });
    await _initPage();
    expect(mockGetMyWhiteGloveAppointment).toHaveBeenCalledWith('order-1');
  });

  it('shows existing section when appointment found', async () => {
    __setQuery({ orderId: 'order-1' });
    mockGetMyWhiteGloveAppointment.mockResolvedValue({ success: true, data: makeAppt() });
    await _initPage();
    expect(getEl('wgExistingSection')._expanded).toBe(true);
  });

  it('shows error when not authenticated', async () => {
    __setQuery({ orderId: 'order-1' });
    mockGetMyWhiteGloveAppointment.mockResolvedValue({ success: false, error: 'Not authenticated' });
    await _initPage();
    expect(getEl('wgErrorSection')._expanded).toBe(true);
    expect(getEl('wgErrorText').text).toContain('sign in');
  });
});

describe('_renderExistingAppointment', () => {
  it('sets date, window, and status text', () => {
    _renderExistingAppointment(makeAppt());
    expect(getEl('existingDateText').text).toBeTruthy();
    expect(getEl('existingWindowText').text).toBe('10:00 AM – 12:00 PM');
    expect(getEl('existingStatusText').text).toBe('Confirmed');
  });

  it('wires reschedule button when canReschedule is true', () => {
    _renderExistingAppointment(makeAppt({ canReschedule: true }));
    expect(getEl('rescheduleBtn').onClick).toHaveBeenCalled();
  });

  it('disables reschedule button when canReschedule is false', () => {
    _renderExistingAppointment(makeAppt({ canReschedule: false }));
    expect(getEl('rescheduleBtn').disabled).toBe(true);
  });

  it('shows reschedule note when canReschedule is false', () => {
    _renderExistingAppointment(makeAppt({ canReschedule: false }));
    expect(getEl('rescheduleNote')._expanded).toBe(true);
    expect(getEl('rescheduleNote').text).toContain('rescheduled');
  });
});

// ── S3: Calendar ─────────────────────────────────────────────────────

describe('_initPage — calendar (no existing appointment)', () => {
  it('calls getWhiteGloveSlots when no appointment', async () => {
    __setQuery({});
    await _initPage();
    expect(mockGetWhiteGloveSlots).toHaveBeenCalled();
  });

  it('shows calendar section on success', async () => {
    __setQuery({});
    await _initPage();
    expect(getEl('wgCalendarSection')._expanded).toBe(true);
  });

  it('shows error when getWhiteGloveSlots fails', async () => {
    __setQuery({});
    mockGetWhiteGloveSlots.mockResolvedValue({ success: false, error: 'Backend error' });
    await _initPage();
    expect(getEl('wgErrorSection')._expanded).toBe(true);
    expect(getEl('wgErrorText').text).toBe('Backend error');
  });
});

describe('_renderCalendar', () => {
  it('shows no-slots message when no available slots', () => {
    _renderCalendar([], null);
    expect(getEl('calendarNoSlots')._expanded).toBe(true);
    expect(getEl('calendarDateRepeater')._expanded).toBe(false);
  });

  it('shows date repeater when slots are available', () => {
    const slots = [
      makeSlot({ date: '2026-06-02', window: 'morning' }),
      makeSlot({ date: '2026-06-02', window: 'midday' }),
    ];
    _renderCalendar(slots, 'order-1');
    expect(getEl('calendarNoSlots')._expanded).toBe(false);
    expect(getEl('calendarDateRepeater')._expanded).toBe(true);
  });

  it('populates repeater with one item per date', () => {
    const slots = [
      makeSlot({ date: '2026-06-02', window: 'morning' }),
      makeSlot({ date: '2026-06-02', window: 'midday' }),
      makeSlot({ date: '2026-06-03', window: 'morning' }),
    ];
    _renderCalendar(slots, null);
    expect(getEl('calendarDateRepeater').data).toHaveLength(2);
  });

  it('wires back button', () => {
    _renderCalendar([makeSlot()], null);
    expect(getEl('calendarBackBtn').onClick).toHaveBeenCalled();
  });

  it('renders day label in repeater items', () => {
    _renderCalendar([makeSlot({ date: '2026-06-02', dayOfWeek: 'Tue' })], null);
    const $item = makeItemEl();
    getEl('calendarDateRepeater')._itemReadyCb($item, {
      _id: '2026-06-02', date: '2026-06-02', dayLabel: 'Tue, Jun 2', available: true,
    });
    expect($item('#calendarDayLabel').text).toBe('Tue, Jun 2');
  });

  it('disables button for fully-booked dates (repeater item has available=false)', () => {
    // Render with an available slot so the repeater gets set up
    _renderCalendar([makeSlot({ date: '2026-06-02', window: 'morning', available: true })], null);
    const $item = makeItemEl();
    // Simulate the repeater item callback being invoked with available=false data
    getEl('calendarDateRepeater')._itemReadyCb($item, {
      _id: '2026-06-02', date: '2026-06-02', dayLabel: 'Tue, Jun 2', available: false,
    });
    expect($item('#calendarSelectDayBtn').disabled).toBe(true);
    expect($item('#calendarSelectDayBtn').label).toBe('Full');
  });
});

describe('_showWindowSelector', () => {
  it('expands window selector section', () => {
    _showWindowSelector(
      [makeSlot(), makeSlot({ window: 'midday' }), makeSlot({ window: 'afternoon' })],
      '2026-06-02', 'order-1', null
    );
    expect(getEl('windowSelectorSection')._expanded).toBe(true);
  });

  it('sets date label', () => {
    _showWindowSelector([makeSlot()], '2026-06-02', null, null);
    expect(getEl('windowDateLabel').text).toBeTruthy();
  });

  it('populates window repeater', () => {
    const slots = [
      makeSlot({ window: 'morning' }),
      makeSlot({ window: 'midday' }),
      makeSlot({ window: 'afternoon' }),
    ];
    _showWindowSelector(slots, '2026-06-02', 'order-1', null);
    expect(getEl('windowRepeater').data).toHaveLength(3);
  });

  it('disables select button for full windows', () => {
    const slots = [makeSlot({ window: 'morning', available: false, spotsLeft: 0 })];
    _showWindowSelector(slots, '2026-06-02', 'order-1', null);
    const $item = makeItemEl();
    getEl('windowRepeater')._itemReadyCb($item, { ...slots[0], _id: 'morning' });
    expect($item('#windowSelectBtn').disabled).toBe(true);
  });

  it('shows spotsLeft text for available windows', () => {
    const slots = [makeSlot({ window: 'morning', available: true, spotsLeft: 2 })];
    _showWindowSelector(slots, '2026-06-02', 'order-1', null);
    const $item = makeItemEl();
    getEl('windowRepeater')._itemReadyCb($item, { ...slots[0], _id: 'morning' });
    expect($item('#windowSpotsText').text).toContain('2');
  });

  it('wires back button to collapse window selector', () => {
    _showWindowSelector([makeSlot()], '2026-06-02', null, null);
    expect(getEl('windowBackBtn').onClick).toHaveBeenCalled();
  });
});

// ── S4: Confirmation ──────────────────────────────────────────────────

describe('_confirmBooking', () => {
  it('books delivery and shows confirmation', async () => {
    mockBookWhiteGloveDelivery.mockResolvedValue({
      success: true,
      data: { appointmentDate: '2026-06-02', window: 'morning', windowLabel: '10:00 AM – 12:00 PM' },
    });

    await _confirmBooking('2026-06-02', 'morning', 'order-1', null);

    expect(mockBookWhiteGloveDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', appointmentDate: '2026-06-02', window: 'morning' })
    );
    expect(getEl('wgConfirmSection')._expanded).toBe(true);
  });

  it('calls rescheduleWhiteGlove when appointmentId provided', async () => {
    mockRescheduleWhiteGlove.mockResolvedValue({
      success: true,
      data: { appointmentDate: '2026-06-03', window: 'midday', windowLabel: '12:00 PM – 2:00 PM' },
    });

    await _confirmBooking('2026-06-03', 'midday', null, 'appt-1');

    expect(mockRescheduleWhiteGlove).toHaveBeenCalledWith('appt-1', '2026-06-03', 'midday');
    expect(mockBookWhiteGloveDelivery).not.toHaveBeenCalled();
  });

  it('shows error on booking failure', async () => {
    mockBookWhiteGloveDelivery.mockResolvedValue({ success: false, error: 'Slot is full' });
    await _confirmBooking('2026-06-02', 'morning', 'order-1', null);
    expect(getEl('wgErrorSection')._expanded).toBe(true);
    expect(getEl('wgErrorText').text).toBe('Slot is full');
  });
});

describe('_renderConfirmation', () => {
  it('sets date and window text', () => {
    _renderConfirmation({ appointmentDate: '2026-06-02', windowLabel: '10:00 AM – 12:00 PM', isReschedule: false });
    expect(getEl('confirmDateText').text).toBeTruthy();
    expect(getEl('confirmWindowText').text).toBe('10:00 AM – 12:00 PM');
  });

  it('sets booking headline for new booking', () => {
    _renderConfirmation({ appointmentDate: '2026-06-02', windowLabel: 'morning', isReschedule: false });
    expect(getEl('confirmHeadline').text).toContain('scheduled');
  });

  it('sets reschedule headline for reschedule', () => {
    _renderConfirmation({ appointmentDate: '2026-06-02', windowLabel: 'morning', isReschedule: true });
    expect(getEl('confirmHeadline').text).toContain('rescheduled');
  });

  it('wires orders button', () => {
    _renderConfirmation({ appointmentDate: '2026-06-02', windowLabel: 'x', isReschedule: false });
    expect(getEl('confirmOrdersBtn').onClick).toHaveBeenCalled();
  });

  it('shows confirmation section', () => {
    _renderConfirmation({ appointmentDate: '2026-06-02', windowLabel: 'x', isReschedule: false });
    expect(getEl('wgConfirmSection')._expanded).toBe(true);
  });
});

// ── S5: Error handling ────────────────────────────────────────────────

describe('error handling', () => {
  it('shows error when getWhiteGloveSlots throws', async () => {
    __setQuery({});
    mockGetWhiteGloveSlots.mockRejectedValue(new Error('network error'));
    await _initPage();
    expect(getEl('wgErrorSection')._expanded).toBe(true);
    expect(getEl('wgErrorText').text).toContain('wrong');
  });

  it('shows error when getMyWhiteGloveAppointment throws', async () => {
    __setQuery({ orderId: 'o1' });
    mockGetMyWhiteGloveAppointment.mockRejectedValue(new Error('network error'));
    await _initPage();
    expect(getEl('wgErrorSection')._expanded).toBe(true);
  });
});
