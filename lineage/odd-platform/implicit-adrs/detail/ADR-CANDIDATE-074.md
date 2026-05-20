## ADR-CANDIDATE-074 — Soft-delete-aware identity LEFT JOIN — `USER_OWNER_MAPPING.DELETED_AT IS NULL` produces best-effort identity display; durable username string is the audit identity

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (this batch — Alert) — cross-batch context from prior RBAC and activity-feed sidecars
**Axes present**: repositories, audit-trail

**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:implicit_adrs[2]` (the explicit USER_OWNER_MAPPING + DELETED_AT IS NULL pattern at three sites)

**Decision statement**: When ODD reads an alert row (or any row that records a user attribution via `status_updated_by` / `created_by` / similar string columns), the identity-to-display resolution uses a **soft-delete-aware LEFT JOIN** on `USER_OWNER_MAPPING`:

```sql
LEFT JOIN USER_OWNER_MAPPING
  ON ALERT.STATUS_UPDATED_BY = USER_OWNER_MAPPING.OIDC_USERNAME
  AND USER_OWNER_MAPPING.DELETED_AT IS NULL
```

(`ReactiveAlertRepositoryImpl.java:83-86`, `:105-108`, `:499-502` — the pattern is applied UNIFORMLY at all three read sites that surface OwnerPojo).

The decision codifies a **two-layer identity model**:
1. **The audit identity (durable)** — the OIDC username string stored on the row (`ALERT.STATUS_UPDATED_BY VARCHAR`). This is NEVER NULL after a status change (per `ReactiveAlertRepositoryImpl.java:301`). It is the canonical record of "who did this"; it survives user deletion, user-owner unlink, OIDC provider changes, and any other identity reconciliation event. Audit-trail queries reading the row directly get this string; forensic reconstruction is always possible from the username alone.
2. **The display identity (best-effort)** — the JOINed `OwnerPojo`, surfaced via the LEFT JOIN. This represents the CURRENT user-owner binding for the username. If the user is currently linked to owner X via `user_owner_mapping`, the alert shows "Updated by X". If the user has been unlinked (e.g. employee left the company → admin removed the user-owner mapping → DELETED_AT is set), the JOIN returns NULL — the alert shows "Updated by (unknown owner)" but the username string is preserved on the row.

The `DELETED_AT IS NULL` predicate on the JOIN is the **soft-delete awareness**: it ensures the display reflects the LIVE binding, not the historical binding. An admin can re-link the same username to a different owner; the alert's display will update automatically (no migration needed). The audit identity remains the username; the display identity follows the current binding.

The architectural choice codifies:
- **(a)** Username strings are the durable audit anchor. They never get re-keyed, never get NULLed on user deletion, never get garbage-collected. Forensic queries depending on identity reconstruction always work.
- **(b)** Owner bindings are best-effort. The UI shows what's currently linked; soft-deleted user-owner mappings are invisible. The trade-off accepted: stale owner displays don't surface; the audit trail is the source of truth for "who did this" historically.
- **(c)** The pattern is uniform across every alert read. Three sites apply the same join shape; a maintainer changing one without changing the others would produce an inconsistency. The uniformity itself is the architecture; the maintainer-extension contract is "always include `DELETED_AT IS NULL` on the USER_OWNER_MAPPING JOIN."
- **(d)** The pattern likely generalises to other audit surfaces (activity feed, data entity ownership history) — cross-batch evidence is needed but the alert sidecar's three-site consistency suggests the pattern is platform-wide.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the three-site consistency of the join shape (with the same `DELETED_AT IS NULL` predicate) is the intent anchor. The maintainer applied the same idiom verbatim at lines 83-85, 105-107, 500-501 — a copy-paste pattern that ENCODES the design decision. The alternative (omitting the predicate) would surface stale bindings; the choice to include it is deliberate.
2. *Structural impact?* YES — affects the audit-trail durability model (username is canonical), the user-deletion / unlink UX (display degrades gracefully to NULL; audit survives), the cross-batch identity pattern (every audit table follows this shape).
3. *Refactoring or structural?* STRUCTURAL — switching to "audit by FK to OWNER" would force user-deletion to either CASCADE-delete every audit row (data-loss) or to preserve orphan FKs (FK-integrity violation). The username-as-anchor model is the only consistent choice for a deletion-friendly audit trail.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveAlertRepositoryImpl.md` says: "Owner of `status_updated_by` is resolved via LEFT JOIN with `DELETED_AT IS NULL` on USER_OWNER_MAPPING, not via a direct join on OWNER. The username string is the source of truth (stored on the ALERT row); the user→owner binding is dereferenced at READ time via the USER_OWNER_MAPPING table with soft-delete awareness. The convention is applied consistently across all three read paths that surface `OwnerPojo` (`get(long)`, `get(List<Long>)`, `createAlertOuterSelect`). The implicit decision: alert audit identity is durable (the username string survives user-owner unlink); the OWNER display is best-effort and degrades to NULL on unlink."
- `ReactiveAlertRepositoryImpl.java:83-86, 105-108, 499-502` — the three LEFT JOIN sites with the identical `DELETED_AT IS NULL` predicate

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete taxonomy) — `user_owner_mapping` uses the standard `deleted_at` soft-delete; this ADR specifies how downstream consumers READ around the soft-delete.
- ADR-CANDIDATE-069 (NEW — edge tables are hard-delete) — distinguishes `user_owner_mapping` (soft-delete because it's a user-owned binding) from pure edge tables (hard-delete). The mapping is logically an edge but uses soft-delete because admins want to undo unlinks easily.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- No direct gap surface; the pattern is consistently applied. If the pattern were inconsistently applied (e.g. some reads omit the DELETED_AT IS NULL predicate), that would be the gap. None observed in this batch.
- Implicit risk: future audit surfaces (e.g. RBAC audit per REFACTOR-188) MUST follow the same identity pattern. Without this ADR documented, future maintainers might invent a different pattern (FK to OWNER, FK to USER, embedded display name string snapshot, etc.) and produce identity-handling inconsistency across audit tables.

**Proposed action**: Promote to `adrs/drafts/soft-delete-aware-identity-join.md` (new ADR). Document:
- The two-layer identity model (durable username + best-effort owner display).
- The LEFT JOIN pattern with `DELETED_AT IS NULL`.
- The cross-batch implications (every audit table should follow this pattern).
- The user-deletion UX (display degrades gracefully; audit survives).
- The maintainer-extension contract: future audit surfaces SHOULD use `(username string, LEFT JOIN owner ON deleted_at IS NULL)` rather than FK to owner.

Cross-link with the audit-emission ADRs (the alert activity events; future RBAC audit per REFACTOR-188) — the audit-trail identity model is the foundation those events build on.

**Severity rationale**: MEDIUM — pattern-shaping decision for audit-trail identity. Less codebase-wide than ADR-CANDIDATE-068 (which covers all CRUDable entities) but cross-cutting for every future audit surface. Compatible-change calculus for any RBAC-audit work (REFACTOR-188's fix) requires understanding this pattern.

---
