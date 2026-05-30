# ADR backlog — triage ledger

Triage registry for the ADR pillar: the map of reverse-engineered implicit-ADR candidates →
published Architecture Decision Records.

- **Source of candidates:** `lineage/odd-platform/implicit-adrs.md` (`ADR-CANDIDATE-NNN`, emitted
  by the adr-archaeologist — it sees one sidecar at a time, so it produces *instances*, not the
  cross-cutting constraints those instances express).
- **Published home:** `../documentation/docs/developer-guides/architecture-decision-log/`.
- **Pillar rules:** `pillars/adr/{pillar,cornerstones,canonical-homes,gates,authoring}.md`.

## The wisdom filter (re-triage 2026-05-30)

The log captures **patterns, constraints, and "big deal" decisions that shape the whole solution
and carry consequences** — NOT every developer choice. Before an `ADR-CANDIDATE` is promoted it
must pass all three:

1. **Generates a pattern** — recurs across the codebase (or *is* the rule a family of code follows).
2. **Carries a tangible consequence** — constrains operators or future maintainers; not a matter of taste.
3. **Constrains future work** — changing it is a structural decision, not a refactor.

A candidate that is a local dev choice with no broad impact and no pattern (one package layout, one
endpoint's param shape, one enum-vs-endpoints call that doesn't even recur) is **NOT an ADR** —
`close` it or `fold` it into the decision it is an instance of. **Prefer few load-bearing ADRs over
many tactical ones.** When several candidates are instances of one constraint, the *constraint* is
the ADR and the instances are its Consequences/Evidence. Drafts carry **no obligation to promote
1:1** (Cornerstone 2; `feedback_adr_wisdom_patterns_not_steps`).

### Verdict vocabulary

| Verdict | Meaning |
|---|---|
| `BACKBONE` | A load-bearing constraint/decision that should anchor the log. Author top-down. Several may not exist as candidates at all. |
| `keep` | Genuine standalone ADR (real pattern + consequence). Already published or worth its own page. |
| `fold→ADR-X` | An *instance* of a broader decision; record as a Consequence/Evidence of X, not its own page. |
| `close` | Not an ADR — tactical / matter-of-taste / no pattern. Stays in `lineage` as a candidate; never promoted. (Gap-shaped ones live in `refactoring-scopes.md`.) |

## Status legend

`published` (live + ontology edge) · `in-review` (authored, in `/review`) · `backlog` (item file ready) ·
`mapped` (triaged, not yet authored).

---

## A. BACKBONE — the load-bearing decisions (author top-down, highest priority)

These are the constraints that actually define ODD. Several have **no candidate** — the
archaeologist could not see them because they span the whole codebase. Each absorbs a cluster of
my already-published tactical ADRs as *instances* (cross-linked, not retired — those stay live).

| ADR | Status | Decision | Absorbs as instances |
|---|---|---|---|
| **ADR-0070** (new) | mapped | **Pull/Push ingestion architecture** — collectors *pull* on a cadence, push-adapters *push* on the source's cadence, both speaking one ODD Specification wire contract; the split is only at ingest, every later stage is identical | — (the defining choice; cross-link `Architecture.md`, the spec) |
| **ADR-0071** (new) | mapped | **PostgreSQL is the only runtime dependency** — no broker / ZK / Redis; cross-instance coordination, queuing, notifications, lineage, and partitioning are all built on Postgres features | `0020` (advisory-lock Slack queue), `0043` (advisory-lock WAL leader), `0044` (lazy-create-no-drop), `0028` (range partitioning), `0057` (recursive-CTE lineage), `0052` (FTS search session) |
| **ADR-0072** (new) | mapped | **Contract-first, reactive, two-language stack** — Java/Spring **WebFlux (reactive, R2DBC)** backend + React/TS SPA, with OpenAPI as the generated contract between them | `0001` (controllers over generated ifaces), `0007` (uniform Mono pipeline), `0008` (tag scoping), `0067` (reactive TX boundary) |
| **ADR-0073** (new) | mapped | **ODDRN as universal entity identity** — every entity carries a stable Open Data Discovery Resource Name; same-ODDRN = same entity across ingests/producers/time → makes idempotent ingest, cross-system lineage, and alert routing possible | — (arguably the most load-bearing data decision; cross-link `main-concepts.md#oddrn`) |
| **ADR-0003** | mapped 📌 | **Read-collaborative authorization posture** — mutations are gated in `SECURITY_RULES`; reads fall through to authenticated-only (any logged-in user reads any entity, lineage, search, activity) | `0015` (`/my*` owner-scoped reads are the *opt-in* exception to this) |
| **ADR-0074** (new) | mapped 🔒⚖ | **Pluggable auth modes — enum-by-construction** — `auth.type` selects exactly one of DISABLED / LOGIN_FORM / OAUTH2 / LDAP via mutually-exclusive `SecurityWebFilterChain` beans; DISABLED is the shipped default; S2S composes additively on top | `0029/0030/0031/0032/0033/0035/0036` (all facets of the one auth-mode architecture) |
| **ADR-0075** (new) | mapped 📌 | **Feature-gating posture** — heavyweight/outbound features ship **off** by default (require external wiring); operational-hygiene ships **on** by default (bounded growth) | `0004/0019/0040` (off) + `0046` (the deliberate on inversion) |
| **ADR-0058** | mapped | **Soft-delete as the deletion model** — `DELETED` is a status, not a row removal; physical purge deferred to housekeeping TTL; closed status enum with `isSwitchable` | `0055` (detail read surfaces soft-deleted via `includeDeleted`) |

