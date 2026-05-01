---
pillar: documentation
file: gates
status: active
since: 2026-04-16
---

# Quality Bar gates — documentation pillar

Acceptance criteria on a work item are the named deliverables. The Quality Bar is the responsibility the maintainer carries on **every** change regardless of scope. If a Quality Bar check reveals an issue outside the current item's scope, log it as a new backlog item (`CLAUDE.md` "Follow-up work must be logged on disk") — never ignore, never just narrate.

Each of the ten gates below is a gate, not a principle. Review will reject an item that cannot cite evidence for each one.

- **Gate 9 (Factual claim provenance)** generalises the runtime-claim pattern — Gates 4, 5, the term/alias side of Gate 2, and the repo/integration claims that surface in Gate 1 are specific applications of its SoT table.
- **Gate 10 (Content type homing)** generalises the no-duplicates pattern to content TYPES — Gate 1 (no parallel copies of the same content) and Gate 7 (single home for layout/IA) are specific applications of its homing rule.
- **Gates 1, 4, 5, 8, 9** have universal cores that apply across pillars. The executable PROTOCOL form lives in `playbooks/{duplication-sweep,consumer-read,unset-parameter-audit,live-site-verification,claim-inventory}.md`. The gate sections below are the documentation pillar's specialisation — they cite the playbook for the universal procedure and add doc-specific extensions (SoT classes, examples, case-law).

## Pre-authoring stance check (cognitive — runs before any sub-section is written)

The session-start CLAUDE.md read sets context; the gates below verify output. The Principal stance is the cognitive step in between — what would a Principal Full-Stack maintainer building world-class docs ask before authoring this? **Run this checklist before writing every sub-section, not just at the start of a work item.** Local optimization is the single largest source of structural drift; the only thing that catches it is a stance check fired at the moment of authoring.

1. **What content type is this section?** (Feature description / API reference / Configuration reference / Deployment / ADR / Glossary entry / Developer guide / Integration / Example / Troubleshooting / Other.) If you can't name the type, name it now — the taxonomy is incomplete and a Cornerstone-5 decision is owed before authoring.
2. **Where is the canonical home for this type?** Per `pillars/documentation/canonical-homes.md`. If the home exists → link to its relevant section/anchor; do not embed. If it is sparse → extend the canonical home with the new content, then link. If it does not exist → propose adding one before authoring, or log a backlog item if scope-deferred. **Do not silently embed on a feature page.** Canonical failure: `retrospectives/LSN-006-lookup-tables-content-homing.md`.
3. **Where does this page sit in the global SUMMARY taxonomy?** Per `pillars/documentation/cornerstones.md` Cornerstone 2 hierarchy-depth rule. Walk the SUMMARY tree; verify the placement reflects conceptual depth (peers at the same depth must be conceptual peers; nested pages must sit under a conceptually broader parent). Canonical failure: `retrospectives/LSN-007-summary-convenience-placements.md` (the "sibling of a parent group" trap — `Build a custom collector` next to the `Build and run` group).
4. **Does this change preserve the WHY?** Look at the change in the context of the world-class-doc mission (`pillars/documentation/pillar.md` "The bar — stated explicitly"): is an operator three years from now better off because we did this, or just locally satisfied because we ticked the AC box? "Locally satisfied" is fail. The Quality Bar gates won't catch this — only the stance check will, because the gates verify *output* whereas this catches *intent*.
5. **Would I be ashamed to see this change quoted back to me by an angry operator?** The Pride-as-Mechanism rule (`CLAUDE.md` "The project and the maintainer"). If the answer requires hedging ("well, it's the same as the other pages", "the bar wasn't established yet"), the change isn't ready. World-class is the standard; everything below it is a regression.

If any of the five answers reveals a structural mismatch, **stop and address the structural question first** — extend the canonical home, propose the new pillar, escalate the IA decision to the user. Do **not** ship a locally-good change that you know is globally drift-producing. The cost of escalating is small; the cost of accumulating drift is the entire mission.

## 1. No duplicates.

Run the pre-authoring duplication sweep before writing a single line (`docs/main-concepts.md` Terms & Aliases → grep for each canonical term + each alias + each config key + each page-title keyword across `docs/`). Classify every hit: **Link**, **Expand-in-place**, **Consolidate**, or **New alias entry**. If a duplicate exists, consolidate or cross-link — never add a parallel copy.

The sweep runs **bi-directionally** — existing content the change might collide with, **and** new terms / URLs / repos / aliases the change is about to introduce. Grep `docs/` for every new term, repo name, and outbound URL **before** the commit reaches a PR. Canonical failure on the new-content side: `retrospectives/LSN-003-dbt-wrong-repo-link.md` (an unverified outbound URL); on the backlog-internal side: `retrospectives/LSN-009-backlog-internal-duplication.md` (a new backlog item that already had a richer existing item).

