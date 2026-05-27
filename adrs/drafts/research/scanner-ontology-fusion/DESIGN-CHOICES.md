---
artefact: research/design-choices
draft_for: ADR-scanner-ontology-fusion
date: 2026-05-27
research_thread: DESIGN-CHOICES
relates_to:
  - scanners/README.md
  - .claude/skills/scan/SKILL.md
  - .claude/agents/doc-gap-finder.md
  - .claude/agents/odd-sme.md
  - .claude/agents/feature-reflector.md
  - .claude/agents/graph-retriever.md
  - lineage/odd-platform/feature-flows/detail/F-001.yaml
  - lineage/odd-platform/sme-consultations/README.md
  - lineage/odd-platform/shoebox/README.md
  - lineage/odd-platform/retrieval-feedback/README.md
  - adrs/drafts/feature-anchored-ontology.md
  - adrs/drafts/agentic-graph-retriever.md
constraints_locked:
  integration_locus: extend-existing-scanners
  write_back_scope: annotate-only
---

# Scanner-ontology fusion — design choices (opinionated)

This thread enumerates every technical decision the fusion needs to make. Each section names the alternatives considered, rejects most of them with reason, picks one with confidence. The maintainer reads this once and decides.

The two locked constraints — **extend existing scanners** + **annotate-only write-back** — are treated as given throughout.

---

### 1. The scanner's orchestration shape

**Alternatives:**

- Option A — Split `/scan --ontology-fed` into a sibling skill. Rejected: two skill files diverge over time (cf. `/scan` vs `/next-batch` already share no orchestrator code); protocol updates split across two files, regression surface doubles.
- Option B — Replace `/scan` entirely with an ontology-fed-only skill, fall back to legacy when the frontmatter lacks `ontology_feed:`. Rejected: violates locked constraint #1 ("extend, not replace"); 28 standalone scanners must remain unchanged on day 1.
- Option C — Extend `/scan` with one conditional branch keyed on the scanner's `ontology_feed:` frontmatter. Prepend step 2.5 (ontology load) between "Load scanner definition" and "Check coverage manifest"; append step 9.5 (writeback) between "Update progress" and "Report". Reads the ontology DIRECTLY (per Read on `lineage/{repo}/feature-flows/detail/F-*.yaml` + sidecars at paths named in `ontology_feed:`), NOT via `graph-retriever`. **(RECOMMENDED.)**

**Recommendation:** `/scan` grows ~30 lines. Direct file reads beat `graph-retriever` for three reasons: (a) the scanner already knows WHICH artefacts it needs (the `ontology_feed:` block names them — no information-need search), so the retriever's iterative loop adds latency without recall benefit; (b) `graph-retriever` writes `retrieval-feedback/` — semantically wrong for a scanner about to write back to the artefacts it just read; (c) the 8s build cache amortises poorly across 28 scanners. `doc-gap-finder` runs INDEPENDENTLY on its existing cadence — the scanner INGESTS the latest `doc-gaps.md` (cited by mtime + hash) but never spawns the reducer. Independence keeps the cost ceiling honest (per Concern A in `feature-anchored-ontology.md` rev-2) and avoids spawning loops.

**Confidence:** HIGH. Mitigation against branch-growth: hard cap of ~80 lines in `SKILL.md`; anything more goes into `playbooks/ontology-fed-scan.md`.

---

### 2. The clue → verification protocol

**Alternatives:**

- Option A — Trust the ontology as authoritative; copy `evidence: file:line` into findings unchanged. Rejected: violates the maintainer's hard rule; LSN-017 itself emerged from ontology silence (sidecars locally correct yet collectively wrong); code drifts between enrichment date and scan date.
- Option B — Ignore the ontology, re-derive every claim from scratch. Rejected: that IS the current standalone-scanner behaviour; wastes the substrate investment.
- Option C — Three-tier clue-class verification ladder, with class-specific minimum verification. **(RECOMMENDED.)**