**Already-published genuine backbone (keep, no change):** ADR-0001, ADR-0002 (centralised authz),
ADR-0012 (attachment storage / LSN-001), ADR-0018 (fail-fast config). These pass the filter cleanly.

---

## B. KEEP — genuine standalone ADRs still to author (real pattern + consequence)

| ADR | from | Status | Flags | Decision |
|---|---|---|---|---|
| ADR-0050 | -050 | mapped | — | Read-discovery + write-enforcement share one permission evaluation graph (no UI-only cache) |
| ADR-0053 | -053 | mapped | — | Policy JSON-Schema validation at write-time (persisted text schema-valid by construction) |
| ADR-0049 | -049 | mapped | — | Owner-directory CRUD is identity-decoupled (Owner ≠ user; association is a separate flow) |
| ADR-0017 | -017 | mapped | 🔒 | Collector token model: in-place rotation, plaintext-on-rotate / masked-on-read, plaintext-equality auth |
| ADR-0027 | -027 | mapped | 🔒 | Ingestion-token verification is opt-in (`auth.ingestion.filter.enabled` default false) |
| ADR-0006 | -006 | mapped | 🔒 ULB | AlertManager webhook auth is network-layer-delegated (no app-layer auth) |
| ADR-0063 | -063 | mapped | 🔒📌 | `description`/`internal_name` stored as raw Markdown; UI is the sole renderer (trust-boundary placement) |
| ADR-0005 | -005 | mapped | — | GenAI is a thin proxy; prompt/RAG/output-safety is the operator's external-service responsibility |
| ADR-0026 | -026 | mapped | — | Metric-storage backend is boot-selected (`INTERNAL_POSTGRES` default-on vs `PROMETHEUS`) |

The 🔒 set still needs your descriptive-vs-disclosure steer at authoring time (decision on the page;
gap in `refactoring-scopes`). They are real ADRs; the flag governs *how* they're written, not *whether*.

---

## C. FOLD — instances of a broader decision (record as Consequence/Evidence, don't give a page)

| Candidate | Fold into | Why it's an instance, not an ADR |
|---|---|---|
| 0015 owner-scoped `/my*` | ADR-0003 | the opt-in exception to read-collaborative |
| 0020, 0043, 0044, 0028, 0057, 0052 | ADR-0071 | all are "use a Postgres feature instead of a dependency" |
| 0007, 0008, 0067 | ADR-0072 | mechanisms of the contract-first reactive stack |
| 0029–0036 (auth facets) | ADR-0074 | facets of the one auth-mode architecture |
| 0019, 0040, 0046 | ADR-0075 | instances of the feature-gating posture |
| 0055 soft-delete-surfaced-by-read | ADR-0058 | a read-path consequence of soft-delete-as-model |
| 0041, 0042 | ADR-0040/notifications | per-channel-presence + fail-soft are notification-subsystem mechanics, not separate constraints |
| 0054, 0056, 0066 | ADR-0058 / a "centerpiece read" note | read-path mechanics (view_count, Mono.zip, popular ranking) — at most one "centerpiece read architecture" ADR, likely just consequences |
| 0024, 0025, 0047, 0037, 0048 | ADR-0074 / close | config-binding idioms within auth; tactical |

