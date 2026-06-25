---
id: CTRIB-035
github_issue_number: 1762
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1762"
class: bug
milestone: "0.29.0"
status: planned            # intake -> scoping -> reproducing -> root-caused -> [planned] -> plan-approved[GATE1] -> implementing -> ... -> pr-draft -> review-ready -> merged[GATE2 human]
reproduced: "POST /api/policies with invalid policy JSON → HTTP 500/SYS001 'Internal Server Error' (live, image 24b863601d49, 2026-06-25); server log shows the IAE 'Policy is not valid: ...' detail. See Phase B."
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

## Phase B — Reproduce + root-cause   (DONE)

**Reproduced live 2026-06-25** on a throwaway `odd-minimal` stack (`ODD_STREAM=ctrib035repro`, `:18141/:15493`,
`AUTH_TYPE=DISABLED`), image `odd-platform:0.0.1-SNAPSHOT` digest `sha256:24b863601d49` (fresh current-main-class
build). Stack torn down after capture (`compose down -v`).

**The user-input path — genuine bug, curl-reproducible** (`POST /api/policies`, body `PolicyFormData{name, policy}`):

| Case | `policy` value | Response | Hits |
|---|---|---|---|
| schema-invalid (valid JSON) | `{"foo":"bar"}` | **500** `{"code":"SYS001","message":"Internal Server Error",...}` | `PolicyJSONValidator.java:28` (jsonSchema.validate → errors) |
| malformed JSON | `{ this is not valid json` | **500** same body | `PolicyJSONValidator.java:31` (readTree → IOException) |
| near-valid (1 wrong permission enum) | `{"statements":[{"resource":{"type":"MANAGEMENT"},"permissions":["MANAGEMENT_CREATE"]}]}` | **500** same body | `:28` (enum not in schema) |

**The crux, proven by the server log.** The catch-all `log.error("Internal server error", e)` logs the FULL diagnostic:
```
ERROR o.o.o.c.exception.ControllerAdvice : Internal server error
java.lang.IllegalArgumentException: Policy is not valid: [$.statements: is missing but it is required,
  $.foo: is not defined in the schema and the schema does not allow additional properties]
...
java.lang.IllegalArgumentException: Policy is not valid: [$.statements[0].permissions[0]: does not have a value
  in the enumeration [TERM_UPDATE, TERM_DELETE, ... POLICY_CREATE, POLICY_UPDATE, ... ALL]]
```
→ **The client gets only generic `"Internal Server Error"`; the actionable detail is in the server log.** For a user
making a policy typo, the detail (their own input + the public permission enum) is *user-actionable* and belongs in
the **response (400)**. For the missing-extractor *server* fault, the detail belongs in the **log** (where on-call
looks for a 500) and the generic client body is correct (no leak). The bug and its correct fix-shape are now concrete.

**`reproduced:` (frontmatter):** `POST /api/policies` invalid policy JSON → 500/SYS001 on current-main image
`24b863601d49` (see table + log above). The missing-extractor headline is NOT separately driven (needs a misconfigured
bean; it is a server fault left as 5xx by the recommended plan — so it is a scope-analysis item, not a fix target).

### Root cause

`PolicyJSONValidator.validate()` (`:24-33`) signals validation failure by throwing `IllegalArgumentException`. The
service calls it on the request path (`PolicyServiceImpl.java:64` create, `:73` update). `ControllerAdvice` has no
`IllegalArgumentException` handler, so the unchecked IAE propagates to `@ExceptionHandler(Exception.class)` (`:94-99`)
→ HTTP 500 / `SYS001` / `"Internal Server Error"`. The *correct* signal for a user-input validation failure is the
platform's own `BadUserRequestException` (`→ handleBadRequest` `:27-31` → 400 / `USR001`, message surfaced).

## Phase C — Product critique (G-C16) + design (G-C12)

### G-C16 — change-request product critique (the issue's WHAT, before the HOW)

