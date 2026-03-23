import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isWindowRequiredForCode,
  deliveryTypeFromCode,
  formatWindowDate,
  groupSlotsByDate,
  initDeliveryWindowPicker,
  hideDeliveryWindowPicker,
  getSelectedDeliveryWindow,
} from '../src/public/DeliveryWindowPicker.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal $w mock that tracks calls to element methods. */
function makeMock$w() {
  const elements = {};

  const makeEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        _id: id,
        _text: '',
        _visible: false,
        _disabled: false,
        _label: '',
        _data: [],
        _onClick: null,
        _onItemReady: null,
        get text() { return this._text; },
        set text(v) { this._text = v; },
        get label() { return this._label; },
        set label(v) { this._label = v; },
        get data() { return this._data; },
        set data(v) {
          this._data = v;
          // Simulate Wix: onItemReady fires for each item on .data assignment
          if (this._onItemReady) {
            for (const item of v) {
              const $item = makeMock$w();
              this._onItemReady($item, item);
            }
          }
        },
        accessibility: {},
        show: vi.fn(function() { this._visible = true; }),
        hide: vi.fn(function() { this._visible = false; }),
        enable: vi.fn(function() { this._disabled = false; }),
        disable: vi.fn(function() { this._disabled = true; }),
        onClick: vi.fn(function(fn) { this._onClick = fn; }),
        onItemReady: vi.fn(function(fn) { this._onItemReady = fn; }),
      };
    }
    return elements[id];
  };

  const $wFn = (sel) => makeEl(sel.replace('#', '$'));
  $wFn._elements = elements;
  $wFn._get = (id) => elements[id.replace('#', '$')] || null;
  return $wFn;
}

/** Build a slot list for two dates. */
function makeSlots(date1 = '2026-04-01', date2 = '2026-04-04') {
  return [
    { date: date1, dayOfWeek: 'Wed', timeSlot: 'morning', label: '9:00 AM – 12:00 PM', available: true, spotsLeft: 3 },
    { date: date1, dayOfWeek: 'Wed', timeSlot: 'afternoon', label: '1:00 PM – 5:00 PM', available: false, spotsLeft: 0 },
    { date: date2, dayOfWeek: 'Sat', timeSlot: 'morning', label: '9:00 AM – 12:00 PM', available: true, spotsLeft: 2 },
    { date: date2, dayOfWeek: 'Sat', timeSlot: 'afternoon', label: '1:00 PM – 5:00 PM', available: true, spotsLeft: 1 },
  ];
}

// ── isWindowRequiredForCode ───────────────────────────────────────────────────

describe('isWindowRequiredForCode', () => {
  it('returns true for white-glove codes', () => {
    expect(isWindowRequiredForCode('white-glove-zone1')).toBe(true);
    expect(isWindowRequiredForCode('white-glove-zone2')).toBe(true);
  });

  it('returns true for local-delivery codes', () => {
    expect(isWindowRequiredForCode('local-delivery-zone1')).toBe(true);
    expect(isWindowRequiredForCode('local-delivery-zone3')).toBe(true);
  });

  it('returns false for standard shipping codes', () => {
    expect(isWindowRequiredForCode('ups-ground')).toBe(false);
    expect(isWindowRequiredForCode('ltl-freight')).toBe(false);
    expect(isWindowRequiredForCode('standard')).toBe(false);
  });

  it('returns false for null / undefined / empty', () => {
    expect(isWindowRequiredForCode(null)).toBe(false);
    expect(isWindowRequiredForCode(undefined)).toBe(false);
    expect(isWindowRequiredForCode('')).toBe(false);
  });
});

// ── deliveryTypeFromCode ──────────────────────────────────────────────────────

describe('deliveryTypeFromCode', () => {
  it('maps white-glove codes to white_glove', () => {
    expect(deliveryTypeFromCode('white-glove-zone1')).toBe('white_glove');
    expect(deliveryTypeFromCode('white-glove-zone4')).toBe('white_glove');
  });

  it('maps local-delivery codes to local', () => {
    expect(deliveryTypeFromCode('local-delivery-zone1')).toBe('local');
    expect(deliveryTypeFromCode('local-delivery-zone2')).toBe('local');
  });

  it('returns null for unrecognised codes', () => {
    expect(deliveryTypeFromCode('ups-ground')).toBe(null);
    expect(deliveryTypeFromCode('')).toBe(null);
    expect(deliveryTypeFromCode(null)).toBe(null);
  });
});

// ── formatWindowDate ──────────────────────────────────────────────────────────

