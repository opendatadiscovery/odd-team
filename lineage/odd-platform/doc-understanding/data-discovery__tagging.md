---
doc_page: "docs/data-discovery/tagging.md"
page_title: "Manual Object Tagging"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/tagging"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Tag"
    - "LSN-019 — listMostPopular NAME-vs-BEHAVIOR drift (pagination precedes ranking; outer count-DESC cannot reach excluded rows)"
    - "Spec-documented auto-create with scope-asymmetry — Tag side-door past TAG_CREATE"
    - "getPopularTagList open-read + per-entity-tag-editors compose to WRITE+READ directory bypass (HIGH severity, batch W cross-batch closure; STRENGTHENED batch VAL-LSN-019 with TagServiceImpl service-tier confirmation of zero-auth posture)"
    - "Term-tag relation has NO external/origin carve-out — tag_to_term replace-all removes every relation"
  features:
    - "F-018"
  code_nodes:
    - "odd-platform java TagController controller-method:getPopularTagList"
    - "odd-platform java TagController controller-method:createTag"
    - "odd-platform java TagController controller-method:updateTag"
    - "odd-platform openapi tags openapi-tag:tag"
audience: [operator]
doc_claim_vs_code:
  - "Page (Known-limitations caveat 1) claims the 'Top tags' strip + Tag-facet seed list are sorted by tag id, not popularity, citing a 35-tags/size=30 empirical test where the 5 youngest tags are absent — CONFIRMED, not drift. listMostPopular pre-truncates by TAG.ID ASC inside the CTE (paginate at ReactiveTagRepositoryImpl.java:148) before the outer count-DESC re-order (line 158); the same 35-tag/size=30 reproduction is recorded at retrospectives/LSN-019:23-32. Evidence: invariant:lsn-019-listmostpopular-name-vs-behavior-drift-pagination-precedes-ranking / ReactiveTagRepositoryImpl.java:137-167; TagServiceImpl.java:72-77; spec 'sorted by popularity' at openapi.yaml:345."
  - "Page (Known-limitations caveat 2) claims five paths mint new tags (POST /api/tags, the three *_TAGS_UPDATE PUTs, and collector ingestion via ExternalTagIngestionRequestProcessor), all routing through getOrCreateTagsByName, so restricting TAG_CREATE does not close the directory — CONFIRMED. getOrCreateTagsByName is called from DatasetFieldServiceImpl.java:202 (column tags), TermServiceImpl.java:257 (term tags), ExternalTagIngestionRequestProcessor.java:104 (collector ingestion), and the data-entity path; none consults TAG_CREATE. Spec documents the auto-create at openapi.yaml:1174. Evidence: invariant:spec-documented-auto-create-with-scope-asymmetry-tag-side-door-past-tag-create; entitie:tag finding (a)/(b)."
  - "Page (Known-limitations caveat 2) states the collector ingestion mint path is not RBAC-gated and cannot be locked via permissions — CONFIRMED. ExternalTagIngestionRequestProcessor.java:104 mints tags on the S2S ingestion path with no per-tag permission. Evidence: entitie:tag finding (h) (ingestion-side write produces no activity-feed entry); ExternalTagIngestionRequestProcessor.java exists at service/ingestion/processor/."
  - "Page (Known-limitations caveat 3 / info hint) claims tag names are case-sensitive — `finance` and `Finance` are distinct rows — CONFIRMED. listByNames uses case-sensitive `TAG.NAME.in(names)` and divideTagsByExistence uses `existingTagNames.contains(n)` (case-sensitive); novel-casing names mint duplicate rows. Evidence: entitie:tag finding (c); TagServiceImpl divideTagsByExistence."
  - "Page (Known-limitations caveat 4) claims a three-way audit asymmetry: data-entity tag PUT emits TAG_ASSIGNMENT_UPDATED, dataset-field tag PUT emits DATASET_FIELD_TAGS_UPDATED, term tag PUT emits NO activity event — CONFIRMED at primary source. DataEntityServiceImpl.upsertTags @ActivityLog(TAG_ASSIGNMENT_UPDATED) (DataEntityServiceImpl.java:358); DatasetFieldServiceImpl @ActivityLog(DATASET_FIELD_TAGS_UPDATED) (DatasetFieldServiceImpl.java:119); TermServiceImpl.upsertTags (TermServiceImpl.java:252-264) carries NO @ActivityLog. Evidence: invariant:term-tag-relation-has-no-external-carve-out; entitie:tag finding (h)."
  - "Drift NOT found, recorded for completeness: every operator-facing claim on the page (RBAC TAG_* table, side-channel mint paths, popularity-ranking limitation, case-sensitivity, audit asymmetry) traces to a confirmed ontology invariant or to the entitie:tag concept's primary-source findings. This page is an accurate operator-facing projection of the F-018 feature-flow's confirmed drift set; the caveats are pre-emptive operator guidance, not contradictions."
maintainer_curated: false
---

# Manual Object Tagging — doc understanding

This page is the operator-facing read-side home for tagging: what a tag is, how to apply tags to entities and columns, the three discovery paths (Search Tag facet, Catalog Overview Top-tags strip, per-entity badges), and a substantial Known-limitations block. It maps to feature `F-018` ("Manual Object Tagging — operator + ingestion-driven Tag directory with side-channel mint paths") and to the `Tag` concept (`entitie:tag`), whose persistence surface is `ReactiveTagRepositoryImpl` and service tier is `TagServiceImpl`. The four directory-CRUD operations the page references generate `TagApi`, implemented by `TagController` (`getPopularTagList` / `createTag` / `updateTag` / `deleteTag`).

The page is unusually high-fidelity: each of its four caveats is a primary-source-confirmed ontology invariant rather than doc drift. The "Top tags sorted by id not popularity" warning is `invariant:lsn-019-listmostpopular-name-vs-behavior-drift-pagination-precedes-ranking` (paginate-inside-CTE at `ReactiveTagRepositoryImpl.java:148` precedes the outer count-DESC at line 158); the page even reproduces the maintainer's 35-tags/`size=30` empirical test from `retrospectives/LSN-019:23-32`. The five-mint-paths caveat is the `getOrCreateTagsByName` side-door (`invariant:spec-documented-auto-create-with-scope-asymmetry-tag-side-door-past-tag-create`), with call sites confirmed at `DatasetFieldServiceImpl.java:202`, `TermServiceImpl.java:257`, and `ExternalTagIngestionRequestProcessor.java:104`. The audit-asymmetry caveat is confirmed by reading the three write methods: only `TermServiceImpl.upsertTags` (`TermServiceImpl.java:252-264`) lacks an `@ActivityLog` annotation. No contradicting drift was found; the page's value is exactly that it surfaces these code-level traps to operators before they hit them.

## Maintainer notes
