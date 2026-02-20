/**
 * @module contactSubmissions
 * @description Backend web module for lightweight contact/lead capture.
 * Handles form submissions from exit-intent popups, back-in-stock alerts,
 * and other non-email-notification captures. Persists to the ContactSubmissions
 * CMS collection for dashboard review and follow-up.
 *
 * For full email notifications (contact form, swatch requests), use
 * emailService.web.js instead.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create the `ContactSubmissions` CMS collection in Wix Dashboard with fields:
 *   name (Text), email (Text), phone (Text), subject (Text), message (Text),
 *   submittedAt (Date), status (Text), source (Text), notes (Text),
 *   productId (Text), productName (Text)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

/**
 * Submit a lightweight contact/lead capture form.
 * Used by exit-intent popups, back-in-stock alerts, and browse abandonment.
 * Does NOT send email notifications — just persists to CMS.
 *
 * @function submitContactForm
 * @param {Object} data - The form submission data.
 * @param {string} data.email - Customer's email address (required).
 * @param {string} [data.name] - Customer's name.
 * @param {string} [data.phone] - Customer's phone number.
 * @param {string} [data.source] - Where the submission came from
 *   (e.g., 'exit_intent_popup', 'back_in_stock', 'browse_abandonment').
 * @param {string} [data.status] - Submission status/type
 *   (e.g., 'exit_intent_signup', 'back_in_stock_request').
 * @param {string} [data.notes] - Additional context about the submission.
 * @param {string} [data.productId] - Associated product ID (for back-in-stock).
 * @param {string} [data.productName] - Associated product name.
 * @returns {Promise<{success: boolean}>} Resolves on successful insert.
 * @permission Anyone — captures from anonymous visitors.
 */
export const submitContactForm = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data || !data.email) {
        throw new Error('Email is required');
      }

<<<<<<< HEAD
      await wixData.insert('ContactSubmissions', {
        email: data.email,
        name: data.name || '',
        phone: data.phone || '',
        subject: data.source || 'lead_capture',
        message: data.notes || '',
        submittedAt: new Date(),
        status: data.status || 'new',
        source: data.source || 'unknown',
        notes: data.notes || '',
        productId: data.productId || '',
        productName: data.productName || '',
=======
      const email = sanitize(data.email, 254).toLowerCase();
      if (!validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      // Rate limit: reject if same email submitted within 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const recent = await wixData.query('ContactSubmissions')
        .eq('email', email)
        .ge('submittedAt', oneMinuteAgo)
        .find();

      if (recent.items.length > 0) {
        return { success: true }; // Silent success to avoid leaking info
      }

      const source = sanitize(data.source || 'unknown', 50);

      await wixData.insert('ContactSubmissions', {
        email,
        name: sanitize(data.name || '', 200),
        phone: sanitize(data.phone || '', 20),
        subject: source,
        message: sanitize(data.notes || '', 2000),
        submittedAt: new Date(),
        status: sanitize(data.status || 'new', 50),
        source,
        notes: sanitize(data.notes || '', 2000),
        productId: sanitize(data.productId || '', 50),
        productName: sanitize(data.productName || '', 200),
>>>>>>> 25c305a (Add security remediation: input sanitization, admin auth, rate limiting)
      });

      return { success: true };
    } catch (err) {
      console.error('Error submitting contact form:', err);
      return { success: false };
    }
  }
);
