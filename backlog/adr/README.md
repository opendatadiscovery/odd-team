# ADR backlog — triage ledger

Triage registry for the ADR pillar: the full map of reverse-engineered implicit-ADR
candidates → published Architecture Decision Records. This is the planning surface;
each ratified row becomes a `backlog/adr/ADR-NNNN.md` work item that authors one page
under `docs/developer-guides/architecture-decision-log/`.

- **Source of candidates:** `lineage/odd-platform/implicit-adrs.md` (`ADR-CANDIDATE-NNN`,
  emitted by the adr-archaeologist; each already wisdom-tested + classified).
- **Published home:** `../documentation/docs/developer-guides/architecture-decision-log/`.
- **Pillar rules:** `pillars/adr/{pillar,cornerstones,canonical-homes,gates,authoring}.md`.

## ID convention

`ADR-NNNN` is assigned at triage with **candidate-number parity**: `ADR-00NN` promotes
`ADR-CANDIDATE-0NN` (e.g. `ADR-0002` ← `ADR-CANDIDATE-002`). Parity keeps the trail
machine-checkable; if a cluster is later merged into one page, the absorbed ids get
`status: merged-into ADR-XXXX` rather than being reused. Publishing is **maintainer-ratified
at PR-merge** (Cornerstone 5) — triage never auto-publishes.

## Status legend

| Status | Meaning |
|---|---|
| `published` | live on docs site + ontology edge recorded |
| `in-review` | item exists, authored, in `/review` |
| `backlog` | item file materialized, ready for `/implement` |
| `mapped` | triaged here; item file not yet materialized (author on a later pass) |

## Ratification / framing flags

- ⚖ **RATIFY** — borderline intent; the maintainer must confirm the decision was *deliberate*
  (not a migration leftover) before publishing.
- 🔒 **FRAME** — security-sensitive; publish **descriptively**, no exploit disclosure (Gate A3).
  The decision is ADR-worthy; the *gap-shaped* consequence is already tracked in
  `refactoring-scopes.md` (`REFACTOR-NNN`) and must not be narrated on the public page.
- 📌 **CONSEQUENCE** — surface a reader-facing consequence in the Consequences section.

## Status summary

