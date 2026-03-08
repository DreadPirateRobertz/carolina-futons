// saveForLaterIntegration.test.js - CF-x8c: Save for Later page integration
// Verifies Cart Page and Side Cart import and use SaveForLater module.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readPage = (name) => readFileSync(resolve(process.cwd(), `src/pages/${name}.js`), 'utf-8');

describe('Save for Later — page integration', () => {
  ['Cart Page', 'Side Cart'].forEach((page) => {
    it(`${page} imports saveForLater from SaveForLater.js`, () => {
      const content = readPage(page);
      expect(content).toMatch(/from\s+['"]public\/SaveForLater/);
    });

    it(`${page} calls saveForLater function`, () => {
      const content = readPage(page);
      expect(content).toContain('saveForLater(');
    });

    it(`${page} handles not_authenticated response`, () => {
      const content = readPage(page);
      expect(content).toContain('not_authenticated');
    });

    it(`${page} uses announce for screen reader feedback`, () => {
      const content = readPage(page);
      expect(content).toMatch(/announce.*saved.*wishlist/i);
    });

    it(`${page} sets ARIA label on save for later button`, () => {
      const content = readPage(page);
      expect(content).toMatch(/ariaLabel.*[Ss]ave.*for later/);
    });
  });
});

describe('SaveForLater module structure', () => {
  it('exports saveForLater function', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/public/SaveForLater.js'), 'utf-8');
    expect(content).toMatch(/export\s+(async\s+)?function\s+saveForLater/);
  });

  it('imports removeCartItem from cartService', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/public/SaveForLater.js'), 'utf-8');
    expect(content).toContain('removeCartItem');
    expect(content).toMatch(/from\s+['"]public\/cartService['"]/);
  });

  it('imports analytics tracking', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/public/SaveForLater.js'), 'utf-8');
    expect(content).toContain('trackEvent');
    expect(content).toContain('fireCustomEvent');
  });

  it('uses Wishlist CMS collection', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/public/SaveForLater.js'), 'utf-8');
    expect(content).toContain("'Wishlist'");
  });
});
