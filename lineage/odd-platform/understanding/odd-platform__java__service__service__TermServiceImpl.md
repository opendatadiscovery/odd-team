---
node_id: "odd-platform java service service:TermServiceImpl"
node_kind: service
axis: services
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-K
---

# TermServiceImpl — semantic understanding

## understanding

`TermServiceImpl` is the service-tier orchestrator for ODD Platform's **Business Glossary** (pillar P-06 in `system-mission.md`) — it implements all 17 methods of `TermService` (`TermService.java:17-57`), spanning Term CRUD (`createTerm`, `updateTerm`, `delete`, `getTermDetails`, `getTerms`, `getTermByNamespaceAndName`), Term-to-DataEntity linkage (`linkTermWithDataEntity`, `removeTermFromDataEntity`), Term-to-DatasetField linkage (`linkTermWithDatasetField`, `removeTermFromDatasetField`), Term-to-Term linkage (`linkTermWithTerm`, `removeTermToLinkedTermRelation`, `listByTerm`), Term tagging (`upsertTags`), Term-mention auto-link reconciliation (`handleDataEntityDescriptionTerms`, `handleDatasetFieldDescriptionTerms`), and the read-side aggregators (`getDataEntityTerms`, `getDatasetFieldTerms`). The **auto-link side-channel** is the load-bearing semantic concern: the regex `\[\[([^:]*?):([^\]]*?)\]\]` (`TermServiceImpl.java:67`) parses `[[namespace:term]]` mentions out of every internal description (data-entity, dataset-field, term-definition) and synthesises `DataEntityToTermPojo` / `DatasetFieldToTermPojo` / `TermToTermPojo` rows with `is_description_link = TRUE` — bypassing the `DATA_ENTITY_ADD_TERM` / `DATASET_FIELD_ADD_TERM` controller-tier permission gates that would otherwise be required to create those rows directly.

**Headline finding (HIGH severity, primary-source confirmed — REFACTOR-217):** the SecurityConstants rules supposed to gate term linking are wired to the WRONG PATH (singular `/term` vs. plural `/terms` in OpenAPI). `SecurityConstants.java:237-242` registers `/api/dataentities/{data_entity_id}/term` (singular) for `DATA_ENTITY_ADD_TERM` and `/api/dataentities/{data_entity_id}/term/{term_id}` (singular) for `DATA_ENTITY_DELETE_TERM`; the OpenAPI operation paths at `openapi.yaml:973` and `openapi.yaml:1042` are PLURAL (`/terms`, `/terms/{term_id}`). The matchers never fire — `linkTermWithDataEntity` and `removeTermFromDataEntity` (`TermServiceImpl.java:170-196`) are reachable by ANY authenticated user with no Policy gate. This is bug-of-record; this sidecar's role is to capture the service-tier counterparts. A SECOND independent SecurityConstants bug (`SecurityConstants.java:295-296`) wires the path `/api/alerts/{alert_id}/status` PUT to the permission `DATASET_FIELD_ADD_TERM` (a Term permission applied to an Alert path) — almost certainly a copy/paste error that disables the intended alert-status authorization and dangles a Term permission on the wrong endpoint.

## concepts

- entities: [
    "`TermPojo` — jOOQ row for the `term` table (catalog-wide term entity; PK `id`; soft-deletable via `deleted_at`).",
    "`NamespacePojo` — namespace scope; `(name, namespace_id)` is the term's natural key. Namespace name comparison is case-INSENSITIVE (`equalIgnoreCase` in `ReactiveTermRepositoryImpl.java:156-157, 167`).",
    "`TermBaseInfoDto` — `(namespaceName, name)` record used as the parse-side representation of a `[[ns:term]]` mention; namespaces and names are stored case-folded to lower for unhandled entries (`TermServiceImpl.java:507-509, 519-520, 541-542`).",
    "`DescriptionParsedTerms(foundTerms: List<TermPojo>, unknownTerms: List<TermBaseInfoDto>)` — the parser output record (`DescriptionParsedTerms.java:6`). foundTerms are terms that EXIST; unknownTerms are mentions whose `(ns, name)` pair has no matching term in the dictionary.",
    "`DataEntityToTermPojo` / `DatasetFieldToTermPojo` / `TermToTermPojo` — the three link tables; each carries an `is_description_link` boolean flag.",
    "`DataEntityDescriptionUnhandledTermPojo` / `DatasetFieldDescriptionUnhandledTermPojo` / `TermDefinitionUnhandledTermPojo` — the three 'unhandled mention' staging tables that hold `[[ns:term]]` mentions that DON'T resolve yet; when a matching term is later CREATED, `resolveUnhandledDescriptionMentions` (`TermServiceImpl.java:421-442`) drains the staging table and materialises real link rows.",
    "`LinkedTermDto(term: TermRefDto, isDescriptionLink: boolean)` — the read-side projection emitted by `getDataEntityTerms` / `getDatasetFieldTerms`; the boolean distinguishes manual links from description-mention links.",
    "Two `ActivityEventTypeDto` values: `TERM_ASSIGNMENT_UPDATED` (data-entity term changes — `TermServiceImpl.java:169, 183, 200`) and `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` (dataset-field term changes — `TermServiceImpl.java:211, 225, 243`)."
  ]
- operations: [
    "`createTerm` (`TermServiceImpl.java:99-117`) — guard against duplicate `(namespace, name)`, then `getOrCreate` namespace, parse `[[ns:term]]` in the term's own definition, INSERT the term, store internal term-to-term links + unknown-mention staging rows, refresh FTS vectors (term + namespace), then drain ANY unhandled-mention staging rows that match this newly-created term's `(ns, name)` (resolves backwards references — earlier-saved descriptions that mention a term that didn't yet exist).",
    "`updateTerm` (`TermServiceImpl.java:121-145`) — fetch existing term, GUARD: if name+namespace have NOT changed, skip the next check and proceed; if name OR namespace HAS changed, ERROR if the term is mentioned in any active description (`hasDescriptionRelations` checks all three link tables filtered to `is_description_link=TRUE` AND parent entity not in `DELETED` status — `ReactiveTermRepositoryImpl.java:408-433`). Then `getOrCreate` the namespace, apply form to pojo, UPDATE, refresh FTS.",
    "`delete` (`TermServiceImpl.java:154-165`) — guard: ERROR if term is mentioned in any active description; then delete relations with data entities + dataset fields + soft-delete the term itself (sets `deleted_at`).",
    "`linkTermWithDataEntity` (`TermServiceImpl.java:170-179`) — `@ReactiveTransactional` + `@ActivityLog(TERM_ASSIGNMENT_UPDATED)`; INSERT `data_entity_to_term` with `is_description_link=FALSE`; on duplicate INSERT (PK collision on `(data_entity_id, term_id, is_description_link)`) the repo emits empty → service translates via `.switchIfEmpty(BadUserRequestException 'Term already assigned to data entity')`; mark `data_entity_filled.TERMS`.",
    "`removeTermFromDataEntity` (`TermServiceImpl.java:184-196`) — delete the link, re-query `getDataEntityTerms`; if the entity now has zero terms, mark `data_entity_filled.TERMS` unfilled.",
    "`handleDataEntityDescriptionTerms` (`TermServiceImpl.java:201-207`) — the AUTO-LINK side-channel entry point invoked from `DataEntityServiceImpl.upsertDescription` (`DataEntityServiceImpl.java:328`); `findTermsInDescription` runs the regex, partitions into foundTerms + unknownTerms, then `updateDataEntityDescriptionTermsState` reconciles: DELETE any existing `is_description_link=TRUE` rows for terms NO LONGER mentioned, INSERT new `is_description_link=TRUE` rows for newly-mentioned existing terms, DELETE unhandled-staging rows except those for currently-unknown mentions, INSERT new unhandled rows for new unknown mentions.",
    "`linkTermWithDatasetField` (`TermServiceImpl.java:212-221`) — the dataset-field-side counterpart; no `.switchIfEmpty` guard (asymmetric vs. `linkTermWithDataEntity` — silently succeeds on duplicate INSERT).",
    "`handleDatasetFieldDescriptionTerms` (`TermServiceImpl.java:244-250`) — dataset-field auto-link side-channel; called from `DatasetFieldServiceImpl.updateDescription` (`DatasetFieldServiceImpl.java:90`).",
    "`upsertTags` (`TermServiceImpl.java:253-264`) — delete existing tag relations matching the new name set, then re-INSERT all current names (the `tagService.getOrCreateTagsByName(names)` returns existing tags by name OR creates new ones via the `TAG_CREATE` side-channel — same architectural class as the `[[ns:term]]` auto-create gap for terms).",
    "`linkTermWithTerm` / `removeTermToLinkedTermRelation` (`TermServiceImpl.java:289-302`) — direct term-to-term linkage from a term's detail page; no asymmetry-vs-empty guard.",
    "`findTermsInDescription` (`TermServiceImpl.java:337-360`) — the regex parser at the heart of the auto-link side-channel: matches `\\[\\[([^:]*?):([^\\]]*?)\\]\\]`, emits `TermBaseInfoDto(namespaceName, name)` for each non-empty `(group1, group2)`, batch-lookups the entire set via `getByNameAndNamespace(List)` (which builds a single `(name=X AND namespace=Y) OR …` query — `ReactiveTermRepositoryImpl.java:162-179`), partitions into foundTerms + unknownTerms by `equalsIgnoreCase` comparison."
  ]
