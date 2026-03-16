import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

const mockSlots = [
  { date: '2026-03-04', dayOfWeek: 'Wed', timeWindow: 'morning', timeLabel: '9:00 AM - 12:00 PM', spotsLeft: 3, type: 'white_glove' },
  { date: '2026-03-04', dayOfWeek: 'Wed', timeWindow: 'afternoon', timeLabel: '1:00 PM - 5:00 PM', spotsLeft: 2, type: 'white_glove' },
  { date: '2026-03-05', dayOfWeek: 'Thu', timeWindow: 'morning', timeLabel: '9:00 AM - 12:00 PM', spotsLeft: 4, type: 'white_glove' },
];

const mockScheduleResult = { success: true, scheduleId: 'sched-001' };

vi.mock('backend/deliveryScheduling.web', () => ({
  getAvailableDeliverySlots: vi.fn(async () => mockSlots),
  scheduleDelivery: vi.fn(async () => mockScheduleResult),
}));

vi.mock('backend/ups-shipping.web', () => ({
  validateAddress: vi.fn(async () => ({ valid: true, candidates: [] })),
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => fn,
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sunsetCoral: '#E8845C',
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    sandBase: '#E8D5B7',
    sandLight: '#F2E8D5',
    offWhite: '#FAF7F2',
    success: '#4A7C59',
    error: '#C0392B',
    muted: '#767676',
    white: '#FFFFFF',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  transitions: { fast: 150, medium: 250 },
  borderRadius: { sm: 4, md: 8, lg: 12 },
  shadows: { card: { x: 0, y: 2, blur: 12, color: 'rgba(58,37,24,0.08)' } },
  fontFamilies: { heading: '"Playfair Display", serif', body: '"Source Sans 3", sans-serif' },
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/mobileHelpers.js', () => ({
  isMobile: vi.fn(() => false),
}));

import {
  groupSlotsByDate,
  formatSlotDate,
  validateSchedulingForm,
  buildConfirmationData,
  getDeliveryTypeLabel,
  getDeliveryTypeDescription,
  validateAddressForShipping,
  isOversizedItem,
  getFreightMessage,
  DELIVERY_TYPES,
} from '../src/public/schedulerHelpers.js';

// ── groupSlotsByDate ──────────────────────────────────────────────────

describe('groupSlotsByDate', () => {
  it('groups slots by date', () => {
    const grouped = groupSlotsByDate(mockSlots);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['2026-03-04']).toHaveLength(2);
    expect(grouped['2026-03-05']).toHaveLength(1);
  });

  it('returns empty object for empty input', () => {
    expect(groupSlotsByDate([])).toEqual({});
    expect(groupSlotsByDate(null)).toEqual({});
    expect(groupSlotsByDate(undefined)).toEqual({});
  });

  it('preserves slot data in groups', () => {
    const grouped = groupSlotsByDate(mockSlots);
    const firstSlot = grouped['2026-03-04'][0];
    expect(firstSlot.timeWindow).toBe('morning');
    expect(firstSlot.spotsLeft).toBe(3);
  });
});

// ── formatSlotDate ────────────────────────────────────────────────────

describe('formatSlotDate', () => {
  it('formats YYYY-MM-DD to human-readable', () => {
    const result = formatSlotDate('2026-03-04', 'Wed');
    expect(result).toContain('Wed');
    expect(result).toContain('Mar');
    expect(result).toContain('4');
  });

  it('handles missing dayOfWeek gracefully', () => {
    const result = formatSlotDate('2026-03-04');
    expect(result).toContain('Mar');
    expect(result).toContain('4');
  });

  it('returns empty string for invalid date', () => {
    expect(formatSlotDate('')).toBe('');
    expect(formatSlotDate(null)).toBe('');
    expect(formatSlotDate(undefined)).toBe('');
  });
});

// ── validateSchedulingForm ────────────────────────────────────────────

