# DNS Rollback Runbook — carolinafutons.com

**Bead:** cf-3qt.8.4  
**Owner:** Stilgar (site owner executes DNS steps; melania coordinates)  
**Last updated:** 2026-05-04

---

## 1. Rollback Triggers

Execute this runbook immediately if **any** of the following are true:

| Trigger | Threshold | How to check |
|---|---|---|
| HTTP 5xx error rate | > 5% over a 5-min window | Vercel Analytics → Errors, or Sentry dashboard |
| Checkout broken | Any `initCheckout` or Wix redirect failure | Visit `/cart` → click "Proceed to Checkout" |
| Payment page unreachable | Wix-hosted payment page returns error | Watch checkout redirect destination |
| Site completely down | `carolinafutons.com` returns no response | `curl -I https://www.carolinafutons.com` |
| Critical data missing | Products, prices, or images not loading | Check `/shop/futon-frames` renders products |

**Do not wait.** If a trigger fires, start the rollback. Every minute of downtime costs sales and SEO trust. The target is full revert within 15 minutes of the decision.

---

## 2. Revert DNS to Wix — Target: under 15 minutes

### Pre-requisite (do this BEFORE the DNS cutover, not during rollback)

Lower the TTL on all `carolinafutons.com` DNS records to **60 seconds** at least 24 hours before the cutover. This is what makes a 15-minute rollback possible. If TTL was not lowered, rollback propagation may take up to 48 hours — contact your registrar immediately for an emergency TTL reduction.

### Step-by-step rollback

**Step 1 — Log into your domain registrar** (estimated: 2 min)

Go to your domain registrar's DNS management page. Carolina Futons' domain (`carolinafutons.com`) is managed at the registrar where it was purchased (check the Wix Dashboard → Settings → Domains to confirm the registrar name).

**Step 2 — Record current Vercel DNS values** (1 min)

Before changing anything, screenshot or write down the current A/CNAME records pointing to Vercel. You will need these if you decide to re-cutover later.

**Step 3 — Restore Wix DNS records** (5 min)

Replace the Vercel records with the original Wix records:

| Record | Type | Value |
|---|---|---|
| `carolinafutons.com` | A | `23.236.62.147` *(standard Wix A record — confirm in Wix Dashboard → Settings → Domains → DNS Records before cutover)* |
| `www` | CNAME | `www.carolinafutons.com.cdn.wix.com` *(confirm in Wix before cutover)* |

> **IMPORTANT:** Record the exact Wix DNS values from Wix Dashboard → Settings → Domains → DNS Records **before** the cutover and paste them below. Update this section when you do the cutover.

```
# Verified via dig on 2026-05-04 — cross-check in Wix Dashboard before cutover
# Wix uses multiple A records (anycast). Restore ALL THREE:
carolinafutons.com  A      185.230.63.107
carolinafutons.com  A      185.230.63.171
carolinafutons.com  A      185.230.63.186
www                 CNAME  cdn1.wixdns.net.
```

**Step 4 — Save and verify** (2 min)

Save the DNS changes. Then poll until propagation is confirmed:

```bash
# Run every 60s until you see the Wix IP
watch -n 60 "dig +short A carolinafutons.com"

# Or without watch:
dig +short A carolinafutons.com
nslookup www.carolinafutons.com
```

**Step 5 — Smoke-test the Wix site** (3 min)

Once DNS resolves to Wix:

```
https://www.carolinafutons.com/               → Home loads
https://www.carolinafutons.com/shop/futon-frames → Products visible
https://www.carolinafutons.com/cart           → Cart accessible
Checkout → Payment page loads                 → End-to-end works
```

**Step 6 — Confirm rollback complete** (1 min)

Verify these before declaring success:

- [ ] `carolinafutons.com` resolves to Wix IP
- [ ] HTTPS cert valid (no browser warning)
- [ ] Home page loads with products
- [ ] A test add-to-cart + checkout redirect succeeds

**Total target: ≤ 15 minutes from decision to Wix serving traffic.**

