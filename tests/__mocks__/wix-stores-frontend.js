// Mock for wix-stores-frontend
// Provides product variant lookup and cart events

let _variantsResponse = [];
let _cartChangedCb = null;

export function __reset() {
  _variantsResponse = [];
  _cartChangedCb = null;
}

export function __setVariantsResponse(variants) {
  _variantsResponse = variants;
}

export function __triggerCartChanged() {
  if (_cartChangedCb) _cartChangedCb();
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
  },
};

export default wixStoresFrontend;