describe('validateSchedulingForm', () => {
  const validForm = {
    orderId: 'order-001',
    date: '2026-03-04',
    timeWindow: 'morning',
    type: 'white_glove',
    customerEmail: 'jane@example.com',
    customerPhone: '828-555-1234',
    address: '123 Main St, Hendersonville, NC 28792',
  };

  it('passes for valid form data', () => {
    const result = validateSchedulingForm(validForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing orderId', () => {
    const result = validateSchedulingForm({ ...validForm, orderId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Order ID is required');
  });

  it('rejects missing date', () => {
    const result = validateSchedulingForm({ ...validForm, date: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Delivery date is required');
  });

  it('rejects missing time window', () => {
    const result = validateSchedulingForm({ ...validForm, timeWindow: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Time window is required');
  });

  it('rejects invalid time window value', () => {
    const result = validateSchedulingForm({ ...validForm, timeWindow: 'evening' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Time window must be morning or afternoon');
  });

  it('rejects invalid email', () => {
    const result = validateSchedulingForm({ ...validForm, customerEmail: 'not-an-email' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Valid email address is required');
  });

  it('rejects missing address for white_glove', () => {
    const result = validateSchedulingForm({ ...validForm, address: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Delivery address is required');
  });

  it('allows missing address for standard delivery', () => {
    const result = validateSchedulingForm({ ...validForm, type: 'standard', address: '' });
    expect(result.valid).toBe(true);
  });

  it('rejects null/undefined input', () => {
    expect(validateSchedulingForm(null).valid).toBe(false);
    expect(validateSchedulingForm(undefined).valid).toBe(false);
  });

  it('collects multiple errors', () => {
    const result = validateSchedulingForm({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('rejects invalid date format', () => {
    const result = validateSchedulingForm({ ...validForm, date: '03/04/2026' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Date must be in YYYY-MM-DD format');
  });
});

// ── buildConfirmationData ─────────────────────────────────────────────

describe('buildConfirmationData', () => {
  it('builds confirmation from schedule result and form data', () => {
    const form = {
      date: '2026-03-04',
      timeWindow: 'morning',
      type: 'white_glove',
      customerEmail: 'jane@example.com',
      address: '123 Main St',
    };
    const result = buildConfirmationData({ success: true, scheduleId: 'sched-001' }, form);
    expect(result.scheduleId).toBe('sched-001');
    expect(result.date).toBe('2026-03-04');
    expect(result.timeLabel).toBe('9:00 AM - 12:00 PM');
    expect(result.typeLabel).toContain('White Glove');
    expect(result.email).toBe('jane@example.com');
  });

  it('maps afternoon window correctly', () => {
    const form = { date: '2026-03-04', timeWindow: 'afternoon', type: 'standard' };
    const result = buildConfirmationData({ success: true, scheduleId: 'x' }, form);
    expect(result.timeLabel).toBe('1:00 PM - 5:00 PM');
  });

  it('returns null for failed result', () => {
    const result = buildConfirmationData({ success: false }, {});
    expect(result).toBeNull();
  });
});

// ── getDeliveryTypeLabel / getDeliveryTypeDescription ─────────────────

describe('getDeliveryTypeLabel', () => {
  it('returns label for white_glove', () => {
    expect(getDeliveryTypeLabel('white_glove')).toBe('White Glove Delivery');
  });

  it('returns label for standard', () => {
    expect(getDeliveryTypeLabel('standard')).toBe('Standard Delivery');
  });

  it('returns fallback for unknown type', () => {
    expect(getDeliveryTypeLabel('unknown')).toBe('Delivery');
  });
});

describe('getDeliveryTypeDescription', () => {
  it('returns description for white_glove', () => {
    const desc = getDeliveryTypeDescription('white_glove');
    expect(desc.toLowerCase()).toContain('in-home');
  });

  it('returns description for standard', () => {
    const desc = getDeliveryTypeDescription('standard');
    expect(desc.toLowerCase()).toContain('curbside');
  });
});

// ── DELIVERY_TYPES constant ──────────────────────────────────────────

describe('DELIVERY_TYPES', () => {
  it('exports white_glove and standard', () => {
    expect(DELIVERY_TYPES.white_glove).toBeDefined();
    expect(DELIVERY_TYPES.standard).toBeDefined();
  });

  it('each type has label and description', () => {
    for (const type of Object.values(DELIVERY_TYPES)) {
      expect(type.label).toBeTruthy();
      expect(type.description).toBeTruthy();
    }
  });
});

// ── validateAddressForShipping ──────────────────────────────────────

describe('validateAddressForShipping', () => {
  beforeEach(async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    validateAddress.mockReset();
    validateAddress.mockResolvedValue({ valid: true, candidates: [] });
  });

  it('returns valid for a correct address', async () => {
    const result = await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(result.valid).toBe(true);
  });

  it('calls UPS validateAddress with address fields', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    await validateAddressForShipping({
      addressLine1: '824 Locust St',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '28792',
      country: 'US',
    });
    expect(validateAddress).toHaveBeenCalledWith({
      addressLine1: '824 Locust St',
      city: 'Hendersonville',
      state: 'NC',
      postalCode: '28792',
      country: 'US',
    });
  });

  it('defaults country to US when not provided', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(validateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'US' })
    );
  });

  it('rejects null input', async () => {
    const result = await validateAddressForShipping(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('address is required');
  });

  it('rejects non-object input', async () => {
    const result = await validateAddressForShipping('123 Main St');
    expect(result.valid).toBe(false);
  });

  it('rejects missing addressLine1', async () => {
    const result = await validateAddressForShipping({ postalCode: '28792' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Street address');
  });

  it('rejects empty addressLine1', async () => {
    const result = await validateAddressForShipping({ addressLine1: '  ', postalCode: '28792' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Street address');
  });

  it('rejects missing postalCode', async () => {
    const result = await validateAddressForShipping({ addressLine1: '824 Locust St' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Zip');
  });

  it('rejects empty postalCode', async () => {
    const result = await validateAddressForShipping({ addressLine1: '824 Locust St', postalCode: '  ' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Zip');
  });

  it('returns candidates when address is ambiguous', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    validateAddress.mockResolvedValueOnce({
      valid: false,
      ambiguous: true,
      candidates: [
        { addressLine1: '824 Locust St Ste 200', postalCode: '28792' },
        { addressLine1: '824 Locust St Ste 100', postalCode: '28792' },
      ],
    });
    const result = await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(result.valid).toBe(false);
    expect(result.candidates).toHaveLength(2);
  });

  it('returns generic error when UPS says invalid (no candidates)', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    validateAddress.mockResolvedValueOnce({ valid: false });
    const result = await validateAddressForShipping({
      addressLine1: '999 Nonexistent Rd',
      postalCode: '00000',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('could not be verified');
  });

  it('fails open when UPS service is unavailable', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    validateAddress.mockResolvedValueOnce({ unavailable: true });
    const result = await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(result.valid).toBe(true);
    expect(result.serviceUnavailable).toBe(true);
  });

  it('fails open on network error (exception)', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    validateAddress.mockRejectedValueOnce(new Error('Network timeout'));
    const result = await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(result.valid).toBe(true);
    expect(result.serviceUnavailable).toBe(true);
  });

  it('defaults city and state to empty string when not provided', async () => {
    const { validateAddress } = await import('backend/ups-shipping.web');
    await validateAddressForShipping({
      addressLine1: '824 Locust St',
      postalCode: '28792',
    });
    expect(validateAddress).toHaveBeenCalledWith(
      expect.objectContaining({ city: '', state: '' })
    );
  });
});

// ── isOversizedItem ──────────────────────────────────────────────────

describe('isOversizedItem', () => {
  it('returns false for null/undefined', () => {
    expect(isOversizedItem(null)).toBe(false);
    expect(isOversizedItem(undefined)).toBe(false);
  });

  it('returns false for normal weight item', () => {
    expect(isOversizedItem({ name: 'Futon Frame', weight: 80 })).toBe(false);
  });

  it('returns true for item at weight threshold (150 lbs)', () => {
    expect(isOversizedItem({ name: 'Futon Frame', weight: 150 })).toBe(true);
  });

  it('returns true for item over weight threshold', () => {
    expect(isOversizedItem({ name: 'Sofa Bed', weight: 200 })).toBe(true);
  });

  it('returns true for Murphy bed by name (keyword match)', () => {
    expect(isOversizedItem({ name: 'Murphy Wall Bed - Queen', weight: 50 })).toBe(true);
  });

  it('returns true for cabinet bed by name (keyword match)', () => {
    expect(isOversizedItem({ name: 'Cabinet Bed - Full', weight: 50 })).toBe(true);
  });

  it('keyword match is case-insensitive', () => {
    expect(isOversizedItem({ name: 'MURPHY BED QUEEN', weight: 10 })).toBe(true);
    expect(isOversizedItem({ name: 'Cabinet BED', weight: 10 })).toBe(true);
  });

  it('returns false when weight is zero or missing', () => {
    expect(isOversizedItem({ name: 'Futon Cover' })).toBe(false);
    expect(isOversizedItem({ name: 'Futon Cover', weight: 0 })).toBe(false);
  });

  it('handles non-numeric weight gracefully', () => {
    expect(isOversizedItem({ name: 'Futon Cover', weight: 'heavy' })).toBe(false);
  });
});

// ── getFreightMessage ─────────────────────────────────────────────────

describe('getFreightMessage', () => {
  it('returns freight message when hasOversized is true', () => {
    const msg = getFreightMessage(true);
    expect(msg).toContain('oversized');
    expect(msg).toContain('freight');
    expect(msg).toContain('White Glove');
  });

  it('returns empty string when hasOversized is false', () => {
    expect(getFreightMessage(false)).toBe('');
  });

  it('returns empty string for falsy values', () => {
    expect(getFreightMessage(null)).toBe('');
    expect(getFreightMessage(undefined)).toBe('');
    expect(getFreightMessage(0)).toBe('');
  });
});
