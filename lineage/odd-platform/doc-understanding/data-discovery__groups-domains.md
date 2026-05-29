---
doc_page: "docs/data-discovery/groups-domains.md"
page_title: "Data Entity Groups & Domains"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/groups-domains"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/groups-domains"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    # NOTE: these concept nodes are confirmed via graph-node (batch 2026-05-19L/M
    # sidecars) but are NOT yet merged into concepts.yaml (catalog v8 / commit
    # ede5d277 / 50 sidecars predates batch L/M). Bound here by their graph
    # node_id since no canonical concepts.yaml name exists yet. See
    # doc_claim_vs_code note on the stale catalog.
    - "operation:bind-data-entity-as-deg-child-member"
    - "entitie:data-entity-group-membership-edge"
    - "invariant:write-collaborative-deg-no-deg-side-authorization"
    - "invariant:deg-membership-read-vs-write-authorization-asymmetry"
    - "operation:get-data-entity-group-lineage-flat-graph"
    - "entitie:deg-anchored-lineage"
  features:
    - "F-012"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:addDataEntityDataEntityGroup"
    - "odd-platform java DataEntityController controller-method:deleteDataEntityFromDataEntityGroup"
audience: [operator, developer]
doc_claim_vs_code:
  - "RESOLVED / NO DRIFT — page now documents the per-CHILD authorization gate accurately. Page (Managing DEG Membership) claims both DATA_ENTITY_ADD_TO_GROUP and DATA_ENTITY_DELETE_FROM_GROUP are 'scoped against the child data_entity_id in the URL — the authorisation rules do not consult the parent DEG.' VERIFIED exact against SecurityConstants.java:228-236 (both SecurityRules bind DATA_ENTITY resource type to the {data_entity_id} path var; group id is body-only for POST and a non-resource path var for DELETE) + PolicyPermissionDto.java:22-23 (both permissions DATA_ENTITY-scoped). Confirms invariant:write-collaborative-deg-no-deg-side-authorization."
  - "RESOLVED / NO DRIFT — page's danger hint ('DATA_ENTITY_RELATION_UPDATED ... is a dead value that the wider event-type enumeration mentions but no event ever triggers') is VERIFIED true: grep -rn DATA_ENTITY_RELATION_UPDATED across odd-platform returns exactly ONE hit, the enum declaration at ActivityEventTypeDto.java:12 — no @ActivityLog, no handler, no emission anywhere. Both addDataEntityToDEG (DataEntityServiceImpl.java:387-407) and deleteDataEntityFromDEG (DataEntityServiceImpl.java:411-438) carry only @ReactiveTransactional, no @ActivityLog. Confirms the page's forensic-silence claim."
  - "RESOLVED / NO DRIFT — page's idempotence-asymmetry warning is VERIFIED exact. ADD raises HTTP 400 'Data entity is already in this DEG' on duplicate (DataEntityServiceImpl.java:402 — switchIfEmpty(new BadUserRequestException(\"Data entity is already in this DEG\"))). DELETE returns silent 204 No Content on a no-op (DataEntityController.java:343-349 .thenReturn(noContent()); service deleteRelationsReturning path raises no error when no row matched). Page quotes both verbatim."
  - "RESOLVED / NO DRIFT — page's 'does NOT auto-create the target DEG' is consistent with code: addDataEntityToDEG filters the group pojo by isManuallyCreatedDEG and switchIfEmpty(BadUserRequestException 'Entity with id %s is not manually created DEG') at DataEntityServiceImpl.java:393-397. Page's '400 conflates three failure modes' (already-in-DEG / not-a-manually-created-DEG / bad body) maps to the two distinct BadUserRequestException sites + the optional-field id-null path."
  - "SUBSTRATE STALENESS (not page-vs-code drift) — concepts.yaml (catalog_version 8, generated_at_commit ede5d277, 50 sidecars) contains NO Data-Entity-Group / Domain / DEG-membership / ML-experiment concept entry (only 'Bind Owner to Data Entity (with optional DEG propagation)'). The six DEG-membership/lineage concept nodes this page DESCRIBES exist in the graph from batch 2026-05-19L/M sidecars but were never merged into the catalog. Evidence: concepts.yaml:5 sidecar_count=50; graph-node confirms operation:bind-data-entity-as-deg-child-member etc. A /concepts refresh is due so the catalog covers the DEG family. Doc-gap-class: substrate-coherence, not operator-facing."
  - "MECHANICAL-LAYER STALENESS (not page-vs-code drift) — doc-nodes.jsonl holds ONLY one node for this page (anchor data-entity-groups-domains, char_count 535, empty links[]), generated from a much earlier/shorter version. The current page (HEAD 30795b4) is ~5 KB with 7 H2 sections (What a DEG is / Domain framing / DEG metadata / ML Experiments / Managing DEG Membership / Group lineage / Where to next) and many cross-links. doc-nodes.jsonl needs regeneration (docs-ingest re-run) so per-section anchors and links are captured. Rule 5: not hand-edited."
maintainer_curated: false
---

# Data Entity Groups & Domains — doc understanding

This page is the canonical operator + developer reference for the Data Entity Group (DEG) primitive and its Domain-flag use. It documents (1) the DEG as a `DATA_ENTITY_GROUP`-class data entity that gathers children under group-level metadata/owners/tags/terms; (2) the Domain framing (a DEG flagged as a domain surfaces on the Catalog Overview's conditional Domains section); (3) the ML-experiment framing (a DEG of class `ML_EXPERIMENT`, with the accurate caveat that ODD is a catalog *view* over run assets, not an experiment-tracker); and (4) a deep "Managing DEG Membership" section covering the two write endpoints. The membership section binds to the implementing code with high fidelity: `addDataEntityDataEntityGroup` (`POST`, `DataEntityController.java:332`) and `deleteDataEntityFromDataEntityGroup` (`DELETE`, `DataEntityController.java:343`), feature **F-012**, and the `bind-data-entity-as-deg-child-member` operation / membership-edge entity / write-collaborative authorization invariant concepts.

The notable finding is a *positive* one: this page has **caught up to the code**. The two membership-controller sidecars (fetched 2026-05-19) flagged the page as "permission-, audit-, and security-silent" — but the current page (2026-05-29, HEAD 30795b4) now correctly documents, with operator mitigations, the per-child authorization gate (no DEG-side check), the Activity-Feed forensic silence (the dead `DATA_ENTITY_RELATION_UPDATED` enum value), the ADD/DELETE idempotence asymmetry (400 vs silent 204), the `auth.type=DISABLED` anonymous reachability, and empty-DEG persistence. Every one of those claims was re-verified against primary source in this session (`SecurityConstants.java:228-236`, `PolicyPermissionDto.java:22-23`, `ActivityEventTypeDto.java:12`, `DataEntityServiceImpl.java:387-438`, `DataEntityController.java:332-349`) and found exact. No operator-facing doc-vs-code drift remains. The only open items are substrate-coherence signals: concepts.yaml and doc-nodes.jsonl both predate the page's expansion and need refreshing.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