**The user-observable problem, restated independent of the issue's suggested fix:** *a user who submits an invalid
policy (a typo'd permission, malformed JSON) gets an opaque `500 "Internal Server Error"` with no hint, instead of an
actionable client error naming what is wrong.* That is the real defect. The issue ALSO names a second case (a
missing permission-extractor bean → 500) and proposes ONE remedy for both: a **class-wide `IllegalArgumentException → 400`**.

**PO/SME consultation (`odd-sme`, HIGH confidence, cited):**
`lineage/odd-platform/sme-consultations/2026-06-25-ctrib035-illegalargument-http-contract.md`. Findings, all corroborating
the independent analysis:
1. **Missing-bean → 5xx, not 4xx.** RFC/MDN test (verbatim): is it fixed by "repeating the request without
   modification"? A missing extractor bean keeps failing the *identical valid* request until the server is redeployed —
   that is a server fault (5xx). The issue wanting 400 here is product-wrong.
2. **Class-wide IAE→400 is an anti-pattern** — Spring's own docs (fetched live) confirm Spring deliberately does NOT
   auto-map `IllegalArgumentException`; it is too broad a superclass. A blanket 400 would misattribute 43-of-45 server
   faults as client errors, suppress the 5xx signal operators page on, and risk leaking internal fault text.
3. **Invalid-policy-JSON → 400 with the validator detail surfaced is correct; info-disclosure is moot** — the allowed
   permission enum + field paths are already returned to any authenticated user by `GET /api/policies/schema`, and
   authoring is gated by `POLICY_CREATE`/`POLICY_UPDATE`. (Noted: 422 is the technically-tighter code for
   well-formed-but-schema-invalid content, but **400 via `BadUserRequestException` is the in-repo-conformant choice** —
   a deliberate call, not an omission.)
4. **Recommendation: Option B** — route only `PolicyJSONValidator` through `BadUserRequestException→400`; leave the 43
   server-fault IAEs as 5xx.

**Options (the GATE-1 matrix):**

| Opt | Shape | User-facing consequence | Verdict |
|---|---|---|---|
| **A** | Class-wide `@ExceptionHandler(IllegalArgumentException.class) → 400` (the issue's recommendation) | Fixes the policy case BUT reclassifies ~43 server/config/internal faults (+ all `NumberFormatException`/enum-`valueOf`) as client 400s → on-call stops being paged for real faults; raw internal messages leak to clients. Also the suggested code `USR400` does not exist. | **REJECT** (anti-pattern; blast radius; against the platform's deliberate-mapping pattern) |
| **B** | **Targeted: `PolicyJSONValidator` throws `BadUserRequestException`→400; server-fault IAEs stay 5xx.** Missing-extractor kept 5xx (optional semantic `IllegalArgumentException`→`IllegalStateException` for intent). | The policy user gets `400` + the actionable validator detail. Server faults stay `5xx` (on-call paging + generic body preserved). | **RECOMMEND** (conforms to the typed-exception + global-handler convention `implicit-adrs.md:287`; the issue's own "Alternative") |
| **C** | B **+** full audit of all 45 IAE sites, reclassify each 4xx/5xx (incl. the ingestion-metric extractors — machine-input, currently 500). | Broader correctness, but a large diff across ingestion + many subsystems = scope explosion, separate risk. | **DEFER the extra sites** to a tracked follow-up (keep this PR bounded — G-C5) |
| **D** | Class-wide IAE handler that maps to a *better-diagnosed 500* (keep status, improve code/message). | No client-facing improvement for the genuine user-input case; marginal over the existing catch-all + log. | reject (doesn't fix the real bug) |

**Divergence from the issue's ask is real → this is a GATE-1 decision (G-C16), surfaced publicly via a scope comment
(G-C5, drafted below), never silently absorbed.**

### G-C12 — design before build

- **(a) Reuse-scan.** No new component. `BadUserRequestException` is the established idiom — already imported and used
  in `PermissionServiceImpl.java:26,36` (same package neighbourhood) and mapped by `ControllerAdvice.handleBadRequest`
  (`:27-31`). The fix reuses the existing `service-throws-typed-exception → global-handler → status` path. (`/retrieve`
  not needed — the grep + the existing handler set are decisive.)
- **(b) ADR-check.** The pattern is already an implicit-ADR candidate — **"uniform Mono controller pipeline"**
  (`lineage/odd-platform/implicit-adrs.md:287-291`): *exception translation / status shaping is NOT at the controller;
  non-2xx come from service-thrown exceptions hitting the global handler.* **Option B conforms** (a service throws a
  typed exception; the global handler maps it). The new `ResponseStatusException` handler (`ControllerAdvice.java:64-92`)
  is the maintainers actively evolving this pattern. → **Propose a focused reverse-engineered ADR**
  (`adrs/drafts/exception-http-status-mapping.md`) that formalises the taxonomy (typed exceptions encode their status;
  user-input validation → `BadUserRequestException`/400; server invariants → 5xx; **`IllegalArgumentException` is NOT
  blanket-mapped — and why**). This directly answers the issue's "CLASS issue / regression vector" framing by giving the
  next contributor a rule. Draft lives in odd-team (not odd-platform code) — it does not bloat the PR. **GATE-1 decision:
  author the ADR now, or defer.**
- **(c) Impact-dimension checklist.**
  - **i18n:** N/A — backend exception messages are not localised (they go to logs + the API `ErrorResponse.message`,
    developer/operator-facing English); no locale catalog touched.
  - **generated BE+FE clients:** none. The `ErrorResponse` *shape* is unchanged (code/message/retryable/resolvable);
    only the HTTP *status* changes (500→400) for the policy path. FE TS client handles statuses generically. No spec
    schema change → no client regen.
  - **openapi:** `/api/policies` declares no error responses today (consistent with every other endpoint — error
    statuses are undeclared platform-wide). Adding a 400 only here would be inconsistent → **out of scope** (note as a
    possible platform-wide follow-up).
  - **consumers of a changed signature:** none. `PolicyJSONValidator.validate(String)` keeps its signature; it still
    throws an unchecked `RuntimeException` (now `BadUserRequestException`, a subclass of `ExceptionWithErrorCode extends
    RuntimeException`); callers (`PolicyServiceImpl:64,73`) don't catch it → unaffected.
  - **migrations:** none. **docs:** Phase D reads the policy/permission docs page(s) and records the routing decision
    (the issue asserts "no doc-side companion needed" — verified by READING, not assumed; G-C10). **ontology:** `/enrich
    --touched` the `PolicyServiceImpl` sidecar (`lineage/.../understanding/...PolicyServiceImpl.md`, exists) — it
    describes the write-time-validation behaviour whose failure-surface changes; lineage/** is CLEAN now so /enrich is
    available.
- **(d) Product-Owner / SRE lens.** SRE-positive: 5xx still pages on-call (server faults preserved); user typos stop
  generating false 5xx pages (move to 4xx). PO-positive: the policy author gets an actionable error, not "Internal
  Server Error." No control lost (a one-line exception-type change + tests).

## Plan (the GATE-1 artifact)

**Recommended: Option B.** Concrete change set (odd-platform, in the `ctrib035` worktree):

1. **`PolicyJSONValidator.java:28,31`** — throw `BadUserRequestException("Policy is not valid: " + errors)` /
   `BadUserRequestException("Policy is not valid: " + e.getMessage())` instead of `IllegalArgumentException`. (Import
   swap `IllegalArgumentException`→`o.o.o.exception.BadUserRequestException`.) → 400 / `USR001`, the validator detail
   surfaced in `ErrorResponse.message` via the existing `handleBadRequest` path.
2. **Missing-extractor (`PermissionServiceImpl.java:47-48`)** — **kept 5xx** (server fault; diagnostic already logged).
   *Optional, GATE-1 sub-decision:* change `IllegalArgumentException` → `IllegalStateException` for intent clarity
   (NO status change — still the catch-all 500). Recommend the rename for clarity; harmless either way.
3. **No class-wide IAE handler** is added (Option A explicitly rejected).
4. **ADR (GATE-1 decision):** author `adrs/drafts/exception-http-status-mapping.md` (recommend) or defer.

**Scope EXCLUSIONS (deliberately NOT touched — G-C5):**
- The other 43 IAE sites (config / jOOQ / WAL / mappers / enum lookups) — server faults, stay 5xx.
- The **ingestion-metric extractor** IAEs (`service/ingestion/metric/...`, machine-input, currently 500) — a genuine
  but separate user/machine-input surface → **deferred follow-up** (a new backlog item), not this PR.
- **`REFACTOR-192`** (`JooqFTSHelper` to_tsquery user-input→500) — sibling finding, already logged; not this PR.
- The openapi error-response declarations — platform-wide gap, not this PR.

**Test plan (BOTH buckets per the tests-pillar home rule — G-C9):**
- **Unit (odd-platform CI):** new `PolicyJSONValidatorTest` — `validate(schema-invalid)` and `validate(malformed)`
  throw `BadUserRequestException` (RED on base: they throw `IllegalArgumentException`; GREEN on fix). Pure, no mocks.
- **Integration / in-process (odd-platform CI):** an `@WebFluxTest`/`BaseIntegrationTest`-level test that `POST
  /api/policies` with invalid policy JSON returns **HTTP 400** (not 500) with `code USR001` (RED on base = 500; GREEN
  on fix = 400). This is the user-facing **contract** proof — and an in-process integration test CAN see the status
  (so the LSN-031 "unit can't see the user-facing symptom" gap does not apply here).
- **Browser e2e (odd-team `IT-NNN`):** **considered, not auto-included.** The symptom is an HTTP status code, fully
  observable by the in-process integration test above — there is no rendered-UI self-contradiction (the LSN-031 /
  PLT-176 class). A browser IT would only assert "the policy form shows an error toast," which tests FE error rendering,
  not this BE contract. **Decision deferred to GATE 1** (belt-and-suspenders option if the maintainer wants it; default
  = not warranted for a pure status-code contract). The FULL e2e regression (G-C2) still runs at the DoD regardless.

**Docs routing (Phase D):** READ the policy/permission docs page(s); expected `none` (error status codes are not
documented per-endpoint in the manual) — but recorded only after reading (G-C10).

**Ontology:** `/enrich --touched` the `PolicyServiceImpl` sidecar + re-embed; committed (G-C10).

### Drafted scope comment for the issue thread (G-C5 — posted immediately after GATE-1 approval, before any code)

> **Scope of the incoming PR (CTRIB-035).** Thanks for the precise write-up. On reproduction + a product review, the
> PR resolves this with a **targeted** fix rather than a class-wide handler, for reasons worth recording:
>
> - **Genuine user-input validation → 400 (fixed here).** `PolicyJSONValidator` (invalid policy JSON on
>   `POST`/`PUT /api/policies`) currently surfaces as `500 "Internal Server Error"` — reproduced: a policy with one
>   mistyped permission returns 500 with no hint, while the validation detail sits only in the server log. The PR makes
>   the validator throw `BadUserRequestException` → **400 / USR001** with the actionable detail in the response (the
>   permission enum + field paths are already public via `GET /api/policies/schema`, so no new disclosure).
> - **Missing-extractor bean → kept 5xx (by design).** Re-issuing the *same valid* request keeps failing until the
>   deployment is fixed — that is a server fault (HTTP 5xx), and its full diagnostic is already logged by the catch-all.
>   A 400 here would tell the operator "you sent a bad request" for a mis-wired build, and stop it paging on-call.
> - **Why not the class-wide `IllegalArgumentException → 400`.** There are 45 `IllegalArgumentException` throw sites;
>   ~43 are server/config/internal faults (bean-init config, internal jOOQ, WAL decoding, mappers). A blanket 400 would
>   reclassify them as client errors, suppress the 5xx paging signal, and risk leaking internal messages — and it would
>   also catch `NumberFormatException`/enum failures across the whole surface. Spring deliberately doesn't auto-map IAE
>   for this reason; the platform's typed-exception + global-handler convention is the safer pattern.
> - **Tracked separately:** the ingestion-metric IAE→500 paths (machine input) and a possible platform-wide
>   error-response audit — out of scope here to keep the PR bounded.
>
> (No workspace-internal IDs; self-contained.)

## GATE 1 — awaiting human approval

Status: `planned` → awaiting `plan-approved`. The AskUserQuestion at GATE 1 carries: (Q1) Option A/B/C; (Q2) the
missing-extractor `IllegalStateException` rename; (Q3) author the ADR now vs defer; (Q4) the browser-IT belt-and-suspenders.
No code is written until approval (G-C3). On approval: post the scope comment (G-C5), then Phase D.
