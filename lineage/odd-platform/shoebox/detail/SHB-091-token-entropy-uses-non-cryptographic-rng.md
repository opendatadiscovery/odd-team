# SHB-091 — Collector + Datasource token entropy uses non-cryptographic `RandomStringUtils` → predictable tokens

**Category**: merged
**Severity**: HIGH

## Hypothesis

The 40-character alphanumeric token issued by Collector / Datasource registration and rotation looks high-entropy (40 alphanumeric ≈ 238 bits of input space) but is generated via `RandomStringUtils.randomAlphanumeric(40)`. In commons-lang 3.16+, that delegates to `ThreadLocalRandom` — NOT `SecureRandom`. `ThreadLocalRandom` is a non-cryptographically-secure PRNG; if the seed state is predictable (e.g. an attacker can observe several tokens issued in close succession, knows the JVM start time, or can correlate with `System.nanoTime`-derived state), subsequent or sibling tokens become inference-attackable. This is the platform's shared secret authenticating every `POST /ingestion/entities` from every collector + datasource.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/util/TokenGeneratorImpl.java:39` — `setValue(RandomStringUtils.randomAlphanumeric(40))` in the `generate` path.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/util/TokenGeneratorImpl.java:49` — same call in the `regenerate` path.
- Commons-lang 3.16+ Javadoc (well-known platform fact): `RandomStringUtils.randomAlphanumeric(int)` uses the package-private default which is `ThreadLocalRandom`-backed in modern versions; `RandomStringUtils.secure().nextAlphanumeric(int)` is the cryptographically-secure variant available since 3.16.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:55-58` — the consumer: `String.equals()` against the in-DB value. Compromise = full ingestion-write access to the platform.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTokenRepositoryImpl.java:21-39` — tokens stored plaintext at rest (no hashing); a DB read / replica / backup carries credentials in clear.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/CollectorController.java:27-31, 47-51` + `DataSourceController.java:30-36, 53-59` — token returned plaintext in response body on register + regenerate; no `Cache-Control: no-store`.

## Notes

- The 238-bit ALPHABET SIZE is large; the RNG QUALITY is the binding constraint. If `ThreadLocalRandom` were perfectly random, this would be uncrackable. It is not — there are well-documented attacks on `java.util.Random` family seeds (recover 48-bit seed from 2 successive `nextLong()` calls). `ThreadLocalRandom` is harder but not cryptographic-grade.
- Attack model: a multi-tenant deployment where an attacker has any one valid token (their own, legitimately-issued), can observe the timing of their token's issuance, and the platform issues another token to a different tenant in close temporal proximity. The attacker uses the seed-recovery technique on their own token to predict candidate tokens for the other tenant.
- One-line fix: replace `RandomStringUtils.randomAlphanumeric(40)` with `RandomStringUtils.secure().nextAlphanumeric(40)` (commons-lang 3.16+), OR explicit `new SecureRandom()`-based generator.
- Compounds with SHB-090 (no rotation grace window) and the plaintext-at-rest / plaintext-on-the-wire storage — the token has THREE independent defects in its credential lifecycle: weak RNG, plaintext storage, plaintext transit on issue/rotate.
- F-020 captures the plaintext-visibility class but does NOT enumerate the RNG entropy gap as a drift facet.

## Next

1. **ENRICH F-020** with this drift facet (`token_entropy_non_cryptographic_rng_via_randomstringutils_alphanumeric`).
2. **REFACTOR-NNN**: one-line change in `TokenGeneratorImpl.java:39, 49` to `RandomStringUtils.secure().nextAlphanumeric(40)`. Mechanical, low-risk, high-security-leverage.
3. **SEC-NNN**: filed as security advisory backlog item (severity HIGH) — even though no known active exploit, the defect class is well-documented and the fix is trivial.
4. **DOC-NNN**: confirm `/configuration-and-deployment/enable-security/authentication` does not contain language implying cryptographic-grade randomness; if it does, retract.

## Links

- cluster_with: [F-020, SHB-090]
- merged_into: F-020
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — F-020 already carries `token_entropy_not_securerandom_randomstringutils` as a drift facet; this thread STRENGTHENS the facet with explicit TokenGeneratorImpl.java:39, 49 primary-source citations + attack model + one-line fix specification. F-020: shoebox_extensions_2026_05_26 → drift_class: token_entropy_non_cryptographic_rng_via_randomstringutils_alphanumeric_strengthens_existing. Cross-cut note re Slice F: this thread cross-cuts security threads in Slice F (token semantics); I MERGED in-place on F-020 (P-08, my pillar) and recorded a sliceF_cross_cut_note explaining why — Slice F should not race a parallel mutation on F-020's drift_class_summary. Category flipped open → merged.
