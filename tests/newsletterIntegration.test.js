// newsletterIntegration.test.js - CF-71f: Email signup and newsletter integration
// Verifies all pages with newsletter signup use the centralized newsletterService.web.js
// backend instead of direct wix-crm-frontend or contactSubmissions.web calls.
// This ensures every signup gets: CMS deduplication, Klaviyo ESP sync, Bronze loyalty enrollment.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const readPage = (name) => readFileSync(resolve(process.cwd(), `src/pages/${name}.js`), 'utf-8');

// ── All newsletter signup pages must use newsletterService.web.js ─────

describe('Newsletter integration — centralized backend', () => {
  const pagesWithNewsletter = [
    { page: 'Newsletter', description: 'dedicated newsletter landing page' },
    { page: 'Thank You Page', description: 'post-purchase newsletter signup' },
    { page: 'Blog', description: 'blog page newsletter CTA' },
    { page: 'Home', description: 'homepage newsletter section' },
  ];

  pagesWithNewsletter.forEach(({ page, description }) => {
    it(`${page} (${description}) uses newsletterService.web`, () => {
      const content = readPage(page);
      // Accept either static import or dynamic import()
      expect(content).toMatch(/(?:from|import)\s*\(?\s*['"]backend\/newsletterService\.web['"]/);
    });

    it(`${page} calls subscribeToNewsletter (not direct CRM)`, () => {
      const content = readPage(page);
      expect(content).toContain('subscribeToNewsletter');
    });
  });

  // Pages must NOT use direct wix-crm-frontend for newsletter signup
  const pagesMustNotUseCRM = [
    'Newsletter',
    'Thank You Page',
    'Blog',
  ];

  pagesMustNotUseCRM.forEach((page) => {
    it(`${page} does NOT use wix-crm-frontend directly for newsletter`, () => {
      const content = readPage(page);
      expect(content).not.toContain('wix-crm-frontend');
    });
  });

  it('Blog does NOT use contactSubmissions.web for newsletter signup', () => {
    const content = readPage('Blog');
    // Blog newsletter should use newsletterService, not contactSubmissions
    expect(content).not.toMatch(/submitContactForm.*newsletter/s);
  });
});

// ── Newsletter.js must show discount code from backend response ──────

describe('Newsletter page — backend integration details', () => {
  it('uses the discountCode from subscribeToNewsletter response', () => {
    const content = readPage('Newsletter');
    // Should reference result.discountCode or similar pattern from backend response
    expect(content).toMatch(/discountCode|result\./);
  });

  it('handles subscription failure gracefully', () => {
    const content = readPage('Newsletter');
    // Should have error handling for failed subscription
    expect(content).toMatch(/catch|\.success\s*===?\s*false|!.*success/);
  });
});

// ── Thank You Page must use backend service ──────────────────────────

describe('Thank You Page — backend integration details', () => {
  it('passes source as thank_you_page to subscribeToNewsletter', () => {
    const content = readPage('Thank You Page');
    expect(content).toContain('thank_you_page');
  });
});

// ── Blog must use backend service ────────────────────────────────────

describe('Blog — backend integration details', () => {
  it('passes source as blog to subscribeToNewsletter', () => {
    const content = readPage('Blog');
    // Should pass blog-related source to the backend
    expect(content).toMatch(/source.*blog|blog.*source/i);
  });
});

// ── FooterSection already correct — verify it stays correct ──────────

describe('FooterSection — already uses newsletterService (regression)', () => {
  it('imports subscribeToNewsletter from newsletterService.web', () => {
    const content = readFileSync(resolve(process.cwd(), 'src/public/FooterSection.js'), 'utf-8');
    expect(content).toMatch(/from\s+['"]backend\/newsletterService\.web['"]/);
    expect(content).toContain('subscribeToNewsletter');
  });
});
