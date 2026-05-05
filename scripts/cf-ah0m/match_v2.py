#!/usr/bin/env python3
"""V2 matcher (revised): tri-source verdict (DOM + alias + cfw token containment).

Verdict ladder:
  yes      — DOM hit, OR alias hit, OR ≥half of feature tokens appear inside
             a single cfw name (component basename or data-slot value),
             AND at least one rare token (rare = appears in <40 cfw names).
  partial  — at least one rare token appears in some cfw name, but not strongly.
  missing  — no cfw evidence at all.
  unknown  — no extractable tokens (e.g. label is just "SEO").
"""
from __future__ import annotations
import json
import re
from collections import Counter
from pathlib import Path

OUT_DIR = Path("/tmp/cf-ah0m")
features = json.loads((OUT_DIR / "features.json").read_text())
data_slots: list[str] = json.loads((OUT_DIR / "cfw_data_slots.json").read_text())
data_testids: list[str] = json.loads((OUT_DIR / "cfw_data_testids.json").read_text())
components: list[str] = json.loads((OUT_DIR / "cfw_components.json").read_text())
aliases_raw: dict[str, list[str]] = json.loads((OUT_DIR / "feature-aliases.json").read_text())
dom: dict[str, dict] = json.loads((OUT_DIR / "cfw_dom.json").read_text())

aliases = {k.lower(): v for k, v in aliases_raw.items() if not k.startswith("_")}

STOP = {
    "the", "and", "for", "with", "page", "section", "of", "in", "on", "a",
    "an", "to", "by", "or", "is", "new", "v0", "v1", "v2", "pr", "cf",
    "phase", "complete", "ready", "core", "sub", "main", "global",
    "appears", "every", "near", "below", "above", "before", "after",
    "repeater", "repeaters", "nested", "instance", "builder", "merged",
    "elements", "added", "alongside", "existing", "replaces", "test",
}


def stem(t: str) -> str:
    if len(t) > 4 and t.endswith("ies"):
        return t[:-3] + "y"
    if len(t) > 4 and t.endswith("es"):
        return t[:-2]
    if len(t) > 3 and t.endswith("s"):
        return t[:-1]
    return t


def normalize_phrase(label: str) -> str:
    label = re.sub(r"[\(\[\{].*?[\)\]\}]", " ", label)
    label = re.sub(r"[—–✅⚠️📋🚀✓✗◇◐]+", " ", label)
    label = re.sub(r"\bNEW\b|\bv\d[\d.]*\+?\b|\bPR\b\s*#\d+|\bCF-[a-zA-Z0-9]+", " ", label)
    label = re.sub(r"[^\w\s-]", " ", label)
    label = re.sub(r"\s+", " ", label).strip().lower()
    return label


def tokenize(label: str) -> list[str]:
    phrase = normalize_phrase(label)
    parts = re.findall(r"[a-z]+|\d+", phrase)
    out: list[str] = []
    for p in parts:
        if len(p) < 3 or p in STOP:
            continue
        out.append(stem(p))
    return out


# Build cfw vocabulary (for rarity weighting): token frequency across all cfw names
def cfw_tokens(name: str) -> list[str]:
    parts = re.findall(r"[A-Z][a-z]+|[a-z]+|\d+", name)
    return [stem(p.lower()) for p in parts if len(p) >= 3]


CORPUS = list(components) + [s.replace("-", " ") for s in data_slots] + [t.replace("-", " ") for t in data_testids]
TOKEN_DOC_FREQ: Counter[str] = Counter()
for n in CORPUS:
    for t in set(cfw_tokens(n)):
        TOKEN_DOC_FREQ[t] += 1

# Precompute lowered + tokenized for each cfw name
COMP_LOWER = [(c, c.lower(), set(cfw_tokens(c))) for c in components]
SLOT_LOWER = [(s, s.lower(), set(cfw_tokens(s.replace("-", " ")))) for s in data_slots]
TESTID_LOWER = [(t, t.lower(), set(cfw_tokens(t.replace("-", " ")))) for t in data_testids]


def is_rare(tok: str) -> bool:
    return TOKEN_DOC_FREQ.get(tok, 0) < 40


def cfw_match(tokens: list[str]) -> tuple[list[str], list[str], float, bool]:
    """Return (component_hits, slot_hits, best_score, has_rare).
    score = (overlapping tokens) / (total feature tokens) for the best cfw name."""
    if not tokens:
        return [], [], 0.0, False
    tok_set = set(tokens)
    has_rare = any(is_rare(t) for t in tok_set)

    best_score = 0.0
    comp_hits: list[tuple[float, str]] = []
    slot_hits: list[tuple[float, str]] = []
    for name, _lower, ctok in COMP_LOWER:
        overlap = tok_set & ctok
        if not overlap:
            continue
        score = len(overlap) / len(tok_set)
        rare_overlap = any(is_rare(t) for t in overlap)
        # weight by rarity: a rare-token match is worth more than a common one
        weighted = score + (0.2 if rare_overlap else 0)
        if weighted > 0.3:
            comp_hits.append((weighted, name))
        best_score = max(best_score, score)
    for name, _lower, stok in SLOT_LOWER:
        overlap = tok_set & stok
        if not overlap:
            continue
        score = len(overlap) / len(tok_set)
        rare_overlap = any(is_rare(t) for t in overlap)
        weighted = score + (0.2 if rare_overlap else 0)
        if weighted > 0.3:
            slot_hits.append((weighted, f"slot:{name}"))
        best_score = max(best_score, score)
    for name, _lower, stok in TESTID_LOWER:
        overlap = tok_set & stok
        if not overlap:
            continue
        score = len(overlap) / len(tok_set)
        rare_overlap = any(is_rare(t) for t in overlap)
        weighted = score + (0.2 if rare_overlap else 0)
        if weighted > 0.3:
            slot_hits.append((weighted, f"testid:{name}"))
        best_score = max(best_score, score)

    comp_hits.sort(reverse=True)
    slot_hits.sort(reverse=True)
    return [c for _, c in comp_hits[:5]], [s for _, s in slot_hits[:5]], best_score, has_rare


