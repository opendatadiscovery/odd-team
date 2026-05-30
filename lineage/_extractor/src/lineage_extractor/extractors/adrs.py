"""ADR axis — the ground-truth Architecture-Decision-Record ingester.

Phase 2 of the ground-truth-lineage layer (`adrs/drafts/ground-truth-lineage.md`):
the positive-space counterpart to the derived `ImplicitADR` candidates. Where
the `adr-archaeologist` reducer surfaces *candidate* decisions (`ADR-CANDIDATE-NNN`),
this module projects the **published, human-ratified** ADRs — a real, committed
external surface, not a regenerated guess. The bare-noun asymmetry IS the
documentation: `ADR` vs `ImplicitADR`.

The join this module performs (two sources, deliberately split for audience
isolation):

1. **Published ADR pages** — `../documentation/docs/developer-guides/
   architecture-decision-log/ADR-*.md`. The ADR's *identity* (`adr_id`, `title`,
   `status`, `date`) and its *content* (hash over the normalised body, the
   resolved live URL). These are written for ODD contributors and live in the
   published manual.
2. **Workspace lineage sidecars** — `backlog/adr/{adr_id}.md`. The *ontology
   join* (`promoted_from` / `realises` / `superseded_by`) the maintainer keeps
   OUT of the published manual. This is where the graph edges come from.

Like the docs axis, this is the deterministic, mechanical half: no LLM, no
network. ADR-page prose is NOT copied — only the addressing + the join are
committed (`content_hash` is the drift anchor; the body is read from
`../documentation` at need). Determinism: ADRs iterate in sorted `adr_id` order;
rows are sorted by `adr_id` before writing; hashing is over normalised text so a
trailing-whitespace edit does not churn the hash; only repo-relative paths are
emitted (CLAUDE.md Rule 5 — no absolute paths in committed artefacts).

The semantic edges this enables (`PROMOTED_TO` / `REALISES` / `SUPERSEDED_BY`)
are wired by `graph_query/projector.py`; this module only emits the addressed,
joined node rows the projector reads.
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

# Reuse the docs-axis text helpers rather than reimplement — the ADR pages are
# the same GitBook markdown, so the same slug/hash/URL logic must apply (else a
# live `#fragment` link or a drift hash would silently diverge between axes).
from lineage_extractor.extractors.docs import (
    DOC_REPO,
    DOCS_SUBDIR,
    _live_url_guess,
    parse_summary,
    section_content_hash,
    slugify,
)
from lineage_extractor.repo import short_sha

# The published ADR log lives here in the documentation repo. The individual
# `ADR-*.md` pages are the nodes; `README.md` is the index page, skipped.
ADR_LOG_SUBDIR = "developer-guides/architecture-decision-log"

# Workspace-side lineage sidecars (the join), kept OUT of the published manual.
# Resolved relative to the workspace root (the directory containing `lineage/`),
# never hardcoded (CLAUDE.md Rule 5).
ADR_BACKLOG_SUBDIR = "backlog/adr"

_yaml = YAML(typ="safe")
_FRONTMATTER_FENCE = "---"


# --------------------------------------------------------------------------
# Records


@dataclass
class ADRNode:
    """One row of `adr-nodes.jsonl` — a published ADR's committed addressing +
    its ontology join.

    Identity is `adr_id` (e.g. `ADR-0001`), the human-readable id the published
    page and the workspace sidecar agree on. `content_hash` (sha256 of the
    normalised page body) is the drift anchor, never identity. The join fields
    (`promoted_from` / `realises` / `superseded_by`) come from the workspace
    sidecar, not the published page — they are the edges the projector wires."""

    adr_id: str
    title: str
    status: str
    date: str
    repo_rel_path: str            # relative to the documentation repo
    anchor: str                   # slug of the page H1 (page-level anchor)
    live_url: str                 # best-effort guess; verifier confirms
    content_hash: str
    promoted_from: str            # the ADR-CANDIDATE-NNN id (or "" if none)
    realises: list[str] = field(default_factory=list)
    superseded_by: str = ""       # an ADR-NNNN id (or "" if none)


@dataclass
class ADRIngestResult:
    ok: bool
    upstream_commit: str
    adr_count: int
    unresolved: list[str] = field(default_factory=list)   # join warnings
    summary: str = ""
    error: str | None = None


# --------------------------------------------------------------------------
# Frontmatter (the ADR pages + the workspace sidecars are both YAML-frontmatter
# markdown). Body = everything after the closing fence — that is what gets
# hashed (the published-page prose), so a frontmatter edit (status flip) does
# not churn the content hash, and a body edit does.


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (frontmatter dict, body-after-fence). Mirrors the loader's
    `_split_frontmatter` semantics; malformed frontmatter yields ({}, full
    text) rather than crashing (conform-or-skip)."""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    if not lines or lines[0].strip() != _FRONTMATTER_FENCE:
        return {}, text
    for idx in range(1, len(lines)):
        if lines[idx].strip() == _FRONTMATTER_FENCE:
            block = "\n".join(lines[1:idx])
            try:
                data = _yaml.load(block) or {}
            except Exception:  # noqa: BLE001 — malformed frontmatter is not a crash
                data = {}
            body = "\n".join(lines[idx + 1:])
            return (data if isinstance(data, dict) else {}), body
    return {}, text


