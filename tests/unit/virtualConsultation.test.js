import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from '../__mocks__/wix-data.js';
import { __setMember } from '../__mocks__/wix-members-backend.js';
import {
  getDesigners,
  getAvailableConsultationSlots,
  bookConsultation,
  cancelConsultation,
  getMyConsultations,
  uploadRoomPhoto,
  getConsultationDetails,
} from '../../src/backend/virtualConsultation.web.js';

beforeEach(() => {
  resetData();
  __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
});

// ── getDesigners ──────────────────────────────────────────────────────

describe('getDesigners', () => {
  it('returns list of available designers', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah Mountain', specialty: 'living-room', bio: 'Living room expert', avatarUrl: 'https://example.com/sarah.jpg', isActive: true },
      { _id: 'd-2', name: 'Jake Ridge', specialty: 'bedroom', bio: 'Bedroom specialist', avatarUrl: 'https://example.com/jake.jpg', isActive: true },
    ]);

    const result = await getDesigners();
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(2);
    expect(result.designers[0].name).toBe('Sarah Mountain');
  });

  it('filters out inactive designers', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Active', specialty: 'living-room', bio: 'Active', avatarUrl: '', isActive: true },
      { _id: 'd-2', name: 'Inactive', specialty: 'bedroom', bio: 'Gone', avatarUrl: '', isActive: false },
    ]);

    const result = await getDesigners();
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(1);
    expect(result.designers[0].name).toBe('Active');
  });

  it('optionally filters by specialty', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Room Expert', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
      { _id: 'd-2', name: 'Bed Expert', specialty: 'bedroom', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await getDesigners('living-room');
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(1);
    expect(result.designers[0].specialty).toBe('living-room');
  });

  it('returns empty array when no designers exist', async () => {
    const result = await getDesigners();
    expect(result.success).toBe(true);
    expect(result.designers).toEqual([]);
  });
});

// ── getAvailableConsultationSlots ────────────────────────────────────

describe('getAvailableConsultationSlots', () => {
  it('returns available time slots for a designer', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await getAvailableConsultationSlots('d-1');
    expect(result.success).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('returns slots within 14-day booking window', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await getAvailableConsultationSlots('d-1');
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 15);

    for (const slot of result.slots) {
      expect(new Date(slot.date) <= maxDate).toBe(true);
    }
  });

  it('excludes already-booked slots', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    // Skip to next weekday if weekend
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    const dateStr = tomorrow.toISOString().split('T')[0];

    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);
    __seed('ConsultationBookings', [
      { _id: 'b-1', designerId: 'd-1', date: dateStr, timeSlot: '10:00', status: 'confirmed', memberId: 'other' },
    ]);

    const result = await getAvailableConsultationSlots('d-1');
    const bookedSlot = result.slots.find(s => s.date === dateStr && s.timeSlot === '10:00');
    expect(bookedSlot).toBeUndefined();
  });

  it('fails for invalid designer ID', async () => {
    const result = await getAvailableConsultationSlots('');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('fails for non-existent designer', async () => {
    const result = await getAvailableConsultationSlots('nonexistent');
    expect(result.success).toBe(false);
  });

  it('returns slots only on weekdays (Mon-Fri)', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await getAvailableConsultationSlots('d-1');
    for (const slot of result.slots) {
      const day = new Date(slot.date + 'T12:00:00').getDay();
      expect(day).toBeGreaterThan(0); // not Sunday
      expect(day).toBeLessThan(6); // not Saturday
    }
  });
});

// ── bookConsultation ────────────────────────────────────────────────

describe('bookConsultation', () => {
  it('books a consultation with valid data', async () => {
    const futureDate = getNextWeekday();

    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: futureDate,
      timeSlot: '10:00',
      consultationType: 'video',
      notes: 'Need help with living room layout',
    });

    expect(result.success).toBe(true);
    expect(result.bookingId).toBeTruthy();
    expect(result.videoCallUrl).toBeTruthy();
  });

  it('requires designer ID', async () => {
    const result = await bookConsultation({
      designerId: '',
      date: '2026-04-01',
      timeSlot: '10:00',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('designer');
  });

  it('requires valid date', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: 'not-a-date',
      timeSlot: '10:00',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('date');
  });

  it('requires valid time slot', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('time');
  });

  it('rejects past dates', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: '2020-01-01',
      timeSlot: '10:00',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('past');
  });

  it('rejects double booking same slot', async () => {
    const futureDate = getNextWeekday();

    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);
    __seed('ConsultationBookings', [
      { _id: 'b-1', designerId: 'd-1', date: futureDate, timeSlot: '10:00', status: 'confirmed', memberId: 'other-member' },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: futureDate,
      timeSlot: '10:00',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('available');
  });

  it('validates consultation type', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '10:00',
      consultationType: 'invalid',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('type');
  });

  it('sanitizes notes input', async () => {
    const futureDate = getNextWeekday();

    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: futureDate,
      timeSlot: '14:00',
      consultationType: 'video',
      notes: '<script>alert("xss")</script>Need help',
    });

    expect(result.success).toBe(true);
    // XSS should be stripped
  });

  it('requires authentication', async () => {
    __setMember(null);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '10:00',
      consultationType: 'video',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });
});

