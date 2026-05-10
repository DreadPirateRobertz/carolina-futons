# cf-3qt.8 — Cutover-night secrets checklist

**Bead:** cf-secrets.F2 follow-up
**Source audit:** `docs/audits/secrets-audit-2026-05-10.md` (rennala, cf-7pd6)
**Audience:** Stilgar (executor), mayor (sign-off), godfrey/melania (review)

> **Use this doc as a tick-box gate.** Every required secret below must be populated in the staging Wix Secrets Manager BEFORE the DNS flip. If any row is empty when cutover fires, the dependent flow fails the moment a customer hits it — and most fail in ways that won't show up in your monitoring (silent stops, fail-soft swallows, 500s buried in catch blocks). Do not flip DNS with unchecked rows.

## Pre-flight (run T-2h)

- [ ] **Open the Wix Dashboard → Secrets Manager** for the production site.
- [ ] **Have the rennala secrets-audit doc pinned in a tab** for cross-reference if anything is unclear: `docs/audits/secrets-audit-2026-05-10.md`.
- [ ] **Confirm escalation path** — if a secret value is missing or unknown, who owns it? Most are external API credentials (Klarna/UPS/WWEX/Stamped/Twilio/Anthropic) that may need a Stilgar phone call to the vendor portal.
- [ ] **PR #1304** (cf-secrets.F1) is merged — explicit warn now logs the offending call site if `SITE_OWNER_CONTACT_ID` is missing. Tail Wix Site Monitoring during the smoke window.

## Required secrets (27) — every row must be ticked

### Cron auth (3 distinct namespaces, F3 documented drift)

- [ ] `ALERT_CRON_KEY` — 14 call sites. **Impact if missing:** all 14 alert/email crons return 401 to scheduler → silent stop (no customer-facing signal until reports go dark).
- [ ] `CONTENT_CRON_KEY` — 2 call sites. **Impact:** content publish cron silently halts.
- [ ] `CRON_SECRET` — 2 call sites. **Impact:** visual-search export + comfort-timeline crons halt.

### Auth tokens (3)

- [ ] `UNSUB_TOKEN_SECRET` — 3 call sites. **Impact:** unsubscribe links in transactional emails return 500. **Legal-compliance blocker — CAN-SPAM violation if customers can't unsubscribe.**
- [ ] `WIX_WEBHOOK_SECRET` — 1 call site. **Impact:** cfw → Wix webhook signature check fails (revalidation loop broken).
- [ ] `KLAVIYO_WEBHOOK_SECRET` — 1 call site. **Impact:** Klaviyo webhook ingestion blocked.

### Email / CRM (3)

- [ ] `SITE_OWNER_CONTACT_ID` — 4 call sites. **Impact:** contact form / swatch request / 2 owner notifications fail. **PR #1304 (cf-secrets.F1)** now logs an explicit warn naming the call site if this is missing — tail Wix Site Monitoring for `[emailService] SITE_OWNER_CONTACT_ID missing — owner notification skipped`.
- [ ] `ESP_API_KEY` — 1 call site. **Impact:** newsletter signups silently no-op (looks successful to customer, no double-opt-in fired).
- [ ] `VERCEL_REVALIDATE_URL` — 1 call site. **Impact:** cfw ISR-revalidate-on-product-update silently degrades; product pages serve stale data.

### Payments / financing / reviews (5)

- [ ] `KLARNA_API_USERNAME` — 1 call site. **Impact:** Klarna PDP widget + checkout return 500 on every request (visible to customers).
- [ ] `KLARNA_API_PASSWORD` — 1 call site. Same impact as above.
- [ ] `STAMPED_API_KEY` — 1 call site. **Impact:** PDP review widget renders empty; reviews fetch fails.
- [ ] `STAMPED_API_SECRET` — 1 call site. Same.
- [ ] `STAMPED_STORE_HASH` — 1 call site. Same.

### Shipping / freight (8)

- [ ] `UPS_CLIENT_ID` — 1 call site. **Impact:** shipping rate lookup at checkout: 500. **Customer-blocking.**
- [ ] `UPS_CLIENT_SECRET` — 1 call site. Same.
- [ ] `UPS_ACCOUNT_NUMBER` — 2 call sites. **Impact:** rates lookup + label create both fail.
- [ ] `WWEX_USERNAME` — 1 call site. **Impact:** LTL freight quotes fail (large-item shipping; affects bed/frame orders).
- [ ] `WWEX_PASSWORD` — 1 call site. Same.
- [ ] `WWEX_ACCOUNT_NUMBER` — 1 call site. Same.
- [ ] `TWILIO_ACCOUNT_SID` — 2 call sites. **Impact:** delivery-day SMS silently no-op (caught in outer try).
- [ ] `TWILIO_AUTH_TOKEN` — 2 call sites. Same.

`TWILIO_PHONE_NUMBER` (2 sites) — same group, same fail-mode:

- [ ] `TWILIO_PHONE_NUMBER`

### AI / LLM (1)

- [ ] `ANTHROPIC_API_KEY` — 3 call sites. **Impact:** all 3 AI features (`styleConsultant`, `chatbotService`, `gamificationChatbot`) return 500 on missing — comments at each site explicitly call out "config failure, not AI failure".

---

## Optional / feature-gated (19) — reviewed but not blockers

These don't break flows when missing; they fall back gracefully or feature-gate off. Ticked = confirmed acceptable as-is for cutover.

