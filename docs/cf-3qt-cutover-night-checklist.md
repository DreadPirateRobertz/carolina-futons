# cf-3qt Phase 8 — Cutover Night Master Checklist

> **Bead:** cf-0hzn (impl) / cf-2r02 (sibling cfw doc) · **For:** Stilgar (executes) · **On-call:** mayor + crew rotation
>
> Single-page printable. Print this doc and keep it on the desk. The deep-dive runbooks are referenced inline — open them in a second window only when a checkpoint says to.

> **Reference docs (have these open in a second window):**
> - [`docs/cf-3qt.8/dns-ttl-drop-runbook.md`](./cf-3qt.8/dns-ttl-drop-runbook.md) — T-48h step-by-step
> - [`docs/cf-3qt.8/wix-snapshot-runbook.md`](./cf-3qt.8/wix-snapshot-runbook.md) — Wix CMS snapshot for forensics
> - [`docs/cf-3qt.8/order-baseline-runbook.md`](./cf-3qt.8/order-baseline-runbook.md) — pre-cutover order-rate baseline
> - [`docs/cf-3qt.8/cutover-verification-matrix.md`](./cf-3qt.8/cutover-verification-matrix.md) — PRE-FLIP / POST-FLIP page checks
> - cfw-side: `docs/vercel-domain-setup.md`, `scripts/post-cutover-smoke.sh`, `scripts/pre-cutover-monitor.sh`, `docs/cf-3qt-rollback-runbook.md` (carolina-futons-web repo)

---

## T-48h — DNS TTL drop

| Step | Action | Source-of-truth | Verify |
|---|---|---|---|
| 1 | Lower TTL to **60 s** on the four production records (`@` A, `www` CNAME, `_vercel` TXT, etc. per inventory) at the Wix DNS dashboard | [`dns-ttl-drop-runbook.md`](./cf-3qt.8/dns-ttl-drop-runbook.md) | All 4 rows show `1 Minute` in TTL column |
| 2 | Append a one-line entry to `docs/cf-3qt.8/ttl-drop-log.md` recording the save timestamp | runbook §Procedure step 6 | Log line committed |

Why 48 h: the new TTL only governs cache entries fetched after the drop; resolvers holding entries from the old 3600 s TTL continue to honour 3600 s until expiry. Forty-eight hours covers the long tail (`12× 3600 s`).

---

## T-24h — Wix snapshot + order baseline

| Step | Action | Source-of-truth |
|---|---|---|
| 3 | Run the Wix CMS snapshot script. Captures live CMS row JSON (NOT media binaries, NOT member PII, NOT orders — those have separate paths) | [`wix-snapshot-runbook.md`](./cf-3qt.8/wix-snapshot-runbook.md) |
| 4 | Run the order-rate baseline capture. Produces `order-baseline-<DATE>.json` + `.md` summary table | [`order-baseline-runbook.md`](./cf-3qt.8/order-baseline-runbook.md) |
| 5 | Confirm Wix Studio site is **Published**, not Draft. Wix Studio stays publishable through Phase 9 (30 d post-cutover) so DNS revert is viable. | Wix Studio dashboard |

If snapshot or baseline capture fails, **do not proceed**. The post-mortem and rollback verification both depend on these files.

---

## T-2h — final go/no-go

| Step | Action | Verify | If failed |
|---|---|---|---|
| 6 | All Phase-8-prereq beads CLOSED (cf-3qt.7 SEO, cf-3qt.6 parity audit, cf-c6g5 templates, cf-3qt.8 sub-tasks except the cutover itself) | `bd ready --label cf-3qt.8` shows zero blockers | hold cutover; finish prereqs |
| 7 | UptimeRobot monitors green for ≥30 min — `/`, `/shop/futon-frames`, `/products/kingston-futon-frame`, `/contact` (per cf-3qt.8.31) | UptimeRobot dashboard | hold; address red monitor first |
| 8 | PRE-FLIP checks pass against the Vercel preview URL | [`cutover-verification-matrix.md`](./cf-3qt.8/cutover-verification-matrix.md) §"PRE-FLIP CHECKS" | hold; failed page = blocker |
| 9 | `WIX_CLIENT_ID_HEADLESS` + `NEXT_PUBLIC_SITE_URL=https://www.carolinafutons.com` set in Vercel **Production** env | Vercel dashboard → Settings → Environment Variables | add + redeploy production |
| 10 | mayor + on-call crew on the cutover-window pager / Slack | acknowledged in cutover-window channel | reschedule cutover |
| 11 | `post-cutover-smoke.sh` dry-run against the **Vercel preview URL** (not the production domain yet) | All 4 checks PASS using `WIX_CLIENT_ID_HEADLESS` + `WIX_SMOKE_PRODUCT_ID` | fix before flipping DNS |
| 12 | Snapshot Wix DNS targets (apex A + www CNAME) for rollback. `dig +short carolinafutons.com www.carolinafutons.com > ~/cfw-cutover-dns-snapshot-$(date +%Y%m%d).txt` | snapshot file exists | required for rollback per `cf-3qt-rollback-runbook.md` P2 |

