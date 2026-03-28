import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getAssemblyGuide,
  getCareTips,
  listAssemblyGuides,
  getAssemblyInfo,
  getTaskRabbitLink,
} from '../src/backend/assemblyGuides.web.js';

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

  it('includes estimatedTime for each guide', async () => {
    const guides = await listAssemblyGuides();
    guides.forEach(g => {
      expect(g.estimatedTime).toBeDefined();
    });
  });

  it('returns guides with category field', async () => {
    const guides = await listAssemblyGuides();
    guides.forEach(g => {
      expect(g.category).toBeDefined();
    });
  });
});

// ── getCareTips edge cases ──────────────────────────────────────────

describe('getCareTips edge cases', () => {
  it('returns default tips for empty string category', async () => {
    const tips = await getCareTips('');
    expect(tips.length).toBeGreaterThanOrEqual(2);
    expect(tips.some(t => t.title.toLowerCase().includes('general'))).toBe(true);
  });

  it('returns each default tip with title and tip fields', async () => {
    const tips = await getCareTips(null);
    tips.forEach(t => {
      expect(t.title).toBeTruthy();
      expect(t.tip).toBeTruthy();
    });
  });
});

// ── getAssemblyGuide edge cases ─────────────────────────────────────

describe('getAssemblyGuide edge cases', () => {
  beforeEach(() => {
    __seed('AssemblyGuides', [
      {
        _id: 'ag-min', sku: 'MIN-SKU', title: 'Minimal Guide',
        // No optional fields at all
      },
    ]);
  });

  it('returns null fields for missing optional URLs', async () => {
    const guide = await getAssemblyGuide('MIN-SKU');
    expect(guide).not.toBeNull();
    expect(guide.pdfUrl).toBeNull();
    expect(guide.videoUrl).toBeNull();
    expect(guide.estimatedTime).toBe('');
    expect(guide.steps).toBe('');
    expect(guide.tips).toBe('');
    expect(guide.category).toBe('');
  });
});

// ── getAssemblyInfo (CF-xmjr) ───────────────────────────────────────

describe('getAssemblyInfo', () => {
  it('returns difficulty and tools for futon frames', () => {
    const result = getAssemblyInfo('futon-frames');
    expect(result.success).toBe(true);
    expect(result.info.difficulty).toBe('Medium');
    expect(result.info.estimatedMinutes).toBe(45);
    expect(result.info.stepCount).toBe(8);
    expect(result.info.tools).toContain('Phillips screwdriver');
    expect(result.info.difficultyLevel).toBe(2);
  });

  it('returns Expert for murphy cabinet beds', () => {
    const result = getAssemblyInfo('murphy-cabinet-beds');
    expect(result.info.difficulty).toBe('Expert');
    expect(result.info.difficultyLevel).toBe(3);
    expect(result.info.tools).toContain('Drill with bits');
    expect(result.info.tools).toContain('Stud finder');
  });

  it('returns Easy for mattresses (no assembly)', () => {
    const result = getAssemblyInfo('mattresses');
    expect(result.info.difficulty).toBe('Easy');
    expect(result.info.estimatedMinutes).toBe(5);
    expect(result.info.tools).toHaveLength(0);
  });

  it('formats time label for short durations', () => {
    const result = getAssemblyInfo('mattresses');
    expect(result.info.estimatedTimeLabel).toBe('5 min');
  });

  it('formats time label for long durations', () => {
    const result = getAssemblyInfo('murphy-cabinet-beds');
    expect(result.info.estimatedTimeLabel).toBe('2 hr');
  });

  it('returns null for unknown category', () => {
    const result = getAssemblyInfo('unknown-category');
    expect(result.success).toBe(true);
    expect(result.info).toBeNull();
  });

  it('covers all major product categories', () => {
    const categories = ['futon-frames', 'murphy-cabinet-beds', 'platform-beds', 'mattresses',
      'covers', 'casegoods-accessories', 'wall-hugger-frames', 'log-frames', 'outdoor-furniture'];
    for (const cat of categories) {
      const result = getAssemblyInfo(cat);
      expect(result.info, `${cat} should have assembly info`).not.toBeNull();
    }
  });
});

// ── getTaskRabbitLink (CF-xmjr) ─────────────────────────────────────

describe('getTaskRabbitLink', () => {
  it('generates TaskRabbit URL with product name and zip', () => {
    const result = getTaskRabbitLink('Eureka Futon Frame', '28792', 'futon-frames');
    expect(result.success).toBe(true);
    expect(result.url).toContain('taskrabbit.com');
    expect(result.url).toContain('zip=28792');
    expect(result.url).toContain('Eureka');
  });

  it('includes estimated cost based on category', () => {
    const result = getTaskRabbitLink('Murphy Bed', '28792', 'murphy-cabinet-beds');
    expect(result.estimatedCost).toContain('$');
  });

  it('returns failure for invalid zip', () => {
    const result = getTaskRabbitLink('Frame', '123');
    expect(result.success).toBe(false);
  });

  it('defaults to 45 min estimate for unknown category', () => {
    const result = getTaskRabbitLink('Custom Piece', '28792');
    expect(result.estimatedTime).toBe('45 min');
  });
});
