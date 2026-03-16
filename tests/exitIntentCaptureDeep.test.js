/**
 * Deep coverage tests for exitIntentCapture.js — edge cases in path exclusion,
 * sessionStorage failures, email validation boundaries, scroll detection,
 * and config immutability.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldShowExitIntent,
  markExitIntentShown,
  validateCaptureEmail,
  getExitIntentConfig,
  getMobileExitIntentConfig,
  detectScrollExit,
  submitExitCapture,
  SCROLL_EXIT_VELOCITY_THRESHOLD,
  EXIT_INTENT_STORAGE_KEY,
} from '../src/public/exitIntentCapture.js';

// ── Path exclusion edge cases ──────────────────────────────────────

describe('shouldShowExitIntent — path edge cases', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
  });

  it('excludes paths containing "cart" as substring (e.g. /cartographer)', () => {
    // This is the actual behavior — substring match, not exact
    expect(shouldShowExitIntent('/cartographer')).toBe(false);
  });

  it('excludes path with query params containing excluded word', () => {
    expect(shouldShowExitIntent('/products?redirect=checkout')).toBe(false);
  });

  it('excludes path with hash fragment containing excluded word', () => {
    expect(shouldShowExitIntent('/page#cart')).toBe(false);
  });

  it('allows path that does not contain excluded substrings', () => {
    expect(shouldShowExitIntent('/category/bedroom')).toBe(true);
  });

  it('allows path with partial non-matching overlap', () => {
    expect(shouldShowExitIntent('/car')).toBe(true);
  });

  it('handles very long paths', () => {
    const longPath = '/' + 'a'.repeat(10000);
    expect(shouldShowExitIntent(longPath)).toBe(true);
  });

  it('throws for numeric path input (no toLowerCase on number)', () => {
    // (12345 || '').toLowerCase() throws — number is truthy, no fallback
    expect(() => shouldShowExitIntent(12345)).toThrow();
  });
});

// ── SessionStorage unavailability ──────────────────────────────────

describe('shouldShowExitIntent — sessionStorage failure', () => {
  it('allows showing when sessionStorage.getItem throws', () => {
    const origStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      clear: () => {},
    };

    expect(shouldShowExitIntent('/')).toBe(true);

    globalThis.sessionStorage = origStorage;
  });

  it('markExitIntentShown does not throw when sessionStorage.setItem throws', () => {
    const origStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceeded'); },
      clear: () => {},
    };

    expect(() => markExitIntentShown()).not.toThrow();

    globalThis.sessionStorage = origStorage;
  });
});

// ── Email validation edge cases ────────────────────────────────────

describe('validateCaptureEmail — edge cases', () => {
  it('rejects email without TLD (user@domain)', () => {
    expect(validateCaptureEmail('user@domain')).toBe(false);
  });

  it('accepts email with consecutive dots in local part', () => {
    // Regex ^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$ allows this
    expect(validateCaptureEmail('user..name@test.com')).toBe(true);
  });

  it('rejects email with space in middle', () => {
    expect(validateCaptureEmail('user name@test.com')).toBe(false);
  });

  it('rejects email with angle brackets', () => {
    expect(validateCaptureEmail('<user>@test.com')).toBe(false);
    expect(validateCaptureEmail('user@<test>.com')).toBe(false);
  });

  it('accepts email with dots in domain', () => {
    expect(validateCaptureEmail('user@sub.domain.example.com')).toBe(true);
  });

  it('accepts email with hyphen in domain', () => {
    expect(validateCaptureEmail('user@my-domain.com')).toBe(true);
  });

  it('accepts email with numbers in local part', () => {
    expect(validateCaptureEmail('user123@test.com')).toBe(true);
  });

  it('rejects non-string input (number)', () => {
    expect(validateCaptureEmail(42)).toBe(false);
  });

  it('rejects non-string input (boolean)', () => {
    expect(validateCaptureEmail(true)).toBe(false);
  });

  it('rejects non-string input (object)', () => {
    expect(validateCaptureEmail({ email: 'a@b.com' })).toBe(false);
  });

  it('rejects tab character in email', () => {
    expect(validateCaptureEmail('user\t@test.com')).toBe(false);
  });
});

// ── detectScrollExit edge cases ────────────────────────────────────

describe('detectScrollExit — edge cases', () => {
  it('returns false for string input', () => {
    expect(detectScrollExit('fast')).toBe(false);
  });

  it('returns false for boolean input', () => {
    expect(detectScrollExit(true)).toBe(false);
  });

  it('returns true for Infinity', () => {
    expect(detectScrollExit(Infinity)).toBe(true);
  });

  it('returns false for -Infinity', () => {
    expect(detectScrollExit(-Infinity)).toBe(false);
  });

  it('returns false for value just below threshold', () => {
    expect(detectScrollExit(SCROLL_EXIT_VELOCITY_THRESHOLD - 0.001)).toBe(false);
  });

  it('returns true for value just above threshold', () => {
    expect(detectScrollExit(SCROLL_EXIT_VELOCITY_THRESHOLD + 0.001)).toBe(true);
  });

  it('returns true for very large velocity', () => {
    expect(detectScrollExit(999999)).toBe(true);
  });
});

// ── Config immutability ────────────────────────────────────────────

describe('config immutability', () => {
  it('getExitIntentConfig returns fresh object each call', () => {
    const a = getExitIntentConfig();
    const b = getExitIntentConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('modifying returned desktop config does not affect next call', () => {
    const config1 = getExitIntentConfig();
    config1.title = 'HACKED';
    config1.discountCode = 'FAKE';

    const config2 = getExitIntentConfig();
    expect(config2.title).not.toBe('HACKED');
    expect(config2.discountCode).not.toBe('FAKE');
  });

  it('getMobileExitIntentConfig returns fresh object each call', () => {
    const a = getMobileExitIntentConfig();
    const b = getMobileExitIntentConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('modifying mobile config does not affect subsequent calls', () => {
    const config1 = getMobileExitIntentConfig();
    config1.swipeDismissThreshold = 9999;

    const config2 = getMobileExitIntentConfig();
    expect(config2.swipeDismissThreshold).toBe(80);
  });
});

// ── submitExitCapture edge cases ───────────────────────────────────

describe('submitExitCapture — edge cases', () => {
  let mockSubscribe;
  let mockQueueWelcome;

  beforeEach(() => {
    globalThis.sessionStorage.clear();
    mockSubscribe = vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' });
    mockQueueWelcome = vi.fn().mockResolvedValue({ success: true });

    vi.doMock('backend/newsletterService.web', () => ({
      subscribeToNewsletter: mockSubscribe,
      captureExitIntentEmail: mockQueueWelcome,
    }));
  });

  it('rejects email with only spaces', async () => {
    const result = await submitExitCapture('   ');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects email with tabs', async () => {
    const result = await submitExitCapture('\t\t');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects numeric input', async () => {
    const result = await submitExitCapture(42);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects array input', async () => {
    const result = await submitExitCapture(['user@test.com']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('forwards backend result when subscription fails with details', async () => {
    mockSubscribe.mockResolvedValue({ success: false, error: 'already_subscribed', message: 'Already on list' });
    const result = await submitExitCapture('user@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('already_subscribed');
  });
});
