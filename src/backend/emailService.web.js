/**
 * @module emailService
 * @description Backend web module for email notifications.
 * Handles contact form submissions (via Wix Triggered Emails) and order
 * notifications to the store owner. Also persists contact form data to the
 * `ContactSubmissions` CMS collection for record-keeping.
 *
 * @requires wix-web-module
 * @requires wix-crm-backend - Wix Triggered Emails API
 * @requires wix-secrets-backend - Retrieves SITE_OWNER_CONTACT_ID secret
 * @requires wix-data
 *
 * @setup
 * 1. In Wix Dashboard > Secrets Manager, add `SITE_OWNER_CONTACT_ID` with the
 *    site owner's Wix contact ID (found in Dashboard > Contacts > Site Members).
 * 2. Create triggered email template `contact_form_submission` in
 *    Dashboard > Marketing > Triggered Emails with variables:
 *    customerName, customerEmail, customerPhone, subject, message, submittedAt.
 * 3. Create triggered email template `new_order_notification` with variables:
 *    orderNumber, customerName, total, itemCount.
 */
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

/**
 * Send a contact form submission to the store owner via triggered email.
 * Also saves the submission to the `ContactSubmissions` CMS collection.
 *
 * @function sendEmail
 * @param {Object} formData - The contact form data.
 * @param {string} formData.name - Customer's name (required).
 * @param {string} formData.email - Customer's email address (required).
 * @param {string} [formData.phone] - Customer's phone number.
 * @param {string} [formData.subject] - Message subject.
 * @param {string} formData.message - The message body (required).
 * @returns {Promise<{success: true}>} Resolves on successful send.
 * @throws {Error} Throws with a user-facing message including the store phone
 *   number as a fallback contact method.
 * @permission Anyone — public form submissions don't require authentication.
 */
export const sendEmail = webMethod(
  Permissions.Anyone,
  async ({ name, email, phone, subject, message }) => {
    try {
      // Retrieve the site owner's Wix contact ID from Secrets Manager.
      // This is the recipient of all contact form notifications.
      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');
      await triggeredEmails.emailContact(
        'contact_form_submission',
        siteOwnerContactId,
        {
          variables: {
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            subject: subject,
            message: message,
            submittedAt: new Date().toLocaleString('en-US', {
              timeZone: 'America/New_York',
              dateStyle: 'full',
              timeStyle: 'short',
            }),
          },
        }
      );

      // Persist the submission to CMS for record-keeping and dashboard access
      await wixData.insert('ContactSubmissions', {
        name,
        email,
        phone,
        subject,
        message,
        submittedAt: new Date(),
        status: 'new',
      });

      return { success: true };
    } catch (err) {
      console.error('Error sending contact email:', err);
      throw new Error('Failed to send message. Please try calling us at (828) 252-9449.');
    }
  }
);

/**
 * Submit a fabric swatch request. Stores in ContactSubmissions CMS and
 * notifies the store owner via triggered email.
 *
 * @function submitSwatchRequest
 * @param {Object} params
 * @param {string} params.name - Customer's name.
 * @param {string} params.email - Customer's email address.
 * @param {string} params.address - Customer's mailing address for swatches.
 * @param {string} params.productId - The product ID swatches are requested for.
 * @param {string} params.productName - Display name of the product.
 * @param {string[]} params.swatchNames - Array of selected swatch/fabric names.
 * @returns {Promise<{success: true}>}
 * @throws {Error} On failure with fallback contact info.
 * @permission Anyone
 */
export const submitSwatchRequest = webMethod(
  Permissions.Anyone,
  async ({ name, email, address, productId, productName, swatchNames }) => {
    try {
      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');

      // Persist to CMS for record-keeping
      await wixData.insert('ContactSubmissions', {
        name,
        email,
        subject: `Swatch Request: ${productName}`,
        message: `Swatches: ${swatchNames.join(', ')}\nMailing Address: ${address}\nProduct: ${productName} (${productId})`,
        submittedAt: new Date(),
        status: 'swatch_request',
      });

      // Notify store owner
      await triggeredEmails.emailContact(
        'contact_form_submission',
        siteOwnerContactId,
        {
          variables: {
            customerName: name,
            customerEmail: email,
            customerPhone: '',
            subject: `Fabric Swatch Request — ${productName}`,
            message: `Swatches requested: ${swatchNames.join(', ')}\n\nShip to:\n${name}\n${address}`,
            submittedAt: new Date().toLocaleString('en-US', {
              timeZone: 'America/New_York',
              dateStyle: 'full',
              timeStyle: 'short',
            }),
          },
        }
      );

      return { success: true };
    } catch (err) {
      console.error('Error submitting swatch request:', err);
      throw new Error('Failed to submit swatch request. Please try calling us at (828) 252-9449.');
    }
  }
);

/**
 * Send a new order notification to the store owner.
 * Non-critical — returns `{ success: false }` on failure rather than throwing.
 *
 * @function sendOrderNotification
 * @param {Object} orderDetails - Order data from Wix Stores.
 * @param {string} orderDetails.number - The order number.
 * @param {string} orderDetails.buyerName - Customer's full name.
 * @param {string} orderDetails.total - Formatted order total (e.g., "$1,299.00").
 * @param {Array} [orderDetails.lineItems] - Array of line items (used for item count).
 * @returns {Promise<{success: boolean}>} Success status.
 * @permission Anyone
 */
export const sendOrderNotification = webMethod(
  Permissions.SiteMember,
  async (orderDetails) => {
    try {
      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');
      await triggeredEmails.emailContact(
        'new_order_notification',
        siteOwnerContactId,
        {
          variables: {
            orderNumber: orderDetails.number,
            customerName: orderDetails.buyerName,
            total: orderDetails.total,
            itemCount: String(orderDetails.lineItems?.length || 0),
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error('Error sending order notification:', err);
      return { success: false };
    }
  }
);