## 2. Synonyms and aliases are logged.

Any alias or synonym encountered or introduced must land in the **Terms & Aliases** table in `docs/main-concepts.md` in the **same PR** as the page that uses it. The table is the source of truth for future searches. Silently using "M2M" without registering it as an alias of "S2S" guarantees the next maintainer rediscovers the duplicate (`retrospectives/LSN-004-s2s-fallback-cache.md`).

## 3. Caveats captured.

Every feature has known limitations, performance characteristics, and security considerations that matter to operators. If the code implements one, the doc must say so — as a dedicated section (hint / admonition block), not buried in prose. Discovered-but-undocumented caveats are findings; log them. The attachment ephemeral-default (`retrospectives/LSN-001-attachment-ephemeral-default.md`) and the S3 region constraint (`retrospectives/LSN-002-minio-region-unset.md`) are the reference cases — both were in the code, both were operator-breaking, both were silent.

## 4. Consumer-read before authoring. (Gate)

Every claim a doc makes about runtime behavior must be traced to the code that enforces it. You do not write the claim from the YAML file or from a feature's PR description — you write it from the consumer code. Required reads, per claim type:

- **Config keys** — `application.yml` declaration + **every** `@Value` / `@ConfigurationProperties` consumer + the bean factory / service that wires them. If a key has multiple consumers (e.g. `odd.platform-base-url` feeds Slack and email), read each. Canonical failures: `retrospectives/LSN-001-attachment-ephemeral-default.md` (path resolution invisible at YAML level), `retrospectives/LSN-010-azure-admin-groups-wrong-default.md` (default in `@Value` annotation, not YAML).
- **SDK integrations** (S3/MinIO, JavaMailSender/SMTP, OAuth2/OIDC/Keycloak/Okta/Azure AD clients, Slack webhook, LDAP, Redis, OTLP exporter, JDBC/R2DBC, AWS SSM) — open the bean factory that builds the client. Apply Gate 5 (below).
- **Feature claims** — controller → service → repository trace, plus any scheduled / event-driven side effects.
- **Error / retry / timeout claims** — the explicit handler and config, not "the SDK probably retries".

Gate 4 is the runtime-behavior slice of the broader provenance rule in **Gate 9** (see below). Every implementation commit must include a `Sources:` footer citing the canonical source of truth for each factual claim class the change touches. The footer format lives in `pillars/documentation/authoring.md` "The `Sources:` footer".

The executable procedure for this gate lives in `playbooks/consumer-read.md`. This section is the documentation pillar's specialisation: the table above maps doc-claim shapes to required reads, and the case-law cites the doc-side incidents.

## 5. Unset-parameter audit for SDK integrations. (Gate)

For every SDK / client builder in the code path behind the change, enumerate builder parameters and mark each with explicit status:

- `{parameter}: configured from {config.key}` — explicitly wired.
- `{parameter}: safely defaulted — {rationale}` — the SDK default is acceptable in ODD's deployment context; a brief note in the doc is enough (or no note, if the SDK default is obvious and inherited upstream).
- `{parameter}: caveat-defaulted — {limitation}` — the SDK default is unsafe or surprising in ODD's context; **must ship as a known limitation** (admonition block, dedicated section, not inline prose). If the code can be fixed, also log a platform-side backlog item via `/log-issue`; the doc ships the caveat now.

Canonical failure: `retrospectives/LSN-002-minio-region-unset.md` — the MinIO `MinioAsyncClient.builder()` shipped without `.region(...)`, restricting REMOTE S3 to `us-east-1`. Under this rule the builder would have been enumerated the moment the attachment-storage doc was authored and the region constraint would have surfaced in review, not by user spot-check. This is why this check is its own responsibility and not a footnote to Gate 4.

The executable procedure lives in `playbooks/unset-parameter-audit.md`. This section is the documentation pillar's specialisation: SDK builders relevant to the documentation surface (S3/MinIO, JavaMailSender/SMTP, OAuth2/OIDC, Slack webhook, LDAP, Redis, OTLP, JDBC/R2DBC, AWS SSM) and the doc-side admonition pattern for `caveat-defaulted` parameters.

## 6. Bidirectional code ↔ doc coverage.

For every user-visible code path touched by the change, verify the doc covers it as a **feature**, **known limitation**, **performance note**, or **security consideration**. Missing coverage in either direction is itself a finding to log as a backlog item. "Found but out of scope" is acceptable and the correct action; "not looked" is not.

## 7. Layout and completeness.

