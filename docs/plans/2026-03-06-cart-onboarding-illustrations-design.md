# cf-aij Design: Cart + Onboarding Illustrations Redesign

**Bead**: cf-aij | **Author**: radahn | **Date**: 2026-03-06
**Status**: Design phase

---

## Goal

Replace two deprecated programmatic SVG modules (`CartIllustrations.js`, `onboardingIllustrations.js`) with Figma-first static SVG modules following the `MountainSkylineFigma.js` pattern.

## Scope

5 illustrations across 2 modules:

| # | Illustration | ViewBox | Theme | Container ID |
|---|-------------|---------|-------|-------------|
| 1 | Cart header skyline | 1440x200 | Light (decorative) | `#cartHeroSkyline` |
| 2 | Empty cart scene | 280x200 | Light (meaningful) | `#emptyCartIllustration` |
| 3 | Onboarding: Welcome | 800x500 | Dark (over #1C1410) | data URI |
| 4 | Onboarding: AR Preview | 800x500 | Dark (over #1C1410) | data URI |
| 5 | Onboarding: Shop w/ Confidence | 800x500 | Dark (over #1C1410) | data URI |

## Architecture

### New Files

```
src/public/CartIllustrationsFigma.js       -- replaces CartIllustrations.js
src/public/OnboardingIllustrationsFigma.js  -- replaces onboardingIllustrations.js
src/assets/illustrations/
  cart-skyline-figma.svg
  cart-skyline-figma.optimized.svg
  empty-cart-figma.svg
  empty-cart-figma.optimized.svg
  onboarding-welcome-figma.svg
  onboarding-welcome-figma.optimized.svg
  onboarding-ar-preview-figma.svg
  onboarding-ar-preview-figma.optimized.svg
  onboarding-shop-confidence-figma.svg
  onboarding-shop-confidence-figma.optimized.svg
tests/CartIllustrationsFigma.test.js
tests/OnboardingIllustrationsFigma.test.js
```

### Module API: CartIllustrationsFigma.js

```javascript
// Static SVG content (pipeline-processed, not template strings)
const CART_SKYLINE_SVG = '...';   // 1440x200 header
const EMPTY_CART_SVG = '...';     // 280x200 scene

export function getCartSkylineSvg(options?) -> string
export function getEmptyCartSvg(options?) -> string
export function initCartSkyline($w, options?) -> void
export function initEmptyCartIllustration($w, options?) -> void
```

### Module API: OnboardingIllustrationsFigma.js

```javascript
const WELCOME_SVG = '...';
const AR_PREVIEW_SVG = '...';
const SHOP_CONFIDENCE_SVG = '...';

export function svgToDataUri(svgString) -> string
export const ONBOARDING_SVGS = {
  welcome: { svg, dataUri, title, description },
  arPreview: { svg, dataUri, title, description },
  shopWithConfidence: { svg, dataUri, title, description }
}
```

## Design Decisions

1. **1:1 module replacement** -- new `*Figma.js` modules replace old ones with same export API shape
2. **Same container IDs** -- `#cartHeroSkyline`, `#emptyCartIllustration` unchanged, no page code changes
3. **Dark theme preserved** for onboarding scenes -- transparent bg over espresso dark (#1C1410)
4. **Static SVG content** -- literal strings from pipeline output, NOT template interpolation
5. **Old files left in place** but imports updated in page files -- deprecation, not deletion
6. **All colors from sharedTokens** -- pipeline token injection verifies zero rogue hex

## SVG Content Specifications

### Cart Skyline (1440x200)
- 7-stop sky gradient (skyGradientTop -> mountainBlueLight -> skyGradientBottom -> sandLight -> sunsetCoralLight)
- 7 ridgeline layers with opacity ramp (0.10 far -> 0.78 near)
- Birds (6), pine trees (3 clusters), wildflowers (8+), atmospheric haze overlays
- `preserveAspectRatio="none"` (stretches to container width)
- Decorative: `aria-hidden="true" role="presentation"`

### Empty Cart (280x200)
- Mountain trail scene with empty pack frame metaphor
- 5 ridgeline layers (compact scene), cabin silhouette, fence post, trail
- `preserveAspectRatio="xMidYMid meet"` (proportional)
- Meaningful: `role="img" aria-labelledby="empty-cart-title"` + `<title>`

### Onboarding Scenes (800x500 each, dark theme)
- Welcome: Futon in living room, mountain view through window, warm lamp glow
- AR Preview: Person silhouette with phone, AR furniture ghost, mountain backdrop
- Shop with Confidence: Delivery truck, mountain road, house destination
- All: transparent bg, espresso/coral/mountainBlue palette on dark, 15+ elements each

## Test Plan (TDD)

### CartIllustrationsFigma.test.js
- `getCartSkylineSvg()` returns string containing `<svg` with viewBox `0 0 1440 200`
- `getCartSkylineSvg({ height: 150 })` respects custom height
- `getCartSkylineSvg()` has `aria-hidden="true"`
- `getEmptyCartSvg()` returns string with viewBox `0 0 280 200`
- `getEmptyCartSvg()` has `role="img"` and `<title>`
- All hex colors in SVG content match sharedTokens values
- SVG content has 15+ distinct elements (paths, circles, lines, rects)
- `initCartSkyline($w)` sets container.html to SVG string
- `initCartSkyline(null)` does not throw
- `initCartSkyline($w)` handles missing container gracefully
- `initEmptyCartIllustration($w)` sets container.html
- `initEmptyCartIllustration($w)` handles missing container

### OnboardingIllustrationsFigma.test.js
- `svgToDataUri(svg)` returns `data:image/svg+xml;charset=utf-8,...`
- `svgToDataUri('')` returns empty data URI gracefully
- `ONBOARDING_SVGS.welcome` has svg, dataUri, title, description
- `ONBOARDING_SVGS.arPreview` has svg, dataUri, title, description
- `ONBOARDING_SVGS.shopWithConfidence` has svg, dataUri, title, description
- All 3 scenes have valid SVG with viewBox `0 0 800 500`
- All 3 scenes have `role="img"` and `aria-labelledby`
- All hex colors match sharedTokens
- Each scene has 15+ distinct SVG elements
- `svgToDataUri` properly encodes special characters (#, <, >)

## Quality Bar (10-point from docs/guides/figma-illustration-workflow.md)

1. Designed following Figma-first principles
2. Brush/Pencil-style paths (natural wobble, not mathematical bezier)
3. Texture/noise visible in renders (edge distressing, paper grain)
4. 5-7 atmospheric ridgeline layers per mountain scene
5. 15+ distinct SVG elements per scene
6. 5+ gradient stops in sky
7. All colors from sharedTokens (zero hardcoded hex)
8. Pipeline processed (optimized + tokenized)
9. Accessibility attributes present
10. Visual comparison against design.jpeg passes

## Docs/Guides Referenced

- `docs/guides/figma-draw-tool-reference.md`
- `docs/guides/figma-illustration-workflow.md`
- `docs/guides/figma-community-asset-study.md`
- `docs/guides/hand-draw-plugin-evaluation.md`
- `docs/guides/svg-export-pipeline.md`
- `docs/guides/cross-rig-illustration-standards.md`
