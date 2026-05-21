## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-003 — getPopularTagList confirms the read-collaborative-GET posture on the tag-directory read)

**One new sidecar confirms the read-collaborative-GET posture at the tag-directory read surface.**

- `getPopularTagList.md:implicit_adrs[0]` — "Read endpoints are NOT RBAC-gated — open-read posture by design. `getPopularTagList` has no `SecurityRule` entry; the request falls through to `pathMatchers(\"/**\").authenticated()`. The same shape is consistent across sibling read endpoints (e.g. `TermController.getTermsList`, `AlertController.getAllAlerts`)."
- `getPopularTagList.md:invariants` — "`getPopularTagList` is the ONLY endpoint among the four on `/api/tags` with no `SecurityRule` entry — `SecurityConstants.SECURITY_RULES` has POST/PUT/DELETE entries for `/api/tags` (`SecurityConstants.java:138-142`) but no GET entry; the request inherits the catch-all `authenticated()` (`AuthorizationCustomizer.java:29-30`)."
- `getPopularTagList.md:auth_gates` — "A user holding NO `TAG_*` permission (or only an unrelated permission such as `DATA_ENTITY_TAGS_UPDATE`) gets 200 + the full tag directory. `getPopularTagList` has no permission requirement beyond `authenticated()`."

**Architectural refinement**: `getPopularTagList` is a CLEAN within-controller demonstration of the ADR — three sibling write verbs on `/api/tags*` (`POST` / `PUT` / `DELETE`) each have a `SecurityRule` entry; the GET deliberately has none. The `SECURITY_RULES` table registers write-verb rules and omits read-verb rules; the convention IS the decision. The `tag` openapi-tag node independently corroborates from the spec side: `tag.md:security.known_security_gaps` notes "`getPopularTagList` has no spec-level owner filter, no RBAC marker... the downstream open-read posture means a user with no `TAG_*` permission still enumerates the whole directory."

**Support count**: extended (the prior batch-M count was 13; `getPopularTagList` is an additional within-`TagController` confirmation). The blast-radius gap — any authenticated user can enumerate the entire global tag directory regardless of `TAG_*` grants, and combined with the tag side-door (REFACTOR-223) a `DATA_ENTITY_TAGS_UPDATE`-only user can both READ and GROW the directory — is captured at REFACTOR-490 (see `refactoring-scopes/index-batch-X-TAGGING-append.md`).

**Severity unchanged**: HIGH.

---
