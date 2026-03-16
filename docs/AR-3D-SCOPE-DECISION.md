# AR/3D Scope Decision & Asset Pipeline

**Decision Date:** 2026-03-15
**Bead:** CF-juq1
**Status:** APPROVED — Dual approach (WebAR + 360-spin)

## Scope Decision: Both WebAR AND 360-Spin

We implement **both** approaches as complementary features, not competing alternatives.

### Why both?

| Approach | Strengths | Weaknesses |
|----------|-----------|------------|
| **WebAR** (.glb/.usdz via `<model-viewer>`) | True spatial placement, "View in Room" for furniture sizing, iOS Quick Look native integration | Requires 3D model per product (~5–8 MB each), not all browsers support AR |
| **360-Spin** (36–72 images per product) | Works in all browsers, easier to produce from existing photography, lower bandwidth per frame | No spatial placement, more total bandwidth for full set, more asset management |

**Decision:** WebAR is the primary experience for AR-capable devices. 360-spin is the universal fallback and also serves browsers without AR support. Both viewers already exist in the codebase and are lazy-loaded on the Product Page.

### Coverage plan

| Category | Product Count | WebAR (3D models) | 360-Spin (photo sets) |
|----------|---------------|--------------------|-----------------------|
| Murphy Cabinet Beds | 10 | Phase 1 — all 6 current models | Phase 2 |
| Futon Frames | 38 | Phase 1 — top 5 sellers | Phase 1 — top 10 sellers |
| Platform Beds | 10 | Phase 2 | Phase 2 |
| Mattresses | 8 | No (commodity shape) | No |
| Casegoods/Accessories | 12 | Phase 3 | Phase 2 |

## Asset Pipeline

### 3D Models (WebAR)

**Source:** Manufacturer CAD files → professional 3D scanning or conversion

1. **Night & Day Furniture** — primary vendor for futon frames
   - Request: Product CAD files (.step, .obj) or high-res turntable photos
   - Conversion: CAD → optimized .glb (Draco compressed, <8 MB) + .usdz (iOS)
   - Tools: Blender (free), or Reality Composer Pro (Apple, for USDZ)

2. **Otis Bed / Murphy Beds** — cabinet bed manufacturer
   - Request: 3D models if available, otherwise photograph for photogrammetry
   - Murphy beds are geometric — simpler to model from dimensions + photos

3. **Photogrammetry fallback** — for products without CAD files
   - 40–60 photos per product at controlled angles
   - Tool: Meshroom (open source) or Polycam (mobile)
   - Post-process in Blender: decimate to <100K triangles, bake textures

**File naming convention:**
```
models/glb/{slug}-{contenthash}.glb
models/usdz/{slug}-{contenthash}.usdz
```

**Quality gates:**
- GLB file size: <8 MB (target <5 MB)
- Triangle count: <100K
- Texture resolution: 2048×2048 max
- Physical dimensions in meters (for AR placement)
- USDZ variant for every GLB (iOS Quick Look)

### 360-Spin Photo Sets

**Source:** Turntable photography or existing multi-angle product shots

1. **Turntable setup** (preferred)
   - 36 frames per product (10° increments) — standard for furniture
   - Consistent lighting, white/neutral background
   - Resolution: 1200×1200 px per frame (CDN serves responsive sizes)

2. **Existing product photos** (bootstrapping)
   - If manufacturer provides 8–12 angles, interpolate or use as-is
   - Minimum viable: 8 frames (45° increments) — still better than static gallery

**File naming convention:**
```
360/{slug}/{slug}-{frame:02d}.jpg    (e.g., 360/monterey/monterey-00.jpg)
```

**CDN hosting:**
```
https://cdn.carolinafutons.com/360/{slug}/{slug}-{frame:02d}.jpg
```

### Hosting Setup

**CDN:** `cdn.carolinafutons.com` (already referenced in `models3d.js`)

```
cdn.carolinafutons.com/
├── models/
│   ├── glb/          # WebAR models (Android/web)
│   └── usdz/         # iOS Quick Look models
└── 360/
    └── {slug}/       # Per-product spin set directories
        ├── {slug}-00.jpg
        ├── {slug}-01.jpg
        └── ... (36 frames)
```

**Cache strategy:**
- Content-hash in filename for GLB/USDZ (already in `models3d.js`)
- Long cache (1 year) for immutable assets
- 360 images: versioned directory or query-string cache-bust

**Bandwidth budget:**
- 3D model load: 5–8 MB one-time (lazy, user-initiated)
- 360 spin set: 36 × ~40 KB = ~1.4 MB total (progressive, preload first 4 frames)

## Dallas Mobile Team Coordination

The mobile app (`cfutons_mobile`) already has `models3d.ts` (noted in code comments as the source for the web port). Coordination needed:

1. **Shared asset catalog:** Both web and mobile reference the same CDN URLs and content hashes. The `models3d.js` web module was ported from `models3d.ts` — keep them in sync.

2. **Native AR on mobile:** iOS uses ARKit Quick Look (USDZ), Android uses SceneViewer (GLB). The mobile app can use native AR APIs directly — no `<model-viewer>` needed. Same USDZ/GLB files serve both web and native.

3. **360-spin on mobile:** Not needed — native AR provides a better mobile experience. 360-spin is web-only for non-AR browsers.

4. **Sync protocol:** When new models are added to the CDN:
   - Update `models3d.js` (web) AND `models3d.ts` (mobile)
   - Both files share the same data structure
   - Content hash ensures cache invalidation across platforms

## Implementation Status

| Component | Status | File |
|-----------|--------|------|
| AR Viewer shell | Done | `src/public/ProductARViewer.js` |
| AR support detection | Done | `src/public/arSupport.js` |
| 3D model catalog | Done (placeholder URLs) | `src/public/models3d.js` |
| 360 Viewer shell | Done | `src/public/Product360Viewer.js` |
| 360 data layer | Done (empty catalog) | `src/public/product360Data.js` |
| Product Page integration | Done | `src/pages/Product Page.js` |
| CDN hosting | Not started | Infrastructure task |
| Actual 3D models | Not started | Vendor outreach needed |
| Actual 360 photo sets | Not started | Photography needed |

## Next Steps (follow-up beads)

1. **Vendor outreach:** Contact Night & Day Furniture and Otis Bed for CAD files or 3D assets
2. **CDN provisioning:** Set up `cdn.carolinafutons.com/models/` and `cdn.carolinafutons.com/360/` directories
3. **First model:** Create or acquire one production GLB/USDZ to validate the full pipeline end-to-end
4. **360 photography:** Schedule turntable shoot for top 10 futon frames
5. **Mobile sync:** Coordinate with Dallas team on shared model catalog updates
