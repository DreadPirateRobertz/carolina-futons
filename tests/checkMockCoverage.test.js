/**
 * @file checkMockCoverage.test.js
 * @description Tests for the mock coverage CI script (CF-duk7).
 */
import { describe, it, expect } from 'vitest';
import {
  extractImports,
  extractMocks,
  normalizeModuleId,
  needsMock,
} from '../scripts/check-mock-coverage.mjs';

describe('extractImports', () => {
  it('extracts static imports from a real source file', () => {
    const imports = extractImports('src/pages/Checkout.js');
    expect(imports.size).toBeGreaterThan(5);
    expect(imports.has('public/cartService')).toBe(true);
    expect(imports.has('backend/checkoutOptimization.web')).toBe(true);
  });
});

describe('extractMocks', () => {
  it('extracts vi.mock declarations from a test file', () => {
    const mocks = extractMocks('tests/checkout.test.js');
    expect(mocks.size).toBeGreaterThan(5);
    expect(mocks.has('public/cartService')).toBe(true);
  });
});

describe('normalizeModuleId', () => {
  it('strips .js extension', () => {
    expect(normalizeModuleId('public/foo.js')).toBe('public/foo');
  });

  it('preserves paths without extension', () => {
    expect(normalizeModuleId('public/foo')).toBe('public/foo');
  });
});

describe('needsMock', () => {
  it('returns true for public/ modules', () => {
    expect(needsMock('public/cartService')).toBe(true);
  });

  it('returns true for backend/ modules', () => {
    expect(needsMock('backend/paymentOptions.web')).toBe(true);
  });

  it('returns false for wix- platform modules', () => {
    expect(needsMock('wix-data')).toBe(false);
    expect(needsMock('wix-members-backend')).toBe(false);
  });

  it('returns false for wix-web-module', () => {
    expect(needsMock('wix-web-module')).toBe(false);
  });

  it('returns false for relative imports', () => {
    expect(needsMock('../src/pages/Home.js')).toBe(false);
    expect(needsMock('./helpers')).toBe(false);
  });

  it('returns false for utility modules', () => {
    expect(needsMock('backend/utils/sanitize')).toBe(false);
    expect(needsMock('backend/utils/errorHandler')).toBe(false);
    expect(needsMock('backend/utils/rateLimit')).toBe(false);
  });
});
