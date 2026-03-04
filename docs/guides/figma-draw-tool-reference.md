# Figma Draw Tool Reference — Blue Ridge Mountain Illustrations

**Bead**: hq-l0d3 | **Author**: melania | **Date**: 2026-03-04
**Purpose**: Complete reference for creating hand-drawn Blue Ridge mountain illustrations in Figma Draw.

---

## Why Figma Draw Instead of Programmatic SVG

Our current approach (JS template strings + SVG filter effects like feTurbulence/feDisplacementMap) produces illustrations that pass automated quality tests but look "too abstract" per overseer feedback. **The fundamental gap: code-generated SVGs with filters will never match hand-drawn illustration quality.**

Figma Draw provides purpose-built tools for hand-drawn work that produces higher fidelity output.

---

## Core Drawing Tools

### Pencil Tool
- **Use for**: Quick mountain ridgeline sketches, terrain outlines, rough composition drafts
- **How it works**: Creates vector networks automatically, placing points along drawn path based on length/complexity
- **Blue Ridge technique**: Sketch soft rolling ridgelines with natural undulation — NOT jagged peaks
- **Tip**: Hold Shift for straight segments (horizon lines)

### Brush Tool
- **Use for**: Watercolor texture, painted fills, atmospheric effects
- **Two brush types**:
  - **Stretch Brush**: Elongates brush style along stroke length → use for mountain slope gradients, sky washes, flowing water
  - **Scatter Brush**: Repeats brush style along stroke → use for foliage distribution, wildflowers, stars, birds, texture fills
- **10 built-in scatter brushes**: Optimized for stippling and shading
- **Custom brushes**: Create from any closed vector path → design Blue Ridge-specific pine tree, wildflower, and bird brushes
- **Sharing**: Custom brushes are file-specific. Copy a layer with the brush to another file to share it.

### Pen Tool
- **Use for**: Precise path editing, mountain ridgeline refinement, architectural details (cabin silhouettes)
- **Blue Ridge technique**: After rough pencil sketch, refine with pen tool — add extra control points for natural undulation

### New Vector Editing Tools
- **Lasso**: Select multiple points for bulk editing — useful for adjusting entire mountain ranges
- **Shape Builder**: Combine/subtract shapes — build complex tree silhouettes
- **Multi-Edit**: Edit same properties across multiple objects — batch-adjust mountain layer opacities

---

## Effects for Hand-Drawn Aesthetic

### Texture Effect (CRITICAL)
- **What it does**: Distresses object edges → creates roughened, hand-drawn appearance
- **Parameters**: Size (effect scale), Radius (extension past boundary)
- **Clip to shape**: Limits effect to within layer boundary
- **Blue Ridge use**: Apply to ALL mountain ridgeline shapes for organic edges
- **Limit**: One texture effect per layer
- **This replaces**: Our feTurbulence + feDisplacementMap SVG filter approach

### Noise Effect (CRITICAL)
- **What it does**: Applies random pixels → grainy texture mimicking film photography / watercolor paper
- **Color modes**: Mono (1 color), Duo (2 colors), Multi (many colors)
- **Parameters**: Noise size (pixel scale), Density (pixel concentration), Color + opacity
- **Blue Ridge use**: Apply Mono noise to mountain fills for paper grain. Apply Duo noise to sky gradients for atmospheric texture.
- **Limit**: Up to 2 noise effects per layer
- **This replaces**: Our feNoise / paperGrain SVG filter approach

### Progressive Blur
- **What it does**: Directional blur with control over start/end intensity
- **Parameters**: Blur size, Direction, Start/end intensity
- **Blue Ridge use**: Apply to distant mountain layers → creates atmospheric haze between ridgelines. Blur increases with distance = depth illusion.
- **This replaces**: Our feGaussianBlur haze filter + opacity ramp approach

### Dynamic Strokes (Wiggle)
- **What it does**: Adds natural variation to stroke width → "perfectly imperfect" lines
- **Blue Ridge use**: Apply to mountain outlines for hand-drawn feel. Vary stroke width along ridgelines.
- **This replaces**: Our "organic hand-drawn paths with wobble" requirement

### Drop Shadow / Inner Shadow
- **Parameters**: X/Y offset, Color + opacity, Blur, Spread (up to 8 per layer)
- **Blue Ridge use**: Warm espresso-tinted shadows (`rgba(58,37,24,...)`) on foreground elements. Inner shadows on mountain layers for depth.

---

## Fills and Gradients

### Gradient Fills
- **Use**: 5+ stop gradients for sky transitions (sunrise/sunset)
- **Blue Ridge palette**: skyGradientTop → mountainBlueLight → skyGradientBottom → sandLight → sunsetCoral
- **Technique**: Create multi-stop gradients directly in Figma's fill panel

### Noise Fill (via plugin)
- **Noise & Texture Plugin**: Generates seamless tiled noise, textures, patterns live
- **Types available**: Particle Flow, Striped, Radial Waves, Spots, Fiber, Pixelated, Diffusion
- **Blue Ridge use**: Fiber noise for wood texture on cabin elements. Particle flow for atmospheric haze.

### Pattern Fill
- **Use**: Repeating texture patterns for backgrounds
- **Blue Ridge use**: Subtle paper texture overlay on entire illustration

---

## Blue Ridge Mountain Illustration Workflow

