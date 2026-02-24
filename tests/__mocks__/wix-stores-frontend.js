// Mock for wix-stores-frontend
// Provides product variant lookup and cart events

let _variantsResponse = [];
let _cartChangedCb = null;

export function __reset() {
  _variantsResponse = [];
  _cartChangedCb = null;
  _updateShouldFail = false;
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

const wixStoresFrontend = {
  async getProductVariants(productId, options) {
    return _variantsResponse;
  },
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
