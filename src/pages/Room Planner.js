// Room Planner.js - Interactive Room Layout Tool
// 2D room planner with drag-and-drop furniture placement,
// room presets, dimension visualization, and save/share
import { getProductDimensions, createRoomLayout, addProductToLayout, saveLayout, shareLayout } from 'backend/roomPlanner.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import {
  getRoomPlannerContent,
  getDefaultRoomPresets,
  getRoomShapeOptions,
  getProductPalette,
  getProductList,
  formatProductDims,
  formatDimensions,
  calculateScale,
  formatPlacementLabel,
} from 'public/roomPlannerHelpers.js';
import { initPageSeo } from 'public/pageSeo.js';
import { initMobileRoomPlanner } from 'public/roomPlannerMobile.js';

/** @type {string|null} */
let currentLayoutId = null;

$w.onReady(async function () {
  initBackToTop($w);
  initPageSeo('roomPlanner');
  // CF-7f32: apply mobile layout (collapse desktop panels, enable touch mode on canvas)
  initMobileRoomPlanner($w, { viewportWidth: globalThis.innerWidth });
  initHero();
  initInstructions();
  initRoomDimensionInputs();
  initRoomPresets();
  initRoomShape();
  initProductPalette();
  initPlannerProductRepeater();
  initCanvas();
  initSaveButton();
  initShareButton();
  trackEvent('page_view', { page: 'room-planner' });
});

// ── Hero Section ────────────────────────────────────────────────────

function initHero() {
  try {
    const content = getRoomPlannerContent();
    try { $w('#plannerHeroHeading').text = content.hero.heading; } catch (e) {}
    try { $w('#plannerHeroSubheading').text = content.hero.subheading; } catch (e) {}
  } catch (e) {}
}

// ── Instructions Steps ──────────────────────────────────────────────

function initInstructions() {
  try {
    const content = getRoomPlannerContent();
    const repeater = $w('#plannerStepsRepeater');
    if (!repeater) return;

    try { repeater.accessibility.ariaLabel = 'How to use the room planner'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#stepNumber').text = String(itemData.number); } catch (e) {}
      try { $item('#stepTitle').text = itemData.title; } catch (e) {}
      try { $item('#stepDesc').text = itemData.description; } catch (e) {}
    });
    repeater.data = content.instructions.steps.map((s, i) => ({ ...s, _id: `step-${i}` }));
  } catch (e) {}
}

// ── Room Dimension Inputs ───────────────────────────────────────────

function initRoomDimensionInputs() {
  try {
    const widthInput = $w('#roomWidthInput');
    const lengthInput = $w('#roomLengthInput');

    try { widthInput.accessibility.ariaLabel = 'Room width in inches'; } catch (e) {}
    try { lengthInput.accessibility.ariaLabel = 'Room length in inches'; } catch (e) {}

    const updateDimensionDisplay = () => {
      try {
        const w = parseInt(widthInput.value, 10) || 0;
        const l = parseInt(lengthInput.value, 10) || 0;
        const formatted = formatDimensions(w, l);
        try { $w('#roomDimensionDisplay').text = formatted || '—'; } catch (e) {}
        updateCanvas(w, l);
      } catch (e) {}
    };

    widthInput.onChange(updateDimensionDisplay);
    lengthInput.onChange(updateDimensionDisplay);
  } catch (e) {}
}

// ── Room Presets ────────────────────────────────────────────────────

function initRoomPresets() {
  try {
    const repeater = $w('#roomPresetsRepeater');
    if (!repeater) return;

    const presets = getDefaultRoomPresets();
    try { repeater.accessibility.ariaLabel = 'Room size presets'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#presetName').text = itemData.name; } catch (e) {}
      try {
        const ft = (inches) => `${Math.floor(inches / 12)}'${inches % 12 > 0 ? inches % 12 + '"' : ''}`;
        $item('#presetDims').text = `${ft(itemData.width)} × ${ft(itemData.length)}`;
      } catch (e) {}

      try {
        $item('#presetName').onClick(() => {
          try {
            $w('#roomWidthInput').value = String(itemData.width);
            $w('#roomLengthInput').value = String(itemData.length);
            if (itemData.shape) {
              try { $w('#roomShapeDropdown').value = itemData.shape; } catch (e) {}
            }
            const formatted = formatDimensions(itemData.width, itemData.length);
            try { $w('#roomDimensionDisplay').text = formatted || '—'; } catch (e) {}
            updateCanvas(itemData.width, itemData.length);
          } catch (e) {}
        });
      } catch (e) {}
    });
    repeater.data = presets.map((p, i) => ({ ...p, _id: `preset-${i}` }));
  } catch (e) {}
}

// ── Room Shape Dropdown ─────────────────────────────────────────────

function initRoomShape() {
  try {
    const dropdown = $w('#roomShapeDropdown');
    if (!dropdown) return;

    const shapes = getRoomShapeOptions();
    dropdown.options = shapes.map(s => ({ value: s.value, label: s.label }));
    try { dropdown.value = 'rectangular'; } catch (e) {}
  } catch (e) {}
}

// ── Product Palette ─────────────────────────────────────────────────

function initProductPalette() {
  try {
    const repeater = $w('#productPaletteRepeater');
    if (!repeater) return;

    const palette = getProductPalette();
    try { repeater.accessibility.ariaLabel = 'Furniture pieces to place in your room'; } catch (e) {}
    repeater.onItemReady(($item, itemData) => {
      try { $item('#paletteCategoryName').text = itemData.category; } catch (e) {}
      // Clicking a category adds all its products to the canvas
      try {
        $item('#paletteCategoryName').onClick(() => {
          if (!itemData.items || itemData.items.length === 0) return;
          for (const item of itemData.items) {
            try {
              $w('#plannerCanvas').postMessage({
                type: 'addProduct',
                product: {
                  id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  productType: item.productType,
                  label: item.label,
                  x: 10,
                  y: 10,
                  width: item.width,
                  depth: item.depth,
                  depthBed: item.depthBed || item.depth,
                },
              });
            } catch (e) {}
          }
        });
      } catch (e) {}
    });
    repeater.data = palette.map((g, i) => ({ ...g, _id: `palette-${i}` }));
  } catch (e) {}
}

