/**
 * @module virtualConsultation
 * @description Virtual room consultation booking system.
 * Enables customers to book video/phone consultations with designers,
 * upload room photos, and receive personalized furniture recommendations.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collections:
 *
 * `Designers` with fields:
 *   name (Text) - Designer display name
 *   specialty (Text) - 'living-room'|'bedroom'|'office'|'multi-room'
 *   bio (Text) - Designer biography
 *   avatarUrl (Text) - Profile image URL
 *   isActive (Boolean) - Whether accepting bookings
 *
 * `ConsultationBookings` with fields:
 *   memberId (Text, indexed) - Booking owner
 *   designerId (Text, indexed) - Assigned designer
 *   date (Text, indexed) - YYYY-MM-DD booking date
 *   timeSlot (Text) - HH:MM start time
 *   consultationType (Text) - 'video'|'phone'
 *   status (Text, indexed) - 'confirmed'|'cancelled'|'completed'
 *   notes (Text) - Customer notes
 *   videoCallUrl (Text) - Generated video call link
 *   photos (Text) - JSON array of uploaded photo objects
 *   createdAt (Date, indexed)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const VALID_TYPES = ['video', 'phone'];
const VALID_TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const BOOKING_WINDOW_DAYS = 14;
const MAX_PHOTOS = 10;

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

function generateCallUrl() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `https://meet.carolinafutons.com/consultation/${id}`;
}

function parseJson(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isWeekday(date) {
  const day = date.getDay();
  return day > 0 && day < 6;
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get available designers, optionally filtered by specialty.
 *
 * @param {string} [specialty] - Filter by specialty (e.g. 'living-room')
 * @returns {Promise<{success: boolean, designers: Array}>}
 */
export const getDesigners = webMethod(
  Permissions.Anyone,
  async (specialty) => {
    try {
      let query = wixData.query('Designers').eq('isActive', true);

      if (specialty) {
        const cleanSpecialty = sanitize(specialty, 50);
        if (cleanSpecialty) {
          query = query.eq('specialty', cleanSpecialty);
        }
      }

      const result = await query.find();

      const designers = result.items.map(d => ({
        _id: d._id,
        name: d.name,
        specialty: d.specialty,
        bio: d.bio,
        avatarUrl: d.avatarUrl,
      }));

      return { success: true, designers };
    } catch (err) {
      console.error('[virtualConsultation] Error getting designers:', err);
      return { success: false, error: 'Failed to load designers.', designers: [] };
    }
  }
);

/**
 * Get available consultation time slots for a designer within the booking window.
 *
 * @param {string} designerId - Designer ID
 * @returns {Promise<{success: boolean, slots?: Array, error?: string}>}
 */
export const getAvailableConsultationSlots = webMethod(
  Permissions.Anyone,
  async (designerId) => {
    try {
      const cleanId = validateId(designerId);
      if (!cleanId) {
        return { success: false, error: 'Valid designer ID is required.', slots: [] };
      }

      const designer = await wixData.get('Designers', cleanId);
      if (!designer || !designer.isActive) {
        return { success: false, error: 'Designer not found or unavailable.', slots: [] };
      }

      // Get existing bookings for this designer
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + BOOKING_WINDOW_DAYS);

      const todayStr = toLocalDateStr(today);
      const endStr = toLocalDateStr(endDate);

      const bookings = await wixData.query('ConsultationBookings')
        .eq('designerId', cleanId)
        .ne('status', 'cancelled')
        .ge('date', todayStr)
        .le('date', endStr)
        .find();

      const bookedSet = new Set(
        bookings.items.map(b => `${b.date}_${b.timeSlot}`)
      );

      // Generate available slots
      const slots = [];
      const cursor = new Date(today);
      cursor.setDate(cursor.getDate() + 1); // Start from tomorrow

      while (cursor <= endDate) {
        if (isWeekday(cursor)) {
          const dateStr = toLocalDateStr(cursor);
          for (const timeSlot of VALID_TIME_SLOTS) {
            const key = `${dateStr}_${timeSlot}`;
            if (!bookedSet.has(key)) {
              slots.push({ date: dateStr, timeSlot });
            }
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      return { success: true, slots };
    } catch (err) {
      console.error('[virtualConsultation] Error getting slots:', err);
      return { success: false, error: 'Failed to load available slots.', slots: [] };
    }
  }
);

/**
 * Book a virtual consultation.
 *
 * @param {Object} data
 * @param {string} data.designerId - Designer to book with
 * @param {string} data.date - YYYY-MM-DD date
 * @param {string} data.timeSlot - HH:MM time slot
 * @param {string} data.consultationType - 'video' or 'phone'
 * @param {string} [data.notes] - Customer notes
 * @returns {Promise<{success: boolean, bookingId?: string, videoCallUrl?: string, error?: string}>}
 */
export const bookConsultation = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const designerId = validateId(data.designerId);
      if (!designerId) {
        return { success: false, error: 'Valid designer ID is required.' };
      }

      // Validate date
      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        return { success: false, error: 'Valid date in YYYY-MM-DD format is required.' };
      }

      const bookingDate = new Date(data.date + 'T12:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (bookingDate < today) {
        return { success: false, error: 'Cannot book consultations in the past.' };
      }

      // Validate time slot
      const timeSlot = sanitize(data.timeSlot, 10);
      if (!timeSlot || !VALID_TIME_SLOTS.includes(timeSlot)) {
        return { success: false, error: 'Valid time slot is required.' };
      }

      // Validate consultation type
      const consultationType = sanitize(data.consultationType, 20);
      if (!VALID_TYPES.includes(consultationType)) {
        return { success: false, error: 'Consultation type must be video or phone.' };
      }

      // Verify designer exists
      const designer = await wixData.get('Designers', designerId);
      if (!designer || !designer.isActive) {
        return { success: false, error: 'Designer not found or unavailable.' };
      }

      // Check for double booking
      const existing = await wixData.query('ConsultationBookings')
        .eq('designerId', designerId)
        .eq('date', data.date)
        .eq('timeSlot', timeSlot)
        .ne('status', 'cancelled')
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'This time slot is no longer available.' };
      }

      const videoCallUrl = consultationType === 'video' ? generateCallUrl() : '';
      const notes = sanitize(data.notes || '', 1000);

      const record = {
        memberId,
        designerId,
        date: data.date,
        timeSlot,
        consultationType,
        status: 'confirmed',
        notes,
        videoCallUrl,
        photos: '[]',
        createdAt: new Date(),
      };

      const inserted = await wixData.insert('ConsultationBookings', record);
      return { success: true, bookingId: inserted._id, videoCallUrl };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error booking consultation:', err);
      return { success: false, error: 'Failed to book consultation.' };
    }
  }
);

