# Consolidated triage — LSN-030 feature-reflection net-new candidates (feature-reflector v0.3.0)

**Input:** `findings/feature-reflection-triage/2026-06-04-net-new-candidates.md` (347 net-new candidate findings across 110 features).
**Method:** clustered the 347 by ROOT CAUSE / drift-class, deduped each cluster against the live backlog (`backlog/docs` DOC-001..325, `backlog/spec` SPC-001/002, `backlog/adr` ADR-0001..0075, `backlog/tests` TST-001) and the upstream issue drafts (`issues/odd-platform` PLT-001..139), then ranked by severity × frequency. Anti-bloat: ONE cluster per root cause, all affected features cited inline; no per-finding items.

**Headline numbers:**
- **33 root-cause clusters** total = **15 GENUINELY-NEW** (N1-N16; N7 folds into N8) + **18 ALREADY-TRACKED** (A1-A18).
- **18 ALREADY-TRACKED** clusters: the per-reflection pass tagged these net_new on its own keywords, but the cross-feature root-cause + broader phrasings map to an existing PLT-/DOC-/SPC- item; corroboration only, nothing filed.
- **15 GENUINELY-NEW** clusters → filed as **16 backlog items** (N9 yields two — a doc caveat + a test pin): DOC-326..335 (10 docs), SPC-003 (1 spec), TST-002..004 (3 test/pin items), ADR-0076 (1 ADR draft), PLT-140 (1 upstream issue draft).
- Note on routing tokens: the candidate file's `-> DOC-NNN / PLT-NNN / BUG-NNN / TEST-GAP-NNN` are PLACEHOLDERS the reflector emitted, NOT existing ids. Dedup is against actual on-disk files only. Many candidates also self-tag "distinct from PLT-X" / "net_new vs DOC-Y" — that disambiguation was honoured.

---

## GENUINELY-NEW clusters (filed)

### N1 — Platform-wide unbounded page-size / negative-offset / page=0 → opaque 500 [HIGH, freq 6]
**Drift-class:** pagination-parameter validation absent at every tier (no `@Min`/`@Max`, no OpenAPI min/max, no repo clamp); `size` accepts `1000000`/`MAX_VALUE`/`null` → unbounded scan; `page=0` → negative OFFSET → opaque server error not a 400.
**Affected:** F-021/H-012 (activity `size` unbounded), F-021/H-013-adjacent, F-028/H-010 (namespaces `size=100000`), F-037/H-010 (relationships `page=0` negative OFFSET + `page=null` NPE), F-174/H-006 (owner_association_request/activity no page-size cap), F-014/H-003 (per-entity alerts — already PLT-134), F-031 (datasource search). Per-endpoint instances already filed: PLT-134 (alerts), PLT-037-adjacent, PLT-050 (alerts size-30). **No platform-wide pagination-validation item exists.**
**Routed:** **DOC-326** — platform-wide caveat documenting the no-page-size-cap / page=0→500 posture as a known operational limitation across list endpoints, cross-linking the per-endpoint PLT issues (PLT-134) and naming the relationships/activity/namespaces/owner-association loci. (Code fix is a platform-wide `@Min(1)`/`@Max` + repo clamp epic — captured as a future PLT in the DOC body's follow-up note; not filed as a separate PLT here to avoid a thin duplicate of PLT-134's scope.)

### N2 — Spec ↔ running-platform conformance: shared ErrorResponse + 4xx/5xx coverage absent [MEDIUM, freq 2]
**Drift-class:** only 3 of 194 operations declare any 4xx/5xx; no shared `ErrorResponse` component schema; SDK consumers have no typed error model and cannot distinguish retryable from non-retryable.
**Affected:** F-029/H-002 (no ErrorResponse schema), F-096/H-008 + F-095/H-010/H-011 (ingestion error-contract surfaces that have no typed error to map to).
**Dedup:** SPC-001 covers `securitySchemes` + 201-vs-200 reconciliation + title rename — it does NOT add a shared ErrorResponse schema or operation-level 4xx coverage. GENUINELY-NEW, natural sibling on the same `openapi.yaml` hygiene branch.
**Routed:** **SPC-003** — add operation-level 400/401/403/404/500 + a shared `ErrorResponse` component schema.

