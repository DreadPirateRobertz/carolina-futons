# 24h Post-Cutover Smoke Test Plan — cf-3qt.8.5

**Window:** First 24 hours after DNS flip to Vercel Pro  
**Trigger:** DNS propagation confirmed (carolinafutons.com → Vercel edge)  
**Owner:** rennala (plan), melania (sign-off)  
**Format:** Each check lists Assignee · Criteria · PASS / FAIL

---

## Wave 1 — Immediate (0–15 min post-flip)

### 1.1 Home page loads
**Assignee:** rennala  
**How:** `curl -sI https://carolinafutons.com/` + browser load  
**PASS:** HTTP 200, `<h1>` present, LCP < 3s on fast 3G (Lighthouse)  
**FAIL:** 5xx, redirect loop, blank page, or LCP > 5s

### 1.2 PDPs resolve — spot check 5 products
**Assignee:** rennala  
**How:** Open 5 PDP URLs from live sitemap (mix of frames + mattresses)  
**PASS:** Each `/products/[slug]` returns 200, product title + price render, Add-to-Cart button present  
**FAIL:** 404, 500, missing price, or JS error in console

### 1.3 Cart add + persist
**Assignee:** rennala  
**How:** Add 1 product to cart, reload page, confirm item still in cart  
**PASS:** Cart count increments, item survives reload, cart drawer opens  
**FAIL:** Item disappears on reload, cart count stuck at 0, drawer crashes

### 1.4 Search returns results
**Assignee:** rennala  
**How:** Search "futon frame" and "mattress" via site search  
**PASS:** Both queries return ≥ 1 result within 3s, result cards link to valid PDPs  
**FAIL:** Zero results for known terms, spinner never resolves, 5xx from search API

### 1.5 Wix CDN images load
**Assignee:** rennala  
**How:** Open home + 2 PDPs, check Network tab for `static.wixstatic.com` or `images.wixmp.com` responses  
**PASS:** All product images return 200 from Wix CDN, no broken-image icons  
**FAIL:** Images return 403/404, CORS errors in console, or placeholder broken icons visible

---

## Wave 2 — First hour (15–60 min)

### 2.1 Mobile 375px — home + PDP + cart
**Assignee:** radahn  
**How:** Chrome DevTools → iPhone SE (375×667) on home, one PDP, cart drawer  
**PASS:** No horizontal scroll, nav hamburger opens, images scale correctly, CTA buttons tappable (≥ 44px)  
**FAIL:** Horizontal overflow, nav broken, images cropped, buttons too small to tap

### 2.2 301 redirects — Wix query-param URLs
**Assignee:** rennala  
**How:** Test 10 old Wix URLs (e.g. `/?product=futon-slug`) with `curl -sI --max-redirs 0`  
**PASS:** Each returns HTTP 301 with `Location:` pointing to correct Next.js route  
**FAIL:** 200 (no redirect), 404, or redirect to wrong page

### 2.3 Checkout flow reaches payment step
**Assignee:** melania (manual QA device)  
**How:** Add item → Proceed to Checkout → confirm checkout page loads with Stripe/PayPal  
**PASS:** Checkout page renders, payment fields appear, no console errors  
**FAIL:** Checkout blank, payment widget missing, JS crash before payment step

### 2.4 Contact form submits
**Assignee:** rennala  
**How:** Submit contact form with test name/email/message  
**PASS:** Success toast appears, no 5xx from `/api/contact`, CRM contact created in Wix  
**FAIL:** Form submits to 404/500, no success feedback, or Velo RPC error in logs

### 2.5 Newsletter signup
**Assignee:** rennala  
**How:** Submit a test email on `/spring-sale` or footer signup  
**PASS:** HTTP 200 from server action, success state shown to user  
**FAIL:** 4xx/5xx, no feedback, or duplicate-email error surfaced to user

---

## Wave 3 — Hours 2–6

### 3.1 PLPs load — all 6 category routes
**Assignee:** rennala  
**How:** Visit `/shop/futon-frames`, `/shop/mattresses`, `/shop/platform-beds`, `/shop/murphy-cabinet-beds`, `/shop/mattresses-sale`, `/shop/accessories`  
**PASS:** Each returns 200, ≥ 1 product card renders, no "No products found" on non-empty categories  
**FAIL:** 404, empty grid on a category with known products, image CDN errors

### 3.2 GA4 events firing
**Assignee:** melania  
**How:** GA4 DebugView (G-E88HTNX5RJ) while browsing home → PLP → PDP → cart  
**PASS:** `page_view`, `view_item_list`, `view_item`, `add_to_cart` events appear in DebugView within 30s  
**FAIL:** DebugView shows no events after 2 min of browsing, or wrong page paths reported

### 3.3 Meta Pixel — page_view + add_to_cart
**Assignee:** melania  
**How:** Meta Pixel Helper browser extension on home + add-to-cart action  
**PASS:** `PageView` fires on each page load, `AddToCart` fires on cart add  
**FAIL:** Pixel Helper shows "No Pixel Found" or events missing

### 3.4 Vercel edge logs — no 5xx spike
**Assignee:** rennala  
**How:** Vercel dashboard → Functions/Edge logs, filter 2xx vs 5xx for first 2h  
**PASS:** 5xx rate < 0.5% of total requests  
**FAIL:** 5xx rate ≥ 1%, or any repeated error pattern (same route erroring consistently)

---

## Wave 4 — Hours 6–24

### 4.1 GSC crawl errors — no new 404s
**Assignee:** melania  
**How:** Google Search Console → Coverage → Crawl Errors at T+24h  
**PASS:** No new 404s for URLs that existed pre-cutover; redirect map fully covers indexed URLs  
**FAIL:** GSC reports 404s on previously-indexed product or content URLs

### 4.2 Lighthouse scores — home + one PDP
**Assignee:** rennala  
**How:** Lighthouse CI on `carolinafutons.com` and one PDP at T+6h (CDN warm)  
**PASS:** Performance ≥ 80, Accessibility ≥ 90, SEO ≥ 95 on both pages  
**FAIL:** Performance < 70 or SEO < 90 (indicates missing meta or broken schema)

### 4.3 Order History accessible for logged-in member
**Assignee:** melania (test account)  
**How:** Log in with test Wix member → `/account/orders`  
**PASS:** Order history loads, past orders visible, links to order detail work  
**FAIL:** Auth redirect loop, blank page, or Wix Members API error

### 4.4 Blog index + post render
**Assignee:** rennala  
**How:** Visit `/blog` and open one post  
**PASS:** Blog index shows posts, individual post renders with correct title/body/date  
**FAIL:** 404, empty index, or CMS data missing

---

## Go / No-Go Gate

**At T+24h, melania reviews all checks:**

| Result | Action |
|--------|--------|
| All PASS | Declare cutover complete, close cf-3qt.8 |
| ≤ 2 FAIL, non-critical (e.g. analytics) | Document, file sub-beads, proceed |
| Any FAIL on Wave 1 checks | Rollback DNS to Wix Studio immediately, file incident bead |
| 5xx rate ≥ 1% sustained | Rollback, root-cause before retry |

**Rollback command (if needed):**
```
# Repoint DNS A/CNAME back to Wix Studio IPs — confirm with Stilgar before executing
```
