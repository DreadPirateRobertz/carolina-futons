# Uptime Monitoring — cf-3qt.8.3

**Service:** UptimeRobot (free tier)  
**Target:** carolinafutons.com  
**Alert email:** carolinafutons@gmail.com  
**Status:** Awaiting API key — run `scripts/setup-monitors.sh` once key is added to secrets.env

---

## Free Tier Limitation

UptimeRobot free tier supports **5-minute** check intervals, not 1-minute. 1-minute intervals require UptimeRobot Pro ($7/mo). Options:

1. **Accept 5-min interval (free)** — adequate for a retail site pre-launch
2. **Upgrade to Pro** — if SLA requires sub-5-min detection
3. **BetterUptime free** — 3-minute minimum, 3 monitors max (not enough for 4 routes)

**Recommendation:** Start with UptimeRobot free (5 min). Upgrade if/when Stilgar confirms SLA requirements.

---

## Monitors Configured

| # | Name | URL | Type |
|---|------|-----|------|
| 1 | CF Home | https://carolinafutons.com/ | HTTP(S) |
| 2 | CF Futon Frames PLP | https://carolinafutons.com/shop/futon-frames | HTTP(S) |
| 3 | CF Products (spot check) | https://carolinafutons.com/products/kingston-futon-frame | HTTP(S) |
| 4 | CF Contact | https://carolinafutons.com/contact | HTTP(S) |

All monitors: expect HTTP 200, alert on non-2xx or timeout >30s.

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

*Setup scripted by miquella for cf-3qt.8.3. Awaiting UPTIMEROBOT_API_KEY in secrets.env to run.*
