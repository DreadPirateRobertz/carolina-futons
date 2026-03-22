/**
 * sizeGuideStatic.test.js
 *
 * Unit tests for src/public/SizeGuide.js
 *
 * Covers:
 *  - initSizeGuide: sizeGuideBtn click → modal expands
 *  - initSizeGuide: sizeGuideClose click → modal collapses
 *  - initSizeGuide: repeater populated with all 3 size rows (Twin/Full/Queen)
 *  - initSizeGuide: each row has correct name, sofa dimensions, bed dimensions
 *  - initSizeGuide: sizeGuideBtn gets aria-label
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
    expand:   vi.fn(),
    collapse: vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    onClick:  vi.fn(),
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
    it('does not throw', () => {
      expect(() => initSizeGuide($w)).not.toThrow();
    });

    it('collapses sizeGuideModal on init', () => {
      initSizeGuide($w);
      expect($w('#sizeGuideModal').collapse).toHaveBeenCalled();
    });

    it('sets aria-label on sizeGuideBtn', () => {
      initSizeGuide($w);
      expect($w('#sizeGuideBtn').accessibility.ariaLabel).toBe('Open size guide');
    });

    it('wires sizeGuideBtn onClick', () => {
      initSizeGuide($w);
      expect($w('#sizeGuideBtn').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sizeGuideBtn click expands the modal', () => {
      initSizeGuide($w);
      const handler = $w('#sizeGuideBtn').onClick.mock.calls[0][0];
      handler();
      expect($w('#sizeGuideModal').expand).toHaveBeenCalled();
    });

    it('wires sizeGuideClose onClick', () => {
      initSizeGuide($w);
      expect($w('#sizeGuideClose').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sizeGuideClose click collapses the modal', () => {
      initSizeGuide($w);
      const handler = $w('#sizeGuideClose').onClick.mock.calls[0][0];
      handler();
      expect($w('#sizeGuideModal').collapse).toHaveBeenCalledTimes(2); // init + close
    });

    it('registers onItemReady on sizeChartRepeater', () => {
      initSizeGuide($w);
      expect($w('#sizeChartRepeater').onItemReady).toHaveBeenCalledWith(expect.any(Function));
    });

    it('assigns data to sizeChartRepeater with 3 rows', () => {
      initSizeGuide($w);
      expect($w('#sizeChartRepeater').data).toHaveLength(3);
    });

    it('includes Twin, Full, and Queen rows', () => {
      initSizeGuide($w);
      const names = $w('#sizeChartRepeater').data.map(r => r.size);
      expect(names).toContain('Twin');
      expect(names).toContain('Full');
      expect(names).toContain('Queen');
    });

    it('each row has _id for repeater dedup', () => {
      initSizeGuide($w);
      const data = $w('#sizeChartRepeater').data;
      for (const row of data) {
        expect(row._id).toBeTruthy();
      }
    });

    it('onItemReady sets sizeChartName text', () => {
      initSizeGuide($w);
      const cb = $w('#sizeChartRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      cb($item, { _id: 'full', size: 'Full', sofa: '54"W × 75"L', bed: '54"W × 75"L' });
      expect($item('#sizeChartName').text).toBe('Full');
    });

    it('onItemReady sets sizeChartSofa text', () => {
      initSizeGuide($w);
      const cb = $w('#sizeChartRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      cb($item, { _id: 'full', size: 'Full', sofa: '54"W × 75"L', bed: '54"W × 75"L' });
      expect($item('#sizeChartSofa').text).toBe('54"W × 75"L');
    });

    it('onItemReady sets sizeChartBed text', () => {
      initSizeGuide($w);
      const cb = $w('#sizeChartRepeater').onItemReady.mock.calls[0][0];
      const $item = create$w();
      cb($item, { _id: 'queen', size: 'Queen', sofa: '60"W × 80"L', bed: '60"W × 80"L' });
      expect($item('#sizeChartBed').text).toBe('60"W × 80"L');
    });

    it('does not throw when sizeGuideBtn selector throws', () => {
      const throwing$w = (sel) => {
        if (sel === '#sizeGuideBtn') throw new Error('Element not found');
        return createMockElement();
      };
      expect(() => initSizeGuide(throwing$w)).not.toThrow();
    });

    it('does not throw when sizeGuideModal selector throws', () => {
      const throwing$w = (sel) => {
        if (sel === '#sizeGuideModal') throw new Error('Element not found');
        return createMockElement();
      };
      expect(() => initSizeGuide(throwing$w)).not.toThrow();
    });
  });
});
