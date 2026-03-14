/**
 * Tests for pages/Accessibility Statement.js
 * Covers: page init, SEO, back-to-top button.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

let onReadyHandler = null;

globalThis.$w = Object.assign(
  () => ({}),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage() {
  await import('../src/pages/Accessibility Statement.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Page Init ───────────────────────────────────────────────────────

describe('page init', () => {
  it('calls initPageSeo with accessibility', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('accessibility');
  });

  it('initializes back-to-top button', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('handles initBackToTop failure gracefully', async () => {
    const { initBackToTop } = await import('public/mobileHelpers');
    initBackToTop.mockImplementation(() => { throw new Error('no element'); });
    await loadPage();
    // Should not throw — wrapped in try/catch
    expect(initBackToTop).toHaveBeenCalled();
  });
});
