# cf-v4py — E2E fixture-OFF test specs for cfw Velo wrapper endpoints

**Bead:** cf-v4py (cf-uwfw final verification gate)
**Status:** SPEC ONLY — staging Velo backend inaccessible from this sandbox; execution gated on Stilgar publishing backend + providing test member token.
**Authored:** 2026-05-16 by rennala
**Pattern ref:** cf-w1u1 PR #1220 (docs/qa/email-triggers-e2e-2026-05-05.md) — same shape, different scope.

## Why this is a spec doc and not a runnable test

The bead's NOTES block explicitly anticipates this fallback:

> "If staging is still inaccessible: write the fixture-OFF test SPECS (test cases without running them) documenting expected request/response shapes. This lets blaidd run them when staging becomes available."

Staging URL `chrisdealglass.wixstudio.com/my-site/_functions/<endpoint>` requires:
1. **Backend published to staging** — Stilgar gate (cf-w1u1 has the same dependency).
2. **Test member token** — Stilgar provides via secrets channel.
3. **Test data fixtures** — known-email-not-in-prod, known-cart-with-items, known-template-id-for-transactional.

None of those are available from this sandbox. Specs below document the contract; execution lands when the gates clear.

## Endpoint inventory (audited 2026-05-16 against `src/backend/http-functions.js`)

The bead names 3 endpoints. Audit shows:

| Bead name (spec) | Actual HTTP wrapper | Status |
|---|---|---|
| `triggerWelcomeSeries` | `post_queueWelcomeEmail` (line ~3697) | EXISTS — rename pending |
| `triggerCartRecovery` | `post_queueCartRecovery` (line ~3749) | EXISTS — rename pending; stub-success shape |
| `triggerTransactionalEmail` | (none) | **MISSING** — no HTTP wrapper exists |

**Action item for PM:** decide whether to (a) file a new bead to build `post_triggerTransactionalEmail` or (b) amend cf-v4py acceptance to drop the transactional row. The other two endpoints' shape is verified below.

---

## Endpoint 1: `POST /_functions/queueWelcomeEmail`

**Source:** `src/backend/http-functions.js:3697-3737`
**Auth:** unauthenticated (triggerWelcomeSeries self-guards via resolveContactId per cf-xdji)
**CORS:** allowed (corsHeaders applied + options_queueWelcomeEmail preflight)

### Request shape

Accepts two body shapes:

```json
// Shape A — callVelo wrapper (cfw-native)
{ "args": [ { "email": "halworker85+welcome@gmail.com", "firstName": "Hal" } ] }

// Shape B — direct payload
{ "email": "halworker85+welcome@gmail.com", "firstName": "Hal" }
```

The handler extracts `payload = (body.args[0]) || body || {}`.

### Required fields

- `email` (string, required, trimmed) — must be non-empty after trim.

### Optional fields

- `firstName` (string, default `""`) — used for template personalization.

### Response shapes

```http
# 200 OK — successful queue
{ "success": true, "queued": <number> }

# 400 Bad Request — invalid JSON body
{ "success": false, "error": "invalid_json" }

# 400 Bad Request — missing/empty email
{ "success": false, "error": "email is required" }

# 500 Server Error — downstream failure
{ "success": false, "error": "server_error", "errorId": "<uuid>" }
```

`errorId` correlates the response with a `console.error` line in the Velo logs for triage.

### Test scenarios

| # | Scenario | Body | Expected status | Expected response |
|---|----------|------|-----------------|-------------------|
| 1 | Happy path (Shape A) | `{"args":[{"email":"halworker85+welcome@gmail.com","firstName":"Hal"}]}` | 200 | `{"success":true,"queued":>=1}` |
| 2 | Happy path (Shape B) | `{"email":"halworker85+welcome@gmail.com","firstName":"Hal"}` | 200 | `{"success":true,"queued":>=1}` |
| 3 | Missing email | `{"firstName":"Hal"}` | 400 | `{"success":false,"error":"email is required"}` |
| 4 | Empty email | `{"email":""}` | 400 | `{"success":false,"error":"email is required"}` |
| 5 | Whitespace-only email | `{"email":"   "}` | 400 | `{"success":false,"error":"email is required"}` |
| 6 | Malformed JSON | `not json` | 400 | `{"success":false,"error":"invalid_json"}` |
| 7 | Optional firstName omitted | `{"email":"halworker85+welcome2@gmail.com"}` | 200 | `{"success":true,"queued":>=1}` (template renders without firstName) |
| 8 | CORS preflight | `OPTIONS` with `Origin: https://carolina-futons-web.vercel.app` | 204 | preflight headers present |

