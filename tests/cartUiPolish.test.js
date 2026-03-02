/**
 * Cart UI Polish Tests (cf-6arz)
 * Tests for design token application in Cart Page and Side Cart,
 * brand-consistent styling, mobile touch targets, and ARIA polish.
 */
import { describe, it, expect } from 'vitest';
import { colors, transitions, spacing } from '../src/public/sharedTokens.js';
import {
  getCartItemStyles,
  getProgressBarStyles,
  getEmptyCartStyles,
  getSideCartPanelStyles,
  getCheckoutButtonStyles,
  getQuantitySpinnerStyles,
  getCrossSellCardStyles,
} from '../src/public/cartStyles.js';

// ── Cart Item Styling ──────────────────────────────────────────────

describe('cartStyles: getCartItemStyles', () => {
  it('returns espresso text color for item names', () => {
    const styles = getCartItemStyles();
    expect(styles.nameColor).toBe(colors.espresso);
  });

  it('returns espresso-light color for variant text', () => {
    const styles = getCartItemStyles();
    expect(styles.variantColor).toBe(colors.espressoLight);
  });

  it('returns espresso color for price text', () => {
    const styles = getCartItemStyles();
    expect(styles.priceColor).toBe(colors.espresso);
  });

  it('returns sand-light background for item row', () => {
    const styles = getCartItemStyles();
    expect(styles.rowBackground).toBe(colors.sandLight);
  });

  it('returns sand-dark border color for item separator', () => {
    const styles = getCartItemStyles();
    expect(styles.borderColor).toBe(colors.sandDark);
  });

  it('returns coral color for remove button', () => {
    const styles = getCartItemStyles();
    expect(styles.removeColor).toBe(colors.sunsetCoral);
  });
});

// ── Progress Bar Styling ────────────────────────────────────────────

describe('cartStyles: getProgressBarStyles', () => {
  it('returns coral fill for shipping progress bar', () => {
    const styles = getProgressBarStyles('shipping');
    expect(styles.fillColor).toBe(colors.sunsetCoral);
  });

  it('returns sand-dark track color for shipping bar', () => {
    const styles = getProgressBarStyles('shipping');
    expect(styles.trackColor).toBe(colors.sandDark);
  });

  it('returns success green when shipping qualifies', () => {
    const styles = getProgressBarStyles('shipping', true);
    expect(styles.fillColor).toBe(colors.success);
  });

  it('returns coral fill for tier progress bar', () => {
    const styles = getProgressBarStyles('tier');
    expect(styles.fillColor).toBe(colors.sunsetCoral);
  });

  it('returns espresso text color for progress label', () => {
    const styles = getProgressBarStyles('shipping');
    expect(styles.textColor).toBe(colors.espresso);
  });

  it('returns muted-brown for secondary text', () => {
    const styles = getProgressBarStyles('shipping');
    expect(styles.secondaryTextColor).toBe(colors.mutedBrown);
  });
});

// ── Empty Cart State Styling ────────────────────────────────────────

describe('cartStyles: getEmptyCartStyles', () => {
  it('returns espresso color for heading', () => {
    const styles = getEmptyCartStyles();
    expect(styles.headingColor).toBe(colors.espresso);
  });

  it('returns muted-brown for message text', () => {
    const styles = getEmptyCartStyles();
    expect(styles.messageColor).toBe(colors.mutedBrown);
  });

  it('returns coral for CTA button background', () => {
    const styles = getEmptyCartStyles();
    expect(styles.ctaBackground).toBe(colors.sunsetCoral);
  });

  it('returns white for CTA button text', () => {
    const styles = getEmptyCartStyles();
    expect(styles.ctaTextColor).toBe(colors.white);
  });

  it('returns off-white page background', () => {
    const styles = getEmptyCartStyles();
    expect(styles.pageBackground).toBe(colors.offWhite);
  });
});

// ── Side Cart Panel Styling ─────────────────────────────────────────

describe('cartStyles: getSideCartPanelStyles', () => {
  it('returns off-white panel background', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.panelBackground).toBe(colors.offWhite);
  });

  it('returns espresso header text color', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.headerColor).toBe(colors.espresso);
  });

  it('returns overlay color for backdrop', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.overlayColor).toBe(colors.overlay);
  });

  it('returns coral for checkout button', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.checkoutBtnBackground).toBe(colors.sunsetCoral);
  });

  it('returns mountain-blue for view-cart link', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.viewCartLinkColor).toBe(colors.mountainBlue);
  });

  it('returns slide duration from transitions', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.slideDuration).toBe(transitions.medium);
  });
});

// ── Checkout Button Styling ─────────────────────────────────────────

describe('cartStyles: getCheckoutButtonStyles', () => {
  it('returns coral background for primary CTA', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.background).toBe(colors.sunsetCoral);
  });

  it('returns white text color', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.textColor).toBe(colors.white);
  });

  it('returns coral-dark for hover state', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.hoverBackground).toBe(colors.sunsetCoralDark);
  });

  it('returns muted color for disabled state', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.disabledBackground).toBe(colors.muted);
  });

  it('returns minimum touch target height of 44px', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.minHeight).toBeGreaterThanOrEqual(44);
  });
});

// ── Quantity Spinner Styling ─────────────────────────────────────────

describe('cartStyles: getQuantitySpinnerStyles', () => {
  it('returns mountain-blue for spinner buttons', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.buttonColor).toBe(colors.mountainBlue);
  });

  it('returns espresso for quantity text', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.valueColor).toBe(colors.espresso);
  });

  it('returns sand-dark for spinner border', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.borderColor).toBe(colors.sandDark);
  });

  it('returns minimum touch target size of 44px for buttons', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.buttonMinSize).toBeGreaterThanOrEqual(44);
  });

  it('returns muted color for disabled button state', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.disabledColor).toBe(colors.muted);
  });
});

// ── Cross-Sell Card Styling ──────────────────────────────────────────

describe('cartStyles: getCrossSellCardStyles', () => {
  it('returns sand-light card background', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.cardBackground).toBe(colors.sandLight);
  });

  it('returns espresso text for product name', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.nameColor).toBe(colors.espresso);
  });

  it('returns coral for add-to-cart button', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.addBtnBackground).toBe(colors.sunsetCoral);
  });

  it('returns white text for add button', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.addBtnTextColor).toBe(colors.white);
  });

  it('returns success color for added state', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.addedColor).toBe(colors.success);
  });

  it('returns mountain-blue for price text', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.priceColor).toBe(colors.mountainBlue);
  });
});
