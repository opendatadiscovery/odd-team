# User-facing verification sweep — 2026-06-10

**Trigger:** maintainer falsified PLT-167's headline UI claim in minutes ("a lie that is easy to check") — second instance of the PLT-176 class (UI claim authored from BE-only analysis). Maintainer ordered a sweep of the whole unverified corpus.

**Scope:** all `issues/odd-platform/PLT-*.md` with `user_facing_verified: false`, excluding `status: rejected` and `status: filed-security-advisory` → **193 drafts** (4 critical / ~95 high / 77 medium / rest low or unset). Groups: `state/sweeps/2026-06-10-groups.json` (29 groups of ≤7, severity-first).

**Method:** per `playbooks/user-facing-verification.md` adapted to a static cross-system trace (no live stack in the sweep): every user-facing claim in a draft is traced through the REAL frontend + backend code with the explicit goal of falsifying it (PLT-176/PLT-167 class: FE transforms/contradicts what BE-only analysis predicts). No mass flag-flipping: `user_facing_verified: true` is set ONLY where every load-bearing user-facing claim is a pure code-structure fact fully settled by the trace (render path exists/absent, FE de-dup/transform, button not rendered). Claims that need a live drive keep `false`, with the static trace recorded in `## User-facing impact` and the precise remaining runtime check named.

**Verdicts:** `confirmed-static` (claims hold; section added/upgraded with citations) · `corrected` (one or more claims falsified; draft rewritten, severity regraded) · `runtime-only` (cannot be settled statically; remaining check named) · `mixed` · `REJECT-CANDIDATE` (whole defect collapses; maintainer-reviewed before any status flip).

**Agent rules:** edit only assigned issue files; odd-platform repo is read-only; no commits; no new files; no services started; citations re-verified against the real files (never trusted from the draft); ASCII-only bodies; YAML frontmatter must stay parseable; `status` / `github_*` fields untouched; severity changed only when the stated rationale collapses or strengthens, with one-line justification.

**Gate (per wave):** mechanical — YAML parse + ASCII check + `## User-facing impact` present + flag value legal on every touched file; spot-read of at least one correction per wave against the cited source; commit per wave.

## Progress

| Wave | Groups | Issues | confirmed-static | corrected | runtime-only/mixed | reject-cand | gate |
|---|---|---|---|---|---|---|---|
| 1 | G01-G06 | 42 | 7 | 9 | 25 | 1 (PLT-005) | PASS (42/42 YAML+ASCII+section+flag) |
| 2 | G07-G12 | 42 | 17 | 18 | 4 | 3 (PLT-011,022,126) +1 dup (PLT-144) | PASS (42/42) |
| 3 | G13-G18 | 42 | 22 | 16 | 4 | 4 (PLT-006 FIXED, 034, 157, 207) +1 dup (PLT-103) | PASS (42/42) |

## Cross-cutting findings (for maintainer triage — NOT auto-filed)

