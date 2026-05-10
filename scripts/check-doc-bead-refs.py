#!/usr/bin/env python3
"""Scan docs/**/*.md for stale or typo'd `cf-XXXX` bead references.

cf-b8n8. Sibling to scripts/check-doc-links.py (cf-ad9y). Where that
script catches dead `[text](path.md)` markdown links, this one catches
the next class of doc-rot: bead-ID drift.

Concrete drift incident motivating this: the cf-ukc6.1 commit subject
in cfw PR #565 mistakenly read `feat(cf-6zjo): ...`, breaking
`git log --grep cf-ukc6` traceability. A 60-second pre-merge scan
would have caught it.

Scope:
  - Walks `docs/**/*.md` from repo root.
  - Pulls every `cf-<lowercase-alnum>` token out of the prose (the
    canonical bead-ID shape used throughout cfutons + cfw).
  - Cross-checks each against `bd list --all --json` (open + closed
    + deferred).
  - Strips fenced code blocks first so example/template IDs in code
    samples don't false-positive (matches the
    check-doc-links.py contract).
  - Reads an allowlist at `scripts/check-doc-bead-refs.allowlist` —
    one prefix per line — for `cf-*` tokens that aren't beads (CSS
    classes like `cf-cta`, `cf-blue`, `cf-navy`; ad-hoc category
    words like `cf-dead`). Allowlist entries match exactly.
  - Reads a baseline at `scripts/check-doc-bead-refs.baseline.txt` —
    one `<path>:<line> → <ref>` per line — for the existing drift
    backlog. Refs in the baseline don't fail the run; they're carried
    as warnings. Refs NOT in the baseline (i.e. new drift introduced
    by a PR) fail.

Run from repo root:
    python3 scripts/check-doc-bead-refs.py            # CI mode
    python3 scripts/check-doc-bead-refs.py --strict   # ignore baseline

Exit codes:
    0  no NEW drift vs baseline
    1  one or more NEW unknown refs (or strict mode + any unknown)
    2  bd not on PATH or returned non-JSON

Adding ignores:
  - Wrap example IDs (e.g. `cf-XXXXX` patterns inside how-to docs) in
    fenced code blocks; the scanner skips fences exactly the way
    check-doc-links.py does.
  - For non-bead `cf-*` tokens that show up in prose (CSS class names,
    category words), append them to the allowlist file.

Deliberate non-goals:
  - Does NOT verify the bead is *open* or *the right priority* — only
    that it exists. Bead lifecycle is not a doc concern.
  - Does NOT recurse into archived directories (`docs/archive/...`)
    since archived docs intentionally reference retired beads.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


# Bead IDs are `cf-` followed by 4–8 lowercase alphanumeric characters,
# with optional `.<suffix>` for sub-beads (e.g. `cf-3qt.8.31`). The
# pattern is intentionally permissive on length so newly-coined IDs
# parse correctly; the validity check is membership in `bd list`.
# Real bead IDs are `cf-XXXX` (3–12 alnum) with optional dotted
# sub-bead segments (`.8.31`). They never contain a second hyphen
# — so `cf-test-zou-...` (a branch name) and `cf-foo-bar` (a
# Tailwind utility composition) are NOT bead refs. The negative
# lookahead `(?!-)` rejects those shapes.
BEAD_RE = re.compile(r"\bcf-[a-z0-9]{3,12}(?:\.[a-z0-9]+)*(?!-)\b")

# MULTILINE so `^` anchors to each line; the leading `[ \t]*` allows
# indented fences (CommonMark-permitted, common inside nested
# bullet lists where bash blocks pick up 2- or 4-space indent).
FENCED_BLOCK_RE = re.compile(
    r"^[ \t]*```[a-zA-Z0-9_-]*\n.*?\n[ \t]*```",
    re.DOTALL | re.MULTILINE,
)


def strip_fenced_blocks(text: str) -> str:
    """Replace fenced code blocks with empty lines so line numbers survive."""
    def replace(m: re.Match[str]) -> str:
        return "\n" * m.group(0).count("\n")
    return FENCED_BLOCK_RE.sub(replace, text)


def load_known_bead_ids() -> set[str]:
    """Return the set of bead IDs known to `bd list`.

    Uses `--all` so closed + deferred beads still resolve (a doc
    correctly referencing a long-closed bead is not drift).
    Exits 2 on bd unavailability so missing tooling is loud, not silent.
    """
    if shutil.which("bd") is None:
        print("bd not on PATH — install gas-town tooling or run from a workspace shell", file=sys.stderr)
        sys.exit(2)
    try:
        result = subprocess.run(
            ["bd", "list", "--all", "--json", "--limit", "0"],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        print(f"bd list --all --json failed: {exc.stderr.strip()}", file=sys.stderr)
        sys.exit(2)
    try:
        rows = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print(f"bd list returned non-JSON: {exc}", file=sys.stderr)
        sys.exit(2)
    return {row["id"] for row in rows if isinstance(row, dict) and "id" in row}


def load_allowlist(here: Path) -> set[str]:
    """Read the per-repo allowlist of non-bead `cf-*` tokens."""
    allowlist_path = here.parent / "check-doc-bead-refs.allowlist"
    if not allowlist_path.is_file():
        return set()
    entries: set[str] = set()
    for raw in allowlist_path.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            entries.add(line)
    return entries


def load_baseline(here: Path) -> set[str]:
    """Read the existing-drift baseline (one `<path>:<line> → <ref>` per line)."""
    baseline_path = here.parent / "check-doc-bead-refs.baseline.txt"
    if not baseline_path.is_file():
        return set()
    entries: set[str] = set()
    for raw in baseline_path.read_text().splitlines():
        line = raw.split("#", 1)[0].strip()
        if line:
            entries.add(line)
    return entries


def scan_repo(root: Path, known: set[str], allowlist: set[str]) -> list[str]:
    """Return a list of "<path>:<line> → <ref>" strings for unknown refs."""
    docs = root / "docs"
    if not docs.is_dir():
        return []

    archive = (docs / "archive").resolve()
    unknown: list[str] = []

    for path in docs.rglob("*.md"):
        # Archived docs intentionally reference retired beads.
        try:
            if archive in path.resolve().parents:
                continue
        except OSError:
            continue

        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue

        stripped = strip_fenced_blocks(text)
        for match in BEAD_RE.finditer(stripped):
            ref = match.group(0)
            if ref in known or ref in allowlist:
                continue
            line = stripped[: match.start()].count("\n") + 1
            unknown.append(f"{path.relative_to(root)}:{line} → {ref}")

    return unknown


def main() -> int:
    strict = "--strict" in sys.argv

    here = Path(__file__).resolve()
    candidates = [here.parent.parent, Path.cwd()]
    root = next((p for p in candidates if (p / "docs").is_dir()), candidates[0])

    known = load_known_bead_ids()
    allowlist = load_allowlist(here)
    baseline = set() if strict else load_baseline(here)
    unknown = scan_repo(root, known, allowlist)

    docs = root / "docs"
    md_count = sum(1 for _ in docs.rglob("*.md")) if docs.is_dir() else 0

    new_drift = [u for u in unknown if u not in baseline]
    carried = len(unknown) - len(new_drift)

    print(
        f"Scanned {md_count} markdown files under {docs} "
        f"against {len(known)} known beads + {len(allowlist)} allowlist entries"
        + ("" if strict else f" + {len(baseline)} baselined refs")
    )
    if not unknown:
        print("✓ Every cf-XXXX reference resolves.")
        return 0
    if not new_drift and not strict:
        print(f"✓ No NEW drift ({carried} carried by baseline — run with --strict to see all).")
        return 0

    label = "unknown bead reference(s)" if strict else "NEW unknown bead reference(s) vs baseline"
    print(f"✗ {len(new_drift)} {label}:")
    for entry in new_drift:
        print(f"  {entry}")
    if not strict and carried:
        print(f"  (also {carried} pre-existing baselined refs — re-run with --strict to triage)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