### Side-effect verification (post-run)

For scenarios 1, 2, 7: after a successful queue, check the **EmailQueue** Wix CMS collection for a row matching the email + welcome-series template. Inbox check at `halworker85+welcome@gmail.com` (or `+welcome2`) within the welcome-series delivery window.

---

## Endpoint 2: `POST /_functions/queueCartRecovery`

**Source:** `src/backend/http-functions.js:3749-3792`
**Auth:** unauthenticated (hint endpoint; cron remains canonical trigger)
**CORS:** allowed (corsHeaders + options_queueCartRecovery)

### Request shape

```json
// Shape A — callVelo wrapper
{ "args": [ { "type": "cart-recovery", "items": [ { "productId": "p-mesa", "quantity": 1 } ] } ] }

// Shape B — direct
{ "type": "cart-recovery", "items": [ { "productId": "p-mesa", "quantity": 1 } ] }
```

### Required fields

- `items` (array, non-empty)
- Each item: `productId` (non-empty string) + `quantity` (positive finite number)

### Response shapes

```http
# 200 OK — accepted (stub-success; cron does the real work)
{ "success": true, "accepted": <number>, "note": "cart-recovery hint accepted; cron remains canonical trigger" }

# 400 Bad Request — invalid JSON
{ "success": false, "error": "invalid_json" }

# 400 Bad Request — items missing or empty
{ "success": false, "error": "items[] is required" }

# 400 Bad Request — items shape invalid
{ "success": false, "error": "each item must have productId (string) + quantity (positive number)" }
```

### Test scenarios

| # | Scenario | Body | Expected status | Expected response |
|---|----------|------|-----------------|-------------------|
| 1 | Happy path single item | `{"items":[{"productId":"p-mesa","quantity":1}]}` | 200 | `{"success":true,"accepted":1,"note":"..."}` |
| 2 | Happy path multi item | `{"items":[{"productId":"p-mesa","quantity":1},{"productId":"p-kingston","quantity":2}]}` | 200 | `{"success":true,"accepted":2,...}` |
| 3 | callVelo shape | `{"args":[{"items":[{"productId":"p-mesa","quantity":1}]}]}` | 200 | `{"success":true,"accepted":1,...}` |
| 4 | Missing items | `{}` | 400 | `{"success":false,"error":"items[] is required"}` |
| 5 | Empty items array | `{"items":[]}` | 400 | `{"success":false,"error":"items[] is required"}` |
| 6 | Item missing productId | `{"items":[{"quantity":1}]}` | 400 | `{"success":false,"error":"each item must have productId..."}` |
| 7 | Item missing quantity | `{"items":[{"productId":"p-mesa"}]}` | 400 | `{"success":false,"error":"each item must have productId..."}` |
| 8 | Item negative quantity | `{"items":[{"productId":"p-mesa","quantity":-1}]}` | 400 | `{"success":false,"error":"each item must have productId..."}` |
| 9 | Item NaN quantity | `{"items":[{"productId":"p-mesa","quantity":"two"}]}` | 400 | `{"success":false,"error":"each item must have productId..."}` |
| 10 | Item empty productId | `{"items":[{"productId":"","quantity":1}]}` | 400 | `{"success":false,"error":"each item must have productId..."}` |
| 11 | Malformed JSON | `not json` | 400 | `{"success":false,"error":"invalid_json"}` |

### Side-effect verification (post-run)

The endpoint is currently STUB-SUCCESS — it validates input then returns `accepted` without touching the AbandonedCarts collection. So there is no CMS-row side-effect to verify. A follow-up bead (per the source comment) would wire items into AbandonedCarts row creation; when that lands, scenario 1 + 2 should also verify the row appears in **AbandonedCarts** with status = "pending".

The cron `triggerCartRecoveryCron` is the canonical path — it scans AbandonedCarts for rows ≥ 30 minutes old and dispatches recovery emails. Verification of the cron is OUT OF SCOPE for cf-v4py.

---

## Endpoint 3: `POST /_functions/triggerTransactionalEmail` — **MISSING**

