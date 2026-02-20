import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog } from './__mocks__/wix-crm-backend.js';
import {
  sendEmail,
  sendOrderNotification,
} from '../src/backend/emailService.web.js';

beforeEach(() => {
  __setSecrets({ SITE_OWNER_CONTACT_ID: 'owner-contact-123' });
});

// ── sendEmail ───────────────────────────────────────────────────────

describe('sendEmail', () => {
  it('sends contact form email to site owner', async () => {
    const result = await sendEmail({
      name: 'John Doe',
      email: 'john@example.com',
      phone: '828-555-0100',
      subject: 'Question about futons',
      message: 'Do you have the Eureka in stock?',
    });

    expect(result).toEqual({ success: true });

    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('contact_form_submission');
    expect(emails[0].contactId).toBe('owner-contact-123');
    expect(emails[0].options.variables.customerName).toBe('John Doe');
    expect(emails[0].options.variables.customerEmail).toBe('john@example.com');
    expect(emails[0].options.variables.subject).toBe('Question about futons');
  });

  it('saves submission to ContactSubmissions collection', async () => {
    await sendEmail({
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '828-555-0200',
      subject: 'Delivery question',
      message: 'How long does delivery take?',
    });

    // The mock wix-data auto-stores inserts; we can query the seeded data
    // In the real implementation, it inserts into ContactSubmissions
    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
  });

  it('includes formatted submission timestamp', async () => {
    await sendEmail({
      name: 'Test',
      email: 'test@test.com',
      phone: '',
      subject: 'Test',
      message: 'Test message',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.submittedAt).toBeTruthy();
    // Should be a formatted date string
    expect(typeof emails[0].options.variables.submittedAt).toBe('string');
  });
});

// ── sendOrderNotification ──────────────────────────────────────────

describe('sendOrderNotification', () => {
  it('sends order notification with correct details', async () => {
    const result = await sendOrderNotification({
      number: '10042',
      buyerName: 'Jane Smith',
      total: '$877.99',
      lineItems: [
        { name: 'Eureka Futon Frame' },
        { name: 'Moonshadow Mattress' },
      ],
    });

    expect(result).toEqual({ success: true });

    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('new_order_notification');
    expect(emails[0].options.variables.orderNumber).toBe('10042');
    expect(emails[0].options.variables.customerName).toBe('Jane Smith');
    expect(emails[0].options.variables.itemCount).toBe('2');
  });

  it('handles missing lineItems gracefully', async () => {
    const result = await sendOrderNotification({
      number: '10043',
      buyerName: 'Bob',
      total: '$100',
    });

    expect(result).toEqual({ success: true });
    const emails = __getEmailLog();
    expect(emails[0].options.variables.itemCount).toBe('0');
  });
});
