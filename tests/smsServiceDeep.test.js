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
  validatePhone: (phone) => {
    if (!phone || typeof phone !== 'string') return false;
    return /^\+?1?\d{10,11}$/.test(phone.replace(/[\s()-]/g, ''));
  },
  formatPhoneE164: (phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
  },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (key) => {
    const secrets = { TWILIO_ACCOUNT_SID: 'AC123', TWILIO_AUTH_TOKEN: 'tok123', TWILIO_PHONE_NUMBER: '+18281234567' };
    return secrets[key] || '';
  }),
}));

let _fetchResponse = { ok: true, json: async () => ({ sid: 'SM123' }) };
vi.mock('wix-fetch', () => ({
  fetch: vi.fn(async () => _fetchResponse),
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[`${field}_ge`] = { type: 'ge', field, value: val }; return chain; },
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [key, f] of Object.entries(filters)) {
        if (key === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[key] === f.value);
      }
      const limit = filters._limit || items.length;
      items = items.slice(0, limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    insert: async (collection, item) => {
      const record = { ...item, _id: `ins-${Date.now()}` };
      if (!_collections[collection]) _collections[collection] = [];
      _collections[collection].push(record);
      return record;
    },
    update: async (collection, item) => {
      const col = _collections[collection] || [];
      const idx = col.findIndex(i => i._id === item._id);
      if (idx >= 0) col[idx] = { ...item };
      return item;
    },
  },
}));

let _currentMember = null;
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => _currentMember),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  _currentMember = null;
  _fetchResponse = { ok: true, json: async () => ({ sid: 'SM123' }) };
  vi.resetModules();
  mod = await import('../src/backend/smsService.web.js');
});

describe('sendOrderConfirmationSMS', () => {
  it('rejects missing memberId', async () => {
    const r = await mod.sendOrderConfirmationSMS({});
    expect(r.success).toBe(false);
    expect(r.reason).toBe('invalid_input');
  });

  it('rejects when no preferences', async () => {
    __seed('SMSPreferences', []);
    const r = await mod.sendOrderConfirmationSMS({ memberId: 'm1', orderNumber: 'ORD-1', orderTotal: 499 });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('no_preferences');
  });

  it('rejects when SMS disabled', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: false, phone: '+18281234567' }]);
    const r = await mod.sendOrderConfirmationSMS({ memberId: 'm1', orderNumber: 'ORD-1', orderTotal: 499 });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('sms_disabled');
  });

  it('sends SMS and logs', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', orderConfirmations: true }]);
    __seed('SMSLog', []);
    const r = await mod.sendOrderConfirmationSMS({ memberId: 'm1', orderNumber: 'ORD-1', orderTotal: 499 });
    expect(r.success).toBe(true);
    expect(_collections['SMSLog']).toHaveLength(1);
    expect(_collections['SMSLog'][0].messageType).toBe('order_confirmation');
  });
});

describe('sendShippingUpdateSMS', () => {
  it('sends shipping update with tracking', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', shippingUpdates: true }]);
    __seed('SMSLog', []);
    const r = await mod.sendShippingUpdateSMS({ memberId: 'm1', orderNumber: 'ORD-1', status: 'shipped', trackingNumber: '1Z999' });
    expect(r.success).toBe(true);
    expect(_collections['SMSLog'][0].messageBody).toContain('shipped');
  });
});

describe('sendDeliveryReminderSMS', () => {
  it('sends delivery reminder with time window', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', deliveryReminders: true }]);
    __seed('SMSLog', []);
    const r = await mod.sendDeliveryReminderSMS({ memberId: 'm1', orderNumber: 'ORD-1', deliveryDate: '2026-03-20', timeWindow: 'morning' });
    expect(r.success).toBe(true);
    expect(_collections['SMSLog'][0].messageBody).toContain('morning');
  });
});

describe('sendBackInStockSMS', () => {
  it('sends back-in-stock alert', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', backInStockAlerts: true }]);
    __seed('SMSLog', []);
    const r = await mod.sendBackInStockSMS({ memberId: 'm1', productName: 'Futon Frame', productSlug: 'futon-frame' });
    expect(r.success).toBe(true);
    expect(_collections['SMSLog'][0].messageBody).toContain('back in stock');
  });

  it('respects cooldown', async () => {
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', backInStockAlerts: true }]);
    __seed('SMSLog', [{ memberId: 'm1', messageType: 'back_in_stock', productId: 'p1', sentAt: new Date() }]);
    const r = await mod.sendBackInStockSMS({ memberId: 'm1', productName: 'Futon', productSlug: 'futon', productId: 'p1' });
    expect(r.success).toBe(false);
    expect(r.reason).toBe('cooldown');
  });
});

describe('updateSMSPreferences', () => {
  it('rejects invalid phone', async () => {
    _currentMember = { _id: 'm1' };
    const r = await mod.updateSMSPreferences({ phone: 'bad', smsEnabled: true });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Invalid phone');
  });

  it('inserts new preferences', async () => {
    _currentMember = { _id: 'm1' };
    __seed('SMSPreferences', []);
    const r = await mod.updateSMSPreferences({ phone: '8281234567', smsEnabled: true });
    expect(r.success).toBe(true);
    expect(_collections['SMSPreferences']).toHaveLength(1);
  });

  it('updates existing preferences', async () => {
    _currentMember = { _id: 'm1' };
    __seed('SMSPreferences', [{ _id: 'sp1', memberId: 'm1', phone: '+18281234567', smsEnabled: false }]);
    const r = await mod.updateSMSPreferences({ phone: '8281234567', smsEnabled: true });
    expect(r.success).toBe(true);
  });
});

describe('getSMSPreferences', () => {
  it('returns defaults when no prefs', async () => {
    _currentMember = { _id: 'm1' };
    __seed('SMSPreferences', []);
    const r = await mod.getSMSPreferences();
    expect(r.success).toBe(true);
    expect(r.preferences.smsEnabled).toBe(false);
    expect(r.preferences.orderConfirmations).toBe(true);
  });

  it('returns saved preferences', async () => {
    _currentMember = { _id: 'm1' };
    __seed('SMSPreferences', [{ memberId: 'm1', smsEnabled: true, phone: '+18281234567', orderConfirmations: true, shippingUpdates: false, deliveryReminders: true, backInStockAlerts: false }]);
    const r = await mod.getSMSPreferences();
    expect(r.preferences.smsEnabled).toBe(true);
    expect(r.preferences.shippingUpdates).toBe(false);
  });
});
