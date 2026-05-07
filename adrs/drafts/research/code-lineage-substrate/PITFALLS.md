---
research: code-lineage-substrate
artifact: PITFALLS
date: 2026-05-08
mode: ecosystem
overall_confidence: HIGH
---

# PITFALLS — Failure modes to avoid

Patterns that have killed comparable projects, with prevention strategies for our context.

## Critical (would scuttle the substrate)

### P1 — Building a precision system for an enumeration use case

**Pattern**: Adopt SCIP (or similar compiler-grade precise code intelligence) and discover six months in that you've spent the budget on cross-file resolution accuracy your scanners don't actually use.

**Where seen**: GitHub stack-graphs (archived September 2025). Multiple Sourcegraph SCIP-adopter forks abandoning SCIP for tree-sitter-only RFCs in 2025 — explicitly because retrieval/AI use cases don't need compiler-accuracy.

**Prevention**: STACK.md commits to tree-sitter as the floor. SCIP is reserved for Phase 3 where it's a complementary axis, not a foundation. If MVP feels like it needs SCIP, that's a signal the scope has crept — check whether the failing query can be answered with declarative tree-sitter queries first.

### P2 — Coverage % framed against the substrate's own enumeration

**Pattern**: Our scanners' "100% coverage" already lied about i18n. Same hazard for the lineage: if we report "100% of lineage nodes documented," that's only meaningful if the lineage's own enumeration is exhaustive.

**Where seen**: Our own `state/coverage/docs-coverage-undocumented-features.yaml` reporting 100% on commit `279fe8ee` while missing six i18n features.

**Prevention**: Every coverage % must cite its denominator's enumeration axes explicitly. Rollups display `axes: [ui_routes, controllers, openapi_tags, ui_shell, config_prefixes]` at the top so a reader sees what was enumerated. Adding a new axis bumps `extractor_version` and triggers a full rebuild — the safety valve for "we discovered a new blind spot."

### P3 — Annotation rot

**Pattern**: `@docs` annotations on code go stale because doc pages move/rename and nobody updates the source-side reference. Within a year, half the annotations point at non-existent paths.

**Where seen**: Doxygen `\see` references rotting in long-lived C++ projects; Javadoc `{@link}` links to relocated classes.

**Prevention**: Validation at extraction time (DOC-LINKAGE.md "Validation rules"): every `@docs` claim is checked against SUMMARY.md on every scan. Broken links become findings, not silent rot. CI integration on the `documentation` repo: when a page is renamed in SUMMARY, the lineage must be re-run against the platform repo and broken-link findings filed before merge.

### P4 — Reflection / runtime-only behavior invisible to static lineage

**Pattern**: Spring profile-driven bean wiring, classpath scanning, dynamic Python imports, JS dynamic `import()` — all invisible to AST-only extractors. Scanner queries assume a complete graph and produce false-negatives.

**Where seen**: Spring's `@Conditional*` annotations + profile activation are notoriously hard to enumerate statically; many static-analysis tools simply over-include all conditional branches and rely on runtime narrowing.

**Prevention**:
- Document the blind spot explicitly in `lineage/README.md`.
- Over-include rather than under-include: a `@ConditionalOnProperty` bean is included as a node with `conditional: true` flag. Scanners can choose to treat conditional nodes specially.
- Phase 2 nice-to-have: complementary runtime probe via Spring `/actuator/mappings` from a running platform instance, used as a validator that "every static-graph route appears at runtime, and vice versa."

## High (would waste significant budget)

### P5 — Diff noise drowns review

**Pattern**: Every full rebuild produces a 5MB diff in `nodes.jsonl`. Reviewers stop reading. Real changes hide.

**Where seen**: Generated artifacts in many monorepos (lock files, generated protobufs); the workaround universally is "reviewers skip the file."

**Prevention**: Two-tier diffability — JSONL is for tools, **rollup Markdown files are for humans**. A node-add appears as a line-add in `rollups/ui-shell.md`. PR reviewers are explicitly told (in `lineage/README.md`) that JSONL is machine surface; rollups are review surface. CI displays rollup diffs prominently in PR descriptions.

