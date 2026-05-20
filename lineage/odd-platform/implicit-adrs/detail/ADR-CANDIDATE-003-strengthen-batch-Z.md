## ADR-CANDIDATE-003 — STRENGTHENED BATCH Z — Read-collaborative GET pattern EXTENDS to the S2S read surface; a NEW AUTH-MODE-ORTHOGONAL property emerges (getDataEntitiesByDEGOddrn anchors as the 10th surface) — surfaced as a borderline-flagged companion ADR-CANDIDATE-192 NEW batch Z

**Severity unchanged**: HIGH
**Updated support count**: now **10 sidecars** (9 prior at batch Y + 1 batch Z getDataEntitiesByDEGOddrn)
**Batch**: Z (2026-05-20)

**New surfaced_by**:
- `getDataEntitiesByDEGOddrn.md:implicit_adrs.[0]` (HIGH) — "Read-collaborative posture extends to the S2S read surface — explicitly UNSCOPED reads by design" — evidence: IngestionController.java:75-79 (no @PreAuthorize) + DataEntityGroupServiceImpl.java:92-108 (no fetchAssociatedOwner) + ReactiveDataEntityRepositoryImpl.java:318-326 (no OWNERSHIP join) + the platform's consistent pattern of unscoped reads across the entire DEG-membership / DEG-lineage / search / search-facet surfaces (ADR-CANDIDATE-003 / 114 / 122 family per REFACTOR-024 + REFACTOR-203 + F-016) — intent_anchor: the pattern is platform-wide; every DEG-anchored read endpoint in the codebase applies the same unscoped posture. The S2S read endpoint matches the architectural shape of its UI-side siblings — confidence: HIGH

**Cross-batch picture — extension from UI surface to S2S surface**:
- Batches A through Y: 9 surfaces (DataEntityController detail / lineage / attachments / directory + AlertController.getAllAlerts + ActivityController.getActivity + SearchController.search + PermissionController.getResourcePermissions + DataEntityAttachmentController) — all under `/api/**` with `.pathMatchers("/**").authenticated()` catch-all fallback
- **NEW Batch Z: getDataEntitiesByDEGOddrn (under `/ingestion/**`)** — same read-collaborative shape BUT WITHOUT the `.authenticated()` fallback because the path is in `SecurityConstants.WHITELIST_PATHS` (line 96). The endpoint is anonymously reachable in EVERY auth mode.

**The NEW load-bearing property: AUTH-MODE-ORTHOGONAL reachability**. Where ADR-003's 9 prior surfaces were "read-collaborative AMONG authenticated users", THIS surface is "read-collaborative AMONG ALL CALLERS — including unauthenticated network probes — in every shipped deployment configuration". The S2S read endpoint shares ADR-003's unscoped posture BUT does not share the authentication requirement.

**Companion ADR**: The AUTH-MODE-ORTHOGONAL property is surfaced as a NEW ADR-CANDIDATE-192 NEW batch Z (borderline_flag: true — whether the maintainer DELIBERATELY chose "S2S reads have no auth at all" or whether the gap evolved from the compound of WHITELIST_PATHS + filter-path scoping is the open question). ADR-003 is the parent (the read-collaborative shape); ADR-192 is the child (the specific auth-mode-orthogonal extension to the S2S surface).

**Updated full surface enumeration (10 sidecars)**:
1. DataEntityAttachmentController (read-side attachment endpoints)
2. DataEntityController (detail / lineage / attachments / alerts / messages / etc — 27+ GET endpoints class-level)
3. DirectoryController (read endpoints)
4. AlertController.getAllAlerts
5. ActivityController.getActivity
6. SearchController.search
7. PermissionController.getResourcePermissions
8. DataEntityController.getDataEntityDetails (the primary-source borderline-resolve in batch F)
9. DataEntityController.getDataEntityDownstreamLineage
10. **NEW Batch Z**: IngestionController.getDataEntitiesByDEGOddrn — the S2S read surface extension WITH the auth-mode-orthogonal property

**Severity unchanged at HIGH** — the pattern is platform-wide; the S2S extension adds the auth-mode-orthogonal property which is surfaced as the companion ADR-192 with borderline_flag for maintainer triage. The architectural shape (read-collaborative) is consistent; the auth-mode dimension is where the S2S surface diverges from the UI surface.

---
