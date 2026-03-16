# AR/3D Asset Verification Report — CF-wf3v

**Date:** 2026-03-15
**Author:** cfutons/crew/godfrey

## Executive Summary

**AR pipeline is NOT ready.** Code infrastructure is complete and tested (38 passing tests), but zero 3D assets exist on CDN. The CDN subdomain `cdn.carolinafutons.com` has no DNS record (NXDOMAIN). All 21 CDN-hosted model URLs fail. Only the placeholder Asheville GLB (hosted on GitHub/Khronos) is reachable.

---

## Asset Verification: Per-Product Pass/Fail

| # | Product | GLB | USDZ | Fabric Variants |
|---|---------|-----|------|-----------------|
| 1 | Murphy Queen Vertical | FAIL | FAIL | No |
| 2 | Murphy Full Horizontal | FAIL | FAIL | No |
| 3 | Murphy Queen Bookcase | FAIL | FAIL | No |
| 4 | Murphy Twin Cabinet | FAIL | FAIL | No |
| 5 | Murphy Queen Desk | FAIL | FAIL | No |
| 6 | Murphy Full Storage | FAIL | FAIL | No |
| 7 | Asheville Full | PASS (placeholder) | FAIL | Yes |
| 8 | Blue Ridge Queen | FAIL | FAIL | Yes |
| 9 | Pisgah Twin | FAIL | FAIL | Yes |
| 10 | Biltmore Loveseat | FAIL | FAIL | Yes |
| 11 | Hardwood Frame | FAIL | FAIL | No |

**Result: 1/11 GLB pass (placeholder only), 0/11 USDZ pass, 0/22 CDN assets exist.**

### Notes

- Asheville GLB points to `raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb` (3.9MB) — this is the Khronos SheenChair sample, NOT an actual Asheville futon model. It's a development placeholder.
- Content hashes in URLs (e.g., `-q1r2s3.glb`) appear to be placeholder/fabricated values, not real asset hashes.
- Catalog says 11 products but bead description says 12 — actual count is 11.

---

## CDN Infrastructure Status

| Check | Status |
|-------|--------|
| `cdn.carolinafutons.com` DNS | NXDOMAIN (domain does not exist) |
| `carolinafutons.com` DNS | Resolves to Wix IPs (185.230.63.x) |
| `/models/glb/` directory | Does not exist |
| `/models/usdz/` directory | Does not exist |
| SSL/TLS | N/A (no DNS) |

**Action needed:** CDN subdomain must be provisioned. Options:
1. Wix Media Manager — upload GLB/USDZ to Wix's CDN (simplest, auto-SSL)
2. Custom CDN (Cloudflare/CloudFront) — set up `cdn.carolinafutons.com` CNAME
3. GitHub Releases — host assets in repo releases (works for development)

---

## Code Infrastructure Status

| Component | File | Tests | Status |
|-----------|------|-------|--------|
| 3D Model Catalog | `src/public/models3d.js` | 15 pass | Complete |
| AR Support Detection | `src/public/arSupport.js` | 11 pass | Complete |
| Product AR Viewer | `src/public/ProductARViewer.js` | 12 pass | Complete |
| Product Page Integration | `src/pages/Product Page.js:147` | N/A | Lazy-loaded in init chain |

**Total AR-related tests: 38 passing**

### model-viewer SDK

- Referenced version: 3.5.0 (per design doc)
- NOT in `package.json` — loaded via HtmlComponent `<script>` tag at runtime
- Loads lazily only on "View in Room" button click (200KB saved on initial page load)
- Uses `postMessage` to communicate between Velo code and HtmlComponent iframe

### WebXR Support Detection

- `checkWebARSupport()` checks for `customElements` API (required for `<model-viewer>`)
- `isProductAREnabled()` gates on: product exists, in stock, AR-eligible category, has 3D model
- AR-eligible categories: `futons`, `frames`, `murphy-beds`
- Graceful degradation: button hidden + container collapsed when AR unavailable

---

## Action Items

### P0 — Blocker (no AR without these)

1. **Create actual 3D models** — Need GLB files for 11 products. Options:
   - Commission from 3D modeling service (e.g., CGTrader, Turbosquid custom)
   - Photogrammetry from product photos (lower quality, faster)
   - Check if Dallas mobile team already has models (design doc says "ported from mobile `models3d.ts`")

2. **Generate USDZ from GLB** — Apple's Reality Converter or `usdzconvert` CLI can convert GLB to USDZ

3. **Provision CDN** — Set up `cdn.carolinafutons.com` or switch to Wix Media Manager URLs

### P1 — Important

4. **Update URLs in models3d.js** — Once real assets exist, update GLB/USDZ URLs, file sizes, and content hashes

5. **Replace Asheville placeholder** — SheenChair.glb is not an Asheville futon. Create real model.

6. **Verify content hashes** — Current hashes (`q1r2s3`, `t4u5v6`, etc.) are clearly placeholder. Generate real SHA256 truncations.

### P2 — Nice to have

7. **Fabric variant models** — 4 products have `hasFabricVariants: true` but no variant-swapping logic exists yet

8. **Mobile team coordination** — If `cfutons_mobile` has AR working, share asset pipeline

9. **Performance testing** — Largest model is 8.4MB (Murphy Queen Bookcase). Test load times on 3G/4G.

---

## Recommendation

The code is ready — this is purely an asset creation problem. Prioritize:
1. Get 2-3 real GLB models created (start with Murphy Queen Vertical and Asheville Full — most popular products)
2. Upload to Wix Media Manager as a CDN substitute
3. Update models3d.js with real URLs
4. Test end-to-end on staging
