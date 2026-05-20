- **DOC-GAP-053**: **META-FINDING** — "docs frame default behaviour but omit blast radius" pattern (3-sidecar triangulated; cross-cutting class)
  - **Category**: drift
  - **Surfaced by**:
    - DOC-GAP-036 + DOC-GAP-045 (DISABLED-default of `auth.type` — docs frame, blast radius omitted)
    - DOC-GAP-038 (`auth.ingestion.filter.enabled=false` default — partial doc coverage on parent page, blast radius and sibling-endpoint coverage omitted)
    - DOC-GAP-041 (activity-feed partition retention claim — page frames cadence, claims retention, code has no DROP)
    - Pattern referenced in concepts.yaml's batch-C cross-cutting findings comment block
  - **Evidence**: aggregated from above findings — common shape is **(a) page exists at the canonical home, (b) page documents the setting and its happy path, (c) page does NOT enumerate the operational consequence cluster** that materialises when an operator inherits the default. The cluster size varies (DISABLED: 6 consequences; ingestion-filter: 2 sibling-endpoint coverage gaps; activity-feed: 1 DROP-path absence) but the failure mode is the same.
  - **Proposed doc action**: This finding is a **meta-recommendation, not a single-page doc action**. The maintainer-facing action is: when authoring any "default behaviour" claim on a doc page, run a Pre-authoring stance check item: "Does the default's blast radius live next to the claim, or several sections away?" Concretely, the maintainer could systematise this by adding to `pillars/documentation/gates.md` an explicit Gate 3 extension: "Caveats captured as admonition blocks must appear ADJACENT to the default behaviour claim, not three sections away. A page that says 'the default is X' without the consequence cluster of X is failing Gate 3 even if the consequence cluster appears on a sibling page." Add to `playbooks/pre-authoring-stance.md` an explicit blast-radius prompt.
  - **Cross-references**:
    - LSN-001 (attachment-ephemeral default) + LSN-002 (MinIO region unset) — both are this pattern's canonical case-law; the case-law cluster grows as the substrate surfaces more instances
    - All three batches (2026-05-08 + 2026-05-10A + 2026-05-12C) have surfaced instances of this pattern; recommend the maintainer treat it as a documentation-pillar standing concern, not a per-page fix
  - **Severity rationale**: HIGH (meta) — the pattern is responsible for at least 9 of the current HIGH-severity findings. Surfacing it as a standing pillar concern accelerates future scans by giving the reviewer a named pattern to spot.

## Batch X append

#### Batch 2026-05-20-X STRENGTHENS — THREE NEW canonical instances of the META class "docs frame defaults without blast radius"

DOC-GAP-053 META captures the recurring pattern: ship a default + document the default value + NOT document the consequences of leaving the default in production deployments. Batch X surfaces THREE NEW canonical instances:

**Instance 1 — `spring.session.timeout: -1` (DOC-GAP-221 NEW batch X)**:
- The default value IS documented (`/configuration-and-deployment/odd-platform#select-session-provider` page says verbatim "spring.session.timeout: -1 means sessions never expire")
- The blast radius is NOT documented: (a) housekeeping job NO-OP under `-1` for INTERNAL_POSTGRESQL; (b) monotonic table growth; (c) stolen-cookie-validity-forever security implication; (d) operator-side monitoring queries that would detect the growth
- The fix shape: extend the existing default-mention into a multi-bullet caveat block

**Instance 2 — `session.provider: IN_MEMORY` (DOC-GAP-221 cross-link + REFACTOR-419 family)**:
- The default value IS documented (`application.yml:30 provider: IN_MEMORY` + live doc enumerates the three providers)
- The blast radius is PARTIALLY documented: live doc says "No multi-instance support" — but does NOT name the specific failure mode for the `/ingestion/datasources` collector-identity bridge (`IllegalStateException("Collector id is null")` per REFACTOR-419)
- The fix shape: cross-link the partial documentation to the operator-impact narrative

