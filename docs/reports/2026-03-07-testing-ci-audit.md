# Testing & CI System Audit

**Author:** rennala | **Date:** 2026-03-07 | **Bead:** CF-bqz

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Test files | 258 |
| Total tests | 9,978 |
| All passing | Yes (0 failures, 0 skips) |
| Test code lines | ~99,233 |
| Execution time | ~16s local, ~1m45s CI |
| Coverage thresholds | None configured |
| CI caching | None configured |
| Flaky tests | 0 currently, 1 historical (fixed) |
| Quality gates | None enforced |

The testing infrastructure is solid for its size. Primary gaps are operational: no coverage enforcement, no dependency caching, and no quality gates. Test quality is high with comprehensive mocking of 20 Wix platform modules.

---

## 1. Vitest Configuration

**File:** `vitest.config.js`

| Setting | Value |
|---------|-------|
| Framework | Vitest v4.0.18 |
| Environment | Node.js (no browser/jsdom) |
| Globals | Enabled |
| Pattern | `tests/**/*.test.js` |
| Setup file | `tests/setup.js` |
| Coverage | Not configured |

**Module aliases:** 160+ path aliases mapping Wix Velo imports (`public/`, `backend/`, `wix-*`) to local source and mock files. This enables testing Wix Velo code in a standard Node environment.

**Setup file** (`tests/setup.js`): Runs `beforeEach()` to reset all 20 Wix mock modules, plus mock `sessionStorage`/`localStorage`. Prevents cross-test pollution.

**Mock infrastructure:** 20 Wix module mocks in `tests/__mocks__/` covering wix-data, wix-crm-backend, wix-fetch, wix-stores-frontend, etc. The wix-data mock (6.4K) provides a full mock database with query chaining.

---

## 2. GitHub Actions CI

**File:** `.github/workflows/ci.yml`

### Pipeline Flow

```
ON PR or PUSH to main:
  test (Node 18)  ──┐
  test (Node 20)  ──┼── parallel, independent
  lint             ──┘

ON SCHEDULE (daily 6am UTC):
  nightly-integration → verbose output → upload artifacts
                      → auto-create GitHub issue on failure
```

### Jobs

| Job | Trigger | Node | Duration | Notes |
|-----|---------|------|----------|-------|
| test | PR, push | 18, 20 (matrix) | ~1m45s | `npm test` + coverage JSON |
| lint | PR, push | 20 | ~35s | `node --check` syntax only |
| nightly-integration | schedule | 20 | ~2m | junit + verbose, uploads artifacts, auto-creates issue |

### What's Missing

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No dependency caching** | +20-30s per run (305 packages) | Add `actions/cache@v4` for `~/.npm` |
| **No job timeouts** | Defaults to 6hr max | Add `timeout-minutes: 10` |
| **Lint is syntax-only** | `node --check` not full eslint | Run `npm run lint` (eslint) in CI |
| **No coverage gates** | Untested code ships freely | Add vitest coverage with thresholds |
| **No fail-fast ordering** | Lint + test run in parallel | Make test depend on lint (fail fast on syntax errors) |
| **No npm cache** | Fresh install every run | Cache node_modules or npm cache |

### Recent Failures

10 of last 30 runs failed. **All 10 failures are billing/account payment issues**, not code failures. Error: "The job was not started because recent account payments have failed or your spending limit needs to be increased." This is an account-level issue requiring action in GitHub Settings > Billing & plans. No actual test failures were found in any CI run.

### Nightly Integration Behavior

The `nightly-integration` job is gated by `if: github.event_name == 'schedule'` — it only runs on the daily 6am UTC cron, never on push/PR. When it fails, it auto-creates a GitHub issue with `bug` + `ci-nightly` labels. No scheduled runs appeared in recent history (likely suppressed by the billing issue).

---

## 3. Test Organization

### Structure

```
tests/
  __mocks__/     (20 Wix module mocks)
  fixtures/      (2 shared data files: products.js, engagement.js)
  setup.js       (global reset)
  *.test.js      (256 files, flat)
```

### Categories (by content, not directory)

| Category | Count | Examples |
|----------|-------|---------|
| Page modules | ~25 | masterPage, Home, Category Page, Product Page, FAQ |
| Public helpers | ~80 | galleryHelpers, mobileHelpers, cartService, designTokens |
| Backend services | ~50 | ups-shipping, catalogImport, emailService, deliveryScheduling |
| Frontend components | ~30 | ProductGallery, ProductOptions, AddToCart, StarRatingCard |
| Quality audits | ~10 | brandPalette, contrastAuditCI, inputSanitization, security |
| Illustration | ~15 | mountainSkylineFigma, aboutIllustrations, emptyStates |
| Integration-style | ~10 | checkoutFlow, cartCheckoutPolish, mountainSkylineIntegration |

One integration test file exists (`emailAutomation.integration.test.js`), but there is no naming convention enforced. No `.e2e.test.js` files exist.

### Minimal Test Files

| File | Tests | Note |
|------|-------|------|
| extract-svgs.test.js | 1 | Only checks output exists, no quality assertions |
| sideCartHandlers.test.js | 3 | Minimal cart handler coverage |

