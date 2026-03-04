// Room Planner.js - Interactive Room Layout Tool
// 2D room planner with drag-and-drop furniture placement,
// room presets, dimension visualization, and save/share
import { getProductDimensions } from 'backend/roomPlanner.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { makeClickable } from 'public/a11yHelpers.js';
import {
  getRoomPlannerContent,
  getDefaultRoomPresets,
  getRoomShapeOptions,
  getProductPalette,
} from 'public/roomPlannerHelpers.js';

$w.onReady(async function () {
  initBackToTop($w);
  initHero();
  initInstructions();
  initRoomPresets();
  initRoomShape();
  initProductPalette();
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
    });
    repeater.data = palette.map((g, i) => ({ ...g, _id: `palette-${i}` }));
  } catch (e) {}
}
