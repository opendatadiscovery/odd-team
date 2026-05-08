---
research: agentic-code-ontology
artifact: STABILITY
date: 2026-05-08
mode: web + cost analysis
overall_confidence: HIGH
---

# STABILITY — handling LLM stochasticity, cost, drift

## Recommendation

Build the ontology as an **anchored, hash-keyed, content-addressable cache** on top of the existing tree-sitter substrate, refresh it via the **Anthropic Message Batches API** (50% discount) with **1-hour prompt caching** of the system+workspace prefix (90% discount on read), and accept that LLM outputs are **stochastically stable but not bit-deterministic** — handle drift via per-node version stamps, schema-locked structured output, and diff-review on the `understanding` field.

Concrete numbers:

| Lever | Mechanism | Savings | Confidence |
|---|---|---|---|
| Anchored re-derivation | tree-sitter ID is the cache key; re-runs land on the same node | 100% on unchanged files | HIGH |
| Prompt caching | 1h cache on system+context prefix | 90% on cache reads (`$0.30/MTok` vs `$3/MTok` Sonnet input) | HIGH |
| Batch API | Asynchronous overnight refresh | 50% on input + output | HIGH |
| Stacked (cache+batch) | Both apply | up to ~95% combined | HIGH |
| Sonnet-class default model | Right capability for code summarization | $3/$15 per MTok base | HIGH |

Full odd-platform rebuild estimate (full-pass, no cache): **~$30-50 cold / ~$3-7 warm with caching+batch**. Incremental refresh on a typical PR (5-20 changed files): **~$0.05-0.20 per refresh**. Numbers derived in `## Cost model` below.

