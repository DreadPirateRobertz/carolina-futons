import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldShowExitIntent,
  markExitIntentShown,
  markExitIntentDismissed,
  validateCaptureEmail,
  getExitIntentConfig,
  EXIT_INTENT_STORAGE_KEY,
} from '../src/public/exitIntentCapture.js';

// ── shouldShowExitIntent ─────────────────────────────────────────

describe('shouldShowExitIntent', () => {
  it('returns true on a regular page with no prior showing', () => {
    expect(shouldShowExitIntent('/')).toBe(true);
  });

  it('returns true on product pages', () => {
    expect(shouldShowExitIntent('/products/blue-ridge-futon')).toBe(true);
  });

  it('returns false after popup was already shown (sessionStorage)', () => {
    markExitIntentShown();
    expect(shouldShowExitIntent('/')).toBe(false);
  });

  it('returns false on cart page', () => {
    expect(shouldShowExitIntent('/cart')).toBe(false);
  });

  it('returns false on checkout page', () => {
    expect(shouldShowExitIntent('/checkout')).toBe(false);
  });

  it('returns false on thank-you page', () => {
    expect(shouldShowExitIntent('/thank-you')).toBe(false);
  });

  it('returns false on cart path with subpath', () => {
    expect(shouldShowExitIntent('/cart/review')).toBe(false);
  });

  it('returns false on checkout path variants', () => {
    expect(shouldShowExitIntent('/checkout/payment')).toBe(false);
  });

  it('handles empty/null path gracefully', () => {
    expect(shouldShowExitIntent('')).toBe(true);
    expect(shouldShowExitIntent(null)).toBe(true);
    expect(shouldShowExitIntent(undefined)).toBe(true);
  });

  it('is case-insensitive for excluded paths', () => {
    expect(shouldShowExitIntent('/Cart')).toBe(false);
    expect(shouldShowExitIntent('/CHECKOUT')).toBe(false);
  });
});

// ── markExitIntentShown ──────────────────────────────────────────

describe('markExitIntentShown', () => {
  it('sets sessionStorage key', () => {
    markExitIntentShown();
    expect(globalThis.sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY)).toBe('1');
  });

  it('prevents subsequent shouldShowExitIntent from returning true', () => {
    expect(shouldShowExitIntent('/')).toBe(true);
    markExitIntentShown();
    expect(shouldShowExitIntent('/')).toBe(false);
  });
});

// ── markExitIntentDismissed ──────────────────────────────────────

describe('markExitIntentDismissed', () => {
  it('marks as shown so popup does not reappear', () => {
    markExitIntentDismissed();
    expect(shouldShowExitIntent('/')).toBe(false);
  });

  it('sets the storage key same as shown', () => {
    markExitIntentDismissed();
    expect(globalThis.sessionStorage.getItem(EXIT_INTENT_STORAGE_KEY)).toBe('1');
  });
});

// ── validateCaptureEmail ─────────────────────────────────────────

describe('validateCaptureEmail', () => {
  it('accepts valid email', () => {
    expect(validateCaptureEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomains', () => {
    expect(validateCaptureEmail('user@mail.example.com')).toBe(true);
  });

  it('accepts email with plus addressing', () => {
    expect(validateCaptureEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateCaptureEmail('')).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(validateCaptureEmail(null)).toBe(false);
    expect(validateCaptureEmail(undefined)).toBe(false);
  });

  it('rejects whitespace-only', () => {
    expect(validateCaptureEmail('   ')).toBe(false);
  });

  it('rejects email without @', () => {
    expect(validateCaptureEmail('notanemail')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateCaptureEmail('user@')).toBe(false);
  });

  it('rejects email without local part', () => {
    expect(validateCaptureEmail('@example.com')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(validateCaptureEmail('user @test.com')).toBe(false);
  });

  it('rejects email with HTML tags', () => {
    expect(validateCaptureEmail('<script>@test.com')).toBe(false);
  });

  it('trims whitespace before validation', () => {
    expect(validateCaptureEmail('  user@test.com  ')).toBe(true);
  });
});

// ── getExitIntentConfig ──────────────────────────────────────────

describe('getExitIntentConfig', () => {
  it('returns title text', () => {
    const config = getExitIntentConfig();
    expect(config.title).toBeTruthy();
    expect(typeof config.title).toBe('string');
  });

  it('returns subtitle with discount mention', () => {
    const config = getExitIntentConfig();
    expect(config.subtitle).toMatch(/10%/);
  });

  it('returns CTA button text', () => {
    const config = getExitIntentConfig();
    expect(config.ctaText).toBeTruthy();
  });

  it('returns success message with discount code', () => {
    const config = getExitIntentConfig();
    expect(config.successMessage).toMatch(/WELCOME10/);
  });

  it('returns email placeholder text', () => {
    const config = getExitIntentConfig();
    expect(config.emailPlaceholder).toBeTruthy();
  });

  it('returns ARIA label for dialog', () => {
    const config = getExitIntentConfig();
    expect(config.ariaLabel).toBeTruthy();
  });

  it('returns close button ARIA label', () => {
    const config = getExitIntentConfig();
    expect(config.closeAriaLabel).toBeTruthy();
  });
});
