# Contributing to Carolina Futons

This project uses **Wix Studio + Velo (JavaScript)**. All backend logic lives in `src/backend/` as Wix web modules; UI widgets live in `src/public/`. Tests run via Vitest.

---

## Contribution Workflow

1. **Claim a bead** — `bd ready` to find available work. `bd update <id> --status=in_progress` when starting.
2. **Create a branch** from `main` — never PR from `main` directly.
3. **TDD first** — write failing tests before implementation. See [TDD Standards](#tdd-standards) below.
4. **Open a PR** — title format: `type(bead-id): short description`. Fill the test plan checklist.
5. **CI must be green** before requesting review — no exceptions.
6. **5-agent review** — all PRs get a `superpowers:code-reviewer` dispatch. Confidence filter ≥80.
7. **Check all test plan boxes** — unchecked items = tests not done = merge blocked.
8. **Merge** — squash merge to main after approvals + CI green.
9. **Close bead** — `bd close <id>` after merge.

### Branch Naming

```bash
feat/cf-abc-short-description    # new feature
fix/cf-abc-short-description     # bug fix
test/cf-abc-short-description    # tests only
chore/cf-abc-short-description   # deps, cleanup
docs/cf-abc-short-description    # documentation
rescue/cf-abc-short-description  # cherry-pick rescue from dead branch
```

**Never PR from `main`.** Always use a dedicated branch per bead.

---

## TDD Standards

**Test-Driven Development is mandatory.** No implementation without a failing test first.

### The TDD cycle

```
1. Write a failing test  →  2. Run it (verify FAIL)  →  3. Write minimal implementation
4. Run tests (verify PASS)  →  5. Refactor  →  6. Commit
```

### Coverage requirements

- **Lines**: ≥91% | **Branches**: ≥85% | **Functions**: ≥88% | **Statements**: ≥90%
- Pre-commit hook enforces these thresholds — fix coverage before committing.

### What to test

**Required — not optional:**

- **Happy path**: the normal success case
- **Empty/null inputs**: `null`, `undefined`, `[]`, `{}`
- **Auth failure**: unauthenticated + unauthorized member access
- **Outlier/edge cases**: boundary values, race conditions, concurrent calls
- **Error propagation**: DB errors, network failures, downstream service failures
- **Graceful degradation**: when one operation fails, others continue (`Promise.allSettled` not `Promise.all`)

**Happy-path-only tests will be rejected at review.** If your describe block has only one `it()`, you are not done.

### Test file location

- Root `tests/` — what CI runs. This is authoritative.
- `refinery/rig/tests/` — rig dev copies. Keep in sync with root.

### Running tests

```bash
# Full suite (from repo root)
cd /path/to/cfutons && npx vitest run

# Single file
cd /path/to/cfutons && npx vitest run tests/myService.test.js

# From refinery rig
cd refinery/rig && npx vitest run
```

---

## JSDoc-Style Function Briefs

Every exported function and webMethod **must** have a JSDoc brief. This is enforced at review.

```js
/**
 * Returns the active challenge for the current week, or null if none published.
 *
 * @param {string} [weekKey] - ISO week key (YYYY-Www). Defaults to current week.
 * @returns {Promise<Challenge|null>} The active challenge, or null.
 * @throws {Error} If the database query fails.
 *
 * WHY: Challenges are scoped to calendar weeks to prevent stale data surfacing
 * after the weekly reset cron runs on Monday 00:00 MT.
 */
export const getActiveChallenge = webMethod(Permissions.Anyone, async (weekKey) => {
```

**Required fields:** description, `@param` for each arg, `@returns`, `@throws` if applicable, `WHY` comment for non-obvious design decisions.

---

## Comment Conventions

**Comments explain WHY, not WHAT.** The code explains what. Comments explain the reasoning.

```js
// BAD — describes what the code does (obvious from reading it)
// Loop through members and send emails
for (const member of members) { ... }

// GOOD — explains why this approach was chosen
// Use Promise.allSettled so a single failed insert doesn't abort the entire
// fan-out batch — partial delivery is better than zero delivery.
await Promise.allSettled(members.map(m => sendEmail(m)));
```

**When to add a comment:**
- Non-obvious business rule or constraint
- Deliberate workaround for a platform limitation (Wix, UPS API, etc.)
- Why a simpler approach was rejected
- TOCTOU/race condition prevention logic

**Do not comment:**
- Variable declarations
- Obvious control flow
- What a function does (that's what JSDoc is for)

---

## Logging Standards

**Smart logging only** — log errors and meaningful state transitions. Do not log routine operations.

```js
// BAD — noise
console.log('Starting email loop');
console.log(`Sending email to ${memberId}`);
console.log('Email loop complete');

// GOOD — signal
console.error(`[gamificationNotifs] EmailQueue insert failed for ${memberId}:`, err);
console.log(`[gamificationNotifs] Challenge notif fan-out: ${sent} sent, ${failed} failed`);
```

**Log format:** `[module-name] message — relevant context`

**Always log:**
- Errors with full context (`console.error`)
- Final aggregate results of batch operations
- Unexpected state (e.g., query returned null when a row was expected)

**Never log:**
- Individual items in a loop (log the aggregate instead)
- Successful reads (only log writes + errors)
- Auth checks passing

---

## CI Gate

**CI must be green before merge. No exceptions.**

CI runs on all PRs targeting `main`. It does NOT run on PRs targeting feature branches — always base your PR on `main`.

CI checks:
- Vitest unit tests (Node 20 + 22 matrix)
- Coverage thresholds (statements 90%, branches 85%, functions 88%, lines 91%)
- CodeQL security analysis
- ESLint

To verify locally before pushing:

```bash
cd /path/to/cfutons && npx vitest run  # all tests
cd /path/to/cfutons && npx eslint src/ tests/ --ext .js
```

If CI is red: **do not ask for review**. Fix the failure first.

---

## PR Description Format

Every PR must include:

```markdown
## Summary
- Bullet 1: what changed and why
- Bullet 2: ...

## Coverage (new/modified files)
- `path/to/file.js`: X% lines, Y% functions, Z% branches

## Test plan
- [ ] `npx vitest run tests/myService.test.js` — N tests passing
- [ ] ESLint clean
- [ ] Edge case X tested (describe what)
- [ ] Error path Y tested (describe what)
- [ ] [Any external dep — e.g., Stilgar creates CMS collection]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**All `- [ ]` items must be checked before merge.** Unchecked = not done = blocked.

---

## Security

- **webMethod permissions**: Always specify `Permissions.Anyone`, `Permissions.Member`, or `Permissions.Admin` explicitly. Never omit.
- **suppressAuth**: Use `{ suppressAuth: true }` on wix-data queries that must bypass member permission gates (read-only public data).
- **Input validation**: Validate all external inputs at system boundaries. Use `isWixMediaUrl()` from `src/backend/utils/sanitize.js` for media URLs.
- **IDOR**: Never expose internal IDs or allow member A to read/write member B's data. All member-scoped queries must filter by `currentMember.getMember()`.
- **No direct exports from `.web.js`**: All public functions must use `webMethod()` — plain exports bypass auth.

---

## Wix/Velo Conventions

- **Backend**: `src/backend/<featureName>.web.js` — webMethods only, no UI code
- **Public**: `src/public/<WidgetName>.js` — UI init functions, no direct DB access
- **Pages**: `src/pages/<pageName>.js` — page-level orchestration, imports from public/
- **Utils**: `src/backend/utils/` — shared helpers (queryAll, sanitize, validateSchema, etc.)
- **Always use `queryAll()`** from `src/backend/utils/queryAll.js` for collections that may exceed 1,000 items (Wix page limit). Never assume a single `.find()` returns all results.

---

## Questions?

- Check existing beads: `bd list`
- Check open PRs: `gh pr list --repo DreadPirateRobertz/carolina-futons --state open`
- Reach melania (PM): `gt nudge cfutons/crew/melania 'message'`