---

## D. CLOSE — not ADRs (tactical / matter-of-taste / no pattern; stay candidates only)

These are developer choices with no broad impact or no recurring pattern — the wisdom filter rejects
them. They remain in `lineage/implicit-adrs.md` as candidates; they are **not** promoted.

| Candidate | Why not an ADR |
|---|---|
| 0022 *(already published — leave live, do not author more like it)* | activity view-modes as one enum param — generates **no** pattern (the sibling data-entity reads use the opposite shape); matter of taste |
| 0021 *(already published — leave live)* | cursor-vs-offset on activity — weak pattern, tactical |
| 0009, 0010, 0011 (i18n) | standard i18next usage; eager-load + localStorage + natural-keys are library defaults, no ODD-specific constraint |
| 0033 CSRF-disabled | a one-line convention; fold a sentence into ADR-0074, not its own page |
| 0038 LDAP `containsIgnoreCase` | one matcher's case-handling; tactical |
| 0039 LDAP fail-loud/tolerate-size | LdapTemplate flag tuning; tactical |
| 0059 service-layer `@ReactiveTransactional` | standard Spring practice; the *asymmetry* (0067) is the only mildly-interesting angle, folded to 0072 |
| 0060 programmatic activity emission for bulk | AOP-vs-programmatic is an implementation choice, no operator consequence |
| 0061 ingestion controller-side validation | "schema describes shape, code enforces semantics" is just ADR-0001 applied |
| 0062 field-level write permissions | an instance of the permission model (ADR-0002 / 0050); not its own constraint |
| 0064 term-link coexistence PK | schema detail; tactical |
| 0065 tag auto-create-on-miss | one endpoint's convenience behaviour; spec-acknowledged but no pattern |
| 0023 chunked-upload `uploadId` | session-key choice; tactical |
| 0013 no-contract security-block | ⚖ borderline + likely migration leftover → not a deliberate decision |
| 0014 AlertManager hand-coded | the *mechanism* of ADR-0006 / the ADR-0001 exception already documented; fold, don't author |
| 0016 max-file-size not re-validated | gap-shaped → `refactoring-scopes`, not an ADR |

---

## Published ADRs (16, live on docs main) — leave as-is

`0001 0002 0004 0007 0008 0012 0018 0019 0020 0021 0022 0040 0041 0042 0043 0044` are on docs
`main` (16); batch-4 `0028/0045/0046` are pushed and pending merge. Per the maintainer (2026-05-30): **do not retire/merge
published tactical ADRs** — finer-grained than ideal but not wrong, and churning live URLs costs
external bookmarks for little gain (DOC-138 lesson). The wisdom filter applies **going forward**.
The backbone ADRs (section A) will cross-link the published instances rather than supersede them.

---

## Authoring order (post-re-triage)

1. **Backbone, top-down (section A):** ADR-0073 (ODDRN) · ADR-0071 (Postgres-only-dependency) ·
   ADR-0070 (Pull/Push) · ADR-0072 (contract-first reactive stack) · ADR-0003 (read-collaborative)
   · ADR-0058 (soft-delete model). These are the high-value core; each cross-links the published
   instances. (0070–0073 are new ids beyond the candidate range; record `promoted_from: none
   (top-down backbone)` in frontmatter.)
2. **Then KEEP (section B)** by value: 0050, 0053, 0049, then the 🔒 set (0017/0027/0006/0063)
   with maintainer framing, then 0005/0026.
3. **Auth backbone ADR-0074 + feature-gating ADR-0075** — fold their instance-candidates in.
4. Section C is recorded as folds (no pages); section D is closed (no pages).

**Net effect of the filter:** ~48 mapped candidates → ~8 backbone + ~9 keep ADRs to author;
the rest fold or close. Few load-bearing ADRs over many tactical ones.
