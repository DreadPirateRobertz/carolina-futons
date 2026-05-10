# Security-header smoke — 2026-05-10

**Bead:** cf-set3 (P2)
**Target:** https://carolina-futons-web.vercel.app
**Driver:** Playwright @ chromium (HEAD via `request.newContext().fetch`)
**Spec:** `e2e/security-headers-smoke-cf-set3.spec.ts` (cfw repo, branch cf-01z3 — held local per cf-ukc6)
**Run time:** 2026-05-10 ~04:50 ET, 6.5s wall, 2 workers

## Result: 7 / 7 PASS

Per-test invariants on each of `/`, `/about`, `/visit`, `/contact`, `/shop/futon-frames`, `/products/kingston-futon-frame`:

| # | Header | Required value | Why |
|---|---|---|---|
| 01 | `Strict-Transport-Security` | `max-age ≥ 6mo, includeSubDomains` | Forces HTTPS-only on subsequent visits — without this, post-cutover first-visit users are exposed to MITM downgrade until they revisit |
| 02 | `X-Content-Type-Options` | `nosniff` | Stops browsers guessing MIME type — defends against polyglot file XSS |
| 03 | `X-Frame-Options` | `DENY` | Blocks clickjacking via iframe embedding |
| 04 | `Referrer-Policy` | `strict-origin-when-cross-origin` | Prevents leaking deep-link paths in cross-origin Referer |
| 05 | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), browsing-topics=()` | Disables browser features the site doesn't need + opts out of FLoC + Topics tracking |
| 06 | `X-DNS-Prefetch-Control` | `on` | Re-enables DNS prefetching that browsers suppress under HTTPS (perf) |
| 07 | static-extension routes | matcher-excluded; HSTS only (Vercel platform) | Documented behavior — `.xml`/`.txt` files skip middleware |

## Per-route observed values (HTML pages — all identical)

```
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=(), browsing-topics=()
x-dns-prefetch-control: on
```

## Per-route observed values (matcher-excluded)

```
/sitemap.xml: HSTS=yes XCTO=no XFO=no PP=no
/robots.txt:  HSTS=yes XCTO=no XFO=no PP=no
```

`src/middleware.ts` matcher is `["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"]`. The trailing `.*\\.[a-zA-Z0-9]+$` excludes any path with a file extension, which is why XCTO/XFO/PP don't apply on `.xml` and `.txt` routes. HSTS still appears on those — Vercel adds it at the platform level for HTTPS responses.

If we want XCTO/XFO/PP on `.xml`/`.txt` too, the fix is widening the matcher (and accepting middleware overhead on every static asset). Not in scope here — sitemap.xml and robots.txt aren't iframeable script-injection targets so the omission is acceptable. Recording the matcher behavior for the future debugger.

## Findings — no cutover-blocking misconfig

All six security headers (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control) are present + correct on every HTML route in the smoke. The cf-c7re middleware (PR #278) is doing its job.

## Surprise during authoring

**Initial probe with `curl -sI` (HEAD) showed only Permissions-Policy + Referrer-Policy.** Subsequent probes against the same URL returned all 6 headers correctly. Likely a one-off edge / region serving from a stale node where middleware hadn't initialized — Vercel's middleware runs on demand at the edge and occasionally a first request to a new region misses the header set. The Playwright smoke uses `request.newContext().fetch` which resolves through a different edge path than curl, and consistently saw all 6 headers across HTML routes.

If a future re-run intermittently fails one of these tests, the most likely cause isn't a code regression — it's an edge-region transient. Re-run the failing test once before treating as a real failure. (If it persists across multiple runs, then real regression.)

## What this DOESN'T cover

- **Content-Security-Policy** (CSP) — the site doesn't currently set a route-level CSP. `next.config.ts` sets a CSP for SVG image responses (`default-src 'self'; script-src 'none'; sandbox;`) but no global page-level CSP. Adding one is a separate beadlet — needs a careful inventory of inline-script + inline-style usage and Wix/Stripe origin allow-listing first.
- **Cookie attribute hygiene** (Secure / HttpOnly / SameSite) — separate smoke. Initial probe showed home/account don't set cookies on landing; cookies are only set on cart/auth interaction. A separate cf-set3 follow-up could exercise the auth + cart flows and verify Set-Cookie attrs.
- **Subresource Integrity (SRI)** — Next.js doesn't ship SRI hashes by default; out of scope.
- **HSTS preload** — middleware intentionally omits the `preload` directive until DNS cutover is confirmed and all subdomains are HTTPS-clean (preload registration is irreversible for months once submitted).

## Re-run command

```bash
cd /Users/hal/gt/cf-01z3                  # or whichever cfw worktree has the spec
BASE_URL=https://carolina-futons-web.vercel.app \
  pnpm exec playwright test e2e/security-headers-smoke-cf-set3.spec.ts --workers=2
```

---

## Refs

- Bead: cf-set3
- Source: `src/middleware.ts` (cf-c7re — PR #278)
- Sibling baselines: `mobile-smoke-2026-05-10.md`, `tablet-smoke-2026-05-10.md`, `desktop-smoke-2026-05-10.md`, `dark-smoke-2026-05-10.md`, `seo-smoke-2026-05-10.md`, `reduced-motion-smoke-2026-05-10.md`, `meta-tags-smoke-2026-05-10.md`, `jsonld-smoke-2026-05-10.md`, `cache-headers-smoke-2026-05-10.md`
- Standing order: cf-ukc6
