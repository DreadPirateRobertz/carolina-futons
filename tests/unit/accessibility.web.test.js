/**
 * Tests for accessibility.web.js — WCAG 2.1 AA backend helpers
 *
 * Covers: aria-live announcements, WCAG checklist, dialog config,
 * and form error accessibility attributes.
 */
import { describe, it, expect } from 'vitest';

// Import the raw functions (webMethod wrapping tested separately)
// We test the core logic by importing the module and calling exports
import {
  getAnnouncement,
  getWcagChecklist,
  getDialogAriaConfig,
  getFormErrorAttributes,
  auditPageAccessibility,
} from '../../src/backend/accessibility.web.js';

// ── getAnnouncement ─────────────────────────────────────────────────

describe('getAnnouncement', () => {
  it('returns cart add announcement', async () => {
    const msg = await getAnnouncement('cartAdd', 'Oak Futon Frame', 1);
    expect(msg).toBe('Oak Futon Frame added to cart');
  });

  it('includes quantity when > 1', async () => {
    const msg = await getAnnouncement('cartAdd', 'Mattress', 3);
    expect(msg).toContain('quantity 3');
  });

  it('returns cart remove announcement', async () => {
    const msg = await getAnnouncement('cartRemove', 'Pillow');
    expect(msg).toBe('Pillow removed from cart');
  });

  it('returns cart update announcement', async () => {
    const msg = await getAnnouncement('cartUpdate', 2, '59.99');
    expect(msg).toContain('2 items');
    expect(msg).toContain('$59.99');
  });

  it('handles singular item in cart update', async () => {
    const msg = await getAnnouncement('cartUpdate', 1, '29.99');
    expect(msg).toContain('1 item,');
    expect(msg).not.toContain('items');
  });

  it('returns filter applied announcement', async () => {
    const msg = await getAnnouncement('filterApplied', 12);
    expect(msg).toBe('Showing 12 products');
  });

  it('handles singular filter result', async () => {
    const msg = await getAnnouncement('filterApplied', 1);
    expect(msg).toBe('Showing 1 product');
  });

  it('returns filter cleared announcement', async () => {
    const msg = await getAnnouncement('filterCleared', 45);
    expect(msg).toContain('Filters cleared');
    expect(msg).toContain('45 products');
  });

  it('returns search results announcement', async () => {
    const msg = await getAnnouncement('searchResults', 8, 'futon');
    expect(msg).toContain('8 results');
    expect(msg).toContain('"futon"');
  });

  it('returns search no results announcement', async () => {
    const msg = await getAnnouncement('searchNoResults', 'zzzzzz');
    expect(msg).toContain('No results');
    expect(msg).toContain('"zzzzzz"');
  });

  it('returns form error announcement', async () => {
    const msg = await getAnnouncement('formError', 'Email');
    expect(msg).toBe('Error: Email is required');
  });

  it('returns form success announcement', async () => {
    const msg = await getAnnouncement('formSuccess', 'Contact form');
    expect(msg).toBe('Contact form submitted successfully');
  });

  it('returns sort changed announcement', async () => {
    const msg = await getAnnouncement('sortChanged', 'Price: Low to High');
    expect(msg).toContain('Price: Low to High');
  });

  it('returns loading start announcement', async () => {
    const msg = await getAnnouncement('loadingStart', 'products');
    expect(msg).toBe('Loading products');
  });

  it('returns loading complete announcement', async () => {
    const msg = await getAnnouncement('loadingComplete', 'Products');
    expect(msg).toBe('Products loaded');
  });

  it('returns modal open announcement', async () => {
    const msg = await getAnnouncement('modalOpen', 'Quick View');
    expect(msg).toContain('Quick View');
    expect(msg).toContain('opened');
  });

  it('returns modal close announcement', async () => {
    const msg = await getAnnouncement('modalClose');
    expect(msg).toBe('Dialog closed');
  });

  it('returns quantity changed announcement', async () => {
    const msg = await getAnnouncement('quantityChanged', 5);
    expect(msg).toBe('Quantity set to 5');
  });

  it('returns stock status announcement', async () => {
    const msg = await getAnnouncement('stockStatus', 'In Stock');
    expect(msg).toBe('Stock status: In Stock');
  });

  it('returns empty string for unknown event', async () => {
    const msg = await getAnnouncement('unknownEvent');
    expect(msg).toBe('');
  });
});

