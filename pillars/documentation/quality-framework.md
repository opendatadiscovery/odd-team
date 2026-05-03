---
pillar: documentation
file: quality-framework
status: active
since: 2026-05-03
---

# Doc-quality framework

## Why this framework exists

The 10 Quality Bar gates fire on what is *authored* in a per-item commit. The editorial-audit playbook adds a "stance" plus a reactive failure-shape catalog that grows after each user spot-check. Both miss a class: **structural defects that no one is changing right now**. A page can be 4× redundant for years (`main-concepts.md` Adapter/Plugin/Collector content, found 2026-05-03), an env-var example can ship hyphens that fail in shells (`odd-platform.md` Notifications section, found same day), an entire UI surface can lack a doc page (Management section, found same day) — none of these get caught by gates that fire on per-commit changes or by an audit that depends on the reviewer noticing the same shape twice.

The fix is a **positive specification of doc quality** — twelve axes that say what world-class docs MUST satisfy — operationalised into a **per-page systematic audit** the reviewer walks for every page, plus a **code-side coverage sweep** for the reverse direction (features implemented but never documented). Findings derive from axes rather than being reactively catalogued. Coverage is measured against `(pages × axes)` so progress has a denominator.

This framework supersedes the editorial-audit playbook's "stance + failure-shape table" approach. The playbook becomes the **executor** of this framework; the failure-shape table becomes a **derived index** from the axes.

## What world-class documentation is — twelve axes

Each axis carries: (1) a positive statement of what the axis requires, (2) what an axis-PASS looks like for a single page, (3) the failure shapes derived from violations, (4) the audit cue — the concrete questions a reviewer asks while auditing the axis.

### A1 — Canonical-home discipline

**Positive statement.** Every content type (feature description, API reference, configuration reference, deployment, ADR, glossary entry, developer guide, integration, example, troubleshooting) has exactly one canonical home in the doc tree. Every page either IS the canonical home for its content type, or LINKS to the canonical home. No content type is embedded twice on different pages.

**PASS shape.** The page authors content of one or more types; for each type, the page is either the canonical home (per `pillars/documentation/canonical-homes.md`) or it carries a one-line pointer + cross-link to the home.

**Derived failure shapes.** Content-type misplacement (LSN-006 lookup-tables); Parallel surfaces with drift (cross-page version of A2); Pointer drift (canonical home moved but page still embeds).

**Audit cue.** For each H2/H3 on the page: name the content type. Look it up in `canonical-homes.md`. Is this page the home? If yes, is the content the richest version that exists in the tree? If no, does the page link to the home rather than embedding? Sources-footer composition (5+ `Spec:` lines on a feature page; 5+ `Config:` lines on a non-config page) is a strong signal of misplacement.

### A2 — Intra-page coherence

**Positive statement.** A single page reads as one coherent narrative top-to-bottom. No section restates content another section already covered. Definitions appear once, not in prose then in a table then in a glossary row. Glossary tables (Terms & Aliases) carry alias-only one-liners pointing to the canonical home, never full re-definitions.

**PASS shape.** The H2 sequence covers distinct topics; adjacent H2s do not overlap; any in-page "see [other H2 on this page]" is for genuine cross-reference, not redundant restatement; the page's own glossary section (if any) carries aliases-and-pointers, not full content.

**Derived failure shapes.** Intra-page redundancy (DOC-114 main-concepts.md); Repeated definitions; Glossary-table-doing-canonical-home's-job.

**Audit cue.** List the H2s in order. For each adjacent pair, ask: do these cover the same conceptual ground? Watch for "X vs Y" next to "X, Y, Z, W" next to "Terms & Aliases" with full definitions. Special check for any glossary table on the page: confirm rows are alias-only, not full re-definitions of content elsewhere on the page or in the doc tree.

### A3 — Cross-page coherence

**Positive statement.** The page does not contradict, duplicate, or conflict with sibling pages. Same fact, same answer, everywhere. Defaults stated once. Caveats mentioned consistently. Concepts named with the canonical term across the tree.

**PASS shape.** Every factual claim on the page is consistent with claims on every other page that touches the same fact. Cross-page disambiguations exist where audiences could confuse two related concepts (e.g. Slack-as-alert-webhook vs Slack-as-collab-app, fixed by DOC-093).

**Derived failure shapes.** Internal contradiction (two pages, different defaults); Logical mismatch (page A implies Y, page B asserts not-Y); Conceptual drift (same term, two meanings, no disambiguation — LSN-004 S2S/M2M).

