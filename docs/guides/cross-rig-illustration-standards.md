# Cross-Rig Illustration Standards — Carolina Futons Web + Mobile

**Bead**: hq-v28m | **Author**: radahn | **Date**: 2026-03-04
**Parent Epic**: hq-4cut (Figma-First Illustration Pipeline, Phase 4b)

**Audience**: cfutons crew (web) + cfutons_mobile/dallas (React Native mobile app)

---

## Purpose

Establish shared illustration principles so Carolina Futons looks and feels like one brand across web and mobile. Both platforms render the same Blue Ridge Mountain aesthetic — the same ridgeline shapes, atmospheric depth, and color palette. Differences are limited to platform delivery mechanics (Wix HtmlComponent vs react-native-svg).

---

## 1. Shared Aesthetic Principles

These rules apply identically to web and mobile. **design.jpeg is the north star for both platforms.**

### Blue Ridge Mountain Ridgeline Style

| Principle | Specification |
|-----------|---------------|
| **Ridge profile** | Soft, rolling — NOT jagged Rockies or flat hills. Blue Ridge Parkway reference photos. |
| **Layer count** | 5-7 overlapping ridgeline layers, fading into distance |
| **Atmospheric perspective** | Each successive layer is lighter, hazier, less saturated |
| **Foreground opacity** | 0.65-0.85 (warm espresso/dark tones) |
| **Distant opacity** | 0.12-0.25 (cool blue haze) |
| **Haze between layers** | Semi-transparent overlays (opacity-based, not blur filters) |
| **Sky gradient** | 5+ stops: skyGradientTop → mountainBlueLight → skyGradientBottom → sandLight → sunsetCoral range |

### Color Source of Truth

`src/public/sharedTokens.js` is the single source of truth for both platforms.

```
Mobile: consume via design-tokens.json (generated from sharedTokens.js)
Web:    import from 'public/sharedTokens' or 'public/designTokens.js'
```

**Zero hardcoded hex in any illustration.** Every color must trace back to a sharedTokens value.

| Role | Token | Hex |
|------|-------|-----|
| Sky (top) | `colors.skyGradientTop` | `#B8D4E3` |
| Sky (horizon) | `colors.skyGradientBottom` | `#F0C87A` |
| Distant ridges | `colors.mountainBlue` | `#5B8FA8` |
| Mid ridges | `colors.mountainBlueDark` | `#3D6B80` |
| Near ridges | `colors.espresso` | `#3A2518` |
| Warm accents | `colors.sunsetCoral` | `#E8845C` |
| Warm accents (light) | `colors.sunsetCoralLight` | `#F2A882` |
| Ground/sand | `colors.sandBase` | `#E8D5B7` |
| Background | `colors.offWhite` | `#FAF7F2` |
| Foliage/success | `colors.success` | `#4A7C59` |

### Detail Element Requirements

Every illustration scene must include (minimum 15 distinct SVG elements):

| Element | Technique | Notes |
|---------|-----------|-------|
| Birds (V shapes) | Scatter brush or manual paths | 3-6 at varying sizes for depth |
| Pine trees | Layered triangle forms with trunk | Clusters of 2-3, at ridgeline edges |
| Wildflowers | Stem line + circle/petal head | Coral and sand colors, foreground |
| Atmospheric haze | Semi-transparent rect overlays | Between ridgeline groups |
| Paper grain | Noise texture overlay at 5-10% opacity | Unifies scene with hand-painted feel |

### What NOT To Do

- No jagged Rockies-style peaks
- No flat geometric shapes without texture
- No hardcoded hex colors
- No blur-filter-only atmospheric depth (use opacity-based overlays)
- No generic stock illustration style — this brand has character

---

## 2. Platform-Specific Delivery

### Web (cfutons — Wix Velo)

**Delivery**: SVG string injected into Wix HtmlComponent via `$w('#container').html = svgString`

**Workflow** (see `docs/guides/figma-draw-tool-reference.md`):
1. Design in Figma Draw
2. Export SVG from Figma
3. Run through `scripts/svgPipeline.js` (optimize → token inject → wix wrap)
4. Inject via HtmlComponent

**Standard viewBox dimensions**:

| Use | viewBox | Display |
|-----|---------|---------|
| Page header skyline | `0 0 1440 200` | `width="100%" height="120px"` |
| Full scene illustration | `0 0 800 500` | `width="100%" height="auto"` |
| Small scene (empty state) | `0 0 280 200` | `width="100%" height="auto"` |
| Section divider | `0 0 1440 80` | `width="100%" height="60px"` |

**preserveAspectRatio**: `"none"` for full-width headers (stretch), `"xMidYMid meet"` for scenes (proportional).

