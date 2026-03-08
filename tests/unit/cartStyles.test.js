/**
 * Tests for cartStyles.js — Cart/checkout UI style token helpers
 */
import { describe, it, expect } from 'vitest';
import { colors, transitions, spacing } from '../../src/public/sharedTokens.js';
import {
  getCartItemStyles,
  getProgressBarStyles,
  getEmptyCartStyles,
  getSideCartPanelStyles,
  getCheckoutButtonStyles,
  getQuantitySpinnerStyles,
  getCrossSellCardStyles,
} from '../../src/public/cartStyles.js';

// ── getCartItemStyles ─────────────────────────────────────────────────

describe('getCartItemStyles', () => {
  it('returns all required style properties', () => {
    const styles = getCartItemStyles();
    expect(styles).toHaveProperty('nameColor');
    expect(styles).toHaveProperty('variantColor');
    expect(styles).toHaveProperty('priceColor');
    expect(styles).toHaveProperty('rowBackground');
    expect(styles).toHaveProperty('borderColor');
    expect(styles).toHaveProperty('removeColor');
  });

  it('uses brand tokens, not hardcoded values', () => {
    const styles = getCartItemStyles();
    expect(styles.nameColor).toBe(colors.espresso);
    expect(styles.removeColor).toBe(colors.sunsetCoral);
    expect(styles.rowBackground).toBe(colors.sandLight);
  });
});

// ── getProgressBarStyles ──────────────────────────────────────────────

describe('getProgressBarStyles', () => {
  it('uses sunsetCoral fill when not qualified', () => {
    const styles = getProgressBarStyles('shipping', false);
    expect(styles.fillColor).toBe(colors.sunsetCoral);
  });

  it('uses success fill when qualified', () => {
    const styles = getProgressBarStyles('shipping', true);
    expect(styles.fillColor).toBe(colors.success);
  });

  it('uses espresso text color', () => {
    const styles = getProgressBarStyles('tier');
    expect(styles.textColor).toBe(colors.espresso);
  });

  it('defaults qualifies to false', () => {
    const styles = getProgressBarStyles('shipping');
    expect(styles.fillColor).toBe(colors.sunsetCoral);
  });
});

// ── getEmptyCartStyles ────────────────────────────────────────────────

describe('getEmptyCartStyles', () => {
  it('uses sunsetCoral for CTA background', () => {
    const styles = getEmptyCartStyles();
    expect(styles.ctaBackground).toBe(colors.sunsetCoral);
  });

  it('uses white for CTA text', () => {
    const styles = getEmptyCartStyles();
    expect(styles.ctaTextColor).toBe(colors.white);
  });

  it('uses offWhite for page background', () => {
    const styles = getEmptyCartStyles();
    expect(styles.pageBackground).toBe(colors.offWhite);
  });
});

// ── getSideCartPanelStyles ────────────────────────────────────────────

describe('getSideCartPanelStyles', () => {
  it('uses sunsetCoral for checkout button', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.checkoutBtnBackground).toBe(colors.sunsetCoral);
  });

  it('uses mountainBlue for view cart link', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.viewCartLinkColor).toBe(colors.mountainBlue);
  });

  it('includes slide duration from transitions', () => {
    const styles = getSideCartPanelStyles();
    expect(styles.slideDuration).toBe(transitions.medium);
    expect(typeof styles.slideDuration).toBe('number');
  });
});

// ── getCheckoutButtonStyles ───────────────────────────────────────────

describe('getCheckoutButtonStyles', () => {
  it('uses sunsetCoral as primary CTA background', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.background).toBe(colors.sunsetCoral);
  });

  it('meets WCAG AA touch target minimum (44px)', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('uses white text on CTA', () => {
    const styles = getCheckoutButtonStyles();
    expect(styles.textColor).toBe(colors.white);
  });
});

// ── getQuantitySpinnerStyles ──────────────────────────────────────────

describe('getQuantitySpinnerStyles', () => {
  it('meets WCAG AA touch target minimum (44px)', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.buttonMinSize).toBeGreaterThanOrEqual(44);
  });

  it('uses mountainBlue for buttons', () => {
    const styles = getQuantitySpinnerStyles();
    expect(styles.buttonColor).toBe(colors.mountainBlue);
  });
});

// ── getCrossSellCardStyles ────────────────────────────────────────────

describe('getCrossSellCardStyles', () => {
  it('uses sunsetCoral for add button', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.addBtnBackground).toBe(colors.sunsetCoral);
  });

  it('uses success color for added state', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.addedColor).toBe(colors.success);
  });

  it('uses mountainBlue for price', () => {
    const styles = getCrossSellCardStyles();
    expect(styles.priceColor).toBe(colors.mountainBlue);
  });
});