**Audit cue.** For each non-trivial factual claim on the page (config default, API behavior, lifecycle state, RBAC rule), grep the doc tree for the same claim on other pages. Do they agree? For each named entity (a config key, an endpoint, a feature name), check the canonical home page agrees with what this page says.

### A4 — Reference integrity

**Positive statement.** Every cross-link's text matches its target's content. Every anchor resolves on the live site. Every outbound URL is canonical (no redirect chains). Every image referenced exists. No commit-pinned source URLs that will rot.

**PASS shape.** All in-doc relative links point at extant pages with intended anchors; outbound URLs return HTTP 200 directly (not via 30x); image paths resolve in `.gitbook/img/` or `.gitbook/assets/`; magic-links (link text says "X" but target is something else) are absent or rephrased to match.

**Derived failure shapes.** Cross-link mismatch (DOC-102 integration-wizard "odd.platform-base-url" → wrong anchor); Dead anchor; Redirect chain (DOC-101 Slack URL canonical migration); Broken image (DOC-103 Overview.md SVGs); Magic-link (link text "technical details" → Java source file, DOC-110); Commit-pinned URL rot.

**Audit cue.** For each `[text](target)` on the page: does the target exist? Does the anchor resolve? Does the link text describe what the reader will get? For outbound URLs: is the URL canonical (no redirect)? For image paths: does the file exist on disk? For source-code URLs: pinned to a commit hash or to `main`/a tag?

### A5 — Claim provenance

**Positive statement.** Every factual claim on the page traces to a named source of truth. Memory and plausibility are never sources. Banned reviewer phrases ("defensible", "probably correct", "looks right", "monorepo default", "safe to assume") are absent. Every implementation commit's `Sources:` footer cites the SoT class for each claim.

**PASS shape.** Each factual claim on the page can be traced (via the `Sources:` footer of the commit that authored it OR a fresh consumer-read at audit time) to a named SoT — `application.yml` declaration + `@Value` consumer for config keys; OpenAPI spec for API paths; bean factory for SDK builder behavior; explicit handler code for retry/timeout claims; ADR for design rationale.

**Derived failure shapes.** Unsourced claim; Wrong default (LSN-010 Azure admin-groups read `roles` not `groups`); Phantom config key; Banned-phrase rationalisation by reviewer.

**Audit cue.** For each non-obvious factual claim on the page, ask: where is this in the code? If you can't name the file:line, it's a finding. If the page was authored by a commit with a `Sources:` footer, do the cited files actually still say what the page claims?

### A6 — Operator depth

**Positive statement.** Every behavior an operator must know is captured at operator-relevant depth. Defaults, caveats, RBAC, retry/timeout behavior, side-effects, performance characteristics, security considerations, deployment-context defaults. The page tells the operator what the code DOES — not what the YAML literally says.

**PASS shape.** A reader who runs the operator path the page describes does not hit a surprise: every default that matters has been called out; every caveat the consumer-code reveals has been surfaced; every error/retry behavior has been documented from explicit handler code (not "the SDK probably retries"); known limitations ship as `{% hint style="warning" %}` admonitions, not buried in prose.

**Derived failure shapes.** Missing caveat (LSN-001 attachment ephemeral default; LSN-002 MinIO region unset); Undocumented default; Surface-only description; "Probably retries" claims instead of cited handler.

**Audit cue.** For each documented operator-facing config key / behavior on the page: open the consumer code (the `@Value` annotation, the bean factory, the SDK builder). Does the page surface every parameter that has operator-relevant default behavior? Are caveats from the consumer code captured as admonition blocks? For SDK builders specifically, is every parameter classified `configured | safely-defaulted | caveat-defaulted`?

### A7 — Reader-flow integrity

**Positive statement.** The page has clear entry-points and clear next-actions. Getting-started flows complete (no dead-ends). "See X for details" delivers what X promises. Admonitions point at the fix-path, not just at the problem. No circular "see also" loops. No half-finished narratives.

**PASS shape.** A reader entering the page can complete the action it advertises without getting stuck. Every "see [link] for X" delivers X. Every warning admonition either describes a thing the reader can act on OR explicitly says "no operator-side workaround until [issue link]". Lists with [Read more] links have follow-through for every item or explicitly mark items as undocumented.

**Derived failure shapes.** Half-finished narrative (DOC-105 quick_start.md); Reader-flow defect; Dead-end admonition (warning without fix-path); Coverage hole (DOC-107 Use_cases.md three orphaned items); Circular see-also.

