import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/accessibility.web.js');
});

// ── getAnnouncement ──────────────────────────────────────────────

describe('getAnnouncement', () => {
  it('returns empty for unknown event', () => {
    expect(mod.getAnnouncement('unknown')).toBe('');
  });

  it('generates cartAdd announcement', () => {
    expect(mod.getAnnouncement('cartAdd', 'Classic Futon', 1)).toBe('Classic Futon added to cart');
  });

  it('includes quantity for multiple items', () => {
    expect(mod.getAnnouncement('cartAdd', 'Futon', 3)).toContain('quantity 3');
  });

  it('generates cartRemove announcement', () => {
    expect(mod.getAnnouncement('cartRemove', 'Futon')).toBe('Futon removed from cart');
  });

  it('generates cartUpdate announcement', () => {
    const r = mod.getAnnouncement('cartUpdate', 3, '1299.00');
    expect(r).toContain('3 items');
    expect(r).toContain('$1299.00');
  });

  it('uses singular for 1 item', () => {
    expect(mod.getAnnouncement('cartUpdate', 1, '499.00')).toContain('1 item,');
  });

  it('generates filterApplied announcement', () => {
    expect(mod.getAnnouncement('filterApplied', 12)).toContain('12 products');
  });

  it('generates searchResults announcement', () => {
    expect(mod.getAnnouncement('searchResults', 5, 'futon')).toContain('5 results');
    expect(mod.getAnnouncement('searchResults', 5, 'futon')).toContain('"futon"');
  });

  it('generates searchNoResults announcement', () => {
    expect(mod.getAnnouncement('searchNoResults', 'xyz')).toContain('No results');
  });

  it('generates modalOpen/Close announcements', () => {
    expect(mod.getAnnouncement('modalOpen', 'Size Guide')).toContain('Size Guide');
    expect(mod.getAnnouncement('modalClose')).toContain('closed');
  });
});

// ── getWcagChecklist ─────────────────────────────────────────────

describe('getWcagChecklist', () => {
  it('returns WCAG checklist items', () => {
    const r = mod.getWcagChecklist();
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].id).toBe('1.1.1');
    expect(r[0].criterion).toBe('Non-text Content');
    expect(r[0].category).toBe('perceivable');
  });
});

// ── getDialogAriaConfig ──────────────────────────────────────────

describe('getDialogAriaConfig', () => {
  it('returns base config without IDs', () => {
    const r = mod.getDialogAriaConfig({});
    expect(r.role).toBe('dialog');
    expect(r.ariaModal).toBe(true);
    expect(r.ariaLabelledBy).toBeUndefined();
  });

  it('includes labelledBy when titleId provided', () => {
    const r = mod.getDialogAriaConfig({ titleId: 'dialog-title' });
    expect(r.ariaLabelledBy).toBe('dialog-title');
  });

  it('includes describedBy when descriptionId provided', () => {
    const r = mod.getDialogAriaConfig({ descriptionId: 'dialog-desc' });
    expect(r.ariaDescribedBy).toBe('dialog-desc');
  });
});

// ── getFormErrorAttributes ───────────────────────────────────────

describe('getFormErrorAttributes', () => {
  it('returns empty for non-array', () => {
    expect(mod.getFormErrorAttributes('bad')).toEqual({});
  });

  it('generates error attributes', () => {
    const r = mod.getFormErrorAttributes([
      { fieldId: 'email', message: 'Email is required' },
      { fieldId: 'name', message: 'Name is required' },
    ]);
    expect(r.email.ariaInvalid).toBe(true);
    expect(r.email.ariaDescribedBy).toBe('email-error');
    expect(r.email.errorMessage).toBe('Email is required');
    expect(r.name).toBeTruthy();
  });

  it('uses default message when none provided', () => {
    const r = mod.getFormErrorAttributes([{ fieldId: 'phone' }]);
    expect(r.phone.errorMessage).toBe('This field has an error');
  });

  it('skips entries without fieldId', () => {
    const r = mod.getFormErrorAttributes([{ message: 'Error' }]);
    expect(Object.keys(r)).toHaveLength(0);
  });
});

// ── auditPageAccessibility ───────────────────────────────────────

describe('auditPageAccessibility', () => {
  it('returns zero score for null data', () => {
    const r = mod.auditPageAccessibility(null);
    expect(r.passes).toBe(false);
    expect(r.score).toBe(0);
  });

  it('reports missing landmarks', () => {
    const r = mod.auditPageAccessibility({ pageName: 'Home', landmarks: ['main'] });
    expect(r.issues.some(i => i.details.includes('banner'))).toBe(true);
  });

  it('reports missing skip nav', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Home', landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      hasSkipNav: false,
    });
    expect(r.issues.some(i => i.details.includes('skip navigation'))).toBe(true);
  });

  it('flags missing alt text', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Product', images: [{ src: 'img.jpg' }],
    });
    expect(r.issues.some(i => i.criterion === '1.1.1')).toBe(true);
  });

  it('flags non-descriptive alt text', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Product', images: [{ src: 'img.jpg', alt: 'image' }],
    });
    expect(r.issues.some(i => i.details.includes('Non-descriptive'))).toBe(true);
  });

  it('passes decorative images (empty alt)', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Test',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      hasSkipNav: true, hasLiveRegion: true,
      images: [{ src: 'spacer.gif', alt: '' }],
    });
    expect(r.issues.filter(i => i.criterion === '1.1.1')).toHaveLength(0);
  });

  it('flags unlabeled form fields', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Contact', forms: [{ fieldId: 'email' }],
    });
    expect(r.issues.some(i => i.criterion === '3.3.2')).toBe(true);
  });

  it('flags elements without keyboard handler', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Test', interactiveElements: [{ id: 'btn1', hasKeyboardHandler: false, hasAriaLabel: true }],
    });
    expect(r.issues.some(i => i.criterion === '2.1.1')).toBe(true);
  });

  it('reports perfect score for complete page', () => {
    const r = mod.auditPageAccessibility({
      pageName: 'Home',
      landmarks: ['banner', 'navigation', 'main', 'contentinfo'],
      hasSkipNav: true, hasLiveRegion: true,
      images: [{ src: 'futon.jpg', alt: 'Classic futon frame in natural wood finish' }],
      forms: [{ fieldId: 'email', label: 'Email Address' }],
      interactiveElements: [{ id: 'addToCart', hasKeyboardHandler: true, hasAriaLabel: true }],
    });
    expect(r.passes).toBe(true);
    expect(r.score).toBe(100);
    expect(r.issues).toHaveLength(0);
  });
});
