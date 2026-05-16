"""cf-69fi — TDD tests for the dead-code regression guard.

Tests pin the contract for `check-regression.py` BEFORE the wrapper script
is implemented, per the 2026-05-15 TDD discipline standing order.

The guard reads audit.py's `/tmp/cf-dead-routes/results.json` output and
compares the DEAD + UNUSED-CAN-DELETE counts against a checked-in baseline
(`scripts/cf-dead-routes/baseline.json`). On regression:

  * default mode  — annotate stderr, exit 0 (soft-fail; PR is not blocked)
  * --strict mode — exit 1 (hard-fail; PR is blocked)

Week-1 plan ships SOFT mode. The flag flip to STRICT is a follow-up bead
(cf-69fi.fu1) once the soft signal proves itself.

Run:  python -m pytest scripts/cf-dead-routes/test_check_regression.py -v
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
GUARD = HERE / "check-regression.py"


def run_guard(
    *,
    results: list[dict],
    baseline: dict,
    strict: bool = False,
    tmp_path: Path,
) -> subprocess.CompletedProcess[str]:
    """Invoke the guard with fixture results + baseline files; capture exit."""
    results_path = tmp_path / "results.json"
    baseline_path = tmp_path / "baseline.json"
    results_path.write_text(json.dumps(results))
    baseline_path.write_text(json.dumps(baseline))
    cmd = [
        sys.executable,
        str(GUARD),
        "--results",
        str(results_path),
        "--baseline",
        str(baseline_path),
    ]
    if strict:
        cmd.append("--strict")
    return subprocess.run(cmd, capture_output=True, text=True)


# ── Fixtures ────────────────────────────────────────────────────────────


def _row(name: str, *buckets: str) -> dict:
    """Audit row shape: {name, file, line, bucket: [...]}."""
    return {
        "name": name,
        "file": f"src/backend/{name}.web.js",
        "line": 1,
        "bucket": list(buckets) or ["DEAD"],
    }


BASELINE_ZERO = {"dead": 0, "unused_can_delete": 0, "version": 1}
BASELINE_THREE = {"dead": 3, "unused_can_delete": 0, "version": 1}


# ── Contract 1: clean run (no regression) ──────────────────────────────


class TestNoRegression:
    def test_zero_dead_matches_zero_baseline_exits_0(self, tmp_path):
        """Healthy state: results match baseline exactly → exit 0."""
        results = [_row("alive1", "HTTP-EXPOSED")]
        cp = run_guard(results=results, baseline=BASELINE_ZERO, tmp_path=tmp_path)
        assert cp.returncode == 0
        assert "no regression" in cp.stderr.lower() or "ok" in cp.stderr.lower()

    def test_count_decrease_exits_0(self, tmp_path):
        """Below-baseline (improvement): exit 0 + suggest baseline ratchet."""
        results = [_row("alive", "HTTP-EXPOSED")]  # 0 dead
        cp = run_guard(results=results, baseline=BASELINE_THREE, tmp_path=tmp_path)
        assert cp.returncode == 0
        assert "ratchet" in cp.stderr.lower() or "below" in cp.stderr.lower()


# ── Contract 2: regression detected ────────────────────────────────────


class TestRegression:
    def test_dead_increase_above_baseline_soft_exits_0(self, tmp_path):
        """SOFT mode: regression visible in stderr, but exit stays 0.

        Week-1 behavior — annotate the PR, don't block the merge.
        """
        results = [_row("regressed1"), _row("regressed2")]  # 2 dead
        cp = run_guard(results=results, baseline=BASELINE_ZERO, tmp_path=tmp_path)
        assert cp.returncode == 0
        assert "regression" in cp.stderr.lower()
        # New offenders are named.
        assert "regressed1" in cp.stderr
        assert "regressed2" in cp.stderr

    def test_dead_increase_above_baseline_strict_exits_1(self, tmp_path):
        """STRICT mode: regression blocks the merge."""
        results = [_row("regressed1"), _row("regressed2")]
        cp = run_guard(
            results=results, baseline=BASELINE_ZERO, strict=True, tmp_path=tmp_path
        )
        assert cp.returncode == 1
        assert "regression" in cp.stderr.lower()

    def test_unused_can_delete_regression_also_tracked(self, tmp_path):
        """The guard tracks UNUSED-CAN-DELETE separately from DEAD.

        cf-hpwy v5 emits both buckets; a row CAN sit in both
        (DEAD ∩ UNUSED-CAN-DELETE). Guard sums each bucket independently
        so a regression on either flips the verdict.
        """
        results = [_row("orphan1", "UNUSED-CAN-DELETE")]
        baseline = {"dead": 0, "unused_can_delete": 0, "version": 1}
        cp = run_guard(
            results=results, baseline=baseline, strict=True, tmp_path=tmp_path
        )
        assert cp.returncode == 1
        assert "unused" in cp.stderr.lower() or "can-delete" in cp.stderr.lower()


# ── Contract 3: degraded / missing inputs ──────────────────────────────


class TestDegraded:
    def test_missing_results_file_exits_2_distinct_from_regression(
        self, tmp_path
    ):
        """No results.json → infrastructure failure (exit 2), not regression."""
        baseline_path = tmp_path / "baseline.json"
        baseline_path.write_text(json.dumps(BASELINE_ZERO))
        cp = subprocess.run(
            [
                sys.executable,
                str(GUARD),
                "--results",
                str(tmp_path / "does-not-exist.json"),
                "--baseline",
                str(baseline_path),
            ],
            capture_output=True,
            text=True,
        )
        assert cp.returncode == 2
        assert "results" in cp.stderr.lower()

    def test_missing_baseline_file_exits_2(self, tmp_path):
        """No baseline.json → infrastructure failure (exit 2)."""
        results_path = tmp_path / "results.json"
        results_path.write_text(json.dumps([]))
        cp = subprocess.run(
            [
                sys.executable,
                str(GUARD),
                "--results",
                str(results_path),
                "--baseline",
                str(tmp_path / "does-not-exist.json"),
            ],
            capture_output=True,
            text=True,
        )
        assert cp.returncode == 2
        assert "baseline" in cp.stderr.lower()

    def test_malformed_results_exits_2(self, tmp_path):
        """Non-JSON results → exit 2."""
        results_path = tmp_path / "results.json"
        results_path.write_text("not-json {{{")
        baseline_path = tmp_path / "baseline.json"
        baseline_path.write_text(json.dumps(BASELINE_ZERO))
        cp = subprocess.run(
            [
                sys.executable,
                str(GUARD),
                "--results",
                str(results_path),
                "--baseline",
                str(baseline_path),
            ],
            capture_output=True,
            text=True,
        )
        assert cp.returncode == 2


# ── Contract 4: GH Actions PR annotation format ────────────────────────


class TestAnnotation:
    def test_regression_emits_github_actions_warning_annotation(self, tmp_path):
        """Stderr contains a `::warning::` line GH Actions will surface.

        Workflow runs with `actions/upload-artifact` + this annotation so
        the PR check page links to the regression list.
        """
        results = [_row("new_dead", "DEAD")]
        cp = run_guard(results=results, baseline=BASELINE_ZERO, tmp_path=tmp_path)
        # Default (soft) mode still emits the warning annotation; strict adds
        # an ::error:: line on top.
        assert "::warning" in cp.stderr or "::warning::" in cp.stderr

    def test_strict_regression_emits_github_actions_error_annotation(
        self, tmp_path
    ):
        results = [_row("new_dead", "DEAD")]
        cp = run_guard(
            results=results, baseline=BASELINE_ZERO, strict=True, tmp_path=tmp_path
        )
        assert "::error" in cp.stderr or "::error::" in cp.stderr


# ── Contract 5: baseline.json format stability ─────────────────────────


class TestBaselineFormat:
    def test_baseline_requires_version_field(self, tmp_path):
        """A baseline without `version` is rejected — future format migrations
        need an opt-in flag, not a silent re-interpretation."""
        results_path = tmp_path / "results.json"
        results_path.write_text(json.dumps([]))
        baseline_path = tmp_path / "baseline.json"
        baseline_path.write_text(json.dumps({"dead": 0, "unused_can_delete": 0}))
        cp = subprocess.run(
            [
                sys.executable,
                str(GUARD),
                "--results",
                str(results_path),
                "--baseline",
                str(baseline_path),
            ],
            capture_output=True,
            text=True,
        )
        assert cp.returncode == 2
        assert "version" in cp.stderr.lower()

    def test_committed_baseline_file_is_well_formed(self):
        """The checked-in baseline must parse and contain the 3 required
        fields. This guards against accidental commit of a malformed file."""
        baseline_path = HERE / "baseline.json"
        if not baseline_path.exists():
            pytest.skip("baseline.json not yet committed")
        data = json.loads(baseline_path.read_text())
        assert "dead" in data
        assert "unused_can_delete" in data
        assert "version" in data
        assert isinstance(data["dead"], int)
        assert isinstance(data["unused_can_delete"], int)
        assert data["dead"] >= 0
        assert data["unused_can_delete"] >= 0
