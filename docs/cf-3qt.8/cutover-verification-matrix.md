# cf-3qt.8 — Cutover Verification Matrix

**Bead:** cf-xze0  
**Owner:** melania  
**Last updated:** 2026-05-10  
**Purpose:** Step-by-step smoke test checklist for DNS flip night. Run pre-flip against Vercel preview, then post-flip against live domain.

---

## Preview URL (current)
```
https://carolina-futons-web.vercel.app
```
Latest production deployment: post-PR #551 merge.

---

## PRE-FLIP CHECKS (run against Vercel preview URL)

Run these before touching any DNS. All should pass.

### Core Pages
- [ ] `GET /` — home page loads, bears header renders (not white flash), hero text visible
- [ ] `GET /shop/futon-frames` — PLP loads, product grid populated (≥6 cards)
- [ ] `GET /products/kingston-futon-frame` — PDP loads, product name + price + Add to Cart button visible
- [ ] `GET /about` — content renders, illustrations visible
- [ ] `GET /visit` — address, hours, map section present
- [ ] `GET /getting-it-home` — ZIP form renders
- [ ] `GET /contact` — contact form renders
- [ ] `GET /gift-cards` — gift card section renders
- [ ] `GET /guides` — guide listing renders
- [ ] `GET /reviews` — reviews section renders
- [ ] `GET /spring-sale` — (if active) renders without 404

### Navigation
- [ ] Header nav links all resolve (no 404s): Futon Frames, Murphy Cabinet Beds, Platform Beds, Mattresses, Contact, About
- [ ] Mobile hamburger opens (viewport 390px), all links visible
- [ ] Footer links resolve

### Transactional Flows
- [ ] Add Kingston to cart → cart drawer opens → item name + price correct → quantity increment works
- [ ] Cart count updates in header
- [ ] `GET /checkout` — Wix Headless checkout page loads (not 404, not blank)
- [ ] Newsletter signup field visible on home page (do not submit)
- [ ] Contact form renders all fields (do not submit with real data)

### Technical
```bash
# Run these curl checks from terminal
BASE="https://carolina-futons-web.vercel.app"

curl -s "$BASE/sitemap.xml" | grep -c "<url>" # Should be > 50
curl -s -o /dev/null -w "%{http_code}" "$BASE/robots.txt" # Should be 200
curl -s "$BASE/api/health" | python3 -m json.tool # Should be {"status":"ok",...}
curl -s -I "$BASE/" | grep -i "x-frame-options\|content-security" # Security headers
curl -s "$BASE/" | grep 'og:title' # OG tags present
curl -s "$BASE/products/kingston-futon-frame" | grep '"@type":"Product"' # JSON-LD
```

- [ ] sitemap.xml accessible + contains > 50 URLs
- [ ] robots.txt returns 200, contains `Sitemap:` directive
- [ ] `/api/health` returns `{"status":"ok"}` with HTTP 200
- [ ] Home page has `og:title` + `og:description` meta tags
- [ ] PDP has `Product` JSON-LD schema
- [ ] `NEXT_PUBLIC_SITE_URL` canonicals point to `www.carolinafutons.com` (not Vercel alias)

### Dark Mode
- [ ] Toggle dark mode via browser DevTools → header/footer render correctly (no white surfaces)
- [ ] Cart drawer dark mode correct
- [ ] PDP dark mode correct (no invisible buttons)

---

## DNS FLIP PROCEDURE

**Prerequisites (must be true before starting):**
- [ ] TTL has been at 60s for ≥ 48h (per dns-ttl-drop-runbook.md)
- [ ] All PRE-FLIP checks above pass
- [ ] UptimeRobot monitors configured (cf-3qt.8.31)
- [ ] Sentry connected to production environment
- [ ] Order-rate baseline captured (order-baseline-runbook.md)
- [ ] cf-dbw9 Track 3 done (secret scanning enabled)
- [ ] Team on standby: Stilgar + melania

### Step 1 — Add domain to Vercel (Stilgar)
```
vercel domains add carolinafutons.com
vercel domains add www.carolinafutons.com
```
Verify both appear in Vercel project domains list.

