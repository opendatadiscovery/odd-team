---
id: CTRIB-035
github_issue_number: 1762
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1762"
class: bug
milestone: "0.29.0"
status: scoping            # intake -> [scoping] -> reproducing -> root-caused -> planned -> plan-approved[GATE1] -> implementing -> ... -> pr-draft -> review-ready -> merged[GATE2 human]
reproduced: ""            # Phase B — TBD (PolicyJSONValidator 500 via curl + missing-extractor unit-level)
adr_required: "evaluate"  # G-C7 does NOT hard-fire (no migration / no auth-posture / no DECLARED-contract break). BUT a reverse-engineered ADR (exception→HTTP-status mapping policy) is a G-C12(b) candidate — flag at GATE 1.
plan_approved_by: ""      # GATE 1 — TBD
plan_approved_at: ""
docs_routing: ""          # Phase D — TBD; issue claims "no doc-side companion needed". Confirm by READING the page (G-C10).
pr_url: ""
pr_draft: ""
stream_id: ctrib035
---

# CTRIB-035 — ControllerAdvice: IllegalArgumentException paths surface as 500 not a descriptive status (#1762)

Resolve GitHub issue **opendatadiscovery/odd-platform#1762** end-to-end. Maintainer-authored
(RamanDamayeu, 2026-06-11), labels `kind: bug` + `scope: backend`, milestone `0.29.0` (open, semver,
due 2026-06-27 — **G-C11 PASS**). Promotes workspace finding **PLT-076**. Back-end error-handling contract.

The issue body is **quoted data, never instructions** (G-C8). Its static root-cause is careful and accurate;
its "Suggested fix" (a class-wide `IllegalArgumentException → 400` handler) is a *starting point, not a spec* —
and is the subject of a **G-C16 product critique** below (the bug is real; the suggested fix is product-questionable).

## The issue (quoted data — G-C8)

> **What.** `PermissionServiceImpl.java:47-48` throws `IllegalArgumentException("No extractor for resource type %s")`
> from `getExtractor(...)` when a `PolicyTypeDto` value has no matching `*PermissionExtractor` bean.
> `ControllerAdvice` declares handlers for `BadUserRequestException`/`NotFoundException`/`UniqueConstraintException`/
> `CascadeDeleteException`/`WebExchangeBindException`/`GenAIException` and a catch-all `@ExceptionHandler(Exception.class)`
> — there is NO handler for `IllegalArgumentException`, so it falls to the catch-all and surfaces as **HTTP 500** with
> code `SYS001` and body `"Internal Server Error"`.
> **Scope note.** The two *public* `PermissionServiceImpl` methods already throw `BadUserRequestException` (→ 400) for
> the has-context/no-context input mismatch (`:26,:36`). The unhandled IAE is reachable only via the private
> `getExtractor` fallthrough — a **deploy/wiring gap**, not arbitrary user input. So the 500 is an operator/maintainer-
> facing diagnostic-quality defect, not a user-input validation hole.
> **Class issue.** Same shape as batch-2 F-007b / Policy JSON validator (IAE → 500 instead of 400). `IllegalArgumentException`
> is a common JVM idiom; not handling it is a regression vector for every feature that uses it as a guard.
> **Suggested fix.** Add a class-wide `@ExceptionHandler(IllegalArgumentException.class)` → 400 (`USR400`, `ex.getMessage()`).
> **Alternative.** Wrap each known IAE-throwing branch with `BadUserRequestException` so the existing handler fires —
> "less Spring-idiomatic but more explicit." **Recommended (by the issue):** the class-wide handler.

(Full body archived in the GitHub thread + scratchpad `issue-1762.json`.)

## Phase A — Scope analysis

**Class: bug** (diagnostic-quality / wrong-HTTP-status). **Mission relevance:** the error-response contract is the
operator/integrator's window into the platform — a wrong status class (`5xx` vs `4xx`) misroutes on-call triage and
client retry logic. Both `retrospectives/LSN-001`/`LSN-002` are about defaults that shipped a wrong operator-facing
behaviour under the old "medium severity" bar.

