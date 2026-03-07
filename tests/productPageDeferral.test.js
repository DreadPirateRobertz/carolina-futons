/**
 * @file productPageDeferral.test.js
 * @description Tests that non-critical tracking JS on the Product Page
 * is deferred until after LCP (not statically imported or called in init path).
 *
 * CF-7zl: engagementTracker and ga4Tracking should be dynamically imported
 * in deferred sections, not statically imported at module top level.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const productPageContent = readFileSync('src/pages/Product Page.js', 'utf-8');

describe('Product Page JS deferral — CF-7zl', () => {
  describe('Static imports removed for tracking modules', () => {
    it('does not statically import trackProductPageView from engagementTracker', () => {
      // Static imports happen before any code runs — blocks LCP
      const staticImportPattern = /^import\s+\{[^}]*trackProductPageView[^}]*\}\s+from\s+['"]public\/engagementTracker['"]/m;
      expect(productPageContent).not.toMatch(staticImportPattern);
    });

    it('does not statically import fireViewContent from ga4Tracking', () => {
      const staticImportPattern = /^import\s+\{[^}]*fireViewContent[^}]*\}\s+from\s+['"]public\/ga4Tracking['"]/m;
      expect(productPageContent).not.toMatch(staticImportPattern);
    });
  });

  describe('Tracking calls are deferred (not in init path)', () => {
    it('trackProductPageView is called inside a deferred section or dynamic import', () => {
      // Should appear after an `await import(` or inside a section init function
      const hasDeferred = productPageContent.includes("import('public/engagementTracker')");
      expect(hasDeferred).toBe(true);
    });

    it('fireViewContent is called inside a deferred section or dynamic import', () => {
      const hasDeferred = productPageContent.includes("import('public/ga4Tracking')");
      expect(hasDeferred).toBe(true);
    });
  });

  describe('Tracking is still registered as a section', () => {
    it('has a deferred section for engagement tracking', () => {
      // Should be in the sections array with critical: false
      expect(productPageContent).toMatch(/name:\s*['"]engagementTracking['"]/);
      expect(productPageContent).toMatch(/engagementTracking['"],\s*init:.*critical:\s*false/s);
    });

    it('has a deferred section for GA4 tracking', () => {
      expect(productPageContent).toMatch(/name:\s*['"]ga4Tracking['"]/);
      expect(productPageContent).toMatch(/ga4Tracking['"],\s*init:.*critical:\s*false/s);
    });
  });

  describe('Critical product operations remain in init path', () => {
    it('trackProductView (gallery recently-viewed) stays in init path', () => {
      // trackProductView is from galleryHelpers and populates recently viewed —
      // it's lightweight and needed for cross-sell sections below
      expect(productPageContent).toMatch(/trackProductView\(state\.product\)/);
    });

    it('cacheProduct stays in init path', () => {
      // Caching is instant (localStorage write) and helps subsequent page loads
      expect(productPageContent).toMatch(/cacheProduct\(state\.product\)/);
    });
  });
});
