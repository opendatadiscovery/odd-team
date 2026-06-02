## 2026-06-02 — IT-008 REMOTE attachment round-trip (Tier-2b) + the LSN-002 finding
- runner: AI-assisted (Claude Opus 4.8) — `ODD_STACK_EXTERNAL=1 npm test -- attachment-remote-roundtrip`, Node v24.13.0; self-managed `odd-minio` stack (postgres + MinIO@eu-west-1 + bucket-init + platform REMOTE), brought up/torn down by the spec.
- protocol: IT-008 (test_class integration — REST upload/download against an S3/MinIO backend; no browser). validates F-027 (REMOTE).
- outcome: **GREEN (1 passed, 43s incl. stack up ~27s + down).** Upload (initiate→chunk→complete) → download returned the exact bytes → REMOTE attachment storage round-trips against an S3-compatible store. Goes in `feature-complete` + `I2-attachment-storage`. A future RED here = a real REMOTE-storage regression.

### LSN-002 investigation result (why IT-008 is GREEN, not a RED region pin)
The original Tier-2b intent was a RED "MinIO non-us-east-1" pin for LSN-002 (MinioConfig builds MinioAsyncClient without `.region(...)`). **Empirically disproven this session:** with MinIO `MINIO_SITE_REGION=eu-west-1` and the platform REMOTE-pointed at it, the upload+download SUCCEEDED — minio-java 8.6.0 auto-discovers the bucket region via `GetBucketLocation` and adapts, so the missing `.region()` is papered over against a cooperative store. The real LSN-002 bites **real AWS S3 under least-privilege IAM** (no `s3:GetBucketLocation` → SDK falls back to us-east-1 → cross-region requests rejected) — not reproducible with a local MinIO.

**Decision (maintainer-chosen):** pin LSN-002 STRUCTURALLY, not via integration.
- LSN-002 pin = `odd-platform` unit test `MinioConfigRegionTest` (`@regresses PLT-086`, branch `test/adr-enforcement-units`, commit `9ce4f18f`) — source-scan asserting MinioConfig sets `.region(...)` from `attachment.remote.region`. RED until fixed. **Awaiting the maintainer's gradle run** (CI gate; the agent cannot run gradlew).
- The MinIO stack built for the investigation was salvaged as IT-008 (the REMOTE happy-path above) — net-new F-027 REMOTE coverage.

### spec defects this session surfaced + fixed
- The attachment initiate field is `fileName` (camelCase) — one of the ~8 camelCase contract outliers (ADR-0072); a live re-confirmation (also hit in IT-007).
- IT-007/IT-008 share the 3-step upload via `helpers/attachments.uploadAttachment` (extracted to avoid duplication).

## 2026-06-02 — IT-009 auth-mode boundary (Tier-3 foundation)
- runner: AI-assisted (Claude Opus 4.8) — `npm test -- auth-mode-boundary`, Node v24.13.0; shared odd-minimal (DISABLED :18080, from global-setup) + self-managed `odd-loginform` stack (LOGIN_FORM :18082, project oddlf).
- protocol: IT-009 (test_class integration — REST; no browser). enforces ADR-0074 · TEST-GAP-778.
- outcome: **GREEN (1 passed, 51s).** `/api/dataentities/classes` → 200 under DISABLED (permitAll), 401/302 under LOGIN_FORM (authenticated required). The auth-mode switch enforces authentication. `feature-complete` + `I1-auth-mode-authz`.
- spec defect fixed mid-run: first probe `/api/owners` returned 500 under DISABLED (needs page/size query params — the UI always sends them; bare it 500s). Switched to `/api/dataentities/classes` (static reference, no params, 200 under DISABLED, not whitelisted).
- helper refactor verified: extracted the generic stack lifecycle to `helpers/stack.ts`; `minio-stack.ts` now delegates to it (IT-008 re-ran GREEN, confirming the refactor). `loginform-stack.ts` is the new thin wrapper.
- scope note: LOGIN_FORM proves only the AUTHENTICATION boundary (every credential = ADMIN, AuthorizationCustomizer inert). The RBAC/cross-owner authz bugs need DISTINCT-permission users → an LDAP tier (group→role mapping; the only locally-reproducible enforcing mode with per-user distinction). That is the next Tier-3 sub-batch — assessment pending.

