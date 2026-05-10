import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert } from './__mocks__/wix-data.js';

const { mockEmailContact, mockQueryContacts } = vi.hoisted(() => {
  const mockEmailContact = vi.fn(async () => ({}));
  const mockQueryContacts = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    find: vi.fn(async () => ({ items: [] })),
  }));
  return { mockEmailContact, mockQueryContacts };
});

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: mockEmailContact },
  contacts: { queryContacts: mockQueryContacts },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'owner-contact-id-123'),
}));

import {
  sendEmail,
  submitSwatchRequest,
  sendSwatchConfirmationEmail,
  sendOrderNotification,
} from '../src/backend/emailService.web.js';

const validForm = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '828-555-1234',
  subject: 'Question about futons',
  message: 'Do you ship to Alaska?',
};

const validSwatch = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  address: '123 Main St, Asheville NC 28801',
  productId: 'prod-001',
  productName: 'Kodiak Futon',
  swatchNames: ['Suede Chocolate', 'Linen Navy'],
};

beforeEach(() => {
  __reset();
  mockEmailContact.mockClear();
  mockQueryContacts.mockClear();
});

// ── sendEmail ──────────────────────────────────────────────────

describe('sendEmail', () => {
  it('returns { success: true } on valid submission', async () => {
    const res = await sendEmail(validForm);
    expect(res).toEqual({ success: true });
  });

  it('calls triggeredEmails.emailContact with contact_form_submission template', async () => {
    await sendEmail(validForm);
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBU6zD', // dashboard ID for contact_form_submission
      'owner-contact-id-123',
      expect.objectContaining({
        variables: expect.objectContaining({
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          customerPhone: '828-555-1234',
          subject: 'Question about futons',
          message: 'Do you ship to Alaska?',
        }),
      }),
    );
  });

  it('persists submission to ContactSubmissions CMS', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    await sendEmail(validForm);
    // CF-rw9g: rate limit also inserts to EmailRateLimit, so filter for ContactSubmissions
    const contactInserts = inserted.filter(i => i.col === 'ContactSubmissions');
    expect(contactInserts).toHaveLength(1);
    expect(contactInserts[0].item).toMatchObject({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '828-555-1234',
      subject: 'Question about futons',
      message: 'Do you ship to Alaska?',
      status: 'new',
    });
    expect(contactInserts[0].item.submittedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid email with { success: false }', async () => {
    const res = await sendEmail({ ...validForm, email: 'not-an-email' });
    expect(res).toEqual({ success: false, message: 'Invalid email address.' });
    expect(mockEmailContact).not.toHaveBeenCalled();
  });

  it('rejects empty email', async () => {
    const res = await sendEmail({ ...validForm, email: '' });
    expect(res.success).toBe(false);
  });

  it('sanitizes HTML tags from input fields', async () => {
    await sendEmail({ ...validForm, name: '<script>alert(1)</script>Bob' });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.customerName).toBe('alert(1)Bob');
  });

  it('returns fallback phone number on API error', async () => {
    mockEmailContact.mockRejectedValueOnce(new Error('API down'));
    const res = await sendEmail(validForm);
    expect(res.success).toBe(false);
    expect(res.message).toContain('(828) 252-9449');
  });

  it('formats submittedAt in America/New_York timezone', async () => {
    await sendEmail(validForm);
    const call = mockEmailContact.mock.calls[0];
    const submittedAt = call[2].variables.submittedAt;
    // toLocaleString with dateStyle:'full' produces a day-of-week string
    expect(submittedAt).toMatch(/day,/i); // e.g. "Monday, March 16, 2026"
  });

  it('handles undefined phone and subject gracefully', async () => {
    const res = await sendEmail({ name: 'Jo', email: 'jo@test.com', message: 'Hi' });
    expect(res).toEqual({ success: true });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.customerPhone).toBe('');
    expect(call[2].variables.subject).toBe('');
  });
});

// ── submitSwatchRequest ────────────────────────────────────────

