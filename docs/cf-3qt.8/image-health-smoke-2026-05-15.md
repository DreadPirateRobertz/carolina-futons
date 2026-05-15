# Image-asset health smoke — 2026-05-15

**Bead:** cf-avtq (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Playwright @ chromium (DOM harvest + HEAD/range-GET probe via `request.newContext().fetch`)
**Spec:** `e2e/image-health-smoke-cf-avtq.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-15 ~19:50 ET, 28.6s wall, 2 workers

## Result: 6 / 6 PASS — 105 image URLs verified, zero bad

For each key page, harvest every image URL we render (`<img currentSrc/src>`, `<link rel=preload as=image>`, `<meta og:image>`, `<meta twitter:image>`) and verify each returns 200 OK with an `image/*` Content-Type. HEAD-probe by default; falls back to a `Range: bytes=0-0` GET for endpoints that don't implement HEAD (some Wix CDN paths).

| # | Path | Image URLs | OK | Bad |
|---|---|---:|---:|---:|
| 01 | `/` | 61 | 61 | 0 |
| 02 | `/about` | 4 | 4 | 0 |
| 03 | `/visit` | 3 | 3 | 0 |
| 04 | `/shop/futon-frames` | 26 | 26 | 0 |
| 05 | `/products/kingston-futon-frame` | 11 | 11 | 0 |
| 06 | `/brand/cf-logo-square.png` (referenced by Organization JSON-LD + manifest) | 1 | 1 | 0 |

**Total: 106 image URLs, all 200 OK with image/* Content-Type.**

## Findings — no broken images on the cutover surface

Every image referenced by every key page resolves. Mix includes:
- Local `/brand/*` + `/illustrations/*` SVG + PNG assets
- Wix CDN `static.wixstatic.com/media/...` JPEGs (PDP gallery, product cards, hero photos)
- `_next/image?url=...` optimizer responses (next/image)
- OG image referenced by social-share meta tags

## Surprise during authoring

Default Playwright per-test timeout (30s) was insufficient for `/` — the home page harvests 61 image URLs and serial HEAD-probing crossed 30s under cold-cache conditions. Bumped per-test timeout to 90s, which leaves headroom for ~3 stuck probes per page before the test correctly fails. Don't run probes in parallel — Wix CDN is not bottlenecked, but firing 60 simultaneous HEADs from the same Playwright worker spikes against the resolver and produces flaky 429s on retry.

## What this DOESN'T cover

- **Image dimensions / quality** — we verify 200 + image/*. We don't fetch the body or measure dimensions. (Recommended: OG image 1200×630 — separate visual smoke.)
- **Lazy-loaded images below the fold** — Playwright sees what hydrated by `networkidle`; if a carousel only loads next-slide on user interaction, those images won't be harvested. Probably acceptable — if the click reveals a broken image, that's a UX bug, not a 404.
- **Image CDN headers** (e.g., `Cache-Control` on `_next/image` responses) — covered by cf-zwqw cache-headers smoke.
- **Wix CDN availability beyond the smoke window** — single-point-in-time check. Wix CDN can drop assets if the underlying Wix Media item is deleted; recommend re-running this smoke periodically.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/image-health-smoke-cf-avtq.spec.ts --workers=2
```

---

## Refs

- Bead: cf-avtq
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `reduced-motion-smoke-2026-05-10.md`, `meta-tags-smoke-2026-05-10.md`, `jsonld-smoke-2026-05-10.md`, `cache-headers-smoke-2026-05-10.md`, `security-headers-smoke-2026-05-10.md`
- Standing order: cf-ukc6
