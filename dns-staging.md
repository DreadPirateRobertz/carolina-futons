# DNS Staging: carolinafutons.com → Vercel

**Bead:** cf-3qt.8.2  
**Author:** godfrey  
**Date:** 2026-05-04  
**Status:** Draft — no changes applied

---

## Current DNS State

Nameservers: `ns2.wixdns.net`, `ns3.wixdns.net` (Wix-managed)  
Registrar SOA: `ns2.wixdns.net. support.wix.com. 2022090101`

| Type  | Name | Value | TTL |
|-------|------|-------|-----|
| A     | @    | 185.230.63.186 | ~3600 |
| A     | @    | 185.230.63.107 | ~3600 |
| A     | @    | 185.230.63.171 | ~3600 |
| CNAME | www  | cdn1.wixdns.net. | ~3600 |
| MX    | @    | mx30.mailspamprotection.com. (priority 30) | ~3600 |
| NS    | @    | ns2.wixdns.net. | — |
| NS    | @    | ns3.wixdns.net. | — |

**Notable absences:** No TXT records, no SPF, no DMARC, no DKIM found at root or
checked subdomains (`_dmarc`, `mail`, `google._domainkey`). The MX record points
to Wix's spam-protection relay — mail appears routed through Wix's infrastructure.

---

## Proposed Records (Post-Vercel Flip)

| Type  | Name | Value | TTL |
|-------|------|-------|-----|
| A     | @    | 76.76.21.21 | 300 (lower for rollback window) |
| CNAME | www  | cname.vercel-dns.com. | 300 |

Remove the three existing Wix A records and the Wix CNAME for www.

---

## MX / Email Risk Assessment

**MX survives the flip: YES**, provided the MX record itself is preserved
in whichever DNS provider takes over. The A-record change does not affect
mail routing — MX is independent.

**Current risk:** The MX target is `mx30.mailspamprotection.com`, which is
Wix's managed spam-filter relay. If nameserver control moves away from Wix
(e.g., to Cloudflare or Vercel DNS), we must manually re-enter this MX record.
It is NOT automatically carried over — it lives in Wix's zone file.

**SPF / DMARC / DKIM:** None currently exist at the DNS level. No TXT records
were found. This means the domain is already sending without email
authentication — the flip neither helps nor hurts this, but it's a pre-existing
gap worth noting for future hardening.

---

## Cutover Checklist (for whoever executes the flip)

- [ ] Add Vercel domain in Vercel dashboard → get the A + CNAME targets confirmed
- [ ] Lower TTL on existing A + CNAME to 300s ≥ 24 hours before flip
- [ ] Verify SSL cert provisioned in Vercel for `carolinafutons.com` + `www.carolinafutons.com`
- [ ] Export full Wix DNS zone file before touching nameservers
- [ ] Add new A `@` → 76.76.21.21 (keep old A records during propagation window)
- [ ] Add new CNAME `www` → cname.vercel-dns.com. (alongside old CNAME)
- [ ] Confirm Vercel shows domain as "Valid" before removing Wix records
- [ ] Remove old Wix A records (185.230.63.{186,107,171})
- [ ] Remove old CNAME www → cdn1.wixdns.net.
- [ ] Preserve MX record: `mx30.mailspamprotection.com.` priority 30
- [ ] Smoke-test: curl -I https://carolinafutons.com → 200
- [ ] Smoke-test: curl -I https://www.carolinafutons.com → 200 or 301
- [ ] Send test email to a monitored address → confirm delivery

---

## Rollback

Revert A record to `185.230.63.{186,107,171}` and CNAME www to `cdn1.wixdns.net.`.
At TTL=300 propagation window is ≤5 minutes. Old Wix records must not be deleted
until stability is confirmed (recommend 48-hour observation period).

---

## Open Questions

1. **Nameserver migration?** If we're moving NS away from Wix entirely (to
   Cloudflare or Vercel DNS), the MX record must be manually reproduced in the
   new zone. Confirm scope with Stilgar.
2. **Wix Studio apps** — some Wix-hosted services (chat widget, forms, etc.)
   reference the Wix CDN origin. Post-flip, the Next.js app serves HTML but Wix
   widget scripts still load from Wix CDN — no DNS impact, but worth confirming
   during smoke test.
3. **SPF hardening** — opportune moment to add SPF + DMARC as part of the flip
   since we're touching the zone anyway. Recommend: `v=spf1 include:wixemails.com ~all`
   if Wix Ascend/email is still in use.