## 2026-06-02 — IT-010 LDAP RBAC enforcement (Tier-3b)
- runner: AI-assisted (Claude Opus 4.8) — `ODD_STACK_EXTERNAL=1 npm test -- ldap-rbac`, Node v24.13.0; self-managed `odd-ldap` stack (osixia/openldap + init-seeded `cn=alice` + AUTH_TYPE=LDAP platform :18083).
- protocol: IT-010 (test_class integration — REST + LDAP form-login; no browser). enforces ADR-0002 + ADR-0003.
- outcome: **GREEN.** Login as alice (LDAP) → 302→/ + SESSION cookie; authenticated non-admin USER → `DELETE /api/owners/999999` → **403** (SECURITY_RULES enforced by the AuthorizationCustomizer; USER has no OWNER_DELETE; 404 would mean bypassed). `feature-complete` + `I1`.
- run-to-resolve findings (the run earned its keep):
  - **No ADMIN bypass** (grounded): authorization always resolves permissions from policies, so a fresh USER (no policies) is denied every gated mutation — the clean, reliable enforcement signal. Most "auth bugs" (LOGIN_FORM everyone-admin, read-collaborative reads) are documented ADR-0074/0003 postures, not clean RED bugs.
  - **bitnami/openldap:2.6 image is gone** → switched to osixia/openldap:1.5.0 + an init container that `printf|ldapadd`s alice (no LDAP_USERS env on osixia).
  - **dn-pattern is RELATIVE to the base**: `cn={0},ou=users` (NOT absolute) — Spring `BindAuthenticator` + `contextSource.setBase` append the base; an absolute pattern doubled it → silent `/login?error`. Confirmed by reading LDAPSecurityConfiguration + direct `ldapwhoami`.
  - **docker-compose --force-recreate needs --renew-anon-volumes** (compose v1 `KeyError: ContainerConfig` bug on newer images) — already the pattern IT-007's recreate helper uses.
- confirmed-but-not-pinned authz gaps (documented postures / need 2 users): attachment read-openness (F-027 H-004), genai no-authz (F-039 H-001, disabled by default), cross-entity mutation escalation (F-027 H-005 / PLT-086).

## 2026-06-02 — IT-011 notifications WAL lifecycle (Tier-3, I3) + a filed bug (PLT-139)
- runner: AI-assisted (Claude Opus 4.8) — `npm test -- notifications-wal-lifecycle`, Node v24.13.0; OFF = shared odd-minimal (:15432), ON = self-managed `odd-notifications` stack (postgres wal_level=logical + NOTIFICATIONS_ENABLED + webhook stub, :18084/:15436).
- protocol: IT-011 (test_class integration — DB-state assertions; no browser). enforces ADR-0040 + ADR-0044.
- outcome: **GREEN.** OFF (default) → 0 `odd_platform_replication_slot` slots (ADR-0040); ON → slot + publication `odd_platform_publication_alert` on the alert table created lazily (ADR-0044). `feature-complete` + `I3-notifications-wal`.
- run-to-resolve — the planned DELIVERY happy-path was reframed by a real finding:
  - The full chain DOES work: with notifications on, a raw `INSERT INTO alert` → logical replication → WAL subscriber (advisory-lock leader) → webhook stub received the AlertNotificationMessage in ~4s (snake_case payload — consistent with ADR-0072). Verified manually multiple times.
  - BUT it is **flaky on fresh boot**: ADR-0044's slot-BEFORE-publication create-order can wedge the subscriber PERMANENTLY with `ERROR: publication "odd_platform_publication_alert" does not exist` when a WAL change lands between slot- and publication-creation; no recovery (no DROP path — a restart did NOT fix it). Filed as **PLT-139** (high; sibling of PLT-016 WAL fragility). So a delivery gate would be flaky → IT-011 pins the deterministic slot/publication LIFECYCLE instead, and the wedge is the (more valuable) filed finding.
- infra: webhook stub = mendhak/http-https-echo:31 (returns 200, logs requests). postgres needs `wal_level=logical` for the slot; the initial POSTGRES_USER is superuser → has REPLICATION.

## 2026-06-02 — IT-012 notifications WAL leader failover (Tier-3, I3) + PLT-139 blast-radius
- runner: AI-assisted (Claude Opus 4.8) — `npm test -- notifications-wal-failover`, Node v24.13.0; self-managed 2-replica `odd-notifications-ha` stack (postgres wal_level=logical + platform-A :18085 + platform-B :18086, same DB).
- protocol: IT-012 (test_class integration — DB-state + docker; no browser). enforces ADR-0043.
- outcome: **GREEN (test 2.7s).** Leader election: advisory lock 100 → A granted (pid 575) + B waiting (pid 700). Kill A → B (700) acquired the lock in ~2s → failover. `feature-complete` + `I3`.
- run-to-resolve — confirmed PLT-139's blast radius is BIGGER than filed (PLT-139 updated):
  - On the 2-replica boot, BOTH replicas wedged (publication-does-not-exist) and `pg_locks advisory granted` stayed **0** — i.e. the wedge **flaps the advisory lock** (try-with-resources closes the connection on each stream error → releases the lock → re-acquire), so there is **no stable leader at all** → all alerting dead cluster-wide. So a wedged leader can't be failed over.
  - **Un-wedge recovery found:** stop the leader → `pg_drop_replication_slot` → start it → the publication now PRE-EXISTS → the slot is recreated after it → clean stable leader (slot active, 1 granted lock) in ~2s. (A plain restart without the drop does NOT recover — the slot stays at the bad LSN.) IT-012's `ha-stack.ensureCleanLeader` does this as a documented precondition; the run log above shows it firing ("leader appears wedged (PLT-139) — dropping slot + restarting").
  - The standby never wedges — it blocks on the advisory lock BEFORE the WAL stream.