_H1_RE = re.compile(r"^#\s+(.*?)\s*#*\s*$", re.MULTILINE)


def _page_h1_slug(body: str) -> str:
    """Slug of the page's H1 — the page-level anchor (mirrors the docs axis,
    which slugifies each heading). Falls back to "" if no H1 is found."""
    m = _H1_RE.search(body)
    return slugify(m.group(1)) if m else ""


# --------------------------------------------------------------------------
# Workspace-side join (backlog/adr/*.md)


def _load_join_index(workspace_root: Path) -> dict[str, dict[str, Any]]:
    """Map `adr_id` -> the workspace sidecar's join frontmatter
    (`promoted_from` / `realises` / `superseded_by`). Keyed by the sidecar's
    own `adr_id` (not its filename) so a rename of the file cannot silently
    break the join."""
    backlog = workspace_root / ADR_BACKLOG_SUBDIR
    index: dict[str, dict[str, Any]] = {}
    if not backlog.is_dir():
        return index
    for path in sorted(backlog.glob("ADR-*.md")):
        fm, _body = _split_frontmatter(path.read_text(encoding="utf-8"))
        adr_id = fm.get("adr_id")
        if not adr_id:
            continue
        index[str(adr_id)] = fm
    return index


def _coerce_realises(value: Any) -> list[str]:
    """Normalise the `realises` frontmatter field to a list of strings. The
    sidecar authors it as a YAML list; a bare string is tolerated."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(v).strip() for v in value if str(v).strip()]
    return []


def _coerce_scalar(value: Any) -> str:
    """A frontmatter scalar -> str, with YAML `null`/None -> ""."""
    if value is None:
        return ""
    return str(value).strip()


# --------------------------------------------------------------------------
# Ingest


def ingest_adrs(
    documentation_repo_path: Path,
    lineage_dir: Path,
    workspace_root: Path,
    *,
    dry_run: bool = False,
) -> ADRIngestResult:
    """Walk the published ADR log + join the workspace sidecars; write
    `adr-nodes.jsonl` under `lineage_dir`. Pure mechanical transcription — see
    the module docstring.

    `workspace_root` is the directory containing `lineage/` and `backlog/`; the
    workspace-side join sidecars are resolved relative to it (no absolute path)."""
    adr_root = documentation_repo_path / DOCS_SUBDIR / ADR_LOG_SUBDIR
    if not adr_root.is_dir():
        return ADRIngestResult(
            ok=False, upstream_commit="", adr_count=0,
            error=f"ADR log not found: {adr_root} (is ../{DOC_REPO} cloned?)",
        )

    # SUMMARY group lookup so the live-URL guess matches the docs axis exactly.
    summary_path = documentation_repo_path / DOCS_SUBDIR / "SUMMARY.md"
    summary_map = (
        parse_summary(summary_path.read_text(encoding="utf-8"))
        if summary_path.is_file() else {}
    )

    join_index = _load_join_index(workspace_root)

    # The individual decision pages are `ADR-*.md`; README.md is the index.
    page_paths = sorted(
        p for p in adr_root.glob("ADR-*.md") if p.name != "README.md"
    )

    nodes: list[ADRNode] = []
    unresolved: list[str] = []
    seen_adr_ids: set[str] = set()

    for page_path in page_paths:
        docs_rel = page_path.relative_to(documentation_repo_path / DOCS_SUBDIR).as_posix()
        repo_rel = f"{DOCS_SUBDIR}/{docs_rel}"
        fm, body = _split_frontmatter(page_path.read_text(encoding="utf-8"))
        adr_id = _coerce_scalar(fm.get("adr_id")) or page_path.stem
        seen_adr_ids.add(adr_id)
        anchor = _page_h1_slug(body)
        group = summary_map.get(docs_rel, "")

        join = join_index.get(adr_id)
        if join is None:
            unresolved.append(
                f"{adr_id}: published page {repo_rel} has no {ADR_BACKLOG_SUBDIR}/{adr_id}.md join"
            )
            promoted_from, realises, superseded_by = "", [], ""
        else:
            promoted_from = _coerce_scalar(join.get("promoted_from"))
            realises = _coerce_realises(join.get("realises"))
            superseded_by = _coerce_scalar(join.get("superseded_by"))

        nodes.append(
            ADRNode(
                adr_id=adr_id,
                title=_coerce_scalar(fm.get("title")),
                status=_coerce_scalar(fm.get("status")),
                date=_coerce_scalar(fm.get("date")),
                repo_rel_path=repo_rel,
                anchor=anchor,
                # Page-level node (the H1) → level 1, so no #fragment appended.
                live_url=_live_url_guess(repo_rel, group, anchor, level=1),
                content_hash=section_content_hash(body),
                promoted_from=promoted_from,
                realises=realises,
                superseded_by=superseded_by,
            )
        )

    # A workspace sidecar whose adr_id has no published page is also an
    # unresolved join (the inverse direction) — surface it, don't drop it.
    for adr_id in sorted(set(join_index) - seen_adr_ids):
        unresolved.append(
            f"{adr_id}: {ADR_BACKLOG_SUBDIR}/{adr_id}.md has no published ADR page"
        )

    nodes.sort(key=lambda n: n.adr_id)
    upstream_commit = _safe_short_sha(documentation_repo_path)

    summary_txt = "\n".join([
        f"adr-lineage ingest — repo={DOC_REPO} upstream={upstream_commit}",
        f"published ADRs: {len(page_paths)}  ADR nodes: {len(nodes)}",
        f"unresolved joins: {len(unresolved)}",
    ])

    if not dry_run:
        _write_adr_nodes(lineage_dir / "adr-nodes.jsonl", nodes)

    return ADRIngestResult(
        ok=True, upstream_commit=upstream_commit, adr_count=len(nodes),
        unresolved=unresolved, summary=summary_txt,
    )


def _safe_short_sha(repo_path: Path) -> str:
    try:
        return short_sha(repo_path)
    except Exception:  # noqa: BLE001 — a docs repo without git history is still ingestable
        return "unknown"


def _write_adr_nodes(path: Path, nodes: list[ADRNode]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for node in nodes:
            fh.write(json.dumps(asdict(node), ensure_ascii=False, sort_keys=True))
            fh.write("\n")
    return len(nodes)