| Clue class | Minimum verification | "Verified" means |
|---|---|---|
| `file_exists` (sidecar says `X.java:139`) | Read the cited file ±5 lines. | Cited symbol present at cited line ±5. |
| `assertion_about_code` (sidecar says "method returns 200 OK") | Read the cited region + verify mechanically (regex / direct read). | Textual claim and read evidence agree. |
| `cross_layer_behaviour` (chain-hop multiplicity, end-to-end DB-delta) | If `probe_verifications:` populated, run the cited probe; else file a `probe-needed` finding. | A probe run from THIS scan exists in `probe-runs/`. |
| `doc_drift` (sidecar's `docs_link_semantic` claim) | Fresh WebFetch in this session. | Live status + key excerpt match sidecar within 30 days. |

**Conflict handling** (scanner disagrees with ontology): scanner does BOTH — (i) writes `doc_status: invalidated` in the new `scanner_reviews:` entry (Section 3) on the offending feature-flow/sidecar, AND (ii) appends a new file under `lineage/{repo}/shoebox/detail/SHB-NNN-{slug}.md` with category `drift-correction`, status `open`. The annotation is the audit trail; the shoebox is the work item the `feature-flow-builder` picks up on its next pass (per `shoebox/README.md` — feature-flow-builder already reads open shoebox threads as Layer 4 input).

**Citation in findings** — introduce ONE new Source-of-Truth class, `Ontology`, to Gate 9's existing list (Repo / Integration / Config / Builder / Spec / Term / Lifecycle / Dep / Handler / Cross-repo / Backlog → +Ontology). It does NOT replace any class. Findings cite BOTH the ontology node-id (the clue) AND the underlying primary-source class (the verification): `Source-of-truth: Ontology[F-001:hop-1] → Repo[DataEntityDetails.tsx:56-64]`. A finding that can cite ONLY `Ontology[...]` is incomplete by Gate 9 — same shape Gate 9 already rejects.

**Recommendation:** smallest protocol respecting "ontology is a clue, not ground truth" without re-deriving. Most clues are `file_exists` or `assertion_about_code` (1-Read each). Only `cross_layer_behaviour` triggers a probe. `doc_drift` already pays for the WebFetch in every existing docs scanner today.

**Confidence:** HIGH — the four classes map 1:1 to clue shapes the substrate already emits; no new substrate work.

---

### 3. The write-back contract — exact field set

**Alternatives:**

- Option A — One flat field (`scanned_date: YYYY-MM-DD`) per annotated file. Rejected: maintainer needs which scanner ran, what it found, whether curation has happened since.
- Option B — Free-form `scanner_notes:` block. Rejected: unparseable text breaks idempotency; re-runs cannot dedup.
- Option C — Structured append-only `scanner_reviews:` LIST keyed by `scan_id`, mirroring the existing `probe_verifications:` shape in `feature-flows/detail/F-001.yaml:659-691`. **(RECOMMENDED.)**

**Exact YAML shape** — appended to `feature-flows/detail/F-NNN.yaml` (top-level key):

```yaml
scanner_reviews:                           # LIST — one entry per scan-run touching this feature
  - scan_id: docs-accuracy-feature-behavior/2026-05-27-batch-A
    reviewed_at: 2026-05-27T14:32:00Z
    reviewer_scanner: docs/accuracy/feature-behavior
    substrate_commit: ede5d277             # from lineage/{repo}/manifest.yaml
    doc_status: drafted                    # backlog | drafted | reviewed | live | invalidated
    scanner_finding_ids: [F-001, F-007]    # IDs from findings/{scan_id}.md
    clues_verified:                        # per-clue ladder outcome (Section 2)
      - clue: "F-001:hop-1 evidence at DataEntityDetails.tsx:56-64"
        verified: true
        method: file_exists
      - clue: "F-001:terminal_side_effect cardinality_per_call=1"
        verified: probe-deferred
        method: cross_layer_behaviour
        probe_skeleton: lineage/odd-platform/probes/P-NNN.yaml
    notes: |-
      Two findings emitted; one cross-layer claim deferred to probe.
      No drift detected at the three verified hops.
```

| Field | Type | Allowed values | Writer | Idempotency |
|---|---|---|---|---|
| `scan_id` | str | `{scanner-id-dashed}/{YYYY-MM-DD}[-batch-N]` | scanner only | unique per entry |
| `reviewed_at` | ISO ts | UTC | scanner only | regenerated each run |
| `reviewer_scanner` | str | scanner id from scanner frontmatter | scanner only | identical across reruns |
| `substrate_commit` | str | from `manifest.yaml:current_substrate_commit` | scanner only | identical on same commit |
| `doc_status` | enum | `backlog \| drafted \| reviewed \| live \| invalidated` | scanner (initial) + maintainer (override via separate entry) | most-recent `reviewed_at` wins; see Section 6 |
| `scanner_finding_ids` | list[str] | IDs from same scan's findings file | scanner only | deterministic |
| `clues_verified` | list[obj] | per-clue ladder outcome | scanner only | deterministic |
| `notes` | str block | free-form summary | scanner only | regenerated each run |

**Sidecars** (`lineage/{repo}/understanding/*.md`): same `scanner_reviews:` block under existing YAML frontmatter — the frontmatter parser already handles list-of-objects fields.

**doc-gaps.md** entries: append ONE line per DOC-GAP-NNN — `scanner_reviewed_by: [<scan_id>, ...]` (list; doc-gap-finder ignores this field on re-run, no merge conflict).

**`invalidated_by` shape**: lives INSIDE the `scanner_reviews` entry. When `doc_status: invalidated`, `notes:` carries `INVALIDATED — see correction shoebox SHB-NNN`. The shoebox file is the work item; the annotation is the audit trail.

**Confidence:** HIGH — mirrors `probe_verifications:` (proven idempotent across 4 probes on F-001); no new pattern invented.

---

### 4. PO / SME consultation escalation

**Alternatives:**

- Option A — Every ontology-fed scanner spawns `feature-reflector` on every touched feature. Rejected: ~10-15 min/feature (per F-021 reflection size) → 3-5 hours per 20-feature scan; also redundant since stable feature-flows reflect identically across consecutive scans.
- Option B — Scanner never consults PO/SME. Rejected: forfeits the PO-level signal the substrate carries (pillar anchor, intent-vs-impl hypotheses) — defeats the fusion's motivation.
- Option C — Threshold-gated consultation routed through the existing rev-11 SME pattern (`lineage/{repo}/sme-consultations/{date}-{slug}.md`). **(RECOMMENDED.)**

| Trigger | Spawn | Question shape |
|---|---|---|
| Drift found on a feature whose `feature-reflections/detail/F-NNN.yaml` is MISSING OR >30 days old | `feature-reflector` | "Re-reflect F-NNN given drift evidence X" |
| Code claim with no doc anchor AND pillar in `system-mission.md` suggests it SHOULD be documented (operator-workflow match per `odd-sme.md` Rule 4) | `odd-sme` | "Is {claim} a documentable operator concern in pillar {P}?" |
| `cross_layer_behaviour` clue contradicts the feature's `observed_vs_expected:` facets | `feature-reflector` | "Validate hypothesis X against current chain" |

**Cost ceiling: 3 consultations per scan-run, hard cap.** On the 4th trigger, scanner pauses with `AskUserQuestion` (per `playbooks/pause-and-ask.md`) summarising deferred consultations and offers (a) extend the cap, (b) defer-to-triage (DEFAULT), (c) drop deferred. Scanner finishes using the existing (possibly-stale) reflections and notes deferred consultations in its findings file.

**Recommendation:** triggers + cap prevent runaway subagent cost (cf. `feature-anchored-ontology.md` Concern A — reducer context growth IS the rev-2 cost ceiling). Routing through the existing SME consultation shape is non-negotiable; inventing a parallel channel splits the audit trail. The 30-day freshness rule from `sme-consultations/README.md` ports verbatim.

**Confidence:** HIGH on triggers; MEDIUM on the cap value. The 3-per-run number is an estimate from rev-2 batch sizes (~60 sidecars / 5 reducers per batch). Raise to 5 if pilot data shows 10+ runs routinely capping; leave at 3 if pilot shows ~0 triggers.

---

### 5. The two-mode coexistence

**Alternatives:**

- Option A — Implicit opt-in: ontology-fed iff `target_repo:` contains `odd-platform` (the only substrate built today). Rejected: couples mode to a build accident; building the substrate for `odd-collectors` later silently changes every collector scanner.
- Option B — Workspace-global toggle in `state/scan-config.yaml`. Rejected: opaque per-scanner contract — maintainer cannot tell from the scanner file which mode runs.
- Option C — Explicit opt-in via the scanner's frontmatter; per-scanner-run mode lock. **(RECOMMENDED.)**

**Minimum frontmatter addition** (8 lines, expandable to ~15):

```yaml
ontology_feed:
  enabled: true
  substrate_repo: odd-platform                # which lineage/{repo}/ to read from
  reads:
    feature_flows: all                        # or list: [F-001, F-007, ...]
    sidecars: by-pillar                       # by-pillar | all | list
    pillars: [Data Discovery, Governance]     # filter (only when sidecars=by-pillar)
    doc_gaps: latest                          # latest | none
    reflections: latest-or-stale              # latest | latest-or-stale | none
  writes_back_to: [feature-flows, sidecars, doc-gaps]
```

Absent `ontology_feed:` → scanner runs in standalone (legacy) mode unchanged.

**Mixed-mode safety:** mode-LOCKED per scanner-run. `/scan` loads ONE scanner at a time, so mode A for scanner X and mode B for scanner Y in the same session is fine (no shared mid-run state). If a scanner with `ontology_feed.enabled: true` is run against a repo whose substrate is missing → ABORT at step 2.5 with `substrate not found at lineage/{repo}/feature-flows/`. NO automatic fallback to legacy mode — silent fallback is the LSN-001-class footgun.

**Idempotency:** scanner reads ontology at the fixed commit named in `lineage/{repo}/manifest.yaml:current_substrate_commit` at scan start and writes that commit into every annotation's `substrate_commit:` field. Re-run on the same commit produces identical findings (modulo `doc-gaps.md`'s mtime, captured by hash). Deterministic ordering: features processed in `feature-flows/index.yaml` order; contributing nodes in `chain:` order.

