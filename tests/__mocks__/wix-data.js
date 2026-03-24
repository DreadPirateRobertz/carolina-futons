// Mock for wix-data
// Provides a chainable query builder that returns controlled results

let _store = {};     // collection -> items[]
let _updated = {};   // collection -> items[] (all items passed to update())
let _insertSpy = null;
let _updateSpy = null;
let _removeSpy = null;
let _queryErrors = {};  // collection -> Error to throw on query
let _lastFindOptions = {};  // collection -> options passed to find()
let _lastGetOptions = {};   // collection -> options passed to get()
let _lastUpdateOptions = {}; // collection -> options passed to update()
let _insertErrors = {}; // collection -> Error to throw on insert
let _updateErrors = {}; // collection -> Error to throw on update
let _uniqueFields = {};  // collection -> field name to enforce uniqueness on

// Reset all mock state between tests
export function __reset() {
  _store = {};
  _updated = {};
  _insertSpy = null;
  _updateSpy = null;
  _removeSpy = null;
  _queryErrors = {};
  _insertErrors = {};
  _updateErrors = {};
  _uniqueFields = {};
  _lastFindOptions = {};
  _lastGetOptions = {};
  _lastUpdateOptions = {};
}

// Force the next insert on a collection to throw
export function __setInsertError(collection, error) {
  _insertErrors[collection] = error;
}

// Enforce uniqueness on a single field for a collection.
// Subsequent inserts with a duplicate value for that field throw a
// "duplicate key" error, matching the Wix Data unique-index behaviour.
export function __setUniqueField(collection, field) {
  _uniqueFields[collection] = field;
}

// Force the next update on a collection to throw
export function __setUpdateError(collection, error) {
  _updateErrors[collection] = error;
}

// Force a query error for a specific collection
export function __setQueryError(collection, error) {
  _queryErrors[collection] = error;
}

// Seed a collection with items
export function __seed(collection, items) {
  _store[collection] = items.map(item => ({ ...item }));
}

// Spy on insert/update calls
export function __onInsert(fn) { _insertSpy = fn; }
export function __onUpdate(fn) { _updateSpy = fn; }
export function __onRemove(fn) { _removeSpy = fn; }

// Return all items inserted into a collection (after __seed, includes both seeded + inserted)
// For test assertions: items inserted AFTER __seed appear after the seeded items.
// Use __seed() then call this after the action under test.
export function __getInserted(collection) {
  return _store[collection] || [];
}

// Return all items passed to wixData.update() for a collection
export function __getUpdated(collection) {
  return _updated[collection] || [];
}

// Resolve dot-notation field paths (e.g. "variables.checkoutId")
function getField(item, field) {
  if (!field.includes('.')) return item[field];
  return field.split('.').reduce((obj, key) => obj?.[key], item);
}