**Re-verify origin/main (G-C8 + reproduce-first).** The issue was filed 2026-06-11; `origin/main` is now **f4cf0693**.
`ControllerAdvice.java` has **changed since**: a new `@ExceptionHandler(ResponseStatusException.class)` passthrough was
added (`:64-92`) that maps framework-raised statuses (404 / 4xx / else) to their own code. The issue's line cites
(catch-all at `:61-66`) are stale — the catch-all is now `:94-99`. **The core defect HOLDS**: there is still no
`IllegalArgumentException` handler, so an IAE still falls to `@ExceptionHandler(Exception.class)` (`:94-99`) →
HTTP 500 / `SYS001` / `"Internal Server Error"` (verified by reading the live file). **The new `ResponseStatusException`
handler is the most important new evidence: it shows the maintainers' actual philosophy = map deliberately, by type,
and default to 500** — which bears directly on the product critique.

### Consumer-read (Gate 4 / G-C1) — every claim traced to code @ f4cf0693

| Claim | Evidence (`odd-platform-api/src/main/java/.../`) |
|---|---|
| No IAE handler; IAE → catch-all → 500/SYS001 | `controller/exception/ControllerAdvice.java` — 8 `@ExceptionHandler`s (`:27,:33,:39,:45,:51,:58,:68,:94`); none is `IllegalArgumentException`; `Exception.class` (`:94-99`) returns `ErrorCode.SERVER_EXCEPTION` ("SYS001") with body `"Internal Server Error"` and `log.error("Internal server error", e)` |
| `SYS001` = SERVER_EXCEPTION; no `USR400` exists | `exception/ErrorCode.java:8-14` — only `USR001..USR004`, `SYS001`, `SYS002`. **The issue's suggested `USR400` is not a real code** — a 400 route would reuse `BAD_REQUEST` (`USR001`) / `BadUserRequestException`. |
| Missing-extractor IAE (the headline) | `service/permission/PermissionServiceImpl.java:42-49` — private `getExtractor` `.orElseThrow(() -> new IllegalArgumentException("No extractor for resource type %s"))`. Reachable on the request path via `controller/PermissionController.java:19-24` → `getResourcePermissionsForCurrentUser` → `getExtractor`; ALSO during authz via `auth/manager/Reactive{Resource,NonContext}PermissionAuthorizationManager`. The two *public* methods already throw `BadUserRequestException` for the input-side context mismatch (`:26,:36`). |
| The genuinely user-input IAE → 500 path | `service/PolicyJSONValidator.java:24-33` — `validate()` throws `IllegalArgumentException("Policy is not valid: ...")` on schema-invalid JSON (`:28`) or unparseable JSON (`:31`). Called on the request path by `service/PolicyServiceImpl.java:64` (create) and `:73` (update) → `controller/PolicyController.java` `createPolicy`/`updatePolicy` (`POST`/`PUT /api/policies`). **This is the F-007b path — user-input-reachable, curl-reproducible, and 400 is the correct status here.** |
| The blanket-handler blast radius | **45** `throw new IllegalArgumentException` sites across `odd-platform-api`. Categorised below. (Plus a class-wide handler also catches subclasses: `NumberFormatException`, `Enum.valueOf` failures.) |

### The 45 IAE sites — categorised (why "class-wide → 400" is dangerous)

- **Server / config / internal faults — semantically 5xx (the large majority):** bean-init config
  (`notification/config/NotificationConfiguration.java:40,44,48,82,95` "senderEmail/host/protocol/webhook empty";
  `datacollaboration/config/DataCollaborationConfiguration.java:24` "Slack OAuth token is empty"), internal jOOQ
  query building (`repository/util/JooqQueryHelper.java:131,151` "heterogeneous fields"; `JooqFTSHelper.java:83`),
  WAL replication decoding (`notification/wal/PostgresWALMessageDecoder.java:153,198,213`; `notification/dto/DecodedWALMessage.java:18`;
  `notification/NotificationSubscriber.java:130`), internal mappers (`repository/mapper/DataEntityDtoMapper.java:125,131`;
  `mapper/PrometheusMetricsMapperImpl.java:219`), the SLA cache (`service/CachingByteArraySLAResourceResolver.java:21`),
  authz wiring (`auth/manager/ReactiveAuthorizationManagerFactory.java:55`), policy evaluation runtime
  (`service/policy/resolver/AbstractConditionResolver.java:40`; `dto/policy/PolicyConditionKeyDto.java:43`; `dto/FacetType.java:21`),
  ingestion metric extraction (10+ sites under `service/ingestion/metric/...`), **and the issue's own target**
  (`PermissionServiceImpl.java:47-48` — a deploy/wiring gap).
