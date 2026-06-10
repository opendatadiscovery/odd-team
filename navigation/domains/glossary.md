# Glossary

Business terms, definitions, term-to-entity assignments, term hierarchy.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/TermController.java` — full CRUD, ownership, tags, linked terms, query examples, search

### Services
- `odd-platform-api/.../service/term/TermService.java` — term CRUD, term-to-entity/term-to-term linking
- `odd-platform-api/.../service/term/TermSearchService.java` — dedicated term search with facets
- `odd-platform-api/.../service/term/TermOwnershipService.java` — term ownership management

### Key Features (from code)
- Term CRUD with namespaces
- Term ownership (create/update/delete owners)
- Term tagging
- Term-to-entity linking (data entities and dataset fields/columns)
- Term-to-term linking (direct API: `addLinkedTermToTerm`, `deleteLinkedTermFromTerm`)
- Query example associations
- Dedicated term search with facets
- Reverse lookup: which entities link to a term (`getTermLinkedEntities`, `getTermLinkedColumns`)

### API endpoints
- `GET/POST /api/terms` — list/create terms
- `GET/PUT/DELETE /api/terms/{term_id}` — term details/update/delete
- `GET /api/terms/{term_id}/entities` — linked entities
- `GET /api/terms/{term_id}/columns` — linked columns
- `GET /api/terms/{term_id}/linked_terms` — linked terms
- `POST /api/terms/{term_id}/term` — link an existing term to another term (`addLinkedTermToTerm`)
- `DELETE /api/terms/{term_id}/term/{linked_term_id}` — remove a term-to-term link (`deleteLinkedTermFromTerm`)
- `POST/DELETE /api/terms/{term_id}/query_examples` — query examples

## Documentation
- `documentation/docs/data-glossary/business-glossary.md` — feature page (live: `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary`); covers term CRUD, namespace scoping claim, 7 TERM_* permissions, term-to-entity link mechanics including `[[namespace:term]]` description-mention shorthand.
- **Known doc drift / known operator caveats** (per `lineage/odd-platform/feature-flows/detail/F-002.yaml`, `F-024.yaml`, `F-056.yaml`, `F-151.yaml`..`F-156.yaml` + scan runs SR-20260527T1400Z + SR-20260527T1800Z findings F-002a/b/c, F-024a/b/c, F-056a/b/c, F-151a/b/c, F-152a/b/c/d, F-153a, F-154a/b/c/d/e, F-155a/b, F-156a/b; tracked as backlog item **DOC-177** — pending triage):
  - Silent term-link authorization bypass (SecurityConstants `/term` SINGULAR vs OpenAPI `/terms` PLURAL — REFACTOR-217); DATA_ENTITY_ADD_TERM gate falls through to `.authenticated()`.
  - Description-edit auto-link side-channel — `[[ns:term]]` syntax materializes link rows bypassing DATA_ENTITY_ADD_TERM; cross-time drain on term-create silently materializes auto-links to entities authored by OTHER users WEEKS AGO.
  - Cross-namespace term enumeration — no per-namespace filter at any read site; doc's "scoped by namespace by default" promise is false at SQL layer.
  - is_description_link UI-asymmetry — TermLinkedEntitiesList shows no indicator; TermLinkedTermsList does.
  - Term detail page Overview tab fires DOUBLE-FETCH of the 12-JOIN hot path.
  - Term reverse-lookup tabs have hardcoded status:500 errors (F-152a — FIXME comment); silent pagination break on TermLinkedColumnsList (`next={() => {}}` — F-153a).
  - TermsForm authoring: client-side duplicate check fragile at scale; no error handler on submit; Markdown editor accepts <script> payloads (F-004 family 3rd Term-surface).
  - OverviewTags slice-then-sort bug — important tags silently hidden beneath "View All".
  - Tag/Namespace creation bypass via TagsEditForm + NamespaceAutocomplete (TERM_TAGS_UPDATE / TERM_CREATE silently invoke `getOrCreate` patterns).
- `documentation/docs/GLOSSARY.md` — stub (5 empty headers — pre-existing).

## Related code sites (added 2026-05-27 — scan run SR-20260527T1800Z)
- Repository: `odd-platform-api/.../repository/reactive/ReactiveTermRepositoryImpl.java` — `getTermDetailsDto` :194-238 (the 4-aggregation detail query; #1746 cross-namespace-linked-term namespace fix at :211, regression-pinned by `ReactiveTermRepositoryCrossNamespaceLinkTest` + IT-127), `extractTerms` :610-636, `listByTerm` :457-499, `getTermByIdAndLinkedTermId` :502-527. Relation seeding: `TermRelationsRepositoryImpl.createRelationWithTerm` :163-172 (added 2026-06-10 — CTRIB-002 review).
- UI hook: `odd-platform-ui/src/lib/hooks/useTermWiki.ts` — the shared `[[ns:term]]` mention hook (parse/resolve/deeplink-rewrite; null-namespace guard since #1746 at :51-58); mounted by `Terms/TermDetails/Overview/TermDefinition/TermDefinition.tsx` :16-23 (its tooltip shows the cross-namespace `[[Finance:User]]` example) (added 2026-06-10 — CTRIB-002 review).
- Service: `odd-platform-api/.../service/term/TermServiceImpl.java` — regex `\[\[([^:]*?):([^\]]*?)\]\]` at line 67; auto-link materialisation at lines 201-207; cross-time drain at lines 99-117 (createTerm) + 421-442 (resolveUnhandledDescriptionMentions).
- UI sub-tree (per F-151..F-156): `odd-platform-ui/src/components/Terms/TermDetails/{TermDetails,TermDetailsTabs,TermDetailsRoutes,Overview/{Overview,OverviewTags,TermLinkedTerms},TermLinkedTermsList/LinkedTermsList,TermLinkedColumnsList/LinkedColumnsList,TermLinkedEntitiesList,TermQueryExamples}.tsx`.
- UI form: `odd-platform-ui/src/components/Terms/TermsForm/TermsForm.tsx` — Create/Edit dialog (F-154 anchor).

## Related Domains
- data-entities (terms assigned to entities and fields)
- search (terms are searchable via dedicated search)
- collaboration (term ownership)
