## REFACTOR-549 — `TagServiceImpl.getOrCreateTagsByName` TOCTOU between `listByNames` + `bulkCreate` surfaces UI 500 on race with side-door / Collector — `ingestData` upsert sibling silences race; choice of method is THE differentiator

**Severity**: HIGH
**Category**: race-condition
**Surfaced by**:
- `TagServiceImpl.md:bugs_limitations_corner_cases[TOCTOU getOrCreateTagsByName]` (HIGH) — "Critical: this is invoked from `TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` (twice) — the side-door write paths — none of which catch `UniqueConstraintException` per a quick Grep would clarify; a Collector + UI concurrent submission of the same novel name will fail the UI write while succeeding the Collector ingest."
- `TagServiceImpl.md:stress_findings.S-B-4` (getOrCreateTagsByName vs getOrInjectTagByName — race semantics differ between siblings)
- `TagServiceImpl.md:stress_findings.S-E-1[ii]` (getOrCreateTagsByName is multi-step read+write WITHOUT @ReactiveTransactional — TOCTOU surface; severity HIGH)
- `TagServiceImpl.md:tests_coverage_semantic.uncovered_behaviours[getOrCreateTagsByName concurrent novel-name]` (HIGH — no contract test)
- `TagServiceImpl.md:security.known_security_gaps[TOCTOU denial-of-write]` (LOW — security framing; the data-integrity framing is HIGH)
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[TOCTOU between listByNames and bulkCreate]` (HIGH) — full chain trace
- `ReactiveTagRepositoryImpl.md:stress_findings.E2` (bulkCreate race UNSAFE; race posture NOT safe)
- `ReactiveTagRepositoryImpl.md:tests_coverage_semantic.uncovered_behaviours[Concurrent bulkCreate race]` (HIGH)
- `ReactiveTagRepositoryImpl.md:tests_coverage_semantic.gaps[3]` ("Auto-create-on-miss TOCTOU... the loser-handling path... is NOT tested anywhere in the repository or the service test corpus")

**Description**: `TagServiceImpl.getOrCreateTagsByName(Set<String> tagNames)` (`:79-86`) issues two sequential DB operations WITHOUT `@ReactiveTransactional`:
1. `divideTagsByExistence(tagNames)` (line 81) which calls `reactiveTagRepository.listByNames(tagNames)` (line 145) — READ
2. `reactiveTagRepository.bulkCreate(tagsToCreate)` (line 82) — WRITE

Between these two reactor stages, another caller (UI on a different request, OR a Collector S2S push via `getOrInjectTagByName`, OR another UI request to the same controller, OR the same caller's pipelined second request) can insert the same novel name. The `listByNames` snapshot does NOT see uncommitted INSERTs from a concurrent TX (PostgreSQL READ COMMITTED isolation). The second caller proceeds to `bulkCreate` with the now-conflicting name, hits the partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (V0_0_64:105), and receives `UniqueConstraintException("Tag with this name already exists")` (translated by `ExceptionUtils.java:54-56`).

The sibling method `getOrInjectTagByName` (`:88-94`) uses `reactiveTagRepository.ingestData(tagsToCreate)` instead, which has an `INSERT … ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name RETURNING *` upsert (`ReactiveTagRepositoryImpl.java:204-210`). The upsert silently merges with the existing row and returns the existing id — race silenced.

**The two methods are sibling APIs with the SAME signature and DIFFERENT race semantics.** The caller's choice of method determines which TOCTOU posture applies:

| Caller | Method | Race posture |
|---|---|---|
| `TermServiceImpl.upsertTags:257` | `getOrCreateTagsByName` | **UNSAFE — UniqueConstraintException → 500** |
| `DataEntityServiceImpl.upsertTags` | `getOrCreateTagsByName` (transitively via `updateRelationsWithDataEntity` → line 105) | **UNSAFE — UniqueConstraintException → 500** |
| `DatasetFieldServiceImpl:202` | `getOrCreateTagsByName` | **UNSAFE — UniqueConstraintException → 500** |
| `DatasetFieldServiceImpl:266` | `getOrCreateTagsByName` | **UNSAFE — UniqueConstraintException → 500** |
| `ExternalTagIngestionRequestProcessor.process:104` | `getOrInjectTagByName` | SAFE — upsert silently merges |

The race occurs when:
- A Collector pushes a novel tag name via `getOrInjectTagByName` (idempotent)
- A UI user simultaneously submits the same name via `PUT /api/dataentities/{id}/tags` (the side-door, REFACTOR-223), which transitively calls `getOrCreateTagsByName` (UNSAFE)
- The Collector's `INSERT … ON CONFLICT DO UPDATE` wins; the UI's `bulkCreate` hits the unique constraint
- `JooqReactiveOperations.flux` wraps with `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` → the friendly `UniqueConstraintException("Tag with this name already exists")` reaches the UI controller as an UNCAUGHT exception → propagates to `ControllerAdvice` → HTTP 5xx response (or 4xx if `UniqueConstraintException` is mapped to 4xx by `ControllerAdvice` — but the message text is the UNDERLYING DB shape, not a user-friendly UX explanation).

**The user sees**: a 4xx/5xx error on a normal-looking PUT request, with the cryptic message "Tag with this name already exists" — when in fact the tag DOES now exist (just not from their write). The retry-by-the-user works (the second call finds the tag via `listByNames`). The user has no way to know they raced a Collector.

**Primary source citations**:
- `TagServiceImpl.java:79-86` (getOrCreateTagsByName, no `@ReactiveTransactional`)
- `TagServiceImpl.java:88-94` (getOrInjectTagByName, no `@ReactiveTransactional` but upsert silences race)
- `TagServiceImpl.java:144-159` (divideTagsByExistence — the READ side of the TOCTOU)
- `ReactiveAbstractCRUDRepository.java:113-126` (the inherited `bulkCreate` — NO `onConflict` clause)
- `ReactiveTagRepositoryImpl.java:204-210` (the `ingestData` upsert — `ON CONFLICT … DO UPDATE`)
- `ExceptionUtils.java:54-56` (the `UniqueConstraintException` translation)
- `V0_0_64__remove_is_deleted_field.sql:103-105` (the partial unique index that triggers the violation)
- `TermServiceImpl.java:257` + the 3 other call sites of `getOrCreateTagsByName` (all UNSAFE)
- `ExternalTagIngestionRequestProcessor.java:104` (the lone SAFE caller via `getOrInjectTagByName`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-065 (Tag auto-create-on-miss is INTENTIONAL and spec-acknowledged) documents the auto-create UX but does NOT defend the race-asymmetry between the two methods. ADR-CANDIDATE-070 (partial unique index) describes the DB-layer protection — it works, the race is silenced for `ingestData` callers and surfaces as `UniqueConstraintException` for `bulkCreate` callers. The choice of method per caller is undocumented; reading `TagService.java:14-36` (the interface) does not reveal that one method silences race and the other does not.

**Proposed remedy**: Three options:

1. **Unify on the upsert path**: Make `getOrCreateTagsByName` use `ingestData` instead of `bulkCreate`. This silences the race for ALL side-door callers AND for the direct `TagController.createTag` path. Trade-off: changes the semantic of `TagController.createTag` from "fail on duplicate (surface `UniqueConstraintException`)" to "silently merge with existing tag" — breaks the spec contract for `POST /api/tags` which currently surfaces the duplicate as a 4xx. Users would lose the explicit "already exists" feedback on the dedicated route.

2. **Keep both methods; document the race**: Add a Javadoc comment on `getOrCreateTagsByName` and `getOrInjectTagByName` describing the race difference. Audit each caller to confirm the method choice is intentional. Switch side-door callers (`TermServiceImpl.upsertTags`, `DataEntityServiceImpl.upsertTags`, `DatasetFieldServiceImpl` x2) from `getOrCreateTagsByName` to `getOrInjectTagByName` — they don't WANT to surface duplicates; they want the operator's mutation to succeed even if a Collector just inserted the same name. The direct `TagController.createTag` path keeps `bulkCreate` for the explicit-duplicate semantic.

3. **Add @ReactiveTransactional + retry-on-conflict**: Wrap `getOrCreateTagsByName` in `@ReactiveTransactional` with `Retry.fixedDelay(3, ofMillis(100))` triggered on `UniqueConstraintException`. The retry re-reads after the racer's commit, finds the tag, and returns it. Trade-off: extra DB round-trip on the rare race; user wait time bounded.

**Recommended**: Option 2 — surgical fix matching each caller's INTENT. Side-door callers (4 of 5) want race-silence; the direct create endpoint wants race-explicit. Pair with a Javadoc comment on the interface methods clarifying the choice. Add a contract test asserting the race-difference at `TagServiceImplTest` (`testGetOrCreateTagsByName_ConcurrentNovelName_OneThrowsUniqueConstraintException` + `testGetOrInjectTagByName_ConcurrentNovelName_ReturnsSameId` per the sidecar's uncovered_behaviours list).

**Severity rationale**: HIGH — the race produces user-visible 4xx/5xx errors on normal-looking operations under realistic concurrency (Collector + UI mutating the same tag namespace). The fact that side-door callers use the UNSAFE method while the Collector uses the SAFE one is a code-quality regression that the test suite cannot catch (no concurrent-novel-name test exists at any layer). The remedy is straightforward (4-line change in 4 call sites).

**Suggested backlog grouping**: SEC-NNN concurrency-hardening sprint. Pair with REFACTOR-011 (same-index attachment race), REFACTOR-037 (alert reopen-guard race), REFACTOR-236 (alert reopen-guard SQL backstop missing) — the four are the platform's known TOCTOU surfaces. The Tag-tier instance is the highest-frequency of the four (every per-data-entity tag update is a potential racer).

---
