---
name: probe
description: Run the probe-driven validation rounds for the agentic ontology — Type 4 (adversarial — capability-negation / cross-product-fabrication / synonym-swap-with-negation, ≥2 of 3 PASS) and Type 6 (implicit-ADR confirmation — maintainer writes 5 ADRs they know are followed; ≥3 of 5 must surface in implicit-adrs.md top-10). Both rounds are MAINTAINER-AUTHORED; this skill is the protocol mechanics, not the answers.
argument-hint: --adversarial | --implicit-adrs | --status [<repo>]
allowed-tools: Read Grep Glob WebFetch Bash(ls *) Bash(jq *)
---

# Probe-driven validation (DOC-164 slice 8+)

The agentic ontology's MVP acceptance is **probe-driven**, not coverage-%-driven (per `adrs/drafts/research/agentic-code-ontology/PROBES.md`). Two rounds the maintainer authors and the skill executes:

- **Type 4 — Adversarial probes (per refresh).** Three maintainer-authored "capability negation" probes (capabilities that *don't* exist — synonym-swap-with-negation, cross-product-fabrication, or capability-negation). The ontology should answer "no" / return empty. ≥2 of 3 must PASS for the refresh to be accepted.
- **Type 6 — Implicit-ADR confirmation (per refresh, but lower frequency in practice — quarterly).** Maintainer privately writes 5 ADRs they know the codebase embodies. The skill compares against `lineage/{repo}/implicit-adrs.md`'s top-10 candidates. ≥3 of 5 must appear (semantically equivalent) for the implicit-ADR feature to be supported. <3 PASS = block ontology MVP acceptance.

This skill is **maintainer-driven** — the implementer cannot author probes (that defeats the adversarial-round design per LSN-013-class case-law: implementer-authored probes only test what the implementer expected the ontology to handle).

## Argument forms

| Form | Behaviour |
|---|---|
| `/probe --adversarial [<repo>]` | Capture 3 adversarial probes the maintainer types in. Run each against the ontology (`concepts.yaml` + `understanding/*.md`). Report ≥2/3 PASS or FAIL. |
| `/probe --implicit-adrs [<repo>]` | Capture 5 maintainer-written implicit ADRs. Compare semantically against `implicit-adrs.md` top-10 candidates. Report ≥3/5 PASS or FAIL. |
| `/probe --status [<repo>]` | Read-only. Print the last probe round's results + recommended next round date (per quarter or per-refresh). |

## Prerequisites

- `lineage/{repo}/concepts.yaml` exists (for adversarial probes — concept catalog is what gets queried).
- `lineage/{repo}/implicit-adrs.md` exists (for Type 6).
- Maintainer is in the session and ready to type the probes (this is interactive; the skill cannot synthesise probes).

## Protocol

### Round A — `/probe --adversarial`

#### Step 1 — Orient

- Read `adrs/drafts/research/agentic-code-ontology/PROBES.md` (Type 4 protocol)
- Note the 3 probe construction patterns the maintainer can choose from:
  - **Capability-negation** — take a real capability, flip a key attribute (e.g. real: "dark mode that toggles in toolbar"; flipped: "dark mode that ties to user profile-server-stored")
  - **Cross-product-fabrication** — combine two real concepts into a capability the codebase doesn't have (e.g. "OIDC-driven scheduled jobs that emit Prometheus metrics")
  - **Synonym-swap-with-negation** — replace a real concept's name with a related-but-different concept (e.g. "server-side i18n" — when only client-side exists)

#### Step 2 — Maintainer authors 3 probes

Use `AskUserQuestion` to capture each. Per-probe questions:

> 1. "Adversarial probe 1: name a capability the codebase does NOT have (a fabrication, negation, or synonym-swap of a real one). One sentence."
> 2. "Adversarial probe 2: same but a different fabrication pattern."
> 3. "Adversarial probe 3: third probe."

#### Step 3 — Verify each probe is genuinely fabricated

For each probe, Grep the substrate's `nodes.jsonl` and search the source repo for any literal/semantic match. If a probe accidentally describes a real capability, surface and ask the maintainer to revise.

#### Step 4 — Query the ontology for each probe

For each probe:
- Search `concepts.yaml` for an entity / operation matching the probe's wording.
- Sample 3-5 sidecars whose concepts most overlap with the probe's keywords; check if any sidecar's `understanding` / `concepts` would falsely confirm the fabricated capability.

Verdict per probe:
- **PASS** — no concept entry matches; no sidecar's `understanding` would falsely confirm. The ontology correctly returns "no such capability."
- **PASS+** — empty result + an explanatory `null`-cause field ("no node matches: combinations of axes X and Y are not represented")
- **FAIL** — confident match to a real-but-different concept (false-positive hallucination)
- **CRITICAL FAIL** — match to a fabricated node not present in `nodes.jsonl`

#### Step 5 — Report

- Per-probe verdict + 1-line rationale
- Aggregate: `<N>/3 PASS`
- Acceptance criterion: ≥2/3 PASS for the refresh to be accepted; <2 = the maintainer iterates the file-analyser / concept-merger prompts to fix the hallucination class
- Append the round to `lineage/{repo}/probe-rounds.yaml` (creates if missing) for historical tracking

### Round B — `/probe --implicit-adrs`

#### Step 1 — Orient

- Read `adrs/drafts/research/agentic-code-ontology/PROBES.md` Type 6
- Read existing `lineage/{repo}/implicit-adrs.md` to surface its top-10 candidates

#### Step 2 — Maintainer writes 5 implicit ADRs

Use `AskUserQuestion` to capture (or invite the maintainer to type into a temp file). Each ADR: one sentence + 2-3 example file:line citations.

> "Write 5 implicit ADRs you know the ODD codebase embodies — patterns followed across the codebase that no `adrs/` file documents yet. One sentence each + 2-3 file:line citations from memory or quick check. The skill compares against the auto-generated implicit-adrs.md top-10."

#### Step 3 — Compare against implicit-adrs.md top-10

For each maintainer-written ADR:
- Read `implicit-adrs.md`'s candidates list. For each candidate, check semantic equivalence against the maintainer's ADR (similar decision_statement; matching file:line citations).
- Verdict per maintainer ADR:
  - **PASS** — appears in the top-10 (semantically equivalent, even if phrased differently)
  - **PARTIAL** — appears outside top-10 but in the candidates list (the ontology saw it, just didn't rank high)
  - **FAIL** — does not appear at all (extractor gap; the file-analyser prompts need refinement)

#### Step 4 — Report

- Per-ADR verdict + 1-line rationale
- Aggregate: `<N>/5 PASS`
- Acceptance criterion: ≥3/5 PASS for the implicit-ADR feature to be supported. <3 = block ontology MVP acceptance per ADR's PROBES section.
- Append to `lineage/{repo}/probe-rounds.yaml`

## Rules

- **Maintainer authors; implementer cannot.** The implementer (Claude in this session) must NOT autocomplete or suggest probes. `AskUserQuestion` captures verbatim from the maintainer; the implementer's only role is to verify the probe is genuinely fabricated (Round A) or compare against the ontology (Round B).
- **Probe history persists.** Every round appends to `lineage/{repo}/probe-rounds.yaml` with date, probes, verdicts, aggregate. This builds the regression record per `PROBES.md`'s "caught bugs become permanent regression probes."
- **Don't grade silently.** Verdicts ALWAYS surface to the maintainer; the skill never auto-accepts an ontology refresh based on a probe round.

## Cross-references

- Probe spec: `adrs/drafts/research/agentic-code-ontology/PROBES.md`
- Substrate-level probes (existence-of-capability): `lineage/PROBES.md`
- Concept catalog: `lineage/{repo}/concepts.yaml` (queried by Type 4)
- Implicit-ADRs catalog: `lineage/{repo}/implicit-adrs.md` (compared against by Type 6)
- ADR: `adrs/drafts/agentic-code-ontology.md` rev 2 — Validation section + slice 8
