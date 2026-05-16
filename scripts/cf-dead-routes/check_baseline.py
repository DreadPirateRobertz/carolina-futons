#!/usr/bin/env python3
"""cf-69fi (cf-roadmap.5): dead-code regression guard.

Runs `audit.py` (cf-hpwy v5), compares the gated verdict counts against
`scripts/cf-dead-routes/baseline.json`, and prints a markdown report
for the GitHub Actions PR annotation.

Modes:
  --mode=soft   Week 1: print report, exit 0 even on regression
                (annotation-only; merge stays unblocked).
  --mode=hard   Week 2+: exit non-zero on regression so the check
                turns red and merge is blocked.

The two gated verdicts are:
  - `UNUSED-CAN-DELETE` — the canonical 'safe to remove' signal
  - DEAD bucket presence — captures the rare case where a row buckets
    DEAD without UNUSED-CAN-DELETE (e.g. MAYBE-CFW-NAME-COLLISION on
    a DEAD-bucket row).

Usage (CI):
  python3 scripts/cf-dead-routes/audit.py    # populates /tmp/cf-dead-routes/results.json
  python3 scripts/cf-dead-routes/check_baseline.py --mode=soft

Update the baseline (ratchet-down after cleanup PRs):
  python3 scripts/cf-dead-routes/check_baseline.py --update-baseline
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_RESULTS = Path("/tmp/cf-dead-routes/results.json")
DEFAULT_BASELINE = HERE / "baseline.json"


def count_gated_verdicts(rows: list[dict]) -> dict[str, int]:
    """Return per-gate counts for the comparator.

    `unused_can_delete`: rows with gap_verdict == "UNUSED-CAN-DELETE"
    `dead_bucket`: rows whose bucket array contains "DEAD"
    """
    unused = 0
    dead = 0
    for r in rows:
        if r.get("gap_verdict") == "UNUSED-CAN-DELETE":
            unused += 1
        bucket = r.get("bucket") or []
        if "DEAD" in bucket:
            dead += 1
    return {"unused_can_delete": unused, "dead_bucket": dead}


def diff_against_baseline(
    current: dict[str, int],
    baseline: dict[str, int],
) -> dict[str, int]:
    """Return signed deltas per key. Missing baseline keys treated as 0
    so first-time runs surface the full current count as the regression."""
    keys = set(current) | set(baseline)
    return {k: current.get(k, 0) - baseline.get(k, 0) for k in keys}


def is_regression(delta: dict[str, int]) -> bool:
    """Any positive delta = regression. Improvements (negative deltas)
    are not regressions."""
    return any(v > 0 for v in delta.values())


def format_report(
    current: dict[str, int],
    baseline: dict[str, int],
    delta: dict[str, int],
) -> str:
    """Markdown report for the GitHub Actions PR annotation."""
    lines: list[str] = ["## cf-hpwy v5 — dead-code regression guard\n"]
    lines.append("| Verdict | Baseline | Current | Delta |")
    lines.append("|---|---:|---:|---:|")
    for key in sorted(set(current) | set(baseline)):
        d = delta.get(key, 0)
        d_str = f"+{d}" if d > 0 else str(d)
        lines.append(
            f"| {key} | {baseline.get(key, 0)} | {current.get(key, 0)} | {d_str} |"
        )
    lines.append("")
    if is_regression(delta):
        offenders = [k for k, v in delta.items() if v > 0]
        lines.append(
            f"⚠ Regression: {', '.join(offenders)} count rose vs baseline."
        )
        lines.append(
            "Investigate the new entries via `cat /tmp/cf-dead-routes/results.json | jq '.[] | select(.gap_verdict == \"UNUSED-CAN-DELETE\" or (.bucket | contains([\"DEAD\"])))'`."
        )
    else:
        lines.append("✅ OK — no regression versus baseline.")
    return "\n".join(lines)


def exit_code_for_mode(delta: dict[str, int], mode: str) -> int:
    """Pick the gate behavior:
      mode='soft' → always 0 (annotation-only).
      mode='hard' → non-zero on regression, 0 on clean.
    """
    if mode == "soft":
        return 0
    if mode == "hard":
        return 1 if is_regression(delta) else 0
    raise ValueError(f"unknown mode: {mode}")


def _load_rows(results_path: Path) -> list[dict]:
    if not results_path.exists():
        sys.stderr.write(
            f"cf-69fi: results file missing at {results_path}. "
            "Run `python3 scripts/cf-dead-routes/audit.py` first.\n"
        )
        sys.exit(2)
    return json.loads(results_path.read_text())


def _load_baseline(baseline_path: Path) -> dict[str, int]:
    if not baseline_path.exists():
        # First-time bootstrap: empty baseline → current counts surface as
        # the regression. Operator runs --update-baseline once to lock.
        return {}
    return json.loads(baseline_path.read_text())


def main() -> int:
    parser = argparse.ArgumentParser(description="cf-69fi dead-code regression guard")
    parser.add_argument(
        "--mode",
        choices=["soft", "hard"],
        default="soft",
        help="soft (Week 1, annotation-only) or hard (Week 2+, fail on regression)",
    )
    parser.add_argument(
        "--results",
        type=Path,
        default=DEFAULT_RESULTS,
        help="audit.py output JSON (default: /tmp/cf-dead-routes/results.json)",
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        default=DEFAULT_BASELINE,
        help="baseline JSON to compare against",
    )
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="rewrite the baseline file from the current results (ratchet-down convention)",
    )
    args = parser.parse_args()

    rows = _load_rows(args.results)
    current = count_gated_verdicts(rows)

    if args.update_baseline:
        args.baseline.write_text(json.dumps(current, indent=2) + "\n")
        sys.stderr.write(f"cf-69fi: baseline updated → {args.baseline}\n")
        sys.stderr.write(json.dumps(current, indent=2) + "\n")
        return 0

    baseline = _load_baseline(args.baseline)
    delta = diff_against_baseline(current, baseline)
    report = format_report(current, baseline, delta)
    print(report)
    return exit_code_for_mode(delta, args.mode)


if __name__ == "__main__":
    raise SystemExit(main())
