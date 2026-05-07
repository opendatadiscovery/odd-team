---
research: code-lineage-substrate
artifact: SCHEMA
date: 2026-05-08
mode: ecosystem
overall_confidence: HIGH
---

# SCHEMA — Granularity, node types, edge taxonomy, persistence

## Recommendations (opinionated)

| Decision | Choice | Confidence |
|---|---|---|
| Primary granularity | **File + Symbol** (mixed) | HIGH |
| Function-level call graph | **Phase 3 only** — defer | HIGH |
| Symbol identifier shape | **SCIP-inspired human-readable string** (not opaque IDs) | HIGH |
| Edge taxonomy | **Seven types** (`imports`, `calls`, `mounts`, `exposes`, `wires`, `configures`, `references`) | HIGH |
| Persistence | **JSONL (nodes, edges) + YAML (manifest) + Markdown (rollups)** | HIGH |

## Granularity — why mixed file+symbol

Three options were considered:

| Option | Graph size | Addressability | Verdict |
|---|---|---|---|
| File-only | smallest | Cannot point at a specific `@Bean` factory inside `MinioConfig.java` | Insufficient — Gate 5 (unset-parameter audit) addresses bean factories by name |
| Symbol-only | medium | Loses file-level metadata (path, lang, byte size, last-touched commit) | Loses incrementality grain |
| **Mixed file+symbol** | medium | Both addressable | **Recommended** |

Mixed shape: every file is a node; selected symbols inside files are also nodes; both are first-class. SCIP's schema prefigures this — its `Document` (file) and `Symbol` (cross-file) coexist by design ([scip.proto](https://github.com/sourcegraph/scip/blob/main/scip.proto)).

What counts as a symbol-level node (MVP):

- **Java**: `@Configuration` classes, `@Bean` methods, `@ConfigurationProperties` classes, `@RestController` classes + their `@RequestMapping` methods, `@MessageMapping` handlers.
- **TypeScript**: default exports of route components, `<AppToolbar>` widget files, `i18n.ts` / `theme.ts` / `auth.ts` / similar app-shell bootstrap files (any TS file imported directly by `index.tsx` is auto-promoted to symbol-node).
- **Python**: module-level callables that match collector-adapter registration patterns (e.g., `class FooAdapter(...)`), `pyproject.toml` entry points.

Function-level granularity is **deferred to Phase 3** — only needed for the `consumer-read` call-graph audit at scale, which today is tractable manually.

## Symbol identifier shape

Borrow SCIP's design: **human-readable structured string, not opaque numeric IDs**. The lesson from SCIP's announcement was explicit — LSIF's opaque IDs were the primary debug pain point, fixed by structured strings.

Format:

```
{repo} {lang} {package} {kind}:{descriptor}
```

Examples:

```
odd-platform java org.opendatadiscovery.oddplatform.config bean:minioClient
odd-platform java org.opendatadiscovery.oddplatform.config props:GenAIProperties
odd-platform ts odd-platform-ui/src/locales bootstrap:i18n
odd-platform ts odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage component:SelectLanguage
odd-collectors python odd_collector.adapters.snowflake adapter:SnowflakeAdapter
```

Properties:

- **Globally unique within the workspace** (`{repo}` prefix prevents collisions across repos).
- **Stable across renames within a class** — moving a method between files keeps the symbol if its package + name are unchanged.
- **Greppable** — a maintainer can `grep "bean:minioClient"` and find every reference in the lineage.
- **Human-debuggable** — when a finding cites a node, you can read it.

## Node schema

```jsonc
// nodes.jsonl — one node per line
{
  "id": "odd-platform java org.opendatadiscovery.oddplatform.config bean:minioClient",
  "kind": "spring-bean-factory",       // see kinds taxonomy below
  "axis": "sdk_builders",              // which manifest axis surfaced it
  "lang": "java",
  "file": "odd-platform-api/src/main/java/.../config/MinioConfig.java",
  "range": { "start_line": 42, "end_line": 67 },
  "name": "minioClient",
  "package": "org.opendatadiscovery.oddplatform.config",
  "axes_present_in": ["sdk_builders", "bean_factories"],
  "extracted_at_commit": "279fe8ee",
  "extractor_version": "0.3.0",
  "annotations": {                     // axis-specific metadata
    "sdk_class": "MinioAsyncClient",
    "sdk_builder_params_set": ["endpoint", "credentials"],
    "sdk_builder_params_unset": ["region", "httpClient", "timeout"]
  }
}
```

Kinds taxonomy (MVP, extensible):

| Kind | Used by axis | Example |
|---|---|---|
| `file` | all | every file in the repo |
| `route` | `ui_routes` | `routes/alertsRoutes.ts` |
| `controller` | `controllers` | `AlertController` |
| `controller-method` | `controllers` | `AlertController.findAll` |
| `openapi-tag` | `openapi_tags` | `tags: [Alerts]` |
| `ui-shell-bootstrap` | `ui_shell` | `locales/i18n.ts` |
| `ui-shell-widget` | `ui_shell` | `SelectLanguage.tsx` |
| `spring-bean-factory` | `bean_factories`, `sdk_builders` | `@Bean minioClient()` |
| `config-properties-class` | `config_prefixes` | `@ConfigurationProperties("genai") GenAIProperties` |
| `config-key-consumer` | `config_prefixes` | `@Value("${attachments.bucket}") String bucket` |
| `ws-channel` | `ws_sse_channels` | `@MessageMapping("/notifications")` |
| `i18n-resource` | `ui_shell` | `locales/translations/en.json` |
| `collector-adapter` | (collectors-specific) | `class SnowflakeAdapter` |

## Edge schema

```jsonc
// edges.jsonl — one edge per line
{
  "from": "odd-platform ts odd-platform-ui/src bootstrap:index",
  "to":   "odd-platform ts odd-platform-ui/src/locales bootstrap:i18n",
  "type": "imports",
  "extracted_at_commit": "279fe8ee"
}
```

Edge types (MVP, seven):

| Type | Meaning | Used by gate/scanner |
|---|---|---|
| `imports` | Static `import` / `require` / `from x import y` | duplication-sweep, ui-shell reachability |
| `calls` | One symbol invokes another (intra-file MVP, cross-file Phase 3) | consumer-read |
| `mounts` | UI shell wiring (a layout file mounts a widget) | undocumented-features (UI shell axis) |
| `exposes` | Code symbol exposes a runtime surface (HTTP route, WS channel, OpenAPI op) | undocumented-features, integration-docs |
| `wires` | Spring DI: bean factory → bean class | integration-caveats, consumer-read |
| `configures` | YAML config prefix → consumer class (`@ConfigurationProperties` / `@Value` reverse map) | config-options accuracy, missing-limitations |
| `references` | Soft reference (string literal, comment) | low-confidence cross-link |

This taxonomy intentionally **does not** include security-flavored edges (taint, dataflow). Those are Joern's territory; we're not in that game.

## Persistence — why JSONL + YAML + Markdown

Per the user's working memory: "extend vocabulary, don't narrow." Three formats with explicit roles:

| File | Format | Why this format | Audience |
|---|---|---|---|
| `manifest.yaml` | YAML | Already the workspace convention (`state/coverage/*.yaml`); 5-20 lines, human-edited rarely | Maintainer reading state |
| `nodes.jsonl` | JSONL | Line-diffable; appendable; one record per line means small graph deltas produce small diffs | Tools (scanners) + occasional human grep |
| `edges.jsonl` | JSONL | Same as nodes | Tools |
| `rollups/*.md` | Markdown | The diffable PR-review surface; aggregates "every UI-shell node," "every bean factory," etc. | Human reviewer |

Rollups are derived; never hand-edited. Sample `rollups/ui-shell.md` shape:

```markdown
# UI Shell rollup — odd-platform-ui

Generated: 2026-05-08 from commit 279fe8ee, extractor v0.3.0
Total ui-shell nodes: 14

## ui-shell-bootstrap (3)
- `locales/i18n.ts` — wires react-i18next; loads 6 languages
- `theme/ThemeProvider.tsx` — MUI theme bootstrap
- `auth/AuthProvider.tsx` — auth context bootstrap

## ui-shell-widget (11)
- `AppToolbar/SelectLanguage/SelectLanguage.tsx` — language picker (uses i18n.ts)
- `AppToolbar/Notifications/NotificationsBell.tsx` — notification bell
- ...
```

Rollups also embed the **doc-linkage** field (next research file): each node lists its declared `documents:` doc-relpath if present, or `[NO DOC]` if absent. This makes `undocumented-features` a one-grep query against rollups.

## Why not SQLite or parquet?

- **SQLite** — queryable but opaque diffs. We need PR-readability of changes, not query speed (graph is small enough for in-memory loading).
- **Parquet** — compact and opaque. Same problem.

JSONL trade-off: larger on disk than parquet, but every diff in version control is human-readable. For a workspace whose value proposition is auditability, that's the right call.

## Cost / size estimate

For `odd-platform` at current size:

- Files: ~3,500 (estimate) → ~3,500 file-kind nodes
- Symbols (MVP kinds): ~1,500-2,500
- Edges (MVP types): ~10,000-20,000

JSONL size: ~5-15 MB total. Negligible for git.

`odd-collectors`: smaller per-adapter, ~40 adapters → ~10,000 nodes total. ~3-8 MB.

Total lineage footprint across the workspace: **under 25 MB**. Acceptable.

## Sources

- [scip.proto schema](https://github.com/sourcegraph/scip/blob/main/scip.proto) — Symbol/Document/Occurrence/SymbolInformation
- [Sourcegraph SCIP announcement](https://sourcegraph.com/blog/announcing-scip) — rationale for human-readable IDs over opaque
- [Joern CPG node taxonomy](https://docs.joern.io/code-property-graph/) — for what we deliberately omitted
