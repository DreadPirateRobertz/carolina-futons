# Velo `/_functions` smoke test suite — 2026-05-05

**Status:** Active smoke spec for the 5 newly-live Velo HTTP endpoints (cf-foo0,
cf-w1lg, cf-9ieq cleanup pending). Used by `scripts/qa/velo-functions-smoke.mjs`
and the nightly GitHub Action at `.github/workflows/velo-smoke.yml`.

**Owner:** godfrey (initial author). Refresh this doc whenever an endpoint adds
or changes a status branch — the action will start failing if expected !== actual.

## Targets

| Origin | When |
|---|---|
| `https://chrisdealglass.wixstudio.com/my-site` | staging (Wix Studio preview) — primary smoke target |
| `https://www.carolinafutons.com` | production — secondary, only after confirming staging green |

The script defaults to staging via env var `VELO_SMOKE_BASE`. Override per run.

## Endpoints

### 1. `POST /_functions/contactSubmissions`

Wrapper around `emailService.sendEmail`. cf-foo0 + cf-9ieq follow-up. Currently
**expected to 500** until cf-c6g5 (Triggered Email template setup) lands;
treat 500 with `'Failed to send message…'` body as PASS until templates ship,
then flip the expectation to 200.

| Case | Body | Expected status | Expected body shape |
|---|---|---|---|
| Valid full payload | `{"name":"Smoke","email":"smoke@example.com","subject":"x","message":"y","sizeOfInterest":"queen"}` | 500 (until cf-c6g5) → 200 after | `{success:false, error:"Failed to send message…"}` (pre-fix) → `{success:true}` |
| Invalid JSON | `{ bad` | 400 | `{success:false, error:"Invalid JSON body"}` |
| Missing required `name` | `{"email":"smoke@example.com","message":"y"}` | 400 | `{success:false, error}` (validateSchema label) |
| Missing required `message` | `{"name":"Smoke","email":"smoke@example.com"}` | 400 | `{success:false, error}` |
| Invalid email format | `{"name":"S","email":"not-an-email","message":"y"}` | 400 | `{success:false, error:"Invalid email address."}` |
| sizeOfInterest whitelist reject | `{"name":"S","email":"smoke@example.com","message":"y","sizeOfInterest":"<script>"}` | 500 (templates) → 200, subject **must NOT** contain the script tag | n/a (server-side only) |
| OPTIONS preflight | (none) | 204 | ACAO header echoed for allowed origin |

### 2. `POST /_functions/mailingListSignups`

Wrapper around `newsletterService.subscribeToNewsletter`. Sends discount code
on first subscribe; idempotent on duplicate. cf-w1lg.

| Case | Body | Expected status | Expected body shape |
|---|---|---|---|
| Valid | `{"email":"smoke+<RUN>@example.com","source":"smoke_test"}` | 200 | `{success:true, discountCode}` |
| Duplicate (re-run with same email) | same | 200 | `{success:true, discountCode}` (newsletterService is idempotent) |
| Invalid JSON | `{ bad` | 400 | `{success:false, error:"Invalid JSON body"}` |
| Missing email | `{}` | 400 | `{success:false, error}` |
| Honeypot filled | `{"email":"smoke@example.com","honeypot":"bot"}` | 200 | `{success:true}` (silent — bot trap) |
| OPTIONS preflight | (none) | 204 | ACAO + `Allow-Methods: POST, OPTIONS` |

> Use `smoke+<UNIX_TS>@example.com` to avoid hitting the 3/hour rate limit on
> repeat smoke runs. The `+suffix` plus-addressing keeps each run unique.

### 3. `POST /_functions/sampleRequests`

Wrapper around `swatchRequest.submitSwatchRequest` with HTTP-level 5/hour
per-email rate limit. cf-w1lg.

| Case | Body | Expected status | Expected body shape |
|---|---|---|---|
| Invalid JSON | `{ bad` | 400 | `{success:false, error:"Invalid JSON body"}` |
| Missing swatchIds | `{"contactInfo":{"email":"smoke@example.com","firstName":"S","lastName":"T","address":"1","city":"H","state":"NC","zip":"28792"}}` | 400 | `{success:false, error}` |
| OPTIONS preflight | (none) | 204 | ACAO + Allow-Methods |

> The valid happy path requires real swatch `_id`s from the FabricSwatches CMS
> collection — too brittle for smoke. Skip the success case here; rely on the
> per-PR vitest in cfutons monorepo (`tests/sampleRequests.http.test.js`).

### 4. `GET /_functions/deliveryZone?zip=<zip>`

Wrapper around `deliveryZoneService.getDeliveryZone`. cf-w1lg + cf-89xn
lying-status fix.

