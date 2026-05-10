# Secrets Manager audit — every getSecret() call site — 2026-05-10

**Bead:** cf-7pd6
**Auditor:** rennala
**Method:** Static enumeration of every `getSecret('NAME')` call across `src/backend/`. Mapped per-secret call sites + fail-mode (try/catch present, fail-open vs fail-closed, propagated vs swallowed). Cross-referenced against cutover-night requirements at cf-3qt.8.
**Pre-cutover scope:** any secret a real call path depends on must exist in the staging Secrets Manager BEFORE DNS flip, or the dependent flow fails the moment customers hit it.

## TL;DR

**46 distinct secret names, 78 call sites.** Inventory split into:
- **27 required** secrets — flow either hard-fails or denies on missing (cron auth, payments, shipping, SMS, transactional CRM contact)
- **19 optional** — fail-soft, feature-gated, or override-with-default

**One P2 finding:** `SITE_OWNER_CONTACT_ID` has 4 hard-fail call sites with no try/catch wrapper — if absent at cutover, the contact form + swatch request + 2 emailService notify paths return 500. Other findings are P3 informational.

## Inventory

### Required at cutover (27)

Group by domain. Each row: secret · # call sites · representative file:line · fail-mode · cutover impact if missing.

#### Cron auth (3 distinct namespaces)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `ALERT_CRON_KEY` | 14 | `http-functions.js:677` | 403 forbidden (fail-closed) | All 14 alert/email crons return 401 to scheduler → silent stop |
| `CONTENT_CRON_KEY` | 2 | `http-functions.js:1040`, `contentScheduler.web.js:35` | 403 forbidden | Content publish cron silently halts |
| `CRON_SECRET` | 2 | `visualSearchExport.web.js:135`, `comfortTimeline.web.js:316` | 403 forbidden | Visual-search export + comfort-timeline crons halt |

These three namespaces overlap conceptually. **F3 below.**

#### Auth tokens (3)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `UNSUB_TOKEN_SECRET` | 3 | `http-functions.js:143`, `:3106`, `emailAutomation.web.js:1555` | 500 (try/catch) on get / hard-fail in token verification | **Legal-compliance blocker** — unsubscribe links in transactional emails return 500 |
| `WIX_WEBHOOK_SECRET` | 1 | `events.js:33` | hard-fail propagated | cfw → Wix webhook signature check fails |
| `KLAVIYO_WEBHOOK_SECRET` | 1 | `http-functions.js:1247` | 401 forbidden | Klaviyo webhook ingestion blocked |

