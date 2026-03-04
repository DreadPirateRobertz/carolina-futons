# Figma Community Asset Study — Blue Ridge Illustration Techniques

**Bead:** hq-qqkt | **Date:** 2026-03-04 | **Author:** cfutons/crew/miquella
**Parent:** Story 2b of Figma-First Illustration Strategy (hq-4cut)

## Purpose

Analyze Figma Community mountain/landscape files and Vecteezy vectors to answer: **What techniques achieve hand-drawn feel? What can we adopt for Carolina Futons' Blue Ridge aesthetic?**

---

## Assets Studied

| # | Asset | Source | Type |
|---|-------|--------|------|
| 1 | Mountains Landscape | [Figma Community 923678537960272601](https://www.figma.com/community/file/923678537960272601/mountains-landscape) | Illustration file |
| 2 | Mountains | [Figma Community 1111995131111640662](https://www.figma.com/community/file/1111995131111640662/mountains) | Illustration file |
| 3 | Watercolours Pack | [Figma Community 1145299048770913511](https://www.figma.com/community/file/1145299048770913511/watercolours) | Texture pack |
| 4 | Figma Draw Playground | [Figma Community 1484549117658754259](https://www.figma.com/community/file/1484549117658754259/figma-draw-playground) | Learning resource |
| 5 | Blue Ridge Mountains Vectors | [Vecteezy](https://www.vecteezy.com/free-vector/blue-ridge-mountains) | 1,548 free vectors |

---

## Key Findings

### 1. Mountains Landscape (923678537960272601)

**What it is:** A complete mountain landscape illustration using Figma's vector tools. Available for duplication and remixing.

**Techniques to study:**
- Multi-layer ridgeline composition with progressive opacity
- Vector path construction for organic mountain silhouettes
- Gradient fills for sky and atmospheric depth
- Foreground detail elements (trees, vegetation) as separate layers

**Relevance to Blue Ridge:** High. Mountain community files consistently use the layered ridgeline approach that defines the Blue Ridge look. Duplicate this file to study exact layer structure and path construction.

### 2. Mountains (1111995131111640662)

**What it is:** A dedicated mountain illustration focused on peak forms and atmospheric perspective.

**Techniques to study:**
- Atmospheric perspective through color desaturation at distance
- Silhouette layering for depth without detail
- Simplified tree forms integrated into ridgelines

**Relevance to Blue Ridge:** High. Study how atmospheric haze is achieved between layers — this is the signature Blue Ridge look we need.

### 3. Watercolours Texture Pack (1145299048770913511)

**What it is:** A pack of watercolor texture fills and overlays for Figma.

**Techniques to study:**
- Raster texture fills that can be applied to vector shapes
- Wet-edge effects and color bleeding patterns
- Paper grain textures for hand-painted feel
- Wash effects with uneven saturation (key for watercolor look)

**Relevance to Blue Ridge:** Critical. Our current SVGs use `feTurbulence` and `feDisplacementMap` SVG filters to approximate watercolor texture. These Figma textures would produce a far more authentic watercolor feel because they're based on actual scanned watercolor patterns, not mathematical noise.

**Adoption path:** Download pack, apply texture fills to mountain shapes in Figma, export as SVG with embedded raster textures or as optimized PNG/WebP backgrounds.

### 4. Figma Draw Playground (1484549117658754259)

**What it is:** Official Figma learning resource for the Draw illustration tools. Teaches brush, pencil, scatter brush, and stretch brush through interactive examples.

**Key Figma Draw capabilities:**
- **Pencil tool:** Quick sketches and line work. Creates vector networks automatically. Good for ridgeline sketching with natural wobble.
- **Brush tool:** 50+ expressive textures for organic, hand-painted strokes. This is the key tool for achieving watercolor mountain effects.
- **Stretch brush:** Custom brushes that elongate along stroke length. Useful for mountain slope gradients and elongated cloud forms.
- **Scatter brush:** Custom brushes that repeat along stroke length. 10 built-in scatter brushes for stippling and shading. Perfect for foliage, texture distribution, wildflower fields.
- **Custom brush creation:** Any closed vector path can become a brush. Create pine tree shapes, wildflower forms, bird silhouettes as scatter brushes.
- **Stroke settings:** Frequency, wiggle, smoothness adjustable for organic feel.

**Relevance to Blue Ridge:** This is the most actionable asset. The playground demonstrates exactly how to create organic hand-drawn illustrations in Figma. Key workflows:
- Pencil for ridgeline base paths with natural wobble
- Brush with watercolor texture for fill/color washes
- Scatter brush with custom tree shapes for forest distribution along ridgelines
- Stretch brush for wispy cloud and smoke effects

### 5. Vecteezy Blue Ridge Mountains (1,548 vectors)

**What's available:** 1,548 free royalty-free Blue Ridge Mountains vectors across multiple styles:
- **Layered silhouette style** (most common): 5-8 ridgeline layers fading from dark foreground to pale background. Flat colors, no texture. This is the "stock" Blue Ridge look.
- **Vintage/retro badge style:** Mountain silhouettes inside circular badges with typography. Common for tourism/outdoor branding.
- **Detailed landscape style:** More realistic with tree details, sky gradients, sun/moon elements.
- **Minimalist line art:** Single-stroke mountain outlines. Too simple for our needs.

**Common color palettes across vectors:**
- Blue-to-pale-blue gradient series (atmospheric perspective)
- Sunset warm tones: coral, gold, amber above ridgelines
- Forest greens in foreground vegetation
- Fog/mist as semi-transparent white/light-blue overlays between layers

**Key technique patterns:**
- Each successive ridgeline layer is lighter in value AND lower in saturation
- Haze between layers achieved with semi-transparent fills (not blur filters)
- Foreground ridgeline has most detail (tree silhouettes on edge)
- Sky gradient has most color stops at the horizon line (where warm meets cool)

**Relevance to Blue Ridge:** Medium-high for reference. Don't use directly (licensing varies, and we need original art), but study the layering patterns. The consistency across 1,500+ vectors confirms the "rules" of Blue Ridge illustration:
1. 5-7 layers minimum
2. Each layer progressively lighter and bluer
3. Haze/fog between layers (opacity, not blur)
4. Foreground has most detail and warmest colors
5. Horizon is the warmest color band

---

## Technique Analysis: What Achieves Hand-Drawn Feel?

### Problem with Our Current Approach

Our current SVGs use programmatic techniques:
- `feTurbulence` + `feDisplacementMap` for "watercolor" texture
- Mathematically defined bezier curves for ridgelines
- Template literal string interpolation for colors

**Why this fails the "hand-drawn" test:**
- SVG filters produce uniform noise — real watercolor has variable saturation, pooling, and edge bleeding
- Mathematical curves are too smooth even with extra control points — real brush strokes have velocity-dependent weight variation
- No stroke width variation — hand-drawn lines are thicker under pressure, thinner on lifts
- No edge irregularity in fills — real watercolor bleeds beyond path boundaries

### What Creates Authentic Hand-Drawn Feel

From studying the community assets and watercolor tutorials:

| Technique | What It Does | Tool in Figma |
|-----------|-------------|---------------|
| **Variable stroke width** | Lines thicken/thin based on "pressure" | Brush tool (automatic with tablet) |
| **Texture fills** | Uneven saturation, paper grain visible | Watercolours pack textures as fills |
| **Edge bleeding** | Color extends beyond shape boundary | Brush with feathered edge settings |
| **Color pooling** | Darker pigment collects at edges | Gradient with darker ring at shape boundary |
| **Wet-on-wet blending** | Colors merge where overlapping | Overlapping shapes with multiply blend mode |
| **Dry brush texture** | Broken strokes show paper through | Scatter brush with low density |
| **Wobble in paths** | Natural hand tremor in lines | Pencil tool (inherent wobble) |
| **Atmospheric depth** | Far layers are paler, less detailed | Layer opacity 0.15-0.4 (far) to 0.7-1.0 (near) |

### The Watercolor Mountain Recipe (for Figma)

Based on analysis of community files + watercolor tutorials + Vecteezy reference:

1. **Sky wash**: Full-frame shape with watercolor texture fill. Rich gradient: warm at horizon (coral/gold), cool at top (blue). 6+ color stops concentrated near horizon.

2. **Far ridgelines (3 layers, opacity 0.15-0.3)**: Draw with Pencil tool for natural wobble. Fill with light blue-grey (mountainBlueLight). Very soft, low detail. No trees visible.

3. **Mid ridgelines (2 layers, opacity 0.35-0.5)**: Pencil paths with slightly more detail. Fill with medium blue (mountainBlue). Faint tree silhouette forms on ridgeline edge via scatter brush.

4. **Haze overlays**: Semi-transparent white/light-blue ellipses between ridgeline groups. NOT blur filters — opacity-based. This is the "atmospheric perspective" key.

5. **Near ridgeline (1-2 layers, opacity 0.65-0.85)**: Most detailed. Brush-drawn with watercolor texture fill. Tree forms visible as individual scatter brush elements. Darkest values (mountainBlueDark, espressoLight).

6. **Foreground**: Ground plane with texture fill. Detail elements (wildflowers, grass, cabin) drawn with Brush tool for hand-painted strokes.

7. **Paper grain overlay**: From Watercolours pack — single full-frame texture at very low opacity (5-10%). Unifies everything with hand-painted feel.

---

## Recommendations for Carolina Futons

### Immediate Actions

1. **Duplicate all 4 Figma Community files** into our CF Figma workspace to study layer structure hands-on
2. **Download Watercolours texture pack** — apply textures to test shapes to evaluate SVG export quality
3. **Practice in Figma Draw Playground** — specifically Brush and Scatter Brush for mountain/tree elements

### Technique Adoption Priority

| Priority | Technique | Why |
|----------|-----------|-----|
| P0 | **Figma Brush for fills** | Biggest quality jump — texture replaces flat filter noise |
| P0 | **Pencil for ridgelines** | Natural wobble vs mathematical curves |
| P1 | **Scatter brush for trees** | Organic distribution vs hand-placed triangles |
| P1 | **Watercolour texture fills** | Authentic paper/paint feel |
| P1 | **Opacity-based atmospheric haze** | Between ridgeline layers (already doing this, keep it) |
| P2 | **Custom scatter brush: wildflowers** | Create flower shape, scatter along foreground |
| P2 | **Stretch brush: smoke/clouds** | Wispy forms with natural taper |

### SVG Export Considerations

- Figma Draw brush strokes export as complex SVG paths — file size will be larger than programmatic SVGs
- Texture fills may export as embedded raster data — evaluate WebP/PNG background image vs inline SVG trade-off
- SVGO optimization can strip Figma metadata but must preserve brush path complexity
- Test render in Wix HtmlComponent before committing to any approach

### Updated Quality Bar (Proposed)

Replace the current 8-point programmatic checklist with:

1. **Designed in Figma Draw** — not hand-coded SVG template strings
2. **Brush tool fills** — no flat vector fills with SVG filter texture
3. **Pencil ridgelines** — natural wobble, not mathematical bezier
4. **Watercolor texture overlay** — from pack or custom, not feTurbulence
5. **5-7 atmospheric layers** — each progressively lighter (keep this from current bar)
6. **Brand colors** — all colors from sharedTokens (keep this)
7. **Accessibility** — title, role="img", aria-labelledby (keep this)
8. **Visual approval** — side-by-side with design.jpeg, approved by melania

---

## Cross-Reference

- **Parent plan:** `docs/plans/2026-03-04-figma-illustration-strategy-design.md`
- **Story 2a (Figma Draw tools):** Separate bead — tool mastery guide
- **Story 2c (Hand Draw plugin):** Separate bead — plugin evaluation
- **Story 2d (SVG export pipeline):** Separate bead — export workflow
- **Phase 3 (POC):** Redesign MountainSkyline as proof of concept

## Sources

- [Mountains Landscape — Figma Community](https://www.figma.com/community/file/923678537960272601/mountains-landscape)
- [Mountains — Figma Community](https://www.figma.com/community/file/1111995131111640662/mountains)
- [Watercolours — Figma Community](https://www.figma.com/community/file/1145299048770913511/watercolours)
- [Figma Draw Playground — Figma Community](https://www.figma.com/community/file/1484549117658754259/figma-draw-playground)
- [Blue Ridge Mountains Vectors — Vecteezy](https://www.vecteezy.com/free-vector/blue-ridge-mountains)
- [Figma Draw illustration tools — Help Center](https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools)
- [Figma Draw scatter brushes — Blog](https://www.figma.com/blog/figma-draw-scatter-brushes/)
- [Atmospheric perspective notes — Runevision](https://blog.runevision.com/2025/06/notes-on-atmospheric-perspective-and.html)
- [Watercolor Mountain Tutorial — EsperoArt](https://www.esperoart.com/mountain-landscape-watercolor-tutorial/)
- [Blue Ridge Mountains stock illustrations — Dreamstime](https://www.dreamstime.com/illustration/blue-ridge-mountains.html)
