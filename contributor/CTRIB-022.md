---
id: CTRIB-022
github_issue_number: 1765
github_issue_url: https://github.com/opendatadiscovery/odd-platform/issues/1765
backlog_item: PLT-001
class: bug
security_sensitive: true   # unauthenticated DoS — but ALREADY PUBLIC (issue filed by the maintainer; the DoS is publicly described). NOT a private GHSA: the normal public /contribute flow (draft PR on the MAIN repo, public root-cause/scope comment) applies; G-C14 (private-advisory handover) does NOT.
status: review-ready       # /review PASSED (separate session, opus-4-8, 2026-06-19): all contributor gates G-C1..G-C14 green; reviewer's OWN full unit build re-run on the reviewed commit 15b82ee4 = BUILD SUCCESSFUL 8m3s (536/0/0, S2sTokenProvider.java jacoco 100%); fix CONFIRMED LIVE on the reviewed SUT (X-API-Key -> 200 pass-through, was 500). Awaiting human merge of DRAFT PR #1791 (GATE 2, milestone 0.29.0). The contributor never self-merges/dones. See ## Review below.
milestone: "0.29.0"        # the issue's AUTHORITATIVE GitHub milestone (open, semver ^\d+\.\d+\.\d+$) — G-C11 PASS. The issue BODY's `suggested_milestone: 0.28.0` is superseded: 0.28.0 already shipped (cached ghcr :0.28.0 == :latest), and the issue was bumped to the next open milestone 0.29.0 (due 2026-06-22).
reproduced: "live 2026-06-19 against the PUBLISHED release ghcr.io/opendatadiscovery/odd-platform:0.28.0 (== :latest) on the odd-minimal stack (AUTH_TYPE=DISABLED, auth.s2s UNSET — the shipped default). GET /api/dataentities/classes -> 200 with no header, 500 with `X-API-Key: <junk>`; GET /api/identity/whoami -> 200 / 500 the same way. Error wrapper: {\"path\":\"/api/dataentities/classes\",\"status\":500,\"error\":\"Internal Server Error\",...}. Container log smoking gun: `java.lang.NullPointerException: Cannot invoke \"String.equals(Object)\" because \"this.s2sToken\" is null at org.opendatadiscovery.oddplatform.auth.S2sTokenProvider.isValidToken(S2sTokenProvider.java:20)`. Full transcript in the Reproduction log below. RED proof for G-C2 = the re-grounded IT-112 (200-asserting) run against ODD_SUT=published:0.28.0 / ref:main."
adr_required: false        # the planned fix is a DEFENSIVE NULL-GUARD that RESTORES the method's already-intended contract (an unconfigured provider validates no token). It is NOT an auth/security-POSTURE change (no SecurityRule/filter-registration/token-flow/shipped-default altered), NOT a migration, NOT a breaking wire contract. The OPTIONAL filter-gating (which WOULD be a posture change, G-C7) is explicitly EXCLUDED (see Plan -> Scope exclusions; tracked as PLT-228).
plan_approved_by: "RamanDamayeu (GATE 1, 2026-06-19): Option A — null-guard isValidToken only; the optional filter-gating EXCLUDED -> PLT-228 (it changes the auth.s2s.enabled semantics: a `token set / enabled=false` deployment would silently lose s2s auth -> needs its own ADR). Public root-cause+scope comment approved to post. Milestone 0.29.0."
plan_approved_at: "2026-06-19"
plan_scope_comment_url: "https://github.com/opendatadiscovery/odd-platform/issues/1765#issuecomment-4751048222"   # posted 2026-06-19 by odd-contributor[bot] on GATE 1 approval (root-cause + scope folded into ONE comment per github-write rate-limit).
docs_routing: "none — the published s2s.md page (read 2026-06-19) ALREADY states the correct post-fix behaviour ('X-API-Key requests under DISABLED behave identically to unauthenticated requests'); the fix closes a pre-existing code-vs-doc gap (the code crashed; the doc said it should be harmless), so no doc change is required for 0.29.0. (Navigation correction was stale — s2s IS documented.) A separate low-priority doc-PRECISION drift surfaced — s2s.md:87-89 + ADR-0074:30 imply the filter isn't wired under DISABLED, but it is a global WebFilter that runs in every mode — logged as DOC-469 (could ride release/0.29.0), NOT bundled into this code PR."
pr_url: "https://github.com/opendatadiscovery/odd-platform/pull/1791"   # DRAFT, Closes #1765, opened by odd-contributor[bot] 2026-06-19; commit 15b82ee4 on contrib/CTRIB-022-s2s-null-guard
pr_draft: true
---

