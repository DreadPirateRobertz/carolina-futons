// Backend web module for email functionality
// Handles contact form submissions and order notifications
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';

// Send contact form email to store
export const sendEmail = webMethod(
  Permissions.Anyone,
  async ({ name, email, phone, subject, message }) => {
    try {
      // Use Wix Triggered Emails to send to store owner
      // The triggered email template "contact_form_submission" must be
      // created in the Wix Dashboard > Marketing > Triggered Emails
      await triggeredEmails.emailMembers(
        'contact_form_submission',
        ['site-owner'], // Sends to site owner
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
      const wixData = await import('wix-data');
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
      await triggeredEmails.emailMembers(
        'new_order_notification',
        ['site-owner'],
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
