---
research: code-lineage-substrate
artifact: STACK
date: 2026-05-08
mode: ecosystem
overall_confidence: HIGH
---

# STACK — Extractor toolchain for the code-lineage substrate

## Recommendation (opinionated)

**Use `tree-sitter` as the single AST source. Do not adopt SCIP.** Supplement tree-sitter with three small language-aware passes:

1. **Java/Spring pass** — tree-sitter query that locates `@Configuration`, `@Bean`, `@ConfigurationProperties`, `@Value("${...}")`, `@RestController`, `@MessageMapping`, and SDK-builder call chains.
2. **TypeScript app-shell pass** — tree-sitter query for `import` statements, default exports, JSX component definitions, and `react-i18next` / `react-router` registration sites.
3. **Python collector pass** — tree-sitter query for module-level callables, `pyproject.toml` entry points, and adapter registration.

Confidence: **HIGH** — backed by 2025 industry shift away from SCIP/stack-graphs toward tree-sitter for retrieval/AI-context use cases (citations below).

## Why not SCIP?

SCIP is a Protobuf-based code-intelligence transmission format — Sourcegraph's successor to LSIF — designed to power IDE-grade "Go to definition / Find references" with **compiler-accurate** cross-references. ([Sourcegraph SCIP announcement](https://sourcegraph.com/blog/announcing-scip), [scip.proto](https://github.com/sourcegraph/scip/blob/main/scip.proto))

Three reasons it's wrong for our use case:

1. **Compiler-accuracy is overkill.** Our scanners enumerate "every UI-shell node, every SDK builder, every config consumer." We don't need precise type resolution; we need exhaustive structural enumeration. SCIP pays a heavy setup cost (per-language indexers that often require full project compilation) for a precision we don't use.
2. **Industry has moved.** GitHub's stack-graphs project — the precise-code-nav peer of SCIP — was archived September 2025. The published rationale: "the community's shift away from complex, monolithic frameworks toward simpler, composable tools." An open RFC explicitly proposes [removing SCIP and replacing it with tree-sitter for file-incremental indexing](https://github.com/orgs/sheeptechnologies/discussions/4). For RAG / retrieval / AI-context use cases (which is exactly ours), tree-sitter is documented as achieving comparable results with far less complexity.
3. **Our extractor must be small.** CLAUDE.md's velocity constraint is explicit: one maintainer, OSS, no budget. SCIP indexers per language would dominate the workspace's footprint. Tree-sitter is a single dependency with declarative queries per language.

## Why tree-sitter

- **Single dependency, multi-language.** Official grammars exist for TypeScript, Java, Python, plus 40+ other languages. ([tree-sitter intro](https://tree-sitter.github.io/))
- **GitHub uses it in production.** GitHub's static-analysis pipeline runs tree-sitter across nine languages and six million repositories for name-binding extraction. ([Static Analysis at GitHub](https://dl.acm.org/doi/fullHtml/10.1145/3487019.3487022))
- **Declarative queries.** Tree-sitter supports S-expression queries (`(class_declaration name: (identifier) @class-name)`) so each "axis" in our manifest becomes a query file, not bespoke code.
- **File-incremental by design.** Tree-sitter parses one file at a time without cross-file resolution baked in — that matches our incremental-via-`git diff` run mode exactly.
- **Existing prior art for our use case.** [`codesight`](https://github.com/spirituslab/codesight) is "universal code structure visualization via static analysis — tree-sitter powered, no LLM" — directly the shape we want. [`srctx`](https://github.com/williamfzc/srctx) combines tree-sitter + LSIF/SCIP for definition/reference graphs (useful as a reference implementation if we later need cross-file edges).

## Toolchain

| Layer | Choice | Why |
|---|---|---|
| AST parser | `tree-sitter` (Python bindings: `py-tree-sitter`) | One dependency, multi-language, declarative queries |
| Java grammar | `tree-sitter-java` | Official grammar |
| TS grammar | `tree-sitter-typescript` | Official grammar (covers `.ts` and `.tsx`) |
| Python grammar | `tree-sitter-python` | Official grammar |
| Spring annotation pass | Custom tree-sitter queries (~300 lines `.scm`) | Spring-specific — must catch `@Bean` / `@ConfigurationProperties` / `@Value` |
| TS app-shell pass | Custom tree-sitter queries (~200 lines) | Catches `import 'locales/i18n'` and similar app-bootstrap-only imports |
| Python adapter pass | Custom tree-sitter queries (~150 lines) | Catches collector adapter registration patterns |
| Storage | JSONL (nodes, edges) + YAML (manifest) + Markdown (rollups) | Line-diffable; matches workspace conventions |
| Driver language | Python | Already used in `odd-collectors`; keeps stack count low |

Total dependency surface: `py-tree-sitter` + four grammar packages. Extractor codebase target: **under 2K lines of Python** for MVP (per the cost cap in the ADR).

## What about SCIP indexers as a complementary axis?

Possible, but defer. If the function-level call-graph need (Phase 3, for `consumer-read` audits at scale) demands cross-file resolution, the smallest-blast-radius option is:

- Run `scip-java` / `scip-typescript` / `scip-python` only on `--full` rebuilds, not incremental.
- Consume SCIP output as an additional `calls` edge layer on top of the tree-sitter base.
- This keeps the daily incremental path tree-sitter-only and reserves SCIP for occasional deep passes.

This is a Phase 3 question, not an MVP one. Flagged here so we don't accidentally close the door on it.

## Anti-recommendations

- **Joern / Code Property Graphs.** Security-flavored, heavy graph DB, designed for vulnerability hunting (data-flow taint analysis). Overkill for enumeration. ([Joern docs](https://docs.joern.io/code-property-graph/))
- **GitHub stack-graphs.** Archived 2025-09. Do not adopt.
- **LSIF.** Superseded by SCIP, which we're also rejecting.
- **Roll-our-own parser.** Multi-language parsing is a multi-year project; tree-sitter exists.

## Open questions deferred (not blocking MVP)

- Do we eventually want a typed-config schema overlay (e.g., parsing `application.yml` with a YAML library and joining to Java `@ConfigurationProperties` classes via tree-sitter)? — Yes, this is Axis 5 (`config_prefixes`) of the MVP. Implementation is a small YAML walk, not extractor work.
- Do we need a runtime probe (Spring `/actuator/mappings`) as a validator? — Phase 2 nice-to-have. Static lineage covers MVP needs.

## Sources

- [Sourcegraph SCIP announcement](https://sourcegraph.com/blog/announcing-scip)
- [scip.proto schema](https://github.com/sourcegraph/scip/blob/main/scip.proto)
- [tree-sitter introduction](https://tree-sitter.github.io/)
- [Static Analysis at GitHub (ACM DL)](https://dl.acm.org/doi/fullHtml/10.1145/3487019.3487022)
- [RFC 001 — Remove SCIP, adopt tree-sitter](https://github.com/orgs/sheeptechnologies/discussions/4)
- [codesight — tree-sitter universal code structure viz](https://github.com/spirituslab/codesight)
- [srctx — tree-sitter + LSIF/SCIP definition/reference graphs](https://github.com/williamfzc/srctx)
- [Joern Code Property Graph docs](https://docs.joern.io/code-property-graph/)
