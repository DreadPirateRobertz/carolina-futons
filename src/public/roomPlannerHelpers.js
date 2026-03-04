/**
 * @module roomPlannerHelpers
 * @description Frontend helpers for the Room Planner page.
 * Static content, room presets, dimension formatting,
 * scale calculations, and product palette grouping.
 */

// Product dimension catalog — mirrors backend roomPlanner.web.js
const PRODUCT_CATALOG = {
  'futon-frame-full': { width: 82, depth: 38, depthBed: 54, label: 'Full Futon Frame', category: 'futon-frames' },
  'futon-frame-queen': { width: 88, depth: 40, depthBed: 60, label: 'Queen Futon Frame', category: 'futon-frames' },
  'futon-frame-twin': { width: 82, depth: 32, depthBed: 39, label: 'Twin Futon Frame', category: 'futon-frames' },
  'futon-wallhugger-full': { width: 82, depth: 38, depthBed: 54, label: 'Full Wall Hugger', category: 'futon-frames' },
  'storage-drawer-full': { width: 75, depth: 20, depthBed: 20, label: 'Storage Drawer (Full)', category: 'storage' },
  'storage-ottoman': { width: 36, depth: 18, depthBed: 18, label: 'Storage Ottoman', category: 'storage' },
  'end-table': { width: 20, depth: 20, depthBed: 20, label: 'End Table', category: 'accessories' },
  'coffee-table': { width: 48, depth: 24, depthBed: 24, label: 'Coffee Table', category: 'accessories' },
};

/**
 * Get static content for the room planner page.
 * @returns {{ hero: Object, instructions: Object }}
 */
export function getRoomPlannerContent() {
  return {
    hero: {
      heading: 'Plan Your Perfect Room',
      subheading: 'Drag, drop, and visualize your furniture layout before you buy',
    },
    instructions: {
      heading: 'How It Works',
      steps: [
        { number: 1, title: 'Set Your Room Size', description: 'Enter your room dimensions or choose a preset to get started.' },
        { number: 2, title: 'Add Furniture', description: 'Drag pieces from the palette onto your room. Rotate and reposition to find the perfect layout.' },
        { number: 3, title: 'Check the Fit', description: 'See exact dimensions and get warnings if something doesn\'t fit.' },
        { number: 4, title: 'Save & Share', description: 'Save your layout to your account or share a link with family.' },
      ],
    },
  };
}

/**
 * Get default room presets for quick setup.
 * Dimensions in inches.
 * @returns {Array<{ name: string, width: number, length: number, shape: string }>}
 */
export function getDefaultRoomPresets() {
  return [
    { name: 'Small Living Room', width: 120, length: 144, shape: 'rectangular' },
    { name: 'Medium Living Room', width: 168, length: 192, shape: 'rectangular' },
    { name: 'Large Living Room', width: 216, length: 264, shape: 'rectangular' },
    { name: 'Studio Apartment', width: 192, length: 240, shape: 'rectangular' },
    { name: 'Guest Room', width: 120, length: 120, shape: 'rectangular' },
    { name: 'Bonus Room', width: 144, length: 168, shape: 'rectangular' },
  ];
}

/**
 * Get room shape dropdown options.
 * @returns {Array<{ value: string, label: string }>}
 */
export function getRoomShapeOptions() {
  return [
    { value: 'rectangular', label: 'Rectangular' },
    { value: 'l-shaped', label: 'L-Shaped' },
    { value: 'custom', label: 'Custom' },
  ];
}

/**
 * Format room dimensions (inches) as human-readable feet/inches.
 * @param {number} widthIn - Width in inches.
 * @param {number} lengthIn - Length in inches.
 * @returns {string} Formatted dimensions, e.g. "10'0\" × 12'0\""
 */
export function formatDimensions(widthIn, lengthIn) {
  if (widthIn <= 0 || lengthIn <= 0) return '';

  const fmtFeetInches = (inches) => {
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    return rem > 0 ? `${ft}'${rem}"` : `${ft}'0"`;
  };

  return `${fmtFeetInches(widthIn)} × ${fmtFeetInches(lengthIn)}`;
}

/**
 * Calculate scale factor (pixels per inch) to fit room in container.
 * @param {number} roomW - Room width in inches.
 * @param {number} roomH - Room height/length in inches.
 * @param {number} containerW - Container width in pixels.
 * @param {number} containerH - Container height in pixels.
 * @returns {number} Scale factor (pixels per inch).
 */
export function calculateScale(roomW, roomH, containerW, containerH) {
  if (roomW <= 0 || roomH <= 0) return 1;
  return Math.min(containerW / roomW, containerH / roomH);
}

/**
 * Get products grouped by category for the drag-and-drop palette.
 * @returns {Array<{ category: string, items: Array }>}
 */
export function getProductPalette() {
  const groups = {};

  for (const [productType, dims] of Object.entries(PRODUCT_CATALOG)) {
    const catLabel = dims.category === 'futon-frames' ? 'Futon Frames'
      : dims.category === 'storage' ? 'Storage'
      : 'Accessories';

    if (!groups[catLabel]) groups[catLabel] = [];
    groups[catLabel].push({
      productType,
      label: dims.label,
      width: dims.width,
      depth: dims.depth,
      depthBed: dims.depthBed,
    });
  }

  return Object.entries(groups).map(([category, items]) => ({ category, items }));
}

/**
 * Format a placement label with dimensions and mode.
 * @param {Object} placement
 * @param {string} [placement.label] - Product label.
 * @param {number} placement.width - Width in inches.
 * @param {number} placement.depth - Depth in inches.
 * @param {boolean} [placement.isBedMode] - Whether in bed mode.
 * @returns {string}
 */
export function formatPlacementLabel(placement) {
  const label = placement.label || 'Furniture';
  const mode = placement.isBedMode ? ' (Bed Mode)' : '';
  return `${label}${mode} — ${placement.width}" × ${placement.depth}"`;
}
