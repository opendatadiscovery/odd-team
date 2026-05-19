## ADR-CANDIDATE-054 — STRENGTHENED by batch J (UI-side LSN-017 root-cause primary source pinned + F-001 view_count loop closure confirmed at UI realisation point)

This file appends batch-J primary-source confirmations to ADR-CANDIDATE-054 ("The centerpiece data-entity detail read is a read-as-write operation — getDataEntityDetails runs inside @ReactiveTransactional and unconditionally increments view_count per call"). Batch J pins the UI side of the loop: the F-001 inflation chain is closed end-to-end with empirical probe-run measurement.

**Batch J new surfaced_by**:
- `DataEntityDetails.md:downstream_side_effects` (|-
    "**Backend `view_count` mutation per mount: +2 (LSN-017 bug locus)** — empirically pinned by probe P-004 at run R-20260519T010758Z-P-004 (xhr_count=2 + DB delta=2; regex-filtered to exact `/api/dataentities/1004` path) — confidence: HIGH (MEASURED, not inferred).")
- `fetchDataEntityDetails.md:downstream_side_effects` (|-
    "+1 to `data_entity.view_count` row on the backend (per batch F sidecar: 'every successful read increments view_count by 1 in the same transaction')" + "Detail-page mount is a hot path — every entity click in Search/Directory/Catalog Overview lands in `<DataEntityDetails>`, which fires this thunk at least once (twice given the self-feeding refire)")
- `PopularStrip.md:bugs_limitations_corner_cases[0]` (|-
    "**F-001 LOOP CLOSURE — the UI surface that displays the inflatable ranking is ALSO the surface that triggers view_count increments on click.** A user clicks a Popular tile → SPA navigates to `/dataentities/{id}/overview` → the entity-detail page mounts → `fetchDataEntityDetails` fires `GET /api/dataentities/{id}` → server-side `incrementViewCount` runs → the entity's view_count rises → next Popular refresh ranks it higher.")

**Updated evidence shape**: ADR-CANDIDATE-054 was previously inferred from the @ReactiveTransactional placement on the read-side service path. Batch J adds:
1. **Empirical measurement** — probe-run R-20260519T010758Z-P-004 measured xhr_count=2 + DB delta=2 with regex-filtered exact path match. The +2 per page-open is no longer inferred; it is measured.
2. **LSN-017 root-cause PRIMARY-SOURCE pinned at `DataEntityDetails.tsx:56-64`** — the useEffect dep-array bug (`details.status?.status` in deps) is the locus; the self-feeding refire is now diagnosed at file:line precision.
3. **F-001 loop closure UI realisation** — clicking Popular → entity Overview tab → view_count increment → next Popular fetch ranks higher. The loop is observable from the UI in real-time.

**Cross-pillar significance**: P-01 (Discovery — Popular ranking) × P-05 (Lineage — Lineage tab click-through does NOT trigger view_count, but the navigation does via the detail-page mount on the SAME route). The view_count side-effect is wider than the entity-detail read; it is triggered by any UI navigation to `/dataentities/{id}/overview`.

**Co-surfaced gaps newly confirmed by batch J**:
- REFACTOR-201 (existing — view-count UPDATE inside @ReactiveTransactional) — UI-side primary-source confirmation: the increment is doubled at the UI source
- REFACTOR-211 (existing — view_count hot-key UPDATE under read load) — UI-side primary-source: every page-open is +2 (doubled by LSN-017), amplifying the hot-row contention
- REFACTOR-220 (existing — view_count inflation loop, PRIMARY-SOURCE CONFIRMED at backend) — batch J adds the UI-side PRIMARY-SOURCE confirmation at `DataEntityDetails.tsx:56-64`

**LSN-017 fix shape**: 1-line change at `DataEntityDetails.tsx:63` — remove `details.status?.status` from the dep-array. The fix reduces the inflation from +2 to +1 per page-open; the absolute fix requires backend rate-limiting (REFACTOR-211) or moving the increment outside @ReactiveTransactional (REFACTOR-201).

---
