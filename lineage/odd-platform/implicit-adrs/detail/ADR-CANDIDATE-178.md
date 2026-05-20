## ADR-CANDIDATE-178 — Notifications WAL pipeline binds to `pgoutput` + ALERT table only — output plugin hardcoded, published table set encoded in code (jOOQ Tables.ALERT), no operator-tunable scope

**Severity**: HIGH
**Classification**: promote (NEW ADR; POSITIVE-INTENT — deliberate operator-burden minimization + WAL scope narrowing)
**Pillars affected**: [P-07-active-platform-features (Notifications sub-feature), P-09-security-access-control (WAL exposure surface)]
**Support count**: 1 sidecar primary source (batch Y NotificationSubscriber) + live-doc anchor at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified 2026-05-20 status 200) naming `pgoutput`-equivalent PG requirements verbatim
**Axes present**: notification, schema_migrations (cross-referenced via WAL artefacts)
**Batch**: Y (2026-05-20)

**Surfaced by**:
- `NotificationSubscriber.md:implicit_adrs.[0]` (HIGH) — "**Output plugin is hardcoded to `pgoutput`** (not operator-tunable). `pgoutput` is the PG-native logical-decoding plugin shipped since PG 10, removing the operator burden of installing `wal2json` or `decoderbufs` as third-party extensions. The decision binds the platform to PG >=10 (consistent with `PGConnectionFactory.ASSUME_MIN_SERVER_VERSION=11.0`) and to the pgoutput binary-format that `PostgresWALMessageDecoder` knows how to parse." — intent_anchor: `private static final String PG_REPLICATION_OUTPUT_PLUGIN = "pgoutput";` + `.withOutputPlugin(PG_REPLICATION_OUTPUT_PLUGIN)` (NotificationSubscriber.java:30, 119)
- `NotificationSubscriber.md:implicit_adrs.[5]` (HIGH) — "**Only the `ALERT` table is published** — the `registerPublication(connection, Tables.ALERT)` call at line 51 hardcodes the published-table set to a single jOOQ table reference. Adding another table to the publication requires a code change (not a config change), keeping the WAL-driven dispatcher tightly scoped to alerts and preventing accidental broadcast of unrelated table changes." — intent_anchor: `registerPublication(connection, Tables.ALERT);` (NotificationSubscriber.java:51)

**Decision statement**: ODD Platform's Notifications WAL pipeline is bound at code-level — not config-level — to two structural choices that are LOAD-BEARING for the feature's deployment posture:

1. **Output plugin = `pgoutput`** (built-in since PG 10, no operator-installed extension required). The constant `PG_REPLICATION_OUTPUT_PLUGIN = "pgoutput"` at `NotificationSubscriber.java:30` + the `.withOutputPlugin(PG_REPLICATION_OUTPUT_PLUGIN)` invocation at line 119 wire the choice in code. There is NO `notifications.wal.output-plugin` configuration key. The choice composes with `PGConnectionFactory.ASSUME_MIN_SERVER_VERSION=11.0` (the JDBC-side guard) and with `PostgresWALMessageDecoder`'s binary-format parser — three structural commitments together encode "this subsystem only runs on PG >=10 with the built-in plugin."

2. **Published table set = {ALERT}** (hardcoded jOOQ Tables.ALERT reference). The `registerPublication(connection, Tables.ALERT)` call at `NotificationSubscriber.java:51` binds the published table set to a single compile-time-checked jOOQ table reference. There is NO `notifications.wal.published-tables` configuration knob and NO `Set<Table<?>> publishedTables` field on `NotificationsProperties`. Adding another WAL-driven sub-feature (e.g. notification on owner-association lifecycle, on Lookup-Table mutations, on data-source registration) requires a code change — a new `registerPublication` call + a new `PostgresWALMessageProcessor` implementor + a new advisory-lock-id + a new replication slot — NOT a configuration toggle.