### N3 — Zero spec-vs-platform contract test (the structural root that lets every status/semantic/missing-field drift accumulate) [HIGH, freq 1 but root-of-class]
**Drift-class:** no test walks the live platform against the spec; every 201-vs-200 / inverse-semantic / missing-field / operationId drift ships undefended.
**Affected:** F-029/H-012 (the meta-finding); enables the whole SPC-001/002/003 + operationId-rename family.
**Dedup:** no TST/SPC item is a running-platform contract test (SPC-* are spec-side hygiene; TST-001 is unrelated).
**Routed:** **TST-002** — spec-driven contract test: local docker-compose (platform + Postgres) + `WebTestClient` walk of every spec'd operation asserting declared status/shape. Pin-style: characterizes current drift (GREEN on known mismatches, RED when spec or platform changes), per LSN-029.

### N4 — Term reverse-lookup backend: overloaded path stem 500/405 + hardcoded hasNext=false silent truncation [HIGH, freq 2]
**Drift-class:** `GET /api/terms/{term_id}/term` (Linked-Terms reverse read) returns 500/405 — the path stem is overloaded with link/unlink write verbs; `TermServiceImpl.listByTerm` hardcodes `hasNext=false`/`total=items.size()` so terms #51+ are silently unreachable (LSN-024 silent-truncation class).
**Affected:** F-152/H-002, F-152/H-006.
**Dedup:** PLT-058 is the Term-Detail **UI** epic (its Defects 4/5 are LinkedColumnsList/LinkedTermsList UI pagination + synthesised-500). These two are **backend** defects (route overload + repository pagination), explicitly self-tagged "new … cross-linked to PLT-058". GENUINELY-NEW.
**Routed:** **PLT-140** (upstream odd-platform issue) — backend term reverse-lookup: fix the overloaded `/term` stem + real pagination in `listByTerm`. Cross-link PLT-058.

### N5 — Approving one owner-association request silently auto-declines all other PENDING for that Owner [HIGH, freq 1]
**Drift-class:** silent side-effect mutation + fabricated audit — `REQUEST_MANUALLY_DECLINED` is written for siblings the operator never acted on; invisible in dialog/UI/doc.
**Affected:** F-171/H-006.
**Dedup:** PLT-038/040/041/132 + DOC-216/220/223 are all different owner-association facets; none cover the auto-decline-siblings behaviour.
**Routed:** **DOC-327** — document the auto-decline-siblings semantics on `user-owner-association.md` as a known behaviour (operator-visible audit consequence). A code-side "make this explicit / confirm" is noted as a future PLT in the body; the immediate operator protection is the doc caveat (the behaviour may be intended single-binding enforcement).