---

## 3. Post-Rollback Checklist

Complete within 30 minutes of rollback:

### Immediate (within 5 min of rollback)

- [ ] Confirm Wix admin panel shows site as "Published" and "Connected" to domain
- [ ] Check Wix Store → Orders — no lost orders from the outage window
- [ ] Verify Wix Analytics shows live traffic resuming

### Within 30 min

- [ ] Reset Vercel A/CNAME records back to Wix values in registrar (done in Step 3 above)
- [ ] Put Vercel preview deployment on hold — disable any auto-promote-to-production rules
- [ ] Check Wix blog and CMS — confirm posts and collections are intact
- [ ] Review Sentry for any errors that may have leaked customer data or caused silent failures during the outage window
- [ ] Document the outage: start time, end time, root cause (see §5 below)

### Before re-attempting cutover

- [ ] Root cause identified and documented
- [ ] Root cause fixed and verified on Vercel staging (`carolina-futons-web.vercel.app`)
- [ ] All smoke tests pass on staging
- [ ] Stilgar confirms re-attempt window
- [ ] TTL is again set to 60s and left for 24h

---

## 4. Who to Notify

| When | Who | How | What to say |
|---|---|---|---|
| Decision to rollback made | **Stilgar** (site owner) | Phone/text | "We're reverting carolinafutons.com to Wix. Site may be briefly unavailable. Expected recovery: 15 min." |
| Rollback complete | **Stilgar** | Phone/text | "carolinafutons.com is back on Wix. Site is live. We'll schedule a re-attempt after fixing [root cause]." |
| Decision to rollback made | **Melania** (PM) | `gt nudge` | "Rollback triggered — [trigger name]. Executing DNS revert now." |
| Rollback complete | **Melania** | `gt nudge` | "Rollback complete at [time]. Wix serving traffic. Root cause: [brief]." |
| If checkout was broken > 10 min | **Stilgar** | Phone | Offer to manually process any orders that may have failed during the window |
| If data loss suspected | **Stilgar** + Wix Support | Wix live chat | Initiate Wix support ticket immediately — Wix retains backups |

### Wix Support

- **Wix Support:** [support.wix.com](https://support.wix.com) → Live Chat
- **Wix Site ID:** `461379f5-91e2-43c5-8ca6-3f13767cd57a` *(have this ready)*

---

## 5. Incident Report Template

Fill out immediately after rollback while details are fresh:

```
## Rollback Incident — [DATE]

Cutover attempted: [TIME]
Rollback decision: [TIME]
Rollback complete: [TIME]
Total outage duration: [N] min

Trigger(s):
- [ ] >5% error rate — peak error rate: ____%
- [ ] Checkout broken — symptom: ____
- [ ] Site down
- [ ] Other: ____

Root cause:
[Describe what failed and why]

Orders affected:
[List any order IDs from the outage window; check Wix Orders and Vercel logs]

Fix required before re-attempt:
[Specific code change / config fix / env var needed]

Re-attempt ETA:
[Date/time window agreed with Stilgar]
```

---

## Pre-Cutover Prep Checklist (fill out before cf-3qt.8 cutover)

Do this in the days before the DNS flip. This makes the runbook executable on short notice.

- [x] Current Wix A records verified via dig 2026-05-04: `185.230.63.107`, `185.230.63.171`, `185.230.63.186`
- [x] Current Wix CNAME target verified via dig 2026-05-04: `cdn1.wixdns.net.`
- [ ] Cross-check above values in Wix Dashboard → Settings → Domains → DNS Records before cutover (confirm not changed)
- [ ] TTL lowered to 60s on all records — date done: `___________________`
- [ ] Registrar login confirmed and credentials accessible to Stilgar — registrar: check Wix Dashboard → Settings → Domains
- [ ] Sentry DSN wired in Vercel production env (`SENTRY_DSN`)
- [ ] Error-rate alerting enabled in Vercel Analytics (alert at 5% 5xx)
- [ ] Stilgar's phone number confirmed with melania
