"""cf-69fi.fu1: skip-guard PR-title kill switch.

The dead-code regression guard (cf-69fi, .github/workflows/dead-code-guard.yml)
will flip to --strict mode after a Week-1 soft-fail observation period.
In strict mode, regressions block merges. Emergency hotfixes occasionally
need to bypass the gate (e.g. SSL cert expiry, security incident, rollback
of a third-party SDK that introduced un-detectable dead code).

The kill switch: a PR title containing `[skip-deadcode-guard]` (case-
insensitive, whitespace-tolerant inside the brackets) causes the workflow
to short-circuit with an audit-trail annotation. The audit message
includes the PR title verbatim so the bypass is logged for review.

**This is not a free pass.** The 5-agent CR mandate still applies, and
the kill switch must be justified in the PR body. The audit annotation
makes the bypass explicit in the PR's check-status panel.

Workflow integration:
  1. Run skip_guard_check.py as the first step
  2. Subsequent steps gate on `if: steps.skip.outputs.skip != 'true'`
  3. Emit the audit message via ::warning:: so reviewers see it

Driven by `.github/workflows/dead-code-guard.yml` (modified in cf-69fi.fu1
to add the skip-check gating step).

Run tests: `python -m pytest scripts/cf-dead-routes/test_skip_guard_check.py -v`
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# The kill-switch marker. Case-insensitive + tolerant of whitespace inside
# the brackets, but the brackets themselves are mandatory — we want the
# opt-in to be explicit + grep-able.
_SKIP_MARKER_RE = re.compile(r"\[\s*skip-deadcode-guard\s*\]", re.IGNORECASE)


def should_skip(pr_title: str | None) -> bool:
    """Return True if the PR title contains the explicit kill-switch marker.

    Empty / None / non-PR contexts return False — fail-closed so a
    push:main or workflow_dispatch run can't accidentally trigger skip
    via missing env.
    """
    if not pr_title:
        return False
    return bool(_SKIP_MARKER_RE.search(pr_title))


def audit_message(pr_title: str | None) -> str:
    """Return a GitHub Actions ::warning:: annotation for the workflow log
    when the guard is bypassed. Empty string when no bypass.

    Includes the verbatim PR title so the bypass is auditable post-merge.
    """
    if not should_skip(pr_title):
        return ""
    return (
        f"::warning::Dead-code guard bypassed via [skip-deadcode-guard] marker "
        f"in PR title: {pr_title}. Bypass must be justified in PR body; "
        f"5-agent CR mandate still applies (mayor's 2026-05-15 standing order)."
    )


def main() -> int:
    """Entry point invoked from the workflow.

    Reads PR_TITLE from env (set by the workflow from
    `github.event.pull_request.title` via the safe-env pattern), writes
    `skip=<true|false>` to $GITHUB_OUTPUT, emits the audit annotation
    if skipping. Always exits 0 — failure to read the title is treated
    as "don't skip" (fail-closed).
    """
    pr_title = os.environ.get("PR_TITLE")
    skip = should_skip(pr_title)

    gh_output_path = os.environ.get("GITHUB_OUTPUT")
    if gh_output_path:
        with Path(gh_output_path).open("a") as f:
            f.write(f"skip={'true' if skip else 'false'}\n")

    if skip:
        print(audit_message(pr_title), file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