### Step 1: Composition (Pencil Tool)
1. Set viewBox: 1440×200 for headers, 800×500 for scenes
2. Sketch 7 ridgeline layers (distant → foreground) with Pencil tool
3. Blue Ridge profile: soft rolling curves, NOT jagged peaks. Each ridge 6-8 curve segments.
4. Add horizon line, sun/moon position, foreground elements (cabin, trees)

### Step 2: Refinement (Pen Tool)
1. Refine each ridgeline path — add extra control points for natural undulation
2. Ensure each ridge has 10-20+ bezier points for organic feel
3. Close each ridge path (fill from ridge top down to bottom of viewBox)

### Step 3: Color & Fills
1. Apply brand colors from sharedTokens.js:
   - Sky: skyGradientTop (#B8D4E3) → skyGradientBottom (#F0C87A)
   - Mountains: mountainBlue (#5B8FA8) with decreasing opacity per layer
   - Foreground: espresso (#3A2518) at full opacity
2. Multi-stop sky gradient: 5+ stops minimum
3. Each mountain layer: progressively lighter from foreground (0.85) to distant (0.12)

### Step 4: Texture & Effects
1. **Texture effect** on each mountain layer → distressed edges
2. **Noise effect** (Mono, low density) on each fill → paper grain
3. **Progressive blur** on distant layers (3-4 farthest) → atmospheric haze
4. **Dynamic strokes** on outlines → hand-drawn wiggle

### Step 5: Detail Elements (Scatter Brush)
1. Create custom **pine tree** scatter brush → apply along midground ridgelines
2. Create custom **bird (V shape)** scatter brush → scatter in sky area
3. Create custom **wildflower** scatter brush → apply at foreground base
4. Add chimney smoke wisps (Pencil + low opacity)
5. Minimum 15 distinct elements per scene

### Step 6: Export & Integration
1. Select illustration frame → Export → SVG
2. Run through SVGO optimization (remove Figma metadata)
3. Replace hardcoded hex colors with sharedTokens.js variable references
4. Inject into Wix HtmlComponent via `$w('#container').html = svgString`
5. Verify rendering in browser

---

## Figma Community Resources

| Resource | URL | What to Study |
|----------|-----|---------------|
| Mountains Landscape | figma.com/community/file/923678537960272601 | Mountain layer techniques |
| Mountains | figma.com/community/file/1111995131111640662 | Ridge profiles, depth |
| Watercolours | figma.com/community/file/1145299048770913511 | Watercolor texture fills |
| Figma Draw Playground | figma.com/community/file/1484549117658754259 | Tool practice |
| 30 Stretch Brushes | figma.com/community/file/1504822987580694274 | Paint stroke brushes |
| Drawing with Brushes | figma.com/community/file/1509694322217243479 | Brush + texture tutorial |
| Sketch Elements | figma.com/community/file/1088571331676113926 | Hand-drawn element set |
| Blue Ridge Vectors | vecteezy.com/free-vector/blue-ridge-mountains | 1,548 reference vectors |

## Plugins to Evaluate

| Plugin | Purpose | Priority | Verdict |
|--------|---------|----------|---------|
| Hand Draw | Transforms precise vectors → sketchy hand-drawn style | EVALUATED | **NOT recommended for ridgelines** — uniform roughness destroys atmospheric depth. OK for small detail elements only. See `docs/guides/hand-draw-plugin-evaluation.md` |
| Rough / Roughly | Similar sketch-style transforms | EVALUATED | **Same problem** — uniform edge treatment breaks layered mountain composition |
| Noise & Texture | Dynamic seamless noise/texture generation | P2 | Not yet evaluated |
| Noise Effect Generator | Multiple noise types (fiber, waves, spots) | P2 | Not yet evaluated |
| Figma Brush for Draw | Additional brush styles | P2 | Not yet evaluated |

**Plugin Decision (radahn 2026-03-04):** Use native Figma Draw tools (Texture effect + Pencil/Pen + Progressive Blur) for mountain ridgelines. Plugins only for small detail elements where uniform roughness is acceptable.

---

## Living Document Protocol

**This document is a living reference.** Every crew member working on an illustration bead MUST:
1. **READ** this doc + all files in `docs/guides/` before starting illustration work
2. **UPDATE** this doc with any new techniques, findings, or lessons learned during their bead
3. **REFERENCE** this doc in their PR description to confirm they followed the workflow

New findings go in the relevant section. If a new guide file is created (like `hand-draw-plugin-evaluation.md`), add it to the Resources table and summarize key findings here.

---

## Key Insight: What Changes vs What Stays

### CHANGES (Figma-first)
- Illustration design moves from code editor to Figma Draw
- SVG filter effects (feTurbulence, feDisplacementMap, feNoise) replaced by native Figma effects (Texture, Noise, Progressive Blur)
- Mountain ridgeline paths drawn by hand in Figma, not calculated in JavaScript
- Detail elements (trees, birds, flowers) created with custom scatter brushes, not coded as SVG shapes

### STAYS THE SAME
- sharedTokens.js remains color source of truth
- HtmlComponent injection pattern (`$w('#container').html = svgString`)
- viewBox dimensions (1440×200 headers, 800×500 scenes)
- Accessibility requirements (role="img", aria-labelledby, title)
- Brand aesthetic: Blue Ridge Mountains, warm sand/espresso/coral palette
- design.jpeg remains the north star
