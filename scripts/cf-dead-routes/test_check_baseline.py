"""cf-69fi (cf-roadmap.5): tests for the dead-code regression-guard
comparator.

The comparator reads two inputs:
  - audit.py output (rows-by-name, e.g. /tmp/cf-dead-routes/results.json)
  - the committed baseline (scripts/cf-dead-routes/baseline.json)

It computes a diff per gated verdict and exits 0 (Week 1 soft-fail
prints to stderr) or non-zero (Week 2+ hard-fail) when the gated
counts rise above baseline. These tests pin the diff logic + the
gating modes — workflow wiring is tested separately by the CI job
itself.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _import_check():
    for mod in list(sys.modules):
        if mod == "check_baseline":
            del sys.modules[mod]
    import check_baseline  # type: ignore
    return check_baseline


def _row(name: str, verdict: str, bucket: list[str] | None = None) -> dict:
    return {
        "name": name,
        "gap_verdict": verdict,
        "bucket": bucket or [verdict.replace("OK-", "")],
    }


def test_count_gated_verdicts_returns_zero_for_clean_inventory():
    """An audit run with zero UNUSED-CAN-DELETE + zero DEAD-bucket rows
    must produce a clean count dict — the baseline-comparator gates on
    these two signals."""
    check = _import_check()
    rows = [
        _row("getOrders", "OK-WIRED", ["HTTP-EXPOSED"]),
        _row("trackShipment", "OK-INTENTIONAL-ANYONE", ["HTTP-EXPOSED-INTENTIONAL"]),
        _row("internalHelper", "VELO-INTERNAL", ["INTERNAL"]),
    ]
    counts = check.count_gated_verdicts(rows)
    assert counts["unused_can_delete"] == 0
    assert counts["dead_bucket"] == 0


def test_count_gated_verdicts_counts_unused_can_delete():
    """UNUSED-CAN-DELETE is the canonical 'safe to remove' verdict —
    the count must reflect every row carrying it so the gate trips
    when new methods slip into this state."""
    check = _import_check()
    rows = [
        _row("oldHelper", "UNUSED-CAN-DELETE", ["DEAD"]),
        _row("orphanWrap", "UNUSED-CAN-DELETE", ["DEAD"]),
        _row("alive", "OK-WIRED", ["HTTP-EXPOSED"]),
    ]
    counts = check.count_gated_verdicts(rows)
    assert counts["unused_can_delete"] == 2
    assert counts["dead_bucket"] == 2


def test_count_gated_verdicts_counts_dead_bucket_independently():
    """The DEAD bucket can appear without UNUSED-CAN-DELETE (rare —
    e.g. a method bucketed DEAD but with a cfw-low collision verdict).
    Count it independently so a regression there surfaces too."""
    check = _import_check()
    rows = [
        _row("ghostCall", "MAYBE-CFW-NAME-COLLISION", ["DEAD"]),
        _row("alive", "OK-WIRED", ["HTTP-EXPOSED"]),
    ]
    counts = check.count_gated_verdicts(rows)
    assert counts["unused_can_delete"] == 0
    assert counts["dead_bucket"] == 1


def test_diff_against_baseline_clean():
    """No-delta case: current counts match baseline → no regression."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 5, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    assert delta["unused_can_delete"] == 0
    assert delta["dead_bucket"] == 0
    assert check.is_regression(delta) is False


def test_diff_against_baseline_regression():
    """Count rises → regression. is_regression flags the gate hit."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 8, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    assert delta["unused_can_delete"] == 3
    assert delta["dead_bucket"] == 0
    assert check.is_regression(delta) is True


def test_diff_against_baseline_improvement_no_regression():
    """Count drops → improvement, not regression. The operator gets
    a 'you can ratchet down the baseline now' hint via the negative
    delta; is_regression stays False."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 3, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    assert delta["unused_can_delete"] == -2
    assert check.is_regression(delta) is False


def test_diff_handles_missing_baseline_keys_as_zero():
    """First-time CI run: baseline.json doesn't yet have a key (or has
    just been merged with a partial schema). Treat missing keys as 0
    so any new gated verdict reports as full regression rather than
    KeyError-crashing the CI step."""
    check = _import_check()
    baseline = {}  # empty baseline
    current = {"unused_can_delete": 3, "dead_bucket": 5}
    delta = check.diff_against_baseline(current, baseline)
    assert delta["unused_can_delete"] == 3
    assert delta["dead_bucket"] == 5
    assert check.is_regression(delta) is True


def test_format_report_includes_per_verdict_counts(capsys):
    """Report rendering — operator-facing markdown for the PR annotation.
    Must include both gated counts so the operator can see at a glance
    which dimension regressed."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 8, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    report = check.format_report(current, baseline, delta)
    assert "unused_can_delete" in report
    assert "dead_bucket" in report
    # New row count visible in the report.
    assert "+3" in report or "3" in report


def test_format_report_no_regression_says_so():
    """Clean case: report is brief + signals 'OK' so PR readers
    aren't left wondering whether the gate fired silently."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 5, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    report = check.format_report(current, baseline, delta)
    assert "OK" in report or "no regression" in report.lower()


def test_exit_code_week_1_soft_fail():
    """Week 1 (soft-fail) mode: exit code 0 even on regression — the
    PR annotation is the signal, not the merge block. mode='soft' must
    always return 0."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 8, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    code = check.exit_code_for_mode(delta, mode="soft")
    assert code == 0


def test_exit_code_week_2_hard_fail():
    """Week 2+ (hard-fail) mode: exit non-zero on regression so the
    GitHub Actions check turns red and merge is blocked."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 8, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    code = check.exit_code_for_mode(delta, mode="hard")
    assert code != 0


def test_exit_code_hard_mode_clean_returns_zero():
    """Hard-fail mode must still pass when no regression — otherwise
    every PR would fail."""
    check = _import_check()
    baseline = {"unused_can_delete": 5, "dead_bucket": 7}
    current = {"unused_can_delete": 5, "dead_bucket": 7}
    delta = check.diff_against_baseline(current, baseline)
    code = check.exit_code_for_mode(delta, mode="hard")
    assert code == 0
