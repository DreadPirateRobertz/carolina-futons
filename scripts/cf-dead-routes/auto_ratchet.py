"""cf-69fi.fu2: auto-ratchet helper for the dead-code regression guard.

When the live audit shows DEAD or UNUSED-CAN-DELETE counts below the
baseline, this module emits the new baseline + a PR body explaining
the ratchet. Mirrors the vitest coverage-ratchet automation pattern
(.github/workflows/coverage-ratchet.yml).

Driven by `.github/workflows/dead-code-baseline-ratchet.yml`:
  1. Workflow runs audit.py to produce results.json
  2. Workflow imports this module to decide whether to ratchet
  3. If yes — workflow writes new baseline.json + opens a PR

Decisions:
  - Live counts match baseline       → no-op (None)
  - Live count(s) rose vs baseline   → no-op (regression guard's job, not ours)
  - Live count strictly below        → emit ratchet decision
  - One axis rose + another fell     → refuse (regression hiding behind progress)

Pure-function design. No git/gh side-effects.

Run tests: `python -m pytest scripts/cf-dead-routes/test_auto_ratchet.py -v`
"""
from __future__ import annotations

import json
from pathlib import Path


def live_counts(results_path: Path) -> dict[str, int]:
    """Read audit.py's results.json and return the two ratchet-axis counts.

    `dead` counts rows whose bucket is exactly `["DEAD"]`.
    `unused_can_delete` counts rows whose gap_verdict is "UNUSED-CAN-DELETE"
    (regardless of bucket — a method can be UNUSED-CAN-DELETE while
    bucketing as something else, e.g. via the verdict-precedence chain).
    """
    rows = json.loads(Path(results_path).read_text())
    dead = sum(1 for r in rows if r.get("bucket") == ["DEAD"])
    ucd = sum(1 for r in rows if r.get("gap_verdict") == "UNUSED-CAN-DELETE")
    return {"dead": dead, "unused_can_delete": ucd}


def decide_ratchet(baseline: Path, live: dict[str, int]) -> dict | None:
    """Return a ratchet decision, or None if no ratchet is warranted.

    Decision shape:
      {
        "new_baseline": {"dead": N, "unused_can_delete": M, "version": V},
        "pr_body":      "<markdown explaining the drop>",
      }

    Contract:
      - If live counts match baseline on every axis: None
      - If any axis ROSE above baseline: None (regression-guard handles it)
      - If all axes are <= baseline AND at least one is strictly <: ratchet
      - If one axis rose AND another fell: None (defensive — don't hide
        the regression behind a progress)
    """
    base = json.loads(Path(baseline).read_text())
    base_dead = base.get("dead", 0)
    base_ucd = base.get("unused_can_delete", 0)
    version = base.get("version", 1)

    live_dead = live["dead"]
    live_ucd = live["unused_can_delete"]

    # Refuse if either axis is above baseline (regression — not our concern;
    # also refuses the "one up + one down" hide-the-regression case).
    if live_dead > base_dead or live_ucd > base_ucd:
        return None

    # No-op if both match exactly.
    if live_dead == base_dead and live_ucd == base_ucd:
        return None

    # At this point: both axes <= baseline, at least one strictly <.
    new_baseline = {
        "dead": live_dead,
        "unused_can_delete": live_ucd,
        "version": version,
    }

    body_lines = [
        "## Auto-ratchet (cf-69fi.fu2)",
        "",
        "Live dead-code audit shows count(s) below the checked-in baseline.",
        "This PR ratchets the baseline down — same shape as the vitest",
        "coverage-ratchet (cf-4x7e.B3/B4/B5/B5.fu).",
        "",
        "### Changes",
    ]
    if live_dead < base_dead:
        body_lines.append(f"- `dead: {base_dead} → {live_dead}`")
    if live_ucd < base_ucd:
        body_lines.append(f"- `unused_can_delete: {base_ucd} → {live_ucd}`")
    body_lines.extend([
        "",
        "### Why this is safe",
        "",
        "The dead-code regression guard (`.github/workflows/dead-code-guard.yml`)",
        "uses this baseline as the floor — counts above it trip the guard.",
        "Ratcheting the floor DOWN (this PR) tightens the gate; never raises it.",
        "Cleanup wave drift gets caught on the next PR after this lands.",
        "",
        "**Manual merge — never auto-merge.** 5-agent review still applies per",
        "mayor's 2026-05-15 standing order, but the diff is mechanical + the",
        "rationale is canonical (matches `_meta.ratchet_pattern` in baseline.json).",
    ])

    return {
        "new_baseline": new_baseline,
        "pr_body": "\n".join(body_lines),
    }


def write_baseline(path: Path, new: dict) -> None:
    """Write the new baseline JSON with a fresh _meta block referencing
    auto-ratchet so future readers see the provenance."""
    payload = {
        "dead": new["dead"],
        "unused_can_delete": new["unused_can_delete"],
        "version": new["version"],
        "_meta": {
            "generated_at": "auto-ratchet",
            "by": "cf-69fi.fu2 auto-ratchet bot",
            "context": (
                "Auto-ratcheted down by the cf-69fi.fu2 bot when live audit "
                "showed counts below the previous baseline. Mirrors the "
                "vitest coverage-ratchet pattern. See "
                ".github/workflows/dead-code-baseline-ratchet.yml + "
                "scripts/cf-dead-routes/auto_ratchet.py."
            ),
            "ratchet_pattern": (
                "Mirror of vitest coverage-ratchet (cf-4x7e.B3/B4/B5/B5.fu). "
                "Auto-ratchet only LOWERS — regressions trip the guard "
                "instead."
            ),
        },
    }
    Path(path).write_text(json.dumps(payload, indent=2) + "\n")
