---
id: LSN-036
title: A cross-cutting i18n regression reached main because the methodology CATALOGUED the gap (PLT-011 rejected + PLT-215 filed the SAME day) but never PROMOTED the invariant to an enforced gate — and no one diffed the running UI vs the released baseline. Knowing != preventing.
date: 2026-06-14
domain: methodology / i18n / triage-and-gates
severity: high
gates_informed:
  - pillars/contributor/gates.md (G-C2 — behavior-diff-vs-released for cross-cutting / dependency changes)
  - playbooks/claim-inventory.md (Gate 9 — a rejection/dismissal is a claim; its load-bearing premise must be verified against open sibling findings)
  - playbooks/follow-up-on-disk.md (a cross-cutting invariant defect must PROPOSE an enforced check — CI guard / IT — not only a backlog item)
  - issues/odd-platform/PLT-011.md (reopened), issues/odd-platform/PLT-215.md (escalated, CI key-parity guard = lead fix)
status: closed
---

## What happened

During the CTRIB-011 re-review the maintainer spot-checked the Data Quality dashboard and found the filter
placeholders rendering **"Buscar por nome"** (Brazilian Portuguese) under the English UI — and under every
non-Brazilian locale. My first response dismissed it as "already tracked by PLT-215, out of scope." That was
wrong twice over, and the failure is a methodology failure, not a one-off.

**The bug.** `t('Search by name')` (DQ filters / catalog Search / Terms) is a key `en.json` does not define.
Commit `8b0155f7` ("feat brazilian portuguese translation", #1564) added `br.json` AND inserted `br` into
`fallbackLng: ['en','es','br','ch','fr','ua','hy']`. i18next resolves `[activeLang, en, es, br, ...]`; for a
key absent from `en` (and `es`) but present in `br`, the chain resolves at **`br` -> Portuguese for every
user.** At 0.27.13 (`ede5d277`, no `br` in the chain) the same key rendered the raw English key. So it is a
**regression**; scripted blast radius = 4 rendered strings (`Search by name`, `Query`, `Query examples`,
`Relationships`); unreleased; ships in 0.28.0.

## Why every gate missed it (the real lesson)

The methodology HAD the knowledge and never turned it into prevention:

- **PLT-011** (2026-06-10) named the exact trigger condition — *"the only way to surface a non-English
  fallback string would be a key missing from `en.json` but present in `es`/`ch`"* — and **rejected it as
  impossible** on the premise *"en.json is the most-complete catalogue."*
- **PLT-215** (filed the SAME DAY) documented **70 `t()` keys missing from `en.json`** — the precise
  falsification of PLT-011's premise.
- The two halves of the proof sat in the backlog together and **were never joined.** The docs even recorded
  the gap as a multilingual-ui "known caveat." All of it was PASSIVE knowledge — a rejected issue, a filed
  issue, a doc caveat, an ontology facet (mis-counted 5x). **None was an enforced gate that fails a build, a
  merge, or a release.**
- No one ran the cheapest regression test that exists — `git show <release-tag>:<file>` + open the running UI
  in English — when ingesting the dependency PR (#1564) that flipped the behaviour.

**Root cause: the methodology over-invests in CATALOGUING drift and under-invests in ENFORCING invariants.
Knowing != preventing.** The agent (me) reproduced the same shape at the human layer: on the report I reached
for the catalogue ("tracked, out of scope") instead of the verification (regression-diff -> root-cause ->
blast-radius script).

## The three rules this installs

1. **Behavior-diff-vs-released for cross-cutting / dependency changes.** Any change — ours OR a merged
   dependency's — that touches a cross-cutting surface (i18n, theming, routing, auth posture) is reviewed
   with a running-system diff vs the latest release (`git show <tag>:<file>` + drive the UI), not only a
   static key/line diff. -> `pillars/contributor/gates.md` G-C2.
2. **A catalogued cross-cutting invariant must be PROMOTED to an enforced check.** When a scan/triage
   catalogues a defect in a cross-cutting invariant ("no foreign-language leak"; "every `t()` key resolves
   to en"), the follow-up must PROPOSE the enforced check (a CI guard or an IT), not only a backlog item +
   a doc caveat. A finding that merely predicts the bug has not prevented it. -> `playbooks/follow-up-on-disk.md`.
3. **A rejection's load-bearing premise is a claim — verify it against open sibling findings.** Before
   rejecting/closing a finding, the premise it rests on ("en is complete") must be checked against the open
   backlog (PLT-215 said otherwise). Gate 9 applies to rejections, not only to authored claims. ->
   `playbooks/claim-inventory.md` Gate 9.

## The deterministic fix (tracked separately)

The structural prevention is code, not process: a **CI key-parity guard** (fail the build when a `t('literal')`
key is absent from `en.json`) + `fallbackLng: 'en'` (a fallback chain routed through other locales IS the
leak) + completing `en.json` + an i18n-leak IT. Tracked: PLT-011 (reopened), PLT-215 (escalated, guard = lead
fix); the contributor code-fix is drafted as a GATE-1 plan (CTRIB-012).

## See also

[[feedback_regression_vs_released_baseline_and_i18n_fallback]] (memory), LSN-031 (verify the running system,
not the diff), LSN-009 (grep-the-backlog-first — the dual is "join sibling findings before rejecting").
