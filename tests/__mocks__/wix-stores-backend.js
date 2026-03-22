/**
 * Mock for wix-stores-backend (products namespace).
 * Supports queryProducts() pagination and updateProductFields().
 */
import { vi } from 'vitest';

let _products = [];
let _queryError = null;
let _updateError = null;

export function __reset() {
  _products = [];
  _queryError = null;
  _updateError = null;
}

export function __setProducts(products) {
  _products = products;
}

export function __setQueryError(err) {
  _queryError = err;
}

export function __setUpdateError(err) {
  _updateError = err;
}

function makeQueryResult(items) {
  return {
    items,
    length: items.length,
    hasNext: () => false,
    next: async () => makeQueryResult([]),
  };
}

/** Chainable query builder — mirrors the Wix Stores queryProducts() API. */
function makeQueryBuilder() {
  return {
    limit: () => makeQueryBuilder(),
    ascending: () => makeQueryBuilder(),
    descending: () => makeQueryBuilder(),
    eq: () => makeQueryBuilder(),
    find: async () => {
      if (_queryError) throw _queryError;
      return makeQueryResult(_products);
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
    return _products.find(p => p._id === id) || null;
  }),

  updateProductFields: vi.fn(async (id, fields) => {
    if (_updateError) throw _updateError;
    return { _id: id, ...fields };
  }),
};
