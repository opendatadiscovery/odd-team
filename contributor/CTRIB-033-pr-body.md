# fix(reference-data): guard column write endpoints + reject name collisions (#1769)

Closes #1769

## Problem

Two contract gaps in the Reference Data (Lookup Tables) write API, verified live on `main`:

- **(a) A name-normalisation collision returns a raw `500`.** `createLookupTable` builds the physical table name by lowercasing + replacing spaces with underscores, with no uniqueness pre-check. Two display names that normalise to the same physical name in one namespace (e.g. `My Table` and `my_table`) collide at the physical `CREATE TABLE` and surface a generic `500 SYS001 "Internal Server Error"` — a cataloguer can't tell it was a name clash.
- **(b) `PATCH /referencedata/table/{lookupTableId}/column/{columnId}` ignores the path table id.** The controller forwarded only `columnId` to the service, which resolved the column by id alone with no table cross-check — so `PATCH /table/{A}/column/{col_of_B}` returned `200` and renamed **table B's** column. The read endpoint (`getLookupTableField`) already enforces the column-to-table linkage; the write path did not. `DELETE` on the same path had the identical, *destructive* defect (it dropped a column off the wrong table).

## Fix

- **(a)** Add `ReactiveLookupTableRepository.existsByTableName` and a uniqueness pre-check in `createLookupTable`; a collision now throws `UniqueConstraintException` → **`400` (`USR003`, "already exists in this namespace")** — the same contract the platform already uses for every other uniqueness collision (namespaces, terms, owners, tags, …) via `ControllerAdvice`. (Chosen over a one-off `409`, which would diverge from that established convention.)
- **(b)** Thread `lookupTableId` through `updateLookupTableField` **and** `deleteLookupTableField`, and enforce the **same** column-belongs-to-table guard the read path already has — a mismatched `columnId` is rejected with `400` ("doesn't belong to") instead of mutating the wrong table.

No OpenAPI / migration / authorization-posture change: the endpoints already carry both path ids, error responses were already undeclared in the spec, and the fix mirrors an existing read-path guard rather than introducing a new authorization rule.

## Tests

**Unit (`odd-platform-api`, full `:odd-platform-api:build` green):**
- `ReferenceDataServiceImplTest` — the create collision throws `UniqueConstraintException`; the create proceeds when unique; `updateLookupTableField` / `deleteLookupTableField` reject a foreign column with `BadUserRequestException` and proceed for an owned column.
- `ReferenceDataControllerTest` — the column `PATCH` / `DELETE` endpoints forward **both** path ids to the service.
- `ReactiveLookupTableRepositoryImplTest` — `existsByTableName` against a real Postgres (Testcontainers).

**Integration (browser e2e, `lookup-tables-rdm.spec.ts`, RED→GREEN proven):**
- The lookup-tables RDM characterization cases were re-grounded from pinning the bug to asserting the fix: a normalisation collision now returns `400 USR003` ("already exists"); a cross-table `PATCH` returns `400` and leaves table B untouched; a new case asserts a cross-table `DELETE` returns `400` and table B keeps its column.
- **GREEN** on the working-tree build (the fix); **RED** on `ref:main` (the pre-fix base): the collision still `500`s and the cross-table `PATCH`/`DELETE` still mutate/drop table B.

**Full integration regression (working-tree build):** `feature-complete` green for this change (the only failures are unrelated to reference data — two belong to a separate, still-open front-end PR, and one is a known flaky owner-association test); `multi-stack` and the ingestion e2e green; the known-bug pins stay red-as-expected (none flipped).

## Scope

This PR is the two reported contract gaps plus the byte-identical destructive `DELETE`-column twin of (b). Deliberately out of scope, tracked separately:
- The lookup-table **rename** path reuses the same name-builder and shares the collision risk — a separate follow-up.
- The column-mutation **permission gate** for `PATCH`/`DELETE` (a separate, already-documented path-mismatch issue: the authorization rule is registered on a singular `/column/` path while the route is plural `/columns/`, so the gate falls through to authentication-only) is **not** addressed here — it is an authorization-posture change that warrants its own review, tracked as a follow-up. This PR's guard closes the *cross-table* vector but does not change the permission gate.

Milestone: 0.29.0
Docs: documentation@`release/0.29.0` — the Reference Data API page's caveat (which documented the cross-table-mutation defect) is corrected to reflect this fix while retaining the separate permission-gate caveat; publishes with the 0.29.0 release.
