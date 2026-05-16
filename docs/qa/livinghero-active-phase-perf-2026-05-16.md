# LivingHero active-phase perf finding — 2026-05-16

**Origin:** cf-sd80 Lighthouse baseline F2 — `/` SI 6.9s (perf 89, LCP 2.6s, CLS 0).
**Bead status:** Not yet filed — this doc is bead-fodder for melania.
**Scope:** Investigation only. No code change proposed in this doc.

## TL;DR

Post-cf-byms lazy-mount fixes the LCP-killer (4× full-bleed SVGs painting on critical path). Remaining SI hit comes from the **single active phase's** JS + paint cost. The day phase (`MascotWorldHero`) carries the heaviest weight — framer-motion import + mousemove cursor-eyes listener + 185 LOC SVG. Recommendation: convert active-phase paint to next/image raster snapshot for the FCP+SI window, with the SVG hydrating post-idle for animation. Estimated SI win: 1.5-2.5s on home.

## What cf-byms already did (do NOT duplicate)

`LivingHero.tsx` lines 41-58:

```tsx
const [mountInactive, setMountInactive] = useState(false);
useEffect(() => {
  const ric = window.requestIdleCallback ?? /* fallback */;
  const handle = ric(() => setMountInactive(true));
  // ...
}, []);
```

Inactive phases are gated on `mountInactive`. Only the active phase is in the DOM on first paint. This closed the original LCP regression where 4× full-bleed SVGs sat at opacity:0 but still composited every frame.

## What's left (the SI 6.9s component)

The active phase IS in the DOM at first paint and renders at `opacity: 1` (cfw-qz7 fix — LCP measurement requires opacity > 0). So whatever that phase paints + executes lands on the critical path.

Day-phase composition (assumes Lighthouse ran during 7-17h):

| Source | LOC | Critical-path cost |
|---|---|---|
| `MascotWorldHero.tsx` | 185 | Full SVG render + framer-motion `<motion.*>` components |
| `MascotCharacters.tsx` (Bear/Deer/Heron/Hummingbird/Pine/Cloud) | 266 (~half rendered) | All 6 character SVGs are shared — Bear + Pine + Cloud almost certainly painted |
| `MascotPalette.ts` V3_PAL | small | Constant import |
| framer-motion (m, motion, AnimatePresence) | ~30KB gzipped (chunk-shared with rest of app, but FIRST USAGE on home loads it eagerly) | JS parse + execution |
| useState/useEffect/useRef × 3 + mousemove listener | small | Lands JS in commit phase |

**SVG element estimate:** 30-60 `<path>`/`<circle>`/`<polygon>` elements per scene (Bear alone is ~12 paths + facial features; Pine is 4-6 paths repeated; clouds 2-3 each). With 4-6 deer/heron/hummingbird groups, total active-phase DOM is **~150-250 SVG nodes**. Browsers measure SI by visual-content-stability — every frame these nodes paint, SI shifts incrementally.

## Comparison: VintageSunRays (dawn/dusk phases)

`VintageSunRays.tsx` is 200 LOC but the paint surface is simpler:
- 1 sunburst SVG (radial gradient + ~24 ray paths)
- 1 mountain silhouette layer
- No framer-motion, no cursor-tracking effects
- No client interactivity beyond a CSS animation on the rays

If the cf-sd80 Lighthouse run had happened during dawn or dusk, SI would likely have been 30-40% lower (~4-5s) because the active phase paints less.

**Implication:** the SI hit on home is **time-of-day dependent**. The 6.9s figure is a daytime-specific upper bound; off-hours visitors see a lighter page.

## Recommendation tree

### A. Raster-snapshot fix (highest win, biggest UX tradeoff)

Convert `MascotWorldHero` (day phase) to a pre-generated raster image:

1. Render `MascotWorldHero` to a 1600×900 PNG via headless Playwright + screenshot
2. Store under `public/brand/heroes/world-day.{webp,avif}` (multi-format via next/image)
3. New component: `MascotWorldHeroRaster` — `<Image priority src="/brand/heroes/world-day.webp" ... />`
4. Post-hydration (post-idle), swap the raster for the live SVG so cursor-eyes + animations work for engaged users

**Win:** SI drops ~2-3s on home (raster paints in 1 frame; LCP candidate is a single img element with `priority`).
**Loss:** First-paint visitors see a static bear (no cursor-tracking eyes during the ~500ms idle gap). Acceptable per cf-sd80 spec's "Worth a follow-up that converts the SVG hero phases to next/image-served raster snapshots for the FCP+SI window, with the SVG version hydrating post-idle for animation."
**Effort:** ~6 hrs (raster build pipeline + Image component + post-idle SVG swap + tests).

### B. SVG-light fix (medium win, no UX tradeoff)

Strip the heaviest paint cost from `MascotWorldHero` while keeping it live:

1. Move the mousemove cursor-eyes effect to `requestIdleCallback` — listener attaches post-paint, eyes start tracking ~200ms later
2. Reduce framer-motion footprint: replace `<motion.*>` with plain `<g>` for static SVG elements that don't actually animate (audit which `motion.*` is load-bearing)
3. Drop secondary characters (deer, heron, hummingbird) from initial render — fade them in via the same `mountInactive` pattern cf-byms uses

**Win:** SI drops 0.5-1s. LCP candidate is still the SVG bear, no hero swap.
**Loss:** Cursor-eyes activate 200ms after mount (negligible — visitors barely notice).
**Effort:** ~3 hrs.

### C. Accept the SI (lowest effort)

`/` SI 6.9s is in "needs improvement" band but perf score is 89 (within rounding distance of 90 "good"). The cf-sd80 spec flagged this as **P3 post-cutover polish**, not a cutover blocker. Acceptable to defer indefinitely.

## What this finding does NOT cover

- **Mobile-emulation profile** — desktop Lighthouse only. Mobile SI is typically 1.5-2× higher; deferred to cf-sd80.fu1 mobile baseline
- **RUM data** — synthetic only. Vercel Analytics + Sentry traces are out of scope for this audit
- **Other home elements** — `LivingFooterBg`, `Footer`, `MascotFooterDivider`, `Header` — none flagged by cf-sd80 baseline

## Recommendation

File as **P3 post-cutover polish** bead. **Option B (SVG-light)** is the right first lever — preserves all UX, ships in ~3 hrs, recovers ~1s SI. Option A (raster swap) becomes the cf-sd80.fu1 escalation if mobile baseline surfaces a worse number.

## Refs

- cf-sd80 baseline: `docs/cf-3qt.8/lighthouse-perf-baseline-2026-05-16.md` (this rig)
- cf-byms (inactive-phase lazy-mount): `src/components/home/LivingHero.tsx` lines 41-58
- cfw-qz7 (active-phase opacity:1 fix): `src/components/home/LivingHero.tsx` line 140-143 comment
- cfw-vxb site-speed re-audit (2026-05-09): notes LivingHero entanglement at row 77, pre-cf-byms
- Standing order cf-ukc6 (doc-only deliverable — no cfw build cost)
