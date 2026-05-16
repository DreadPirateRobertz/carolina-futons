"""cf-69fi.fu2: tests for the auto-ratchet helper that opens a bot-PR
ratcheting baseline.json down when live dead-counts drop below it.

Mirrors the vitest coverage-ratchet pattern (cf-4x7e.B3/B4/B5/B5.fu).
Pure-function helpers — the workflow drives I/O. Tested in isolation
via tmp files; no git/gh side-effects.

Run: `python -m pytest scripts/cf-dead-routes/test_auto_ratchet.py -v`
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def _import_ar():
    for mod in list(sys.modules):
        if mod == "auto_ratchet":
            del sys.modules[mod]
    import auto_ratchet
    return auto_ratchet


def _write_baseline(path: Path, dead: int, ucd: int) -> None:
    path.write_text(json.dumps({
        "dead": dead,
        "unused_can_delete": ucd,
        "version": 1,
        "_meta": {"generated_at": "2026-05-15", "by": "test"},
    }, indent=2))


def _write_results(path: Path, dead: int, extra_ucd: int) -> None:
    """Mirror audit.py's results.json structure: list of row dicts.

    `dead` controls the DEAD-bucket rows (each also carries the
    UNUSED-CAN-DELETE verdict per audit.py's verdict chain).
    `extra_ucd` adds rows with UNUSED-CAN-DELETE verdict but a non-DEAD
    bucket (INTERNAL stand-in) — these are independent UCD rows beyond
    the DEAD-bucket ones. Result: live_counts returns dead=N, ucd=N+M.
    """
    rows = []
    for i in range(dead):
        rows.append({"bucket": ["DEAD"], "gap_verdict": "UNUSED-CAN-DELETE"})
    for i in range(extra_ucd):
        rows.append({"bucket": ["INTERNAL"], "gap_verdict": "UNUSED-CAN-DELETE"})
    path.write_text(json.dumps(rows))


# ── Count helpers ────────────────────────────────────────────────


def test_count_dead_from_results_zero(tmp_path):
    ar = _import_ar()
    results = tmp_path / "r.json"
    _write_results(results, dead=0, extra_ucd=0)
    counts = ar.live_counts(results)
    assert counts == {"dead": 0, "unused_can_delete": 0}


def test_count_dead_nonzero(tmp_path):
    ar = _import_ar()
    results = tmp_path / "r.json"
    _write_results(results, dead=3, extra_ucd=5)
    counts = ar.live_counts(results)
    # All DEAD bucket rows also carry the UNUSED-CAN-DELETE gap_verdict
    # per audit.py's verdict chain (the cf-5dto/cf-5dto.fu1 ordering),
    # plus 5 extra non-DEAD UCD rows → total 8.
    assert counts["dead"] == 3
    assert counts["unused_can_delete"] == 8


# ── Decision function ────────────────────────────────────────────


def test_no_ratchet_when_counts_match_baseline(tmp_path):
    """Clean state — live matches baseline. No PR needed."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=0, ucd=0)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 0, "unused_can_delete": 0})
    assert decision is None


def test_no_ratchet_when_live_above_baseline(tmp_path):
    """Live counts ROSE — that's the regression-guard's job, not auto-ratchet.
    auto-ratchet never raises baseline; it only lowers. Returns None."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=0, ucd=0)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 2, "unused_can_delete": 0})
    assert decision is None


def test_ratchet_when_dead_drops(tmp_path):
    """Live dead count dropped below baseline. Open a PR with the new floor."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=3)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 7, "unused_can_delete": 3})
    assert decision is not None
    assert decision["new_baseline"]["dead"] == 7
    assert decision["new_baseline"]["unused_can_delete"] == 3
    assert "10" in decision["pr_body"] and "7" in decision["pr_body"]


def test_ratchet_when_unused_can_delete_drops(tmp_path):
    """Live UNUSED-CAN-DELETE count dropped — independent ratchet axis."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=0, ucd=20)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 0, "unused_can_delete": 15})
    assert decision is not None
    assert decision["new_baseline"]["dead"] == 0
    assert decision["new_baseline"]["unused_can_delete"] == 15


def test_ratchet_only_drops_one_axis_when_other_unchanged(tmp_path):
    """Only ratchets the axes that actually moved — doesn't touch axes that
    stayed equal."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=5)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 8, "unused_can_delete": 5})
    assert decision is not None
    assert decision["new_baseline"]["dead"] == 8
    assert decision["new_baseline"]["unused_can_delete"] == 5


def test_ratchet_preserves_version_field(tmp_path):
    """The version field on baseline.json is part of the contract; preserve
    it across a ratchet write."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=0)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 5, "unused_can_delete": 0})
    assert decision["new_baseline"]["version"] == 1


def test_ratchet_refuses_when_live_partially_above_baseline(tmp_path):
    """Defensive case: if EITHER axis rose, refuse to ratchet either —
    that's a regression to address before any ratchet. The auto-ratchet
    bot should never let an upward drift on one axis hide behind a
    downward drift on another."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=5, ucd=10)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 7, "unused_can_delete": 8})
    assert decision is None


# ── PR body content ──────────────────────────────────────────────


def test_pr_body_includes_ratchet_summary(tmp_path):
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=5)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 7, "unused_can_delete": 3})
    body = decision["pr_body"]
    assert "dead: 10 → 7" in body
    assert "unused_can_delete: 5 → 3" in body
    assert "cf-69fi.fu2" in body  # bead reference


def test_pr_body_omits_unchanged_axis(tmp_path):
    """If only one axis moved, the PR body should only mention that axis."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=5)
    decision = ar.decide_ratchet(baseline=baseline, live={"dead": 7, "unused_can_delete": 5})
    body = decision["pr_body"]
    assert "dead: 10 → 7" in body
    assert "unused_can_delete:" not in body  # unchanged, don't mention


# ── Write contract ───────────────────────────────────────────────


def test_write_new_baseline(tmp_path):
    """write_baseline produces a valid JSON file with the new counts +
    preserves the _meta structure for human readability."""
    ar = _import_ar()
    baseline = tmp_path / "b.json"
    _write_baseline(baseline, dead=10, ucd=0)
    ar.write_baseline(baseline, {"dead": 5, "unused_can_delete": 0, "version": 1})
    parsed = json.loads(baseline.read_text())
    assert parsed["dead"] == 5
    assert parsed["unused_can_delete"] == 0
    assert parsed["version"] == 1
    assert "_meta" in parsed
    assert "auto-ratchet" in parsed["_meta"]["by"]
