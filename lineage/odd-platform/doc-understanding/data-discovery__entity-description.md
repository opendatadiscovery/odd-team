---
doc_page: "docs/data-discovery/entity-description.md"
page_title: "Entity description"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/entity-description"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/entity-description"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Internal Description (Markdown body)"
    - "Upsert Internal Description (Markdown)"
    - "Edit Internal Description (Markdown with term-resolution)"
  features:
    - "F-004"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:upsertDataEntityInternalDescription"
    - "odd-platform ts react-component component:DataEntityDescription"
audience: [operator]
doc_claim_vs_code:
  - "Page claims (line 51) the before-and-after description text is NOT included in the DESCRIPTION_UPDATED activity event payload, steering operators to query data_entity_history for content-diff reconstruction; code captures the FULL old AND new description text in the event payload. DescriptionUpdatedActivityHandler.getContextInfo sets oldState = getState(pojo.getInternalDescription()) and getUpdatedState returns getState(pojo.getInternalDescription()); getState serialises DescriptionActivityStateDto(String description) — the entire description string — to JSON, and ActivityMapper deserialises both back for the feed. The feed IS a content diff for descriptions, contradicting the page. Evidence: DescriptionUpdatedActivityHandler.java:30,35-37,40-41 + DescriptionActivityStateDto.java:3 + ActivityMapper.java:181-187 (node: odd-platform java DataEntityController controller-method:upsertDataEntityInternalDescription)."
  - "Page omits that a description edit emits a SECOND activity event — TERM_ASSIGNMENT_UPDATED — whenever the body contains [[ns:term]] mentions, because the same write path runs the term-linking flow unconditionally. The page's Activity-trail section names only DESCRIPTION_UPDATED. Evidence: TermServiceImpl.java:198-207 (@ActivityLog(TERM_ASSIGNMENT_UPDATED) on handleDataEntityDescriptionTerms) + DataEntityServiceImpl.java:323-333 (description-upsert invokes term-linking) (node: odd-platform java DataEntityController controller-method:upsertDataEntityInternalDescription)."
  - "Page's six-surface security table calls the renderer @uiw/react-md-editor without a version and frames React attribute-filtering + Chromium script policy as the live defence with <svg onload>/CSS-expression/javascript: vectors 'unmeasured'. Code pins the version at @uiw/react-md-editor@3.25.6 -> @uiw/react-markdown-preview@4.2.2 -> rehype-raw@6.1.1 (no rehype-sanitize, no skipHtml), and probe P-009 has EMPIRICALLY measured the in-browser outcome: script/img/iframe tags reach the DOM, the onerror attribute is stripped (dom_has_onerror_attr == False), no dialog fires, no leak. So the onerror vector is measured (mitigated by React), not unmeasured as the page implies — though the page's core claim (no platform-side write-time sanitisation) is correct. Evidence: pnpm-lock.yaml:5911-5938 + Markdown.tsx:112-124 + probe-runs/2026-05-19-P-009.yaml (node: odd-platform ts react-component component:DataEntityDescription)."
maintainer_curated: false
---

# Entity description — doc understanding

This operator-facing page documents the platform's primary per-entity free-text annotation: an operator-authored Markdown body stored verbatim in `data_entity.internal_description`, edited through the entity Overview tab and written via `PUT /api/dataentities/{id}/description`. It binds cleanly to feature **F-004** ("Data entity description — Markdown content storage"), the backend write handler (`upsertDataEntityInternalDescription`, `DataEntityController.java:202` — confirmed via graph-node: `PUT /api/dataentities/{data_entity_id}/description`, verbatim store, empty-string→NULL at `ReactiveDataEntityRepositoryImpl.java:431`, unbounded Postgres `text` since `V0_0_1__init.sql:80`), and the React render/edit cluster (`component:DataEntityDescription` — the `@uiw/react-md-editor` wrapper with `rehype-raw@6.1.1` and no `rehype-sanitize`/`skipHtml`, confirmed via graph-node + `pnpm-lock.yaml:5911-5938`). The `DATA_ENTITY_DESCRIPTION_UPDATE` permission gate (`SecurityConstants.java:194-197`) and the `DESCRIPTION_UPDATED` activity event (`DescriptionUpdatedActivityHandler.java`) are both real and correctly named. The page's stored-XSS security caveat is well-grounded: there is genuinely no platform-side write-time sanitisation across the six listed description-shaped surfaces (DatasetFieldController, QueryExampleController, ReferenceDataController, AlertManager/Slack senders all exist as confirmed graph nodes), and the only defence is rendering-tier happy-accident plus the operator-trust posture the page prescribes.

The page carries one materially misleading claim (the activity-payload assertion — see `doc_claim_vs_code` #1) and two omissions of operator-relevant behaviour (the second `TERM_ASSIGNMENT_UPDATED` event; the now-measured `onerror` vector). The activity-payload contradiction is the high-value finding: the page tells operators the audit feed retains no description content and to use `data_entity_history` for diffs, but the event payload stores the full old and new description strings — a privacy/compliance-relevant inversion of the truth, confirmed from source at `DescriptionUpdatedActivityHandler.java:30,35-37,40-41`.

Related existing finding (not a fresh drift from this page): **DOC-GAP-097** tracks that the `PUT .../description` operationId/OpenAPI summary uses "upsert" language while the implementation is a pure UPDATE that silently 200s on a missing entity. This page does not assert the upsert-creates semantics, so it does not itself trigger DOC-GAP-097, but a maintainer editing this page should keep the endpoint's true (replace-only) semantics in mind.

## Maintainer notes
