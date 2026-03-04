// crossSellWidget.js — "Complete the Room" cross-sell bundle logic
// Transforms raw product suggestions into room-context bundles with savings.
// Used by Cart Page.js and Side Cart.js to render cross-sell widgets.
import { colors } from 'public/sharedTokens.js';

/** @type {number} Bundle discount rate (5% off when completing the room) */
export const BUNDLE_DISCOUNT_RATE = 0.05;

/** @type {Record<string, string>} Collection slug → room context */
const COLLECTION_ROOM_MAP = {
  'futon-frames': 'living-room',
  'wall-huggers': 'living-room',
  'unfinished-wood': 'living-room',
  'front-loading-nesting': 'living-room',
  'mattresses': 'living-room',
  'murphy-cabinet-beds': 'bedroom',
  'platform-beds': 'bedroom',
  'casegoods-accessories': 'bedroom',
};

/**
 * Determine room context from product collections.
 * Checks living-room collections first (futon-frames, wall-huggers, etc.),
 * then bedroom collections. Defaults to "living-room".
 *
 * @param {string[]|null|undefined} collections - Product collection slugs
 * @returns {'living-room'|'bedroom'} Room context
 */
export function getRoomContext(collections) {
  if (!collections || !Array.isArray(collections) || collections.length === 0) {
    return 'living-room';
  }

  // Check living-room collections first
  const livingRoomSlugs = ['futon-frames', 'wall-huggers', 'unfinished-wood', 'front-loading-nesting'];
  for (const slug of livingRoomSlugs) {
    if (collections.includes(slug)) return 'living-room';
  }

  // Check bedroom collections
  const bedroomSlugs = ['murphy-cabinet-beds', 'platform-beds', 'casegoods-accessories'];
  for (const slug of bedroomSlugs) {
    if (collections.includes(slug)) return 'bedroom';
  }

  return 'living-room';
}

/**
 * Calculate bundle savings for a "Complete the Room" bundle.
 * Applies BUNDLE_DISCOUNT_RATE to the combined total.
 *
 * @param {number} cartSubtotal - Current cart subtotal
 * @param {number} suggestionTotal - Total price of suggested products
 * @returns {{ originalTotal: number, savings: number, bundlePrice: number }}
 */
export function calculateBundleSavings(cartSubtotal, suggestionTotal) {
  const safeCart = Math.max(0, cartSubtotal || 0);
  const safeSuggestion = Math.max(0, suggestionTotal || 0);
  const originalTotal = safeCart + safeSuggestion;
  const savings = Math.round(originalTotal * BUNDLE_DISCOUNT_RATE * 100) / 100;
  const bundlePrice = Math.round((originalTotal - savings) * 100) / 100;

  return { originalTotal, savings, bundlePrice };
}

/**
 * Build room-context bundles from raw suggestion groups.
 * Each bundle includes room context, heading, savings, and product list.
 *
 * @param {Array<{heading: string, products: Array}>|null} suggestions - From getCompletionSuggestions()
 * @param {number} cartSubtotal - Current cart subtotal for savings calculation
 * @returns {Array<{roomContext: string, heading: string, subheading: string, products: Array, originalTotal: number, savings: number, bundlePrice: number, formattedSavings: string, formattedBundlePrice: string}>}
 */
export function buildRoomBundles(suggestions, cartSubtotal) {
  if (!suggestions || !Array.isArray(suggestions)) return [];

  return suggestions
    .filter(group => group.products && group.products.length > 0)
    .map(group => {
      const suggestionTotal = group.products.reduce(
        (sum, p) => sum + (p.price || 0), 0
      );
      const { originalTotal, savings, bundlePrice } = calculateBundleSavings(
        cartSubtotal, suggestionTotal
      );

      // Determine room from suggestion product collections
      const allCollections = group.products.flatMap(p => p.collections || []);
      const roomContext = getRoomContext(allCollections);

      return {
        roomContext,
        heading: 'Complete the Room',
        subheading: group.heading,
        products: group.products,
        originalTotal,
        savings,
        bundlePrice,
        formattedSavings: `$${savings.toFixed(2)}`,
        formattedBundlePrice: formatPrice(bundlePrice),
      };
    });
}

/**
 * Format price with commas and 2 decimal places.
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get style tokens for the cross-sell widget.
 * @returns {{ sectionBackground: string, headingColor: string, subheadingColor: string, savingsBadgeBackground: string, savingsBadgeText: string, cardBackground: string, nameColor: string, priceColor: string, addBtnBackground: string, addBtnText: string, addedColor: string, bundlePriceColor: string, originalPriceColor: string }}
 */
export function getCrossWidgetStyles() {
  return {
    sectionBackground: colors.sandLight,
    headingColor: colors.espresso,
    subheadingColor: colors.espressoLight,
    savingsBadgeBackground: colors.sunsetCoral,
    savingsBadgeText: colors.white,
    cardBackground: colors.white,
    nameColor: colors.espresso,
    priceColor: colors.mountainBlue,
    addBtnBackground: colors.sunsetCoral,
    addBtnText: colors.white,
    addedColor: colors.success,
    bundlePriceColor: colors.sunsetCoral,
    originalPriceColor: colors.mutedBrown,
  };
}

