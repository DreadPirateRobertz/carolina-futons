/**
 * ComfortStoryCards.js — Comfort level personality cards for product pages
 * and comfort filtering for category pages.
 *
 * Replaces clinical 1-5 firmness scales with illustrated personality
 * descriptions: Plush (sink in), Medium (balanced), Firm (supportive).
 */
import { getComfortLevels, getProductComfort, getComfortProducts } from 'backend/comfortService.web';
import { colors } from 'public/designTokens.js';

/**
 * Icon/label map for comfort levels (used as fallback when illustrations unavailable).
 */
export const COMFORT_ICONS = {
  plush: { icon: '\u2601\uFE0F', label: 'Cloud-soft' },
  medium: { icon: '\u2696\uFE0F', label: 'Balanced' },
  firm: { icon: '\uD83E\uDDF1', label: 'Structured' },
};

/**
 * Render a single comfort card into a repeater item or section.
 * @param {Function} $item - Wix $item or $w scoped to the card container.
 * @param {Object} comfort - Comfort level data from comfortService.
 */
export function renderComfortCard($item, comfort) {
  if (!comfort) return;

  try { $item('#comfortName').text = comfort.name || ''; } catch (e) {}
  try { $item('#comfortTagline').text = comfort.tagline || ''; } catch (e) {}
  try { $item('#comfortDescription').text = comfort.description || ''; } catch (e) {}

  try {
    if (comfort.illustration) {
      $item('#comfortIllustration').src = comfort.illustration;
      $item('#comfortIllustration').alt = comfort.illustrationAlt || `${comfort.name} comfort level illustration`;
    }
  } catch (e) {}
}

/**
 * Initialize the comfort story card on the product page.
 * Shows the product's comfort level with personality description.
 *
 * @param {Function} $w - Wix selector function.
 * @param {Object} state - Page state with product data.
 */
export async function initComfortCards($w, state) {
  try {
    const section = $w('#comfortSection');
    if (!state?.product) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    const comfort = await getProductComfort(state.product._id);
    if (!comfort) {
      try { section.collapse(); } catch (e) {}
      return;
    }

    renderComfortCard($w, comfort);
    section.expand();
  } catch (e) {
    console.error('Error initializing comfort cards:', e);
    try { $w('#comfortSection').collapse(); } catch (e2) {}
  }
}

/**
 * Initialize the comfort filter dropdown on category pages.
 * Populates with Plush/Medium/Firm options and handles onChange
 * to filter products by comfort level.
 *
 * @param {Function} $w - Wix selector function.
 * @returns {Promise<void>}
 */
export async function initComfortFilter($w) {
  try {
    const filter = $w('#comfortFilter');
    const levels = await getComfortLevels();

    filter.options = [
      { label: 'All Comfort Levels', value: '' },
      ...levels.map(l => ({ label: l.name, value: l.slug })),
    ];
    filter.value = '';

    filter.onChange(async () => {
      const slug = filter.value;
      if (!slug) {
        // Reset — show all products (caller handles dataset refresh)
        return;
      }
      const productIds = await getComfortProducts(slug);
      // Emit filtered product IDs for the category page to use
      try { $w('#comfortFilterResults').data = productIds; } catch (e) {}
    });
  } catch (e) {
    console.error('Error initializing comfort filter:', e);
  }
}