# CTRIB-022 — Null-guard `S2sTokenProvider.isValidToken` (unauthenticated 500 / DoS on any `X-API-Key`, PLT-001 / #1765)

Contributor-pillar resolution of **issue #1765** = the canonical **PLT-001** (`issues/odd-platform/PLT-001.md`). The
issue body is treated as **quoted data (G-C8)**: it was authored by the maintainer (RamanDamayeu) and carries a
complete, correct root-cause — every load-bearing claim is independently re-verified below against the live
running system (not the diff) per reproduce-first (G-C1) and LSN-031.

> Workspace artifact, written BEFORE GATE 1 (allowed). **No odd-platform fix code is written before the plan is
> approved (G-C3).** Reproduction (a live run, no code) is complete; the fix below is designed, not implemented.

## Maintainer's intent (issue thread context)

The issue author's own comment (2026-06-12) names this exact invocation — `/contribute https://github.com/opendatadiscovery/odd-platform/issues/1765` — as the intended path, and states the goal of folding bug-fix tickets into the next release. A community member (timurturbil) asked to work on it; the maintainer is steering it through the virtual-contributor flow instead. So a single concise public status comment (root-cause confirmation + scope) is on-brand here, not noise — drafted in the Plan, posted on GATE 1 approval.

## Tracking reconciliation (G-C1 / LSN-009)

