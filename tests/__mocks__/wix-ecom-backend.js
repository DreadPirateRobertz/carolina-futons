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

let _order = { _id: 'mock-order', number: '1001' };
let _orderError = null;

export const orders = {
  getOrder: async (orderId) => {
    if (_orderError) throw _orderError;
    if (!_order) throw Object.assign(new Error('Order not found'), { code: 404 });
    return { ..._order, _id: orderId };
  },
  listOrders: async () => ({ orders: [] }),
};

/**
 * Set the order returned by getOrder. Pass null to simulate not found.
 * Also clears any error set by __setOrderError.
 */
export function __setOrder(order) {
  _order = order;
  _orderError = null;
}

/**
 * Make ALL subsequent getOrder calls throw until __reset() or __setOrder() is called.
 * (Persistent, not one-shot — unlike the cart mock helpers.)
 */
export function __setOrderError(err) {
  _orderError = err;
}

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
  _order = { _id: 'mock-order', number: '1001' };
  _orderError = null;
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
