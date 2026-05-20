## REFACTOR-183 — STRENGTHENED BATCH Y — Advisory-lock-ID registry absence reaches 4-sidecar triangulation; NotificationSubscriber's hardcoded lock-id default 100 confirms operator-tuneable lock-id namespace pattern (90/100/110/120) is platform-wide without disjoint-allocation assertion

**Severity unchanged**: MEDIUM
**Updated support count**: now **4-sidecar triangulated** (was 3 after batch D; batch Y adds NotificationSubscriber)
**Batch**: Y (2026-05-20)

**New surfaced_by**:
- `NotificationSubscriber.md:dependencies_semantic.requires-config` + `performance.scaling_characteristics.[1]` — "advisory-lock-id collision risk — `notifications.wal.advisory-lock-id` (default 100) shares the same Postgres advisory-lock id namespace with `partition.advisory-lock-id` (default 90) and `datacollaboration.receive-event-advisory-lock-id` (default 110) and `datacollaboration.sender-message-advisory-lock-id` (default 120) — operators who set lock ids manually risk silent collision; the seam runs only behind whichever lock holder wins, and a collision means the dispatcher never runs at all" — evidence: application.yml:172-179 (notifications block) + lines 197-202 (partition + datacollaboration locks)

**Cross-batch insight**: Batch D + D's discovery surfaced 3 advisory-lock IDs (partition 90, datacollab-receive 110, datacollab-send 120) sharing the namespace. Batch Y adds the 4th (notifications 100) with explicit cross-batch confirmation that:
- All four IDs are operator-tuneable via `@ConfigurationProperties`
- All four use the same Postgres advisory-lock id namespace
- NO startup validator asserts disjointness
- A collision (e.g. operator sets `notifications.wal.advisory-lock-id=110` and `datacollaboration.receive-event-advisory-lock-id=110`) silently disables one of the subsystems — whichever loses the lock contention never runs

**Pattern-strengthening rationale**: The 4-sidecar triangulation across 3 distinct feature subsystems (partition lifecycle + DataCollaboration + Notifications) confirms the platform-wide pattern. The operator-tuneable namespace is intentional (per ADR-CANDIDATE-043 + ADR-CANDIDATE-179 NEW batch Y); the lack of a registry / disjoint-allocation assertion is the refactor scope.

**Severity unchanged at MEDIUM** — collision is operator-config-modification + still bounded; but the 4-sidecar triangulation is now the strongest possible argument for a boot-time registry + validator.

**Refined remedy** (extended from original):
- Original Path A: Add `AdvisoryLockIdRegistry` Spring bean that collects all `*.advisory-lock-id` POJO fields at boot and asserts disjointness.
- NEW Path C: Add `application.yml` documentation explicitly listing the 4 IDs as RESERVED + their default values + a note that operators must keep them disjoint.

---
