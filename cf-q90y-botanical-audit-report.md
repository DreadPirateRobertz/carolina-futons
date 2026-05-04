# cf-q90y — Botanical/Lineart Grep Audit Report

**Bead:** cf-q90y
**Author:** radahn
**Date:** 2026-05-04
**Audit base:** `origin/main` @ commit `37b55fb` (post PRs #406, #414, #415, #416)
**Verdict:** **AUDIT NOT CLEAN — 9 orphan components flagged; regex needs scoping.**

---

## TL;DR

The bead's regex
`Botanical|LineSky|BotanicalMountain|BotanicalTimeline|BotanicalGuides|BotanicalReviews|BotanicalVisitUs|BotanicalDesignARoom|ContactHero|BlueRidgeTimeline|MountainSkyline|FooterMountainDivider|StargazingHero|LivingSky`
returns 30 file hits on `origin/main`. After classification:

- **0 real production blockers** — no live page or component imports a deleted v2 illustration.
- **9 orphan files** (production code consumed only by their own tests) — recommend follow-on PR to delete.
- **2 stale comments** referencing deleted components — cosmetic.
- **19 false positives** — the regex matches legitimate v3 keepers (`mascot/StargazingHero`, the `LivingSky*` family) and self-defining files.

---

## Section A — Real orphans (recommend deletion in a follow-on PR)

These components have **zero non-test consumers** on `origin/main`. They were
v2 botanical surfaces that the v3 mascot migration replaced. Each is now kept
alive only by its own test file. Recommend bundling all 11 files (9 components
+ 2 test files) into a single follow-on cleanup PR.

| Component | Only consumer | Notes |
|-----------|---------------|-------|
| `illustrations/BotanicalTimeline.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | Replaced by v3 mascot Blue Ridge scene on `/about`. |
| `illustrations/BotanicalMountainSkyline.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | Replaced by mascot porch scene on `/about` (per `about/page.tsx:22` comment confirming the swap). |
| `illustrations/BotanicalDesignARoom.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | `/design-a-room` now uses `mascot/StargazingHero` (`design-a-room/page.tsx:7`). |
| `illustrations/BotanicalReviews.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | No live consumer. |
| `illustrations/BotanicalFooterDivider.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | `MascotFooterDivider` is the v3 replacement; PR #415 just removed even that from the layout. |
| `illustrations/BotanicalGuides.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | No live consumer. |
| `illustrations/BotanicalVisitUs.tsx` | `__tests__/BotanicalIllustrations.test.tsx` | No live consumer. |
| `illustrations/AboutIllustrationClient.tsx` | `illustrations/TeamPortrait.tsx` (which is itself orphaned) + `__tests__/AboutIllustration.test.tsx` | Transitive orphan via `TeamPortrait`. |
| `illustrations/TeamPortrait.tsx` | `__tests__/AboutIllustration.test.tsx` | Only its own test consumes it. |

**Companion test files to delete with the components above:**

- `__tests__/BotanicalIllustrations.test.tsx` (covers all 7 Botanical components)
- `__tests__/AboutIllustration.test.tsx` (covers `AboutIllustrationClient` + `TeamPortrait`)

**Verification command** (re-run before opening the cleanup PR):

```bash
for f in BotanicalTimeline BotanicalMountainSkyline BotanicalDesignARoom \
         BotanicalReviews BotanicalFooterDivider BotanicalGuides \
         BotanicalVisitUs AboutIllustrationClient TeamPortrait; do
  echo "--- ${f}"
  grep -rn "from.*illustrations/${f}\|from.*['\"]@/components/illustrations/${f}" \
    /Users/hal/gt/carolina-futons-web/src --include='*.tsx' --include='*.ts'
done
```

Each section should report only the test file (and, for `AboutIllustrationClient`,
also `TeamPortrait`). If any page or component file appears, **stop** — it's a
real consumer and the migration plan needs revisiting.

---

## Section B — Stale comments (cosmetic, optional cleanup)

These are not functional blockers — they reference deleted components in
comments only. Worth removing in the same follow-on PR for tidiness:

| File:line | Comment | Recommended fix |
|-----------|---------|-----------------|
| `app/about/page.tsx:22` | `{/* v3 mascot porch scene — bear on Blue Ridge, replaces v2 BotanicalMountainSkyline */}` | Drop the `replaces v2 BotanicalMountainSkyline` clause once the orphan is deleted; otherwise leave for one cycle as a breadcrumb. |
| `components/site/SaleLightbox.tsx:62` | `// Simple Blue Ridge silhouette — same palette as MountainSkyline` | Replace `MountainSkyline` with `LivingSky` or just `the v3 hero scene`. |

---

## Section C — False positives (regex over-broad)

The bead regex catches several **legitimate v3 keepers** because their names
share prefixes with the v2 components being audited. None of these is a
blocker:

| Hit | Why it matches | Verdict |
|-----|----------------|---------|
| `components/mascot/StargazingHero.tsx` | regex includes `StargazingHero` | **Keep** — this is the v3 replacement (`PR #406` migrated `theme-c`/`design-a-room`/`LivingHero` to consume it). |
| `app/theme-c/page.tsx`, `app/design-a-room/page.tsx`, `components/home/LivingHero.tsx` | Each imports `mascot/StargazingHero` | **Keep** — legitimate v3 consumers. |
| All `LivingSky*` files (`illustrations/LivingSky.tsx`, `LivingSkyClient.tsx`, `LivingSkyErrorBoundary.tsx`, `lib/illustrations/living-sky.ts`, `living-sky-svg.ts`, `lib/hooks/useTimeOfDay.ts`) | regex includes `LivingSky` | **Keep** — `LivingSky` is the active illustration engine (5+ live consumers including `MrPopsHero`, `LivingHero`, the about page), not a v2 botanical. Recommend dropping `LivingSky` from future audit regexes — it's a v3 system, not a deletion target. |
| `components/theme-a/MrPopsHero.tsx` | imports `LivingSkyClient` | **Keep** — same reason as above. |
| All `__tests__/LivingSky*.test.*`, `__tests__/Header.test.tsx`, `__tests__/SpringSalePage.test.tsx`, `__tests__/illustrations.test.tsx`, `__tests__/living-sky-engine.test.ts` | Tests reference `LivingSky` (legit) or contain comments about deleted components (after my PRs #406/#414 cleaned imports) | **Keep** — tests for live components. |
| `lib/illustrations/about-illustrations-svg.ts` | references `Botanical` in comments/SVG IDs | **Keep** — backing data for `BotanicalIllustrations.test.tsx`. Will be orphaned and should be deleted alongside the components in Section A if there are no other consumers. *Not yet verified — flag for cleanup PR.* |

> **Recommendation for future audit beads:** scope the regex to v2-only names —
> drop `LivingSky` and `StargazingHero` (regex anchored to `illustrations/StargazingHero`
> only catches the deleted location). Otherwise every clean run will surface
> the same v3 "false positives" and create audit fatigue.

---

## Section D — Cross-check against design-migration-plan.md

Per `crew/melania/design-migration-plan.md`:

- **Deleted in earlier PRs (cf-3qt.8.13/.14/.15):** ✅ confirmed gone — `BlueRidgeTimeline`, `MountainSkyline`, `FooterMountainDivider`, `illustrations/StargazingHero`, `ContactHero`, plus their public/illustrations/*.svg assets.
- **Replaced in /shop/[category] PLPs:** the plan called for `MascotCategoryCard` to replace `FutonsCategory`/`MurphyCategory`/`PlatformCategory`/`MattressesCategory`. Those four `*Category` files are NOT in the regex, but I noticed they still exist in `illustrations/` — out of scope for this audit, but worth re-checking they're not orphans next pass.
- **Section A here is the long tail** — the v2 Botanical pages (about/design-a-room/etc.) that got mascot replacements but whose `Botanical*` components were never deleted alongside the page rewires.

---

## Acceptance check

- [x] Regex run, hits classified.
- [x] Production blockers: **0** (no live page/component imports deleted v2 names).
- [x] Orphan components flagged: **9** (Section A) — recommend follow-on bead.
- [x] Stale comments flagged: **2** (Section B).
- [x] False-positive analysis filed: **19** (Section C) — regex tightening recommended.
- [x] Report committed to `crew/melania/cf-q90y-botanical-audit-report.md`.

---

## Recommended next bead

**cf-q90y.1 — Delete orphaned Botanical/About illustration components**

- Delete the 9 component files listed in Section A.
- Delete the 2 test files (`BotanicalIllustrations.test.tsx`, `AboutIllustration.test.tsx`).
- Audit `lib/illustrations/about-illustrations-svg.ts` for non-test consumers and
  delete if confirmed orphan.
- Audit `FutonsCategory.tsx`, `MurphyCategory.tsx`, `PlatformCategory.tsx`,
  `MattressesCategory.tsx` while in the area (the migration plan said they
  were replaced by `MascotCategoryCard` — verify no live imports).
- Update the two stale comments in Section B.
- Verify `npx tsc --noEmit` and `npx next build` clean on Linux before PR.
- Use a single atomic commit (per melania's preference established in PR #414).

This is exactly the kind of cleanup PR I just shipped (PR #414 / cf-3qt.8.15)
— happy to take it if you spawn the bead.

---

## References

- `crew/melania/design-migration-plan.md` — the plan this audit verifies against.
- PR #406 (radahn) — deleted `BlueRidgeTimeline`, `MountainSkyline`, `FooterMountainDivider`, `illustrations/StargazingHero` and updated `theme-c`/`illustrations.test.tsx`.
- PR #414 (radahn) — deleted `ContactHero` + 4 orphaned SVGs in `public/illustrations/`.
- PR #415 — removed `MascotFooterDivider` from layout.
- Vercel/Next.js: this audit changes nothing at runtime; orphans add bundle weight only via the test runner (Section A files are not imported by any production code path).
