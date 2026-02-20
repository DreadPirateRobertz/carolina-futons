// Backend web module for email functionality
// Handles contact form submissions and order notifications
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';

// Send contact form email to store
export const sendEmail = webMethod(
  Permissions.Anyone,
  async ({ name, email, phone, subject, message }) => {
    try {
      // Use Wix Triggered Emails to send to store owner
      // The triggered email template "contact_form_submission" must be
      // created in the Wix Dashboard > Marketing > Triggered Emails
      // IMPORTANT: Replace SITE_OWNER_MEMBER_ID with the actual site owner's
      // member ID from Wix Dashboard > Contacts > Site Members
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

      // Also save to a CMS collection for record keeping
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

// Send order notification to store
export const sendOrderNotification = webMethod(
  Permissions.Anyone,
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
