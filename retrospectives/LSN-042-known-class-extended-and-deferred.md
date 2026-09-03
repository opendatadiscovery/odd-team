---
id: LSN-042
title: A known defect class was EXTENDED by the very slice that catalogued it — every role saw that a saved search would drop the new Favorites filter, every role deferred it as "pre-existing / not this slice's", and the disclosure reached the maintainer only as a footnote saying "reported separately" (nothing was filed). He found it on the first manual test of the merged feature.
date: 2026-09-03
domain: contributor / methodology
severity: high
gates_informed:
  - pillars/contributor/gates.md (G-C5 — the class-extension clause; G-C13 — no sibling surface left inconsistent)
  - playbooks/spec-gate.md (the Consistency-keeper lens; ADR invariants checked at system level)
  - playbooks/design-before-build.md (impact dimension — every representation of the state)
  - .claude/agents/plan-checker.md (D4 class-extension deferral phrases = BLOCKER; D6 system-level ADR invariants)
  - playbooks/follow-up-on-disk.md (the class-extension rule; feature-consistency invariants are cross-cutting)
  - playbooks/stream-coordination.md (opposite decisions on one invariant by co-active streams = a GATE-1 decision)
  - issues/odd-platform/PLT-256.md (widened to the class; the round-trip contract test leads the acceptance)
status: closed
---

# LSN-042: the slice knew, everyone knew, and it shipped anyway

## What happened

On 2026-09-03 the maintainer merged odd-platform#1875 (ST-7, the Favorites filter on the unified search,
`96d77668`) and, on the first manual test, found that **"Save current search" does not keep the Favorites
filter**: reapplying the saved search navigates to a URL without `favorites=yes`, the toggle shows off, the list
is the whole catalog. The cause is a contract gap: `SavedSearch.spec` is typed `SearchFormData`
(`components.yaml:2587`), while `favorites` — like ST-4's `asset_kinds` — lives only on `AssetSearchFormData`
(`:476,:480`); both capture (`searchUrlStateToFormData`, `searchUrlState.ts:366`) and reapply
(`searchFormDataToUrlState`, `:422`) drop it, and the server deserialises the stored jsonb into
`SearchFormData.class` (`SavedSearchServiceImpl.java:108`), so even an API client loses the field. Verified by a
round-trip on the ST-7 stack: a spec posted with `favorites:true` + `asset_kinds:[TERM]` was stored with neither.

**This was not a miss. It was seen by every role and deferred by every role.** The trail, in order:

| When | Who | What they saw | What they did |
|---|---|---|---|
| 2026-06-30 | the ADR + decomposition | D11: the saved row holds *"the same param spec D10 encodes — one canonical spec, two surfaces"*; the roadmap: the saved `spec` jsonb *"extends additively when the core (ST-4) lands"* | the invariant was written down |
| 2026-07-06 | ST-4 (CTRIB-056, #1838) added `asset_kinds` as a URL-only dimension on `AssetSearchFormData` | nothing — zero mentions of saved search in the record | the first instance shipped; the roadmap's "extend the saved spec" requirement was carried by no slice |
| 2026-08-30 | ST-7 design read (CTRIB-061 §11) | the whole class — "any further URL-only dimension inherits this gap by construction" | logged **PLT-256** as a paste-ready draft for the `asset_kinds` instance; classified *"pre-existing, not caused by ST-7, out of scope (G-C5)"* |
| 2026-08-30 | `odd-sme` (Q4.4 "Nameability") | *"verify at ST-3 that the favorites scope is saveable"* | mis-sequenced (ST-3 had shipped on 07-05) and self-classified *"cross-slice note, not ST-7 scope"* |
| 2026-08-30 | CTRIB-061 §6.3 | *"a saved search should be able to hold the favorites scope. It cannot today"* | filed under the heading **"no decision needed"**; no `R`-line in the spec; not one of the two GATE-1 decisions |
| 2026-08-30/31 | plan-checker, three adversarial rounds | 13 blockers on other things | never asked whether the new dimension flows through every representation of search state; D6 checked slice-local ADR conformance, not the D11 invariant |
| 2026-08-30 22:41 | the public scope comment on #1841 | last paragraph: *"reported separately ... A Favorites filter will be dropped by a saved search for the same reason until it is fixed"* | "separately" = a disk draft the bot cannot file; from GitHub's side nothing was reported |
| 2026-08-31 | GATE 1 (the maintainer) | two decisions: toggle shape, ordering split | the inconsistency was not put to him as a decision |
| 2026-09-01 | ST-8 (CTRIB-062), co-active, same contract | *"ST-7 puts `favorites` on `AssetSearchFormData` ... so it will not be captured into a saved search; ST-8 puts `my_data` on `SearchFormData`"* — ST-8 made the saved round-trip a `must_have` truth for ITS dimension | *"One noted difference, deliberately not harmonised here ... not ST-8's to fix and not a blocker for either slice"* |
| 2026-09-02 | PR #1875 body | *"Saved searches will not capture this filter ... pre-existing, reported separately"* | disclosed as a bullet among nine |
| 2026-09-03 | `/review`, two rounds | PLT-256 *"verified present on disk and ASCII-clean"* | round 2: **"Nothing in the product behaviour is wrong."** |
| 2026-09-03 | GATE 2 + first manual test | the toggle turns itself off on reapply | found by the maintainer, not by us |

## Why it slipped

Six mechanisms, each individually reasonable, together guaranteeing the outcome:

1. **G-C5 has no notion of a class the slice EXTENDS.** Scope discipline says a discovered adjacent defect routes
   to a follow-up. That is right for a defect the slice *finds* and wrong for one the slice *adds an instance of*.
   ST-7 did not find a bug beside its work; it built a fourth filter that the product's own saved-search feature
   would not hold, and called the resulting inconsistency "consistent with shipped behaviour". *Pre-existing* is a
   description of the cause, not a verdict on scope.
2. **The disclosure channel was a footnote, not a decision.** The pause-and-ask rule fired correctly on the two
   product trade-offs the issue was silent on, and correctly did NOT fire on an inconsistency the run had already
   decided was out of scope. Once §6.3 said "no decision needed", every downstream artefact (scope comment, PR
   body, review) inherited that classification. The maintainer approves what he is asked; he was not asked.
3. **"Reported separately" pointed at nothing.** The bot is policy-barred from filing issues, so PLT-256 existed
   only on disk. Two public comments and the PR body told the maintainer it was tracked. No GATE-1 packet handed him
   the draft to file. The follow-up mechanism has no forcing function between `draft` and `filed`, and the public
   thread is allowed to claim a tracker that does not exist.
4. **The spec asked "what is out of scope?", never "where else does this state live?".** Spec-gate's boundary
   lens is a *Boundary-keeper* whose output is a `Deferred` list; design-before-build's impact checklist asks for
   every consumer of a changed *signature*. Neither asks for every *representation* of the state a change extends
   (URL, saved spec, share link, deep link, panel). The URL got a requirement (R7) because #1858 had burned us; the
   saved spec got nothing because nothing had burned us yet.
5. **ADR compliance was checked slice-locally.** §5(b) cited D10/D11 and passed: `favorites` is a URL param, so
   D10 holds. Nobody asked whether *the system* still satisfied D11's invariant ("one canonical spec, two surfaces")
   after the slice. It did not, and had not since ST-4 — the ADR's own roadmap line ("the spec extends additively
   when the core lands") was assigned to no slice's spec, so G-C18's 100 % requirement coverage was 100 % of the
   slice specs, not of the ADR.
6. **Diffusion across parallel streams.** ST-7 and ST-8 ran the same week on the same contract and took opposite
   decisions on the same invariant (ST-8: saved round-trip is a `must_have`; ST-7: follow-up). ST-8 recorded the
   divergence and declared it nobody's. Two streams that each correctly decide "not mine" produce a system in which
   it is no one's — and no rail surfaces a cross-stream divergence on one invariant as a decision.

The precedent was already on file: LSN-036 ("knowing != preventing") installed the rule that a cross-cutting
invariant defect must lead with an enforced check. PLT-256 led with a description and a suggested contract
change; no test asserted "every search dimension round-trips through a saved search", so the next instance had
nothing to fail against. The rule was not applied because "a search dimension is saveable" was not recognised as a
cross-cutting invariant — the rule's examples were all platform-level (i18n, 500s, config defaults).

## Rules that emerged

1. **G-C5 — the class-extension clause.** Out-of-scope routing applies to a defect the slice *finds*, never to
   one it *extends*. A slice that adds an instance of a known-broken class owns the class: fix it in-slice (widen
   the contract), or put the knowingly-inconsistent ship to the maintainer as a plain-language GATE-1 decision with
   its user-facing consequence. Any public "reported / tracked separately" must link the GitHub issue; when the bot
   cannot file it, the GATE-1 packet hands the maintainer the paste-ready draft to file as part of approving, and
   the scope comment posts only once the URL exists. → `pillars/contributor/gates.md` G-C5.
2. **Spec-gate — the Consistency-keeper lens + system-level ADR invariants.** For every state a change touches,
   enumerate every representation of it (URL, stored spec, share/deep link, panel deep-link, API request object,
   export); each is a requirement with an acceptance line or an explicit GATE-1 decision. Then re-check the cited
   ADR's stated invariants against the system *after* the change, not the slice's local conformance.
   → `playbooks/spec-gate.md` §3; `.claude/agents/plan-checker.md` D6.
3. **Design-before-build — "every representation of the state" is an impact dimension.** A dimension added to one
   representation and not the others is a defect shipped, not a dimension deferred. → `playbooks/design-before-build.md`.
4. **Plan-checker D4 — class-extension deferral phrases are scope reductions.** `pre-existing`, `not caused by
   this change`, `inherits by construction`, `consistent with shipped behaviour`, `reported separately`, `not this
   slice's to fix`, `PLT-NNN fixes both`: when the slice adds an instance of the class being deferred, BLOCKER
   unless a GATE-1 decision presents the inconsistency. → `.claude/agents/plan-checker.md`.
5. **Follow-up-on-disk — feature-consistency invariants are cross-cutting; a follow-up may not defer a class the
   change extends.** The logged item leads with the round-trip contract test that would have caught the next
   instance (LSN-036's rule, now with a feature-level example). → `playbooks/follow-up-on-disk.md`.
6. **G-C13 / review — no sibling surface left inconsistent.** "Nothing in the product behaviour is wrong" may be
   written only after the new dimension has been driven through every representation of its state. A new instance
   of a tracked class is a defect IN the diff, not a harness finding (this refines `feedback_review_blocks_only_on_the_diff`,
   it does not contradict it). → `pillars/contributor/gates.md` G-C13.
7. **Stream-coordination — opposite decisions on one invariant are a GATE-1 decision.** When co-active streams
   touch one contract and diverge on one invariant, the divergence is put to the maintainer, never recorded as
   "deliberately not harmonised". → `playbooks/stream-coordination.md`.

The deterministic prevention is code: PLT-256 (widened to both filters, severity high, verified on the running
stack) now leads its acceptance with a fully-populated `SearchUrlState` → save → reapply deep-equality test, so
any future URL-only dimension without saved-search support goes RED at unit level.

## Forcing question

*"This change adds a dimension to a state that lives in more than one place — which representations of that
state did I NOT extend, and did the maintainer decide that, or did I?"*

## References

- `contributor/CTRIB-061.md` §6.3 ("Nameability ... no decision needed"), §11 (the PLT-256 row: "out of this
  slice's approved scope (G-C5)"), the scope comment (issuecomment-5471707666, last paragraph), review round 2
  ("Nothing in the product behaviour is wrong")
- `contributor/CTRIB-062.md` "One noted difference, deliberately not harmonised here"; its `must_haves` truth
  "a NEW saved search carrying a My-data scope reapplies with that scope intact" — the same invariant, honoured
  by the sibling slice
- `contributor/CTRIB-056.md` — ST-4 introduced `asset_kinds` with zero saved-search mentions
- `lineage/odd-platform/sme-consultations/2026-08-30-favorites-tab-to-filter-ia.md` Q4.4
- `adrs/drafts/unified-asset-search.md` D10/D11 ("one canonical spec, two surfaces"); `state/search-overhaul-decomposition.md:63,92`
  ("extends additively when the core lands")
- odd-platform `origin/main @ 96d77668`: `components.yaml:466-491, 2574-2587, 2614-2623`; `searchUrlState.ts:366-460`;
  `SavedSearchForm.tsx:70`; `SavedSearches.tsx:43,57`; `SavedSearchServiceImpl.java:94-108`
- PR odd-platform#1875 body ("pre-existing, reported separately"); issue #1841 comments 5471707666 + 5511701855
- `issues/odd-platform/PLT-256-saved-search-drops-asset-type-filter.md` (widened 2026-09-03)
- Related: LSN-036 (knowing != preventing — the rule this incident failed to apply), LSN-009 (grep-the-backlog-first — its
  dual: a tracked item is not a scope verdict), LSN-040 (the front-of-loop this extends), memory
  `feedback_converge_claim_complete_not_instance_loop`, `feedback_linus_torvalds_engineering_bar`