**Audit cue.** Walk the page as a first-time reader of the topic. At each "see X" link, follow it; does it deliver? At each warning, does the page name the next action? At each list, is every item followed through? At each step-by-step, do all the steps exist?

### A8 — Vocabulary consistency

**Positive statement.** Terms are used per the canonical alias registry (`main-concepts.md` Terms & Aliases). Aliases are registered in the same PR they appear in. Ambiguous terms are disambiguated where the audience could form an incompatible mental model. The doc tree speaks one vocabulary.

**PASS shape.** The page uses canonical terms (per the alias registry); any synonyms are flagged as aliases and registered; ambiguous terms (e.g. "Slack" before DOC-093) carry inline disambiguation pointing at the registry; new terms introduced by this page have rows in the registry that ship in the same PR.

**Derived failure shapes.** Conceptual drift (LSN-004 S2S/M2M); Unregistered alias; Ambiguity (multiple readings); Multi-framing-not-extended (the user-2026-05-03 directive: when two terms describe the same concept from different framings, extend the registry rather than flagging one as drift).

**Audit cue.** For each non-trivial term on the page: is it in the alias registry? Does the page use the canonical form, or a registered alias? Does any term on the page have a second meaning elsewhere in the tree? If yes, is the disambiguation present?

### A9 — Audience completeness

**Positive statement.** Every feature appears on every audience surface where its audience needs it: user-facing (Features.md or aspect landings) if there's a UI affordance; operator-facing (configuration-and-deployment) if there's config or a deployment concern; developer-facing (developer-guides) if there's an API, an extension point, or a contract. Cross-audience absence is a finding.

**PASS shape.** The feature this page documents has the corresponding entry on every other audience surface where the feature warrants it — and those other-surface entries cross-link bidirectionally with this page.

**Derived failure shapes.** Cross-audience absence (DOC-091 Data Collaboration on operator+developer but missing from Features.md); One-surface-only feature; Missing-cross-link between audience surfaces.

**Audit cue.** For each feature documented on the page, ask: does this feature have a UI? An operator-facing config? A developer-facing API? For each audience that applies, find the entry on that audience's surface. Missing entry on a relevant audience = finding. Found entry but no cross-link back to this page = finding.

### A10 — IA placement

**Positive statement.** The page sits at the SUMMARY depth its conceptual depth warrants. Siblings at that depth are conceptual peers, not convenience-placements. Sub-features are nested under their parent feature, not placed next to it. Primary pillars are not buried under a thematic group.

**PASS shape.** The page's SUMMARY entry is at the depth a Principal-grade IA review would assign it. The page's siblings at that depth are conceptual peers (not "this also fits in this group"). The page's parent group is the conceptually broadest reasonable parent.

**Derived failure shapes.** IA / hierarchy incoherence (LSN-007 SUMMARY convenience-placements); Sub-feature placed as peer of pillar; Pillar buried under thematic group.

**Audit cue.** Find the page's SUMMARY entry. List its siblings at that depth. Are the siblings conceptual peers? Is the page actually a sub-feature of one sibling (and should be nested under it instead)? Is the page's parent the conceptually broadest reasonable one?

### A11 — Bidirectional code↔doc fidelity

