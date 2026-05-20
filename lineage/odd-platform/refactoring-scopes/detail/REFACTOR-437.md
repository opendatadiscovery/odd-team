## REFACTOR-437 — TOKEN.value plaintext-at-rest SQL-tier substrate (cross-batch family with REFACTOR-419 controller-tier surface)

**Severity**: HIGH
**Category**: missing-defence-in-depth / credentials-at-rest
**Batch**: R (2026-05-20)
**Pillars affected**: [P-09-security-access-control, P-10-integrations-ingestion, P-08-management-administration]

**Surfaced by**:
- `ReactiveCollectorRepositoryImpl.md:bugs_limitations_corner_cases.[0]` (HIGH): "TOKEN.value plaintext-at-rest with no UNIQUE constraint, no hashing, no timing-attack-safe equality. The SQL-tier substrate of the bearer-token authentication shipped to the always-on `IngestionDataSourceFilter` and the opt-in `IngestionDataEntitiesFilter`. A DB-side reader (replica, backup, pg_dump, jOOQ log leak, application log leak) recovers every live credential."
- `ReactiveCollectorRepositoryImpl.md:security.known_security_gaps.[0]` (HIGH): "TOKEN.value plaintext-at-rest — the SQL row is plaintext; recovery is a single SELECT for any DB-side reader. No application-layer encryption, no hashing. The live doc at `configuration-and-deployment/enable-security` (WebFetched 2026-05-20, status 200) is SILENT on the storage shape."
- `ReactiveCollectorRepositoryImpl.md:implicit_adrs.[0]` (MEDIUM-confidence BORDERLINE-ADR): "TOKEN.value is the plaintext credential at rest … The intent is consistency-across-layers — every component of the bearer-token flow assumes plaintext-at-rest. There is no comment or annotation explicitly defending the plaintext choice, but the cross-component coherence (no hashing anywhere) IS the implicit ADR. The maintainer should consider promoting this to an explicit ADR with the rationale; if that IS the rationale, document it; if it ISN'T, raise as REFACTOR-NNN."
- cross-batch — `IngestionController.createDataSourceEntity` batch P (controller-side primary source)
- cross-batch — `CollectorController.regenerateCollectorToken` batch Q (rotation-side primary source)
- cross-batch — `CollectorsList.tsx` batch Q (UI-side obfuscation finding — UI masks `******{last6}`, but the underlying value is plaintext)
- `ReactiveDataSourceRepositoryImpl.md:security.known_security_gaps.[0]` (MEDIUM): "The repository returns plaintext TOKEN values to any caller (lines 163, 167, 172, 177). A service-bypassing caller (e.g. a future internal job, a misconfigured integration) gets full plaintext tokens. The platform's posture is 'tokens are plaintext in DB and in DTOs; the UI obfuscates on render only'."

**Statement**: The TOKEN.value column is the platform's bearer-token credential — written by `TokenGeneratorImpl.java:34-42` as `RandomStringUtils.randomAlphanumeric(40)` verbatim with no hashing, stored at `V0_0_28__add_token.sql:4` as `value varchar(40) NOT NULL` with NO UNIQUE constraint, read by `ReactiveCollectorRepositoryImpl.getByToken` at line 94 via plaintext equality `TOKEN.VALUE.eq(token)`, and cross-checked by `IngestionDataEntitiesFilter.java:56` via `tokenPojo.getValue().equals(token)`. The consistency-across-layers means there is NO defence-in-depth — any DB-side reader recovers every live credential by issuing `SELECT value FROM token`.

