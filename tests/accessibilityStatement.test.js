/**
 * Tests for pages/Accessibility Statement.js
 * Minimal page — just initPageSeo and initBackToTop.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    collapsed: false,
    accessibility: { ariaLabel: '', role: '' },
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Helper ──────────────────────────────────────────────────────────

async function loadPage() {
  onReadyHandler = null;
  elements.clear();
  vi.resetModules();
  await import('../src/pages/Accessibility Statement.js');
  if (onReadyHandler) await onReadyHandler();
  await new Promise((r) => setTimeout(r, 50));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Accessibility Statement page', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('registers an onReady handler', async () => {
    await import('../src/pages/Accessibility Statement.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls initPageSeo with accessibility', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('accessibility');
  });

  it('calls initBackToTop with $w', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });
});