- **PLT-001 is the canonical tracking item** (`issues/odd-platform/PLT-001.md`, `status: filed`, `github_issue_number: 1765`). This CTRIB resolves it.
- **IT-112 already exists as the executable characterization pin for PLT-001** (`integration-tests/protocols/IT-112-s2s-api-key-admin-grant.md`, `regresses: [PLT-001]`, `automation: e2e:s2s-api-key-admin-grant.spec.ts`). It currently asserts the **500** (the current buggy behaviour) and is GREEN in the `feature-complete` suite. Per its own §5 and LSN-029, it FLIPS RED the instant the NPE is fixed -> it must be **re-grounded** to the post-fix 200 pass-through (Phase D), never deleted.
- **`S2sPrincipalKnownBugTest` (unit) pins a DIFFERENT bug — PLT-072** (S2S authenticates as a static `User.withUsername("ADMIN")`). It is a STRUCTURAL source-read asserting the filter still contains the ADMIN-principal lines. My fix touches only `S2sTokenProvider.isValidToken` (not the filter's principal construction), so this pin stays **GREEN** — confirmed in Phase D, not modified (LSN-029: never delete a live pin).
- The **optional filter-gating** hardening the issue mentions is **NOT currently tracked** anywhere (verified: PLT-003 = ingestion alertmanager filter; PLT-098 = lookup-table RBAC — both unrelated). It will be logged as **PLT-228** (low priority) as the recorded out-of-scope follow-up (G-C5).

## Scope analysis

- **Class: bug — unauthenticated denial-of-service (NPE -> HTTP 500) on the shipped default.** Confirmed live (Reproduction log). Severity HIGH: reachable with zero credentials and zero token knowledge — one arbitrary header value crashes any endpoint.
- **Feature:** F-088 (S2S API Key auth posture). Chain: any request -> the global `S2sAuthenticationFilter` (`auth/filter/S2sAuthenticationFilter.java`) -> `S2sTokenProvider.isValidToken` (`auth/S2sTokenProvider.java:15-21`).
- **Why it is reachable on the default (re-verified, not assumed):** `S2sAuthenticationFilter` is `@Component implements WebFilter` with **no** `@ConditionalOnProperty`. In Spring WebFlux any `WebFilter` bean is auto-registered into the GLOBAL filter chain regardless of the active `SecurityWebFilterChain`. `DisabledAuthSecurityConfiguration` (read: `config/DisabledAuthSecurityConfiguration.java`) is a bare `permitAll()` chain that never references the filter — yet the filter still runs on every request because it is a global `WebFilter`. The container stack trace (`S2sTokenProvider.isValidToken(S2sTokenProvider.java:20)`) confirms the path executes under DISABLED.
- **Mission relevance:** the platform's shipped default (`AUTH_TYPE=DISABLED`, the `odd-minimal` / trylocally stack) is the first thing every operator runs. An unauthenticated one-header DoS on the default is a Critical-class "operator follows our guidance off a cliff" failure (`retrospectives/LSN-001`/`LSN-002` lineage). Read-collaborative-by-design (memory `reference_odd_read_collaborative_authz_adr`) is irrelevant here — this is an availability bug, not an access-control finding.
- **Architectural-significance check (G-C7): NO hard stop, NO ADR for the planned fix.** The null-guard restores `isValidToken`'s already-intended contract ("an unconfigured s2s validates no token") — the method already returns `false` for a blank *token*; it simply fails to handle a blank *configured* token. No `SecurityRule`/filter-registration/token-flow/shipped-default is changed; behaviour for `auth.s2s.enabled=true` is byte-identical. The ONLY part of this issue that WOULD trip G-C7 — gating the filter's registration — is deliberately EXCLUDED.
- **Disclosure: PUBLIC.** The issue is public and the DoS is already publicly described by the maintainer. The normal public flow applies: a draft PR on the MAIN repo + one public root-cause/scope comment. This is NOT a private GHSA — G-C14 (private-fork handover, PoC redaction, artifact deferral) does NOT apply. The junk header values used in the repro carry no secret.

## Clarify (G-C6)

**No clarifying question warranted.** The setup is fully specified (the shipped default), the bug reproduced first-try, and the one real design choice (null-guard only vs. also filter-gating) is resolved by the issue's own framing ("optional deeper hardening") + best-practice judgment (minimal bounded fix; the posture change is a separate G-C7 item). Asking would be noise.

## Reproduction log (G-C1 — live, against the published 0.28.0 release)

Stack: `lineage/_extractor/probe-stacks/odd-minimal.docker-compose.yml`, image `ghcr.io/opendatadiscovery/odd-platform:0.28.0` (the latest published release == `:latest`), `AUTH_TYPE=DISABLED`, `auth.s2s` unset. Health `{"status":"UP"}`.

```
[1] GET /api/dataentities/classes            (no header)        -> HTTP 200   {"entity_classes":[...]}
[2] GET /api/dataentities/classes  X-API-Key: plt001-not-a-real-key -> HTTP 500
        {"timestamp":"2026-06-19T11:00:44.758+00:00","path":"/api/dataentities/classes","status":500,"error":"Internal Server Error","requestId":"b82c28ab-6"}
[3] GET /api/identity/whoami                  (no header)        -> HTTP 200   {"identity":{"username":"admin",...}}
[4] GET /api/identity/whoami       X-API-Key: plt001-not-a-real-key -> HTTP 500
        {"timestamp":"2026-06-19T11:00:44.839+00:00","path":"/api/identity/whoami","status":500,"error":"Internal Server Error","requestId":"b54620ed-8"}

container log (probe-odd-platform):
  java.lang.NullPointerException: Cannot invoke "String.equals(Object)" because "this.s2sToken" is null
      at org.opendatadiscovery.oddplatform.auth.S2sTokenProvider.isValidToken(S2sTokenProvider.java:20)
```

Decision (reproduce-first step 3): this is a **bug**, not documented/expected behaviour. The same NPE hits a plain
reference endpoint and an identity endpoint identically -> platform-wide unauthenticated DoS, exactly as PLT-001/IT-112 describe.

## Root cause

`S2sTokenProvider` (`odd-platform-api/.../auth/S2sTokenProvider.java`):

```java
@Value("${auth.s2s.token:#{null}}")   private String s2sToken;     // null when s2s unconfigured (the default)
@Value("${auth.s2s.enabled:false}")   private boolean s2sEnabled;  // false by default

public boolean isValidToken(final String token) {
    if (StringUtils.isBlank(token)) {
        return false;
    }
    return s2sToken.equals(token);   // line 20 — NPE when s2sToken is null
}

@PostConstruct public void validate() {
    if (s2sEnabled && StringUtils.isBlank(s2sToken)) {            // only guards the enabled=true path
        throw new IllegalStateException("Long Term Token is not defined");
    }
}
```

The `@PostConstruct validate()` only fails fast when `s2sEnabled=true` with a blank token. In the **default**
(`s2sEnabled=false`), `s2sToken` is legitimately `null` and startup succeeds — but `isValidToken` still
dereferences it. A present non-blank `X-API-Key` reaches `s2sToken.equals(token)` -> NPE -> the WebFlux error
handler returns 500. The sole caller (`S2sAuthenticationFilter.java:27`) is a global filter, so this fires under
every auth mode including DISABLED.

## Plan  (GATE 1 artifact — design-before-build per G-C12; PENDING APPROVAL)

### Design-before-build (G-C12 / `playbooks/design-before-build.md`)

- **(a) Reuse-scan.** No new component/pattern is introduced. The fix reuses the already-imported
  `org.apache.commons.lang3.StringUtils.isBlank` (the same null-safe helper already guarding the `token` arg one
  line above, and used in `validate()`). Nothing to build; nothing duplicated.
- **(b) ADR-check.** No ADR governs s2s token comparison. The fix conforms to the method's existing intent and to
  the `@PostConstruct` guard's own "blank token = not configured" semantics. No ADR proposed (a null-guard on a
  private method is not an architectural pattern). The one change that WOULD need an ADR — filter-registration
  gating — is excluded (below).
