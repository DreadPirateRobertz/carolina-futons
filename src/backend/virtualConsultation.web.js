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
import { triggerConsultationFollowup } from 'backend/emailAutomation.web';

const VALID_TYPES = ['video', 'phone'];
const VALID_TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const BOOKING_WINDOW_DAYS = 14;
const MAX_PHOTOS = 10;

// Pre-consultation intake form allowed values (cf-osnt)
const INTAKE_ENUMS = {
  roomType: ['living-room', 'guest-room', 'studio', 'bedroom', 'office', 'other'],
  roomSize: ['small', 'medium', 'large'],
  primaryUse: ['daily-sleeping', 'occasional-guest', 'both'],
  stylePreference: ['modern', 'traditional', 'rustic', 'eclectic'],
  budget: ['under-500', '500-1000', '1000-2000', '2000-plus'],
  timeline: ['within-week', 'within-month', 'browsing'],
  painPoint: ['price', 'space', 'comfort', 'style', 'assembly'],
};
const REQUIRED_INTAKE_FIELDS = Object.keys(INTAKE_ENUMS).filter(k => k !== 'painPoint');

/**
 * Validate consultationId and verify booking ownership.
 * Returns { cleanId, memberId } on success, or { error } on failure.
 */
async function resolveOwnedBooking(consultationId) {
  const memberId = await requireMember();
  const cleanId = validateId(consultationId);
  if (!cleanId) {
    return { error: 'Consultation ID is required.' };
  }
  const booking = await wixData.get('ConsultationBookings', cleanId);
  if (!booking || booking.memberId !== memberId) {
    return { error: 'Consultation not found.' };
  }
  return { cleanId, memberId, booking };
}

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

      // Pre-consultation quiz answers (room type, budget, style preferences)
      const quizAnswers = {};
      if (data.quizAnswers && typeof data.quizAnswers === 'object') {
        if (data.quizAnswers.roomType) quizAnswers.roomType = sanitize(String(data.quizAnswers.roomType), 100);
        if (data.quizAnswers.budget) quizAnswers.budget = sanitize(String(data.quizAnswers.budget), 50);
        if (data.quizAnswers.style) quizAnswers.style = sanitize(String(data.quizAnswers.style), 100);
        if (data.quizAnswers.roomSize) quizAnswers.roomSize = sanitize(String(data.quizAnswers.roomSize), 50);
        if (data.quizAnswers.primaryUse) quizAnswers.primaryUse = sanitize(String(data.quizAnswers.primaryUse), 100);
      }

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
        quizAnswers: JSON.stringify(quizAnswers),
        createdAt: new Date(),
      };

      const inserted = await wixData.insert('ConsultationBookings', record);

      // Trigger confirmation email (fire-and-forget)
      try {
        await wixData.insert('EmailQueue', {
          templateId: 'consultation_confirmation',
          recipientEmail: data.email || '',
          recipientContactId: memberId,
          variables: JSON.stringify({
            designerName: designer.name,
            date: data.date,
            timeSlot,
            consultationType,
            videoCallUrl,
            quizAnswers,
          }),
          sequenceType: 'consultation',
          sequenceStep: 1,
          scheduledFor: new Date(),
          status: 'pending',
          createdAt: new Date(),
        });
      } catch (emailErr) {
        console.warn('[virtualConsultation] Confirmation email failed:', emailErr.message);
      }

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

/**
 * Submit a pre-consultation intake form linked to a booking.
 *
 * Saves the customer's space details, preferences, and budget to the
 * ConsultationIntake collection so the designer is prepared before the call.
 *
 * @param {string} consultationId - ConsultationBookings _id
 * @param {Object} data
 * @param {string} data.roomType - 'living-room'|'guest-room'|'studio'|'bedroom'|'office'|'other'
 * @param {string} data.roomSize - 'small'|'medium'|'large'
 * @param {string} data.primaryUse - 'daily-sleeping'|'occasional-guest'|'both'
 * @param {string} data.stylePreference - 'modern'|'traditional'|'rustic'|'eclectic'
 * @param {string} data.budget - 'under-500'|'500-1000'|'1000-2000'|'2000-plus'
 * @param {string} data.timeline - 'within-week'|'within-month'|'browsing'
 * @param {string} [data.description] - What the customer is looking for (max 200 chars)
 * @param {string} [data.painPoint] - 'price'|'space'|'comfort'|'style'|'assembly'
 * @returns {Promise<{success: boolean, intakeId?: string, error?: string}>}
 */
