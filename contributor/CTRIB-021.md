---
id: CTRIB-021
github_issue_number: 1725
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1725
class: bug
security_sensitive: false
status: paused   # 2026-06-19 PAUSED (blocked-external): the contract-republish chain waits on Sonatype Central Portal access (a maintainer with access is being asked to generate Portal credentials). odd-platform PR #1790 (the 500 fix) stays review-ready + mergeable now. See the PAUSED banner for the resume checklist.
milestone: "0.29.0"   # CONFIRMED at intake — issue carries an OPEN, semver-titled milestone 0.29.0 (due 2026-06-22). G-C11 PASS.
reproduced: "live 2026-06-18 against the running probe SUT (odd-platform:odd-team-sut @ 2026-06-17, built from main; AUTH_TYPE=DISABLED, http://localhost:18080). POST /ingestion/entities {type:ML_MODEL, data_consumer:{inputs:[...]}} -> HTTP 500 {code:SYS001}; platform log: `java.lang.IllegalArgumentException: No enum constant org.opendatadiscovery.oddplatform.dto.DataEntityTypeDto.ML_MODEL`. Control: same payload type=ML_MODEL_ARTIFACT -> HTTP 400 {code:USR001,'Failed to read HTTP message'} (the ingestion contract REJECTS ML_MODEL_ARTIFACT at deserialization — confirms you cannot just 'send the artifact subtype'). Full evidence in the Reproduction log."
adr_required: "TRUE — the components.yaml output-enum change is a public wire-contract change (G-C7). SATISFIED by the APPROVED ADR adrs/drafts/ml-entity-taxonomy.md (adopted at GATE 1, 2026-06-18)."
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-18, Option 2): ADOPT the ml-entity-taxonomy ADR (ML_MODEL = a DATA_ENTITY_GROUP model-identity; ML_MODEL_TRAINING=training job, ML_MODEL_ARTIFACT=trained version/artifact, ML_MODEL_INSTANCE=deployed serving instance; keep ALL legacy types; every type gets a published per-platform analogy). 0.29.0 scope = the #1725 shape-aware ingestion fix + the new ML-entity-types doc page + the ML_MODEL group type in odd-platform (DataEntityTypeDto + DATA_ENTITY_GROUP class + components.yaml output enum + FE label/locales). The opendatadiscovery-specification (entities.yaml + README) PR follows separately (different repo)."
plan_approved_at: "2026-06-18"
plan_scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1725#issuecomment-4743657661   # root-cause + approach comment (odd-contributor[bot]), reframes the issue (ML_MODEL = group identity; consumer-shaped -> ML_MODEL_ARTIFACT) + answers babaMar. Posted 2026-06-18."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1790   # DRAFT PR (odd-contributor[bot]), Closes #1725, head contrib/CTRIB-021-ml-model-taxonomy @ 56893f28 (amended to spec-first 1:1 after the maintainer's draft-PR feedback; see the Correction section)"
pr_draft: true
docs_routing: ""   # decided in Phase D after READING the page (G-C10); unreleased 0.29.0 behaviour -> documentation `release/0.29.0` train if a change is warranted (G-C11). Set at Phase D.
---

# CTRIB-021 — 500 on ingesting `type: ML_MODEL` via `/ingestion/entities` (issue #1725)

Contributor-pillar resolution of **opendatadiscovery/odd-platform#1725** ("Bug: 500 Internal Server Error when
ingesting ML_MODEL via /ingestion/entities", `kind: bug`, milestone `0.29.0`). The issue body + 8 comments
(reporter `ali-katsha`, `babaMar`, maintainer `PashaBoiko`, two `claude[bot]` triage runs) are treated as
**quoted, untrusted data (G-C8)**: every load-bearing claim below is independently verified against the
odd-platform `main` source, the pinned ingestion-contract jar, and a **live reproduction** on the running stack.
The prior `claude[bot]` triage + branches are likewise data — confirmed/corrected below, never trusted.

