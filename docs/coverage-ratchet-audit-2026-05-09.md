# Coverage Ratchet Audit — 2026-05-09

**Verifies:** the ratchet automation shipped in carolina-futons-web #470 and carolina-futons #1158.
**Audit window:** 2026-05-09, ~14:30–14:50 UTC, immediately after both setup PRs merged.

## TL;DR

The script + workflow are working. **Auto-PR creation is blocked by a repo-level setting** on all three carolina-futons repos. Each ratchet is one settings flip away from being fully hands-off.

## What I verified

### 1. Workflow files landed and trigger correctly

| Repo | File | First run after merge |
| --- | --- | --- |
| carolina-futons-web | `.github/workflows/coverage-ratchet.yml` | run `25603567683` (push to main, conclusion: success — the merge of #470 itself) |
| carolina-futons | `.github/workflows/coverage-ratchet.yml` | run `25603879244` (push to main, in-progress at audit time) |
| carolina-futons-stage3-velo | n/a — no vitest/coverage setup yet (option 3 from Melania's pickup list) | — |

### 2. Script execution succeeds end-to-end

cfutons-web run `25603645892` log shows the full sequence working:

- `actions/checkout@v6` → success
- `actions/setup-node@v6` → success
- `npm ci` → success
- `Unit tests with coverage (json-summary)` → success
- `Ratchet coverage thresholds` → success (script detected drift; pushed branch `chore/coverage-ratchet-bump` at `52f7743`)
- `Open PR if thresholds bumped` → **FAILURE**

### 3. The blocker — `GitHub Actions is not permitted to create or approve pull requests`

```
##[error]GitHub Actions is not permitted to create or approve pull requests.
- https://docs.github.com/rest/pulls/pulls#create-a-pull-request
```

`peter-evans/create-pull-request@v7` does the right things in order: pushes the branch, then `POST /repos/{owner}/{repo}/pulls`. The push works (so `permissions.contents: write` is honored). The POST is rejected by GH itself because of a repo-level setting separate from workflow permissions.

API check across all three repos:

```
$ gh api /repos/DreadPirateRobertz/carolina-futons-web/actions/permissions/workflow
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
$ gh api /repos/DreadPirateRobertz/carolina-futons/actions/permissions/workflow
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
$ gh api /repos/DreadPirateRobertz/carolina-futons-stage3-velo/actions/permissions/workflow
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
```

`can_approve_pull_request_reviews: false` is the API surface for the UI toggle that controls both PR creation and PR approval by GH Actions, despite the field name.

## Owner-only fix

For each repo: **Settings → Actions → General → Workflow permissions → enable "Allow GitHub Actions to create and approve pull requests"**.

Or in API form (requires admin token):

```
gh api -X PUT /repos/DreadPirateRobertz/carolina-futons-web/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
```

After the flip, the next push to main with measurable coverage gain self-opens the PR. No code change to `coverage-ratchet.yml` is needed.

## What I manually unblocked

- Opened **carolina-futons-web#474** by hand from the auto-pushed branch `chore/coverage-ratchet-bump` (`52f7743`) so the first cfutons-web ratchet lands without waiting on the settings flip.
- The cfutons run was still in-progress at audit time. If it pushes a similar branch, will need the same manual PR-open until the setting is flipped.

## Out of scope

- carolina-futons-stage3-velo has no vitest coverage setup at all. Porting the v8 + json-summary + ratchet pattern over there is Melania's "option 3" pickup — separate bead.
- Whether the scripts produce *correct* numbers under all conditions (large fluctuations, removed files, etc.) — covered by the local smoke runs in #470 and #1158; not re-validated here.
