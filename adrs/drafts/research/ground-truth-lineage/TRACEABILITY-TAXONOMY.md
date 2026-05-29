---
research: ground-truth-lineage
artifact: TRACEABILITY-TAXONOMY
date: 2026-05-29
mode: research (single-thread, aggressive web)
overall_confidence: HIGH
threads: OSLC + ADR-as-data (MADR/Log4brains/Nygard) + GitHub-issue model + test-rationale (Allure/pytest/JUnit) + SPDX + safety-traceability (DO-178C/ISO-26262)
scope: >
  Add THREE ground-truth ("positive space") anchor labels so the existing DERIVED/GAP nodes
  (ImplicitADR, RefactoringScope, DocGap, TestGap, Finding) can point at committed reality:
  published ADRs, real GitHub issues, existing tests. Names chosen to sit in the existing
  UPPER_SNAKE LPG vocabulary (graph-query-layer SCHEMA.md) and make derived→ground-truth obvious.
---

# TRACEABILITY-TAXONOMY — ground-truth lineage anchors

## Recommendations (opinionated, decision-dense)

1. **Lifecycle model — adopt OSLC RM's relationship vocabulary verbatim, in object→subject form, as the naming spine.** OSLC (OASIS) is the only widely-deployed, vendor-neutral, RDF-typed traceability vocabulary for decision↔requirement↔test↔code, and its predicates map 1:1 onto our three surfaces: `validatedBy` (req/feature ← test), `satisfies/satisfiedBy` (impl ↔ requirement/decision), `trackedBy` (entity ← issue/change-request that governs it), `affectedBy`, `decomposedBy`. Adopt **the meanings and the directionality**; rename to our UPPER_SNAKE house style (OSLC's RDF camelCase would clash with the 13 existing edge types). Layer DO-178C/ISO-26262's **bidirectional-traceability** discipline as a *property invariant* (every ground-truth anchor edge must be navigable both ways and carry `source_file:source_line`), not as new edge types. **Confidence: HIGH.**

