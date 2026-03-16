import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';

// ── Backend module under test ───────────────────────────────────────

import {
  getAssemblyGuide,
  getCareTips,
  listAssemblyGuides,
} from '../src/backend/assemblyGuides.web.js';

// ── PDP module under test ───────────────────────────────────────────

// Mock the dynamic backend import that ProductAssemblyGuide uses —
// forward to the real module so the PDP init gets actual backend behavior.
vi.mock('backend/assemblyGuides.web', async () => {
  const actual = await import('../src/backend/assemblyGuides.web.js');
  return { ...actual };
});

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

import { initProductAssemblyGuide } from '../src/public/ProductAssemblyGuide.js';

// ── $w element factory ──────────────────────────────────────────────

function makeElement(id) {
  return {
    _id: id,
    text: '',
    link: '',
    target: '',
    collapsed: false,
    hidden: false,
    accessibility: { ariaLabel: '' },
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    hide: vi.fn(function () { this.hidden = true; }),
    show: vi.fn(function () { this.hidden = false; }),
    onClick: vi.fn(),
  };
}

function make$w() {
  const elements = {};
  const $w = (selector) => {
    const id = selector.replace('#', '');
    if (!elements[id]) elements[id] = makeElement(id);
    return elements[id];
  };
  $w._elements = elements;
  return $w;
}

// ── Fixtures ────────────────────────────────────────────────────────

const SEATTLE_GUIDE = {
  _id: 'ag-1',
  sku: 'NDF-SEATTLE',
  title: 'Seattle Futon Frame Assembly',
  pdfUrl: 'https://cdn.example.com/seattle-assembly.pdf',
  videoUrl: 'https://youtube.com/watch?v=abc123',
  estimatedTime: '30 minutes',
  steps: '<ol><li>Unbox</li><li>Attach arms</li></ol>',
  tips: 'Use a Phillips screwdriver',
  category: 'futon-frames',
};

const MURPHY_GUIDE = {
  _id: 'ag-2',
  sku: 'ARA-MURPHY',
  title: 'Murphy Cabinet Bed Setup',
  pdfUrl: 'https://cdn.example.com/murphy-setup.pdf',
  videoUrl: null,
  estimatedTime: '45 minutes',
  steps: '',
  tips: '',
  category: 'murphy-cabinet-beds',
};

const MINIMAL_GUIDE = {
  _id: 'ag-3',
  sku: 'MIN-BASIC',
  title: 'Basic Frame',
};

// ── Tests ───────────────────────────────────────────────────────────