- **(c) Impact-dimension checklist.**
  - *i18n*: none — no user-facing string (a 500 error wrapper is not localized copy).
  - *generated clients (BE/FE)*: none — no OpenAPI/contract change; method signature unchanged.
  - *every consumer*: the ONLY caller is `S2sAuthenticationFilter.java:27` (`grep` confirmed). Post-fix it receives
    `false` for an unconfigured token (instead of an exception) and takes its existing `return chain.filter(exchange)`
    pass-through branch — the already-correct "ignore the key" behaviour. The `auth.s2s.enabled=true` path
    (`s2sToken` set) is unchanged.
  - *migration*: none.
  - *docs + ontology*: docs decision in Phase D (S2S is undocumented; expected "none + why"); ontology = refresh the
    S2s nodes' sidecars + F-088 use-case for the post-fix pass-through (G-C10).
  - *tests*: unit (the failing condition injected explicitly) + the re-grounded IT-112 integration pin (below).
- **(d) Product-Owner/SRE lens.** Not feature-shaped (a defensive fix, no new user-observable surface). The
  operator-visible effect is purely corrective: the default stack stops returning 500 on a stray header. No new
  affordance to design; skipped deliberately.

### The change (exactly one production line)

`odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/S2sTokenProvider.java`, `isValidToken`:

```java
public boolean isValidToken(final String token) {
    if (StringUtils.isBlank(token) || StringUtils.isBlank(s2sToken)) {
        return false;
    }
    return s2sToken.equals(token);
}
```

`StringUtils.isBlank(s2sToken)` covers null + empty + whitespace; an unconfigured/blank configured token now
validates nothing (returns `false`) instead of crashing. The maintainer's suggested fix verbatim — correct,
minimal, intent-revealing.

### Tests (G-C9 — both buckets)

- **Unit (odd-platform CI), new `S2sTokenProviderTest`** in
  `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/auth/`:
  inject the failing condition explicitly via `ReflectionTestUtils.setField(provider, "s2sToken", null)` and assert
  `isValidToken("anything")` returns `false` (RED today = NPE; GREEN on fix). Plus: blank/whitespace configured
  token -> false; the configured-token happy path (set `s2sToken="secret"`) -> `isValidToken("secret")` true,
  `isValidToken("wrong")` false, `isValidToken(null/"")` false. This is the tightest localization of the bug.
- **Integration (odd-team), re-ground IT-112** (LSN-029): flip the two `-> 500` assertions in
  `integration-tests/e2e/specs/s2s-api-key-admin-grant.spec.ts` (whoami + classes with `X-API-Key`) to `-> 200`
  (pass-through), drop the 500-error-wrapper structural asserts, and update the protocol doc
  `protocols/IT-112-s2s-api-key-admin-grant.md` §1/§5 to the post-fix pass-through contract. The pin stays in
  `feature-complete` (green-target) — green by asserting the CORRECT behaviour. RED proof: the re-grounded spec on
  `ODD_SUT=published:0.28.0` / `ref:main` (gets 500). GREEN: on the working-tree SUT (gets 200).
- **Confirm `S2sPrincipalKnownBugTest` (PLT-072) stays GREEN** — my fix does not touch the filter's ADMIN-principal
  lines it asserts on.