def alias_hit(phrase: str) -> list[str]:
    keys_to_try: list[str] = []
    if phrase in aliases:
        keys_to_try.append(phrase)
    for key in aliases.keys():
        if key != phrase and (key in phrase or phrase in key):
            keys_to_try.append(key)
    targets: list[str] = []
    for k in keys_to_try:
        targets.extend(aliases[k])
    if not targets:
        return []
    hits: list[str] = []
    for t in targets:
        tl = t.lower()
        for c, cl, _ in COMP_LOWER:
            if tl in cl:
                hits.append(f"alias→component:{c}")
                break
        else:
            for s, sl, _ in SLOT_LOWER:
                if tl in sl:
                    hits.append(f"alias→slot:{s}")
                    break
    return hits[:4]


def dom_hit(page: str, phrase: str, element_ids: list[str], tokens: list[str]) -> list[str]:
    info = dom.get(page)
    if not info or info.get("status") != 200:
        return []
    haystack_parts: list[str] = []
    haystack_parts.extend(info.get("slots", []))
    haystack_parts.extend(info.get("ids", []))
    haystack_parts.extend(info.get("class_tokens", []))
    haystack_parts.extend(h.lower() for h in info.get("headings", []))
    blob = " | ".join(haystack_parts).lower()

    hits: list[str] = []
    # Specific element ids from the guide
    for eid in element_ids[:8]:
        eid_l = eid.lower()
        if len(eid_l) >= 5 and eid_l in blob:
            hits.append(f"dom-id:{eid}")
    # Compound phrases (kebab-case + condensed)
    if phrase:
        for needle in (phrase.replace(" ", "-"), phrase.replace(" ", "")):
            if len(needle) >= 6 and needle in blob:
                hits.append(f"dom-phrase:{needle[:40]}")
                break
    # All tokens present in blob
    if tokens and len(tokens) >= 2:
        token_hits = [t for t in tokens if t in blob]
        if len(token_hits) >= max(2, int(0.5 * len(tokens))):
            hits.append(f"dom-tokens:{','.join(token_hits[:4])}")
    return hits[:3]


def verdict_for(row: dict) -> dict:
    page = row["page"]
    label = row["section"]
    if row.get("subfeature"):
        label = f"{label} :: {row['subfeature']}"
    section_phrase = normalize_phrase(row["section"])
    sub_phrase = normalize_phrase(row.get("subfeature") or "")
    primary_phrase = (sub_phrase or section_phrase).strip()
    tokens_section = tokenize(row["section"])
    tokens_sub = tokenize(row.get("subfeature") or "")
    tokens = tokens_section + [t for t in tokens_sub if t not in tokens_section]
    eids = row.get("element_ids", [])
    eid_tokens: list[str] = []
    for e in eids:
        eid_tokens.extend(cfw_tokens(e))
    # dedupe
    tokens = list(dict.fromkeys(tokens + eid_tokens))

    evidence: list[str] = []

    # 1) DOM probe
    e_dom = dom_hit(page, primary_phrase, eids, tokens)
    evidence.extend(e_dom)

    # 2) Alias map
    e_alias = alias_hit(primary_phrase) or alias_hit(section_phrase)
    evidence.extend(e_alias)

    # 3) cfw token-containment
    chits, shits, best_score, has_rare = cfw_match(tokens)
    if chits:
        evidence.append(f"cfw-component:{chits[0]}")
    if shits:
        evidence.append(f"cfw-slot:{shits[0]}")
    if len(chits) > 1:
        evidence.append(f"cfw-component:{chits[1]}")

    if not tokens and not eids:
        verdict = "unknown"
    elif e_dom:
        verdict = "yes"
    elif e_alias and (best_score >= 0.5 or has_rare):
        verdict = "yes"
    elif e_alias:
        verdict = "yes"  # alias is curated; trust it
    elif (chits or shits) and best_score >= 0.5 and has_rare:
        verdict = "yes"
    elif (chits or shits) and best_score >= 0.5:
        verdict = "yes"
    elif (chits or shits) and best_score >= 0.34 and has_rare:
        verdict = "partial"
    elif chits or shits:
        verdict = "partial"
    else:
        verdict = "missing"

    return {
        **row,
        "verdict": verdict,
        "phrase": primary_phrase,
        "tokens": tokens,
        "best_score": round(best_score, 2),
        "has_rare_token": has_rare,
        "evidence": evidence[:6],
    }


def main() -> None:
    matched = [verdict_for(r) for r in features]
    (OUT_DIR / "matched_v2.json").write_text(json.dumps(matched, indent=2))
    counts: Counter[str] = Counter()
    for m in matched:
        counts[m["verdict"]] += 1
    print(f"v2: total={len(matched)} verdicts={dict(counts)}")


if __name__ == "__main__":
    main()
