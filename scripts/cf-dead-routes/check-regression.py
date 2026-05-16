#!/usr/bin/env python3
"""cf-69fi — dead-code regression guard.

Reads the JSON output of `audit.py` (`/tmp/cf-dead-routes/results.json`) plus
a checked-in baseline (`scripts/cf-dead-routes/baseline.json`) and reports
whether the DEAD or UNUSED-CAN-DELETE counts regressed.

Modes:
    default (soft)  annotate stderr with ::warning::, exit 0 (don't block PR)
    --strict        also emit ::error::, exit 1 on regression (block PR)

Exit codes:
    0  no regression OR soft-mode (regression visible but not blocking)
    1  strict-mode regression
    2  infrastructure failure (missing file, malformed JSON, etc.)

Baseline format (scripts/cf-dead-routes/baseline.json):
    {
        "dead": 0,
        "unused_can_delete": 0,
        "version": 1
    }

Usage:
    python3 scripts/cf-dead-routes/check-regression.py \\
        --results /tmp/cf-dead-routes/results.json \\
        --baseline scripts/cf-dead-routes/baseline.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _exit(code: int, msg: str) -> int:
    """Print msg to stderr and return the exit code."""
    print(msg, file=sys.stderr)
    return code


def _load_json(path: Path, label: str) -> object | int:
    """Return parsed JSON, or an exit code (int) on failure."""
    if not path.exists():
        return _exit(2, f"error: {label} file not found: {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        return _exit(2, f"error: {label} file is not valid JSON ({e}): {path}")


def _validate_baseline(baseline: dict) -> int | None:
    """Return an exit code on invalid baseline, or None when valid."""
    if not isinstance(baseline, dict):
        return _exit(2, "error: baseline must be a JSON object")
    if "version" not in baseline:
        return _exit(
            2,
            "error: baseline missing required 'version' field — "
            "future format migrations require an opt-in flag, not a "
            "silent re-interpretation",
        )
    for field in ("dead", "unused_can_delete"):
        if field not in baseline or not isinstance(baseline[field], int):
            return _exit(2, f"error: baseline.{field} must be an integer")
        if baseline[field] < 0:
            return _exit(2, f"error: baseline.{field} must be non-negative")
    return None


def _count_buckets(rows: list) -> tuple[int, int, list[str], list[str]]:
    """Return (dead_count, unused_count, dead_names, unused_names)."""
    dead_names: list[str] = []
    unused_names: list[str] = []
    for r in rows:
        buckets = r.get("bucket", [])
        if "DEAD" in buckets:
            dead_names.append(r.get("name", "?"))
        if "UNUSED-CAN-DELETE" in buckets:
            unused_names.append(r.get("name", "?"))
    return len(dead_names), len(unused_names), dead_names, unused_names


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--results",
        type=Path,
        default=Path("/tmp/cf-dead-routes/results.json"),
        help="Path to audit.py output JSON (default: /tmp/cf-dead-routes/results.json)",
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        default=Path(__file__).parent / "baseline.json",
        help="Path to baseline JSON (default: scripts/cf-dead-routes/baseline.json)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 on regression instead of soft-fail. Week-2+ behavior.",
    )
    args = parser.parse_args(argv)

    results = _load_json(args.results, "results")
    if isinstance(results, int):
        return results
    if not isinstance(results, list):
        return _exit(2, "error: results.json must be a JSON array")

    baseline = _load_json(args.baseline, "baseline")
    if isinstance(baseline, int):
        return baseline
    err = _validate_baseline(baseline)
    if err is not None:
        return err

    dead_count, unused_count, dead_names, unused_names = _count_buckets(results)

    dead_delta = dead_count - baseline["dead"]
    unused_delta = unused_count - baseline["unused_can_delete"]

    # Healthy + improvement paths
    if dead_delta <= 0 and unused_delta <= 0:
        if dead_delta < 0 or unused_delta < 0:
            print(
                f"OK — counts below baseline (dead {baseline['dead']}→{dead_count}, "
                f"unused-can-delete {baseline['unused_can_delete']}→{unused_count}). "
                f"Consider ratcheting baseline.json down.",
                file=sys.stderr,
            )
        else:
            print(
                f"OK — no regression (dead={dead_count}, "
                f"unused-can-delete={unused_count}, both match baseline)",
                file=sys.stderr,
            )
        return 0

    # Regression path — at least one count rose.
    print("::warning::cf-69fi dead-code regression guard found new offenders", file=sys.stderr)
    print("", file=sys.stderr)
    print("Dead-code regression detected:", file=sys.stderr)
    print(
        f"  DEAD:              {baseline['dead']} (baseline) → "
        f"{dead_count} (current)  Δ={'+' if dead_delta > 0 else ''}{dead_delta}",
        file=sys.stderr,
    )
    print(
        f"  UNUSED-CAN-DELETE: {baseline['unused_can_delete']} (baseline) → "
        f"{unused_count} (current)  Δ={'+' if unused_delta > 0 else ''}{unused_delta}",
        file=sys.stderr,
    )
    print("", file=sys.stderr)

    if dead_delta > 0:
        print("New DEAD offenders:", file=sys.stderr)
        for name in dead_names[: 20]:
            print(f"  - {name}", file=sys.stderr)
        if len(dead_names) > 20:
            print(f"  ... and {len(dead_names) - 20} more", file=sys.stderr)
    if unused_delta > 0:
        print("New UNUSED-CAN-DELETE offenders:", file=sys.stderr)
        for name in unused_names[: 20]:
            print(f"  - {name}", file=sys.stderr)
        if len(unused_names) > 20:
            print(f"  ... and {len(unused_names) - 20} more", file=sys.stderr)

    if args.strict:
        print("", file=sys.stderr)
        print("::error::cf-69fi dead-code regression — strict mode is blocking the PR", file=sys.stderr)
        print(
            "If the new offenders are intentional (e.g. a new endpoint being "
            "wired up across multiple PRs), update baseline.json and re-run.",
            file=sys.stderr,
        )
        return 1

    print("", file=sys.stderr)
    print(
        "Soft-fail mode: PR is NOT blocked. To make this hard-fail, "
        "pass --strict (Week-2+ behavior per cf-69fi).",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