**Accessibility**:
- Decorative headers: `aria-hidden="true" role="presentation"`
- Meaningful scenes: `role="img" aria-labelledby="title-id"` + `<title>` element

### Mobile (cfutons_mobile — React Native)

**Delivery**: SVG components via `react-native-svg`

```jsx
import Svg, { Path, Defs, LinearGradient, Stop, G, Rect, Circle, Line } from 'react-native-svg';
import { colors } from '../tokens/sharedTokens';
```

**Mobile viewBox variants**:

| Use | viewBox | Notes |
|-----|---------|-------|
| Screen header | `0 0 390 120` | iPhone width, proportional to web 1440×200 |
| Full scene | `0 0 390 280` | ~16:9 aspect ratio for phone screens |
| Small scene | `0 0 280 200` | Same as web (compact enough) |
| Tab bar background | `0 0 390 60` | Thin skyline strip |

**Why different viewBox for mobile headers**: A 1440×200 viewBox stretched to 390px width compresses the ridgeline detail. Instead, design a mobile-specific composition at 390×120 that shows fewer ridgeline undulations but at higher detail per ridge. Same aesthetic, adapted density.

**React Native SVG component pattern**:

```jsx
// MountainSkylineHeader.js (mobile)
import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, G, Rect } from 'react-native-svg';
import { colors } from '../tokens/sharedTokens';

export function MountainSkylineHeader({ width = 390, height = 120 }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 390 120" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colors.skyGradientTop} stopOpacity={1} />
          <Stop offset="20%" stopColor={colors.mountainBlueLight} stopOpacity={0.9} />
          <Stop offset="50%" stopColor={colors.skyGradientBottom} stopOpacity={0.7} />
          <Stop offset="80%" stopColor={colors.sandLight} stopOpacity={0.8} />
          <Stop offset="100%" stopColor={colors.sunsetCoralLight} stopOpacity={0.5} />
        </LinearGradient>
      </Defs>
      <Rect width={390} height={120} fill="url(#sky)" />
      {/* Ridgeline layers — same style as web, fewer undulations */}
      <Path d="M0,120 L0,65 C30,60 55,42 95,38 ... L390,120 Z"
            fill={colors.mountainBlue} opacity={0.18} />
      {/* ... more layers ... */}
    </Svg>
  );
}
```

**Mobile accessibility**:
- Use `accessible={true}` and `accessibilityLabel="Mountain skyline header"` on Svg component
- Decorative: `accessible={false}`

---

## 3. Figma Component Library Design

Design reusable illustration components in the Carolina Futons Figma file that both platforms export from.

### Shared Components (design once, export for both)

| Component | Figma Frame | Web Export | Mobile Export |
|-----------|-------------|------------|---------------|
| **Mountain Ridgeline Set** | 7 individual ridge paths, named layers | Full SVG via pipeline | Individual `<Path>` elements |
| **Sky Gradient** | Rectangle with 5+ stop gradient | `<linearGradient>` in SVG defs | `<LinearGradient>` in react-native-svg |
| **Pine Tree Cluster** | 2-3 trees as group | `<g class="pine">` | `<G>` component |
| **Bird Flock** | 3-6 V-shape paths | `<g class="bird">` | `<G>` component |
| **Wildflower Group** | Stem + blossom elements | `<g class="flora">` | `<G>` component |
| **Cabin Silhouette** | Wall + roof + chimney + smoke | `<g class="cabin">` | `<G>` component |
| **Atmospheric Haze** | Semi-transparent rects | `<rect>` overlays | `<Rect>` overlays |
| **Paper Grain Overlay** | Full-frame noise texture | `<rect filter="...">` | Custom component or PNG overlay |

### Figma Naming Convention

```
CF / Illustrations / Components / [Component Name] / [Variant]
```

Examples:
- `CF / Illustrations / Components / Mountain Ridgeline / Distant`
- `CF / Illustrations / Components / Mountain Ridgeline / Front`
- `CF / Illustrations / Components / Pine Tree Cluster / 3-tree`
- `CF / Illustrations / Components / Sky Gradient / Sunrise`
- `CF / Illustrations / Components / Sky Gradient / Sunset`

### Composed Scenes (page-specific)

```
CF / Illustrations / Scenes / [Page Name] / [Variant]
```

Examples:
- `CF / Illustrations / Scenes / Header Skyline / Web (1440×200)`
- `CF / Illustrations / Scenes / Header Skyline / Mobile (390×120)`
- `CF / Illustrations / Scenes / Empty Cart / Standard (280×200)`
- `CF / Illustrations / Scenes / About Hero / Web (800×500)`

