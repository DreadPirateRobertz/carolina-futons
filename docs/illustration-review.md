# Illustration Quality Review + Video Alternative Sourcing Plan

**Bead**: CF-we5k
**Date**: 2026-03-15
**Author**: cfutons/crew/radahn

---

## 1. SVG Illustration Module Inventory

We have **10 illustration modules** (5 Figma-first + 5 legacy/programmatic):

### Figma-First Pipeline Modules (Static SVG)

| Module | Scenes | Dimensions | Quality Score | Notes |
|--------|--------|------------|--------------|-------|
| **MountainSkylineFigma.js** | 1 (header skyline) | 1440x200 | **A** | 7 ridge layers, birds, pine trees, wildflowers, atmospheric haze. Clean static SVG. |
| **CartIllustrationsFigma.js** | 2 (cart skyline + empty cart) | 1440x200, 280x200 | **A** | Rich gradients (7-stop sky), 7 ridge layers, 6 bird shapes, pine tree clusters, wildflower details. Proper accessibility (aria-hidden decorative, aria-labelledby meaningful). |
| **OnboardingIllustrationsFigma.js** | 3 (welcome, AR preview, shop confidence) | 800x500 each | **A** | Full scenes with narrative elements (cabin window, phone AR overlay, delivery truck). Dark-theme compatible. Proper ARIA roles and titles. |
| **aboutIllustrations.js** | 2 (team portrait + timeline) | 900x500, 1200x400 | **A** | Team portrait with 3 hand-illustrated photo frames, 8 pine trees. Timeline with 4 milestone markers, dashed trail path. Rich multi-gradient system. |
| **contactIllustrations.js** | 2 (showroom + hero skyline) | 400x280, 1440x220 | **A** | Showroom has cabin with chimney smoke, map pin with glow, 7 tree silhouettes. Hero has sunrise sun with radial glow and rays. |

### Legacy/Programmatic Modules (Template Literal SVG)

| Module | Scenes | Dimensions | Quality Score | Notes |
|--------|--------|------------|--------------|-------|
| **MountainSkyline.js** | 1 (header skyline) | 1440x200 | **B+** | Programmatic generation with gradient presets (sunrise/sunset/dawn). Uses feTurbulence filters. Superseded by MountainSkylineFigma.js. |
| **CartIllustrations.js** | 2 (cart skyline + empty cart) | 1440x200, 280x200 | **B+** | Programmatic with feTurbulence watercolor. Superseded by CartIllustrationsFigma.js. |
| **onboardingIllustrations.js** | 3 (dark theme scenes) | Uses template literals | **B** | Dark-theme mobile scenes with feTurbulence. Superseded by OnboardingIllustrationsFigma.js. |
| **emptyStateIllustrations.js** | 8 (cart, search, wishlist, reviews, category, error, notFound, sideCart) | 280x200 each | **A-** | Complete set of empty states. Uses brand token template literals (not hardcoded hex). Rich layered mountain scenes with 5+ gradient stops, birds, wildflowers, pine trees. |
| **comfortIllustrations.js** | 3 (plush, medium, firm) | 800x500 each | **A-** | Narrative scenes with figures on comfort surfaces. Uses feTurbulence (NOTE: overseer directive says these are deprecated — "too abstract"). Has cabins, pine trees, wildflowers, birds. |

### Overall Quality Assessment

- **All Figma-first modules**: Excellent. Static SVG, no deprecated filters, rich detail (15+ elements per scene), proper accessibility, brand token colors verified by pipeline.
- **emptyStateIllustrations**: Very good despite being template literals — comprehensive coverage of 8 states.
- **comfortIllustrations**: Good scenes but uses deprecated feTurbulence/feDisplacementMap/fractalNoise filters (per overseer directive). Candidate for Figma-first migration.
- **Legacy duplicates** (MountainSkyline, CartIllustrations, onboardingIllustrations): Superseded by Figma versions. Should be sunset after full migration.

---

## 2. SVG Pipeline Verification

**Pipeline**: `scripts/svgPipeline.js`
**Status**: Fully functional
**Tests**: 31/31 passing

Pipeline steps verified:
1. **optimizeSvg()** — Removes XML declarations, comments, metadata, empty defs, Figma-specific attributes, collapses whitespace. Reduces file size.
2. **injectBrandTokens()** — Maps 18 brand colors (hex → sharedTokens.js path). Adds `data-token-fill` / `data-token-stroke` attributes. Reports all replacements.
3. **wrapForWixHtmlComponent()** — Creates responsive HTML wrapper with 100% width/height, `overflow: hidden`, and a `postMessage` listener for dynamic SVG updates.
4. **processSvgPipeline()** — Full pipeline: optimize → inject → wrap. Returns optimized SVG, tokenized SVG, Wix HTML, and size/replacement report.

