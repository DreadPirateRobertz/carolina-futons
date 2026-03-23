# Phase 7 — Living Blue Ridge Sky: Design Spec

**Date:** 2026-03-23
**Status:** Approved for implementation
**Scope:** Header + Footer illustration system — Carolina Futons website (Wix Velo)
**Also applies to:** cfutons_mobile app (coordinate with dallas)

---

## 1. Vision

The Carolina Futons header is a **living window onto the Blue Ridge Mountains**. The sky, mountain ridges, lighting, wildlife, and weather all respond to the visitor's local time of day, creating an authentic sense of place that no competitor can replicate. Asheville / Hendersonville NC — this IS the view from the region.

Not decorative. Not gratuitous. **Honest and local.**

---

## 2. Time-of-Day System

The illustration runs a 24-hour cycle driven by `new Date()` on the visitor's device.

### Time Phases

| Phase | Hours | Sky | Mood |
|-------|-------|-----|------|
| Deep Night | 10pm–5am | Deep indigo-black, rich stars | Silent, still |
| Pre-Dawn | 4–5am | Indigo softening | Expectant |
| Dawn Break | 5–6am | Rose-violet horizon | Magical |
| Sunrise | 6–7am | Warm gold-peach | Awakening |
| Morning | 7–10am | Cool blue, dissipating mist | Fresh |
| Midday | 10am–2pm | Clear deep blue | Vibrant |
| Afternoon | 2–5pm | Slightly hazy blue | Settled |
| Late Afternoon | 5–6:30pm | Cooling, building warmth | Anticipation |
| Golden Hour | 6:30–8pm | Orange-purple fire | Spectacular |
| Dusk | 8–9pm | Deep burgundy-purple | Transitioning |
| Evening | 9–10pm | Dark blue, stars emerging | Peaceful |

All transitions are **continuous interpolation** — no jumps. The scrubber demo shows 16 keyframes smoothly blended.

### Sky Color Palette (CF Brand Anchored)

Ridge colors are anchored to the CF brand palette from `EDITOR_HOOKUP_GUIDE.html`:

- `--mountain-blue: #5B8FA8` → near-mid ridge (r2) daytime anchor
- `--mountain-blue-light: #8BB5C9` → far-mid ridge (r3) daytime anchor
- `--sky-gradient-start: #B8D4E3` → farthest ridge (r4), near-sky color
- `--espresso: #3A2518` → near ridge (r1) nighttime base
- `--coral: #E8845C` → dawn/golden hour accent
- `--sand: #E8D5B7` → morning light tones

---

## 3. Mountain Ridge System

### SVG Structure

Four mountain ridge layers (SVG viewBox 0 0 1040 150):

- **Ridge 4** (farthest) — nearly flat, wide gentle swell. Nearly sky-colored due to atmospheric isoprene haze.
- **Ridge 3** — wide smooth arch, dominant crest left-of-center
- **Ridge 2** — left-dominant mass, lower right. Key blue-purple band.
- **Ridge 1** (nearest) — Mt. Pisgah-style summit at ~x500, dense forested slopes

### Ridge Color Facts (photo-accurate)

These are observations from real Blue Ridge photography, critical to authenticity:

- **Near ridge (r1)**: Dense dark FOREST GREEN-BLUE — not just blue. The canopy reads as dark blue-green, not sky blue.
- **Mid ridges**: Distinctly blue-PURPLE with atmospheric isoprene haze. This is the signature "blue" in Blue Ridge.
- **Far ridges**: Nearly sky-colored. Extremely faint atmospheric perspective.
- **Golden hour**: Near ridges go almost BLACK silhouette against orange-purple sky. High contrast.
- **Night**: All ridges shift to deep indigo, lighter as they recede (moonlit atmosphere).

---

## 4. Celestial Bodies

### Sun
- Tracks an arc: rises left (~x70), peaks center-top (~x520), sets right (~x1000)
- Two halo rings (soft glow) + sharp disc
- At golden hour: disc is large (r=17-18), warm yellow-gold
- Disappears below horizon line at sunset

### Moon
- **Actual lunar phase** calculated from the visitor's current date
- Reference: new moon Jan 29, 2025. 29.53-day cycle.
- Phase shadow creates accurate crescent/gibbous appearance
- Rises ~6pm, sets ~6am (arc mirrors sun)
- Glows softly at night (moonGlow effect)

### Stars
- 35 individual stars, CSS-animated independent twinkle rhythms
- Visible only at night (2–5am peak opacity)
- Shooting star: ~0.6% chance per render tick, night only, clear weather only

---

## 5. Wildlife System

### Philosophy: Subtle Wins

**One-pass animations** (loud, memorable, then long quiet interval):
- Barred owl sweep: glides right-to-left over 22s, one pass every 45s
- Screech owl perch: stationary on pine silhouette at night (no animation — just presence)