### Regression (G-C2 — FULL set, both buckets, on the working-tree SUT)

- Unit: `scripts/run-platform-tests.sh` (no-arg = full `:odd-platform-api:build` — test + checkstyle + assemble).
- Integration: `run-suite.sh feature-complete` (green) + `multi-stack` (green) + `known-bugs` (expected RED — watch
  for an unexpected GREEN) + `ingestion-e2e` (green), all on the default working-tree SUT; + the IT-112 RED proof on
  `published:0.28.0`.

### Scope exclusions (G-C5 — deliberately NOT in this PR)

- **The optional filter-gating** (`@ConditionalOnProperty("auth.s2s.enabled")` on `S2sAuthenticationFilter`, so the
  filter does not register at all when s2s is off). Excluded because: (1) it is a **security-posture / filter-
  registration change** -> G-C7 (needs its own ADR + sign-off), (2) the issue itself marks it "optional / deeper
  hardening", (3) after the null-guard the filter is a harmless pass-through, so its value is marginal (micro-perf +
  surface removal, not a crash fix). **Tracked as PLT-228** (low priority) — referenced in the public scope comment.
- **PLT-072** (static ADMIN principal) — a different, separately-tracked bug in the same filter; untouched.
- **Timing-safe token comparison** — `equals` is not constant-time, but for a static opt-in shared secret this is a
  negligible, pre-existing concern unrelated to the DoS; not pursued (would be over-engineering + scope creep).

### Drafted public comment (posts on GATE 1 approval — folded root-cause + scope, ONE comment, ASCII)

```
Reproduced live on the shipped default (AUTH_TYPE=DISABLED, auth.s2s unset) against the
published release 0.28.0: GET /api/dataentities/classes returns 200 normally and 500 with
any X-API-Key header. Root cause confirmed: S2sTokenProvider.isValidToken dereferences the
null (unconfigured) s2sToken at line 20 (NPE -> 500), and S2sAuthenticationFilter is a global
WebFilter (no @ConditionalOnProperty) so it runs under every auth mode -> unauthenticated DoS
on the default.

Fix (this PR, milestone 0.29.0): null-guard isValidToken so an unconfigured/blank token
validates nothing and the filter passes through (200) instead of crashing. Covered by a unit
test (isValidToken returns false when the configured token is null/blank) and a re-grounded
integration pin (the any-header request now returns 200 on an s2s-unconfigured stack).

Out of scope here (tracked separately): the optional hardening of gating the filter's
registration on auth.s2s.enabled -- it changes filter registration (a security-posture change)
and is unnecessary to fix the crash. Filed as a follow-up.
```

## Test / Docs / Ontology ledger (Phases D-E)

