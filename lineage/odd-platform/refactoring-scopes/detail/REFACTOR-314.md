## REFACTOR-314 — Second SecurityConstants path-mismatch bug — `/api/alerts/{alert_id}/status` PUT is gated by `DATASET_FIELD_ADD_TERM` (a Term permission applied to an Alert path) — almost certainly a copy/paste error that disables the intended alert-status authorization

**Severity**: HIGH
**Category**: path-mismatch (wrong-permission-on-endpoint)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:bugs_limitations_corner_cases.[1]` (HIGH) — "Second SecurityConstants bug (independent) — `/api/alerts/{alert_id}/status` PUT is gated by `DATASET_FIELD_ADD_TERM`. `SecurityConstants.java:295-296` registers `new SecurityRule(ALERT, new PathPatternParserServerWebExchangeMatcher(\"/api/alerts/{alert_id}/status\", PUT), DATASET_FIELD_ADD_TERM)` — a Term permission applied to an alert-status path. Almost certainly a copy/paste error: the AlertController.changeAlertStatus endpoint should gate on `DATA_ENTITY_ALERT_RESOLVE`. Effect: an operator with `DATASET_FIELD_ADD_TERM` can change alert statuses on any data entity; an operator with `DATA_ENTITY_ALERT_RESOLVE` (the named permission for that operation) cannot."

**Description**: `SecurityConstants.java:295-296` declares `new SecurityRule(ALERT, new PathPatternParserServerWebExchangeMatcher("/api/alerts/{alert_id}/status", PUT), DATASET_FIELD_ADD_TERM)` — the path is for the alert-status PUT endpoint (consumed by `AlertController.changeAlertStatus`), and the permission `DATASET_FIELD_ADD_TERM` is a Glossary-domain permission for linking terms to dataset-fields. The two are semantically unrelated. This is the SECOND SecurityConstants path-mismatch bug surfaced from this codebase — the first is REFACTOR-217 (`/term` vs `/terms` plural mismatch on the term-link endpoint).

**Failure mode**: An operator's Policy grants `DATASET_FIELD_ADD_TERM` to a "data-quality-team" role for term-linkage on dataset fields. Any holder of that role can now also change alert statuses on any data entity (resolve, reopen) — a power they were never explicitly granted. Conversely, an operator's Policy grants `DATA_ENTITY_ALERT_RESOLVE` to an "alert-stewards" role expecting them to be able to resolve alerts — the matcher does NOT consult `DATA_ENTITY_ALERT_RESOLVE` for this endpoint, so the holder gets 403 / falls through to `.authenticated()` and resolves the alert as any user (per the authorization customizer's fallback). Operators auditing "who can resolve alerts" via the Policies UI see one answer; the runtime permits a different set of users.

**Primary source citations**:
- `SecurityConstants.java:295-296` (the rule declaration: path `/api/alerts/{alert_id}/status` PUT × permission `DATASET_FIELD_ADD_TERM`)
- `AlertController.changeAlertStatus` (the endpoint being gated)
- The `DATA_ENTITY_ALERT_RESOLVE` permission (the intended-but-not-wired gate)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-002 (centralised SECURITY_RULES) is the architectural intent — every authorisation gate lives in this single registry. The IMPLIED prescription is that the (path, permission) pairs are semantically related; a path-permission mismatch is a defect. ADR-CANDIDATE-062 (two-permission split on data-entity write surface) is also undermined: the architectural intent was fine-grained per-feature permission gating, and a copy/paste error silently nullifies it for one endpoint.

**Proposed remedy**: One-line fix at `SecurityConstants.java:295-296` — replace `DATASET_FIELD_ADD_TERM` with `DATA_ENTITY_ALERT_RESOLVE` (or whatever the named permission for alert-status mutation is — verify with the platform's Permissions enum). Add a regression test in `AlertControllerTest` that asserts a user holding `DATA_ENTITY_ALERT_RESOLVE` (and no other permissions) CAN PUT `/api/alerts/{id}/status` and that a user holding only `DATASET_FIELD_ADD_TERM` CANNOT. Add a build-time / startup-time check that asserts every SECURITY_RULES (path, permission) pair is semantically aligned (e.g. via a naming-convention check: alert paths get ALERT_* permissions, term paths get TERM_*, etc.). Cross-link REFACTOR-009 (no compile-time / test-time guard against SECURITY_RULES path-pattern drift) — same long-term remedy applies.

**Severity rationale**: HIGH — silently misroutes authorization for the alert-status endpoint; combined with REFACTOR-024 (getAllAlerts cross-owner exposure) and REFACTOR-073 (no boot-time security-posture validator), the Alerts subsystem has the WEAKEST gate alignment in the platform. The one-line fix is high-leverage; the systemic fix (path-permission alignment check at build) catches future drift.

**Suggested backlog grouping**: `Authorization audit batch` (with REFACTOR-009, REFACTOR-024, REFACTOR-217)

---