The architectural commitments:
- **(a) Operator burden minimisation — pgoutput is the PG-native plugin.** No third-party extension installation required (vs `wal2json` or `decoderbufs` which need `CREATE EXTENSION` access and version compatibility with PG major versions). The platform commits operators to PG >=10 in exchange for zero-install replication.
- **(b) WAL scope is narrow by design.** Only the ALERT table's WAL is published — every other mutation in the database (data_entity inserts, ownership changes, owner-directory CRUD, RBAC mutations) does NOT flow through the notification subscriber. This is the structural reason the Notifications subsystem is "the alert subsystem" — the WAL-decoder + dispatcher + sender beans all assume ALERT-table-shaped events.
- **(c) Cross-feature WAL bus is NOT in scope.** A future WAL-driven sub-feature must implement its own subscriber, publication, slot, advisory-lock-id — there is no shared-WAL-bus pattern. The single-implementor `PostgresWALMessageProcessor` SPI (per ADR-CANDIDATE-182) is the structural reason this would not be a small refactor.
- **(d) Binary-format coupling is implicit.** The `PostgresWALMessageDecoder` parses pgoutput's binary message format directly; replacing `pgoutput` with `wal2json` (which emits JSON) would require rewriting the decoder. The output-plugin choice and the decoder are co-evolved.
- **(e) Operator-config drift is bounded.** A pathological `notifications.wal.publication-name` cannot reach unintended tables because the publication is CREATEd by the platform with the hardcoded `Tables.ALERT` target — even if the operator changes the publication NAME, the published-table set remains alert-only.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three independent commitments to the design:
   - `PG_REPLICATION_OUTPUT_PLUGIN = "pgoutput"` is a constant (not a config-read), at file-scope with `private static final` visibility — the design choice is encoded in the type system, not in YAML.
   - `registerPublication(connection, Tables.ALERT)` is a single call site with a jOOQ compile-time-checked table reference — adding another table requires editing this line; there is no "register all tables" / "register from config" pattern.
   - `ASSUME_MIN_SERVER_VERSION=11.0` at `PGConnectionFactory.java:30-32` is a sibling commitment — the platform refuses to talk to PG 9.x at the JDBC layer; this is the platform-wide companion to the pgoutput-PG10+ binding.
2. **Structural impact?** YES — every future change to the notification subsystem's WAL surface must respect these two commitments. Adding owner-lifecycle notifications requires either (a) adding a second `registerPublication(connection, Tables.OWNER)` call site PLUS extending the decoder PLUS adding a second implementor of `PostgresWALMessageProcessor` (single-implementor invariant of ADR-CANDIDATE-182 would break) OR (b) widening the subscriber to dispatch per-relation-id (a structural redesign of the SPI seam).
3. **Refactoring or structural?** STRUCTURAL — switching to a different output plugin requires rewriting `PostgresWALMessageDecoder` (binary-format coupling); widening the published-table set requires per-table relation-id routing at the decoder + per-table processor instances at the SPI seam. Neither is a single-file change.

**Existing ADR**: none in `adrs/`. Cross-references ADR-CANDIDATE-028 (lazy-create-no-drop pattern — same NotificationSubscriber surface; the publication created here is the artefact ADR-028 says is created-but-not-dropped); ADR-CANDIDATE-043 (single-leader WAL — sibling decision about WHICH instance does the reading; this ADR governs WHAT is published).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-509 NEW batch Y (WAL retention disk-exhaustion via replication-slot orphan/rename — the consequence of the publication being a code commitment + the slot being lazy-create-no-drop)
- REFACTOR-510 NEW batch Y (publication-name DDL identifier injection — the operator-config knob that survives this ADR's scope)
- REFACTOR-508 NEW batch Y (poison-message WAL replay loop — the cross-cutting consequence of ALERT-only + at-least-once + LSN-advance-after-process)

**Proposed action**: Promote to `adrs/drafts/notifications-wal-pgoutput-alert-only.md` (new ADR). Document the two structural commitments together (output plugin + published-table set are co-evolved); link the live doc which already says "ODD Platform uses the PostgreSQL replication mechanism" — the live doc should be expanded to make the PG >=10 binding explicit AND to surface the ALERT-only scope so operators understand the subsystem's narrow purpose.

**Severity rationale**: HIGH — defines the PG-version compatibility floor for the platform (operators on PG 9.x cannot use Notifications); defines the scope of every future WAL-driven sub-feature (must be new subscriber + new slot + new processor; not "just add to the publication"); structural for deployment topology.

---