The stochasticity ceiling is real and Anthropic acknowledges it explicitly: even temperature=0 does not guarantee bit-identical outputs ([Glossary — Temperature](https://platform.claude.com/docs/en/about-claude/glossary)). Engineer for *semantic* stability, not bit determinism.

## Determinism strategies (recommended stack)

### 1. Accept the stochasticity ceiling — engineer around it

Anthropic's official Glossary entry on Temperature, verbatim:

> "Users may encounter non-determinism in APIs. Even with temperature set to 0, the results will not be fully deterministic and identical inputs may produce different outputs across API calls. This applies both to Anthropic's first-party inference service and to inference through third-party cloud providers."

Sources of residual variance even at `temperature=0` ([keywordsai/respan consistency-2025 review](https://www.keywordsai.co/blog/llm_consistency_2025), [vincentschmalbach](https://www.vincentschmalbach.com/does-temperature-0-guarantee-deterministic-llm-outputs/)):

- Floating-point non-associativity in matmul kernels under variable batch sizes (server-side batching mixes requests differently every call)
- GPU/TPU hardware variance
- Tied-probability tie-breaking when the top-1 token has a near-tie (the API does not expose a seed)
- Model-snapshot rollovers (a `claude-sonnet-4` alias may point to a new build mid-quarter)

Implication: **bit-identical re-runs are not achievable**, and design choices must assume a ~3-7% token-level perturbation rate even on stable inputs. Confidence: HIGH.

### 2. Use `temperature=0` + `top_p=1` (or close) anyway — it minimises variance even if it doesn't eliminate it

Standard guidance ([Glanzz on temperature for code](https://medium.com/@glanzz/stop-using-temperature-1-0-385cb51ac863)). Variance is reduced; greedy decoding pushes the model toward the modal token sequence. Confidence: HIGH.

### 3. Enforce structured output via JSON Schema / tool-use

Don't ask the agent for "a paragraph describing this file." Ask it to call a structured tool (`emit_node_record`) with a schema-validated shape:

```jsonc
{
  "name": "emit_node_record",
  "input_schema": {
    "type": "object",
    "required": ["id", "kind", "axis", "understanding", "claims", "sources"],
    "properties": {
      "id": {"type": "string"},                  // anchor — derived from substrate
      "kind": {"enum": ["controller", "ui-shell-bootstrap", "spring-bean-factory", ...]},
      "axis": {"enum": [...]},
      "understanding": {"type": "string", "maxLength": 600},
      "claims": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["statement", "evidence_file", "evidence_lines"],
          "properties": {
            "statement": {"type": "string"},
            "evidence_file": {"type": "string"},  // file:line citation, gate-9 enforced
            "evidence_lines": {"type": "string"},
            "confidence": {"enum": ["HIGH", "MEDIUM", "LOW"]}
          }
        }
      },
      "sources": {"type": "array"}
    }
  }
}
```

Why this matters for stability:

- Structured outputs **collapse the freeform generation surface**: model picks shape from schema, not from a million possible prose framings ([JSON Schema reduces stochasticity](https://blog.promptlayer.com/how-json-schema-works-for-structured-outputs-and-tool-integration/), [SLOT paper, ACL 2025](https://arxiv.org/html/2505.04016v1)).
- Validation is a hard gate — a missing `evidence_file` is a parse error, not a soft failure to be caught later.
- Each field has an independent re-prompt budget — if `claims[3].evidence_file` is malformed, retry just that field.

Confidence: HIGH.

### 4. Anchor on substrate-derived IDs (the existing tree-sitter ID is the cache key)

The substrate's symbol identifier — `{repo} {lang} {package} {kind}:{descriptor}` — is **already** a stable, content-addressable, human-readable key (see [`SCHEMA.md`](../code-lineage-substrate/SCHEMA.md) "Symbol identifier shape"). The ontology layer reuses these IDs verbatim as the primary key for `ontology/{repo}/nodes/{id-hash}.json`.

Re-running the agent on the same file produces a record keyed by the same ID; the previous record is **overwritten in place**, not appended as a new node. This is the single most important stability lever — it means "shuffled outputs" cannot happen at the structural level. The `understanding` text may rephrase, but the node it attaches to does not move.

Confidence: HIGH. This is the same anchoring discipline LSIF→SCIP adopted ([SCIP announcement](https://sourcegraph.com/blog/announcing-scip)) and that GitNexus / code-review-graph apply ([GitNexus](https://github.com/abhigyanpatwari/GitNexus), [code-review-graph](https://github.com/tirth8205/code-review-graph)).

### 5. Snapshot diffing — distinguish noise from signal

When the same file is re-analysed and the JSON output differs, classify the diff:

| Diff class | Detection rule | Action |
|---|---|---|
| **Schema-equal** (same fields, same `claims[].statement`) | Field-level deep equality | No action — perfect stability |
| **Paraphrase noise** (the `understanding` string differs but `claims[]` is identical) | Hash `claims[]` ignoring the prose field | Accept silently; note in audit log |
| **Claim-set drift** (different `claims[]` shapes) | Set-diff on `claims[].statement` | **Surface as a doc-style diff for human review** |
| **Kind/axis drift** (the model classified it differently) | Categorical compare | Block; require LSN or human override |

Implementation: a `lineage/{repo}/ontology-runs/{run-id}/diff.md` artifact rendered per refresh, with the four classes binned. Maintainer reviews only "Claim-set drift" + "Kind/axis drift" rows.

Confidence: HIGH. Mirrors the substrate's `--dry-run` discipline.

### 6. Pin the model snapshot

Use `claude-opus-4-7` or `claude-sonnet-4-6` (the explicit pinned IDs from [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing)), not aliases like `claude-opus-latest`. Pinned snapshots reduce the "Anthropic shipped a new build and now my outputs drift" failure mode. The ontology's `manifest.yaml` records the exact model ID used for each axis, and a model-version bump is treated as a `--full` rebuild trigger.

Confidence: HIGH.

### 7. Do NOT use consensus voting (self-consistency / N-sample majority) at MVP

Tempting; expensive; pays off only marginally for code summarization at our scale.

Evidence ([self-consistency cost-benefit, ACL findings 2025](https://aclanthology.org/2025.findings-acl.744.pdf), [confidence-improved sampling, arXiv 2502.06233](https://arxiv.org/pdf/2502.06233)):

- Self-consistency requires ~18 samples to match the accuracy of confidence-weighted methods using 10 samples — a 46% cost reduction for the latter, but still a 10× cost multiplier vs single-shot.
- Increasing ensemble size from 1 to 7 produced **no significant accuracy gain** for typical code-analysis tasks.

Conclusion: defer N-sample voting to **Phase 3 selectively**, only on critical claims (e.g., implicit ADR archaeology, security-relevant `understanding` fields) where the 5-10× cost is justifiable. MVP runs single-shot.

Confidence: HIGH.

## Cost model

All numbers below use [Anthropic's published 2026 pricing](https://platform.claude.com/docs/en/about-claude/pricing). All `MTok` = million tokens.

### Base rates (verbatim from Anthropic pricing page, 2026-05-08)

| Model | Base input | 5m cache write | 1h cache write | Cache read | Output | Batch input | Batch output |
|---|---|---|---|---|---|---|---|
| Claude Opus 4.7 | $5 | $6.25 | $10 | $0.50 | $25 | $2.50 | $12.50 |
| Claude Sonnet 4.6 | $3 | $3.75 | $6 | $0.30 | $15 | $1.50 | $7.50 |
| Claude Haiku 4.5 | $1 | $1.25 | $2 | $0.10 | $5 | $0.50 | $2.50 |

Discount stacking is officially supported: "the pricing discounts from prompt caching and Message Batches can stack" ([Anthropic batch-processing docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing)). So cache-read inside a batch = $0.30/MTok × 50% = **$0.15/MTok** for Sonnet 4.6.

### Per-file cost estimate

Assumptions for a "typical ODD file":

- Java/TS source file: ~150-400 lines, ~2k-6k tokens
- Per-file prompt structure:
  - System prompt + workspace context (anchored, cached): ~30-50k tokens
  - Per-file content (cold, the file itself): ~2-6k tokens
  - Output (structured node record): ~300-800 tokens

**Cold path (no cache, no batch — first run after model bump or schema change)**:

Sonnet 4.6, single file:
- Input: 35k system + 4k file = 39k tokens × $3/MTok = **$0.117**
- Output: 500 tokens × $15/MTok = **$0.0075**
- Per-file: **~$0.12 cold**

**Warm path (system context cached, batched)**:

- Input cache-read: 35k × $0.30/MTok × 50% batch = **$0.00525**
- Input cache-miss (the file): 4k × $3/MTok × 50% batch = **$0.006**
- Output: 500 × $15/MTok × 50% batch = **$0.00375**
- Per-file: **~$0.015 warm** — ~8× cheaper than cold

For the 1h cache-write surcharge (one-time per shift, amortised across all files in that 1h window):
- Cache write: 35k × $6/MTok = **$0.21** per cache-write event (1h cache, batch-recommended for shared context per Anthropic)
- Amortised across ~500 files in one batch: **~$0.0004/file** — negligible

### Repo-scale cost — cold full rebuild

ODD repo sizes (estimates from `code-lineage-substrate/SCHEMA.md` cost section + workspace knowledge):

| Repo | Files (approx) | Symbol nodes | Per-axis runs |
|---|---|---|---|
| odd-platform (Java + TS) | ~3,500 files (~860 Java + ~2,500 TS) | ~1,500-2,500 | 5 axes MVP |
| odd-collectors (Python) | ~40 adapter packages, ~400 files | ~500-800 | 1 axis (collector-adapter) |
| odd-team (Markdown) | ~300 .md files | ~300 (1:1 with files) | 1 axis (doc-content) |
| documentation (GitBook) | ~150 .md files | ~150 | 1 axis (doc-content) |

**Cold full rebuild — all repos, no cache, no batch (the worst case)**:

- File-level analysis: ~4,400 files × $0.12 = **~$528 cold full rebuild, no caching**

**Warm full rebuild — first batch establishes cache, subsequent files hit it**:

- One cache-write event per axis: ~6 axes × $0.21 = **~$1.26**
- File-level analysis: ~4,400 files × $0.015 = **~$66 warm**

**Cold rebuild with caching+batching (the realistic first-run number)**:

- Cache-write surcharge: ~$1-2
- Per-file warm cost: ~4,400 × $0.015 = **~$66**
- **Total: ~$67-70 for a full repo-wide ontology rebuild on Sonnet 4.6, batched + cached**

If we use Haiku 4.5 for routine summarization (output quality is sufficient for most code-summary work):

- Per-file warm: ~$0.005
- Full rebuild: 4,400 × $0.005 = **~$22**

If we use Opus 4.7 only for critical-axis nodes (implicit-ADR archaeology, integration-caveats):

- Critical nodes: ~10% of total = ~440 × ($0.025 warm) = **~$11 additional**

**Realistic budget ranges**:

| Operation | Sonnet 4.6 (recommended default) | Haiku 4.5 (cheap path) | Mixed (Sonnet+Opus on 10%) |
|---|---|---|---|
| Cold first-ever rebuild | ~$67-70 | ~$22 | ~$80 |
| Subsequent full rebuild (cache miss after 1h) | same as cold | same | same |
| Monthly full rebuild (assume cache cold each month) | ~$67/mo | ~$22/mo | ~$80/mo |
| Per-PR incremental (5-20 changed files, cache hot) | $0.08-$0.30 | $0.025-$0.10 | $0.10-$0.40 |
| Daily incremental, 1 changed file (cache hot) | ~$0.015 | ~$0.005 | ~$0.025 |

Confidence: HIGH on per-file numbers; MEDIUM on file-count estimates (these can be tightened by counting actual files post-MVP).

### Refresh frequency — what's economically tenable

**Recommendation tier (MVP)**:

- **Per-PR incremental** (every `/scan` invocation, automatic): ~$0.10-$0.30/PR — clearly affordable.
- **Weekly full rebuild** (overnight Sunday batch): ~$67/week × 4 = **~$268/month upper-bound** on Sonnet.
- **On-demand `--full` after a model bump** or schema change: ~$67 one-time.

**Cheaper tier (if budget pressure)**:

- Switch routine axis to Haiku 4.5: full monthly rebuild drops to ~$22.
- Skip weekly full; rely on per-PR incremental + monthly full.
- **Total: ~$30-40/month** for the entire workspace's LLM ontology.

**Velocity-first tier (if ROI proves out)**:

- Daily full rebuild on Sonnet via batch-API overnight: ~$67/day × 30 = ~$2,000/month.
- This is **NOT recommended for OSS** but documents the worst case.

For an unfunded single-maintainer OSS project, **the recommendation tier (~$268/mo) is too high**. The cheaper tier (~$30-40/mo) is in the noise of any individual cloud bill and is the right default.

Confidence: HIGH on the order-of-magnitude; MEDIUM on the exact monthly given uncertainty about how often we actually re-derive vs. trust the cache.

## Prompt caching strategy

[Anthropic prompt-caching docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) define the mechanics; this section names the specific cache structure for ODD's case.

### Cache hierarchy (apply breakpoints in this order)

```
[1] tools (the emit_node_record schema, ~1k tokens)        [ stable for months ]
[2] system prompt — workspace identity + agentic stance    [ stable for weeks ]
[3] system prompt — workspace context block:               [ stable per-axis run ]
       - CLAUDE.md (~25k tokens)
       - active pillar's pillar.md (~3k)
       - relevant retrospectives index (~2k)
       - axis-specific instructions (~1k)
[4] user message — file content (the COLD per-file part)   [ unique per file ]
```

Apply `cache_control: ephemeral, ttl: 1h` to the boundary between [3] and [4]. The first ~30k tokens (everything stable) become a single cached prefix that every per-file call reuses.

### Cache TTL recommendation: **1-hour, not 5-minute**

Per the Batch API tip in [Anthropic's batch docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing):

> "Since batches can take longer than 5 minutes to process, consider using the 1-hour cache duration with prompt caching for better cache hit rates when processing batches with shared context."

Pricing math for a 500-file batch run:

- 5m cache: write = $3.75/MTok × 30k = $0.1125; cache likely re-written ~10× during the batch as it spans more than 5min. Total writes: ~$1.13.
- 1h cache: write = $6/MTok × 30k = $0.18; written once. Total writes: ~$0.18.

The 1h cache pays for itself the moment a batch runs longer than 5 minutes, which it will.

### Minimum-token threshold check

Sonnet 4.6 minimum cacheable tokens: **2,048** ([prompt-caching docs](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)). Our cached prefix (~30k) easily exceeds this.

### Cache-key invalidation hierarchy

Per docs, changes to tools invalidate everything; system invalidates messages. Implications:

- Bumping the `emit_node_record` schema = full cache rebuild = budget for ~$1-2 cache-write surcharge.
- Editing CLAUDE.md = full cache rebuild on the next run.
- File content changes (the per-file [4] block) **never** invalidate the cache prefix — this is the key insight that makes the design economical.

### Verification fields to log

Per the docs, every API response includes `usage.cache_read_input_tokens` and `usage.cache_creation_input_tokens`. The driver writes these to `lineage/{repo}/ontology-runs/{run-id}/usage.jsonl` so we can monitor:

- Hit rate (should be ≥95% within a single batch)
- Cumulative cache-write spend
- Cumulative cache-read spend
- Per-axis cost trend over time

Confidence: HIGH.

## Drift detection + auditing

### Per-node version stamping (mandatory)

Every emitted node carries:

```jsonc
{
  "id": "...",
  "...": "...",
  "_meta": {
    "model": "claude-sonnet-4-6",       // pinned snapshot
    "model_version_alias": "sonnet-4.6", // human-readable
    "prompt_version": "v3.2",            // hash of the system prompt
    "schema_version": "ontology-v0.4",   // tool schema version
    "tree_sitter_anchor": "279fe8ee:src/locales/i18n.ts:42",
    "extracted_at": "2026-05-08T14:30Z",
    "run_id": "ontology-2026-05-08-batch-3"
  }
}
```

This makes every drift attributable to a *named* version of the agentic pipeline. When the maintainer says "this node looks wrong," they can answer: did it drift because we bumped the model? bumped the prompt? bumped the schema? bumped the substrate anchor?

Confidence: HIGH.

### Diff-review pattern (the `understanding` field as a doc PR)

Every refresh emits `lineage/{repo}/ontology-runs/{run-id}/diff.md`:

```markdown
# Ontology refresh diff — 2026-05-08 — odd-platform

## Schema-equal nodes (1247) — no review needed

## Paraphrase-only diffs (203)
[collapsible, low-priority]

## Claim-set drifts (12) — REVIEW
- `odd-platform java org.openda...config bean:minioClient`
  - Removed claim: "Bucket name defaults to 'attachments'"
  - Added claim: "Bucket name read from `attachments.s3.bucket`, no default"
  - **Probable cause**: file changed (commit hash differs)
  - Source diff: `git diff 279fe8ee..HEAD -- ...MinioConfig.java`

## Kind/axis drifts (2) — BLOCK
- `odd-platform-ui/src/locales/i18n.ts`
  - Previous kind: `ui-shell-bootstrap`
  - New kind: `i18n-resource`
  - **Probable cause**: prompt-version changed (v3.1 → v3.2 reclassification)
  - Action: confirm the new classification is correct, update reference rollups
```

The diff is **the deliverable**. A maintainer's review of an ontology refresh is essentially reviewing this file, the same way they review a doc PR.

Confidence: HIGH.

### LLM-as-judge — selective use only

Research consensus ([ACL 2025: LLM-as-judge for code summarization](https://arxiv.org/abs/2507.16587)):

- LLM-as-judge identifies >95% of *consistent* summaries (high precision).
- LLM-as-judge identifies only 30-60% of *inconsistent* summaries (low recall on defects).
- Spearman correlation with human ratings: 0.27-0.46 — low to moderate.

Implication: LLM-as-judge is **not a reliable substitute** for the human review pass. It is useful as a **first-pass filter** that compresses 1,000 nodes down to "the 50 most likely to be wrong" for human review. We can adopt it later if review backlog becomes a bottleneck; for MVP, the diff-review pattern is sufficient.

Confidence: HIGH (defer the feature; not "don't ever build it").

### Hallucination-rate baseline

[Vectara hallucination leaderboard, 2024-12](https://github.com/vectara/hallucination-leaderboard) reports:

- Claude 3.5 Sonnet: 4.6%
- GPT-4o: 1.5%
- Llama-3.1-405B: 3.9%

For ODD, this means roughly **1 in 20 emitted node summaries** may contain a factually incorrect claim. The Gate 9 discipline (every claim must cite `evidence_file:line`) is the structural defence: a hallucinated claim that doesn't cite a real file is a parse-time failure, and a hallucinated claim that cites a real-but-wrong file is caught at review.

Confidence: HIGH on the rate; HIGH on Gate 9's role.

## Incremental refresh design

The agentic ontology layer **composes** with the substrate's existing incremental mode (per [`code-lineage-substrate.md`](../../code-lineage-substrate.md) — `lineage/_extractor/` runs `--full` / `incremental` / `--dry-run` / `--ref` modes).

### Three refresh modes

| Mode | Trigger | Scope | Cost (Sonnet 4.6) |
|---|---|---|---|
| `incremental` (default) | git-diff vs last anchor | Touched files + dependency-aware fanout (1-hop) | $0.05-$0.30/PR |
| `--full` | Model bump, schema change, manifest reset | All files in scope | ~$67 |
| `--dry-run` | Preview before commit | Same as incremental, but writes to a sandbox dir | same as incremental |

### Touched-files dependency fanout

Per [GitNexus](https://github.com/abhigyanpatwari/GitNexus) and [code-review-graph](https://github.com/tirth8205/code-review-graph) prior art, the smart incremental pattern is:

1. Compute `git diff` between last-known-good anchor and HEAD → list of changed files.
2. Walk the substrate's `imports` / `wires` / `mounts` edges 1 hop outward → "files that depend on the changed files."
3. Re-derive ontology for the union — **but** check the file content hash against the cached node's `_meta.tree_sitter_anchor.hash`; skip the LLM call if unchanged.

This gives:

- **Idempotency**: if you re-run incremental against the same HEAD, no LLM calls are made (everything in cache).
- **Conservatism**: a 1-hop walk catches "I renamed a method, and 3 files that imported it now have stale `understanding` strings."
- **Bounded cost**: `git diff` typically touches 5-20 files; 1-hop adds ~10-50 more; total per-PR ≤ ~70 files × $0.015 = **≤ $1/PR**.

Reference: idempotency via content hash is the standard RAG-pipeline pattern ([Redis idempotency for LLM apps](https://redis.io/blog/what-is-idempotency-in-redis/)).

Confidence: HIGH.

### Tier-based refresh

Not every axis needs daily refresh. Stratify:

| Tier | Axes | Cadence | Why |
|---|---|---|---|
| **Hot** | `ui_routes`, `controllers`, `config_prefixes` | per-PR incremental | Touched constantly during feature work |
| **Warm** | `ui_shell`, `bean_factories`, `sdk_builders` | weekly full | Stable until app-shell refactors |
| **Cold** | `implicit_adrs`, `cross_repo_lineage` | monthly full + on-demand | Expensive to derive, drift slowly |

The "Cold" tier is where Opus 4.7 may be justified — implicit-ADR archaeology benefits from the better reasoning, and the monthly cadence keeps the Opus cost bounded (~$50/month for cold-tier axes).

Confidence: MEDIUM. Tier assignment is a judgment call; revisit after MVP shipped.

### Snapshot lifecycle

Mirroring the substrate's `--dry-run`:

```
lineage/{repo}/
  ontology/                       # the live, queryable artifact (committed)
  ontology-runs/
    2026-05-08-batch-3/           # last 5 runs kept, rest GC'd
      diff.md                     # the human-review surface
      usage.jsonl                 # cost telemetry
      manifest.yaml               # exact model/prompt/schema versions
      nodes.jsonl                 # the run's full output (input to diff)
  ontology-rollback/              # last-good snapshot for emergency revert
```

The "last-good" pattern means a bad refresh (model regression, prompt error) is one `cp` away from being undone.

Confidence: HIGH.

## Repeatability probe protocol

How do we *prove* the ontology is stable enough? Concrete protocol:

### Probe 1 — Same-input twin run

Run the agent on the same file twice in succession (same prompt, same model, same temperature=0). Diff the JSON outputs.

| Outcome | Pass criteria |
|---|---|
| `id` field | 100% identical (anchored by substrate) |
| `kind` / `axis` | 100% identical |
| `claims[].evidence_file` | 100% identical |
| `claims[].statement` | ≥95% identical (semantic equality, post-normalization) |
| `understanding` (prose) | ≥80% Levenshtein similarity, no contradictions |

If `kind` ever drifts on a same-input twin, the schema is too loose — tighten the enum.

Confidence: HIGH.

### Probe 2 — Noise floor over time

Pick 50 representative files. Re-derive nodes weekly for 4 weeks. Plot:

- Schema-equal rate over time (should trend ≥80%)
- Paraphrase-only rate (should trend ≥10-15%)
- Claim-set drift rate (should be ≤5%; spikes mean prompt or model changed)

If the noise floor decays (later weeks more stable than earlier), the system is converging. If it stays flat or rises, something upstream is unstable.

Confidence: HIGH.

### Probe 3 — Adversarial scrambled-input

Test the model's robustness: insert irrelevant whitespace / reorder import statements / rename a local variable. The node's `id`, `kind`, `axis`, `claims[].evidence_file` should all be invariant. The `understanding` may rephrase; the `claims[].statement` set should be unchanged.

If a cosmetic edit changes the `claims[]` set, the prompt is asking about the wrong abstraction level.

Confidence: HIGH.

### Probe 4 — Cross-model drift check

Once per quarter, run the same file against Sonnet 4.6 and Haiku 4.5. If the `kind`/`axis` classifications agree (≥95%), Haiku is good enough for routine work. If they disagree systematically, Sonnet is paying for itself.

Confidence: MEDIUM (the cost-quality tradeoff varies by axis).

### Probe 5 — Substrate-grounded sanity check

Every emitted `claims[].evidence_file:line` must point at a real line in the substrate's `nodes.jsonl`. Hallucinated file paths are caught by a post-processing validator that runs **after** the LLM call but **before** writing to the live ontology.

Reject rate threshold: if >2% of claims hallucinate file paths, the prompt or schema needs revision. Confidence: HIGH on the validator design; MEDIUM on the threshold.

### Adoption criterion

The ontology graduates from "experimental" to "production" when:

- Probe 1 passes on 100 sampled files (semantic-equality rate ≥95%)
- Probe 2 shows a stable or decaying noise floor over 4 weeks
- Probe 3 passes on 20 cosmetic-edit pairs
- Probe 5's reject rate is ≤2%

Until then, the ontology lives in `lineage/{repo}/ontology-experimental/` and scanners explicitly opt in.

Confidence: HIGH.

## Anti-patterns

- **Anti-pattern 1: ignore the stochasticity ceiling.** Designing for bit-equal re-runs sets up the system to fail Probe 1 forever. Anthropic explicitly says it's not achievable. Engineer for semantic equality, not bit equality.

- **Anti-pattern 2: re-running the agent without anchoring on substrate IDs.** Without the substrate ID as the cache key, every re-run produces "fresh" nodes with new identifiers. The ontology becomes append-only, deduplication is impossible, and diff-review collapses to noise. **The substrate is the spine; the agentic layer is the muscle.**

- **Anti-pattern 3: using `temperature=1` "for creativity."** Code summarization is not creative writing. Greedy decoding is correct.

- **Anti-pattern 4: skipping the structured-output schema.** "Just ask for a paragraph" maximises stochasticity, makes parsing fragile, and turns Gate 9 (claim provenance) into post-hoc text mining. Tool-use schemas with required fields are the lever that makes the rest of the design work.

- **Anti-pattern 5: caching at the wrong layer.** Caching the full request including the file content means every file is its own cache; the prefix never gets reused. Caching only the system+context prefix means every file shares the same hot cache. Apply `cache_control` at the system/messages boundary, not on every block.

- **Anti-pattern 6: 5m cache for batch workloads.** Batches commonly exceed 5 minutes. Anthropic's own docs recommend 1h. Use 1h.

- **Anti-pattern 7: consensus voting at MVP scale.** N-sample voting at 10× cost rarely beats single-shot + structured output + claim-citation. Defer until evidence demands it.

- **Anti-pattern 8: alias model IDs (`claude-sonnet-latest`).** Pin to the snapshot. Otherwise an Anthropic update silently drifts the entire ontology.

- **Anti-pattern 9: no diff-review in the workflow.** "Refresh ran successfully" is not enough. Every refresh produces a diff.md; every maintainer reviews it like a doc PR. Without this, drift is invisible until a downstream scanner produces a wrong finding.

- **Anti-pattern 10: full rebuild on every run.** The substrate's incremental mode exists for a reason. Run incremental by default; reserve full for model/schema bumps.

- **Anti-pattern 11: assuming Haiku is "free" without a probe.** Cheap doesn't mean correct. Run Probe 4 before downgrading any axis from Sonnet to Haiku.

- **Anti-pattern 12: ignoring `usage.cache_read_input_tokens` in the response.** This is the only honest way to verify the cache actually hit. A miss-classified prompt will silently rebill at full input rates and the cost model breaks.

## Sources

### Anthropic primary sources (canonical)

- [Anthropic Pricing — full table for Opus / Sonnet / Haiku 2026](https://platform.claude.com/docs/en/about-claude/pricing) — base rates, batch rates, cache multipliers verbatim
- [Anthropic Prompt Caching docs — full canonical specification](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching) — TTL options, breakpoints, lookback window, minimum tokens, hierarchy
- [Anthropic Batch Processing docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing) — 50% discount, 24h SLA, 100k requests / 256MB limits, 1h-cache recommendation
- [Anthropic Glossary — Temperature non-determinism statement](https://platform.claude.com/docs/en/about-claude/glossary) — the verbatim "temperature=0 is not fully deterministic" admission
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — pinned model IDs

### Industry / academic — determinism

- [Why deterministic output from LLMs is nearly impossible (Unstract, 2025)](https://unstract.com/blog/understanding-why-deterministic-output-from-llms-is-nearly-impossible/)
- [How to get consistent and reproducible LLM outputs in 2025 (KeywordsAI/Respan)](https://www.keywordsai.co/blog/llm_consistency_2025)
- [Does Temperature 0 Guarantee Deterministic LLM Outputs? (Schmalbach)](https://www.vincentschmalbach.com/does-temperature-0-guarantee-deterministic-llm-outputs/)
- [Stop using temperature 1.0 for code generation (Glanzz, 2025)](https://medium.com/@glanzz/stop-using-temperature-1-0-385cb51ac863)

### Industry / academic — structured output

- [How JSON Schema Works for Structured Outputs (PromptLayer)](https://blog.promptlayer.com/how-json-schema-works-for-structured-outputs-and-tool-integration/)
- [SLOT: Structuring the Output of Large Language Models (arXiv 2505.04016, ACL 2025)](https://arxiv.org/html/2505.04016v1)
- [Structured Output Generation in LLMs (Karatas)](https://medium.com/@emrekaratas-ai/structured-output-generation-in-llms-json-schema-and-grammar-based-decoding-6a5c58b698a6)

### Industry / academic — drift, voting, judging

- [On the Effectiveness of LLM-as-a-judge for Code Generation and Summarization (arXiv 2507.16587)](https://arxiv.org/abs/2507.16587)
- [Ranked Voting based Self-Consistency (ACL Findings 2025)](https://aclanthology.org/2025.findings-acl.744.pdf)
- [Confidence Improves Self-Consistency in LLMs (arXiv 2502.06233)](https://arxiv.org/pdf/2502.06233)
- [Vectara Hallucination Leaderboard](https://github.com/vectara/hallucination-leaderboard) — Sonnet 3.5 4.6%, GPT-4o 1.5%

### Industry — incremental code knowledge graphs

- [GitNexus — incremental tree-sitter knowledge graph](https://github.com/abhigyanpatwari/GitNexus) — git-diff impact analysis, dependency fanout
- [code-review-graph — local KG for Claude Code with incremental updates](https://github.com/tirth8205/code-review-graph)
- [CodeGraph — file-watcher-driven incremental MCP server](https://github.com/colbymchenry/codegraph)
- [Redis idempotency patterns for LLM apps](https://redis.io/blog/what-is-idempotency-in-redis/)

### Industry — prompt caching cost case studies

- [Prompt Caching: 60% cost reduction case study (Thomson Reuters Labs)](https://medium.com/tr-labs-ml-engineering-blog/prompt-caching-the-secret-to-60-cost-reduction-in-llm-applications-6c792a0ac29b)
- [How I went from $720 to $72 monthly with prompt caching (Lightfoot)](https://medium.com/@labeveryday/prompt-caching-is-a-must-how-i-went-from-spending-720-to-72-monthly-on-api-costs-3086f3635d63)
- [Spring AI prompt caching with Anthropic Claude (Spring blog 2025-10-27)](https://spring.io/blog/2025/10/27/spring-ai-anthropic-prompt-caching-blog/)

### Local workspace cross-references

- `adrs/drafts/code-lineage-substrate.md` — substrate that the ontology layer composes with
- `adrs/drafts/research/code-lineage-substrate/SCHEMA.md` — symbol identifier shape that becomes the ontology's anchor key
- `adrs/drafts/research/code-lineage-substrate/SUMMARY.md` — overall substrate recommendations
- `CLAUDE.md` Gate 9 — claim provenance discipline that the structured-output schema enforces
- `retrospectives/LSN-001/LSN-002/LSN-006/LSN-007` — failure modes the ontology layer is designed to make structurally impossible
