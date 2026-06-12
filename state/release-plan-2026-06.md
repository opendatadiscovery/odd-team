# Release plan — odd-platform, 2026-06 (one maintainer-week)

**Authored:** 2026-06-11 · **Capacity:** 15-20 fixes over one week · **Goals (maintainer's words):** most important · safe for backwards compatibility · the most annoying bugs we have.

**Method:** full triage of the 190 PLT drafts (`issues/odd-platform/`) + PLT-109 (GHSA, fix unshipped) by two independent agents — domain SME (`lineage/odd-platform/sme-consultations/2026-06-11-release-prioritization.md`) and a product-owner pass — then synthesis. 10 items appeared in both top lists; the exclusion sets agreed almost exactly.

**Selection function:** confirmed exploits first → everyday-surface 500s → lying UI (counts/labels/columns that misreport) → all compat-SAFE → effort dominated by one-liners (max 4 medium efforts).

**Hard rule for the week (compat guardrails):** no API contract breaks, no changed PUT/PATCH semantics, no newly-required config, no closing previously-anonymous endpoints, no auth-posture flips, no changed shipped defaults. Items needing any of those are in the Cut list, deferred to a deliberately release-noted train.

---

## Core slate — 15 slots (commit to these)

| # | Item [scope] | What ships | Why | Compat | Effort | Verification |
|---|---|---|---|---|---|---|
| 1 | **PLT-109** | Parameterize `ts_headline` in `getHighlightedResult` (bind params, mirror sibling FTS sinks) + regression test + repo-wide `.formatted(` SQL grep | Confirmed exploited SQLi (pg_sleep + UNION token exfiltration), anonymous under default auth; GHSA-rjp9-9vgm-q94c open | SAFE | S | PoC payload must come back inert |
| 2 | **PLT-147** | Null-guard `DATA_TRANSFORMER`/`DATA_QUALITY_TEST` null-details branches in `DataEntityMapperImpl` | One such entity 500s the whole search results list AND its detail page — the most-touched surface | SAFE | S | **SHIPPED 2026-06-12: draft PR #1779 (CTRIB-009, #1755), GATE 2 pending.** All four class branches guarded in mapPojo+mapDtoDetails (+DEG-details symmetry); DataEntityMapperImplTest failing-first; IT-068 pin flipped to the fixed-contract lock |
| 3 | **PLT-127 + PLT-090 [D3]** | Escape/neutralize tsquery metacharacters in `JooqFTSHelper.tsQuery` (or `websearch_to_tsquery`) — one fix closes term search + catalog search | A `(` or `:` in a search persistently 500s the search session (poisoned row re-500s on reopen) | SAFE | M | ufv=true; IT-003 is RED today → flips green |
| 4 | **PLT-021 [D1+D2]** | Map in-flight `RUNNING` rows so run history renders (prefer internal `@ValueMapping` fallback = zero wire change) + `nullsLast()` ordering | DQ run-history page 500s exactly when a test is mid-run ("I just retried it") | SAFE (with @ValueMapping variant; adding a wire enum value would be FLAG) | S | ufv=true; IT-059 driven |
| 5 | **PLT-100 [D1]** | Default/box `lineage_depth` (no NPE on omitted param) + server-side **clamp** (clamp, not 400-reject — non-breaking) | Spec-compliant lineage call without depth → opaque 500 on a core surface | SAFE | S | ufv=true |
| 6 | **PLT-141** | Bump springdoc-openapi 2.2.0 → 2.8.17 (was planned 2.7.x; official-matrix tip for Boot 3.4.x) | Swagger UI/OpenAPI dead since Spring 6.2 bump — the integrator surface is gone | SAFE (restores dead feature) | S-M | **MERGED 2026-06-12: PR #1777 = main `3f02dd63`; #1759 closed (GATE 2 done).** IT-042+IT-063 pins inverted; unit OpenApiDocsContractTest; docs train f67851e (DOC-450 pending-release) |
| 7 | **PLT-150** | `switchIfEmpty(NotFound)` on search-filters read + graceful "search expired" UI state | Bookmarked/expired search deep-link → generic "Unknown Error" boundary | SAFE | S | ufv=true |
| 8 | **PLT-143 + PLT-076** | One ControllerAdvice commit: `MissingRequestValueException`/`ServerWebInputException` + `IllegalArgumentException` → 400 | Missing required param / bad input read as platform crash (500 SYS001) + ERROR-log noise | SAFE | S | ufv=true both |
| 9 | **PLT-121** | Relabel global Alerts "All" → "Open" (or additive `status` param defaulting OPEN) | Resolved alerts invisible on every global tab; stewards conclude alerts were purged | SAFE | S | ufv=true |
| 10 | **PLT-179** | Relabel DQ "Title" filter → "Owner title" + OpenAPI param description (binding unchanged) | "Title" reads as the dataset name but binds an ownership role — confidently-wrong DQ aggregates | SAFE | S | ufv=true |
| 11 | **PLT-104 [FE scope]** | Remove `details.status?.status` from the `useEffect` dep array → +1 not +2 per open | Popular strip's sole ranking signal double-counts every view | SAFE | S | ufv=true; probe P-004/IT-001 re-run |
| 12 | **PLT-056 [D1+D4]** | Target column: render `targetDataEntity` (one-line copy-paste fix) + runtime-validate `?type=` | Critical: BOTH columns show the source dataset on every Relationships row; bad deep-link renders fake-empty page | SAFE | S | FE-traced 2026-06-10; eyeball on live stack |
| 13 | **PLT-057 [D1+D2]** | `scrollableTarget` one-line fix (+ shared id constant) + additive `LOOKUP_TABLE_RENAMED` activity event | Critical: Lookup Tables list silently stops at 30 rows under a true-total header; renames have zero audit trail | SAFE (event is additive) | S | **Drive first**: seed >30 tables, confirm truncation (ufv=false today); TST-001 pairs |
| 14 | **PLT-001** | Null-guard `S2sTokenProvider.isValidToken` / gate filter on s2s configured | Any request with any `X-API-Key` header → 500 on shipped default (trivial unauth error-spam) | SAFE | S | ufv=true |
| 15 | **PLT-163** | Shared ConfirmationDialog: reset loading + surface error on reject (both mutateAsync and thunk arms) | All ~23 confirm-and-mutate flows either freeze a dead spinner or close-as-success on failure | SAFE | M | ufv=true |

> Slot 10 was originally **PLT-176** (activity fan-out dedup) — discovered on 2026-06-11 to be already filed upstream as [#1744](https://github.com/opendatadiscovery/odd-platform/issues/1744) and **fixed by PR #1745** (closed completed 2026-06-10). PLT-179 promoted from alternates.

## Stretch — 5 slots (land if the week allows; order = priority)

| # | Item [scope] | What ships | Compat | Effort |
|---|---|---|---|---|
| 16 | **PLT-161** | Sanitize attachment `fileName` (basename, reject `..`/CRLF; `ContentDisposition` builder) — path traversal + header injection | FLAG-light (rejects hostile names only) | S |
| 17 | **PLT-160** | http/https allow-list on attachment link URLs — stored `javascript:`/`data:` XSS | FLAG-light (decide mailto; release-note) | S |
| 18 | **PLT-012 + PLT-061** | SecurityConstants corrections in one commit: `/term`→`/terms` + 2 mis-routed permissions | FLAG (documented gates start firing; under DISABLED no change — release-note) | S |
| 19 | **PLT-096** | Sort-before-slice on Overview sidebar lists ×4 (+ drop no-op bare `.sort()`) | SAFE | S |
| 20 | **PLT-146 [Db+Da]** | Column-PATCH belongs-to-table guard (cross-table silent mutation!) + 409 on name collision | FLAG-light (the "working" cross-table PATCH was corrupting another table) | S |

## Alternates (first substitutions if a slate item balloons)

- **PLT-139** (M) — notification subscriber wedges on fresh boot (slot-before-publication). Top silent-corruption per SME (#8) but needs the WAL harness to verify; first alternate, or its own fast-follow. IT-011 pairs.
- **PLT-026 [D1]** (S) — "Popular tags" returns oldest-by-id (paginate-before-COUNT).
- **PLT-128** (S) — DataSource delete blocked by attached entities closes the modal like a success.
- **PLT-058 [PR-2: D5+D6+D7]** (S-M) — Term linked-terms tab: fake 500 during loading / real errors render as empty / un-debounced keystroke search. (Whole cluster now tracked upstream as #1754.)
- **PLT-174** (S) — thread `ownerIds` through the 3 dropped activity view modes (same code as PLT-176).
- **PLT-044 [D1]** (S, **FLAG**) — parent-child check on stats ingestion: one-line fix but ingestion starts rejecting writes that previously (corruptingly) succeeded — release-note if shipped.

## Cut list — deliberately NOT in this release (and why)

| Items | Reason |
|---|---|
| PLT-152, PLT-003, PLT-064 [A1], PLT-072 | **Auth-posture changes** — close anonymous surfaces / activate policy enforcement / require ack env var. Breaks DISABLED-mode deployments, AlertManager integrations, or implicitly-admin users on in-place upgrade. Own release-noted security train. (PLT-064 A2 warn-only + PLT-072 SystemUsers cleanup are safe fragments to mine later.) |
| PLT-080 [default drop], PLT-074, PLT-085, PLT-108 | **Changed shipped defaults / credential semantics** — break quick-starts, plain-HTTP evals, running collectors. Dedicated security release. (PLT-080's warn-only startup check is safe to mine.) |
| PLT-066, PLT-184, PLT-025 [silent-200 half] | **Write-semantics changes** (PUT/replace-all/UPSERT) — protective but observable contract changes; SME "Theme D", ship together, loudly release-noted. |
| PLT-145 | Lookup-table rename = physical `ALTER TABLE` — real fix is structural (decouple display name from relation). This release ships the mitigation instead: PLT-057 D2 audit event. |
| PLT-056 [D2/D5], PLT-102 | Visibility-predicate alignment (result-set change) + `relationship_id` semantics (spec decision). Scope with the relationships cluster later. |
| PLT-058 [D1/D4] | Double-fetch + 50-cap need BE pageInfo work — M efforts; PR-2 hygiene scope is the alternate instead. |
| PLT-030, PLT-148 | Need design decisions first (user-identity source per auth mode; owner-association under DISABLED). |
| PLT-090 [D1/D2 remainder] | Facet enumeration / session-facets owner binding = posture; only the D3 escape ships (slot 3). |

## Release narrative (for the changelog)

A trust-and-stability pass: the everyday 500s on core surfaces are gone (catalog search, entity detail, glossary search, DQ run history, lineage, expired search links, and the API docs page itself), one confirmed SQL injection is closed along with a handful of small contained security gaps, and the UI stops misreporting — the Alerts "All" tab, activity counts, relationship targets, lookup-table listings, view counts, and destructive-action dialogs now mean what they say. Every change is backwards-compatible: no contract breaks, no new required config, no posture flips, no changed defaults. The heavier posture/default/semantics work is deferred to a dedicated, loudly release-noted follow-up.

## Filing status (2026-06-11)

- **Filed by maintainer (open):** #1752 (PLT-056), #1753 (PLT-057), #1754 (PLT-058), #1751 (PLT-215), #1750 (PLT-177).
- **Filed + already fixed (closed completed):** #1744 (PLT-176, PR #1745), #1746 (PLT-006, PR #1747), #1748 (PLT-190, PR #1749).
- **Queued for batch filing:** 15 slate items — manifest `state/filing-manifest-2026-06-11.txt`, script `scripts/file-issue-batch.py` (replicates the #1754 format: draft body verbatim + frontmatter in a trailing fenced block + labels + milestone 0.28.0). All slate drafts carry `suggested_milestone: "0.28.0"` (open milestone, due 2026-06-22) per the new milestone-at-filing rule (`issues/README.md`). Idempotent: drafts with `github_issue_number` set are skipped.
- **NOT filed publicly (maintainer decision 2026-06-11):** PLT-109 (GHSA, confirmed exploit) and the 5 security-adjacent items **PLT-090, PLT-160, PLT-161, PLT-012, PLT-061** — they stay `draft` (private handling); the fixes remain in the slate, only the public disclosure is withheld.

## Process notes for the week

- Per `pillars/tests/pillar.md`: each fix lands with its pin/regression test (named above where one exists: IT-068, IT-003, IT-042, IT-059, IT-050, P-004/IT-001, TST-001).
- PLT-057 D1 and PLT-012's 403-path are the two claims still needing a live drive before the fix is written (ufv=false); everything else in the slate is ufv=true or exploit-confirmed.
- On each ship: flip the PLT draft `status` per `issues/README.md` lifecycle, back-link the fix commit/PR, and re-check the paired DOC caveats (DOC-229/231/233 etc.) for retirement.

Sources: `/tmp` inventory snapshot of `issues/odd-platform/*.md` frontmatter (2026-06-11); SME consultation `lineage/odd-platform/sme-consultations/2026-06-11-release-prioritization.md`; PO agent analysis (session 2026-06-11, synthesized here); issue bodies cited per item.
