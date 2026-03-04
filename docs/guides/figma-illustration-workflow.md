# Carolina Futons — Figma Illustration Workflow Guide

**REQUIRED READING for all illustration beads.**

**Bead:** hq-5j6u | **Date:** 2026-03-04 | **Author:** cfutons/crew/miquella
**Parent:** Phase 4a of Figma-First Illustration Strategy (hq-4cut)

---

## TL;DR

1. Design in Figma Draw (not code)
2. Apply Figma effects (Texture, Noise, Progressive Blur)
3. Export SVG from Figma
4. Run `node scripts/svgPipeline.js input.svg`
5. Integrate tokenized output into codebase
6. Visually verify against design.jpeg

**No more programmatic SVG.** Writing SVG as JS template strings with `feTurbulence`/`feDisplacementMap` filters is deprecated. Those produced "too abstract" results.

---

## 1. Figma File Access

### Carolina Futons Design File

The CF Figma file contains brand styles, component library, and illustration frames for every page.

**To get access:**
1. Request the Figma file URL from melania (cfutons/crew/melania) — she coordinates all design assets
2. Duplicate the file to your drafts for editing: Community files → "Open in Figma" → duplicate
3. Brand tokens are already set up as Figma color/text styles matching `sharedTokens.js`

### Community Reference Files

Download these into your Figma drafts for technique reference:

