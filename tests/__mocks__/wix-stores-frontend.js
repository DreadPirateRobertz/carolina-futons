// Mock for wix-stores-frontend
// Provides product variant lookup, cart events, and product fetch

let _variantsResponse = [];
let _cartChangedCb = null;
let _productMap = {};
let _getProductShouldFail = false;

export function __reset() {
  _variantsResponse = [];
  _cartChangedCb = null;
  _updateShouldFail = false;
  _productMap = {};
  _getProductShouldFail = false;
}

export function __setProductMap(map) {
  _productMap = map;
}

export function __setGetProductShouldFail(val) {
  _getProductShouldFail = val;
}

export function __setVariantsResponse(variants) {
  _variantsResponse = variants;
}

export function __triggerCartChanged() {
  if (_cartChangedCb) _cartChangedCb();
}

let _updateShouldFail = false;

export function __setUpdateShouldFail(val) {
  _updateShouldFail = val;
}

export const products = {
  async getProduct(id) {
    if (_getProductShouldFail) throw new Error('Stores API error');
    return _productMap[id] ?? null;
  },
};

const wixStoresFrontend = {
  async getProductVariants(productId, options) {
    return _variantsResponse;
  },
  products,
  onCartChanged(cb) {
    _cartChangedCb = cb;
  },
  cart: {
    async addProducts(items) {
      return { items };
    },
    async updateLineItemQuantity(cartItemId, quantity) {
      if (_updateShouldFail) throw new Error('Update failed');
      return { cartItemId, quantity };
    },
    async removeProduct(cartItemId) {
      return { removed: cartItemId };
    },
  },
};

export default wixStoresFrontend;