#### Email/CRM (3)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `SITE_OWNER_CONTACT_ID` | 4 | `emailService.web.js:148`/`:290`/`:439`, `notificationService.web.js:353` | **NO try/catch — propagates** | Contact form / swatch / 2 owner notifications hard-fail. **F1 below** |
| `ESP_API_KEY` | 1 | `newsletterService.web.js:105` | try/catch swallow | Newsletter signup silently no-ops if missing (and it's marked "fail-soft" but ESP push is the canonical newsletter flow — if missing, signup looks successful but no double-opt-in) |
| `VERCEL_REVALIDATE_URL` | 1 | `events.js:32` | try/catch propagates with retry | cfw ISR-revalidate-on-product-update silently degrades — stale product pages |

#### Payments / financing (5)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `KLARNA_API_USERNAME` | 1 | `klarna-http.js:149` | hard-fail (Promise.all) | Klarna PDP widget + checkout: 500 on every request |
| `KLARNA_API_PASSWORD` | 1 | `klarna-http.js:150` | hard-fail | Same |
| `STAMPED_API_KEY` | 1 | `stampedIoService.web.js:36` | hard-fail | Reviews fetch fails, PDP review widget renders empty |
| `STAMPED_API_SECRET` | 1 | `stampedIoService.web.js:37` | hard-fail | Same |
| `STAMPED_STORE_HASH` | 1 | `stampedIoService.web.js:38` | hard-fail | Same |

#### Shipping / freight (8)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `UPS_CLIENT_ID` | 1 | `ups-shipping.web.js:92` | hard-fail | Shipping rate lookup at checkout: 500 |
| `UPS_CLIENT_SECRET` | 1 | `ups-shipping.web.js:93` | hard-fail | Same |
| `UPS_ACCOUNT_NUMBER` | 2 | `ups-shipping.web.js:197`/`:350` | hard-fail | Rates lookup + label create fail |
| `WWEX_USERNAME` | 1 | `wwex-freight.web.js:116` | hard-fail | LTL freight quotes fail (large-item shipping) |
| `WWEX_PASSWORD` | 1 | `wwex-freight.web.js:117` | hard-fail | Same |
| `WWEX_ACCOUNT_NUMBER` | 1 | `wwex-freight.web.js:118` | hard-fail | Same |
| `TWILIO_ACCOUNT_SID` | 2 | `deliveryNotifications.web.js:47`, `smsService.web.js:51` | hard-fail in outer try | Delivery-day SMS silently no-op (caught) |
| `TWILIO_AUTH_TOKEN` | 2 | `deliveryNotifications.web.js:48`, `smsService.web.js:52` | hard-fail | Same |

`TWILIO_PHONE_NUMBER` (2 sites) is in the same group — same fail-mode.

#### AI / LLM (1)
| Secret | Sites | Anchor | Fail | Impact |
|--------|-------|--------|------|--------|
| `ANTHROPIC_API_KEY` | 3 | `styleConsultant.web.js:278`, `chatbotService.web.js:154`, `gamificationChatbot.web.js:211` | hard-fail (commented "config failure, not AI failure") | All 3 AI features 500 on missing |

### Optional / feature-gated (19)

| Secret | Sites | Default if missing | Note |
|--------|-------|-------------------|------|
| `WELCOME_DISCOUNT_CODE` | 2 | `discountAvailable=false` (try/catch) | Welcome series sends without discount block |
| `RECOVERY_DISCOUNT_CODE` | 1 | (similar fail-soft) | Cart recovery sends without discount |
| `REVIEW_DISCOUNT_CODE` | 1 | (similar) | Review request sends without incentive |
| `UPS_SANDBOX` | 2 | `false` (production) | If unset, UPS calls hit prod — usually correct |
| `KLARNA_API_BASE_URL` | 1 | `https://api.klarna.com` | Override only |
| `ESP_LIST_ID` | 1 | `null` (graceful) | Optional — newsletter still posts to ESP |
| `CHATBOT_ENABLED` | 1 | `false` (gate) | Chatbot disabled; shows fallback UI |
| `GAMIFICATION_CHATBOT_ENABLED` | 2 | `false` | Gamification chatbot disabled |
| `META_PAGE_ID` | 1 | feature-off | Social story posts skipped |
| `META_PAGE_ACCESS_TOKEN` | 2 | feature-off | Same |
| `FB_AUDIENCE_SECRET` | 1 | 401 forbidden (graceful) | FB audience webhook denied; webhook unused if FB integration off |
| `EXCHANGE_RATE_API_KEY` | 1 | feature-off | Multi-currency display falls back to USD |
| `GOOGLE_VISION_API_KEY` | 1 | feature-off | Visual search disabled |
| `AI_IMAGE_API_URL` | 1 | feature-off | Room-staging tool disabled |
| `AI_IMAGE_API_KEY` | 1 | feature-off | Same |
| `MOBILE_BUS_URL` | 1 | feature-off | Mobile event bus dispatch silently skipped |
| `BUS_SECRET` | 1 | feature-off | Same |
| `MOBILE_PUSH_ENDPOINT` | 1 | feature-off | Push notifications skipped |
| `MOBILE_PUSH_SECRET` | 1 | feature-off | Same |

`QA_ADMIN_KEY` (1 site) and `STAMPED_WEBHOOK_SECRET` (1 site) are admin/test-only — required only if those paths are exercised at cutover.

`CONTENT_EVENT_KEY` (3 sites) — internal event-bus auth; required only if cfutons↔cms content event flow is active at cutover.

## Findings

### F1 (P2) — `SITE_OWNER_CONTACT_ID` has 4 hard-fail call sites with no try/catch
**Where:**
- `src/backend/emailService.web.js:148` — contact form submission notification to owner
- `src/backend/emailService.web.js:290` — secondary owner notification
- `src/backend/emailService.web.js:439` — third owner notification path
- `src/backend/notificationService.web.js:353` — generic owner-notify helper

**Behavior:** `await getSecret('SITE_OWNER_CONTACT_ID')` is called bare. If the secret isn't set, Wix Secrets Manager rejects → exception propagates → `triggeredEmails.emailContact(template, undefined, …)` is never reached — outer try/catch in each parent function logs "Failed to send notification" and returns the parent's failure path. Customer-facing impact:
- Contact form: **submission appears to succeed** (the user sees the auto-reply branch fail-soft per cf-hafn) but the OWNER never gets the inbound message → silent customer-service blackout.
- Swatch request: same shape.

**Fix:** wrap each site in a try/catch and log a `[secrets] SITE_OWNER_CONTACT_ID missing — owner notification skipped` warning. Make the missing-secret case explicit, not silently swallowed inside a generic "Failed to send notification" message that doesn't surface the root cause to whoever triages staging logs at cutover.

**Why P2 not P1:** customer-facing path (contact form) returns 200 + the auto-reply still goes out, so customers don't see the failure. But Stilgar would. **Belongs in the cutover-night runbook checklist** alongside the populated secret value.

### F2 (P2) — Cutover-night required-secret list has no canonical owner doc
**Observation:** `docs/cf-3qt.8/` (per `git ls-files docs/cf-3qt.8` from prior cf-jvut/cf-w1u1 work) does not contain a populated `secrets-required.md` or equivalent. The 27 required secrets above are scattered across whoever-knew-which.

**Fix:** the **Required at cutover** table above is the source-of-truth checklist. Recommend Stilgar copy-paste it into `docs/cf-3qt.8/cutover-checklist.md` (or wherever the runbook lives) so Phase-8 has a tick-box per secret.

### F3 (P3) — Three overlapping cron-secret namespaces
**Where:** `ALERT_CRON_KEY` (14 sites) + `CONTENT_CRON_KEY` (2 sites) + `CRON_SECRET` (2 sites). Three secrets, all serving the same purpose: "is this caller an authorized scheduler?"

**Recommended:** consolidate to one `CRON_SECRET` for cron auth + keep namespacing in the X-Cron-Secret value if scope-isolation is needed (e.g., different rotated values in the same Secrets Manager slot is awkward — cleaner to have one secret + per-endpoint allowlist if multi-tenant scheduler). For pre-cutover, the lower-friction action is: document why three exist + populate all three. Don't refactor under cutover pressure.

**Why P3:** all three fail-closed correctly. No security risk, only operational drift.

### F4 (P3 informational) — No PII / credential leak risk in error logs
**What I checked:** every `console.error('[…]', e)` site adjacent to a `getSecret()` call. Wix Secrets Manager rejects with errors that **do not** include the secret value — error messages reference the secret *name* only. No leak risk in current code.

**What to keep an eye on:** if anyone refactors a `console.error('[X] secret retrieval failed:', secretValue)` pattern in (looking at you, future shortcut-takers), that becomes a leak. No grep result on `console.*${secret`-style template strings — clean as of audit date.

### F5 (P3 informational) — `ANTHROPIC_API_KEY` loaded inline in 3 different files
**Where:** `chatbotService.web.js:154`, `styleConsultant.web.js:278`, `gamificationChatbot.web.js:211`.

**Observation:** could be centralized in a small helper (`getAnthropicClient()`). Not a defect — just a tiny invariant for if the auth pattern ever changes (e.g., switching to a different Anthropic auth header). Not a cutover blocker.

## Pre-cutover acceptance (cf-3qt.8)

Before DNS flip:
- [ ] Every secret in the **Required at cutover** table (27 entries) exists in the staging Secrets Manager with a populated value.
- [ ] `SITE_OWNER_CONTACT_ID` specifically verified — there is no hard-fail-on-missing protection in code (F1), so its absence at cutover causes a silent customer-service blackout.
- [ ] Cron-secret values (ALERT/CONTENT/CRON) match what Wix Automations / external scheduler is configured to send (cross-reference cf-ox0h cron audit).
- [ ] `WIX_WEBHOOK_SECRET` matches what cfw `WIX_WEBHOOK_SECRET` env var sends to `events.js:33`.
- [ ] `VERCEL_REVALIDATE_URL` points at the production cfw deployment URL (otherwise stale ISR pages indefinitely).

Optional secrets are tickable per feature decision (e.g., is the chatbot launching at cutover? then CHATBOT_ENABLED=true + ANTHROPIC_API_KEY is required).

## Out of scope (file separately if needed)

- **Secret rotation cadence** — no audit of last-rotated dates per secret. If Stilgar wants a rotation runbook, separate bead.
- **Wix Secrets Manager UI inventory** — Stilgar-only. This audit is code-side only; the Secrets Manager dashboard itself isn't grep-able from a worker session.
- **cfw env var audit** — cfw uses `process.env.X` not `getSecret`. Out of scope here; would be a sibling bead pointed at `carolina-futons-web/`.
- **Per-secret blast radius if leaked** — useful for incident response runbook, separate bead.

## References

- Wix Velo `wix-secrets-backend` docs: https://dev.wix.com/docs/velo/api-reference/wix-secrets-backend
- cf-3qt.8 (DNS cutover, in_progress) — this audit feeds the Phase-8 readiness checklist
- Companion audits: cf-icww (email touchpoints), cf-jqkg (cfw→Velo HTTP gaps), cf-mgnh (lying-status taxonomy), cf-3pwy (V1↔V3 stores), cf-ox0h (cron schedule)
