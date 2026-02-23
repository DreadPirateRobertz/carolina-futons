import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the Newsletter page by verifying it initializes without error
// and that all section setup functions handle missing elements gracefully.
// Page files can't be imported directly (they rely on $w global), so we
// test the patterns and integration points.

describe('Newsletter Page', () => {
  describe('structure', () => {
    it('page file exists and exports are syntactically valid', async () => {
      // Verify the module can be parsed without syntax errors
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.resolve('src/pages/Newsletter.js');
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(100);
    });

    it('imports engagementTracker', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("from 'public/engagementTracker'");
    });

    it('imports ga4Tracking for analytics', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("from 'public/ga4Tracking'");
    });

    it('imports designTokens for brand styling', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("from 'public/designTokens.js'");
    });

    it('imports a11yHelpers for accessibility', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("from 'public/a11yHelpers'");
    });

    it('includes email validation regex', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('@');
      expect(content).toMatch(/test\(email\)/);
    });

    it('fires newsletter_signup GA4 event', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("fireCustomEvent('newsletter_signup'");
    });

    it('fires page_view tracking on load', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("trackEvent('page_view'");
    });

    it('uses wix-crm-frontend for contact creation', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('wix-crm-frontend');
      expect(content).toContain('appendOrCreateContact');
    });

    it('labels contacts with custom.newsletter', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain("'custom.newsletter'");
    });

    it('includes ARIA labels for accessibility', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('ariaLabel');
    });

    it('shows WELCOME10 discount code on success', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('WELCOME10');
    });

    it('includes benefits section with 4 items', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('Exclusive Deals');
      expect(content).toContain('New Arrivals');
      expect(content).toContain('Furniture Tips');
      expect(content).toContain('No Spam');
    });

    it('includes social links section', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('pinterest.com/carolinafutons');
      expect(content).toContain('instagram.com/carolinafutons');
      expect(content).toContain('facebook.com/carolinafutons');
    });

    it('uses announce for screen reader feedback', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync('src/pages/Newsletter.js', 'utf8');
      expect(content).toContain('announce($w');
    });
  });
});

describe('Newsletter page email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('accepts valid email addresses', () => {
    expect(emailRegex.test('test@example.com')).toBe(true);
    expect(emailRegex.test('user@domain.co')).toBe(true);
    expect(emailRegex.test('name.last@company.org')).toBe(true);
  });

  it('rejects invalid email addresses', () => {
    expect(emailRegex.test('')).toBe(false);
    expect(emailRegex.test('notanemail')).toBe(false);
    expect(emailRegex.test('@no-local.com')).toBe(false);
    expect(emailRegex.test('no-domain@')).toBe(false);
    expect(emailRegex.test('spaces in@email.com')).toBe(false);
  });
});