describe('submitSwatchRequest', () => {
  it('returns { success: true } on valid request', async () => {
    const res = await submitSwatchRequest(validSwatch);
    expect(res).toEqual({ success: true });
  });

  it('stores swatches in CMS as comma-joined string in message', async () => {
    const inserted = [];
    __onInsert((col, item) => inserted.push({ col, item }));
    await submitSwatchRequest(validSwatch);
    const rec = inserted.find(i => i.col === 'ContactSubmissions');
    expect(rec.item.message).toContain('Suede Chocolate, Linen Navy');
    expect(rec.item.status).toBe('swatch_request');
    expect(rec.item.subject).toContain('Kodiak Futon');
  });

  it('notifies store owner via triggered email', async () => {
    await submitSwatchRequest(validSwatch);
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBU6zD', // dashboard ID for contact_form_submission
      'owner-contact-id-123',
      expect.objectContaining({
        variables: expect.objectContaining({
          subject: expect.stringContaining('Fabric Swatch Request'),
          message: expect.stringContaining('Suede Chocolate, Linen Navy'),
        }),
      }),
    );
  });

  it('rejects invalid email', async () => {
    const res = await submitSwatchRequest({ ...validSwatch, email: 'bad' });
    expect(res).toEqual({ success: false, message: 'Invalid email address.' });
  });

  it('handles non-array swatchNames by defaulting to empty array', async () => {
    const res = await submitSwatchRequest({ ...validSwatch, swatchNames: 'single' });
    expect(res.success).toBe(true);
    const call = mockEmailContact.mock.calls[0];
    // cleanSwatches would be [] since 'single' is not an array
    expect(call[2].variables.message).toContain('Swatches requested:');
  });

  it('sends customer confirmation email when contact found', async () => {
    const contactItem = { _id: 'contact-456' };
    mockQueryContacts.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn(async () => ({ items: [contactItem] })),
    });
    await submitSwatchRequest(validSwatch);
    // Second emailContact call is the confirmation
    expect(mockEmailContact).toHaveBeenCalledTimes(2);
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBTzwh', // cf-obsb: Wix dashboard ID for swatch_confirmation
      'contact-456',
      expect.objectContaining({
        variables: expect.objectContaining({
          customerName: 'Jane Doe',
          productName: 'Kodiak Futon',
          swatchList: 'Suede Chocolate, Linen Navy',
          estimatedArrival: '5-7 business days',
        }),
      }),
    );
  });

  it('does not send confirmation when no contact found', async () => {
    await submitSwatchRequest(validSwatch);
    // Only the owner notification, no confirmation
    expect(mockEmailContact).toHaveBeenCalledTimes(1);
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBU6zD', // dashboard ID for contact_form_submission
      expect.any(String),
      expect.any(Object),
    );
  });

  it('confirmation email failure does NOT fail the overall request', async () => {
    const contactItem = { _id: 'contact-456' };
    mockQueryContacts.mockReturnValueOnce({
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn(async () => ({ items: [contactItem] })),
    });
    // First call (owner notify) succeeds, second call (confirmation) fails
    mockEmailContact
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('confirmation send failed'));
    const res = await submitSwatchRequest(validSwatch);
    expect(res).toEqual({ success: true });
  });

  it('returns fallback phone on main API error', async () => {
    mockEmailContact.mockRejectedValueOnce(new Error('API down'));
    const res = await submitSwatchRequest(validSwatch);
    expect(res.success).toBe(false);
    expect(res.message).toContain('(828) 252-9449');
  });
});

// ── sendSwatchConfirmationEmail ────────────────────────────────