**Confidence:** HIGH — abort-on-missing-substrate is the explicit anti-LSN-001 stance the workspace consistently applies (cf. Gate 5 unset-parameter audit). Mode-lock-per-run is the simplest coexistence model.

---

### 6. Conflict resolution

**Alternatives:**

- Option A — Scanner always wins (overwrites ontology). Rejected: scanner sometimes sees LESS than the sidecar (sidecar may carry probe verifications the scanner cannot reproduce in a single run).
- Option B — Ontology always wins (scanner findings filtered against ontology). Rejected: defeats the verification ladder — ontology can be wrong.
- Option C — Class-specific resolution with maintainer-curation preserved via append-only writeback. **(RECOMMENDED.)**

**Sub-cases from the brief:**

**(a) Scanner thinks feature is undocumented; ontology has `documents:` populated.** Scanner runs `doc_drift` ladder rung (Section 2) — fresh WebFetch on the cited URL. Live page exists AND covers the claim → scanner DEFERS to ontology, no finding. Live page 404s or omits the claim → scanner FILES the undocumented finding AND writes `doc_status: invalidated` on the ontology's `documents:` entry. The ontology lost because underlying truth shifted.

**(b) Scanner finds drift; `feature-reflector` flagged the same drift with different severity.** Scanner uses the existing dedup rule (per `scanners/README.md` "Deduplication" + `/scan` SKILL step 5 enrichment format) — emits an enrichment entry citing the reflector's verdict. NEVER a duplicate finding. Scanner does NOT override the reflector's severity; the enrichment NAMES both severities and the maintainer picks at triage. Single-author-severity-supremacy would defeat the rev-11 SME pattern's confidence-tagging.