2. **ADR-as-data — model a published ADR as an `ADR` node keyed by `ADR-NNN` with `{status, date, superseded_by, url}`; promote an `ImplicitADR` candidate to it via `PROMOTED_TO`, and record realisation (code embodies the decision) via `REALISES`.** This is the MADR/Log4brains/Nygard consensus: identity = stable id + slug, status ∈ {proposed, accepted, deprecated, superseded}, supersession is a *first-class forward link* (`superseded_by: ADR-NNN`) modelled as an `ADR`→`ADR` `SUPERSEDED_BY` edge. The source of truth is the committed ADR file (`adrs/ADR-NNN-*.md`; published into the docs' Developer Guides), exactly mirroring the canonical=committed-files contract. `PROMOTED_TO` is the lineage join the brief asks for; `REALISES` reuses OSLC `satisfiedBy` semantics for code↔decision. **Confidence: HIGH.**

3. **GitHub-issue — model a real filed issue as a thin durable `Issue` node `{number, url, state, title, labels[], repo}` keyed by `{repo}#{number}`; relate it with `FILED_AS` (draft→real), `TRACKS` (issue governs a finding/scope), and `CLOSED_BY` (PR/commit that closed it). Ingest offline-first: cache to one committed JSON snapshot per repo, refresh via a single batched GraphQL query, never live-query at graph-build time.** The durable fields are exactly GitHub's GraphQL `Issue` scalars (`number/url/state/title/labels`); code-linkage rides GitHub's own `closedByPullRequestsReferences` / `closingIssuesReferences` / timeline `CrossReferencedEvent`. The number, not the opaque node-id, is the human-facing key. **Confidence: HIGH** (model) / **MEDIUM** (ingestion mechanics — gated on local-only + no-`gh`-CLI constraints; see §3.4).

4. **Test-existence-rationale — model a real test as a `Test` node `{test_id, kind∈{unit,integration}, path, rationale}` and express *why it exists* with FOUR distinct edges, one per rationale class: `COVERS` (→CodeNode), `VALIDATES` (→Feature), `REGRESSES` (→Issue|Finding), `ENFORCES` (→ADR).** This is the Allure/pytest/JUnit tagging model (`@Issue`/`@TmsLink`/`@Feature`, pytest markers) made into edges plus the well-attested "BUG-#"/"regression test for" naming convention. The rationale is a *typed edge set*, not a free-text field — a test with zero ground-truth edges is itself a finding (orphan test / unknown purpose). `VALIDATES` reuses OSLC `validatedBy` inverse; `ENFORCES` is the ADR-conformance test class; `REGRESSES` is the regression-for-a-known-bug class. **Confidence: HIGH.**

5. **Naming — three new node labels (`ADR`, `Issue`, `Test`) and nine new edge types, all UPPER_SNAKE, all carrying `source_file:source_line`.** Full table in §5. The labels are deliberately short positive-space nouns (no `Published`/`Real`/`Existing` prefix — the *gap* siblings already carry the qualifier: `ImplicitADR` vs `ADR`, `TestGap` vs `Test`, finding-vs-`Issue`). Each derived→ground-truth promotion edge is named so direction reads as a sentence: `ImplicitADR PROMOTED_TO ADR`, `Issue draft FILED_AS Issue`, `Test REGRESSES Issue`. **Confidence: HIGH.**

---

## 1 — Canonical lifecycle-traceability model (Decision 1)

**The established model is the Requirements Traceability Matrix (RTM) realised as a typed link graph, and the canonical *vocabulary* for those links is OSLC.** Three layers of prior art, in decreasing order of what we adopt:

- **OSLC Requirements Management (OASIS Open Project)** — the one to copy. The [OSLC RM vocabulary](https://github.com/oslc-op/oslc-specs/blob/master/specs/rm/requirements-management-vocab.ttl) defines exactly the predicates we need, each as an RDF property with a one-line comment and an explicit subject→object direction:

  | OSLC predicate | Direction (subject → object) | Meaning (verbatim gloss) |
  |---|---|---|
  | `validatedBy` | requirement → **test** | "the object entity in some way validates the subject entity" |
  | `satisfiedBy` / `satisfies` | userreq → sysreq / **impl → requirement** | "a user requirement is satisfied by a system requirement" |
  | `trackedBy` | entity → **change-request/issue** | "the object entity … tracks or governs the evolution of the subject entity" |
  | `affectedBy` | entity → entity | "the object entity in some way affects the subject entity" |
  | `decomposedBy` / `decomposes` | req → req | "the object entity decomposes the subject entity" |
  | `implementedBy` | requirement → **code** | "the object … is a necessary aspect of an implementation of the subject" |
  | `elaboratedBy`, `specifiedBy`, `constrainedBy`, `uses` | (peripheral; not adopted) | elaboration / specification / constraint / use |

  OSLC links are plain RDF triples — *"a subject URI, a predicate that is the property, and a value that is the URI of the target resource"* ([OSLC RM spec](https://docs.oasis-open-projects.org/oslc-op/rm/v2.1/requirements-management-spec.html)). That is precisely our LPG-with-`source_file:source_line` contract: a typed directed edge to a resource that carries its own canonical address. **We adopt `validatedBy`, `satisfies/satisfiedBy`, `trackedBy`, `implementedBy` (renamed `VALIDATES`/`REALISES`/`TRACKS`/`COVERS` to fit house style and to read as active verbs from the ground-truth anchor's perspective). We reject `elaboratedBy`/`specifiedBy`/`decomposedBy`/`constrainedBy`** — they model requirement-to-requirement decomposition we do not have (we have no requirements tier; our "requirement" tier is the published ADR + the GitHub feature-request issue).

- **DO-178C / ISO 26262 — adopt the *discipline*, not the vocabulary.** Both safety standards mandate **bidirectional traceability**: every requirement links *both* to its origin *and* to its downstream verification evidence; DO-178C requires HLR↔LLR↔code↔test to be navigable in both directions, and ISO 26262 requires "every safety requirement … link both to its origin and to its downstream verification evidence" ([Parasoft DO-178C](https://www.parasoft.com/learning-center/do-178c/requirements-traceability/), [Parasoft ISO 26262](https://www.parasoft.com/learning-center/iso-26262/requirements-traceability/)). For us this is one invariant, not new edges: **the graph projector must be able to answer the inverse of every ground-truth edge** (`ADR ←PROMOTED_TO← ImplicitADR`, `Feature ←VALIDATES← Test`) — which an LPG gives for free by traversing edges backwards. We also adopt DO-178C's **"derived requirement"** notion as a node *property*, not a label: an `ADR` or `Issue` with no upstream driver is flagged `derived: true` (a decision/issue that originated in implementation, with no external requirement above it) — the audit-useful signal, captured cheaply.

- **SPDX relationship vocabulary — confirms our edge names against an independent standard.** SPDX 3.0.1 ships `TEST_OF`, `TEST_CASE_OF`, `DOCUMENTATION_OF`, `SPECIFICATION_FOR`, `GENERATED_FROM` ([SPDX RelationshipType](https://spdx.github.io/spdx-spec/v3.0.1/model/Core/Vocabularies/RelationshipType/)). `TEST_OF`/`TEST_CASE_OF` independently validate a test→code edge as a first-class relationship type; we name ours `COVERS` (clearer for code-coverage intent) but the precedent confirms the shape is standard. We do **not** adopt SPDX wholesale — it is an SBOM/packaging vocabulary; its strength here is corroboration, not a source to copy.

**Net:** the lifecycle spine is OSLC's predicate set, projected into our UPPER_SNAKE LPG, governed by DO-178C-style bidirectionality + provenance, corroborated by SPDX. We are not inventing relationship semantics — we are instantiating a 15-year-old standard vocabulary onto committed-files-as-truth.

## 2 — ADR-as-data (Decision 2)

**Consensus model across MADR, Log4brains, adr-tools, and Nygard's original:**

- **Identity** = a stable sequential id (`ADR-NNN`, already our `adrs/README.md` convention) plus a human slug. Log4brains keys each ADR by a `slug` like `20200924-use-markdown-architectural-decision-records` ([Log4brains](https://github.com/thomvaill/log4brains)); our README already uses `id: ADR-{NNN}`. Keep `ADR-NNN` as the node key.
- **Status** ∈ `{proposed, accepted, deprecated, superseded}` — identical across [MADR](https://adr.github.io/madr/) (`[proposed | rejected | accepted | deprecated | superseded]`), Log4brains (`proposed/accepted/superseded/deprecated`), and our own `adrs/README.md` frontmatter (`accepted | superseded | deprecated`). No new vocabulary needed; our format already matches.
- **Supersession is a first-class forward link.** MADR writes "Superseded by ADR-NNNN" in the status line and our README already has `superseded_by: ADR-{NNN}`. Model it as an `ADR`→`ADR` `SUPERSEDED_BY` edge (and its free inverse `←SUPERSEDED_BY←` = "supersedes"). This makes the decision chain traversable, which is the entire point of a maintained ADR log.
- **Links to code / other ADRs** — MADR's design explicitly "supports links to other ADRs inside an ADR" and a "More Information / Links" section. Code-linkage = the `## Examples` / "Code locations that exemplify this decision" section already in our ADR template.

**Node shape — `ADR`:**

| Property | Source | Example |
|---|---|---|
| `adr_id` (key) | frontmatter `id` | `ADR-007` |
| `status` | frontmatter `status` | `accepted` |
| `title`, `date` | frontmatter | — |
| `superseded_by` | frontmatter | `ADR-012` (→ `SUPERSEDED_BY` edge) |
| `url` | published Developer-Guides URL | `https://docs.opendatadiscovery.org/developer-guides/adr/...` |
| `derived` (bool) | no upstream requirement/issue driver | `true` |
| `source_file` / `source_line` | `adrs/ADR-NNN-*.md` | `adrs/ADR-007-...md:1` |

**Derived→ground-truth edges:**

- **`ImplicitADR PROMOTED_TO ADR`** — the candidate the archaeologist surfaced has been ratified into a published ADR. This is the explicit ask in the brief ("Implicit-ADR candidates should link to the published ADR they get promoted into"). Direction: candidate → published. The `find-implicit-adrs` skill already classifies candidates as `promote | extend-existing | drift | unique-load-bearing`; the `promote` class is exactly the set that should grow a `PROMOTED_TO` edge once the human writes the ADR. `extend-existing` candidates edge to the ADR they extend via the same `PROMOTED_TO` (an existing ADR gains a new realisation).
- **`CodeNode REALISES ADR`** — code embodies the decision (OSLC `satisfiedBy` semantics, inverted to active voice). Sourced from the ADR's `## Examples` file:line citations. This is how "the graph knows which code is load-bearing for which decision," and it is the inverse query a refactor planner needs ("if I touch this file, which ratified decisions does it realise?").

**Why not reuse `ImplicitADR` for both?** Because the canonical=committed-files contract demands the distinction: `ImplicitADR` is a *derived* node (lives in `lineage/{repo}/implicit-adrs.md`, regenerated each run, may churn); `ADR` is a *ground-truth* node (lives in a committed, human-ratified file, stable, citable in the public docs). Collapsing them would let a regenerated candidate silently overwrite a ratified decision — the exact category error the whole positive-space layer exists to prevent.

## 3 — GitHub-issue modeling (Decision 3)

### 3.1 Minimal durable node — `Issue`

GitHub's GraphQL `Issue` object gives the durable scalar set directly ([GitHub GraphQL objects](https://docs.github.com/en/graphql/reference/objects)): `number` (Int!), `url` (URI!), `state` (open/closed), `title` (String!), `labels` (LabelConnection), `createdAt`/`closedAt`. The opaque `id` (base64 node-id) is **not** the key — it is unstable across GitHub's own migrations and meaningless to a maintainer; **key the node on `{repo}#{number}`** (e.g. `odd-platform#1234`), the form that is human-typeable, appears in commit messages, and matches our issue-draft `target_repo` + filed number.

| Property | Source (GraphQL field) | Notes |
|---|---|---|
| `issue_key` (key) | `{repo}#{number}` | human-facing, stable |
| `number` | `Issue.number` | |
| `url` | `Issue.url` | |
| `state` | `Issue.state` | `OPEN` / `CLOSED` |
| `title` | `Issue.title` | |
| `labels[]` | `Issue.labels` | `bug`/`enhancement`/`refactor` → drives `issue_kind` |
| `repo` | parent | matches `navigation/repos.yaml` key |
| `source_file` / `source_line` | the cached snapshot file | provenance into the committed JSON |

### 3.2 Code/PR linkage — ride GitHub's own model, don't reinvent

GitHub already maintains the development graph: `PullRequest.closingIssuesReferences` (PRs declare which issues they close via "Closes #N"), the inverse `Issue.closedByPullRequestsReferences`, and timeline `CrossReferencedEvent` / `ConnectedEvent` (mentions and sidebar links) ([GitHub GraphQL objects](https://docs.github.com/en/graphql/reference/objects); [community discussion #24367](https://github.com/orgs/community/discussions/24367)). We project these as one edge:

- **`Issue CLOSED_BY {PullRequest|commit}`** — from `closedByPullRequestsReferences`. For MVP we do not add a `PullRequest` node label (PRs are ephemeral, merge-and-gone); `CLOSED_BY` can target a `CodeNode` (the merge commit / file touched) or carry the PR URL as an edge property. Defer a `PullRequest` label until a consumer needs PR-level queries.

### 3.3 Derived→ground-truth edges

- **`{issue-draft} FILED_AS Issue`** — the on-disk draft (`issues/{repo}/PLT-NNN.md`, whose frontmatter *already* carries empty `github_issue_url` + `github_issue_number`) links to the real filed issue once a human files it and populates those fields. The draft is **not** a graph node today; the cheapest projection is: when `github_issue_number` is non-empty in a draft's frontmatter, the projector emits a `FILED_AS` edge from a lightweight `IssueDraft` stub (keyed by `PLT-NNN`) to the `Issue`. This is the direct realisation of "Drafts should link to the real filed issue."
- **`Finding TRACKS Issue`** and **`RefactoringScope TRACKS Issue`** — OSLC `trackedBy`: the real issue governs the evolution of the finding/scope. Direction reads "this finding is tracked by issue #N." Source: the draft's `discovered_during:` back-pointer + the finding-id cross-reference already present in PLT-065-style drafts (`finding F-011d`, `DOC-245`). This is "findings/refactor-scopes should link to the issue that tracks them."

### 3.4 Ingestion under local-only + rate-limit constraints — **MEDIUM confidence**

Hard constraints: local-only (no cloud service), single maintainer, **`gh` CLI is NOT installed** (per CLAUDE.md), filing is always a deliberate human action. Recommended ingestion:

1. **One committed JSON snapshot per repo** at `lineage/{repo}/github-issues.json` — a *cache*, not live state. Contains the durable scalar set + `closingIssuesReferences` for the issues we actually reference (the ones named in issue-drafts' `github_issue_number`, plus any referenced by findings). This is the offline-first pattern: the graph build reads the snapshot, never the network.
2. **Refresh via a single batched GraphQL query**, run by a human/session deliberately (the same "visible-to-others is a human action" rule that governs filing). One GraphQL call fetches many issues by number in one round-trip — well inside the unauthenticated 60/hr or authenticated 5000/hr REST budget, and GraphQL's point-cost model makes a batched `nodes(ids:[...])` query a single cheap operation. **Do not** WebFetch issue HTML pages at build time (brittle, unauthenticated, rate-limited per page).
3. **Scope the snapshot to referenced issues only.** We do not mirror the whole tracker — only the issues some draft/finding/test points at. This keeps the snapshot tiny, the refresh cheap, and the graph honest (every `Issue` node exists because something references it).

Confidence is MEDIUM here purely because the *mechanics* of the refresh step depend on a not-yet-decided detail (a tiny committed script vs. a manual paste of GraphQL output vs. a future `/sync-issues` skill) — the *model* (snapshot-as-cache, key on `{repo}#{number}`, edges from GitHub's own development graph) is HIGH. The ADR that adopts this must pick the refresh mechanism explicitly; the recommended default is **a small read-only Python helper in `lineage/_extractor/` that takes a GITHUB_TOKEN env var when present and degrades to "snapshot only, stale" when absent** — never blocking the graph build on network access.

## 4 — Test-existence-rationale modeling (Decision 4)

**How the industry captures *why a test exists*:** test-management tools attach typed metadata to tests rather than free text. Allure ships `@Issue`, `@TmsLink`, `@Link`, and behaviour annotations `@Epic`/`@Feature`/`@Story` ([Allure JUnit5 reference](https://allurereport.org/docs/junit5-reference/), [jest-allure2 links](https://wix-incubator.github.io/jest-allure2-reporter/docs/features/links/)); pytest exposes markers (shown as tags); JUnit5 uses `@Tag`. The recurring, decades-old convention for the regression class is **naming**: tests prefixed `BUG-<n>` or named "regression test for #N" — *"a clear traceability link with the concerned bug report"* ([ResearchGate: Establishing Traceability Links between Unit Test Cases and Units under Test](https://www.researchgate.net/publication/221569791_Establishing_Traceability_Links_between_Unit_Test_Cases_and_Units_under_Test)). The research finding is that **naming/tagging conventions yield highly accurate test↔code traceability** — i.e. the rationale should be *structured*, captured at the test, not inferred.

**Our model: rationale = a typed edge set, one edge per rationale class.** A `Test` node carries identity + a free-text `rationale` summary for human reading, but the *machine-traceable* "why" is the set of outbound edges. Four classes, four edges, matching the brief's three named rationales (regression-for-bug, enforces-ADR, validates-feature) plus the base coverage relation:

| Rationale class | Edge | Target | Maps to |
|---|---|---|---|
| validates a feature | **`VALIDATES`** | `Feature` | Allure `@Feature`/`@Story`; OSLC `validatedBy` (inverse) |
| regression for a known bug | **`REGRESSES`** | `Issue` or `Finding` | Allure `@Issue`; "BUG-#" naming convention |
| enforces an architectural decision | **`ENFORCES`** | `ADR` | ADR-conformance test class (no single tool owns this; ours is novel-but-grounded — it is OSLC `validatedBy` applied to a *decision* instead of a requirement) |
| covers code | **`COVERS`** | `CodeNode` | SPDX `TEST_OF`/`TEST_CASE_OF`; coverage-mapper's existing test↔node claim |

**Node shape — `Test`:**

| Property | Source | Example |
|---|---|---|
| `test_id` (key) | `{path}::{Class}#{method}` or `{path}::{test_fn}` | `…/AlertServiceTest.java::reopenIsIdempotent` |
| `kind` | dir/marker | `unit` \| `integration` |
| `path` | test file | |
| `rationale` | human summary (and/or parsed annotation) | "regression for cross-mode owner bleed" |
| `source_file` / `source_line` | the test file | |

**Distinction from `TestGap` is the whole point:** `TestGap` (derived, from `test-map.yaml`) says "behaviour X has no test"; `Test` (ground-truth, from a real test file the coverage-mapper already parses) says "this test exists and here is what it anchors." The `test-coverage-mapper` skill already verifies "sidecar-claimed test files exist" — it is the natural producer of `Test` nodes and `COVERS` edges; the three rationale edges (`VALIDATES`/`REGRESSES`/`ENFORCES`) are populated from test annotations/naming + the cross-references the mapper already reads. **An existing test with `COVERS` but no `VALIDATES`/`REGRESSES`/`ENFORCES` is a surfaced finding** — "test exists, purpose unknown" — which is itself a useful audit signal (orphan test, or a test whose feature/decision link was never recorded).

## 5 — Naming (Decision 5)

New node **labels** (3) and **edge types** (9), all UPPER_SNAKE for edges / PascalCase for labels (matching the existing `CodeNode`/`Sidecar`/`ImplicitADR` labels and `ENRICHED_BY`/`SURFACES_FINDING` edges in `graph-query-layer/SCHEMA.md`). Every edge carries `source_file` + `source_line` (the universal provenance rule).

### Node labels

| Label | Meaning | Source-of-truth file | Gap-sibling it anchors |
|---|---|---|---|
| `ADR` | A ratified, published architectural decision | `adrs/ADR-NNN-*.md` (published to docs Developer Guides) | `ImplicitADR` (derived candidate) |
| `Issue` | A real filed GitHub issue in the `opendatadiscovery` org | `lineage/{repo}/github-issues.json` (committed cache snapshot) | `Finding` / `RefactoringScope` (derived) |
| `Test` | An existing unit/integration test, with its reason for existing | the test file itself (parsed by `test-coverage-mapper`) | `TestGap` (derived) |
| `IssueDraft` (lightweight stub) | On-disk paste-ready issue draft, projected only when filed | `issues/{repo}/{PREFIX}-NNN.md` frontmatter | — (it is the *bridge*, not a gap) |

### Edge types

| Edge | From → To | Meaning | OSLC / standard basis | Source-of-truth |
|---|---|---|---|---|
| `PROMOTED_TO` | `ImplicitADR` → `ADR` | candidate ratified into a published ADR | (lineage join) | `implicit-adrs.md` + ADR frontmatter |
| `REALISES` | `CodeNode` → `ADR` | code embodies the decision | OSLC `satisfiedBy` | ADR `## Examples` file:line |
| `SUPERSEDED_BY` | `ADR` → `ADR` | decision replaced by a newer one | MADR/Nygard supersession | ADR `superseded_by` frontmatter |
| `FILED_AS` | `IssueDraft` → `Issue` | on-disk draft became a real filed issue | (lineage join) | draft `github_issue_number` |
| `TRACKS` | `Finding`/`RefactoringScope` → `Issue` | the issue governs this finding's evolution | OSLC `trackedBy` | draft `discovered_during` + finding-id xref |
| `CLOSED_BY` | `Issue` → `CodeNode` (PR/commit) | PR/commit that closed the issue | GitHub `closedByPullRequestsReferences` | `github-issues.json` |
| `COVERS` | `Test` → `CodeNode` | test exercises this code | SPDX `TEST_OF`/`TEST_CASE_OF` | test file + coverage-mapper |
| `VALIDATES` | `Test` → `Feature` | test validates a user-facing feature | OSLC `validatedBy`; Allure `@Feature` | test annotation/naming |
| `REGRESSES` | `Test` → `Issue`/`Finding` | test guards against a known bug | Allure `@Issue`; "BUG-#" convention | test annotation/naming |
| `ENFORCES` | `Test` → `ADR` | test enforces an architectural decision | OSLC `validatedBy` on a decision | test annotation/naming |

**Direction discipline (DO-178C bidirectionality):** every edge above is stored once and traversed both ways by the projector. The audit-critical inverse queries fall out for free: `ADR ←REALISES←` = "which code realises this decision," `Feature ←VALIDATES←` = "which tests validate this feature," `Issue ←TRACKS←` = "which findings does this issue track," `ADR ←ENFORCES←` = "which tests enforce this decision." These inverses are the maintainer's real questions; the forward edges are how they are cheaply stored.

**Why these names sit cleanly in the existing vocabulary:** the existing derived layer uses `HAS_DOC_GAP`/`HAS_TEST_GAP`/`IMPLIES_ADR`/`SURFACES_FINDING` — all "derived node points at a derived gap." The new layer's verbs (`PROMOTED_TO`, `FILED_AS`, `REALISES`, `VALIDATES`, `REGRESSES`, `ENFORCES`, `TRACKS`) are all "derived/code node points at *committed ground truth*," and each reads as a complete sentence in the direction stored. The positive-space labels are bare nouns (`ADR`/`Issue`/`Test`) precisely because their gap-siblings already carry the negative qualifier — the asymmetry *is* the documentation.

---

## What we deliberately reject and why

- **RDF/OWL + full OSLC HTTP service surface — rejected.** OSLC is delivered as RDF triples over an OSLC-Core HTTP linked-data API ([OSLC RM spec](https://docs.oasis-open-projects.org/oslc-op/rm/v2.1/requirements-management-spec.html)). We adopt its *vocabulary and directionality* into our existing LPG; we reject the RDF serialization and the service layer. Rationale: the graph-query-layer already settled LPG-over-RDF/OWL ("structured prose, not formal triples"); importing OSLC's machinery would re-litigate a decided question and add a triple-store + service for zero query-power gain at our scale (~600 nodes).
- **OSLC `elaboratedBy` / `specifiedBy` / `decomposedBy` / `constrainedBy` — rejected.** They model a requirements-decomposition tier (sysreq decomposes into sub-reqs) we do not have. Our "requirement" tier is the published `ADR` plus the GitHub feature-request `Issue`; there is no requirement-to-requirement hierarchy to decompose. Adopting them would create empty edge types — vocabulary debt.
- **SPDX as the primary vocabulary — rejected (kept as corroboration only).** SPDX is an SBOM/packaging relationship vocabulary; its `TEST_OF`/`DOCUMENTATION_OF`/`GENERATED_FROM` confirm our edge *shapes* are standard, but the bulk of SPDX (`DYNAMIC_LINK`, `BUILD_DEPENDENCY_OF`, `DISTRIBUTION_ARTIFACT`, `PATCH_FOR` …) is supply-chain semantics irrelevant to a decision/issue/test lineage. We cite it to prove we are not inventing; we do not adopt it.
- **A `PullRequest` node label — rejected for MVP.** PRs are ephemeral (open, merge, gone); GitHub already exposes the issue↔PR↔commit linkage via `closingIssuesReferences`. We carry the PR as a `CLOSED_BY` edge property (URL) rather than a node, and defer a `PullRequest` label until a consumer needs PR-level traversal. Adding it now is a node label with no query behind it.
- **Live GitHub queries at graph-build time — rejected.** Violates local-only, is rate-limited per page, and makes the graph build non-deterministic and network-dependent (the graph-query-layer's whole rebuild model is "pure function of committed files"). The committed `github-issues.json` snapshot is the canonical cache; the network is touched only by a deliberate human-run refresh, mirroring the "filing an issue is a human action" rule.
- **Auto-filing issues / auto-promoting ADRs from the graph — rejected (hard).** Filing a GitHub issue and ratifying an ADR are both "visible-to-others, human-deliberate" actions per the workspace's safety rules and `issues/README.md` lifecycle. The graph *records* `FILED_AS` / `PROMOTED_TO` after the human acts; it never triggers the act. The derived→ground-truth edge is populated by reading the human-populated frontmatter field (`github_issue_number`, `superseded_by`), never by the agent reaching out to GitHub or writing a published ADR on its own.
- **A single free-text `rationale` field as the sole "why a test exists" — rejected.** Free text is unqueryable and drifts. The rationale must be a *typed edge set* (`VALIDATES`/`REGRESSES`/`ENFORCES`/`COVERS`) so "which tests enforce ADR-007?" is a graph traversal, not a grep. The free-text `rationale` property is retained only as a human-readable gloss alongside the edges.
- **Keying `Issue` on GitHub's opaque GraphQL node-id — rejected.** The base64 `id` is unstable and meaningless to a maintainer. `{repo}#{number}` is the form that appears in commits, drafts, and conversation, and is the natural join key to our existing `target_repo` + `github_issue_number` draft fields.

## Sources

- [OSLC RM Vocabulary (TTL, authoritative predicate list)](https://github.com/oslc-op/oslc-specs/blob/master/specs/rm/requirements-management-vocab.ttl) — `validatedBy`, `satisfiedBy`/`satisfies`, `trackedBy`, `implementedBy`, `affectedBy`, `decomposedBy`, `elaboratedBy`, `specifiedBy`, `constrainedBy`, `uses` with verbatim glosses + subject→object direction.
- [OSLC Requirements Management v2.1 — Part 1: Specification (OASIS)](https://docs.oasis-open-projects.org/oslc-op/rm/v2.1/requirements-management-spec.html) — OSLC links as RDF triples (subject URI, predicate, target URI); linked-data delivery model.
- [MADR — About / template (adr.github.io)](https://adr.github.io/madr/) — status enum `proposed|rejected|accepted|deprecated|superseded`; "Superseded by ADR-NNNN"; links-to-other-ADRs design decision.
- [Log4brains (thomvaill/log4brains)](https://github.com/thomvaill/log4brains) — ADR identity via slug; status `proposed/accepted/superseded/deprecated`; docs-as-code knowledge base.
- [GitHub GraphQL API — Objects reference (Issue, PullRequest)](https://docs.github.com/en/graphql/reference/objects) — durable Issue scalars (`number`, `url`, `state`, `title`, `labels`, `createdAt`, `closedAt`); `closingIssuesReferences` / `closedByPullRequestsReferences`.
- [GitHub community discussion #24367 — referenced PR from issue](https://github.com/orgs/community/discussions/24367) — `closingIssuesReferences` + timeline `CrossReferencedEvent`/`ConnectedEvent` for issue↔PR linkage.
- [SPDX 3.0.1 RelationshipType vocabulary](https://spdx.github.io/spdx-spec/v3.0.1/model/Core/Vocabularies/RelationshipType/) — `TEST_OF`, `TEST_CASE_OF`, `DOCUMENTATION_OF`, `SPECIFICATION_FOR`, `GENERATED_FROM` (corroborates test→code edge as a standard relationship type).
- [Allure Report — JUnit5 reference](https://allurereport.org/docs/junit5-reference/) and [jest-allure2 links](https://wix-incubator.github.io/jest-allure2-reporter/docs/features/links/) — `@Issue`, `@TmsLink`, `@Link`, `@Feature`/`@Story` test-traceability annotations.
- [Establishing Traceability Links between Unit Test Cases and Units under Test (ResearchGate)](https://www.researchgate.net/publication/221569791_Establishing_Traceability_Links_between_Unit_Test_Cases_and_Units_under_Test) — "BUG-#" naming convention; naming/tagging yields highly accurate test↔code traceability.
- [Parasoft — DO-178C requirements traceability](https://www.parasoft.com/learning-center/do-178c/requirements-traceability/) and [ISO 26262 requirements traceability](https://www.parasoft.com/learning-center/iso-26262/requirements-traceability/) — bidirectional traceability mandate; derived-requirement notion; requirement↔verification-evidence linkage.
- Workspace: `adrs/drafts/research/graph-query-layer/SCHEMA.md` — existing 11 LPG node labels + 13+ edge types, UPPER_SNAKE convention, universal `source_file:source_line` provenance rule.
- Workspace: `issues/README.md` + `issues/odd-platform/PLT-065.md` — issue-draft frontmatter (`github_issue_url`/`github_issue_number`/`discovered_during`), draft→filed lifecycle as a human action.
- Workspace: `adrs/README.md` — ADR frontmatter (`id: ADR-NNN`, `status`, `superseded_by`); published to docs as source of truth.
