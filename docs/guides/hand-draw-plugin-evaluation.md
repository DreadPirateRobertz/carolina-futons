# Hand Draw Plugin Evaluation — Carolina Futons Illustration Pipeline

**Bead**: cf-jt12 | **Evaluator**: radahn | **Date**: 2026-03-04
**Parent Epic**: hq-4cut (Figma-First Illustration Pipeline, Phase 2c)

---

## Executive Summary

**Recommendation: DO NOT adopt Hand Draw plugin for mountain ridgeline work. USE native Figma Draw tools (Texture effect + Pencil/Pen refinement) as the primary workflow. Reserve Hand Draw plugin as a SECONDARY tool for small detail elements only (cabin silhouettes, fence posts, UI borders).**

The Hand Draw plugin (and its underlying rough.js engine) applies roughness uniformly to ALL edges of a filled path. For mountain ridgeline compositions where the top edge must be organic while the bottom extends cleanly to the canvas edge, this uniform approach destroys the layered depth illusion that defines the Blue Ridge aesthetic.

---

## Plugins Evaluated

### 1. Hand Draw (Figma Community)
- **URL**: https://www.figma.com/community/plugin/1470038834240070564/hand-draw
- **What it does**: Transforms existing SVG paths into hand-drawn interpretations
- **Key feature**: Preserves vector editability — you can adjust anchor points after transformation
- **Settings**: Roughness level, variation amount
- **Limitations**: Applies same roughness to ALL edges of a path; no per-edge control

### 2. Rough (Figma Community, roughjs-based)
- **URL**: https://www.figma.com/community/plugin/908327335402084440/rough
- **What it does**: Converts Figma primitives (lines, curves, arcs, polygons, circles, ellipses, paths) to sketchy style
- **Engine**: rough.js v4.x
- **Settings**: roughness (0-10+), bowing (line curvature), fillStyle (solid/hachure/zigzag/cross-hatch/dots/dashed), fillWeight, hachureAngle, hachureGap, curveStepCount, seed (reproducible)
- **Limitations**: Same uniform-edge problem; hachure fills look like drafting illustrations, not watercolor

### 3. Roughly (Figma Community, excalidraw-inspired)
- **URL**: https://www.figma.com/community/plugin/1177565418933907283/roughly
- **What it does**: Sketch vector elements to hand-drawn shapes, powered by roughjs
- **Settings**: Fill style (hachure, zigzag, cross-hatch, solid), sloppiness intensity
- **Limitations**: Same roughjs engine, same uniform-edge behavior

---

## Testing Against MountainSkyline.js Paths

### Method

Extracted all 7 ridgeline paths from `src/public/MountainSkyline.js` and rendered them through rough.js at roughness levels 0.5, 1.0, 2.0, and 3.0, plus bowing variations and hachure fill style. Visual comparison against the original programmatic SVG with feTurbulence watercolor filter.

### Results by Roughness Level

| Roughness | Edge Wobble | Ridgeline Visibility | Atmospheric Depth | Blue Ridge Feel |
|-----------|-------------|---------------------|-------------------|-----------------|
| 0.5 | Barely visible | Good | Preserved | Nearly identical to original — too subtle to justify plugin |
| 1.0 | Gentle | Degraded | Slightly degraded | Bottom edges wobble — layers don't stack cleanly |
| 2.0 | Prominent | Poor | Significantly degraded | Mountain layers blend into undifferentiated mass |
| 3.0 | Heavy | Very poor | Destroyed | Ridgelines unrecognizable — looks like abstract noise |

### Critical Finding: The Uniform Edge Problem

Mountain ridgeline SVG paths are structured as:
```
M0,200 L0,105 C... (ridgeline top edge) ...C1440,62 L1440,200 Z
```

The path has TWO distinct edge zones:
- **Top edge**: The ridgeline — should have organic wobble
- **Bottom/side edges**: Straight lines to canvas bottom — must remain clean for layer stacking

Hand Draw / rough.js applies roughness to ALL edges equally. This means:
- The clean bottom edge `L1440,200 Z` becomes wobbly
- Gaps appear between overlapping mountain layers
- The atmospheric depth illusion (layers stacking from bottom) breaks
- Adjacent layers no longer align at the canvas bottom

**This is architecturally incompatible with our ridgeline composition approach.**

### Bowing Test (roughness=1.5, bowing=2.0)

Higher bowing adds gentle curvature to straight segments. Result: slightly softer feel but still suffers from the uniform edge problem. The bottom edge bows inward, creating visible white gaps between layers.

### Hachure Fill Test

Cross-hatch fill creates a pencil-sketch aesthetic. While visually interesting, it's wrong for our brand — Carolina Futons uses watercolor washes, not drafting illustrations. The hachure lines are too precise and geometric for the Blue Ridge watercolor feel.

---

## Comparison: Plugin vs Native Figma Draw