### N6 — Attachment filename injection (path traversal + CRLF) + chunk last-writer-wins corruption [HIGH, freq 1 security]
**Drift-class:** filename propagated raw into the LOCAL storage path (path traversal) and into `Content-Disposition` (CRLF injection); no `..`/NUL/scheme/length checks. Same-index chunk retry is last-writer-wins with no write isolation; non-integer chunk filename aborts upload via `NumberFormatException`.
**Affected:** F-027/H-007, F-027/H-003.
**Dedup:** PLT-086 is attachment **cross-entity mutation escalation + MinioConfig unset region** — it does NOT cover filename sanitisation or chunk-write corruption. The 2026-06-01 reflection emitted probe P-196 but never filed a PLT. GENUINELY-NEW security.
**Routed:** **TST-003** — characterization pins (LSN-029) for the current unsanitised-filename + chunk-overwrite behaviour (GREEN now, RED on fix), plus the corresponding upstream fix is noted in the body for a future PLT. (Pinned rather than only doc'd because it is a live security defect we are not fixing in code right now.)

### N7 — Attachment read endpoints + 3 mutation-audit-silence surfaces in the audit-silence family [MEDIUM, see N8]
Folded into N8 (audit-silence) for the audit dimension; the read-no-SecurityRule half (F-027/H-004) is already named in PLT-086 Defect 1. No separate item.

### N8 — Audit-silence: mutations that emit no Activity/audit event (platform-wide @ActivityLog gap) [HIGH, freq 9]
**Drift-class:** write paths with no `@ActivityLog` / no audit row — forensic reconstruction impossible. A genuinely cross-cutting pattern.
**Affected:** F-027/H-013 (attachment uploads/deletes/link-edits), F-028/H-011 (namespace create/update/delete, no `NAMESPACE_*` enum), F-007/H-009 (webhook ingress unaudited), F-125/H-006 (token rotation/delete no event), F-152/H-011 (term-to-term link/unlink), F-173/H-006 (owner-association binding REMOVAL — has CREATED/APPROVED/DECLINED but no removal type), F-036/H-011 (DEG-propagated child ownership change parent-only), F-192/H-011 (one description edit emits TWO events — over-count), F-022-adjacent.
**Dedup:** DOC-246 ("audit-trail-scope" new page: schema-rooted RBAC + Owner/Term/Namespace audit silence, positive vs negative half) + PLT-062 (3-tier coordinated audit migration) + DOC-181/251/188 cover the Owner/Term/Namespace/DEG/Activity-Feed audit-silence axis. **NOT covered:** attachment mutations (F-027/H-013), token rotation (F-125/H-006), owner-association binding removal (F-173/H-006), term-to-term (F-152/H-011), and the double-event over-count (F-192/H-011).
**Routed:** **DOC-328** — extend the audit-trail-scope coverage (DOC-246 family) with the FOUR uncovered audit-silent surfaces (attachment, token rotation, association-unbind, term-to-term) + the description-edit double-event note; cite the @ActivityLog-data-entity-scoped structural cause (F-021a). Code-side audit emission is the PLT-062 epic's remit (cross-linked).

### N9 — Concurrent edit / last-writer-wins with no optimistic lock (service-tier non-transactional R-then-W) [MEDIUM, freq 5]
**Drift-class:** non-transactional read-then-write or full-replace PUT with no optimistic-lock detection → silent lost update; sibling services that ARE `@ReactiveTransactional` make the asymmetry the oversight.
**Affected:** F-006/H-007 (`PolicyServiceImpl.update` non-transactional vs `RoleServiceImpl` transactional), F-006/H-011 (cascade-delete + soft-delete two non-tx R2DBC calls), F-004/H-008 (description edits last-writer-wins, same oldState baseline), F-031/H-013 (datasource PUT last-write-wins + REPLACE), F-020/H-009 (collector full-replace PUT nulls fields).
**Dedup:** PLT-053 (Notification Settings optimistic-concurrency), PLT-037 (Namespace delete TOCTOU), PLT-066/247 (owner empty-roles PUT), PLT-087 (regenerateDataSourceToken non-tx) cover specific instances. **NOT filed:** the `PolicyServiceImpl.update` non-transactional asymmetry (F-006/H-007) and the policy cascade race (F-006/H-011). GENUINELY-NEW (RBAC service-tier transactional asymmetry).
**Routed:** **DOC-329** (caveat: RBAC concurrent-edit / non-transactional update is last-writer-wins; PUT is full-replace) **+ TST-004** (characterization pin for the `PolicyServiceImpl` transactional-asymmetry). The full-replace-PUT data-loss surfaces (datasource F-031/H-013, collector F-020/H-009, description F-004/H-008) are documented in the same DOC-329 as the platform-wide "PUT is full-replace; concurrent edits are last-writer-wins" caveat. Avoided a thin PLT duplicate of PLT-053's pattern; the per-service code fix belongs to the existing hardening epics, and the un-filed `PolicyServiceImpl` fix is logged as a follow-up from DOC-329/TST-004.

### N10 — UI cache not invalidated after mutation → success toast over a stale screen [MEDIUM, freq 5]
**Drift-class:** React-Query / Redux cache not invalidated on write, or `useEffect([])` fetch-once badges that never refresh → the UI shows stale data after a successful mutation; success toast contradicts the screen.
**Affected:** F-131/H-006 (`useCreateQueryExample` invalidates nothing), F-131/H-007 (`useUpdateQueryExample` invalidates only details key), F-007/H-008 (alert tab badges `useEffect([])` never refresh after Resolve), F-023/H-007 (Directory level-1 grid stale-singleton after Management datasource registration), F-119/H-011 (auth-mode-derived UI lags live auth.type change).
**Dedup:** PLT-059 covers one instance (queryClient invalidate by undefined termId in CREATE mode). The query-example create/update cache-invalidation is self-tagged "PLT-NNN pending mint". GENUINELY-NEW.
**Routed:** **DOC-330** — caveat on the affected feature pages (query-examples, alerting, directory) noting "newly-created/edited items may not appear until refresh"; the cache-invalidation code fix is logged as a follow-up upstream PLT. (Per the no-code-change-now posture: document the behaviour now; the consolidated cache-invalidation PLT is the follow-up.)

### N11 — SMTP/webhook protocol & status-code rigidity drops alerts silently [HIGH, freq 3]
**Drift-class:** case-sensitive lowercase protocol/status comparisons silently disable security or drop messages — `smtp` lowercase-only disables STARTTLS+AUTH (creds may go plaintext); generic-webhook delivery accepts ONLY HTTP 200 (201/202/204 async-accept treated as failure → alert dropped).
**Affected:** F-009/H-009 (SMTP case-sensitive — already PLT-107), F-009/H-005 (webhook only-200).
**Dedup:** PLT-107 covers the SMTP `.equals("smtp")` case exactly. The webhook only-accepts-200 (F-009/H-005) is self-tagged "not in PLT-016; webhook-channel-specific" and has no home. GENUINELY-NEW (the webhook half).
**Routed:** **DOC-331** — caveat in the notifications config section: generic-webhook receivers MUST return HTTP 200 (201/202/204 are treated as delivery failure → alert dropped) + the SMTP-must-be-lowercase note cross-linking PLT-107/DOC-180. Code fix (accept 2xx) noted for a future PLT.

### N12 — jotai-vs-Redux state-management paradigm split is an undocumented implicit-ADR [LOW/contributor, freq 3]
**Drift-class:** consistently-applied implicit architecture decision (per-feature jotai stores scoped to mount lifetime, vs session-persistent Redux for the majority) with no ADR/CONTRIBUTING/ARCHITECTURE doc — contributor-facing drift that produces future operator-facing inconsistency (filters reset on navigate in 4 jotai areas).
**Affected:** F-104/H-007 (the meta-finding), F-104/H-001/H-005 (the 4 jotai areas), F-152/H-008 (three sibling term tabs use two patterns).
**Dedup:** no ADR backlog item covers state-management choice (ADR max 0075).
**Routed:** **ADR-0076** (draft) — "Per-feature jotai stores deliberately scoped to mount lifetime vs session-persistent Redux" via the implicit-adrs → backlog ADR → published ADR-log flow. The operator-facing consequence (filters don't persist on navigate) is documented separately as a caveat — see DOC-332.

### N13 — Filter/selection state silently non-persistent on navigate in jotai areas (operator-facing half of N12) [LOW, freq 3]
**Affected:** F-104/H-001 (DQ dashboard + 3 sibling jotai areas), F-104/H-005 (no affordance warns selection won't persist), F-040/H-010-adjacent.
**Dedup:** scattered caveat hints route to data-quality/dashboard, data-lineage, dataset-structure pages; no DOC tracks the cross-cutting persistence-model caveat.
**Routed:** **DOC-332** — admonition on the affected feature pages (data-quality/dashboard + data-lineage + dataset-structure): filter/cursor selection resets on navigate-away (URL is the only cushion, DQ-only); bookmark the URL to keep filters.

### N14 — Owner.NAME-safe vs OIDC-username-dangerous rename surface not cross-linked + collision returns 400 not 409 [LOW, freq 2]
**Affected:** F-019/H-010 (OWNER.NAME safe for USER_OWNER_MAPPING; OIDC-username rename is the hazard, REFACTOR-391/PLT-111), F-019/H-011 (name collision returns USR003/400 not 409 Conflict — clients can't distinguish duplicate from bad-input).
**Dedup:** DOC-245 covers OIDC-username cross-mode bleed; PLT-111 covers GitHub login-rename orphan. Neither cross-links the safe-vs-dangerous rename surface on the owners/user-owner-association doc pages, nor documents the 400-vs-409 collision contract.
**Routed:** **DOC-333** — owners + user-owner-association pages: cross-link the rename-hazard surface (OWNER.NAME safe, OIDC username hazardous → PLT-111) + document the USR003/HTTP-400-on-collision contract (vs 409).

### N15 — Frozen/silent error pages: missing `.rejected` reducer / `.catch` / error-state branch [MEDIUM, freq 6]
**Drift-class:** route or panel has no rejected-fetch render branch → a 404/auth-expiry/transient-5xx shows a frozen empty page no refresh recovers, OR an unconditional upsert over an empty form silently re-arms suppressed config.
**Affected:** F-024/H-008 (term-search no `.rejected` reducer — frozen empty page; already PLT-138-adjacent), F-024/H-012 (Dictionary create/restore failure frozen — PLT-138), F-198/H-004 (Notification Settings no FAILED-fetch branch → blank form upsert re-arms all alert types), F-035/H-012 (AppInfoMenu no loading/error), F-042 (error page no retry), F-031/H-008 (backend-rejected register discards typed input).
**Dedup:** PLT-138 covers the Dictionary-tab frozen-empty-page exactly. F-024/H-008 (term-search `.rejected`) is the same root and folds into PLT-138. F-198/H-004 is self-tagged "fold into PLT-053 as Defect 4" — ALREADY-TRACKED (PLT-053). The remainder (AppInfoMenu, error-page-no-retry, register-discards-input) are minor UI papercuts.
**Routed:** **DOC-334** — error-pages/troubleshooting caveat documenting the silent-frozen-page class + the no-retry error page; cross-link PLT-138/PLT-053. (The new instances are low-value individually; the doc caveat + existing PLTs cover the operator need.)

### N16 — Boot-time WARN absent for insecure/silent-misconfig defaults (operability) [MEDIUM, freq 4]
**Drift-class:** the platform boots green on a silently-wrong or insecure configuration with no startup WARN — DISABLED auth exposes the full surface, lockAtMostFor < 2×fixedRate, single scheduler thread serialises jobs, uppercase SMTP disables TLS.
**Affected:** F-097/H-010 (DISABLED boots silently, no WARN spec/Swagger anonymous), F-121/H-001 (4 @Scheduled jobs share one thread, undocumented mitigation), F-121/H-002 (lockAtMostFor 14m vs 15m fixedRate), F-010/H-008 (lockAtMostFor >= 2×fixedRate).
**Dedup:** PLT-072 (require ODD_DISABLED_AUTH_ACK env var) covers the DISABLED-ack angle. PLT-083 covers TTL=0 + session-lock but NOT the lock-window-vs-schedule ratio or the shared-thread serialisation. The scheduler thread-model + lock-window caveats are self-tagged "distinct from PLT-083". GENUINELY-NEW (operability).
**Routed:** **DOC-335** — odd-platform housekeeping config section: document the scheduled-executor single-thread model (`spring.task.scheduling.pool.size` mitigation) + the `lockAtMostFor >= 2×fixedRate` guidance + the per-restart ~14m housekeeping-pause window. Cross-link PLT-083. (Boot-WARN code change noted for a future PLT.)

---

## ALREADY-TRACKED clusters (corroboration only — nothing filed)

| # | Cluster (root drift-class) | Severity | Affected (count) | Tracked by |
|---|---|---|---|---|
| A1 | Global Alerts "All" tab hard-filters STATUS=OPEN; resolved alerts invisible | HIGH | F-007/H-006 (1) | **PLT-121** (exact) |
| A2 | Collector re-registration overwrites UI-edited datasource name/desc, no audit | MEDIUM | F-008/H-004 (1) | **PLT-135** (exact) |
| A3 | Per-entity alert read no page/size bounds (size=1000000, page=0→500) | MEDIUM | F-014/H-003 (1) | **PLT-134** (exact; broader pattern → N1) |
| A4 | Dictionary tab session create/restore failure → silent frozen empty page | MEDIUM | F-024/H-012, F-024/H-008 (2) | **PLT-138** (+ folds N15) |
| A5 | Malformed/poisoned tsquery persists session row → persistent 500 | HIGH | F-024/H-009 (1) | **PLT-127** (Dictionary term-search) |
| A6 | DataSource delete on active source → stuck-open ConfirmationDialog | HIGH | F-031/H-005 (1) | **PLT-128** (exact) |
| A7 | GET /api/owners/{id} returns soft-deleted Owners (PII recoverable) | MEDIUM | F-019/H-007 (1) | **PLT-131** (exact) |
| A8 | Owner delete cascade-block checks 3 of 4 relations | MEDIUM | F-019/H-009 (1) | **PLT-132** (exact) |
| A9 | Owner delete does not refresh FTS vectors | MEDIUM | F-019/H-012 (1) | **PLT-136** (exact) |
| A10 | Azure logout-uri unvalidated → NPE/500 on first logout | HIGH/MED | F-084/H-009, F-124/H-004 (2) | **PLT-130** (exact) |
| A11 | OWNER table mintable without OWNER_CREATE via getOrCreate side-doors | HIGH | F-019/H-004 (1) | **PLT-125** (exact) |
| A12 | 201-vs-200 status-code drift (createOwner/updateOwner, queryExamples) | MED/LOW | F-019/H-006, F-025/H-009 (2) | **SPC-001** (Facet 3, "7+ controllers") |
| A13 | admin-groups SUBSTRING overpromotion premise is factually wrong | MEDIUM | F-084/H-007 (1) | **PLT-081** (amend/close — flagged) |
| A14 | DISABLED-mode anonymous exposure of read surfaces (RBAC/Directory/home/spec) | HIGH | F-006/H-008, F-023/H-009, F-085/H-008, F-090/H-010, F-119/H-002, F-141/H-011 (6) | **DOC-239/242/256/293/297/299/302/308/310** family |
| A15 | Token rows orphaned forever (no deleted_at, no cleanup leg) | HIGH | F-125/H-001 (1) | **PLT-108/PLT-087** (token lifecycle) |
| A16 | Namespace case-sensitivity + soft-delete reincarnation + side-door | MED | F-028/H-002, F-028/H-008 (2) | **DOC-254** (new namespaces page, full scope) |
| A17 | Namespace oversize-name 500 + no NAMESPACE_* audit | MED/HIGH | F-028/H-006, F-028/H-011 (2) | **PLT-076** (IllArg→500) + **DOC-246/PLT-062** (audit) |
| A18 | Notification-subsystem operational hardening (WAL replay, senders cost, PII) | HIGH | F-009/H-008 (subscriber liveness), F-009/H-006 (no batching/429) (2) | **PLT-016** + **PLT-139** (slot/pub wedge) |

Additional individually-named candidates that map cleanly to existing items (not re-tabled): F-013/H-012 + F-123/H-008 (getDtosByDataEntityId soft-delete ghost fields) → **PLT-137-adjacent / DOC-189 family**; F-005/H-006/H-008/H-010/H-011 + F-055/H-010 (lineage depth/diamond/LoadMore) → **PLT-042/PLT-100 + DOC-227/293**; F-017/H-004 + F-057 (per-facet query substring) → **DOC-260** extension; F-156/H-001 (Tags slice-then-sort) → **PLT-060/DOC-199**; F-146 (stale-icon a11y/discoverability) → **PLT-091 + metadata-stale.md (resolved)**; F-147 (whole-row navigate a11y) → **PLT-091 Defect 3**; F-095 (stats replay/validation) → **PLT-044/PLT-106**; F-097/H-003b/H-004 (spec contact PII + localhost server) → **SPC-001 / PLT-112**; F-029/H-009 (createDataEntityTagsRelations replace-masquerade) → **PLT-026 family**.

---

## Top-5 highest-severity GENUINELY-NEW (one-liners)
1. **N1 (HIGH)** — Platform-wide list endpoints have no page-size cap and `page=0` 500s, not 400 (relationships/activity/namespaces/owner-association-activity). → DOC-326.
2. **N3 (HIGH)** — Zero spec-vs-running-platform contract test; every status/semantic/missing-field drift ships undefended. → TST-002.
3. **N4 (HIGH)** — Term reverse-lookup backend: `/terms/{id}/term` 500/405 (overloaded path stem) + `listByTerm` hardcodes `hasNext=false` (terms #51+ unreachable). → PLT-140.
4. **N5 (HIGH)** — Approving one owner-association request silently auto-declines all other PENDING for that Owner, with fabricated DECLINED audit rows. → DOC-327.
5. **N6 (HIGH security)** — Attachment filename → LOCAL path (path traversal) + `Content-Disposition` (CRLF), unsanitised; chunk retry last-writer-wins corruption. → TST-003.