**Threat model**:
- **Replica reads** — read replicas of the platform's Postgres carry the credentials in clear. A read-only replica access grant (e.g. to a BI tool, an SRE jump host, an analytics user) leaks all collector tokens.
- **Backup recovery** — `pg_dump` output, base backups, point-in-time-recovery archives all contain plaintext tokens. Backup access policies must match credential-handling policies (typically they don't; backups are routinely lower-privilege).
- **Log leaks** — jOOQ debug logging at TRACE level would render `WHERE token.value = $1` with the actual bound parameter. R2DBC parameter logging is parameterised but TRACE-level rendering could expose. Application-tier logging that prints TokenPojo (e.g. `log.debug("token={}", tokenPojo)`) leaks via Lombok @Data toString (cross-reference REFACTOR-181).
- **Cross-collector token sharing** — no UNIQUE constraint on TOKEN.value (V0_0_28:1-9) means two TOKEN rows COULD theoretically share the same value (astronomically improbable from `RandomStringUtils.randomAlphanumeric(40)`, but not schema-prevented); `getByToken` returns the FIRST match with no ORDER BY — ambiguous COLLECTOR_ID_SESSION_KEY (`ReactiveCollectorRepositoryImpl.java:89-97`).
- **Timing channel** — plaintext equality in Postgres + Java `.equals()` short-circuit on first mismatching byte; technically present, practically infeasible against 40-char alphanumeric (keyspace ≈ 62^40).

**Borderline ADR cross-link**: The corresponding ADR-candidate "plaintext as consistency-across-layers" is BORDERLINE — the sidecar flags MEDIUM confidence because no defending comment exists in the code. If the maintainer's INTENT is "tokens are deployment-internal shared secrets between operator-controlled collectors and the operator-controlled platform; storage-at-rest threats are addressed at the disk/backup layer, not the application layer", that intent should be PROMOTED to an ADR; if it is NOT the intent, this scope is the actionable refactor. The maintainer's triage of the BORDERLINE candidate gates this scope's resolution.

**Evidence** (SQL-tier substrate primary source NEW batch R):
- `ReactiveCollectorRepositoryImpl.java:89-97` — `getByToken` plaintext equality (`TOKEN.VALUE.eq(token)`)
- `V0_0_28__add_token.sql:1-9` — `value varchar(40) NOT NULL`, no UNIQUE, no encryption
- `TokenGeneratorImpl.java:34-42` — `RandomStringUtils.randomAlphanumeric(40)` plaintext write
- `IngestionDataEntitiesFilter.java:55-58` — `tokenPojo.getValue().equals(token)` plaintext cross-check
- `ReactiveDataSourceRepositoryImpl.java:163, 167, 172, 177` — service-bypassing repository access returns plaintext via `TokenDto(tokenPojo)`
- `TokenMapper` / `CollectorMapper` — masking is UI-tier only (`******{last6}` per batch-Q CollectorsList sidecar)

**Existing-ADR-or-implied-prescription**: No accepted ADR. Cross-references the BORDERLINE ADR-CANDIDATE proposal "plaintext as consistency-across-layers". The doc-site (`configuration-and-deployment/enable-security`) is SILENT on storage shape — operators cannot infer the threat model.

**Proposed remedy**: Two paths; the maintainer triages.

**Path A — Accept the threat model + document it (the implicit ADR's positive interpretation)**:
- Promote the BORDERLINE ADR to `adrs/drafts/collector-token-plaintext-at-rest.md` codifying the deployment-internal-shared-secret rationale
- Surface on `configuration-and-deployment/enable-security` a section "Token storage at rest" with the threat model + operator-side mitigations (disk encryption, backup encryption, replica access restrictions, log-redaction policies)
- Add to `developer-guides/build-and-run/platform` a "Token-handling operator obligations" section
- DOC-NNN: a doc-product follow-up to surface the implicit operator contract

**Path B — Harden the application layer**:
1. Schema migration: `value_hash varchar(64) NOT NULL` replacing `value varchar(40)` — store BCrypt or HMAC-SHA256 hash
2. `TokenGeneratorImpl.generateToken` returns the plaintext to the operator once-only (UI display + copy-to-clipboard), persists the hash; never persists plaintext
3. `ReactiveCollectorRepositoryImpl.getByToken` hashes the inbound token before the WHERE match (or pre-computes the hash in a derived index)
4. `IngestionDataEntitiesFilter` hashes inbound before `.equals` (constant-time `MessageDigest.isEqual` comparator)
5. UI mapping stays plaintext-display on rotation, masked-by-hash on list
6. Add UNIQUE constraint on `value_hash` (eliminates the cross-collector token-sharing race)
7. All six layers must change atomically; multi-PR migration with backwards compatibility (column rename, dual-write, traffic-shift, plaintext-column drop)

The two paths are mutually exclusive at the ADR level; the maintainer's triage resolves which.

**Severity rationale**: HIGH — credentials-at-rest in plaintext is OWASP A02:2021 (cryptographic failures) class. The threat model is operator-controllable (encrypt-at-disk mitigates); the doc-side silence is the real failure today. The path-A doc-only fix is high-leverage; path-B is a multi-quarter engineering project.

**Suggested backlog grouping**: "Token credential hardening sprint" (paired with REFACTOR-419 cross-cluster session-key fragility — both touch the bearer-token authentication subsystem). Companion DOC-NNN for the doc-side coverage. The maintainer's BORDERLINE-ADR triage is the gate.

---