| Criteria | Hand Draw Plugin | Native Figma Draw |
|----------|-----------------|-------------------|
| **Ridgeline control** | Uniform roughness on all edges | Per-edge control — rough top, clean bottom |
| **Texture quality** | Algorithmic randomness | Hand-crafted organic wobble |
| **Atmospheric haze** | Cannot apply Progressive Blur | Progressive Blur on distant layers |
| **Paper grain** | Not included | Noise effect (Mono) on each layer |
| **Edge distressing** | Uniform rough edges | Texture effect — controlled edge distress |
| **Reproducibility** | Seed-based (exact reproduction) | Not seed-based (each design is unique) |
| **Speed** | Instant transformation | Slower (manual work per illustration) |
| **Editability** | Preserves vector points | Full vector editing |
| **Blue Ridge accuracy** | Poor — destroys layer composition | Excellent — matches design.jpeg |

---

## Where Hand Draw Plugin IS Useful

Despite being wrong for mountain ridgelines, the plugin has valid use cases for smaller elements:

### Good candidates for Hand Draw plugin:
1. **Cabin silhouettes** — Simple closed shapes where uniform edge roughness adds charm
2. **Fence posts** — Rectangular shapes that benefit from wobbly edges
3. **UI borders** — Page section dividers, card borders, button outlines
4. **Standalone icons** — Navigation icons, social media icons transformed to hand-drawn style
5. **Text containers** — Speech bubbles, callout boxes with sketchy borders

### Bad candidates (avoid):
1. **Mountain ridgeline layers** — Breaks atmospheric depth composition
2. **Sky gradient shapes** — Uniform roughness creates gaps at edges
3. **Full-scene illustrations** — Loses the controlled layering that creates depth
4. **Anything with clean-bottom fills** — The bottom-edge wobble is destructive

---

## Rough.js Configuration Reference (for programmatic fallback)

If the team decides to use rough.js in code (not recommended over Figma Draw, but documented):

```javascript
// Blue Ridge ridgeline — NOT recommended (uniform edge problem)
rc.path(ridgelinePath, {
  roughness: 0.5,        // Minimum to preserve ridge shape
  bowing: 1,             // Default curvature
  fill: '#3A2518',       // espresso
  fillStyle: 'solid',    // NOT hachure for watercolor feel
  stroke: 'none',
  seed: 42,              // Reproducible
  preserveVertices: true  // Keep endpoints fixed
});

// Cabin detail — GOOD use case
rc.path(cabinPath, {
  roughness: 1.5,        // Medium wobble for charm
  bowing: 1.5,           // Slight curvature
  fill: '#E8D5B7',       // sandBase
  fillStyle: 'solid',
  stroke: '#3A2518',     // espresso outline
  strokeWidth: 1,
  seed: 42
});
```

---

## Final Recommendation

### Primary workflow: Native Figma Draw tools
Per the Figma-first directive and `docs/guides/figma-draw-tool-reference.md`:
1. **Pencil tool** for ridgeline sketches (organic top edges)
2. **Pen tool** for refinement (precise control point placement)
3. **Texture effect** for edge distressing (replaces feTurbulence)
4. **Noise effect** for paper grain (replaces feNoise)
5. **Progressive Blur** for atmospheric haze (replaces feGaussianBlur)

### Secondary workflow: Hand Draw plugin for detail elements only
- Install plugin in the Carolina Futons Figma file
- Apply to cabin, fence, and small standalone shapes (roughness 1.0-2.0)
- Do NOT apply to mountain ridgeline paths or sky fills
- Do NOT apply to any shape that participates in layered depth composition

### Not recommended: Rough/Roughly plugins
- Same underlying engine (roughjs) as Hand Draw but with less polish
- Hachure fill styles don't match our watercolor brand aesthetic
- Use Figma Draw's native Noise effect instead of roughjs noise

---

## Sources

- [Hand Draw Plugin](https://www.figma.com/community/plugin/1470038834240070564/hand-draw) — Figma Community
- [Rough Plugin](https://www.figma.com/community/plugin/908327335402084440/rough) — Figma Community (roughjs-based)
- [Roughly Plugin](https://www.figma.com/community/plugin/1177565418933907283/roughly) — Figma Community
- [Rough.js Wiki](https://github.com/rough-stuff/rough/wiki) — Full configuration API
- [Best Figma Plugins for Hand-Drawn Aesthetics 2026](https://www.illustration.app/blog/best-figma-plugins-for-creating-hand-drawn-aesthetics-in-2026) — Plugin comparison
- [Vector to Hand Drawn](https://www.figma.com/community/plugin/1403358417813653484/vector-to-hand-drawn) — Alternative plugin (not evaluated in depth)
- Internal: `src/public/MountainSkyline.js` — Test paths for evaluation
- Internal: `docs/guides/figma-draw-tool-reference.md` — Figma Draw workflow reference
- Internal: `docs/plans/2026-03-04-figma-illustration-strategy-design.md` — Parent strategy