---

## 4. Reliability

### Current Flaky Tests: None

All 9,935 tests pass consistently. No `it.skip()` or `it.todo()` blocks found.

### Historical Issues (All Fixed)

| Issue | Fix Commit | Pattern |
|-------|-----------|---------|
| Stale date in deliveryScheduling | `08ebb70` | Changed hardcoded dates to `getNextDayOfWeek()` |
| UTC day shift in booking window | `de2c95e` | Fixed timezone edge case |
| Missing PriceHistory seed | `e964be5` | Added mock data seeding |
| Free shipping threshold mismatch | `ec0a39c` | Aligned test expectations |

### Date Staleness Risk

Several test files use hardcoded 2026-02 dates as test data. These are historical fixtures (not future dates) and work correctly, but could confuse maintainers. Files: `accountDashboard.test.js`, `affiliateProgram.test.js`, `blogContent.test.js`, `customerReviews.test.js`, `deliveryExperience.test.js`.

**Guideline:** Use `Date.now()` offsets for time-relative logic. Hardcoded dates are fine for static fixture data (order history, review dates, etc).

### Async Patterns (All Safe)

- 47+ files use `Date.now() +/- ms` correctly
- `vi.useFakeTimers()`/`vi.useRealTimers()` properly paired
- `vi.advanceTimersByTime()` used for timer-dependent tests
- No live API calls — all external dependencies mocked
- `setTimeout` waits used sparingly for fire-and-forget patterns (~50ms)

---

## 5. Coverage Gaps

### No Coverage Reporting

No c8, istanbul, or vitest coverage is configured. Coverage JSON is generated in CI (`npx vitest --coverage`) but:
- No thresholds are enforced
- No Codecov/SonarQube integration
- Results aren't posted to PRs

### Source Files Without Tests

**Backend (1 untested module out of 93):**
- `accessibility.web.js` — no dedicated test file

**Public helpers (14 untested out of 96):**
- `assemblyGuideHelpers.js`, `blogHelpers.js`, `cartStyles.js`, `checkoutProgress.js`
- `financingPageHelpers.js`, `MemberPageHelpers.js`, `navigationHelpers.js`
- `product360Data.js`, `pwaHelpers.js`, `referralPageHelpers.js`
- `socialProofToast.js`, `testProducts.js`, `tikTokPixel.js`, `validators.js`

**Pages:** All 39 page modules have some test coverage (often through their component modules).

### Structural Gaps

| Area | Gap | Risk |
|------|-----|------|
| E2E tests | None (no Playwright/Cypress) | UI regressions undetected |
| Visual regression | None | Design drift from design.jpeg |
| Performance tests | None | Page speed regressions |
| Wix Studio editor sync | No automated check | Element IDs in code vs editor can drift |
| Coverage tool | Not installed (`@vitest/coverage-v8`) | Can't measure actual line/branch coverage |

### Well-Covered Areas

- Backend services: comprehensive (catalogImport, ups-shipping, deliveryScheduling all have 15+ tests)
- Input sanitization: thorough (26 tests covering XSS, injection, boundary)
- Design token compliance: automated audits (brandPalette, contrastAudit, tokenCompliance)
- Accessibility: good coverage (a11yHelpers, focusTrap, announcements)
- Cart/checkout flow: extensive (cartService, checkoutFlow, checkoutOptimization)

---

## 6. Recommendations

### P0 — Quick Wins (< 1 hour each)

1. **Add npm caching to CI** — saves 20-30s per run
   ```yaml
   - uses: actions/cache@v4
     with:
       path: ~/.npm
       key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
   ```

2. **Add job timeouts** — prevent runaway jobs
   ```yaml
   jobs:
     test:
       timeout-minutes: 10
   ```

3. **Run full eslint in CI** — `node --check` only catches syntax errors
   ```yaml
   - run: npm run lint
   ```

### P1 — Medium Effort (1-4 hours)

4. **Configure coverage thresholds** in vitest.config.js:
   ```js
   coverage: {
     provider: 'v8',
     reporter: ['text', 'json-summary'],
     thresholds: { lines: 70, branches: 60, functions: 70 }
   }
   ```

5. **Add coverage reporting to PRs** — use Codecov or vitest JSON summary posted as PR comment

6. **Categorize tests** — add subdirectories or naming convention:
   - `tests/unit/`, `tests/integration/`, `tests/audit/`
   - Or suffix: `.unit.test.js`, `.integration.test.js`

### P2 — Strategic (Multi-day)

7. **Add Playwright visual regression** — screenshot key pages, compare against design.jpeg
8. **Add performance budget tests** — track bundle size, import counts
9. **Implement Wix editor sync check** — script to verify `$w('#id')` references match editor config

---

## Appendix: Key Files

| File | Purpose |
|------|---------|
| `vitest.config.js` | Test config, aliases, setup |
| `.github/workflows/ci.yml` | CI pipeline |
| `tests/setup.js` | Global mock reset |
| `tests/__mocks__/*.js` | 20 Wix platform mocks |
| `tests/fixtures/*.js` | Shared test data |
| `package.json` | Test scripts, deps |
