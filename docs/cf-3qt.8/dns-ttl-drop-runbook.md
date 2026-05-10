# cf-3qt.8 — DNS TTL Drop Runbook

**Bead:** cf-3qt.8 (acceptance item 2 — "Lower DNS TTL to 60s (48h prior)")
**Owner:** Stilgar (executes in Wix DNS dashboard) + millicent (verification helper) + melania (gate-keeps timing)
**Last updated:** 2026-05-10

The cf-3qt.8 cutover commits to a **rollback-inside-15-minutes** SLO. That commitment depends entirely on the TTL of the `carolinafutons.com` records being short enough that resolvers re-fetch within the rollback window. Today the records carry a default `~3600` (1-hour) TTL — too long. This runbook captures the procedure for dropping all of them to **60 seconds** at least 48 hours before the cutover, plus the post-cutover restoration to a normal TTL once the migration has stabilized.

---

## Why 60s, why 48h

- **Why 60s:** the rollback SLO is 15 minutes from "decision to rollback" to "carolinafutons.com resolves to Wix again." With a 60s TTL, a globally-cached record expires within one minute; the long tail of intermediate caches (some ISPs ignore TTL and cap at their own minimum, often 5–10 min) settles by the 15-minute mark. With a 3600s TTL, the same propagation takes up to an hour — the SLO is unreachable.
- **Why 48h:** A TTL drop only takes effect after the *previous* TTL window has expired. If we drop TTL → 60 from 3600 at T-12h, resolvers that fetched the record at T-11h still hold the old 3600s entry until T+49min. 48 hours is a comfortable safety margin (12× the 3600s window, accounts for resolvers that round up TTL).

If the cutover slips by more than 48h after the TTL drop, no action needed — the short TTL just means more re-fetches, no operational risk. If the cutover slips by more than **two weeks**, restore TTL to the normal value and re-drop 48h before the new cutover date (long-running 60s TTL makes the records sensitive to single-DNS-server outages).

---

## Pre-flight inventory

The records to lower are the four authoritative entries for `carolinafutons.com` per `dns-staging.md` (cf-3qt.8.2). Wix is the DNS provider today (nameservers `ns2.wixdns.net`, `ns3.wixdns.net`), so the procedure happens in the Wix Dashboard, not at an external registrar.

| # | Type | Name | Current value | Current TTL | Target TTL |
| ---: | --- | --- | --- | ---: | ---: |
| 1 | A | `@` | `185.230.63.186` | `~3600` | **60** |
| 2 | A | `@` | `185.230.63.107` | `~3600` | **60** |
| 3 | A | `@` | `185.230.63.171` | `~3600` | **60** |
| 4 | CNAME | `www` | `cdn1.wixdns.net.` | `~3600` | **60** |

**Do NOT touch:**
- **MX `@` → `mx30.mailspamprotection.com.` (priority 30)** — mail routing. A TTL drop here is harmless but unnecessary; keep the surface of changes minimal so the email-risk assessment in `dns-staging.md` stays valid.
- **NS records (`ns2.wixdns.net.` / `ns3.wixdns.net.`)** — registrar-level, not edited from the DNS dashboard. Untouched.
- **No TXT / SPF / DMARC / DKIM records exist** today (per cf-3qt.8.2). Nothing to lower.

---

## Procedure (Wix DNS dashboard)

**Estimated time: 5 minutes. Stilgar executes; melania pairs.**

1. Log into the Wix Dashboard at <https://manage.wix.com>.
2. Open `carolinafutons.com` site → **Settings** → **Domains**.
3. Click `carolinafutons.com` → **Advanced** → **Edit DNS**.
4. For each of the 4 records above:
   1. Click the row → **Edit**.
   2. Change the TTL field from `1 Hour` (or whatever the current value reads) to `1 Minute`. Wix's UI presents preset choices — `1 Minute` corresponds to 60 seconds.
   3. Click **Save**.
5. Confirm all 4 rows now show `1 Minute` in the TTL column.
6. Record the timestamp of the last save in `docs/cf-3qt.8/ttl-drop-log.md` (create the file if it doesn't exist; one line per drop):
   ```
   2026-05-12T14:00 MT — TTL → 60s on @, @, @, www. Done by Stilgar (verified: melania).
   ```
   This timestamp is the start of the 48-hour window. The earliest the cutover may proceed is T+48h.

---

## Verification

`scripts/cutover/verify-dns-ttl.sh` polls public resolvers and exits non-zero if any of the 4 records still report a TTL > 120s (60s with a small grace for clock skew). Run it:

- Immediately after the dashboard save (expect: still some resolvers report old TTL — this is the propagation tail)
- 1 hour later (expect: most major resolvers updated)
- At T+24h (expect: every checked resolver reports ≤ 120s — anything else is investigated before cutover)
- Right before the cutover (final go/no-go signal)

```sh
bash scripts/cutover/verify-dns-ttl.sh
# → exits 0 if all 4 records show TTL ≤ 120s on every checked resolver
# → exits 1 with a per-resolver/record table if any still show stale TTL
```

The script is plain `dig`-based — works without any Wix or Vercel auth.

---

## Post-cutover restoration

Once the cutover has been stable for **30 days** (or the rollback window is officially closed by Stilgar, whichever comes first), restore the TTL to a normal value:

| Record | Restore TTL |
| --- | ---: |
| A `@` (3 records, now pointing at Vercel `76.76.21.21`) | `3600` (1 hour) |
| CNAME `www` (now `cname.vercel-dns.com.`) | `3600` (1 hour) |

Same procedure as the drop: Wix Dashboard → Domains → Edit DNS → set TTL `1 Hour`. Append the timestamp to `ttl-drop-log.md` so the historical record is intact.

Why restore: a permanent 60s TTL doubles or triples the DNS query load (every minute vs every hour), and a single brief Wix-DNS-server outage during a 60s window means lots of users see immediate resolution failures. 1 hour is the standard balance.

---

## Failure modes

| Mode | Detection | Response |
| --- | --- | --- |
| Wix UI saves silently fail | Verification script at T+1h still shows 3600s | Re-open the record in the dashboard, re-save. If still fails, contact Wix support — their dashboard occasionally drops writes during deploys. |
| One record was missed | Verification script reports TTL > 120s on a specific record | Edit that single record, re-save, re-verify. Common cause: the third A record at the bottom of the list scrolled off. |
| Cutover triggered without 48h elapsed | Pre-cutover gate (melania) | **Block the cutover.** Resolver caches still hold the old TTL; rollback would not finish in 15 min. Reschedule the cutover for T+48h after the actual TTL drop. |
| Resolvers report TTL > 60s but ≤ 120s | Verification script | **Acceptable.** Some resolvers (Google's `8.8.8.8`, Cloudflare's `1.1.1.1`) clamp TTL to a minimum (often 30–60s) and present a slightly higher value in `dig` output. The 120s grace in the script accommodates this without false failures. |

---

## Reference

- Parent: cf-3qt.8 (DNS cutover) acceptance item 2
- DNS record inventory: `dns-staging.md` (cf-3qt.8.2)
- Sibling runbooks:
  - `docs/cf-3qt.8/order-baseline-runbook.md` (item 5)
  - `docs/cf-3qt.8/wix-snapshot-runbook.md` (item 1)
  - `docs/ops/rollback-runbook.md` (item 4 — the rollback procedure that depends on this TTL drop)
- Wix DNS dashboard: <https://manage.wix.com> → Settings → Domains → Advanced → Edit DNS