describe('sendSwatchConfirmationEmail', () => {
  it('returns { success: true } on valid send', async () => {
    const res = await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: ['Velvet Teal'],
      productName: 'Monterey Futon',
    });
    expect(res).toEqual({ success: true });
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBTzwh', // cf-obsb: Wix dashboard ID for swatch_confirmation
      'c-100',
      expect.objectContaining({
        variables: expect.objectContaining({
          customerName: 'Jane',
          productName: 'Monterey Futon',
          swatchList: 'Velvet Teal',
        }),
      }),
    );
  });

  it('rejects missing contactId', async () => {
    const res = await sendSwatchConfirmationEmail({
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: ['Velvet Teal'],
      productName: 'Monterey Futon',
    });
    expect(res).toEqual({ success: false, message: 'Customer contact ID is required.' });
    expect(mockEmailContact).not.toHaveBeenCalled();
  });

  it('rejects empty string contactId', async () => {
    const res = await sendSwatchConfirmationEmail({
      contactId: '',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: [],
      productName: 'Monterey',
    });
    expect(res).toEqual({ success: false, message: 'Customer contact ID is required.' });
  });

  it('uses default "5-7 business days" when estimatedDays not provided', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: ['Suede Red'],
      productName: 'Kodiak',
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.estimatedArrival).toBe('5-7 business days');
  });

  it('uses custom estimatedDays when provided', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: ['Suede Red'],
      productName: 'Kodiak',
      estimatedDays: 3,
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.estimatedArrival).toBe('3 business days');
  });

  it('handles empty swatchNames array', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: [],
      productName: 'Kodiak',
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.swatchList).toBe('');
  });

  it('handles non-array swatchNames', async () => {
    await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: 'not-an-array',
      productName: 'Kodiak',
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.swatchList).toBe('');
  });

  it('returns { success: false } on API error without throwing', async () => {
    mockEmailContact.mockRejectedValueOnce(new Error('CRM down'));
    const res = await sendSwatchConfirmationEmail({
      contactId: 'c-100',
      name: 'Jane',
      email: 'jane@test.com',
      swatchNames: ['Velvet'],
      productName: 'Monterey',
    });
    expect(res).toEqual({ success: false, message: 'Failed to send confirmation email.' });
  });
});

// ── sendOrderNotification ──────────────────────────────────────

describe('sendOrderNotification', () => {
  const validOrder = {
    number: 'ORD-10042',
    buyerName: 'Bob Smith',
    total: '$1,299.00',
    lineItems: [{ name: 'Kodiak' }, { name: 'Cover' }],
  };

  it('returns { success: true } on valid order', async () => {
    const res = await sendOrderNotification(validOrder);
    expect(res).toEqual({ success: true });
  });

  it('calls triggeredEmails with correct variables', async () => {
    await sendOrderNotification(validOrder);
    expect(mockEmailContact).toHaveBeenCalledWith(
      'VJBUDr1', // dashboard ID for new_order_notification
      'owner-contact-id-123',
      {
        variables: {
          orderNumber: 'ORD-10042',
          customerName: 'Bob Smith',
          total: '$1,299.00',
          itemCount: '2',
        },
      },
    );
  });

  it('defaults itemCount to "0" when lineItems missing', async () => {
    await sendOrderNotification({
      number: 'ORD-10043',
      buyerName: 'Alice',
      total: '$499.00',
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.itemCount).toBe('0');
  });

  it('defaults itemCount to "0" when lineItems is null', async () => {
    await sendOrderNotification({
      number: 'ORD-10044',
      buyerName: 'Alice',
      total: '$0',
      lineItems: null,
    });
    const call = mockEmailContact.mock.calls[0];
    expect(call[2].variables.itemCount).toBe('0');
  });

  it('returns { success: false } on API error without throwing', async () => {
    mockEmailContact.mockRejectedValueOnce(new Error('triggered email API down'));
    const res = await sendOrderNotification(validOrder);
    expect(res).toEqual({ success: false });
  });

  it('converts itemCount to string', async () => {
    await sendOrderNotification({
      ...validOrder,
      lineItems: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    });
    const call = mockEmailContact.mock.calls[0];
    expect(typeof call[2].variables.itemCount).toBe('string');
    expect(call[2].variables.itemCount).toBe('3');
  });
});
