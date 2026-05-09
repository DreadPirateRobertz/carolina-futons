# cfw Parity — Residual Triage (cf-ah0m follow-up, 2026-05-09)

> Audit-refresh sweep on top of v2.1 (PR #1148, merged). Classifies the **24 residuals** (5 missing + 19 unprobed) into actionable buckets so polecats can sweep the real gaps without re-running the matcher first.
>
> Also: **bonus check** — re-grep of `EDITOR_HOOKUP_GUIDE.html` h4 `Implementation` blocks after the cf-qdxi v4.6 refresh. **285 blocks, all closed properly, 0 unclosed, 0 heading-only.** No blank-screen regression introduced by v4.6.

## v2.1 baseline (for reference)

201 ✓ → 208 ✓ in v2.1 / 28 ~ → 22 / 25 ✗ → 5 / 1 ? / **+19 ▢ unprobed** (newly explicit).

## Residual classification

Each residual was probed against `carolina-futons-web/src` with targeted greps to determine whether the matcher missed real evidence (alias-promotable), the feature is actually missing (polecat sweep), the page is auth-walled / client-rendered (probe-tier blocker), or the row is out-of-scope (release-note heading, future-wiring placeholder).

| Bucket | Count | What polecats should do |
|---|---:|---|
| 🟢 alias-promotable (matcher false-negative) | 1 | Update alias map; rerun audit; promote to ✓ |
| 🔴 real gap (cfw doesn't have it) | 12 | Sweep candidates — file a small bead per item OR roll into next batch |
| 🔒 auth-walled / client-rendered (DOM probe blocked) | 7 | Need Playwright + logged-in session OR source-side spot check before classification firms up |
| ⏸️ out-of-scope (release-note / future-wiring placeholder) | 4 | Filter out of audit; not a coverage gap |

Total: **24** = 1 + 12 + 7 + 4.

## Detail by row

### 🟢 alias-promotable (1)

| Row | cfw evidence found | Alias to add |
|---|---|---|
| `SUSTAINABILITY :: Certifications ⚠️ REPEATER` | `app/sustainability/page.tsx:167` exports a `getCertifications()` server action; renders FSC, CertiPUR-US, GOTS, etc. as cards under `id="certifications-heading"` (DOM-confirmed at probe time). Falls below the matcher today because cfw uses `id=` (not `data-slot`/`data-testid`) and the inventory script only collects the latter two attributes. | `"certifications": ["certifications-heading", "Certifications", "CertList", "FSC", "GOTS", "CertiPUR"]` (alias added in this PR; will fire once inventory is extended to harvest `id=` attributes — short follow-up bead suggested). |

### 🔴 real gap — polecat sweep candidates (12)

These have no matching cfw component, data-slot, data-testid, or rendered DOM evidence. Spot-checked each by direct grep.

| Row | Notes |
|---|---|
| `MASTER PAGE :: Accessibility` | Many `aria-label` / `aria-labelledby` / `aria-live` usages but no `SkipLink` / `skip-to-content` / explicit landmark wrapper. Either add one OR mark the guide row as "covered by per-component aria primitives" and remove from inventory. |
| `CONTACT :: Hours ⚠️ REPEATER` | Hours appear inline as prose in `app/contact/page.tsx` ("Open Wednesday through Saturday, 10am–5pm"). No structured `BusinessHours` component or `data-slot`. Cheap polecat fix: extract a small component + slot. |
| `SHIPPING POLICY :: Scheduling` | Mentioned only in FAQ prose body. No scheduling UI surface — the page is informational. Probably OOS for cfw; if it is in scope, build a small calendar widget. |
| `PRICE MATCH GUARANTEE :: Policy Display ⚠️ REPEATERS` | `/price-match-guarantee` is a 404 on cfw (already in v1 page-level-404 list). Whole page is missing. Decision needed: deprecate or build. |
| `CART PAGE :: Tier Discount` | Cart components have no `tier`, `BulkDiscount`, or `VolumeDiscount` references. Genuine gap. |
| `CHECKOUT :: Payment Methods ⚠️ REPEATER` | No `PaymentMethod` / `payment-selector` / Stripe Element wiring in `app/checkout`. Gap. |
| `CHECKOUT :: Protection Plans ⚠️ NESTED REPEATER` | No `ProtectionPlan` / `warranty-upsell` references anywhere. Gap. |
| `MEMBER PAGE :: Streak Display` (CF-64k) | `actions/gamification.ts` exposes `getStreakData` / `recoverStreak`, but **no** `StreakDisplay` UI component on `/dashboard`. Backend exists, UI does not. |
| `MEMBER PAGE :: Streak Display` (Phase 2 Streak Multipliers) | Same backend path as above; UI gap. |
| `MEMBER PAGE :: Rewards ⚠️ REPEATER` | `actions/loyalty.ts` exposes loyalty calls; only `PreferencesForm.tsx` references "rewards". No structured rewards list/card UI on `/dashboard`. Gap. |
| `BLOG :: Author Bio` | No `AuthorBio` / `BlogAuthor` component in `app/blog` or `components/blog`. Gap. |
| `REFERRAL PAGE :: How It Works ⚠️ REPEATER` | `/referral` renders `ReferralDashboard`; no "How it works" explainer block. Gap. |

### 🔒 auth-walled / client-rendered — needs hydrated probe (7)

These either live on auth-walled pages (admin, dashboard) or are client-rendered (only the master shell hits curl). v2.1 marked them ▢ unprobed; classification here is "cannot confirm by static greps either, because of complexity / runtime-only state." Polecats should defer until a Playwright + logged-in session probe runs.

- `WHITE GLOVE DELIVERY :: Calendar (Date Picker) ⚠️ REPEATER`
- `WHITE GLOVE DELIVERY :: Window Selector ⚠️ REPEATER`
- `ADMIN A/B TESTS :: Experiments ⚠️ REPEATER` (page is 404 to anonymous probe; admin gate)
- `UGC GALLERY :: Related Clusters ⚠️ REPEATER`
- `UGC GALLERY :: Denominations ⚠️ REPEATER`
- `UGC GALLERY :: Commerce`
- `UGC GALLERY :: Page-level Elements`

UGC gallery is its own larger triage thread (the v2 report flagged 14 UGC items; most landed in unprobed/yes via aliases in v2.1 but these 4 remain).

### ⏸️ out-of-scope — release-note / future-wiring placeholders (4)

These rows in the hookup guide are status banners or "future wiring" placeholders, not feature checklist items. They shouldn't be evaluated against cfw at all. Suggest filtering at parse time or annotating with a `scope: future|release-note` flag.

- `STYLE QUIZ :: Future Wiring — Leaderboard Page`
- `STYLE QUIZ :: Future Wiring — Challenge of the Week (Homepage)`
- `STYLE QUIZ :: Phase 7 Shipped (2026-04-13)`
- `STYLE QUIZ :: Phase 8 Shipped (2026-04-13)`

## Bonus check — h4 `Implementation` blocks (post-cf-qdxi v4.6)

Re-grep of `EDITOR_HOOKUP_GUIDE.html` for `<h4>` Implementation template strings:

| Metric | Result |
|---|---:|
| `impl: ` template-literal blocks | 285 |
| Properly closed (matching backtick) | 285 |
| Unclosed | 0 |
| Heading-only (`<h4>...</h4>` with no body content) | 0 |

cf-qdxi v4.6 added a static "v4.6 Refresh" section above the dynamic Feature Log without touching the `impl:` template strings. **No blank-screen regression introduced.** If Stilgar still sees a blank section in practice, it's a stale-render / cache issue — hard-reload and re-verify.

## Recommended next-round work for polecats

1. **Three quick alias-and-inventory work** (one bead, ≤30 min):
   - Extend `scripts/cf-ah0m/inventory_cfw.py` to also harvest `id="..."` attributes (not just `data-slot` / `data-testid`).
   - The Sustainability Certifications alias added in this PR will then fire and promote that row to ✓.
   - Re-run the pipeline to capture the lift.

2. **A11y skip-link** (one bead, ≤30 min): add a `SkipLink` component in cfw `MasterLayout` to satisfy the `MASTER PAGE :: Accessibility` row.

3. **Member dashboard UI for backend-already-shipped features** (small batch, 2-4 hours): wire `StreakDisplay` and `Rewards` UI components against the existing `actions/gamification.ts` + `actions/loyalty.ts` server actions. Backend exists; just needs UI.

4. **Decide-and-do on the four 404 pages** (decision bead): `/price-match-guarantee`, `/wishlist`, `/wishlist-share`, `/sign-in`, `/fabric-swatches`. Each is either dead-and-document, redirect-and-document, or rebuild — five short scoping calls.

5. **Hydrated DOM probe** (P3 — depends on Playwright auth session work): unlocks the 7 auth-walled / client-rendered residuals. Defer until the rest of the email infra (cf-c6g5) lands and the dashboard E2E surface stabilises.

## Source artifacts

- `scripts/cf-ah0m/feature-aliases.json` — alias map (this PR adds the `certifications` row).
- `scripts/cf-ah0m/{parse_guide,inventory_cfw,dom_probe,match_v2,forward_drift,build_report_v2}.py` — pipeline (no changes; classification was done by hand for triage).
- `cfw-parity-audit-2026-05-04.md` — v2.1 canonical report on `main` (PR #1148, merged).

Refs cf-ah0m, cf-o2kq, cf-bdkq, cf-qdxi.
