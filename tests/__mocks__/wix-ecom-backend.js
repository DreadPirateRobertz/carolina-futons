// Mock for wix-ecom-backend
export const orders = {
  getOrder: async () => ({ _id: 'mock-order', number: '1001' }),
  listOrders: async () => ({ orders: [] }),
};

export const cart = {
  getCurrentCart: async () => ({ lineItems: [] }),
  addProducts: async () => ({}),
};

export function __reset() {}