// ── getWcagChecklist ───────────────────────────────────────────────

describe('getWcagChecklist', () => {
  it('returns array of WCAG criteria', async () => {
    const checklist = await getWcagChecklist();
    expect(Array.isArray(checklist)).toBe(true);
    expect(checklist.length).toBeGreaterThan(0);
  });

  it('each item has required fields', async () => {
    const checklist = await getWcagChecklist();
    for (const item of checklist) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('criterion');
      expect(item).toHaveProperty('level');
      expect(item).toHaveProperty('category');
    }
  });

  it('includes key WCAG 2.1 AA criteria', async () => {
    const checklist = await getWcagChecklist();
    const ids = checklist.map(c => c.id);
    expect(ids).toContain('1.1.1'); // Non-text Content
    expect(ids).toContain('1.4.3'); // Contrast
    expect(ids).toContain('2.1.1'); // Keyboard
    expect(ids).toContain('2.4.7'); // Focus Visible
    expect(ids).toContain('4.1.3'); // Status Messages
  });

  it('includes all four WCAG categories', async () => {
    const checklist = await getWcagChecklist();
    const categories = [...new Set(checklist.map(c => c.category))];
    expect(categories).toContain('perceivable');
    expect(categories).toContain('operable');
    expect(categories).toContain('understandable');
    expect(categories).toContain('robust');
  });
});

// ── getDialogAriaConfig ─────────────────────────────────────────────

describe('getDialogAriaConfig', () => {
  it('returns role dialog and ariaModal', async () => {
    const config = await getDialogAriaConfig({});
    expect(config.role).toBe('dialog');
    expect(config.ariaModal).toBe(true);
  });

  it('includes ariaLabelledBy when titleId provided', async () => {
    const config = await getDialogAriaConfig({ titleId: 'dialogTitle' });
    expect(config.ariaLabelledBy).toBe('dialogTitle');
  });

  it('includes ariaDescribedBy when descriptionId provided', async () => {
    const config = await getDialogAriaConfig({ descriptionId: 'dialogDesc' });
    expect(config.ariaDescribedBy).toBe('dialogDesc');
  });

  it('works with both titleId and descriptionId', async () => {
    const config = await getDialogAriaConfig({ titleId: 't', descriptionId: 'd' });
    expect(config.ariaLabelledBy).toBe('t');
    expect(config.ariaDescribedBy).toBe('d');
  });

  it('omits ariaLabelledBy when no titleId', async () => {
    const config = await getDialogAriaConfig({});
    expect(config).not.toHaveProperty('ariaLabelledBy');
  });

  it('handles undefined input', async () => {
    const config = await getDialogAriaConfig();
    expect(config.role).toBe('dialog');
  });
});

// ── getFormErrorAttributes ──────────────────────────────────────────

describe('getFormErrorAttributes', () => {
  it('returns attributes for each error field', async () => {
    const result = await getFormErrorAttributes([
      { fieldId: 'name', message: 'Name is required' },
      { fieldId: 'email', message: 'Invalid email' },
    ]);
    expect(result.name.ariaInvalid).toBe(true);
    expect(result.name.ariaDescribedBy).toBe('name-error');
    expect(result.name.errorMessage).toBe('Name is required');
    expect(result.email.ariaInvalid).toBe(true);
    expect(result.email.errorMessage).toBe('Invalid email');
  });

  it('uses default error message when none provided', async () => {
    const result = await getFormErrorAttributes([{ fieldId: 'phone' }]);
    expect(result.phone.errorMessage).toBe('This field has an error');
  });

  it('skips entries without fieldId', async () => {
    const result = await getFormErrorAttributes([
      { fieldId: 'name', message: 'Required' },
      { message: 'No field ID' },
    ]);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result.name).toBeDefined();
  });

  it('returns empty object for non-array input', async () => {
    expect(await getFormErrorAttributes(null)).toEqual({});
    expect(await getFormErrorAttributes('invalid')).toEqual({});
  });

  it('returns empty object for empty array', async () => {
    expect(await getFormErrorAttributes([])).toEqual({});
  });
});

