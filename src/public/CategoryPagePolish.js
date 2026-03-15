// CategoryPagePolish.js — Design token application for Category Page UX
// Centralizes Blue Ridge aesthetic styling: category hero gradients,
// Mountain Blue accents, navy UI text, branded empty states.
import { colors, shadows, transitions, spacing, borderRadius } from 'public/designTokens.js';

/**
 * Style the category hero section with gradient background.
 * Falls back to solid color if gradient is unsupported.
 * @param {Function} $w - Wix selector function
 * @param {string} gradient - CSS gradient string from CATEGORY_CONTENT
 */
export function styleHeroSection($w, gradient) {
  try {
    const hero = $w('#categoryHeroSection');
    if (!hero) return;
    hero.style.backgroundColor = '';
    hero.style.backgroundImage = gradient;
  } catch (e) {
    try {
      const solidColor = gradient?.match(/#[A-Fa-f0-9]{6}/)?.[0] || colors.sandBase;
      $w('#categoryHeroSection').style.backgroundColor = solidColor;
    } catch (e2) {}
  }
}

/**
 * Style the hero title and subtitle with brand colors.
 * @param {Function} $w - Wix selector function
 */
export function styleHeroText($w) {
  try { $w('#categoryHeroTitle').style.color = colors.espresso; } catch (e) {}
  try { $w('#categoryHeroSubtitle').style.color = colors.espressoLight; } catch (e) {}
}

/**
 * Style the sort dropdown with brand tokens.
 * @param {Function} $w - Wix selector function
 */
export function styleSortDropdown($w) {
  try {
    const dropdown = $w('#sortDropdown');
    if (!dropdown) return;
    dropdown.style.borderColor = colors.mountainBlue;
    dropdown.style.borderRadius = borderRadius.button;
  } catch (e) {}
}

/**
 * Style the filter sidebar/drawer with warm tones.
 * @param {Function} $w - Wix selector function
 */
export function styleFilterPanel($w) {
  try { $w('#filterPanel').style.backgroundColor = colors.offWhite; } catch (e) {}
  try { $w('#filterPanel').style.boxShadow = shadows.card; } catch (e) {}

  // Style individual filter section headers
  const filterHeaders = ['#filterCategoryLabel', '#filterBrandLabel', '#filterPriceLabel',
    '#filterSizeLabel', '#filterMaterialLabel', '#filterColorLabel'];
  for (const id of filterHeaders) {
    try { $w(id).style.color = colors.espresso; } catch (e) {}
  }
}

/**
 * Style an active filter chip with brand colors.
 * @param {Object} el - Chip element
 */
export function styleFilterChip(el) {
  if (!el) return;
  try {
    el.style.backgroundColor = colors.mountainBlueLight;
    el.style.color = colors.espresso;
    el.style.borderRadius = borderRadius.pill;
    el.style.transition = transitions.fast;
  } catch (e) {}
}

/**
 * Style the "Clear All Filters" button.
 * @param {Object} el - Button element
 */
export function styleClearFiltersButton(el) {
  if (!el) return;
  try {
    el.style.color = colors.sunsetCoral;
    el.style.borderColor = colors.sunsetCoral;
    el.style.borderRadius = borderRadius.button;
  } catch (e) {}
}

/**
 * Style the quick view modal with brand tokens.
 * @param {Function} $w - Wix selector function
 */
export function styleQuickViewModal($w) {
  try {
    const modal = $w('#quickViewModal');
    if (!modal) return;
    modal.style.boxShadow = shadows.modal;
    modal.style.borderRadius = borderRadius.lg;
    modal.style.backgroundColor = colors.offWhite;
  } catch (e) {}

  // CTA button
  try {
    const btn = $w('#qvAddToCart');
    if (btn) {
      btn.style.backgroundColor = colors.sunsetCoral;
      btn.style.color = colors.espresso;
    }
  } catch (e) {}

  // Price text
  try { $w('#qvPrice').style.color = colors.espresso; } catch (e) {}
}

/**
 * Style the empty state / no matches section.
 * @param {Function} $w - Wix selector function
 */
export function styleEmptyState($w) {
  try { $w('#emptyStateTitle').style.color = colors.espresso; } catch (e) {}
  try { $w('#emptyStateMessage').style.color = colors.espressoLight; } catch (e) {}
  try { $w('#noMatchesTitle').style.color = colors.espresso; } catch (e) {}
  try { $w('#noMatchesMessage').style.color = colors.espressoLight; } catch (e) {}
}

/**
 * Style the result count text.
 * @param {Function} $w - Wix selector function
 */
export function styleResultCount($w) {
  try { $w('#resultCount').style.color = colors.espressoLight; } catch (e) {}
  try { $w('#filterResultCount').style.color = colors.espressoLight; } catch (e) {}
}

/**
 * Style a swatch preview dot with its color.
 * @param {Object} dot - Dot element
 * @param {string} colorHex - Hex color value
 */
export function styleSwatchDot(dot, colorHex) {
  if (!dot) return;
  try {
    dot.style.backgroundColor = colorHex;
    dot.style.borderRadius = '50%';
    dot.style.borderColor = colors.sandDark;
    dot.style.borderWidth = '1px';
  } catch (e) {}
}

/**
 * Style the recently viewed section.
 * @param {Function} $w - Wix selector function
 */
export function styleRecentlyViewed($w) {
  try { $w('#recentlyViewedTitle').style.color = colors.espresso; } catch (e) {}
  try {
    const repeater = $w('#recentlyViewedRepeater');
    if (repeater) {
      repeater.style.display = 'flex';
      repeater.style.flexWrap = 'nowrap';
      repeater.style.gap = spacing.lg;
      repeater.style.overflowX = 'auto';
    }
  } catch (e) {}
}

/**
 * Apply all design tokens to Category Page elements.
 * Called once during page init after sections are wired.
 * @param {Function} $w - Wix selector function
 */
export function applyCategoryPageTokens($w) {
  styleHeroText($w);
  styleSortDropdown($w);
  styleFilterPanel($w);
  styleQuickViewModal($w);
  styleEmptyState($w);
  styleResultCount($w);
  styleRecentlyViewed($w);
}