// ── Planner Product Repeater ─────────────────────────────────────────

function initPlannerProductRepeater() {
  try {
    const repeater = $w('#plannerProductRepeater');
    if (!repeater) return;

    const products = getProductList();
    try { repeater.accessibility.ariaLabel = 'Products to add to your room'; } catch (e) {}

    repeater.onItemReady(($item, itemData) => {
      try { $item('#plannerProductName').text = itemData.label; } catch (e) {}
      try { $item('#plannerProductDims').text = formatProductDims(itemData); } catch (e) {}
      try { $item('#plannerProductCategory').text = itemData.categoryLabel; } catch (e) {}

      try {
        $item('#plannerAddBtn').onClick(() => {
          try {
            $w('#plannerCanvas').postMessage({
              type: 'addProduct',
              product: {
                id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                productType: itemData.productType,
                label: itemData.label,
                x: 10,
                y: 10,
                width: itemData.width,
                depth: itemData.depth,
                depthBed: itemData.depthBed,
              },
            });
            trackEvent('room_planner_add_product', { productType: itemData.productType });
          } catch (e) {}
        });
      } catch (e) {}
    });

    repeater.data = products.map((p, i) => ({ ...p, _id: `product-${i}` }));
  } catch (e) {}
}

// ── Canvas / Planner Area ───────────────────────────────────────────

function initCanvas() {
  try {
    const canvas = $w('#plannerCanvas');
    if (!canvas) return;

    // Listen for product position updates from the canvas embed
    canvas.onMessage((event) => {
      try {
        if (event.data && event.data.type === 'canvasUpdate') {
          const products = event.data.products || [];
          const unfitting = products.filter(p => !p.fits);
          if (unfitting.length > 0) {
            try { $w('#plannerStatusText').text = `${unfitting.length} piece(s) outside room bounds`; } catch (e) {}
          } else if (products.length > 0) {
            try { $w('#plannerStatusText').text = `${products.length} piece(s) placed — all fit!`; } catch (e) {}
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
}

/**
 * Send updated room dimensions to the planner canvas.
 * @param {number} widthIn - Room width in inches.
 * @param {number} lengthIn - Room length in inches.
 */
function updateCanvas(widthIn, lengthIn) {
  try {
    const canvas = $w('#plannerCanvas');
    if (!canvas) return;
    const scale = calculateScale(widthIn, lengthIn, 600, 400);
    canvas.postMessage({
      type: 'updateRoom',
      roomWidth: widthIn,
      roomLength: lengthIn,
      scale,
    });
  } catch (e) {}
}

// ── Save Layout ─────────────────────────────────────────────────────

function initSaveButton() {
  try {
    const saveBtn = $w('#saveLayoutBtn');
    try { saveBtn.accessibility.ariaLabel = 'Save room layout'; } catch (e) {}

    saveBtn.onClick(async () => {
      try {
        const name = ($w('#layoutNameInput').value || '').trim();
        const roomWidth = parseInt($w('#roomWidthInput').value, 10) || 0;
        const roomLength = parseInt($w('#roomLengthInput').value, 10) || 0;
        const roomShape = $w('#roomShapeDropdown').value || 'rectangular';

        if (currentLayoutId) {
          const result = await saveLayout(currentLayoutId, { name, roomWidth, roomLength });
          try {
            $w('#plannerStatusText').text = result.success
              ? 'Layout saved successfully!'
              : (result.error || 'Failed to save layout.');
          } catch (e) {}
        } else {
          const result = await createRoomLayout({ name, roomWidth, roomLength, roomShape });
          if (result.success) {
            currentLayoutId = result.id;
            try { $w('#plannerStatusText').text = 'Layout saved successfully!'; } catch (e) {}
          } else {
            try { $w('#plannerStatusText').text = result.error || 'Failed to save layout.'; } catch (e) {}
          }
        }

        trackEvent('room_planner_save', { layoutId: currentLayoutId });
      } catch (e) {
        try { $w('#plannerStatusText').text = 'Error saving layout.'; } catch (err) {}
      }
    });
  } catch (e) {}
}

// ── Share Layout ────────────────────────────────────────────────────

function initShareButton() {
  try {
    const shareBtn = $w('#shareLayoutBtn');
    try { shareBtn.accessibility.ariaLabel = 'Share room layout'; } catch (e) {}

    shareBtn.onClick(async () => {
      try {
        if (!currentLayoutId) {
          try { $w('#plannerStatusText').text = 'Save your layout first before sharing.'; } catch (e) {}
          return;
        }

        const result = await shareLayout(currentLayoutId, true);
        if (result.success && result.shareUrl) {
          try { $w('#shareUrlText').text = result.shareUrl; } catch (e) {}
          try { $w('#plannerStatusText').text = 'Share link created!'; } catch (e) {}
        } else {
          try { $w('#plannerStatusText').text = result.error || 'Failed to create share link.'; } catch (e) {}
        }

        trackEvent('room_planner_share', { layoutId: currentLayoutId });
      } catch (e) {
        try { $w('#plannerStatusText').text = 'Error sharing layout.'; } catch (err) {}
      }
    });
  } catch (e) {}
}
