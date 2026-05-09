# Carolina Futons — Master Testing Guide
**Owner**: Melania (PM) | **Last updated**: 2026-05-05 | **Mirrors**: Petra's TL-side testing-master

This is the canonical e2e + verification checklist for cf migration → cutover. Each section maps to a flow Stilgar / QA / Brenda need to confirm before Phase 8 (DNS flip to carolinafutons.com → Vercel).

---

## Test environments

| Env | URL | Purpose |
|-----|-----|---------|
| **Vercel preview** | https://carolina-futons-web.vercel.app/ | Active development + e2e (current focus) |
| **Wix Studio staging** | https://chrisdealglass.wixstudio.com/my-site | Velo backend + email funnel test surface |
| **Live (DO NOT TOUCH)** | https://carolinafutons.com | Production until cutover. Read-only. |

---

## Section 1 — Account + Auth

### 1.1 Signup happy path
- [ ] /signup → enter unique email + password (≥8 chars) + confirm
- [ ] "Account created" shown OR "Check your email" if verification required
- [ ] Member appears in Wix Members dashboard (Customers & Leads → Contacts → filtered to active members)

### 1.2 Sign-in roundtrip ⚠️ **BLOCKED**
- [ ] /account → enter same email + password → redirects to /dashboard
- [ ] Currently 502 — tracked cfw-aik / cfw-hb3 / cf-9u1 (paired Mac+Linux debug)

### 1.3 Forgot password reset (cfw-bm2 in flight)
- [ ] /account → "Forgot your password?" link
- [ ] Email arrives with tokenized reset link
- [ ] /account/reset-password?token=… → set new password → sign-in succeeds

---

## Section 2 — Cart + Checkout (skip payment per Stilgar Option D)

### 2.1 Add to cart
- [x] /products/kingston-futon-frame → variants render (5 colors, 3 sizes)
- [x] Add to Cart → drawer opens
- [x] Cart count badge updates

### 2.2 Cart persistence ✅ verified
- [x] Add product → navigate /cart → items survive (verified 2× Kingston @ $1,238)
- [x] Subtotal correct
- [ ] Reload page — cart still present
- [ ] New tab same browser — cart shared

### 2.3 Cart line item display ❌ **BUG cfw-1nm**
- [ ] Line item shows product image (currently bare placeholder)
- [ ] Line item shows variant color label
- [ ] Line item shows variant size label
- [ ] Line item shows variant-specific price (King ≠ Full ≠ Queen)

### 2.4 Variant binding ✅ **FIXED 2026-05-09**
- [ ] PDP color click → main image swaps to variant photo (blocked: no per-finish media in staging catalog)
- [x] PDP size click → price updates to variant price (Full=$619 / Queen=$669 / King=$699 — verified Puppeteer)
- [ ] Add to Cart respects selected variant (pending cart line item fix cfw-1nm)

### 2.5 Empty cart state ✅
- [x] /cart with no items → V3 sleeping-bear illustration + "Continue shopping" CTA

### 2.6 Checkout (deferred until templates land)
- [ ] /checkout creates Wix Headless checkout session
- [ ] Redirects to Wix-hosted checkout
- [ ] Shipping method selection
- [ ] Payment method shown (then STOP per Option D)

---

## Section 3 — Email touch funnel ⚠️ **BLOCKED on cf-c6g5**

Templates needed on STAGING_SITE (Stilgar batch-copy from prod):
1. contact_form_submission → owner notification
2. welcome_series_1..5
3. order_confirmation
4. order_shipped, freight_shipped
5. delivery_confirmation
6. post_purchase_review_reward (Day-14)
7. NPS survey
8. swatch_confirmation
9. abandoned_cart_recovery
10. browse_recovery
11. reengagement_1..3
12. post_purchase_care
13. recovery_discount

### Verification curl (post-templates)
- [ ] `curl -X POST .../_functions/contactSubmissions -d {valid body}` → 200 + email arrives
- [ ] `curl -X POST .../_functions/mailingListSignups -d {email}` → 200 + welcome_series_1 arrives
- [ ] Place order in checkout → order_confirmation arrives
- [ ] Mark fulfillment in Wix dashboard → order_shipped arrives
- [ ] Mark delivered → delivery_confirmation + Day-14 reward scheduled

---

## Section 4 — PDP feature checklist (per hookup guide v4.6)

| Feature | Status | Bead |
|---------|--------|------|
| Product info + price + variants | ✅ live | cfw-1nm (variant binding bug) |
| Variant Swatches | partial | cfw-1nm |
| Image Gallery | ✅ live | — |
| Add to Cart | ✅ live | — |
| Quick View modal | ✅ live | — |
| Sticky Add-to-Cart bar | 🔄 cfw-k10 in flight | — |
| Related Products | ✅ live | — |
| Recently Viewed | ✅ live | — |
| Also Bought / FBT | ✅ live | — |
| Reviews aggregate | ⚠ hardcoded fixture | cfw-49h migration in flight |
| Stamped review widget | 🔄 cfw-km7 in flight | — |
| Customer Video Reviews | 🔄 cfw-9zp in flight | — |
| Live Inventory + Low Stock | 🔄 cfw-6bp in flight | — |
| Showroom CTA | ✅ shipped | cfw-tbg |
| Price Lock Guarantee | 🔄 cfw-5jt in flight | — |
| BNPL widget (Affirm/Afterpay) | ✅ shipped | cfw-8cx |
| 360° Spin Viewer | 🔄 cfw-tsd in flight | — |
| Gallery Zoom Lightbox | 🔄 cfw-zd8 in flight | — |
| Share-Photo CTA (UGC) | ✅ shipped | cfw-0ty |
| Compare tray | 🔄 cfw-7g1 in flight | — |
| Q&A Widget | ❌ not started | morgott audit cf-o2kq |
| Size Guide & Room Fit | ✅ live | — |
| Financing display | ✅ live | — |
| Shipping Intelligence | ✅ live | — |

