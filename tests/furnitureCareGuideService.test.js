/**
 * Tests for furnitureCareGuideService.web.js — CF-gbv
 * Per-product furniture care guide data service.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __setQueryError, __reset as resetData } from './__mocks__/wix-data.js';
import { getCareGuide } from '../src/backend/furnitureCareGuideService.web.js';

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));
import { logError } from 'backend/utils/errorHandler';

beforeEach(() => {
  resetData();
  vi.clearAllMocks();
});

// ── Seed helpers ──────────────────────────────────────────────────────────────

function makeCareRecord(overrides = {}) {
  return {
    _id:             'care-1',
    productId:       'comfort-futon',
    material:        'fabric',
    cleaningMethod:  'Blot stains immediately with a clean cloth.',
    maintenanceTips: 'Rotate cushions monthly.',
    warningNotes:    'Do not use bleach.',
    ...overrides,
  };
}

// ── getCareGuide — valid slug, CMS record exists ──────────────────────────────

describe('getCareGuide — fabric product', () => {
  it('returns success true', async () => {
    __seed('FurnitureCare', [makeCareRecord()]);
    const result = await getCareGuide('comfort-futon');
    expect(result.success).toBe(true);
  });

  it('returns guide object with material fabric', async () => {
    __seed('FurnitureCare', [makeCareRecord()]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('fabric');
  });

  it('returns cleaningMethod from CMS record', async () => {
    __seed('FurnitureCare', [makeCareRecord()]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.cleaningMethod).toBe('Blot stains immediately with a clean cloth.');
  });

  it('returns maintenanceTips from CMS record', async () => {
    __seed('FurnitureCare', [makeCareRecord()]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.maintenanceTips).toBe('Rotate cushions monthly.');
  });

  it('returns warningNotes from CMS record', async () => {
    __seed('FurnitureCare', [makeCareRecord()]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.warningNotes).toBe('Do not use bleach.');
  });
});

describe('getCareGuide — wood product', () => {
  it('returns material wood', async () => {
    __seed('FurnitureCare', [makeCareRecord({ productId: 'wood-frame', material: 'wood' })]);
    const result = await getCareGuide('wood-frame');
    expect(result.guide.material).toBe('wood');
  });
});

describe('getCareGuide — metal product', () => {
  it('returns material metal', async () => {
    __seed('FurnitureCare', [makeCareRecord({ productId: 'metal-bed', material: 'metal' })]);
    const result = await getCareGuide('metal-bed');
    expect(result.guide.material).toBe('metal');
  });
});

describe('getCareGuide — leather product', () => {
  it('returns material leather', async () => {
    __seed('FurnitureCare', [makeCareRecord({ productId: 'leather-sofa', material: 'leather' })]);
    const result = await getCareGuide('leather-sofa');
    expect(result.guide.material).toBe('leather');
  });
});

// ── getCareGuide — no CMS record ──────────────────────────────────────────────

describe('getCareGuide — no CMS record', () => {
  it('returns success true when no record exists', async () => {
    const result = await getCareGuide('unknown-product');
    expect(result.success).toBe(true);
  });

  it('returns guide null when no record exists', async () => {
    const result = await getCareGuide('unknown-product');
    expect(result.guide).toBeNull();
  });
});

// ── getCareGuide — unknown material type ─────────────────────────────────────

describe('getCareGuide — unknown material type', () => {
  it('normalises unrecognised material to unknown', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'bamboo' })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('unknown');
  });

  it('still returns care fields even with unknown material', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'bamboo', cleaningMethod: 'Wipe gently.' })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.cleaningMethod).toBe('Wipe gently.');
  });
});

// ── getCareGuide — missing fields in CMS record ───────────────────────────────

describe('getCareGuide — missing fields in CMS record', () => {
  it('returns empty string for missing cleaningMethod', async () => {
    __seed('FurnitureCare', [makeCareRecord({ cleaningMethod: undefined })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.cleaningMethod).toBe('');
  });

  it('returns empty string for missing maintenanceTips', async () => {
    __seed('FurnitureCare', [makeCareRecord({ maintenanceTips: undefined })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.maintenanceTips).toBe('');
  });

  it('returns empty string for missing warningNotes', async () => {
    __seed('FurnitureCare', [makeCareRecord({ warningNotes: undefined })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.warningNotes).toBe('');
  });

  it('returns unknown material when material field is missing', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: undefined })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('unknown');
  });
});

// ── getCareGuide — invalid input ──────────────────────────────────────────────

describe('getCareGuide — invalid input', () => {
  it('returns success false for null slug', async () => {
    const result = await getCareGuide(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_slug');
  });

  it('returns success false for empty string slug', async () => {
    const result = await getCareGuide('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_slug');
  });

  it('returns success false for numeric slug', async () => {
    const result = await getCareGuide(42);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_slug');
  });

  it('returns success false for undefined slug', async () => {
    const result = await getCareGuide(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_slug');
  });
});

// ── getCareGuide — wixData query failure ──────────────────────────────────────

describe('getCareGuide — wixData query failure', () => {
  it('returns success false with internal_error when the query throws', async () => {
    __setQueryError('FurnitureCare', new Error('Wix Data network timeout'));
    const result = await getCareGuide('comfort-futon');
    expect(result.success).toBe(false);
    expect(result.error).toBe('internal_error');
  });

  it('logs the underlying error via logError on query failure', async () => {
    const err = new Error('Wix Data network timeout');
    __setQueryError('FurnitureCare', err);
    await getCareGuide('comfort-futon');
    expect(logError).toHaveBeenCalledWith(
      'furnitureCareGuideService.getCareGuide',
      err,
    );
  });

  it('does not return a guide object on query failure', async () => {
    __setQueryError('FurnitureCare', new Error('boom'));
    const result = await getCareGuide('comfort-futon');
    expect(result.guide).toBeUndefined();
  });
});

// ── getCareGuide — unknown material surfacing ─────────────────────────────────

describe('getCareGuide — unknown material surfacing', () => {
  it('logs the unknown material so ops can correct the CMS record', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'bamboo' })]);
    await getCareGuide('comfort-futon');
    expect(logError).toHaveBeenCalledWith(
      'furnitureCareGuideService.getCareGuide',
      expect.objectContaining({
        message: 'unknown material "bamboo" for productId "comfort-futon"',
      }),
    );
  });

  it('does not log when material field is missing entirely', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: undefined })]);
    await getCareGuide('comfort-futon');
    expect(logError).not.toHaveBeenCalled();
  });

  it('does not log for a valid material', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'fabric' })]);
    await getCareGuide('comfort-futon');
    expect(logError).not.toHaveBeenCalled();
  });
});

// ── getCareGuide — material normalisation ─────────────────────────────────────

describe('getCareGuide — material case normalisation', () => {
  it('normalises uppercase material to lowercase', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'FABRIC' })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('fabric');
  });

  it('normalises mixed-case material', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: 'Leather' })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('leather');
  });

  it('trims whitespace from material', async () => {
    __seed('FurnitureCare', [makeCareRecord({ material: '  wood  ' })]);
    const result = await getCareGuide('comfort-futon');
    expect(result.guide.material).toBe('wood');
  });
});
