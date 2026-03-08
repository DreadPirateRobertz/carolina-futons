import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ═══════════════════════════════════════════════════════════════════════
// Mobile UX Optimization Tests (cf-ziqg)
// Covers: token drift fixes, swipe migration, filter drawer a11y,
//         viewport inline-width fix
// ═══════════════════════════════════════════════════════════════════════

// ── 1. Token Drift: LiveChat uses design token breakpoints ──────────

describe('LiveChat — breakpoint token alignment', () => {
  it('imports breakpoints from designTokens, not hardcoded values', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/public/LiveChat.js', import.meta.url), 'utf8'
    );
    // Should import breakpoints from designTokens
    expect(src).toMatch(/import\s+\{[^}]*breakpoints[^}]*\}\s+from\s+['"]public\/designTokens/);
    // Should NOT have a hardcoded MOBILE_BREAKPOINT constant
    expect(src).not.toMatch(/const\s+MOBILE_BREAKPOINT\s*=\s*\d+/);
  });

  it('_isMobile uses breakpoints.tablet from design tokens', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/public/LiveChat.js', import.meta.url), 'utf8'
    );
    // Should reference breakpoints.tablet (768) instead of a magic number
    expect(src).toMatch(/breakpoints\.tablet/);
  });
});

// ── 2. Token Drift: proactiveChatTriggers uses design token breakpoints ─

describe('proactiveChatTriggers — breakpoint token alignment', () => {
  it('imports breakpoints from designTokens, not hardcoded values', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/public/proactiveChatTriggers.js', import.meta.url), 'utf8'
    );
    expect(src).toMatch(/import\s+\{[^}]*breakpoints[^}]*\}\s+from\s+['"]public\/designTokens/);
    expect(src).not.toMatch(/const\s+MOBILE_BREAKPOINT\s*=\s*\d+/);
  });

  it('_detectMobile uses breakpoints.tablet', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/public/proactiveChatTriggers.js', import.meta.url), 'utf8'
    );
    expect(src).toMatch(/breakpoints\.tablet/);
  });
});

// ── 3. Token Drift: galleryConfig uses design token breakpoints ─────

describe('galleryConfig — breakpoint token alignment', () => {
  it('imports breakpoints from designTokens or sharedTokens', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/public/galleryConfig.js', import.meta.url), 'utf8'
    );
    expect(src).toMatch(/import\s+\{[^}]*breakpoints[^}]*\}\s+from\s+['"]public\/(designTokens|sharedTokens)/);
    // Should NOT have a local hardcoded breakpoints object
    expect(src).not.toMatch(/export\s+const\s+breakpoints\s*=\s*\{/);
  });

  it('desktop breakpoint matches canonical value (1024, not 1200)', async () => {
    const { breakpoints } = await import('../../src/public/galleryConfig.js');
    const { breakpoints: canonical } = await import('../../src/public/designTokens.js');
    expect(breakpoints.desktop).toBe(canonical.desktop);
  });

  it('getGridColumns uses canonical desktop breakpoint (1024)', async () => {
    const { getGridColumns } = await import('../../src/public/galleryConfig.js');
    // 1024 should now be desktop (3 cols), not tablet (2 cols)
    expect(getGridColumns(1024)).toBe(3);
    expect(getGridColumns(1023)).toBe(2);
    // Tablet
    expect(getGridColumns(768)).toBe(2);
    expect(getGridColumns(767)).toBe(1);
  });
});

// ── 4. Side Cart: uses enableSwipe from touchHelpers ────────────────

describe('Side Cart — swipe migration to enableSwipe', () => {
  it('imports enableSwipe from touchHelpers instead of addSwipeHandler', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/pages/Side Cart.js', import.meta.url), 'utf8'
    );
    // Should import enableSwipe from touchHelpers
    expect(src).toMatch(/import\s+\{[^}]*enableSwipe[^}]*\}\s+from\s+['"]public\/touchHelpers/);
    // Should NOT import addSwipeHandler from mobileHelpers
    expect(src).not.toMatch(/import\s+\{[^}]*addSwipeHandler[^}]*\}\s+from\s+['"]public\/mobileHelpers/);
  });
});

// ── 5. Filter Drawer: Escape key close ──────────────────────────────

describe('Category Page filter drawer — keyboard accessibility', () => {
  it('initFilterDrawer source includes Escape key handler', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/pages/Category Page.js', import.meta.url), 'utf8'
    );
    // The filter drawer function should handle Escape key
    // Look for keydown listener within initFilterDrawer context
    expect(src).toMatch(/filterDrawer[\s\S]*?Escape/);
  });

  it('initFilterDrawer source includes focus trap setup', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/pages/Category Page.js', import.meta.url), 'utf8'
    );
    // Should import or use createFocusTrap for the filter drawer
    expect(src).toMatch(/createFocusTrap/);
    // Should reference filterDrawer within focus trap context
    expect(src).toMatch(/filterDrawer[\s\S]*?focusTrap|focusTrap[\s\S]*?filterDrawer/i);
  });
});

// ── 6. masterPage: CWV device detection uses getViewport ────────────

describe('masterPage — CWV device detection uses design tokens', () => {
  it('CWV function does not use raw window.innerWidth for device type', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/pages/masterPage.js', import.meta.url), 'utf8'
    );
    // Should not have the pattern: width < 768 ? 'mobile' for device detection
    // (the exact raw innerWidth pattern)
    expect(src).not.toMatch(/const\s+width\s*=.*window\.innerWidth.*\n.*const\s+deviceType\s*=\s*width\s*<\s*768/);
  });

  it('imports getViewport from mobileHelpers', async () => {
    const src = (await import('fs')).readFileSync(
      new URL('../../src/pages/masterPage.js', import.meta.url), 'utf8'
    );
    expect(src).toMatch(/import\s+\{[^}]*getViewport[^}]*\}\s+from\s+['"]public\/mobileHelpers/);
  });
});
