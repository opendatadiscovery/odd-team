---
research: code-lineage-substrate
artifact: SUMMARY
date: 2026-05-08
mode: ecosystem (synthesis of STACK / SCHEMA / DOC-LINKAGE / PITFALLS / PROBES)
overall_confidence: HIGH
---

# SUMMARY — Synthesis & firm recommendations

Synthesizes the five sibling research artifacts (`STACK.md`, `SCHEMA.md`, `DOC-LINKAGE.md`, `PITFALLS.md`, `PROBES.md`) into firm recommendations against the eight open questions in the ADR draft. `PROBES.md` was added 2026-05-08 in response to user feedback that i18n was *one of many probes* the maintainer would use to stress-test coverage; the substrate's MVP acceptance must be probe-driven, not coverage-%-driven.

Confidence convention follows gsd-build's: HIGH = backed by 2025 production-deployed precedent; MEDIUM = best-practice inference with limited specific-precedent; LOW = our context-specific judgment, deserves revisit after MVP.

## Key findings (3-5 bullets)

1. **Tree-sitter, not SCIP.** The 2025 industry shift away from SCIP/stack-graphs for retrieval and AI-context use cases is decisive ([RFC 001](https://github.com/orgs/sheeptechnologies/discussions/4), GitHub stack-graphs archived 2025-09). Our use case is enumeration, not "Go to definition" — tree-sitter's declarative queries cover it with ~10× less complexity. SCIP stays available as a Phase 3 complementary axis if Phase 2 reveals a real need.

2. **Mixed file+symbol granularity is the right shape.** SCIP's own schema validates this (`Document` + `Symbol` coexist). File-only loses bean-factory addressability (Gate 5 requires it); symbol-only loses incremental grain. Mixed costs little, gains both.

3. **Doc linkage is two existing patterns combined.** Backstage TechDocs's `backstage.io/techdocs-ref` annotation pattern, **inverted** (annotation lives in source, not doc) + the workspace's existing `Sources:` footer discipline = a bidirectional, validated, low-ceremony binding. SUMMARY.md is the validator.

4. **MVP acceptance is probe-driven, not coverage-%-driven.** The i18n miss showed why a self-referential coverage % (denominator = the heuristic's own enumeration) inherits the heuristic's blind spots. The substrate's MVP is accepted only when (a) the seed probe set in `PROBES.md` passes, (b) an adversarial round of 3 unannounced probes from the maintainer has ≥2 PASS, (c) probes become permanent regression tests. Every future blind-spot incident adds a probe.

5. **The substrate makes the i18n class structurally impossible to hide.** `undocumented-features` becomes a query: `WHERE documents IS NULL AND kind IN (route, controller, ui-shell-bootstrap, ui-shell-widget, spring-bean-factory, ws-channel, collector-adapter)`. Adding a kind = full rebuild = every scanner sees the new nodes. No per-scanner enumeration patches.

6. **MVP is achievable inside the workspace's velocity envelope.** Single Python driver, ~2K LOC, four tree-sitter grammars, JSONL+YAML+Markdown outputs, no graph database, no IDE-grade indexing tooling. ~2-3 weeks for MVP per the ADR's cost shape.

## Confidence assessment

| Area | Confidence | Reasoning |
|---|---|---|
| Extractor toolchain (tree-sitter) | HIGH | GitHub production deployment + 2025 industry RFC + concrete prior-art repos (codesight, srctx) |
| Granularity (file + symbol) | HIGH | Validated by SCIP's own dual-axis design; matches scanner addressability needs |
| Symbol identifier shape | HIGH | SCIP's documented retrospective on LSIF's opaque-ID pain |
| Edge taxonomy (seven types) | MEDIUM | Best-practice inference; the seven cover known scanners but a new scanner could need an eighth — extractor versioning handles this |
| Persistence (JSONL+YAML+MD) | HIGH | Workspace conventions + diffability requirement; alternatives (SQLite, parquet) explicitly considered and rejected with reasons |
| Doc linkage annotation pattern | HIGH | Adapted from Backstage's production-tested pattern, narrowed for our inverse direction |
| Bootstrap path (seed-then-require) | MEDIUM | Specific to ODD's current annotation-free state; no direct precedent for "seed N=50-100 annotations in one sweep PR" — pragmatic call |
| MVP cost (~2-3 weeks) | MEDIUM | Estimate from extractor LOC budget + axis count; first axis will reveal the actual shape |

## Recommendations against the ADR's eight open questions

The ADR draft `adrs/drafts/code-lineage-substrate.md` ends with "Open questions for human review." Each is now answered:

| # | Question | Recommendation | Confidence | Source |
|---|---|---|---|---|
| 1 | Granularity — file / class / function? | **File + Symbol**; symbols include Spring `@Bean` / `@ConfigurationProperties` / `@RestController`, TS app-shell bootstraps + UI-shell widgets, Python collector adapters. **Function-level deferred to Phase 3.** | HIGH | SCHEMA.md "Granularity" |
| 2 | Extractor toolchain — tree-sitter / SCIP / roll-our-own? | **tree-sitter** (single dependency, four grammars: TS, Java, Python, YAML). Reject SCIP. Reject stack-graphs (archived 2025-09). | HIGH | STACK.md "Why tree-sitter" |
| 3 | Edge taxonomy MVP — seven proposed types? | **Confirm seven**: `imports`, `calls` (intra-file MVP), `mounts`, `exposes`, `wires`, `configures`, `references`. Cross-file `calls` deferred to Phase 3 with optional SCIP layer. | MEDIUM | SCHEMA.md "Edge schema" |
| 4 | Storage format — JSONL+YAML+MD vs SQLite vs parquet? | **JSONL (nodes, edges) + YAML (manifest) + Markdown (rollups)**. Two-tier diffability: JSONL for tools, rollups for human review. | HIGH | SCHEMA.md "Persistence" |
| 5 | Navigation migration — atomic flip or per-domain? | **Per-domain migration** in MVP's third milestone. Each domain rolls over from `navigation/domains/{X}.md` (hand-curated) to `lineage/odd-platform/rollups/{X}.md` (auto-derived) + `navigation/notes/{X}.md` (human intent/gotchas only). | MEDIUM | SCHEMA.md "Persistence", PITFALLS.md "P10" |
| 6 | MVP axis set — five proposed? | **Confirm five**: `ui_routes`, `controllers`, `openapi_tags`, `ui_shell` (the i18n-class fix), `config_prefixes`. | HIGH | ADR + STACK.md |
| 7 | Phase sequencing — MVP → Phase 2 → Phase 3? | **Confirm sequence**: MVP (the five axes + doc-linkage validation) → Phase 2 (`sdk_builders`, `bean_factories`, `ws_sse_channels`) → Phase 3 (function-level call graph + optional SCIP layer). | HIGH | ADR cost shape, validated by PITFALLS.md "P6" |
| 8 | Cheap `ui_shell` patch ship now or wait? | **Ship the cheap patch immediately** as a one-hour follow-up; **do not wait** for the substrate. Closes i18n now. The patch's enumeration logic will be folded into the lineage extractor's `ui_shell` axis verbatim. The patch is forward-compatible and is the first concrete proof that the axis design works. | HIGH | Velocity bias; CLAUDE.md "Velocity is the partner of Pride" |

## Roadmap implications

The ADR's three-phase shape stands. Specific scope-per-phase:

### MVP (~2-3 weeks)
- Python driver in `lineage/_extractor/` (~1.5K LOC target)
- tree-sitter grammars: TS, Java, Python, YAML
- Five axes: `ui_routes`, `controllers`, `openapi_tags`, `ui_shell`, `config_prefixes`
- Doc-linkage: `@docs` annotation parser + SUMMARY.md validator
- Run modes: `incremental` (default), `--full`, `--dry-run`, `--ref <branch>`
- Persistence: `lineage/{repo}/{manifest.yaml, nodes.jsonl, edges.jsonl, rollups/*.md}`
- Migration: 3-5 `navigation/domains/*.md` files flipped to auto-derived rollups (the rest deferred)
- Bootstrap PR: seed 50-100 `@docs` annotations across already-documented features

**Closes**: i18n class (LSN-006/007 family of misses), navigation drift on the migrated domains.

### Phase 2 (~2 weeks)
- Three new axes: `sdk_builders`, `bean_factories`, `ws_sse_channels`
- Spring-aware tree-sitter pass (the ~300 line query file)
- WebSocket / SSE channel detection
- Optional: complementary runtime probe via `/actuator/mappings`

**Closes**: LSN-001 / LSN-002 silent-SDK-default class. Lights up `integration-caveats` scanner at scale.

### Phase 3 (~3-4 weeks, optional)
- Function-level call-graph
- SCIP layer for cross-file resolution (if MVP+Phase2 reveal it's needed; not before)
- Cross-repo edges (`odd-platform` → `odd-collectors`)
- Phase 4 (separate ADR): doc-lineage pass over `documentation/docs/**/*.md`

**Closes**: `consumer-read` audits at scale; cross-repo refactor safety.

## Open questions deferred to phase-specific research

These are the gsd-build-style "questions that come back at planning time, not now":

1. **CI integration shape** — does the lineage rebuild on every `/scan` invocation, or run nightly with manual refresh? MVP recommendation: rebuild only when `/scan` runs (avoid PR diff floods); revisit if we add an autonomous loop.
2. **Annotation drift detection over time** — once `@docs` annotations exist, how do we periodically validate they still match the doc page's actual content (not just that the page exists)? Phase 4 doc-lineage work.
3. **Multi-tenant rollup format** — when both `odd-platform` and `odd-collectors` rollups join in the same scanner finding, what's the rendered shape? Defer to first scanner that needs it.
4. **Coverage % UX** — how do we display "100% of enumerated nodes documented, where enumeration axes are X/Y/Z" without re-creating the misleading-100% problem? UX call after first MVP scanner using lineage runs.

## Critical operating notes (for any maintainer reading later)

- **DO NOT punt these decisions back to the user as "open questions for review."** That was the failure mode that triggered this research. The maintainer's job is to make these calls per best practices and ship; conflicts surface in the ADR's case-law section as they arise.
- **DO update the ADR's "Open questions for human review" section** to reflect the recommendations above. The ADR is now an opinionated, ship-ready proposal with one decision pending: the maintainer's overall yes/no/defer on the substrate itself.
- **DO ship the cheap `ui_shell` patch as a parallel commit BEFORE the substrate lands.** It closes i18n today and proves the axis design.

## Sources (synthesized; full citations in sibling files)

- [SCIP](https://github.com/sourcegraph/scip), [SCIP announcement](https://sourcegraph.com/blog/announcing-scip), [scip.proto](https://github.com/sourcegraph/scip/blob/main/scip.proto)
- [tree-sitter](https://tree-sitter.github.io/), [Static Analysis at GitHub (ACM)](https://dl.acm.org/doi/fullHtml/10.1145/3487019.3487022)
- [RFC 001 — Remove SCIP, adopt tree-sitter](https://github.com/orgs/sheeptechnologies/discussions/4)
- [Backstage TechDocs](https://backstage.io/docs/features/techdocs/creating-and-publishing/)
- [gsd-build/get-shit-done research methodology](https://github.com/gsd-build/get-shit-done) — the parallel-researcher + synthesizer pattern this artifact follows
- [Joern CPG](https://docs.joern.io/code-property-graph/) — for what we deliberately omitted
- Local: `documentation/docs/SUMMARY.md`, retrospectives `LSN-001/002/006/007/009`, `CLAUDE.md` Gate 9
