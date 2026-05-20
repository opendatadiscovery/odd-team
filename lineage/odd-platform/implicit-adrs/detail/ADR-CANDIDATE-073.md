## ADR-CANDIDATE-073 — Selective `FOR UPDATE` on ingestion-read paths only — explicit-comment intent at the concurrent-write surface; user-driven mutation reads deliberately unfenced

**Severity**: MEDIUM
**Classification**: promote (unique-load-bearing)
**Support count**: 1 sidecar (this batch — Alert) — with explicit verbatim inline-comment intent anchor
**Axes present**: repositories, concurrency

**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:implicit_adrs[1]` (the explicit selective-FOR-UPDATE pattern with verbatim source comment as intent anchor)

**Decision statement**: ODD's alert repository uses **selective row locking** — `FOR UPDATE` is applied ONLY on the ingestion-driven read path (`getOpenAlertsForEntities`); user-driven mutation paths (`updateAlertStatus`, `openAlertWithTheSameTypeExistsForDataEntity`) deliberately do NOT use `FOR UPDATE`. The asymmetry is documented inline:

```java
// ReactiveAlertRepositoryImpl.java:130-132 (verbatim)
// While BIS and FDT type of alerts usually are engaged in one ingestion request
// FDQT type more likely can be reported from various data sources.
// In such cases 'for update' clause prevents potential concurrent issues
```

The decision codifies:
- **(a)** Ingestion-driven reads acquire row locks when the consumer KNOWS multiple writers will race. The classic example: FDQT (Failed-Data-Quality-Test) alerts can be reported from multiple data sources in parallel; without `FOR UPDATE`, the `AlertActionResolver`'s "is this alert already open?" check would race with another resolver's "open it" write. The `FOR UPDATE` serialises the read-modify-write at the row level.
- **(b)** User-driven mutations explicitly DO NOT use `FOR UPDATE`. The reasoning (inferred from the comment's contrast): user-driven status mutations are typically operator-triggered (one operator at a time per alert), the contention is low, and the application-level reopen-guard (`openAlertWithTheSameTypeExistsForDataEntity`) is acceptable defence. The maintainer accepted the read-then-write race on mutations (per REFACTOR-037 / REFACTOR-236) in exchange for shorter lock-holding durations on the user path.
- **(c)** The decision is documented INLINE in source code — not in an ADR, not in a doc, not in a Javadoc. The comment IS the intent anchor; a future maintainer removing `FOR UPDATE` from `getOpenAlertsForEntities` (or ADDING it to `updateAlertStatus`) would have to read past the comment to do so. This is "narrow documentation at the load-bearing seam" — the maintainer trusts that the only readers of this code will SEE the comment.
- **(d)** The pattern is alert-specific. Other repositories in the batch (Lineage, Ownership, Policy, DataEntity) do NOT use `FOR UPDATE` anywhere. The selective application is intentional: only the multi-producer-ingestion path needs it; other repository paths rely on the platform's transactional isolation (READ COMMITTED by default).

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the verbatim inline comment IS the intent anchor. The maintainer explicitly framed the trade-off (BIS/FDT vs FDQT) and documented the reasoning. No other repository in the batch has FOR UPDATE; the alert repository's selective application is deliberate.
2. *Structural impact?* YES — affects the ingestion-path concurrency model (multiple data sources racing on FDQT alerts), the lock-acquisition latency budget (FOR UPDATE adds round-trip cost), the choice of transaction isolation (this code presupposes READ COMMITTED), and the user-driven mutation path's eventual-consistency story (the reopen-guard race is the price).
3. *Refactoring or structural?* STRUCTURAL — switching to "FOR UPDATE everywhere" or "FOR UPDATE nowhere" would change the platform's concurrency model. The selective application IS the architecture.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveAlertRepositoryImpl.md` says: "`getOpenAlertsForEntities` uses `FOR UPDATE` deliberately; the mutation path does NOT. The inline comment at `ReactiveAlertRepositoryImpl.java:130-132` explicitly frames the intent: `// While BIS and FDT type of alerts usually are engaged in one ingestion request / FDQT type more likely can be reported from various data sources. / In such cases 'for update' clause prevents potential concurrent issues`. The lock-on-read on the INGESTION path is intentional (FDQT — Failed-Data-Quality-Test alerts can be reported from multiple sources simultaneously). The ABSENCE of `FOR UPDATE` on the MUTATION path (`updateAlertStatus`, `openAlertWithTheSameTypeExistsForDataEntity`) is the converse implicit decision."
- `ReactiveAlertRepositoryImpl.java:126-134` — the FOR UPDATE call + the inline comment
- `ReactiveAlertRepositoryImpl.java:297-306` — the mutation path with no FOR UPDATE

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-067** (existing — `@ReactiveTransactional` boundary asymmetry) — the ingestion path's transactional boundary at `AlertServiceImpl.applyAlertActions` (line 201) is what makes the FOR UPDATE effective; without the wrapping transaction the row lock would be released prematurely.
- ADR-CANDIDATE-058 (existing — data-entity status-machine) — the alert status machine is conceptually similar; both rely on application-level reopen-guards rather than DB-level fences for user-driven mutations.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-037 (existing — reopen-conflict guard race on `changeAlertStatus`; the price of the user-driven-mutation-unfenced choice).
- REFACTOR-236 (NEW — SQL-layer confirmation of the reopen-guard race; the absence of `FOR UPDATE` on the mutation path + the absence of DB-level UNIQUE constraint produces the race).

**Proposed action**: Promote to `adrs/drafts/selective-row-locking-on-ingestion-paths.md` (new ADR). Document:
- The pattern (FOR UPDATE on multi-producer ingestion reads; no FOR UPDATE on user-driven mutation reads).
- The verbatim source comment (lift the comment from `ReactiveAlertRepositoryImpl.java:130-132` into the ADR text — it IS the intent anchor).
- The trade-off (ingestion correctness + extra latency vs user-mutation race + shorter latency).
- The known prices (REFACTOR-037, REFACTOR-236 — the reopen-guard race is the ADR's accepted cost).
- The cross-link with ADR-CANDIDATE-067 (the transactional boundary that makes FOR UPDATE effective).
- The maintainer-extension contract: future repositories with multi-producer write paths should consider FOR UPDATE; user-driven paths default to no-lock unless a specific concurrency case is documented.

**Severity rationale**: MEDIUM — pattern-shaping decision for one repository, with cross-cutting implications for the platform's concurrency strategy. Not codebase-wide (only the alert repository uses FOR UPDATE), but the rationale generalises to any future multi-producer ingestion path.

---
