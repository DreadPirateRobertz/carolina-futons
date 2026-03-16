import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (!id || typeof id !== 'string') return null;
    const clean = id.replace(/<[^>]*>/g, '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return clean || null;
  },
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ne: (field, val) => { filters[field] = { type: 'ne', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    le: (field, val) => { filters[field] = { type: 'le', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ne') items = items.filter(i => i[field] !== f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
        if (f.type === 'le') items = items.filter(i => i[field] <= f.value);
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      return item;
    },
    remove: async (collection, id) => {
      _collections[collection] = (_collections[collection] || []).filter(i => i._id !== id);
    },
  },
}));

let _mockMember = { _id: 'member-abc' };
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: async () => _mockMember,
  },
}));

beforeEach(() => {
  _collections = {};
  _mockMember = { _id: 'member-abc' };
});

const mod = await import('../src/backend/virtualConsultation.web.js');
const {
  getDesigners,
  getAvailableConsultationSlots,
  bookConsultation,
  cancelConsultation,
  getMyConsultations,
  uploadRoomPhoto,
  getConsultationDetails,
} = mod;

// Helper: a future weekday date string (YYYY-MM-DD)
function futureWeekday(daysAhead = 3) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // Ensure it's a weekday
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ═════════════════════════════════════════════════════════════════════
// getDesigners
// ═════════════════════════════════════════════════════════════════════
describe('getDesigners', () => {
  it('returns all active designers when no specialty given', async () => {
    __seed('Designers', [
      { _id: 'd1', name: 'Alice', specialty: 'bedroom', bio: 'bio', avatarUrl: 'url', isActive: true },
      { _id: 'd2', name: 'Bob', specialty: 'office', bio: 'bio2', avatarUrl: 'url2', isActive: true },
    ]);
    const result = await getDesigners();
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(2);
  });

  it('filters by specialty when provided', async () => {
    __seed('Designers', [
      { _id: 'd1', name: 'Alice', specialty: 'bedroom', isActive: true },
      { _id: 'd2', name: 'Bob', specialty: 'office', isActive: true },
    ]);
    const result = await getDesigners('bedroom');
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(1);
    expect(result.designers[0].name).toBe('Alice');
  });

  it('excludes inactive designers', async () => {
    __seed('Designers', [
      { _id: 'd1', name: 'Inactive', specialty: 'bedroom', isActive: false },
    ]);
    const result = await getDesigners();
    expect(result.designers).toHaveLength(0);
  });

  it('maps only safe fields in response', async () => {
    __seed('Designers', [
      { _id: 'd1', name: 'Alice', specialty: 'bedroom', bio: 'mybio', avatarUrl: 'myurl', isActive: true, secret: 'hidden' },
    ]);
    const result = await getDesigners();
    const d = result.designers[0];
    expect(d).toHaveProperty('_id');
    expect(d).toHaveProperty('name');
    expect(d).toHaveProperty('specialty');
    expect(d).toHaveProperty('bio');
    expect(d).toHaveProperty('avatarUrl');
    expect(d).not.toHaveProperty('secret');
    expect(d).not.toHaveProperty('isActive');
  });

  it('returns empty array when no designers match', async () => {
    __seed('Designers', []);
    const result = await getDesigners('living-room');
    expect(result.success).toBe(true);
    expect(result.designers).toHaveLength(0);
  });

  it('ignores empty string specialty (no filter applied)', async () => {
    __seed('Designers', [
      { _id: 'd1', name: 'Alice', specialty: 'bedroom', isActive: true },
    ]);
    // sanitize('') returns '' which is falsy, so no filter
    const result = await getDesigners('');
    expect(result.designers).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getAvailableConsultationSlots
// ═════════════════════════════════════════════════════════════════════
describe('getAvailableConsultationSlots', () => {
  it('returns available slots for an active designer', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const result = await getAvailableConsultationSlots('d1');
    expect(result.success).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('rejects invalid designer ID', async () => {
    const result = await getAvailableConsultationSlots('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('designer ID');
    expect(result.slots).toEqual([]);
  });

  it('rejects null designer ID', async () => {
    const result = await getAvailableConsultationSlots(null);
    expect(result.success).toBe(false);
    expect(result.slots).toEqual([]);
  });

  it('rejects inactive designer', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: false }]);
    const result = await getAvailableConsultationSlots('d1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects non-existent designer', async () => {
    __seed('Designers', []);
    const result = await getAvailableConsultationSlots('d999');
    expect(result.success).toBe(false);
  });

  it('excludes already-booked slots', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    const dateStr = futureWeekday(3);
    __seed('ConsultationBookings', [
      { _id: 'b1', designerId: 'd1', date: dateStr, timeSlot: '09:00', status: 'confirmed' },
    ]);
    const result = await getAvailableConsultationSlots('d1');
    const slotsOnDate = result.slots.filter(s => s.date === dateStr);
    expect(slotsOnDate.find(s => s.timeSlot === '09:00')).toBeUndefined();
  });

  it('includes cancelled bookings as available', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    const dateStr = futureWeekday(3);
    __seed('ConsultationBookings', [
      { _id: 'b1', designerId: 'd1', date: dateStr, timeSlot: '09:00', status: 'cancelled' },
    ]);
    const result = await getAvailableConsultationSlots('d1');
    const slotsOnDate = result.slots.filter(s => s.date === dateStr);
    expect(slotsOnDate.find(s => s.timeSlot === '09:00')).toBeTruthy();
  });

  it('only returns weekday slots', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const result = await getAvailableConsultationSlots('d1');
    for (const slot of result.slots) {
      const d = new Date(slot.date + 'T12:00:00');
      const day = d.getDay();
      expect(day).toBeGreaterThan(0);
      expect(day).toBeLessThan(6);
    }
  });

  it('only returns valid time slots', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const validTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
    const result = await getAvailableConsultationSlots('d1');
    for (const slot of result.slots) {
      expect(validTimes).toContain(slot.timeSlot);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════
// bookConsultation
// ═════════════════════════════════════════════════════════════════════
describe('bookConsultation', () => {
  const validBooking = () => ({
    designerId: 'd1',
    date: futureWeekday(3),
    timeSlot: '10:00',
    consultationType: 'video',
    notes: 'Need help with living room',
  });

  it('books a video consultation successfully', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const result = await bookConsultation(validBooking());
    expect(result.success).toBe(true);
    expect(result.bookingId).toBeTruthy();
    expect(result.videoCallUrl).toMatch(/^https:\/\/meet\.carolinafutons\.com\/consultation\//);
  });

  it('books a phone consultation without videoCallUrl', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const data = { ...validBooking(), consultationType: 'phone' };
    const result = await bookConsultation(data);
    expect(result.success).toBe(true);
    expect(result.videoCallUrl).toBe('');
  });

  it('rejects invalid designer ID', async () => {
    const result = await bookConsultation({ ...validBooking(), designerId: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('designer ID');
  });

  it('rejects missing date', async () => {
    const result = await bookConsultation({ ...validBooking(), date: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('date');
  });

  it('rejects badly formatted date', async () => {
    const result = await bookConsultation({ ...validBooking(), date: '12/25/2026' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('rejects past dates', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    const result = await bookConsultation({ ...validBooking(), date: '2020-01-01' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('past');
  });

  it('rejects invalid time slot', async () => {
    const result = await bookConsultation({ ...validBooking(), timeSlot: '12:00' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('time slot');
  });

  it('rejects invalid consultation type', async () => {
    const result = await bookConsultation({ ...validBooking(), consultationType: 'in-person' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('video or phone');
  });

  it('rejects inactive designer', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: false }]);
    __seed('ConsultationBookings', []);
    const result = await bookConsultation(validBooking());
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects double booking', async () => {
    const data = validBooking();
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', [
      { _id: 'b1', designerId: 'd1', date: data.date, timeSlot: '10:00', status: 'confirmed' },
    ]);
    const result = await bookConsultation(data);
    expect(result.success).toBe(false);
    expect(result.error).toContain('no longer available');
  });

  it('allows booking a cancelled slot', async () => {
    const data = validBooking();
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', [
      { _id: 'b1', designerId: 'd1', date: data.date, timeSlot: '10:00', status: 'cancelled' },
    ]);
    const result = await bookConsultation(data);
    expect(result.success).toBe(true);
  });

  it('stores correct record fields', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    await bookConsultation(validBooking());
    const record = _collections.ConsultationBookings[0];
    expect(record.memberId).toBe('member-abc');
    expect(record.status).toBe('confirmed');
    expect(record.photos).toBe('[]');
    expect(record.createdAt).toBeInstanceOf(Date);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await bookConsultation(validBooking());
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('sanitizes notes', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    await bookConsultation({ ...validBooking(), notes: '<script>alert("xss")</script>Hello' });
    const record = _collections.ConsultationBookings[0];
    expect(record.notes).not.toContain('<script>');
    expect(record.notes).toContain('Hello');
  });

  it('handles missing notes gracefully', async () => {
    __seed('Designers', [{ _id: 'd1', isActive: true }]);
    __seed('ConsultationBookings', []);
    const data = validBooking();
    delete data.notes;
    const result = await bookConsultation(data);
    expect(result.success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// cancelConsultation
// ═════════════════════════════════════════════════════════════════════
describe('cancelConsultation', () => {
  it('cancels a confirmed booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', status: 'confirmed' },
    ]);
    const result = await cancelConsultation('b1');
    expect(result.success).toBe(true);
    expect(_collections.ConsultationBookings[0].status).toBe('cancelled');
  });

  it('rejects invalid booking ID', async () => {
    const result = await cancelConsultation('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('booking ID');
  });

  it('rejects null booking ID', async () => {
    const result = await cancelConsultation(null);
    expect(result.success).toBe(false);
  });

  it('rejects booking not owned by member', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'other-member', status: 'confirmed' },
    ]);
    const result = await cancelConsultation('b1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects already cancelled booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', status: 'cancelled' },
    ]);
    const result = await cancelConsultation('b1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already cancelled');
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await cancelConsultation('b1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('rejects non-existent booking', async () => {
    __seed('ConsultationBookings', []);
    const result = await cancelConsultation('nonexistent');
    expect(result.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMyConsultations
// ═════════════════════════════════════════════════════════════════════
describe('getMyConsultations', () => {
  it('returns member consultations', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', status: 'confirmed' },
      { _id: 'b2', memberId: 'member-abc', status: 'cancelled' },
    ]);
    const result = await getMyConsultations();
    expect(result.success).toBe(true);
    expect(result.consultations).toHaveLength(2);
  });

  it('only returns own consultations', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', status: 'confirmed' },
      { _id: 'b2', memberId: 'other-member', status: 'confirmed' },
    ]);
    const result = await getMyConsultations();
    expect(result.consultations).toHaveLength(1);
    expect(result.consultations[0]._id).toBe('b1');
  });

  it('returns empty array when no bookings', async () => {
    __seed('ConsultationBookings', []);
    const result = await getMyConsultations();
    expect(result.success).toBe(true);
    expect(result.consultations).toHaveLength(0);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getMyConsultations();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
    expect(result.consultations).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// uploadRoomPhoto
// ═════════════════════════════════════════════════════════════════════
describe('uploadRoomPhoto', () => {
  it('uploads a photo to a booking', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '[]' },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg', description: 'Living room' });
    expect(result.success).toBe(true);
    expect(result.photoId).toMatch(/^ph-/);
  });

  it('rejects invalid booking ID', async () => {
    const result = await uploadRoomPhoto('', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('booking ID');
  });

  it('rejects booking not owned by member', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'other-member', photos: '[]' },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects invalid URL', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '[]' },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('photo URL');
  });

  it('rejects empty URL', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '[]' },
    ]);
    const result = await uploadRoomPhoto('b1', { url: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('photo URL');
  });

  it('rejects when max photos reached', async () => {
    const existingPhotos = Array.from({ length: 10 }, (_, i) => ({ photoId: `ph-${i}`, url: `https://x.com/${i}.jpg` }));
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: JSON.stringify(existingPhotos) },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum');
    expect(result.error).toContain('10');
  });

  it('appends photo to existing photos', async () => {
    const existing = [{ photoId: 'ph-1', url: 'https://x.com/1.jpg', description: 'first' }];
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: JSON.stringify(existing) },
    ]);
    await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg', description: 'second' });
    const updated = JSON.parse(_collections.ConsultationBookings[0].photos);
    expect(updated).toHaveLength(2);
    expect(updated[1].description).toBe('second');
  });

  it('handles null photos field gracefully', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: null },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(true);
  });

  it('handles malformed JSON in photos field', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '{broken' },
    ]);
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(true);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('sanitizes photo description', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '[]' },
    ]);
    await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg', description: '<b>bold</b> text' });
    const photos = JSON.parse(_collections.ConsultationBookings[0].photos);
    expect(photos[0].description).not.toContain('<b>');
    expect(photos[0].description).toContain('bold');
  });

  it('handles missing description', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', photos: '[]' },
    ]);
    await uploadRoomPhoto('b1', { url: 'https://example.com/room.jpg' });
    const photos = JSON.parse(_collections.ConsultationBookings[0].photos);
    expect(photos[0].description).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getConsultationDetails
