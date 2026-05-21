# cf-3qt Phase 9 — 30-Day Stability Report

**Report period:** <!-- FILL: e.g. 2026-MM-DD → 2026-MM-DD (30 days post Phase 8 cutover) -->
**Prepared by:** <!-- FILL: name/handle -->
**Review date:** <!-- FILL -->

---

## 1. Uptime

| Metric | Value | Pass threshold |
|--------|-------|----------------|
| Uptime % (30d) | <!-- FILL: e.g. 99.97% --> | ≥ 99.9% |
| Longest outage (min) | <!-- FILL --> | < 30 min |
| Total downtime (min) | <!-- FILL --> | < 45 min |

**Notes:** <!-- FILL: any notable outages, causes, and resolution times -->

---

## 2. Incidents

| Severity | Count | Rollback triggered? |
|----------|-------|---------------------|
| P0 (site down / checkout broken) | <!-- FILL --> | <!-- yes/no --> |
| P1 (major feature broken) | <!-- FILL --> | <!-- yes/no --> |
| P2 (degraded, workaround exists) | <!-- FILL --> | — |

**Incident summaries:** <!-- FILL: brief description of each P0/P1, link to post-mortem if applicable -->

---

## 3. Order Conversion Rate

| Period | Conversion rate | vs. Wix baseline | Δ |
|--------|----------------|-----------------|---|
| Wix baseline (7d pre-cutover avg) | <!-- FILL: e.g. 2.4% --> | — | — |
| Post-cutover week 1 | <!-- FILL --> | <!-- +/- % --> | <!-- FILL --> |
| Post-cutover week 2 | <!-- FILL --> | <!-- +/- % --> | <!-- FILL --> |
| Post-cutover week 3 | <!-- FILL --> | <!-- +/- % --> | <!-- FILL --> |
| Post-cutover week 4 | <!-- FILL --> | <!-- +/- % --> | <!-- FILL --> |
| 30d average | <!-- FILL --> | <!-- +/- % --> | <!-- FILL --> |

**Pass threshold:** 30d average ≥ 90% of Wix baseline (rollback trigger was <90% at T+2h)

**Notes:** <!-- FILL: seasonality adjustments, promo periods, anomalies -->

---

## 4. Core Web Vitals Trend

Measured on carolinafutons.com (Vercel production). Source: CrUX / PageSpeed Insights.

| Page | LCP (s) | CLS | FID/INP (ms) | vs. Wix baseline |
|------|---------|-----|--------------|-----------------|
| Home | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| PDP (representative) | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| /shop PLP | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| /contact | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |

**Pass thresholds:** LCP < 2.5s, CLS < 0.1, INP < 200ms

**Trend direction:** <!-- FILL: improving / stable / degrading -->

---

## 5. Synthetic Monitoring

| Check | Status | P95 latency (30d) |
|-------|--------|-------------------|
| Homepage load | <!-- FILL: green/yellow/red --> | <!-- FILL: ms --> |
| /shop PLP load | <!-- FILL --> | <!-- FILL --> |
| PDP load | <!-- FILL --> | <!-- FILL --> |
| Checkout initiation | <!-- FILL --> | <!-- FILL --> |
| Contact form submit | <!-- FILL --> | <!-- FILL --> |

---

## 6. Rollback Capability Verification

- [ ] Wix Studio site still publishable (verified: <!-- FILL: date -->)
- [ ] DNS rollback runbook tested (verified: <!-- FILL: date or N/A -->)
- [ ] Wix CMS data in sync (verified: <!-- FILL: date -->)

---

## 7. Sign-off

| Reviewer | Role | Decision | Date |
|----------|------|----------|------|
| <!-- FILL: Stilgar --> | Site owner | <!-- FILL: approved / needs work --> | <!-- FILL --> |
| <!-- FILL: Mayor --> | Oversight | <!-- FILL --> | <!-- FILL --> |
| <!-- FILL: Melania --> | PM | <!-- FILL --> | <!-- FILL --> |

**Stilgar sign-off date:** <!-- FILL — required before Phase 9 (Wix retirement) proceeds -->

---

## 8. Recommendation

- [ ] **GREEN — proceed to Phase 9** (retire Wix Studio, evaluate Premium downgrade)
- [ ] **HOLD — address items before Phase 9**
- [ ] **ROLLBACK — revert DNS to Wix**

**Rationale:** <!-- FILL -->