**Instance 3 — `management.endpoints.web.exposure.include: health, prometheus, env, info` (DOC-GAP-223 NEW batch X)**:
- The default value IS documented (the live doc enumerates the management endpoints knob)
- The blast radius is NOT documented: (a) the `env` endpoint exposes 8 credential surfaces (3 verbatim); (b) the substring-mask masking is fragile; (c) the JDBC URL is unmasked (infrastructure fingerprint); (d) the Slack/Webhook URLs are unmasked (bearer credentials)
- The fix shape: replace the bare default mention with the explicit credential-leak warning enumerating the 8 credential surfaces

**The META's cumulative instance count**:
- Pre-batch-X: DOC-GAP-053 had ~8 cataloged instances (DOC-GAP-001 through DOC-GAP-006 + DOC-GAP-045 + DOC-GAP-NN — see prior batch appends)
- Batch X adds 3 instances: DOC-GAP-221, the IN_MEMORY-cross-link, DOC-GAP-223
- Cumulative: ~11 cataloged instances

The META's STRUCTURAL pattern is: every `application.yml` shipped default with operational-or-security implications needs (a) the value documented (already done), (b) the blast radius documented (the gap), (c) the override recommendation documented (the operator-side fix). The fix-shape is uniformly bounded — one sub-section per default with the blast-radius narrative + operator-side override.

**The cross-cutting fix proposal (DOC-GAP-223 part-3 action)**:
A NEW page `documentation/docs/configuration-and-deployment/operational-hardening.md` is the CANONICAL HOME for the DOC-GAP-053 META class of findings. Per-feature pages cross-link to it. The page enumerates ALL "ship-with-default-on-but-recommend-off-for-production" surfaces:

| Default | Source | Blast radius | Recommended override |
|---|---|---|---|
| `auth.type=DISABLED` | DOC-GAP-036 | RBAC INERT, anonymous mutations | `auth.type=OAUTH2 | LDAP` |
| `auth.ingestion.filter.enabled=false` | DOC-GAP-038 | `/ingestion/entities` anonymous | `auth.ingestion.filter.enabled=true` |
| `attachment.storage=LOCAL` | DOC-GAP-001 (LSN-001) | Data loss on restart | `attachment.storage=REMOTE` |
| `spring.session.timeout: -1` (NEW batch X) | DOC-GAP-221 | Monotonic growth + perpetual session theft | `spring.session.timeout: 24h` |
| `session.provider=IN_MEMORY` (NEW batch X) | DOC-GAP-221 cross-link | `/ingestion/datasources` cluster-fragility | `session.provider=INTERNAL_POSTGRESQL | REDIS` |
| `management.endpoints.web.exposure.include` (NEW batch X) | DOC-GAP-223 | 8-credential leak via `/actuator/env` | `include: health, prometheus, info` |
| `notifications.enabled=false` | per concept catalog | Alerts disabled (this is the safe-default) | opt-in for production |
| MinioConfig `.region(...)` unset | LSN-002 / DOC-GAP-231 | us-east-1 region pin | (no operator knob currently — code-side fix needed) |
| `spring.r2dbc.pool.*` framework defaults (NEW batch X) | DOC-GAP-228 | 10-connection ceiling per pool × 2 pools = 20 per replica | Pin in application.yml |
| Cookie attributes framework defaults (NEW batch X) | DOC-GAP-222 | No `Secure` flag, no `SameSite=Strict` | Reverse proxy `proxy_cookie_flags` |
| LOGIN_FORM credentials `admin:admin,root:root` shipped | DOC-GAP-218 + sidecar | Insecure default credentials | Operator-mandatory override |

ELEVEN canonical "default-but-anti-secure-or-anti-prod" surfaces. The new operational-hardening page closes the META structurally with one page authoring effort.

**Severity stays HIGH (meta)** — batch X strengthens the META with 3 new instances + crystallises the cross-cutting fix proposal into a NEW PAGE that closes the structural gap. The doc-side action transforms from "per-finding admonition" to "single operational-hardening page + per-finding cross-links".

**Coherence**: strengthens=1 (DOC-GAP-053 META), supersedes=0, conflicts_surfaced=0. The structural insight (11 canonical instances of one pattern → 1 canonical hardening page) is the largest doc-product win in the batch-X coherence sweep.
