import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

vi.mock('backend/ups-shipping.web', () => ({
  createShipment: vi.fn(async () => ({
    success: true, trackingNumber: '1Z999AA10123456784',
    labels: [{ trackingNumber: '1Z999AA10123456784', labelBase64: 'base64data', labelFormat: 'PDF' }],
    totalCharge: 12.50,
  })),
  trackShipment: vi.fn(async () => ({
    success: true, trackingNumber: '1Z999AA10123456784', status: 'In Transit',
  })),
}));

import {
  getReturnEligibleOrders, submitReturnRequest, getReturnStatus,
  lookupReturn, submitGuestReturn, getReturnReasons, generateReturnLabel,
  getAdminReturns, updateReturnStatus, processRefund,
} from '../src/backend/returnsService.web.js';

function recentOrder(overrides = {}) {
  return {
    _id: 'order-1',
    number: '10042',
    _createdDate: new Date(),
    paymentStatus: 'PAID',
    buyerInfo: { id: 'member-1', email: 'test@example.com' },
    billingInfo: {
      firstName: 'John', lastName: 'Doe',
      contactDetails: { firstName: 'John', lastName: 'Doe', phone: '8285551234' },
      address: { addressLine1: '100 Main St', city: 'Charlotte', subdivision: 'NC', postalCode: '28202' },
    },
    shippingInfo: {
      shipmentDetails: {
        address: { addressLine1: '100 Main St', city: 'Charlotte', subdivision: 'NC', postalCode: '28202', country: 'US' },
      },
    },
    lineItems: [
      { _id: 'li-1', name: 'Seattle Futon', price: '549', quantity: 1, productId: 'prod-seattle' },
    ],
    ...overrides,
  };
}

describe('Returns Flow', () => {
  beforeEach(() => {
    resetData();
    resetMember();
    __setMember({ _id: 'member-1', loginEmail: 'test@example.com' });
    __seed('Returns', []);
    __seed('Stores/Orders', [recentOrder()]);
  });

  describe('customer return initiation', () => {
    it('lists eligible orders within 30-day window', async () => {
      const { orders } = await getReturnEligibleOrders();
      expect(Array.isArray(orders)).toBe(true);
      expect(orders).toHaveLength(1);
    });

    it('submits return request with reason', async () => {
      const result = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
        details: 'Broken leg on frame',
      });
      expect(result.success).toBe(true);
      expect(result.rmaNumber).toMatch(/^RMA-/);
    });
  });

  describe('guest returns', () => {
    it('allows return without login via order number + email', async () => {
      const result = await submitGuestReturn({
        orderNumber: '10042', email: 'test@example.com',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'damaged_in_shipping',
        details: 'Box was crushed',
      });
      expect(result.success).toBe(true);
      expect(result.rmaNumber).toMatch(/^RMA-/);
    });
  });

  describe('return label', () => {
    it('generates downloadable return label', async () => {
      const ret = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
      });
      const label = await generateReturnLabel(ret.rmaNumber);
      expect(label).toBeDefined();
    });
  });

  describe('admin dashboard', () => {
    it('lists all returns with status filters', async () => {
      const returns = await getAdminReturns({ status: 'pending' });
      expect(returns).toBeDefined();
    });

    it('updates return status', async () => {
      const ret = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'changed_mind',
      });
      const result = await updateReturnStatus(ret.rmaNumber, 'approved');
      expect(result).toBeDefined();
    });

    it('processes refund', async () => {
      const ret = await submitReturnRequest({
        orderId: 'order-1',
        items: [{ lineItemId: 'li-1', quantity: 1 }],
        reason: 'defective',
      });
      const result = await processRefund(ret.rmaNumber);
      expect(result).toBeDefined();
    });
  });
});
