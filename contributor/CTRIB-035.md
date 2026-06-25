---
id: CTRIB-035
github_issue_number: 1762
github_issue_url: "https://github.com/opendatadiscovery/odd-platform/issues/1762"
class: bug
milestone: "0.29.0"
status: review-ready       # intake -> scoping -> reproducing -> root-caused -> planned -> plan-approved[GATE1 ✓] -> implementing -> tests-green -> docs-done -> pr-draft -> [review-ready ✓ /review ACCEPTED 2026-06-25] -> merged[GATE2 human]
reproduced: "POST /api/policies with invalid policy JSON → HTTP 500/SYS001 'Internal Server Error' (live, image 24b863601d49, 2026-06-25); server log shows the IAE 'Policy is not valid: ...' detail. See Phase B."
adr_required: "yes — adrs/drafts/exception-http-status-mapping.md (GATE-1 approved: author now)"
plan_approved_by: "RamanDamayeu (AskUserQuestion GATE 1)"
plan_approved_at: "2026-06-25"
scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1762#issuecomment-4796326456"
docs_routing: ""          # Phase D — TBD; issue claims "no doc-side companion needed". Confirm by READING the page (G-C10).
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1807"
pr_draft: "draft:true, open, Closes #1762 — branch contrib/CTRIB-035-illegalargument-exception-contract @ a4a34e98 (pushed via the App, same-name refspec, main untouched)"
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

## GATE 1 — APPROVED 2026-06-25 (RamanDamayeu, AskUserQuestion)

All four recommended options chosen (no code was written before approval — G-C3):
- **Q1 Fix approach → Option B (targeted).** `PolicyJSONValidator` throws `BadUserRequestException`→400; server-fault IAEs stay 5xx.
- **Q2 Missing-extractor → keep 5xx + rename to `IllegalStateException`** at `PermissionServiceImpl:47-48` (intent clarity, no status change).
- **Q3 ADR → author now** — `adrs/drafts/exception-http-status-mapping.md`.
- **Q4 Tests → in-process integration only** — unit (`PolicyJSONValidatorTest`) + `@WebFluxTest`/`BaseIntegrationTest` (POST → 400); no browser IT (no rendered-UI contradiction; the in-process test sees the status).

**Scope comment posted** (G-C5, before any code): https://github.com/opendatadiscovery/odd-platform/issues/1762#issuecomment-4796326456
(author `odd-contributor[bot]`, 201). External GitHub writes authorized by the maintainer (AskUserQuestion) — the branch
push + draft PR in Phase E use the same App path.

## Phase D — implement + test (the ledger)   (IN PROGRESS)

**Worktree** `../odd-platform-ctrib035` @ branch `contrib/CTRIB-035-illegalargument-exception-contract`
(off origin/main `f4cf0693`, `--no-track`, push-safety verified `@{u}` != origin/main).

**The change (exactly the GATE-1 scope):**
- `service/PolicyJSONValidator.java:28,31` — `IllegalArgumentException` → `BadUserRequestException("Policy is not valid: %s", detail)`. Detail passed as a **format arg** (never concatenated into the format string) so a `%` in a validation message cannot break `String.format` inside `BadUserRequestException`.
- `service/permission/PermissionServiceImpl.java:48` — the missing-extractor fallthrough `IllegalArgumentException` → `IllegalStateException` (server-invariant intent; **no status change**, still 5xx via the catch-all).
- (odd-team) `adrs/drafts/exception-http-status-mapping.md` — the reverse-engineered ADR (extends published **ADR-0007**).

**Reuse/ADR notes (confirmed in code):** the typed-exception → global-handler path is **ADR-0007** (`backlog/adr/ADR-0007.md`, published at `…/architecture-decision-log/adr-0007-uniform-reactive-controller-pipeline`). `AdrControllerAdviceMappingScanTest` pins the ControllerAdvice handler set — **unaffected** (I add no handler). No test asserted the old IAE on these paths (PolicyServiceImplTest *mocks* the validator) → no breakage.

**Commit:** odd-platform `a4a34e98` (`contrib/CTRIB-035-illegalargument-exception-contract`).

