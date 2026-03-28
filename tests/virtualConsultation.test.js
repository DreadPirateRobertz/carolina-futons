import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __getInserted } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  getDesigners,
  getAvailableConsultationSlots,
  bookConsultation,
  cancelConsultation,
  getMyConsultations,
  uploadRoomPhoto,
  getConsultationDetails,
  submitConsultationIntake,
  getConsultationIntake,
} from '../src/backend/virtualConsultation.web.js';

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

  it('stores pre-consultation quiz answers (CF-va6c)', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '10:00',
      consultationType: 'video',
      quizAnswers: {
        roomType: 'living-room',
        budget: '$500-$1000',
        style: 'modern',
        roomSize: '12x15',
        primaryUse: 'daily sleeper',
      },
    });

    expect(result.success).toBe(true);

    const bookings = __getInserted('ConsultationBookings');
    expect(bookings).toHaveLength(1);
    const quiz = JSON.parse(bookings[0].quizAnswers);
    expect(quiz.roomType).toBe('living-room');
    expect(quiz.budget).toBe('$500-$1000');
    expect(quiz.style).toBe('modern');
  });

  it('queues confirmation email on booking (CF-va6c)', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '14:00',
      consultationType: 'video',
      email: 'customer@example.com',
    });

    const emails = __getInserted('EmailQueue');
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('consultation_confirmation');
    expect(emails[0].recipientEmail).toBe('customer@example.com');

    const vars = JSON.parse(emails[0].variables);
    expect(vars.designerName).toBe('Sarah');
    expect(vars.timeSlot).toBe('14:00');
  });

  it('handles missing quiz answers gracefully (CF-va6c)', async () => {
    __seed('Designers', [
      { _id: 'd-1', name: 'Sarah', specialty: 'living-room', bio: '', avatarUrl: '', isActive: true },
    ]);

    const result = await bookConsultation({
      designerId: 'd-1',
      date: getNextWeekday(),
      timeSlot: '10:00',
      consultationType: 'phone',
    });

    expect(result.success).toBe(true);
    const bookings = __getInserted('ConsultationBookings');
    const quiz = JSON.parse(bookings[0].quizAnswers);
    expect(Object.keys(quiz)).toHaveLength(0);
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

// ── submitConsultationIntake ──────────────────────────────────────────

describe('submitConsultationIntake', () => {
  const VALID_INTAKE = {
    roomType: 'living-room',
    roomSize: 'medium',
    primaryUse: 'daily-sleeping',
    stylePreference: 'modern',
    budget: '500-1000',
    timeline: 'within-month',
    description: 'Looking for a futon that converts easily',
    painPoint: 'space',
  };

  beforeEach(() => {
    __seed('ConsultationBookings', [
      {
        _id: 'booking-1',
        memberId: 'member-1',
        designerId: 'd-1',
        date: '2099-06-01',
        timeSlot: '10:00',
        consultationType: 'video',
        status: 'confirmed',
        notes: '',
        videoCallUrl: '',
        photos: '[]',
        quizAnswers: '{}',
      },
    ]);
  });

  it('saves intake to ConsultationIntake and returns intakeId', async () => {
    const result = await submitConsultationIntake('booking-1', VALID_INTAKE);
    expect(result.success).toBe(true);
    expect(result.intakeId).toBeTruthy();

    const rows = __getInserted('ConsultationIntake');
    expect(rows).toHaveLength(1);
    expect(rows[0].consultationId).toBe('booking-1');
    expect(rows[0].roomType).toBe('living-room');
    expect(rows[0].budget).toBe('500-1000');
  });

  it('saves all 8 intake fields', async () => {
    await submitConsultationIntake('booking-1', VALID_INTAKE);
    const row = __getInserted('ConsultationIntake')[0];
    expect(row.roomType).toBe('living-room');
    expect(row.roomSize).toBe('medium');
    expect(row.primaryUse).toBe('daily-sleeping');
    expect(row.stylePreference).toBe('modern');
    expect(row.budget).toBe('500-1000');
    expect(row.timeline).toBe('within-month');
    expect(row.description).toBe('Looking for a futon that converts easily');
    expect(row.painPoint).toBe('space');
  });

  it('succeeds with optional fields omitted', async () => {
    const { description: _d, painPoint: _p, ...minimal } = VALID_INTAKE;
    const result = await submitConsultationIntake('booking-1', minimal);
    expect(result.success).toBe(true);
    const row = __getInserted('ConsultationIntake')[0];
    expect(row.description).toBe('');
    expect(row.painPoint).toBeNull();
  });

  it('sets memberId from session on saved record', async () => {
    await submitConsultationIntake('booking-1', VALID_INTAKE);
    const row = __getInserted('ConsultationIntake')[0];
    expect(row.memberId).toBe('member-1');
  });

  it('rejects missing consultationId', async () => {
    const result = await submitConsultationIntake(null, VALID_INTAKE);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/consultation id/i);
  });

  it('rejects booking not found', async () => {
    const result = await submitConsultationIntake('nonexistent-booking', VALID_INTAKE);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects booking owned by different member', async () => {
    __seed('ConsultationBookings', [
      { _id: 'booking-other', memberId: 'member-99', designerId: 'd-1', date: '2099-06-01',
        timeSlot: '10:00', consultationType: 'video', status: 'confirmed', notes: '',
        videoCallUrl: '', photos: '[]', quizAnswers: '{}' },
    ]);
    const result = await submitConsultationIntake('booking-other', VALID_INTAKE);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects missing required field roomType', async () => {
    const { roomType: _r, ...data } = VALID_INTAKE;
    const result = await submitConsultationIntake('booking-1', data);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/roomType/i);
  });

  it('rejects invalid roomType enum value', async () => {
    const result = await submitConsultationIntake('booking-1', { ...VALID_INTAKE, roomType: 'castle' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/roomType/i);
  });

  it('rejects invalid budget enum value', async () => {
    const result = await submitConsultationIntake('booking-1', { ...VALID_INTAKE, budget: '$100' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/budget/i);
  });

  it('rejects description over 200 chars', async () => {
    const result = await submitConsultationIntake('booking-1', {
      ...VALID_INTAKE,
      description: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/description/i);
  });

  it('rejects invalid painPoint enum value', async () => {
    const result = await submitConsultationIntake('booking-1', { ...VALID_INTAKE, painPoint: 'unknown' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/painPoint/i);
  });

  it('rejects unauthenticated call', async () => {
    __setMember(null);
    const result = await submitConsultationIntake('booking-1', VALID_INTAKE);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication/i);
  });
});

// ── getConsultationIntake ─────────────────────────────────────────────

describe('getConsultationIntake', () => {
  beforeEach(() => {
    __seed('ConsultationBookings', [
      { _id: 'booking-1', memberId: 'member-1', designerId: 'd-1', date: '2099-06-01',
        timeSlot: '10:00', consultationType: 'video', status: 'confirmed', notes: '',
        videoCallUrl: '', photos: '[]', quizAnswers: '{}' },
    ]);
    __seed('ConsultationIntake', [
      { _id: 'intake-1', consultationId: 'booking-1', memberId: 'member-1',
        roomType: 'bedroom', roomSize: 'small', primaryUse: 'occasional-guest',
        stylePreference: 'rustic', budget: 'under-500', timeline: 'browsing',
        description: 'Guest room refresh', painPoint: 'price', createdAt: new Date() },
    ]);
  });

  it('returns intake data for own booking', async () => {
    const result = await getConsultationIntake('booking-1');
    expect(result.success).toBe(true);
    expect(result.intake.roomType).toBe('bedroom');
    expect(result.intake.budget).toBe('under-500');
    expect(result.intake.description).toBe('Guest room refresh');
  });

  it('returns null intake when none submitted yet', async () => {
    __seed('ConsultationBookings', [
      { _id: 'booking-2', memberId: 'member-1', designerId: 'd-1', date: '2099-06-02',
        timeSlot: '11:00', consultationType: 'phone', status: 'confirmed', notes: '',
        videoCallUrl: '', photos: '[]', quizAnswers: '{}' },
    ]);
    const result = await getConsultationIntake('booking-2');
    expect(result.success).toBe(true);
    expect(result.intake).toBeNull();
  });

  it('rejects missing consultationId', async () => {
    const result = await getConsultationIntake(null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/consultation id/i);
  });

  it('rejects booking owned by different member', async () => {
    __seed('ConsultationBookings', [
      { _id: 'booking-other', memberId: 'member-99', designerId: 'd-1', date: '2099-06-01',
        timeSlot: '10:00', consultationType: 'video', status: 'confirmed', notes: '',
        videoCallUrl: '', photos: '[]', quizAnswers: '{}' },
    ]);
    const result = await getConsultationIntake('booking-other');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects unauthenticated call', async () => {
    __setMember(null);
    const result = await getConsultationIntake('booking-1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/authentication/i);
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