**(c) Maintainer manually edited `scanner_reviews:`.** Scanner writeback is **append-only, never edit**. Maintainer adds their own entry with `scan_id: maintainer-curated/{date}` + `reviewer_scanner: maintainer-direct`; scanner reads but never overwrites. The `doc_status:` of the most recent entry (by `reviewed_at`) is canonical — if the maintainer's is newest, the maintainer's call stands.

**Recommendation:** append-only survives session-after-session co-edit. Mirrors `feature-flows/detail/F-001.yaml:batch_extensions:` (lines 50-115) — already maintainer-curated AND machine-extended via the same append pattern; proven at scale across 113 feature-flows.

**Confidence:** HIGH — append-only on a list-keyed-by-scan-id is the standard schema for time-ordered audit trails; maintainer-direct escape hatch is one line of policy.

---

### 7. The transition path

**Alternatives:**

- Option A — Big-bang flip on day 1: all 28 scanners get `ontology_feed:` blocks simultaneously. Rejected: verification ladder + writeback contract are new; one round of pilot data is needed before committing 28 scanners.
- Option B — Indefinite parallel-mode coexistence: ontology-fed remains opt-in forever. Rejected: two-mode maintenance cost amortises against substrate value; if substrate proves out, ontology-fed must become the norm.
- Option C — Three-phase transition: pilot → broad rollout → restructure adjacent reducers. **(RECOMMENDED.)**

**Day 1 — 2 pilot scanners:**

