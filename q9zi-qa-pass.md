# cf-q9zi QA Pass — carolina-futons-web.vercel.app — 2026-04-27

Comprehensive E2E sweep per Stilgar request. Every navigable page tested. Forms submitted. Results below.

---

## FORMS

| Form | Result | Notes |
|---|---|---|
| /contact | ✅ PASS | Renders, client validation fires (min 10 chars message), previous session confirmed delivery |
| /signup | ✅ PASS | PR #241 (cf-nl0k) merged — CF-branded "Create an account" form renders, client validation fires |
| Newsletter footer | ❌ FAIL | "We couldn't save that right now" — persists post-PR-#242. Re-tested 2026-04-27. Bead: cf-5pf8 |

---

## SHOP / COLLECTION PAGES

| Page | Result | Notes |
|---|---|---|
| /shop/futon-frames | ✅ PASS | 17 products |
| /shop/murphy-cabinet-beds | ✅ PASS | 9 products |
| /shop/platform-beds | ✅ PASS | Loads |
| /shop/mattresses | ✅ PASS | 7 products |
| /shop/mattresses-sale | ✅ PASS | Loads |
| /collections/futon-frames | ❌ FAIL | 404 — no redirect to /shop/*. Bead: cf-1te7 |

---

## PRODUCT DETAIL PAGES

| Page | Result | Notes |
|---|---|---|
| /products/kingston-futon-frame | ✅ PASS | Images, Add to cart, ZIP estimator |
| /products/solstice-futon-frame | ✅ PASS | Loads |
| /products/wilderness-log-futon | ✅ PASS | Correct slug (NOT wilderness-log-futon-frame which 404s) |
| /products/orion-murphy-cabinet-bed | ✅ PASS | Loads |
| /products/mesa-1000-mattress | ✅ PASS | Correct slug (NOT mesa-1000-futon-mattress which 404s) |
| /products/canby-mattress | ✅ PASS | Loads (note: Canby is a futon-frame — cf-m80l) |
| PDP variant pickers | ⏳ BLOCKED | cf-44mq in progress — all STAGING_SITE products have empty productOptions |

---

## INFO / STATIC PAGES

| Page | Result | Notes |
|---|---|---|
| /about | ✅ PASS | |
| /faq | ✅ PASS | 18 entries |
| /warranty | ✅ PASS | |
| /shipping | ✅ PASS | |
| /returns | ✅ PASS | |
| /guides | ✅ PASS | |
| /visit | ✅ PASS | |
| /press | ✅ PASS | |
| /reviews | ✅ PASS | |
| /design-a-room | ✅ PASS | |
| /blog | ✅ PASS | 8 articles; titled "Journal — Notes from the Showroom" |
| /blog/[slug] | ✅ PASS | e.g. /blog/small-space-furniture-solutions-best-beds-for-apartments-studios |
| /account | ✅ PASS | Sign In page renders |
| /privacy | ✅ PASS | |
| /terms | ✅ PASS | |
| /accessibility | ✅ PASS | |
| /our-story | ✅ PASS | Redirects → /about |
| /winback | ✅ PASS | |
| /spring-sale | ✅ PASS | |
| /care | ❌ FAIL | 404 — no route, no redirect to /warranty. Bead: cf-e92v |
| /care-warranty | ❌ FAIL | 404 — same. Bead: cf-e92v |
| /style-quiz | ❌ FAIL | "The quiz is temporarily unavailable." Ongoing since Phase 1. Bead: cf-sg12 |

---

## CART / CHECKOUT

| Page | Result | Notes |
|---|---|---|
| /cart | ✅ NEW PASS | Renders empty cart page with Continue shopping CTA (was 404 in cf-wx0g) |
| /checkout | ✅ PASS | PR #249 merged — Go to checkout → Wix STAGING_SITE `/__ecom/checkout` with checkoutId + headlessExternalUrls. "Can't accept online payments" = STAGING_SITE payment config, not cfw bug |
| Cart drawer (add item) | ✅ PASS | Kingston $619 adds, qty stepper, Remove, Go to checkout render |
| Cart full pipeline | ✅ PASS | PR #249 merged — full add-to-cart → drawer → checkout pipeline working |

---

## SEARCH

| Test | Result | Notes |
|---|---|---|
| /search (empty) | ✅ PASS | 4 suggestion chips |
| /search?q=futon | ✅ PASS | 12 products + 2 articles (GAP-2 closed) |

---

## NEW BEADS FILED

| Bead | Priority | Title |
|---|---|---|
| cf-1te7 | P1 | /collections/* → 404, no redirect to /shop/* |
| cf-e92v | P2 | /care and /care-warranty → 404 |
| cf-5pf8 | P1 | Newsletter footer still fails post-PR-#242 merge |
| cf-sg12 | P1 | /style-quiz permanently broken |

---

## POST-MERGE SWEEP — 7 PRs (2026-04-27 Wave 2)

Retested all features from PRs merged since first-wave QA pass.

| PR | Feature | Result | Notes |
|---|---|---|---|
| #241 (cf-nl0k) | /signup page | ✅ PASS | "Create an account" form renders; email + password + confirm fields; client validation fires |
| #242 | Newsletter → Velo | ❌ FAIL | Still "We couldn't save that right now" — retested post-merge. Velo endpoint may not be published. Bead: cf-5pf8 |
| #243 + #248 | Dark mode toggle | ✅ PASS | Sun/moon button in header; toggle → dark background, light text on /account; localStorage persisted |
| #239 | CartIllustration drawer | ✅ PASS | Mountains/futon illustration renders at top of cart drawer when item added |
| #229 | /privacy consent prefs | ✅ PASS | "Cookie preferences" section with Analytics, Advertising, Ad personalization toggles |
| #247 | Announcement rotation | ✅ PASS | 5 messages rotate every 5s; cart-aware override fires ("You're $881.00 away from free white-glove delivery") |
| #244 (cf-h1i4) | PdpMattressBundle | ✅ PASS | "Add a mattress" cross-sell on Kingston PDP — Mesa 1000/3000/5000 with individual Add to cart buttons |
| #249 | Cart full pipeline | ✅ PASS | See CART/CHECKOUT table above — full checkout flow confirmed |
| #254 | /swatch-request | ✅ PASS | "Request fabric swatches" page renders — swatch picker (up to 5), shipping address fields, Request swatches CTA |

---

## cf-c77s UPDATE — Welcome Email + Cart Abandonment

**PR #249 is now merged.** Cart pipeline functional. Status:

- **Cart abandonment email**: Cart abandonment automation is ACTIVE (Wix, `eedfb2db`). Real test requires email-associated cart session + 30 min wait. Cannot automate.
- **Welcome email**: /signup (PR #241) now live on cfw. `wixMembers_onMemberCreated` trigger still requires human signup with reCAPTCHA solve on STAGING_SITE. `welcome_series_4` and `welcome_series_5` missing from `emailTemplates.web.js` registry — steps 4-5 will fail at send time regardless.
- **Manual step required**: Hal signs up at `https://chrisdealglass.wixstudio.com/my-site` → solve reCAPTCHA → check `halworker85@gmail.com` for `welcome-01-hello.html` within 5 min.

Full email + challenge test matrix: `parity/reports/2026-04-26-e2e-emails-challenges.md`

---

## OPEN BEADS TRACKER

All beads still requiring action as of 2026-04-27 wave-2.

| Bead | Priority | Status | Title | Blocker |
|---|---|---|---|---|
| cf-1te7 | P1 | OPEN | /collections/* → 404, no redirect to /shop/* | — |
| cf-e92v | P2 | OPEN | /care and /care-warranty → 404, no redirect to /warranty | — |
| cf-5pf8 | P1 | OPEN | Newsletter footer fails post-PR-#242 | Velo endpoint not published or deploy lag |
| cf-sg12 | P1 | OPEN | /style-quiz permanently broken | Ongoing since Phase 1 |
| cf-44mq | P1 | IN_PROGRESS | PDP variant pickers broken | STAGING_SITE products have empty productOptions |
| cf-c77s | P1 | IN_PROGRESS | E2E email + challenge tests | Welcome email: reCAPTCHA blocker (manual Hal action needed) |
| B1 (new) | HIGH | OPEN | welcome_series_4, welcome_series_5 missing from emailTemplates.web.js | Will fail at send time — registry gap |
| B2 (new) | HIGH | OPEN | reengagement_2, reengagement_3 missing from emailTemplates.web.js | Will fail at send time — registry gap |

---

*millicent — 2026-04-27 — cf-q9zi QA pass (updated with post-merge wave 2 + open beads tracker)*