| File | URL | Study For |
|------|-----|-----------|
| Mountains Landscape | [Figma 923678537960272601](https://www.figma.com/community/file/923678537960272601) | Layer structure, ridgeline paths |
| Mountains | [Figma 1111995131111640662](https://www.figma.com/community/file/1111995131111640662) | Atmospheric perspective, depth |
| Watercolours Pack | [Figma 1145299048770913511](https://www.figma.com/community/file/1145299048770913511) | Texture fills, paper grain |
| Figma Draw Playground | [Figma 1484549117658754259](https://www.figma.com/community/file/1484549117658754259) | Tool practice, brush demos |
| 30 Stretch Brushes | [Figma 1504822987580694274](https://www.figma.com/community/file/1504822987580694274) | Paint stroke brushes |
| Blue Ridge Reference | [Vecteezy](https://www.vecteezy.com/free-vector/blue-ridge-mountains) | 1,548 vectors for visual reference |

---

## 2. Step-by-Step: Blue Ridge Mountain Illustration in Figma Draw

### Step 1: Composition — Pencil Tool

1. Create a frame:
   - Page headers: **1440 x 200**
   - Full scenes: **800 x 500**
2. Sketch 7 ridgeline layers with the **Pencil tool** (distant to foreground)
3. **Blue Ridge profile**: Soft rolling curves. NOT jagged peaks, NOT smooth mathematical arcs. Each ridge needs 6-8 curve segments minimum for natural undulation.
4. Mark sun/moon position, horizon line, foreground element placement (cabin, trees, trail)
5. Hold **Shift** for straight horizon segments

### Step 2: Refinement — Pen Tool

1. Refine each ridgeline path — add extra control points
2. Target 10-20+ bezier points per ridge for organic feel
3. Close each path: ridge top → bottom of viewBox (for fill)
4. Ensure ridgelines overlap slightly for seamless layering

### Step 3: Color & Fills

Apply brand colors from `sharedTokens.js`:

| Element | Color Token | Hex |
|---------|------------|-----|
| Sky top | skyGradientTop | #B8D4E3 |
| Sky bottom | skyGradientBottom | #F0C87A |
| Far mountains | mountainBlueLight | #A8CCD8 |
| Mid mountains | mountainBlue | #5B8FA8 |
| Near mountains | mountainBlueDark | #3D6B80 |
| Foreground earth | espressoLight | #5C4033 |
| Dark elements | espresso | #3A2518 |
| Warm accents | sunsetCoral | #E8845C |
| Light fills | sandBase / sandLight | #E8D5B7 / #F2E8D5 |
| Trees | success | #4A7C59 |
| Background | offWhite | #FAF7F2 |

**Sky gradient**: Create a multi-stop linear gradient with 5+ stops. Concentrate color stops near the horizon where warm meets cool.

**Mountain opacity ramp**: Each layer progressively lighter from foreground to distance:
- Foreground: opacity 0.75-0.85
- Midground: opacity 0.35-0.50
- Far background: opacity 0.12-0.25

### Step 4: Texture & Effects

Apply these Figma effects to transform flat vectors into hand-drawn illustration:

| Effect | Apply To | Settings | Purpose |
|--------|----------|----------|---------|
| **Texture** | Every mountain layer | Size: medium, Radius: slight | Distresses edges — hand-drawn look |
| **Noise (Mono)** | Mountain fills | Low density, subtle opacity | Paper grain texture |
| **Noise (Duo)** | Sky gradient | Two warm tones, low density | Atmospheric texture |
| **Progressive Blur** | 3-4 farthest mountain layers | Blur increasing with distance | Atmospheric haze between ridges |
| **Dynamic Strokes** | Mountain outlines | Moderate wiggle | Hand-drawn line variation |
| **Drop Shadow** | Foreground elements | Warm espresso tint, soft blur | Depth on cabins, trees |

**Key rule**: Texture effect replaces `feTurbulence + feDisplacementMap`. Noise effect replaces `feNoise / paperGrain`. Progressive Blur replaces opacity-only haze. These produce better results.

### Step 5: Detail Elements — Scatter & Stretch Brushes

Create custom brushes for repeating elements:

| Element | Brush Type | How |
|---------|-----------|-----|
| Pine trees | Scatter | Draw one tree silhouette → right-click → Create Scatter Brush → apply along midground ridgelines |
| Birds (V shapes) | Scatter | Draw one bird V → scatter in sky area, vary scale |
| Wildflowers | Scatter | Draw one flower shape → scatter at foreground base |
| Chimney smoke | Stretch | Draw wispy shape → stretch along smoke path |
| Clouds | Stretch | Draw cloud wisp → stretch across sky |
| Stars | Scatter | Small dot → scatter in evening/night skies |

**Minimum element count**: 15 distinct elements per scene (trees, birds, flowers, smoke, stars, cabin details, etc.)

### Step 6: Final Review in Figma

Before exporting, verify:
- [ ] 5-7 visible ridgeline layers with atmospheric haze between them
- [ ] Texture effect on all mountain shapes (no clean vector edges)
- [ ] Noise visible at zoom (paper grain feel)
- [ ] Progressive blur on distant layers (depth)
- [ ] 15+ distinct detail elements
- [ ] All colors are from the brand palette
- [ ] Overall warm sand/coral feel matches design.jpeg

---

## 3. Tool-to-Element Reference

Quick reference: which Figma tool for which illustration element.

| Visual Element | Primary Tool | Secondary Tool | Notes |
|---------------|-------------|----------------|-------|
| **Sky** | Rectangle + gradient fill | Noise effect | 5+ stop gradient, concentrate stops at horizon |
| **Far ridgelines** | Pencil | Progressive Blur | Very soft, low detail, opacity 0.12-0.25 |
| **Mid ridgelines** | Pencil + Pen refine | Texture effect | Moderate detail, opacity 0.35-0.50 |
| **Near ridgelines** | Pencil + Pen refine | Texture + Noise | Most detail, opacity 0.75-0.85 |
| **Atmospheric haze** | Ellipse (semi-transparent) | Progressive Blur | White/light-blue overlays between layer groups |
| **Pine trees** | Custom scatter brush | — | Draw one tree → scatter along ridgeline |
| **Birds** | Custom scatter brush | — | V-shape, scatter in sky, vary scale/opacity |
| **Wildflowers** | Custom scatter brush | — | Small circles/petals, scatter at foreground |
| **Cabin walls** | Rectangle | Texture effect | Warm fill, distressed edges |
| **Cabin roof** | Pen tool (triangle) | Drop shadow | Dark espresso fill |
| **Chimney smoke** | Custom stretch brush | Dynamic Strokes | Wispy, low opacity, organic path |
| **Clouds** | Custom stretch brush | — | Wispy ellipse forms, very low opacity |
| **Trail/path** | Pencil | Dynamic Strokes | Organic wobble, sandDark stroke |
| **Sun/sunset glow** | Radial gradient circle | — | Warm coral center → transparent edge |
| **Stars/fireflies** | Custom scatter brush | — | Tiny dots, warm colors, low opacity |
| **Paper grain** | Full-frame rectangle | Noise effect | Mono, very low opacity (5-10%), covers everything |

---

## 4. Export Pipeline: Figma → Optimized SVG → Wix

### 4.1 Export from Figma

1. Select your illustration frame
2. Right-click → **Export** → **SVG**
3. Settings:
   - Include "id" attribute: **OFF**
   - Outline Text: **ON**
4. Save the `.svg` file to your working directory

### 4.2 Run the SVG Pipeline

```bash
node scripts/svgPipeline.js path/to/illustration.svg
```

This produces three files:

| Output | Description |
|--------|-------------|
| `illustration.optimized.svg` | Clean SVG — Figma metadata removed (20-40% smaller) |
| `illustration.tokenized.svg` | SVG with `data-token-*` attributes mapping hex → brand tokens |
| `illustration.wix.html` | Complete HTML wrapper for Wix HtmlComponent injection |

**Optional output directory:**
```bash
node scripts/svgPipeline.js input.svg --output ./output/
```

### 4.3 What the Pipeline Does

**Optimization** — Removes:
- XML declarations, HTML comments, `<metadata>` elements
- Empty `<style>` and `<defs>` blocks
- Figma-specific attributes and namespaces
- Excess whitespace

**Brand Token Injection** — Maps hardcoded hex to tokens:
```xml
<!-- Before --> <rect fill="#E8D5B7"/>
<!-- After -->  <rect fill="#E8D5B7" data-token-fill="colors.sandBase"/>
```

**Wix Wrapper** — Produces responsive HTML with `postMessage` listener for dynamic updates from Wix page code.

### 4.4 Programmatic Usage

```javascript
import { processSvgPipeline } from './scripts/svgPipeline.js';
import fs from 'fs';

const rawSvg = fs.readFileSync('mountain.svg', 'utf8');
const result = processSvgPipeline(rawSvg);
// result.report: { originalSize, optimizedSize, savingsPercent, tokenCount }
```

Individual functions also available: `optimizeSvg()`, `injectBrandTokens()`, `wrapForWixHtmlComponent()`, `buildColorMap()`.

### 4.5 Integrate into Wix Page

**Option A — HtmlComponent (recommended for complex illustrations):**
1. Add an HtmlComponent to the page in Wix Studio
2. Paste `.wix.html` content into the component
3. Dynamic updates via: `$w('#htmlComponent').postMessage(svgString)`

**Option B — Inline SVG module (for simple/reusable illustrations):**
1. Create a JS module in `src/public/` exporting SVG strings
2. Use tokenized SVG with template literal color injection from `sharedTokens.js`
3. Set via: `$w('#container').html = svgString`

### 4.6 Export Quality Checklist

- [ ] Pipeline ran without errors
- [ ] Token report shows all brand colors mapped (no unmapped hex)
- [ ] SVG renders correctly in browser (open `.optimized.svg`)
- [ ] Wix HTML renders correctly (open `.wix.html`)
- [ ] File size < 50KB
- [ ] Visual comparison against design.jpeg passes

---

## 5. Updated Quality Bar

**Replaces the old 8-point programmatic SVG checklist.**

Every illustration PR must satisfy ALL of these:

| # | Requirement | How to Verify |
|---|-------------|---------------|
| 1 | **Designed in Figma Draw** | Not coded as JS template strings. Figma file link in PR description. |
| 2 | **Brush/Pencil paths** | Ridgelines drawn with Pencil (natural wobble), not mathematical bezier. Detail fills use Brush tool. |
| 3 | **Figma effects applied** | Texture (edge distressing), Noise (paper grain), Progressive Blur (atmospheric haze) visible in render. |
| 4 | **5-7 atmospheric ridgeline layers** | Each progressively lighter/hazier from foreground to background. |
| 5 | **15+ distinct SVG elements** | Trees, birds, flowers, smoke, cabin, trail, clouds, stars — count in pipeline report. |
| 6 | **5+ gradient stops** | Sky gradient has rich color transition, not 2-stop linear. |
| 7 | **All colors from sharedTokens** | Pipeline token injection report shows zero unmapped hex values. |
| 8 | **Pipeline processed** | `.optimized.svg`, `.tokenized.svg`, `.wix.html` all generated. |
| 9 | **Accessibility** | SVG has `<title>`, `role="img"`, `aria-labelledby`. Add manually if Figma export strips them. |
| 10 | **Visual approval** | Side-by-side with design.jpeg. Must match warm Blue Ridge aesthetic. melania approves. |

### What Passes vs What Fails

| PASSES | FAILS |
|--------|-------|
| Hand-drawn ridgelines with natural undulation | Mathematically smooth bezier curves |
| Visible texture/noise grain on fills | Flat solid fills with SVG filter noise |
| Progressive blur on distant layers | Uniform opacity with no blur |
| Brush-drawn detail elements | Geometric shapes (triangles for trees) |
| Warm sand/coral/blue palette | Cold or generic color scheme |
| Figma file link in PR | "I coded this SVG by hand" |

---

## Reference Guides

| Guide | Path | Covers |
|-------|------|--------|
| Figma Draw Tool Reference | `docs/guides/figma-draw-tool-reference.md` | All Figma Draw tools, effects, community resources |
| Community Asset Study | `docs/guides/figma-community-asset-study.md` | Analysis of 4 community files + Vecteezy vectors |
| SVG Export Pipeline | `docs/guides/svg-export-pipeline.md` | Pipeline CLI usage, programmatic API |
| Brand Tokens | `src/public/sharedTokens.js` | Color hex values, spacing, typography |
| Design North Star | `design.jpeg` | Visual quality target for all illustrations |

---

## Quick Reference Card

```
START → Figma Draw → Pencil (ridgelines) → Pen (refine)
                   → Gradient fills (sky, ground)
                   → Opacity ramp (0.12 far → 0.85 near)
                   → Texture effect (edge distressing)
                   → Noise effect (paper grain)
                   → Progressive Blur (atmospheric haze)
                   → Scatter Brush (trees, birds, flowers)
                   → Stretch Brush (smoke, clouds)
                   → Review against design.jpeg
      → Export SVG → node scripts/svgPipeline.js input.svg
      → Integrate  → HtmlComponent or inline module
      → Verify     → Browser render + design.jpeg comparison
      → PR         → Include Figma file link + visual screenshot
```