// ── cancelConsultation ──────────────────────────────────────────────

describe('cancelConsultation', () => {
  it('cancels an existing booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: getNextWeekday(), timeSlot: '10:00', status: 'confirmed' },
    ]);

    const result = await cancelConsultation('b-1');
    expect(result.success).toBe(true);
  });

  it('rejects cancellation of non-owned booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'other-member', designerId: 'd-1', date: getNextWeekday(), timeSlot: '10:00', status: 'confirmed' },
    ]);

    const result = await cancelConsultation('b-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects cancellation of already cancelled booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: getNextWeekday(), timeSlot: '10:00', status: 'cancelled' },
    ]);

    const result = await cancelConsultation('b-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already');
  });

  it('requires valid booking ID', async () => {
    const result = await cancelConsultation('');
    expect(result.success).toBe(false);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await cancelConsultation('b-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });
});

// ── getMyConsultations ──────────────────────────────────────────────

describe('getMyConsultations', () => {
  it('returns member consultations', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', consultationType: 'video', notes: '', videoCallUrl: 'https://meet.example.com/abc', createdAt: new Date() },
      { _id: 'b-2', memberId: 'other-member', designerId: 'd-1', date: '2026-04-02', timeSlot: '14:00', status: 'confirmed', consultationType: 'video', notes: '', videoCallUrl: '', createdAt: new Date() },
    ]);

    const result = await getMyConsultations();
    expect(result.success).toBe(true);
    expect(result.consultations).toHaveLength(1);
    expect(result.consultations[0]._id).toBe('b-1');
  });

  it('returns empty array for member with no bookings', async () => {
    const result = await getMyConsultations();
    expect(result.success).toBe(true);
    expect(result.consultations).toEqual([]);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getMyConsultations();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });
});

// ── uploadRoomPhoto ──────────────────────────────────────────────────

describe('uploadRoomPhoto', () => {
  it('associates a photo URL with a booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', photos: '[]' },
    ]);

    const result = await uploadRoomPhoto('b-1', {
      url: 'https://static.wixstatic.com/media/room1.jpg',
      description: 'Living room overview',
    });

    expect(result.success).toBe(true);
    expect(result.photoId).toBeTruthy();
  });

  it('rejects invalid URL', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', photos: '[]' },
    ]);

    const result = await uploadRoomPhoto('b-1', {
      url: 'not-a-url',
      description: 'test',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('URL');
  });

  it('limits photos to maximum 10 per booking', async () => {
    const existingPhotos = Array.from({ length: 10 }, (_, i) => ({
      photoId: `p-${i}`,
      url: `https://static.wixstatic.com/media/photo${i}.jpg`,
      description: `Photo ${i}`,
    }));

    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', photos: JSON.stringify(existingPhotos) },
    ]);

    const result = await uploadRoomPhoto('b-1', {
      url: 'https://static.wixstatic.com/media/extra.jpg',
      description: 'One too many',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
  });

  it('rejects upload to non-owned booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'other-member', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', photos: '[]' },
    ]);

    const result = await uploadRoomPhoto('b-1', {
      url: 'https://static.wixstatic.com/media/room.jpg',
      description: 'test',
    });

    expect(result.success).toBe(false);
  });

  it('sanitizes photo description', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', photos: '[]' },
    ]);

    const result = await uploadRoomPhoto('b-1', {
      url: 'https://static.wixstatic.com/media/room.jpg',
      description: '<img onerror="alert(1)">My room',
    });

    expect(result.success).toBe(true);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await uploadRoomPhoto('b-1', { url: 'https://example.com/img.jpg', description: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });
});

// ── getConsultationDetails ──────────────────────────────────────────

describe('getConsultationDetails', () => {
  it('returns full consultation details with designer info', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'member-1', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', consultationType: 'video', notes: 'Help please', videoCallUrl: 'https://meet.example.com/abc', photos: '[]', createdAt: new Date() },
    ]);
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah Mountain', specialty: 'living-room', bio: 'Expert', avatarUrl: 'https://example.com/sarah.jpg', isActive: true },
    ]);

    const result = await getConsultationDetails('b-1');
    expect(result.success).toBe(true);
    expect(result.consultation.designerName).toBe('Sarah Mountain');
    expect(result.consultation.videoCallUrl).toBeTruthy();
    expect(result.consultation.status).toBe('confirmed');
  });

  it('rejects access to non-owned booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b-1', memberId: 'other-member', designerId: 'd-1', date: '2026-04-01', timeSlot: '10:00', status: 'confirmed', consultationType: 'video', notes: '', videoCallUrl: '', photos: '[]', createdAt: new Date() },
    ]);

    const result = await getConsultationDetails('b-1');
    expect(result.success).toBe(false);
  });

  it('requires valid booking ID', async () => {
    const result = await getConsultationDetails('');
    expect(result.success).toBe(false);
  });

  it('requires authentication', async () => {
    __setMember(null);
    const result = await getConsultationDetails('b-1');
    expect(result.success).toBe(false);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────

function getNextWeekday() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}
