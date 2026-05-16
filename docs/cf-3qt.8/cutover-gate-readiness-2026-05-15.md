# cf-3qt.8 — Cutover-Gate Readiness Scorecard (2026-05-15)

**Bead:** cf-jfn5 · **Author:** melania · **Date:** 2026-05-15
**For:** Stilgar (go/no-go call), melania (merge gate authority)
**Method:** Synthesis of all 13+ cf-3qt.8 baseline docs + qa/ audit findings

---

## Top-Level Verdict

🔴 **NO-GO — 2 hard blockers remain unresolved.**

Both blockers are Stilgar-gated manual actions that unblock the 48h clock:

| Blocker | Status | Owner | Action |
|---|---|---|---|
| **DNS TTL 3600 → 60s** | ❌ NOT DONE | Stilgar (Wix DNS) | Run `dns-ttl-drop-runbook.md` in Wix Dashboard → Domains → DNS |
| **Order-rate baseline capture** | ❌ NOT DONE | Stilgar | Run `node scripts/cutover/capture-order-baseline.mjs`; commit JSON to `docs/cf-3qt.8/` |

Until both ship, the 48h cutover window cannot open. Every other gate is either CLEAR or has a known, bounded fix.

---

## Domain Traffic-Light Summary

| Domain | Signal | Status |
|---|---|---|
| DNS infrastructure | TTL still 3600; order baseline missing | 🔴 NO-GO |
| Application smoke | Pre-flip 20/20 + mobile 10/10 + QuickView 3/3 + checkout 2/2 | 🟢 PASS |
| Technical health | /api/health ✅ merged; sitemap 128 URLs; robots ✅; OG/JSON-LD ✅ | 🟢 PASS |
| Performance | cfw Perf=83 vs Wix=61; LCP=3.8s vs 14.8s (cfw faster) | 🟢 PASS |
| Accessibility | P0=0, P1=3 (contrast tweaks, aria-label) | 🟡 WATCH |
| SEO | P0=0, P1=2 (PDP+PLP canonical — small PR) | 🟡 WATCH |
| Dark mode | P1 on 3 pages (/getting-it-home, /gift-cards, /order-confirmation) | 🟡 WATCH |
| Velo backend | Staging: 4/5 healthy; Production: NOT PUBLISHED yet | 🔴 BLOCK |
| Monitoring | /api/health ✅ but UptimeRobot API key missing | 🟡 WATCH |
| Sentry | Not confirmed linked to production | 🟡 WATCH |

---

## Gate Matrix (as of 2026-05-15)

Status codes: ✅ CLEAR · 🟡 WATCH · ❌ BLOCKER · 🕐 PENDING-STILGAR

