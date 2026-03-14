# Carolina Futons — Testing Procedure

**Status**: MANDATORY — all crew must read before writing any test code.
**Location**: `docs/TESTING-PROCEDURE.md`
**Last updated**: 2026-03-14

---

## 1. Pre-Flight Checklist

Before writing a single line of test code, complete these steps in order:

- [ ] Pull latest main: `git checkout main && git pull origin main`
- [ ] Verify green baseline: `npm test` — all tests must pass before you start
- [ ] Read `tests/CONVENTIONS.md` — import path rules (the #1 CI-breaking issue)
- [ ] Identify the source file(s) you're testing — check if tests already exist in `tests/`
- [ ] Create a feature branch from main: `git checkout -b test-<bead-id>-<description>`

If the baseline is broken (tests failing on main), STOP and report to melania. Do not build on a broken foundation.

---

## 2. TDD Workflow (Red-Green-Refactor)

Every test follows this cycle. No exceptions.

### Step 1: RED — Write a Failing Test

```bash
# Write your test file first
# Run it — it MUST fail
npx vitest run tests/yourModule.test.js
```

If your test passes before you write implementation, something is wrong:
- The feature already exists (check the source)
- Your test isn't actually testing what you think
- Your mock is returning the expected value by default

### Step 2: GREEN — Write Minimum Implementation

Write the simplest code that makes the test pass. No more.

```bash
npx vitest run tests/yourModule.test.js
```

### Step 3: REFACTOR — Clean Up

With tests green, improve the code:
- Remove duplication
- Improve naming
- Simplify logic

```bash
# Verify everything still passes
npm test
```

### Step 4: REPEAT

Add the next test case. Go back to Step 1.

---

## 3. Test File Structure

### Naming

| Source file | Test file |
|---|---|
| `src/pages/Product Page.js` | `tests/productPage.test.js` |
| `src/public/footerContent.js` | `tests/footerContent.test.js` |
| `src/backend/promotions.web.js` | `tests/promotions.test.js` |

One test file per source file. No multi-source test files.

### Template

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (BEFORE imports) ──────────────────────────────────────

vi.mock('wix-data', () => ({ /* ... */ }));

// ── Import module under test ────────────────────────────────────

const { myFunction } = await import('../src/public/myModule.js');

// ── Tests ───────────────────────────────────────────────────────

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does the expected thing', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('handles edge case', () => {
    expect(myFunction(null)).toBeNull();
  });

  it('throws on invalid input', () => {
    expect(() => myFunction(-1)).toThrow();
  });
});
```

### Describe/It Conventions

- `describe` blocks group by function or feature
- `it` descriptions start with a verb: "returns", "throws", "filters", "handles"
- Test the happy path first, then edge cases, then error cases

---

## 4. Import Rules (CI-Critical)

**This is the #1 cause of CI failures.** Read carefully.

### Dynamic imports (module under test)

```js
// CORRECT — relative path within this repo
const { fn } = await import('../src/public/myModule.js');
const { handler } = await import('../src/pages/Product Page.js');
const { webFn } = await import('../src/backend/service.web.js');

// WRONG — references sibling repo (DOES NOT EXIST IN CI)
const { fn } = await import('../carolina-futons-stage3-velo/src/public/myModule.js');
```

The `../carolina-futons-stage3-velo/` path works locally when both repos are cloned side by side. **It does not exist in CI.** The CI guard grep will reject your PR if you use it.

### Bare specifiers (mocked dependencies)

```js
// These resolve via vitest.config.js aliases
vi.mock('wix-data', () => ({ query: vi.fn() }));
vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('backend/seoHelpers.web', () => ({ getPageTitle: vi.fn() }));
```

### Adding new aliases

If your test needs a bare specifier that isn't in `vitest.config.js`, add both forms:

```js
// In vitest.config.js resolve.alias:
'public/newModule.js': path.resolve(__dirname, 'src/public/newModule.js'),
'public/newModule': path.resolve(__dirname, 'src/public/newModule.js'),
```

---

## 5. Mocking Patterns

### $w Mock (Page-Level Tests)

Page files use Wix's `$w` selector. Mock it before importing:

```js
const mockElements = {};
const mockW = vi.fn((selector) => {
  const id = selector.replace('#', '');
  if (!mockElements[id]) {
    mockElements[id] = {
      text: '', html: '', src: '', alt: '', label: '',
      value: '', placeholder: '', checked: false,
      collapsed: false, hidden: false, enabled: true,
      show: vi.fn(), hide: vi.fn(), expand: vi.fn(),
      collapse: vi.fn(), enable: vi.fn(), disable: vi.fn(),
      onClick: vi.fn(), onKeyPress: vi.fn(), onChange: vi.fn(),
      onMouseIn: vi.fn(), onMouseOut: vi.fn(), onInput: vi.fn(),
      onViewportEnter: vi.fn(), onViewportLeave: vi.fn(),
      scrollTo: vi.fn(), focus: vi.fn(),
      style: { backgroundColor: '', color: '' },
      children: [], parent: null,
      type: '$w.TextInput',
    };
  }
  return mockElements[id];
});