**Status:** No HTTP wrapper for transactional email dispatch exists in `src/backend/http-functions.js` as of commit baseline. Searched for `triggerTransactional`, `transactional`, `post_trigger`, `post_send`. None match.

### Possible interpretations of the bead's intent

1. **Endpoint planned but not built** — cf-uwfw shipped queueWelcomeEmail + queueCartRecovery; the transactional case was deferred. Need a new bead to build it.
2. **Endpoint renamed during cf-uwfw** — possible candidates: `post_sendShippingNotification`, `post_sendOrderConfirmation`. Both also absent.
3. **Bead spec drift** — the bead description was written before cf-uwfw landed and the endpoint set was finalized; the spec wasn't updated.

### Recommended PM action

File a new bead (`cf-v4py.fu1`?) deciding whether to:
- **Build** `post_triggerTransactionalEmail` accepting `{templateId, recipientContactId, variables}` and dispatching via the email-queue pipeline.
- **Amend** cf-v4py acceptance to drop the transactional row from the test matrix.

Either decision unblocks the cf-v4py run-results section below.

---

## Run-results template (post-staging-unblock)

Once Stilgar publishes backend to staging + provides member token, blaidd (or rennala) fills this section in:

### queueWelcomeEmail

| # | Scenario | Status | Response | Inbox-check | Pass/Fail |
|---|----------|--------|----------|-------------|-----------|
| 1 | Happy path (Shape A) | _ | _ | _ | _ |
| 2 | Happy path (Shape B) | _ | _ | _ | _ |
| 3 | Missing email | _ | _ | N/A | _ |
| 4 | Empty email | _ | _ | N/A | _ |
| 5 | Whitespace-only email | _ | _ | N/A | _ |
| 6 | Malformed JSON | _ | _ | N/A | _ |
| 7 | Optional firstName omitted | _ | _ | _ | _ |
| 8 | CORS preflight | _ | _ | N/A | _ |

### queueCartRecovery

| # | Scenario | Status | Response | Pass/Fail |
|---|----------|--------|----------|-----------|
| 1 | Happy path single item | _ | _ | _ |
| 2 | Happy path multi item | _ | _ | _ |
| 3 | callVelo shape | _ | _ | _ |
| 4 | Missing items | _ | _ | _ |
| 5 | Empty items array | _ | _ | _ |
| 6 | Item missing productId | _ | _ | _ |
| 7 | Item missing quantity | _ | _ | _ |
| 8 | Item negative quantity | _ | _ | _ |
| 9 | Item NaN quantity | _ | _ | _ |
| 10 | Item empty productId | _ | _ | _ |
| 11 | Malformed JSON | _ | _ | _ |

### triggerTransactionalEmail

Blocked — endpoint missing. Resolution decision needed from PM (see above).

---

## Curl scaffolds (for the operator running the specs)

Replace `<STAGING_HOST>` with the actual staging URL once published:

```bash
# Endpoint 1, scenario 1
curl -i -X POST 'https://<STAGING_HOST>/_functions/queueWelcomeEmail' \
  -H 'Content-Type: application/json' \
  -d '{"args":[{"email":"halworker85+welcome@gmail.com","firstName":"Hal"}]}'

# Endpoint 1, scenario 6 (malformed JSON)
curl -i -X POST 'https://<STAGING_HOST>/_functions/queueWelcomeEmail' \
  -H 'Content-Type: application/json' \
  --data-raw 'not json'

# Endpoint 2, scenario 1
curl -i -X POST 'https://<STAGING_HOST>/_functions/queueCartRecovery' \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"p-mesa","quantity":1}]}'

# Endpoint 2, scenario 8 (negative quantity)
curl -i -X POST 'https://<STAGING_HOST>/_functions/queueCartRecovery' \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"productId":"p-mesa","quantity":-1}]}'
```

For Wix's CORS preflight verification:

```bash
curl -i -X OPTIONS 'https://<STAGING_HOST>/_functions/queueWelcomeEmail' \
  -H 'Origin: https://carolina-futons-web.vercel.app' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type'
```

---

## Acceptance check-back

This doc is the cf-v4py static deliverable per the bead's NOTES fallback clause. When staging access is restored:

1. Operator fills the run-results tables above (curl scaffolds provided).
2. Any FAIL row gets a follow-on bead with diagnosis + fix scope.
3. PM resolves the missing-endpoint question (build vs amend).
4. cf-v4py closes when all scenarios are filled AND the missing endpoint is resolved.
