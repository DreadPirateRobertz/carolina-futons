// Mock wix-marketing-backend for vitest
import { vi } from 'vitest';

let mockCoupons = [];

export const coupons = {
  createCoupon: vi.fn((data) => Promise.resolve({ _id: 'coupon-mock-1', code: data.code, ...data })),
  queryAllCoupons: vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    find: vi.fn(() => Promise.resolve({ items: mockCoupons })),
  })),
};

export function __setCoupons(c) { mockCoupons = c; }
export function __reset() {
  mockCoupons = [];
  coupons.createCoupon.mockClear();
}