/**
 * Cancel a consultation booking.
 *
 * @param {string} bookingId - Booking ID to cancel
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const cancelConsultation = webMethod(
  Permissions.SiteMember,
  async (bookingId) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(bookingId);
      if (!cleanId) {
        return { success: false, error: 'Valid booking ID is required.' };
      }

      const booking = await wixData.get('ConsultationBookings', cleanId);
      if (!booking || booking.memberId !== memberId) {
        return { success: false, error: 'Booking not found.' };
      }

      if (booking.status === 'cancelled') {
        return { success: false, error: 'Booking is already cancelled.' };
      }

      booking.status = 'cancelled';
      await wixData.update('ConsultationBookings', booking);

      return { success: true };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error cancelling consultation:', err);
      return { success: false, error: 'Failed to cancel consultation.' };
    }
  }
);

/**
 * Get the current member's consultation bookings.
 *
 * @returns {Promise<{success: boolean, consultations: Array}>}
 */
export const getMyConsultations = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const memberId = await requireMember();

      const result = await wixData.query('ConsultationBookings')
        .eq('memberId', memberId)
        .find();

      return { success: true, consultations: result.items };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.', consultations: [] };
      }
      console.error('[virtualConsultation] Error getting consultations:', err);
      return { success: false, error: 'Failed to load consultations.', consultations: [] };
    }
  }
);

/**
 * Upload a room photo for a consultation booking.
 *
 * @param {string} bookingId - Booking ID
 * @param {Object} photo
 * @param {string} photo.url - Photo URL (from Wix media upload)
 * @param {string} [photo.description] - Photo description
 * @returns {Promise<{success: boolean, photoId?: string, error?: string}>}
 */
export const uploadRoomPhoto = webMethod(
  Permissions.SiteMember,
  async (bookingId, photo) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(bookingId);
      if (!cleanId) {
        return { success: false, error: 'Valid booking ID is required.' };
      }

      const booking = await wixData.get('ConsultationBookings', cleanId);
      if (!booking || booking.memberId !== memberId) {
        return { success: false, error: 'Booking not found.' };
      }

      // Validate URL
      const url = (photo.url || '').trim();
      if (!url || !url.match(/^https?:\/\/.+/)) {
        return { success: false, error: 'Valid photo URL is required.' };
      }

      const photos = parseJson(booking.photos);
      if (photos.length >= MAX_PHOTOS) {
        return { success: false, error: `Maximum ${MAX_PHOTOS} photos per consultation.` };
      }

      const photoId = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const description = sanitize(photo.description || '', 200);

      photos.push({ photoId, url, description });
      booking.photos = JSON.stringify(photos);
      await wixData.update('ConsultationBookings', booking);

      return { success: true, photoId };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error uploading photo:', err);
      return { success: false, error: 'Failed to upload photo.' };
    }
  }
);

/**
 * Get full consultation details including designer info.
 *
 * @param {string} bookingId - Booking ID
 * @returns {Promise<{success: boolean, consultation?: Object, error?: string}>}
 */
export const getConsultationDetails = webMethod(
  Permissions.SiteMember,
  async (bookingId) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(bookingId);
      if (!cleanId) {
        return { success: false, error: 'Valid booking ID is required.' };
      }

      const booking = await wixData.get('ConsultationBookings', cleanId);
      if (!booking || booking.memberId !== memberId) {
        return { success: false, error: 'Booking not found.' };
      }

      // Fetch designer info
      let designerName = '';
      let designerAvatar = '';
      let designerSpecialty = '';
      try {
        const designer = await wixData.get('Designers', booking.designerId);
        if (designer) {
          designerName = designer.name;
          designerAvatar = designer.avatarUrl;
          designerSpecialty = designer.specialty;
        }
      } catch {
        // Designer lookup failed — continue with empty designer info
      }

      return {
        success: true,
        consultation: {
          _id: booking._id,
          date: booking.date,
          timeSlot: booking.timeSlot,
          consultationType: booking.consultationType,
          status: booking.status,
          notes: booking.notes,
          videoCallUrl: booking.videoCallUrl,
          photos: parseJson(booking.photos),
          designerName,
          designerAvatar,
          designerSpecialty,
          createdAt: booking.createdAt,
        },
      };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error getting consultation details:', err);
      return { success: false, error: 'Failed to load consultation details.' };
    }
  }
);