**Positive statement.** Both directions hold:
- **Forward (doc → code):** Every claim in the doc is currently true. Every aspect of the documented feature that matters to the audience(s) the page serves is captured — features, known limitations, performance, security, RBAC, error/retry, side-effects, defaults, caveats. Surface-only descriptions fail; what's needed is operator-relevant detail.
- **Reverse (code → doc):** Every implemented user-visible code path is documented on every surface where it matters. Every known limitation, performance characteristic, and security consideration the code carries is surfaced in the docs (not just in code comments or the engineer's head).

**PASS shape.** Forward: a fresh consumer-read at audit time confirms every documented claim still holds; the documented feature's full operator-relevant detail is present. Reverse: a periodic codebase scan finds every controller / service / `@Value` consumer / SDK builder / scheduled job / security configuration / performance-relevant code path mapped to a doc entry on every audience surface that needs it.

**Derived failure shapes.** Forward: Outdated baked-in assumption; Dead admonition; Phantom feature; Stale URL/screenshot; Default drift. Reverse: Silent feature (shipped without doc surface); Silent caveat (operator-discovers-empirically); Silent security consideration; Silent performance characteristic.

**Audit cue.**
- Forward (per-page): for each documented behavior on the page, fresh-read the consumer code; does the doc still match? For each documented default, is the default still in `application.yml` / the `@Value` annotation? For each admonition, is the bug it warns about still present?
- Reverse (periodic codebase sweep, NOT per-page): walk the codebase looking for features without doc entries. Catalogues of code paths to sweep:
  - `@RestController` / `@Controller` classes — every endpoint should have an API-reference entry.
  - `@Configuration` + `@Bean` factories — every bean wiring an SDK / external dep should map to a configuration page section.
  - `@Value` / `@ConfigurationProperties` consumers — every consumed config key should appear in the configuration reference.
  - `@Scheduled` jobs — every background job should have an operator-facing description (cadence, side-effects, ShedLock guard).
  - Security configurations (`SecurityConfig`, `SecurityWebFilterChain`, custom filters) — every protected/unprotected endpoint group should be documented.
  - SDK client builders (`MinioAsyncClient`, `JavaMailSender`, `WebClient`, etc.) — every parameter classified per Gate 5.

### A12 — Prose and rendering

**Positive statement.** The doc product speaks one voice. No typos, broken markdown, escaped artefacts, missing punctuation, mixed indentation, unrendered GitBook editor leakage, casual marketing-tone H3 headings interleaved with technical ones. Reads like a published manual, not a draft.

**PASS shape.** The page passes a Principal-grade copy-edit: spelling consistent, grammar clean, markdown renders as intended, no stray escape characters, no zero-width artifacts, indentation uniform, headings tone-consistent with sibling H3s on the same page.

**Derived failure shapes.** Prose polish (DOC-113 cross-page batch); Rendering defect (DOC-112 broken markdown link pattern in github-organization-overview.md); Tone inconsistency; Escaped-character artefacts; Mixed indentation.

**Audit cue.** Read the page end-to-end as a published manual. Note every typo, broken markdown, missing space, escaped backslash that should render literal, casual-vs-technical tone shift in adjacent headings. Cumulative weight matters — a single typo is rounding error; ten typos on a page are a Principal-grade fail.

## How violations are caught

Two execution modes. Both mandatory.

### Mode 1 — Per-page systematic audit (axes 1-10, 11-forward, 12)

For every page in `documentation/docs/**/*.md`, the reviewer walks the eleven page-readable axes and assigns a verdict per axis: **PASS** / **FAIL+DOC-NNN** / **N/A**. The reviewer cannot move to the next page until every page-readable axis has a verdict on this page.

Axis 11's reverse direction is NOT in this mode (it requires reading the codebase, not the page); it runs as Mode 2.

Procedure:

1. Open the page. Read it end-to-end once for context.
2. For each axis A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11-forward, A12:
   - Apply the audit cue.
   - Decide: PASS / FAIL / N/A.
   - If FAIL, log a DOC-NNN (per `playbooks/follow-up-on-disk.md`). Do not narrate the finding without logging it.
3. Record the page's audit row in `state/doc-quality-coverage.md`:
   ```
   docs/{path}.md — A1✓ A2✗(DOC-NNN) A3✓ A4✓ A5✓ A6✓ A7✓ A8✓ A9✓ A10✓ A11✓ A12✗(DOC-NNN) — overall FAIL
   ```
4. Move to the next page.

A page passes overall when every axis is PASS or N/A. A single FAIL → page-overall is FAIL.

### Mode 2 — Code-side coverage sweep (axis 11-reverse, periodic)

Walks the platform / collector codebase looking for features that lack doc entries on the audience surfaces where they belong. Runs as a separate scanner-style sweep, not per-page.

Procedure (per code repo):

1. For each catalogue in axis A11's reverse audit cue (`@RestController`, `@Configuration`+`@Bean`, `@Value`/`@ConfigurationProperties`, `@Scheduled`, security configs, SDK client builders): grep the codebase, enumerate every match.
2. For each match, decide which audience surface(s) the feature warrants: user-facing (Features.md) / operator-facing (configuration-and-deployment) / developer-facing (developer-guides/api-reference).
3. For each (match, surface) pair, check whether the doc has an entry. If missing on any surface that the feature warrants, log a DOC-NNN with the missing surface(s) named.
4. Record the sweep in `state/doc-quality-coverage.md` under the "Code-side coverage" section.

This sweep is heavy; it runs at minimum every quarter, plus after any significant code refactor.

## How findings are recorded

Every audit finding (Mode 1 axis-FAIL OR Mode 2 missing-surface) is a `DOC-NNN` follow-up via `playbooks/follow-up-on-disk.md`. The follow-up's body cites:

- **Axis** the violation falls under (A1-A12).
- **Source location** — `docs/{path}.md:{line}` (Mode 1) OR `{repo}/{path}:{line}` (Mode 2).
- **Verbatim passage** that triggered the finding (Mode 1) OR the code-feature description (Mode 2).
- **Failure shape** from the axis's derived list, OR a new shape proposed via this framework (axis remains the parent).
- **Recommended-fix direction** — what the fix should aim at, not the fix itself.
- **Cross-references** — every other doc page or code path the finding touches.

Priority bands stay aligned with `playbooks/doc-product-editorial-read.md` § 4 (Critical / High / Medium / Low) — but the axis identifies the structural class, the priority identifies audience impact.

## Coverage dashboard

Lives at `state/doc-quality-coverage.md`. Two sections:

1. **Per-page audit cells** — table with one row per `documentation/docs/**/*.md` page, one column per page-readable axis (A1-A10, A11-forward, A12), cells are `✓` (PASS), `✗(DOC-NNN)` (FAIL with link), `—` (N/A), or empty (not yet audited).
2. **Code-side coverage sweep** — table with one row per code-feature catalogue (controllers / configurations / SDK builders / etc.), columns for the relevant audience surfaces, cells indicate coverage status.

Headline metrics:
- **Per-page coverage**: `(audited pages / total pages) %`.
- **Per-axis pass rate**: `(PASS cells / non-empty cells)` per axis. Identifies which axes drag the average.
- **Open FAILs**: count of `✗(DOC-NNN)` cells.
- **Code-side coverage**: `(documented code-feature/audience-surface pairs / total pairs) %`.

Baseline audit run is the initial population. Subsequent `/review` runs re-audit affected pages plus a rotating sample (one new page per `/review` invocation if no batch-affected pages need re-auditing).

## How this slots into the rest of the framework

- **The 10 Quality Bar gates** (`pillars/documentation/gates.md`) remain the per-item authority for `review-ready` → `done` or `blocked`. Gates verify what is *changed*; this framework verifies what is *present*. The two are complementary, not redundant — gates fire on commits, this framework fires on the doc product as a whole.
- **`pillars/documentation/cornerstones.md`** — Cornerstones 1-5 are the IA constraints; A1, A2, A3, A10 operationalise them axis-by-axis.
- **`pillars/documentation/canonical-homes.md`** — the content-type homing table; A1's audit cue is "look it up here".
- **`pillars/documentation/authoring.md`** — the GitBook authoring rules + Sources-footer format; A4, A5, A12 enforce them.
- **`playbooks/doc-product-editorial-read.md`** — restructured to be the executor of this framework. Its procedure becomes the per-page audit walk; its failure-shape table becomes a derived index from these axes.
- **`/review` skill** — runs Mode 1 (per-page audit) on every affected page in the batch + a rotating sample of one un-audited page per invocation. Mode 2 runs as a separate `/scan code-coverage` scanner (to be defined; out of scope for this initial framework codification).

## Case-law (the failures this framework exists to prevent)

- **2026-05-03 main-concepts.md 4× redundancy** — DOC-114. Two consecutive editorial-audit runs missed it because the failure-shape catalog had no within-page redundancy entry. A1 + A2 together catch this on first audit.
- **2026-05-03 odd-platform.md hyphenated env-vars** — DOC-108. Internal contradiction on the same page (`ODD_PLATFORM-BASE-URL` in one section, `ODD_PLATFORM_BASE_URL` in another) for the same key. A3 + A4 catch this on first audit.
- **2026-05-03 quick_launch_on_amazon_elastic_kubernetes_service.md 18 defects** — DOC-111. Typos, broken shell examples, missing words. A12 catches the typos; A4 catches the broken examples.
- **2026-05-03 Management UI section has no doc page** — DOC-109. A9 (audience completeness) catches the user-facing miss; A11-reverse (code-side sweep) would catch the operator-facing miss when the management routes are walked.
- **2026-05-03 Overview.md / Data_Compliance_DS.md / quick_start.md / platform.md orphan files** — DOC-103/104/105/106. A1 (canonical-home discipline + content-homing) catches all four when audited.
- All prior LSN-001 through LSN-011 retrospectives are anchored to specific axes; see `retrospectives/README.md` for the LSN-by-axis index (to be added when the existing LSN files are next touched).
