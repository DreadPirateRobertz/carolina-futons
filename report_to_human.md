# cfutons (Carolina Futons) — Report to Human

**Last Updated:** 2026-02-22 16:30 UTC (architect)
**Repo:** git@github.com:DreadPirateRobertz/carolina-futons.git
**Beads DB:** ONLINE

---

## Health: GREEN — LAUNCH READY

| Metric | Value |
|--------|-------|
| Tests | 3,535+ vitest tests across 97 files (all green) |
| Backend Modules | 63 `.web.js` modules ready |
| Page Code | 24 page JS files with $w bindings |
| CMS Collections | 16 live in Wix + 66 auto-created by backend |
| Secrets Manager | 8 secrets configured (incl. WIX_BACKEND_KEY) |
| Payments | Wix Payments — Credit, Apple Pay, Google Pay, Afterpay |
| Product Catalog | 88 products enriched (74 priced, 14 contact-for-price) |

---

## Product Catalog Status: SHIPPED

| Data | Count | Status |
|------|-------|--------|
| Products total | 88 | All scraped via JSON-LD from carolinafutons.com |
| With prices | 74 | $35–$2,978 range |
| Contact-for-price | 14 | All Otis Bed mattresses (business choice, not missing data) |
| With descriptions | 88/88 | Complete |
| With images | 88/88 | High-res Wix static URLs |
| YouTube videos | 16 | KD Frames, Night & Day, Strata |

**Categories:** futon-frames 19, platform-beds 21, mattresses 14, casegoods-accessories 13, wall-hugger-frames 10, murphy-cabinet-beds 9, front-loading-nesting 2

**Key files:**
- `content/catalog-MASTER.json` — 88 products, enriched with prices/descriptions/images
- `content/carolinafutons-products.json` — Raw JSON-LD scrape (88 products)
- `content/catalog-youtube-videos.json` — 16 product videos
- `content/faq.json` — FAQ content (ordering, frames, beds, mattresses)
- `content/shipping-info.json` — Shipping policy, assembly, returns

---

## Deployment Guide: SHIPPED

`HOOKUP-GUIDE.md` — Complete step-by-step guide:
1. Deploy 63 backend modules to Wix Velo
2. Deploy utility modules
3. Deploy page code (Product, Thank You, Master pages)
4. Verify 8 secrets in Secrets Manager
5. Import product catalog via `catalogImport.web.js`
6. Configure 4 scheduled jobs (cart recovery, browse recovery, email queue, inventory)
7. Connect domain and publish
8. Verification checklist (13 test flows)

---

## Active Work

| Bead | Priority | Status | Title | Assigned |
|------|----------|--------|-------|----------|
| cf-nbw | P0 | IN PROGRESS | Review and update all MD files for deployment | architect |
| cf-584 | P0 | OPEN | Pull all text from carolinafutons.com via Wix MCP | unassigned |

**Recently completed:** cf-umw (Order Tracking page with UPS integration) — SHIPPED by architect.

---

## Crew Status

| Member | Role | Status | Current Work |
|--------|------|--------|-------------|
| melania | Production Manager | ACTIVE | Beads coordination, deployment prep |
| architect | Tech Lead | RUNNING | cf-nbw: MD file review for deployment |
| caesar | Executor | AVAILABLE | — |
| radahn | Executor | RUNNING | CMS content import |

---

## Completed This Session (50+ beads closed)

Key deliverables shipped:
- **catalog-MASTER.json** — 88 products, fully enriched
- **HOOKUP-GUIDE.md** — Complete Wix deployment guide
- **catalogImport.web.js** — Bulk import service (5 web methods, 39 tests)
- **loyaltyTiers.web.js** — Loyalty program (5 web methods, 36 tests)
- **productQA.web.js** — Q&A service (7 web methods, 37 tests)
- **YouTube video catalog** — 16 product videos cataloged
- 63 backend `.web.js` modules with 3,535+ tests

---

## Wix Site Readiness

### What's Ready (can deploy now):
- All backend code (63 modules)
- All page code (24 files)
- Product catalog (88 products)
- CMS collections (16 live)
- Secrets (8 configured)
- Payment processing (4 methods)
- Shipping calculator (UPS API)
- Email automation (SendGrid)

### What Needs Human Action:
| Item | Action Required |
|------|----------------|
| cf-6ub | Verify secrets in Wix Secrets Manager (halworker85@gmail.com login) |
| cf-xv3 | Verify CMS collections in Wix Dashboard |
| cf-e3o | Commission illustration assets |
| cf-1ur | Create Triggered Email templates in Wix Automations |
| Text content pages | FAQ, About, Shipping pages need content pasted into Wix Editor |

### Blocker:
- carolinafutons.com is 100% client-rendered (Wix Thunderbolt). WebFetch returns JS shell for all pages. Text content extraction requires headless browser or manual copy-paste from live site.

---

## Test Suite Growth

| Checkpoint | Tests | Files |
|------------|-------|-------|
| Session start | 2,394 | 70 |
| +comparison, abandonment | 2,639 | 75 |
| +checkout, vitals, reviews | 2,899 | 81 |
| +sustainability | 2,953 | 82 |
| +media gallery, delivery, topics | 3,200 | 88 |
| +catalogImport, productQA, loyalty | 3,444 | 94 |
| +orderTracking, search, financing | 3,535 | 97 |

---

*Production Manager: melania | cfutons GREEN — LAUNCH READY*
*Next: Complete MD review, deploy live test, verify all pages*
