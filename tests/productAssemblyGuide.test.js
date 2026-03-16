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

  // ── With guide found (shared setup) ─────────────────────────────

  describe('when guide is found', () => {
    beforeEach(async () => {
      getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
      await initProductAssemblyGuide($w, makeState());
    });

    it('fetches guide by product SKU', () => {
      expect(getAssemblyGuide).toHaveBeenCalledWith('NDF-SEATTLE');
    });

    it('registers onClick handler on button', () => {
      expect($w('#assemblyGuideBtn').onClick).toHaveBeenCalled();
    });

    it('expands the section', () => {
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });

    it('shows estimated time', () => {
      expect($w('#assemblyGuideTime').text).toContain('30 minutes');
    });

    it('sets section title to "Assembly & Care Guide"', () => {
      expect($w('#assemblyGuideTitle').text).toBe('Assembly & Care Guide');
    });

    it('sets button ARIA label to "View assembly guide"', () => {
      expect($w('#assemblyGuideBtn').accessibility.ariaLabel).toBe('View assembly guide');
    });

    it('sets PDF link URL and target', () => {
      expect($w('#assemblyGuideLink').link).toBe(MOCK_GUIDE.pdfUrl);
      expect($w('#assemblyGuideLink').target).toBe('_blank');
    });

    it('sets PDF ARIA label with guide title', () => {
      expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
      expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('PDF');
    });

    it('sets video link URL and target', () => {
      expect($w('#assemblyGuideVideoLink').link).toBe(MOCK_GUIDE.videoUrl);
      expect($w('#assemblyGuideVideoLink').target).toBe('_blank');
    });

    it('sets video ARIA label with guide title', () => {
      expect($w('#assemblyGuideVideoLink').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
      expect($w('#assemblyGuideVideoLink').accessibility.ariaLabel).toContain('video');
    });
  });

  // ── Button onClick behavior ──────────────────────────────────────

  it('opens PDF via wix-window-frontend on button click', async () => {
    const wixWindow = await import('wix-window-frontend');
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    await initProductAssemblyGuide($w, makeState());

    const handler = $w('#assemblyGuideBtn').onClick.mock.calls[0][0];
    handler();
    // The handler does dynamic import().then() — flush microtasks
    await new Promise((r) => setTimeout(r, 0));

    expect(wixWindow.openUrl).toHaveBeenCalledWith(MOCK_GUIDE.pdfUrl);
  });

  // ── Guide variants ───────────────────────────────────────────────

  it('hides PDF link when pdfUrl is absent', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, pdfUrl: null });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').hide).toHaveBeenCalled();
  });

  it('hides video link when videoUrl is absent', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, videoUrl: null });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
  });

  it('hides both links but expands section when neither URL exists', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, pdfUrl: null, videoUrl: null });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').hide).toHaveBeenCalled();
    expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('leaves time element at default when estimatedTime is absent', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, estimatedTime: undefined });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideTime').text).toBe('');
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  it('handles guide with empty string title gracefully', async () => {
    getAssemblyGuide.mockResolvedValue({ ...MOCK_GUIDE, title: '' });
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('PDF');
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });

  // ── No guide / missing data ──────────────────────────────────────

  it('collapses section when no guide exists', async () => {
    getAssemblyGuide.mockResolvedValue(null);
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product has empty SKU', async () => {
    await initProductAssemblyGuide($w, makeState({ sku: '' }));

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when product has undefined SKU', async () => {
    await initProductAssemblyGuide($w, makeState({ sku: undefined }));

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it.each([null, undefined])('returns early when state is %s', async (state) => {
    await initProductAssemblyGuide($w, state);

    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  it('returns early when product is null in state', async () => {
    await initProductAssemblyGuide($w, { product: null });

    expect(getAssemblyGuide).not.toHaveBeenCalled();
  });

  // ── Error resilience ─────────────────────────────────────────────

  it('collapses section on backend error', async () => {
    getAssemblyGuide.mockRejectedValue(new Error('Network error'));
    await initProductAssemblyGuide($w, makeState());

    expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
  });

  it('survives single missing element without crashing', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    const throwing$w = (id) => {
      if (id === '#assemblyGuideVideoLink') throw new TypeError('Element not found');
      return $w(id);
    };
    await initProductAssemblyGuide(throwing$w, makeState());
  });

  it('survives multiple missing elements and still expands section', async () => {
    getAssemblyGuide.mockResolvedValue(MOCK_GUIDE);
    const fragile$w = (id) => {
      if (id === '#assemblyGuideTime') throw new TypeError('Missing element');
      if (id === '#assemblyGuideLink') throw new TypeError('Missing element');
      return $w(id);
    };
    await initProductAssemblyGuide(fragile$w, makeState());
    expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
  });
});
