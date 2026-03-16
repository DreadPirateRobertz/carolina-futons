import { describe, it, expect } from 'vitest';
import {
  buildCartIllustration,
  buildErrorIllustration,
  buildSearchIllustration,
  buildReviewsIllustration,
  buildWishlistIllustration,
  buildNotFoundIllustration,
  buildCategoryIllustration,
  buildStreamIllustration,
} from '../src/public/illustrations.js';
import { ILLUSTRATION_COLORS } from '../src/public/illustrationShared.js';

const c = ILLUSTRATION_COLORS;

// ── Helper: validate SVG string structure ───────────────────────

function assertValidSvg(svg, expectedVbW = 280, expectedVbH = 200) {
  expect(svg).toMatch(/^<svg /);
  expect(svg).toMatch(/<\/svg>$/);
  expect(svg).toContain(`viewBox="0 0 ${expectedVbW} ${expectedVbH}"`);
}

function assertHasGradient(svg, id) {
  expect(svg).toContain(`id="${id}"`);
  expect(svg).toContain(`url(#${id})`);
}

function assertHasMountainLayers(svg, minLayers = 3) {
  // Mountain layers are <path> elements with opacity < 1
  const pathMatches = svg.match(/<path[^>]+opacity/g) || [];
  expect(pathMatches.length).toBeGreaterThanOrEqual(minLayers);
}

// ── CartIllustration ─────────────────────────────────────────────

describe('buildCartIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildCartIllustration());
  });

  it('has sunset sky gradient', () => {
    assertHasGradient(buildCartIllustration(), 'cart-sky');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildCartIllustration(), 5);
  });

  it('includes sun circles', () => {
    const svg = buildCartIllustration();
    expect(svg).toContain('<circle');
    expect(svg).toContain(c.sunsetCoralLight);
  });

  it('includes trail marker posts', () => {
    const svg = buildCartIllustration();
    expect(svg).toContain('<line');
  });

  it('includes footpath', () => {
    const svg = buildCartIllustration();
    // Footpath is a path with sandBase stroke
    expect(svg).toContain(c.sandBase);
  });

  it('accepts custom width and height', () => {
    const svg = buildCartIllustration({ width: 320, height: 240 });
    expect(svg).toContain('width="320"');
    expect(svg).toContain('height="240"');
  });
});

// ── ErrorIllustration ────────────────────────────────────────────

describe('buildErrorIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildErrorIllustration());
  });

  it('has dark storm sky gradient', () => {
    assertHasGradient(buildErrorIllustration(), 'err-sky');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildErrorIllustration(), 5);
  });

  it('includes storm clouds (ellipses)', () => {
    const svg = buildErrorIllustration();
    expect(svg).toContain('<ellipse');
  });

  it('includes lightning bolts', () => {
    const svg = buildErrorIllustration();
    // Lightning paths with sunsetCoral stroke
    expect(svg).toContain(c.sunsetCoral);
  });

  it('has radial gradient for lightning glow', () => {
    const svg = buildErrorIllustration();
    expect(svg).toContain('radialGradient');
  });
});

// ── SearchIllustration ───────────────────────────────────────────

describe('buildSearchIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildSearchIllustration());
  });

  it('has bright sky gradient', () => {
    assertHasGradient(buildSearchIllustration(), 'search-sky');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildSearchIllustration(), 5);
  });

  it('includes fog wisps (ellipses)', () => {
    const svg = buildSearchIllustration();
    expect(svg).toContain('<ellipse');
  });

  it('includes distant bird silhouette', () => {
    const svg = buildSearchIllustration();
    // Bird is a stroke path
    expect(svg).toContain('stroke=');
  });
});

// ── ReviewsIllustration ──────────────────────────────────────────

describe('buildReviewsIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildReviewsIllustration());
  });

  it('has sunrise sky gradient', () => {
    assertHasGradient(buildReviewsIllustration(), 'rev-sky');
  });

  it('has radial sun glow', () => {
    const svg = buildReviewsIllustration();
    expect(svg).toContain('radialGradient');
    expect(svg).toContain('rev-sun');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildReviewsIllustration(), 5);
  });

  it('includes sun rays', () => {
    const svg = buildReviewsIllustration();
    expect(svg).toContain('<line');
    expect(svg).toContain(c.sunsetCoralLight);
  });
});

