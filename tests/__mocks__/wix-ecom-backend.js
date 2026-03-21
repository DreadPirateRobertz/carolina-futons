// Mock for wix-ecom-backend
import { vi } from 'vitest';

let _cart = { lineItems: [], appliedCoupon: null };

export const cart = {
  getCurrentCart: vi.fn(async () => ({ ..._cart })),
  addProducts: vi.fn(async () => ({ ..._cart })),
  applyCoupon: vi.fn(async (code) => {
    _cart = { ..._cart, appliedCoupon: { code } };
    return { ..._cart };
  }),
};

export const orders = {
  getOrder: async () => ({ _id: 'mock-order', number: '1001' }),
  listOrders: async () => ({ orders: [] }),
};

/** Preset cart state (e.g. to simulate an already-applied coupon). */
export function __setCart(c) {
  _cart = { lineItems: [], appliedCoupon: null, ...c };
  cart.getCurrentCart.mockImplementation(async () => ({ ..._cart }));
}

/** Make getCurrentCart throw on the next call. */
export function __setGetCurrentCartError(err) {
  cart.getCurrentCart.mockRejectedValueOnce(err);
}

/** Make addProducts throw on the next call. */
export function __setAddProductsError(err) {
  cart.addProducts.mockRejectedValueOnce(err);
}

/** Make applyCoupon throw on the next call. */
export function __setApplyCouponError(err) {
  cart.applyCoupon.mockRejectedValueOnce(err);
}

export function __reset() {
  _cart = { lineItems: [], appliedCoupon: null };
  cart.getCurrentCart.mockReset();
  cart.addProducts.mockReset();
  cart.applyCoupon.mockReset();
  cart.getCurrentCart.mockImplementation(async () => ({ ..._cart }));
  cart.addProducts.mockImplementation(async () => ({ ..._cart }));
  cart.applyCoupon.mockImplementation(async (code) => {
    _cart = { ..._cart, appliedCoupon: { code } };
    return { ..._cart };
  });
}