**Definition-of-Done gates:**
1. **Full unit build (working tree)** — ✅ **GREEN**. `scripts/run-platform-tests.sh` (no-arg = `:odd-platform-api:build` = test + checkstyleMain + checkstyleTest + assemble): `BUILD SUCCESSFUL in 7m29s`; **0 failures / 0 errors across the WHOLE suite** (no existing test broke); my 3 classes `PolicyJSONValidatorTest` 4/4, `PermissionServiceImplTest` 1/1, `PolicyValidationErrorContractTest` 2/2.
2. **FULL integration regression** on the branch SUT — ✅ **GREEN-for-change** (`run-regression.sh ctrib035`, SUT built from worktree `a4a34e98` → digest `sha256:4d541a88`, flock-serialized 08:35→08:50):
   - **feature-complete: 313 passed, 1 skipped, 4 failed** — all 4 accounted-for, ZERO attributable to my change: ① + ② `i18n-main-search-placeholder.spec.ts` es/ua = **ctrib036's #1776 unmerged fix** (my SUT correctly lacks ctrib036's locale changes → fails on any SUT without #1776; delta-0); ③ + ④ `owner-association-triage:78` + `remove-user-owner-mapping:123` = `waitForResponse 60s` **environmental flakes** under heavy 3-stream load — **CONFIRMED flakes**: re-ran both spec files on the same SUT (`4d541a88`) on a quiet box → **6/6 PASS in 29.4s** (the two were 6.7s / 9.8s). The change-relevant specs PASSED: `rbac-policy-lifecycle` (multi-stack), `permission-read-surface` + `rbac-frontend-affordance` (feature-complete).
   - **known-bugs: 3 RED — all expected** (attachment LSN-001/PLT-086 · error-boundary F-042 · quality-dashboard PLT-052/#1794); **0 unexpected GREEN** ✓.
   - **multi-stack: PASS** ✓ · **ingestion-e2e: PASS** ✓.
   - Note: this is the regression-safety gate; the fix itself is proven by the unit + in-process integration RED→GREEN (no browser-e2e IT for this fix — GATE-1 Q4). My change is provably inert on normal flows (it alters only invalid-policy-JSON + missing-extractor-bean paths; all extractor beans are wired in the SUT, so `getExtractor` never throws).
3. **Docs read + decided + routed (G-C10/G-C11)** — ✅ **routing: none**. Read `configuration-and-deployment/enable-security/authorization/policies.md`; line 310 already documents the validation-error behaviour generically (*"a condition using `in` is rejected by the policy JSON Schema, and the platform returns an error rather than saving the policy"*) — that stays true and is *improved* by the fix (a clean 400 with detail vs an opaque 500). The page documents policy structure + behaviour, not HTTP status codes; adding one would be inconsistent scope creep. The issue's own "no doc-side companion needed" is read-confirmed.
4. **Ontology /enrich --touched (G-C10)** — **DEFERRED to the post-merge / 0.29.0 release substrate scan** (the accepted CTRIB-028..034 bar). Justification: the ontology tracks `origin/main`; the fix is on an **unmerged branch**, so re-enriching now would either re-describe pre-fix main (no-op) or premature unmerged code. **Exact staleness recorded for the release scan:** `lineage/odd-platform/understanding/odd-platform__java__service__service__PolicyServiceImpl.md` lines **31** (facet `error_class_misrepresented` — now FIXED), **78**, **91**, **109** (all say "IllegalArgumentException → 500 not 400"), and the **F-006** reflection facet `error_class_misrepresented`. These correctly describe *current main* (which still 500s until GATE-2 merge). No dedicated sidecar exists for `PolicyJSONValidator`/`PermissionServiceImpl`.
5. **Principal sufficiency + local jacoco patch-coverage 98% (G-C13)** — ✅ **verified locally** (not discovered in CI). From the full-build jacoco XML: every changed executable line is covered (`ci>0`) — `PolicyJSONValidator` :32 + :35 (the two `BadUserRequestException` throws), `PermissionServiceImpl` :51 (the `IllegalStateException`). PolicyJSONValidator has zero missed lines; the PermissionServiceImpl "missed" lines are pre-existing OTHER methods, not my diff. CI gate `Madrapps/jacoco-report min-coverage-changed-files: 98` satisfied. Sufficiency: 3 meaningful RED→GREEN tests, no control lost (a typed-exception swap), no existing functionality harmed (full suite green).

**Test ledger (BOTH buckets; unit bucket per the tests-pillar home rule) — RED→GREEN PROVEN:**
- Unit `PolicyJSONValidatorTest` (4 cases: schema-invalid→400, malformed→400, %-in-detail format-safe, valid passes) — **GREEN on fix** ✅; **RED on base** ✅ (3 exception-asserting cases fail: pre-fix throws `java.lang.IllegalArgumentException`).
- Unit `PermissionServiceImplTest` (missing extractor → `IllegalStateException`, stays 5xx) — **GREEN on fix** ✅; **RED on base** ✅ (pre-fix throws `IllegalArgumentException`).
- In-process integration `PolicyValidationErrorContractTest` (`POST /api/policies` invalid → 400 USR001, detail in body) — **GREEN on fix** ✅ (2/2, BaseIntegrationTest+WebTestClient); **RED on base** ✅ (got `< 500 INTERNAL_SERVER_ERROR`).
- RED-on-base proof method: reverted the 2 source files to `origin/main`, ran the 3 classes → `7 tests completed, 6 failed` (`validPolicyPasses` is a guard, green on both), fix auto-restored. Both buckets proven.

## Phase E — draft PR (GATE 2 entry)

- **Branch pushed** via the App (same-name refspec, `main` untouched, push-safety asserted `@{u}` != origin/main): `contrib/CTRIB-035-illegalargument-exception-contract` @ `a4a34e98`.
- **DRAFT PR #1807** — https://github.com/opendatadiscovery/odd-platform/pull/1807 (`draft:true`, open, `Closes #1762`, base `main`, `Milestone: 0.29.0`, `Docs: none`). Body = `contributor/CTRIB-035-pr-body.md`.
- **Scope comment** (G-C5, posted before any code): https://github.com/opendatadiscovery/odd-platform/issues/1762#issuecomment-4796326456.
- Status = `pr-draft`. A **separate `/review` session** flips it to `review-ready`; the human reviews + merges at **GATE 2** (the bot is the PR author and cannot self-approve — the required approval is the gate). The CTRIB never self-marks `merged`.

### Deferred follow-ups (G-C5 — logged on disk, not narrated)
- `issues/odd-platform/PLT-246.md` — ingestion-metric extractor `IllegalArgumentException → 500` paths (machine input, ~10 sites under `service/ingestion/metric/...`): same error-contract class as #1762, separate surface.
- `issues/odd-platform/PLT-247.md` — OpenAPI does not declare error responses on any endpoint (platform-wide spec-completeness gap).

## Acceptance criteria (1–17) — implementer self-check (the gate authority is `/review`, separate session)

1 plan-before-code ✓ (GATE-1 `b963c30` precedes the fix `a4a34e98`) · 2 reproduced ✓ (Phase B live 500; durable RED proof) · 3 diff bounded ✓ (= GATE-1 scope: 2 source + 3 tests; exclusions logged) · 4 unit injects the failing condition ✓ (real validator throws; real missing-extractor) · 5 pins N/A (no characterization pin) · 6 docs stated + page READ ✓ (none + why) · 7 ontology — DEFERRED-justified (release scan; exact staleness recorded) · 8 not self-`done` ✓ (status `pr-draft`) · 9 ADR ✓ (authored before code per GATE 1; G-C7 did not hard-fire) · 10 injection N/A · 11 DoD ✓ (full unit build + FULL regression green-for-change + docs read + ontology decided) · 12 milestone 0.29.0 ✓ (docs routing none, no train item) · 13 design-before-build ✓ (reuse BadUserRequestException; ADR-check ADR-0007; impact checklist; PO/SRE lens) · 14 Principal sufficiency ✓ (patch-coverage verified local; 3 meaningful tests; no control lost) · 15 test-change integrity N/A (all tests ADDED, none changed) · 16 product critique ✓ (G-C16 options matrix at GATE 1; divergence surfaced + scope comment posted) · 17 = 16.

## Review (2026-06-25, session: review-ctrib035 — separate /review session)

- **Result**: **ACCEPTED** → `pr-draft` → `review-ready`. Human **GATE-2** (approve + merge PR #1807) owns `merged`/`done`; the bot is the PR author and cannot self-approve (G-C4). Milestone 0.29.0 → the 0.29.0 release-review owns the eventual `done`.

### Preconditions
Status was `pr-draft` (the contributor review-ready-equivalent). Separate session from `/implement` (the fix shipped in a prior session: b963c30 → a4a34e98 → d6076f4). **2-minute bounce did NOT fire** — the fix-SUT image is present + VERIFIED to contain the fix, and integration run-logs exist on its digest. The odd-platform commit carries no `Sources:`/`Consumer-read:` footer, but that is **not** a stop for a contributor *code* commit: `pillars/contributor/gates.md` mandates none, prior ACCEPTED CTRIB platform commits (4028b4a6 / fd71eb3d / 8e5b3339) carry none, and the consumer-read evidence lives inline in the Phase-A ledger table (re-verified below).

### Acceptance criteria (1–17)
- [x] 1 plan-before-code — PASS (GATE-1 b963c30 @08:00:46 precedes fix a4a34e98 @08:28:55).
- [x] 2 reproduced — PASS (Phase B live 500 attested; durable RED proof = the 3 added tests assert `BadUserRequestException`/`IllegalStateException`, RED on the IAE base; CI-green on fix).
- [x] 3 diff bounded — PASS (`git diff --stat origin/main..a4a34e98` = exactly 2 source + 3 NEW test files; exclusions logged PLT-246/247).
- [x] 4 unit injects the failing condition — PASS (real validator fed real invalid JSON; real `PermissionServiceImpl(List.of(), List.of())` → real `orElseThrow`).
- [x] 5 pins — N/A (no characterization pin; all behavioral RED→GREEN).
- [x] 6 docs stated + page READ — PASS (routing:none; reviewer independently read `policies.md` — `:310` stays accurate & improves under the fix; status codes not documented per-endpoint anywhere).
- [x] 7 ontology — DEFERRED-justified (PolicyServiceImpl sidecar describes the pre-fix `error_class_misrepresented` = current main; `lineage/**` dirty+contended by P-001; the accepted CTRIB-028..034 bar; refreshes at the 0.29.0 release substrate scan).
- [x] 8 not self-done — PASS (status was `pr-draft`; implementer did not self-flip).
- [x] 9 ADR — PASS (`exception-http-status-mapping.md` authored before code; taxonomy verified line-by-line vs `ControllerAdvice`; extends ADR-0007; G-C7 did not hard-fire).
- [x] 10 injection — covered (the `%s`-format-arg safety is the relevant guard; `validatorDetailContainingPercentDoesNotBreakFormatting` pins it).
- [x] 11 DoD — PASS (full unit = CI 580/0 on the SHA; FULL regression GREEN-for-change — reviewer's OWN run below; docs read; ontology decided).
- [x] 12 milestone 0.29.0 — PASS (issue milestone 0.29.0 open, due 2026-06-27 — WebFetch; G-C11).
- [x] 13 design-before-build — PASS (reuse `BadUserRequestException`; ADR-0007 conformance; impact checklist; PO/SRE lens).
- [x] 14 Principal sufficiency — PASS (CI: **100% coverage on both changed files** ≥ the 98% gate; 3 meaningful tests; no control lost).
- [x] 15 test-change integrity (G-C15) — N/A (all 3 tests ADDED; no existing test changed — verified via `git diff`; `AdrControllerAdviceMappingScanTest` not touched → handler set unchanged).
- [x] 16 product critique (G-C16) — PASS (Option B chosen over the issue's Option A; divergence surfaced via scope comment + GATE-1, before code).
- [x] 17 — = 16.

### Quality Bar
- Gate 1 — PASS (reuses `BadUserRequestException`; no new component / no parallel copy) via git diff + grep.
- Gate 2 — N/A (code change, no doc alias).
- Gate 3 — N/A (no new caveat; the `policies.md` caveat stays accurate).
- Gate 4 — PASS via consumer-read of the 3 files: `BadUserRequestException(String, Object...)` → `super(ErrorCode.BAD_REQUEST, String.format(message, args))` (format-safe; `%` lands in the arg); `ControllerAdvice.handleBadRequest` `:27-31` `@ResponseStatus(BAD_REQUEST)` → 400/USR001/detail; `IllegalStateException` has no handler & is not a `ResponseStatusException` → `@ExceptionHandler(Exception.class)` `:94-99` → 500/SYS001 unchanged. `ErrorCode.BAD_REQUEST`=USR001.
- Gate 5 — N/A (no SDK builder in scope).
- Gate 6 — PASS (the changed error path is documented generically at `policies.md:310`; no new user-visible path needs doc coverage) via read.
- Gate 7 — N/A (no doc layout/SUMMARY change).
- Gate 8 — DEFERRED/N/A-for-code (PR is draft, not merged; docs routing:none = no live doc URL; milestone 0.29.0 → release-review owns any live verification).
- Gate 9 — PASS (claims trace to code; ADR taxonomy verified vs `ControllerAdvice`; CI green on the SHA) via read + WebFetch.
- Gate 10 — N/A (code change; the ADR is correctly homed in `adrs/drafts/`).
- Gate 11 — N/A (no `documentation/docs/**` file touched — routing:none; the ADR is an odd-team draft, not published).

### SUT image provenance (CTRIB-029 lesson — verified, not trusted)
The implementer's SUT `odd-team-sut-ctrib035` (digest `4d541a88`) VERIFIED to contain the fix: extracted `/app/classes` `PolicyJSONValidator.class` → references `BadUserRequestException` + literal `"Policy is not valid: %s"`; `PermissionServiceImpl.class` → `orElseThrow(...)Ljava/lang/IllegalStateException;` at the extractor site. Not the no-fix-image trap.

### Regressions — reviewer's OWN full confirmation regression (measured, not inferred; G-C2 serialized)
Built a FRESH independent SUT from `../odd-platform-ctrib035 @ a4a34e98` (`ODD_SUT=working`) → `odd-team-sut-revctrib035` digest `sha256:b568bac6`; ran all 4 buckets under the heavy-e2e flock (serialized behind ctrib037's live run; quiet box).
- **feature-complete: 315 passed / 3 failed / 1 skipped → GREEN-for-change.** The 3 failures are ALL change-independent co-active-stream specs asserting fixes ABSENT from the ctrib035 SUT: `dq-dashboard-runstatus-accounting` (IT-144/#1794) + `i18n-main-search-placeholder` es & ua (IT-143/#1776). The prior 2 flakes (`owner-association-triage` IT-106, `remove-user-owner-mapping`) PASSED on the quiet box — flake diagnosis confirmed. The change-relevant specs PASS: `permission-read-surface` H-001 (GET MANAGEMENT/{id}/permissions → 400 USR001 "does not have context"), H-002/H-003/corner; `rbac-frontend-affordance`; `cross-provider-admin-promotion`.
- **multi-stack: 9 passed** (incl. `rbac-policy-lifecycle` IT-124 F-006). **ingestion-e2e: 6 passed.**
- **known-bugs: 3 failed = the exact expected-RED pins** (IT-007 attachment LSN-001/PLT-086, IT-006 error-boundary F-042, IT-004 quality-dashboard PLT-052), **0 unexpected GREEN** (no un-flipped fix).
- The fix is statically inert on all e2e flows (it changes only invalid-policy-JSON→400 and missing-extractor-bean→500-unchanged; every extractor bean is wired in the SUT, so `getExtractor` never throws). **Unit bucket = CI on a4a34e98 = 580 passed / 0 failed / 150 suites, 100% changed-file coverage.**

### Other gates
- **Navigation**: consistent — no `navigation/domains/*` pointer references the changed files; a 2-line in-file edit moves nothing.
- **Banned-phrase check**: none used.
- **Upstream issues logged**: none new this review (PLT-246/247 already on disk from `/implement`).
- **Doc-product editorial findings** (audit ran per `playbooks/doc-product-editorial-read.md`):
  - **Coverage this run**: authorization subtree (`configuration-and-deployment/enable-security/authorization/**` — `policies.md` read end-to-end as the doc owner; siblings cross-link-checked) — the item-adjacent domain. Full-tree audit last ran comprehensively 2026-06-08 (DOC-336..439); queued for a future dedicated pass.
  - **Findings**: none surfaced this run. Verified non-finding: `policies.md:310` ("the platform returns an error rather than saving the policy") stays true and becomes a clean 400 under the fix; no per-endpoint status codes documented anywhere → no DOC item warranted.
- **Notes**: All claims VERIFIED via read/grep/WebFetch/own-regression. The scope comment (G-C16) is recorded in the ledger (issuecomment-4796326456) + evidenced by commit b963c30 ("scope comment posted", which precedes the fix) — WebFetch cannot isolate GitHub lazy-loaded comments, so NOT independently re-fetched, but the GATE-1 record + commit ordering corroborate it.
