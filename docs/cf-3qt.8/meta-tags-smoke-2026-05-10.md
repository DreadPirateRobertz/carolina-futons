# Meta-tag smoke (OG / twitter / canonical) — 2026-05-10

**Bead:** cf-oj8u (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Playwright @ chromium
**Spec:** `e2e/meta-tags-smoke-cf-oj8u.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~04:05 ET, 10.2s wall, 2 workers

## Result: 10 / 10 PASS — with one P3 finding (8 routes missing canonical)

Per-page assertions (all pass):
- `<meta property="og:title">` non-empty
- `<meta property="og:description">` non-empty
- `<meta property="og:image">` non-empty + HTTPS scheme
- `<meta name="twitter:card">` non-empty
- `<link rel="canonical">` for paths in the cf-bbo8 coverage set (PDP + PLP)

| # | Path | OG title | OG description | OG image (HTTPS) | twitter:card | canonical |
|---|---|---|---|---|---|---|
| 01 | `/` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 02 | `/shop/futon-frames` | ✅ | ✅ | ✅ | ✅ | ✅ (cf-bbo8) |
| 03 | `/products/kingston-futon-frame` | ✅ | ✅ | ✅ | ✅ | ✅ (cf-bbo8) |
| 04 | `/about` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 05 | `/visit` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 06 | `/contact` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 07 | `/gift-cards` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 08 | `/guides` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 09 | `/reviews` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |
| 10 | `/getting-it-home` | ✅ | ✅ | ✅ | ✅ | ⚠️ omitted |

## P3 finding (NOT cutover-blocking) — canonical omission on 8 routes

cf-bbo8 added `alternates: { canonical: ... }` to PDP + PLP `generateMetadata` returns. The other 8 core routes don't ship a `<link rel="canonical">` tag at all. Implications:
- Without an explicit canonical, Google + other crawlers default to the request URL — usually fine, but post-cutover when DNS flips, both `carolina-futons-web.vercel.app` and `www.carolinafutons.com` could surface the same content with different canonicals (or none), creating duplicate-content risk.
- Suggested follow-up: extend cf-bbo8's pattern to the static routes (home, about, visit, contact, gift-cards, guides, reviews, getting-it-home). One-line addition per page or a layout-level default.

The smoke logs each omission via `console.log` so a future re-run after the gap closes will report `PRESENT (update doc)` and prompt this doc to be updated.

## Why these matter

- **OG tags** drive Slack / iMessage / Twitter / Facebook link previews. A page without OG is a naked URL in social shares — measurable click-through impact.
- **Twitter card** controls the Twitter-specific preview shape (`summary_large_image` favored).
- **Canonical** controls which URL Google picks for indexing when the same content is reachable via multiple paths. Critical at cutover when DNS flips and the old + new hosts may coexist briefly.

## Out of scope

- **Content quality** — we verify OG tags exist, not that titles + descriptions are SEO-optimized. That's a copy review, not a runtime smoke.
- **Open Graph image dimensions** — we verify HTTPS scheme; we don't fetch + measure the image. (Recommended: 1200×630 for max compatibility — Stilgar to confirm asset shape.)
- **Twitter:image** — relies on `og:image` fallback on most consumers; explicit `twitter:image` not asserted.
- **Per-product OG / canonical correctness** — only kingston tested in this smoke; bulk product audit is a separate bead.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/meta-tags-smoke-cf-oj8u.spec.ts --workers=2
```

---

## Refs

- Bead: cf-oj8u
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `reduced-motion-smoke-2026-05-10.md`
- Canonical implementation: cf-bbo8 (PDP + PLP)
- Standing order: cf-ukc6
