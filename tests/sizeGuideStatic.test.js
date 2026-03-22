/**
 * sizeGuideStatic.test.js
 *
 * Unit tests for src/public/SizeGuide.js
 *
 * Covers:
 *  - initSizeGuide: modal collapsed on init
 *  - initSizeGuide: sizeGuideBtn click → modal expands
 *  - initSizeGuide: sizeGuideClose click → modal collapses
 *  - initSizeGuide: repeater populated with all 3 size rows (Twin/Full/Queen)
 *  - initSizeGuide: each row has distinct dims, folded height, open height
 *  - initSizeGuide: sizeGuideBtn gets aria-label
 *  - initSizeGuide: inner errors swallowed (expand throws, item element throws)
 *  - initSizeGuide: does not throw when $w selectors throw
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSizeGuide } from '../src/public/SizeGuide.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    data: [],
    accessibility: { ariaLabel: '', role: '' },
    expand:      vi.fn(),
    collapse:    vi.fn(),
    show:        vi.fn(),
    hide:        vi.fn(),
    onClick:     vi.fn(),
    onItemReady: vi.fn(),
  };
}

function create$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SizeGuide', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
  });

  describe('initSizeGuide', () => {
    it('does not throw', async () => {
      await expect(initSizeGuide($w)).resolves.not.toThrow();
    });

    it('collapses sizeGuideModal on init', async () => {
      await initSizeGuide($w);
      expect($w('#sizeGuideModal').collapse).toHaveBeenCalled();
    });

    it('sets aria-label on sizeGuideBtn', async () => {
      await initSizeGuide($w);
      expect($w('#sizeGuideBtn').accessibility.ariaLabel).toBe('Open size guide');
    });

    it('wires sizeGuideBtn onClick', async () => {
      await initSizeGuide($w);
      expect($w('#sizeGuideBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sizeGuideBtn click expands the modal', async () => {
      await initSizeGuide($w);
      const handler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
      handler();
      expect($w('#sizeGuideModal').expand).toHaveBeenCalled();
    });

    it('wires sizeGuideClose onClick', async () => {
      await initSizeGuide($w);
      expect($w('#sizeGuideClose').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sizeGuideClose click collapses the modal', async () => {
      await initSizeGuide($w);
      const handler = $w('#sizeGuideClose').onClick.mock.calls[0][0];
      handler();
      expect($w('#sizeGuideModal').collapse).toHaveBeenCalled();
    });

    it('registers onItemReady on sizeChartRepeater', async () => {
      await initSizeGuide($w);
      expect($w('#sizeChartRepeater').onItemReady).toHaveBeenCalledWith(expect.any(Function));
    });

    it('registers onItemReady BEFORE assigning .data', async () => {
      const callOrder = [];
      $w('#sizeChartRepeater').onItemReady = vi.fn(() => callOrder.push('onItemReady'));
      Object.defineProperty($w('#sizeChartRepeater'), 'data', {
        set() { callOrder.push('data'); },
        get() { return []; },
        configurable: true,
      });
      await initSizeGuide($w);
      expect(callOrder.indexOf('onItemReady')).toBeLessThan(callOrder.indexOf('data'));
    });

    it('assigns data to sizeChartRepeater with 3 rows', async () => {
      await initSizeGuide($w);
      expect($w('#sizeChartRepeater').data).toHaveLength(3);
    });

    it('includes Twin, Full, and Queen rows', async () => {
      await initSizeGuide($w);
      const names = $w('#sizeChartRepeater').data.map(r => r.size);
      expect(names).toContain('Twin');
      expect(names).toContain('Full');
      expect(names).toContain('Queen');
    });

    it('each row has _id for repeater dedup', async () => {
      await initSizeGuide($w);
      for (const row of $w('#sizeChartRepeater').data) {
        expect(row._id).toBeTruthy();
      }
    });

    it('dims, folded, and open values are distinct per row', async () => {
      await initSizeGuide($w);
      const full = $w('#sizeChartRepeater').data.find(r => r.size === 'Full');
      expect(full.dims).toBeTruthy();
      expect(full.folded).not.toBe(full.dims);
      expect(full.open).not.toBe(full.folded);
    });

    it('onItemReady populates name, dims, folded, and open text', async () => {
      await initSizeGuide($w);
      const cb = $w('#sizeChartRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      cb($item, { _id: 'full', size: 'Full', dims: '54"W × 75"L', folded: '9"', open: '4.5"' });
      expect($item('#sizeChartName').text).toBe('Full');
      expect($item('#sizeChartDims').text).toBe('54"W × 75"L');
      expect($item('#sizeChartFolded').text).toBe('9"');
      expect($item('#sizeChartOpen').text).toBe('4.5"');
    });

    // ── Error isolation ──────────────────────────────────────────────

    it('does not throw when sizeGuideBtn selector throws', async () => {
      const throwing$w = (sel) => {
        if (sel === '#sizeGuideBtn') throw new Error('Element not found');
        return createMockElement();
      };
      await expect(initSizeGuide(throwing$w)).resolves.not.toThrow();
    });

    it('does not throw when sizeGuideModal selector throws', async () => {
      const throwing$w = (sel) => {
        if (sel === '#sizeGuideModal') throw new Error('Element not found');
        return createMockElement();
      };
      await expect(initSizeGuide(throwing$w)).resolves.not.toThrow();
    });

    it('does not throw when sizeChartRepeater selector throws', async () => {
      const throwing$w = (sel) => {
        if (sel === '#sizeChartRepeater') throw new Error('Element not found');
        return createMockElement();
      };
      await expect(initSizeGuide(throwing$w)).resolves.not.toThrow();
    });

    it('sizeGuideBtn click does not throw when expand() throws', async () => {
      await initSizeGuide($w);
      $w('#sizeGuideModal').expand = vi.fn(() => { throw new Error('expand failed'); });
      const handler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
      expect(() => handler()).not.toThrow();
    });

    it('sizeGuideClose click does not throw when collapse() throws', async () => {
      await initSizeGuide($w);
      $w('#sizeGuideModal').collapse = vi.fn(() => { throw new Error('collapse failed'); });
      const handler = $w('#sizeGuideClose').onClick.mock.calls[0][0];
      expect(() => handler()).not.toThrow();
    });

    it('onItemReady does not throw when $item selectors throw', async () => {
      await initSizeGuide($w);
      const cb = $w('#sizeChartRepeater').onItemReady.mock.calls[0][0];
      const throwing$item = (sel) => { throw new Error(`${sel} missing`); };
      expect(() => cb(throwing$item, { _id: 'twin', size: 'Twin', dims: '39"W × 75"L', folded: '9"', open: '4.5"' })).not.toThrow();
    });
  });
});
