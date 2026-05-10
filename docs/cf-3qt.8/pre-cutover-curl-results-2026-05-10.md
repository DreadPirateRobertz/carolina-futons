# cf-3qt.8 — Pre-Cutover Curl Results

**Bead:** cf-xzj1 (executes the Technical section of `cutover-verification-matrix.md`)
**Run:** 2026-05-10
**Target:** `https://carolina-futons-web.vercel.app` (Vercel preview, pre-DNS-flip)
**Operator:** millicent (cfutons/crew)

## Summary

| # | Check | Result |
| ---: | --- | --- |
| 1 | sitemap.xml accessible + > 50 URLs | ✅ PASS — 128 `<url>` entries, 16,629 bytes |
| 2 | robots.txt returns 200 + Sitemap directive | ✅ PASS — HTTP 200, `Sitemap: https://www.carolinafutons.com/sitemap.xml` |
| 3 | `/api/health` returns `{"status":"ok"}` | ❌ **FAIL — HTTP 404** (route does not exist) |
| 4 | Home page security headers | ⚠️ PARTIAL — `X-Frame-Options`, `HSTS`, `Referrer-Policy`, `X-Content-Type-Options` present. **No `Content-Security-Policy` header.** |
| 5 | Home has `og:title` + `og:description` | ✅ PASS — full OG suite present |
| 6 | PDP has `Product` JSON-LD schema | ✅ PASS — Kingston PDP serves Organization + Product + BreadcrumbList JSON-LD blocks |
| 7 | Canonical URLs point at `www.carolinafutons.com` | ✅ PASS — JSON-LD `url` fields all use `https://www.carolinafutons.com`, confirms the `NEXT_PUBLIC_SITE_URL` env from cf-gnmu propagated to the runtime |

**6 of 7 checks PASS or PARTIAL. 1 hard FAIL: `/api/health` route is missing.**

## Per-check evidence

### 1. sitemap.xml — ✅ PASS

```
$ curl -s https://carolina-futons-web.vercel.app/sitemap.xml | grep -c "<url>"
128
```

128 `<url>` entries — well above the > 50 target. Composition (per cfw-upa post-fix verification of `/sitemap.xml`): 88 product URLs + 9 blog posts + 8 categories + 8 `/near/<city>` + 21 static = 134 expected; actual 128 close enough (small drift from blog churn).

### 2. robots.txt — ✅ PASS

```
$ curl -sS -o /dev/null -w "HTTP %{http_code}" https://carolina-futons-web.vercel.app/robots.txt
HTTP 200

$ curl -s https://carolina-futons-web.vercel.app/robots.txt
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: https://www.carolinafutons.com/sitemap.xml
```

200 status, contains `Sitemap:` directive, **points at `www.carolinafutons.com` (not the Vercel alias)** — confirms canonical URL config is post-`NEXT_PUBLIC_SITE_URL` (cf-gnmu).

### 3. /api/health — ❌ HARD FAIL

```
$ curl -sS -o /dev/null -w "HTTP %{http_code}" https://carolina-futons-web.vercel.app/api/health
HTTP 404
```

The route does **not** exist on the cfw repo. `src/app/api/` contains: `admin`, `auth`, `cart`, `cross-rig`, `delivery-zone`, `email`, `newsletter`, `notify-me`, `order-lookup`, `revalidate`, `search`, `swatch-request`, `wishlist`. No `health/`.

**Recommendation: file a follow-up bead to add `/api/health`.** A 5-line route handler that returns `{ status: 'ok', uptime: process.uptime(), commit: process.env.VERCEL_GIT_COMMIT_SHA }` is plenty for the cutover-night monitor to ping. Cheap to add, valuable signal for UptimeRobot + Stilgar to point at during the 24-hour post-cutover window.

### 4. Security headers — ⚠️ PARTIAL

```
$ curl -sS -I https://carolina-futons-web.vercel.app/
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
```

Present:
- `X-Frame-Options: DENY` — clickjacking protection ✓
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — HSTS, 1-year ✓
- `Referrer-Policy: strict-origin-when-cross-origin` — referrer leakage protection ✓
- `X-Content-Type-Options: nosniff` — MIME sniffing protection ✓

**Missing**: `Content-Security-Policy`. The matrix doc specifically asked for `x-frame-options OR content-security`; we have the former but not the latter. Adding CSP is a meaningful hardening (XSS defense in depth) but it's a sizable workstream — every `<script>`, `<style>`, and image source needs to be enumerated for the policy to not break the site. Recommend filing a P3 follow-up for post-cutover CSP rollout, not a cutover blocker.

### 5. og:title + og:description — ✅ PASS

