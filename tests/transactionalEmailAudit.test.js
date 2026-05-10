/**
 * @file transactionalEmailAudit.test.js
 * @description Tests for transactional email templates and send functions
 * (order_confirmation, order_shipped, delivery_confirmation) — hq-cys audit.
 *
 * Covers:
 * - getOrderConfirmationTemplate, getOrderShippedTemplate, getDeliveryConfirmationTemplate
 * - sendOrderConfirmation, sendShippingNotification, sendDeliveryConfirmation
 * - TEMPLATE_REGISTRY entries for the three new templates
 * - Event handler wiring (wixEcom_onFulfillmentCreated, wixEcom_onOrderDelivered)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __getEmailLog, __reset as __resetEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  _TEMPLATE_REGISTRY,
} from '../src/backend/emailTemplates.web.js';
import {
  sendOrderConfirmation,
  sendShippingNotification,
  sendDeliveryConfirmation,
} from '../src/backend/emailService.web.js';
import {
  wixEcom_onFulfillmentCreated,
  wixEcom_onOrderDelivered,
} from '../src/backend/emailAutomation.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const ORDER = {
  contactId: 'contact-abc',
  email: 'alice@example.com',
  firstName: 'Alice',
  orderNumber: '12345',
  total: '$1,299.00',
  itemSummary: '1× Blue Ridge Futon Frame',
  estimatedDays: 7,
};

const FULFILLMENT_EVENT = {
  entity: {
    trackingInfo: {
      trackingNumber: 'UPS123456',
      trackingLink: 'https://ups.com/track/UPS123456',
      shippingProvider: 'UPS',
    },
    order: {
      buyerInfo: { email: 'alice@example.com', contactId: 'contact-abc' },
      billingInfo: { firstName: 'Alice' },
      number: '12345',
    },
  },
};

const DELIVERY_EVENT = {
  entity: {
    buyerInfo: { email: 'alice@example.com', contactId: 'contact-abc' },
    billingInfo: { firstName: 'Alice' },
    number: '12345',
  },
};

beforeEach(() => {
  __resetEmailLog();
});

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE_REGISTRY — new transactional entries
// ═══════════════════════════════════════════════════════════════════

describe('TEMPLATE_REGISTRY — transactional templates', () => {
  it('has order_confirmation entry', () => {
    expect(_TEMPLATE_REGISTRY.order_confirmation).toBeDefined();
    expect(_TEMPLATE_REGISTRY.order_confirmation.category).toBe('transactional');
  });

  it('has order_shipped entry', () => {
    expect(_TEMPLATE_REGISTRY.order_shipped).toBeDefined();
    expect(_TEMPLATE_REGISTRY.order_shipped.category).toBe('transactional');
  });

  it('has delivery_confirmation entry', () => {
    expect(_TEMPLATE_REGISTRY.delivery_confirmation).toBeDefined();
    expect(_TEMPLATE_REGISTRY.delivery_confirmation.category).toBe('transactional');
  });

  it('order_confirmation variables include orderNumber, total, email', () => {
    const vars = _TEMPLATE_REGISTRY.order_confirmation.variables;
    expect(vars).toContain('orderNumber');
    expect(vars).toContain('total');
    expect(vars).toContain('email');
  });

  it('order_shipped variables include trackingNumber and trackingUrl', () => {
    const vars = _TEMPLATE_REGISTRY.order_shipped.variables;
    expect(vars).toContain('trackingNumber');
    expect(vars).toContain('trackingUrl');
  });

  it('order_confirmation subject contains {orderNumber} placeholder', () => {
    expect(_TEMPLATE_REGISTRY.order_confirmation.subjectLine).toContain('{orderNumber}');
  });
});

// ═══════════════════════════════════════════════════════════════════
// sendOrderConfirmation
// ═══════════════════════════════════════════════════════════════════

describe('sendOrderConfirmation', () => {
  it('returns success:true on valid order', async () => {
    const result = await sendOrderConfirmation(ORDER);
    expect(result.success).toBe(true);
  });

  it('sends to order_confirmation template', async () => {
    await sendOrderConfirmation(ORDER);
    const log = __getEmailLog();
    expect(log.some(e => e.templateId === 'VJBTjjZ')).toBe(true);
  });

  it('sends to buyer contactId', async () => {
    await sendOrderConfirmation(ORDER);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTjjZ');
    expect(entry.contactId).toBe('contact-abc');
  });

  it('passes orderNumber in variables', async () => {
    await sendOrderConfirmation(ORDER);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTjjZ');
    expect(entry.options.variables.orderNumber).toBe('12345');
  });

  it('passes total in variables', async () => {
    await sendOrderConfirmation(ORDER);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTjjZ');
    expect(entry.options.variables.total).toBe('$1,299.00');
  });

  it('returns success:false when contactId is missing', async () => {
    const result = await sendOrderConfirmation({ ...ORDER, contactId: '' });
    expect(result.success).toBe(false);
  });

  it('returns success:false when email is missing', async () => {
    const result = await sendOrderConfirmation({ ...ORDER, email: '' });
    expect(result.success).toBe(false);
  });

  it('returns success:false when emailContact throws', async () => {
    __failNextEmail();
    const result = await sendOrderConfirmation(ORDER);
    expect(result.success).toBe(false);
  });

  it('returns success:false when called with no args', async () => {
    const result = await sendOrderConfirmation();
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// sendShippingNotification
// ═══════════════════════════════════════════════════════════════════

describe('sendShippingNotification', () => {
  const SHIP = {
    ...ORDER,
    trackingNumber: 'UPS123456',
    trackingUrl: 'https://ups.com/track/UPS123456',
    carrier: 'UPS',
  };

  it('returns success:true on valid order', async () => {
    const result = await sendShippingNotification(SHIP);
    expect(result.success).toBe(true);
  });

  it('sends to order_shipped template', async () => {
    await sendShippingNotification(SHIP);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTpK1');
    expect(entry).toBeDefined();
  });

  it('passes trackingNumber in variables', async () => {
    await sendShippingNotification(SHIP);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTpK1');
    expect(entry.options.variables.trackingNumber).toBe('UPS123456');
  });

  it('passes carrier in variables', async () => {
    await sendShippingNotification(SHIP);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTpK1');
    expect(entry.options.variables.carrier).toBe('UPS');
  });

  it('returns success:false when contactId is missing', async () => {
    const result = await sendShippingNotification({ ...SHIP, contactId: '' });
    expect(result.success).toBe(false);
  });

  it('returns success:false when emailContact throws', async () => {
    __failNextEmail();
    const result = await sendShippingNotification(SHIP);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// sendDeliveryConfirmation
// ═══════════════════════════════════════════════════════════════════

describe('sendDeliveryConfirmation', () => {
  it('returns success:true on valid order', async () => {
    const result = await sendDeliveryConfirmation(ORDER);
    expect(result.success).toBe(true);
  });

  it('sends to delivery_confirmation template', async () => {
    await sendDeliveryConfirmation(ORDER);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTuXp');
    expect(entry).toBeDefined();
    expect(entry.contactId).toBe('contact-abc');
  });

  it('passes orderNumber in variables', async () => {
    await sendDeliveryConfirmation(ORDER);
    const entry = __getEmailLog().find(e => e.templateId === 'VJBTuXp');
    expect(entry.options.variables.orderNumber).toBe('12345');
  });

  it('returns success:false when contactId is missing', async () => {
    const result = await sendDeliveryConfirmation({ ...ORDER, contactId: '' });
    expect(result.success).toBe(false);
  });

  it('returns success:false when emailContact throws', async () => {
    __failNextEmail();
    const result = await sendDeliveryConfirmation(ORDER);
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Event handler wiring
// ═══════════════════════════════════════════════════════════════════

describe('wixEcom_onFulfillmentCreated — UPS parcel', () => {
  it('does not throw on valid UPS fulfillment event', async () => {
    await expect(
      Promise.resolve(wixEcom_onFulfillmentCreated(FULFILLMENT_EVENT))
    ).resolves.not.toThrow();
  });

  it('sends order_shipped template for UPS parcel carrier', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(FULFILLMENT_EVENT));
    // Allow the async import chain to settle
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    expect(log.some(e => e.templateId === 'VJBTpK1')).toBe(true);
  });

  it('does not throw when email is missing from event', () => {
    expect(() => wixEcom_onFulfillmentCreated({ entity: { order: {} } })).not.toThrow();
  });

  it('does not throw on empty event', () => {
    expect(() => wixEcom_onFulfillmentCreated({})).not.toThrow();
  });
});

describe('wixEcom_onFulfillmentCreated — LTL freight routing', () => {
  const makeLTLEvent = (shippingProvider) => ({
    entity: {
      trackingInfo: {
        trackingNumber: '987654321',
        trackingLink: '',
        shippingProvider,
      },
      order: {
        buyerInfo: { email: 'alice@example.com', contactId: 'contact-abc' },
        billingInfo: { firstName: 'Alice' },
        number: '99999',
      },
    },
  });

  it('sends freight_shipped template for XPO carrier', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(makeLTLEvent('XPO Logistics')));
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    expect(log.some(e => e.templateId === 'VJBUKCa')).toBe(true);
    expect(log.every(e => e.templateId !== 'VJBTpK1')).toBe(true);
  });

  it('sends freight_shipped template for Estes carrier', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(makeLTLEvent('Estes Express')));
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    expect(log.some(e => e.templateId === 'VJBUKCa')).toBe(true);
  });

  it('sends freight_shipped template for WWEX carrier', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(makeLTLEvent('WWEX Freight')));
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    expect(log.some(e => e.templateId === 'VJBUKCa')).toBe(true);
  });

  it('freight_shipped email includes proNumber variable', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(makeLTLEvent('XPO')));
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    const freight = log.find(e => e.templateId === 'VJBUKCa');
    expect(freight?.options?.variables?.proNumber).toBe('987654321');
  });

  it('freight_shipped email includes XPO tracking URL', async () => {
    await Promise.resolve(wixEcom_onFulfillmentCreated(makeLTLEvent('XPO')));
    await new Promise(r => setTimeout(r, 100));
    const log = __getEmailLog();
    const freight = log.find(e => e.templateId === 'VJBUKCa');
    expect(freight?.options?.variables?.trackingUrl).toContain('xpo.com');
  });

  it('does not throw on empty event', () => {
    expect(() => wixEcom_onFulfillmentCreated({})).not.toThrow();
  });
});

describe('wixEcom_onOrderDelivered', () => {
  it('does not throw on valid delivery event', async () => {
    await expect(
      Promise.resolve(wixEcom_onOrderDelivered(DELIVERY_EVENT))
    ).resolves.not.toThrow();
  });

  it('does not throw when email is missing from event', () => {
    expect(() => wixEcom_onOrderDelivered({ entity: {} })).not.toThrow();
  });

  it('does not throw on empty event', () => {
    expect(() => wixEcom_onOrderDelivered({})).not.toThrow();
  });
});
