/**
 * Mock for wix-stores-backend (products namespace).
 * Supports queryProducts() pagination and updateProductFields().
 */
import { vi } from 'vitest';

let _pages = [[]];   // array of product pages; each page is an array of products
let _queryError = null;
let _updateError = null;

export function __reset() {
  _pages = [[]];
  _queryError = null;
  _updateError = null;
}

/** Set a single page of products (convenience wrapper for the common case). */
export function __setProducts(products) {
  _pages = [products];
}

/**
 * Set multiple pages of products to simulate catalog pagination.
 * e.g. __setPages([[...100 products...], [...50 products...]])
 */
export function __setPages(pages) {
  _pages = pages;
}

export function __setQueryError(err) {
  _queryError = err;
}

export function __setUpdateError(err) {
  _updateError = err;
}

function makeQueryResult(pageIndex) {
  const items = _pages[pageIndex] || [];
  const nextIndex = pageIndex + 1;
  const hasMorePages = nextIndex < _pages.length && _pages[nextIndex].length > 0;
  return {
    items,
    length: items.length,
    hasNext: () => hasMorePages,
    next: async () => makeQueryResult(nextIndex),
  };
}

/** Chainable query builder — mirrors the Wix Stores queryProducts() API. */
function makeQueryBuilder(pageIndex = 0) {
  return {
    limit: () => makeQueryBuilder(pageIndex),
    ascending: () => makeQueryBuilder(pageIndex),
    descending: () => makeQueryBuilder(pageIndex),
    eq: () => makeQueryBuilder(pageIndex),
    find: async () => {
      if (_queryError) throw _queryError;
      return makeQueryResult(pageIndex);
    },
  };
}

export const products = {
  queryProducts: vi.fn(() => {
    if (_queryError) throw _queryError;
    return makeQueryBuilder();
  }),

  getProduct: vi.fn(async (id) => {
    if (_queryError) throw _queryError;
    const allProducts = _pages.flat();
    return allProducts.find(p => p._id === id) || null;
  }),

  updateProductFields: vi.fn(async (id, fields) => {
    if (_updateError) throw _updateError;
    return { _id: id, ...fields };
  }),
};
