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
  validateEmail: (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  },
}));

let _emailsSent = [];
let _contactsQueryResult = { items: [] };
vi.mock('wix-crm-backend', () => ({
  triggeredEmails: {
    emailContact: vi.fn(async (templateId, contactId, opts) => {
      _emailsSent.push({ templateId, contactId, opts });
    }),
  },
  contacts: {
    queryContacts: () => ({
      eq: () => ({
        limit: () => ({
          find: async () => _contactsQueryResult,
        }),
      }),
    }),
  },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'owner-contact-id'),
}));

let _collections = {};

vi.mock('wix-data', () => ({
  default: {
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}-${Math.random()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _emailsSent = [];
  _contactsQueryResult = { items: [] };
  vi.resetModules();
  mod = await import('../src/backend/emailService.web.js');
});

// ── sendEmail ────────────────────────────────────────────────────

describe('sendEmail', () => {
  it('rejects invalid email', async () => {
    const r = await mod.sendEmail({ name: 'Jane', email: 'bad', message: 'Help' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('sends contact form and persists submission', async () => {
    const r = await mod.sendEmail({
      name: 'Jane Doe', email: 'jane@test.com', phone: '555-1234',
      subject: 'Question', message: 'Need help with my order',
    });
    expect(r.success).toBe(true);
    expect(_emailsSent).toHaveLength(1);
    expect(_emailsSent[0].templateId).toBe('contact_form_submission');
    expect(_emailsSent[0].contactId).toBe('owner-contact-id');
    expect(_emailsSent[0].opts.variables.customerName).toBe('Jane Doe');
    expect(_collections['ContactSubmissions']).toHaveLength(1);
    expect(_collections['ContactSubmissions'][0].status).toBe('new');
  });

  it('strips HTML from inputs', async () => {
    await mod.sendEmail({
      name: '<b>Jane</b>', email: 'jane@test.com', message: '<script>alert(1)</script>Help',
    });
    expect(_collections['ContactSubmissions'][0].name).toBe('Jane');
    expect(_collections['ContactSubmissions'][0].message).not.toContain('<script>');
  });
});

// ── submitSwatchRequest ──────────────────────────────────────────

describe('submitSwatchRequest', () => {
  it('rejects invalid email', async () => {
    const r = await mod.submitSwatchRequest({
      name: 'Jane', email: 'bad', address: '123 Main', productName: 'Futon', swatchNames: ['Red'],
    });
    expect(r.success).toBe(false);
  });

  it('submits swatch request and notifies owner', async () => {
    const r = await mod.submitSwatchRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main St',
      productId: 'p1', productName: 'Classic Futon', swatchNames: ['Red Suede', 'Blue Twill'],
    });
    expect(r.success).toBe(true);
    expect(_collections['ContactSubmissions']).toHaveLength(1);
    expect(_collections['ContactSubmissions'][0].status).toBe('swatch_request');
    expect(_emailsSent.length).toBeGreaterThanOrEqual(1);
    expect(_emailsSent[0].opts.variables.subject).toContain('Swatch Request');
  });

  it('sends customer confirmation if contact exists', async () => {
    _contactsQueryResult = { items: [{ _id: 'customer-contact-id' }] };
    await mod.submitSwatchRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main St',
      productName: 'Futon', swatchNames: ['Red'],
    });
    // Should have 2 emails: owner notification + customer confirmation
    expect(_emailsSent).toHaveLength(2);
    expect(_emailsSent[1].templateId).toBe('VJBTzwh'); // cf-obsb: Wix dashboard ID
    expect(_emailsSent[1].contactId).toBe('customer-contact-id');
  });
});

// ── sendSwatchConfirmationEmail ──────────────────────────────────

describe('sendSwatchConfirmationEmail', () => {
  it('rejects missing contactId', async () => {
    const r = await mod.sendSwatchConfirmationEmail({
      name: 'Jane', swatchNames: ['Red'], productName: 'Futon',
    });
    expect(r.success).toBe(false);
  });

  it('sends confirmation email with defaults', async () => {
    const r = await mod.sendSwatchConfirmationEmail({
      contactId: 'c1', name: 'Jane', swatchNames: ['Red', 'Blue'], productName: 'Futon',
    });
    expect(r.success).toBe(true);
    expect(_emailsSent[0].opts.variables.estimatedArrival).toBe('5-7 business days');
  });

  it('uses custom estimated days', async () => {
    await mod.sendSwatchConfirmationEmail({
      contactId: 'c1', name: 'Jane', swatchNames: ['Red'], productName: 'Futon', estimatedDays: 3,
    });
    expect(_emailsSent[0].opts.variables.estimatedArrival).toBe('3 business days');
  });
});

// ── sendOrderNotification ────────────────────────────────────────

describe('sendOrderNotification', () => {
  it('sends order notification', async () => {
    const r = await mod.sendOrderNotification({
      number: 'ORD-123', buyerName: 'Jane Doe', total: '$1,299.00',
      lineItems: [{ name: 'Futon' }, { name: 'Cover' }],
    });
    expect(r.success).toBe(true);
    expect(_emailsSent[0].templateId).toBe('new_order_notification');
    expect(_emailsSent[0].opts.variables.orderNumber).toBe('ORD-123');
    expect(_emailsSent[0].opts.variables.itemCount).toBe('2');
  });

  it('handles missing lineItems', async () => {
    const r = await mod.sendOrderNotification({ number: 'ORD-1', buyerName: 'Jane', total: '$100' });
    expect(r.success).toBe(true);
    expect(_emailsSent[0].opts.variables.itemCount).toBe('0');
  });
});