// ═════════════════════════════════════════════════════════════════════
describe('getConsultationDetails', () => {
  it('returns full consultation details with designer info', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', designerId: 'd1', date: '2026-04-01', timeSlot: '10:00', consultationType: 'video', status: 'confirmed', notes: 'help', videoCallUrl: 'https://meet.carolinafutons.com/consultation/abc', photos: '[]', createdAt: new Date() },
    ]);
    __seed('Designers', [
      { _id: 'd1', name: 'Alice', avatarUrl: 'url', specialty: 'bedroom' },
    ]);
    const result = await getConsultationDetails('b1');
    expect(result.success).toBe(true);
    expect(result.consultation.designerName).toBe('Alice');
    expect(result.consultation.designerAvatar).toBe('url');
    expect(result.consultation.designerSpecialty).toBe('bedroom');
    expect(result.consultation.date).toBe('2026-04-01');
    expect(result.consultation.timeSlot).toBe('10:00');
  });

  it('rejects invalid booking ID', async () => {
    const result = await getConsultationDetails('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('booking ID');
  });

  it('rejects booking not owned by member', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'other-member' },
    ]);
    const result = await getConsultationDetails('b1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns empty designer info when designer not found', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', designerId: 'd999', photos: '[]', createdAt: new Date() },
    ]);
    __seed('Designers', []);
    const result = await getConsultationDetails('b1');
    expect(result.success).toBe(true);
    expect(result.consultation.designerName).toBe('');
    expect(result.consultation.designerAvatar).toBe('');
    expect(result.consultation.designerSpecialty).toBe('');
  });

  it('parses photos from JSON string', async () => {
    const photos = [{ photoId: 'ph-1', url: 'https://x.com/1.jpg', description: 'room' }];
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', designerId: 'd1', photos: JSON.stringify(photos), createdAt: new Date() },
    ]);
    __seed('Designers', []);
    const result = await getConsultationDetails('b1');
    expect(result.consultation.photos).toHaveLength(1);
    expect(result.consultation.photos[0].photoId).toBe('ph-1');
  });

  it('handles malformed photos JSON gracefully', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', designerId: 'd1', photos: 'not-json', createdAt: new Date() },
    ]);
    __seed('Designers', []);
    const result = await getConsultationDetails('b1');
    expect(result.success).toBe(true);
    expect(result.consultation.photos).toEqual([]);
  });

  it('fails when not authenticated', async () => {
    _mockMember = null;
    const result = await getConsultationDetails('b1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Authentication');
  });

  it('includes all expected consultation fields', async () => {
    __seed('ConsultationBookings', [
      { _id: 'b1', memberId: 'member-abc', designerId: 'd1', date: '2026-04-01', timeSlot: '14:00', consultationType: 'phone', status: 'completed', notes: 'Great', videoCallUrl: '', photos: '[]', createdAt: new Date('2026-03-15') },
    ]);
    __seed('Designers', []);
    const result = await getConsultationDetails('b1');
    const c = result.consultation;
    expect(c).toHaveProperty('_id');
    expect(c).toHaveProperty('date');
    expect(c).toHaveProperty('timeSlot');
    expect(c).toHaveProperty('consultationType');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('notes');
    expect(c).toHaveProperty('videoCallUrl');
    expect(c).toHaveProperty('photos');
    expect(c).toHaveProperty('designerName');
    expect(c).toHaveProperty('designerAvatar');
    expect(c).toHaveProperty('designerSpecialty');
    expect(c).toHaveProperty('createdAt');
  });
});
