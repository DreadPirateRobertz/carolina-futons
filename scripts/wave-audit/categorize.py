"""cf-6amf (cf-roadmap.3): wave-audit PR categorizer.

Pure function module — takes a PR record (mirrors `gh pr list --json files,
additions,deletions,number,title` output) and assigns a category for the
wave-audit ritual. Five categories are mutually exclusive; check precedence
is documented inline.

Rationale: cf-o5j5 (PR #1339) shipped a one-shot 26-PR wave audit; this
module factors the categorization rubric so future audits can run via
`scripts/wave-audit/wave-audit.sh` and produce consistent output.

Run tests: `python -m pytest scripts/wave-audit/test_categorize.py -v`
"""
from __future__ import annotations

import re

# A PR file path is "test-related" if it lives in any tests/ or __tests__/
# directory OR has a .test.<ext> / .spec.<ext> infix. The wave-audit ritual
# treats these uniformly — locks the contract via test_audit_v5.py-style
# negative-case pins for paths like tests/helpers.ts that live alongside
# tests but aren't themselves tests.
_TEST_PATH_RE = re.compile(
    r"(?:^|/)(?:tests|__tests__|e2e)/.*\.(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$"
)

# Top-level docs files outside docs/ tree (README, CHANGELOG, LICENSE, etc.)
_TOP_LEVEL_DOC_RE = re.compile(
    r"^(README|CHANGELOG|LICENSE|CONTRIBUTING|CODEOWNERS|AGENTS|CLAUDE|GEMINI)(\.md|\.MD)?$"
)

# Housekeeping/config file patterns. .runtime/ + .claude/ are agent state;
# .gitignore / .gitattributes are repo config; tsconfig.json etc. are
# build config without behavior implications.
_HOUSEKEEPING_PATH_RE = re.compile(
    r"^(?:"
    r"\.gitignore"
    r"|\.gitattributes"
    r"|\.runtime/.*"
    r"|\.claude/.*"
    r"|\.github/CODEOWNERS"
    r"|CLAUDE\.md"
    r"|AGENTS\.md"
    r"|GEMINI\.md"
    r")$"
)

# Threshold below which a non-lockfile PR is considered "trivial". The
# cf-o5j5 audit used 12 LOC as the cut; it captures the typical aria-hidden
# / one-line-fix / config-tweak shape that doesn't host meaningful gaps.
TRIVIAL_LOC_THRESHOLD = 12

# Lockfile / dep-manifest files. A diff containing ONLY these is trivial
# regardless of LOC count — npm regenerates lockfiles in bulk on every
# dep bump, and the diff is mechanical.
_LOCKFILE_PATHS = frozenset({
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "uv.lock",
    "poetry.lock",
})


def _is_doc(path: str) -> bool:
    """Pure-docs path: under docs/ OR top-level documentation file."""
    if path.startswith("docs/") and path.endswith(".md"):
        return True
    return bool(_TOP_LEVEL_DOC_RE.match(path))


def _is_test(path: str) -> bool:
    return bool(_TEST_PATH_RE.search(path))


def _is_housekeeping(path: str) -> bool:
    return bool(_HOUSEKEEPING_PATH_RE.match(path))


def _is_lockfile_or_manifest(path: str) -> bool:
    return path in _LOCKFILE_PATHS or path == "package.json"


def categorize(pr: dict) -> str:
    """Return the wave-audit category for a PR record.

    Precedence (checked top-down):
      1. pure-docs       — ALL files are docs/ or top-level .md
      2. test-only       — ALL files are test files
      3. housekeeping    — ALL files are .gitignore/.runtime/.claude/etc.
      4. trivial         — total LOC ≤ TRIVIAL_LOC_THRESHOLD,
                           OR ALL files are lockfile/dep-manifest
      5. substantive     — everything else (the deep-audit candidates)

    Categories are computed from the file paths and LOC totals; the
    function does NOT call out to git or gh.
    """
    files = [f["path"] for f in pr.get("files", [])]
    if not files:
        return "trivial"  # Empty PRs are vacuously trivial; defensive default.

    if all(_is_doc(p) for p in files):
        return "pure-docs"
    if all(_is_test(p) for p in files):
        return "test-only"
    if all(_is_housekeeping(p) for p in files):
        return "housekeeping"

    total_loc = pr.get("additions", 0) + pr.get("deletions", 0)
    if all(_is_lockfile_or_manifest(p) for p in files):
        return "trivial"
    if total_loc <= TRIVIAL_LOC_THRESHOLD and not any(_is_doc(p) for p in files):
        # Small code-touching PR: trivial. (Docs-mixed-with-source falls through
        # to substantive — a 5-LOC code-and-doc change still hosts surface.)
        return "trivial"

    return "substantive"


def deep_audit_candidates(prs: list[dict]) -> list[dict]:
    """Filter PRs to the substantive ones — the targets for JSDoc + TDD +
    CI deep-audit per the cf-o5j5 methodology."""
    return [pr for pr in prs if categorize(pr) == "substantive"]


