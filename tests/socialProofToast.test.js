/**
 * Tests for socialProofToast.js — Social proof toast notification system
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupToast } from '../src/public/socialProofToast.js';

// Mock the backend imports
vi.mock('backend/socialProof.web', () => ({
  getProductSocialProof: vi.fn(),
  getCategorySocialProof: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

describe('cleanupToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when called with no active timer', () => {
    expect(() => cleanupToast()).not.toThrow();
  });

  it('can be called multiple times safely', () => {
    cleanupToast();
    cleanupToast();
    cleanupToast();
  });
});

// Test initProductSocialProof via dynamic import to get fresh module state
describe('initProductSocialProof', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does nothing when productId is null/empty', async () => {
    await initProductSocialProof(() => null, null);
    await initProductSocialProof(() => null, '');
    expect(getProductSocialProof).not.toHaveBeenCalled();
  });

  it('calls backend with productId', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [],
      config: { maxPerSession: 3, minIntervalMs: 5000, autoDismissMs: 8000 },
    });
    await initProductSocialProof(() => null, 'prod-123', 'Test Product');
    expect(getProductSocialProof).toHaveBeenCalledWith('prod-123', 'Test Product');
  });

  it('does nothing when no notifications returned', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [],
      config: { maxPerSession: 3, minIntervalMs: 5000, autoDismissMs: 8000 },
    });
    const $w = vi.fn(() => null);
    await initProductSocialProof($w, 'prod-123');
    vi.advanceTimersByTime(10000);
    // No toast shown — $w not called for toast elements
  });

  it('does not throw when backend errors', async () => {
    getProductSocialProof.mockRejectedValue(new Error('network'));
    await expect(initProductSocialProof(() => null, 'prod-123')).resolves.not.toThrow();
  });
});

describe('initCategorySocialProof', () => {
  let initCategorySocialProof;
  let getCategorySocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initCategorySocialProof = mod.initCategorySocialProof;
    const backend = await import('backend/socialProof.web');
    getCategorySocialProof = backend.getCategorySocialProof;
    getCategorySocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does nothing when categorySlug is null/empty', async () => {
    await initCategorySocialProof(() => null, null);
    await initCategorySocialProof(() => null, '');
    expect(getCategorySocialProof).not.toHaveBeenCalled();
  });

  it('does not throw on backend error', async () => {
    getCategorySocialProof.mockRejectedValue(new Error('fail'));
    await expect(initCategorySocialProof(() => null, 'futon-frames')).resolves.not.toThrow();
  });
});
