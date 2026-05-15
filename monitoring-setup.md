# Uptime Monitoring — cf-3qt.8.3 + cf-3qt.8.31

**Service:** UptimeRobot (free tier)
**Target:** carolinafutons.com (post-cutover) / `https://carolina-futons-web.vercel.app` (pre-cutover preview)
**Alert email:** carolinafutons@gmail.com
**Status:** **PENDING_KEY** — engineering side complete, blocked on Stilgar UptimeRobot account creation. Cloudflare Turnstile gates the signup so headless / programmatic creation is not possible.

> **Endpoint:** `/api/health` ships in cfw PR #554 (cf-x6ph + cf-x0ks). Schema:
> `{ status: 'ok', uptime: <int>, commit: <sha>, ts: <ISO> }` with
> `Cache-Control: no-store`. UptimeRobot keyword check on `"ok"` will match.
> 9 unit tests pin the contract. Full ops runbook at
> `carolina-futons-web/docs/monitoring-runbook.md` (lands with PR #554).

## Activation handoff to Stilgar

To activate monitoring (cf-3qt.8.31 acceptance):

1. **Stilgar:** sign up at https://uptimerobot.com using `carolinafutons@gmail.com` (resolves the Turnstile gate).
2. **Stilgar:** Profile → API Settings → **Create Main API Key** → copy.
3. **Stilgar OR godfrey:** add to `/Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env`:
   ```
   UPTIMEROBOT_API_KEY=ur1234567-...
   UPTIMEROBOT_ALERT_CONTACT_ID=<see step 4 below>
   ```
   **Never commit secrets.env.**
4. **Stilgar OR godfrey:** Dashboard → **My Settings → Alert Contacts** → confirm `carolinafutons@gmail.com` is verified (it auto-creates from the signup email; the contact ID is the integer in the row's edit URL).
5. **godfrey:** ETA <10 min from key delivery — runs `bash scripts/setup-monitors.sh`, verifies 5 monitors live (4 HTTP up/down + 1 `/api/health` keyword on `"status":"ok"` per cf-ybsf), fires the mis-config alert test (§4 of `carolina-futons-web/docs/monitoring-runbook.md`), commits this doc with `Status: LIVE` + monitor IDs to main.

The setup script is ready (`scripts/setup-monitors.sh`) and gated on `UPTIMEROBOT_API_KEY:?` so it errors loudly if the key is missing.

---

## Free Tier Limitation

UptimeRobot free tier supports **5-minute** check intervals, not 1-minute. 1-minute intervals require UptimeRobot Pro ($7/mo). Options:

1. **Accept 5-min interval (free)** — adequate for a retail site pre-launch
2. **Upgrade to Pro** — if SLA requires sub-5-min detection
3. **BetterUptime free** — 3-minute minimum, 3 monitors max (not enough for 4 routes)

**Recommendation:** Start with UptimeRobot free (5 min). Upgrade if/when Stilgar confirms SLA requirements.

---

## Monitors Configured

| # | Name | URL | Type | Keyword check |
|---|------|-----|------|---|
| 1 | CF Home | https://carolinafutons.com/ | HTTP(S) | — |
| 2 | CF Futon Frames PLP | https://carolinafutons.com/shop/futon-frames | HTTP(S) | — |
| 3 | CF Products (spot check) | https://carolinafutons.com/products/kingston-futon-frame | HTTP(S) | — |
| 4 | CF Contact | https://carolinafutons.com/contact | HTTP(S) | — |
| 5 | CF API Health | https://carolinafutons.com/api/health | **Keyword** | `"status":"ok"` exists |

Monitors 1-4 expect HTTP 200, alert on non-2xx or timeout >30s. Monitor 5 also verifies the response body contains `"status":"ok"` (the quoted-colon-quoted substring is a stable marker that only appears in a healthy JSON response from `/api/health` per cf-x6ph + cf-x0ks; the bare word `ok` would false-positive on any HTML page that contains it — cf-ybsf alignment).

---

## Setup Steps

### 1. Create UptimeRobot Account

1. Go to https://uptimerobot.com and sign up (free)
2. Navigate to **My Settings → API Settings**
3. Click **Create Main API Key**
4. Copy the key

### 2. Add API Key to secrets.env

```bash
echo 'UPTIMEROBOT_API_KEY=ur...' >> /Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env
```

### 3. Add Alert Contact (email)

UptimeRobot creates a default alert contact for your account email. To use `carolinafutons@gmail.com`:

1. In UptimeRobot → **Alert Contacts** → Add
2. Type: Email, value: `carolinafutons@gmail.com`
3. Note the alert contact ID (visible in the URL or API response)
4. Add to secrets.env:
   ```bash
   echo 'UPTIMEROBOT_ALERT_CONTACT_ID=<id>' >> secrets.env
   ```

### 4. Run Setup Script

```bash
source /Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env
bash /Users/hal/gt/cfutons/crew/melania/scripts/setup-monitors.sh
```

---

## Scripts

See `scripts/setup-monitors.sh` (in this directory) for the provisioning script.  
See `scripts/list-monitors.sh` to verify monitors after setup.

---

## Credential Storage

| Key | Location |
|-----|----------|
| `UPTIMEROBOT_API_KEY` | `/Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env` |
| `UPTIMEROBOT_ALERT_CONTACT_ID` | `/Users/hal/gt/cfutons/refinery/rig/scripts/secrets.env` |

---

## Status Page

UptimeRobot free includes a public status page. After setup, enable at:  
**Dashboard → Status Pages → Create** → share URL with team.

---

*Setup scripted by miquella for cf-3qt.8.3. cf-3qt.8.31 (godfrey 2026-05-10): doc updated with current status + Stilgar handoff. Mayor escalation `hq-wisp-wgxbf` filed for the API-key block. Endpoint contract documented in `carolina-futons-web/docs/monitoring-runbook.md` (cfw PR #554).*
