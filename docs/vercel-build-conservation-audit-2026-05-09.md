# Vercel Build Conservation Audit — 2026-05-09

**Verifies:** Melania's "push complete PRs only" rule for `carolina-futons-web` (sent ~14:46 UTC on 2026-05-09 after she flagged Vercel build minutes near the account cap).
**Source:** `vercel ls carolina-futons-web --format json` (8 paginated pages, 160 deployments).
**Scope:** `carolina-futons-web` only — cfutons + stage3-velo do not hit Vercel.

## TL;DR

The rule is **plausibly helping** but the audit window is too short (≈ 1 hour post-rule) to claim conclusively. Strongest signal: deploy rate dropped from 24/hr immediately before the rule (14:00 UTC) to 3/hr in the hour the rule landed (15:00 UTC). The reference burn day for comparison (2026-05-05) was 121 deploys / day vs today's 27 — a ~4.5× reduction, but most of today's traffic was front-loaded into the pre-rule window.

## Per-day deploy counts (UTC, last week)

| Day | Total | Production | Preview | Build-min proxy (× 1.5) |
| --- | ---: | ---: | ---: | ---: |
| 2026-05-09 (today) | 27 | 11 | 16 | ~40.5 |
| 2026-05-08 | 0 | 0 | 0 | 0 |
| 2026-05-07 | 0 | 0 | 0 | 0 |
| 2026-05-06 | 0 | 0 | 0 | 0 |
| 2026-05-05 (peak) | **121** | 56 | 65 | ~181.5 |
| 2026-05-04 | 12 | 0 | 12 | ~18.0 |

(Days with zero counts are a true silence in the captured window — likely quiet Sat/Sun + Mon Memorial-day-adjacent.)

## Today, hour-by-hour (UTC)

| Hour | Total | Prod | Preview |
| --- | ---: | ---: | ---: |
| 14:00 | 24 | 9 | 15 |
| 15:00 | 3 | 2 | 1 |

The rule landed mid-hour 14 (≈ 14:46 UTC). The 14:00 bucket spans both pre- and post-rule activity; the 15:00 bucket is entirely post-rule. The 8× drop is consistent with the rule taking effect, but also consistent with end-of-session quiet — small sample.

## Authors today (UTC, all deploys)

| Author | Deploys today |
| --- | ---: |
| Chris Deal | 14 |
| github-actions[bot] | 3 |
| blaidd | 3 |
| miquella | 3 |
| onyx | 2 |
| jasper | 1 |
| millicent | 1 |

The bot deploys are mostly the auto-pushed `chore/coverage-ratchet-bump` branches from #470's workflow — those will keep firing on every main merge until the GH Actions auto-PR setting is flipped (separate from this rule). They're cheap (each is 1 build for 1 file change) but add up.

## 2026-05-05 burn day — reference baseline

| Hour | Total | Prod | Preview |
| --- | ---: | ---: | ---: |
| 01:00 | 8 | 0 | 8 |
| 02:00 | **53** | 26 | 27 |
| 03:00 | 17 | 8 | 9 |
| 06:00 | 1 | 1 | 0 |
| 07:00 | 22 | 11 | 11 |
| 08:00 | 18 | 9 | 9 |
| 12:00 | 2 | 1 | 1 |

53 deploys in a single hour is the worst single-hour bucket I can see in the captured window. That's almost twice today's full 14:00 hour and 17× the post-rule 15:00 hour.

## Billing snapshot (`vercel usage` — current period 2026-05-01 → today)

Major lines: `Pro` $5.33, `Fluid Active CPU` $0.12, `Observability Events` $0.10, `Fluid Provisioned Memory` $0.04, `Fast Origin Transfer` $0.01, `Image Optimization` ~$0.02. Effective + billed cost both $0 (Pro plan covers it). The `Pro` $5.33 is the seat charge; build minutes are bundled in the Pro plan up to a quota that the dashboard enforces but isn't broken out in this CLI view.

## Caveats

- **Build-minute proxy:** I'm multiplying deploy count by 1.5 min to estimate build-time spent. Vercel's `ls` view doesn't expose per-deploy duration in the JSON I get. Real per-build durations can range 30s (cached, no-op) to ~3min (cold/full-build). The 1.5 min figure is a midpoint sanity-check, not a billing reconciliation.
- **Audit window is short:** the rule landed today; I have ≈ 1 hour of post-rule data. A real before/after comparison wants ≥ 24 hr post-rule. Recommend re-running this audit on 2026-05-10 with a 24-hr window.
- **Author attribution noise:** several PRs today were merged by Chris (squash-merges = his name as author), even though the original commits came from other agents. The author column above counts deployment author per Vercel, not commit-history author.
- **Bot deploy count will inflate** until the `Allow GitHub Actions to create and approve pull requests` setting is flipped (per #1161). Each ratchet workflow run that succeeds in pushing the branch but fails to open the PR still triggers a Vercel preview build for the bumped branch.

## Recommendation

Re-run this audit at end-of-day 2026-05-10 (24-hr post-rule window) to confirm the reduction holds. If it does, the rule is the right call and no further action needed. If it doesn't, dig into whether specific agents need a refresher on the push-discipline.