- invariants: [
    "Reactive-transactional perimeter — ALL mutating methods are `@ReactiveTransactional` (`TermServiceImpl.java:100, 120, 154, 168, 182, 199, 210, 224, 242, 253, 289, 298`); reads (`getTerms`, `getTermByNamespaceAndName`, `getTermDetails`, `listByTerm`, `getDataEntityTerms`, `getDatasetFieldTerms`) are NOT transactional (read-committed).",
    "Term natural key is `(namespace, name)` case-insensitively — duplicate check on create (`createTerm` lines 107-113) and lookup (`ReactiveTermRepositoryImpl.java:156-157, 167`) both use `equalIgnoreCase`. Two terms `finance/Customer` and `finance/customer` cannot coexist.",
    "Soft-delete via `deleted_at` — `delete` (`TermServiceImpl.java:164`) returns `term.id` after `termRepository.delete(id)` which sets `deleted_at` (cross-ref `ReactiveTermRepositoryImpl.java:143 .where(TERM.DELETED_AT.isNull())` on every fetch).",
    "Description-mention guard for irreversible operations — `updateTerm` and `delete` BOTH error with `BadUserRequestException('Can\\'t update term, which was mentioned in description')` / `('Can\\'t delete term, which was mentioned in description')` when `hasDescriptionRelations` returns TRUE (`TermServiceImpl.java:128-134, 157-160`). This guard checks all three link tables AND filters to parent entities NOT in `DELETED` status (`ReactiveTermRepositoryImpl.java:415, 425, 432`) — a term mentioned ONLY in a soft-deleted data-entity's description CAN be deleted.",
    "Update-without-rename bypasses the description-mention guard — `updateTerm` skips the `hasDescriptionRelations` check entirely when name AND namespace are BOTH unchanged (`TermServiceImpl.java:125-127`). This lets an operator edit a term's DEFINITION even when it is mentioned by descriptions — the rename-only guard exists because mentions are stored by `(ns, name)` text, not term-id (rename would break link resolution). Definition edits don't break references.",
    "Auto-link triggered ONLY by description-edit endpoints — `findTermsInDescription` is invoked from `createTerm` (term's own definition), `updateTerm` (via `update` → line 306), `handleDataEntityDescriptionTerms` (data-entity description edit), `handleDatasetFieldDescriptionTerms` (dataset-field description edit). Ingestion-side description writes (raw-description from collectors) DO NOT call this method per `DataEntityServiceImpl.java:328` being the only data-entity entry point — but the cross-ref against ingestion processors is out of scope for this sidecar.",
    "Unhandled-mention staging is unidirectional → resolution — `[[ns:NEW_TERM]]` mentions for terms that don't exist yet sit in `*_unhandled_term` tables (`buildDataEntityUnknownTerms` etc.); when the matching term is later CREATED, `resolveUnhandledDescriptionMentions` (`TermServiceImpl.java:421-442`) drains the staging rows and materialises real `*_to_term` link rows. There is NO opposite flow: when a term is DELETED, descriptions that mention it do NOT migrate to the staging tables — the description guard (`hasDescriptionRelations`) prevents delete instead.",
    "`removeDuplicateNonDescriptionTerms` (`TermServiceImpl.java:444-448`) — both `getDataEntityTerms` and `getDatasetFieldTerms` pass results through this groupBy/reduce; when a term has BOTH a manual link row (`is_description_link=FALSE`) AND a description-mention link row (`is_description_link=TRUE`), the read side returns ONLY the description-link variant. The two rows coexist in the DB (per the PK on `(data_entity_id, term_id, is_description_link)`) but are collapsed on read."
  ]
- audiences: [
    "ODD Platform UI — the Dictionary tab, Term detail page, Data Entity Terms section, and dataset-field Terms section consume `getDataEntityTerms` / `getDatasetFieldTerms` / `getTermDetails` etc.",
    "Any authenticated caller — per REFACTOR-217 path-mismatch in SecurityConstants.java:237-242, all `/api/dataentities/{id}/terms` and `/api/datasetfields/{id}/terms` mutations bypass the intended `DATA_ENTITY_ADD_TERM` / `DATASET_FIELD_ADD_TERM` gates; the read endpoints (`GET /api/terms`, `GET /api/terms/{id}`, `GET /api/terms/{id}/linked_terms`) have no per-namespace scoping (every authenticated user sees every term across every namespace).",
    "`DataEntityServiceImpl.upsertDescription` (`DataEntityServiceImpl.java:328`) — invokes `handleDataEntityDescriptionTerms` after `updateDescription`; the only auth check for the auto-link side-channel is the `DATA_ENTITY_DESCRIPTION_UPDATE` gate on the description endpoint itself (`SecurityConstants.java:195-197`).",
    "`DatasetFieldServiceImpl.updateDescription` (`DatasetFieldServiceImpl.java:90`) — invokes `handleDatasetFieldDescriptionTerms`; auth gate is `DATASET_FIELD_DESCRIPTION_UPDATE` (`SecurityConstants.java:286-287`).",
    "`TermAssignmentActivityHandler` (`TermAssignmentActivityHandler.java:20-61`) — consumes `TERM_ASSIGNMENT_UPDATED` events emitted by `linkTermWithDataEntity` / `removeTermFromDataEntity` / `handleDataEntityDescriptionTerms`; re-queries `getDataEntityTerms` to assemble BEFORE+AFTER state JSON."
  ]

## dependencies_semantic

- requires-feature: [
    "Business Glossary / Dictionary feature (P-06 P-06) — provides the `term` + `namespace` + `data_entity_to_term` + `dataset_field_to_term` + `term_to_term` + three `*_unhandled_term` tables this service orchestrates.",
    "Activity feed (P-07) — `TERM_ASSIGNMENT_UPDATED` and `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` events drive the per-entity activity feed; consumed by `TermAssignmentActivityHandler`.",
    "Data-entity filled-field tracking — `dataEntityFilledService.markEntityFilled(TERMS)` / `markEntityUnfilled(TERMS)` toggles the `data_entity_filled.TERMS` flag (and the `DATASET_FIELD_TERMS` counterpart) so the data-entity participates in completeness metrics.",
    "Namespace management (P-08 Management) — `namespaceService.getOrCreate(name)` (`TermServiceImpl.java:103, 138`) means a Term create with a NEW namespace name silently creates the namespace too — bypassing the `NAMESPACE_CREATE` permission that protects the `POST /api/namespaces` endpoint (cross-ref namespace-create side-channel pattern from batch G).",
    "Tag management (P-08) — `upsertTags` calls `tagService.getOrCreateTagsByName(names)` (`TermServiceImpl.java:257`) which creates tags as needed — bypassing the `TAG_CREATE` permission that gates `POST /api/tags`. Cross-ref: same `TAG_CREATE`-via-`upsertTags` pattern in `OwnerController#createOwner` sidecar (REFACTOR-222 / REFACTOR-223 family).",
    "Full-text search indexing — `termSearchEntrypointRepository.updateTermVectors(id)` and `updateNamespaceVectorsForTerm(id)` and `updateTagVectorsForTerm(id)` (`TermServiceImpl.java:326-328, 261-262`) refresh the `term_search_entrypoint` materialised view backing `GET /api/terms?query=…`."
  ]