### P6 — Granularity creep

**Pattern**: "We could also extract every method call!" → graph 10× bigger, extractor 5× slower, and 90% of the new nodes have no scanner consuming them.

**Where seen**: Joern's full CPG is rich but most users only query a small subset; the rest is dead weight.

**Prevention**: Every kind/edge type added to the schema must have at least one scanner consuming it documented in SCHEMA.md. Function-level granularity is **deferred to Phase 3** for exactly this reason — no current scanner needs it; adding it now would bloat the graph for hypothetical future use.

### P7 — Cross-repo edges accumulate without governance

**Pattern**: A controller in `odd-platform` consumed by an adapter in `odd-collectors` looks like one cross-repo edge — until you have 200 of them and any platform refactor breaks adapter lineage in subtle ways.

**Where seen**: Multi-repo workspaces with implicit cross-repo coupling; the coupling becomes load-bearing without anyone noticing.

**Prevention**: MVP keeps repos lineage-isolated (`lineage/odd-platform/`, `lineage/odd-collectors/`). Cross-repo edges are Phase 4 with their own ADR — by the time we add them, we'll know what queries need them.

## Moderate (cost overruns)

### P8 — Extractor written in many languages

**Pattern**: "Java parser in Java, TS parser in Node, Python parser in Python." Three deploy stories, three CI configurations, three ways to break.

**Prevention**: Tree-sitter has Python bindings for all grammars. **Single Python driver, one runtime, one venv.** Extractor lives in one place.

### P9 — "We'll regenerate from scratch every time"

**Pattern**: Initial decision is "always do `--full`; incremental is too complex." Six months later, a `--full` rebuild takes 40 minutes and nobody runs scans anymore.

**Where seen**: Many internal documentation generators that started as "regenerate everything" and slowly became "regenerate Mondays."

**Prevention**: Incremental is the **default mode** from day one (per the ADR). `git diff last_scan_commit..HEAD` is trivial; the design treats `--full` as the exceptional path (extractor version bump, post-miss recovery, post-long-gap).

### P10 — Lineage outpaces navigation

**Pattern**: Lineage substrate ships, scanners adopt it, but `navigation/domains/*.md` stays hand-curated and drifts. Two sources of truth for "where is this feature?"

**Prevention**: `navigation/domains/*.md` becomes auto-derived rollups (per ADR's Decision section) on a per-domain migration schedule. The hand-written intent/gotcha portions move to `navigation/notes/*.md`. This is not optional — it's the third milestone of MVP.

## Specific to ODD's context

### P11 — The collectors monorepo problem

**Pattern**: `odd-collectors` has 40+ adapters, each a near-copy of the others. Lineage extracted naively shows 40× the same shape, and any per-adapter scanner finding fires 40 times.

**Prevention**:
- Adapter-kind nodes carry a `template_class:` field pointing at the shared base.
- Scanners aggregate findings by template class first; only break to per-adapter when the finding genuinely differs.
- Rollups have an explicit `rollups/collectors-adapter-summary.md` showing the matrix (adapter × axis) — one cell per adapter, hot-spotting outliers.

### P12 — The documentation repo is itself a target, not just a destination

**Pattern**: Treating `documentation/` as opaque (just a join target) misses that it has its own structural drift — duplicate pages, orphan pages, IA hierarchy violations (`LSN-007`).

**Prevention**: Out of scope for this ADR's MVP, but flagged: a future "doc-lineage" pass walks the SUMMARY tree + parses heading hierarchies + identifies admonition blocks. Joins to code-lineage at the `@docs` boundary. Phase 5+ work.

## Sources

- [GitHub stack-graphs archival announcement (referenced via 2025 RFC)](https://github.com/orgs/sheeptechnologies/discussions/4)
- [Sourcegraph SCIP — design retrospective](https://sourcegraph.com/blog/the-future-of-scip)
- [Joern CPG — what it is and is not](https://docs.joern.io/code-property-graph/)
- Local: retrospectives `LSN-001`, `LSN-002`, `LSN-006`, `LSN-007`, `LSN-009` — workspace's own case-law for the failure classes this lineage must address