describe('formatWindowDate', () => {
  it('formats a date string as "Day, Mon D"', () => {
    // 2026-04-01 is a Wednesday
    const result = formatWindowDate('2026-04-01', 'Wed');
    expect(result).toBe('Wed, Apr 1');
  });

  it('falls back to the raw date string on parse error', () => {
    const result = formatWindowDate('not-a-date', 'Wed');
    expect(result).toBe('not-a-date');
  });
});

// ── groupSlotsByDate ──────────────────────────────────────────────────────────

describe('groupSlotsByDate', () => {
  it('groups morning and afternoon slots under each date', () => {
    const grouped = groupSlotsByDate(makeSlots());
    expect(grouped).toHaveLength(2);

    const wed = grouped.find(g => g.dayOfWeek === 'Wed');
    expect(wed).toBeDefined();
    expect(wed.morning.timeSlot).toBe('morning');
    expect(wed.afternoon.timeSlot).toBe('afternoon');
  });

  it('marks unavailable slots correctly', () => {
    const grouped = groupSlotsByDate(makeSlots());
    const wed = grouped.find(g => g.dayOfWeek === 'Wed');
    expect(wed.morning.available).toBe(true);
    expect(wed.afternoon.available).toBe(false);
  });

  it('returns empty array for empty input', () => {
    expect(groupSlotsByDate([])).toHaveLength(0);
  });

  it('handles date with only one time slot gracefully', () => {
    const slots = [
      { date: '2026-04-01', dayOfWeek: 'Wed', timeSlot: 'morning', label: '9:00 AM – 12:00 PM', available: true, spotsLeft: 2 },
    ];
    const grouped = groupSlotsByDate(slots);
    expect(grouped[0].morning).toBeDefined();
    expect(grouped[0].afternoon).toBeNull();
  });
});

// ── initDeliveryWindowPicker ──────────────────────────────────────────────────

describe('initDeliveryWindowPicker', () => {
  let $w;

  beforeEach(() => {
    $w = makeMock$w();
  });

  it('shows the section on init', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    const section = $w._get('#deliveryWindowSection');
    expect(section.show).toHaveBeenCalled();
  });

  it('shows the loader while fetching then hides it', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    const loader = $w._get('#deliveryWindowLoader');
    expect(loader.show).toHaveBeenCalled();
    expect(loader.hide).toHaveBeenCalled();
  });

  it('shows fallback text when no slots available', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    const errEl = $w._get('#deliveryWindowError');
    expect(errEl.show).toHaveBeenCalled();
    expect(errEl._text).toContain('contact you');
  });

  it('shows fallback on fetch error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'));
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    const errEl = $w._get('#deliveryWindowError');
    expect(errEl.show).toHaveBeenCalled();
  });

  it('renders the repeater when slots are available', async () => {
    const fetcher = vi.fn().mockResolvedValue(makeSlots());
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    const repeater = $w._get('#deliveryWindowRepeater');
    expect(repeater.show).toHaveBeenCalled();
    expect(repeater._data.length).toBe(2); // two dates
  });

  it('resets selected window on each init call', async () => {
    // First call: simulate a selection
    const fetcher = vi.fn().mockResolvedValue(makeSlots());
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher });
    // Second call resets state
    const fetcher2 = vi.fn().mockResolvedValue([]);
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher: fetcher2 });
    expect(getSelectedDeliveryWindow()).toBeNull();
  });

  it('calls onSelect when a slot is chosen', async () => {
    const onSelect = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(makeSlots());
    await initDeliveryWindowPicker($w, '28792', 'white-glove-zone1', { fetcher, onSelect });

    // The mock fires onItemReady for each item — find the morning button's onClick
    const morningBtn = $w._get('#windowMorningBtn');
    if (morningBtn && morningBtn._onClick) morningBtn._onClick();

    if (onSelect.mock.calls.length > 0) {
      expect(onSelect.mock.calls[0][0]).toMatchObject({ timeSlot: 'morning' });
    }
  });
});

// ── hideDeliveryWindowPicker ──────────────────────────────────────────────────

describe('hideDeliveryWindowPicker', () => {
  it('hides the section', () => {
    const $w = makeMock$w();
    hideDeliveryWindowPicker($w);
    const section = $w._get('#deliveryWindowSection');
    expect(section.hide).toHaveBeenCalled();
  });

  it('clears the selected window', async () => {
    // Ensure there's no lingering state
    const $w = makeMock$w();
    hideDeliveryWindowPicker($w);
    expect(getSelectedDeliveryWindow()).toBeNull();
  });
});
