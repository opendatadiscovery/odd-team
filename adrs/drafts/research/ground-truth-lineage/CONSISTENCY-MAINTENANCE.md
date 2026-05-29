---
research: ground-truth-lineage
artifact: CONSISTENCY-MAINTENANCE
date: 2026-05-29
overall_confidence: HIGH
scope: >
  How to ingest four external ground-truth surfaces (live docs split by anchor; published ADR log;
  real GitHub issues; existing-test registry) into the ODD ontology as committed "derived-but-committed
  mirror" files WITHOUT creating a drifting second source of truth. Local-only, single unpaid maintainer,
  Claude-Code-agent-maintained.
---

# Consistency Maintenance for Derived-but-Committed Ground-Truth Mirrors

## The maintainer's fear, named precisely

The fear ("very easy to get inconsistency due to redundancy") is correct and is the **single-source-of-truth (SSOT) violation** that the prior-art literature treats as a first-order architecture risk: duplicating information in two places leads to drift and bugs, and "the longer it drifts the harder it becomes to know which version is current" ([Paligo SSOT](https://paligo.net/blog/content-reuse/what-is-single-source-of-truth-ssot/), [Improvementsoft on quality drift](https://www.improvementsoft.com/blog/quality-drift-in-documentation/)). The classic mitigation is **"link, don't copy."**

The resolution is **not** to abandon ingestion. It is to make the committed copy a **generated projection, never an authority** — exactly the contract the ontology already holds for the ephemeral graph ("canonical = committed files; the graph is a disposable projection"; APPROACH §17.2). We extend that contract one layer outward: **the upstream surface (docs repo / GitHub tracker / test suite) is canonical; the committed mirror is a `DO NOT EDIT` generated file whose only job is to be a cheap, diffable, provenance-stamped *cache of upstream truth as of a pinned commit/timestamp*.** A mirror that is never hand-authored cannot be a competing source of truth — it can only be **fresh or stale**, and staleness is made a cheap boolean. This is the dbt-source / generated-code-checkin / lockfile pattern, not the "save-as second copy" anti-pattern.

---

## Recommendations (opinionated) — answer first, detail below

### R1 — The derived-but-committed-mirror pattern → **generated-file + lockfile hybrid, single-writer ingestion subagent.** Confidence: **HIGH**
Treat each mirror exactly like checked-in generated code (protoc-gen-go's `Code generated … DO NOT EDIT.` discipline — [Buf/protoc convention](https://blainsmith.com/articles/go-grpc-gateway-openapi/)) **plus** a lockfile-style provenance header (the `go.sum`/`poetry.lock` idea: record the upstream identity + a content hash so integrity is a hash compare — [Go modules ref](https://go.dev/ref/mod)). One writer only: the **ingestion subagent** (the inverse of a reducer — reads an external surface, emits committed mirror files). Humans never edit a mirror body; human intent lives in a `## Maintainer notes` block that survives refresh (APPROACH Rule 7) and in the backlog, never inline. This is the materialized-view stance: the mirror is a view; upstream is the base table ([incremental view maintenance](https://risingwave.com/blog/incremental-materialized-views-complete-guide/)).

### R2 — Drift detection → **two-tier cheap boolean: upstream-revision anchor first, per-chunk content hash second. Store both in a `_manifest.yaml`; never re-read to check.** Confidence: **HIGH**
The substrate already pins `last_scan_commit`; generalise it per surface. Drift = `upstream_revision_now != upstream_revision_pinned`. That is one comparison per surface, and for GitHub it costs **zero rate-limit budget** via conditional requests (ETag / `If-None-Match` → `304 Not Modified` does not count against the limit — [GitHub REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)). The revision anchor is the *trigger*; the **per-chunk SHA-256** is the *scalpel* — it says *which* anchors/issues/tests actually changed so refresh and re-embed touch only the delta (10–15% reprocessing vs 100% — [incremental indexing](https://medium.com/@vasanthancomrads/incremental-indexing-strategies-for-large-rag-systems-e3e5a9e2ced7)). Falling back to content-hash when the revision marker is untrustworthy is the documented change-detector design ([Particula](https://particula.tech/blog/update-rag-knowledge-without-rebuilding)).

### R3 — Completeness checking → **a per-surface "validator denominator," computed from the upstream, never from the mirror itself.** Confidence: **HIGH**
The workspace already has the pattern (SUMMARY.md is the validator for docs; fixed substrate-node count for coverage) and the anti-pattern it exists to kill (LSN: "100% coverage" over the heuristic's *own surfaced subset*, not the codebase). Generalise: completeness = `ingested_count / upstream_authoritative_count`, where the denominator is fetched from upstream's own index (docs: `SUMMARY.md` leaf count; issues: paginate to exhaustion + cross-check `total_count`; tests: the test-runner's collected count; ADRs: the ADR-log index). A mirror is **complete only if every upstream key has a mirror file AND no mirror file lacks an upstream key** (bi-directional, like the existing code↔doc Gate 6). Store the denominator + the missing/orphan key lists in `_manifest.yaml` so completeness is a length compare, not a re-crawl.

### R4 — Agentic consistency-maintenance loop → **git-diff/conditional-fetch-*triggered* refresh, three-subagent split (ingest / verify / reconcile), human surfaced only on genuine conflict.** Confidence: **MEDIUM-HIGH**
Mirror the KARMA multi-agent KG-enrichment shape (ingest → verify → reconcile, with a dedicated conflict-detection vs conflict-resolution split — [KARMA, arXiv 2502.06472](https://arxiv.org/pdf/2502.06472)) and the doc-drift-in-CI trigger shape (a `CLAUDE.md` source→doc mapping table; git-diff drives *which* mirror to check; routine fixes land as an auto-PR a human reviews post-hoc — [doc-drift-detection-in-CI](https://understandingdata.com/posts/doc-drift-detection-ci/)). Trigger is **on-demand + git-diff-driven, NOT a daemon** (APPROACH Rule 12 forbids recurring infra; no cron, no hosted bot). The reconcile subagent auto-applies *additive/identical-modulo-formatting* refreshes silently and escalates to the maintainer **only** when an upstream change collides with a `maintainer_curated` annotation or contradicts a downstream-cited claim — the dbt "freshness is a gate, not an afterthought" stance applied at human-attention granularity.

### R5 — Pitfalls → see the dedicated table at the end. The five load-bearing ones: **redundancy→drift** (mitigated by R1's no-hand-edit single-writer), **context-window blowout** (the project already hit 1.26 MB / 157% of a context window — mirrors MUST be sharded + index-only-loaded, never monolith-loaded), **anchor instability** (heading slugs move; pin by stable key + fuzzy-rematch on refresh), **GitHub rate limits** (conditional requests + cursor pagination + jitter), and **partial-ingestion corruption** (atomic temp-write-then-rename + all-or-nothing manifest commit). Confidence: **HIGH**

---

## Detail

### D1 — The derived-but-committed-mirror pattern (R1)

**The reconciliation that dissolves the maintainer's fear.** "Two sources of truth" is an anti-pattern only when *both can be authored*. A `go.sum` is a committed copy of upstream hashes and nobody fears it, because it is single-writer (the toolchain) and `go mod verify` makes divergence a hard error ([Harshanu on go mod verify](https://harshanu.space/en/tech/go-mod-verify/)). A `poetry.lock` is a committed projection of the dependency resolver's decision. A protoc-generated `.pb.go` is a committed projection of a `.proto`. None are second sources of truth; all are **caches with an integrity check and a regeneration command**. The mirror is the same object class. The design rules that make this hold:

1. **`DO NOT EDIT` header on every mirror**, naming the upstream SoT, the ingestion subagent, the pinned upstream revision, and the regenerate command. This is the protoc/Buf convention ([source](https://blainsmith.com/articles/go-grpc-gateway-openapi/)) and it is what tells *both* a human and the next agent that this file has no authority.
2. **Single writer.** Only the ingestion subagent writes mirror bodies. The file-analyser already runs `Write`-only / no-`Edit` for an analogous reason (APPROACH Rule 4); ingestion subagents inherit the same tool restriction so they cannot silently mutate non-mirror files.
3. **Human intent is quarantined to a survive-refresh block.** APPROACH Rule 7 ("maintainer-curated entries survive refresh") already exists for sidecars/`concepts.yaml`. A mirror carries a `## Maintainer notes` / `maintainer_annotations:` region the ingestion subagent copies forward verbatim and never overwrites. Everything else is regenerable. So the human *can* add value (a caveat on a flaky test, a note that an issue is a known dup) without ever becoming a competing author of the mirrored body.
4. **Check-in-and-verify, not check-in-and-trust.** The generated-code-CI pattern: a verify step re-derives and fails on any diff in checked-in generated trees ([anthropics/connect-rust #95](https://github.com/anthropics/connect-rust/issues/95), [influxdata/flux #1183](https://github.com/influxdata/flux/issues/1183)). Local analogue: a `verify` subagent (R4) that re-fetches upstream revision + recomputes hashes and reports stale-vs-fresh. Because Rule 12 forbids hosted CI in the loop, this runs on-demand/pre-commit locally, not as a managed runner.

**Which prior-art patterns apply (and which don't):**

| Pattern | Applies? | How it maps |
|---|---|---|
| Generated-file `DO NOT EDIT` + check-in-verify CI | **YES (core)** | Mirror header + local verify subagent; the no-hand-edit rule is the whole consistency guarantee. |
| Lockfile (`go.sum`/`poetry.lock`) — pinned identity + hash | **YES (core)** | `_manifest.yaml` per surface = the lockfile: upstream revision + per-key content hash. |
| Materialized-view incremental invalidation | **YES (mental model)** | Upstream = base table; mirror = view; refresh computes the delta, not a full recompute. |
| dbt source freshness (`loaded_at_field` → pass/warn/error) | **YES (drift-as-gate)** | Per-surface freshness check → tri-state; only-downstream-of-changed refresh is `state:`-style selection. |
| Content-addressed / hash change detection | **YES** | Per-chunk SHA-256 is the scalpel for partial refresh + re-embed. |
| Vendoring with checksums (`go mod vendor`) | **PARTIAL** | We vendor *content* (the mirror) but the checksum lives in our manifest, not upstream's (GitHub/test-suite emit no checksum file). |
| Git submodules | **NO** | A submodule re-points at upstream HEAD but gives no per-chunk drift granularity, no completeness denominator, and no agent-readable provenance per element. Rejected. |
| RAG-as-construction-method / external vector store | **NO** | Forbidden by LSN-016 / Rule 12. Embeddings only *find entry points* over local distilled prose (APPROACH §17.3). |

### D2 — Drift detection: what gets stored so drift is a cheap boolean (R2)

The principle from the substrate: store enough that *checking* drift is O(1) per surface and *locating* drift is O(changed-keys), so the routine "nothing changed" path never re-reads bodies.

**`lineage/{repo}/ground-truth/{surface}/_manifest.yaml`** (the lockfile) per surface holds:

```yaml
surface: docs            # docs | adrs | issues | tests
upstream:
  kind: gitbook-repo                      # or github-issues | adr-log | test-suite
  ref: opendatadiscovery/documentation
  pinned_revision: 8f3c1a2               # commit SHA (docs/adrs/tests) OR a high-water cursor (issues)
  pinned_at: 2026-05-29T10:00:00Z
  etag: "W/\"a1b2c3\""                   # GitHub conditional-request cache (issues/ADR-log)
completeness:
  upstream_authoritative_count: 214       # the denominator — fetched from UPSTREAM's own index
  ingested_count: 214
  missing_keys: []                        # upstream keys with no mirror file → INCOMPLETE
  orphan_keys: []                         # mirror files with no upstream key → STALE/DELETED upstream
entries:
  - key: data-discovery/attachments#retention   # stable upstream key (relpath#anchor / issue-number / nodeid)
    mirror_file: docs/data-discovery/attachments/retention.md
    content_hash: sha256:7d9f…            # hash of the NORMALISED upstream chunk
    upstream_anchor_resolved: true        # false ⇒ anchor moved/deleted ⇒ anchor-instability flag
    last_refreshed_revision: 8f3c1a2
    embedded_hash: sha256:7d9f…           # what the ephemeral index last embedded → re-embed iff differs
```

**The two-tier check, in order of cheapness:**

1. **Revision anchor (tier-0, cheapest).** docs/adrs/tests live in git → `upstream HEAD SHA != pinned_revision` is a single `git ls-remote` / local `git log -1`. Issues live in GitHub → a single conditional `GET` with the stored ETag returns `304` (no change, **zero rate-limit cost**) or `200` + new ETag ([GitHub conditional requests](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api), [Octokit conditional calls](https://www.bomberbot.com/school/maximizing-your-github-api-requests-with-conditional-calls-using-octokit/)). If tier-0 says "unchanged," the whole surface is fresh — stop, no body reads.
2. **Per-chunk content hash (tier-1, the scalpel).** When tier-0 fires, fetch the changed region and recompute SHA-256 per chunk. `content_hash` differs ⇒ that one mirror file is stale and gets regenerated; `embedded_hash != content_hash` ⇒ that one chunk gets re-embedded (everything else is reused — the chunk-level-hashing pattern, [Roo-Code #4619](https://github.com/RooCodeInc/Roo-Code/issues/4619), [Particula](https://particula.tech/blog/update-rag-knowledge-without-rebuilding)).

**Caveat to respect (load-bearing):** GitHub ETags are **per-page, not per-collection** — a `304` on page 1 does NOT mean pages 2–5 are unchanged ([Jamie Magee](https://jamiemagee.co.uk/blog/making-the-most-of-github-rate-limits/)). For issues, anchor freshness on a **high-water `updated_at` cursor** (`GET /issues?since=<cursor>&sort=updated&direction=asc`) so a single forward scan catches every change since last sync; time-based pagination is the documented incremental-sync technique ([Knit pagination](https://www.getknit.dev/blog/api-pagination-techniques)). Also: a tagged upstream doc revision can be force-overwritten (the `go.sum` "maintainer overwrites a tagged version" mismatch case — [studyraid](https://app.studyraid.com/en/read/15009/518931/addressing-checksum-mismatch-problems)); the content hash, not the revision label, is the authority for "did the bytes change."

**Normalisation before hashing is mandatory** (else cosmetic noise = false drift): strip trailing whitespace, normalise line endings, and for issues exclude volatile fields (reaction counts, `updated_at` itself) from the hashed payload — hash the *semantic* content (title + body + state + labels + ordered comments), not the envelope.

### D3 — Completeness checking: the per-surface invariant (R3)

The failure this prevents is the documented LSN: a coverage number computed over *the tool's own output set* reports 100% while real items are silently absent. The fix is **the denominator must come from the upstream's own authoritative index, never from the mirror directory listing.** Bi-directional, like the existing code↔doc Gate 6 and the "SUMMARY.md is the validator" rule.

| Surface | Completeness invariant | Denominator source (upstream-authoritative) | How computed cheaply |
|---|---|---|---|
| **Docs (by anchor)** | Every leaf in `SUMMARY.md` has a mirror; every heading anchor in each page is either mirrored or explicitly excluded | `SUMMARY.md` leaf count + per-page `^#{1,6} ` heading scan | `missing_keys`/`orphan_keys` length in manifest; reuse the existing SUMMARY-validator machinery |
| **ADR log** | Every ADR in the published log index is mirrored; numbering has no gaps (a gap = a missing or withdrawn ADR to account for) | The ADR-log index / `adrs/` directory listing on the pinned revision | Set-difference of upstream ADR IDs vs mirrored IDs |
| **GitHub issues** | Every issue number in `[1..max]` is either mirrored or accounted-for (deleted/transferred); paginate to exhaustion, cross-check `total_count` | Paginate `since`-cursor to the empty page (the documented "loop until x-next-page absent" technique — [community #69826](https://github.com/orgs/community/discussions/69826)); `total_count` as a *sanity check only* (Search API caps at 1000 — [community #56494](https://github.com/orgs/community/discussions/56494)) | Contiguous-number-range check + count reconcile |
| **Test registry** | Every test the runner *collects* has a registry row; no registry row points at a deleted test | The test runner's own collected-item count (`pytest --collect-only -q` / `mvn test -DskipTests=false` collected list / `jest --listTests`) | Set-difference of collected node IDs vs registry keys |

**The general invariant:** `complete ⟺ (missing_keys == [] AND orphan_keys == [])`, both recomputed against an upstream-derived key set on every refresh, both persisted in the manifest so the steady-state check is two empty-list assertions. **The substrate already proves the denominator-from-source principle** (`last_scan_commit` + fixed node count as the coverage denominator vs the rejected heuristic-subset denominator); this is the same rule applied to four new surfaces. Critically: the test-suite denominator must be the *collected* count, mirroring Rule 20's "conceptual ceiling vs enumerated subset" check — a registry that only lists tests matching one naming pattern silently under-counts exactly like the i18n/UI-axis misses (LSN-025).

### D4 — The agentic consistency-maintenance loop (R4)

**The shape, mapped onto the existing reducer architecture.** Reducers are *fan-in* (read many committed files → emit one derived file). Ingestion subagents are the **inverse fan-in**: read one *external* surface → emit many committed mirror files + one manifest. Three subagents, modelled on KARMA's ingest/verify/reconcile separation with its distinct conflict-detection and conflict-resolution roles ([KARMA](https://arxiv.org/pdf/2502.06472)):

| Subagent | Role | Inputs | Outputs | Tool surface |
|---|---|---|---|---|
| **`gt-ingester`** (one variant per surface, sharing a contract) | Fetch upstream, normalise, shard, emit mirror files + manifest. The "Entity Discovery + Property Extraction" role. | Live docs (WebFetch) / GitHub API / `git` / test-runner `--collect-only` | `ground-truth/{surface}/**` mirror files + `_manifest.yaml` | `WebFetch, Bash(git/gh/pytest --collect-only), Read, Write` — **no `Edit`** (single-writer; can only replace whole mirror files atomically) |
| **`gt-verifier`** | Re-derive revision + hashes; report fresh/stale/incomplete; **never writes mirror bodies**. The "Verification + Evaluation" role + the check-in-verify CI step. | Existing manifest; cheap upstream probes (ETag/`304`, `git ls-remote`) | A drift report → routes to `playbooks/follow-up-on-disk.md` | `WebFetch, Bash(read-only), Read` — no `Write` to mirrors |
| **`gt-reconciler`** | For each drifted key: regenerate mirror, preserve `maintainer_annotations`, decide auto-apply vs escalate. The "Conflict Detection + Conflict Resolution + Integration" roles. | Verifier's drift report; the changed upstream chunks; downstream citations into the mirror | Refreshed mirror files; escalation items for genuine conflicts | same as ingester |

**Trigger policy (NOT a daemon — Rule 12):**
- **git-diff-driven (primary).** A `CLAUDE.md`-style source→mirror mapping table (the doc-drift-CI technique — [source](https://understandingdata.com/posts/doc-drift-detection-ci/)): when `documentation/` changes in a pulled revision, the docs/ADR mirrors are flagged for verify; when the test suite changes, the test registry is flagged. Reuse the substrate's existing `git diff last_scan_commit..HEAD` machinery — the trigger denominator already exists.
- **on-demand (`/refresh-ground-truth {surface}`).** A skill the maintainer fires, or that a reducer fires when it notices a stale `embedded_hash`.
- **opportunistic conditional fetch for issues.** Because issues have no local git signal, the verifier does one cheap conditional `GET` (ETag → `304` is free) when any session touches issue-derived artefacts. No polling loop, no scheduled job.

**Human-out-of-the-loop for the routine case; surfaced only on genuine conflict.** The reconciler auto-applies silently when the refresh is **non-conflicting**: additive (new doc page / new issue / new test), or a body change that does **not** touch a `maintainer_annotations` region and is **not** cited by a downstream artefact as a load-bearing claim. It **escalates to the maintainer** (via `playbooks/pause-and-ask.md` + a logged backlog item) only when:
1. An upstream change **contradicts a `maintainer_curated` annotation** (e.g. the human noted "this test is flaky, ignore"; upstream rewrote the test) — KARMA's conflict-resolution-needs-evidence case.
2. An upstream change **invalidates a downstream-cited claim** (a sidecar / feature-flow cited `attachments/retention.md#L40` and that anchor's content materially changed) — this is the "downstream consumer breaks" case; the cross-reference must be re-verified, not silently re-pointed.
3. **Completeness regressed** (a previously-mirrored upstream key vanished — issue transferred, doc page deleted, test removed): orphan keys are never auto-deleted; they are surfaced so the maintainer decides retire-vs-investigate (an `orphan` is sometimes a real upstream regression worth a finding).

This is the dbt "freshness is a *gate*, not an afterthought" stance ([Paradime](https://www.paradime.io/guides/blog-dbt-source-freshness-best-practices)) applied to **maintainer attention** as the scarce resource: routine freshness flows through; only evidence-needing conflicts consume a human roundtrip.

**Reconciliation with the ephemeral graph (APPROACH §17).** The mirrors are *committed canonical inputs*; the ephemeral `rustworkx` graph + vector index treat them exactly like sidecars — projected, never authoritative. The `embedded_hash` field is what keeps re-embedding incremental: the graph rebuild re-embeds only chunks whose `content_hash != embedded_hash`, preserving the "disposable projection rebuilt from files" contract while avoiding a full re-embed of every doc anchor each run.

### D5 — Why this does not reintroduce the index-bloat ceiling

The project's #1 CRITICAL was a 1.26 MB / ~315k-token monolith index that exceeded an agent's context window (APPROACH §17.1). Four ingested surfaces (especially *all docs by anchor* and *all issues*) are exactly the kind of payload that re-creates that ceiling if mirrored as monoliths. **Non-negotiable design constraints inherited from §17:**
- **Shard, never monolith.** One mirror file per anchor / per issue / per ADR / per test. The `_manifest.yaml` is the only index loaded whole, and it carries *keys + hashes + paths*, not bodies — it stays KB-scale.
- **Index-only loading.** Agents load the manifest (cheap) to decide *what* changed, and read individual mirror bodies only for the changed keys — the same bounded-per-query discipline the ephemeral graph enforces.
- **Embed distilled prose, never raw dumps.** Per §17.3, the vector half embeds distilled NL, not raw issue threads or raw doc HTML — so ingesting issues does not balloon the index with low-signal comment noise.

---

## Pitfalls → Mitigations

| # | Pitfall | Failure mode if unmitigated | Mitigation | Confidence |
|---|---|---|---|---|
| P1 | **Redundancy → drift** (the maintainer's stated fear) | Mirror hand-edited; becomes a competing SoT; nobody knows which is current | Single-writer ingestion subagent; `DO NOT EDIT` header; human intent only in survive-refresh `maintainer_annotations` (Rule 7); verify-subagent fails on hand-edit diff (check-in-verify CI pattern) | HIGH |
| P2 | **Context-window blowout from over-ingestion** | A monolith mirror (all docs / all issues) exceeds the agent context window — the project already hit 1.26 MB = 157% (§17.1) | Shard one file per key; load `_manifest.yaml` (KB-scale, bodies-excluded) to decide deltas; read individual bodies only for changed keys; embed distilled prose only | HIGH |
| P3 | **Anchor instability** (heading slugs / line numbers move; issue renumbered on transfer) | Stable-looking key silently re-points to wrong content; drift undetected; downstream citation rots | Key on the most stable available id (relpath#anchor-text, issue **number** not title, test **node id** not line); on refresh, content-hash-match to re-locate moved anchors; `upstream_anchor_resolved:false` raises an explicit anchor-instability flag, never a silent re-point | HIGH |
| P4 | **Embedding staleness** | Index reflects last-month's doc/issue; returns outdated answers with full confidence (the "silent failure mode") | `embedded_hash` per chunk in manifest; re-embed iff `content_hash != embedded_hash`; graph is ephemeral and rebuilt from files (§17.2) so a stale embedding cannot outlive a refresh | HIGH |
| P5 | **GitHub API rate limits** | Naïve polling burns the hourly budget; sync throttled mid-crawl → partial data | Conditional requests (ETag/`If-None-Match` → `304` costs nothing); `since`-cursor incremental scan (per-collection, not per-page ETag — the per-page caveat); jitter + 429-retry per spec; no daemon (Rule 12) | HIGH |
| P6 | **"Two sources of truth" anti-pattern** | Same as P1 at the *architecture* level: the org now has two places to fix a doc/issue/test | Mirror is explicitly a *cache of upstream-as-of-revision*, never authoritative; all writes flow to upstream; mirror is regenerated, never the fix target; "link, don't copy" enforced by the no-hand-edit rule | HIGH |
| P7 | **Completeness false-positive** (the recurring LSN failure) | "100% ingested" computed over the mirror's own listing while real upstream items are absent | Denominator is **always** upstream-authoritative (SUMMARY leaf count / paginate-to-exhaustion / runner-collected count / ADR-log index); bi-directional missing+orphan check; test denominator = *collected* count (LSN-025 conceptual-ceiling discipline) | HIGH |
| P8 | **Merge conflicts on regenerated files** | Two branches both refresh the same mirror → noisy git conflicts on generated content | Deterministic, stable-sorted output (sorted keys, canonical formatting — the reproducible-build discipline); regeneration is idempotent so a rebase re-runs cleanly; mirrors live under one directory so conflicts are localised and resolvable by *re-running the ingester*, never by hand-merge | MEDIUM-HIGH |
| P9 | **Partial-ingestion corruption** | Fetch fails mid-crawl; half the issues written; manifest disagrees with files; next verify trusts a corrupt state | Atomic temp-write-then-rename per file ([Python os.replace](https://thelinuxcode.com/python-osreplace-for-safe-atomic-file-updates-in-real-systems/)); manifest written **last** as the commit point (all-or-nothing — the lockfile-after-content discipline); a fetch failure leaves the prior good manifest intact; verifier treats files-newer-than-manifest as a corrupt-state error | HIGH |
| P10 | **Stale denominator** (upstream grew; denominator cached from an old crawl) | Completeness looks 100% against a stale, too-small denominator | Recompute the denominator from upstream on *every* refresh, never trust the cached one for the freshness gate; tier-0 revision change forces a denominator refresh | MEDIUM-HIGH |
| P11 | **LLM ingestion non-determinism** (an LLM agent re-summarising upstream produces different bytes each run → perpetual false drift) | Every refresh shows "changed"; hash check becomes useless; merge conflicts everywhere (P8) | Ingestion is **mechanical transcription + normalisation, not LLM re-summarisation** — the mirror body is the upstream content verbatim-normalised; any LLM-distilled view is a *separate derived layer* with its own provenance, kept out of the hashed mirror body. Hash the deterministic transcription, not an LLM rendering | HIGH |
| P12 | **Downstream citation rot** | A sidecar/feature-flow cites a mirror anchor; upstream changes the claim; the citation now silently misleads | On refresh, the reconciler diffs changed keys against the set of downstream artefacts citing them (the mirror is `source_file:source_line`-addressable per the ontology contract); any cited-and-changed key escalates for re-verification rather than silent refresh | MEDIUM |

---

## Cross-references (workspace)

- **APPROACH §17.1–§17.3** — the ephemeral-graph contract (canonical = files; graph is a disposable projection) this design extends one layer outward; the 1.26 MB / 157% index-bloat CRITICAL (P2).
- **APPROACH Rule 7** — maintainer-curated entries survive refresh (the `maintainer_annotations` quarantine, P1).
- **APPROACH Rule 12** — local-only, no recurring infra (kills the daemon/cron/hosted-bot option in R4).
- **APPROACH Rule 20 / LSN-025** — declared-axis conceptual ceiling vs enumerated subset (the test-registry completeness denominator, P7).
- **`adrs/drafts/code-lineage-substrate.md`** — `last_scan_commit` revision anchor (R2 tier-0), `extractor_version` full-rebuild invalidation, and "SUMMARY.md is the validator" (R3) — the patterns this generalises to four surfaces.
- **`.claude/agents/*` reducer contracts** — the fan-in shape the ingestion subagents invert; Rule 4 `Write`-not-`Edit` tool restriction (P1 single-writer).
- **`playbooks/follow-up-on-disk.md` + `playbooks/pause-and-ask.md`** — the escalation channels the reconciler uses for genuine conflicts (R4).

## Sources (external)

- Generated-code check-in CI: [anthropics/connect-rust #95](https://github.com/anthropics/connect-rust/issues/95), [influxdata/flux #1183](https://github.com/influxdata/flux/issues/1183); `DO NOT EDIT` convention: [protoc/Buf](https://blainsmith.com/articles/go-grpc-gateway-openapi/)
- SSOT / drift anti-pattern: [Paligo](https://paligo.net/blog/content-reuse/what-is-single-source-of-truth-ssot/), [Improvementsoft](https://www.improvementsoft.com/blog/quality-drift-in-documentation/)
- Lockfile / checksum integrity: [Go modules reference](https://go.dev/ref/mod), [go mod verify](https://harshanu.space/en/tech/go-mod-verify/), [checksum mismatch causes](https://app.studyraid.com/en/read/15009/518931/addressing-checksum-mismatch-problems)
- Materialized-view incremental maintenance: [RisingWave](https://risingwave.com/blog/incremental-materialized-views-complete-guide/), [Enzyme/IVM arXiv](https://arxiv.org/html/2603.27775)
- dbt source freshness / state selectors: [dbt freshness docs](https://docs.getdbt.com/reference/resource-properties/freshness), [Datafold](https://www.datafold.com/blog/dbt-source-freshness/), [Paradime best practices](https://www.paradime.io/guides/blog-dbt-source-freshness-best-practices)
- GitHub conditional requests / rate limits / pagination: [GitHub REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api), [Jamie Magee](https://jamiemagee.co.uk/blog/making-the-most-of-github-rate-limits/), [Octokit conditional calls](https://www.bomberbot.com/school/maximizing-your-github-api-requests-with-conditional-calls-using-octokit/), [pagination guide](https://github.com/orgs/community/discussions/69826), [Search API total_count cap](https://github.com/orgs/community/discussions/56494), [Knit pagination techniques](https://www.getknit.dev/blog/api-pagination-techniques)
- Incremental re-embedding / chunk hashing: [incremental indexing](https://medium.com/@vasanthancomrads/incremental-indexing-strategies-for-large-rag-systems-e3e5a9e2ced7), [Particula](https://particula.tech/blog/update-rag-knowledge-without-rebuilding), [Roo-Code chunk hashing #4619](https://github.com/RooCodeInc/Roo-Code/issues/4619)
- Agentic KG maintenance / reconciliation: [KARMA, arXiv 2502.06472](https://arxiv.org/pdf/2502.06472), [LLM-empowered KG construction survey](https://arxiv.org/html/2510.20345v1)
- Doc-drift detection in CI: [understandingdata.com](https://understandingdata.com/posts/doc-drift-detection-ci/); doc-freshness tooling: [Docs Fresh](https://www.docsfresh.com/), [DocSentry](https://doc-sentry.com/)
- Atomic file writes: [Python os.replace](https://thelinuxcode.com/python-osreplace-for-safe-atomic-file-updates-in-real-systems/), [atomic write-then-rename](https://linuxvox.com/blog/atomic-writing-to-file-on-linux/)