/**
 * Initialize the "Complete the Room" cross-sell widget in a page context.
 * Populates elements and registers event handlers for add-to-cart actions.
 *
 * @param {Function} $w - Wix Velo selector function
 * @param {Object} options
 * @param {Array} options.bundles - Built room bundles from buildRoomBundles()
 * @param {Function} options.addToCart - Cart service addToCart function
 * @param {Function} options.announce - Accessibility announce function
 * @param {Object} options.elements - Element ID map
 * @param {string} options.elements.section - Section container ID
 * @param {string} options.elements.heading - Heading text ID
 * @param {string} options.elements.subheading - Subheading text ID
 * @param {string} options.elements.savingsBadge - Savings badge ID
 * @param {string} options.elements.repeater - Product repeater ID
 * @param {string} options.elements.bundlePrice - Bundle price text ID
 * @param {string} options.elements.originalPrice - Original price text ID
 * @param {Object} options.cardElements - Per-card element ID map
 * @param {string} options.cardElements.image - Product image ID
 * @param {string} options.cardElements.name - Product name ID
 * @param {string} options.cardElements.price - Product price ID
 * @param {string} options.cardElements.addBtn - Add to cart button ID
 * @param {Function} [options.onProductClick] - Callback when product image/name clicked
 * @param {Function} [options.onAdded] - Callback after product added to cart
 */
export function initCrossSellWidget($w, options) {
  const { bundles, addToCart: addFn, announce: announceFn, elements, cardElements } = options;

  if (!bundles || bundles.length === 0) {
    try { $w(elements.section).collapse(); } catch (e) {}
    return;
  }

  const bundle = bundles[0];
  const styles = getCrossWidgetStyles();

  // Section
  try {
    $w(elements.section).expand();
    $w(elements.section).style.backgroundColor = styles.sectionBackground;
  } catch (e) {}

  // Heading
  try {
    $w(elements.heading).text = bundle.heading;
    $w(elements.heading).style.color = styles.headingColor;
  } catch (e) {}

  // Subheading
  try {
    $w(elements.subheading).text = bundle.subheading;
    $w(elements.subheading).style.color = styles.subheadingColor;
  } catch (e) {}

  // Savings badge
  try {
    $w(elements.savingsBadge).text = `Save ${bundle.formattedSavings}`;
    $w(elements.savingsBadge).style.backgroundColor = styles.savingsBadgeBackground;
    $w(elements.savingsBadge).style.color = styles.savingsBadgeText;
    $w(elements.savingsBadge).show();
  } catch (e) {}

  // Bundle price
  try {
    $w(elements.bundlePrice).text = bundle.formattedBundlePrice;
    $w(elements.bundlePrice).style.color = styles.bundlePriceColor;
  } catch (e) {}

  // Original price (strikethrough)
  try {
    $w(elements.originalPrice).text = formatPrice(bundle.originalTotal);
    $w(elements.originalPrice).style.color = styles.originalPriceColor;
  } catch (e) {}

  // Product repeater
  const repeater = $w(elements.repeater);
  if (!repeater) return;

  repeater.onItemReady(($item, product) => {
    try { $item(cardElements.image).src = product.mainMedia; } catch (e) {}
    try { $item(cardElements.image).alt = `${product.name} — add to complete the room`; } catch (e) {}
    try {
      $item(cardElements.name).text = product.name;
      $item(cardElements.name).style.color = styles.nameColor;
    } catch (e) {}
    try {
      $item(cardElements.price).text = product.formattedPrice;
      $item(cardElements.price).style.color = styles.priceColor;
    } catch (e) {}

    // Add to cart button
    try {
      const btn = $item(cardElements.addBtn);
      btn.style.backgroundColor = styles.addBtnBackground;
      btn.style.color = styles.addBtnText;
      btn.accessibility.ariaLabel = `Add ${product.name} to cart`;
      btn.onClick(async () => {
        try {
          btn.disable();
          btn.label = 'Adding...';
          await addFn(product._id);
          btn.label = 'Added!';
          btn.style.backgroundColor = styles.addedColor;
          if (announceFn) announceFn($w, `${product.name} added to cart`);
          if (options.onAdded) options.onAdded(product);
        } catch (err) {
          btn.label = 'Error';
          btn.enable();
        }
      });
    } catch (e) {}

    // Click image/name to navigate
    if (options.onProductClick) {
      try {
        $item(cardElements.image).onClick(() => options.onProductClick(product));
      } catch (e) {}
      try {
        $item(cardElements.name).onClick(() => options.onProductClick(product));
      } catch (e) {}
    }
  });

  repeater.data = bundle.products.map(p => ({ ...p, _id: p._id }));
}