- **67 candidates** total. Severity (derived per-entry, not the file's stale frontmatter):
  **11 HIGH / 51 MEDIUM / 5 LOW**. Classification: **65 promote + 2 unique-load-bearing**
  (`-006`, `-014`); zero drift / extend-existing → every candidate is a net-new ADR.
- `ADR-0001` published (pilot), currently `in-review` for the two-webhook-exceptions fix.
- This pass materializes **6 backbone items** (★); the other 60 are `mapped`.

## The ledger

### Backbone — author first (★ = materialized this pass)

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0001 | -001 | high | small | in-review | — | Contract-first HTTP layer: controllers implement OpenAPI-generated interfaces |
| ★ ADR-0002 | -002 | high | small | in-review | — | Centralised path-matcher authorization (no `@PreAuthorize`) |
| ★ ADR-0007 | -007 | high | small | in-review | — | Uniform `Mono<ResponseEntity<T>>` controller pipeline |
| ★ ADR-0008 | -008 | medium | small | in-review | — | OpenAPI tags scope the generated `*Api` interfaces (single-tag-per-op; 30/33 single-prefix, 3 multi-root) |
| ★ ADR-0018 | -018 | high | small | in-review | — | Outbound-integration config is fail-fast at boot |
| ★ ADR-0012 | -012 | high | small | in-review | 📌 | Attachment storage backend selected at boot via `@ConditionalOnProperty` (`LOCAL` default) |
| ★ ADR-0004 | -004 | high | small | in-review | 🔒📌 | GenAI ships disabled-by-default; runtime-guard (not boot-gate); minimal enabled-defaults |
| ADR-0003 | -003 | high | small | mapped | 📌 | GET reads outside `SECURITY_RULES` — read-collaborative, authenticated-only |

### Authorization & auth-mode family

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0029 | -029 | high | small | mapped | 🔒⚖ | `auth.type=DISABLED` is the shipped default (opt-out security) |
| ADR-0030 | -030 | medium | small | mapped | — | Each auth mode wired by an explicit `SecurityWebFilterChain` bean (enum-by-construction) |
| ADR-0031 | -031 | high | small | mapped | 🔒 | LOGIN_FORM is a dev/demo path (in-memory user, all-ADMIN) |
| ADR-0032 | -032 | high | medium | mapped | 🔒 | S2S auth composes additively with interactive modes (X-API-Key ADMIN across `/**`) |
| ADR-0033 | -033 | low | small | mapped | ⚖ | CSRF unconditionally disabled across all four auth modes |
| ADR-0034 | -034 | medium | medium | mapped | — | OAuth2 provider quirks via URL-mutation + handler-chain strategy |
| ADR-0035 | -035 | medium | small | mapped | — | OAuth2 `GrantedAuthoritiesMapper` is fail-closed (defaults to USER) |
| ADR-0036 | -036 | medium | small | mapped | — | Authorization framework is mode-agnostic (same chain across OAUTH2/LDAP) |
| ADR-0037 | -037 | medium | small | mapped | — | LDAP supports Active Directory as a dedicated provider branch |
| ADR-0038 | -038 | low | small | mapped | 🔒 | LDAP admin-group match is case-insensitive substring containment |
| ADR-0039 | -039 | medium | small | mapped | — | LDAP query posture: fail-loud on inconsistency, tolerate size-limit |
| ADR-0024 | -024 | medium | small | mapped | — | AppInfo publishes active auth-mode (reporter-not-reactor consumer) |
| ADR-0025 | -025 | medium | small | mapped | — | `AnyNestedCondition` idiom for OR-ing `@ConditionalOnProperty` |
| ADR-0047 | -047 | medium | small | mapped | — | OAuth2 clients keyed by `Map<String,OAuth2Provider>` (registrationId = URL segment) |

### RBAC / permission / policy

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0049 | -049 | medium | small | mapped | — | Owner-directory CRUD is identity-decoupled |
| ADR-0050 | -050 | medium | medium | mapped | — | Read-discovery + write-enforcement share one permission evaluation graph |
| ADR-0051 | -051 | medium | small | mapped | — | Resource-type↔context coupling at `PolicyTypeDto.hasContext` enum field |
| ADR-0053 | -053 | medium | small | mapped | — | Policy JSON-Schema validation at write-time (schema-valid by construction) |
| ADR-0062 | -062 | medium | small | mapped | — | Field-level data-entity write permissions (fine-grained RBAC) |

### Data-entity reads / writes / lineage / search

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0052 | -052 | medium | small | mapped | — | Search is a server-side stateful session (UUID-keyed `search_facets`) |
| ADR-0054 | -054 | medium | small | mapped | — | Data-entity detail read is read-as-write (increments `view_count`) |
| ADR-0055 | -055 | medium | small | mapped | — | Soft-deleted entities surfaced by detail read (`includeDeleted(true)` + `isStale`) |
| ADR-0056 | -056 | medium | medium | mapped | — | Centerpiece reads use multi-stage `Mono.zip` enrichment (not one fat JOIN) |
| ADR-0057 | -057 | medium | medium | mapped | — | Lineage is a single recursive-CTE walk + client-driven progressive expansion |
| ADR-0058 | -058 | medium | small | mapped | — | Data-entity status is a closed enum + soft-delete-as-deletion-model |
| ADR-0059 | -059 | medium | small | mapped | — | Per-data-entity writes use a service-layer `@ReactiveTransactional` boundary |
| ADR-0060 | -060 | medium | small | mapped | — | Bulk mutations use programmatic activity-event emission (not `@ActivityLog` AOP) |
| ADR-0061 | -061 | medium | small | mapped | — | Ingestion endpoint: OpenAPI-contract path + controller-side semantic validation |
| ADR-0063 | -063 | medium | small | mapped | 🔒📌 | `description`/`internal_name` stored as raw Markdown; UI is sole renderer/sanitiser |
| ADR-0066 | -066 | medium | small | mapped | — | Popular ranking is single-signal `view_count DESC` |
| ADR-0067 | -067 | medium | small | mapped | — | Transactional-boundary asymmetry (reads outside TX, writes inside) |
| ADR-0064 | -064 | low | small | mapped | — | Coexisting manual + description term-links (`is_description_link` in PK) |
| ADR-0065 | -065 | medium | small | mapped | — | Tag auto-create-on-miss (intentional, spec-acknowledged) |
| ADR-0015 | -015 | low | small | mapped | — | Owner-scoped reads are separate first-class `/my*` endpoints |

### Notifications / Data Collaboration / Slack

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0019 | -019 | medium | small | in-review | — | Data Collaboration ships disabled-by-default (`@ConditionalOnDataCollaboration`) |
| ADR-0020 | -020 | medium | medium | in-review | — | Slack delivery decoupled via 202 + queue + Postgres advisory-lock |
| ADR-0040 | -040 | medium | small | in-review | — | Notifications ship off-by-default via single `Condition` + meta-annotation |
| ADR-0041 | -041 | medium | small | in-review | — | Each notification channel activated by presence of its URL/sender key |
| ADR-0042 | -042 | medium | small | in-review | 📌 | Notification fan-out is fail-soft per channel |
| ADR-0043 | -043 | medium | medium | in-review | — | Notifications WAL subscriber is leader-elected single-thread (advisory-lock 100) |
| ADR-0044 | -044 | medium | small | in-review | — | Notifications use lazy-create-no-drop for Postgres replication artefacts |

### Activity / partition / housekeeping

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0021 | -021 | medium | small | in-review | — | Activity streams use cursor pagination (no offset/limit) |
| ADR-0022 | -022 | medium | small | in-review | — | Activity view-modes are one `type` enum parameter, not separate endpoints |
| ADR-0028 | -028 | medium | medium | in-review | — | Range-partition lifecycle: 2× overlap + dual-trigger (boot advisory-lock 90 + nightly ShedLock cron) + List-injection + continue-on-failure |
| ADR-0045 | -045 | medium | small | in-review | — | Housekeeping is a separate subsystem from partition management |
| ADR-0046 | -046 | medium | small | in-review | 📌 | Housekeeping is opt-OUT (ships `enabled: true`) |

### Config idioms / metrics / collector / i18n / attachment / GenAI

| ADR | from | Pri | Effort | Status | Flags | Decision |
|---|---|---|---|---|---|---|
| ADR-0005 | -005 | medium | small | mapped | — | GenAI is a thin proxy; prompt/RAG is the operator's responsibility |
| ADR-0006 | -006 | high | small | mapped | 🔒 ULB | AlertManager webhook auth is network-layer-delegated (no app-layer auth) |
| ADR-0014 | -014 | medium | small | mapped | ULB | AlertManager webhook receiver is hand-coded (not OpenAPI-generated) |
| ADR-0009 | -009 | medium | small | mapped | — | i18n bundle is eagerly loaded at app start (all locales in main bundle) |
| ADR-0010 | -010 | medium | small | mapped | — | Language preference persisted client-side only (`localStorage`) |
| ADR-0011 | -011 | medium | small | mapped | — | Translation keys are literal English source phrases (natural-key i18next) |
| ADR-0013 | -013 | medium | small | mapped | ⚖ | No-contract security-block (deliberate division OR migration leftover) |
| ADR-0016 | -016 | low | small | mapped | 📌 | `attachment.max-file-size` exposed to UI but not re-validated server-side |
| ADR-0023 | -023 | medium | small | mapped | — | Chunked-upload session identity is the server-issued `uploadId` |
| ADR-0017 | -017 | high | small | mapped | 🔒 | Collector tokens: in-place rotation, plaintext-on-rotate, masked-on-read, plaintext-equality auth |
| ADR-0027 | -027 | high | small | mapped | 🔒 | Ingestion-token verification is opt-in (`auth.ingestion.filter.enabled`, default false) |
| ADR-0026 | -026 | medium | small | mapped | — | Metric-storage backend via mirrored `@ConditionalOnProperty` (INTERNAL_POSTGRES default-on) |
| ADR-0048 | -048 | medium | small | mapped | — | `@ConfigurationProperties` validators are narrow-scope-by-design (structural faults only) |

## Consolidation clusters (resolve at authoring time)

The deep read at `/implement` time may merge facets of one decision into a single page.
Candidate clusters (do **not** pre-merge — the per-candidate Evidence must be read first):

- **Auth-mode family** — `0029/0030/0031/0032/0033/0034/0035/0036/0037/0038/0039/0024/0025/0047`
  could collapse to a smaller set (e.g. one "Pluggable auth modes" ADR + per-mode sub-decisions).
- **Notifications** — `0040/0041/0042/0043/0044` (one "Notifications subsystem architecture" ADR).
- **i18n** — `0009/0010/0011` (one "Frontend i18n strategy" ADR).
- **DataEntity reads** — `0054/0055/0056/0057` (one "Centerpiece read architecture" ADR).
- **Partition/housekeeping** — `0028/0045/0046` (one "Postgres lifecycle jobs" ADR).
- **AlertManager** — `0006/0014` are the rule-and-its-exception pair (ULB); likely one page.

If a cluster merges, keep the lowest id as the page and mark the rest `merged-into`.

## Ratification required before publish

- ⚖ **RATIFY (confirm intent):** `ADR-0013`, `ADR-0029`, `ADR-0033`.
- 🔒 **FRAME (descriptive, no exploit disclosure):** `ADR-0004`, `ADR-0006`, `ADR-0017`,
  `ADR-0027`, `ADR-0029`, `ADR-0031`, `ADR-0032`, `ADR-0038`, `ADR-0063`. The gap-shaped
  consequences live in `refactoring-scopes.md` (`REFACTOR-NNN`) — the public ADR states the
  *decision*, never the exploit.

## Recommended authoring order

1. **Batch 1 (this pass, materialized):** `0002, 0007, 0008, 0018, 0012, 0004` — backbone,
   high sidecar-support, low disclosure risk; the worked examples the rest follow.
2. **Batch 2:** `0003` (read-collaborative — careful 📌 framing), then the authorization
   family `0029/0030/0031/0032` (🔒 framing pass with the maintainer).
3. **Batch 3+:** remaining `mapped` rows by priority, consolidating clusters as the deep
   reads warrant.
