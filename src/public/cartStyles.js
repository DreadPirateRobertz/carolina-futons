/** @module cartStyles - Cart and checkout UI style helpers.
 *
 * Returns design-token-based style objects for cart/checkout components so that
 * Cart Page, Side Cart, and cross-sell cards all render with consistent brand
 * styling. Each function returns a plain object of CSS-ready values (colors,
 * durations, sizes) derived from sharedTokens.
 *
 * All call-to-action (CTA) buttons use sunsetCoral per brand guidelines.
 * Touch targets meet WCAG AA minimum (44px).
 *
 * Dependencies: sharedTokens (colors, transitions, spacing).
 */
import { colors, transitions, spacing } from 'public/sharedTokens.js';

/**
 * Style tokens for cart line items (repeater rows).
 * @returns {{ nameColor: string, variantColor: string, priceColor: string, rowBackground: string, borderColor: string, removeColor: string }}
 */
export function getCartItemStyles() {
  return {
    nameColor: colors.espresso,
    variantColor: colors.espressoLight,
    priceColor: colors.espresso,
    rowBackground: colors.sandLight,
    borderColor: colors.sandDark,
    removeColor: colors.sunsetCoral,
  };
}

/**
 * Style tokens for shipping/tier progress bars.
 * @param {'shipping'|'tier'} type
 * @param {boolean} [qualifies=false] - Whether the threshold is met
 * @returns {{ fillColor: string, trackColor: string, textColor: string, secondaryTextColor: string }}
 */
export function getProgressBarStyles(type, qualifies = false) {
  return {
    fillColor: qualifies ? colors.success : colors.sunsetCoral,
    trackColor: colors.sandDark,
    textColor: colors.espresso,
    secondaryTextColor: colors.mutedBrown,
  };
}

/**
 * Style tokens for empty cart state.
 * @returns {{ headingColor: string, messageColor: string, ctaBackground: string, ctaTextColor: string, pageBackground: string }}
 */
export function getEmptyCartStyles() {
  return {
    headingColor: colors.espresso,
    messageColor: colors.mutedBrown,
    ctaBackground: colors.sunsetCoral,
    ctaTextColor: colors.white,
    pageBackground: colors.offWhite,
  };
}

/**
 * Style tokens for side cart slide-out panel.
 * @returns {{ panelBackground: string, headerColor: string, overlayColor: string, checkoutBtnBackground: string, viewCartLinkColor: string, slideDuration: number }}
 */
export function getSideCartPanelStyles() {
  return {
    panelBackground: colors.offWhite,
    headerColor: colors.espresso,
    overlayColor: colors.overlay,
    checkoutBtnBackground: colors.sunsetCoral,
    viewCartLinkColor: colors.mountainBlue,
    slideDuration: transitions.medium,
  };
}

/**
 * Style tokens for primary checkout/CTA buttons.
 * @returns {{ background: string, textColor: string, hoverBackground: string, disabledBackground: string, minHeight: number }}
 */
export function getCheckoutButtonStyles() {
  return {
    background: colors.sunsetCoral,
    textColor: colors.white,
    hoverBackground: colors.sunsetCoralDark,
    disabledBackground: colors.muted,
    minHeight: 48, // Touch-friendly: exceeds 44px WCAG minimum
  };
}

/**
 * Style tokens for quantity spinner (+/−) controls.
 * @returns {{ buttonColor: string, valueColor: string, borderColor: string, buttonMinSize: number, disabledColor: string }}
 */
export function getQuantitySpinnerStyles() {
  return {
    buttonColor: colors.mountainBlue,
    valueColor: colors.espresso,
    borderColor: colors.sandDark,
    buttonMinSize: 44, // WCAG AA minimum touch target
    disabledColor: colors.muted,
  };
}

/**
 * Style tokens for cross-sell suggestion cards.
 * @returns {{ cardBackground: string, nameColor: string, addBtnBackground: string, addBtnTextColor: string, addedColor: string, priceColor: string }}
 */
export function getCrossSellCardStyles() {
  return {
    cardBackground: colors.sandLight,
    nameColor: colors.espresso,
    addBtnBackground: colors.sunsetCoral,
    addBtnTextColor: colors.white,
    addedColor: colors.success,
    priceColor: colors.mountainBlue,
  };
}
