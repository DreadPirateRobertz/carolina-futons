# Sentry alert spec — ISR background revalidation failures

**Bead:** cf-czdw (cf-h345.t2)
**Depends on:** cf-h345.t1 wrapper (cfw PR #706, merged) — tags `next.revalidate_reason` on every Sentry-captured request error
**Repo emitting the signal:** `carolina-futons-web` (cfw)
**Audience:** on-call (mayor primary, melania secondary)

---

## 1. What this alert detects

Next.js's `onRequestError` hook fires for every error during a render request, including errors raised while ISR is regenerating a stale page in the background. By design, Next.js silently falls back to the last successfully cached version — **the user sees stale content, no 5xx, no obvious symptom.** The on-call signal is the Sentry event.

cfw PR #706 wraps `onRequestError` to call `Sentry.setTag('next.revalidate_reason', context.revalidateReason ?? 'none')` before delegating to `Sentry.captureRequestError`. That tag is the only thing distinguishing ISR-regen failures from regular render errors in the alert channel.

The three tag values:

| Tag value | Meaning | Operator interpretation |
|---|---|---|
| `stale` | Time-based ISR background regen (visit after `revalidate=N` window expired) | Upstream (Wix) is degrading our cache regen; users see stale content; **page on threshold breach** |
| `on-demand` | `revalidatePath()` / `revalidateTag()` server action failing | Our own server action is throwing; usually a code regression — **page on threshold breach** |
| `none` | Normal render request, no revalidation in flight | Baseline; **do NOT page on this filter** (handled by existing render-error alerts) |

---

## 2. Sentry filter query

```
event.tags.next.revalidate_reason:[stale,on-demand]
  AND environment:production
  AND project:carolina-futons-web
```

The `[stale,on-demand]` set-membership filter excludes the `none` baseline. Add explicit environment + project clauses so preview-deploy noise (Vercel preview builds throwing during a PR build) doesn't trip the production paging alert.

### Per-page slicing (drill-down)

Pair with `transaction:/products/[slug]` (or the relevant route) when investigating a specific spike. The cfw routes most likely to ISR are PDP (`/products/[slug]`) and PLPs (`/shop/[collection]`); blog and content pages will join the set when their `revalidate` exports land.

---

## 3. Threshold + paging policy

### Threshold

**3 events / 5-minute window → page.**

Rationale: with the cfw 88-product catalog and a 1-hour `revalidate` window, the natural background-regen rate (per route, per hour) is bounded by `ceil(catalog / 60min)` ≈ 2 regens/min ≈ 6/5min at saturation. A healthy regen success rate is ≥95%, so the expected `stale`-tagged failure rate is < 0.3/5min. Three errors in five minutes is ~10× baseline — confidence that something real is happening, before the rate produces enough Sentry noise to drown the signal.

Adjust as ISR coverage expands:
- ISR on PDP only (current state once cf-0klm lands) → 3/5min as above
- ISR added to PLPs + blog → re-baseline at **5/5min**
- ISR added to all non-cart/account routes → re-baseline at **10/5min** with separate per-route alerts for high-traffic surfaces

### Paging policy

| Severity | Trigger | Action |
|---|---|---|
| `WARN` | 1 event / 5min, any tag in `[stale, on-demand]` | Sentry Slack channel post (no page). Auto-acks after 15min if no escalation. |
| `PAGE` | ≥3 events / 5min, tag = `stale` | Page mayor primary. Investigate Wix outage / network blip. Falls into "Known degradation posture" below. |
| `PAGE` | ≥1 event / 5min, tag = `on-demand` | Page mayor primary AND nudge melania. `on-demand` means a server action revalidate call threw — almost always a code regression, lower threshold. |

The `on-demand` lower threshold is deliberate: those errors are nearly always caused by our own code (a `revalidatePath` call in a Server Action throwing). One reliably-reproducing on-demand failure is worth investigating; three stale ones could just be Wix being Wix.

---

## 4. Escalation path

1. **Sentry alert fires.** Slack notification + page to mayor primary.
2. **Mayor triage (5 min):**
   - Click into the Sentry event. Confirm the `next.revalidate_reason` tag value (filter could mis-fire if Sentry projects are mis-routed).
   - Check transaction name — is this concentrated on one route or spread?
   - Check the event's exception type — is it a Wix SDK error (`WixSdkError`, `getProductBySlug failure`) or a Next.js framework error?
3. **If `tag=stale` and exception is Wix-side:**
   - Check Wix status page (Wix doesn't publish one; check our cfw Wix-side error rate dashboard if it exists, otherwise infer from the Sentry events).
   - **Do nothing** if rate is dropping — the cache is serving stale content; users are unaffected. Document the spike in the on-call log.
   - **Nudge melania** if rate stays elevated > 30min — she may want to manually `revalidatePath` once Wix recovers to flush stale content faster.
4. **If `tag=on-demand`:**
   - This is a code regression. Recent merges to cfw `app/actions/**` or any file calling `revalidatePath`/`revalidateTag`.
   - **Nudge melania immediately** + check `gh pr list --limit 5 --state merged` for suspects.
   - If unclear, this is the cf-0klm context: the layout `cookies()` opt-out (godfrey-owned, cf-0klm spike doc) may have inadvertently been removed, making revalidate calls reach an unsupported path.
5. **If escalation needed beyond melania:** Stilgar (engineering lead). On-call log entry + nudge with the Sentry permalink.

---

## 5. Known degradation posture

This alert is for an **operationally-acceptable silent degradation** by Next.js design:

> if an error is thrown while attempting to revalidate data, the last successfully generated data will continue to be served from the cache
> — Next.js docs, ISR section

The signal is a **leading indicator**, not an outage. Three categories of response:

1. **No-op tolerable** — single-digit `stale` events with no clustering, rate < 1/5min. Cache stays warm. No user impact. Document and move on.
2. **Investigate** — sustained elevated rate, even below page threshold. Likely Wix degradation. Check Wix dashboard if available.
3. **Page** — threshold breach per §3. Risk: users seeing increasingly stale content; `revalidatePath` server actions throwing means cart / checkout flows could be affected if they share the broken path.

The `none`-tagged baseline (normal render errors) is **NOT covered by this alert**. Those are handled by the pre-existing cfw render-error Sentry alert (project default rules) — not in scope for this spec.

---

## 6. Verification before this alert goes live

- [ ] PR #706 wrapper is merged + deployed to production cfw (confirmed: melania nudge 2026-05-16)
- [ ] Sentry project `carolina-futons-web` is receiving `event.tags.next.revalidate_reason` field on events (verify: filter query returns at least the `none` baseline)
- [ ] cf-0klm resolved + ISR active on at least one production route (without this, every tag value will be `none` — the alert is forward-looking-only until then; this is acceptable per cfw PR #706 carve-out)
- [ ] Alert configured in Sentry UI per §2 + §3 (one-time setup by mayor or whoever has Sentry admin)
- [ ] Slack channel + on-call paging integration tested with a forced `stale` event (can be triggered manually by throwing inside a `revalidate`-tagged fetch in a preview deploy)

---

## 7. Refs

- cfw PR #706 — wrapper implementation, 5 test cases pinning tag values + delegation + ordering
- cf-h345 — parent investigation bead
- cf-h345.t1 — wrapper subtask (blaidd, 2026-05-16)
- cf-0klm — cookies()-opt-out blocker for actual ISR coverage (godfrey, P2 OPEN)
- cf-0oj5 — original PDP ISR strategy (godfrey)
- Next.js docs — [Incremental Static Regeneration: handling errors](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration#handling-errors-and-revalidation)
- `feedback_reachable_observable_honest.md` — the 3-stage framing this alert operationalizes (reachable: wrapper fires; observable: this spec makes operator action possible; honest: tag values distinguish stale vs on-demand vs none truthfully)

---

## 8. Out-of-scope flags-for-followups

- **Sentry dashboard widget** that surfaces tag-value time-series for at-a-glance posture — useful but not required for paging to function. File as cf-czdw.fu1 if mayor wants it.
- **Per-route alert variants** — once ISR coverage expands, splitting the alert per route lets traffic-weighted thresholds tune separately. Track 4 of cf-h345 references a Playwright cache-hit test that complements this; both are post-cf-0klm.
- **Wix status integration** — Wix doesn't publish a status feed cfw can consume. If we ever build a cfw-side Wix health probe, fold it into §4 step 3.