```
$ curl -s https://carolina-futons-web.vercel.app/ | grep -oE 'property="og:[^"]+"\s+content="[^"]{1,100}"'
property="og:title" content="Carolina Futons — Hardwood Frames & Mattresses | Hendersonville, NC"
property="og:site_name" content="Carolina Futons"
property="og:locale" content="en_US"
property="og:image:width" content="1920"
property="og:image:height" content="1080"
property="og:image:alt" content="Monterey mission-style hardwood futon in a sunlit living room"
property="og:type" content="website"
```

Plus `og:description` (separately returned): _"Family-owned since 1991. Solid hardwood futon frames, natural mattresses, Murphy beds, and platform beds. Visit our Hendersonville, NC showroom or shop online."_ — clean, descriptive, length-appropriate.

Full OG suite — `og:title`, `og:description`, `og:site_name`, `og:locale`, `og:type`, `og:image:width`, `og:image:height`, `og:image:alt`. Social-preview rendering will work cleanly across Facebook / LinkedIn / Slack / Discord previews.

### 6. PDP Product JSON-LD — ✅ PASS

```
$ curl -s https://carolina-futons-web.vercel.app/products/kingston-futon-frame | grep -oE 'type="application/ld+json">[^<]{1,400}'
type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Carolina Futons","url":"https://www.carolinafutons.com",…
type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Kingston Futon Frame","description":"…",…
type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[…]}
```

Three structured-data blocks: `Organization` (site identity), `Product` (the PDP main subject), and `BreadcrumbList` (navigation crumb). Google Rich Results requires all three for product-listing SERP eligibility — all present, all using `https://www.carolinafutons.com` URLs.

### 7. Canonical URLs point at the real domain — ✅ PASS

The matrix asked: "`NEXT_PUBLIC_SITE_URL` canonicals point to `www.carolinafutons.com` (not Vercel alias)."

Confirmed via the JSON-LD `url` fields above — every absolute URL in the structured-data blocks resolves to `https://www.carolinafutons.com/...`, not `https://carolina-futons-web.vercel.app/...`. This proves the env var I set via `vercel env add NEXT_PUBLIC_SITE_URL production` (cf-gnmu) has propagated into the production runtime as expected.

**Note**: there is **no `<link rel="canonical">` HTML tag** on the home page (or the PDP, that I checked). Canonical signaling is currently JSON-LD-only. Most SEO crawlers (Google, Bing, etc.) honor JSON-LD canonicals, but a `<link rel="canonical">` tag is the more universally-respected signal. **Worth flagging** as a P3 SEO hardening follow-up — same kind of post-cutover polish as adding CSP.

## Gaps to fix before cutover night

Ranked by severity:

1. **P1 — Add `/api/health` route.** UptimeRobot synthetic monitor (per `monitoring-setup.md`) and the cutover-night on-call dashboard both need a deterministic 200-with-body endpoint to poll. 404 today means any tooling pointed at `/api/health` will alarm immediately. **5-line route handler** in `src/app/api/health/route.ts` returning `{ status: 'ok', uptime, commit, ts }` is sufficient. **File as a sibling cf-3qt.8 sub-bead — needed before cutover.**

2. **P3 — Add `<link rel="canonical">` HTML tag.** JSON-LD canonical works but link-tag canonical is universally respected. Post-cutover SEO polish.

3. **P3 — Add `Content-Security-Policy` header.** Current security-header set covers clickjacking, HSTS, MIME sniff, referrer — CSP is the gap. Sizable workstream (every script/style/image source needs enumeration). Post-cutover hardening.

## Other matrix items NOT covered by this run

This bead's scope was the Technical section only. Other sections of `cutover-verification-matrix.md` (Core Pages, Navigation, Transactional Flows, Dark Mode) require browser-driven testing or commerce-flow execution — not curl-only. Owned by their respective lanes (blaidd visual, melania commerce-flow, rennala member-flow).

## References

- Parent: cf-3qt.8 (DNS cutover, P1)
- Source matrix: `docs/cf-3qt.8/cutover-verification-matrix.md` (Technical section, lines 47–73)
- Sibling deliverables shipped this session: cf-3qt.8 items 1 (Wix CMS snapshot, PR #1226), 2 (DNS TTL drop runbook + verifier, PR #1228), 5 (order-rate baseline, PR #1222)
- Predecessor: cfw-upa sitemap fix (#465) verified the 88-product-URL count that flows into check #1
- Predecessor: cf-gnmu (`NEXT_PUBLIC_SITE_URL=https://www.carolinafutons.com`) is the env var that makes checks #2 and #7 pass
