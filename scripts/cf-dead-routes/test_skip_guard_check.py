"""cf-69fi.fu1: tests for the skip-guard PR-title kill switch.

The dead-code regression guard (cf-69fi) blocks merges on Week-2+ strict
mode. Emergency hotfixes may need an explicit escape hatch: a PR title
containing `[skip-deadcode-guard]` causes the workflow to short-circuit
with an audit-trail annotation.

Run: `python -m pytest scripts/cf-dead-routes/test_skip_guard_check.py -v`
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _import_sg():
    for mod in list(sys.modules):
        if mod == "skip_guard_check":
            del sys.modules[mod]
    import skip_guard_check
    return skip_guard_check


# ── Should-skip predicate ──────────────────────────────────────────


def test_title_with_marker_returns_skip():
    sg = _import_sg()
    assert sg.should_skip("fix(emergency): hotfix [skip-deadcode-guard]") is True


def test_title_without_marker_returns_no_skip():
    sg = _import_sg()
    assert sg.should_skip("feat(cf-69fi): regular feature work") is False


def test_marker_is_case_insensitive():
    sg = _import_sg()
    assert sg.should_skip("fix(x): emergency [SKIP-DEADCODE-GUARD]") is True
    assert sg.should_skip("fix(x): emergency [Skip-DeadCode-Guard]") is True


def test_marker_at_start():
    sg = _import_sg()
    assert sg.should_skip("[skip-deadcode-guard] urgent revert") is True


def test_empty_title_does_not_skip():
    """Defensive: an empty or missing title must NOT trigger skip.
    The kill switch is opt-in; failing to read the title should fail
    closed, not open."""
    sg = _import_sg()
    assert sg.should_skip("") is False
    assert sg.should_skip(None) is False


def test_partial_match_does_not_skip():
    """A title that contains the literal word 'skip' or 'deadcode' but
    NOT the bracketed marker must not trigger. The marker is the explicit
    opt-in signal — partial matches would let casual mentions bypass."""
    sg = _import_sg()
    assert sg.should_skip("fix(x): skip the broken test") is False
    assert sg.should_skip("docs: explain deadcode-guard rationale") is False
    assert sg.should_skip("fix(x): [skip-deadcode]") is False


def test_marker_with_extra_whitespace():
    """Operators sometimes pad the marker with spaces. Trim tolerantly."""
    sg = _import_sg()
    assert sg.should_skip("fix(x): emergency [ skip-deadcode-guard ]") is True


# ── Audit-trail rendering ──────────────────────────────────────────


def test_audit_message_on_skip():
    """When skipping, render an audit-trail line for the workflow log so
    the operator + future reviewer see WHY the guard was bypassed."""
    sg = _import_sg()
    msg = sg.audit_message("fix(emergency): hotfix [skip-deadcode-guard]")
    assert "skip-deadcode-guard" in msg.lower()
    assert "fix(emergency)" in msg
    # Annotation format compatible with GitHub Actions ::warning:: emission
    assert msg.startswith("::warning::")


def test_audit_message_no_skip_returns_empty():
    """When not skipping, no audit message needed (workflow proceeds
    normally and the regression check emits its own logging)."""
    sg = _import_sg()
    msg = sg.audit_message("feat(cf-69fi): regular work")
    assert msg == ""


# ── Entry point + exit code ────────────────────────────────────────


def test_main_skip_writes_to_github_output(monkeypatch, tmp_path):
    """When invoked as a workflow step, the helper writes
    `skip=true` to GITHUB_OUTPUT and exits 0."""
    sg = _import_sg()
    output = tmp_path / "output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("PR_TITLE", "fix(x): urgent [skip-deadcode-guard]")
    rc = sg.main()
    assert rc == 0
    assert "skip=true" in output.read_text()


def test_main_no_skip_writes_false(monkeypatch, tmp_path):
    sg = _import_sg()
    output = tmp_path / "output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.setenv("PR_TITLE", "feat(cf-69fi): regular feature work")
    rc = sg.main()
    assert rc == 0
    assert "skip=false" in output.read_text()


def test_main_missing_title_env_does_not_crash(monkeypatch, tmp_path):
    """workflow_dispatch + push events have no PR_TITLE. The helper must
    handle the missing-env case gracefully (treat as non-PR → don't skip)."""
    sg = _import_sg()
    output = tmp_path / "output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(output))
    monkeypatch.delenv("PR_TITLE", raising=False)
    rc = sg.main()
    assert rc == 0
    assert "skip=false" in output.read_text()
