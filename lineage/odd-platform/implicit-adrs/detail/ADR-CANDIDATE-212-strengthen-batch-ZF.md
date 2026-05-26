# ADR-CANDIDATE-212 — Directory dimension tables are mutated ONLY as a side-effect of feature-domain mutations; the read surface is exposed but the WRITE surface is intentionally absent (`Title` is the canonical instance)

## STRENGTHENS — batch ZF (2026-05-25)

**Two new sibling instances** of the directory-side-effect-only-mutation pattern join the support set: the **MetadataField** case + the **Owner** partial case (Owner is a HYBRID — has a write controller but ALSO has a side-effect path; the side-effect path is the pattern this ADR captures).

- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:implicit_adrs.[0]` — "**Custom-metadata catalogue is read-only on this surface; mutation is a side effect of per-value write operations** — the controller exposes ONLY `getMetadataFieldList`. The write path is `MetadataFieldServiceImpl.getOrCreateMetadataFields` called from `DataEntityServiceImpl.createMetadata` (per batch L sidecar) and the EXTERNAL-origin path `ingestMetadataFields` called from the collector ingestion pipeline. The directory is therefore a derived dimension that follows custom-metadata value writes, not an independently managed catalogue."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:bugs_limitations_corner_cases.[1]` + `coherence_notes.[enclosing-class-triangulation]` — `ownerService.getOrCreate` (`OwnerServiceImpl.java:38-42`) is reached from THREE separate service-tier callers (OwnerAssociationRequestServiceImpl + OwnershipServiceImpl + TermOwnershipServiceImpl). The Owner case is the HYBRID: the controller exposes both `/api/owners` POST (explicit-create) AND a side-effect-grow surface via 3 service-tier callers.

The ADR's support set is now **4-sidecar pure-instance + 2-sidecar hybrid-instance**:

**Pure-instance** (canonical pattern — read controller + side-effect-only writes):
1. **Title** (batch ZE — the ORIGINAL canonical instance) — `TitleController` is a single-GET; `TitleService.getOrCreate(name)` called from `OwnershipServiceImpl` is the side-effect-only write path.
2. **MetadataField** (batch ZF — new) — `MetadataFieldController` is a single-GET; `MetadataFieldServiceImpl.getOrCreateMetadataFields` called from `DataEntityServiceImpl.createMetadata` (user-side) + `ingestMetadataFields` from the collector pipeline (collector-side) are the side-effect-only write paths.

**Hybrid-instance** (controller exposes explicit-create AND side-effect-grow path):
3. **Tag** (batch K — pre-existing finding, acknowledged via ADR-CANDIDATE-065) — `TagController` exposes mutations; `TagServiceImpl.getOrCreateTagsByName` also side-effect-grows from data-entity tag application.
4. **Owner** (batch ZF — new) — `OwnerController` exposes CRUD; `OwnerServiceImpl.getOrCreate` ALSO side-effect-grows from 3 service-tier callers. The Owner case is the FULL HYBRID — both explicit and side-effect paths.

The architectural pattern is now richer than batch-ZE described. The strengthening reveals:
- **A pure-instance directory** has NO explicit-create controller; growth is 100% side-effect (Title, MetadataField-INTERNAL).
- **A hybrid-instance directory** has an explicit-create controller AND side-effect callers; the explicit and side-effect paths are gated by DIFFERENT permissions (Tag, Owner).
- **A fully-managed directory** would have an explicit-create controller with NO side-effect callers — none currently exist in the codebase, suggesting the platform CHOSE the pure / hybrid shapes deliberately.

The maintainer-stance is: directory growth is induced by usage. Whether the platform exposes an explicit-create path is independent of the side-effect path; the side-effect path is ALWAYS present. This is the load-bearing claim.

**Cross-link to ADR-CANDIDATE-218 (batch ZF NEW)**: ADR-218 captures the SECURITY-ARCHITECTURE consequence — the side-effect paths bypass directory-level permission gates. ADR-212 captures the GROWTH-MODEL choice — directories ARE grown by usage. The two ADRs compose: ADR-212 says "directories grow by side-effect"; ADR-218 says "side-effect callers are not gated by the directory's permission". A future maintainer reading the two ADRs gets the full picture.

**Co-surfaced gaps** that link to this ADR family:
- REFACTOR-636 (Owner side-channel) — operator-actionable
- REFACTOR-642 (MetadataField read gaps) — read-side consequence
- REFACTOR-436 (metadata_field partial-unique indices not migrated for soft-delete) — schema-side consequence

---