**Stilgar/melania go/no-go decision before T-30m.**

---

## T-30m — Vercel domain prep

Per `vercel-domain-setup.md` (cfw repo):

| Step | Action | Verify |
|---|---|---|
| 13 | Add `carolinafutons.com` + `www.carolinafutons.com` to the Vercel project | Both appear in Settings → Domains |
| 14 | Vercel issues SSL certificates | Both domains show "Valid" SSL once DNS resolves (the "Pending" state is normal until step 16 lands) |
| 15 | Configure apex ↔ www redirect (decide: apex → www) | Vercel Settings → Domains |

**Vercel is now ready to receive traffic. DNS is still pointed at Wix.**

---

## T = 0 — DNS flip

```
[T=0]  STILGAR: flipping DNS — carolinafutons.com → Vercel
```

| Step | Action |
|---|---|
| 16 | At the Wix DNS dashboard: replace the apex A record with Vercel's IP per `vercel-domain-setup.md` |
| 17 | Replace the `www` CNAME with `cname.vercel-dns.com` |
| 18 | Save. **Note the timestamp** in the cutover-window channel. |

The clock starts here.

---

## T+5m — first smoke + SSL

| Step | Action | Verify | If failed |
|---|---|---|---|
| 19 | `dig +short carolinafutons.com` | Resolves to a Vercel IP / `cname.vercel-dns.com` | wait 5 more min; some ISPs cache stubbornly |
| 20 | Vercel dashboard → Domains → both `carolinafutons.com` + `www.*` show "Valid" SSL | green | re-issue cert; if persistent → escalate |
| 21 | Run `bash scripts/post-cutover-smoke.sh https://www.carolinafutons.com` (with `WIX_CLIENT_ID_HEADLESS` + `WIX_SMOKE_PRODUCT_ID` env) | Exits 0 (4/4 PASS) | see Escalation matrix below |
| 22 | POST-FLIP checks against the **production domain** | [`cutover-verification-matrix.md`](./cf-3qt.8/cutover-verification-matrix.md) §"POST-FLIP CHECKS" — every page in the matrix renders Next.js (NOT Wix) | escalate per matrix |

---

## T+15m — monitor cutover + manual cart walk