### Export Workflow per Platform

**Web**:
1. Select scene frame in Figma
2. Export as SVG
3. Run `node scripts/svgPipeline.js scene.svg`
4. Use `.wix.html` output in HtmlComponent

**Mobile**:
1. Select scene frame OR individual component in Figma
2. Export as SVG
3. Convert SVG paths to react-native-svg JSX (manual or via svg-to-react-native tool)
4. Replace hardcoded hex with `colors.*` imports from sharedTokens
5. Wrap in a React Native component

---

## 4. Key Differences Between Platforms

| Aspect | Web | Mobile |
|--------|-----|--------|
| **SVG engine** | Browser native SVG | react-native-svg library |
| **Injection** | `$w('#el').html = svgString` | JSX component render |
| **ViewBox (headers)** | 1440×200 | 390×120 |
| **Filter support** | Full SVG filter support | Limited — no feTurbulence, feDisplacementMap |
| **Texture approach** | SVG filters OR embedded raster | PNG/WebP overlay (no SVG filters) |
| **Color tokens** | `import { colors } from 'public/sharedTokens'` | `import { colors } from '../tokens/sharedTokens'` |
| **Responsive** | CSS width:100%, viewBox stretches | React Native `Dimensions.get('window').width` |
| **Accessibility** | `role="img"`, `aria-labelledby` | `accessible={true}`, `accessibilityLabel` |

### Mobile SVG Filter Limitations

`react-native-svg` does **not** support:
- `<filter>` elements (`feTurbulence`, `feDisplacementMap`, `feGaussianBlur`, etc.)
- `<feBlend>`, `<feColorMatrix>`, `<feNoise>`

**Workarounds for mobile**:
- **Paper grain**: Use a semi-transparent PNG/WebP texture overlay positioned absolutely on top of the SVG
- **Watercolor texture**: Apply texture in Figma before export; the texture bakes into the path complexity
- **Atmospheric haze**: Opacity-based overlays work identically (`<Rect opacity={0.1} />`)
- **Edge distressing**: Apply Figma's Texture effect before export; it modifies the actual path, not a runtime filter

This is another reason the Figma-first workflow matters: Figma effects bake into the exported SVG paths rather than relying on runtime filters. The exported paths already have texture, wobble, and distressed edges — they render identically on both web and mobile.

---

## 5. Integration with Plugin Findings

Per the Hand Draw plugin evaluation (`docs/guides/hand-draw-plugin-evaluation.md`):

- **Do NOT use** Hand Draw / Rough / Roughly plugins for mountain ridgeline paths — they apply uniform roughness to all edges, breaking layered depth composition
- **DO use** native Figma Draw tools (Texture effect, Pencil, Pen, Progressive Blur)
- **OK to use** Hand Draw plugin for small standalone detail elements (cabin silhouettes, fence posts) where uniform edge roughness adds charm
- Figma's Texture effect modifies actual path vertices, making it cross-platform safe (no runtime filter dependency)

---

## 6. Quality Checklist (Cross-Platform)

Before submitting any illustration PR on either platform:

- [ ] Designed in Figma Draw (not programmatic JS template strings)
- [ ] All docs/guides/*.md read before starting
- [ ] 5-7 ridgeline layers with atmospheric depth (opacity ramp)
- [ ] 5+ gradient stops in sky
- [ ] 15+ distinct detail elements (birds, trees, flowers, etc.)
- [ ] All colors from sharedTokens (zero hardcoded hex)
- [ ] Correct viewBox for platform (web: 1440×200 headers; mobile: 390×120 headers)
- [ ] Accessibility attributes present
- [ ] Visual comparison against design.jpeg passes
- [ ] Pipeline ran successfully (web: `svgPipeline.js`; mobile: svg-to-react-native)
- [ ] docs/guides/ updated with any new techniques discovered
- [ ] PR description references docs/guides/ files consulted

---

## Cross-References

| Document | Path | Content |
|----------|------|---------|
| Figma Draw Tool Reference | `docs/guides/figma-draw-tool-reference.md` | Tools, effects, step-by-step workflow |
| Community Asset Study | `docs/guides/figma-community-asset-study.md` | Technique analysis from Figma Community files |
| Hand Draw Plugin Eval | `docs/guides/hand-draw-plugin-evaluation.md` | Plugin vs native tools decision |
| SVG Export Pipeline | `docs/guides/svg-export-pipeline.md` | Figma → optimize → token inject → Wix |
| Illustration Strategy | `docs/plans/2026-03-04-figma-illustration-strategy-design.md` | Full migration plan |
| Brand Tokens | `src/public/sharedTokens.js` | Color source of truth (both platforms) |