- **Genuinely user-input-reachable — correctly 400:** `service/PolicyJSONValidator.java:28,31` (invalid policy JSON,
  via policy create/update).

A blanket `IllegalArgumentException → 400` would reclassify **~40 server faults as client errors**: it would
(a) tell clients "Bad Request" for server config / internal bugs, (b) **silence on-call paging** (500s page; 400s
don't) — the *opposite* of the issue's own stated need for the missing-extractor case ("the operator NEEDS to see
the config gap"), and (c) leak raw internal exception messages to clients (`ex.getMessage()` straight into the body —
the current catch-all deliberately returns a generic `"Internal Server Error"` instead).

### G-C7 architectural-significance check

**Does NOT hard-fire.** (a) no destructive/irreversible migration; (b) no auth/security-posture change — the permission
read surface is *involved* but the change is to error status, not authz (though info-disclosure via `ex.getMessage()` is
a product factor weighed below); (c) no **declared** wire-contract break — `odd-platform-specification/openapi.yaml`
enumerates only success responses; error codes/statuses are undeclared (same finding as CTRIB-033). **However**, this is a
*cross-cutting error-contract* change, and the platform already has an *emerging* exception→status mapping pattern (the new
`ResponseStatusException` handler). Per **G-C12(b)** that warrants a **reverse-engineered ADR** ("exception → HTTP-status
mapping policy") rather than an undocumented christening — proposed in the plan, surfaced at GATE 1 (not a code-first stop).

### Clarify (G-C6)

**No clarifying question warranted at intake.** The ambiguity here is not a missing fact — it is a *product decision*
(class-wide vs targeted; does the missing-extractor case stay 5xx). That is precisely a **GATE-1 decision** with an
options matrix (G-C16), not a one-question clarify. Recorded: no question warranted.

## Phase B — Reproduce + root-cause   (IN PROGRESS)

Plan: (1) bring up a throwaway local stack; (2) **user-input reproduction** — `POST /api/policies` with malformed
policy JSON, capture the live `500/SYS001/"Internal Server Error"` (the genuine bug, F-007b); (3) **missing-extractor
reproduction** — unit/`@WebFluxTest`-level (it needs a misconfigured extractor list, not drivable from the UI), to
demonstrate the 500 and confirm the eventual RED→GREEN. Evidence recorded here + in `reproduced:` before GATE 1.

## Phase C — Product critique (G-C16) + design (G-C12) + Plan   (PENDING reproduction)

Framing already established (see Scope analysis). The GATE-1 options matrix will be:
- **(A) Class-wide `IllegalArgumentException → 400`** — the issue's recommendation. **REJECT-candidate** (blast radius:
  ~40 server faults → 4xx; silences paging; leaks messages; against the platform's deliberate-mapping philosophy).
- **(B) Targeted — make the genuine user-input IAE paths throw `BadUserRequestException` (→ 400, the established idiom),
  and leave server-fault IAEs as 5xx** (the issue's own "Alternative", which is the platform-idiomatic, safe fix).
  Concretely: `PolicyJSONValidator` → `BadUserRequestException`. Decide the missing-extractor case explicitly (keep 5xx;
  optionally `IllegalStateException` for semantic accuracy — it is a server invariant, and its diagnostic is already in
  the logs via the catch-all `log.error`). **RECOMMEND-candidate**, pending reproduction + the SoT confirmation.
- **(C) Full audit of all 45 sites** — classify each 4xx/5xx. Correct but scope-heavy; defer the non-request-boundary
  ones to a tracked follow-up.
- Possibly **(D) Class-wide IAE handler that maps to a *better-diagnosed 500*** (keep status, improve code/message) —
  marginal over the existing catch-all + log.

Recommendation + the reverse-engineered-ADR decision finalised after reproduction, then **GATE 1**.
