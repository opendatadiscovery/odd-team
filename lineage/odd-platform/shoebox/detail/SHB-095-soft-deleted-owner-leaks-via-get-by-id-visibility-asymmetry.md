# SHB-095 — Soft-deleted Owner row visible via GET-by-id but hidden from list (visibility asymmetry leaks deleted PII)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators expect that deleting an Owner (whose `name` field commonly carries PII — email addresses, employee handles, pseudonymous-research identifiers) removes it from every read surface, with the row persisting only for audit history. The actual behaviour: `GET /api/owners` filters soft-deleted rows out (the inherited `ReactiveAbstractSoftDeleteCRUDRepository.listCondition` adds `deleted_at IS NULL`), but `GET /api/owners/{owner_id}` does NOT — `ReactiveOwnerRepositoryImpl.getDto` queries without the deleted_at filter. A direct by-id read returns the soft-deleted Owner's name + role list + USER_OWNER_MAPPING. Combined with the OPENLY-readable Owner list (SHB-085), an attacker who recorded the Owner ids during normal browsing can iterate by-id reads post-deletion and recover the PII the operator believed they had removed.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:44-52` — `list` filtered: routes through `ownerRepository.list` which inherits the soft-delete `listCondition`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/OwnerServiceImpl.java:102-107` — `getOwnerDtoById` NOT filtered: `ownerRepository.getDto(ownerId).switchIfEmpty(NotFoundException)`. The `switchIfEmpty` fires ONLY for never-existed ids; soft-deleted ids pass through and return the row.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveOwnerRepositoryImpl.java:65-83` — `getDto` query has no `deleted_at IS NULL` predicate on the OWNER table (only on the joined OWNER_TO_ROLE / ROLE side).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveAbstractSoftDeleteCRUDRepository.java:50-59` — the `delete` impl: `UPDATE owner SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL` — soft-delete only.
- `odd-platform-specification/openapi.yaml:131-220` — `GET /api/owners/{owner_id}` declares response `200` with the same `Owner` schema as the list endpoint; no doc-mention of soft-delete semantics.
- Live `/owners` doc (WebFetched 2026-05-25) — silent on soft-delete, name re-use, or by-id visibility.

## Notes

- This is the deleteOwner sidecar's bugs[6] surface, anchored at the service tier in OwnerServiceImpl (which surfaces as bugs[9] there) — the asymmetry between `list` (filtered) and `getOwnerDtoById` (unfiltered) is unstated.
- Operator-pain scenarios:
  - GDPR right-to-erasure: an operator deletes "Alice Smith"'s Owner row to satisfy a deletion request. GET `/api/owners/{the-id}` still returns Alice's name. Compliance partially defeated.
  - Sensitive-name redaction: an operator deletes an internal-team Owner that was misnamed with a sensitive project codename. The list view no longer shows it; the by-id view still does.
- Soft-deleted Owner's USER_OWNER_MAPPING rows also persist (per ReactiveOwnerRepositoryImpl batch sidecar — `userOwnerMapping.isOwnerAssociated` does filter `deleted_at IS NULL` on its own join, but the persisted user-owner association rows remain). A user previously bound to a soft-deleted Owner can have their identity correlated post-deletion.
- Combined with SHB-085 (ungated GET-list): any authenticated user can enumerate the active Owner ids, AND iterate by-id to recover soft-deleted owners. The threat model is "compromised low-privilege user" not "external attacker."
- Combined with SHB-084 (Owner mint via 3 side-doors) + the partial-unique-index name-reuse pattern: operator deletes "Bob Smith", new "Bob Smith" is minted by an Ownership form with a different id; both rows exist with the same name; by-id reads to the OLD id still return the original soft-deleted Bob.

## Next

1. **ENRICH F-019** with this drift facet (`getownerdtobyid_returns_soft_deleted_visibility_asymmetry_leaks_pii`).
2. **REFACTOR-NNN**: add `.where(OWNER.DELETED_AT.isNull())` to `ReactiveOwnerRepositoryImpl.getDto`. One-line, low-risk fix. Consider doing the same audit across every `getDto`-style method in soft-delete repositories.
3. **DOC-NNN**: live `/owners` page must document soft-delete semantics, the name-reuse mechanic, and the visibility contract.
4. **TEST-GAP-NNN**: regression test seeding soft-deleted Owner, asserting `GET /api/owners/{id}` returns 404 (not 200 with the row).
5. Consider extending the audit to other soft-deleted entity types (Term, DataSource, etc.) — same architectural pattern likely present.

## Links

- cluster_with: [F-019, SHB-085, SHB-084]
- merged_into: F-019
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged — F-019 already carries `soft_deleted_owner_visible_via_get_by_id_but_hidden_from_list` in its drift_class_summary; this thread STRENGTHENS the facet with GDPR-right-to-erasure operational scenario + cross-link to SHB-084 (mint side-doors) + SHB-085 (ungated list reads) + USER_OWNER_MAPPING persistence + cross-feature audit candidates (extend to Term/DataSource). F-019: shoebox_extensions_2026_05_26 → drift_class: getownerdtobyid_returns_soft_deleted_visibility_asymmetry_strengthens_existing. Category flipped open → merged.
