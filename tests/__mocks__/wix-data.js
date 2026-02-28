// Mock for wix-data
// Provides a chainable query builder that returns controlled results

let _store = {};     // collection -> items[]
let _insertSpy = null;
let _updateSpy = null;
let _removeSpy = null;

// Reset all mock state between tests
export function __reset() {
  _store = {};
  _insertSpy = null;
  _updateSpy = null;
  _removeSpy = null;
}

// Seed a collection with items
export function __seed(collection, items) {
  _store[collection] = items.map(item => ({ ...item }));
}

// Spy on insert/update calls
export function __onInsert(fn) { _insertSpy = fn; }
export function __onUpdate(fn) { _updateSpy = fn; }
export function __onRemove(fn) { _removeSpy = fn; }

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
    gt(field, value) { filters.push(item => (getField(item, field) || 0) > value); return builder; },
    ge(field, value) { filters.push(item => (getField(item, field) || 0) >= value); return builder; },
    lt(field, value) { filters.push(item => (getField(item, field) || 0) < value); return builder; },
    le(field, value) { filters.push(item => (getField(item, field) || 0) <= value); return builder; },
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

      const totalCount = items.length;
      items = items.slice(skipVal, skipVal + limitVal);
      return { items, totalCount, length: items.length };
    },
    async distinct(field) {
      const items = (_store[collection] || []).filter(item =>
        filters.every(f => f(item))
      );
      const values = [...new Set(items.map(item => item[field]).filter(Boolean))];
      return { items: values, totalCount: values.length, length: values.length };
    },
    async count() {
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
};

export default wixData;
export { __reset as reset, __seed as seed };
