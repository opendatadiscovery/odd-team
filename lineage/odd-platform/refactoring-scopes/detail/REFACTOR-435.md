## REFACTOR-435 — Substrate-quality: synthetic-node walker emits enrichment candidates without verifying the method exists in the target source file; PHANTOM-NODE `getPolicyPermissions` on `PermissionController` is the load-bearing example

**Severity**: MEDIUM (substrate-process, not platform-quality)
**Category**: substrate-quality (process improvement; NOT a platform-quality finding)
**Pillars affected**: [tooling]
**Batch**: P (2026-05-20)

**Surfaced by**: `PermissionController__controller-method__getPolicyPermissions.md:bugs_limitations_corner_cases.[0]` (MEDIUM — substrate-quality category)

**Description**: The synthetic-node walker (described in `state/sprint-themes.yaml:210-212`) produced `getPolicyPermissions` as a candidate node-id without verifying that the method exists in the source file. `PermissionController.java:14-26` contains exactly one method (`getResourcePermissions` at lines 20-25); the entire file is 27 lines including imports. The synthetic-node entry provides only a `rationale` field ("Permission catalogue read. RBAC observability."); there is no method-existence assertion. A pre-emission existence check ('does the named method appear in the source file?') would have caught this. The cost of the miss is small (one phantom sidecar requiring a deliberate phantom-node enrichment to disambiguate), but the pattern recurring at scale would inflate the enrichment backlog with non-existent nodes.

The phantom-node sidecar verified the operator question encoded in the synthetic-node rationale ("how do I discover available permissions for policy authoring?") DOES have a legitimate answer — it lives on `PolicyController.getPolicySchema` (`/api/policies/schema`), NOT on `PermissionController`. The synthesis hypothesis was correct that the OPERATOR-QUESTION exists; it was wrong about WHICH CONTROLLER answers it.

The negative confirmation also surfaced (the phantom-node sidecar's `security.known_security_gaps.[0]` NEGATIVE FINDING): the `Permission` enum is PUBLIC by OpenAPI design (`components.yaml:158-235`); the catalogue is not "leaked" because it was never secret. The phantom-node hypothesis's information-disclosure concern is unfounded.

**Primary source citations**:
- `PermissionController.java:1-27` (the entire file)
- `state/sprint-themes.yaml:210-212` (synthetic-node rationale)
- Grep `getPolicyPermissions` over `<odd-platform-repo>` returns ZERO matches (verified session 2026-05-20)

**Existing-ADR-or-implied-prescription**: NONE existing; this is a substrate-process gap. The substrate's enrichment-pipeline should be amended to assert method existence before invoking the file-analyser.

**Proposed remedy**:
1. Amend the substrate's enumeration walker to MATCH synthetic-node ids against the file's actual method list before emitting them as enrichment candidates.
2. ALTERNATIVELY, annotate synthetic-node entries with a `provenance: synthesis-from-rationale` field so file-analyser invocations know to either return early with an explicit phantom-node sidecar (this batch's resolution) or escalate to a substrate-team review.
3. Pre-emit verification step: `grep <method_name> <file_path>` — if no match, the orchestrator emits a phantom-node placeholder + flags for substrate review; the file-analyser doesn't run.
4. Cross-reference: a successful pre-emit existence check would have caught this AND would have flagged the synthetic-node rationale ("Permission catalogue read. RBAC observability.") for resolution at the substrate-process layer (the legitimate catalogue surface is `PolicyController.getPolicySchema`) — saving one file-analyser invocation and producing a more-actionable substrate-team finding instead of a sidecar.

**Severity rationale**: MEDIUM — substrate-process gap; not platform quality; recurring at scale would inflate the enrichment backlog meaningfully. The fix is a small orchestrator amendment.

**Suggested backlog grouping**: `Substrate-process hardening sprint` (separate from platform-quality work).

---