function createQueryBuilder(collection) {
  let filters = [];
  let sortField = null;
  let sortDir = 'asc';
  let limitVal = 50;
  let skipVal = 0;

  const builder = {
    eq(field, value) { filters.push(item => getField(item, field) === value); return builder; },
    ne(field, value) { filters.push(item => getField(item, field) !== value); return builder; },
    gt(field, value) { filters.push(item => { const v = getField(item, field); if (v === undefined) return false; return (v ?? 0) > value; }); return builder; },
    ge(field, value) { filters.push(item => { const v = getField(item, field); if (v === undefined) return false; return (v ?? 0) >= value; }); return builder; },
    lt(field, value) { filters.push(item => { const v = getField(item, field); if (v === undefined) return false; return (v ?? 0) < value; }); return builder; },
    le(field, value) { filters.push(item => { const v = getField(item, field); if (v === undefined) return false; return (v ?? 0) <= value; }); return builder; },
    hasSome(field, values) {
      filters.push(item => {
        const v = getField(item, field);
        if (Array.isArray(v)) return v.some(x => values.includes(x));
        return values.includes(v);
      });
      return builder;
    },
    contains(field, value) {
      filters.push(item => {
        const v = getField(item, field);
        if (typeof v === 'string') return v.includes(value);
        if (Array.isArray(v)) return v.some(x => String(x).includes(value));
        return false;
      });
      return builder;
    },
    isNotEmpty(field) {
      filters.push(item => {
        const v = getField(item, field);
        return v !== null && v !== undefined && v !== '';
      });
      return builder;
    },
    isEmpty(field) {
      filters.push(item => {
        const v = getField(item, field);
        return v === null || v === undefined || v === '';
      });
      return builder;
    },
    startsWith(field, value) {
      // Matches items where the field value begins with the given prefix string.
      filters.push(item => {
        const v = getField(item, field);
        return typeof v === 'string' && v.startsWith(value);
      });
      return builder;
    },
    or(subQuery1, subQuery2) {
      // .or() combines two sub-query builders — item passes if either matches
      const f1 = subQuery1 && subQuery1.__getFilters ? subQuery1.__getFilters() : [];
      const f2 = subQuery2 && subQuery2.__getFilters ? subQuery2.__getFilters() : [];
      filters.push(item =>
        (f1.length === 0 || f1.every(f => f(item))) ||
        (f2.length === 0 || f2.every(f => f(item)))
      );
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
    skip(n) { skipVal = n; return builder; },
    limit(n) { limitVal = n; return builder; },
    __getFilters() { return filters; },
    async find(options) {
      _lastFindOptions[collection] = options;
      if (_queryErrors[collection]) throw _queryErrors[collection];
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

      const totalCount = items.length;
      items = items.slice(skipVal, skipVal + limitVal);
      return { items, totalCount, length: items.length };
    },
    async distinct(field) {
      if (_queryErrors[collection]) throw _queryErrors[collection];
      const items = (_store[collection] || []).filter(item =>
        filters.every(f => f(item))
      );
      const values = [...new Set(items.map(item => item[field]).filter(Boolean))];
      return { items: values, totalCount: values.length, length: values.length };
    },
    async count() {
      if (_queryErrors[collection]) throw _queryErrors[collection];
      const items = (_store[collection] || []).filter(item =>
        filters.every(f => f(item))
      );
      return items.length;
    },
  };

  return builder;
}

// Sort builder factory — used by Category Page for dataset.setSort(wixData.sort().ascending('name'))
function createSortBuilder() {
  const builder = {
    ascending(field) { return builder; },
    descending(field) { return builder; },
  };
  return builder;
}

// Filter builder factory — used by Category Page for dataset.setFilter(wixData.filter().contains(...))
function createFilterBuilder() {
  const builder = {
    contains(field, value) { return builder; },
    eq(field, value) { return builder; },
    ne(field, value) { return builder; },
    gt(field, value) { return builder; },
    ge(field, value) { return builder; },
    lt(field, value) { return builder; },
    le(field, value) { return builder; },
    hasSome(field, values) { return builder; },
    not(subBuilder) { return builder; },
  };
  return builder;
}

const wixData = {
  query(collection) {
    return createQueryBuilder(collection);
  },

  sort() {
    return createSortBuilder();
  },

  filter() {
    return createFilterBuilder();
  },

  async get(collection, id, options) {
    _lastGetOptions[collection] = options;
    const items = _store[collection] || [];
    return items.find(item => item._id === id) || null;
  },

  async insert(collection, item) {
    if (_insertErrors[collection]) {
      const err = _insertErrors[collection];
      delete _insertErrors[collection];
      throw err;
    }
    if (!_store[collection]) _store[collection] = [];
    // Always enforce _id uniqueness (Wix Data guarantees this at the DB layer)
    if (item._id !== undefined) {
      const idExists = _store[collection].some(i => i._id === item._id);
      if (idExists) {
        throw new Error(`duplicate key value violates unique constraint on field "_id" in collection "${collection}"`);
      }
    }
    const uniqueField = _uniqueFields[collection];
    if (uniqueField && item[uniqueField] !== undefined) {
      const exists = _store[collection].some(i => i[uniqueField] === item[uniqueField]);
      if (exists) {
        throw new Error(`duplicate key value violates unique constraint on field "${uniqueField}" in collection "${collection}"`);
      }
    }
    const inserted = { ...item, _id: item._id || `mock-${Date.now()}` };
    _store[collection].push(inserted);
    if (_insertSpy) _insertSpy(collection, inserted);
    return inserted;
  },

  async update(collection, item, options) {
    _lastUpdateOptions[collection] = options;
    if (_updateErrors[collection]) {
      const err = _updateErrors[collection];
      delete _updateErrors[collection];
      throw err;
    }
    if (!_store[collection]) _store[collection] = [];
    const idx = _store[collection].findIndex(i => i._id === item._id);
    if (idx >= 0) _store[collection][idx] = { ...item };
    if (!_updated[collection]) _updated[collection] = [];
    _updated[collection].push({ ...item });
    if (_updateSpy) _updateSpy(collection, item);
    return item;
  },

  async remove(collection, id) {
    if (!_store[collection]) _store[collection] = [];
    const idx = _store[collection].findIndex(i => i._id === id);
    if (idx >= 0) {
      const removed = _store[collection].splice(idx, 1)[0];
      if (_removeSpy) _removeSpy(collection, id);
      return removed;
    }
    return null;
  },

  async bulkRemove(collection, ids) {
    if (!_store[collection]) _store[collection] = [];
    const idSet = new Set(ids);
    const removed = _store[collection].filter(i => idSet.has(i._id));
    _store[collection] = _store[collection].filter(i => !idSet.has(i._id));
    if (_removeSpy) {
      for (const item of removed) _removeSpy(collection, item._id);
    }
    return { removed: removed.length };
  },
};

// Return options last passed to find() for a collection (e.g. { suppressAuth: true }).
// Returns undefined if find() has not been called for that collection, or after __reset().
export function __getLastFindOptions(collection) {
  return _lastFindOptions[collection];
}

// Return options last passed to get() for a collection.
export function __getLastGetOptions(collection) {
  return _lastGetOptions[collection];
}

// Return options last passed to update() for a collection.
export function __getLastUpdateOptions(collection) {
  return _lastUpdateOptions[collection];
}

export default wixData;
export { __reset as reset, __seed as seed };
