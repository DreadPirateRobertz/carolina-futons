# DNS TTL Drop Log — carolinafutons.com

**Bead:** cf-3qt.8.35 (parent: cf-3qt.8 DNS cutover phase)
**Runbook:** `docs/cf-3qt.8/dns-ttl-drop-runbook.md`
**Document owner:** Stilgar fills in the `[FILL IN]` markers as steps execute. radahn owns the doc skeleton + pre-change verification.

---

## Pre-change baseline (radahn, 2026-05-10)

**Authoritative TTL:** `3600s` (Wix default).

Verified via `dig` from radahn's workstation, 2026-05-10 03:50 UTC:

```
$ dig +noall +answer carolinafutons.com A
carolinafutons.com.   2999   IN   A   185.230.63.171
carolinafutons.com.   2999   IN   A   185.230.63.107
carolinafutons.com.   2999   IN   A   185.230.63.186
```

Note: the `2999` field is the *remaining* cache TTL from this query, not the authoritative value. The Wix-side authoritative TTL is `3600` per the runbook + bead.

**Records affected by the TTL drop:**

| Record | Type | Current target              | Authoritative TTL |
| ------ | ---- | --------------------------- | ----------------- |
| `carolinafutons.com` | A    | `185.230.63.171`, `.107`, `.186` (Wix) | 3600 |
| `www.carolinafutons.com` | CNAME | `cdn1.wixdns.net.` | 3600 |

**Nameservers:** `ns2.wixdns.net` + `ns3.wixdns.net` (Wix-managed). The TTL change must happen in the Wix Dashboard (Domains → DNS), not at the registrar.

**No AAAA records configured** (no IPv6 to drop).

---

## TTL drop execution (Stilgar)

**Wix Dashboard path:** Domains → DNS → A records → Edit TTL

Drop the TTL on **both** the apex `A` records (3 of them) and the `www` CNAME from `3600` → `60`.

| Field                 | Value           |
| --------------------- | --------------- |
| Time of change (UTC)  | `[FILL IN]`     |
| Time of change (MT)   | `[FILL IN]`     |
| Records updated       | `[apex A × 3, www CNAME × 1]` confirm |
| New TTL value         | `60s`           |
| Executed by           | Stilgar         |

---

## Post-change verification (run every 15 min until TTL field stabilises at 60)

```bash
# Apex A records
dig +noall +answer carolinafutons.com A
# Expect TTL field to drop to <= 60 within 1 hour of the change.

# www CNAME
dig +noall +answer www.carolinafutons.com CNAME
# Expect TTL field to drop to <= 60 within 1 hour of the change.

# Authoritative-server check (bypasses recursive caches)
dig @ns2.wixdns.net +noall +answer carolinafutons.com A
# This MUST show TTL=60 immediately after the change. If it still shows
# 3600 here, the dashboard change didn't propagate to Wix's authoritative
# servers — escalate before starting the 48h clock.
```

| Verification step          | Time      | dig output (TTL value) |
| -------------------------- | --------- | ---------------------- |
| Authoritative @ns2.wixdns  | `[FILL]`  | `[FILL]`               |
| Recursive (default resolver) at change+15min | `[FILL]`  | `[FILL]` |
| Recursive at change+1h     | `[FILL]`  | `[FILL]`               |
| Recursive at change+4h     | `[FILL]`  | `[FILL]`               |

**TTL drop confirmed at:** `[FILL IN — UTC timestamp when authoritative read returns 60]`

---

## 48-hour clock

Per the runbook, cutover is gated on **all** recursive resolvers having had ≥48h to expire their old cached records. The earliest safe cutover window is `48h` after the authoritative TTL change, NOT after the dashboard click.

| Field                          | Value      |
| ------------------------------ | ---------- |
| 48h clock start (UTC)          | `[FILL IN — same as "TTL drop confirmed at"]` |
| Earliest cutover window (UTC)  | `[FILL IN + 48h]` |
| Earliest cutover window (MT)   | `[FILL IN + 48h, MT]` |

---

## Order-rate baseline (capture BEFORE or immediately AFTER the TTL drop)

Per the bead's note: once Vercel is serving traffic post-cutover, comparing order rates against the Wix baseline becomes hard. Capture the 48h baseline NOW so we have a regression yardstick.

| Field                                         | Value      |
| --------------------------------------------- | ---------- |
| Baseline window start (UTC)                   | `[FILL IN — TTL change timestamp]` |
| Baseline window end (UTC)                     | `[FILL IN + 48h]` |
| Order count in window                         | `[FILL IN — pull from Wix orders dashboard, filter by createdDate]` |
| Average order value (USD)                     | `[FILL IN]` |
| Mobile share %                                | `[FILL IN]` |
| Notable abandoned-cart rate change?           | `[FILL IN]` |
| Anomalies / promos / outages during window    | `[FILL IN — anything that would skew the baseline]` |

**Source query:** Wix Dashboard → Orders → date filter on the 48h window. Export CSV + attach hash here:

```
shasum -a 256 orders-baseline-2026-05-XX.csv
[FILL IN]
```

---

## Cutover-readiness checklist (gate for moving to cf-3qt.8.<next>)

- [ ] Authoritative TTL confirmed at 60 via `dig @ns2.wixdns.net`
- [ ] Recursive resolvers showing TTL ≤ 60 at change+1h
- [ ] 48h clock start timestamp recorded above
- [ ] Order-rate baseline captured + CSV hash recorded
- [ ] Earliest-cutover window (≥ 48h after TTL drop) computed + on the team calendar
- [ ] Stilgar approves the cutover-ready state in writing (mail or bead comment)

---

## Reproducer (radahn pre-flight verification commands)

```bash
# Current state (run before Stilgar's TTL change to capture the "before" snapshot)
dig +noall +answer carolinafutons.com A
dig +noall +answer www.carolinafutons.com CNAME
dig +noall +answer carolinafutons.com NS

# Authoritative read (bypass recursive cache to see Wix-side truth)
dig @ns2.wixdns.net +noall +answer carolinafutons.com A
dig @ns3.wixdns.net +noall +answer carolinafutons.com A

# Cross-resolver sanity (run from multiple resolvers post-change)
dig @1.1.1.1 +noall +answer carolinafutons.com A   # Cloudflare
dig @8.8.8.8 +noall +answer carolinafutons.com A   # Google
dig @9.9.9.9 +noall +answer carolinafutons.com A   # Quad9
```

The cross-resolver checks are the most useful 1–4h post-change to confirm propagation across the public internet, not just one ISP's cache.