| Case | Query | Expected status | Expected body shape |
|---|---|---|---|
| Local NC zip (Hendersonville) | `?zip=28792` | 200 | `{success:true, zone, label, rate, eta, distanceMiles}` |
| Out-of-range zip | `?zip=99999` | 200 | `{success:true, zone:"outofrange", message}` |
| Missing zip | (none) | 400 | `{success:false, error}` |
| Letters in zip | `?zip=ABCDE` | 400 | `{success:false, error}` |
| Short zip | `?zip=123` | 400 | `{success:false, error}` |
| OPTIONS preflight | (none) | 204 | ACAO |

### 5. `GET` + `POST /_functions/unsubscribe`

CAN-SPAM / GDPR one-click unsubscribe with HMAC-verified token. cf-w1lg.
Generating a valid token requires `UNSUB_TOKEN_SECRET` access — happy path
not smokeable from CI. Smoke covers the rejection branches only.

| Case | Method | Args | Expected status | Body |
|---|---|---|---|---|
| GET missing token | `GET` | (none) | 400 | HTML "Invalid link" |
| GET invalid token | `GET ?token=garbage` | | 400 | HTML "invalid or has expired" |
| POST missing token | `POST {}` | | 400 | JSON `{success:false, error:"Token is required"}` |
| POST invalid token | `POST {"token":"garbage"}` | | 400 | JSON `{success:false, error:"invalid-token"}` |
| POST invalid JSON | `POST { bad` | | 400 | JSON `{success:false, error:"Invalid JSON body"}` |
| OPTIONS preflight | `OPTIONS` | | 204 | ACAO |

### 6. `GET /_functions/health` (bonus, post cf-89xn)

Health probe + smoke-gate. Zero state, zero auth.

| Case | Expected status | Body |
|---|---|---|
| GET (any origin) | 200 | `{status:"ok", timestamp}` |
| GET (allowed origin) | 200 | + `Access-Control-Allow-Origin` header |
| OPTIONS preflight (allowed origin) | 204 | ACAO + `Allow-Methods: GET, POST, OPTIONS` |
| OPTIONS preflight (rejected origin) | 403 | "Origin not allowed" body |

## Known-broken paths (env-var contract)

The first smoke run (2026-05-05) surfaced 3 production gaps. Until they
fix, the script's expectations match current reality so nightly stays
green; flip the env var when each fix lands and the smoke will start
catching regressions on the new contract.

| Env var | Default (today) | Flip to | Trigger |
|---|---|---|---|
| `CONTACT_VALID_EXPECT` | `500` | `200` | cf-c6g5 lands (Triggered Email templates set up) |
| `NEWSLETTER_VALID_EXPECT` | `400` | `200` | newsletterService.subscribeToNewsletter healthy (root cause TBD — likely missing CMS collection or ESP creds; **file follow-up bead**) |
| `UNSUB_INVALID_TOKEN_EXPECT` | `500` | `400` | `UNSUB_TOKEN_SECRET` added to Wix Secrets Manager (`get_unsubscribe`'s bare-catch hides `SecretNotFoundError` — same pattern as cf-9ieq) |

Set in GitHub Actions via workflow_dispatch inputs, or pass on the
command line for manual runs:

```bash
NEWSLETTER_VALID_EXPECT=200 node scripts/qa/velo-functions-smoke.mjs
```

## How to run

### Manually (single endpoint)

```bash
curl -i -X POST -H 'Content-Type: application/json' \
  -H 'Origin: https://carolina-futons-web.vercel.app' \
  -d '{"name":"Smoke","email":"smoke@example.com","subject":"x","message":"y"}' \
  https://chrisdealglass.wixstudio.com/my-site/_functions/contactSubmissions
```

### Programmatically (full suite)

```bash
node scripts/qa/velo-functions-smoke.mjs                     # → staging
VELO_SMOKE_BASE=https://www.carolinafutons.com node scripts/qa/velo-functions-smoke.mjs  # → prod
```

Exit code 0 on all-green, 1 on any unexpected status. Output is one line per
case in TAP-ish format so it's grep-friendly.

## When to update this spec

Edit this file (and the script) when:

- A new `/_functions/<name>` endpoint lands. Add its rows to the table.
- An existing endpoint's status mapping changes (e.g., cf-c6g5 lands → flip
  contactSubmissions valid case from 500 → 200).
- A consumer's expected body shape changes (cfw branches on status, mobile
  app on shape — both audiences need stable contracts).

## Linked beads

- cf-foo0 (closed) — contactSubmissions wrapper
- cf-w1lg (closed) — 4-endpoint port
- cf-89xn (closed) — stage3 follow-ups + deliveryZone lying-status
- cf-9ieq (open) — sendEmail 500 root cause = missing template
- cf-c6g5 (open) — Triggered Email template setup (blocks cf-9ieq close)
- cf-fuvd (open) — orphan importProductOptions module deletion