---

## Section 5 — Pages confirmed live

✅ / (home with FilterFirst hero) | ✅ /shop/futon-frames | ✅ /shop/murphy-cabinet-beds | ✅ /shop/platform-beds | ✅ /shop/mattresses | ✅ /shop/sale | ✅ /products/[slug] | ✅ /cart | ✅ /spring-sale | ✅ /design-a-room | ✅ /referral | ✅ /spin-wheel | ✅ /survey | ✅ /sommelier | ✅ /near/[city] | ✅ /bundle | ✅ /gift-registry | ✅ /style-quiz/[result] | ✅ /contact (FogScene) | ✅ /visit (CabinHero) | ✅ /about (MascotTimeline) | ✅ /guides | ✅ /reviews | ✅ /press | ✅ /faq | ✅ /shipping | ✅ /returns | ✅ /warranty | ✅ /accessibility | ✅ /privacy | ✅ /terms | ✅ /sustainability | ✅ /community-gallery | ✅ /sitemap.xml (88 product URLs verified post-cfw-upa fix)

❌ /wishlist + /wishlist-share — pending cfw-vni (gated by cfw-aik signin fix)
❌ /price-match-guarantee — confirmed missing per morgott audit
❌ /fabric-swatches — confirmed missing per morgott audit

---

## Section 6 — Performance + Cutover Gates (radahn Lighthouse audit)

### Lighthouse PR #1153 verdicts

| Page | Wix Studio Perf | cfw Perf | Delta |
|------|-----------------|----------|-------|
| Home | 92 | 88 | ⚠ -4 |
| /shop/futon-frames | 90 | 91 | ✅ +1 |
| /products/kingston-futon-frame | 74 | **41** | ❌ **-33 (HOLD)** |
| /cart | 64 | 88 | ✅ +24 |
| /design-a-room | 75 | 80 | ✅ +5 |

### **PHASE 8 CUTOVER GATES**
- [ ] **P0-1**: Wix product image sizing — `/v1/fit/` slot must enforce w/h caps. radahn taking directly. ETA 1-2 hr.
- [ ] **P0-2**: Long-task in 0seo.*.js (cf-3qt.7 analytics+JSON-LD bundle, 1825ms). Bead pending. ETA 2-4 hr.
- [ ] After both P0s, re-run Lighthouse on Kingston PDP — Perf must return to ≥75.
- [ ] CWV (LCP/TBT/CLS) within budget across all 5 audited pages.

### Other regression checks
- [ ] axe-core a11y scan ≥ Wix Studio score per page
- [ ] Visual regression vs Wix Studio screenshots (cf-3qt.6 spec)

---

## Section 7 — Mobile-specific

- [ ] Hamburger menu drawer takes visual focus (cfw-xnl in flight — backdrop opacity bump)
- [x] Header LivingHero compact mode visible (moon + 2 fireflies + bear) at 375px
- [ ] Footer sitting bear visible at 375px (cf-aqk3 mobile refocus shipped)
- [ ] PDP variant pickers tap-friendly (≥44px tap targets)
- [ ] Cart drawer slides smoothly
- [ ] No horizontal scroll on any page at 375/390/414 widths

---

## Section 8 — Cross-rig (Mobile app + cfw)

- [ ] Mobile useProducts → cfw products parity (same SKU set)
- [ ] CROSS_RIG_SECRET HMAC working /api/cross-rig (Velo → cfw revalidation)
- [ ] ProductSwatches CMS table parity (Dallas cross-PM)
- [ ] Member auth shared session (post-cfw-aik)

---

## Section 9 — SEO / Analytics

- [ ] /sitemap.xml has all product URLs (✅ 88 verified post-cfw-upa)
- [ ] /robots.txt allows Googlebot
- [ ] noindex removed from production layout (✅ #443)
- [ ] GA4 + GTM + Meta Pixel + TikTok + Pinterest events firing (Stilgar to wire pixel IDs when at computer)
- [ ] Schema.org JSON-LD on PDP + breadcrumbs
- [ ] OG + Twitter cards on all routes

---

## Section 10 — DNS Cutover Day Checklist (Phase 8)

Pre-cutover (T-48hr):
- [ ] DNS TTL lowered to 300s on carolinafutons.com
- [ ] Vercel Pro upgrade approved + active
- [ ] STAGING_SITE Wix Premium (if needed for payments) approved
- [ ] All P0 + P1 beads cleared

Cutover window:
- [ ] DNS A/CNAME flipped → Vercel
- [ ] Synthetic monitor running every 60s on 10 critical URLs
- [ ] cf-3qt.8.13 Wave-2 e2e spec running

Post-cutover (T+24hr):
- [ ] Order rate ≥ 90% baseline (rollback trigger if below)
- [ ] No 5xx spikes in Vercel logs
- [ ] Email touch funnel firing (per cf-c6g5 templates)

---

## Outstanding blockers (Stilgar gates)
1. cf-c6g5 — Triggered Email templates batch-copy from prod (~30-60 min)
2. CODECOV_TOKEN — add to cfw repo secrets
3. Add codecov/project + codecov/patch to cfw main branch protection (after first upload)
4. Wix Premium upgrade on STAGING_SITE for full payment-path e2e
5. Vercel Pro upgrade — cutover gate
6. Pixels (GA4/Meta/TikTok/Pinterest) — Stilgar wires when at computer

---

*Living document. Update as features ship + flows verify.*