// ── auditPageAccessibility ──────────────────────────────────────────

describe('auditPageAccessibility', () => {
  it('returns passing audit for fully compliant page', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Home',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [
        { src: '/hero.jpg', alt: 'Carolina Futons showroom in Hendersonville NC' },
        { src: '/divider.png', alt: '' },
      ],
      forms: [
        { fieldId: 'email', label: 'Email Address' },
      ],
      interactiveElements: [
        { id: '#shopBtn', hasKeyboardHandler: true, hasAriaLabel: true },
      ],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.pageName).toBe('Home');
    expect(result.passes).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it('flags missing landmarks', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Test',
      landmarks: ['banner'],
      images: [],
      forms: [],
      interactiveElements: [],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const landmarkIssue = result.issues.find(i => i.criterion === '2.4.1');
    expect(landmarkIssue).toBeDefined();
    expect(landmarkIssue.details).toContain('navigation');
  });

  it('flags images with missing alt text', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Product',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [
        { src: '/product.jpg', alt: null },
        { src: '/hero.jpg', alt: 'image' },
      ],
      forms: [],
      interactiveElements: [],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const altIssues = result.issues.filter(i => i.criterion === '1.1.1');
    expect(altIssues.length).toBe(2);
  });

  it('flags form fields without labels', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Contact',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [],
      forms: [
        { fieldId: 'name' },
        { fieldId: 'email', label: 'Email' },
      ],
      interactiveElements: [],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const formIssue = result.issues.find(i => i.criterion === '3.3.2');
    expect(formIssue).toBeDefined();
    expect(formIssue.element).toBe('name');
  });

  it('flags interactive elements without keyboard handlers', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Category',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [],
      forms: [],
      interactiveElements: [
        { id: '#filterBtn', hasKeyboardHandler: false, hasAriaLabel: true },
      ],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const kbIssue = result.issues.find(i => i.criterion === '2.1.1');
    expect(kbIssue).toBeDefined();
    expect(kbIssue.element).toBe('#filterBtn');
  });

  it('flags interactive elements without aria labels', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Category',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [],
      forms: [],
      interactiveElements: [
        { id: '#iconBtn', hasKeyboardHandler: true, hasAriaLabel: false },
      ],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const labelIssue = result.issues.find(i => i.criterion === '4.1.2');
    expect(labelIssue).toBeDefined();
  });

  it('flags missing skip navigation', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Blog',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [],
      forms: [],
      interactiveElements: [],
      hasSkipNav: false,
      hasLiveRegion: true,
    });

    expect(result.passes).toBe(false);
    const skipIssue = result.issues.find(i => i.criterion === '2.4.1');
    expect(skipIssue).toBeDefined();
    expect(skipIssue.details).toContain('skip');
  });

  it('flags missing live region', async () => {
    const result = await auditPageAccessibility({
      pageName: 'FAQ',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [],
      forms: [],
      interactiveElements: [],
      hasSkipNav: true,
      hasLiveRegion: false,
    });

    expect(result.passes).toBe(false);
    const liveIssue = result.issues.find(i => i.criterion === '4.1.3');
    expect(liveIssue).toBeDefined();
  });

  it('calculates score based on passing checks', async () => {
    const result = await auditPageAccessibility({
      pageName: 'Partial',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      images: [{ src: '/img.jpg', alt: null }],
      forms: [],
      interactiveElements: [],
      hasSkipNav: true,
      hasLiveRegion: true,
    });

    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it('handles null/undefined input gracefully', async () => {
    const result = await auditPageAccessibility(null);
    expect(result.passes).toBe(false);
    expect(result.pageName).toBe('Unknown');
  });

  it('handles missing optional fields', async () => {
    const result = await auditPageAccessibility({ pageName: 'Minimal' });
    expect(result.pageName).toBe('Minimal');
    expect(result.passes).toBe(false);
    expect(Array.isArray(result.issues)).toBe(true);
  });
});
