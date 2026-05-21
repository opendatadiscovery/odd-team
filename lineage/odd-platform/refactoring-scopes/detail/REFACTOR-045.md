- **REFACTOR-045** (NEW 2026-05-10A): Collector token entropy uses non-cryptographically-secure RNG — `RandomStringUtils.randomAlphanumeric(40)` delegates to `ThreadLocalRandom` (commons-lang 3.16+), not `SecureRandom`
  - **Category**: weak-rng
  - **Surfaced by**:
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:bugs_limitations_corner_cases.[4]` (severity HIGH)
    - `odd-platform__java__CollectorController__controller-method__regenerateCollectorToken.md:security.known_security_gaps.[1]` (severity HIGH)
  - **Statement**: `TokenGeneratorImpl.java:39, 49` calls `setValue(RandomStringUtils.randomAlphanumeric(40))`. Without an explicit Random argument, commons-lang 3.16+ uses `ThreadLocalRandom` — a non-cryptographically-secure PRNG. The token is the shared secret authenticating ALL ingestion against the platform; a predictable RNG seed (process startup time, easy to recover via JVM lifecycle telemetry) reduces the brute-force surface from ~238 bits (alphanumeric × 40) to whatever the seed entropy provides. The `commons-lang 3.16+` `RandomStringUtils.secure().nextAlphanumeric(40)` (or explicit `new SecureRandom()`) would be the security-grade source.
  - **Evidence**: `TokenGeneratorImpl.java:39, 49` (`RandomStringUtils.randomAlphanumeric(40)` — no Random arg)
  - **Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-017 (NEW 2026-05-10A — token rotation semantics) implicitly assumes the token is "long-random opaque string" — high entropy is a precondition for the plaintext-equality model. This scope is a direct violation of the implicit precondition: the token is "long" (40 chars) but not necessarily "random" in the cryptographic sense.
  - **Proposed remedy**: Replace `RandomStringUtils.randomAlphanumeric(40)` with `RandomStringUtils.secure().nextAlphanumeric(40)` (commons-lang 3.16+) OR explicit `new SecureRandom()` injected into TokenGeneratorImpl. Add a unit test asserting the chosen RNG is `SecureRandom`-backed.
  - **Severity rationale**: HIGH — defeats the implicit precondition of the platform's S2S authentication model. The fix is one line; the absence of the fix has no defending rationale.
  - **Suggested backlog grouping**: `Token rotation hardening`

---

## STRENGTHENS — Batch ZB (2026-05-21) — the DataSource token-rotation path shares the SAME `TokenGeneratorImpl`; the weak-RNG gap is platform-wide across both credential families

**New surfaced_by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[5]` (HIGH) — "Token entropy uses `RandomStringUtils.randomAlphanumeric(40)` (`TokenGeneratorImpl.java:49`) which is NOT a cryptographically-secure RNG by default. A regenerated ingestion credential should be drawn from `SecureRandom`. (Same finding as the CollectorController sibling sidecar — the two share `TokenGeneratorImpl`.)"
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:security.known_security_gaps` (HIGH) — confirms the same `TokenGeneratorImpl.java:49` weak-RNG site for the data-source token rotation.

**Why a STRENGTHEN, not a new entry**: `DataSourceController.regenerateDataSourceToken` → `DataSourceServiceImpl.regenerateDataSourceToken` → `tokenGenerator.regenerateToken` reaches the EXACT same `TokenGeneratorImpl.java:49` line that `CollectorController.regenerateCollectorToken` reaches. There is one `TokenGeneratorImpl` bean; the weak-RNG gap is one code site serving both the Collector and the DataSource token families (and the registration paths via `generateToken`). The scope's title should be re-scoped on triage to "ODD token entropy (every `token` row — Collector + DataSource)". `regenerateDataSourceToken` also confirms `registerDataSource`'s `generateToken()` path hits the same generator. Support is now 2 endpoints across both credential families confirming one shared gap site.

**Severity unchanged: HIGH** — one-line fix at `TokenGeneratorImpl.java:39,49`; fixing it remediates BOTH the Collector and the DataSource token surfaces simultaneously. Composes with ADR-CANDIDATE-017's batch-ZB strengthen (the shared-secret model is now confirmed platform-wide).

---
