import { describe, it, expect } from 'vitest';
import {
  CONSULTATION_TYPES,
  TIME_SLOTS,
  validateConsultationForm,
  formatSlotDisplay,
  buildBookingConfirmation,
  groupSlotsByDate,
  getConsultationTypeLabel,
  isPhotoUrlValid,
  MAX_PHOTOS,
} from '../../src/public/consultationHelpers.js';

// ── Constants ───────────────────────────────────────────────────────

describe('CONSULTATION_TYPES', () => {
  it('has video and phone types', () => {
    expect(CONSULTATION_TYPES.video).toBeDefined();
    expect(CONSULTATION_TYPES.phone).toBeDefined();
    expect(CONSULTATION_TYPES.video.label).toBeTruthy();
    expect(CONSULTATION_TYPES.phone.label).toBeTruthy();
  });
});

describe('TIME_SLOTS', () => {
  it('has valid time slot entries', () => {
    expect(TIME_SLOTS.length).toBeGreaterThan(0);
    for (const slot of TIME_SLOTS) {
      expect(slot.value).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.label).toBeTruthy();
    }
  });
});

// ── validateConsultationForm ────────────────────────────────────────

describe('validateConsultationForm', () => {
  const validForm = {
    designerId: 'd-1',
    date: '2026-04-01',
    timeSlot: '10:00',
    consultationType: 'video',
  };

  it('passes with valid form data', () => {
    const result = validateConsultationForm(validForm);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('requires designer ID', () => {
    const result = validateConsultationForm({ ...validForm, designerId: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('designer'))).toBe(true);
  });

  it('requires date', () => {
    const result = validateConsultationForm({ ...validForm, date: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('date'))).toBe(true);
  });

  it('validates date format', () => {
    const result = validateConsultationForm({ ...validForm, date: '04/01/2026' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('date'))).toBe(true);
  });

  it('requires time slot', () => {
    const result = validateConsultationForm({ ...validForm, timeSlot: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('time'))).toBe(true);
  });

  it('requires valid consultation type', () => {
    const result = validateConsultationForm({ ...validForm, consultationType: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('type'))).toBe(true);
  });

  it('returns multiple errors for invalid form', () => {
    const result = validateConsultationForm({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('handles null/undefined form', () => {
    const result = validateConsultationForm(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles non-object form', () => {
    const result = validateConsultationForm('string');
    expect(result.valid).toBe(false);
  });
});

// ── formatSlotDisplay ───────────────────────────────────────────────

describe('formatSlotDisplay', () => {
  it('formats date and time for display', () => {
    const display = formatSlotDisplay('2026-04-01', '10:00');
    expect(display).toContain('Apr');
    expect(display).toContain('10:00');
  });

  it('returns empty string for invalid date', () => {
    expect(formatSlotDisplay('', '10:00')).toBe('');
    expect(formatSlotDisplay(null, '10:00')).toBe('');
  });

  it('handles missing time gracefully', () => {
    const display = formatSlotDisplay('2026-04-01', '');
    expect(display).toBe('');
  });
});

// ── buildBookingConfirmation ────────────────────────────────────────

describe('buildBookingConfirmation', () => {
  it('builds confirmation display data', () => {
    const result = buildBookingConfirmation(
      { success: true, bookingId: 'b-1', videoCallUrl: 'https://meet.example.com/abc' },
      { designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', consultationType: 'video', notes: 'Help' }
    );

    expect(result).not.toBeNull();
    expect(result.bookingId).toBe('b-1');
    expect(result.videoCallUrl).toBe('https://meet.example.com/abc');
    expect(result.typeLabel).toBeTruthy();
  });

  it('returns null for failed booking', () => {
    const result = buildBookingConfirmation(
      { success: false, error: 'Slot taken' },
      { designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', consultationType: 'video' }
    );

    expect(result).toBeNull();
  });

  it('handles missing result', () => {
    expect(buildBookingConfirmation(null, {})).toBeNull();
    expect(buildBookingConfirmation(undefined, {})).toBeNull();
  });
});

// ── groupSlotsByDate ────────────────────────────────────────────────

describe('groupSlotsByDate', () => {
  it('groups slots by date', () => {
    const slots = [
      { date: '2026-04-01', timeSlot: '10:00' },
      { date: '2026-04-01', timeSlot: '14:00' },
      { date: '2026-04-02', timeSlot: '10:00' },
    ];

    const grouped = groupSlotsByDate(slots);
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped['2026-04-01']).toHaveLength(2);
    expect(grouped['2026-04-02']).toHaveLength(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupSlotsByDate([])).toEqual({});
  });

  it('handles non-array input', () => {
    expect(groupSlotsByDate(null)).toEqual({});
    expect(groupSlotsByDate(undefined)).toEqual({});
    expect(groupSlotsByDate('string')).toEqual({});
  });
});

// ── getConsultationTypeLabel ────────────────────────────────────────

describe('getConsultationTypeLabel', () => {
  it('returns label for video type', () => {
    const label = getConsultationTypeLabel('video');
    expect(label).toBeTruthy();
    expect(label.toLowerCase()).toContain('video');
  });

  it('returns label for phone type', () => {
    const label = getConsultationTypeLabel('phone');
    expect(label).toBeTruthy();
    expect(label.toLowerCase()).toContain('phone');
  });

  it('returns fallback for unknown type', () => {
    const label = getConsultationTypeLabel('unknown');
    expect(label).toBeTruthy(); // Should return a generic fallback
  });
});

// ── isPhotoUrlValid ─────────────────────────────────────────────────

describe('isPhotoUrlValid', () => {
  it('accepts valid HTTPS URLs', () => {
    expect(isPhotoUrlValid('https://static.wixstatic.com/media/room.jpg')).toBe(true);
    expect(isPhotoUrlValid('https://example.com/photo.png')).toBe(true);
  });

  it('accepts HTTP URLs', () => {
    expect(isPhotoUrlValid('http://example.com/photo.jpg')).toBe(true);
  });

  it('rejects non-URL strings', () => {
    expect(isPhotoUrlValid('not-a-url')).toBe(false);
    expect(isPhotoUrlValid('')).toBe(false);
    expect(isPhotoUrlValid(null)).toBe(false);
    expect(isPhotoUrlValid(undefined)).toBe(false);
  });

  it('rejects javascript: URLs', () => {
    expect(isPhotoUrlValid('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isPhotoUrlValid('data:image/png;base64,abc')).toBe(false);
  });
});

// ── MAX_PHOTOS ──────────────────────────────────────────────────────

describe('MAX_PHOTOS', () => {
  it('is defined as 10', () => {
    expect(MAX_PHOTOS).toBe(10);
  });
});
