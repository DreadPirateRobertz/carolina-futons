#!/usr/bin/env python3
"""Scan docs/**/*.md for broken relative links — fail fast on doc-link drift.

cf-ad9y. Prevents the slow burn of "this doc says X is in cfw, actually
it's in cfutons" annotation rot. Caught one such bug in cf-0hzn
(lighthouse-pre-cutover-2026-05-05.md was annotated cfw but lives in
cfutons). A 30-line script catches the next one before it ships.

Scope:
  - Scans every `docs/**/*.md` under the repo root.
  - Looks at relative markdown link targets `[text](path.md)` (with
    optional `#anchor`). External `http(s)://` URLs are ignored.
  - Skips fenced code blocks (``` ... ```) so example/template paths
    inside code samples don't fire false positives.

Run from repo root:
    python3 scripts/check-doc-links.py

Exit codes:
    0  no broken links
    1  one or more broken links (path printed for each)

Adding ignores:
  Inline a code fence around any template paths that legitimately don't
  resolve until a future archive step. The fenced-code-block skip is
  intentional and documented; do NOT add a separate ignore-list file
  unless a real-world case justifies it.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


# `[text](target.md)` or `[text](target.md#anchor)` — relative only (we
# bail on http(s):// targets at scan time).
LINK_RE = re.compile(r"\]\(\s*([^)\s#]+\.md)(?:#[^)]*)?\s*\)")

# Triple-backtick fenced code blocks (any language, including markdown
# itself). We strip these from the text before scanning so example
# paths inside docs don't trip the check.
FENCED_BLOCK_RE = re.compile(r"```[a-zA-Z0-9_-]*\n.*?\n```", re.DOTALL)


def strip_fenced_blocks(text: str) -> str:
    """Replace fenced code blocks with empty lines so line numbers survive."""
    def replace(m: re.Match[str]) -> str:
        # Preserve newlines so any link-line number outside the block
        # stays accurate after the strip.
        return "\n" * m.group(0).count("\n")

    return FENCED_BLOCK_RE.sub(replace, text)


def scan_repo(root: Path) -> list[str]:
    """Return a list of "<path>:<line> → <target>" strings for broken links."""
    docs = root / "docs"
    if not docs.is_dir():
        # Repos without a docs/ tree are fine — nothing to scan.
        return []

    broken: list[str] = []
    for path in docs.rglob("*.md"):
        try:
            text = path.read_text(errors="ignore")
        except OSError:
            continue
        stripped = strip_fenced_blocks(text)
        for match in LINK_RE.finditer(stripped):
            link = match.group(1)
            if link.startswith("http://") or link.startswith("https://"):
                # Belt-and-suspenders — LINK_RE excludes whitespace so
                # most external URLs are pre-filtered, but keep the
                # explicit guard for clarity.
                continue
            target = (path.parent / link).resolve()
            if not target.exists():
                line = stripped[: match.start()].count("\n") + 1
                broken.append(f"{path.relative_to(root)}:{line} → {link}")

    return broken


def main() -> int:
    # Walk up from the script location to find the repo root. The repo
    # root is the directory that contains a `docs/` tree alongside this
    # script. Falling back to CWD lets a CI runner invoke the script
    # from a custom checkout layout.
    here = Path(__file__).resolve()
    candidates = [here.parent.parent, Path.cwd()]
    root = next((p for p in candidates if (p / "docs").is_dir()), candidates[0])

    broken = scan_repo(root)
    md_count = sum(1 for _ in (root / "docs").rglob("*.md")) if (root / "docs").is_dir() else 0

    print(f"Scanned {md_count} markdown files under {root / 'docs'}")
    if not broken:
        print("✓ No broken relative-md links found.")
        return 0

    print(f"✗ {len(broken)} broken relative-md link(s):")
    for entry in broken:
        print(f"  {entry}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