| Step | Action | Verify |
|---|---|---|
| 23 | Start `pre-cutover-monitor.sh` against the **production domain** (https://www.carolinafutons.com). Log to `/tmp/cf-cutover-monitor-<DATE>.log`. | All 10 critical URLs green |
| 24 | UptimeRobot now hitting carolinafutons.com (not the preview URL) — confirm 4 monitors green | Dashboard "Up" |
| 25 | Sentry / Vercel logs — no error spike in the last 15m vs. baseline | dashboards quiet |
| 26 | Manual cart walk: PDP → add → cart → checkout (DO NOT complete payment) | Cart redirects to Wix Headless checkout cleanly |
| 27 | Spot-check a Wix Studio order — confirm a real test order from cfw appears in Wix Stores admin (cart-session dual-write working) | Order visible |

If steps 19–27 are green, **cutover is provisionally successful.** Continue monitoring.

---

## T+1h — first-hour stability

| Step | Action | Verify |
|---|---|---|
| 28 | `pre-cutover-monitor.sh` log review | Zero 5xx, zero non-Vercel responses across all 10 paths |
| 29 | Vercel dashboard → Functions → real-time logs | No unhandled errors / unexpected 5xx |
| 30 | Wix Headless API errors via `vercel logs` filter | No elevation above pre-cutover baseline |
| 31 | Order rate sanity check: orders since T = 0 vs. baseline hourly rate from `order-baseline-<DATE>.json` | **≥ 90 % of baseline** (per bead acceptance) |
| 32 | Search Console — `URL Inspection` for `https://www.carolinafutons.com/` | Returns successfully, indexable |

If any check fails, consult **Escalation matrix** below + [`cf-3qt-rollback-runbook.md`](https://github.com/DreadPirateRobertz/carolina-futons-web/blob/main/docs/cf-3qt-rollback-runbook.md) §Decision-matrix.

---

## T+1h — Search Console + sitemap

Per cfw `docs/cf-3qt/GSC-SUBMISSION-RUNBOOK.md`:

| Step | Action |
|---|---|
| 33 | Submit `https://www.carolinafutons.com/sitemap.xml` to Search Console |
| 34 | Submit `https://www.carolinafutons.com/near-cities-sitemap.xml` (cf-l6aj.21 city pages) |
| 35 | Verify `robots.txt` is reachable: `curl -s https://www.carolinafutons.com/robots.txt | head` |

---

## T+24h — final clearance

| Step | Action |
|---|---|
| 36 | Stop `pre-cutover-monitor.sh`. Save the log. |
| 37 | Tally: total uptime %, # of 5xx, # of orders placed, P0/P1 incident count |
| 38 | Vercel Web Vitals — RUM LCP / INP / CLS distributions vs. pre-cutover Lighthouse baseline (`docs/lighthouse-pre-cutover-2026-05-05.md` cfw repo) |
| 39 | Search Console — index coverage for new domain, any spike in errors |
| 40 | melania compiles → cfw `docs/cf-3qt-day1-stability-report-<DATE>.md` (template at `cf-3qt-day1-stability-report-TEMPLATE.md`) |
| 41 | If GREEN: monitor continues for 30 days (Phase 9 prereq, cf-3qt.9) |

---

## Escalation matrix

| What you see | Action |
|---|---|
| `post-cutover-smoke.sh` exit 1 (DNS not resolving to Vercel) | wait 15 min, re-run; if still 1 after 30 min → ROLL BACK |
| Exit 2 (PLP returns Wix markers) | wait 15 min for cache; ROLL BACK if persistent |
| Exit 3 (Wix Headless OAuth) | **ROLL BACK** immediately — every cart/PDP path is broken |
| Exit 4 (cart) | wait 5 min, re-run; ROLL BACK if persistent |
| `pre-cutover-monitor` shows >5 % 5xx for >10 min | **ROLL BACK** |
| Order rate < 50 % of baseline at T+1h | investigate first; only roll back if a code/config fault is identified within 30 min |
| Customer-reported checkout broken | **ROLL BACK** |
| Single-browser issue | forward-fix in cfw, do NOT roll back |
| Search Console reports index drop next-day | DO NOT roll back at this point — file as Phase 8.x recovery bead with sitemap re-submission |

Rollback procedure: `docs/cf-3qt-rollback-runbook.md` (cfw repo).

---

## Comms templates

### Pre-cutover (T-24h, internal)

```
TONIGHT: cf-3qt Phase 8 cutover at T = <UTC timestamp>.
Vercel deployment carolina-futons-web → carolinafutons.com.
On-call: Stilgar primary, mayor secondary.
Rollback path: docs/cf-3qt-rollback-runbook.md (cfw).
```

### Post-cutover success (T+1h, internal)

```
Cutover complete at T = <timestamp>.
post-cutover-smoke.sh: 4/4 PASS.
First-hour 5xx: <N>. Orders since cutover: <M> (<x>% of baseline).
Monitor running for 24h; day-1 stability report in 22h.
```

### Customer-facing (only if outage > 5 min)

See `cf-3qt-rollback-runbook.md` §"Step 5 — Comms" (cfw repo).

---

## After-action checklist

| Step | Action |
|---|---|
| 42 | Restore DNS TTL to **3600 s** at the Wix DNS dashboard (T+24h or later) |
| 43 | Tag the cfw deploy: `git tag -a cutover-<YYYY-MM-DD> <SHA> && git push --tags` |
| 44 | Capture lessons → cfw `docs/cf-3qt-cutover-postmortem-<DATE>.md` (template at `cf-3qt-cutover-postmortem-TEMPLATE.md`) |
| 45 | Schedule the 30-day Phase 9 review (cf-3qt.9) |
| 46 | Mark cf-3qt.8 CLOSED with link to the post-mortem |

---

## Refs

- **This doc**: cf-0hzn (impl) / cf-2r02 (cfw sibling)
- **DNS prep**: [`docs/cf-3qt.8/dns-ttl-drop-runbook.md`](./cf-3qt.8/dns-ttl-drop-runbook.md)
- **Forensics inputs**: [`wix-snapshot-runbook.md`](./cf-3qt.8/wix-snapshot-runbook.md), [`order-baseline-runbook.md`](./cf-3qt.8/order-baseline-runbook.md)
- **Pre/post page checks**: [`cutover-verification-matrix.md`](./cf-3qt.8/cutover-verification-matrix.md)
- **cfw-side ops**: `vercel-domain-setup.md`, `scripts/post-cutover-smoke.sh`, `scripts/pre-cutover-monitor.sh`, `cf-3qt-rollback-runbook.md`
- **Reports**: cfw `cf-3qt-day1-stability-report-TEMPLATE.md`, `cf-3qt-cutover-postmortem-TEMPLATE.md`
- **Phase 8 master**: cf-3qt.8 · **Phase 9 retirement**: cf-3qt.9 (30 d post-stable)
