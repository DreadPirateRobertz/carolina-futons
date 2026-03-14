import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WCAG 2.1 AA Keyboard Accessibility Audit Tests
 *
 * Validates that page modules use makeClickable() from a11yHelpers
 * instead of bare .onClick() for interactive elements.
 *
 * WCAG 2.1.1 (Keyboard): All functionality must be operable via keyboard.
 * makeClickable() adds onKeyPress (Enter/Space) alongside onClick.
 */

const PAGES_DIR = join(__dirname, '..', 'src', 'pages');

// Pages that MUST import makeClickable if they have interactive elements
const AUDITED_PAGES = [
  'masterPage.js',
  'Blog Post.js',
  'Blog.js',
  'Fullscreen Page.js',
  'Assembly Guides.js',
  'Admin Returns.js',
  'Buying Guide.js',
];

function readPage(filename) {
  return readFileSync(join(PAGES_DIR, filename), 'utf-8');
}

describe('WCAG 2.1 AA Keyboard Audit', () => {
  describe('makeClickable import', () => {
    AUDITED_PAGES.forEach((page) => {
      it(`${page} imports makeClickable from a11yHelpers`, () => {
        const src = readPage(page);
        expect(src).toMatch(/import\s+\{[^}]*makeClickable[^}]*\}\s+from\s+['"]public\/a11yHelpers['"]/);
      });
    });
  });

  describe('no bare .onClick on known interactive elements', () => {
    // These element IDs were identified as needing keyboard support.
    // A bare .onClick() without makeClickable is a WCAG 2.1.1 violation.
    const CRITICAL_ELEMENTS = {
      'masterPage.js': [
        'promoDismiss', 'promoCopyCode',
        'promoCTA', 'installBannerBtn', 'installBannerDismiss',
        'exitEmailSubmit', 'exitSwatchLink',
      ],
      'Blog Post.js': [
        'postShareFacebook', 'postSharePinterest', 'postShareTwitter', 'postShareEmail',
      ],
      'Blog.js': [
        'shareFacebook', 'sharePinterest', 'shareTwitter', 'shareEmail',
      ],
      'Fullscreen Page.js': [
        'videoProductLink',
      ],
      'Admin Returns.js': [
        'refreshBtn', 'closeDetailBtn', 'approveBtn', 'denyBtn',
        'markShippedBtn', 'markReceivedBtn', 'generateLabelBtn',
        'trackShipmentBtn', 'cancelRefundBtn', 'confirmRefundBtn', 'processRefundBtn',
      ],
    };

    Object.entries(CRITICAL_ELEMENTS).forEach(([page, elementIds]) => {
      elementIds.forEach((elId) => {
        it(`${page}: #${elId} uses makeClickable (not bare .onClick)`, () => {
          const src = readPage(page);
          // Find lines with this element's onClick
          const lines = src.split('\n');
          const bareOnClickPattern = new RegExp(
            `\\$w\\(['"]#${elId}['"]\\)\\.onClick\\(|` +
            `\\$item\\(['"]#${elId}['"]\\)\\.onClick\\(|` +
            `${elId}\\.onClick\\(`
          );
          const makeClickablePattern = new RegExp(
            `makeClickable\\(.*['"]#${elId}['"]|` +
            `makeClickable\\(${elId}`
          );

          const hasBareOnClick = lines.some((line) => bareOnClickPattern.test(line));
          const hasMakeClickable = lines.some((line) => makeClickablePattern.test(line));

          if (hasBareOnClick && !hasMakeClickable) {
            expect.fail(
              `#${elId} in ${page} uses bare .onClick() without makeClickable. ` +
              'This violates WCAG 2.1.1 — keyboard users cannot activate this element.'
            );
          }
          // Element should use makeClickable
          expect(hasMakeClickable).toBe(true);
        });
      });
    });
  });

  describe('no double-registration (onClick + makeClickable on same element)', () => {
    // Previously found in Buying Guide.js: both .onClick(handler) and makeClickable(el, handler)
    // on the same element. This registers the click handler twice.
    const DOUBLE_REG_PAGES = ['Buying Guide.js'];

    DOUBLE_REG_PAGES.forEach((page) => {
      it(`${page} has no onClick + makeClickable double-registrations`, () => {
        const src = readPage(page);
        const lines = src.split('\n');

        // Find all element IDs that appear in both onClick and makeClickable calls
        const onClickElements = new Set();
        const makeClickableElements = new Set();

        lines.forEach((line) => {
          const onClickMatch = line.match(/\$(?:item|w)\(['"]#(\w+)['"]\)\.onClick/);
          if (onClickMatch) onClickElements.add(onClickMatch[1]);

          const mcMatch = line.match(/makeClickable\(\$(?:item|w)\(['"]#(\w+)['"]\)/);
          if (mcMatch) makeClickableElements.add(mcMatch[1]);
        });

        const doubles = [...onClickElements].filter((id) => makeClickableElements.has(id));
        expect(doubles).toEqual([]);
      });
    });
  });

  describe('variable-based makeClickable (elements resolved to local vars)', () => {
    it('masterPage.js cart icon uses makeClickable(cartIcon, ...)', () => {
      const src = readPage('masterPage.js');
      expect(src).toMatch(/makeClickable\(cartIcon,/);
    });

    it('masterPage.js logo uses makeClickable(logo, ...)', () => {
      const src = readPage('masterPage.js');
      expect(src).toMatch(/makeClickable\(logo,/);
    });
  });

  describe('ARIA labels on interactive elements', () => {
    it('masterPage.js cart icon has ariaLabel via makeClickable opts', () => {
      const src = readPage('masterPage.js');
      expect(src).toContain("ariaLabel: 'Shopping cart'");
    });

    it('masterPage.js logo has ariaLabel via makeClickable opts', () => {
      const src = readPage('masterPage.js');
      expect(src).toContain("ariaLabel: 'Carolina Futons - Go to homepage'");
    });

    it('Admin Returns.js action buttons have ariaLabels', () => {
      const src = readPage('Admin Returns.js');
      expect(src).toContain("ariaLabel: 'Approve this return'");
      expect(src).toContain("ariaLabel: 'Deny this return'");
      expect(src).toContain("ariaLabel: 'Mark return as shipped'");
      expect(src).toContain("ariaLabel: 'Mark return as received'");
    });

    it('Blog Post.js share buttons have ariaLabels', () => {
      const src = readPage('Blog Post.js');
      expect(src).toContain("ariaLabel: 'Share on Facebook (opens in new window)'");
      expect(src).toContain("ariaLabel: 'Share via email'");
    });
  });
});
