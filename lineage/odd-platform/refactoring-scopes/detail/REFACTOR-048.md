- **REFACTOR-048** (NEW 2026-05-10A; STRENGTHENED 2026-05-10B): Collector tokens stored in plaintext at rest in the `TOKEN` table — DB read, replica, backup, or jOOQ log carries credentials in the clear
  - **Category**: plaintext-at-rest
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[3]` (severity HIGH)
    - **STRENGTHENED 2026-05-10B** — `odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md:bugs_limitations_corner_cases.[2]` + `security.known_security_gaps.[1]` (severity MEDIUM per sidecar; corroborates from the verify side: "Token comparison is `.equals(...)` (line 56), not `MessageDigest.isEqual(...)` — vulnerable to timing-based token discovery on a local network where an attacker can measure response time differences. For a 40-character alphanumeric token (62^40 ≈ 2.4e71 search space) the practical attack surface is small, but the principle is violated." — the verify side's plaintext `.equals(...)` confirms the storage shape established by the rotate side; together they compose the full plaintext-at-rest + plaintext-equality + non-constant-time model. REFACTOR-079 captures the constant-time-comparison gap independently; REFACTOR-048 is the storage-at-rest dimension)
  - **Statement**: ADR-CANDIDATE-017's "plaintext-equality against in-DB string" model means the database stores tokens as-is. There is no application-layer hashing (no BCrypt, no SHA-256+salt, no HMAC verification — the `IngestionDataEntitiesFilter` does a literal `dto.tokenPojo().getValue().equals(token)` check at line 55-58). A read-only DB replica, a Postgres backup, a jOOQ statement log capture, an SQL-injection at the TOKEN table — any of these escalates from "DB read" to "platform-wide ingestion compromise."
  - **Evidence**: `ReactiveTokenRepositoryImpl.java:21-39` (record stored as-is) + `IngestionDataEntitiesFilter.java:55-58` (plaintext `.equals(...)` check confirms no hashing)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 codifies the plaintext-equality model. This scope is the structural consequence of the model; addressing it is a structural change (would require BCrypt-on-write + BCrypt.matches-on-read, breaking the rotation model that returns plaintext on regenerate). The maintainer's choice for ADR-017 was "long-random over TLS"; the gap-shape of REFACTOR-048 is the price.
  - **Proposed remedy**: At minimum, document on the new "Token Rotation" doc section that tokens are plaintext at rest and that operators must (a) restrict DB access, (b) encrypt-at-rest at the storage layer, (c) treat backups as credential-bearing. At maximum, redesign to BCrypt-at-rest, which would require extending ADR-CANDIDATE-017 (and breaks the rotation model: the new BCrypt'd token can no longer be RETURNed in plaintext to the operator).
  - **Severity rationale**: HIGH — credential plaintext at rest is one DB read away from total ingestion compromise.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token shares the SAME plaintext `token` table + plaintext `.equals` verification; the gap is platform-wide across both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:security.known_security_gaps` (HIGH) — "Token is stored in plaintext in the `token` table — a DB read, replica, backup, or jOOQ statement log carries the credential in the clear. No hashing / encryption-at-rest at the application layer (confirmed by `IngestionDataEntitiesFilter.java:56-57` doing a literal `.equals` against the stored value)."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:concepts.invariants` — "The new token is RETURNED in the response body in plaintext (40 alphanumeric chars; showToken=true on the regenerate path) and stored likewise in plaintext in the `token` table — no hashing layer."

**Why a STRENGTHEN, not a new entry**: the Collector token and the DataSource token are rows in the SAME `token` table; both are written by `ReactiveTokenRepositoryImpl` as raw `RandomStringUtils.randomAlphanumeric(40)` strings; both are verified by `IngestionDataEntitiesFilter.java:56-57`'s literal plaintext `.equals`. There is one storage shape and one verification shape. The plaintext-at-rest gap is one finding spanning both credential families — re-scope the title on triage to "ODD `token` table plaintext-at-rest (every token row)".

**Severity unchanged: HIGH** — a DB read / backup / replica carries plaintext credentials for BOTH the Collector and the DataSource ingestion surfaces; a single `token`-table compromise escalates to platform-wide ingestion compromise across both.

---
