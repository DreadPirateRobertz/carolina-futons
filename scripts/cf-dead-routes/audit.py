#!/usr/bin/env python3
"""Velo dead-route detector — Phase 1.

For each `export const NAME = webMethod(Permissions.X, ...)` in
src/backend/*.web.js, classify into:

  HTTP-EXPOSED  — http-functions.js imports OR calls NAME (cfw can reach it)
  EVENT-WIRED   — events.js or *.events.js references NAME
  FRONTEND      — src/public, src/pages, or any non-.web.js Velo source calls NAME
  INTERNAL      — called by another src/backend/*.web.js module OR by another
                  exported function in the SAME .web.js file (e.g. generatePinContent
                  is called by syncCatalogBatch in the same pinterestCatalogSync.web.js)
  DEAD          — no caller anywhere

Plus secondary flag SUSPICIOUS:
  - Permissions.Anyone, no HTTP wrapper / cfw caller
  - name starts with a public-verb (submit/track/register/...) → looks
    publicly callable but isn't reachable from cfw
"""
from __future__ import annotations
import json
import re
import sys
from collections import Counter
from pathlib import Path

# ROOT auto-detects from script location: scripts/cf-dead-routes/ → repo root.
# Override via CFUTONS_ROOT env var if running from a non-standard checkout.
ROOT = Path(__import__("os").environ.get("CFUTONS_ROOT") or Path(__file__).resolve().parents[2])
SRC = ROOT / "src"
BACKEND = SRC / "backend"
HTTP_FILE = BACKEND / "http-functions.js"
EVENTS_FILE = BACKEND / "events.js"

# cfw repo for cross-rig caller check (gap-finder per cf-hpwy).
# Override via CFW_SRC env var if cfw lives elsewhere.
CFW_SRC = Path(__import__("os").environ.get("CFW_SRC") or "/Users/hal/gt/carolina-futons-web/src")

# `export const NAME = webMethod(Permissions.X, ...`
WM_RE = re.compile(
    r"^export\s+const\s+(\w+)\s*=\s*webMethod\s*\(\s*Permissions\.(\w+)",
    re.MULTILINE,
)

PUBLIC_VERB_RE = re.compile(
    r"^(submit|create|track|register|capture|send|notify|subscribe|"
    r"unsubscribe|redeem|claim|generate|update|delete)",
)

# cf-quba (cf-hpwy detector v3): allowlist for known-intentional
# Permissions.Anyone webMethods that match the public-verb pattern. Phase B
# audit (PR #1190) identified three legitimate cases that the SUSPICIOUS
# heuristic flags as false positives — guest-cart entry points and a
# customer-facing tracking endpoint. Each entry should pin to <module>.<name>
# so a same-named method in a different module isn't accidentally allowlisted.
#
# Entries are deliberately specific (module + name) and gated on a comment
# anchor so future additions are deliberate rather than drive-by.
INTENTIONAL_ANYONE = frozenset({
    # cartSessionService — guest-cart entry points (cannot require auth by
    # definition; documented in eventBus.js).
    "cartSessionService.createSession",
    "cartSessionService.updateCartItems",
    # ups-shipping — customer self-service tracking endpoint. Cited author
    # note + 6 actual internal callers.
    "ups-shipping.trackShipment",
    # pinterestCatalogSync — declares Permissions.Anyone explicitly and is
    # called by syncCatalogBatch within the same module to compose pin
    # content from a Wix product. No http-functions.js wrapper, no cfw
    # caller — the only consumer is the same-file orchestrator. The
    # "generate" verb prefix trips SUSPICIOUS; allowlisted because the
    # function only formats caller-supplied product data into a string
    # (no DB writes, no privileged reads, no PII), so Wix auto-RPC
    # exposure is harmless. cf-quba.fu1.
    "pinterestCatalogSync.generatePinContent",
})


def _module_qualified_name(file_rel: str, name: str) -> str:
    """Return `<module>.<name>` for INTENTIONAL_ANYONE lookup.

    `file_rel` is the path relative to repo root, e.g.
    `src/backend/cartSessionService.web.js`. We extract the basename minus
    the `.web.js` (or `.js`) suffix.
    """
    base = file_rel.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    return f"{base}.{name}"


def all_source_files() -> list[Path]:
    out: list[Path] = []
    for p in SRC.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix in (".js", ".jsx", ".ts", ".tsx"):
            out.append(p)
    return out


