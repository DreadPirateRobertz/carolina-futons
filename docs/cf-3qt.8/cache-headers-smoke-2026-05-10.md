# Cache-Control header smoke — 2026-05-10

**Bead:** cf-zwqw (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Playwright @ chromium (HEAD via `request.newContext().fetch`)
**Spec:** `e2e/cache-headers-smoke-cf-zwqw.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~04:35 ET, 8.0s wall, 2 workers

## Result: 5 / 5 PASS — with one P2 finding for cf-3qt.2 owner (morgott)

Per-test invariants:

| # | Test | What it checks |
|---|---|---|
| 01 | HTML pages | `/, /about, /visit, /shop/futon-frames, /products/<slug>` — Cache-Control must NOT be `public` with positive max-age. Today: `private, no-cache, no-store, max-age=0, must-revalidate` ✅ |
| 02 | `/_next/static/*` | Long immutable: `max-age=31536000, immutable` ✅ |
| 03 | `/sitemap.xml + /robots.txt` | Present + `public, max-age=0, must-revalidate` (crawlers re-fetch each visit) ✅ |
| 04 | `/api/*` (cart, auth/session, auth/login, newsletter, order-lookup) | Must NOT be `public` with positive max-age ✅ |
| 05 | `/api/*` warning surface | Logs whether each API route emits `private/no-store` (preferred) or `public, max-age=0` (Vercel default — safe but wrong by convention) |

## Per-route observed Cache-Control

| Route | Status | Cache-Control |
|---|---|---|
| `/` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/about` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/visit` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/shop/futon-frames` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/products/kingston-futon-frame` | 200 | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/_next/static/chunks/<digest>.css` | 200 | `public, max-age=31536000, immutable` |
| `/sitemap.xml` | 200 | `public, max-age=0, must-revalidate` |
| `/robots.txt` | 200 | `public, max-age=0, must-revalidate` |
| `/api/cart` | 501 | ⚠️ `public, max-age=0, must-revalidate` |
| `/api/auth/session` | 200 (after 307 follow) | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/api/auth/login` | 405 | `public, max-age=0, must-revalidate` (wrong-method response) |
| `/api/newsletter` | 405 | `public, max-age=0, must-revalidate` (wrong-method response) |
| `/api/order-lookup` | 405 | `public, max-age=0, must-revalidate` (wrong-method response) |

## P2 finding — `/api/cart` returns `public` (NOT cutover-blocking, but flag for cf-3qt.2)

`/api/cart` is currently a 501 "Not Implemented" stub (`src/app/api/cart/route.ts`) that calls `NextResponse.json(...)` without setting an explicit `Cache-Control`. Vercel's default for force-dynamic routes is `public, max-age=0, must-revalidate`. With `max-age=0 + must-revalidate`, every intermediary cache must revalidate, so in practice the response is not actually shared — but `public` on what will become a personalized cart endpoint is the wrong default.

**Action for morgott when implementing cf-3qt.2 cart slice:** explicitly set `Cache-Control: 'private, no-store'` on every response. Even on error paths. Example:

```ts
return NextResponse.json(
  { ok: true, cart },
  {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  },
);
```

The cache-headers smoke test #04 today permits the `public, max-age=0` default because positive-max-age is the actual risk (cached personalized responses); `max-age=0 + must-revalidate` doesn't satisfy that. But once cart returns real data, test #04 should be tightened to `isPrivateNoStore(cc)` for the cart route specifically.

The same default applies to `/api/auth/login`, `/api/newsletter`, `/api/order-lookup` on wrong-method responses (405) — those don't surface PII so it's lower-risk, but the pattern should be the same: explicit `'private, no-store'` set in a top-level handler or middleware.

Test #05 logs each API route's actual Cache-Control on every run, so a future re-run after cart implements explicit headers will surface the change in CI output.

## Findings — no cutover-blocking misconfig

- **HTML pages** correctly set the safe SSR default.
- **Static assets** correctly set 1-year immutable.
- **Crawler files** correctly set `public, max-age=0` so Google + Bing pull fresh each visit.
- **Real cart contents are not yet exposed** through any API route — cart state lives in cookies + server actions. The `/api/cart` route is a placeholder and the `public` default is therefore latent, not active.

## What this DOESN'T cover

- **Set-Cookie attribute hygiene** (Secure, HttpOnly, SameSite) — separate auth-cookie smoke.
- **Stale-while-revalidate behavior** — we verify CC headers; we don't measure CDN actually serves SWR'd responses with the expected age.
- **Vary header** — important for dark-mode / personalized variants but not asserted here.
- **CORS headers** on /api/* — out of scope.

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/cache-headers-smoke-cf-zwqw.spec.ts --workers=2
```

---

## Refs

- Bead: cf-zwqw
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `reduced-motion-smoke-2026-05-10.md`, `meta-tags-smoke-2026-05-10.md`, `jsonld-smoke-2026-05-10.md`
- Related: cf-3qt.2 (morgott — cart slice — must set explicit Cache-Control on /api/cart)
- Standing order: cf-ukc6
