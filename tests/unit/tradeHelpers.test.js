import { describe, it, expect } from 'vitest';
import {
  getTierBadgeConfig,
  formatInvoiceStatus,
  formatCurrency,
  calculateSavings,
  getAccountManagerDisplay,
  getTaxExemptStatusDisplay,
  getPaymentTermsLabel,
  validateTradeApplication,
} from '../../src/public/tradeHelpers.js';

// ══════════════════════════════════════════════════════════════════════
// getTierBadgeConfig
// ══════════════════════════════════════════════════════════════════════

describe('getTierBadgeConfig', () => {
  it('returns correct config for bronze tier', () => {
    const config = getTierBadgeConfig('bronze');
    expect(config.label).toBe('Bronze');
    expect(config.discount).toBe('10%');
    expect(config).toHaveProperty('color');
  });

  it('returns correct config for silver tier', () => {
    const config = getTierBadgeConfig('silver');
    expect(config.label).toBe('Silver');
    expect(config.discount).toBe('15%');
  });

  it('returns correct config for gold tier', () => {
    const config = getTierBadgeConfig('gold');
    expect(config.label).toBe('Gold');
    expect(config.discount).toBe('20%');
  });

  it('returns correct config for platinum tier', () => {
    const config = getTierBadgeConfig('platinum');
    expect(config.label).toBe('Platinum');
    expect(config.discount).toBe('25%');
  });

  it('returns default config for unknown tier', () => {
    const config = getTierBadgeConfig('diamond');
    expect(config.label).toBe('Trade');
    expect(config.discount).toBe('0%');
  });

  it('handles null/undefined input', () => {
    expect(getTierBadgeConfig(null).label).toBe('Trade');
    expect(getTierBadgeConfig(undefined).label).toBe('Trade');
    expect(getTierBadgeConfig('').label).toBe('Trade');
  });
});

// ══════════════════════════════════════════════════════════════════════
// formatInvoiceStatus
// ══════════════════════════════════════════════════════════════════════

describe('formatInvoiceStatus', () => {
  it('formats pending status', () => {
    const result = formatInvoiceStatus('pending');
    expect(result.label).toBe('Pending');
    expect(result).toHaveProperty('color');
  });

  it('formats paid status', () => {
    const result = formatInvoiceStatus('paid');
    expect(result.label).toBe('Paid');
  });

  it('formats overdue status', () => {
    const result = formatInvoiceStatus('overdue');
    expect(result.label).toBe('Overdue');
  });

  it('formats void status', () => {
    const result = formatInvoiceStatus('void');
    expect(result.label).toBe('Void');
  });

  it('handles unknown status', () => {
    const result = formatInvoiceStatus('unknown');
    expect(result.label).toBe('Unknown');
  });

  it('handles null/undefined', () => {
    expect(formatInvoiceStatus(null).label).toBe('Unknown');
    expect(formatInvoiceStatus(undefined).label).toBe('Unknown');
  });
});

// ══════════════════════════════════════════════════════════════════════
// formatCurrency
// ══════════════════════════════════════════════════════════════════════

describe('formatCurrency', () => {
  it('formats whole dollar amount', () => {
    expect(formatCurrency(5000)).toBe('$5,000.00');
  });

  it('formats cents', () => {
    expect(formatCurrency(49.99)).toBe('$49.99');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
  });

  it('handles non-numeric input', () => {
    expect(formatCurrency('not a number')).toBe('$0.00');
    expect(formatCurrency(null)).toBe('$0.00');
    expect(formatCurrency(undefined)).toBe('$0.00');
  });
});

// ══════════════════════════════════════════════════════════════════════
// calculateSavings
// ══════════════════════════════════════════════════════════════════════

describe('calculateSavings', () => {
  it('calculates savings for bronze tier', () => {
    const result = calculateSavings(500, 10, 10);
    expect(result.originalTotal).toBe(5000);
    expect(result.discountTotal).toBe(4500);
    expect(result.savings).toBe(500);
  });

  it('calculates savings for platinum tier', () => {
    const result = calculateSavings(1000, 5, 25);
    expect(result.originalTotal).toBe(5000);
    expect(result.discountTotal).toBe(3750);
    expect(result.savings).toBe(1250);
  });

  it('returns zero savings with 0% discount', () => {
    const result = calculateSavings(100, 1, 0);
    expect(result.savings).toBe(0);
  });

  it('handles edge case of zero price', () => {
    const result = calculateSavings(0, 10, 10);
    expect(result.savings).toBe(0);
  });

  it('handles edge case of zero quantity', () => {
    const result = calculateSavings(100, 0, 10);
    expect(result.savings).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getAccountManagerDisplay
// ══════════════════════════════════════════════════════════════════════

describe('getAccountManagerDisplay', () => {
  it('returns manager info when available', () => {
    const result = getAccountManagerDisplay({ accountManagerName: 'Sam Wilson', accountManagerEmail: 'sam@cf.com' });
    expect(result.name).toBe('Sam Wilson');
    expect(result.email).toBe('sam@cf.com');
    expect(result.available).toBe(true);
  });

  it('returns unavailable when no manager assigned', () => {
    const result = getAccountManagerDisplay({ accountManagerName: null, accountManagerEmail: null });
    expect(result.available).toBe(false);
  });

  it('handles missing account object', () => {
    const result = getAccountManagerDisplay(null);
    expect(result.available).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getTaxExemptStatusDisplay
// ══════════════════════════════════════════════════════════════════════

describe('getTaxExemptStatusDisplay', () => {
  it('returns verified display', () => {
    const result = getTaxExemptStatusDisplay(true);
    expect(result.label).toBe('Verified');
    expect(result.verified).toBe(true);
  });

  it('returns not-verified display', () => {
    const result = getTaxExemptStatusDisplay(false);
    expect(result.label).toBe('Not Verified');
    expect(result.verified).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// getPaymentTermsLabel
// ══════════════════════════════════════════════════════════════════════

describe('getPaymentTermsLabel', () => {
  it('returns Net-30 for 30 days', () => {
    expect(getPaymentTermsLabel(30)).toBe('Net-30');
  });

  it('returns Net-60 for 60 days', () => {
    expect(getPaymentTermsLabel(60)).toBe('Net-60');
  });

  it('returns default for zero/undefined', () => {
    expect(getPaymentTermsLabel(0)).toBe('Net-30');
    expect(getPaymentTermsLabel(undefined)).toBe('Net-30');
  });
});

// ══════════════════════════════════════════════════════════════════════
// validateTradeApplication
// ══════════════════════════════════════════════════════════════════════

describe('validateTradeApplication', () => {
  it('returns valid for complete application', () => {
    const result = validateTradeApplication({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acme.com',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing required fields', () => {
    const result = validateTradeApplication({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns error for invalid email', () => {
    const result = validateTradeApplication({
      businessName: 'Acme Hotels',
      contactName: 'Jane Doe',
      contactEmail: 'not-an-email',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'contactEmail')).toBe(true);
  });

  it('returns error for empty businessName', () => {
    const result = validateTradeApplication({
      businessName: '',
      contactName: 'Jane Doe',
      contactEmail: 'jane@acme.com',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'businessName')).toBe(true);
  });

  it('returns error for empty contactName', () => {
    const result = validateTradeApplication({
      businessName: 'Acme Hotels',
      contactName: '',
      contactEmail: 'jane@acme.com',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.field === 'contactName')).toBe(true);
  });

  it('handles null input', () => {
    const result = validateTradeApplication(null);
    expect(result.valid).toBe(false);
  });
});
