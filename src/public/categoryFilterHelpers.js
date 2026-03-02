/**
 * @module categoryFilterHelpers
 * @description Shared filter state utilities for category page faceted navigation.
 * Handles filter chip generation, URL serialization/deserialization, and
 * filter state manipulation. Pure functions — no $w or DOM dependencies.
 */

/**
 * Sanitize user input — strip HTML tags, decode entities, limit length.
 * @param {*} str - Input to sanitize
 * @param {number} [maxLen=200] - Maximum output length
 * @returns {string} Sanitized string
 */
export function sanitizeFilterInput(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  // Strip script/style tags and their contents first
  let result = str.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  result = result.replace(/<[^>]*>/g, '');
  result = result.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  result = result.replace(/<[^>]*>/g, '');
  return result.trim().slice(0, maxLen);
}

/**
 * Format a hyphenated feature tag into a display label.
 * @param {string} tag - e.g. "wall-hugger"
 * @returns {string} e.g. "Wall Hugger"
 */
export function formatFeatureLabel(tag) {
  if (!tag) return '';
  return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Build an array of filter chip objects from the current filter state.
 * @param {Object} filters - Current filter state
 * @returns {Array<{_id: string, label: string, key: string, value?: string}>}
 */
export function buildFilterChips(filters) {
  if (!filters) return [];
  const chips = [];

  if (filters.material) {
    chips.push({ _id: 'chip-material', label: `Material: ${filters.material}`, key: 'material' });
  }
  if (filters.color) {
    chips.push({ _id: 'chip-color', label: `Color: ${filters.color}`, key: 'color' });
  }
  if (Array.isArray(filters.features) && filters.features.length > 0) {
    filters.features.forEach((f, i) => {
      chips.push({ _id: `chip-feature-${i}`, label: `Feature: ${formatFeatureLabel(f)}`, key: 'features', value: f });
    });
  }
  if (filters.priceRange) {
    chips.push({ _id: 'chip-price', label: `Price: ${filters.priceRange}`, key: 'priceRange' });
  }
  if (filters.brand) {
    chips.push({ _id: 'chip-brand', label: `Brand: ${filters.brand}`, key: 'brand' });
  }
  if (filters.size) {
    chips.push({ _id: 'chip-size', label: `Size: ${filters.size}`, key: 'size' });
  }
  if (filters.comfortLevel) {
    chips.push({ _id: 'chip-comfort', label: `Comfort: ${filters.comfortLevel}`, key: 'comfortLevel' });
  }
  if (filters.widthRange) {
    chips.push({ _id: 'chip-width', label: `Width: ${filters.widthRange[0]}"-${filters.widthRange[1]}"`, key: 'widthRange' });
  }
  if (filters.depthRange) {
    chips.push({ _id: 'chip-depth', label: `Depth: ${filters.depthRange[0]}"-${filters.depthRange[1]}"`, key: 'depthRange' });
  }

  return chips;
}

/**
 * Remove a filter from the state. Returns a new object (does not mutate).
 * @param {Object} filters - Current filter state
 * @param {string} key - Filter key to remove
 * @param {string} [value] - Specific value to remove (for array filters like features)
 * @returns {Object} New filter state
 */
export function removeFilter(filters, key, value) {
  const result = { ...filters };

  if (key === 'features' && value) {
    const remaining = (result.features || []).filter(f => f !== value);
    if (remaining.length === 0) {
      delete result.features;
    } else {
      result.features = remaining;
    }
  } else {
    delete result[key];
  }

  return result;
}

/**
 * Returns an empty filter state.
 * @returns {Object} Empty filters
 */
export function clearAllFilters() {
  return {};
}

/**
 * Serialize filter state to a URL query string.
 * @param {Object} filters - Filter state
 * @returns {string} Query string (without leading ?)
 */
export function serializeFiltersToUrl(filters) {
  if (!filters) return '';
  const params = {};

  if (filters.priceRange) params.price = filters.priceRange;
  if (filters.material) params.material = filters.material;
  if (filters.color) params.color = filters.color;
  if (Array.isArray(filters.features) && filters.features.length > 0) params.features = filters.features.join(',');
  if (filters.widthRange) params.width = filters.widthRange.join('-');
  if (filters.depthRange) params.depth = filters.depthRange.join('-');
  if (filters.brand) params.brand = filters.brand;
  if (filters.price) params.priceDropdown = filters.price;
  if (filters.size) params.size = filters.size;
  if (filters.comfortLevel) params.comfort = filters.comfortLevel;

  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';

  return entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Deserialize URL query params back into filter state.
 * All values are sanitized to prevent XSS from crafted URLs.
 * @param {Object} query - URL query params object
 * @returns {Object} Filter state
 */
export function deserializeFiltersFromUrl(query) {
  if (!query) return {};
  const filters = {};

  if (query.price) filters.priceRange = sanitizeFilterInput(query.price, 20);
  if (query.material) filters.material = sanitizeFilterInput(query.material, 100);
  if (query.color) filters.color = sanitizeFilterInput(query.color, 50);
  if (query.features) {
    filters.features = sanitizeFilterInput(query.features, 500)
      .split(',')
      .map(f => sanitizeFilterInput(f, 50))
      .filter(Boolean);
  }
  if (query.width) {
    const [min, max] = sanitizeFilterInput(query.width, 20).split('-').map(Number);
    if (!isNaN(min) && !isNaN(max)) filters.widthRange = [min, max];
  }
  if (query.depth) {
    const [min, max] = sanitizeFilterInput(query.depth, 20).split('-').map(Number);
    if (!isNaN(min) && !isNaN(max)) filters.depthRange = [min, max];
  }
  if (query.brand) filters.brand = sanitizeFilterInput(query.brand, 100);
  if (query.size) filters.size = sanitizeFilterInput(query.size, 50);
  if (query.comfort) filters.comfortLevel = sanitizeFilterInput(query.comfort, 50);

  return filters;
}
