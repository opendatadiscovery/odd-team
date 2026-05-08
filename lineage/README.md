# Lineage substrate

The cross-pillar code-lineage substrate. Anchored on commit SHAs, updated incrementally, queryable by every scanner, gate, and navigation lookup.

Design lives in `adrs/drafts/code-lineage-substrate.md` (revision 2 — research-backed). Probe-driven validation in `lineage/PROBES.md`. This README covers schema, run modes, and how to query.

## Status

**MVP scaffold in progress** (DOC-164). First slice = `ui_shell` axis end-to-end. Five MVP axes total: `ui_routes`, `controllers`, `openapi_tags`, `ui_shell`, `config_prefixes`.

Phase sequencing per ADR: MVP (5 axes + doc-linkage) → Phase 2 (`sdk_builders`, `bean_factories`, `ws_sse_channels`) → Phase 3 (function-level call graph + optional SCIP layer).

## Schema

```
lineage/
  README.md              this file
  PROBES.md              probe-driven validation set (canonical copy)
  _extractor/            Python driver (tree-sitter based)
    pyproject.toml
    src/lineage_extractor/
      cli.py             entry point
      manifest.py        YAML manifest read/write
      nodes.py           JSONL nodes/edges I/O
      repo.py            git anchor + diff helpers
      extractors/        per-axis extraction logic
      queries/           tree-sitter S-expression queries (.scm)
      rollups/           per-axis rollup writers
  {repo}/                one directory per scanned repo
    manifest.yaml        anchor commit, extractor version, axis versions, last-run mode
    nodes.jsonl          one node per line
    edges.jsonl          one edge per line
    rollups/             per-domain Markdown rollups (the diffable surface for PRs)
      ui-shell.md
      controllers.md
      ...
```

### Node shape (JSONL)

```json
{
  "id": "odd-platform ts locales kind:i18n-bootstrap descriptor:i18n.ts",
  "repo": "odd-platform",
  "lang": "ts",
  "package": "locales",
  "kind": "ui-shell-bootstrap",
  "descriptor": "i18n.ts",
  "path": "odd-platform-ui/src/locales/i18n.ts",
  "axis": "ui_shell",
  "documents": null,
  "metadata": {
    "imported_by": ["odd-platform-ui/src/index.tsx:24"],
    "locales": ["en", "es", "ch", "fr", "ua", "hy"]
  }
}
```

### Edge shape (JSONL)

```json
{
  "from": "{from-node-id}",
  "to": "{to-node-id}",
  "type": "imports",
  "metadata": {"line": 24}
}
```

Seven MVP edge types: `imports`, `calls` (intra-file), `mounts`, `exposes`, `wires`, `configures`, `references`. Cross-file `calls` deferred to Phase 3.

### Manifest shape (YAML)

```yaml
repo: odd-platform
last_scan_commit: ede5d277
last_scan_date: 2026-05-08
last_scan_mode: full
extractor_version: 0.1.0
axes:
  ui_shell:        { version: 1, last_built: 2026-05-08 }
  controllers:     { version: 0, last_built: null }
  openapi_tags:    { version: 0, last_built: null }
  ui_routes:       { version: 0, last_built: null }
  config_prefixes: { version: 0, last_built: null }
node_count: 0
edge_count: 0
```

`extractor_version` is semver. MAJOR or MINOR bump invalidates incremental and forces a full rebuild on next scan; PATCH does not.

## Run modes

| Mode | Diff window | Anchor advances? | Writes artifact? |
|---|---|---|---|
| `incremental` (default) | `git diff last_scan_commit..HEAD` → touched files + N-hop graph walk | Yes (on success) | Yes |
| `--full` | Entire repo | Yes | Yes |
| `--dry-run` | Same as requested mode | **No** | **No** — emit delta to stdout |
| `--ref <branch>` | `git diff last_scan_commit..<branch>` | **No** — main-anchor never moves on a branch run | Writes side artifact at `lineage/{repo}/branch-{slug}.delta.json` |

A failed run does **not** advance the anchor and does **not** delete the prior artifact. Last good lineage is the floor.

## Install + run

```bash
cd lineage/_extractor
uv sync                                          # install deps + create .venv
uv run lineage-extractor --help                  # CLI surface
uv run lineage-extractor scan odd-platform       # incremental scan
uv run lineage-extractor scan odd-platform --full
uv run lineage-extractor scan odd-platform --dry-run
uv run lineage-extractor scan odd-platform --ref feature/foo
uv run lineage-extractor probe                   # run probe validation
```

Repo paths are resolved relative to the workspace root (sibling directories: `../odd-platform`, `../odd-collectors`, etc.).

## Querying

The substrate's primary use case is "give me every node where condition X". Today this is grep + jq against `nodes.jsonl`:

```bash
# Every undocumented ui_shell node
jq -c 'select(.axis == "ui_shell" and .documents == null)' lineage/odd-platform/nodes.jsonl

# Every config-prefix consumer for a given prefix
jq -c 'select(.kind == "config-key-consumer" and .metadata.prefix == "auth.s2s")' lineage/odd-platform/nodes.jsonl
```

A SQLite read-mirror is on the roadmap (Phase 2/3) if jq stops being ergonomic for cross-axis joins. Today, two-tier diffability is the priority: JSONL for tools, rollups for human PR review.

## Doc linkage (`@docs`)

Each lineage node carries a `documents:` field (zero or more doc-relpath strings under `documentation/docs/`). Sources declare via lightweight annotations:

| Language | Convention | Example |
|---|---|---|
| Java | Javadoc `@docs` tag on class | `@docs configuration-and-deployment/odd-platform#attachments` |
| TypeScript | JSDoc `@docs` tag; line-comment `// @docs:` | `// @docs: features/data-discovery/search` |
| Python | Docstring `@docs:` tag | `"""@docs: integrations/odd-collector-aws#snowflake"""` |
| YAML config | Comment-line `# @docs:` directive above prefix | `# @docs: configuration-and-deployment/odd-platform#genai` |

The extractor validates every claim against `documentation/docs/SUMMARY.md`; broken paths surface as findings (Gate 7).

## Acceptance is probe-driven, not coverage-%-driven

See `lineage/PROBES.md`. The substrate's MVP is accepted only when (a) the seed probe set passes, (b) an adversarial round of 3 unannounced probes from the maintainer has ≥2 PASS, (c) probes become permanent regression tests.

`coverage_pct` over the lineage's own enumeration is a **secondary** metric — meaningful relative to the axes the substrate knows about, never the acceptance criterion.

## See also

- `adrs/drafts/code-lineage-substrate.md` — the design (revision 2, research-backed)
- `adrs/drafts/research/code-lineage-substrate/` — the research artefacts (STACK / SCHEMA / DOC-LINKAGE / PITFALLS / PROBES / SUMMARY)
- `retrospectives/LSN-013-research-punted-on-substrate-draft.md` — the case-law for this work
- `backlog/docs/DOC-164.md` — MVP-scaffold tracking item