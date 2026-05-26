# SHB-164 — Opening any data entity detail page mints two view_count increments via self-feeding useEffect dep-array loop

**Category**: clustering
**Severity**: HIGH

## Hypothesis

When operators open any data entity detail page (`/dataentities/{id}/*` — every Search result click, every Catalog row, every Popular tile, every Lineage node, every Alert link), the backend `view_count` for that entity is incremented BY 2 (not by 1) per page-open. This is because the `useEffect` at `DataEntityDetails.tsx:56-64` lists `details.status?.status` in its dependency array — a value that is itself populated BY the very fetch the effect dispatches. First render: status undefined → fetch dispatched → server increments view_count. Response lands, status flips from undefined to its value → effect re-fires → second fetch → second view_count increment. The entire Popular Entities Ranking (F-001) is inflated by exactly 2× from the UI side; a script-driven detail-read attack is exactly twice as cheap as the API allows.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:56-64` — the useEffect with the 5-element dep array including `details.status?.status`.
- `odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:35-42` — `fetchDataEntityDetails` thunk, called twice per mount.
- `odd-platform-api/src/main/java/.../ReactiveDataEntityRepositoryImpl.java:173-180` — backend per-call side effect: `UPDATE data_entity SET view_count = view_count + 1` inside the @ReactiveTransactional read.
- Probe P-004 (run R-20260519T010758Z-P-004) — EMPIRICALLY PINNED: xhr_count=2 + DB delta=2 per page-open.
- LSN-017 retrospective canonical anchor.

## Notes

- This is the canonical primary anchor for F-001 (Popular Entities Ranking) inflation — but F-001 already captures the broad surface. This thread is an ENRICHER pinning the UI-side multiplicity producer and the fix locus.
- Click Popular tile → mounts DataEntityDetails → fires fetch twice → +2 view_count → next Popular render ranks the clicked entity even higher = the UI literally closes the inflation loop (per F-001 cross-reference).
- Fix is ONE LINE: remove `details.status?.status` from the dep array at line 63. The author KNEW the correct pattern (the second useEffect at lines 66-76 uses `[dataEntityId]` correctly).
- The second useEffect fires 4 additional parallel fetches per mount (alerts count, DQ test report, SLA report, resource permissions) — not buggy but a perf load: 5 logical / 6 actual fetches per page-open.
- No requestId stale-response protection: rapid entity-id flips can see A's late response overwriting C's data.
- No client-side de-dup: rapid mash of entity routes mints many concurrent /api/dataentities/{id} calls (each +1 view_count).
- TEST-GAP-310 already filed in test-map.

## Next

1. **SHIP THE 1-LINE FIX** at DataEntityDetails.tsx:63 — highest-leverage 1-line PR in the entire UI codebase.
2. Add the regression-pin integration test (mount + assert dispatch fires exactly once).
3. Cross-promote to F-001 as the canonical UI-half anchor.
4. Consider adding `view_count` rate-limit at the backend (defence in depth — even with the UI fix, a malicious actor can still pump via scripted GETs).

## Links

- cluster_with: [F-001, F-003]
- merged_into: (set when merged into F-001)
- supersedes: []