def summary_histogram(prs: list[dict]) -> dict[str, int]:
    """Return a dict with counts per category. Keys appear even for zero
    counts so downstream consumers can format a stable table."""
    out = {
        "pure-docs": 0,
        "test-only": 0,
        "trivial": 0,
        "housekeeping": 0,
        "substantive": 0,
    }
    for pr in prs:
        out[categorize(pr)] += 1
    return out


# cf-6amf.1 (cf-6amf.fu1): substantive-bucket sub-classification.
#
# When the substantive ratio exceeds ~60% of a wave (as it did in
# cf-6amf-pilot: 24/34 = 71%), the deep-audit queue becomes too long
# for a single sitting. Conventional-commit prefix gives the auditor
# a prioritization signal — `feat()` PRs touching external-SDK call
# sites are the highest-leverage spy-assertion target (radahn dim
# #4), while `chore()` / `refactor()` typically have narrower
# behavior surface and can be batched.

# Prefix is `feat` / `fix` / `refactor` / `chore` / `test` / `perf` /
# `docs` / `style` — case-insensitive, tolerant of parenthesized
# scope (e.g. `fix(cf-g640):`) — the prefix match is on the leading
# word before any `(` or `:`.
_COMMIT_PREFIX_RE = re.compile(
    r"^(feat|fix|refactor|chore|test|perf|docs|style)\b",
    re.IGNORECASE,
)

# Paths that signal "touches an external SDK call site" — the
# radahn dim-#4 trigger for spy-assertion priority. A `feat()` PR
# touching any of these is flagged priority-1 in the deep-audit
# queue. Keep narrow: external SDKs only, not internal helpers.
_SDK_CALLSITE_RE = re.compile(
    r"^src/(?:lib/wix|lib/stripe|lib/twilio|api/[^/]+/route\.(?:ts|tsx))"
)


def commit_prefix(title: str | None) -> str:
    """Extract the conventional-commit prefix from a PR title.

    Returns one of `feat` / `fix` / `refactor` / `chore` / `test` /
    `perf` / `docs` / `style`, or `"other"` when the title doesn't
    open with a recognized prefix. Case-insensitive; tolerant of
    parenthesized scope (e.g. `fix(cf-g640):`).

    Empty / non-string title returns `"other"` defensively.

    :param title: The PR title string.
    :returns: The lowercase prefix or ``"other"`` for unclassified.
    """
    if not isinstance(title, str) or not title.strip():
        return "other"
    m = _COMMIT_PREFIX_RE.match(title.strip())
    return m.group(1).lower() if m else "other"


def deep_audit_priority(pr: dict) -> str:
    """Classify a substantive PR's deep-audit priority tier.

    ``"p1"`` — ``feat(...)`` that touches an external-SDK call site
        (matches ``_SDK_CALLSITE_RE``). Highest leverage for radahn
        dim-#4 spy-assertion checks.
    ``"p2"`` — ``feat(...)`` or ``fix(...)`` not touching SDK sites.
        Behavior surface but no external-SDK boundary.
    ``"p3"`` — ``refactor(...)`` / ``chore(...)`` / ``perf(...)`` /
        anything else. Narrower surface, can be batched.

    Only meaningful for substantive PRs; calling on a non-substantive
    PR returns ``"p3"`` (the safest disposition).

    :param pr: The PR record (mirrors ``gh pr list --json files,...`` shape).
    :returns: Priority tier as a lowercase string.
    """
    prefix = commit_prefix(pr.get("title"))
    file_paths = [f["path"] for f in pr.get("files", [])]
    if prefix == "feat" and any(_SDK_CALLSITE_RE.match(p) for p in file_paths):
        return "p1"
    if prefix in ("feat", "fix"):
        return "p2"
    return "p3"


def substantive_subclassify(prs: list[dict]) -> dict[str, int]:
    """Sub-classify the substantive bucket by conventional-commit prefix.

    Returns a stable-key dict counting the substantive PRs per
    prefix. Non-substantive PRs are skipped. Unrecognized-prefix
    substantive PRs land under ``"other"``.

    :param prs: Iterable of PR records.
    :returns: Histogram of substantive PRs by commit prefix.
    """
    out = {
        "feat": 0,
        "fix": 0,
        "refactor": 0,
        "chore": 0,
        "test": 0,
        "perf": 0,
        "docs": 0,
        "style": 0,
        "other": 0,
    }
    for pr in prs:
        if categorize(pr) != "substantive":
            continue
        out[commit_prefix(pr.get("title"))] += 1
    return out


def deep_audit_priority_histogram(prs: list[dict]) -> dict[str, int]:
    """Histogram of deep-audit priorities across substantive PRs.

    Combines ``deep_audit_priority`` over the substantive subset.
    Useful for the wave-audit report's "what to audit first" pane.

    :param prs: Iterable of PR records.
    :returns: Histogram with stable keys ``p1`` / ``p2`` / ``p3``.
    """
    out = {"p1": 0, "p2": 0, "p3": 0}
    for pr in prs:
        if categorize(pr) != "substantive":
            continue
        out[deep_audit_priority(pr)] += 1
    return out
