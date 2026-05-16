# cf-3qt.8 — Cutover Readiness Scorecard (2026-05-16)

**Bead:** cf-afxf
**Companion to:** `cutover-verification-matrix.md` (flip-night checklist)
**Purpose:** Single-page synthesis of the 12 baseline smokes shipped on PR #1274 + every outstanding P-finding rolled up across them. Read this before paging through individual baseline docs.

## Domain traffic-lights

| Domain | Status | Outstanding |
|---|---|---|
| **Cart / Checkout** | 🟢 GREEN | None blocking. cf-snil shipped in-cart coupon entry; cf-5qv7 surfaced discount-line in subtotal; cf-7utd pins the buy-button happy path end-to-end. |
| **SEO / Meta** | 🟢 GREEN | None blocking. cf-bbo8 + cf-89fb cover all 10 core canonicals. cf-oj8u meta-tag smoke 10/10 PASS. cf-o9f6 JSON-LD smoke 6/6 PASS. |
| **A11y** | 🟢 GREEN | ~25 components pinned across waves 0-6 to the cf-cta focus-visible convention (cf-nm9p ships the helper consolidation). cf-2oku contrast fixes landed. cf-613 / cf-uoe role=status pinned. |
| **Security / Headers** | 🟢 GREEN | cf-set3 7/7 PASS (HSTS, XCTO, XFO, Referrer, Permissions, X-DNS-Prefetch). cf-zwqw cache-headers 5/5 PASS. P2 finding on /api/cart Vercel default — flagged for morgott's cf-3qt.2 implementation. |
| **Images / Assets** | 🟢 GREEN | cf-avtq 6/6 PASS — 106 image URLs verified, zero bad. Mix includes Wix CDN + local /brand + next/image. |
| **Visual / Dark / Reduced-motion** | 🟢 GREEN | cf-pjdb + cf-vtoe + cf-ljsy + cf-9mm0 + cf-5nmb baselines all 10/10 per-surface PASS. |
| **DNS / Cutover-mechanics** | 🟡 YELLOW | cf-gqdf verify-dns-ttl.sh enhanced with --watch + cutover-window math (PR #1327 merged). **Stilgar still needs to drop TTL to 60s in Wix dashboard** — current TTL is 3600s per the runbook. Once dropped, 48h drain window starts. |
| **Email triggers** | 🟡 YELLOW | cf-w1u1 covers email-side; **BLOCKED on staging Velo unreachable** — staging.carolinafutons.com doesn't resolve, www.../_functions/contactSubmissionsDiagnostic returns 404. rennala's test plan (PR #1220) is ready to execute once Stilgar publishes backend to staging. |
| **Parity vs Wix Studio** | 🟢 GREEN | cf-4i44 policy pages: 3 of 4 are net-new on cfw (Wix Studio 404s on /shipping, /returns, /warranty). cf-wsrr cart parity audit: 1 material gap closed (cf-snil + cf-5qv7). cf-tm1e referral: 3-row delta matrix awaiting Stilgar 15-min visual check. |

## 12 baselines on PR #1274 — status table

| # | Bead | Doc | Result | Open findings |
|---|---|---|---|---|
| 01 | cf-pjdb | `mobile-smoke-2026-05-10.md` | 10/10 PASS | — |
| 02 | cf-vtoe | `tablet-smoke-2026-05-10.md` | 10/10 PASS | — |
| 03 | cf-ljsy | `desktop-smoke-2026-05-10.md` | 10/10 PASS | — |
| 04 | cf-9mm0 | `dark-smoke-2026-05-10.md` | 10/10 PASS | Surfaced cf-ax24 + cf-yq3h dark-mode waves (all merged) |
| 05 | cf-i5sq | `seo-smoke-2026-05-10.md` | 10/10 PASS | Surfaced cf-y0ca sitemap fix (merged) |
| 06 | cf-5nmb | `reduced-motion-smoke-2026-05-10.md` | 10/10 PASS | Playwright config gotcha documented |
| 07 | cf-oj8u | `meta-tags-smoke-2026-05-10.md` | 10/10 PASS | Surfaced cf-89fb canonical extension (merged) |
| 08 | cf-o9f6 | `jsonld-smoke-2026-05-10.md` | 6/6 PASS | PDP streaming-timing documented |
| 09 | cf-zwqw | `cache-headers-smoke-2026-05-10.md` | 5/5 PASS | **P2 finding**: `/api/cart` Vercel default `public, max-age=0`; morgott to set `private, no-store` when cart impl ships (cf-3qt.2) |
| 10 | cf-set3 | `security-headers-smoke-2026-05-10.md` | 7/7 PASS | — |
| 11 | cf-avtq | `image-health-smoke-2026-05-15.md` | 6/6 PASS (106 URLs) | — |
| 12 | cf-7utd | (spec held local in `cf-7utd-cart-flow-e2e` branch — buy-button e2e) | PASS @ 17s wall | — |

## Outstanding findings rolled up

### P1 (block cutover)

**None blocking.** All P1 work from the baselines has shipped:
- cf-snil cart coupon entry (PR #598)
- cf-5qv7 cart discount display (PR #626)
- cf-7utd cart-flow e2e (PR #683)
- cf-f3zo cart action hotfix (PR #653)

### P2 (close before cutover ideal, post-cutover OK)

| Finding | Owner | Status |
|---|---|---|
| `/api/cart` Vercel default `public, max-age=0` (cf-zwqw F2) | morgott via cf-3qt.2 | Pending real cart impl |
| `/faq` underpopulated (cfw 6 questions vs Wix ~20) — cf-4i44.F1 | Brenda / Stilgar (Wix CMS data entry) | Pending |
| `/account` Lighthouse A11y 93→100 — cf-2oku | blaidd (PR #592) | **MERGED** |
| Wave 6 a11y (QuizResult + DragDropRoomPlanner) — cf-g0mu | blaidd (PR #650) | Pending merge |

### P3 (post-cutover polish)

- cf-tm1e referral parity (3-row matrix awaits Stilgar visual)
- cf-snil.fu1 → cf-5qv7 discount-line surface — **DONE** (PR #626)
- cf-2oku.fu1 focus-ring helper — **DONE** (cf-nm9p PR #687)
- cf-y0ca sitemap fix — **DONE**
- cf-89fb canonical extension — **DONE** (PR #569)
- Future per-page-OG image artistry (separate beads)

### YELLOW-status (out-of-band gates)

- **DNS TTL drop** (cf-3qt.8.2): Stilgar manual action in Wix dashboard. 5-min execution + 48h drain window. cf-gqdf script (PR #1327) verifies progress.
- **Staging Velo publish** (gates cf-w1u1 + cf-oi01): Stilgar manual action. Blocks real-Wix end-to-end smokes; fixture-mode coverage (cf-7utd) does NOT block.

## Cutover readiness call

**Pre-flight: GREEN if** the 2 YELLOW gates (DNS TTL drop + staging Velo publish for full validation) move to GREEN.

**Recommended cutover window:**
- T-0: Stilgar drops Wix DNS TTL to 60s.
- T+48h: cf-gqdf verify-dns-ttl.sh passes all 5 resolvers.
- T+48h to T+72h: Stilgar publishes Velo to staging; rennala/godfrey execute cf-w1u1 email-trigger matrix.
- T+72h+: open the cutover window.

The cf-3qt.8 verification matrix (the flip-night checklist) is then the runbook for the actual DNS flip.

## What this scorecard intentionally does NOT track

- **Mobile-app coupling** — separate Velo CartSessions mirror tracked by morgott / cf-cart-session-dual-write.
- **Per-product Wix Stores data quality** — covered by miquella / millicent under cf-3qt.6.
- **Post-cutover monitoring** — Sentry + UptimeRobot tracked by cf-3qt.8.31.
- **Revenue dashboards** — out of cutover-gate scope; pulled by Stilgar via Wix Analytics.

## Refs

- Bead: cf-afxf
- Parent epic: cf-3qt
- Cutover phase: cf-3qt.8
- Companion: `cutover-verification-matrix.md` (flip-night checklist)
- All 12 baselines: `docs/cf-3qt.8/*-smoke-2026-05-*.md`
