# SHB-028 — Term-to-term linkage has NO SecurityRule — docs claim TERM_UPDATE gates "directly-linked terms" but runtime accepts any authenticated user

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators reading the Business Glossary documentation (live `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` verified 2026-05-20 status 200) see the `TERM_UPDATE` permission described as "Edit the term's name, description, namespace, or **directly-linked terms**" and reasonably assume that linking term A to term B requires `TERM_UPDATE` on at least one of them. The runtime DOES NOT enforce this. `POST /api/terms/{term_id}/term` (addLinkedTermToTerm — TermController.java:237-243) and `DELETE /api/terms/{term_id}/term/{linked_term_id}` (deleteLinkedTermFromTerm — lines 246-249) have **NO SecurityRule entry** in `SecurityConstants.java` (verified exhaustively by grep per TermController sidecar bugs[0]). The catch-all `pathMatchers("/**").authenticated()` at `AuthorizationCustomizer.java:30` is the ONLY gate. Any authenticated user (LOGIN_FORM / OAUTH2 / LDAP) — including a read-only viewer with zero `TERM_*` permissions — can create or delete arbitrary term-to-term links on any term. An RBAC administrator who withholds `TERM_UPDATE` from a "read-only operators" role expecting them to be unable to mutate term relationships will silently fail-open: those operators can freely rewire the glossary's term graph.

## Evidence

- `lineage/odd-platform/understanding/odd-platform__java__TermController__controller-class__TermController.md:223` (bugs HEADLINE) — primary finding: "Term-to-term linkage endpoints (`POST /api/terms/{term_id}/term` and `DELETE /api/terms/{term_id}/term/{linked_term_id}`) have **NO SecurityRule entry** in `SecurityConstants.java`. Verified by exhaustive grep: `grep -nE '/api/terms/.*term\\b' SecurityConstants.java` returns ZERO matches."
- `odd-platform-api/src/main/java/.../config/SecurityConstants.java:111, 174-193` — 9 of TermController's 14 mutating endpoints have SecurityRules; the two term-to-term linkage endpoints have NONE.
- `odd-platform-api/src/main/java/.../config/AuthorizationCustomizer.java:29-30` — catch-all `.authenticated()` is the fall-through.
- `odd-platform-api/src/main/java/.../service/term/TermServiceImpl.java:288-301` — `linkTermWithTerm` / `removeTermToLinkedTermRelation` have **no `@PreAuthorize` and no `@ActivityLog`** (per TermController sidecar bugs[5]) — the mutation is invisible to BOTH RBAC AND the activity feed.
- Live WebFetch 2026-05-20 of `https://docs.opendatadiscovery.org/features/data-glossary/business-glossary` (per TermController sidecar `docs_link_semantic.inferred_docs[1]`) — verbatim excerpt: `TERM_UPDATE — "Edit the term's name, description, namespace, or directly-linked terms."`
- `lineage/odd-platform/understanding/odd-platform__java__TermController__controller-class__TermController.md:207` (doc-drift[0]) — "Operators reading the docs and authoring an RBAC policy that withholds TERM_UPDATE on a set of terms expecting term-to-term linking to be blocked will silently fail-open."

## Notes

- **The doc-drift is the headline**: the gap between what the doc PROMISES and what the runtime ENFORCES is exactly what trust-breaks operators. An RBAC administrator's mental model is "permissions in the docs = permissions in the system"; this drift falsifies that model on a load-bearing surface (the glossary's term graph).
- **Compounds with audit-log silence** (bugs[5] of TermController sidecar): the term-to-term linkage mutations DO NOT emit `@ActivityLog(TERM_ASSIGNMENT_UPDATED)` events. Sibling `linkTermWithDataEntity` / `removeTermFromDataEntity` DO emit them. An auditor investigating "who linked term A to term B" has NO RBAC gate to point to AND no activity-feed trail. The combination is **silent + ungated + cross-time invisible**.
- **The fix is a one-line `SECURITY_RULES.add(new SecurityRule(TERM, matcher("/api/terms/{term_id}/term", POST/DELETE), TERM_UPDATE))`** per the two endpoints. Plus the `@ActivityLog` annotation on the two service methods. Cheap fix; obvious miss.
- **Why this is its own thread, not an F-002 facet**: F-002 (Term-to-Entity Linkage) covers term-to-DATA-ENTITY linkage (the `data_entity_to_term` direction). This is **term-to-TERM linkage** (the `term_to_term` direction) — a sibling axis that powers the Term ontology graph (term hierarchies, equivalences, parent-child). The two axes share the audit-silence shape and the auto-link side-channel (`[[ns:term]]` mentions create term_to_term rows when found in term DEFINITIONS — TermServiceImpl.java:67 regex), but they're distinct surfaces. Set `Category: clustering`, `Links.cluster_with: [F-002]`.
- **Cross-time bypass via auto-link**: per TermServiceImpl sidecar `concepts.operations[0]`, `createTerm` calls `resolveUnhandledDescriptionMentions` which drains the staging table and materialises term_to_term rows for previously-unresolvable `[[ns:term]]` mentions. A user creating term X now can SILENTLY auto-link X to terms mentioned in OTHER users' term definitions written weeks ago, with NO RBAC gate AND NO activity-feed trail.
- **Audit-log silence compounds with RBAC silence**: the platform's audit story for glossary mutations is fragile in general (no TERM_CREATED / TERM_UPDATED / TERM_DELETED activity-event enum values per TermServiceImpl sidecar `concepts.entities` — "Critical absence: the enum `ActivityEventTypeDto` has NO `TERM_CREATED`, `TERM_UPDATED`, `TERM_DELETED`...values defined"). Term-to-term linkage compounds the silence.

## Next

1. **Mark as ENRICHER for F-002** (Category: clustering, Links.cluster_with: [F-002]). The feature-flow-builder should add the term-to-term linkage axis as a sibling facet of the term-to-data-entity axis F-002 currently anchors.
2. **SEC-NNN**: add the missing `SecurityRule` entries for POST + DELETE `/api/terms/{term_id}/term[/{linked_term_id}]` with `TERM_UPDATE` permission, resolved via `TERM` AuthorizationManagerType.
3. **REFACTOR-NNN**: add `@ActivityLog(TERM_ASSIGNMENT_UPDATED)` to `TermServiceImpl.linkTermWithTerm` / `removeTermToLinkedTermRelation`. Also extend the enum to add `TERM_CREATED` / `TERM_UPDATED` / `TERM_DELETED` (separate refactor; broader scope).
4. **DOC-NNN**: until the SECURITY_RULES fix lands, add an admonition to the Business Glossary page noting that term-to-term linkage is currently ungated. Better: fix the code first, then the doc remains accurate.
5. **TEST-NNN**: WebTestClient integration test pinning the current behaviour (any authenticated user can POST `/api/terms/{id}/term`) AND a regression test for the fixed behaviour (caller without `TERM_UPDATE` gets 403).
6. **Cross-link to LSN-NNN candidate**: "doc-promise-vs-runtime-enforcement drift on RBAC matrix" — case-law candidate. Pattern is: the docs enumerate permissions and what they gate; if the SecurityConstants matchers don't match the documented gates, operators trust the docs and the trust is misplaced. Similar shape to REFACTOR-217 (path mismatch singular vs plural) per TermServiceImpl sidecar but on a different endpoint pair.

## Links

- cluster_with: [F-002]
- merged_into: (open — enriches F-002 with term-to-term linkage axis)
- supersedes: []