| # | Gate | Status | Update vs 2026-05-10 |
|--:|---|---|---|
| 1 | DNS TTL 60s for ≥ 48h | ❌ BLOCKER | TTL still 3600; ttl-drop-log has no fill-in entries |
| 2 | Order-rate baseline captured | ❌ BLOCKER | Runbook merged (#1222); JSON data file still missing |
| 3 | Vercel Pro plan active | ✅ CLEAR | Confirmed 2026-05-10; billing active |
| 4 | Pre-flip smoke 20/20 | ✅ CLEAR | 20/0/1 PASS (cf-lt2l, miquella 2026-05-10) |
| 5 | Pre-flip curl checks | ✅ CLEAR | /api/health now 200 (PR #554 merged); CSP P3 only |
| 6 | `/api/health` route deployed | ✅ CLEAR | **NEW** — PR #554 merged; `{"status":"ok","timestamp":...}` |
| 7 | UptimeRobot monitors active | 🕐 PENDING | Needs Stilgar API key; script ready |
| 8 | Sentry connected to production | 🕐 PENDING | Out-of-band; needs Stilgar confirm |
| 9 | vercel.json ratchet exclusion | ✅ CLEAR | **NEW** — PR #565 merged (cf-ukc6.1) |
| 10 | cf-dbw9 security audit (Track 3) | ✅ CLEAR | 40 gitleaks hits all triaged (PR #1252) |
| 11 | Logo (PR #540 visual confirm) | ✅ CLEAR | cf-jo07 confirmed live in mobile smoke screenshot |
| 12 | Velo backend production publish | ❌ BLOCKER | `www.carolinafutons.com/_functions/*` = 404 across all routes |
| 13 | Email triggers (cf-c6g5) | 🕐 PENDING | Contact form 500 on staging = Stilgar template batch-copy needed |
| 14 | FAQ CMS data | 🕐 PENDING | Brenda |

---

## Baseline Results — Smoke Tests

### Pre-flip smoke (cf-lt2l, miquella, 2026-05-10)
- **20 PASS / 0 FAIL / 1 SKIP** (spring-sale skipped per instructions)
- Core pages: 9/9 ✅ · Navigation: 3/3 ✅ · Transactional: 5/5 ✅ · Dark mode: 3/3 ✅
- Zero console errors on cfw pages across all 9 core routes
- Soft: /gift-cards denomination amounts not in plain text (manual visual check recommended flip-night)

### Mobile smoke (cf-pjdb, radahn, 2026-05-10, 390×844)
- **10/10 PASS** at iPhone 14 viewport
- No blocker regressions; /contact form selector tightened (test artifact only, not a bug)

### QuickView smoke (cf-b57h, radahn, 2026-05-15)
- **3/3 PASS** — hover reveal, keyboard path, mobile always-visible
- All bead acceptances verified; no console errors

### E2E checkout smoke (cf-vu40, radahn, 2026-05-10, desktop + mobile)
- **2/2 PASS** — Kingston PDP → variant select → add-to-cart → cart state → /checkout reach
- Cart announcement bar wired correctly (cf-xqc0 confirmed)
- Guest proceed-CTA present both viewports; zero cfw-domain errors

### Velo endpoint smoke (cf-3pc5, radahn, 2026-05-10)
- **4/5 PASS on staging** (`chrisdealglass.wixstudio.com/my-site`)
- ✅ health / productSitemap / manifest / robots; ❌ contactSubmissions 500 (expected — gates on cf-c6g5)
- **Production `carolinafutons.com/_functions/*` = 404** — backend not published yet

---

## Baseline Results — Lighthouse (cf-z0ht, godfrey, 2026-05-10)

Tool: chrome-devtools-mcp `lighthouse_audit` (A11y / Best Practices / SEO / Agentic Browsing categories)

| Category | Min across 10 audits | Threshold (< 80 = block) | Verdict |
|---|---|---|---|
| Accessibility | 96 | 80 | ✅ PASS |
| Best Practices | 81 | 80 | ✅ PASS (tight; root cause = Meta Pixel deprecated API, third-party) |
| SEO | 92 | 80 | ✅ PASS |
| Agentic Browsing | 67 | 80 | 🟡 ADVISORY (missing `llms.txt`; non-user-facing; recommend advisory not block) |

**Recommendation:** do not block cutover on Lighthouse scores. BP=81 is third-party SDK; Agentic=67 is a new LLM-crawler metric.

---

## Baseline Results — Pre-Cutover Curl (cf-xzj1, millicent, 2026-05-10)

| Check | 2026-05-10 | 2026-05-15 update |
|---|---|---|
| sitemap.xml | ✅ 128 URLs | unchanged |
| robots.txt | ✅ 200, Sitemap directive | unchanged |
| /api/health | ❌ 404 | ✅ **RESOLVED** — PR #554 merged |
| Security headers (4 of 5) | ⚠️ no CSP | P3 — post-cutover |
| og:title + og:description | ✅ full OG suite | unchanged |
| PDP Product JSON-LD | ✅ Organization + Product + BreadcrumbList | unchanged |
| Canonical URLs → www.carolinafutons.com | ✅ | unchanged |

---

## Quality Audit Summary

### SEO (cf-5rmn, miquella, 2026-05-10)
| Severity | Count | Top findings |
|---|---|---|
| P0 | 0 | — |
| P1 | 2 | PDP missing `alternates.canonical`; PLP missing canonical (filtered URLs = separate canonicals) |
| P2 | 4 | 15 pages no openGraph block; 13 pages missing all metadata; twitter card defaults; no BreadcrumbList on PLPs |

**Pre-cutover action:** file 1 small PR (6 lines, 2 files) for P1 canonical additions. Not a hard cutover blocker but low-risk and high SEO value.

### Accessibility (cf-7tkf, miquella, 2026-05-10, WCAG 2.1 AA)
| Severity | Count | Top findings |
|---|---|---|
| P0 | 0 | — |
| P1 | 3 | NewsletterSignup + EmailCapturePopup `placeholder:text-cf-cream/40` (contrast); HeaderMobileMenu close button aria-label |
| P2 | 6 | gift-registry "(optional)" contrast; search input aria-label; decorative alt="" confirm; drop-cap aria-hidden |

**Pre-cutover action:** 3-line class tweak + 1 aria-label add in one PR. All P1s are narrow-context (not page-wide). Zero P0s.

### Dark Mode (cf-rn4j, miquella, 2026-05-10)
| Page | Severity | Issue |
|---|---|---|
| /getting-it-home | 🟥 P1 | AddressCheckForm: bg-white inputs + text-cf-espresso labels — no dark: overrides (8 class additions) |
| /gift-cards | 🟥 P1 | page.tsx + loading.tsx: forced-light text/bg (6 class additions) |
| /order-confirmation | 🟥 P1 | 12 `text-cf-ink` instances without dark: override (single-file sweep) |
| /account, /contact, /design-a-room, /spring-sale, /guides, /reviews, /compare, QuickViewModal | ⚠️ P2 | Single-component forced-light; readable but inconsistent |

**Pre-cutover action:** 3-file dark-mode sweep (getting-it-home, gift-cards, order-confirmation) — ~26 class additions, low risk. Ship as one PR.

### Site Speed (cfw-vxb, 2026-05-09 — status as of merge)
| Finding | Severity | Status |
|---|---|---|
| PDP LCP image not prioritized (`fetchPriority="high"` missing on gallery + fallback `<img>`) | P0 | ✅ **SHIPPED** — cfw-vxb PR merged; `fetchPriority="high"` added to both paths |
| SiteContent per-request Wix reads (React `cache()` only, no `unstable_cache`) | P1 | ✅ **SHIPPED** — SiteContent wrapped in `unstable_cache` |

### Home Parity vs Wix (cf-3qt.6, 2026-05-15)
| Metric | cfw | Wix | Delta |
|---|---|---|---|
| Lighthouse Performance | 83 | 61 | **+22 (cfw wins)** |
| LCP | 3.8 s | 14.8 s | **−11.0 s (cfw wins)** |
| Accessibility | 97 | 96 | +1 |
| SEO | 100 | 100 | tie |

### Content Parity (cf-3qt.6, 2026-05-15)
- Blog: **15 posts on cfw** (full parity)
- Guides: **7 on cfw** vs 404 on Wix (cfw-exclusive surface)
- No content regressions identified

---

## What Stilgar Must Do Before GO Call

In order, top-down:

```
[ ] 1. Drop DNS TTL: Wix Dashboard → Domains → DNS → A records + www CNAME → set TTL=60
        Record execution time in docs/cf-3qt.8/ttl-drop-log.md
[ ] 2. Capture order baseline: node scripts/cutover/capture-order-baseline.mjs
        Commit resulting order-baseline-<DATE>.json to docs/cf-3qt.8/
[ ] 3. Add UptimeRobot API key to godfrey's env (cf-3qt.8.31 can then run setup-monitors)
[ ] 4. Confirm Sentry linked to carolinafutons.com production env
[ ] 5. Batch-copy 13 email templates to STAGING_SITE (cf-c6g5) — unblocks contact form + order flows
[ ] 6. Publish Velo backend to production — unblocks /_functions/* on www.carolinafutons.com
[ ] 7. FAQ CMS data (Brenda) — content only, not a deploy gate
[ ] 8. /referral visual check (Stilgar eyeball before cutover-night)
[ ] ⏳ Wait 48h from step 1 TTL drop before flipping DNS
```

---

## Recommended Pre-Cutover PRs (crew executes, Stilgar reviews)

All are low-risk, no Vercel credit cost for test-only, or minimal for implementation PRs:

| PR | Scope | Lines | Bead | Priority |
|---|---|---|---|---|
| SEO: PDP+PLP canonical | `alternates.canonical` in 2 files | ~6 | cf-5rmn P1 | Ship before cutover |
| A11y: placeholder contrast + close-button aria-label | 3 class tweaks + 1 aria-label | ~4 | cf-7tkf P1 | Ship before cutover |
| Dark mode: /getting-it-home + /gift-cards + /order-confirmation | ~26 class additions | ~26 | cf-rn4j P1 | Ship before cutover |
| OG metadata backfill (test-only) | og-metadata.test.ts +45 assertions | test only | cf-o5j5.1 | In review now |

---

## Hard DO-NOT-GO Conditions

Per `docs/cf-3qt-cutover-night-checklist.md` — abort if any true at calling-order time:

- DNS TTL > 60 s on any of the 4 production records
- Order baseline JSON not in `docs/cf-3qt.8/`
- `/api/health` returns ≠ 200 on the production Vercel alias ← **now RESOLVED**
- UptimeRobot has any monitor red or not configured
- Sentry not confirmed connected to production env
- Any P0 incident open in the last 4h on cfw or cfutons
- Pager / on-call coverage not acknowledged in cutover-window channel

---

## Source Documents

| Doc | Author | Date | Result |
|---|---|---|---|
| `go-no-go-gate-status-2026-05-10.md` | millicent | 2026-05-10 | 4 CLEAR, 6 PENDING, 2 BLOCKER |
| `pre-flip-smoke-results-2026-05-10.md` | miquella | 2026-05-10 | 20/0/1 PASS |
| `mobile-smoke-2026-05-10.md` | radahn | 2026-05-10 | 10/10 PASS |
| `e2e-checkout-smoke-2026-05-10.md` | radahn | 2026-05-10 | 2/2 PASS |
| `velo-smoke-2026-05-10.md` | radahn | 2026-05-10 | 4/5 PASS (staging) |
| `lighthouse-baseline-2026-05-10.md` | godfrey | 2026-05-10 | A11y 96+, SEO 92+, BP 81 |
| `pre-cutover-curl-results-2026-05-10.md` | millicent | 2026-05-10 | 6/7 PASS (health since fixed) |
| `quickview-smoke-2026-05-15.md` | radahn | 2026-05-15 | 3/3 PASS |
| `ttl-drop-log.md` | radahn (skeleton) | 2026-05-10 | All [FILL IN] — NOT STARTED |
| `docs/qa/seo-audit-2026-05-10.md` | miquella | 2026-05-10 | P0=0, P1=2 |
| `docs/qa/a11y-audit-2026-05-10.md` | miquella | 2026-05-10 | P0=0, P1=3 |
| `docs/qa/dark-mode-wave2-audit-2026-05-10.md` | miquella | 2026-05-10 | P1 on 3 pages |
| `docs/cfw-vxb-site-speed-audit-2026-05-09.md` | (cfw-vxb) | 2026-05-09 | P0+P1 both SHIPPED |
| `docs/cf-3qt.6/home-parity-2026-05-15.md` | (cf-3qt.6) | 2026-05-15 | cfw Perf=83 vs Wix=61 ✅ |
| `docs/cf-3qt.6/content-parity-2026-05-15.md` | (cf-3qt.6) | 2026-05-15 | blog+guides full parity ✅ |