describe('Assembly Guide PDP Integration', () => {
  let $w;

  beforeEach(() => {
    resetData();
    __seed('AssemblyGuides', [SEATTLE_GUIDE, MURPHY_GUIDE, MINIMAL_GUIDE]);
    $w = make$w();
  });

  /** Helper: init PDP assembly section for a given SKU. */
  const initWithSku = (sku) =>
    initProductAssemblyGuide($w, { product: { sku } });

  // ── SKU lookup: full guide with PDF + video ───────────────────────

  describe('SKU lookup — full guide (PDF + video)', () => {
    it('fetches guide by SKU and expands the section', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });

    it('sets title text', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideTitle').text).toBe('Assembly & Care Guide');
    });

    it('shows estimated time', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideTime').text).toContain('30 minutes');
    });

    it('wires PDF download link with target _blank', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideLink').link).toBe('https://cdn.example.com/seattle-assembly.pdf');
      expect($w('#assemblyGuideLink').target).toBe('_blank');
    });

    it('sets PDF link aria label with guide title', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
      expect($w('#assemblyGuideLink').accessibility.ariaLabel).toContain('PDF');
    });

    it('wires video link with target _blank', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideVideoLink').link).toBe('https://youtube.com/watch?v=abc123');
      expect($w('#assemblyGuideVideoLink').target).toBe('_blank');
    });

    it('sets video link aria label', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideVideoLink').accessibility.ariaLabel).toContain('video');
    });

    it('wires button onClick handler', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideBtn').onClick).toHaveBeenCalled();
    });

    it('sets button aria label', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideBtn').accessibility.ariaLabel).toBe('View assembly guide');
    });
  });

  // ── SKU lookup: guide without video ───────────────────────────────

  describe('SKU lookup — guide without video', () => {
    it('hides video link when videoUrl is null', async () => {
      await initWithSku('ARA-MURPHY');
      expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
    });

    it('still shows PDF link when video is missing', async () => {
      await initWithSku('ARA-MURPHY');
      expect($w('#assemblyGuideLink').link).toContain('.pdf');
    });

    it('still expands section', async () => {
      await initWithSku('ARA-MURPHY');
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });
  });

  // ── SKU lookup: minimal guide (no optional fields) ────────────────

  describe('SKU lookup — minimal guide (no optional fields)', () => {
    it('hides PDF link when pdfUrl is missing', async () => {
      await initWithSku('MIN-BASIC');
      expect($w('#assemblyGuideLink').hide).toHaveBeenCalled();
    });

    it('hides video link when videoUrl is missing', async () => {
      await initWithSku('MIN-BASIC');
      expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
    });

    it('still expands the section for minimal guide', async () => {
      await initWithSku('MIN-BASIC');
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });
  });

  // ── Null handling ─────────────────────────────────────────────────

  describe('null handling', () => {
    it('collapses section when no guide found for SKU', async () => {
      await initWithSku('NONEXISTENT-SKU');
      expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
      expect($w('#assemblyGuideSection').expand).not.toHaveBeenCalled();
    });

    it('collapses section when product has no SKU', async () => {
      await initWithSku('');
      expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
    });

    it('collapses section when SKU is null', async () => {
      await initWithSku(null);
      expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
    });

    it('returns early without error when state is null', async () => {
      await expect(initProductAssemblyGuide($w, null)).resolves.not.toThrow();
    });

    it('returns early without error when product is undefined', async () => {
      await expect(initProductAssemblyGuide($w, {})).resolves.not.toThrow();
    });

    it('does not expand section when state has no product', async () => {
      await initProductAssemblyGuide($w, {});

      expect($w('#assemblyGuideSection').expand).not.toHaveBeenCalled();
    });
  });

  // ── Backend: getAssemblyGuide integration ─────────────────────────

  describe('backend getAssemblyGuide — SKU lookup paths', () => {
    it('returns full guide shape for valid SKU', async () => {
      const guide = await getAssemblyGuide('NDF-SEATTLE');
      expect(guide).toMatchObject({
        _id: 'ag-1',
        sku: 'NDF-SEATTLE',
        title: 'Seattle Futon Frame Assembly',
        pdfUrl: 'https://cdn.example.com/seattle-assembly.pdf',
        videoUrl: 'https://youtube.com/watch?v=abc123',
        estimatedTime: '30 minutes',
        category: 'futon-frames',
      });
    });

    it('returns null for empty string SKU', async () => {
      expect(await getAssemblyGuide('')).toBeNull();
    });

    it('returns null for null SKU', async () => {
      expect(await getAssemblyGuide(null)).toBeNull();
    });

    it('returns null for undefined SKU', async () => {
      expect(await getAssemblyGuide(undefined)).toBeNull();
    });

    it('returns null for SKU not in collection', async () => {
      expect(await getAssemblyGuide('DOES-NOT-EXIST')).toBeNull();
    });

    it('defaults missing optional fields to null or empty string', async () => {
      const guide = await getAssemblyGuide('MIN-BASIC');
      expect(guide.pdfUrl).toBeNull();
      expect(guide.videoUrl).toBeNull();
      expect(guide.estimatedTime).toBe('');
      expect(guide.steps).toBe('');
      expect(guide.tips).toBe('');
      expect(guide.category).toBe('');
    });

    it('sanitizes SKU input (strips HTML tags)', async () => {
      __seed('AssemblyGuides', [{ _id: 'ag-x', sku: 'NDF-SEATTLE', title: 'Test' }]);
      // Injected HTML should be stripped by sanitize
      const guide = await getAssemblyGuide('<script>alert(1)</script>NDF-SEATTLE');
      // sanitize strips tags, so this becomes "alert(1)NDF-SEATTLE" — no match
      expect(guide).toBeNull();
    });
  });

  // ── Backend: getCareTips integration ──────────────────────────────

  describe('backend getCareTips — category lookup', () => {
    it('returns futon-frames tips with wood care', async () => {
      const tips = await getCareTips('futon-frames');
      expect(tips.length).toBe(4);
      expect(tips.some(t => t.title === 'Wood Care')).toBe(true);
    });

    it('returns mattresses tips with rotation advice', async () => {
      const tips = await getCareTips('mattresses');
      expect(tips.length).toBe(4);
      expect(tips.some(t => t.title === 'Rotation')).toBe(true);
    });

    it('returns murphy-cabinet-beds tips with mechanism care', async () => {
      const tips = await getCareTips('murphy-cabinet-beds');
      expect(tips.length).toBe(3);
      expect(tips.some(t => t.title === 'Mechanism')).toBe(true);
    });

    it('returns platform-beds tips with slat check', async () => {
      const tips = await getCareTips('platform-beds');
      expect(tips.length).toBe(3);
      expect(tips.some(t => t.title === 'Slats')).toBe(true);
    });

    it('returns default tips for unknown category', async () => {
      const tips = await getCareTips('recliners');
      expect(tips.some(t => t.title === 'General Care')).toBe(true);
    });

    it('returns default tips for null category', async () => {
      const tips = await getCareTips(null);
      expect(tips.length).toBe(3);
      expect(tips.some(t => t.title === 'General Care')).toBe(true);
    });

    it('returns default tips for empty string category', async () => {
      const tips = await getCareTips('');
      expect(tips.some(t => t.title === 'General Care')).toBe(true);
    });

    it.each([
      'futon-frames', 'mattresses', 'murphy-cabinet-beds', 'platform-beds', null,
    ])('each tip for category "%s" has title and tip fields', async (cat) => {
      const tips = await getCareTips(cat);
      tips.forEach(t => {
        expect(t.title).toBeTruthy();
        expect(t.tip).toBeTruthy();
      });
    });
  });

  // ── Backend: listAssemblyGuides integration ───────────────────────

  describe('backend listAssemblyGuides — listing', () => {
    it('returns all seeded guides', async () => {
      const guides = await listAssemblyGuides();
      expect(guides.length).toBe(3);
    });

    it('returns summary shape (no steps/tips/full URLs)', async () => {
      const guides = await listAssemblyGuides();
      const g = guides.find(g => g.sku === 'NDF-SEATTLE');
      expect(g.sku).toBe('NDF-SEATTLE');
      expect(g.title).toBe('Seattle Futon Frame Assembly');
      expect(g.category).toBe('futon-frames');
      expect(g.hasPdf).toBe(true);
      expect(g.hasVideo).toBe(true);
      expect(g.steps).toBeUndefined();
      expect(g.tips).toBeUndefined();
    });

    it('flags hasPdf/hasVideo correctly for guides without URLs', async () => {
      const guides = await listAssemblyGuides();
      const minimal = guides.find(g => g.sku === 'MIN-BASIC');
      expect(minimal.hasPdf).toBe(false);
      expect(minimal.hasVideo).toBe(false);
    });

    it('returns empty array when collection is empty', async () => {
      __seed('AssemblyGuides', []);
      const guides = await listAssemblyGuides();
      expect(guides).toEqual([]);
    });
  });

  // ── End-to-end: PDP renders guide fetched from backend ────────────

  describe('end-to-end: PDP section reflects backend data', () => {
    it('Seattle SKU: section expanded with PDF + video links', async () => {
      await initWithSku('NDF-SEATTLE');
      expect($w('#assemblyGuideLink').link).toBe(SEATTLE_GUIDE.pdfUrl);
      expect($w('#assemblyGuideVideoLink').link).toBe(SEATTLE_GUIDE.videoUrl);
      expect($w('#assemblyGuideTime').text).toContain('30 minutes');
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });

    it('Murphy SKU: video hidden, PDF shown', async () => {
      await initWithSku('ARA-MURPHY');
      expect($w('#assemblyGuideLink').link).toContain('murphy');
      expect($w('#assemblyGuideVideoLink').hide).toHaveBeenCalled();
      expect($w('#assemblyGuideSection').expand).toHaveBeenCalled();
    });

    it('unknown SKU: section collapsed, no links wired', async () => {
      await initWithSku('GHOST-9999');
      expect($w('#assemblyGuideSection').collapse).toHaveBeenCalled();
      expect($w('#assemblyGuideLink').link).toBe('');
      expect($w('#assemblyGuideVideoLink').link).toBe('');
    });
  });
});
