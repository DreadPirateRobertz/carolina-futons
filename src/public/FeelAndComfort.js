/**
 * FeelAndComfort.js — Unified "Feel & Comfort" product page section.
 * Groups comfort story card + fabric swatch preview + swatch request CTA
 * into one cohesive Blue Ridge-themed section.
 */
import { getProductComfort } from 'backend/comfortService.web';
import { getProductSwatches } from 'backend/swatchService.web';
import { renderComfortCard } from 'public/ComfortStoryCards.js';
import { colors } from 'public/designTokens.js';

/**
 * Initialize the unified Feel & Comfort section on the product page.
 * Shows comfort personality card, fabric swatch preview thumbnails,
 * and a prominent "Get Free Swatches" CTA.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Page state with product data.
 */
export async function initFeelAndComfort($w, state) {
  try {
    const section = $w('#feelAndComfortSection');
    if (!state?.product) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    const [comfort, swatches] = await Promise.all([
      getProductComfort(state.product._id).catch(() => null),
      getProductSwatches(state.product._id, null, 6).catch(() => []),
    ]);

    const hasComfort = !!comfort;
    const hasSwatches = swatches && swatches.length > 0;

    if (!hasComfort && !hasSwatches) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    // Section heading + ARIA
    try { $w('#feelAndComfortTitle').text = 'Feel & Comfort'; } catch (e) {}
    try { section.accessibility.ariaLabel = 'Feel and Comfort section'; } catch (e) {}

    // Comfort card sub-section
    if (hasComfort) {
      renderComfortCard($w, comfort);
      try { $w('#comfortSection').expand(); } catch (e) {}
    } else {
      try { $w('#comfortSection').collapse(); } catch (e) {}
    }

    // Swatch preview thumbnails
    if (hasSwatches) {
      try {
        const grid = $w('#feelSwatchPreview');
        if (grid) {
          grid.data = swatches.map((s, i) => ({ ...s, _id: s._id || `fs-${i}` }));
          grid.onItemReady(($item, itemData) => {
            try {
              if (itemData.swatchImage) {
                $item('#feelSwatchThumb').src = itemData.swatchImage;
                $item('#feelSwatchThumb').alt = `${itemData.swatchName} fabric swatch`;
              } else if (itemData.colorHex) {
                $item('#feelSwatchThumb').style.backgroundColor = itemData.colorHex;
              }
            } catch (e) {}
            try { $item('#feelSwatchLabel').text = itemData.swatchName || ''; } catch (e) {}
          });
        }
      } catch (e) {}

      // Swatch CTA — Coral styling
      try {
        const cta = $w('#feelSwatchCTA');
        cta.label = "Can't decide? Get free swatches";
        try { cta.style.backgroundColor = colors.sunsetCoral; } catch (e) {}
        try { cta.style.color = colors.white; } catch (e) {}
        try { cta.accessibility.ariaLabel = 'Request free fabric swatches shipped to your door'; } catch (e) {}
        cta.show();
        cta.onClick(() => {
          try { $w('#swatchRequestSection').expand(); } catch (e) {}
          try { $w('#swatchRequestSection').scrollTo(); } catch (e) {}
        });
      } catch (e) {}
    } else {
      try { $w('#feelSwatchPreview')?.collapse?.(); } catch (e) {}
      try { $w('#feelSwatchCTA').hide(); } catch (e) {}
    }

    section.expand();
  } catch (e) {
    console.error('Error initializing Feel & Comfort section:', e);
    try { $w('#feelAndComfortSection').collapse(); } catch (e2) {}
  }
}
