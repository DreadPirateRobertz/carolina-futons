import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert } from './__mocks__/wix-data.js';
import { __setSecrets, __failNext } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  sendEmail,
  submitSwatchRequest,
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

  it('persists submission to ContactSubmissions CMS', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await sendEmail({
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '828-555-0200',
      subject: 'Delivery question',
      message: 'How long does delivery take?',
    });

    expect(inserted.col).toBe('ContactSubmissions');
    expect(inserted.item.name).toBe('Jane Smith');
    expect(inserted.item.email).toBe('jane@example.com');
    expect(inserted.item.status).toBe('new');
    expect(inserted.item.submittedAt).toBeInstanceOf(Date);
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
    expect(typeof emails[0].options.variables.submittedAt).toBe('string');
  });

  it('includes phone number in template variables', async () => {
    await sendEmail({
      name: 'Phone Test',
      email: 'phone@test.com',
      phone: '828-555-1234',
      subject: 'Test',
      message: 'Testing phone',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerPhone).toBe('828-555-1234');
  });

  it('includes message body in template variables', async () => {
    await sendEmail({
      name: 'Msg Test',
      email: 'msg@test.com',
      phone: '',
      subject: 'Test',
      message: 'This is my detailed question about futon frames.',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.message).toBe('This is my detailed question about futon frames.');
  });

  it('rejects invalid email address', async () => {
    await expect(sendEmail({
      name: 'Bad Email',
      email: 'not-an-email',
      phone: '',
      subject: 'Test',
      message: 'Test',
    })).rejects.toThrow('calling us at (828)');
  });

  it('rejects empty email address', async () => {
    await expect(sendEmail({
      name: 'No Email',
      email: '',
      phone: '',
      subject: 'Test',
      message: 'Test',
    })).rejects.toThrow();
  });

  it('sanitizes HTML/XSS in form fields', async () => {
    await sendEmail({
      name: '<script>alert("xss")</script>',
      email: 'test@test.com',
      phone: '',
      subject: '<img onerror="hack()">',
      message: 'Clean message',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerName).not.toContain('<script>');
    expect(emails[0].options.variables.subject).not.toContain('<img');
  });

  it('truncates overlong name field', async () => {
    const longName = 'A'.repeat(500);
    await sendEmail({
      name: longName,
      email: 'test@test.com',
      phone: '',
      subject: 'Test',
      message: 'Test',
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerName.length).toBeLessThanOrEqual(200);
  });

  it('truncates overlong message field', async () => {
    const longMsg = 'X'.repeat(5000);
    await sendEmail({
      name: 'Test',
      email: 'test@test.com',
      phone: '',
      subject: 'Test',
      message: longMsg,
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.message.length).toBeLessThanOrEqual(2000);
  });

  it('throws user-friendly error with phone number on email failure', async () => {
    __failNextEmail();
    await expect(sendEmail({
      name: 'Test',
      email: 'test@test.com',
      phone: '',
      subject: 'Test',
      message: 'Test',
    })).rejects.toThrow('(828) 252-9449');
  });

  it('handles empty phone and subject gracefully', async () => {
    const result = await sendEmail({
      name: 'Min Fields',
      email: 'min@test.com',
      phone: '',
      subject: '',
      message: 'Just a message',
    });

    expect(result).toEqual({ success: true });
  });
});

// ── submitSwatchRequest ─────────────────────────────────────────────

describe('submitSwatchRequest', () => {
  it('sends swatch request with correct template variables', async () => {
    const result = await submitSwatchRequest({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      address: '123 Main St, Asheville NC 28801',
      productId: 'prod-123',
      productName: 'Eureka Futon Frame',
      swatchNames: ['Natural Oak', 'Espresso'],
    });

    expect(result).toEqual({ success: true });
    const emails = __getEmailLog();
    expect(emails).toHaveLength(1);
    expect(emails[0].templateId).toBe('contact_form_submission');
    expect(emails[0].options.variables.subject).toContain('Fabric Swatch Request');
    expect(emails[0].options.variables.subject).toContain('Eureka Futon Frame');
    expect(emails[0].options.variables.message).toContain('Natural Oak');
    expect(emails[0].options.variables.message).toContain('Espresso');
  });

  it('persists swatch request to CMS with correct status', async () => {
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await submitSwatchRequest({
      name: 'CMS Test',
      email: 'cms@test.com',
      address: '456 Oak Ave',
      productId: 'prod-456',
      productName: 'Dillon Frame',
      swatchNames: ['Walnut'],
    });

    expect(inserted.col).toBe('ContactSubmissions');
    expect(inserted.item.status).toBe('swatch_request');
    expect(inserted.item.subject).toContain('Swatch Request');
    expect(inserted.item.subject).toContain('Dillon Frame');
  });

  it('includes mailing address in email message', async () => {
    await submitSwatchRequest({
      name: 'Addr Test',
      email: 'addr@test.com',
      address: '789 Pine St, Apt 2B',
      productId: 'p1',
      productName: 'Test Product',
      swatchNames: ['Red'],
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.message).toContain('789 Pine St, Apt 2B');
  });

  it('includes customer name in shipping info', async () => {
    await submitSwatchRequest({
      name: 'Ship Name',
      email: 'ship@test.com',
      address: '100 Elm St',
      productId: 'p1',
      productName: 'Product',
      swatchNames: ['Blue'],
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.message).toContain('Ship Name');
  });

  it('rejects invalid email for swatch request', async () => {
    await expect(submitSwatchRequest({
      name: 'Test',
      email: 'bad-email',
      address: '123 St',
      productId: 'p1',
      productName: 'Test',
      swatchNames: ['Swatch'],
    })).rejects.toThrow('calling us at (828)');
  });

  it('handles empty swatchNames array', async () => {
    const result = await submitSwatchRequest({
      name: 'Test',
      email: 'test@test.com',
      address: '123 St',
      productId: 'p1',
      productName: 'Test Product',
      swatchNames: [],
    });
    expect(result).toEqual({ success: true });
  });

  it('handles non-array swatchNames (converts to empty array)', async () => {
    const result = await submitSwatchRequest({
      name: 'Test',
      email: 'test@test.com',
      address: '123 St',
      productId: 'p1',
      productName: 'Test Product',
      swatchNames: 'not-an-array',
    });
    expect(result).toEqual({ success: true });
  });

  it('sanitizes XSS in swatch names', async () => {
    await submitSwatchRequest({
      name: 'XSS Test',
      email: 'xss@test.com',
      address: '123 St',
      productId: 'p1',
      productName: 'Product',
      swatchNames: ['<script>alert(1)</script>', 'Normal Fabric'],
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.message).not.toContain('<script>');
  });

  it('sanitizes overlong address', async () => {
    const longAddr = 'A'.repeat(1000);
    let inserted;
    __onInsert((col, item) => { inserted = { col, item }; });

    await submitSwatchRequest({
      name: 'Test',
      email: 'test@test.com',
      address: longAddr,
      productId: 'p1',
      productName: 'Product',
      swatchNames: ['Fabric'],
    });

    // address is sanitized to 500 chars
    expect(inserted.item.message.length).toBeLessThan(1000 + 200); // some overhead from formatting
  });

  it('sets empty customerPhone in email variables', async () => {
    await submitSwatchRequest({
      name: 'No Phone',
      email: 'nophone@test.com',
      address: '123 St',
      productId: 'p1',
      productName: 'Product',
      swatchNames: ['Fabric'],
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.customerPhone).toBe('');
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

  it('includes total in notification variables', async () => {
    await sendOrderNotification({
      number: '10045',
      buyerName: 'Total Test',
      total: '$1,299.00',
      lineItems: [{ name: 'Item' }],
    });

    const emails = __getEmailLog();
    expect(emails[0].options.variables.total).toBe('$1,299.00');
  });

  it('sends to correct contact ID from secrets', async () => {
    await sendOrderNotification({
      number: '10046',
      buyerName: 'Secret Test',
      total: '$100',
      lineItems: [],
    });

    const emails = __getEmailLog();
    expect(emails[0].contactId).toBe('owner-contact-123');
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

  it('converts itemCount to string', async () => {
    await sendOrderNotification({
      number: '10047',
      buyerName: 'Count Test',
      total: '$500',
      lineItems: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });

    const emails = __getEmailLog();
    expect(typeof emails[0].options.variables.itemCount).toBe('string');
    expect(emails[0].options.variables.itemCount).toBe('3');
  });

  it('returns success: false on email failure (non-throwing)', async () => {
    __failNextEmail();
    const result = await sendOrderNotification({
      number: '10044',
      buyerName: 'Test',
      total: '$50',
      lineItems: [],
    });
    expect(result).toEqual({ success: false });
  });

  it('handles single line item', async () => {
    const result = await sendOrderNotification({
      number: '10048',
      buyerName: 'Single Item',
      total: '$499',
      lineItems: [{ name: 'Eureka Frame' }],
    });

    expect(result).toEqual({ success: true });
    const emails = __getEmailLog();
    expect(emails[0].options.variables.itemCount).toBe('1');
  });
});
