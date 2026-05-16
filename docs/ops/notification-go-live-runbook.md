# Notification System Go-Live Runbook

**Bead:** cf-ui9w (cf-roadmap.4 — notification system go-live)
**Author:** millicent (cfutons/crew, CI/devops + observability lane)
**Scope of this PR:** doc-only mitigation slice. Pre-writes the runbook + smoke matrix so the actual go-live (when Stilgar provides Twilio creds + staging Velo publish) takes < 1 day. Per the parent bead's own "Risk + mitigation" section.

The execution slices stay with their natural owners:

- **Twilio go-live** → morgott (SMS backend)
- **Email queue E2E validation** → rennala (cf-w1u1 owner) + godfrey (Velo wiring)
- **Post-purchase comfort sequence wire-up** → morgott (per cf-4x7e.B5 createTimeline ownership)

## Pre-go-live checklist (Stilgar gates)

These all block until Stilgar acts:

| Item | Owner | Verify |
|---|---|---|
| `TWILIO_ACCOUNT_SID` in Wix Secrets Manager | Stilgar | Velo `getSecret('TWILIO_ACCOUNT_SID')` returns non-empty in staging |
| `TWILIO_AUTH_TOKEN` in Wix Secrets Manager | Stilgar | (same; only the credential read path, not the value, is verified in runbook) |
| `TWILIO_PHONE_NUMBER` in Wix Secrets Manager (E.164 format) | Stilgar | matches `^\+1\d{10}$` for US toll-free / long-code; document the exact number for opt-out routing |
| Staging Velo backend published | Stilgar | `https://chrisdealglass.wixstudio.com/my-site/_functions/contactSubmissionsDiagnostic` returns 200 (not 404) |
| `SMSPreferences` CMS collection exists in staging + prod | Stilgar | per `smsService.web.js` `@setup` block, 8 fields, see source for schema |
| `SMSLog` CMS collection exists in staging + prod | Stilgar | same |
| `EmailQueue` CMS collection exists in staging + prod | Stilgar | per `emailQueueService.web.js` `EMAIL_QUEUE_COLLECTION` constant |
| Wix Triggered Emails: all templates referenced by `TEMPLATE_ID_MAP` deployed | Stilgar | cross-check the live registry against `src/backend/emailService.web.js` (NOTE: bead's reference to `templateRegistry.web.js` is stale — actual map lives in `emailService.web.js`) |

## Workstream 1 — Twilio go-live (morgott)

### Smoke-matrix table

| # | Trigger | Code path | Pre-cond | Expected | Verify |
|--:|---|---|---|---|---|
| 1 | `handleOrderFulfilled` event | `events.js:358` → `notificationOrchestrator.handleOrderFulfilled` → `smsService.sendOrderShippedSMS` | member has `smsEnabled=true`, `orderConfirmations` or `shippingUpdates` opt-in true, `phone` on record (E.164) | Twilio API returns 201 + `SMSLog` row inserted with `twilioSid` | inbox at `+1XXX…` receives "Your Carolina Futons order is on the way" |
| 2 | `sendOrderConfirmationSMS` direct | `smsService.web.js:162` | same opt-in shape | (same) | (same) |
| 3 | `sendBackInStockSMS` direct | `smsService.web.js:302` | `backInStockAlerts` opt-in true | (same) | (same) |
| 4 | **Opt-in gate REJECT path** | any of above with `smsEnabled=false` | member opted out | `{sent: false, reason: 'opt_out'}` — no Twilio API call | `SMSLog` has NO new row; Twilio dashboard shows no send |
| 5 | **Missing phone path** | any of above with no `SMSPreferences.phone` | row exists, phone blank | `{sent: false, reason: 'no_phone'}` | no Twilio call |
| 6 | **Cooldown path** | repeat #1 within cooldown window | `SMSLog` has recent send for same `messageType` | `{sent: false, reason: 'cooldown'}` | no Twilio call |
| 7 | **Twilio outage simulation** | wrap fetch in a temp throw OR use a deliberately-bad SID | secrets present | `{sent: false, reason: 'send_error'}` + `logError` fires | error visible in Wix runtime logs with context `smsService:sendOrderShippedSMS:send` |

### Quick test command (cutover-night, post-Stilgar-creds)

```sh
# From a Velo console (admin), run the smoke against a known test member
$w('#button1').click() // Or via Backend Test panel:
import { sendOrderShippedSMS } from 'backend/smsService.web';
await sendOrderShippedSMS({
  memberId: 'test-member-id',
  trackingNumber: 'TEST-1Z999AA10123456784',
  carrier: 'UPS',
});
// → expected: { sent: true, twilioSid: 'SM…' }
```

### Rollback signal

If `SMSLog` shows 3+ consecutive `send_error` rows OR Sentry error rate on `smsService:*` exceeds 5/min: **disable SMS at the orchestrator level by setting `SMS_DISABLE_KILLSWITCH=1`** (not yet implemented — file as cf-ui9w.fu1 if go-live needs a kill switch before launch). Failing that, set every member's `SMSPreferences.smsEnabled=false` via batch CMS update — slower but immediate effect.

## Workstream 2 — Email queue E2E (rennala + godfrey)

### Smoke-matrix table

| # | Trigger | Code path | Pre-cond | Expected | Verify |
|--:|---|---|---|---|---|
| 1 | `enqueueEmail` direct | `emailQueueService.web.js:117` | recipient + sequenceType + sequenceStep present | `EmailQueue` row inserted with `status='pending'` | row visible in Wix CMS |
| 2 | Dedup gate | re-call #1 with same tuple | pending or sent row exists for same (recipientEmail, sequenceType, sequenceStep) | `{enqueued: false, reason: 'dedup'}` — no new row | `EmailQueue` row count unchanged |
| 3 | Send-window gate | call #1 outside 9 AM – 8 PM ET | `scheduledFor` rolled forward to next 9 AM ET | row's `scheduledFor` is the next 9 AM ET timestamp | inspect CMS |
| 4 | `processQueue` drain | `emailQueueService.web.js:197` | ≥ 1 `pending` row past `scheduledFor` | row flips to `sent`, `sentAt` populated, Velo sendgrid/wix-crm dispatch fires | halworker85+test inbox receives template |
| 5 | Rate-limit gate | run #4 with high concurrency | `EmailQueueRateLimit` collection at max for the window | items NOT processed in this drain, queued for next | re-run #4 next cycle → items flip to `sent` |
| 6 | Rate-limit DB failure | force `EmailQueueRateLimit` query to throw | (manual: temporarily revoke read perm OR set query to nonexistent collection) | rate-limit failOpen path engages (per `emailQueueService.web.js:14`) — items still process | `EmailQueue` rows still flip to `sent`. Verify the failOpen comment-line is still true after the cf-3ldu.F2 / cf-2enk policy migration — if `checkRateLimit` was switched to `failOpenOnDbError: true` per the cf-lzkm audit, the comment is accurate; if not, file a follow-up |
| 7 | Cancel-queued path | `cancelQueuedEmails(email, sequenceType)` | ≥ 1 pending row for the tuple | rows flip to `cancelled` | inspect CMS |

### Stilgar dispatch gate

Workstream 2 is **doubly-blocked** — needs (a) staging Velo published AND (b) Wix Triggered Emails for every `TEMPLATE_ID` in the registry. melania's cf-c6g5 covers (b); coordinate via her.

### Test inbox: `halworker85+test@gmail.com`

Per rennala's PR #1220 30-row touchpoint matrix, all template sends route there during smoke. Confirm the address is added to every template's "from" allowlist before drain.

## Workstream 3 — Post-purchase comfort sequence (morgott)

### Current state

Per cf-4x7e.B5 (PR #1333): `createTimeline` was the only piece of the comfort sequence kept after the audit. Day-1 / Day-7 / Day-14 / Day-30 milestone scheduling **does not exist as a wired-up surface yet** — those milestones are referenced in `emailService.web.js` template-ID map but no scheduler actually fires them.

### Two viable architectures

**Option A — `jobs.config` cron** (Velo native):

```json
{
  "jobs": [
    {
      "functionLocation": "/comfortSequence.web.js/dispatchDay1",
      "executionConfig": { "cronExpression": "0 14 * * *" }
    }
    // … 3 more for day 7 / 14 / 30
  ]
}
```

- Pros: minimal new infra, runs in Wix env
- Cons: 4 cron entries that each query the same `Orders` collection on overlapping windows; resource-wasteful

**Option B — single dispatch on `wixEcom_onOrderPaid`** (event-driven enqueue):

```js
// events.js
export async function wixEcom_onOrderPaid(event) {
  const orderId = event.entity._id;
  // enqueue all 4 milestones at once
  await enqueueEmail({
    recipientEmail: event.entity.buyerInfo.email,
    sequenceType: 'comfort_post_purchase',
    sequenceStep: 'day_1',
    scheduledFor: Date.now() + 24 * 60 * 60 * 1000,
    // … etc
  });
  // (3 more for day 7/14/30)
}
```

- Pros: 1 query per order at order-paid time, scheduledFor is exact, dedup gate already handles re-fires
- Cons: requires `emailQueueService` to support `scheduledFor > now()` (it does — `processQueue` filters by `scheduledFor <= now()`)

**Recommendation: Option B.** Reuses the existing queue + dedup machinery, doesn't add cron-config drift. Single-decision-point: one place to add a new milestone.

### TDD shape for whichever lands

Tests pin the contract:

```js
it("comfort_post_purchase enqueues 4 milestones on order_paid", async () => {
  // mock event with buyerInfo.email
  await wixEcom_onOrderPaid(fakeOrderEvent);
  expect(_collections.EmailQueue).toHaveLength(4);
  expect(_collections.EmailQueue.map(r => r.sequenceStep))
    .toEqual(['day_1', 'day_7', 'day_14', 'day_30']);
});

it("dedup prevents double-enqueue on order_paid replay", async () => {
  await wixEcom_onOrderPaid(fakeOrderEvent);
  await wixEcom_onOrderPaid(fakeOrderEvent); // replay
  expect(_collections.EmailQueue).toHaveLength(4); // not 8
});
```

## Observability surfacing

When the dashboard cell from cf-9fqc PR #1345 lands, the `sentry` cell will surface notification errors via these log prefixes:

| Module | Sentry tag prefix |
|---|---|
| `smsService` | `smsService:<methodName>:<stage>` |
| `notificationOrchestrator` | `notificationOrchestrator:<handler>:<stage>` |
| `emailQueueService` | `emailQueueService:<methodName>:<stage>` |

Operator pulls `bash scripts/ops/dashboard.sh` post-go-live; any `error_rate_per_min ≥ 0.5` cell goes ⚠️ and is the leading signal of "the notification cutover broke something."

## Cross-references

- Parent: cf-ui9w (this bead)
- Roadmap: 2026-05-15 mail to melania (Stilgar directive)
- Observability dashboard: cf-9fqc PR #1345 (Phase 2 GREEN — surfaces this runbook's error signals)
- Email-trigger E2E matrix: rennala's PR #1220 (cf-w1u1, blocked on Velo publish)
- Source modules:
  - `src/backend/smsService.web.js`
  - `src/backend/notificationOrchestrator.web.js`
  - `src/backend/emailQueueService.web.js`
  - `src/backend/emailService.web.js` (template ID map lives here, NOT in a `templateRegistry.web.js` — the bead's reference is stale)
- Sibling fail-open audit: cf-lzkm (PR #1307) — confirm rate-limit semantics for workstream 2 row #6
- cf-c6g5 — Stilgar batch-copies Triggered Email templates (workstream 2 blocker)

## 5-agent review

Per mayor's 2026-05-15 mandate. Doc + tests only; cfutons-only; no Vercel impact. Looking for 4 more crew sign-offs.