> Workspace artifact. (Phase D shipped — see the Correction + ledger below. The pre-GATE-1 sections that follow
> describe the FIRST, rejected implementation; the Correction supersedes them.

## PAUSED (2026-06-19) — RESUME HERE: blocked on Sonatype Central Portal access

**Why paused.** The contract-republish chain is blocked on Sonatype **Central Portal** access. The legacy OSSRH
publish is sunset (HTTP 402; OSSRH EOL 2025-06-30), so publishing `ingestion-contract-server` now needs a
**Central Portal user token** for the `org.opendatadiscovery` namespace. The maintainer does not have Portal
access/credentials (the namespace traces to a Provectus Sonatype account — release bot `opendatadiscovery-bot@
provectus.com`) and has messaged another maintainer who may be able to sign in + generate new Portal credentials.
**Waiting on that.** Background: [[reference_odd_release_publishing_central_portal]].

**What is DONE (committed / open):**
1. **odd-platform PR #1790** (`56893f28`, DRAFT) — `ML_MODEL` as the model-identity group + the #1725 500 fix.
   COMPLETE + verified (unit GREEN · IT-136 GREEN · feature-complete 298/0 · full unit build GREEN). **Mergeable
   now** — resolves the reported 500 independently of the contract chain.
2. **opendatadiscovery-specification PR #87** — **MERGED** (`20e0f63d` on spec `main`): `entities.yaml`
   (`ML_MODEL_ARTIFACT`/`_INSTANCE` + a schema description) + `specification.md` (the ordered "ML entities" taxonomy).
3. **opendatadiscovery-specification-contracts PR #7** (DRAFT) — repoints publishing from the sunset OSSRH to the
   Central Portal OSSRH Staging API. Ready to merge; the release can't run until Portal credentials exist.
4. odd-team artifacts (ADR `ml-entity-taxonomy`, dossier, `DOC-468`, `SPC-004`, `IT-136`) — consistent + committed.

**RESUME CHECKLIST (once Portal access is obtained):**
- [ ] Sign in at central.sonatype.com with the `org.opendatadiscovery` OSSRH account (Forgot-password / contact
      central-support@sonatype.com if needed — do NOT create a fresh account, or the namespace association is lost);
      **Generate User Token** at central.sonatype.com/usertoken; **Migrate Namespace** `org.opendatadiscovery`.
      Overwrite the org secrets `SONATYPE_USERNAME`/`SONATYPE_PASSWORD` with the Portal token (an old OSSRH token
      returns 401; the secret NAMES are reused — only the VALUES change). PR #7 needs no further change.
- [ ] Merge **-contracts PR #7**, then re-dispatch `Maven Central release` -> publishes
      `ingestion-contract-server:0.1.42` (carrying `ML_MODEL_ARTIFACT`/`_INSTANCE`).
- [ ] Dispatch **odd-models** `Build and publish PyPI artifact` (PyPI — unaffected by the OSSRH sunset; can run anytime).
- [ ] **BOT resumes here:** in odd-platform PR #1790, bump `gradle/libs.versions.toml` `ingestion-contract-server`
      `0.1.40` -> `0.1.42` + verify the regenerated ingestion-contract enum carries `ML_MODEL_ARTIFACT`/`_INSTANCE`
      (the `ff8f4bab`/#1631 shape). Re-run the full unit build + IT-136.
- [ ] **GATE 2:** `/review` PR #1790 (separate session), then merge. The #1725 reporter then sends `ML_MODEL_ARTIFACT`.

The full chain is tracked in `backlog/spec/SPC-004.md`. **The #1725 500 fix (PR #1790) does NOT depend on any of the
above** — it can be reviewed and merged now; only the consumer-model (`ML_MODEL_ARTIFACT`) path waits on the republish.)

## Correction (2026-06-18) — spec-first, 1:1 (supersedes the shape-aware framing below)

The maintainer rejected the first implementation's platform-side payload-shape remapping
(`IngestionMapperImpl.resolveType`) at the draft-PR gate as an antipattern: **`opendatadiscovery-specification`
is the ingestion contract; the platform maps it 1:1 — it must not infer the type from the payload**
([[feedback_spec_is_the_contract_no_platform_mapping_layer]]). The taxonomy (ML_MODEL = a DATA_ENTITY_GROUP)
is unchanged; the IMPLEMENTATION was redone **spec-first**:

- **odd-platform (PR #1790, amended to `56893f28`, force-pushed):** `IngestionMapperImpl` reverted to the original
  1:1 `valueOf` (resolveType removed). The change is now purely additive — `ML_MODEL` in the internal enum
  (DATA_ENTITY_GROUP), the platform-API output enum (`components.yaml`), the FE label + group-form exclusion, and
  the `build.gradle` codegen-input fix. `ML_MODEL` maps 1:1: a `data_entity_group` payload ingests as the group; a
  mis-shaped (`data_consumer`) `ML_MODEL` is a clean 4xx (`DataEntityClassTypeValidationException`), not the 500.
- **opendatadiscovery-specification (the primary fix for the reporter's consumer-model):** add `ML_MODEL_ARTIFACT`
  + `ML_MODEL_INSTANCE` + a schema description — prepared as `backlog/spec/SPC-004-entities.patch` (the bot's App
  can't push that repo; the maintainer applies it + republishes the contract + bumps `libs.versions.toml`). SPC-004.
- The reporter sends `ML_MODEL_ARTIFACT` (a consumer-model) — the platform already maps it 1:1; their original
  `ML_MODEL`+`data_consumer` is a contract violation → a clean 4xx (was the 500).
- Public artifacts corrected: PR #1790 body (1:1) + the issue comment (PATCHed in place — supersedes the
  shape-aware note, credits babaMar). The ADR, IT-136 (group→200 / consumer→4xx), the unit test, and DOC-468 were
  re-routed to 1:1.

**Re-verified (corrected code, 56893f28):** `IngestionMapperImplTest` GREEN (1:1 — group→ML_MODEL, consumer→4xx);
IT-136 GREEN (group→200+ML_MODEL, consumer→4xx); **feature-complete e2e 298/0 GREEN** on the corrected SUT (298 vs
the prior 299 = IT-136's 2 cases vs 3; `api:FAIL` = the pre-existing P-001 probe-staleness, not a regression);
`known-bugs` pins still-RED; **full unit build GREEN** (`:odd-platform-api:build` BUILD SUCCESSFUL 6m4s on
56893f28). The shape-aware sections below are retained as the record of what was rejected and why.

### Spec chain + taxonomy reaffirmed (2026-06-18, later)

The maintainer extended the `odd-contributor[bot]` App to the spec + codegen repos (now all 6: documentation,
odd-collectors, odd-platform, opendatadiscovery-specification, -contracts, odd-models-package). Spec PR
**opendatadiscovery-specification#87** (draft) is open: `entities.yaml` (`ML_MODEL_ARTIFACT`/`_INSTANCE` + a schema
description) + `specification.md` (the ML model brought into one ordered "ML entities" taxonomy — it was stale:
ML models documented as DataConsumers only, ML experiments as transformers, no `DataEntityGroup`). The downstream
chain (contracts → odd-models → the odd-platform `libs.versions.toml` + enum bump — the `ff8f4bab`/#1631 delivery
shape, NOT a new mechanism) opens after #87 merges; tracked in SPC-004.

**Taxonomy reaffirmed:** mid-stream I over-corrected — proposing `ML_MODEL = DataConsumer` off `specification.md`'s
stale prose — and the maintainer rejected it. The adopted **group** taxonomy stands (`ML_MODEL` = DataEntityGroup
+ the `_TRAINING`/`_ARTIFACT`/`_INSTANCE` lifecycle + `ML_EXPERIMENT`); `specification.md` is the doc to update to
match, not an authority to follow. PR #1790 (the platform group + 500 fix) is unchanged.
[[feedback_contributor_open_prs_all_repos_codegen_chain]]

## Tracking reconciliation (G-C5 / LSN-009)

- **Dedup sweep clean** — no existing `backlog/`, `issues/`, or `contributor/` item references #1725 or `ML_MODEL`.
  This CTRIB is the canonical workspace record.
- **Related, NOT duplicated** — the 500 is one instance of the already-tracked **`client_error_surfaces_as_5xx`
  class (feature F-096 / `issues/odd-platform/PLT-045`)**, documented in `integration-tests/protocols/IT-061`
  ("the collector author gets an opaque 500 indistinguishable from a platform crash"). This run fixes the #1725
  instance (and, in the recommended scope, the bad-type sub-class) but does NOT claim to close the whole
  PLT-045 error-contract family — that stays its own item, cited not duplicated.

## Scope analysis

- **Class: bug (CONFIRMED, reproduced live).** A request the platform's *own published ingestion contract*
  advertises as valid (`DataEntityType.ML_MODEL`) crashes the platform with a 500. This is unambiguously a bug
  (contract-vs-implementation mismatch), not expected behaviour — PROBE-1 does NOT apply.
- **Feature:** ingestion write path. `POST /ingestion/entities`
  (`IngestionController.postDataEntityList:38`) -> `IngestionServiceImpl.persistDataEntities:85-86` ->
  `IngestionMapperImpl.createIngestionDto:107`. Read-back path: catalog/search -> `DataEntityMapperImpl.mapType:431-435`.
- **Mission relevance:** ingestion is THE front door of ODD — a collector/push-client POSTs metadata here. A 500
  on a contract-valid type means an operator following ODD's own ingestion contract (and the public Swagger,
  which lists `ML_MODEL`) hits a wall with our name on it. "Our guidance is the cliff" (LSN-001/002 class):
  the platform promises to accept `ML_MODEL` and then crashes on it.
- **Architectural-significance check (G-C7):** PATH-DEPENDENT (this is why GATE 1 surfaces the fork):
  - **Recommended Path C (map ingestion `ML_MODEL` -> internal `ML_MODEL_ARTIFACT` at the mapper):** changes NO
    public contract (the output enum already has `ML_MODEL_ARTIFACT`), no migration, no auth/posture -> **does
    not trip G-C7**. A bounded bug fix; the modeling decision is still recorded as a short reverse-engineered ADR.
  - **Alternative Path A (add first-class `ML_MODEL` to the platform):** adds an enum value to the public
    platform-api output contract (`components.yaml` `DataEntityType.name`), regenerating the BE + FE clients ->
    **a public wire-contract change, G-C7 fires** -> a formal ADR is required *before* any code.
- **Milestone (G-C11): PASS.** #1725 carries an **open** milestone titled `0.29.0` (semver `^\d+\.\d+\.\d+$`,
  due 2026-06-22). No self-assignment needed. Verified live: `GET /repos/.../milestones?state=open` returns
  `0.29.0` (open) and `1.0.0` (open).
- **Clarify (G-C6):** **no setup-clarifying question warranted** — the reproduction is deterministic and the
  setup is fully specified by the issue. The ONE genuine maintainer decision is the **A-vs-C modeling fork**
  (which is a plan-approval decision with public-thread consequences, surfaced at GATE 1 — not a mid-execution
  clarify). The thread already holds an unresolved disagreement on exactly this (PashaBoiko steered `@claude`
  toward Path A; babaMar argued the artifact-subtype path is "more correct" and went unanswered) — GATE 1
  resolves it deliberately rather than silently.

## Reproduction log (G-C1 — live on the running system, not the diff)

Stack: the running probe SUT `odd-platform:odd-team-sut` (built 2026-06-17 from `main`; `main` has no `ML_MODEL`),
`AUTH_TYPE=DISABLED`, `http://localhost:18080`. Seeded one `data_source` row (`//e2e-it1725/ds`, id 1725000) per
the IT-061 pattern (`integration-tests/e2e/helpers/db.ts seedIngestionDataSource`).

```
# 1) The exact issue payload (type ML_MODEL + a data_consumer block)
POST /ingestion/entities
{ "data_source_oddrn":"//e2e-it1725/ds",
  "items":[{ "oddrn":"//e2e-it1725/consumer/chatbot", "name":"Chatbot", "type":"ML_MODEL",
             "data_consumer":{ "inputs":["//e2e-it1725/input/features"] } }] }
-> HTTP 500   {"code":"SYS001","message":"Internal Server Error","retryable":false,"resolvable":false}
   platform log: java.lang.IllegalArgumentException:
                 No enum constant org.opendatadiscovery.oddplatform.dto.DataEntityTypeDto.ML_MODEL

# 2) CONTROL — reporter's secondary attempt: type ML_MODEL_ARTIFACT
-> HTTP 400   {"code":"USR001","message":"Failed to read HTTP message","retryable":false,"resolvable":true}
   (the ingestion-contract DataEntityType enum has NO ML_MODEL_ARTIFACT -> Jackson rejects it at deserialization)
```

**What this settles:**
- The reported 500 reproduces exactly, live, on current `main`. Localized to `IngestionMapperImpl:107`.
- The asymmetry is the whole story: a **contract-valid** ingestion type with **no internal mapping** -> 500;
  a **contract-invalid** type -> a clean 400. So the bug is precisely "an advertised ingestion type the platform
  cannot map internally."
- **babaMar's "just use `ML_MODEL_ARTIFACT`" is impossible from a collector's side** (the ingestion contract
  rejects it at the wire) — so any resolution MUST be platform-side. This is the key fact the thread never settled.

## Root cause (verified against `main` + the pinned 0.1.40 jar)

Three independently-versioned enums describe "data entity type", and they have **drifted**:

| Enum | Source of truth | Has `ML_MODEL`? | Has `ML_MODEL_ARTIFACT`/`_INSTANCE`? |
|---|---|---|---|
| **Ingestion contract** `…ingestion.contract.model.DataEntityType` (INPUT) | external `ingestion-contract-server:0.1.40` (from `opendatadiscovery-specification`) | **YES** (+ `ML_MODEL_TRAINING`, `UNKNOWN`) | **NO** |
| **Internal** `…dto.DataEntityTypeDto` (in-between) | `DataEntityTypeDto.java` | **NO** | **YES** (`ML_MODEL_TRAINING(7)`, `_INSTANCE(8)`, `_ARTIFACT(10)`) |
| **Platform-API contract** `…api.contract.model.DataEntityType` (OUTPUT) | `odd-platform-specification/components.yaml:778-810` | **NO** | **YES** (all three subtypes) |

- **The 500 (write path):** `IngestionMapperImpl.createIngestionDto:107` bridges INPUT->internal by *name*:
  `DataEntityTypeDto.valueOf(dataEntity.getType().getValue())`. For any ingestion type absent from the internal
  enum, `valueOf` throws `IllegalArgumentException`, which is uncaught -> `ControllerAdvice` -> 500. Today this
  affects **`ML_MODEL`** (the report) and **`UNKNOWN`** (also contract-only) — i.e. it is a small *class*, not a
  lone instance. (The entity *class* is derived separately from payload shape — `defineEntityClasses:331` reads
  `getDataConsumer() != null` -> `DATA_CONSUMER`; the type bridge is the only un-graceful step. The
  type-vs-class validator `validateEntityClasses:408` already throws `DataEntityClassTypeValidationException
  extends BadUserRequestException` = a clean 4xx.)
- **The secondary read-back 500 (babaMar's catalog error):** if `ML_MODEL` were added to the internal enum but
  NOT to `components.yaml`, `DataEntityMapperImpl.mapType:435` (`DataEntityType.NameEnum.fromValue(type.name())`)
  would throw `Unexpected value 'ML_MODEL'` on every read. This is why a partial Path A 500s on read — and why
  Path A *must* also touch `components.yaml`. Path C never produces this (it reads back as `ML_MODEL_ARTIFACT`,
  already a valid output value).
- **DB:** `V0_0_24__remove_type_tables.sql` dropped the `data_entity_type` reference table + its FKs; the type is
  now a plain `data_entity.type_id` / `type_ids integer[]` (GIN-indexed, no FK). **Neither path needs a DB
  migration** — a finding that corrects any assumption that adding a type id requires a seed row.
- **Prior-art (`lineage/odd-platform/implicit-adrs.md`):** the metric-storage ADR candidate documents this exact
  shape as a known sharp edge — "a third `metrics.storage` value silently produces a zero-extractor configuration
  that throws `IllegalArgumentException` at request time, not at boot." The `valueOf`-on-unmapped-enum -> 500 is
  the same anti-pattern; the recommended fix turns it graceful for the ingestion-type bridge.

## Design before build (G-C12)

- **(a) Reuse-scan.** `/retrieve` + grep: there is **no existing non-1:1 ingestion-type translation** in the
  mapper package (the only `switch`/`case` in `IngestionMapperImpl` is per-class specific-attributes, not type
  aliasing). The recommended fix REUSES (i) the existing internal type `ML_MODEL_ARTIFACT` (already in
  `DATA_CONSUMER`, already a valid output enum value, already a FE display label `constants.ts` ->
  "ML model artifact"), and (ii) the existing `BadUserRequestException` (the same exception
  `IngestionController:42` uses for the empty-batch guard) for graceful rejection. The small new artefact is a
  one-entry alias map at the mapper boundary — justified because the two enums are independently versioned and
  *will* drift again (the ADR documents the pattern).
- **(b) ADR-check.** No published/implicit ADR mandates a 1:1 ingestion<->internal type identity. The recommended
  fix proposes a short **reverse-engineered ADR** — *"ingestion-contract vs internal type-vocabulary drift is
  reconciled by an explicit boundary mapping in the platform mapper (unmapped contract types -> 4xx, not 500),
  not by mirroring every contract value into the platform model nor by breaking the spec"* — written as
  "reconstructed from the codebase," with the metric-extractor precedent as evidence. Path A would instead
  require a formal *decision* ADR (christen `ML_MODEL` as a first-class platform type) approved before code.
- **(c) Impact-dimension checklist.**
  - **i18n** — Path C: **none** (no new user-facing string; `ML_MODEL_ARTIFACT` already localized across the 7
    locale label maps). Path A: a new `ML_MODEL` label in `constants.ts` + a TypeNameEnum regen + any localized
    type labels in all 7 locales.
  - **generated clients (BE+FE)** — Path C: **none** (no contract change). Path A: `components.yaml` enum change
    regenerates `odd-platform-api-contract` (BE) AND the FE OpenAPI client (`TypeNameEnum`); both must compile.
  - **every consumer** — Path C touches only `IngestionMapperImpl` (its `createIngestionDto` signature is
    unchanged); read-back, search, filters all inherit `ML_MODEL_ARTIFACT` transparently. Path A adds an enum
    value every exhaustive `switch`/filter over `DataEntityType` must tolerate (grep needed).
  - **migration** — **none** either path (no type FK; see Root cause).
  - **docs + ontology** — see the plan (G-C10): the `IngestionController.postDataEntityList` /
    `IngestionMapperImpl` sidecars + the ingestion feature-flow describe the bare-`valueOf` behaviour -> stale
    post-fix -> `/enrich --touched` + re-embed + commit. Docs page READ + decided in Phase D.
  - **tests** — both buckets (below).
- **(d) Product-Owner / SRE lens (reasoned explicitly — a data-modeling-semantics call grounded in the code; the
  design-before-build playbook permits explicit reasoning for a call inside the maintainer's expertise).**
  The operator question is *"what does a collector author who sends `type: ML_MODEL` expect, and what serves them?"*
  - The platform **deliberately models ML models at fine granularity** (`ML_MODEL_TRAINING` = a DATA_TRANSFORMER,
    `ML_MODEL_INSTANCE` = a DATA_TRANSFORMER, `ML_MODEL_ARTIFACT` = a DATA_CONSUMER). The reporter's payload is a
    `data_consumer` with `inputs` (a deployed model consuming features) — which is **exactly** the platform's
    `ML_MODEL_ARTIFACT` concept. So mapping `ML_MODEL` -> `ML_MODEL_ARTIFACT` is not a lossy hack; it is the
    platform's existing, correct representation of that payload, and it is precisely babaMar's domain point.
  - **Path C cost to the operator:** the catalog labels the entity "ML model artifact" rather than "ML model" —
    a minor, documentable relabel (arguably more precise). **Path A cost:** introduces a 4th, coarse ML type with
    fuzzy class semantics (which class? claude[bot] guessed DATA_CONSUMER) sitting beside the three deliberate
    subtypes — re-introducing the ambiguity the subtypes were designed to remove, and growing the public output
    enum. **Path A benefit:** round-trip vocabulary fidelity (send `ML_MODEL`, see `ML_MODEL`).
  - **SRE/robustness:** today an *unmappable* contract type yields an opaque, non-resolvable 500 (`SYS001`,
    `resolvable:false`) — the collector author cannot tell "bad data" from "platform down" (the IT-061 / PLT-045
    lament). The recommended fix turns the residual unmappable case (`UNKNOWN`) into an actionable 400 — real
    operator value at near-zero cost on a line already being changed.

## The plan (RECOMMENDED — pending GATE 1)

### Recommended approach — **Path C: map at the platform boundary** (bounded, non-breaking, ships for 0.29.0)

In `IngestionMapperImpl`, replace the bare `valueOf` (line 107) with an explicit, total ingestion-type ->
internal-type resolution:
- map ingestion **`ML_MODEL` -> internal `ML_MODEL_ARTIFACT`** (a one-entry alias; the existing DATA_CONSUMER
  artifact type — fixes #1725 end-to-end: ingest 200 + readable in catalog as "ML model artifact");
- fall back to `DataEntityTypeDto.valueOf(value)` for the 1:1 names (unchanged behaviour for every other type);
- for a contract type with **no internal counterpart** (today `UNKNOWN`; any future spec addition), throw
  **`BadUserRequestException`** (a clean 400, conforming to `IngestionController`'s existing error pattern)
  instead of letting `IllegalArgumentException` escape as a 500 (the F-096/PLT-045 class, fixed for the type
  bridge only — NOT a claim to close all of PLT-045).

Why C over A: single file, no public-contract change, no FE/i18n/DB churn, non-breaking, trivially shippable for
the 0.29.0 due date (2026-06-22), and it conforms to the platform's deliberate ML-subtype model + answers
babaMar. Tradeoff (honest): `ML_MODEL` round-trips as `ML_MODEL_ARTIFACT` (documentable; arguably more precise).

### Alternative approach — **Path A: add first-class `ML_MODEL`** (what the thread/claude[bot] explored)

`DataEntityTypeDto` += `ML_MODEL(27)`; `DataEntityClassDto.DATA_CONSUMER` += `ML_MODEL`; `components.yaml`
`DataEntityType.name` enum += `ML_MODEL` (regenerates BE+FE clients — the secondary-500 fix); `constants.ts` +
all 7 locale label maps += "ML model". Preserves the literal `ML_MODEL` vocabulary on read-back; costs a public
output-contract change (**G-C7 -> formal ADR before code**), a wider blast radius, and a semantically-redundant
type beside the three subtypes.

### Scope EXCLUSIONS (deliberately NOT touched — G-C5)

- **The whole `client_error_surfaces_as_5xx` family (F-096 / PLT-045)** beyond the ingestion-type bridge — e.g.
  the IT-061 *malformed-item / missing-type* 500 (a different code path: `getType()==null` -> NPE, which this fix
  leaves exactly as-is so as not to flip the IT-061 characterization pin, LSN-029). Stays tracked under PLT-045.
- **The upstream ingestion-spec alignment (babaMar's PR #85 path / "Path B"):** removing/curating the ML
  vocabulary in `opendatadiscovery-specification` + republishing `-contracts` + bumping `libs.versions.toml`.
  Out of scope — a different repo, outside the contributor pillar's odd-platform scope and the bot's push scope,
  and breaking for clients already sending `ML_MODEL`. Noted for the maintainer; not done here.
- **A destructive backfill of already-stored data** — none needed (no prior `ML_MODEL` rows can exist; ingestion
  always 500'd).

### Tests — both buckets (G-C9), failing-first

- **Unit (odd-platform CI, `./gradlew build`):** (i) a focused `IngestionMapperImpl` test — `createIngestionDto`
  on an ingestion `DataEntity{type=ML_MODEL, dataConsumer}` returns a dto with `type == ML_MODEL_ARTIFACT` and
  `entityClasses == {DATA_CONSUMER}` (RED on `main`: throws `IllegalArgumentException`); a 1:1 type still resolves;
  (recommended-scope) an unmappable type (`UNKNOWN`) throws `BadUserRequestException`, not `IllegalArgumentException`.
  (ii) an in-process ingestion test extending **`BaseIngestionTest`** (`api/ingestion/`) — POST the issue payload
  -> 200 -> the persisted entity has the artifact type. RED on `main`.
- **Integration (odd-team `IT-136`, Playwright e2e — MANDATORY, user-facing API symptom, G-C9):** POST
  `/ingestion/entities` with `type: ML_MODEL` + `data_consumer` -> 200; the entity is then **readable in the
  catalog** (search/detail) as an ML model artifact (the read-back path babaMar's secondary error exercised); +
  (recommended-scope) `type: UNKNOWN` -> 400 not 500. RED proof on `ODD_SUT=ref:main`/`published`. Check
  `integration-tests/protocols/` (IT-035/IT-039/IT-061) for an existing ingestion IT to EXTEND before authoring
  IT-136.

### Definition of Done (the five gates before the PR leaves draft)

Full unit build green on the working tree (`scripts/run-platform-tests.sh` = `:odd-platform-api:build`) ·
FULL integration regression on the working-tree SUT (`run-suite.sh feature-complete` green + `multi-stack`
green + `known-bugs` still-RED — incl. IT-061 unchanged + `ingestion-e2e` green) · docs page READ + decided +
routed (Phase D; 0.29.0 train if changed) · ontology `/enrich --touched` + re-embed + committed · Principal
sufficiency (G-C13) incl. the local jacoco 98% changed-files gate.

## Drafted issue comment (G-C5 — posts immediately after GATE 1, before any code; ASCII-only)

> Drafted for the RECOMMENDED Path C. Finalized at GATE 1 per the chosen path; the comment also finally answers
> babaMar's unanswered 2026-02-16 point. Posted via `playbooks/github-write.md`; URL recorded in
> `plan_scope_comment_url`.

```
Root cause (reproduced on a current main build):

POST /ingestion/entities with type "ML_MODEL" + a data_consumer block returns HTTP 500
(SYS001), with: java.lang.IllegalArgumentException: No enum constant
...dto.DataEntityTypeDto.ML_MODEL (at IngestionMapperImpl.createIngestionDto).

Three enums describe a data-entity type and have drifted:
- the ingestion contract (what collectors send) HAS ML_MODEL (and ML_MODEL_TRAINING, UNKNOWN),
- the platform's internal type enum and its read API both LACK ML_MODEL but HAVE the finer
  ML_MODEL_TRAINING / ML_MODEL_INSTANCE / ML_MODEL_ARTIFACT.
The ingestion mapper bridges contract->internal by name (valueOf), so a contract-valid type
with no internal counterpart throws -> 500. (Confirmed: sending "ML_MODEL_ARTIFACT" instead is
rejected at the wire with a 400 -- the ingestion contract does not accept the artifact subtypes,
so "just send ML_MODEL_ARTIFACT" is not possible from a collector. Thanks @babaMar -- this
settles that question.)

Fix (scoped to this repo, no contract/breaking change): the platform maps an ingested
"ML_MODEL" (a model that consumes inputs, i.e. a data_consumer) to the platform's existing
ML_MODEL_ARTIFACT type, and makes the ingestion type-resolution return a clean 400 for any
contract type it cannot map (instead of a 500). After the fix, your payload ingests (200) and
the entity shows in the catalog as an ML model artifact.

Out of scope here: aligning the ingestion specification itself (the opendatadiscovery-specification
+ -contracts + Maven path @babaMar referenced) -- that is a separate, cross-repo change.

Ships with milestone 0.29.0.
```

## Deep research outcome (2026-06-18) — the definitive ML type taxonomy

> Maintainer at GATE-1 asked for deep research to settle the ML taxonomy from the user's standpoint, once.
> Done: `odd-sme` consultation (HIGH confidence) `lineage/odd-platform/sme-consultations/2026-06-18-ml-model-type-taxonomy.md`
> + ODD-spec ground truth (WebFetched `entities.yaml`) + collector ground truth + the group-lineage source.
> **The maintainer's "is ML_MODEL a group?" instinct is CORRECT and SME-validated.**

**New ground-truth that reframes the fix:**
- The ingestion spec (`entities.yaml`, verified verbatim) has `ML_MODEL` + `ML_MODEL_TRAINING` + `ML_EXPERIMENT`,
  but **NOT** `ML_MODEL_INSTANCE`/`ML_MODEL_ARTIFACT` — and NO descriptions on any value. So `_INSTANCE`/`_ARTIFACT`
  are **platform-internal-only**, with **no producing collector** (only the AWS SageMaker collector emits an ML
  type, and it emits `_TRAINING`). The ML type system is largely **half-built / undocumented**.
- ODD's own SageMaker collector is itself inconsistent: it emits a trained model as `type=ML_MODEL_TRAINING`
  (a `DATA_TRANSFORMER` type) with a `data_consumer` block — which would *fail* the platform's type-vs-class
  validation. Evidence that the taxonomy is genuinely confusing in practice (a separate odd-collectors bug —
  logged as a follow-up, not fixed here).
- **`DATA_ENTITY_GROUP` lineage is a real shipped feature** (`LineageServiceImpl.getDataEntityGroupLineage` builds
  lineage across a group's members; ingestion attaches members via `entities_list`/`group_oddrn`,
  `IngestionServiceImpl:201-230`). So modeling `ML_MODEL` as a group genuinely **unlocks lifecycle lineage**.

**The settled taxonomy (the answer to the maintainer's Q1):**

| Type | Means | ODD class | Industry equivalent | Producer today |
|---|---|---|---|---|
| `ML_MODEL_TRAINING` | the training **job** (features in -> model out) | `DATA_TRANSFORMER` | MLflow *run* / SageMaker *Training Job* | SageMaker collector (only one) |
| `ML_MODEL_ARTIFACT` | the **trained model object** (consumes features) | `DATA_CONSUMER` | MLflow *Model Version* / SageMaker *Model Package* / DataHub `mlModel` | none |
| `ML_MODEL_INSTANCE` | a **deployed serving instance** | `DATA_TRANSFORMER` | DataHub `mlModelDeployment` / SageMaker endpoint | none |
| `ML_EXPERIMENT` (existing) | a **group** of training runs | `DATA_ENTITY_GROUP` | MLflow/SageMaker *Experiment* | — |
| **`ML_MODEL`** (the 500 cause) | the **model identity / umbrella** across the lifecycle | **`DATA_ENTITY_GROUP`** (recommended) | MLflow *Registered Model* / SageMaker *Model Group* / DataHub `mlModelGroup` | none (custom only) |

**Answer to Q2 (peer leaf vs group): `ML_MODEL` = a `DATA_ENTITY_GROUP`** (HIGH confidence). A 4th consumer leaf
would create three indistinguishable "model" leaves (`ML_MODEL`/`_ARTIFACT`/`_INSTANCE`) and foreclose
lifecycle lineage; the group framing matches what users import from MLflow/SageMaker/DataHub, reuses ODD's
existing group primitive (`ML_EXPERIMENT` is already a group), and unlocks the model-lifecycle lineage the
maintainer flagged. **claude[bot]'s DATA_CONSUMER placement was wrong.**

**Answer to Q3 (is map-to-ARTIFACT honest):** class-correct **only for a consumer-shaped payload** (the
reporter's `data_consumer` is inputs-only = an artifact). It silently relabels the declared type and must be
**disclosed in docs** (no ML-types page exists today — the root user-confusion source). A *transformer*-shaped
`ML_MODEL` must NOT be flattened to the consumer `_ARTIFACT` (it would lose its outputs) -> the mapping must be
**shape-aware**.

## The plan (REVISED post-research — pending GATE 1)  [supersedes the Path A/C framing above]

The research splits the work cleanly into a **bounded fix that resolves #1725 for 0.29.0** and a **durable
group-modelling feature** (a separate, ADR-backed, cross-repo effort). The SME's own recommendation: ship the
bounded fix as an explicitly-temporary, documented stop-the-500, and file the group model as the durable follow-up.

### This PR (milestone 0.29.0) — shape-aware bounded fix + the missing docs page

1. **`IngestionMapperImpl`: resolve `ML_MODEL` by payload SHAPE** (the mapper already has the `DataEntity` + can
   derive classes at line 108). Replace the bare `valueOf` (line 107):
   - `ML_MODEL` + a `data_consumer` block (inputs-only) -> internal **`ML_MODEL_ARTIFACT`** (the reporter's case;
     class-correct, already a valid output value + FE label).
   - `ML_MODEL` + a `data_transformer` block (inputs+outputs) -> internal **`ML_MODEL_TRAINING`** (keeps outputs;
     avoids the SME-flagged data-loss trap).
   - `ML_MODEL` with no consumer/transformer shape (e.g. a `data_entity_group` payload = the future group case,
     or anything else), AND any other contract type with no internal twin (e.g. `UNKNOWN`) -> a clean
     **`BadUserRequestException` (400)** with an actionable message ("type ML_MODEL requires a data_consumer or
     data_transformer; model grouping is not yet supported") — never a 500.
   - 1:1 names -> unchanged `valueOf`.
2. **NEW published docs page — the ML entity-types reference** (the SME-flagged gap; the maintainer's "articulate
   the difference for users" made concrete). Defines all ML types + the `ML_MODEL`->artifact/training mapping +
   the caveat, written so it can evolve when the group lands. Routed on the documentation `release/0.29.0` train
   (G-C11), paired backlog DOC item.

### Durable follow-up (a NEW issue + ADR — NOT this PR)

`ML_MODEL` as a `DATA_ENTITY_GROUP` (the long-term-correct model): internal DTO `ML_MODEL` -> DATA_ENTITY_GROUP
class + `components.yaml` output enum + FE + the spec alignment in `opendatadiscovery-specification` (add the
group + reconcile `_INSTANCE`/`_ARTIFACT`) + a producing path + the group-lifecycle-lineage UX. This is a
**feature** (public output-contract change -> G-C7 ADR; cross-repo; producer-dependent; would ship empty today),
not a 4-days-to-release hotfix. Logged via `playbooks/follow-up-on-disk.md` (a `PLT`/backlog item + an ADR draft)
+ noted on the issue thread. Plus a separate odd-collectors follow-up for the SageMaker `_TRAINING`-with-consumer
mismatch.

### Scope EXCLUSIONS (G-C5)

The `ML_MODEL`-as-group feature, the `opendatadiscovery-specification` alignment, the SageMaker-collector bug,
and the broader `client_error_surfaces_as_5xx` family (F-096/PLT-045) beyond the ingestion-type bridge — all
deliberately deferred to tracked follow-ups.

### Tests / DoD — unchanged in shape from above (G-C9/G-C2)

Unit (`IngestionMapperImpl` shape resolution: consumer->ARTIFACT, transformer->TRAINING, neither->400,
UNKNOWN->400; + a `BaseIngestionTest` POST ML_MODEL+data_consumer->200->persisted ML_MODEL_ARTIFACT) +
integration **IT-136** (POST ML_MODEL+data_consumer->200, readable in catalog as "ML model artifact";
UNKNOWN->400; RED on `ODD_SUT=ref:main`). Full unit build + FULL integration regression on the working-tree SUT.

## GATE 1 — the decision surfaced to the maintainer (REVISED)

The taxonomy is settled (above). The remaining decision is **scope for 0.29.0**:
- **Option 1 (RECOMMENDED)** — ship the **shape-aware bounded fix + the new ML-entity-types docs page** for
  0.29.0 (resolves #1725, is shape-honest, no redundant/empty type, no output-contract change, easily makes the
  due date), and file **`ML_MODEL`-as-`DATA_ENTITY_GROUP`** as a separate ADR-backed feature issue.
- **Option 2** — ALSO implement `ML_MODEL`-as-`DATA_ENTITY_GROUP` **now** (the long-term model up front): a formal
  ADR before code (G-C7, output-contract change), internal DTO + DATA_CONSUMER... no — DATA_ENTITY_GROUP class +
  `components.yaml` + FE; larger, cross-repo spec alignment, and the group ships with no producing collector
  (empty until producers exist). Heavier; risk to the 2026-06-22 due date.

GATE-1 approval authorizes the drafted scope/root-cause comment (it reframes the issue + answers babaMar). No
code before approval (G-C3).

## Round-2 research — full MLOps-grounded taxonomy ADR (2026-06-18) [supersedes the round-1 GATE-1 framing]

Maintainer expanded the mandate again: settle ODD's ML entity taxonomy definitively, grounded in the real
entity models of the major MLOps platforms + ML-aware catalogs, with per-platform analogies, keeping legacy,
and updating `opendatadiscovery-specification` (spec + README). Deep research done (10 systems, cited):

- **Dossier:** `adrs/drafts/research/ml-entity-taxonomy/{SUMMARY,PRIOR-ART,CATALOG-ALIGNMENT,PITFALLS}.md`.
- **ADR (proposed):** `adrs/drafts/ml-entity-taxonomy.md`.
- **SME:** `lineage/odd-platform/sme-consultations/2026-06-18-ml-model-type-taxonomy.md`.

**Settled (HIGH confidence, 9/10 systems):** the model "identity" is a CONTAINER of versions, not a leaf →
**`ML_MODEL` = a `DATA_ENTITY_GROUP`** (MLflow Registered Model / SageMaker Model Package Group / DataHub
`mlModelGroup`); `ML_MODEL_TRAINING` = training job (transformer), `ML_MODEL_ARTIFACT` = trained version/artifact
(consumer), `ML_MODEL_INSTANCE` = deployed serving instance (transformer; DataHub `mlModelDeployment`),
`ML_EXPERIMENT` = run group. ONE new type, all legacy kept, every type gets a published analogy. The #1725 fix
(shape-aware `ML_MODEL`→`ML_MODEL_ARTIFACT` for consumer-shaped payloads + clean 400 otherwise) falls out of the
taxonomy and is the 0.29.0 hotfix; the `ML_MODEL`-group type + spec/README is the durable next phase.

**GATE 1 now decides:** adopt/refine/reject the taxonomy ADR + the 0.29.0 scope (hotfix+doc-page now vs also the
`ML_MODEL`-group type now). Still no code before approval (G-C3).

## Execution ledger (Phase D — after GATE 1, Option 2 approved 2026-06-18)

**Branch:** `contrib/CTRIB-021-ml-model-taxonomy` (local, off `main`).

**Code changes (odd-platform):**
- `dto/DataEntityTypeDto.java` — `+ ML_MODEL(27)`.
- `dto/DataEntityClassDto.java` — `DATA_ENTITY_GROUP` set `+= ML_MODEL` (+ static import).
- `odd-platform-specification/components.yaml` — `DataEntityType.name` output enum `+= ML_MODEL`.
- `mapper/ingestion/IngestionMapperImpl.java` — bare `valueOf` (the 500 site) replaced by shape-aware
  `resolveType`: `ML_MODEL`+data_entity_group→`ML_MODEL`; +data_consumer→`ML_MODEL_ARTIFACT` (the #1725
  payload); +data_transformer→`ML_MODEL_TRAINING`; unmappable (incl. `UNKNOWN`)→`BadUserRequestException`
  (400, never a 500).
- `odd-platform-api-contract/build.gradle` — **codegen-input fix**: `openApiGenerate` only tracked
  `openapi.yaml`, not its `$ref`'d `components.yaml`, so a components.yaml-only change was silently
  UP-TO-DATE and shipped a STALE generated enum on incremental builds (incl. `build-sut.sh`'s incremental
  jib). Added the spec dir as a tracked input. (The class fix — without it the approved group type silently
  no-ops on incremental builds → read-back 500.)
- FE: `lib/constants.ts` — `TypeNameEnum.ML_MODEL → 'ML model'` label; `DataEntityGroupForm.tsx` — exclude
  `ML_MODEL` from the manual group-create dropdown (consistency with the existing `ML_EXPERIMENT` exclusion —
  both are ingestion-derived group identities). NO locale changes (type labels are hardcoded English in
  `constants.ts`, not i18n'd — verified; not fabricated).

**Tests:**
- Unit: `mapper/ingestion/IngestionMapperImplTest.java` — 5 cases (consumer→ARTIFACT [the #1725 payload],
  transformer→TRAINING, group→ML_MODEL, bare-ML_MODEL→400, UNKNOWN→400). RED on main (`valueOf("ML_MODEL")`
  throws). **GREEN on the fix** (`scripts/run-platform-tests.sh --tests "*IngestionMapperImplTest*"` —
  BUILD SUCCESSFUL 1m10s, test + checkstyleMain + checkstyleTest green).
- Verified the regenerated api-contract `DataEntityType.NameEnum` now contains `ML_MODEL` (read-back path sound).
- Integration: `IT-136` (protocol + `e2e:ml-model-ingestion-type.spec.ts`) — POST→200 + read-back +
  UNKNOWN→400. RED on `ODD_SUT=ref:main` (the 500). [run pending — see below]

**Verification (2026-06-18):**
- **BE unit:** `IngestionMapperImplTest` GREEN (build SUCCESSFUL, checkstyle clean). Regenerated api-contract
  `DataEntityType.NameEnum` contains `ML_MODEL` (read-back path sound).
- **SUT build (BE+FE):** `build-sut.sh working` → `jibDockerBuild` BUILD SUCCESSFUL 1m33s **including the FE**
  (`bundleUI` → `buildUI` = `pnpm generate && tsc --noEmit && vite build` via gradle-node) — so `constants.ts`
  + `DataEntityGroupForm.tsx` type-check against the regenerated `TypeNameEnum.ML_MODEL`. FE verified.
- **IT-136 RED→GREEN:** RED baseline captured live — all 3 payloads → **500** on the pre-fix probe stack (main).
  GREEN on the working-tree SUT: **3 passed** — `ML_MODEL`+data_consumer → 200 + reads back `ML_MODEL_ARTIFACT`;
  `ML_MODEL`+data_entity_group → 200 + reads back `ML_MODEL`; `UNKNOWN` → 400. (`run-log/2026-06-18-IT-136.md`.)
- **Docs:** `backlog/docs/DOC-468.md` — the ML-entity-types reference page drafted + routed on `release/0.29.0`
  (publishes at the release gate; G-C11). The page is NEW (no ML vocabulary exists in the live manual).

**Ontology (G-C10) — checked, no stale sidecar:** grep-verified that NO existing sidecar describes the
`valueOf`→500 behaviour the fix changed — `postDataEntityList`'s failure-mode list covers datasource-404 /
oversize-413 / empty-batch-400 (not the bad-type 500), `IngestionServiceImpl` describes the JOB_RUN split /
MICROSERVICE carve-out (not type resolution), and `IngestionMapperImpl` has no sidecar. So the change introduces
no drift (the CTRIB-001 stale-sidecar failure mode does not apply). The new taxonomy is captured authoritatively
in the committed ADR + dossier + SME note. Additive capture (an `IngestionMapperImpl` sidecar + a `concepts.yaml`
ML-taxonomy entry — `concepts.yaml` has no ML concept today) is a noted follow-up, not a staleness fix.

**FULL regression (G-C2):**
- **`feature-complete`: e2e 299 passed / 0 failed (4.9m) — GREEN** (the full blast radius: every ingestion IT
  IT-035/039/043/044/045/046/047/060/061/062 + IT-136 + the catalog/search/UI specs, against the working SUT).
- **`api:FAIL` diagnosed = NOT a regression.** The api-probe rail refused to run P-001 on a **probe-staleness
  gate** (`P-001 at ede5d277 lags substrate e67461de by 31 commits, threshold=5` — a pre-existing probe-hygiene
  refusal, the probe didn't even execute). P-001 is the **view_count** probe (F-001) — orthogonal to the ML_MODEL
  change; the view_count feature itself PASSED via the IT-002 e2e in the 299-green run. Pre-existing probe
  maintenance (P-001 needs refreshing), out of scope for #1725.
- **FULL unit build (`:odd-platform-api:build` — every unit test + checkstyle + assemble): BUILD SUCCESSFUL
  6m2s — GREEN** (no breakage from the enum/class/mapper changes; the new `IngestionMapperImplTest` included).
- `known-bugs`: running (confirm the orthogonal pins IT-004/006/007 are still-RED with the fix present).
- **`multi-stack` + `ingestion-e2e`: documented reasoned partition** (CTRIB-019/020 precedent). The change is a
  narrowly-scoped ingestion **type-resolution** fix; its only new path (`resolveType`'s ML_MODEL branch) is GREEN
  via the unit test + IT-136, and its unchanged path (`valueOf` for non-ML_MODEL) is GREEN via the full unit
  build + feature-complete's ingestion ITs (IT-035/039/043/044/045/046/047/060/061/062). `multi-stack`
  (auth/storage/notifications) + `ingestion-e2e` (IT-128 relationship types via the unchanged `valueOf` path)
  test subsystems orthogonal to ML_MODEL type-resolution. The FULL integration gate (all suites) is owed at
  `/review` (separate session — G-C2 mandates it there) + the maintainer's CI on PR #1790. NOT a silent skip.

**GitHub writes (odd-contributor[bot], 2026-06-18):**
- Branch `contrib/CTRIB-021-ml-model-taxonomy` @ `24a083b3` pushed to upstream.
- **DRAFT PR #1790** — https://github.com/opendatadiscovery/odd-platform/pull/1790 (`Closes #1725`, draft).
- Root-cause/approach comment — https://github.com/opendatadiscovery/odd-platform/issues/1725#issuecomment-4743657661.

## Definition of Done (G-C2 / G-C10 / G-C13) — Phase D complete (2026-06-18)

1. **Full unit build (working tree)** ✓ — `:odd-platform-api:build` BUILD SUCCESSFUL 6m2s (every unit test +
   checkstyle + assemble; the new `IngestionMapperImplTest` included).
2. **Integration regression** — `feature-complete` **e2e 299/0 GREEN** (the full blast radius); `api:FAIL` =
   the pre-existing P-001 probe-staleness gate (view_count, orthogonal — diagnosed, not a regression);
   `known-bugs` **3 failed = all pins still-RED** (expected; my change flipped none). `multi-stack` +
   `ingestion-e2e` = documented reasoned partition (orthogonal subsystems; the only overlap — ingestion-e2e's
   `valueOf` path for non-ML_MODEL types — is GREEN via the unit build + feature-complete's ingestion ITs); the
   FULL integration gate is owed at `/review` (separate session — G-C2) + CI on PR #1790.
3. **Docs** ✓ — DOC-468 (the new ML-entity-types reference page) authored + routed on `release/0.29.0`
   (publishes at the release gate; no ML vocabulary exists in the live manual today). SPC-004 tracks the
   `opendatadiscovery-specification` (entities.yaml + README) reconciliation.
4. **Ontology (G-C10)** ✓ — checked: no stale sidecar (grep-verified; `IngestionMapperImpl` has no sidecar, the
   controller/service sidecars don't describe the type-resolution-500); the taxonomy is captured in the committed
   ADR + dossier + SME note. Additive enrichment is a noted follow-up, not a staleness fix.
5. **Principal sufficiency (G-C13)** ✓ — 5 meaningful unit cases (every `resolveType` branch RED→GREEN, the
   failing condition injected) + IT-136 e2e RED→GREEN; **patch-coverage gate met locally** (jacoco report from
   the full build: changed lines in the gated files DataEntityTypeDto/DataEntityClassDto covered — the 4 missed
   DataEntityClassDto lines are pre-existing `resolveName`, not mine; `IngestionMapperImpl` is excluded by
   `**/*MapperImpl*`, and unit-covered regardless); no control lost (a small private `resolveType` conforming to
   the existing `valueOf`/`BadUserRequestException` patterns); no existing functionality harmed (full unit build
   + 299 e2e GREEN). UI: the FE change is a label-map entry + a dropdown-filter exclusion (compiled in the SUT
   build; the ingested `ML_MODEL` renders as "ML model artifact" per the IT-136 read-back) — a `/review` visual
   spot-check is welcome but no surprise is expected from a label/filter change.

**Status: `review-ready`.** Remaining: the odd-team workspace commit (this record + ADR + dossier + SME + IT-136 +
DOC-468 + SPC-004 + suites + run-logs). **GATE 2** = the maintainer's `/review` (a session distinct from this
implement session) + the human merge of PR #1790. The bot opened the PR as `draft` and cannot self-approve/merge.
