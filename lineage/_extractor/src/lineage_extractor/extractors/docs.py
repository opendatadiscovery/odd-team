"""documentation axis — the ground-truth doc-lineage ingester.

This is the deterministic, mechanical half of the ground-truth-lineage layer
(`adrs/drafts/ground-truth-lineage.md`). It walks the published documentation
manual (the GitBook markdown under `../documentation/docs/`) and emits one
`Doc` node per heading/anchor section, so the live documentation becomes a
first-class, searchable, traversable surface of the ontology — the positive-
space counterpart to the derived `DocGap` nodes.

Contract (the maintainer's call, 2026-05-29): **doc prose is referenced, not
copied.** `../documentation` stays the sole prose source of truth. This module
commits only the *addressing* of each section — repo-relative path, heading
path, anchor, a best-effort live-URL guess, a content hash, and the section's
outbound links. The section prose itself is NOT written here; the graph
embedder reads it from `../documentation` at build time (see
`graph_query/loaders.py:_load_doc_nodes`). Zero prose duplication; the content
hash is the drift anchor.

Determinism (mirrors the rest of the substrate): files iterate in sorted path
order; nodes are sorted by id before writing; hashing is over normalised text
so a trailing-whitespace edit does not churn the hash; only repo-relative paths
are emitted (CLAUDE.md Rule 5 — no absolute paths in committed artefacts).

No LLM, no network. The semantic reverse-links (which concepts / features /
code a page documents) are the *agentic* half — the `doc-analyser` subagent
emits `doc-understanding/*.md` sidecars carrying `DESCRIBES` edges. This module
is the cheap, exhaustive scaffold those sidecars attach to.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from lineage_extractor.repo import short_sha

# The published manual's live origin. The *guess* this module computes from the
# docs-relative path is best-effort only — GitBook derives the real slug from
# the page title at render time and rewrites it (e.g. `attachments.md` ->
# `.../data-entity-attachments`), so the authoritative live URL is a re-verified
# attribute the `doc-verifier` subagent writes back, never this guess.
BASE_URL = "https://docs.opendatadiscovery.org"

DOC_REPO = "documentation"
DOCS_SUBDIR = "docs"

_ATX_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_FENCE_RE = re.compile(r"^(```|~~~)")
_MD_LINK_RE = re.compile(r"\[(?:[^\]]*)\]\(([^)]+)\)")
_BARE_URL_RE = re.compile(r"https?://[^\s)\]<>\"'`]+")
_SLUG_STRIP_RE = re.compile(r"[^a-z0-9\s_-]")   # keep underscores (GitHub-style word chars)
_SLUG_SPACE_RE = re.compile(r"\s+")             # only whitespace collapses to a hyphen


# --------------------------------------------------------------------------
# Records


@dataclass
class DocSection:
    """One heading-bounded section of a markdown page (the chunking unit).

    `body` is the prose between this heading and the next heading of any level
    — it is used here only to compute the content hash and is NOT persisted
    (reference-upstream). The graph loader re-derives it from `../documentation`
    via the same `split_sections` so the prose the embedder sees matches the
    prose this hash anchors."""

    heading_path: list[str]      # breadcrumb of ancestor headings incl. this one
    level: int                   # 1..6 (the `#` count)
    anchor: str                  # per-page-unique GitHub/GitBook-style slug
    body: str                    # section prose (heading line excluded)
    start_line: int              # 1-based line of the heading in the page


@dataclass
class DocNode:
    """One row of `doc-nodes.jsonl` — a `Doc` graph node's committed addressing.

    Mirrors `nodes.Node`'s greppable-id philosophy: the id is a human-readable
    `documentation {relpath}#{anchor}`, not an opaque hash. `content_hash` (the
    sha256 of the normalised section prose) is separate and used for *drift*
    detection, never identity."""

    id: str
    repo: str
    repo_rel_path: str           # relative to the documentation repo, e.g. docs/data-discovery/attachments.md
    page_title: str
    heading: str
    heading_path: list[str]
    anchor: str
    level: int
    char_count: int
    content_hash: str
    live_url: str                # best-effort guess; verifier writes the resolved value
    summary_group: str           # the SUMMARY.md `## group` the page sits under ("" if orphan)
    in_summary: bool
    links: list[dict[str, str]] = field(default_factory=list)
    source_line: int = 0


@dataclass
class DocIngestResult:
    ok: bool
    upstream_commit: str
    page_count: int
    node_count: int
    missing: list[str] = field(default_factory=list)   # in SUMMARY, not on disk
    orphan: list[str] = field(default_factory=list)     # on disk, not in SUMMARY
    summary: str = ""
    error: str | None = None


# --------------------------------------------------------------------------
# Text helpers (deterministic, pure)


def slugify(text: str) -> str:
    """GitHub/GitBook-style heading anchor slug.

    Lowercase; drop anything that is not a letter, digit, space or hyphen;
    collapse whitespace/underscores to single hyphens; strip leading/trailing
    hyphens. Matches the anchor GitBook generates for a heading, which is what a
    live `#fragment` link resolves against."""
    text = text.strip().lower()
    text = _SLUG_STRIP_RE.sub("", text)
    text = _SLUG_SPACE_RE.sub("-", text)
    return text.strip("-")


def normalize_for_hash(text: str) -> str:
    """Normalise section prose before hashing so trivial whitespace edits do not
    churn the content hash (and so re-ingestion is idempotent). Strips trailing
    per-line whitespace, normalises line endings, and collapses 3+ blank lines
    to one."""
    lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    out: list[str] = []
    blanks = 0
    for ln in lines:
        if ln == "":
            blanks += 1
            if blanks <= 1:
                out.append(ln)
        else:
            blanks = 0
            out.append(ln)
    return "\n".join(out).strip()


def section_content_hash(body: str) -> str:
    """Drift anchor for a doc section: sha256 of the normalised prose. Public so
    the graph loader can recompute it against live upstream prose and flag drift
    when the committed `content_hash` no longer matches (reference-upstream)."""
    return "sha256:" + hashlib.sha256(normalize_for_hash(body).encode("utf-8")).hexdigest()[:32]


def split_sections(markdown: str) -> list[DocSection]:
    """Split a markdown page into heading-bounded sections, in document order.

    Each ATX heading (`#`..`######`) opens a section whose body runs until the
    next heading of ANY level. `heading_path` is the breadcrumb of ancestor
    headings by level (a stack), so a section knows its place in the page. Anchor
    slugs are de-duplicated per page with the GitHub `-1`/`-2` suffix so every
    section id is unique and matches the live anchor. Fenced code blocks are
    skipped so a `# comment` line inside a code fence is not mistaken for a
    heading.

    Used at ingest (to hash) AND at graph-build (the loader re-derives the prose
    to embed) — so it must stay deterministic and stable."""
    lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    sections: list[DocSection] = []
    stack: list[tuple[int, str]] = []        # (level, heading text) ancestor stack
    seen_anchors: dict[str, int] = {}
    cur: DocSection | None = None
    cur_body: list[str] = []
    in_fence = False

    def _flush() -> None:
        if cur is not None:
            cur.body = "\n".join(cur_body).strip()
            sections.append(cur)

    for idx, line in enumerate(lines):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            if cur is not None:
                cur_body.append(line)
            continue
        m = None if in_fence else _ATX_HEADING_RE.match(line)
        if m:
            _flush()
            level = len(m.group(1))
            heading = m.group(2).strip()
            # Maintain the ancestor stack: pop headings at >= this level.
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, heading))
            heading_path = [h for _lvl, h in stack]
            base_anchor = slugify(heading) or "section"
            n = seen_anchors.get(base_anchor, 0)
            seen_anchors[base_anchor] = n + 1
            anchor = base_anchor if n == 0 else f"{base_anchor}-{n}"
            cur = DocSection(
                heading_path=heading_path, level=level, anchor=anchor,
                body="", start_line=idx + 1,
            )
            cur_body = []
        elif cur is not None:
            cur_body.append(line)
        # Preamble before the first heading is intentionally dropped — GitBook
        # pages lead with the H1 title; any stray preamble is front-matter noise.
    _flush()
    return sections


def extract_links(body: str, page_rel_path: str) -> list[dict[str, str]]:
    """Outbound links in a section: intra-doc (`.md` / `#anchor`) and external
    (`http(s)://`). Each is `{target, kind}` with kind ∈ {doc, anchor, external,
    other}. Deterministic, de-duplicated, sorted."""
    found: dict[str, str] = {}
    for target in _MD_LINK_RE.findall(body):
        target = _unescape_md(target.strip())
        if not target or target.startswith("<"):
            continue
        base = target.split(" ", 1)[0]          # strip optional `"title"`
        if base.startswith("http://") or base.startswith("https://"):
            kind = "external"
        elif base.startswith("#"):
            kind = "anchor"
        elif base.endswith(".md") or ".md#" in base:
            kind = "doc"
        elif base.startswith("mailto:"):
            kind = "other"
        else:
            kind = "other"
        found[base] = kind
    for url in _BARE_URL_RE.findall(body):
        found.setdefault(url, "external")
    return [{"target": t, "kind": k} for t, k in sorted(found.items())]


# --------------------------------------------------------------------------
# SUMMARY.md — the completeness validator (denominator from the upstream's own
# index, never the mirror's directory listing — CONSISTENCY-MAINTENANCE §3).


_SUMMARY_GROUP_RE = re.compile(r"^##\s+(.*?)\s*$")
_SUMMARY_LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+\.md)\)")
_MD_ESCAPE_RE = re.compile(r"\\([_\-.*()\[\]`])")


def _unescape_md(text: str) -> str:
    """Undo markdown backslash-escapes in a link target. GitBook's SUMMARY.md
    escapes underscores (`quick\\_launch\\_...md`); the on-disk filename has none,
    so the escaped form must be normalised before matching or every escaped page
    reads as both `missing` (escaped path absent on disk) and `orphan` (real
    file absent from SUMMARY)."""
    return _MD_ESCAPE_RE.sub(r"\1", text)


def parse_summary(summary_text: str) -> dict[str, str]:
    """Map each docs-relative `.md` path referenced in SUMMARY.md to the `##`
    group it sits under. The key set is the *authoritative page denominator*
    for the completeness check; the value is the live-URL prefix guess."""
    group = ""
    out: dict[str, str] = {}
    for line in summary_text.split("\n"):
        gm = _SUMMARY_GROUP_RE.match(line)
        if gm:
            group = gm.group(1).strip()
            continue
        for rel in _SUMMARY_LINK_RE.findall(line):
            rel = _unescape_md(rel.strip().lstrip("./"))
            out.setdefault(rel, group)
    return out


def _live_url_guess(docs_rel: str, summary_group: str, anchor: str, level: int) -> str:
    """Best-effort live URL from the docs-relative path + SUMMARY group prefix.

    GitBook reality: the real slug is title-derived and may be rewritten, so
    this is a *guess* the `doc-verifier` subagent confirms/corrects via WebFetch.
    `docs/data-discovery/attachments.md` under `## Features` ->
    `{BASE}/features/data-discovery/attachments[#anchor]`."""
    stem = docs_rel
    if stem.startswith(DOCS_SUBDIR + "/"):
        stem = stem[len(DOCS_SUBDIR) + 1:]
    stem = stem[:-3] if stem.endswith(".md") else stem
    if stem.lower() in ("readme", "summary"):
        stem = ""
    # GitBook lowercases path segments in the published URL (Architecture.md ->
    # /architecture). Slugify each segment so the guess matches case; the real
    # title-derived slug rewrite is still the verifier's job.
    stem = "/".join(slugify(seg) for seg in stem.split("/") if seg)
    prefix = slugify(summary_group) if summary_group else ""
    parts = [p for p in (prefix, stem) if p]
    url = BASE_URL + "/" + "/".join(parts) if parts else BASE_URL
    # The page-root (H1) addresses the page; deeper headings add the fragment.
    if level > 1 and anchor:
        url = f"{url}#{anchor}"
    return url


# --------------------------------------------------------------------------
# Ingest


def ingest_docs(documentation_repo_path: Path, lineage_dir: Path, *, dry_run: bool = False) -> DocIngestResult:
    """Walk `documentation_repo_path/docs/` and write `doc-nodes.jsonl` +
    `documentation/_manifest.yaml` under `lineage_dir`. Pure mechanical
    transcription — see module docstring."""
    docs_root = documentation_repo_path / DOCS_SUBDIR
    if not docs_root.is_dir():
        return DocIngestResult(
            ok=False, upstream_commit="", page_count=0, node_count=0,
            error=f"docs root not found: {docs_root} (is ../{DOC_REPO} cloned?)",
        )

    summary_path = docs_root / "SUMMARY.md"
    summary_map = parse_summary(summary_path.read_text(encoding="utf-8")) if summary_path.is_file() else {}

    # `.gitbook/` holds GitBook's reusable include partials + assets — content
    # spliced into pages, not navigable pages. SUMMARY.md is the page set, so
    # these are skipped (else they read as orphans).
    md_paths = sorted(
        p for p in docs_root.rglob("*.md")
        if p.name != "SUMMARY.md" and ".gitbook" not in p.parts
    )
    on_disk: set[str] = set()
    nodes: list[DocNode] = []

    for page_path in md_paths:
        docs_rel = page_path.relative_to(docs_root).as_posix()             # e.g. data-discovery/attachments.md
        repo_rel = f"{DOCS_SUBDIR}/{docs_rel}"                              # e.g. docs/data-discovery/attachments.md
        on_disk.add(docs_rel)
        text = page_path.read_text(encoding="utf-8")
        sections = split_sections(text)
        page_title = sections[0].heading_path[0] if sections else Path(docs_rel).stem
        group = summary_map.get(docs_rel, "")
        in_summary = docs_rel in summary_map
        for sec in sections:
            anchor_suffix = f"#{sec.anchor}" if sec.level > 1 else ""
            node_id = f"{DOC_REPO} {repo_rel}{anchor_suffix}"
            nodes.append(
                DocNode(
                    id=node_id,
                    repo=DOC_REPO,
                    repo_rel_path=repo_rel,
                    page_title=page_title,
                    heading=sec.heading_path[-1],
                    heading_path=sec.heading_path,
                    anchor=sec.anchor,
                    level=sec.level,
                    char_count=len(sec.body),
                    content_hash=section_content_hash(sec.body),
                    live_url=_live_url_guess(repo_rel, group, sec.anchor, sec.level),
                    summary_group=group,
                    in_summary=in_summary,
                    links=extract_links(sec.body, repo_rel),
                    source_line=sec.start_line,
                )
            )

    nodes.sort(key=lambda n: n.id)
    missing = sorted(set(summary_map) - on_disk)
    orphan = sorted(on_disk - set(summary_map))
    upstream_commit = _safe_short_sha(documentation_repo_path)

    summary_txt = "\n".join([
        f"doc-lineage ingest — repo={DOC_REPO} upstream={upstream_commit}",
        f"pages: {len(md_paths)}  sections (Doc nodes): {len(nodes)}",
        f"completeness: {len(on_disk & set(summary_map))}/{len(summary_map)} SUMMARY pages on disk"
        f"  missing={len(missing)}  orphan={len(orphan)}",
    ])

    if not dry_run:
        _write_doc_nodes(lineage_dir / "doc-nodes.jsonl", nodes)
        _write_doc_manifest(
            lineage_dir / "documentation" / "_manifest.yaml",
            upstream_commit=upstream_commit, page_count=len(md_paths),
            node_count=len(nodes), summary_pages=len(summary_map),
            missing=missing, orphan=orphan,
        )

    return DocIngestResult(
        ok=True, upstream_commit=upstream_commit, page_count=len(md_paths),
        node_count=len(nodes), missing=missing, orphan=orphan, summary=summary_txt,
    )


def _safe_short_sha(repo_path: Path) -> str:
    try:
        return short_sha(repo_path)
    except Exception:  # noqa: BLE001 — a docs repo without git history is still ingestable
        return "unknown"


def _write_doc_nodes(path: Path, nodes: list[DocNode]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for node in nodes:
            fh.write(json.dumps(asdict(node), ensure_ascii=False, sort_keys=True))
            fh.write("\n")
    return len(nodes)


def _write_doc_manifest(
    path: Path, *, upstream_commit: str, page_count: int, node_count: int,
    summary_pages: int, missing: list[str], orphan: list[str],
) -> None:
    """The drift + completeness manifest. Stores the upstream commit anchor
    (tier-0 drift) + completeness (denominator from SUMMARY). Per-section content
    hashes live in doc-nodes.jsonl (tier-1 drift), not duplicated here. No
    absolute paths (Rule 5) — the upstream repo is named relatively."""
    from ruamel.yaml import YAML

    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "surface": "documentation",
        "upstream_repo": f"../{DOC_REPO}",
        "upstream_commit": upstream_commit,
        "page_count": page_count,
        "node_count": node_count,
        "completeness": {
            "summary_pages": summary_pages,
            "missing": missing,      # in SUMMARY.md, absent on disk
            "orphan": orphan,        # on disk, absent from SUMMARY.md
            "complete": not missing and not orphan,
        },
        "prose_source": "reference-upstream (not copied; embedded at graph-build)",
        "generated_by": "lineage_extractor.extractors.docs.ingest_docs",
    }
    yaml = YAML()
    yaml.indent(mapping=2, sequence=4, offset=2)
    with path.open("w", encoding="utf-8") as fh:
        fh.write("# GENERATED — do not edit; rebuilt by `lineage-extractor docs-ingest`.\n")
        fh.write("# Source of truth for doc prose is ../documentation; this is addressing only.\n")
        fh.write("# adrs/drafts/ground-truth-lineage.md\n")
        yaml.dump(payload, fh)