# cf-sq0d.fu2 (v3.2): strip JSDoc/block + line comments before checking
# caller hits. Without this, a JSDoc `@param {Object} foo - data from
# getAffiliateDashboard` line is credited as a real caller of the backend
# `getAffiliateDashboard` webMethod.
#
# Two passes:
#   1. Strip `/* … */` block comments (covers JSDoc and inline blocks).
#   2. Strip `// …` line comments — but preserve URL schemes like `https://`
#      by requiring the `//` to NOT be preceded by a `:` character.
_BLOCK_COMMENT_RE = re.compile(r"/\*[\s\S]*?\*/")
_LINE_COMMENT_RE = re.compile(r"(^|[^:])//[^\n]*")


def strip_js_comments(text: str) -> str:
    text = _BLOCK_COMMENT_RE.sub("", text)
    # Replace match with the captured non-`:` prefix so URL `://` survives.
    return _LINE_COMMENT_RE.sub(lambda m: m.group(1), text)


def collect_web_methods() -> dict[str, dict]:
    methods: dict[str, dict] = {}
    for fp in BACKEND.rglob("*.web.js"):
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        for m in WM_RE.finditer(text):
            name, perm = m.group(1), m.group(2)
            line = text[: m.start()].count("\n") + 1
            methods[name] = {
                "file": str(fp.relative_to(ROOT)),
                "permission": perm,
                "line": line,
            }
    return methods


# cf-sq0d (cf-hpwy detector v3): filesystem-path reference detection.
#
# The v2 detector closed the same-file caller blind-spot. v3 closes the
# next layer up: a same-path-as-string caller. cf-4x7e Pass 2 chunk 3
# (PR #1217) tripped on this when catalogImport.web.js was deleted —
# all 5 of its webMethods were correctly DEAD per v2, but
# scripts/validate-catalog.js and tests/validateCatalog.test.js both
# read the file directly via fs.readFileSync as the canonical source for
# VALID_CATEGORIES. v2 only scans for `import`/`from 'backend/...'`
# patterns, so the filesystem-path reads slipped past.
#
# Patterns we now flag (any of these → file is FS-path-referenced):
#   1. fs.readFileSync('...src/backend/<module>.web.js'...)        — Node
#   2. path.resolve(__dirname, '...src/backend/<module>...')       — relative
#   3. import x from '...src/backend/<module>?raw'                  — Vite ?raw
#   4. quoted bare path in array/string: '...src/backend/<module>...' — generic
#
# All four collapse to the same shape: a quoted string literal containing
# the substring `src/backend/<module>` (with or without the `.web.js`
# suffix). One regex catches all four — we don't need to model each call
# shape because the path string itself is the signal.
#
# False positive risk: a comment or doc that happens to quote the path
# wouldn't be a real reference. Acceptable trade-off — comments referencing
# the file are themselves a load-bearing signal that someone cared about
# the file enough to write about it. Extreme false-positive cases (e.g.
# CHANGELOG entries naming all 802 files) can be filtered out later by
# adding a comment-stripping pass.
FS_PATH_REF_RE_TEMPLATE = (
    r"""['"`][^'"`]*src/backend/{module}(?:\.web)?\.js[^'"`]*['"`]"""
)


def _module_basename(file_rel: str) -> str:
    """Return module basename (no extension) for fs-path lookup.

    `src/backend/catalogImport.web.js` → `catalogImport`.
    `src/backend/sub/foo.js`           → `foo`.
    """
    base = file_rel.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if base.endswith(suffix):
            return base[: -len(suffix)]
    return base