- **Dead error-toasts platform-wide** (from G06 PLT-128/PLT-163): `errorHandling.tsx:48-68` x `runtime.ts` ResponseError wrapper — `showServerErrorToast`/`getErrorResponse` expect a raw `Response` but the generated client throws a `ResponseError` wrapper nothing unwraps (`.response`). Net: UI error toasts are dead for every redux-thunk AND react-query mutation error path, not just ConfirmationDialog. Candidate for its own class-level PLT. Folded into PLT-128/PLT-163 fix scope; not filed separately.
- **jOOQ precedence is NOT a bug** (G01 PLT-005, REJECT-CANDIDATE): the `.or()/.and()` "SQL precedence" defect family does not exist — jOOQ combines the whole accumulated condition correctly (proven by javap+jshell render). Any other draft asserting a jOOQ `.or().and()` precedence bug (PLT-083 mentions the same pattern) must be re-checked against this.
- **Global ControllerAdvice maps NotFound->404** (G03): a single `@RestControllerAdvice` (NotFound->404, BadUserRequest->400, catch-all->500) falsifies any "no @ExceptionHandler on controller X => 5xx" reasoning. Re-check such claims corpus-wide.
- **Live docs were MORE accurate than drafts** (G04 PLT-061/078/089): several drafts were the stale artefact; the published operator caveats already had the correct masking/permission-name/wedge behaviour.
- **Confirmed duplicates to reconcile before filing:** PLT-103 == PLT-078 (both /actuator/env, values masked — PLT-078 is the fuller writeup); PLT-054 == PLT-099 (both /api/slack/events HMAC absence — consolidate on one PR); PLT-144 == PLT-021 (RUNNING wire-enum 500). PLT-106 overlaps PLT-003 (alertmanager no-auth) + PLT-044 (stats cross-dataset); PLT-035 overlaps PLT-054/099 dedup.
- **PLT-006 already FIXED on main** (CTRIB-002 / PR #1747, commit fbb2eb43) — the contributor flow shipped the null-namespace fix + a regression test; draft is a closeable reject-candidate. A draft tracking an already-fixed bug is its own staleness class.
- **Soft-delete-aware partial unique index** (owner/role/tag/title/collector, WHERE deleted_at IS NULL) is a deliberate, repeated convention (falsified PLT-207) — a candidate implicit-ADR datum, not a bug.

## Verdict log

### Wave 1 (G01-G06)

corrected/falsified (the PLT-167 class — UI/severity claims that did not survive the trace):
- PLT-005 high->low REJECT-CAND — jOOQ precedence bug does not exist (no data loss).
- PLT-059 critical->medium — "silent failure" + XSS + dead-cache claims falsified; toast IS shown.
- PLT-014 high (mixed) — "UI stored-XSS" + "duplicate rows on retry" falsified (React-escaped; partial unique index blocks dup); forge defect survives.
- PLT-015 high->medium — webhook generatorURL is a URI rejecting mrkdwn; real vector is collector taskRunName; MrkdwnUtils already exists.
- PLT-058 critical (mixed) — fake-500 shows while LOADING (real errors swallowed); 50-col cap is badge-vs-list not false "more pages".
- PLT-056 critical (mixed) — "cross-tenant oracle" + "SDK 404" falsified; Target-column-renders-Source survives as the critical.
- PLT-027 high->medium — INVERTED: the 30-day DELETED purge DOES fire; dead guard only affects unread non-DELETE staleness.
- PLT-045 high->medium — "unknown datasource->5xx" falsified (global advice ->404); dup-ODDRN + oversized survive.
- PLT-078 high->medium — show-values=NEVER masks /actuator/env; credential-leak rationale collapsed.
- PLT-122 high->low — onboarding form IS auto-rendered on the landing page; "silently-empty broken" collapses.
- PLT-128 high->medium — modal does NOT stick; delete fails silently looking like success (no toast).
- PLT-155 high->medium — uppercase SMTP can NEVER silently send cleartext (loud NoSuchProviderException); real defect is WAL-loop poisoning.
- PLT-153 high->medium — "dead thread keeps leader lock" falsified (lock is scope-released); silent no-restart survives.
- PLT-093 high (mixed) — NaN id ->400->AppErrorPage, not "silent broken view"; reflection leak survives.
- PLT-120 high (mixed) — unique-index "at-most-one null" misread (PG NULL-distinct); provider=null collapse survives.
- PLT-090 high (mixed) — fabricated tsQuery signature; persistent vector is PUT not POST; injection survives.
- PLT-061/PLT-029/PLT-019/PLT-023/PLT-074/PLT-083/PLT-141 — citation/scope corrections; core defects survive.

confirmed-static (held under trace, section+citations added): PLT-004, PLT-012, PLT-020, PLT-042, PLT-051, PLT-055, PLT-089, PLT-105, PLT-121, PLT-154.
flag->true (code-settled or runtime-backed): PLT-003, PLT-005, PLT-021, PLT-027, PLT-028, PLT-051, PLT-055, PLT-085, PLT-121, PLT-128, PLT-139, PLT-141, PLT-153, PLT-163.

### Wave 2 (G07-G12)

reject-candidates / fully falsified:
- PLT-011 medium->low REJECT-CAND — i18next prepends active lang then walks fallback with `en` FIRST; missing keys resolve to English, never another locale. No user bug.
- PLT-022 high->low REJECT-CAND — `exclude_from_search` is an ingestion-set DEG-member signal with NO operator toggle; list surfaces omitting it is largely intended; live docs already document it. Premise (operator hides entity) false.
- PLT-126 high->low REJECT-CAND — commons-lang3 3.18.0 `randomAlphanumeric` delegates to SecureRandom (proven by javap); token IS CSPRNG. security_sensitive->false.
- PLT-144 high (dup of PLT-021) — real defect, but PLT-021 already owns the endpoint+IT-059 evidence; banner added, do not file separately.

corrected (claim/severity falsified, defect survives):
- PLT-052 high->medium — "out-of-enum TypeError blanks page" falsified (BE coerces unknown->UNKNOWN, FE enum closed); surviving defect is the tests-by-latest-run mislabel.
- PLT-140 high->low — "reverse-lookup 500/405" + "silent truncation past 50" both falsified (separate /linked_terms path; FE recomputes hasNext); only a BE pageInfo contract wart remains.
- PLT-067 high->medium — defence-in-depth/perf, draft itself says today's code is correct (no present leak).
- PLT-075 high->medium — "no platform.base-url exists" grep claim false (property exists, 3 consumers); multi-precondition runtime-only.
- PLT-013/030/033/064/065/025/026/044/040/097/098/100/101/102/106/108/124/145/147/148/151/152/002/016/031/165 — citation/scope/mechanism corrections; core defects survive (many fabricated SQL/line cites fixed).

confirmed-static held: PLT-026, PLT-040, PLT-044, PLT-080, PLT-086, PLT-098, PLT-101, PLT-102, PLT-104(probe P-004), PLT-127(IT-003), PLT-145(IT-048), PLT-147(IT-068), PLT-148(IT-105), PLT-152(IT-009).
flag->true wave 2: 33 of 42 (RBAC wiring facts code-settled; observ. auth-mode-labelled). Stayed false: PLT-011,013,016,030(mixed mechanism),033... (runtime/mixed) — see per-draft.

### Wave 3 (G13-G18)

reject-candidates / fully falsified:
- PLT-006 high (FIXED ON MAIN) — null-namespace term-overview crash fixed by CTRIB-002/#1747 (commit fbb2eb43; re-read source to confirm, not the commit msg). Closeable.
- PLT-034 medium->low REJECT-CAND — premise inverted: WithPermissions IS a synchronous render-gate (`WithPermissions.tsx:28` returns null on no-perm), not a context provider with a flash window. No defect.
- PLT-157 high->low REJECT-CAND — "surviving audit rows hidden behind inner join" doesn't exist; the hard-delete (TTL purge) deletes activity rows in the same txn before the entity, none stranded. Source reflection F-021 made the same untraced cascade assumption.
- PLT-207 high->low REJECT-CAND — the proposed partial unique index already exists since V0_0_31; recreate-by-name already works. Drafted from the birth migration, ignoring 8 later collector migrations.

corrected (UI claim/severity falsified, defect survives):
- PLT-103 high->medium — /actuator/env masks all values (show-values=NEVER); "JDBC/LDAP/Slack verbatim leak" false; duplicate of PLT-078; residual is config-KEY recon.
- PLT-166 high->low — bare /management/integrations inherits the PARENT provider, not the sibling; no control in the subtree uses hasAccessTo yet — harm is prospective.
- PLT-168 high->medium — skeleton DOES reserve hero/tags/info-bar space; "unbounded CLS" rescoped to a bounded post-skeleton shift; magnitude runtime-only.
- PLT-164 high->medium — Title is a descriptive label, not authorization-relevant; security framing dropped; the unaudited unbounded mint survives.
- PLT-156 high (partial) — reassignment misattributes past activity (holds); "soft-delete makes activity authorless" false (UI falls back to username).
- PLT-117 medium (rescoped) — tab is HIDDEN not click-then-redirect, and it's a blanket deleted-entity policy over 6 tabs; report/SLA cross-channel split via deep-link survives.
- PLT-024/054/072/099/162/035/036/037/017/043/087/096/060 — citation/mechanism/scope corrections (fabricated SQL columns, wrong method names, swapped springdoc paths); core defects survive.

confirmed-static held + flag->true: PLT-158, PLT-159, PLT-160, PLT-161 (attachment family), PLT-119, PLT-073, PLT-008, PLT-050, PLT-053, PLT-079, PLT-088, PLT-171, PLT-186, PLT-188, PLT-198, PLT-039.
flag stayed false (runtime/mixed): PLT-024, PLT-054, PLT-072, PLT-099, PLT-162, PLT-035, PLT-046, PLT-103, PLT-168, PLT-157, PLT-034(low), PLT-172, PLT-196.