**Constant subtle animations** (always on when active):
- Small distant birds (V-shapes) — barely visible, very high in sky
- Turkey vultures — 3 circling on thermals, very small, late afternoon/dusk
- Fireflies — individual CSS blink pulses, dusk/night

**Daily variation** (controlled by day-of-week seed):
- Different wildlife/elements appear on different days
- Some days: hawk soars at midday. Other days: no hawk.
- Creates sense of authentic living environment, not a loop

### Active Wildlife by Time

| Wildlife | Active | Notes |
|----------|--------|-------|
| Distant bird V's | Dawn, golden hour | Small, barely visible |
| Circling hawk | Mid-morning–afternoon | Thermal soaring |
| Turkey vultures (3) | Late afternoon, dusk | Circling wide orbits |
| Sweeping barred owl | Dusk, early night | One pass every ~45s |
| Perched screech owl | Night | Stationary on pine |
| Fireflies | Dusk, night | CSS blink pulses |

### Removed
Big animals (deer, elk, bear) were considered and rejected. Too distracting, wrong mood for a furniture site header. **Small and distant only.**

---

## 6. Weather System

Five weather modes selectable (in production: auto-detected via weather API or randomized daily):

| Mode | SVG Overlays | Photo Background | Character |
|------|-------------|-----------------|-----------|
| ☀️ Clear | None (or subtle at night) | Golden hour + night photos | Standard time-of-day |
| ⛅ Cloudy | Cloud opacity boosted ×1.6 | Cloudy mountain photo | Overcast but calm |
| 🌫 Fog | Valley fog ellipses (5 blur layers) | Misty valley photo | Thickest at dawn, burns off by 10am |
| ⛈ Storm | Dark anvil clouds, lightning bolt | Dark dramatic mountain photo | Most dramatic |
| 🌧 Rain | 20 diagonal rain streaks, mist | Rainy mountain photo | Steady, moody |

### Lightning
- CSS `@keyframes lightning-flash` — 6s cycle, two-flash pattern (double-flash realism)
- Storm mode only. One-and-done feel — not constant flickering.

### Fog Behavior
- Density varies by time of day: thickest at dawn (opacity 0.85), burns off by 10am (fades to 0)
- In fog weather mode: minimum 0.4 opacity all day (fog never fully clears)
- Five ellipses with `feGaussianBlur` filter positioned in valley areas between ridges

---

## 7. Season System

Four seasons applied as color modifiers to ridge interpolation:

| Season | Ridge Effect | Tree Effect |
|--------|-------------|-------------|
| 🌸 Spring | Slightly greener, softer haze | Budding green |
| ☀️ Summer | Baseline (CF palette) | Deep forest green |
| 🍂 Fall | Near ridges deep amber-russet, far cooler with warm cast | Full amber-red foliage |
| ❄️ Winter | Desaturated + cool blue-white cast, pale peaks | Bare branches, darker |

Season is **auto-detected from visitor's date** but can be overridden.

Fall is the most iconic Blue Ridge look — October's amber ridges against blue sky. This mode should be prioritized visually.

---

## 8. Pure SVG Rendering Approach

### Core Concept
The entire header is a single SVG illustration — no photo backgrounds. All atmospheric depth, mood, and variation comes from the SVG gradient system, ridge color interpolation, and weather overlays. This keeps the implementation clean and the aesthetic distinctly illustrated (not photographic).

**Design decision**: Photos were prototyped and rejected. The pure SVG approach is more cohesive, more controllable, and truer to a unique brand identity. Photo + SVG blending created visual noise. SVG alone is cleaner.

### Layer Order (bottom to top)
1. **SVG sky gradient** (`skyRect`) — fills entire SVG with time-of-day gradient
2. **SVG glow overlay** (`glowRect`) — sun/horizon radial gradient (additive)
3. **SVG animated elements** — stars, sun disc, moon, clouds, wildlife, weather effects
4. **SVG mountain ridges** — solid fills, interpolated colors, seasonal tints
5. **Nav bar** — HTML overlaid on top of SVG

### Atmospheric Depth Without Photos

All depth comes from SVG techniques:

- **Atmospheric perspective**: Ridge 4 (far) nearly matches sky color; Ridge 1 (near) is fully saturated dark. 4 distinct tonal bands.
- **Isoprene haze simulation**: Far ridges interpolate toward sky-blue regardless of time of day
- **Rim light**: Glowing stroke on ridge tops during dawn/golden hour (`edge-glow` SVG filter)
- **Sun glow**: `radialGradient` centered on sun position washes the lower sky
- **Valley fog**: 5 blurred ellipses (`mist-blur` filter) in valley areas between ridges
- **Weather sky tinting**: Storm/rain desaturate and darken the sky gradient colors

### Weather Sky Tinting (Pure SVG)

Each weather mode shifts the sky gradient stops themselves, not an opacity layer:

| Weather | Sky Effect |
|---------|-----------|
| Clear | Baseline gradient per hour |
| Cloudy | Gradient desaturated ×0.75 |
| Fog | No sky change; fog ellipses fill valleys |
| Storm | Gradient darkened ×0.4, anvil clouds overlay |
| Rain | Gradient darkened ×0.6, rain streaks |

The `weatherSkyTint()` function applies this transformation before setting gradient stop colors.

---

## 9. Footer

The footer **inherits the sky mood**:

- Background color = same as nav bar background (follows time-of-day palette)
- Text color = same as nav text
- Mountain SVG strip at top of footer echoes Ridge 3 and Ridge 1 colors

Footer layout: Brand column (logo, tagline, social links) + Shop column + Visit Us / Hours column. Copyright bar at bottom.

This creates visual cohesion — the sky mood flows from header through the page to footer.

---

## 10. Animation Philosophy

**Loud animations** (memorable moments, then long quiet interval):
- Sweeping owl: one pass every 45s
- Lightning: fire-then-pause cycle (6s interval, storm mode only)
- Shooting star: ~0.6% probability per tick — appears rarely, surprises

**Subtle constant animations** (always present when active):
- Moon drift across sky (based on time, very slow)
- Sun arc movement (1px/min — imperceptible in real-time)
- Star twinkle (individual CSS rhythms, 2–4s cycles)
- Firefly blink (independent per-firefly CSS pulse)
- Cloud drift (28–40s gentle sway)
- Vulture orbit (slow, distant, 26–36s circles)

**One rule**: If an animation would draw the visitor's eye away from the furniture product content below, it's too loud. The header is atmosphere, not a distraction.

---

## 11. Daily Variation

Each day a different combination of subtle elements appears, driven by `dayOfYear % N` seed:
- Some days the hawk appears, some days it doesn't
- Some days extra birds in the distance at golden hour
- Some days the moon is higher or lower in the visible portion
- Firefly density varies slightly

This makes the site feel genuinely alive on return visits.

---

## 12. Implementation Notes (Wix Velo)

### Time Source
```javascript
const now = new Date();
const hour = now.getHours() + now.getMinutes() / 60;
```
Runs on page load. For full live animation, refresh every 30 seconds via `setInterval`.

### Performance
- SVG SMIL animations (`animateTransform`) handle owl/vulture — browser-native, no JS overhead
- CSS `@keyframes` handle fireflies, stars, rain, lightning
- JS only interpolates colors/positions — runs once per tick
- Total: lightweight enough for Wix, no canvas required

### Mobile
The same SVG scales cleanly at mobile widths (viewBox preserves ratio). Wildlife opacity may be reduced at mobile. Photo backgrounds already serve at correct size via Unsplash/Wix CDN params (`?w=768`).

### Weather Data Source (Production)
Options (in preference order):
1. Wix weather widget data (if accessible via Velo)
2. `wix-fetch` call to OpenWeatherMap API (free tier, 60 calls/min)
3. Deterministic daily variation from date seed (no API needed, always works)

Start with option 3 for launch, upgrade to option 2 post-launch.

---

## 13. Cross-Platform (Mobile App)

This illustration system is designed to transfer to the **cfutons mobile app** (coordinate with dallas, cfutons_mobile PM). Key considerations:

- SVG is framework-agnostic — can be embedded in React Native via `react-native-svg`
- Time-of-day logic is pure JS — copy directly
- Weather integration in mobile can use the device's native location/weather
- Photo backgrounds: React Native `ImageBackground` component with animated opacity overlay
- The visual identity is the same across web and mobile — same Blue Ridge, same mountains, same living sky

---

## 14. Deliverables for Implementation

1. **Global CSS additions** to `public/global.css`:
   - Header container: `position: relative`
   - Photo layer styles + transition

2. **New Velo module** `public/living-sky.js`:
   - `skyTable` (16-entry color lookup)
   - `ridgeTable` (16-entry ridge color lookup)
   - `lerpColor`, `lerp`, `getInterpolated`
   - `updateScene(hour)` — main render tick
   - `getMoonPhase()`, `moonShadowOffset()`
   - `detectSeason()`, `seasonalColor()`
   - `applyWeather()`, `weatherCloudMult()`
   - `updatePhotoBg(hour)`
   - `maybeShootingStar(hour)`

3. **SVG asset** — exported from demo as Wix-compatible SVG

4. **Page setup** (`masterPage.js`):
   - `setInterval(tick, 30000)` for live update
   - Initial `setNow()` on page load
   - Weather API integration (Phase 2)

---

## Demo

Full interactive demo available:
`/crew/melania/.superpowers/brainstorm/39429-1774246398/03-living-sky.html`
Server: `http://localhost:60425/files/03-living-sky.html`

Implements: time scrubber, weather/season selectors, live moon phase, photo backgrounds, all animations.
