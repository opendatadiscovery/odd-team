# SHB-013 — Directory reflection-based ODDRN-property leak (host / database / port / cluster / account exposed without redaction)

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators see per-datasource detail rows in the Directory level-2 response that include the datasource's ODDRN-derived infrastructure properties — for a Postgres datasource that's `host`, `database`, `port`; for Snowflake that adds `account`, `warehouse`; for Kafka adds `cluster`, `topic` — because `DirectoryServiceImpl.getOddrnProperties` (lines 138-171) uses Java reflection to enumerate EVERY `@PathField`-annotated field on the OddrnPath subclass. NO redaction step, NO allow-list, NO per-property visibility gate. Combined with the read-collaborative posture on `/api/directory` (no SecurityRule, falls through to `.authenticated()`) and the auth.type=DISABLED bypass, ANY authenticated user (and any anonymous DISABLED-mode caller) gets the FULL ODDRN-derived **internal-infrastructure map** of the deployment. F-023 (Directory) anchors the four-level browse but does NOT enumerate the reflection-property leak.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DirectoryServiceImpl.java:138-171` — `getOddrnProperties` uses reflection (`getDeclaredFields` + `getMethod` get-prefix + invoke) on every data-source row.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DirectoryServiceImpl.java:153-171` — `getOddrnPathProperties` reflects EVERY `@PathField`-annotated property on the OddrnPath subclass. No allow-list filter, no redaction, no per-property opt-out.
- `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/DirectoryTest.java:141-149` — the existing test confirms the response shape: `host` and `database` are part of the expected payload. The leak is the intended payload shape.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:98-355` — grep `/api/directory` returns ZERO matches. No SecurityRule, falls through to `.authenticated()`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/authorization/AuthorizationCustomizer.java:24-30` — the catch-all `.pathMatchers("/**").authenticated()`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/configuration/DisabledAuthSecurityConfiguration.java:14-17` — `auth.type=DISABLED` → `anyExchange().permitAll()` → anonymous access to the entire `/api/directory*` surface.
- Live doc: `https://docs.opendatadiscovery.org/features/data-discovery/directory` (verified 2026-05-20 status 200) — page describes the four-level drill-down but mentions NOTHING about authorization, ownership, visibility, or ODDRN-derived infrastructure properties.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__DirectoryController__controller-class__DirectoryController.md` (the directory-reflection-oddrn-property-leak entry under `coherence_check.strengthens`).

## Notes

- **Threat model**: an authenticated user with NO Owner association still gets the full datasource inventory + every datasource's host / database / port / cluster / topic. A deployment that intentionally avoids exposing internal hostnames in its UI still leaks them via `/api/directory/datasources?prefix=postgresql` — the response includes properties like `{host: "pg-prod-01.internal", database: "billing", port: "5432"}`.
- **Why this is operator-visible and load-bearing**: the Directory is the catalog's primary HIERARCHICAL browse surface. The point of the level-2 view IS to show "here are the platform's Postgres instances." For mature deployments this is the most efficient way for any operator (with or without Owner association) to enumerate ALL registered hostnames in 1-2 clicks.
- **Combined with REFACTOR-185 (auth.type=DISABLED bypass)**: under DISABLED mode, the leak is fully anonymous to any caller able to reach the HTTP port. Same fingerprint as the LSN-001 / LSN-002 family (silent-misconfiguration → wide blast radius).
- **Cross-link with REFACTOR-203 (graph-shaped cross-owner enumeration via lineage)**: Directory is the FLAT-LIST sibling of REFACTOR-203's graph-shaped enumeration. Together they exhaust the catalog-shape enumeration surface: graph-via-lineage + flat-via-directory.
- **No allow-list mechanism**: the reflection chain emits EVERY `@PathField` it finds; there's no `@RedactedProperty` or `@DirectoryHidden` annotation to opt out of exposure. Operators who want host-name redaction have to patch the source.
- **Performance secondary concern**: `getOddrnProperties` is unmemoised — per request, per data source, the `@PathField` field set is re-discovered via reflection and the getter Method is re-resolved. A simple per-OddrnPath-subclass cache (`Map<Class, List<Method>>`) would eliminate the per-row reflection cost.
- **F-023 anchors Directory generally**; this is a DRIFT facet that may merge into F-023 as an extension. The maintainer-call is: graduate to its own F-NNN, or fold into F-023's drift facets list.

## Next

1. **SEC-NNN — MEDIUM** — implement an allow-list or `@DirectoryHidden` annotation on OddrnPath fields. Recommend opt-in (operator declares which fields are exposed) rather than opt-out, since the threat model defaults to "redact unless explicitly published."
2. **REFACTOR-NNN — LOW** — memoise the reflection result per OddrnPath subclass (single-entry cache on first call; reflection is constant for a given class).
3. **DOC-NNN — HIGH** — the live `/features/data-discovery/directory` page must disclose the visibility model. Either: (a) document that the Directory is a deployment-wide unscoped reconnaissance surface (matches current code behaviour); or (b) implement an owner-scoping permission and document that.
4. **TEST-NNN — MEDIUM** — `DirectoryTest` currently asserts the leak (lines 141-149 assert host + database in the response). After the fix, the test should assert that opt-out properties are EXCLUDED.
5. **Cluster** with F-023 + REFACTOR-185 + REFACTOR-203 — the broader catalog-cardinality-enumeration surface.
6. **Optionally**: ADR for "What datasource properties are operator-policy-visible vs deployment-private."

## Links

- cluster_with: [F-023]
- merged_into: (open)
- supersedes: []
