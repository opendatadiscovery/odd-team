---
doc_page: "docs/data-glossary/business-glossary.md"
page_title: "Business Glossary"
live_url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-glossary/business-glossary"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Dictionary tab — Term catalog browse surface (UI shell for P-06 Data Glossary)"
    - "Term-mention Syntax `[[Namespace:TermName]]`"
    - "Term Definition Markdown body (third user-curated Markdown surface — same XSS class as internal_description)"
    - "Link Term to Data Entity"
    - "Authorization path-mismatch — SECURITY_RULES /term vs OpenAPI /terms silently disables permission gate"
    - "NAMESPACE_CREATE + TAG_CREATE side-doors via TermController unguarded paths (TERM_CREATE / TERM_UPDATE / TERM_TAGS_UPDATE bypass the dedicated CREATE permissions)"
    - "F-004 stored-XSS extends to TermDefinition — third Markdown rendering surface (data-entity description + dataset-field description + term definition)"
    - "SecurityConstants wiring failure — term-to-term linkage has NO SecurityRule (third independent SecurityConstants bug after REFACTOR-217 and the alerts-status DATASET_FIELD_ADD_TERM mis-gate)"
    - "[[ns:term]] auto-link side-channel — REFACTOR-227 primary source"
    - "Cross-component fetch duplication on hot path — Shell + Tab both fire getTermDetailsDto on every TermDetails mount (sibling class to LSN-017, expressed as cross-component composition)"
  features:
    - "F-024"   # Term Search & Browse — Dictionary tab faceted server-side session
    - "F-056"   # [[namespace:term]] description-mention auto-link bypassing DATA_ENTITY_ADD_TERM
    - "F-152"   # Term Linked-Terms tab (reverse-lookup)
    - "F-153"   # Term Linked-Columns tab (InfiniteScroll noop → 50-row silent cap)
    - "F-155"   # Term Query-Example tab
  code_nodes:
    - "odd-platform java TermController controller-method:deleteTerm"
    - "odd-platform java TermController controller-method:deleteLinkedTermFromTerm"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Term-to-term linking section) says the direct term-to-term Add term action is 'gated by TERM_UPDATE'; code shows the term-to-term link/unlink endpoints have NO SecurityRule at all and fall through to /** authenticated() — any authenticated user can link/unlink terms regardless of TERM_UPDATE. The section carries no caveat (unlike Known operator caveats). LSN-002-class doc omission of an operator-critical RBAC bypass. Evidence: invariant:securityconstants-term-to-term-no-security-rule-third-wiring-failure — TermController.java:237-243 (addLinkedTermToTerm POST /api/terms/{id}/term), TermController.java:246-249 (deleteLinkedTermFromTerm DELETE /api/terms/{id}/term/{linked_id}), AuthorizationCustomizer.java:29-30 catch-all; grep of SecurityConstants.java returns zero term-to-term rule matches."
  - "Page does not warn that the term-link RBAC bypasses are also exploitable at the SERVICE tier independent of the controller-path-rename fix. The flagship DANGER caveat frames the /term-vs-/terms mismatch as the cause; code shows the service-tier consumers (linkTermWithDataEntity, removeTermFromDataEntity, linkTermWithDatasetField, removeTermFromDatasetField, linkTermWithTerm, removeTermToLinkedTermRelation) carry ZERO permission checks, so a fix to the SecurityRule path alone does not fully close the bypass. Evidence: invariant:authorization-path-mismatch-security-rules-term-vs-openapi-terms-silently-disables-permission-gate (TermServiceImpl primary-source, batch 2026-05-19K)."
  - "Page (Known operator caveats → duplicate-name client check loading the first 1000 terms client-side, no edit-mode check) has no dedicated enriched substrate node — top Concept search hit was 0.71 and unrelated (the namespace/tag side-door invariant). Not contradicted by code, but unverified against the substrate; flag for doc-gap-finder to confirm the 1000-term-client-side claim and the edit-mode-skips-check claim against the Term create/edit UI. pillar-undocumented-class signal (doc asserts a specific UI behaviour the substrate has not yet enriched)."
maintainer_curated: false
---

# Business Glossary — doc understanding

This page is the canonical operator + developer reference for ODD Platform's Business Glossary: term entities (Data Entities of type `TERM`), the `/termsearch/*` Dictionary tab browse surface, namespace-scoped term identity, the two term-relationship mechanisms (inline `[[Namespace:TermName]]` description-mentions and direct term-to-term links), the seven `TERM_*` RBAC permissions, and a large `Known operator caveats` section. The page maps cleanly onto the ontology's deep model of this feature — its caveats are confirmations of enriched invariants, not assertions the substrate cannot back.

Every flagship caveat is confirmed against primary-source code: the term-link RBAC bypass via the `/term` (singular) vs `/terms` (plural) `SecurityConstants` path mismatch (`invariant:authorization-path-mismatch-security-rules-term-vs-openapi-terms-silently-disables-permission-gate`, `SecurityConstants.java:237-242` / `openapi.yaml:973,1042`); the `[[namespace:term]]` description-mention auto-link side-channel that writes link rows without `DATA_ENTITY_ADD_TERM` (`invariant:term-mention-auto-link-side-channel-primary-source`, `TermServiceImpl.java:337-360` + `handleDataEntityDescriptionTerms:201-207`); the namespace/tag auto-create side-doors past `NAMESPACE_CREATE` / `TAG_CREATE` (`invariant:namespace-create-tag-create-side-doors-via-termcontroller-unguarded-paths`, `TermServiceImpl.java:101-117,119-145`, `getOrCreate@103,138`); the term-definition stored-XSS surface (`invariant:f-004-stored-xss-extends-to-term-definition-third-markdown-surface` + `entitie:term-definition-markdown-body`, `TermServiceImpl.java:99-145` → `Markdown.tsx` rehype-raw without rehype-sanitize); the Linked-Columns 50-row silent cap (`F-153`, InfiniteScroll `next` wired to noop); and the double-query-per-page-open performance caveat (`invariant:cross-component-fetch-duplication-shell-plus-tab-double-fire-hot-path`, `TermDetails.tsx:37-45` shell + tab both fire `getTermDetailsDto`). The Dictionary-tab framing matches `entitie:dictionary-tab-term-catalog-browse-surface` + `F-024` (server-side faceted session at `/termsearch/*`).

The drift findings (frontmatter) are two operator-critical omissions plus one unverified claim: (1) the page tells operators the direct term-to-term Add-term action is `TERM_UPDATE`-gated, but those endpoints carry no SecurityRule and are open to any authenticated user — and unlike the term-to-entity bypass, this one has no caveat on the page; (2) the page frames the term-link bypass as solely a controller-path mismatch, omitting that the service tier carries zero permission checks so the path-rename fix alone is insufficient; (3) the duplicate-name "first 1000 terms client-side" caveat has no enriched substrate node — not contradicted, but unverified, flagged for doc-gap triage.

Code-node bindings in `describes.code_nodes` are the two confirmed `TermController` methods read directly via graph-node (`deleteTerm`, `deleteLinkedTermFromTerm`); the richer term-link/service evidence lives in the cited invariants' sidecars rather than as standalone enriched method nodes, so it is referenced by concept node_id rather than padded into `code_nodes`.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->
