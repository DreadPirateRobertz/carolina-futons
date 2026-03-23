// Mock for wix-data-index-service-v2
// Simulates Wix Data index management for tests.

let _indexes = {};     // collectionId -> Index[]
let _createError = null;
let _listError = null;

export function __reset() {
  _indexes = {};
  _createError = null;
  _listError = null;
}

export function __seedIndexes(collectionId, indexList) {
  _indexes[collectionId] = indexList.map(i => ({ ...i }));
}

export function __setCreateError(error) {
  _createError = error;
}

export function __setListError(error) {
  _listError = error;
}

export function __getIndexes(collectionId) {
  return _indexes[collectionId] || [];
}

export const indexes = {
  async listIndexes(collectionId) {
    if (_listError) {
      const err = _listError;
      _listError = null;
      throw err;
    }
    return { indexes: _indexes[collectionId] || [] };
  },

  async createIndex(collectionId, index) {
    if (_createError) {
      const err = _createError;
      _createError = null;
      throw err;
    }
    if (!_indexes[collectionId]) _indexes[collectionId] = [];
    _indexes[collectionId].push({ ...index });
    return { ...index };
  },
};
