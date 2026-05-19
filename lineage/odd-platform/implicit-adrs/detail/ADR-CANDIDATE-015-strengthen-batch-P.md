## ADR-CANDIDATE-015 — STRENGTHENED BATCH P — Owner-scoped routes — updateOwner + deleteOwner add the OWNER mutation tier (now 17 + 18-sidecar with the READ-vs-WRITE distinction)

**Severity unchanged**: LOW (convention decision; but the cross-batch insight adds architectural completeness)
**Updated support count**: now **17 + 18-sidecar** (15 prior batch-K-strengthen + 16 batch-M + 17 batch-P updateOwner + 18 batch-P deleteOwner)
**Batch**: P (2026-05-20)

**New surfaced_by**:
- `OwnerController__controller-method__updateOwner.md:security.owner_scoping` (HIGH) — "N/A — code is not data-scoped at this directory layer AND BYPASSES at the per-Owner-target dimension — the endpoint mutates a directory entry by id; there is no concept of 'this Owner row belongs to that user, so only that user can rename it.' A caller with `OWNER_UPDATE` permission can rename ANY Owner row, not just the one(s) they are associated with via USER_OWNER_MAPPING."
- `OwnerController__controller-method__deleteOwner.md:security.owner_scoping` (HIGH) — "N/A — code is not data-scoped. Owner is the SCOPING dimension; the owner-directory CRUD is meta-level — there is no concept of 'this Owner row belongs to that Owner row.'"

**Cross-batch insight — the READ-vs-WRITE distinction**: The owner-scoped pattern (READS via `/my*` + reactor Context principal resolution) PAIRS with the owner-mutation pattern (NO per-Owner scoping; global `OWNER_*` permissions). The architectural distinction is:

| Surface | Identity source | Per-Owner scoping |
|---|---|---|
| `/my*` READS | reactor Context (`AuthIdentityProviderImpl`) | YES — implicit (caller's own Owner) |
| `OWNER_*` writes | none (the path-bound owner_id is the target, not the caller) | NO — global management |

The architectural completeness: reading "my objects" requires identity-as-filter; writing "delete this owner" requires identity-as-permission-check-only. The platform DELIBERATELY chose to make Owner-mutations NOT per-Owner-scoped (anyone with OWNER_DELETE can delete any owner) — this is the management-tier model.

This complements:
- ADR-CANDIDATE-105 (batch K — fetchAssociatedOwner single-Mono primitive — the identity-as-filter primitive used by READs)
- ADR-CANDIDATE-075 (repository corollary — owner-id flows as `Long` into JOIN OWNERSHIP — the identity-as-filter consumer)
- ADR-CANDIDATE-117 NEW (batch M — anchor + derived-set lineage neighbourhood)

**Severity unchanged at LOW** (the convention statement) but the cross-batch READ-vs-WRITE distinction adds architectural completeness.

---
