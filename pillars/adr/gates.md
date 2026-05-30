---
pillar: adr
file: gates
status: active
since: 2026-05-30
---

# Quality Bar gates — ADR pillar

The gates every ADR change passes. The universal gates (Pre-authoring stance, duplication-sweep, consumer-read, claim-inventory, live-site-verification, follow-up-on-disk) have executable PROTOCOL form in `playbooks/` and are cited by reference, exactly as the documentation pillar does. The ADR-specific gates (A1-A4) are stated in full here. Published ADRs are doc pages in `../documentation`, so the documentation pillar's Gate 8 + the ≤200-char description rule + the YAML-parse pre-commit check also apply.

The gates are not a checklist to skim — they are the floor. The Pre-authoring stance check fires them *before* authoring; `/review` verifies them *after*.

---

## Pre-authoring stance check

Before authoring an ADR page, run `playbooks/pre-authoring-stance.md`. The five questions, specialised for this pillar:

1. **What content type is this?** — a ratified decision (→ ADR page) or a gap (→ refactoring-scopes / backlog / upstream issue)?
2. **Where is its canonical home?** — `architecture-decision-log/ADR-NNNN-{slug}.md`; new page, extend, or reconcile-drift (the three outcomes in `canonical-homes.md`)?
3. **Where does it sit in the SUMMARY taxonomy?** — under Developer Guides → Architectural Decision Log; the log index row + SUMMARY entry ship with the page.
4. **Does this preserve the WHY?** — does the ADR capture the real force the code embodies, descriptively, without inventing intent?
5. **Would I be ashamed to see this quoted back to me by a core-team architect** as a decision they never made?

If any answer is unclear, stop and resolve it before writing.

---

## Universal gates (by reference)

- **Duplication sweep** → `playbooks/duplication-sweep.md`. Sweep the existing decision log, the new content, and the backlog before authoring. ADR specialisation: search the log index and `implicit-adrs.md` for the same decision; if an ADR already covers it, extend it (outcome 2) rather than create a second. Case-law: `LSN-009` (backlog-internal duplication).
- **Consumer-read before authoring** → `playbooks/consumer-read.md`. Every runtime claim traces to the code that enforces it. ADR specialisation: read the consumer/builder/handler that embodies the decision before describing it — the `Evidence` citations come from this read. Case-law: `LSN-005` (consumer-read discipline).
- **Factual claim provenance** → `playbooks/claim-inventory.md`. Every claim cites a canonical source in the commit's `Sources:` footer. Banned phrases ("defensible", "probably correct", "looks right", "safe to assume", "presumably", "should be") require `VERIFIED via {fetch/grep/read}` or `NOT VERIFIED → log as DOC-NNN`. Case-law: `LSN-013`.
- **Live-site verification** → `playbooks/live-site-verification.md` (documentation Gate 8). After merge, WebFetch the published ADR page + the log index on `docs.opendatadiscovery.org`; for the meta `description`, `curl -sL` the raw HTML head. Case-law: `LSN-028` (YAML parse error stalled GitBook sync).
- **Follow-up on disk** → `playbooks/follow-up-on-disk.md`. Any gap, drift, or adjacent issue discovered while authoring becomes a tracked artefact (backlog item / refactoring-scope / upstream issue), never a conversation-only note.

---

## Gate A1 — Wisdom-test confirmation

The candidate passes the adr-archaeologist 3-question wisdom test, and the published ADR cites that verdict. A gap masquerading as a decision is rejected.

**What this demands:**
- The candidate's `implicit-adrs.md` entry shows Q1 (deliberate choice + rationale), Q2 (structural impact), Q3 (still load-bearing) all answered yes.
- The ADR item records that verdict; if the candidate fails any question, it is not an ADR — route it to refactoring-scopes / backlog (Cornerstone 2).

**Case-law:** `LSN-013` (gap-vs-decision discipline).

---

## Gate A2 — Code-evidence present & verified

Every claim in Context / Decision / Consequences cites a `file:line`, **re-verified by the implementer** against the substrate commit — not trusted from the sidecar. The `realises:` frontmatter is populated from these loci.

**What this demands:**
- Each cited `file:line` is opened and confirmed to still embody the claim at the substrate commit (a stale citation means the decision is no longer load-bearing → fails Gate A1).
- `realises:` lists every code locus the decision governs; the same loci appear in the body `Evidence` section.

**Case-law:** `LSN-005` (consumer-read), `LSN-002` (claims that must trace to the builder).

---

## Gate A3 — Descriptive-framing check

The ADR reads as reconstructed-from-code: no prescriptive / decree language, no invented intent, no security-exploit disclosure.

**What this demands:**
- Voice is "the platform does X because Y, as `<file:line>` shows" — not "we must" / "going forward we will".
- Inferred rationale is marked as reconstructed, never asserted as the core team's stated intent.
- Security findings do **not** become ADRs — route them via the issues / responsible-disclosure flow (PLT upstream), as the documentation pillar does.

**Case-law:** `LSN-001`, `LSN-002` (sensitive defaults — disclosed responsibly, not narrated publicly).

---

## Gate A4 — Ontology frontmatter complete

`adr_id`, `promoted_from`, `realises`, `status`, and `description` are present and well-formed, so the extractor can project the `ADR` node + `PROMOTED_TO` / `REALISES` / `SUPERSEDED_BY` edges.

**What this demands:**
- All required keys present; `status` is one of `proposed | accepted | superseded | deprecated`.
- `promoted_from` names a **real** `ADR-CANDIDATE-NNN` that exists in `implicit-adrs.md`.
- `realises` is non-empty and matches the body `Evidence`; `superseded_by` is set only when `status: superseded`.
- `description` ≤200 chars, no `: ` colon-space YAML hazard (the documentation pillar's PyYAML pre-commit + bash fast-fail regex apply).

**Case-law:** `LSN-028` (YAML hazard halts GitBook sync), `LSN-006` (content homed to its one place).

---

## Reused documentation-pillar gates

- **Gate 8 — Live-site verification** (above, by reference) — published ADRs are GitBook pages; build-time and live-render are not the same system.
- **≤200-char description** + **YAML-parse pre-commit check** — the same GitBook hazards apply to ADR page frontmatter.
- **Gate 11 — Audience isolation.** ADRs are developer-facing, so code references and odd-platform class names **are** allowed. But workspace-internal jargon must **not** appear on the published page: no `DOC-GAP`, `REFACTOR-NNN`, `ADR-CANDIDATE-NNN`, "sidecar", subagent names, or backlog IDs. The candidate id lives in `promoted_from:` frontmatter (machine-read), never in the rendered prose.

---

## The gates in one line each

- Pre-authoring stance check (5 questions) before writing.
- Duplication sweep / consumer-read / claim-inventory / live-site / follow-up (universal, by reference).
- A1 — Wisdom-test confirmed; gaps rejected.
- A2 — Code `file:line` evidence present and re-verified; `realises:` populated.
- A3 — Descriptive framing; no decree, no exploit disclosure.
- A4 — Ontology frontmatter complete + well-formed; `promoted_from` is real.
- Gate 8 live-site + ≤200-char description + YAML-parse check + audience isolation (reused).