// ── WishlistIllustration ─────────────────────────────────────────

describe('buildWishlistIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildWishlistIllustration());
  });

  it('has sky gradient', () => {
    assertHasGradient(buildWishlistIllustration(), 'wish-sky');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildWishlistIllustration(), 5);
  });

  it('includes cabin structure (polygon roof + rect body)', () => {
    const svg = buildWishlistIllustration();
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<rect');
  });

  it('includes chimney smoke', () => {
    const svg = buildWishlistIllustration();
    // Smoke is espressoLight stroke paths
    expect(svg).toContain(c.espressoLight);
  });

  it('includes pine trees', () => {
    const svg = buildWishlistIllustration();
    expect(svg).toContain(c.mountainBlueDark);
  });
});

// ── NotFoundIllustration ─────────────────────────────────────────

describe('buildNotFoundIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildNotFoundIllustration());
  });

  it('has sky gradient', () => {
    assertHasGradient(buildNotFoundIllustration(), 'nf-sky');
  });

  it('has horizontal fog gradient', () => {
    assertHasGradient(buildNotFoundIllustration(), 'nf-fog');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildNotFoundIllustration(), 5);
  });

  it('includes heavy fog rectangles', () => {
    const svg = buildNotFoundIllustration();
    expect(svg).toContain('url(#nf-fog)');
  });

  it('includes fog wisps', () => {
    const svg = buildNotFoundIllustration();
    expect(svg).toContain('<ellipse');
  });
});

// ── CategoryIllustration ─────────────────────────────────────────

describe('buildCategoryIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildCategoryIllustration());
  });

  it('has sky gradient', () => {
    assertHasGradient(buildCategoryIllustration(), 'cat-sky');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildCategoryIllustration(), 5);
  });

  it('includes pine trees', () => {
    const svg = buildCategoryIllustration();
    expect(svg).toContain(c.mountainBlueDark);
  });

  it('includes forest path', () => {
    const svg = buildCategoryIllustration();
    expect(svg).toContain(c.sandBase);
  });

  it('includes flora accents', () => {
    const svg = buildCategoryIllustration();
    expect(svg).toContain('<ellipse');
    expect(svg).toContain(c.sunsetCoral);
  });
});

// ── StreamIllustration ───────────────────────────────────────────

describe('buildStreamIllustration', () => {
  it('returns valid SVG markup', () => {
    assertValidSvg(buildStreamIllustration());
  });

  it('has sky gradient', () => {
    assertHasGradient(buildStreamIllustration(), 'sc-sky');
  });

  it('has water gradient', () => {
    assertHasGradient(buildStreamIllustration(), 'sc-water');
  });

  it('has 5 mountain layers', () => {
    assertHasMountainLayers(buildStreamIllustration(), 5);
  });

  it('includes stream channel', () => {
    const svg = buildStreamIllustration();
    expect(svg).toContain('url(#sc-water)');
  });

  it('includes rocks (ellipses)', () => {
    const svg = buildStreamIllustration();
    expect(svg).toContain('<ellipse');
  });

  it('includes water ripples', () => {
    const svg = buildStreamIllustration();
    expect(svg).toContain(c.offWhite);
  });
});

// ── Cross-cutting concerns ──────────────────────────────────────

describe('all illustrations', () => {
  const builders = [
    buildCartIllustration,
    buildErrorIllustration,
    buildSearchIllustration,
    buildReviewsIllustration,
    buildWishlistIllustration,
    buildNotFoundIllustration,
    buildCategoryIllustration,
    buildStreamIllustration,
  ];

  it('all return valid SVG strings', () => {
    for (const build of builders) {
      const svg = build();
      assertValidSvg(svg);
    }
  });

  it('all use the warm illustration palette, not UI palette', () => {
    // UI palette espresso is #1E3A5F — should NOT appear
    for (const build of builders) {
      const svg = build();
      expect(svg).not.toContain('#1E3A5F');
    }
  });

  it('default dimensions are 280×200', () => {
    for (const build of builders) {
      const svg = build();
      expect(svg).toContain('width="280"');
      expect(svg).toContain('height="200"');
    }
  });

  it('all accept custom width/height options', () => {
    for (const build of builders) {
      const svg = build({ width: 400, height: 300 });
      expect(svg).toContain('width="400"');
      expect(svg).toContain('height="300"');
    }
  });
});
