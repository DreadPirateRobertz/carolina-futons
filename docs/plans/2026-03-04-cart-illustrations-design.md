# Cart Page Illustrations — cf-6a6d Design

**Goal:** Create dedicated SVG illustration module for Cart Page with mountain skyline hero + empty cart scene, meeting 8/8 quality bar.

## Architecture

New module: `src/public/CartIllustrations.js` following MountainSkyline.js patterns.

**Two exported functions:**
1. `generateCartSkylineSVG(options)` — Cart page header skyline (1440x200 viewBox, full-width)
2. `generateEmptyCartSVG(options)` — Empty cart scene (280x200 viewBox, centered)

**Two init wrappers:**
1. `initCartSkyline($w, options)` — Injects skyline into `#cartHeroSkyline` HtmlComponent
2. `initEmptyCartIllustration($w, options)` — Injects empty cart scene into `#emptyCartIllustration`

## Scene Descriptions

### Cart Skyline Hero
Morning mist over Blue Ridge ridgelines. 5-7 layered mountain ranges fading into distance with atmospheric haze. Sunrise variant with warm coral-to-sand gradient. Birds in sky, pine silhouettes at edges. Conveys "almost home" feeling for checkout journey.

### Empty Cart Scene
Quiet mountain trail with empty pack frame leaning against a weathered fence post. Rolling Blue Ridge ridgelines in background. Wildflowers at trail edges, single bird overhead. Gentle morning light. Invites exploration — "your journey awaits."

## 8/8 Quality Bar

1. `feTurbulence` + `feDisplacementMap` watercolor texture on fills
2. Organic hand-drawn C-curve paths with wobble/irregularity
3. 15+ SVG elements per scene (paths, circles, lines, rects)
4. 5+ gradient stops per sky gradient
5. Paper grain overlay via `feNoise` + multiply blend
6. Foreground/midground/background atmospheric depth layers
7. All colors from `sharedTokens.colors` — zero hardcoded hex
8. `role="img"`, `<title>`, `aria-labelledby` for accessibility

## Testing Strategy

Tests validate structure, not aesthetics. Test file: `tests/cartIllustrations.test.js`

- SVG validity (viewBox, xmlns, responsive width/height)
- 8 quality bar assertions (one test per point)
- Brand token enforcement (extract hex, validate against sharedTokens)
- Accessibility (role, title, aria-labelledby)
- Init wrapper error handling (null $w, missing elements)
- Element count >= 15 per scene
- Opacity ramp: distant layers < near layers

## Integration

Cart Page.js already has `showEmptyCart()` at lines 73-104. The init wrappers integrate via:
- `initCartSkyline($w)` in main init (header decoration)
- `initEmptyCartIllustration($w)` called from `showEmptyCart()`

Design-vision preview: `design-vision/cart-illustrations-preview.html`