- `docs/coverage/undocumented-features` — ALREADY enumerates from code (5 axes per scanner lines 17-30); ontology's `feature-flows/index.yaml` IS an enumeration. Scanner's job changes from "enumerate then cross-reference SUMMARY.md" to "diff (enumerated nodes) against (feature-flows + sidecars), then cross-reference SUMMARY.md". Cheapest possible win — cross-reference half unchanged.
- `docs/accuracy/feature-behavior` — canonical accuracy scanner (Pass A/B/C three-pass method, scanner lines 22-28); feature-flows ALREADY carry `observed_vs_expected:` facets the scanner's Pass A can verify against directly. Highest-value win — proves the substrate's drift-class taxonomy maps to scanner passes.

Both run for one week (1 batch each). Compare findings against pre-fusion baseline on the same code commit. Metric: did the fusion-mode findings surface anything the standalone scanner missed? Yes → advance; no → revise the verification ladder before broader rollout.

**Day 30 — broad rollout.** All 28 scanners get `ontology_feed:` blocks (most flip to `enabled: true`; pure URL/HTML scanners like `docs/quality/rendering` and `docs/quality/outbound-urls` keep `enabled: false` as a documented no-op). Estimated: ~18 of 28 flip.

**Day 90 — restructure decision** for `doc-gap-finder`. If ontology-fed scanners are routinely emitting DOC-GAP candidates with the same shape, the reducer's role shifts from "find gaps" to "merge scanner-emitted gaps + cross-sidecar dedup + live-URL verification sweep". Reducer thins, runs on demand instead of per-batch, `doc-gaps.md` becomes derived. NOT retired — the cross-sidecar dedup role is structurally unique (per `doc-gap-finder.md` Rule 4 — five sidecars referencing one URL is ONE finding).

**Recommendation:** pilots picked for strongest natural fit (code-enumeration alignment + drift-taxonomy alignment). Day-30 is mechanical once pilots prove the contract. Day-90 deferred — if pilots fail, it never happens.

**Confidence:** HIGH on pilots (structural rationale). MEDIUM on day-90 restructure — depends on what pilots surface; the right verdict at day-30 might be "doc-gap-finder is fine, no restructure".

---

## Summary table — every decision at a glance

| Decision | Pick | Confidence |
|---|---|---|
| 1. Orchestration shape | Extend `/scan` with conditional branch; direct file reads; doc-gap-finder runs independently | HIGH |
| 2. Verification protocol | Three-tier clue-class ladder; dual-citation SoT `Ontology[...] → Repo[...]`; conflict → annotation + correction-shoebox | HIGH |
| 3. Writeback contract | Append-only `scanner_reviews:` list, mirrors `probe_verifications:` shape; maintainer curation preserved by identity | HIGH |
| 4. PO/SME consultation | Three triggers; 3-per-run cap with AskUserQuestion escalation; routes through existing rev-11 SME pattern | HIGH (triggers) / MEDIUM (cap value) |
| 5. Two-mode coexistence | Explicit per-scanner opt-in; abort-on-missing-substrate (no silent fallback); deterministic ordering | HIGH |
| 6. Conflict resolution | Class-specific; append-only writeback; maintainer-direct entries preserved by identity | HIGH |
| 7. Transition path | Day 1 pilots: `docs/coverage/undocumented-features` + `docs/accuracy/feature-behavior`; Day 30 broad rollout; Day 90 restructure decision deferred | HIGH (pilots) / MEDIUM (day-90) |

---

## Out of scope for the MVP

- NO substrate mutation outside `scanner_reviews:` (locked constraint #2).
- NO changes to `feature-flow-builder` / `concept-merger` / `adr-archaeologist` / `test-coverage-mapper` / `doc-gap-finder` agents. Fusion is scanner-side only; reducers run unchanged.
- NO new orchestrator skill alongside `/scan` — one skill grows, no split.
- NO Source-of-Truth class that supersedes existing classes — `Ontology` is additive and always co-cited with the underlying primary-source class.
- NO ontology authority in tie-breakers — Section 6 always defers to live-source truth.

## Bottom line

The fusion is small. Orchestrator grows by ~80 lines. Every existing artefact shape ports forward unchanged. `scanner_reviews:` mirrors `probe_verifications:` (same idempotency, append-only, dual-author preservation). The verification ladder forces live-source verification at every clue class. SME triggers route through the existing rev-11 pattern. Transition is two pilots → 30-day broad rollout → 90-day reducer restructure decision deferred. The single MEDIUM-confidence call is the 3-per-run consultation cap (Section 4) — pilot data should override it within the first month. Every other decision is HIGH-confidence because it ports an existing workspace pattern rather than inventing a new one.
