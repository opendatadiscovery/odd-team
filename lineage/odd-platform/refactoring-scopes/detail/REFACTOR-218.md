## REFACTOR-218 — Markdown / HTML description body stored verbatim without backend sanitisation; UI renders via `rehype-raw` without `rehype-sanitize` — stored-content-injection / potential stored-XSS

**Severity**: HIGH
**Category**: missing-sanitisation
**Surfaced by**:
- `upsertDataEntityInternalDescription.md:bugs_limitations_corner_cases[0]` (headline finding — no backend sanitisation + UI pulls rehype-raw + no rehype-sanitize anywhere)
- `upsertDataEntityInternalDescription.md:security.known_security_gaps[0]` (security restatement)
- `upsertDataEntityInternalDescription.md:concepts.invariants[3]`

**Description**: `setInternalDescription` (`ReactiveDataEntityRepositoryImpl.java:430-438`) writes the request body verbatim into the `internal_description` `text` column. There is no `Jsoup.clean`, no `Encode.html`, no allowlist, no length cap, no `@Size` on the form-data DTO. The UI renders via `@uiw/react-markdown-preview@4.2.2` (`Markdown.tsx:113-124`), which transitively pulls in `rehype-raw@6.1.1` (`pnpm-lock.yaml:5922`). `rehype-raw` parses raw HTML embedded in Markdown into AST nodes that `react-markdown` then renders. NO `rehype-sanitize` is configured anywhere in the UI (`grep -rln 'rehype-sanitize' odd-platform-ui/` returns 0 matches). NO `skipHtml` prop is passed. Whether `<script>` survives depends on `react-markdown`'s default allowed-elements schema, but `<img src=x onerror=…>`, `<a href="javascript:…">`, `<iframe>`, `<style>`, and HTML-comment-based payloads are not categorically excluded. A future minor-version bump of any of the rendering libraries can widen the surface invisibly. Every description-display surface (entity-detail Description tab, activity-feed event-detail dialog rendering old/new description JSON, lineage tooltips if they show descriptions, search-result snippets) is downstream of this gap. The writer is `DATA_ENTITY_DESCRIPTION_UPDATE`-gated under non-DISABLED auth modes; the readers include any authenticated user with `DATA_ENTITY_VIEW` (effectively every catalog visitor) — **one malicious / careless writer reaches every reader.**

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:430-438` (verbatim store)
- `Markdown.tsx:113-124` (`MDEditor.Markdown` invocation with no `skipHtml`)
- `pnpm-lock.yaml:5922` (`rehype-raw@6.1.1` transitive dependency)
- absence of `rehype-sanitize` in the entire UI tree (grep evidence: 0 matches)
- `V0_0_1__init.sql:80` (`internal_description text` column, unbounded length)
- `components.yaml:2188-2194` (no `maxLength` constraint at OpenAPI level)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-063 (NEW THIS BATCH) — "Description is stored as raw Markdown / free-text with no backend transformation; UI is the sole renderer." The ADR captures the storage-format intent; this REFACTOR captures the missing defence-in-depth that the ADR does NOT absolve. The ADR says "UI renders Markdown"; the scope says "UI must also sanitise it (the current renderer + raw-HTML config does not)."

**Proposed remedy**: Two-layer defence:
1. **Backend (server-side):** Apply `Jsoup.clean(body, Safelist.relaxed())` or equivalent OWASP-recommended sanitiser at the service layer in `DataEntityInternalStateServiceImpl.updateDescription` BEFORE the repository call. Add a `@Size(max = 65535)` annotation on `InternalDescriptionFormData.internal_description` (or whatever maximum the operator team agrees is reasonable) so OpenAPI-generated validation enforces it.
2. **UI (client-side):** Add `rehype-sanitize` to the `MDEditor.Markdown` plugin pipeline in `Markdown.tsx`. Configure an allowlist that excludes raw `<script>`, `<style>`, `<iframe>`, and `javascript:` URLs. Pair with `skipHtml` prop as a belt-and-braces measure for non-raw-HTML rendering surfaces.

A `@WebFluxTest` should store `<script>alert(1)</script>` and `<img src=x onerror=...>` and assert the round-tripped content is sanitised. A UI snapshot test should render a description containing `<script>` and assert the script tag is absent in the DOM.

**Severity rationale**: HIGH — stored-content-injection / potential stored-XSS on the platform's largest free-text write surface. Combined with REFACTOR-073 (DISABLED-mode bypass) and the activity-feed cross-owner read (REFACTOR-053 / REFACTOR-024 cluster), the writer reaches the largest possible reader set. Defence-in-depth at both layers is the standard remedy.

**Suggested backlog grouping**: SEC-NNN content-injection sprint. Pair with the REFACTOR-220 view_count inflation, REFACTOR-225 ownership lineage SPoF, and the broader read-collaborative blast-radius family for a coordinated audit.

---
