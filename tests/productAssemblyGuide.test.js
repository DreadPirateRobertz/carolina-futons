import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';

// Mock the backend module
vi.mock('backend/assemblyGuides.web', () => ({
  getAssemblyGuide: vi.fn(),
}));

// Mock wix-window-frontend
vi.mock('wix-window-frontend', () => ({
  default: { openUrl: vi.fn() },
  openUrl: vi.fn(),
}));

import { initProductAssemblyGuide } from '../src/public/ProductAssemblyGuide.js';
import { getAssemblyGuide } from 'backend/assemblyGuides.web';

// ── Test helpers ──────────────────────────────────────────────────

function make$w() {
  const elements = {};
  const $w = (id) => {
    if (!elements[id]) {
      elements[id] = {
        text: '',
        label: '',
        src: '',
        link: '',
        target: '_blank',
        hidden: false,
        collapsed: true,
        disabled: false,
        accessibility: {},
        onClick: vi.fn(),
        show: vi.fn(function () { this.hidden = false; }),
        hide: vi.fn(function () { this.hidden = true; }),
        expand: vi.fn(function () { this.collapsed = false; }),
        collapse: vi.fn(function () { this.collapsed = true; }),
        enable: vi.fn(function () { this.disabled = false; }),
        disable: vi.fn(function () { this.disabled = true; }),
        style: {},
      };
    }
    return elements[id];
  };
  $w._elements = elements;
  return $w;
}

function makeState(overrides = {}) {
  return {
    product: {
      _id: 'prod-1',
      sku: 'NDF-SEATTLE',
      name: 'Seattle Futon Frame',
      ...overrides,
    },
  };
}

const MOCK_GUIDE = {
  _id: 'ag-1',
  sku: 'NDF-SEATTLE',
  title: 'Seattle Futon Frame Assembly',
  pdfUrl: 'https://cdn.example.com/seattle-assembly.pdf',
  videoUrl: 'https://youtube.com/watch?v=abc123',
  estimatedTime: '30 minutes',
  steps: '<ol><li>Unbox</li></ol>',
  tips: 'Use a Phillips screwdriver',
  category: 'futon-frames',
};

// ── Tests ─────────────────────────────────────────────────────────

describe('initProductAssemblyGuide', () => {
  let $w;

  beforeEach(() => {
    $w = make$w();
    vi.clearAllMocks();
  });

  it('fetches guide by product SKU and sets button text', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect(getAssemblyGuide).toHaveBeenCalledWith('NDF-SEATTLE');
    expect($w('#assemblyGuideBtn').onClick).toHaveBeenCalled();
  });

  it('expands section when guide is found', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('shows estimated time when available', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideTime').text).toContain('30 minutes');
  });

  it('hides section when no guide exists', async () => {
    getAssemblyGuide.mockResolvedValue(null);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('hides section when product has no SKU', async () => {
    getAssemblyGuide.mockResolvedValue(null);
    await initProductAssemblyGuide($w, makeState({ sku: '' }));

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('returns early when no product in state', async () => {
    await initProductAssemblyGuide($w, { product: null });

    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it('sets ARIA label on guide button', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideBtn').accessibility.ariaLabel).toContain('assembly');
  });

  it('sets PDF link when pdfUrl is available', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').link).toBe(MOCK_GUIDE.pdfUrl);
    expect($w('#assemblyGuideLink').target).toBe('_blank');
  });

  it('hides PDF link when no pdfUrl', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, pdfUrl: null });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').hide).toHaveBeenCalled();
  });

  it('shows video link when videoUrl is available', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideVideoLink').link).toBe(MOCK_GUIDE.videoUrl);
  });

  it('hides video link when no videoUrl', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, videoUrl: null });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
  });

  it('sets guide title text', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideTitle').text).toContain('Assembly');
  });

  it('handles backend error gracefully', async () => {
    getAssemblyGuide.mockRejectedValue(new Error('Network error'));
    await initProductAssemblyGuide($w, makeState());

    // Should not throw — section collapses
    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('does not crash when element IDs are missing', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    // Use a $w that throws on unknown elements
    const throwing$w = (id) => {
      if (id === '#assemblyGuideVideoLink') throw new TypeError('Element not found');
      return $w(id);
    };
    // Should not throw
    await initProductAssemblyGuide(throwing$w, makeState());
  });

  // ── Deepened coverage ──────────────────────────────────────────────

  it('PDF ARIA label includes the guide title', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
    expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('PDF');
  });

  it('video ARIA label includes the guide title', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideVideoLink').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
    expect($w('#assemblyGuideVideoLink').accessibility.ariaLabel).toContain('video');
  });

  it('video link target is _blank', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideVideoLink').target).toBe('_blank');
  });

  it('section title text is "Assembly & Care Guide"', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideTitle').text).toBe('Assembly & Care Guide');
  });

  it('button ARIA label is "View assembly guide"', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideBtn').accessibility.ariaLabel).toBe('View assembly guide');
  });

  it('button onClick opens PDF via wix-window-frontend', async () => {
    const wixWindow = await import('wix-window-frontend');
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    // Extract the onClick handler and invoke it
    const handler = $w('#assemblyGuideBtn').onClick.mock.calls[0][0];
    handler();
    // The handler does dynamic import().then() — flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(wixWindow.openUrl).toHaveBeenCalledWith(MOCK_GUIDE.pdfUrl);
  });

  it('skips estimatedTime when field is absent', async () => {
    const guideNoTime = { ...MOCK_GUIDE, estimatedTime: undefined };
    getAssemblyGuide.mockResolvedValue(guideNoTime);
    await initProductAssemblyGuide($w, makeState());

    // Time element should remain at default (empty string from make$w)
    expect($w('#assemblyGuideTime').text).toBe('');
    // Section should still expand
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('hides both PDF and video links when neither URL exists', async () => {
    const guideNoLinks = { ...MOCK_GUIDE, pdfUrl: null, videoUrl: null };
    getAssemblyGuide.mockResolvedValue(guideNoLinks);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').hide).toHaveBeenCalled();
    expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
    // Section still expands (title + time are available)
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('collapses section when SKU is undefined', async () => {
    await initProductAssemblyGuide($w, makeState({ sku: undefined }));

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it('returns early when state is null', async () => {
    await initProductAssemblyGuide($w, null);

    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it('returns early when state is undefined', async () => {
    await initProductAssemblyGuide($w, undefined);

    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it('handles guide with empty string title gracefully', async () => {
    const guideEmptyTitle = { ...MOCK_GUIDE, title: '' };
    getAssemblyGuide.mockResolvedValue(guideEmptyTitle);
    await initProductAssemblyGuide($w, makeState());

    // PDF ARIA label should still set (with empty title portion)
    expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('PDF');
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('handles multiple elements throwing without propagating errors', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    const fragile$w = (id) => {
      if (id === '#assemblyGuideTime') throw new TypeError('Missing element');
      if (id === '#assemblyGuideLink') throw new TypeError('Missing element');
      return $w(id);
    };
    // Should not throw — all try-catches protect individual element access
    await initProductAssemblyGuide(fragile$w, makeState());
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });
});