`SUMMARY.md` reflects the real page list; orphan pages are adopted or deleted; index / `README.md` / section-landing pages stay in sync with SUMMARY; headings match the TOC levels. A new page ships with its SUMMARY entry and all link-backs in the **same commit** (rule lives in `pillars/documentation/authoring.md`). **In-page TOCs stay synchronized with the H2s they index** — pages with an in-page TOC at the top (canonical example: `docs/Features.md`) must update that list whenever an H2 is added, renamed, or removed on the page, in the same commit (`retrospectives/LSN-005-features-toc-desync.md`).

**IA hierarchy sanity.** Every new page's SUMMARY placement must reflect conceptual depth (see `pillars/documentation/cornerstones.md` Cornerstone 2 — "Hierarchy depth must reflect conceptual depth"). Reviewer checks: (a) are the new page's siblings at the chosen depth conceptual peers, or is the new page actually a sub-topic of one of them? (b) is the chosen parent the conceptually broadest reasonable one, or does the page belong under a more general parent? (c) does the parent's existing child set form a peer group this page joins — or is the page being placed next to a parent group rather than inside it? **FAIL** on convenience-placements (a page lands at root or at the wrong depth because no clean parent was identified at authoring time, or because the placement "felt close enough" to similar-looking entries). Canonical failure: `retrospectives/LSN-007-summary-convenience-placements.md` (DOC-082 logs the IA refactor).

## 8. Publishing standards always.

Every doc change ships with live-site verification on `docs.opendatadiscovery.org` (performed by `/review`, not the implementer). Build-time rendering and live-site rendering are not the same system; only the live site is authoritative. If a URL returns a GitHub-fallback substring or the intended change isn't visible, the item reopens as `blocked`. The fallback-cache failure mode is `retrospectives/LSN-004-s2s-fallback-cache.md`.

## 9. Factual claim provenance. (Gate — generalizes Gate 4)

Every factual claim a doc change makes must cite its canonical source of truth in the commit's `Sources:` footer. Memory and plausibility are not sources. Reviewer rationalizations ("defensible", "monorepo default", "probably correct", "looks right", "canonical owner", "safe to assume", "presumably", "should be") are **banned** as standalone justifications — every review note ends in `VERIFIED via {fetch/grep/read}` or `NOT VERIFIED → logging as DOC-NNN`.

The SoT table below names the canonical source per claim class. Claims without a cited SoT fail review.

| Claim class | Canonical source of truth | Sources-line format |
|---|---|---|
| Repo URL / ownership | `navigation/architecture.md` canonical repo table (implementer SoT) + `documentation/docs/developer-guides/github-organization-overview.md` (user-facing companion) + WebFetch of the target README on first introduction | `Repo: {url} → architecture.md row "{repo}"` |
| Integration category (adapter vs collector vs push adapter vs plugin) | `navigation/architecture.md` "Canonical vocabulary" + `docs/integrations/README.md` (DOC-042, once shipped) | `Integration: {name} → architecture.md §"Canonical vocabulary"` |
| Config key semantics & default | `application.yml` declaration + **every** `@Value` / `@ConfigurationProperties` consumer + bean factory | `Config: {yml-key} → {consumer:line}` (one bullet per consumer) |
| SDK client / builder behavior | bean factory + **every** builder parameter classified (Gate 5) | `Builder: {file:line} ({status per param})` |
| API path / request schema | OpenAPI spec (`odd-platform-specification/openapi.yaml`, `opendatadiscovery-specification/specification/odd_api.yaml`) | `Spec: {yaml-path}:line` |
| Terminology / alias | `docs/main-concepts.md` Terms & Aliases | `Term: main-concepts.md §Terms — "{alias}"` |
| Feature lifecycle (GA / Beta / Experimental / Deprecated) | ADR + target repo README / CHANGELOG / release tag | `Lifecycle: {source}` |
| Dependency / version | `pyproject.toml` / `build.gradle` / `package.json` | `Dep: {file:line}` |
| Error / retry / timeout behavior | explicit handler code (never "the SDK probably retries") | `Handler: {file:line}` |
| Cross-repo code reference | target repo clone (not GitHub web UI) | `Cross-repo: {repo}/{file:line}` |
| Existing in-flight work (backlog) | `backlog/{cat}/*.md` — grep before creating any new item | `Backlog: {DOC-NNN} ({status})` |

Each claim class has a testable failure mode that Gate 9 catches:

- **Wrong repo URL in an outbound link** — `retrospectives/LSN-003-dbt-wrong-repo-link.md`. `Repo:` line forces an `architecture.md` lookup that surfaces the mismatch.
- **Wrong integration category** — calling a push adapter a "collector", or calling a pull adapter a "collector" instead of naming the collector that hosts it. `Integration:` line forces cross-checking the canonical vocabulary (adapter = mapper; collector = container of pull adapters; plugin = configured adapter instance; push adapter = push-strategy adapter embedded in the source's runtime).
- **Wrong default value** — `retrospectives/LSN-010-azure-admin-groups-wrong-default.md` (Azure admin-groups read `roles`, not `groups`). `Config-consumer:` bullet forces reading every `@Value` annotation, where the default lives.
- **Silent SDK data loss** — `retrospectives/LSN-002-minio-region-unset.md`. `Builder:` line forces parameter-by-parameter enumeration with explicit `configured | safely-defaulted | caveat-defaulted` status.
- **Drift between doc claim and spec** — `Spec:` line forces a grep of the OpenAPI YAML.
- **Terminology collision** — `retrospectives/LSN-004-s2s-fallback-cache.md` (M2M vs S2S for the same auth path). `Term:` line forces an alias-table row in the same PR.
- **Backlog-internal duplication** — `retrospectives/LSN-009-backlog-internal-duplication.md`. `Backlog:` line forces grepping the backlog before creating a new item.

The bi-directional duplication sweep (Gate 1) is scoped at the same time to cover **terms, URLs, and repos being added** as well as those being removed. An implementer introducing `odd-dbt` as a link should grep `docs/` for `dbt` first — hits on `github-organization-overview.md` and `main-concepts.md` would have caught the LSN-003 dbt-link error at authoring time, not at user-review time.

The executable claim-inventory procedure lives in `playbooks/claim-inventory.md`. The SoT table above is the documentation-pillar specialisation — each row is the documentation pillar's SoT class with `Sources:` footer format.

## 10. Content type homing. (Gate — generalizes Gate 1 to content TYPES; enforces Cornerstone 5)

Gate 1 catches **same-content duplication** ("the same paragraph appears on two feature pages"). Gate 10 catches **same-type misplacement** — content of a recognizable *type* (API reference, Configuration reference, ADR, Glossary entry, Developer guide, Integration, Deployment, Example, Troubleshooting) authored on a feature page when a canonical home for that type exists elsewhere in the doc tree.

Canonical failure: `retrospectives/LSN-006-lookup-tables-content-homing.md` — ~1300 words of API endpoint tables on `lookup-tables.md` while `developer-guides/api-reference` (the dedicated page) carried only a "use Swagger UI" pointer. Gate 1 didn't catch it because the content wasn't duplicated anywhere — but the operator opening the dedicated API reference page got nothing of value, and a future maintainer asking "where do API endpoints live?" would have had to grep every feature page.

For every authored sub-section in a change, the implementer (and reviewer) must answer:

- **What content type is this?** (Per `pillars/documentation/canonical-homes.md`.)
- **Where is the canonical home for this type?** (Per `pillars/documentation/canonical-homes.md`.)
- **Is this the canonical home — or is this a feature page that should *link* to the canonical home?**

Three legitimate outcomes (matching the Pre-authoring stance check question 2 above and `pillars/documentation/canonical-homes.md` "The rule operationalized"):

1. **Canonical home exists and contains the relevant content.** Feature page links to the home's relevant section/anchor; embeds at most a 1-2 sentence pointer. **PASS.**
2. **Canonical home exists but is sparse for this case.** Same change extends the canonical home with the new content + adds the feature-page link. **PASS** if both surfaces ship in the same commit; **FAIL** if only the feature page is updated.
3. **No canonical home today.** Same change either (a) adds the canonical home and migrates the embedded content there in the same commit (escalating to a Cornerstone-5 decision), or (b) logs a backlog item to add the home then migrate, with the embedded content explicitly marked as "temporary until DOC-NNN ships the canonical home." **FAIL** if the embedded content ships without one of (a) or (b).

The Sources footer's per-claim-class lines (Gate 9) double as a content-type signal — `Spec:` lines indicate API reference content, `Config:` / `Config-consumer:` indicate configuration reference, `Lifecycle:` indicates ADR-class content. When a footer carries 5+ `Spec:` lines and the change is on a feature page rather than the API reference page, that is a Gate 10 signal: the content type is API reference; the canonical home is `developer-guides/api-reference`; the feature page should be linking, not embedding.

**Examples of past drift Gate 10 should have caught (logged for refactor under DOC-083):**

- `lookup-tables.md` `## API reference` (~1300 words; 16 endpoints in 4 groups) — should live on `developer-guides/api-reference` under a Reference-Data section, with a one-line link from the feature page.
- `odd-platform.md` `### API surface` for data-collaboration (DOC-034 — 7 routes across 3 tables) — same pattern.
- `directory.md` `## API surface` (DOC-047 — 4 endpoints) — same pattern.
- `integration-wizard.md` `## API surface` (DOC-050 — 2 endpoints) — same pattern.

In every case the work shipped reads well in isolation, but the global picture is: API reference content is scattered across feature pages, and the dedicated `developer-guides/api-reference` page is empty. DOC-083 is the systemic refactor; the rule above is what prevents the next four feature pages from repeating the pattern.