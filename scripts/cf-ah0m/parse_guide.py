#!/usr/bin/env python3
"""Parse EDITOR-HOOKUP-GUIDE.md → feature inventory.

Each `## PAGE` is a page section. Inside it, each `### Section` is a feature
group, and each `#### ` subheading is a finer-grained feature. We emit a flat
list of (page, section, subfeature_or_None, element_ids[]) rows.
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

GUIDE = Path("/Users/hal/gt/cfutons/EDITOR-HOOKUP-GUIDE.md")

# Page headings we treat as content pages (not setup chapters)
PAGE_RE = re.compile(
    r"^## (?:[\W_]*)?(HOME PAGE|MASTER PAGE|PRODUCT PAGE|CATEGORY PAGE|CART PAGE|"
    r"CHECKOUT|SIDE CART|SEARCH RESULTS|MEMBER PAGE|CONTACT|ABOUT|FAQ|"
    r"THANK YOU PAGE|WHITE GLOVE DELIVERY|ADMIN DELIVERY CALENDAR|"
    r"ADMIN A/B TESTS|SHIPPING POLICY|FULLSCREEN / PRODUCT VIDEOS|"
    r"PRIVACY POLICY|TERMS & CONDITIONS|REFUND POLICY|SEARCH SUGGESTIONS BOX|"
    r"COMPARE PAGE|FABRIC SWATCHES|WISHLIST SHARE|SUSTAINABILITY|"
    r"PRICE MATCH GUARANTEE|STYLE QUIZ|BLOG|BLOG POST|ROOM PLANNER|"
    r"COMMUNITY GALLERY|REFERRAL PAGE|UGC GALLERY)"
)
SECTION_RE = re.compile(r"^### (.+?)\s*$")
SUB_RE = re.compile(r"^#### (.+?)\s*$")
ID_RE = re.compile(r"`#([a-zA-Z][a-zA-Z0-9_]*)`")


def parse(md_path: Path) -> list[dict]:
    rows: list[dict] = []
    page: str | None = None
    section: str | None = None
    sub: str | None = None
    buf: list[str] = []

    def flush() -> None:
        if section is None or page is None:
            return
        ids = sorted(set(ID_RE.findall("\n".join(buf))))
        rows.append(
            {
                "page": page,
                "section": section,
                "subfeature": sub,
                "element_ids": ids,
                "body_chars": sum(len(b) for b in buf),
            }
        )

    for line in md_path.read_text().splitlines():
        m_page = PAGE_RE.match(line)
        if m_page:
            flush()
            page = m_page.group(1)
            section = None
            sub = None
            buf = []
            continue
        if page is None:
            continue
        m_sec = SECTION_RE.match(line)
        if m_sec:
            flush()
            section = m_sec.group(1)
            sub = None
            buf = []
            continue
        m_sub = SUB_RE.match(line)
        if m_sub:
            flush()
            sub = m_sub.group(1)
            buf = []
            continue
        buf.append(line)
    flush()
    return rows


def main() -> int:
    if not GUIDE.exists():
        print(f"missing: {GUIDE}", file=sys.stderr)
        return 1
    rows = parse(GUIDE)
    print(f"parsed: {len(rows)} feature rows", file=sys.stderr)
    pages = sorted({r["page"] for r in rows})
    print(f"pages: {len(pages)}", file=sys.stderr)
    out = Path("/tmp/cf-ah0m/features.json")
    out.write_text(json.dumps(rows, indent=2))
    print(f"wrote {out}", file=sys.stderr)
    # Per-page tally
    by_page: dict[str, int] = {}
    for r in rows:
        by_page[r["page"]] = by_page.get(r["page"], 0) + 1
    for p in pages:
        print(f"  {p}: {by_page[p]}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