### Step 2 — Update Wix DNS (Stilgar in Wix Dashboard)
Change the `@` A records to point to Vercel:
```
A  @    76.76.21.21    TTL 60
A  @    76.223.126.88  TTL 60  (if needed for failover)
CNAME www  cname.vercel-dns.com.  TTL 60
```
Remove the old Wix A records (`185.230.63.186`, `185.230.63.107`, `185.230.63.171`).
Remove the old `www` CNAME (`cdn1.wixdns.net.`).

### Step 3 — Verify propagation (melania)
```bash
# Run every 30s until resolved
dig +short carolinafutons.com A      # Should return Vercel IPs
dig +short www.carolinafutons.com A  # Should return Vercel IPs
curl -s -o /dev/null -w "%{http_code}" https://www.carolinafutons.com/  # Should be 200
```
Typical propagation with 60s TTL: **2–5 minutes**.

### Step 4 — SSL Certificate
Vercel auto-provisions SSL via Let's Encrypt. Check:
```bash
curl -sI https://www.carolinafutons.com/ | grep -i "strict-transport"
```
SSL should be green within **5 minutes** of DNS propagation.

---

## POST-FLIP CHECKS (run against live domain)

Same checklist as PRE-FLIP, but against `https://www.carolinafutons.com`:

- [ ] `https://www.carolinafutons.com/` loads cfw (not Wix Studio page)
- [ ] `https://carolinafutons.com/` → redirects to `www.` (or loads directly per Stilgar preference)
- [ ] Bears header renders (not Wix template header)
- [ ] All PRE-FLIP page checks pass on live domain
- [ ] `/api/health` returns OK on live domain
- [ ] UptimeRobot monitors show green within 10 min
- [ ] Sentry: no spike in errors (check error rate vs pre-cutover baseline)
- [ ] Google Search Console: submit new sitemap URL

### Wix Fallback Verification
```bash
# Wix Studio preview URL should still work (read-only fallback)
curl -s -o /dev/null -w "%{http_code}" "https://chrisdealglass.wixstudio.com/my-site"
# Should return 200 (Wix site still exists, just not primary)
```

---

## ROLLBACK PROCEDURE

If any POST-FLIP check fails and the issue can't be fixed in < 15 min:

### Rollback Steps (Stilgar, ~5 min)
1. Wix Dashboard → DNS → restore original A records:
   ```
   A  @    185.230.63.186  TTL 60
   A  @    185.230.63.107  TTL 60
   A  @    185.230.63.171  TTL 60
   CNAME www  cdn1.wixdns.net.  TTL 60
   ```
2. Remove Vercel custom domains (optional — can leave, Wix takes priority via DNS)
3. Verify propagation: `dig +short carolinafutons.com A` → should show Wix IPs within 60s
4. Verify Wix site loads: `curl -s -o /dev/null -w "%{http_code}" https://www.carolinafutons.com/`

**Rollback SLO: < 15 minutes** (guaranteed by 60s TTL, see dns-ttl-drop-runbook.md).

Post-rollback: file incident bead, investigate root cause before scheduling retry.

---

## 24h MONITORING THRESHOLDS

| Metric | Baseline | Alert threshold |
|--------|----------|-----------------|
| Uptime | 100% | < 99.9% (UptimeRobot) |
| Response time | < 500ms (health) | > 2000ms |
| Error rate (Sentry) | ~0 | > 5 errors/min |
| Order rate | See order-baseline-runbook.md | < 50% of baseline for > 1h |
| 404 rate | < 1% | > 5% |

---

## CONTACTS

| Role | Contact | Channel |
|------|---------|---------|
| Site owner | Stilgar (DreadPirateRobertz) | Discord 1484990638930788352 |
| PM | melania | gt nudge / gt mail |
| Mobile | dallas | gt nudge cfutons_mobile/dallas |
| DNS registrar | Wix Dashboard | carolinafutons@gmail.com login |
| Vercel | Dashboard | chrisdealglass@gmail.com login |
