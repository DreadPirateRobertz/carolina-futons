#!/usr/bin/env python3
"""DOM probe: fetch rendered cfw HTML for each canonical page and extract:
  - data-slot values
  - id attributes
  - class names (raw token list)
  - heading text (h1..h4)

Output: /tmp/cf-ah0m/cfw_dom.json — { url: { slots: [...], ids: [...], classes: [...], headings: [...] } }

Uses curl (Next.js SSR is enough). Conservative timeout, sequential.
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
from pathlib import Path

BASE = "https://carolina-futons-web.vercel.app"

# (page label, url) — page label matches PAGE_URL keys in the report builder
PAGES: list[tuple[str, str]] = [
    ("HOME PAGE", "/"),
    ("MASTER PAGE", "/"),
    ("PRODUCT PAGE", "/products/canby"),
    ("CATEGORY PAGE", "/shop/futon-frames"),
    ("CART PAGE", "/cart"),
    ("CHECKOUT", "/checkout"),
    ("SIDE CART", "/"),
    ("SEARCH RESULTS", "/search?q=futon"),
    ("MEMBER PAGE", "/dashboard"),
    ("CONTACT", "/contact"),
    ("ABOUT", "/about"),
    ("FAQ", "/faq"),
    ("THANK YOU PAGE", "/thank-you"),
    ("WHITE GLOVE DELIVERY", "/white-glove-delivery"),
    ("SHIPPING POLICY", "/shipping"),
    ("FULLSCREEN / PRODUCT VIDEOS", "/products/canby"),
    ("PRIVACY POLICY", "/privacy"),
    ("TERMS & CONDITIONS", "/terms"),
    ("REFUND POLICY", "/returns"),
    ("SEARCH SUGGESTIONS BOX", "/"),
    ("COMPARE PAGE", "/compare"),
    ("FABRIC SWATCHES", "/fabric-swatches"),
    ("WISHLIST SHARE", "/wishlist-share"),
    ("SUSTAINABILITY", "/sustainability"),
    ("PRICE MATCH GUARANTEE", "/price-match-guarantee"),
    ("STYLE QUIZ", "/style-quiz"),
    ("BLOG", "/blog"),
    ("BLOG POST", "/blog"),
    ("ROOM PLANNER", "/room-planner"),
    ("COMMUNITY GALLERY", "/community-gallery"),
    ("REFERRAL PAGE", "/referral"),
    ("UGC GALLERY", "/community-gallery"),
    # Admin pages — likely auth-walled but probe anyway
    ("ADMIN DELIVERY CALENDAR", "/admin/delivery-calendar"),
    ("ADMIN A/B TESTS", "/admin/ab-tests"),
]


SLOT_RE = re.compile(r'data-slot=["\']([^"\']+)["\']')
ID_RE = re.compile(r'\sid=["\']([^"\']+)["\']')
CLASS_RE = re.compile(r'class(?:Name)?=["\']([^"\']+)["\']')
HEADING_RE = re.compile(r"<h[1-4][^>]*>(.*?)</h[1-4]>", re.DOTALL)
TAG_RE = re.compile(r"<[^>]+>")


def fetch(url: str) -> tuple[int, str]:
    full = BASE + url
    try:
        out = subprocess.check_output(
            [
                "curl",
                "-sL",
                "--max-time",
                "12",
                "-w",
                "\n---HTTP_STATUS:%{http_code}---",
                full,
            ],
            text=True,
            errors="ignore",
        )
        m = re.search(r"---HTTP_STATUS:(\d+)---$", out)
        status = int(m.group(1)) if m else 0
        body = out[: m.start()] if m else out
        return status, body
    except subprocess.SubprocessError as e:
        return 0, ""


def extract(body: str) -> dict:
    slots = sorted(set(SLOT_RE.findall(body)))
    ids = sorted(set(ID_RE.findall(body)))
    classes_raw = CLASS_RE.findall(body)
    class_tokens: set[str] = set()
    for c in classes_raw:
        for tok in c.split():
            if len(tok) >= 3 and not tok.startswith(("h-", "w-", "p-", "m-", "px-", "py-", "mx-", "my-", "pt-", "pb-", "pl-", "pr-", "mt-", "mb-", "ml-", "mr-", "text-", "bg-", "border-", "rounded", "flex", "grid", "gap-")):
                class_tokens.add(tok.lower())
    headings_raw = HEADING_RE.findall(body)
    headings = []
    for h in headings_raw:
        clean = TAG_RE.sub(" ", h)
        clean = re.sub(r"\s+", " ", clean).strip()
        if clean:
            headings.append(clean[:120])
    return {
        "slots": slots,
        "ids": ids,
        "class_tokens": sorted(class_tokens)[:200],
        "headings": headings[:60],
        "body_length": len(body),
    }


def main() -> int:
    results: dict[str, dict] = {}
    for page, url in PAGES:
        print(f"  fetching {url} ({page})…", file=sys.stderr)
        status, body = fetch(url)
        info = extract(body) if status == 200 else {"slots": [], "ids": [], "class_tokens": [], "headings": [], "body_length": 0}
        info["status"] = status
        info["url"] = url
        # Multi-page mapping: keep first OK for each page
        if page not in results or (results[page].get("status") != 200 and status == 200):
            results[page] = info
    Path("/tmp/cf-ah0m/cfw_dom.json").write_text(json.dumps(results, indent=2))
    ok = sum(1 for v in results.values() if v.get("status") == 200)
    print(f"probed {len(results)} pages, {ok} OK", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