export const submitConsultationIntake = webMethod(
  Permissions.SiteMember,
  async (consultationId, data) => {
    try {
      const resolved = await resolveOwnedBooking(consultationId);
      if (resolved.error) {
        return { success: false, error: resolved.error };
      }
      const { cleanId, memberId, booking } = resolved;

      if (booking.status === 'cancelled' || booking.status === 'completed') {
        return { success: false, error: 'Cannot submit intake for a cancelled or completed consultation.' };
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Intake data is required.' };
      }

      // Validate required enum fields
      for (const field of REQUIRED_INTAKE_FIELDS) {
        const value = data?.[field];
        if (!value || !INTAKE_ENUMS[field].includes(value)) {
          return { success: false, error: `Invalid or missing ${field}.` };
        }
      }

      // Validate optional description (max 200 chars)
      if (data.description && data.description.length > 200) {
        return { success: false, error: 'description must be 200 characters or fewer.' };
      }

      // Validate optional painPoint
      if (data.painPoint && !INTAKE_ENUMS.painPoint.includes(data.painPoint)) {
        return { success: false, error: 'Invalid painPoint.' };
      }

      const record = {
        consultationId: cleanId,
        memberId,
        ...Object.fromEntries(REQUIRED_INTAKE_FIELDS.map(f => [f, data[f]])),
        description: sanitize(data.description || '', 200),
        painPoint: data.painPoint || null,
        createdAt: new Date(),
      };

      const existing = await wixData.query('ConsultationIntake')
        .eq('consultationId', cleanId)
        .find();

      if (existing.items.length > 0) {
        const saved = await wixData.update('ConsultationIntake', { ...existing.items[0], ...record });
        return { success: true, intakeId: saved._id };
      }

      const inserted = await wixData.insert('ConsultationIntake', record);
      return { success: true, intakeId: inserted._id };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error submitting intake:', err);
      return { success: false, error: 'Failed to submit intake form.' };
    }
  }
);

/**
 * Get the pre-consultation intake form response for a booking.
 *
 * @param {string} consultationId - ConsultationBookings _id
 * @returns {Promise<{success: boolean, intake: Object|null, error?: string}>}
 */
export const getConsultationIntake = webMethod(
  Permissions.SiteMember,
  async (consultationId) => {
    try {
      const resolved = await resolveOwnedBooking(consultationId);
      if (resolved.error) {
        return { success: false, error: resolved.error };
      }

      const { cleanId, memberId } = resolved;

      const result = await wixData.query('ConsultationIntake')
        .eq('consultationId', cleanId)
        .eq('memberId', memberId)
        .find();

      return { success: true, intake: result.items[0] ?? null };
    } catch (err) {
      if (err.message === 'Authentication required') {
        return { success: false, error: 'Authentication required.' };
      }
      console.error('[virtualConsultation] Error getting intake:', err);
      return { success: false, error: 'Failed to load intake form.' };
    }
  }
);

/**
 * Record post-consultation notes and product recommendations, then trigger follow-up email.
 * Called by staff after each consultation via admin panel.
 *
 * @param {string}   bookingId - ConsultationBookings CMS _id
 * @param {string[]} productIds - up to 5 product IDs to feature in follow-up email
 * @param {string}   [notes] - optional internal notes from the designer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const addConsultationNotes = webMethod(
  Permissions.Admin,
  async (bookingId, productIds, notes) => {
    try {
      const cleanId = validateId(bookingId);
      if (!cleanId) return { success: false, error: 'bookingId is required' };

      const booking = await wixData.get('ConsultationBookings', cleanId);
      if (!booking) return { success: false, error: 'Consultation booking not found' };

      const cleanProductIds = (Array.isArray(productIds) ? productIds : [])
        .slice(0, 5)
        .map(id => sanitize(String(id), 100).trim())
        .filter(Boolean);
      const cleanNotes = sanitize(String(notes || ''), 2000);

      // Update booking: mark completed + save product recommendations
      await wixData.update('ConsultationBookings', {
        ...booking,
        status: 'completed',
        recommendedProductIds: JSON.stringify(cleanProductIds),
        staffNotes: cleanNotes,
        completedAt: new Date(),
      });

      // Resolve designer name for email
      let designerName = '';
      if (booking.designerId) {
        const designer = await wixData.get('Designers', booking.designerId);
        designerName = designer?.name || '';
      }

      // Parse quiz answers for email personalization
      let quizAnswers = null;
      try {
        quizAnswers = booking.quizAnswers ? JSON.parse(booking.quizAnswers) : null;
      } catch (_) { /* ignore malformed quiz answers */ }

      // Fire-and-forget: queue follow-up email
      const nameParts = (booking.contactName || '').split(' ');
      const firstName = nameParts[0] || '';
      triggerConsultationFollowup(
        booking.memberId || '',
        booking.recipientEmail || '',
        firstName,
        { designerName, productIds: cleanProductIds, notes: cleanNotes, quizAnswers },
      ).catch(err => console.error('[virtualConsultation] addConsultationNotes: followup queue failed:', err));

      return { success: true };
    } catch (err) {
      console.error('[virtualConsultation] addConsultationNotes error:', err);
      return { success: false, error: err.message || 'Failed to save consultation notes.' };
    }
  }
);