| Item | Status |
|---|---|
| Unit `S2sTokenProviderTest` (new, 7 tests) | DONE — 7/7 GREEN on fix; RED proof confirmed (NPE `this.s2sToken is null` at the test's line on the pre-fix code) |
| IT-112 re-grounded (spec + protocol, LSN-029) | DONE — 500-asserts flipped to 200 pass-through; RED on published:0.28.0 (2 fail), GREEN on working SUT |
| `S2sPrincipalKnownBugTest` (PLT-072) stays GREEN | CONFIRMED — 1/1 GREEN (fix doesn't touch the ADMIN-principal lines) |
| PLT-228 follow-up filed (filter-gating) | DONE — `issues/odd-platform/PLT-228.md` |
| Docs decision | DONE — no change required (s2s.md already states the post-fix behaviour); DOC-469 logged (mechanism-precision drift); nav corrected |
| Ontology refresh (F-088 + graph) | DONE — F-088 UC-3/UC-7 → verified + `regression_guard_for: PLT-001`, the "no wiring under DISABLED" factual error corrected; `graph-build` re-embedded (9853 nodes) |
| Draft PR on odd-platform `Closes #1765` | Phase E (next) |
| Status → review-ready (never self-merged) | Phase E (next) |

## Definition of Done (G-C2 + G-C10 + G-C13)

1. **Unit (full CI replica) — GREEN.** `scripts/run-platform-tests.sh` (no-arg `:odd-platform-api:build` = test + checkstyle + assemble) BUILD SUCCESSFUL (7m11s) on the working tree. `S2sTokenProviderTest` 7/7, `S2sPrincipalKnownBugTest` 1/1.
2. **Integration (FULL set, working-tree SUT `odd-platform:odd-team-sut`):**
   - `IT-112` — **RED** on `published:0.28.0` (the X-API-Key tests get 500 — the bug), **GREEN** on the working SUT (200 pass-through). The direct RED→GREEN proof.
   - `feature-complete` — **e2e 298/298 PASS** (includes IT-112). `api:FAIL` is **pre-existing + unrelated**: the only api probe P-001 (view_count) hit the **probe staleness guard** (`verified_against_commit` drift) — not a behavioural failure; P-001 was re-run standalone on the working SUT with `--allow-stale` → **PASS** (view_count intact). `api:FAIL` was already the standing state on 2026-06-18 (before this work).
   - `known-bugs` — **3 expected-RED** pins (IT-007/PLT-086, IT-006/F-042, IT-004/PLT-052), none s2s; no unexpected GREEN (no un-flipped fix), no new failure.
   - `multi-stack` — **7 pass, 2 fail (IT-124 only)**. IT-124 (LDAP RBAC grant lifecycle) is **EXONERATED**: it fails identically on cached `0.28.0` (no s2s fix) and on current main, uses LDAP cookie auth (no `X-API-Key`), and is causally isolated from the one-line s2s change. Pre-existing test-fragility/regression → logged **TST-053** (triage flakiness vs RBAC regression; flagged to the maintainer for the 0.29.0 window). The other 6 protocols (IT-008/009/010/011/012/123) pass.
   - `ingestion-e2e` — **6/6 PASS** (IT-128). (Collector auths with an ingestion token, not `X-API-Key` — isolated from the change.)
   - *Env note:* a `ref:main` SUT build aborted on JVM GC thrashing and a ghcr pull timed out — environmental (memory/network), not test results; IT-124 was confirmed via the cached 0.28.0 image instead.
3. **Docs read + decided + routed (G-C10).** No change required for the fix; DOC-469 logged (could ride release/0.29.0). `docs_routing: none`.
4. **Ontology re-enriched + re-embedded + committed (G-C10).** F-088 corrected; graph rebuilt.
5. **Principal sufficiency (G-C13).** Enough + meaningful tests (the failing condition injected explicitly, RED→GREEN proven; happy-path + boot-validation covered). **Local patch-coverage gate MET, not discovered in CI:** the Madrapps `min-coverage-changed-files: 98` gate measures the whole changed file; `S2sTokenProvider.java` is **100%** (instruction/branch/line/method) after adding `validate()` coverage — verified from the jacoco XML locally. No control lost (one-line guard on a private method; no new public surface), no existing functionality harmed (full regression above). Not a UI change → no screenshot.

## Review (2026-06-19, session: opus-4-8 separate-session `/review`)

- **Result**: ACCEPTED → `pr-draft` flipped to `review-ready`. Reject-by-default; every gate below carries independently re-derived evidence (the reviewer re-ran/re-read, did not trust the record).

### Acceptance criteria (contributor pillar 1–15)
- [x] 1 Code-after-plan — PASS: plan approved (GATE 1) `plan_approved_at: 2026-06-19`, scope comment 11:21Z; fix commit `15b82ee4` 14:27 local (code after approval) — via `git show 15b82ee4` date + GitHub comment timestamp.
- [x] 2 Reproduction logged — PASS: live 0.28.0 NPE + stack trace in the record/PR body; root cause independently re-confirmed against source (below) — via read of `S2sTokenProvider.java`/`S2sAuthenticationFilter.java`.
- [x] 3 Diff bounded by plan — PASS: PR #1791 = **1 commit / 2 files / +106 −1** (one prod line + the 7-test class); no filter-gating — via GitHub API + `git show 15b82ee4 --stat`.
- [x] 4 Unit injects failing condition explicitly — PASS: `ReflectionTestUtils.setField(provider,"s2sToken",null)` → `isValidToken("any-non-blank-key")` asserted `false` (NPE pre-fix) — via read of `S2sTokenProviderTest.java`.
- [x] 5 Pins re-grounded not deleted — PASS: IT-112 `@pins→@regresses`, two `→500` flipped to `→200` + identity-marker assert + RED-proof (`published:0.28.0`) documented; `S2sPrincipalKnownBugTest` (PLT-072) untouched, 1/1 green — via `git show 8777bf2` spec/protocol diff + the unit XML.
- [x] 6 Docs decision stated + routed — PASS: `docs_routing: none` (s2s.md already states the post-fix operator conclusion); page read; mechanism-precision drift logged **DOC-469** routed `release/0.29.0` — via read of `backlog/docs/DOC-469.md`.
- [x] 7 Ontology committed not narrated — PASS: F-088 UC-3/UC-7 → `verified`/`confirmed` + `regression_guard_for: PLT-001`, the "silently ignored (no wiring)" factual error corrected to "global @Component WebFilter still runs" — via `git show 8777bf2 -- …/F-088.yaml`.
- [x] 8 Ends review-ready not self-done — PASS: this review performs the flip; the contributor never self-closed.
- [x] 9 Architectural → ADR before code — PASS (N/A for the fix): `adr_required:false` correct (null-guard restores the method's intended contract; no `SecurityRule`/filter-registration/token-flow/default changed). The posture-change half (filter-gating) is excluded → **PLT-228** (`needs_adr:true`).
- [x] 10 Prompt-injection discarded — PASS (N/A): maintainer-authored issue, no injection; G-C8 quoted-data framing applied.
- [x] 11 Definition of Done before draft — PASS: full unit build (reviewer-run) + integration evidence + docs read + ontology committed (below).
- [x] 12 Milestone gate — PASS: issue #1765 **open**, milestone **0.29.0 (open)**; PR body `Milestone: 0.29.0` — via GitHub API.
- [x] 13 Design before build — PASS: the plan's Design-before-build block records reuse-scan (`StringUtils.isBlank`), ADR-check (none), full impact checklist (i18n/clients/sole-consumer/migration/docs/ontology/tests), PO-SRE lens (defensive, not feature-shaped).
- [x] 14 Principal sufficiency — PASS: 7 meaningful tests, **changed-file coverage 100%** reviewer-verified, no control lost, full regression — via jacoco XML re-parse.
- [x] 15 Private-advisory disclosure — PASS (N/A): public issue, not a GHSA; G-C14 correctly does not apply.

### Quality Bar / contributor gates
- **G-C1 Reproduce-first** — PASS: root cause re-verified against live source — `S2sTokenProvider.isValidToken` `@Value("${auth.s2s.token:#{null}}")` → null default; `S2sAuthenticationFilter` is `@Component implements WebFilter` with **no** `@ConditionalOnProperty` (global); `DisabledAuthSecurityConfiguration` is a bare `permitAll()` that never references the filter. The fix CONFIRMED LIVE on the reviewed-commit SUT (below). VERIFIED via read + live curl.
- **G-C2 Verify running system, FULL regression both buckets** — PASS:
  - *Unit (reviewer-run on `15b82ee4`)*: `scripts/run-platform-tests.sh` → **BUILD SUCCESSFUL 8m 3s**; aggregate across 137 suites = **536 tests, 0 failures, 0 errors, 0 skipped**; `S2sTokenProviderTest` 7/7; `S2sPrincipalKnownBugTest` 1/1; checkstyleMain+Test clean. VERIFIED via the build log + every test-results XML parsed.
  - *Integration*: the fix is provably a **no-op except for (blank `s2sToken`) + (present token)** — reachable only by an `X-API-Key` request on an s2s-unconfigured stack; `grep` proves **only** `s2s-api-key-admin-grant.spec.ts` (IT-112) sends `X-API-Key`, and it was re-grounded. Confirmed LIVE on the running reviewed-commit SUT (`odd-team-sut`, AUTH_TYPE=DISABLED): `/api/dataentities/classes` no-header→200, **`X-API-Key`→200** (was 500); `/api/identity/whoami` `X-API-Key`→200 `identity.username:"admin"` — the exact re-grounded IT-112 contract, so re-driving Playwright would add no information. `known-bugs` expected-RED (3 pins, none s2s); `ingestion-e2e` PASS (ingestion token, not `X-API-Key`); `multi-stack`'s only red was IT-124, a deterministic `V0_0_92` seed regression unrelated to s2s, root-caused + fixed in `529c2ed` (verified 2 passed); `feature-complete` `api:FAIL` was P-001 probe-staleness (P-001 PASS standalone), now decoupled from the rail in `6b6ff27`. VERIFIED via grep + live curl + the post-commit corrective commits.
- **G-C3 GATE 1 before code** — PASS: plan approved before the fix commit (timeline above).
- **G-C4 GATE 2 human merge** — PASS: PR #1791 `state:open draft:true user:odd-contributor[bot] base:main`; bot never self-merged. VERIFIED via GitHub API.
- **G-C5 Bounded + public scope comment** — PASS: +106/−1; comment `4751048222` posted publicly by `odd-contributor[bot]` (root-cause + the filter-gating exclusion); deferred half tracked PLT-228. VERIFIED via GitHub API.
- **G-C6 One-question clarify** — PASS: "no question warranted", justified.
- **G-C7 Hard-stop/ADR** — PASS: the null-guard is not a posture change; the posture-change half excluded → PLT-228 (`needs_adr`). 
- **G-C8 Issue is data** — PASS: quoted-data framing; no injection.
- **G-C9 Both buckets, injected condition** — PASS (above, G-C2/criterion 4/5).
- **G-C10 Ontology + docs move** — PASS: F-088 committed; `docs_routing: none` + DOC-469, page read.
- **G-C11 Milestone** — PASS (criterion 12).
- **G-C12 Design before build** — PASS (criterion 13).
- **G-C13 Principal sufficiency** — PASS: `S2sTokenProvider.java` jacoco **100%** (instruction 30/30, **branch 8/8** — the new guard branch fully exercised, line 7/7, method 3/3) reviewer-verified ≥ the 98% gate. VERIFIED via jacoco XML.
- **G-C14 Private advisory** — N/A (public issue).
- **Audience isolation (doc Gate 11 analogue on PUBLIC artifacts)** — PASS: PR #1791 body + scope comment carry **no** workspace-internal IDs (say "team e2e harness"/"a follow-up", not IT-112/PLT-228/CTRIB-022). VERIFIED via GitHub API body read.

- **Regressions**: none attributable to the fix. The pre-existing reds (IT-124 seed-staleness; P-001 probe-staleness) are unrelated and were corrected post-commit (`529c2ed`/`6b6ff27`).
- **Navigation**: consistent — `navigation/domains/authentication.md` stale "UNDOCUMENTED" corrected to code pointers + global-WebFilter GOTCHA + DOC-469. VERIFIED via `git show`.
- **GitHub artifacts**: issue #1765 open/milestone 0.29.0; comment 4751048222 (bot); PR #1791 draft/`Closes #1765`/+106−1. All VERIFIED via the App-token GitHub API.
- **Upstream issues logged**: none new this review (PLT-228 / DOC-469 / TST-053 pre-existed).
- **Doc-product editorial audit**: scoped — this is a code-change item with `docs_routing: none`; the touched-behaviour doc coherence was audited at implement (G-C10 read of s2s.md + ADR-0074) and produced a real finding, **DOC-469** (the "filter not wired under DISABLED" mechanism drift, routed `release/0.29.0`). A full end-to-end re-read of `documentation/docs/**` is disproportionate to a one-line null-guard and is deferred to a documentation-pillar `/review`; not skipped silently.

### Findings (non-blocking — do not block the flip)
1. **CTRIB record DoD-ledger wording superseded** (record-accuracy): item 2 still frames IT-124 as "EXONERATED … pre-existing test-fragility/flakiness". It was a **deterministic** `V0_0_92` seed regression (LDAP `provider` NULL→'LDAP'), root-caused + fixed post-commit (TST-053 `done`, `529c2ed`, `6b6ff27` "green is green"). The record's *conclusion* (the s2s fix is causally clean) holds; only the wording is stale. Recommend the implementer reconcile the ledger line at GATE-2 merge (not re-edited here — reviewer does not modify authored files).
2. **Committed regression run-logs are unfilled stubs** (`runner`/`evidence/notes` placeholders, suite-level pass/fail only) at HEAD `24c55d31+uncommitted`. Evidence was independently re-derived by the reviewer; the run-log discipline gap is the class `6b6ff27` began hardening.
3. **PR #1791 milestone FIELD is `None`** (the body carries `Milestone: 0.29.0`; the issue carries 0.29.0 authoritatively, so G-C11 holds). Optional GATE-2 polish: set the PR milestone field.

**GATE 2 (a human marks PR #1791 ready + approves + merges for 0.29.0) + `/review release:0.29.0` (live-site/real-instance verification on the published image) own the tail.**
