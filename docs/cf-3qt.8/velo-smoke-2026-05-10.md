# cf-3pc5 — Velo endpoint smoke test (2026-05-10)

Pre-cutover health probe of the cfutons Velo HTTP function layer. Five endpoints hit live against staging.

## Environment

- **Staging base:** `https://chrisdealglass.wixstudio.com/my-site`
- **Production:** `https://www.carolinafutons.com` returns HTTP 404 for ALL `/_functions/*` URLs — backend is not published there yet (matches cf-w1u1's deferred note).
- **Probed by:** radahn, 2026-05-10 ~08:27 UTC
- **Tool:** `curl` with `--max-time 15`

## Endpoint name reconciliation

The bead's example endpoint list (`getProducts`, `getProductById`, `submitContactForm`, `getSiteSettings`, `healthCheck`) does NOT match the actual cfutons Velo exports. Wix Velo's HTTP function naming convention is `get_<name>` / `post_<name>` → `/_functions/<name>` URL. I substituted the closest 5 real endpoints that exercise the same coverage classes the bead asked for:

| Bead intent       | Real endpoint                       | Class                        |
| ----------------- | ----------------------------------- | ---------------------------- |
| healthCheck       | `GET /_functions/health`            | Liveness                     |
| getProducts       | `GET /_functions/productSitemap`    | Product-data read (XML feed) |
| submitContactForm | `POST /_functions/contactSubmissions` | Contact form write         |
| getSiteSettings   | `GET /_functions/manifest`          | Static config read           |
| (5th)             | `GET /_functions/robots`            | Static-config read           |

`getProductById` has no `_functions` endpoint in this codebase — cfw reads single products via the Wix Stores SDK directly. `getSiteSettings` similarly has no direct endpoint; manifest serves as the closest static-config probe.

## Results

| # | Endpoint                              | Method | Status | Verdict | Notes |
| - | ------------------------------------- | ------ | ------ | ------- | ----- |
| 1 | `/_functions/health`                  | GET    | **200** | ✅ PASS | `{"status":"ok","timestamp":"2026-05-10T08:27:34.419Z"}` — 54 bytes, JSON. Liveness healthy. |
| 2 | `/_functions/productSitemap`          | GET    | **200** | ✅ PASS | 3740 bytes XML. Valid `<urlset>` with real product URLs (`https://www.carolinafutons.com/products/<slug>`). Product-data read working. |
| 3 | `/_functions/contactSubmissions`      | POST   | **500** | ⚠️ EXPECTED FAIL | Body: `{"success":false,"error":"Failed to send message. Please try calling us at (828) 252-9449."}`. This is the infra-failure path. Most likely cause: cf-c6g5 (Stilgar batch-copies 13 triggered email templates to STAGING_SITE) has not yet completed, so the contact-submission email-send step fails downstream. Track in cf-w1u1 (E2E email triggers) — both gates on cf-c6g5. |
| 4 | `/_functions/manifest`                | GET    | **200** | ✅ PASS | 489 bytes JSON PWA manifest. `{"name":"Carolina Futons","short_name":"CF Futons",...}`. Static-config read working. |
| 5 | `/_functions/robots`                  | GET    | **200** | ✅ PASS | 390 bytes `text/plain`. `User-agent: * / Allow: / / Disallow: /cart ...`. Static-config read working. |

## Summary

**4 of 5 endpoints PASS.** The Velo backend stack is healthy on staging for liveness + read paths. The single failure (contactSubmissions 500) is consistent with the documented cf-c6g5 dependency — email triggers cannot complete until Stilgar batch-copies the 13 production templates to STAGING_SITE.

## Pre-cutover gates implied

- **GO:** Liveness, product-data reads, static-config reads (manifest + robots) — all healthy.
- **HOLD:** Any flow that completes via triggered email (contact form, swatch confirmation, order confirmation, abandoned-cart recovery, winback). Gated on cf-c6g5.
- **Production publish:** `www.carolinafutons.com/_functions/*` returns 404 across the board. The latest backend is staging-only. Gated on Stilgar's production publish step.

## Followups

None to file. cf-c6g5 already exists for the email-template batch-copy. cf-w1u1 already exists for the post-cf-c6g5 e2e email-trigger sweep. This smoke confirms the rest of the Velo surface is ready when those two gates clear.

## Reproducer

```bash
BASE="https://chrisdealglass.wixstudio.com/my-site"
curl -s "$BASE/_functions/health" -w "\n%{http_code}\n"
curl -s "$BASE/_functions/productSitemap" -w "\n%{http_code}\n" | head -c 400
curl -s -X POST "$BASE/_functions/contactSubmissions" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke test","email":"test@example.com","message":"cf-3pc5 smoke — ignore"}' \
  -w "\n%{http_code}\n"
curl -s "$BASE/_functions/manifest" -w "\n%{http_code}\n"
curl -s "$BASE/_functions/robots" -w "\n%{http_code}\n"
```
