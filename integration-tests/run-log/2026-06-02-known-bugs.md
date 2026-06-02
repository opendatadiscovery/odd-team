## 2026-06-02 — suite/protocol: known-bugs (Tier-1 e2e build-out: IT-003..IT-006)
- runner: AI-assisted (Claude Opus 4.8) — `npm test` in integration-tests/e2e, Node v24.13.0 (user-space ~/.local/node)
- stack: odd-minimal — image `ghcr.io/opendatadiscovery/odd-platform:latest`; stack auto up→healthy ~12s→down (-v)
- protocols: IT-002, IT-003, IT-004, IT-005, IT-006
- automation: UI e2e Playwright; api: none; manual: none
- outcome: **ALL RED (expected) — every pin reproduces its open bug for the documented reason** (the correct state for a quarantine suite)
- machine traces: integration-tests/e2e/test-results/*/ (test-failed-1.png + trace.zip; gitignored — `npx playwright show-trace <zip>`)
- evidence/notes (per pin, captured from this run):
  - **IT-003 catalog (PLT-090 / F-017 H-007)** — `500 PUT /api/search/{uuid}`: a `foo )(` query reaches `to_tsquery()` unescaped → Postgres 42601 → 500. Flips GREEN when JooqFTSHelper escapes tsquery operators.
  - **IT-003 dictionary (PLT-127 / F-024 H-009)** — `500 PUT /api/terms/search/{uuid}`: same root cause on the term-search surface. One fix closes both.
  - **IT-004 (PLT-052 Defect 1)** — injected an out-of-enum run status (`WARNING`) into `/api/dataqatests/runs`; the dashboard threw `TypeError: Cannot read properties of undefined (reading 'color')` (`palette.runStatus["WARNING"]` undefined, `DataQualityContent.tsx:47-48`) and did not render. Flips GREEN with a null-safe palette lookup.
  - **IT-005 (PLT-026 / F-018 H-001, LSN-019)** — seeded 35 tags (youngest 5 most-used); the most-used youngest tag `it005-POP-005` is absent from the Overview "Top Tags" strip — `listMostPopular` returned the 30 oldest by id. Flips GREEN when it aggregates before paginating.
  - **IT-006 (TEST-GAP-1013 / F-042)** — injected a malformed dashboard payload (`tables_dashboard: null`); a render throw white-screened the whole app — `#root` innerText length = 0 (nav chrome unmounted, no error boundary). Flips GREEN when a root/route-level ErrorBoundary contains the throw.
  - **IT-002 (PLT-104)** — view_count +2 (prior pin; unchanged).
- harness fixes made this session (the run is what surfaced them — recorded for reproducibility):
  - `helpers/db.latestSearchFacetQuery` queried a non-existent `deleted_at` column (real `search_facets` = id/query_string/filters/last_accessed_at) → crashed IT-003 catalog before its assertion; fixed + made best-effort.
  - `helpers/net.interceptDashboard` matched/mutated camelCase keys, but the HTTP wire is **snake_case** (`test_results`/`tables_dashboard`; the generated TS client camelCases only after fetch) → the injection was a no-op and IT-004/IT-006 false-passed. Fixed to snake_case + added an `injected` guard (a no-op interception now fails loudly instead of false-passing) + a `waitForResponse` so the assertion runs after the poisoned response lands (react-query renders valid `initialData` first).

## 2026-06-02 (later) — IT-007 added (Tier-2 attachment durability, LSN-001)
- runner: AI-assisted (Claude Opus 4.8) — `npm test -- attachment-local-durability`, Node v24.13.0; stack odd-minimal (auto up; platform recreated mid-test; down -v after).
- protocol: IT-007 (test_class integration — REST upload/download + a real container recreate; no browser). regresses PLT-086 / validates F-027 / LSN-001.
- outcome: **RED (expected) — reproduces LSN-001 end-to-end.** Flow: upload (initiate→chunk→complete, fileId=1) → download-before 200 + bytes match → **recreate platform container** (DB kept, healthy again ~12s) → attachment **still listed** (DB record survived) → download-after **500** (file gone). The platform lists a file it can no longer serve = silent data loss. Flips GREEN when LOCAL is backed by a persistent volume by default (or durable REMOTE is the default).
- two spec defects this run surfaced + fixed:
  - initiate body field is **`fileName` (camelCase)**, NOT `file_name` — `fileName` is one of the ~8 camelCase outliers in the contract (ADR-0072 serialization-naming); the server returned `400 field:"fileName" must not be null`. A live confirmation of exactly the inconsistency ADR-0072 now documents.
  - `helpers/docker.ts` compose path was `../../lineage` but the helper sits in `e2e/helpers/` (one level below `global-setup.ts`) → fixed to `../../../lineage`.