// Repeater support
mockW.onReady = vi.fn((cb) => cb());

globalThis.$w = mockW;
```

### Wix Platform Modules

Platform mocks live in `tests/__mocks__/`. They auto-reset via `tests/setup.js` `beforeEach`.

- `wix-data` — query builder chain: `.eq()`, `.find()`, `.insert()`, `.update()`
- `wix-fetch` — `fetch()` returns `{ json: vi.fn(), text: vi.fn(), ok: true }`
- `wix-location` / `wix-location-frontend` — `to()`, `url`, `query`
- `wix-stores-frontend` — cart operations
- `wix-members-backend` — member lookups

### Rules

1. **Mock before import** — `vi.mock()` calls must come before `await import()`
2. **Never mock what you're testing** — if testing `footerContent.js`, import it real
3. **Clear mocks in beforeEach** — `vi.clearAllMocks()` prevents test bleed
4. **Match real return shapes** — mock return values must match actual backend responses. A mock returning `{ bannerMessage }` when the real API doesn't is a false positive.

---

## 6. CI Requirements

Every PR must pass ALL of these before merge:

| Check | Requirement |
|---|---|
| `test (20)` | All tests pass on Node 20 |
| `test (22)` | All tests pass on Node 22 |
| `lint` | ESLint passes with zero errors |
| `codecov/patch` | New code meets coverage thresholds |
| Import guard | No `../carolina-futons-stage3-velo/` paths in test files |

### Coverage Thresholds

```
Lines:      70%
Branches:   60%
Functions:  70%
```

Run locally to check: `npm run test:coverage`

### Before Pushing

```bash
# Full validation — do this before every push
npm test                    # All tests pass
npm run lint                # No lint errors
npm run test:coverage       # Check thresholds (optional but recommended)
```

---

## 7. What to Test

### Always Test

- **Happy path** — normal inputs produce expected outputs
- **Edge cases** — empty arrays, null/undefined, zero, empty strings
- **Error paths** — invalid inputs, API failures, missing data
- **Return shape** — verify structure, not just truthiness

### Don't Test

- Wix platform internals (`$w` behavior, dataset lifecycle)
- Third-party library internals
- Pure pass-through functions with no logic
- Implementation details (private methods, internal state)

### Assertion Quality

```js
// WEAK — tells you nothing when it fails
expect(result).toBeDefined();
expect(result).toBeTruthy();

// STRONG — tells you exactly what's wrong
expect(result.name).toBe('Kingston Futon Frame');
expect(result.media).toHaveLength(2);
expect(result.media[0].newAlt).toContain('Main Product Image');
```

---

## 8. PR Checklist for Test PRs

Before creating the PR:

- [ ] All tests pass locally: `npm test`
- [ ] Lint passes: `npm run lint`
- [ ] No `../carolina-futons-stage3-velo/` import paths
- [ ] New vitest aliases added for any new bare specifiers
- [ ] PR title format: `test(<bead-id>): <description>`

After creating the PR:

- [ ] CI green on all checks
- [ ] 5-agent review completed (mandatory before merge)
- [ ] Codecov patch coverage acceptable

---

## 9. Common Pitfalls

| Pitfall | Fix |
|---|---|
| Tests pass locally, fail in CI | Check import paths — no sibling repo refs |
| Mock returns wrong shape | Compare mock to actual source return value |
| Test passes without implementation | Your mock is doing the work — tighten it |
| `beforeEach` not clearing state | Use `vi.clearAllMocks()` AND reset mock data arrays |
| Repeater `onItemReady` not firing | Set up `$w.onReady` mock to invoke callback |
| Test bleed between files | Check for global state mutation — use `beforeEach` reset |
| `wix-web-module` import errors | Add `vi.mock('wix-web-module', ...)` before source import |

---

## 10. Quick Reference

```bash
# Run all tests
npm test

# Run single test file
npx vitest run tests/myModule.test.js

# Run tests matching pattern
npx vitest run -t "returns products"

# Run with coverage
npm run test:coverage

# Watch mode (local dev)
npx vitest tests/myModule.test.js
```

### File Locations

| What | Where |
|---|---|
| Test files | `tests/*.test.js` |
| Wix mocks | `tests/__mocks__/` |
| Test setup | `tests/setup.js` |
| Vitest config | `vitest.config.js` |
| Import conventions | `tests/CONVENTIONS.md` |
| This document | `docs/TESTING-PROCEDURE.md` |
