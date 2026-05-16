"""cf-4hys: pre-dispatch staleness checker for OPEN/HOOKED beads.

PM workflow: before dispatching crew to a bead, run this to detect
"work already shipped under a different bead ID / PR" — the dispatch-
collision shape that fired 7+ times in the 2026-05-16 session
(cf-q8m2, cf-8r7v, cf-uydr, cf-5ocx, cf-b8n8, cf-641x, cf-e55k, ...).

Usage from PM workflow:
  $ python3 scripts/check_stale_hooked_bead.py cf-q8m2

It runs `bd show <id>` + `gh pr list --state merged --limit 50`, then
prints a warning if the bead's title shares a direct ID match or 2+
distinctive keywords with a recent merged PR. Exit code 0 if clean, 1
if a warning fires (so the PM workflow can branch on it).

Pure-function design — `should_warn(bead, recent_prs)` is the testable
predicate. The shell wrapper at the bottom drives I/O.

Tests: scripts/test_check_stale_hooked_bead.py (pytest)
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

# Tokens that don't count toward keyword-overlap scoring. Adding "fix"
# / "feat" / "chore" etc. keeps every PR-with-a-conventional-prefix
# from triggering a 1-keyword match against any bead title that also
# starts with those words.
_STOPWORDS = frozenset({
    "a", "an", "and", "the", "for", "of", "to", "in", "on", "with",
    "fix", "feat", "chore", "refactor", "docs", "test", "perf", "style",
    "build", "ci", "is", "are", "be", "via", "by", "from",
    # cf-XXXX prefix tokens that aren't load-bearing
    "cf",
})

# Tokens shorter than this are filtered out of keyword overlap (avoids
# noise from short article/preposition matches the stoplist misses).
_MIN_TOKEN_LEN = 3

# Number of distinctive keyword overlaps required to fire a warn when
# no direct bead-ID match exists. 1 is too noisy; 2 catches the
# cf-8r7v / cf-gift-g1 "gift card recipient" cluster cleanly.
_KEYWORD_OVERLAP_THRESHOLD = 2


def _tokenize(text: str) -> set[str]:
    """Return distinctive lowercase tokens from text. Strips punctuation,
    filters stopwords + short tokens."""
    text = text.lower()
    tokens = re.findall(r"[a-z][a-z0-9]+", text)
    return {t for t in tokens if t not in _STOPWORDS and len(t) >= _MIN_TOKEN_LEN}


def _pr_contains_bead_id(pr_title: str, bead_id: str) -> bool:
    """Case-insensitive word-boundary check for the bead ID in the PR title.

    Word boundary prevents false positives where a longer bead-ID prefix
    is mistakenly matched (e.g. searching for `cf-q8m2` would otherwise
    substring-match `cf-q8m2x` if such a bead existed). Per radahn
    obs#1 on PR #1377.
    """
    pattern = rf"\b{re.escape(bead_id)}\b"
    return bool(re.search(pattern, pr_title, re.IGNORECASE))


def should_warn(bead: dict, recent_prs: list[dict]) -> dict | None:
    """Return a warning record if the bead looks shipped under a recent
    PR, else None.

    Return shape:
      {
        "pr_number": int,
        "match_kind": "bead-id-direct" | "keyword-overlap",
        "matched_keywords": list[str] | None,
      }

    Precedence:
      1. Direct bead-ID match wins (highest confidence)
      2. Strongest keyword-overlap match wins among the rest (≥2 distinctive
         overlapping tokens). Ties broken by higher PR number (more recent).
    """
    if not recent_prs:
        return None
    bead_id = bead.get("id", "")
    bead_title = bead.get("title", "")

    # Pass 1: direct bead-ID match. Highest confidence.
    if bead_id:
        for pr in recent_prs:
            if _pr_contains_bead_id(pr["title"], bead_id):
                return {
                    "pr_number": pr["number"],
                    "match_kind": "bead-id-direct",
                    "matched_keywords": None,
                }

    # Pass 2: keyword overlap. Score each PR + return the strongest.
    bead_tokens = _tokenize(bead_title)
    if not bead_tokens:
        return None

    best = None
    best_overlap_count = 0
    for pr in recent_prs:
        pr_tokens = _tokenize(pr["title"])
        overlap = bead_tokens & pr_tokens
        if len(overlap) >= _KEYWORD_OVERLAP_THRESHOLD:
            # Tie-break on higher PR number (more recent = more relevant signal).
            if (
                len(overlap) > best_overlap_count
                or (len(overlap) == best_overlap_count and (best is None or pr["number"] > best["pr_number"]))
            ):
                best = {
                    "pr_number": pr["number"],
                    "match_kind": "keyword-overlap",
                    "matched_keywords": sorted(overlap),
                }
                best_overlap_count = len(overlap)

    return best


# ── Shell driver ─────────────────────────────────────────────────


def _fetch_bead(bead_id: str) -> dict:
    """Run `bd show <id>` and parse the title + id. Falls back to id-only
    if `bd show` fails (defensive — the checker should still work)."""
    bead = {"id": bead_id, "title": ""}
    env = {
        **os.environ,
        "BEADS_DOLT_PORT": "3307",
        "BEADS_DOLT_SERVER_PORT": "3307",
        "GT_DOLT_PORT": "3307",
    }
    try:
        out = subprocess.run(
            ["bd", "show", bead_id], capture_output=True, text=True, env=env, timeout=10
        ).stdout
    except (subprocess.SubprocessError, FileNotFoundError):
        return bead
    # First non-status line typically has the title after the bead-ID + status box.
    # Example: "○ cf-q8m2 · Dead-code Pass 3 chunk A — SUPERSEDE [● P3 · HOOKED]"
    for line in out.splitlines():
        m = re.match(rf"[○◐◇✓]\s+{re.escape(bead_id)}\s+·\s+(.+?)\s+\[", line)
        if m:
            bead["title"] = m.group(1).strip()
            break
    return bead


def _fetch_recent_prs(repo: str, limit: int = 50) -> list[dict]:
    """Run `gh pr list --state merged` and parse number+title."""
    try:
        out = subprocess.run(
            [
                "gh", "pr", "list", "--repo", repo, "--state", "merged",
                "--json", "number,title", "--limit", str(limit),
            ],
            capture_output=True, text=True, timeout=30,
        ).stdout
    except (subprocess.SubprocessError, FileNotFoundError):
        return []
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return []


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: check_stale_hooked_bead.py <bead-id>", file=sys.stderr)
        return 2
    bead_id = sys.argv[1]
    bead = _fetch_bead(bead_id)
    prs = _fetch_recent_prs(os.environ.get("STALENESS_REPO", "DreadPirateRobertz/carolina-futons"))
    warn = should_warn(bead, prs)
    if warn is None:
        print(f"OK — no recent merged PR appears to ship {bead_id}'s work.")
        return 0
    print(
        f"⚠ STALENESS WARNING for {bead_id}: PR #{warn['pr_number']} "
        f"(match: {warn['match_kind']}"
        + (f", overlap: {', '.join(warn['matched_keywords'])}" if warn["matched_keywords"] else "")
        + ")",
        file=sys.stderr,
    )
    print("  → Verify the bead's scope hasn't already shipped before dispatching.", file=sys.stderr)
    print(f"  → Inspect: gh pr view {warn['pr_number']}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