- [ ] `WELCOME_DISCOUNT_CODE` — welcome emails send without discount block (try/catch swallow).
- [ ] `RECOVERY_DISCOUNT_CODE` — cart recovery sends without discount.
- [ ] `REVIEW_DISCOUNT_CODE` — review request sends without incentive.
- [ ] `UPS_SANDBOX` — defaults to `false` (production); only override if intentionally hitting sandbox.
- [ ] `KLARNA_API_BASE_URL` — override only; production default is `https://api.klarna.com`.
- [ ] `ESP_LIST_ID` — newsletter still posts to ESP if missing.
- [ ] `CHATBOT_ENABLED` — defaults `false`; chatbot UI shows fallback.
- [ ] `GAMIFICATION_CHATBOT_ENABLED` — defaults `false`.
- [ ] `META_PAGE_ID` — feature-off; social story posts skipped.
- [ ] `META_PAGE_ACCESS_TOKEN` — same.
- [ ] `FB_AUDIENCE_SECRET` — graceful 401 if missing; FB audience webhook denied.
- [ ] `EXCHANGE_RATE_API_KEY` — multi-currency falls back to USD.
- [ ] `GOOGLE_VISION_API_KEY` — visual search disabled if missing.
- [ ] `AI_IMAGE_API_URL` — room-staging tool disabled.
- [ ] `AI_IMAGE_API_KEY` — same.
- [ ] `MOBILE_BUS_URL` — mobile event bus dispatch silently skipped.
- [ ] `BUS_SECRET` — same.
- [ ] `MOBILE_PUSH_ENDPOINT` — push notifications skipped.
- [ ] `MOBILE_PUSH_SECRET` — same.

Admin / test-only (require only if those paths are exercised at cutover):

- [ ] `QA_ADMIN_KEY`
- [ ] `STAMPED_WEBHOOK_SECRET`
- [ ] `CONTENT_EVENT_KEY` (3 sites — required only if cfutons↔cms content-event flow is active)

---

## Smoke verification (run T-30m)

After all 27 required boxes are ticked, run a quick smoke to confirm the secrets actually resolve (i.e., not just present but populated with valid values):

```bash
# Cron auth — should return 200 (not 401/403) when key matches
curl -H "X-Cron-Secret: $ALERT_CRON_KEY" \
     https://www.carolinafutons.com/_functions/verifyRateLimitCollections | jq .status
# Expected: "ok"

# Health probe (cf-x6ph) — sanity check Vercel runtime
curl https://www.carolinafutons.com/api/health | jq .status
# Expected: "ok"

# Klarna / UPS / Stamped / Twilio — exercise via PDP load + checkout flow
# (manual smoke — covered by docs/cf-3qt.8/e2e-checkout-smoke-2026-05-10.md)
```

Tail Wix Site Monitoring for the `[secrets]` / `[emailService]` warn patterns from PR #1304 during the smoke window. Any explicit "missing" warn = a secret didn't propagate; halt cutover and remediate.

---

## Post-cutover spot-check (T+5m)

Within 5 minutes of DNS flip, customers will hit:

- [ ] **Contact form** — submit a test message. Confirm owner inbox received + customer auto-reply landed (verifies `SITE_OWNER_CONTACT_ID`).
- [ ] **PDP load** — verify Klarna pricing widget renders (verifies `KLARNA_*`) + reviews carousel populates (verifies `STAMPED_*`).
- [ ] **Checkout flow** — start a checkout for a freight-eligible item. Confirm UPS + WWEX rates resolve (verifies `UPS_*` + `WWEX_*`).
- [ ] **Newsletter signup** — confirm signup → ESP double-opt-in email arrives (verifies `ESP_API_KEY`).
- [ ] **Cron heartbeat** — wait for the next 15-min cron tick, check Wix Site Monitoring for `processEmailQueue` execution log (verifies `ALERT_CRON_KEY` chain).
- [ ] **Unsubscribe link** — open a recent transactional email, click unsubscribe; confirm 200 response (verifies `UNSUB_TOKEN_SECRET`).

If any of these silently fails or returns 500/empty, **rollback DNS immediately** and remediate the missing/wrong secret before re-flipping.

---

## Out of scope (post-cutover hardening)

The audit identified follow-ups deliberately deferred from this checklist:

- **F3:** three overlapping cron-secret namespaces (`ALERT_CRON_KEY` / `CONTENT_CRON_KEY` / `CRON_SECRET`) — consolidate post-cutover.
- **F5:** `ANTHROPIC_API_KEY` loaded inline in 3 different files — centralize via `getAnthropicClient()` helper post-cutover.

---

## Linked beads + audits

- **Source audit:** `docs/audits/secrets-audit-2026-05-10.md` §"Required at cutover" + §F1-F5
- **Parent:** cf-3qt.8 (DNS cutover gate)
- **Sibling:** cf-secrets.F1 / **PR #1304** — explicit warn for missing `SITE_OWNER_CONTACT_ID`
- **Sibling:** cf-x6ph / cf-x0ks / **PR #554** — `/api/health` endpoint for the smoke step
- **Sibling:** cf-3ldu.F2 / **PR #1297** (merged) — rate-limit fail-closed change tightens the cron-secret blast radius
- **Sibling:** cf-ox0h.fu1 / **PR #1308** — cron canonical-source decision (related to `ALERT_CRON_KEY` consumers)
- **30-day window:** cf-3qt.9 retirement checklist