- requires-config: [] — N/A (method reads no `application.yml` config; behaviour is fully data-driven)
- requires-runtime: [
    "Spring WebFlux runtime — every method returns `Mono<…>` or `Flux<…>`; service is `@Service`-registered (`TermServiceImpl.java:63`).",
    "jOOQ reactive DB session via the `Reactive*Repository` ports + the `@ReactiveTransactional` Spring AOP weaver (`org.opendatadiscovery.oddplatform.annotation.ReactiveTransactional`).",
    "Postgres `term`, `namespace`, `data_entity_to_term`, `dataset_field_to_term`, `term_to_term`, `data_entity_description_unhandled_term`, `dataset_field_description_unhandled_term`, `term_definition_unhandled_term` tables plus the `term_search_entrypoint` materialised view."
  ]
- couples-to: [
    "`TermService` interface — `TermServiceImpl` is the sole impl; consumed by `TermController` (`TermController.java:44`), `DataEntityServiceImpl` (description-edit side-channel — `DataEntityServiceImpl.java:328`), `DatasetFieldServiceImpl` (description-edit side-channel — `DatasetFieldServiceImpl.java:90`), and `DataEntityController.addDataEntityTerm` (via `TermService.linkTermWithDataEntity` — `DataEntityController.java:154`).",
    "`ReactiveTermRepository` — the principal data port.",
    "`TermRelationsRepository` — the link-table mutator port (3 link tables × CRUD).",
    "`ReactiveTermSearchEntrypointRepository` — FTS vector refresh.",
    "`DataEntityDescriptionUnhandledTermRepository` / `DatasetFieldDescriptionUnhandledTermRepositoryImpl` / `TermDefinitionUnhandledTermRepository` — staging-table ports (note the `Impl` suffix on the dataset-field variant — `TermServiceImpl.java:78` injects the concrete class rather than an interface, a single-file inconsistency).",
    "`NamespaceService` (`TermServiceImpl.java:69`) — `getOrCreate(name)` is the side-channel namespace creator.",
    "`TagService` (`TermServiceImpl.java:70`) — `getOrCreateTagsByName(names)` + `deleteRelationsWithTerm` / `createRelationsWithTerm`.",
    "`DataEntityFilledService` (`TermServiceImpl.java:71`) — `markEntityFilled(TERMS)` / `markEntityUnfilled(TERMS)` and the dataset-field counterparts.",
    "`TermMapper` / `TagMapper` (`TermServiceImpl.java:80-81`) — DTO ↔ pojo translation.",
    "`@ActivityLog` annotation processor — captures BEFORE+AFTER state via `TermAssignmentActivityHandler`."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. There is NO `TermServiceImplTest` and NO integration test that targets any of the 17 methods. `grep -rln 'TermServiceImpl\\|TermServiceImplTest' <odd-platform-repo>/odd-platform-api/src/test` returns one match (`DataEntityServiceTest.java:80` declares `@Mock private TermService termService;` but never invokes any method on it — it's wired only to allow the `DataEntityServiceImpl` constructor signature).
- uncovered_behaviours: [
    "Term create — duplicate-name-in-namespace 400 surface (`TermServiceImpl.java:108-113`) has no test.",
    "Term create — namespace side-channel creation via `namespaceService.getOrCreate` (`TermServiceImpl.java:103`); no test asserts that creating a Term with a never-before-seen namespace name silently creates the namespace and bypasses the `NAMESPACE_CREATE` permission.",
    "Term create — backward resolution of unhandled mentions via `resolveUnhandledDescriptionMentions` (`TermServiceImpl.java:116, 421-442`); no test verifies that an unhandled `[[ns:NEW]]` mention created BEFORE the term existed is materialised when the term is later created.",
    "Term update — the `nameOrNamespaceHasChanged` GUARD bypass (`TermServiceImpl.java:125`); no test asserts that an update without name/namespace change is permitted even when the term is mentioned in descriptions, AND that an update WITH name/namespace change is blocked under that condition.",
    "Term delete — the description-relation guard error path (`TermServiceImpl.java:157-160`); no test exercises the 400 surface.",
    "Term delete — the cascading link-deletion (`TermServiceImpl.java:162-163`); no test verifies that data-entity + dataset-field link rows are deleted before the term itself.",
    "linkTermWithDataEntity — duplicate INSERT 400 surface (`TermServiceImpl.java:174` `BadUserRequestException 'Term already assigned to data entity'`); no test.",
    "linkTermWithDatasetField — duplicate INSERT path (`TermServiceImpl.java:215`); NO `.switchIfEmpty` guard (asymmetric vs. `linkTermWithDataEntity`); no test catches the silent-success on duplicate.",
    "removeTermFromDataEntity — the `markEntityUnfilled` fire-on-last-removal logic (`TermServiceImpl.java:190-194`); no test asserts the flag flip on the LAST term removed.",
    "handleDataEntityDescriptionTerms — the auto-link side-channel; this is the REFACTOR-227-equivalent code path. NO test asserts that a description edit with `[[finance:Customer]]` content creates a `data_entity_to_term` row with `is_description_link=TRUE` despite the caller lacking `DATA_ENTITY_ADD_TERM` permission.",
    "findTermsInDescription regex behaviour — `[[ns:term]]` parsing has NO unit test. The regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` (`TermServiceImpl.java:67`) has multiple edge cases unproven: nested brackets (`[[a:[b]]]`), empty groups (`[[:foo]]`, `[[foo:]]`), colon in name (handled — `[^:]*?` for namespace makes namespace eager-to-end-at-first-colon), unicode names, trailing `]]` matched by `[^\\]]*?`. The unicode behaviour and the multi-line behaviour (regex compiled with no flags — no MULTILINE, no DOTALL) are unproven.",
    "Unhandled-mention staging — `buildDataEntityUnknownTerms` / `buildDatasetFieldUnknownTerms` / `buildTermUnknownTerms` (`TermServiceImpl.java:501-544`) lowercase namespace + name before insertion; no test verifies case-folding consistency vs. the later `equalsIgnoreCase` comparison in `isTermUnknown` (`TermServiceImpl.java:546-550`).",
    "resolveUnhandledDescriptionMentions — the unhandled→link migration on term-create (`TermServiceImpl.java:421-442`); no test.",
    "removeDuplicateNonDescriptionTerms — the BOTH-manual-AND-description-link collapse on read (`TermServiceImpl.java:444-448`); no test asserts that when both rows exist, the description-link variant wins.",
    "TermAssignmentActivityHandler triple-re-query (REFACTOR-228) — `linkTermWithDataEntity` (`TermServiceImpl.java:170-179`) emits a `TERM_ASSIGNMENT_UPDATED` event; the handler's `getContextInfo` (`TermAssignmentActivityHandler.java:30-37`) re-queries `getDataEntityTerms` (1st full-list query) BEFORE method execution; the handler's `getUpdatedState` (`TermAssignmentActivityHandler.java:40-43`) re-queries AGAIN (2nd full-list query) AFTER. For `removeTermFromDataEntity` (`TermServiceImpl.java:184-196`) a THIRD query fires inside the method (line 188) to drive the markEntityUnfilled decision — making a single de-link request execute 3 full-list re-queries. No test catches this.",
    "Activity-event suppression on description-mention removals — `handleDataEntityDescriptionTerms` (`TermServiceImpl.java:200-207`) is `@ActivityLog(TERM_ASSIGNMENT_UPDATED)`; if the description edit drops a `[[ns:term]]` mention, the resulting `DELETE FROM data_entity_to_term WHERE is_description_link=TRUE` produces an activity event. No test verifies the JSON state captures the description-link distinction."
  ]
- test_files: [] — verified absent: `find <odd-platform-repo> -name 'TermServiceImpl*Test*'` and `find <odd-platform-repo> -name 'Term*ServiceTest*'` both return zero matches.
- gaps: |
    `TermServiceImpl` is a 552-line service with 17 methods carrying multiple transactional invariants, three link-table mutators with `is_description_link` flag semantics, a regex parser at the heart of an undocumented auto-link side-channel, a three-stage unhandled-mention staging system, and zero unit tests. The most impactful regression that would land undetected is a Term-mention auto-link change (e.g., the regex tightening to allow only existing namespaces, or the silent-namespace-create being removed) — there is no test that pins ANY of those behaviours. The second-most-impactful is a Term update or delete leak past the `hasDescriptionRelations` guard — a logic edit there could silently allow a rename + cascade that breaks `[[ns:term]]` resolution across every description in the catalog. Adding a single integration test that (a) creates a term, (b) creates a data entity with `[[ns:term]]` in its description, (c) attempts to rename the term, (d) asserts 400, would pin the most fragile invariant in this file. The triple-re-query in TermAssignmentActivityHandler (REFACTOR-228) is a separate performance test gap. The whole file is TEST-GAP-018 (HIGH) verified against primary source.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
    anchor: ""
    rationale: "Canonical user-facing doc for the Business Glossary feature this service backs. The Wikipedia-About-style description, term-to-term linking, term-to-entity descriptive associations are all named on this page; the [[ns:term]] syntax is described as 'the required format for linking' but NOT SPELLED OUT VERBATIM in the page text — only shown via screenshots of the in-app information-icon tooltip."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-19 returned 200 with content matching the local `documentation/docs/data-glossary/business-glossary.md` clone (lines 1-141). Key verbatim excerpts the fetched page returned:
      - "Inline-mention a term inside a data entity's or column's description. The mention surfaces in that entity's **Terms** section once the description is saved."
      - "The link format used in description text spells out the namespace explicitly when crossing namespaces"
      - Seven `TERM_*` permissions listed (TERM_CREATE / TERM_UPDATE / TERM_DELETE / TERM_OWNERSHIP_CREATE / TERM_OWNERSHIP_UPDATE / TERM_OWNERSHIP_DELETE / TERM_TAGS_UPDATE).
      - The page does NOT mention `DATA_ENTITY_ADD_TERM` or `DATASET_FIELD_ADD_TERM` (the two permissions that gate the term-linkage endpoints this service backs).
      - The page does NOT describe the auto-link side-channel — that a user with only `DATA_ENTITY_DESCRIPTION_UPDATE` can create term-link rows via `[[ns:term]]` syntax without holding `DATA_ENTITY_ADD_TERM`.
      - The page does NOT spell out the exact `[[namespace:term]]` text format — it shows screenshots of the in-app information-icon tooltip but does not transcribe the format into the page text.
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "Pillar landing for Data Glossary (P-06). Cross-checks the verbatim doc-side narrative used in `system-mission.md` line 188."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-19 returned 200. The page frames the Data Glossary as "operator-curated term entities that name and describe the concepts your data represents" and notes the seven `TERM_*` RBAC permissions. The page does NOT mention `DATA_ENTITY_ADD_TERM`, `DATASET_FIELD_ADD_TERM`, the auto-link side-channel, the `[[ns:term]]` syntax, the unhandled-mention staging, or the description-mention guards on update/delete. The page's API-surface section refers readers to API Reference → Glossary for HTTP details but does not document the `is_description_link` flag distinction at the conceptual level either.
- doc_drift_findings:
  - "DOC-NNN (HIGH): the live Business Glossary doc page does NOT spell out the `[[namespace:term]]` description-mention syntax verbatim — readers must rely on the in-app tooltip (a non-Googleable surface) to discover the exact format. The format is HARD-CODED in code (`TermServiceImpl.java:67` regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]`) and silently determines whether a description's mention will link or stage as 'unhandled'. Add a 'Description-mention syntax' subsection to `business-glossary.md` with the exact format, a worked example, and the case-folding note (the parser preserves case but `(ns, name)` lookup is `equalIgnoreCase`)."
  - "DOC-NNN (HIGH): the live doc page does NOT name the auto-link side-channel — that a user with `DATA_ENTITY_DESCRIPTION_UPDATE` only (no `DATA_ENTITY_ADD_TERM`) can create term-link rows via `[[ns:term]]` in a description edit. The two permissions look orthogonal to a reader of the doc page but are connected via this side-channel. Add a 'Description-mention side-channel and permissions' note to `business-glossary.md` calling this out."
  - "DOC-NNN (MEDIUM): the live doc page does NOT name the description-mention GUARDS on `updateTerm` and `delete` — that renaming a term or deleting a term is BLOCKED with a 400 BadUserRequestException 'Can't update/delete term, which was mentioned in description' if any active data-entity / dataset-field / term description still mentions the term via `[[ns:term]]`. This is a real operator-facing constraint that surfaces as a 400 today but is invisible until hit."
  - "DOC-NNN (MEDIUM): the live doc page does NOT name the unhandled-mention staging — that a `[[ns:NEW_TERM]]` mention for a term that doesn't yet exist is NOT silently dropped, but is staged in `*_unhandled_term` tables and AUTOMATICALLY materialises into a real link row when the matching term is later created (`resolveUnhandledDescriptionMentions`). This is an undocumented backward-resolution feature that operators would not predict."
  - "DOC-NNN (LOW): the live doc page does NOT describe the read-side `removeDuplicateNonDescriptionTerms` behaviour — that when a term is BOTH manually-linked and description-mentioned for the same data entity, the read API surfaces only ONE LinkedTerm (the description variant). The underlying DB rows persist (the PK is `(data_entity_id, term_id, is_description_link)`); the collapse is read-time only. Operators inspecting the DB directly would see two rows; operators reading the API would see one."
  - "DOC-NNN (HIGH): the live doc page links to `developer-guides/api-reference/glossary` for the HTTP surface but the API Reference page (when this sidecar was written) carries the same REFACTOR-217 path-mismatch ambiguity as the code (`/api/dataentities/{id}/terms` is the real path; SecurityConstants registers `/term` singular). The doc should NOT pretend the API is gated by `DATA_ENTITY_ADD_TERM` if the gate doesn't fire — document the current state honestly OR fix the code, but do not document a fictitious posture."

## implicit_adrs

- "**Term natural key is `(namespace, name)` case-insensitively.** Two terms `finance/Customer` and `finance/customer` cannot coexist in the same namespace; lookups are case-insensitive throughout." — evidence: `TermServiceImpl.java:107-113, 333-334, 548-549` + `ReactiveTermRepositoryImpl.java:156-157, 167` — intent_anchor: "`TERM.NAME.equalIgnoreCase(name).and(TERM.DELETED_AT.isNull()).and(NAMESPACE.NAME.equalIgnoreCase(namespaceName))`" (`ReactiveTermRepositoryImpl.java:156-157`) — confidence: HIGH
- "**Description-mention rows are stored as `is_description_link=TRUE`; manual links are `is_description_link=FALSE`; the PK `(parent_id, term_id, is_description_link)` allows both to coexist as separate rows.** The read-side `removeDuplicateNonDescriptionTerms` collapses the pair into one LinkedTerm at projection time, preferring the description variant. This is intentional — the description-mention flag is preserved so the activity feed and UI can distinguish 'this link was authored by a description edit' from 'this link was manually attached'." — evidence: `TermServiceImpl.java:444-448` + the `IS_DESCRIPTION_LINK` column wiring across `buildDataEntityDescriptionTermRelations` (line 481-489), `buildDatasetFieldDescriptionTermRelations` (line 491-499), `buildTermDescriptionTermRelations` (line 524-532) — intent_anchor: "`return terms.groupBy(dto -> dto.term().getTerm().getId()).flatMap(group -> group.reduce((dto1, dto2) -> dto1.isDescriptionLink() ? dto1 : dto2));`" (`TermServiceImpl.java:445-447`) — confidence: HIGH
- "**Description-mention guard blocks rename/delete; allows definition-only updates.** A term cannot be renamed or deleted while any active (non-soft-deleted parent) description mentions it via `[[ns:term]]`. A term's definition CAN be edited freely because mentions are stored by `(ns, name)` text, not term-id — definition edits don't break link resolution." — evidence: `TermServiceImpl.java:125-127, 128-134, 156-160` + `ReactiveTermRepositoryImpl.java:408-433` — intent_anchor: "`sink.error(new BadUserRequestException(\"Can't update term, which was mentioned in description\"));`" (`TermServiceImpl.java:130-131`) — confidence: HIGH
- "**Unhandled-mention staging with auto-resolution on term-create.** A `[[ns:term]]` mention for a non-existent term is NOT dropped — it is staged in `*_unhandled_term` tables (`buildDataEntityUnknownTerms` etc., lines 501-544) and AUTOMATICALLY materialised into a real link row when a matching term is later created (`resolveUnhandledDescriptionMentions`, lines 421-442). This is intentional forward-compatibility: operators authoring descriptions can reference terms they plan to create later, and the platform reconciles when the term arrives." — evidence: `TermServiceImpl.java:116, 421-442, 501-544` — intent_anchor: "`return termRepository.getByNameAndNamespace(formData.getNamespaceName(), formData.getName()).handle((dto, sink) -> { if (dto != null) { sink.error(...); } }).then(createTermMono).flatMap(this::updateSearchVectors).flatMap(term -> resolveUnhandledDescriptionMentions(term).thenReturn(term));`" (`TermServiceImpl.java:107-116`) — confidence: HIGH
- "**`@ReactiveTransactional` perimeter on every mutator; reads are read-committed.** Every mutating method carries `@ReactiveTransactional`; read methods (`getTerms`, `getTermByNamespaceAndName`, `getTermDetails`, `listByTerm`, `getDataEntityTerms`, `getDatasetFieldTerms`) do not. The transactional boundary sits at the service tier, not the controller." — evidence: `TermServiceImpl.java:100, 120, 154, 168, 182, 199, 210, 224, 242, 253, 289, 298` — intent_anchor: "Twelve mutator-method declarations all preceded by `@ReactiveTransactional`; six read methods at lines 84, 92, 148, 267, 273, 279 have no transaction annotation" — confidence: HIGH
- "**Activity events emitted only on mutations affecting data-entity / dataset-field-term links — NOT on Term CRUD itself.** `linkTermWithDataEntity`, `removeTermFromDataEntity`, `handleDataEntityDescriptionTerms` emit `TERM_ASSIGNMENT_UPDATED`; `linkTermWithDatasetField`, `removeTermFromDatasetField`, `handleDatasetFieldDescriptionTerms` emit `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`. `createTerm`, `updateTerm`, `delete`, `upsertTags`, `linkTermWithTerm`, `removeTermToLinkedTermRelation` have NO `@ActivityLog` annotation — Term-itself mutations are NOT in the activity feed." — evidence: `TermServiceImpl.java:99-117 (no @ActivityLog), 121-145 (no), 154-165 (no), 169 (yes), 183 (yes), 200 (yes), 211 (yes), 225 (yes), 243 (yes), 253-264 (no), 289-302 (no)` — intent_anchor: "Six methods are decorated with `@ActivityLog(event = …)`; six other mutator methods are not" — confidence: HIGH"

## bugs_limitations_corner_cases

- "**REFACTOR-217 path-mismatch primary source — `DATA_ENTITY_ADD_TERM` is unenforced for `POST /api/dataentities/{id}/terms`.** `SecurityConstants.java:237-239` registers a matcher on `/api/dataentities/{data_entity_id}/term` (singular); OpenAPI declares the operation at `/api/dataentities/{data_entity_id}/terms` (plural — `openapi.yaml:973`). The matcher never fires; the `linkTermWithDataEntity` service method (`TermServiceImpl.java:170-179`) is reachable by any authenticated user. Same applies to DELETE — `SecurityConstants.java:240-242` singular vs `openapi.yaml:1042` plural — `removeTermFromDataEntity` (`TermServiceImpl.java:184-196`) is similarly unenforced." — evidence: `TermServiceImpl.java:170-196` + `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` — severity: HIGH
- "**Second SecurityConstants bug (independent) — `/api/alerts/{alert_id}/status` PUT is gated by `DATASET_FIELD_ADD_TERM`.** `SecurityConstants.java:295-296` registers `new SecurityRule(ALERT, new PathPatternParserServerWebExchangeMatcher(\"/api/alerts/{alert_id}/status\", PUT), DATASET_FIELD_ADD_TERM)` — a Term permission applied to an alert-status path. Almost certainly a copy/paste error: the AlertController.changeAlertStatus endpoint should gate on `DATA_ENTITY_ALERT_RESOLVE`. Effect: an operator with `DATASET_FIELD_ADD_TERM` can change alert statuses on any data entity; an operator with `DATA_ENTITY_ALERT_RESOLVE` (the named permission for that operation) cannot. Cross-ref: AlertController sidecar should be augmented with this finding." — evidence: `SecurityConstants.java:295-296` — severity: HIGH
- "**Auto-link side-channel — description edit bypasses `DATA_ENTITY_ADD_TERM`.** A user holding `DATA_ENTITY_DESCRIPTION_UPDATE` (the gate on `PUT /api/dataentities/{id}/description`) can paste `[[finance:Customer]]` into a description; `handleDataEntityDescriptionTerms` (`TermServiceImpl.java:201-207`) parses the mention and INSERTs into `data_entity_to_term` with `is_description_link=TRUE`. The `DATA_ENTITY_ADD_TERM` permission that gates the direct-link endpoint is NEVER consulted on this path. Cross-ref: `DataEntityServiceImpl.java:328` is the invocation site. Even if REFACTOR-217 were fixed, this side-channel would remain — the auto-link path is service-tier, not controller-tier, so a service-tier permission check is needed (or a doc admission that description-mention is part of the description-update permission's scope)." — evidence: `TermServiceImpl.java:201-207` + `DataEntityServiceImpl.java:323-333` + `SecurityConstants.java:194-197` (the description-update gate) + `SecurityConstants.java:237-239` (the link-term gate that the side-channel bypasses) — severity: HIGH
- "**Cross-namespace term pollution / no per-tenant scoping.** Neither `TermServiceImpl` nor `ReactiveTermRepositoryImpl` references `odd.tenant-id` or any tenant scoping. `getByNameAndNamespace(List<TermBaseInfoDto>)` (`ReactiveTermRepositoryImpl.java:162-179`) joins `term` and `namespace` with NO tenant filter. In any deployment where multiple teams share a single platform instance, a description in team-A's namespace that references `[[team-B-ns:term]]` will silently auto-link to team-B's term. There is no concept-level isolation between namespaces in this code path." — evidence: `ReactiveTermRepositoryImpl.java:162-179` + `TermServiceImpl.java:350-359` (cross-namespace lookup is the batch call) — severity: MEDIUM
- "**TermAssignmentActivityHandler triple-re-query (REFACTOR-228 primary source).** `removeTermFromDataEntity` (`TermServiceImpl.java:184-196`) emits `TERM_ASSIGNMENT_UPDATED`; `TermAssignmentActivityHandler.getContextInfo` re-queries `getDataEntityTerms` (1st full-list query) BEFORE method execution; the method itself calls `getDataEntityTerms` at line 188 (2nd full-list query, drives `markEntityUnfilled` decision); the handler's `getUpdatedState` re-queries AGAIN (3rd full-list query) AFTER. For a data entity with 100 linked terms, a single de-link produces 3 full-list re-queries plus 1 DELETE. The same triple-re-query pattern applies to `removeTermFromDatasetField` (line 226-239)." — evidence: `TermServiceImpl.java:184-196` + `TermAssignmentActivityHandler.java:30-43` — severity: MEDIUM
- "**`linkTermWithDataEntity` and `linkTermWithDatasetField` are asymmetric on duplicate-INSERT handling.** `linkTermWithDataEntity` (`TermServiceImpl.java:173-174`) translates the empty INSERT result to `BadUserRequestException 'Term already assigned to data entity'`. `linkTermWithDatasetField` (`TermServiceImpl.java:215`) has NO `.switchIfEmpty` — a duplicate INSERT silently succeeds, returning an empty Mono that flatMaps onwards into `termRepository.getTermRefDto(relation.getTermId())` with `relation == null` (NullPointerException risk — depends on the repository's null-handling)." — evidence: `TermServiceImpl.java:173-174 vs 215` — severity: MEDIUM
- "**`nameOrNamespaceHasChanged` method name is the inverse of its boolean.** The method body returns TRUE when name AND namespace are BOTH unchanged; the name `nameOrNamespaceHasChanged` suggests TRUE means 'something changed'. Calling code at line 125 uses the boolean correctly given the actual semantics (`if (returnTrue → unchanged) skip the description-relation guard`), but the name is misleading. A future refactor that reads the call site by the method name and 'fixes' the if-branch direction would invert the logic and silently allow rename-while-referenced." — evidence: `TermServiceImpl.java:125, 331-335` — intent_anchor: "`private boolean nameOrNamespaceHasChanged(...) { return existingTerm.getNamespace().getName().equalsIgnoreCase(formData.getNamespaceName()) && existingTerm.getTerm().getName().equalsIgnoreCase(formData.getName()); }`" — severity: MEDIUM
- "**`buildTermUnknownTerms` parameter named `datasetFieldId` is actually a `termId`.** The method at `TermServiceImpl.java:534-544` takes `final long datasetFieldId` but uses it as `setTargetTermId(datasetFieldId)`. The caller at line 470 passes `termId`. Runtime is correct (Java passes-by-name doesn't matter at runtime); the parameter name is mis-pasted from `buildDatasetFieldUnknownTerms` at line 503. A future maintainer reading the method body would be misled. Trivial fix." — evidence: `TermServiceImpl.java:470, 534-544` — severity: LOW
- "**`DatasetFieldDescriptionUnhandledTermRepositoryImpl` is injected by concrete class, not interface.** `TermServiceImpl.java:78` injects `private final DatasetFieldDescriptionUnhandledTermRepositoryImpl datasetFieldDescriptionUnhandledTermRepository;` — a concrete class rather than its interface (compare line 77 which injects the data-entity counterpart `DataEntityDescriptionUnhandledTermRepository` as an interface). Single-file inconsistency suggesting the dataset-field interface was never extracted. Refactoring opportunity." — evidence: `TermServiceImpl.java:77-78` — severity: LOW
- "**`upsertTags` is a TAG_CREATE side-channel.** Through `tagService.getOrCreateTagsByName(names)` (`TermServiceImpl.java:257`), an operator with `TERM_TAGS_UPDATE` can create new tags without holding `TAG_CREATE`. Cross-ref: same pattern in `OwnerController#createOwner` (REFACTOR-222 family) and `TermServiceImpl.createTerm` (`getOrCreate` namespace, REFACTOR-223). Aggregate finding: the platform's `getOrCreate*` pattern systematically allows tag/namespace creation through any endpoint that touches those entities, bypassing the dedicated `*_CREATE` permissions." — evidence: `TermServiceImpl.java:103, 138, 257` — severity: MEDIUM
- "**`upsertTags` is a delete-then-recreate, not a true upsert.** `TermServiceImpl.java:255-260` first `tagService.deleteRelationsWithTerm(termId, names)` removes ALL existing tag relations matching the new set, then re-INSERTs them via `tagService.createRelationsWithTerm`. The window between the two operations is inside a `@ReactiveTransactional` boundary (line 253), so the delete-then-recreate is atomic from a DB perspective — but the activity feed (if there were one for term-tag changes — there isn't, no `@ActivityLog`) would not see a no-op as a no-op. Less critical given the transactional perimeter and the absence of an activity event, but worth recording." — evidence: `TermServiceImpl.java:253-264` — severity: LOW
- "**Regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` (line 67) does not handle nested or escaped brackets.** A description containing `[[foo[bar]:baz]]` will match `[foo[bar]:baz]` against the FIRST inner `]]`-like pattern, producing an unexpected term lookup. There is no escaping mechanism (`\\[\\[`). Operators writing prose with bracket-heavy content (e.g., array notation in code blocks) may produce unintended term mentions." — evidence: `TermServiceImpl.java:67` — severity: LOW
- "**Soft-deleted data-entities allow descendant Term deletion despite mentioning the term.** The `hasDescriptionRelations` query (`ReactiveTermRepositoryImpl.java:408-433`) explicitly filters parent entity status `!= DELETED`. A term mentioned ONLY in a soft-deleted data-entity's description CAN be deleted (line 415, 425). When the soft-deleted entity is restored (`DataEntityStatusController.restore`), its description still contains `[[ns:term]]` text — but `term` no longer exists. The mention silently downgrades to 'unhandled' on the next description edit." — evidence: `TermServiceImpl.java:156-160` + `ReactiveTermRepositoryImpl.java:415, 425` — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — controller-tier authentication applies through the standard `SecurityConstants.SECURITY_RULES` pipeline. `INTERNAL_ONLY` for the service tier itself — `TermServiceImpl` does NOT inspect `auth.type` directly; behaviour is identical across the three UI auth modes (the service-tier permission gates are absent regardless). `DISABLED` skips authentication entirely. `S2S` does NOT apply (these are UI/API paths, not `/ingestion/*`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The service is invoked from `TermController` and from `DataEntityServiceImpl.upsertDescription` / `DatasetFieldServiceImpl.updateDescription` (both UI/API paths).
- **authorization_assertions**: [] — N/A. `TermServiceImpl` performs NO service-tier permission checks. All authorization is supposed to happen at the controller perimeter via `SecurityConstants.SECURITY_RULES` matchers in `AuthorizationCustomizer`. The service tier blindly trusts the call. Per the REFACTOR-217 path-mismatch finding, the controller-tier gate does NOT fire for `POST /api/dataentities/{id}/terms` and `DELETE /api/dataentities/{id}/terms/{term_id}` — making the entire term-linkage surface effectively unauthenticated-mutation-allowed.
- **owner_scoping**: `N/A — code is not data-scoped`. Term reads (`getTerms`, `getTermByNamespaceAndName`, `getTermDetails`, `listByTerm`, `getDataEntityTerms`, `getDatasetFieldTerms`) return every Term across every namespace to every authenticated user. The platform's read-collaborative posture (per `system-mission.md` line 267) applies: every authenticated user sees every Term in every namespace. This is consistent with the rest of the platform but worth recording given the namespace concept implies team isolation.
- **data_exposure**: [
    "Every Term in every namespace → any authenticated user via `getTerms` / `listByTerm` / `getTermByNamespaceAndName` (no per-namespace or per-owner filter applied at controller or service layer)",
    "Every term-to-data-entity association → any authenticated user via `getDataEntityTerms` (no scoping)",
    "Every term-to-dataset-field association → any authenticated user via `getDatasetFieldTerms` (no scoping)",
    "BadUserRequestException error messages leak operational state — 'Term already assigned to data entity', 'Can't update term, which was mentioned in description', 'Can't delete term, which was mentioned in description'. These messages are returned to the caller verbatim, exposing internal state about existing assignments and description references that the caller would not otherwise see. For a cross-namespace probe, an attacker holding `TERM_UPDATE` could enumerate which terms are referenced where by observing which renames are blocked."
  ]
- **known_security_gaps**: [
    "REFACTOR-217 path mismatch — `DATA_ENTITY_ADD_TERM` and `DATA_ENTITY_DELETE_TERM` are unenforced for the real endpoints; ANY authenticated user can link/unlink terms on any data entity — evidence: `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` — severity: HIGH",
    "Second SecurityConstants bug — `/api/alerts/{alert_id}/status` PUT is gated by `DATASET_FIELD_ADD_TERM` instead of the intended Alert permission — evidence: `SecurityConstants.java:295-296` — severity: HIGH",
    "Description-edit auto-link side-channel — `DATA_ENTITY_DESCRIPTION_UPDATE` alone is sufficient to create term-link rows via `[[ns:term]]` in description text; `DATA_ENTITY_ADD_TERM` is never consulted — evidence: `TermServiceImpl.java:201-207` + `DataEntityServiceImpl.java:328` — severity: HIGH",
    "`TAG_CREATE` bypass via `upsertTags` — `TERM_TAGS_UPDATE` allows creating tags through `tagService.getOrCreateTagsByName` — evidence: `TermServiceImpl.java:257` — severity: MEDIUM",
    "`NAMESPACE_CREATE` bypass via `createTerm` / `updateTerm` — `TERM_CREATE` / `TERM_UPDATE` allows creating namespaces through `namespaceService.getOrCreate(name)` — evidence: `TermServiceImpl.java:103, 138` — severity: MEDIUM",
    "Cross-namespace pollution — no per-tenant or per-namespace scoping at the service or repository layer; descriptions in one namespace can resolve `[[other-namespace:term]]` references and auto-link across team boundaries — evidence: `ReactiveTermRepositoryImpl.java:162-179` + `TermServiceImpl.java:350-359` — severity: MEDIUM",
    "Error-message info-leak — `BadUserRequestException` payloads expose existence and reference state ('Term already assigned to data entity', 'Can't update/delete term, which was mentioned in description') — evidence: `TermServiceImpl.java:110-111, 130-131, 159, 174` — severity: LOW"
  ]

## performance

- **hot_paths**: [
    "`findTermsInDescription` runs on EVERY description edit (data-entity, dataset-field, term) — `TermServiceImpl.java:337-360`. The regex compile happens once at static-final init (line 67 uses `Pattern.compile` outside any method); per-call cost is the regex match (O(N) on description length) + one DB round-trip (`getByNameAndNamespace(List)` — `ReactiveTermRepositoryImpl.java:162-179` batches all mentions into one query).",
    "`updateDataEntityDescriptionTermsState` (lines 362-389) and the two siblings (391-419, 450-479) issue 4-5 DB statements per description edit even when nothing changed: re-query existing description-link rows, compute delete-set, compute create-set, compute unknown-pojo-set, DELETE old, INSERT new, DELETE old unhandled, INSERT new unhandled. No early-exit when terms == existing.",
    "`getDataEntityTerms` / `getDatasetFieldTerms` (lines 267-276) run on every data-entity detail page load + every dataset-field detail page load + every activity-handler call. The result is collected to List (no streaming) and passed through `removeDuplicateNonDescriptionTerms` (groupBy + reduce — O(N)).",
    "FTS vector refresh on every Term create/update — `updateSearchVectors` (`TermServiceImpl.java:324-329`) calls `updateTermVectors(id)` AND `updateNamespaceVectorsForTerm(id)` AND (in `upsertTags`) `updateTagVectorsForTerm(id)`. Three full vector refreshes per term-modify operation."
  ]
- **throughput_characteristics**: [
    "Single-Term operations only — no batch create, no batch link, no batch unlink. Linking 100 terms to one data entity requires 100 separate `linkTermWithDataEntity` calls and 100 separate `@ReactiveTransactional` perimeters + 100 activity events + 200 full-list re-queries from the activity handler.",
    "`@ReactiveTransactional` — every mutator opens a DB transaction (line 100, 120, 154, 168, 182, 199, 210, 224, 242, 253, 289, 298) regardless of how many rows are touched. The transaction perimeter is per-method, not per-batch.",
    "Description-edit auto-link is single-shot — the entire `[[ns:term]]` reconciliation for a description happens in one `handleDataEntityDescriptionTerms` invocation, inside one `@ReactiveTransactional`. A description with 50 mentions issues 1 SELECT batch + 50 staging-or-link INSERTs / DELETEs in one transaction."
  ]
- **resource_allocation**: [
    "Regex `Pattern.compile` is `static final` (line 67) — compiled once at class load, shared across all calls. No per-call compilation cost.",
    "`findTermsInDescription` loads the entire match set into an `ArrayList<TermBaseInfoDto>` (line 342) before issuing the DB lookup — bounded by description length / mention frequency. A description with 10,000 mentions of `[[ns:term]]` would build a 10,000-element list.",
    "`getByNameAndNamespace(List<TermBaseInfoDto>)` builds a single `OR`-chained `WHERE` clause (`ReactiveTermRepositoryImpl.java:166-169` — `reduce(Condition::or)`); Postgres's `pg_stat_statements` will see a query with N `OR (name=… AND namespace=…)` predicates, one per mention. PG planner cost scales with the OR count; at large mention counts the planner may degrade to seqscan.",
    "No connection pooling concerns at the service tier — relies on the platform's R2DBC pool."
  ]
- **scaling_characteristics**: [
    "Stateless service — all state in Postgres; no in-memory caching of terms.",
    "No pagination on `getDataEntityTerms` / `getDatasetFieldTerms` — returns the full term list for an entity. A data entity with 10,000 linked terms (manual + description) returns a 10,000-row Flux collected to List. UI rendering and activity-handler re-queries scale O(N) with linked-term count per entity.",
    "`listByTerm` (line 279-286) DOES paginate via `page` / `size` — but the response wraps `total = item.size()` (line 285) which is the PAGE size, not the total count. `hasNext = false` is hard-coded. The pagination is structurally broken — the response always claims this is the last page, and `total` reflects the page rather than the full result set.",
    "No locking, no advisory locks, no leader-election concerns."
  ]
- **known_performance_gaps**: [
    "Triple-re-query in TermAssignmentActivityHandler — every link/unlink fires 3 full-list re-queries (REFACTOR-228 primary source) — evidence: `TermServiceImpl.java:170-179, 184-196` + `TermAssignmentActivityHandler.java:30-43` — severity: MEDIUM",
    "Broken pagination on `listByTerm` — `total` reflects page-size not full size; `hasNext` hard-coded false — evidence: `TermServiceImpl.java:279-286` — severity: MEDIUM",
    "No batch-link / batch-unlink endpoints — linking N terms requires N service calls and N transactions — evidence: `TermService.java:32-44` (interface lacks batch methods) — severity: LOW",
    "Description-edit auto-link runs 4-5 DB statements even on no-op edits (description unchanged); no early-exit when terms == existing description-link set — evidence: `TermServiceImpl.java:362-389, 391-419` — severity: LOW",
    "FTS vector refresh triple-fired on create/update — `updateTermVectors` + `updateNamespaceVectorsForTerm` + (on tag changes) `updateTagVectorsForTerm` — evidence: `TermServiceImpl.java:324-329, 261-262` — severity: LOW",
    "OR-chained `getByNameAndNamespace(List)` query may degrade at high mention counts due to PG planner OR-handling — evidence: `ReactiveTermRepositoryImpl.java:166-169` — severity: LOW"
  ]

## sources

- understanding ← `TermServiceImpl.java:1-552` + `TermService.java:17-57` + `system-mission.md:182-198` (pillar P-06) + `SecurityConstants.java:237-242, 295-296` + `openapi.yaml:973, 1042`
- concepts.entities.TermPojo ← `TermServiceImpl.java:40` (import) + `ReactiveTermRepositoryImpl.java:143-159`
- concepts.entities.NamespacePojo ← `TermServiceImpl.java:38, 69, 314` + `ReactiveTermRepositoryImpl.java:156-157, 167`
- concepts.entities.TermBaseInfoDto ← `TermServiceImpl.java:27` (import) + `TermServiceImpl.java:347` (construction)
- concepts.entities.DescriptionParsedTerms ← `DescriptionParsedTerms.java:6` + `TermServiceImpl.java:337-360`
- concepts.entities.DataEntityToTermPojo ← `TermServiceImpl.java:35` (import) + `TermServiceImpl.java:481-489`
- concepts.entities.LinkedTermDto ← `LinkedTermDto.java:3` + `TermServiceImpl.java:176`
- concepts.entities.ActivityEventTypeDto ← `TermServiceImpl.java:24` (import) + lines 169, 183, 200, 211, 225, 243
- concepts.operations.createTerm ← `TermServiceImpl.java:99-117`
- concepts.operations.updateTerm ← `TermServiceImpl.java:121-145`
- concepts.operations.delete ← `TermServiceImpl.java:154-165`
- concepts.operations.linkTermWithDataEntity ← `TermServiceImpl.java:170-179`
- concepts.operations.removeTermFromDataEntity ← `TermServiceImpl.java:184-196`
- concepts.operations.handleDataEntityDescriptionTerms ← `TermServiceImpl.java:201-207` + `DataEntityServiceImpl.java:328`
- concepts.operations.linkTermWithDatasetField ← `TermServiceImpl.java:212-221`
- concepts.operations.handleDatasetFieldDescriptionTerms ← `TermServiceImpl.java:244-250` + `DatasetFieldServiceImpl.java:90`
- concepts.operations.upsertTags ← `TermServiceImpl.java:253-264`
- concepts.operations.linkTermWithTerm ← `TermServiceImpl.java:289-302`
- concepts.operations.findTermsInDescription ← `TermServiceImpl.java:337-360`
- concepts.invariants.* ← `TermServiceImpl.java:100, 107-113, 125-127, 164, 444-448` + `ReactiveTermRepositoryImpl.java:143, 156-157, 408-433`
- dependencies_semantic.requires-feature.* ← `TermServiceImpl.java:69-78` (injected deps) + `system-mission.md:194-198` (pillar P-06)
- dependencies_semantic.couples-to.* ← `TermServiceImpl.java:69-81` (injected deps) + `TermController.java:44` + `DataEntityServiceImpl.java:328` + `DatasetFieldServiceImpl.java:90`
- tests_coverage_semantic.test_files ← grep verification: `find <odd-platform-repo>/odd-platform-api/src/test -name 'TermService*Test*'` returns zero matches; `grep -rln 'TermServiceImpl\\|linkTermWithDataEntity\\|findTermsInDescription' <odd-platform-repo>/odd-platform-api/src/test` returns only `DataEntityServiceTest.java:80` (declares `@Mock private TermService termService;` but never invokes any method)
- docs_link_semantic.declared_docs ← N/A (no @docs annotation in source)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` 2026-05-19 status 200 + cross-checked against local `documentation/docs/data-glossary/business-glossary.md:1-141`
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-glossary` 2026-05-19 status 200 + cross-checked against local `documentation/docs/data-glossary.md`
- docs_link_semantic.doc_drift_findings[0-5] ← live-doc content (WebFetched 2026-05-19) + code in `TermServiceImpl.java:67, 201-207, 125-127, 156-160, 421-442, 444-448`
- implicit_adrs[0] term-natural-key ← `TermServiceImpl.java:107-113, 333-334, 548-549` + `ReactiveTermRepositoryImpl.java:156-157, 167`
- implicit_adrs[1] description-link-flag ← `TermServiceImpl.java:444-448, 481-499, 524-532`
- implicit_adrs[2] description-mention-guard ← `TermServiceImpl.java:125-134, 156-160` + `ReactiveTermRepositoryImpl.java:408-433`
- implicit_adrs[3] unhandled-staging-with-auto-resolve ← `TermServiceImpl.java:116, 421-442, 501-544`
- implicit_adrs[4] reactive-transactional-perimeter ← `TermServiceImpl.java:100, 120, 154, 168, 182, 199, 210, 224, 242, 253, 289, 298`
- implicit_adrs[5] activity-event-asymmetry ← `TermServiceImpl.java:99-117, 169, 183, 200, 211, 225, 243, 253-264, 289-302`
- bugs_limitations_corner_cases[0] REFACTOR-217 ← `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042` + `TermServiceImpl.java:170-196`
- bugs_limitations_corner_cases[1] alerts-status-DATASET_FIELD_ADD_TERM ← `SecurityConstants.java:295-296`
- bugs_limitations_corner_cases[2] auto-link-side-channel ← `TermServiceImpl.java:201-207` + `DataEntityServiceImpl.java:328` + `SecurityConstants.java:194-197, 237-239`
- bugs_limitations_corner_cases[3] cross-namespace-pollution ← `ReactiveTermRepositoryImpl.java:162-179` + `TermServiceImpl.java:350-359`
- bugs_limitations_corner_cases[4] REFACTOR-228 triple-re-query ← `TermServiceImpl.java:184-196` + `TermAssignmentActivityHandler.java:30-43`
- bugs_limitations_corner_cases[5] asymmetric-switchIfEmpty ← `TermServiceImpl.java:173-174 vs 215`
- bugs_limitations_corner_cases[6] nameOrNamespaceHasChanged-misnamed ← `TermServiceImpl.java:125, 331-335`
- bugs_limitations_corner_cases[7] buildTermUnknownTerms-misnamed-param ← `TermServiceImpl.java:470, 534-544`
- bugs_limitations_corner_cases[8] DatasetFieldDescriptionUnhandledTermRepositoryImpl-concrete-injection ← `TermServiceImpl.java:77-78`
- bugs_limitations_corner_cases[9] TAG_CREATE-via-upsertTags ← `TermServiceImpl.java:257`
- bugs_limitations_corner_cases[10] upsertTags-delete-then-recreate ← `TermServiceImpl.java:253-264`
- bugs_limitations_corner_cases[11] regex-no-escaping ← `TermServiceImpl.java:67`
- bugs_limitations_corner_cases[12] soft-deleted-parent-allows-term-delete ← `TermServiceImpl.java:156-160` + `ReactiveTermRepositoryImpl.java:415, 425`
- security.auth_mode_relevance ← service has no `@ConditionalOnProperty`; `SecurityConstants.java:237-242` (controller-tier rule); `system-mission.md:251-268` (auth mode framing)
- security.authorization_assertions ← absence verified — `grep -n '@PreAuthorize\\|hasPermission\\|hasRole\\|permissionService' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/term/TermServiceImpl.java` returns zero matches
- security.owner_scoping ← `ReactiveTermRepositoryImpl.java:140-179` no owner filter; `system-mission.md:267` read-collaborative posture
- security.data_exposure[0-4] ← `TermServiceImpl.java:84-97, 148-151, 267-286, 110-111, 130-131, 159, 174`
- security.known_security_gaps[0] ← `SecurityConstants.java:237-242` + `openapi.yaml:973, 1042`
- security.known_security_gaps[1] ← `SecurityConstants.java:295-296`
- security.known_security_gaps[2] ← `TermServiceImpl.java:201-207` + `DataEntityServiceImpl.java:328`
- security.known_security_gaps[3] ← `TermServiceImpl.java:257`
- security.known_security_gaps[4] ← `TermServiceImpl.java:103, 138`
- security.known_security_gaps[5] ← `ReactiveTermRepositoryImpl.java:162-179` + `TermServiceImpl.java:350-359`
- security.known_security_gaps[6] ← `TermServiceImpl.java:110-111, 130-131, 159, 174`
- performance.hot_paths[0] findTermsInDescription ← `TermServiceImpl.java:67, 337-360` + `ReactiveTermRepositoryImpl.java:162-179`
- performance.hot_paths[1] update*DescriptionTermsState ← `TermServiceImpl.java:362-389, 391-419, 450-479`
- performance.hot_paths[2] getDataEntityTerms/getDatasetFieldTerms ← `TermServiceImpl.java:267-276, 444-448`
- performance.hot_paths[3] updateSearchVectors triple ← `TermServiceImpl.java:324-329, 261-262`
- performance.throughput.* ← `TermServiceImpl.java:170-179, 100-298` (per-method `@ReactiveTransactional`) + `TermService.java:17-57` (no batch methods)
- performance.resource_allocation.* ← `TermServiceImpl.java:67, 342` + `ReactiveTermRepositoryImpl.java:166-169`
- performance.scaling_characteristics.* ← `TermServiceImpl.java:267-286` + absence of pagination on `getDataEntityTerms` / `getDatasetFieldTerms`
- performance.known_performance_gaps[0] REFACTOR-228 ← `TermServiceImpl.java:170-179, 184-196` + `TermAssignmentActivityHandler.java:30-43`
- performance.known_performance_gaps[1] broken-pagination-listByTerm ← `TermServiceImpl.java:279-286`
- performance.known_performance_gaps[2] no-batch-endpoints ← `TermService.java:17-57`
- performance.known_performance_gaps[3] no-early-exit-description-edit ← `TermServiceImpl.java:362-389`
- performance.known_performance_gaps[4] triple-FTS-refresh ← `TermServiceImpl.java:324-329, 261-262`
- performance.known_performance_gaps[5] OR-chained-getByNameAndNamespace ← `ReactiveTermRepositoryImpl.java:166-169`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence of tests verified via filesystem grep)
- docs_link_semantic: HIGH (two live URLs WebFetched 2026-05-19, both status 200, content cross-checked against local clone)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes
