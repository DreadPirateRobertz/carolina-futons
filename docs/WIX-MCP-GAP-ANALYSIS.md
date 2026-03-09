# Wix MCP Gap Analysis

**Bead:** CF-mfcw (P1)
**Date:** 2026-03-08
**Author:** godfrey (cfutons/crew)
**Target:** My Site 2 staging integration (`49cd75b0-92f1-4978-93e2-f5b5da531142`)

---

## Executive Summary

We have **two MCP servers** configured — the official Wix MCP and our custom wix-velo-mcp. Together they cover ~70% of what we need for full "My Site 2" staging integration. The critical gaps are: **CMS/collection management**, **member/CRM operations**, **media management**, and **environment-aware testing** (staging vs production). The official `CallWixSiteAPI` is a generic REST passthrough that *theoretically* covers most gaps, but lacks the ergonomics needed for routine agent workflows.

---

## 1. Inventory: What Each MCP Handles

### Official Wix MCP (`@wix/mcp-remote` → `mcp.wix.com/mcp`)

| Tool | Purpose | Category |
|------|---------|----------|
| `SearchWixWDSDocumentation` | Search Design System docs | Docs |
| `SearchWixRESTDocumentation` | Search REST API docs | Docs |
| `SearchWixSDKDocumentation` | Search SDK docs | Docs |
| `SearchBuildAppsDocumentation` | Search Build Apps docs | Docs |
| `SearchWixHeadlessDocumentation` | Search Headless docs | Docs |
| `WixBusinessFlowsDocumentation` | Multi-step flow guides | Docs |
| `ReadFullDocsArticle` | Fetch full article by URL | Docs |
| `ReadFullDocsMethodSchema` | Get API method request/response schema | Docs |
| `ListWixSites` | List sites on account | Account |
| `CallWixSiteAPI` | Generic REST API passthrough | Site API |
| `ManageWixSite` | Site-level ops (create, etc.) | Account |
| `SupportAndFeedback` | Submit feedback to Wix | Meta |

**Also available per-site** (via `<site>/_api/mcp`):
- `GenerateVisitorToken` — Create visitor session for API auth
- `SearchSiteApiDocs` — API docs for installed solutions
- `GetBusinessDetails` — Timezone, email, phone, address
- `SearchInSite` — Search site content

**Strength:** Documentation search, generic API passthrough, account management.
**Weakness:** No domain-specific tools for CMS, eCommerce, CRM. Everything goes through `CallWixSiteAPI` which requires knowing exact endpoints and body schemas.

### Custom wix-velo-mcp (`wix-velo-mcp/dist/index.js`)

| Tool | Purpose | Category |
|------|---------|----------|
| `velo_status` | Auth status, deployed tag | DevOps |
| `velo_sync` | Copy tagged release to prod repo | DevOps |
| `velo_diff` | Preview changes before sync | DevOps |
| `velo_preview` | Start `wix dev` server | DevOps |
| `velo_preview_stop` | Stop dev server | DevOps |
| `velo_publish` | Run tests + `wix publish` | DevOps |
| `velo_catalog_import` | Import products from JSON | eCommerce |
| `velo_secrets_set` | Manage Wix Secrets | Config |
| `velo_email_template_list` | List triggered email templates | Email |
| `velo_email_template_create` | Create email templates | Email |
| `velo_page_list` | List site pages | Content |
| `velo_redirect_list` | List URL redirects | SEO |
| `velo_redirect_set` | Create URL redirects | SEO |

**Strength:** Code deployment pipeline (sync → preview → publish), catalog import, secrets/email/redirect management.
**Weakness:** No CMS CRUD, no member management, no order/cart operations, no media uploads.

---

## 2. Wix APIs Used in Our Codebase

Our codebase imports **16 distinct Wix modules** across **230+ files**. Here's how each maps to MCP coverage:

| Wix Module | Files | MCP Coverage | Gap? |
|------------|-------|-------------|------|
| `wix-data` | 95 | `CallWixSiteAPI` (generic) | **YES** — No dedicated CMS tools |
| `wix-web-module` | 93 | N/A (runtime only) | No — framework, not API |
| `wix-location-frontend` | 41 | N/A (client-side) | No — browser runtime |
| `wix-window-frontend` | 19 | N/A (client-side) | No — browser runtime |
| `wix-members-backend` | 36 | `CallWixSiteAPI` (generic) | **YES** — No member tools |
| `wix-members-frontend` | 13 | N/A (client-side) | No — browser runtime |
| `wix-secrets-backend` | 8 | `velo_secrets_set` | **Covered** |
| `wix-seo-frontend` | 8 | N/A (client-side) | No — browser runtime |
| `wix-storage-frontend` | 5 | N/A (client-side) | No — browser runtime |
| `wix-fetch` | 4 | N/A (runtime only) | No — generic HTTP |
| `wix-crm-backend` | 5 | `CallWixSiteAPI` (generic) | **YES** — No CRM tools |
| `wix-crm-frontend` | 1 | N/A (client-side) | No — browser runtime |
| `wix-stores-frontend` | 2 | `CallWixSiteAPI` (generic) | **PARTIAL** — catalog import exists |
| `wix-loyalty.v2` | 1 | `CallWixSiteAPI` (generic) | **YES** — No loyalty tools |
| `wix-media-backend` | 1 | None | **YES** — No media tools |
| `wix-marketing-backend` | 1 | None | **YES** — No coupon tools |
| `wix-http-functions` | 1 | N/A (runtime only) | No — framework |

### Frontend/runtime modules (no gap — not MCP-relevant)

These modules run in the browser or Wix runtime. They don't need MCP tools:
- `wix-web-module`, `wix-location-frontend`, `wix-window-frontend`, `wix-members-frontend`, `wix-seo-frontend`, `wix-storage-frontend`, `wix-fetch`, `wix-crm-frontend`, `wix-http-functions`

### Covered by existing MCP tools

- `wix-secrets-backend` → `velo_secrets_set`
- `wix-stores-frontend` (catalog) → `velo_catalog_import`

### Gaps requiring custom tools

- `wix-data` (CMS collections) — **60+ collections**, most-used API
- `wix-members-backend` — 36 files use member context
- `wix-crm-backend` — triggered emails, contact management
- `wix-loyalty.v2` — loyalty tiers/rewards
- `wix-media-backend` — media uploads/management
- `wix-marketing-backend` — coupon creation/management

---

## 3. Gap Analysis: What's Missing for My Site 2 Staging

### Priority 1 — Critical Gaps (block staging workflow)

#### 3.1 CMS Collection Management (wix-data)

**Impact:** 95 files, 60+ collections. This is our most-used Wix API.

**What's needed:**
| Tool | REST Endpoint | Purpose |
|------|---------------|---------|
| `velo_collection_list` | `POST /v3/collections/query` | List all CMS collections |
| `velo_collection_query` | `POST /v3/items/query` | Query items from a collection |
| `velo_collection_insert` | `POST /v3/items` | Insert items into a collection |
| `velo_collection_update` | `PATCH /v3/items/{id}` | Update collection items |
| `velo_collection_delete` | `DELETE /v3/items/{id}` | Delete collection items |
| `velo_collection_bulk` | `POST /v3/items/bulk` | Bulk insert/update |

**Why `CallWixSiteAPI` isn't enough:** Agents need to seed staging data (products, FAQ, testimonials), verify collection schemas, and debug data issues. A generic passthrough requires remembering exact endpoints and schemas every time. Dedicated tools with collection-name autocompletion would save significant token overhead.

**Note:** A branch `cf-9g1g-cms-collection-tools` exists in wix-velo-mcp with CMS work in progress.

#### 3.2 Environment Separation (Staging vs Production)

**Impact:** Blocks safe staging workflows entirely.

**What's needed:**
| Tool | Purpose |
|------|---------|
| `velo_env_switch` | Switch between staging/production site contexts |
| `velo_env_status` | Show current environment (site ID, API key scope) |

**Current state:** All API calls go to the same site ID. No way to point tools at a staging instance without reconfiguring env vars. Need a staging site ID or sandbox mode for safe testing.

### Priority 2 — Important Gaps (needed for full functionality)

#### 3.3 Member & Contact Management (wix-members-backend, wix-crm-backend)

**Impact:** 41 files depend on member/CRM operations.

**What's needed:**
| Tool | REST Endpoint | Purpose |
|------|---------------|---------|
| `velo_member_list` | `POST /v1/members/query` | List site members |
| `velo_member_get` | `GET /v1/members/{id}` | Get member details |
| `velo_contact_list` | `POST /v4/contacts/query` | List CRM contacts |
| `velo_contact_create` | `POST /v4/contacts` | Create test contacts |
| `velo_email_send` | `POST /v3/triggered-emails/send` | Send triggered email |

**Use case:** Seed test members for staging, verify loyalty tiers, test email flows.

#### 3.4 eCommerce Operations (wix-stores beyond catalog)

**Impact:** Cart, checkout, orders — core business flow.

**What's needed:**
| Tool | REST Endpoint | Purpose |
|------|---------------|---------|
| `velo_order_list` | `POST /v2/orders/query` | List orders |
| `velo_order_get` | `GET /v2/orders/{id}` | Get order details |
| `velo_product_list` | `POST /v1/products/query` | List products (live site) |
| `velo_product_get` | `GET /v1/products/{id}` | Get product details |
| `velo_coupon_create` | `POST /v1/coupons` | Create test coupons |

**Use case:** Verify catalog import results, test checkout flows, create promo codes for testing.

### Priority 3 — Nice to Have (can use `CallWixSiteAPI` as workaround)

#### 3.5 Media Management

| Tool | Purpose |
|------|---------|
| `velo_media_upload` | Upload images/assets to Wix Media |
| `velo_media_list` | List media in site gallery |

#### 3.6 Marketing & Loyalty

| Tool | Purpose |
|------|---------|
| `velo_loyalty_status` | Check loyalty program config |
| `velo_coupon_list` | List active coupons/promotions |

#### 3.7 Analytics & Monitoring

