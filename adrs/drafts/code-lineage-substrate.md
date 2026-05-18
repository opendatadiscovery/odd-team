---
id: ADR-DRAFT-code-lineage-substrate
title: "Introduce a code-lineage substrate as the exhaustive enumeration layer for scanners, navigation, and future cross-pillar audits"
status: draft
date: 2026-05-08
revision: 3 (2026-05-18 — file-axis + concept-axis added as universal node kinds; portability moved to APPROACH.md)
scope: workspace-meta (this repo's audit infrastructure) + cross-pillar (documentation, tests, features, code-quality)
related_drafts: ADR-DRAFT-workspace-pillar-architecture
trigger_incident: i18n undocumented-features miss (2026-05-08) — see Examples
research_dir: adrs/drafts/research/code-lineage-substrate/ (STACK / SCHEMA / DOC-LINKAGE / PITFALLS / PROBES / SUMMARY)
research_methodology: gsd-build/get-shit-done parallel-researcher pattern
---

# ADR-DRAFT: Code-Lineage Substrate

## Context

### The trigger

On 2026-05-08, while reviewing scanner coverage, the user asked: "what about i18n?" The platform ships a six-language UI (`en`, `es`, `fr`, `ua`, `hy`, `ch`), bootstraps `react-i18next` from `odd-platform-ui/src/locales/i18n.ts`, and renders a `<SelectLanguage>` widget in `AppToolbar`. **None of this is documented.** The `docs/coverage/undocumented-features` scanner reported 100% coverage on 2026-04-21 against the platform repo at commit `279fe8ee` and never surfaced i18n as a feature at all.

The miss is **not** a single oversight. The scanner enumerates features along three axes:

1. UI routes in `odd-platform-ui/src/routes/*.ts`
2. REST controllers / OpenAPI tags in `odd-platform-api/`
3. Top-level pages in `documentation/docs/SUMMARY.md`

i18n has **none of these surfaces**. It is a cross-cutting client-side capability that lives in `src/locales/` and is wired into the app shell via a single import in `index.tsx`. The scanner's enumeration is structurally blind to that entire class — and the same blind spot hides theme switching, the auth/login flow, the AppToolbar widgets individually, error pages, browser persistence, accessibility behaviors, WebSocket/SSE channels, and anything keyed off `application.yml` prefixes that don't map 1:1 to a controller.

The "100% coverage" number was 100% of the **20 enumerated items**, not 100% of the platform's user-visible features. The manifest's framing made it look like the latter. That mis-framing is the actual bug, and it is structural — every per-scanner heuristic enumeration has the same shape.

### Why this is an architectural decision, not a tactical fix

The cheap fix — add a "UI shell + cross-cutting" enumeration axis to `undocumented-features.md` — closes the i18n class for one scanner. The structural fix is to **stop letting each scanner invent its own enumeration heuristic** and instead give every scanner a single **exhaustive denominator** to query against.

The same blind spot underlies multiple existing retrospectives:

- `LSN-001` (attachment-storage ephemeral default) and `LSN-002` (MinIO region unset) — caught by humans, not scanners. A code-lineage that includes "every SDK builder and every parameter the SDK accepts" would have surfaced these as nodes the `integration-caveats` scanner could iterate over.
- `LSN-006` (lookup-tables content-homing) and `LSN-007` (SUMMARY convenience placements) — same root cause as the i18n miss expressed in the doc tree: no exhaustive map of "what content types exist and where they should live."
- `LSN-009` (backlog-internal duplication) — the duplication-sweep gate explicitly relies on exhaustive enumeration; today that's a manual grep.

A persisted code-lineage artifact is the substrate every scanner, every gate, and the navigation layer can share. It is **the** place where "what exists in this codebase" is a question with a single, verifiable answer.

### What the lineage actually buys (and what it does NOT)

| Buys | Does not buy |
|---|---|
| **Exhaustive denominator** — scanners stop inventing their own enumeration heuristics; coverage % becomes meaningful. | **The metadata layer.** "This is a public-facing surface / has an O(N²) limit at 10K rows / leaks PII to logs" is judgment work. Scanners are exactly that judgment layer. |
| **Cross-cutting reach** — touched-file → graph-walk catches utils that 50 features depend on. | **Runtime behaviors invisible to static analysis** — Spring profile-driven bean wiring, reflection-loaded classes, data-driven control flow, dynamic OpenAPI registration. |
| **Navigation auto-derived** — `navigation/domains/*.md` becomes per-domain rollups of the lineage instead of hand-curated pointers. | **A replacement for pillar-specific Quality Bar gates.** Lineage feeds gates exhaustive inputs; gates still decide pass/fail. |
| **Cross-pillar reuse** — same artifact powers documentation gap scans, missing-test scans, missing-limitation scans, integration-caveat scans, future feature work. | **A diff-friendly artifact you read in PRs.** The raw graph is too large; per-domain rollups are the reviewable surface. |

### Prior art (so we stitch, not reinvent)

| Tool | Purpose | Fit |
|---|---|---|
| `tree-sitter` | Multi-language AST parsing | Strong fit for syntactic node extraction across TS, Python, Java |
| Sourcegraph SCIP | Semantic code index, language-server-quality cross-references | Strong fit for call/import edges; heavier setup |
| GitHub stack-graphs | Cross-file name resolution | Niche fit — used internally by GitHub for precise code nav |
| Joern | Code Property Graphs (security-flavored) | Fit for the integration-caveats class (data flow into SDK builders) but heavyweight |
| Spring `/actuator/mappings` | Runtime route truth from a running platform | Useful as a **validator** of the static graph, not a primary source |
| OpenAPI generator introspection | Tag → controller → method mapping | Already produces machine-readable artifacts we can consume |

The decision below picks a substrate; it does not commit to building parsers from scratch.

## Decision

Adopt a **code-lineage substrate** as a first-class workspace artifact. The substrate is anchored on commit SHAs (not timestamps), updated incrementally by default, and queryable by every scanner, gate, and navigation lookup.

### Persisted artifact

```
lineage/
  README.md              schema + run modes + how to query
  {repo}/
    manifest.yaml        anchor commit, extractor version, axis versions, last-run mode
    nodes.jsonl          one node per line (file/class/function-level, configurable)
    edges.jsonl          one edge per line (typed: imports, calls, wires, mounts, exposes, configures)
    rollups/
      ui-shell.md        per-domain markdown rollup (auto-derived; the diffable surface for PRs)
      controllers.md
      bean-factories.md
      sdk-builders.md
      config-prefixes.md
      ...
```

`nodes.jsonl` and `edges.jsonl` are line-delimited JSON so diffs are tractable on small changes; large rebuilds are expected to produce large diffs and that is fine because rebuilds are explicit (`--full` or extractor-version bump).

`manifest.yaml` shape:

```yaml
repo: odd-platform
last_scan_commit: 279fe8ee
last_scan_date: 2026-04-21
last_scan_mode: full
extractor_version: 0.3.0
axes:
  ui_routes:           { version: 1, last_built: 2026-04-21 }
  controllers:         { version: 1, last_built: 2026-04-21 }
  openapi_tags:        { version: 1, last_built: 2026-04-21 }
  ui_shell:            { version: 1, last_built: 2026-05-08 }   # new — the i18n-class fix
  config_prefixes:     { version: 1, last_built: 2026-05-08 }   # new
  sdk_builders:        { version: 1, last_built: 2026-05-08 }   # new
  ws_sse_channels:     { version: 0, last_built: null }         # planned
  spring_bean_factories: { version: 0, last_built: null }       # planned
node_count: 8421
edge_count: 27093
```

`extractor_version` follows semver. **A bump invalidates incremental and forces a full rebuild on next scan.** This is the safety valve for "we discovered a new blind spot like i18n" — adding an axis is a version bump, full rebuild captures everything once, incremental keeps it fresh thereafter.

### Run modes

| Mode | Diff window | Anchor advances? | Writes artifact? | When |
|---|---|---|---|---|
| `incremental` (default) | `git diff last_scan_commit..HEAD` → touched files + N-hop graph walk | Yes (on success) | Yes | Routine scans |
| `--full` / `revalidate` | Entire repo | Yes | Yes | After extractor bump, after a discovered miss, after long gap, on first run |
| `--dry-run` | Same as the requested mode (`incremental` or `--full`) | **No** | **No** — emit a delta diff to stdout / `findings/`, do not touch `lineage/` | Operator preview before committing a refresh |
| `--ref <branch>` | `git diff last_scan_commit..<branch>` | **No** — main-anchor never moves on a branch run | Writes a side artifact at `lineage/{repo}/branch-{slug}.delta.json`; never overwrites the main artifact | Pre-merge audit on a feature branch |

**Mode interactions:**

- `--full --dry-run` = "show me what a clean rebuild would change without committing it." Useful before an extractor bump.
- `--ref <branch> --dry-run` = no-op equivalent — branch mode already doesn't write the main artifact, but `--dry-run` additionally suppresses the side artifact.
- A failed run (extractor crash, partial graph) does **not** advance the anchor and does **not** delete the prior artifact. Last good lineage is the floor.

### Edge cases (decided)

- **Deletions / renames** — `git diff --name-status -M` distinguishes; updater drops or renames nodes by stable ID (path + symbol kind, not raw path).
- **Cross-cutting reach** — touched file → walk N hops outward through the graph, default `N=1` (direct callers + callees). Tunable via `--reach <N>`. A change to a util that 50 features import propagates because each importer is N=1 away.
- **Extractor versioning** — semver. MAJOR bump = schema change; MINOR = new axis or new edge type; PATCH = bug fix in extractor with no schema impact. MAJOR/MINOR force full rebuild; PATCH does not.
- **Branch-mode safety** — branch artifacts live at `lineage/{repo}/branch-{slug}.delta.json` and are never read by scanners running in incremental/full mode against main. Stale branch artifacts are garbage-collected when the underlying ref is gone.
- **Failed extraction** — extractor errors are logged to `lineage/{repo}/last-error.log` and the prior good artifact is retained. Anchor does not advance.

### Revision 3 (2026-05-18) — universal axes + portability extraction

Two universal node kinds added to the substrate (extractor v0.2.0):

- **`kind: file` (axis: `files`)** — pre-pass walks every source file in scope (default 29 extensions across JVM / JS-TS / Python / Go / Rust / Ruby / PHP / config + shell / UI markup; per-project tuneable) and emits one node per file. Each file node carries `language`, repo-relative `path`, `line_count`, `size_bytes`. Universal post-process emits `declared_in` edges from every non-file node to its parent file node. Fixes the axis-first-taxonomy coverage gap: `coverage = (files-with-sidecar / files-in-scope)` is now a real monotonic ratio. LSN-016 guardrail preserved — file nodes carry syntactic facts only; semantic content arrives via the file-analyser at the per-file sidecar layer.

- **`kind: concept` (axis: `concepts`)** — post-pass reads `lineage/{repo}/concepts.yaml` emitted by the concept-merger reducer and emits one node per catalog entry across the four categories (entities, operations, invariants, audiences) with `embodied_by` edges pointing at the contributing node IDs. Smoke test against ODD's current `concepts.yaml`: 84 concept nodes + 303 `embodied_by` edges. Query shape: "which files embody the Policy concept?" becomes a graph traversal instead of a free-text search through 5197 lines of YAML.

**Extractor ordering** (in `extractors/__init__.py`): `files` first (scaffold for `declared_in`), project-specific axes next in alphabetical order for determinism, `concepts` last (depends on sidecars + concept-merger having run).

**Portability extraction.** The methodology side of this ADR (three-layer architecture, sidecar schema, reducer subagent shapes, probe protocol, case-law shape, Quality Bar rules) moved to top-level `APPROACH.md` — a portable, project-agnostic surface that a new project (Django, Go, anything) can read end-to-end and bootstrap from without copying ODD-specific content. The substrate ADR remains the long-form design rationale; APPROACH.md is the "how to apply this elsewhere" digest. Per the 2026-05-18 retrospective: portability is methodology-level (substrate-vs-enrichment-vs-reducers shape, sidecar fields, agent prompts, probe protocol) and explicitly NOT artefact-level (axes, LSNs, probes, canonical concepts are project-specific). Copy the framework; author the instances.

**Version bump.** Extractor `0.1.0 → 0.2.0` (MINOR — schema change, forces full rebuild on next scan per the rules in `lineage/README.md`).

### Research-backed decisions (revision 2 — 2026-05-08)

The first revision of this ADR ended with eight "open questions for human review." Per the workspace's velocity bias ("don't loop on options the user already approved at the ADR level; pick the best per best practices and ship"), these were converted into firm recommendations via the gsd-build parallel-researcher pattern. Full research lives in `adrs/drafts/research/code-lineage-substrate/`:

- **STACK.md** — extractor toolchain decision + sources
- **SCHEMA.md** — granularity, node types, edge taxonomy, persistence
- **DOC-LINKAGE.md** — code↔docs.opendatadiscovery.org join key + annotation conventions
- **PITFALLS.md** — twelve known failure modes with prevention strategies
- **PROBES.md** — probe-driven validation methodology + seed probe set + MVP acceptance criterion
- **SUMMARY.md** — synthesis with confidence levels

Decisions:

| Area | Decision | Confidence | Rationale (1-line; full in research/) |
|---|---|---|---|
| **Extractor toolchain** | **`tree-sitter`** as the only AST source. Reject SCIP. Reject stack-graphs (archived 2025-09). | HIGH | 2025 industry RFC + GitHub production deployment + simpler-composable shift. SCIP is for compiler-grade IDE features; we do enumeration. |
| **Granularity** | **File + Symbol** (mixed). Symbols include Spring `@Bean`/`@ConfigurationProperties`/`@RestController`, TS app-shell bootstraps + UI-shell widgets, Python collector adapters. **Function-level deferred to Phase 3.** | HIGH | Validated by SCIP's own dual-axis design (`Document` + `Symbol` coexist). |
| **Symbol identifier shape** | Human-readable structured string: `{repo} {lang} {package} {kind}:{descriptor}`. Globally unique within workspace; greppable. | HIGH | SCIP's documented retrospective on LSIF's opaque-ID pain. |
| **Edge taxonomy** | **Seven types**: `imports`, `calls` (intra-file MVP), `mounts`, `exposes`, `wires`, `configures`, `references`. Cross-file `calls` deferred to Phase 3 with optional SCIP layer. | MEDIUM | Each edge type has a documented scanner consumer; no speculative edges. |
| **Persistence format** | **JSONL (nodes, edges) + YAML (manifest) + Markdown (rollups)**. Two-tier diffability: JSONL for tools, rollups for human review. | HIGH | Workspace conventions; alternatives (SQLite, parquet) explicitly considered and rejected. |
| **Doc linkage join key** | Doc-relpath stem under `documentation/docs/` (e.g., `data-discovery/attachments`). Source-side declares via `@docs` Javadoc tag / TS `// @docs:` directive / Python docstring `@docs:` tag. SUMMARY.md is the validator (broken links become findings). | HIGH | Adapted from Backstage TechDocs's `backstage.io/techdocs-ref` pattern, inverted (annotation in source, not docs). |
| **MVP axis set** | **Five axes**: `ui_routes`, `controllers`, `openapi_tags`, `ui_shell` (the i18n-class fix), `config_prefixes`. | HIGH | Closes the i18n class + LSN-006/007 family in MVP. |
| **Phase sequencing** | MVP (5 axes + doc-linkage validation) → Phase 2 (`sdk_builders`, `bean_factories`, `ws_sse_channels` — closes LSN-001/002 silent-SDK-default class) → Phase 3 (function-level call graph + optional SCIP layer for cross-file calls). | HIGH | Each phase ships independently and is independently valuable. |
| **Navigation migration** | Per-domain migration. `navigation/domains/{X}.md` flips to auto-derived `lineage/odd-platform/rollups/{X}.md`; hand-written intent/gotchas move to `navigation/notes/{X}.md`. | MEDIUM | Atomic flip risks too much drift in one PR; per-domain lets each migration be its own reviewable batch. |
| **CI integration** | Lineage rebuilds only on `/scan` invocation. Not on every PR. | MEDIUM | Avoids PR diff floods (PITFALLS P5). |
| **Where it lives** | `lineage/` at workspace root, sibling to `navigation/` and `state/`. | HIGH | Cross-pillar by design; not a per-pillar artifact. |
| **Cheap `ui_shell` patch — ship now or wait?** | **Ship the patch immediately as a parallel commit**, before substrate lands. Closes i18n today; the patch's enumeration logic folds into the lineage extractor's `ui_shell` axis verbatim. | HIGH | Velocity bias; forward-compatible; first concrete proof the axis design works. |

### Documentation linkage — concrete shape

Each lineage node carries a `documents:` field (zero or more doc-relpath strings). Sources are declared in code via lightweight annotations:

| Language | Convention | Example |
|---|---|---|
| Java | Javadoc `@docs` tag on class; optional `@Docs(...)` annotation on method/field | `@docs configuration-and-deployment/odd-platform#attachments` |
| TypeScript | JSDoc `@docs` tag on export; line-comment `// @docs:` on imports/bootstraps | `// @docs: features/data-discovery/search` |
| Python | Docstring `@docs:` tag | `"""@docs: integrations/odd-collector-aws#snowflake"""` |
| YAML config | Comment-line `# @docs:` directive above prefix | `# @docs: configuration-and-deployment/odd-platform#genai` |

The extractor validates every claim against `documentation/docs/SUMMARY.md`; broken paths surface as findings (Gate 7). Bootstrap path: a one-shot seed PR (~50-100 annotations) wires existing documented features before MVP scanners run; new code requires a `@docs` annotation when it introduces a documented feature.

This binding pattern is Backstage TechDocs ([backstage.io/techdocs-ref](https://backstage.io/docs/features/techdocs/creating-and-publishing/)) inverted — Backstage points an entity at its docs folder via `catalog-info.yaml`; we point a code symbol at its doc page via in-source annotation, because our truth lives in code, not in catalog.

### Cost / size estimate

For `odd-platform` (Java + TS): ~3,500 file nodes + ~2,000 symbol nodes + ~15,000 edges → ~5-15 MB JSONL.
For `odd-collectors` (Python × 40+ adapters): ~10,000 nodes + smaller edge density → ~3-8 MB.
**Total lineage footprint under 25 MB** across the workspace. Negligible for git.

### MVP acceptance — probe-driven validation (not coverage %)

**The substrate's MVP is *not* accepted on a self-referential coverage % over its own enumeration.** That is the failure mode that produced the i18n miss in the first place: `state/coverage/docs-coverage-undocumented-features.yaml` reported "100% coverage on commit 279fe8ee" while six i18n features were silently absent from the manifest. The denominator was the heuristic's own surfaced subset, not the codebase. Repeating the same framing for the substrate would inherit the same blind-spot dynamic.

MVP acceptance is **probe-driven**, per `adrs/drafts/research/code-lineage-substrate/PROBES.md`:

1. **The seed probe set passes** — ~12 hand-picked probes spanning UI shell, backend cross-cutting surfaces, collector adapters, and doc-side validation. Each probe is a four-step exercise (name a capability → locate it in code → run the substrate's query → pass/fail). Failures are classified as axis gap / extractor bug / annotation gap and routed via `playbooks/follow-up-on-disk.md`.
2. **The adversarial probe round passes** — the maintainer (not the implementer) picks **3 unannounced probes** from outside the seed list. ≥2 of 3 must pass; the third may be a classified FAIL with a coherent follow-up.
3. **Probes become permanent regression tests** — each scanner using the lineage imports the relevant probes as test cases. A future regression where the substrate stops finding a known capability becomes a failing test, not a silent miss.
4. **Every blind-spot incident from this point forward adds a probe.** When a future LSN documents a feature the substrate failed to surface, a probe is added to the list as part of the LSN's "rule that emerged" — codifying the case-law into a continuously-runnable test.

The probe approach is the primary acceptance gate. Lineage-internal coverage % can be reported as a secondary metric (and is meaningful relative to the axes the substrate knows about), but it is never the acceptance criterion. The `PROBES.md` artefact is co-authored with the maintainer — when the maintainer probes new capabilities ("what about theme switching? auth? error pages?"), each probe is added there before the substrate is rebuilt to cover it.

## Consequences

### What becomes easier

- **Scanners stop inventing enumeration.** `undocumented-features`, `missing-limitations`, `integration-caveats`, `integration-docs`, `missing-keywords`, `feature-behavior` all query the same node set. Adding a scanner = writing a query, not building an enumerator.
- **Coverage % becomes meaningful.** Denominator is the lineage's exhaustive node set, not the heuristic's surfaced subset. Coverage delta over time becomes a real signal.
- **The i18n class of miss closes structurally.** New blind spot discovered → add an axis → extractor version bumps → full rebuild → all scanners see the new nodes on next run. No per-scanner patching.
- **Navigation auto-derives.** Hand-curated pointer drift (a perennial problem) becomes a rebuild artifact. The hand-written parts shrink to "intent and gotchas," which is what humans should be writing.
- **Cross-pillar reuse is real.** When the `tests` pillar activates, it queries the same lineage for "every public function with no test" instead of building a parallel enumerator.
- **Branch-mode pre-merge audit.** A feature branch can be lineage-diffed against main before merge — surfaces "you added 47 nodes; here are the 12 with no documentation, 8 with no test, 3 with caveat-defaulted SDK builders."

### What becomes harder

- **A new build artifact to keep correct.** Extractor bugs, edge cases in the parser, language-version drift (TS 5.x → 6.x). Mitigations: extractor `--dry-run` + last-good retention + version-bump-forces-full-rebuild.
- **First-run cost.** Building the initial lineage for `odd-platform` (Java + TS) and `odd-collectors` (Python × 40+ adapters) is the single largest one-time cost. Mitigation: stage by axis — ship `ui_routes` + `controllers` + `ui_shell` + `config_prefixes` first; layer `sdk_builders` + `bean_factories` + `ws_sse_channels` after.
- **Scanner rewrites.** Every scanner that currently enumerates its own surface needs migration to query lineage. Mitigation: scanners keep working until migrated; the substrate is additive, not breaking.
- **Diff noise on full rebuilds.** A `--full` regeneration produces large `nodes.jsonl` / `edges.jsonl` diffs. Mitigation: rollups are the diffable surface for PR review; raw JSONL is the machine surface and reviewers skip it intentionally.
- **Maintenance contract.** Someone owns the extractor. For an OSS project with one maintainer, this is real. Mitigation: the extractor must itself be small and `tree-sitter`-based; if it grows beyond ~2K LOC of stitching, it has scope-crept.

### Cost shape

- **MVP (axes: ui_routes, controllers, openapi_tags, ui_shell, config_prefixes):** ~2-3 weeks of focused work. Closes the i18n class and the LSN-006/007 class.
- **Phase 2 (axes: sdk_builders, bean_factories, ws_sse_channels):** another ~2 weeks. Closes the LSN-001/002 class.
- **Phase 3 (function-level call graph for consumer-read audits):** ~3-4 weeks. Optional — only needed if `consumer-read` gate becomes a bottleneck.

This is months of work, not days. The sequencing means the i18n class is closed in MVP; the silent-SDK-default class is closed in Phase 2. Each phase ships independently and is independently valuable.

## Known Issues / Exceptions

- **Reflection / runtime-only behavior.** Spring profile-driven bean wiring, runtime classloading, dynamic OpenAPI registration are invisible to static lineage. Mitigation: `/actuator/mappings` from a running platform is a complementary axis (live validation of the static graph).
- **Data-driven control flow.** A YAML config that selects between three storage backends at runtime — lineage sees all three connected, not which one a given deployment activates. Scanners that depend on this distinction (e.g., "is `s3` actually wired in this deployment?") need a runtime probe, not lineage.
- **String-literal coupling.** Config keys read via `@Value("${some.key}")` are string-typed; lineage's `configures` edge depends on the extractor parsing those literals reliably. Typed config (`@ConfigurationProperties`) is preferred and cleaner.
- **Cross-repo edges.** A controller in `odd-platform` consumed by an adapter in `odd-collectors` is a cross-repo edge. MVP keeps repos separate (`lineage/odd-platform/`, `lineage/odd-collectors/`); cross-repo edge layer is a Phase 4 item.
- **Document repo is not in scope.** `documentation/docs/**/*.md` is content, not code. Document-side enumeration (SUMMARY tree, headings, admonitions) belongs in a separate doc-lineage pass that joins to code-lineage at the canonical-home boundary. Out of scope for this ADR.

## Examples

### Canonical case — i18n (2026-05-08)

`undocumented-features` scanner reported 100% on commit `279fe8ee`. i18n was not in the manifest. The lineage substrate would have:

1. Recorded `odd-platform-ui/src/locales/i18n.ts` as a node with kind `ui-shell-bootstrap`.
2. Recorded `odd-platform-ui/src/components/shared/elements/AppToolbar/SelectLanguage/SelectLanguage.tsx` as a node with kind `ui-shell-widget`, mounted by `AppToolbar.tsx`.
3. Recorded each translation file (`en.json`, `es.json`, `fr.json`, `ua.json`, `hy.json`, `ch.json`) as a node with kind `i18n-resource`.
4. The `ui_shell` axis would include any node not reachable from a `ui_routes` axis node — `i18n.ts` is imported by `index.tsx` directly, not via a route.
5. The `undocumented-features` scanner would query "every `ui-shell-*` node" and find six undocumented features instead of zero.

### Counter-case — LSN-001 (attachment ephemeral default)

A working SDK builder (the attachment storage client) was constructed without a persistence-mode parameter. Lineage with the `sdk_builders` axis would have surfaced the builder as a node, listed every parameter the SDK accepts, classified the unset parameter as `caveat-defaulted`, and fed it to the `integration-caveats` scanner — which is exactly Gate 5's protocol (`playbooks/unset-parameter-audit.md`) executed at scale instead of one integration at a time.

### Precursor pattern in current workspace

The existing scanner manifests already record `*_repo_commit_at_enumeration`. That field is the seed of this whole proposal — anchoring an audit artifact on a commit SHA so subsequent runs can incremental-update against `git diff`. The lineage substrate generalises that pattern from per-scanner manifests to a single workspace-wide artifact. The pattern is not new; what is new is unifying it.

## References

- **Trigger conversation:** 2026-05-08 — i18n undocumented-features miss + the user's framing that incremental-via-git-diff is the obvious answer
- **Retrospectives that this substrate addresses:**
  - `LSN-001` — attachment ephemeral default (silent SDK default; would be caught by `sdk_builders` axis)
  - `LSN-002` — MinIO region unset (silent SDK default; same axis)
  - `LSN-006` — lookup-tables content homing (no exhaustive content-type map; analogous problem in doc tree)
  - `LSN-007` — SUMMARY convenience placements (same root cause expressed in IA)
  - `LSN-009` — backlog-internal duplication (exhaustive enumeration is the duplication-sweep precondition)
- **Related drafts:**
  - `ADR-DRAFT-workspace-pillar-architecture` — pillar layering. Lineage is cross-pillar by design and lives at workspace root, not inside a pillar.
- **Existing workspace artifacts that converge into this substrate:**
  - `state/coverage/*.yaml` — per-scanner manifests with `*_repo_commit_at_enumeration` (the precursor pattern)
  - `navigation/features.yaml` + `navigation/domains/*.md` — hand-curated pointer layer that becomes lineage-derived
  - `playbooks/consumer-read.md`, `playbooks/unset-parameter-audit.md`, `playbooks/duplication-sweep.md` — gates that today rely on manual enumeration; lineage feeds them exhaustive inputs
- **Prior art (substrates we'd stitch, not rebuild):**
  - `tree-sitter` — multi-language AST
  - Sourcegraph SCIP — semantic code index format
  - GitHub stack-graphs — cross-file name resolution
  - Joern — Code Property Graphs (security-flavored)
  - Spring `/actuator/mappings` — runtime route validation
  - OpenAPI generator introspection — controller ↔ tag truth

## Decision pending — single yes/no

The previous "eight open questions for human review" are resolved (see "Research-backed decisions" inside the Decision section above). The only decision left to the maintainer is the binary call on the substrate itself:

- **Adopt** — schedule MVP implementation per the phase sequencing above. Approve the parallel-track plan: ship the cheap `ui_shell` patch now (closes i18n in one PR); start MVP extractor scaffolding in a separate branch.
- **Defer** — the i18n class still gets closed by the cheap `ui_shell` patch alone; substrate work waits. Revisit when the next blind-spot incident occurs (which the phase-2 `sdk_builders` axis would have caught — i.e., when a future LSN-001/002-class incident lands).
- **Reject** — accept that scanner-level enumeration will continue to be heuristic and per-scanner. Document this choice and the operational consequence (each new blind spot needs a per-scanner patch).

If adopting, the implementation work itself does not require further ADR review — the research artifacts in `adrs/drafts/research/code-lineage-substrate/` carry the technical decisions. The next human-decision point is **after MVP first-axis ships** (a working `ui_shell` axis with one scanner querying it), to validate the substrate's design against actual use before Phase 2.