def collect_filesystem_path_refs(files: list[Path]) -> dict[str, list[str]]:
    """Scan all source files for filesystem-path references to backend modules.

    Returns a dict mapping module basename (e.g. 'catalogImport') → list of
    relative source paths that reference it via a quoted filesystem path.
    Self-references (the defining file referencing itself) are filtered —
    only cross-file references prove an external consumer.
    """
    backend_modules: set[str] = set()
    for fp in BACKEND.rglob("*.js"):
        if not fp.is_file():
            continue
        backend_modules.add(_module_basename(str(fp.relative_to(ROOT))))

    if not backend_modules:
        return {}

    # One compiled regex per backend module — anchored on a literal module
    # name so backtracking is bounded.
    patterns = {
        mod: re.compile(FS_PATH_REF_RE_TEMPLATE.format(module=re.escape(mod)))
        for mod in backend_modules
    }

    # Also scan files outside `src/` — scripts/, tests/ are the documented
    # cf-4x7e blast site. Build a lazy file list that includes both src/ and
    # the repo-root scripts/+tests/ trees if they exist.
    scan_files: list[Path] = list(files)
    for extra_root in ("scripts", "tests"):
        extra_path = ROOT / extra_root
        if not extra_path.exists():
            continue
        for p in extra_path.rglob("*"):
            if not p.is_file():
                continue
            if p.suffix in (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"):
                scan_files.append(p)

    refs: dict[str, list[str]] = {mod: [] for mod in backend_modules}
    for fp in scan_files:
        try:
            rel = str(fp.relative_to(ROOT))
        except ValueError:
            continue
        rel_basename = _module_basename(rel)
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        for mod, pat in patterns.items():
            if mod == rel_basename:
                continue
            if pat.search(text):
                refs[mod].append(rel)
    return refs


def collect_cfw_files() -> list[Path]:
    if not CFW_SRC.exists():
        return []
    out: list[Path] = []
    for p in CFW_SRC.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix in (".js", ".jsx", ".ts", ".tsx"):
            out.append(p)
    return out


def cfw_references(name: str, cfw_files: list[Path]) -> tuple[list[str], list[str]]:
    """Return (high_confidence, low_confidence) cfw paths.

    High confidence:
      - `/_functions/<NAME>` literal URL fragment (direct fetch)
      - `method: "<...>/<NAME>"` or `method: g("<NAME>")` etc. (callVelo pattern)
    Low confidence:
      - Bare `\\bNAME\\b` reference anywhere in cfw source (could be a name
        collision with a cfw-internal symbol).
    """
    pat_word = re.compile(rf"\b{re.escape(name)}\b")
    pat_url = re.compile(rf"/_functions/(?:[A-Za-z0-9_-]+/)?{re.escape(name)}\b")
    pat_method_str = re.compile(
        rf"""method\s*:\s*[`'"](?:[A-Za-z0-9_-]+/)?{re.escape(name)}\b"""
    )
    pat_method_helper = re.compile(rf"""[gmhl]\s*\(\s*[`'"]{re.escape(name)}\b""")
    high: list[str] = []
    low: list[str] = []
    for fp in cfw_files:
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(fp.relative_to(CFW_SRC.parent))
        if (
            pat_url.search(text)
            or pat_method_str.search(text)
            or pat_method_helper.search(text)
        ):
            high.append(rel)
        elif pat_word.search(text):
            low.append(rel)
    return high, low


def classify_method(
    name: str,
    info: dict,
    files: list[Path],
    cfw_files: list[Path],
    http_text: str,
    events_text: str,
    fs_path_refs: dict[str, list[str]] | None = None,
) -> dict:
    """Return classification for this webMethod."""
    defining_file = info["file"]
    pat_call = re.compile(rf"\b{re.escape(name)}\s*\(")  # NAME(... call
    pat_import = re.compile(rf"\b{re.escape(name)}\b")  # any reference (for imports)
    # cf-sq0d.fu1 (v3.1): same-name-collision filter. Detect when a candidate
    # caller defines its own function / const / let / var with the same name
    # as the backend webMethod — those are local-symbol collisions, not
    # backend callers. Two regressions surfaced this:
    #   chunk 11: src/public/AddToCart.js declares `async function checkBackInStock(...)`
    #             and was being credited as a caller of the same-named backend method.
    #   chunk 12: src/public/bundleDiscountExperiment.js declares `export function
    #             calculateBundleDiscount(...)` and was credited similarly.
    # The filter only skips a file when it has a local definition AND no
    # explicit `'backend/<module>'` import string for the defining module —
    # so a legitimate caller that re-exports a backend symbol under the same
    # local name (rare but possible) still gets counted.
    pat_local_def = re.compile(
        rf"(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+{re.escape(name)}\b"
    )
    defining_module_basename = defining_file.rsplit("/", 1)[-1]
    for suffix in (".web.js", ".js"):
        if defining_module_basename.endswith(suffix):
            defining_module_basename = defining_module_basename[: -len(suffix)]
            break
    pat_backend_import_quoted = re.compile(
        rf"""['"`](?:[\w./-]*?){re.escape(defining_module_basename)}(?:\.web)?['"`]"""
    )

    in_http = bool(
        pat_call.search(http_text) or pat_import.search(http_text)
    )
    in_events = bool(
        pat_import.search(events_text)
    )
    in_public = False
    in_pages = False
    in_pdocs_backend = False  # other backend (not defining file, not http-functions, not events)
    in_same_file = False  # NAME( call inside the defining file (excluding the export decl)
    sample_callers: list[str] = []

    for fp in files:
        rel = str(fp.relative_to(ROOT))
        if rel == defining_file:
            # v2 fix: same-file detection. Scan the defining file for NAME(
            # call sites — `pat_call` requires `\bNAME\s*\(` which excludes the
            # export declaration `export const NAME = webMethod(` (no `(` directly
            # after NAME) and excludes JSDoc / log-string mentions.
            try:
                self_text = fp.read_text(errors="ignore")
            except OSError:
                continue
            # cf-sq0d.fu2: strip comments before the same-file call check so
            # a JSDoc `@example NAME()` snippet in the defining file's own
            # docstring isn't credited as a real same-file caller.
            self_text = strip_js_comments(self_text)
            if pat_call.search(self_text):
                in_same_file = True
                if len(sample_callers) < 5:
                    sample_callers.append(f"{rel} (same-file)")
            continue
        if rel == "src/backend/http-functions.js":
            continue  # handled
        if rel == "src/backend/events.js":
            continue  # handled
        try:
            text = fp.read_text(errors="ignore")
        except OSError:
            continue
        # cf-sq0d.fu2 (v3.2): comment-strip before checking caller hits so
        # JSDoc-only mentions ("@param … from getAffiliateDashboard") don't
        # masquerade as callers. The local-def + backend-import checks below
        # still run against the stripped view for the same reason.
        stripped = strip_js_comments(text)
        if not pat_import.search(stripped):
            continue
        # cf-sq0d.fu1: skip same-name-collision callers. If the file defines
        # its own function/const with this name AND has no explicit string
        # reference to the defining backend module, the name match is local —
        # not a backend caller.
        if pat_local_def.search(stripped) and not pat_backend_import_quoted.search(stripped):
            continue
        # any reference counts; don't require call form (could be re-export, type ref)
        if rel.startswith("src/public/"):
            in_public = True
        elif rel.startswith("src/pages/"):
            in_pages = True
        elif rel.startswith("src/backend/") and rel.endswith(".web.js"):
            in_pdocs_backend = True
        elif rel.startswith("src/backend/"):
            in_pdocs_backend = True
        if len(sample_callers) < 5:
            sample_callers.append(rel)

    # cf-sq0d (v3): a file referenced by filesystem path from another module
    # is NOT dead — deleting it would ENOENT the consumer. Surface these as a
    # distinct bucket so the operator sees WHY the demotion happened (and can
    # decide whether to refactor the consumer to use a proper import).
    fs_path_consumers: list[str] = []
    if fs_path_refs:
        module_basename = _module_basename(defining_file)
        fs_path_consumers = list(fs_path_refs.get(module_basename, []))
    in_fs_path = bool(fs_path_consumers)

    buckets: list[str] = []
    if in_http:
        buckets.append("HTTP-EXPOSED")
    if in_events:
        buckets.append("EVENT-WIRED")
    if in_public or in_pages:
        buckets.append("FRONTEND")
    if in_pdocs_backend or in_same_file:
        buckets.append("INTERNAL")
    if in_fs_path:
        buckets.append("FILESYSTEM-PATH-REFERENCED")
    if not buckets:
        buckets = ["DEAD"]

    # cf-quba: allowlist filter — gate the SUSPICIOUS classification so
    # known-intentional Anyone endpoints stop generating noise.
    qualified = _module_qualified_name(defining_file, name)
    suspicious = (
        info["permission"] == "Anyone"
        and "HTTP-EXPOSED" not in buckets
        and "FRONTEND" not in buckets
        and PUBLIC_VERB_RE.match(name) is not None
        and qualified not in INTENTIONAL_ANYONE
    )

    cfw_high, cfw_low = cfw_references(name, cfw_files)
    has_cfw_high = bool(cfw_high)
    has_cfw_low = bool(cfw_low)
    has_cfw_any = bool(cfw_high or cfw_low)

    # Gap-finder verdict (cf-hpwy core deliverable)
    if not in_http and has_cfw_high:
        gap_verdict = "GAP-CFW-WANTS"  # cfw calls it via /_functions or callVelo, no HTTP wrapper
    elif in_http and has_cfw_high:
        gap_verdict = "OK-WIRED"
    elif in_http and not has_cfw_high:
        gap_verdict = "WRAPPED-NO-CONSUMER"
    elif buckets == ["DEAD"] and not has_cfw_any:
        gap_verdict = "UNUSED-CAN-DELETE"
    elif has_cfw_low:
        gap_verdict = "MAYBE-CFW-NAME-COLLISION"  # bare-word match only
    else:
        gap_verdict = "VELO-INTERNAL"  # used inside Velo; cfw isn't a consumer

    return {
        "name": name,
        "file": defining_file,
        "line": info["line"],
        "permission": info["permission"],
        "bucket": buckets,
        "suspicious": suspicious,
        "gap_verdict": gap_verdict,
        "in_http": in_http,
        "in_events": in_events,
        "in_public": in_public,
        "in_pages": in_pages,
        "in_other_backend": in_pdocs_backend,
        "in_same_file": in_same_file,
        "in_filesystem_path": in_fs_path,
        "filesystem_path_consumers": fs_path_consumers[:6],
        "sample_callers": sample_callers,
        "cfw_high_refs": cfw_high[:6],
        "cfw_low_refs": cfw_low[:6],
        "cfw_high_count": len(cfw_high),
        "cfw_low_count": len(cfw_low),
    }


def main() -> int:
    files = all_source_files()
    methods = collect_web_methods()
    print(f"scanning {len(files)} src files", file=sys.stderr)
    print(f"webMethods discovered: {len(methods)}", file=sys.stderr)

    # cf-sq0d.fu2: strip JSDoc/line comments from the http and events text up
    # front so a JSDoc-only mention (e.g. `// see also: post_someName`) in
    # those files doesn't count as a wiring of NAME.
    http_text = (
        strip_js_comments(HTTP_FILE.read_text(errors="ignore")) if HTTP_FILE.exists() else ""
    )
    events_text = (
        strip_js_comments(EVENTS_FILE.read_text(errors="ignore"))
        if EVENTS_FILE.exists()
        else ""
    )
    # Also fold any *.events.js into events_text
    for fp in BACKEND.rglob("*.events.js"):
        try:
            events_text += "\n" + strip_js_comments(fp.read_text(errors="ignore"))
        except OSError:
            continue

    cfw_files = collect_cfw_files()
    print(f"cfw src files: {len(cfw_files)}", file=sys.stderr)

    # cf-sq0d (v3): scan for filesystem-path references once up front; pass
    # the result into classify_method so each row can demote DEAD → INTERNAL
    # when its defining file is read by path from elsewhere.
    fs_path_refs = collect_filesystem_path_refs(files)
    fs_path_referenced_modules = sum(1 for v in fs_path_refs.values() if v)
    print(
        f"backend modules referenced by filesystem-path: {fs_path_referenced_modules}",
        file=sys.stderr,
    )

    rows = [
        classify_method(
            name, info, files, cfw_files, http_text, events_text, fs_path_refs
        )
        for name, info in methods.items()
    ]

    Path("/tmp/cf-dead-routes/results.json").write_text(json.dumps(rows, indent=2))

    # Single-bucket tally
    primary = Counter()
    for r in rows:
        primary[r["bucket"][0]] += 1
    print("\nPrimary bucket (first match):", file=sys.stderr)
    for b, c in primary.most_common():
        print(f"  {b}: {c}", file=sys.stderr)

    multi = Counter()
    for r in rows:
        for b in r["bucket"]:
            multi[b] += 1
    print("\nAny-match tally (rows can appear in multiple):", file=sys.stderr)
    for b, c in multi.most_common():
        print(f"  {b}: {c}", file=sys.stderr)

    sus = [r for r in rows if r["suspicious"]]
    print(f"\nSUSPICIOUS (Permissions.Anyone, public-verb name, not HTTP/frontend reachable): {len(sus)}", file=sys.stderr)

    dead = [r for r in rows if r["bucket"] == ["DEAD"]]
    print(f"DEAD (no caller anywhere): {len(dead)}", file=sys.stderr)

    print("\nGap-verdict tally (cf-hpwy core):", file=sys.stderr)
    gap = Counter(r["gap_verdict"] for r in rows)
    for v, c in gap.most_common():
        print(f"  {v}: {c}", file=sys.stderr)
    gaps = [r for r in rows if r["gap_verdict"] == "GAP-CFW-WANTS"]
    if gaps:
        print(f"\n🚨 GAP-CFW-WANTS — cfw URL/callVelo references but no HTTP wrapper ({len(gaps)}):", file=sys.stderr)
        for r in gaps:
            print(f"  {r['name']:35s} {r['file']}:{r['line']}  perm={r['permission']}  cfw_high={r['cfw_high_count']}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
