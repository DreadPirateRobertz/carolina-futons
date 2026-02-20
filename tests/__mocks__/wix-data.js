// Mock for wix-data
// Provides a chainable query builder that returns controlled results

let _store = {};     // collection -> items[]
let _insertSpy = null;
let _updateSpy = null;

// Reset all mock state between tests
export function __reset() {
  _store = {};
  _insertSpy = null;
  _updateSpy = null;
}

// Seed a collection with items
export function __seed(collection, items) {
  _store[collection] = items.map(item => ({ ...item }));
}

// Spy on insert/update calls
export function __onInsert(fn) { _insertSpy = fn; }
export function __onUpdate(fn) { _updateSpy = fn; }

function createQueryBuilder(collection) {
  let filters = [];
  let sortField = null;
  let sortDir = 'asc';
  let limitVal = 50;

  const builder = {
    eq(field, value) { filters.push(item => item[field] === value); return builder; },
    ne(field, value) { filters.push(item => item[field] !== value); return builder; },
    gt(field, value) { filters.push(item => (item[field] || 0) > value); return builder; },
    ge(field, value) { filters.push(item => (item[field] || 0) >= value); return builder; },
    lt(field, value) { filters.push(item => (item[field] || 0) < value); return builder; },
    le(field, value) { filters.push(item => (item[field] || 0) <= value); return builder; },
    hasSome(field, values) {
      filters.push(item => {
        const v = item[field];
        if (Array.isArray(v)) return v.some(x => values.includes(x));
        return values.includes(v);
      });
      return builder;
    },
    not(subQuery) {
      // .not() takes a sub-query builder; we extract its filters and negate
      if (subQuery && subQuery.__getFilters) {
        const subFilters = subQuery.__getFilters();
        filters.push(item => !subFilters.every(f => f(item)));
      }
      return builder;
    },
    ascending(field) { sortField = field; sortDir = 'asc'; return builder; },
    descending(field) { sortField = field; sortDir = 'desc'; return builder; },
    limit(n) { limitVal = n; return builder; },
    __getFilters() { return filters; },
    async find() {
      let items = (_store[collection] || []).filter(item =>
        filters.every(f => f(item))
      );

      if (sortField) {
        items.sort((a, b) => {
          const av = a[sortField], bv = b[sortField];
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });
      }

      items = items.slice(0, limitVal);
      return { items, totalCount: items.length, length: items.length };
    },
  };

  return builder;
}

const wixData = {
  query(collection) {
    return createQueryBuilder(collection);
  },

  async get(collection, id) {
    const items = _store[collection] || [];
    return items.find(item => item._id === id) || null;
  },

  async insert(collection, item) {
    if (!_store[collection]) _store[collection] = [];
    const inserted = { ...item, _id: item._id || `mock-${Date.now()}` };
    _store[collection].push(inserted);
    if (_insertSpy) _insertSpy(collection, inserted);
    return inserted;
  },

  async update(collection, item) {
    if (!_store[collection]) _store[collection] = [];
    const idx = _store[collection].findIndex(i => i._id === item._id);
    if (idx >= 0) _store[collection][idx] = { ...item };
    if (_updateSpy) _updateSpy(collection, item);
    return item;
  },
};

export default wixData;
export { __reset as reset, __seed as seed };