**CLI entrypoint** works: `node scripts/svgPipeline.js <input.svg> [--output <dir>]`

Brand color coverage: 18 tokens mapped (sand, espresso, mountain blue, sunset coral, off-white, white, sky gradients, success, error, muted).

---

## 3. Illustration Init Function Verification

All init functions follow the same safe pattern:
```javascript
export function initXxx($w) {
  try {
    if (!$w) { return; }
    const container = $w('#elementId');
    if (!container) { return; }
    container.html = getSvgMarkup();
  } catch (_e) { /* Element may not exist on all pages */ }
}
```

This pattern is correct for Wix — silently handles missing elements (pages that don't have the container). All tested via 633 passing tests across 9 test files.

---

## 4. Illustration Gaps — Pages Without Illustrations

### Pages WITH illustrations (via imports):

| Page | Illustration Source | How Used |
|------|-------------------|----------|
| **masterPage.js** | MountainSkylineFigma | Global header skyline |
| **Home.js** | MountainSkyline (legacy) | Hero skyline |
| **Product Page.js** | MountainSkyline (legacy) | Header skyline |
| **Category Page.js** | MountainSkyline (legacy) | Header skyline |
| **Contact.js** | contactIllustrations | Hero skyline + showroom scene |

### Pages using illustrations INDIRECTLY:
- **All pages with empty states** — emptyStateIllustrations via `emptyStates.js` (cart, search, wishlist, etc.)
- **Product pages** — comfortIllustrations via `ComfortStoryCards.js`

### Pages WITHOUT any illustrations (GAPS):

| Page | Priority | Suggested Illustration |
|------|----------|----------------------|
| **About.js** | **P1** | aboutIllustrations.js EXISTS but is NOT imported! Team portrait + timeline illustrations sitting unused. |
| **Cart Page.js** | **P1** | CartIllustrationsFigma.js EXISTS but is NOT imported! Cart skyline + empty cart illustrations unused. |
| **Sale.js** | P2 | Mountain sunrise/sunset promotional scene |
| **Buying Guide.js** / **Buying Guides.js** | P2 | Educational mountain cabin/furniture scene |
| **Financing.js** | P2 | Trust/stability mountain illustration |
| **Gift Cards.js** | P2 | Gift-themed mountain scene |
| **FAQ.js** | P3 | Informational/helpful scene |
| **Thank You Page.js** | P2 | Celebratory mountain sunset scene |
| **Store Locator.js** | P2 | Map/showroom scene (could reuse contactIllustrations showroom) |
| **Compare Page.js** | P3 | Side-by-side comparison visual |
| **Room Planner.js** | P2 | Interior design scene |
| **Style Quiz.js** | P2 | Interactive/exploratory mountain trail scene |
| **Assembly Guides.js** | P3 | Step-by-step visual |
| **Newsletter.js** | P3 | Mountain mailbox/community scene |
| **Referral Page.js** | P3 | Friends hiking together scene |
| **Sustainability.js** | P2 | Blue Ridge conservation/nature scene |

**Critical finding**: `aboutIllustrations.js` and `CartIllustrationsFigma.js` are fully built, tested, and ready but NOT wired into their page files. This is the highest-priority gap.

---

## 5. Mountain/Nature Video Content — Alternative Sourcing Plan

### Wix Video Background Support

**Confirmed**: Wix supports video backgrounds on sections/strips via Velo API.

```javascript
// Set video background programmatically
$w('#heroSection').background.src = 'wix:video://v1/<video_uri>/<filename>#posterUri=<poster_uri>&posterWidth=1920&posterHeight=1080';

// Or direct URL
$w('#heroSection').background.src = 'https://video.wixstatic.com/video/<account>_<hash>/480p/mp4/file.mp4';
```

**Key facts**:
- Supported on: Page backgrounds, Section/Strip backgrounds, ColumnStrip backgrounds
- Mobile: Wix shows a poster image on mobile instead of video (performance optimization)
- Format: MP4 (hosted on wixstatic.com via Media Manager upload)
- Autoplay: Videos auto-loop and autoplay when set as background
- Audio: Background videos are muted by default

### Recommended Free/Licensable Video Sources

| Source | Content | License | Resolution | Best For |
|--------|---------|---------|------------|----------|
| **[Mixkit](https://mixkit.co/free-stock-video/mountain/)** | Mountain landscapes, aerials, timelapses | Mixkit License (free, no attribution) | 4K | Hero sections, page backgrounds |
| **[Videezy](https://www.videezy.com/free-video/mountain)** | 3,336+ mountain clips, nature loops, motion backgrounds | CC + Videezy License | Up to 4K | Looping backgrounds, seasonal variety |
| **[Vecteezy](https://www.vecteezy.com/free-videos/nature-loop)** | Nature loops, mountain landscapes | Vecteezy License | Various | Ambient background loops |
| **[Pexels](https://www.pexels.com/search/videos/mountain/)** | Mountain/nature clips | Pexels License (free) | Up to 4K | Diverse mountain content |

### Video Content Recommendations for Carolina Futons

| Use Case | Scene Description | Duration | Loop? |
|----------|------------------|----------|-------|
| **Home hero** | Blue Ridge mountain sunrise timelapse, warm golden light washing over layered ridgelines | 15-30s | Yes |
| **Product Page header** | Slow aerial pan over misty mountain valleys, soft morning light | 10-20s | Yes |
| **About page** | Mountain cabin in forest setting, chimney smoke, golden hour | 15-25s | Yes |
| **Sale page** | Sunset over mountain peaks, dramatic warm colors | 10-15s | Yes |
| **Thank You page** | Mountain trail reaching a summit viewpoint, triumphant feeling | 10-20s | Yes |

### Implementation Strategy

1. **Source videos**: Download 5-8 mountain/Blue Ridge clips from Mixkit (best license) or Pexels
2. **Optimize**: Trim to 10-30s loops, compress to 720p-1080p (background doesn't need 4K), target <5MB per clip
3. **Upload**: Add to Wix Media Manager via Wix Studio dashboard
4. **Implement**: Create a `videoBackgrounds.js` module following the same pattern as illustrations:
   ```javascript
   export function initHeroVideoBackground($w, options) {
     try {
       if (!$w) return;
       const section = $w(options.containerId || '#heroSection');
       if (!section) return;
       section.background.src = options.videoSrc;
     } catch (_e) { /* Element may not exist */ }
   }
   ```
5. **Fallback**: Always set a poster image (SVG illustration) as fallback for mobile and slow connections

### SVG vs Video — When to Use Each

| Factor | SVG Illustrations | Video Backgrounds |
|--------|------------------|-------------------|
| **File size** | 5-50KB | 2-10MB |
| **Mobile** | Works everywhere | Falls back to poster image |
| **Performance** | Zero rendering cost | GPU decode required |
| **Brand control** | 100% — uses brand tokens | Limited — stock footage |
| **Interactivity** | Can be dynamic via postMessage | Static loop only |
| **Recommended for** | Headers, empty states, section dividers, decorative borders | Hero backgrounds, full-page immersive sections, landing pages |

**Recommendation**: Use video backgrounds as an ENHANCEMENT layer on top of SVG illustrations, not a replacement. SVGs remain the primary illustration system; videos add premium feel to key pages (home hero, about page, sale page).

---

## 6. comfortIllustrations.js — Deprecated Filter Warning

The `comfortIllustrations.js` module uses SVG filters that were deprecated per overseer directive:
- `feTurbulence` (type="turbulence")
- `feDisplacementMap`
- `fractalNoise`

The overseer noted these produce "too abstract" results. The Figma-first modules (CartIllustrationsFigma, OnboardingIllustrationsFigma, MountainSkylineFigma, aboutIllustrations, contactIllustrations) successfully achieve the watercolor feel through layered opacity and irregular paths WITHOUT these filters.

**Action needed**: Migrate comfortIllustrations.js to Figma-first pipeline (remove feTurbulence, use layered opacity technique like the other Figma modules).

---

## Summary of Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **P0** | Wire `aboutIllustrations.js` into `About.js` | 15 min |
| **P0** | Wire `CartIllustrationsFigma.js` into `Cart Page.js` | 15 min |
| **P1** | Migrate `comfortIllustrations.js` to Figma-first (remove deprecated filters) | 2-3 hrs |
| **P1** | Source 5 mountain video clips from Mixkit/Pexels | 1 hr |
| **P1** | Create `videoBackgrounds.js` module | 1 hr |
| **P2** | Create illustrations for Sale, Thank You, Store Locator pages | 3-5 hrs |
| **P2** | Sunset legacy modules (MountainSkyline.js, CartIllustrations.js, onboardingIllustrations.js) — update Home.js, Product Page.js, Category Page.js to use Figma versions | 1-2 hrs |
| **P3** | Create illustrations for remaining gap pages (FAQ, Buying Guide, etc.) | 5-8 hrs |