| Tool | Purpose |
|------|---------|
| `velo_analytics_summary` | Site traffic/conversion summary |
| `velo_error_log` | Recent Velo runtime errors |

---

## 4. The `CallWixSiteAPI` Question

The official Wix MCP's `CallWixSiteAPI` is a **generic REST passthrough** that can theoretically call any Wix REST endpoint. So why do we need custom tools?

### When `CallWixSiteAPI` is sufficient:
- One-off queries (check a specific order, verify a member exists)
- Ad-hoc exploration (what collections exist, what products are live)
- Operations agents do rarely

### When custom tools are needed:
- **Repeated workflows** — Agents shouldn't re-discover endpoint URLs and schemas each time
- **Multi-step operations** — Catalog import requires transform + batch + verify (229 lines in our tool)
- **Safety guardrails** — Our tools validate inputs, prevent destructive ops on production
- **Token efficiency** — A dedicated `velo_collection_query Products` saves ~500 tokens vs constructing a full CallWixSiteAPI request with endpoint URL, auth headers, and JSON body
- **Staging safety** — Custom tools can enforce environment checks before writes

### Recommendation:
Build custom tools for P1/P2 gaps. Use `CallWixSiteAPI` as fallback for P3 items.

---

## 5. Implementation Recommendations

### Phase 1: CMS + Environment (blocks staging)
1. **Finish `cf-9g1g-cms-collection-tools` branch** — merge CMS CRUD tools
2. **Add environment switching** — support `WIX_STAGING_SITE_ID` env var, add `velo_env_switch` tool
3. **Add collection schema introspection** — agents need to know field names/types

### Phase 2: Members + eCommerce
4. **Member/contact tools** — query, create for staging seeding
5. **Order/product query tools** — verify live site state from agent context
6. **Triggered email send** — test email flows end-to-end

### Phase 3: Media + Marketing
7. **Media upload** — for product images, illustration assets
8. **Coupon management** — create/list promotions for testing
9. **Analytics summary** — quick site health check

### Architecture Notes
- All new tools should follow existing pattern in `wix-velo-mcp/src/tools/`
- Use `wixApiFetch()` from `src/lib/wixApi.ts` for REST calls
- Add Zod schemas for all inputs in `src/index.ts`
- Environment switching: add `WIX_STAGING_SITE_ID` + `WIX_STAGING_API_KEY` to config
- TDD: write tests before implementation per PM directive

---

## 6. Current Coverage Matrix

```
                        Official Wix MCP    Our wix-velo-mcp    Gap?
                        ────────────────    ────────────────    ────
Code Deployment              ✗                    ✓              ─
Preview/Publish              ✗                    ✓              ─
Docs Search                  ✓                    ✗              ─
Account Management           ✓                    ✗              ─
Secrets Management           ✗                    ✓              ─
Email Templates              ✗                    ✓              ─
URL Redirects                ✗                    ✓              ─
Page Listing                 ✗                    ✓              ─
Catalog Import               ✗                    ✓              ─
CMS CRUD                     ○ (generic)          ✗              ★ P1
Environment Switch           ✗                    ✗              ★ P1
Member Management            ○ (generic)          ✗              ★ P2
CRM/Contacts                 ○ (generic)          ✗              ★ P2
Order Queries                ○ (generic)          ✗              ★ P2
Coupon Management            ○ (generic)          ✗              ◎ P3
Media Upload                 ✗                    ✗              ◎ P3
Loyalty Program              ○ (generic)          ✗              ◎ P3
Analytics                    ✗                    ✗              ◎ P3

Legend: ✓ = dedicated tool  ○ = possible via generic passthrough  ✗ = not available
        ★ = needs custom tool  ◎ = can use CallWixSiteAPI workaround
```

---

## 7. External API Integrations (Not Wix MCP Relevant)

Our codebase integrates with 6 external APIs via `wix-fetch` + `wix-secrets-backend`. These are **not candidates for MCP tools** — they run server-side in Wix Velo runtime:

| Service | Module | Purpose |
|---------|--------|---------|
| UPS | `ups-shipping.web.js` | Rate quotes, labels, tracking |
| Twilio | `smsService.web.js` | SMS notifications |
| Klaviyo | `newsletterService.web.js` | Email campaigns, webhooks |
| Google Merchant | `http-functions.js` | Shopping feed |
| Facebook/Meta | `facebookCatalog.web.js` | Catalog sync, CAPI |
| Pinterest | `pinterestCatalogSync.web.js` | Product feed, Rich Pins |

These run inside Wix Velo and don't need MCP tools — they're called by the site's backend code at runtime.

---

## Sources

- [About the Wix MCP](https://dev.wix.com/docs/api-reference/articles/wix-mcp/about-the-wix-mcp)
- [About the Wix Site MCP](https://dev.wix.com/docs/develop-websites/articles/get-started/about-the-wix-site-mcp)
- [Wix MCP GitHub](https://github.com/wix/wix-mcp)
- [Official Wix MCP Server](https://www.wix.com/studio/developers/mcp-server)
- [Wix REST API Reference](https://dev.wix.com/docs/rest)
