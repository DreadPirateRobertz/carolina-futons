# Codecov Integration Proposal — Cross-Repo Coverage Strategy

**Author:** godfrey (cfutons/crew)
**Date:** 2026-03-08
**For:** melania (PM / Final Arbiter)

---

## What This PR Does

Adds Codecov integration to `carolina-futons` CI pipeline:
- `.codecov.yml` — coverage thresholds, PR comment config, ignore patterns
- CI uploads coverage on every PR and nightly run
- Existing inline coverage comment preserved (Codecov adds its own too)
- `lcov` reporter added to vitest for Codecov's preferred format

## Why Codecov Over Our Inline Script

| Feature | Our Inline Script | Codecov |
|---------|-------------------|---------|
| PR coverage comment | Yes (basic table) | Yes (detailed diff, file tree, sunburst) |
| Historical tracking | No | Yes (trends over time) |
| Patch coverage | No | Yes (only new/changed lines) |
| Cross-repo dashboard | No | **Yes** |
| Branch comparison | No | Yes (base vs head) |
| Coverage badges | No | Yes (README badges) |
| Flags (unit/integration) | No | Yes |
| Carry-forward | No | Yes (partial CI runs) |

**Recommendation:** Keep both. Our inline script is immediate and zero-dependency. Codecov adds trend tracking and cross-repo visibility.

## Cross-Repo Rollout Plan

Melania should configure Codecov for all repos we maintain:

### Repos Needing Codecov

| Repo | Test Framework | Coverage Today | Priority |
|------|---------------|----------------|----------|
| `carolina-futons` | vitest + v8 | Yes (70/60/70 thresholds) | **Done (this PR)** |
| `wix-velo-mcp` | vitest | No CI at all | P1 — needs CI first |
| `carolina_futons_velO` | N/A (prod mirror) | N/A | Skip |

### Setup Steps Per Repo

1. **Add `CODECOV_TOKEN` secret** to GitHub repo settings
   - Get token from [codecov.io](https://app.codecov.io) after linking the org
   - Settings → Secrets → Actions → `CODECOV_TOKEN`
2. **Copy `.codecov.yml`** from carolina-futons (adjust thresholds per repo)
3. **Add `codecov/codecov-action@v5`** step to CI workflow
4. **Add `lcov` to coverage reporters** in test config

### Org-Level Setup (One-Time)

1. Sign up at [codecov.io](https://codecov.io) with GitHub org `DreadPirateRobertz`
2. Enable repos: carolina-futons, wix-velo-mcp
3. Generate org-level upload token (or per-repo tokens)
4. Set org-level defaults in Codecov dashboard:
   - Default target: 70%
   - Patch target: 70%
   - Require CI to pass: true

## Thresholds Strategy

| Metric | Current | Rationale |
|--------|---------|-----------|
| Project target | 70% | Matches vitest.config.js |
| Project threshold | 2% | Allow small dips without blocking |
| Patch target | 70% | New code should meet same bar |
| Patch threshold | 5% | More lenient for hotfixes |

These can be tightened as coverage improves. Current codebase is at ~70% lines.

## What Melania Needs To Do

1. **Create Codecov account** for `DreadPirateRobertz` org
2. **Add `CODECOV_TOKEN`** secret to carolina-futons repo
3. **Review and merge** this PR (CF-8v6o)
4. **Roll out to wix-velo-mcp** once it has CI (separate bead)
5. **Monitor** Codecov dashboard for coverage trends

## Nightly Integration

The nightly job already runs full test suite. With Codecov:
- Nightly uploads use `flags: nightly` — tracked separately
- Coverage drops caught before they reach a PR
- Historical data shows regression trends over days/weeks

---

*This proposal is part of CF-8v6o. The `.codecov.yml` and CI changes are in the same PR.*
