import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from '../__mocks__/wix-data.js';
import {
  getAssemblyGuide,
  getCareTips,
  listAssemblyGuides,
} from '../../src/backend/assemblyGuides.web.js';

// ── getAssemblyGuide ─────────────────────────────────────────────────

describe('getAssemblyGuide', () => {
  beforeEach(() => {
    __seed('AssemblyGuides', [
      {
        _id: 'ag-1',
        sku: 'NDF-SEATTLE',
        title: 'Seattle Futon Frame Assembly',
        pdfUrl: 'https://cdn.example.com/seattle-assembly.pdf',
        videoUrl: 'https://youtube.com/watch?v=abc123',
        estimatedTime: '30 minutes',
        steps: '<ol><li>Unbox</li><li>Attach arms</li></ol>',
        tips: 'Use a Phillips screwdriver',
        category: 'futon-frames',
      },
      {
        _id: 'ag-2',
        sku: 'ARA-MURPHY',
        title: 'Murphy Cabinet Bed Setup',
        pdfUrl: 'https://cdn.example.com/murphy-setup.pdf',
        videoUrl: null,
        estimatedTime: '45 minutes',
        steps: '',
        tips: '',
        category: 'murphy-cabinet-beds',
      },
    ]);
  });

  it('returns guide for valid SKU', async () => {
    const guide = await getAssemblyGuide('NDF-SEATTLE');
    expect(guide).not.toBeNull();
    expect(guide.title).toBe('Seattle Futon Frame Assembly');
    expect(guide.pdfUrl).toContain('.pdf');
    expect(guide.videoUrl).toContain('youtube');
    expect(guide.estimatedTime).toBe('30 minutes');
    expect(guide.category).toBe('futon-frames');
  });

  it('returns null for nonexistent SKU', async () => {
    const guide = await getAssemblyGuide('DOES-NOT-EXIST');
    expect(guide).toBeNull();
  });

  it('returns null for empty SKU', async () => {
    const guide = await getAssemblyGuide('');
    expect(guide).toBeNull();
  });

  it('returns null for null SKU', async () => {
    const guide = await getAssemblyGuide(null);
    expect(guide).toBeNull();
  });

  it('handles guide with missing optional fields', async () => {
    const guide = await getAssemblyGuide('ARA-MURPHY');
    expect(guide).not.toBeNull();
    expect(guide.videoUrl).toBeNull();
    expect(guide.steps).toBe('');
    expect(guide.tips).toBe('');
  });
});

// ── getCareTips ──────────────────────────────────────────────────────

describe('getCareTips', () => {
  it('returns futon frame care tips', async () => {
    const tips = await getCareTips('futon-frames');
    expect(tips.length).toBeGreaterThanOrEqual(3);
    expect(tips[0].title).toBeDefined();
    expect(tips[0].tip).toBeDefined();
    expect(tips.some(t => t.title.toLowerCase().includes('wood'))).toBe(true);
  });

  it('returns mattress care tips', async () => {
    const tips = await getCareTips('mattresses');
    expect(tips.length).toBeGreaterThanOrEqual(3);
    expect(tips.some(t => t.title.toLowerCase().includes('rotation'))).toBe(true);
  });

  it('returns murphy bed care tips', async () => {
    const tips = await getCareTips('murphy-cabinet-beds');
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.some(t => t.title.toLowerCase().includes('mechanism'))).toBe(true);
  });

  it('returns platform bed care tips', async () => {
    const tips = await getCareTips('platform-beds');
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.some(t => t.title.toLowerCase().includes('slat'))).toBe(true);
  });

  it('returns default tips for unknown category', async () => {
    const tips = await getCareTips('unknown-category');
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.some(t => t.title.toLowerCase().includes('general'))).toBe(true);
  });

  it('returns default tips for null category', async () => {
    const tips = await getCareTips(null);
    expect(tips.length).toBeGreaterThanOrEqual(2);
  });
});

// ── listAssemblyGuides ───────────────────────────────────────────────

describe('listAssemblyGuides', () => {
  beforeEach(() => {
    __seed('AssemblyGuides', [
      { _id: 'ag-1', sku: 'NDF-SEATTLE', title: 'Seattle Frame', category: 'futon-frames', estimatedTime: '30 min', pdfUrl: 'http://a.pdf', videoUrl: 'http://v.mp4' },
      { _id: 'ag-2', sku: 'ARA-MURPHY', title: 'Murphy Bed', category: 'murphy-cabinet-beds', estimatedTime: '45 min', pdfUrl: 'http://b.pdf', videoUrl: null },
      { _id: 'ag-3', sku: 'NDF-NOMAD', title: 'Nomad Platform', category: 'platform-beds', estimatedTime: '20 min', pdfUrl: null, videoUrl: null },
    ]);
  });

  it('returns all guides', async () => {
    const guides = await listAssemblyGuides();
    expect(guides).toHaveLength(3);
  });

  it('includes hasPdf and hasVideo flags', async () => {
    const guides = await listAssemblyGuides();
    const seattle = guides.find(g => g.sku === 'NDF-SEATTLE');
    expect(seattle.hasPdf).toBe(true);
    expect(seattle.hasVideo).toBe(true);

    const nomad = guides.find(g => g.sku === 'NDF-NOMAD');
    expect(nomad.hasPdf).toBe(false);
    expect(nomad.hasVideo).toBe(false);
  });

  it('returns basic info without steps or full URLs', async () => {
    const guides = await listAssemblyGuides();
    const first = guides[0];
    expect(first.sku).toBeDefined();
    expect(first.title).toBeDefined();
    expect(first.category).toBeDefined();
    expect(first.estimatedTime).toBeDefined();
    expect(first.steps).toBeUndefined(); // Should not expose full content in list
  });

  it('returns empty array when no guides exist', async () => {
    __seed('AssemblyGuides', []);
    const guides = await listAssemblyGuides();
    expect(guides).toEqual([]);
  });
});
