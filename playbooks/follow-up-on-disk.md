---
playbook: follow-up-on-disk
status: active
since: 2026-04-22
applies_to: universal
---

# PROTOCOL follow-up-on-disk

Every discovered bug, gap, or adjacent issue is logged as a tracked artefact on disk — never narrated in conversation. The backlog and the issues directory are the source of truth; conversation-only notes do not survive across sessions.

## trigger

Any phase (`/scan`, `/triage`, `/implement`, `/review`) discovering a bug, gap, or adjacent issue not in the current item's scope.

## inputs

- the discovery — bug description, affected files, scope category
- the originating context — current item ID, current branch, current phase
- the active pillar's backlog directory + issues directory

## procedure

1. **Grep the backlog first.** Run `playbooks/duplication-sweep.md` step 3:

   - Search by title keywords, affected files, and `scanner_source` across `backlog/{cat}/`.
   - If an existing item already covers the concept (possibly in richer form), extend its acceptance criteria; do **not** create a parallel item.

   Skipping this step caused `retrospectives/LSN-009-backlog-internal-duplication.md` (a proposed DOC-062 was already covered by DOC-042 in richer form).

2. **Classify the scope of the discovery.**

   | Scope | Action |
   |---|---|
   | **Trivial + related** (typo next door, obvious whitespace) | Fold into the current commit; note in commit body. |
   | **Small + fits the batch** (related work, same target repo, no file conflicts) | Create a new work item (`backlog/{cat}/DOC-NNN.md`); update `state/file-registry.yaml`; update `state/PROGRESS.md`; implement in the same batch; reference in the originating item's Context. |
   | **Larger or unrelated** | Create the work item with full frontmatter and `scanner_source: "discovered-during-{originating-ID}"`; update `state/file-registry.yaml`; update `state/PROGRESS.md`. **Do not implement** — the triage-review gate still applies. Log everything needed for a cold-start implementer. |
   | **Upstream code defect** (defect or gap in code we don't directly maintain in this workspace — `odd-platform`, `odd-collectors`, the spec, charts, etc.) | Create a paste-ready GitHub issue draft at `issues/{repo}/{PREFIX}-NNN.md` via `/log-issue` (see `issues/README.md`). The doc-side caveat — if any — ships in the current backlog item now; the upstream fix is handed off via the issue draft. The originating backlog item gains a `## Platform-side follow-up filed` section pointing at the draft path. Filing the draft into GitHub is **always** a deliberate human action, never automated — drafts can be queued freely, but `draft → filed` is a manual paste-and-submit. |

3. **Author the artifact — scoped to completeness.**

   **Full-scope rule (the logged item carries the whole class, not a pointer).** A finding about a *factual claim* — a config default, an endpoint path, a security posture, a version, a runtime behaviour — almost never lives on one page. Before writing the item: sweep the **whole** doc tree for the claim's key terms (`grep -rniE '{claim terms}' ../documentation/docs/`), enumerate **every** surface that carries it with `file:line` + the verbatim passage in `affected_files` + the Description, and verify the canonical fact against code **once**. The implementer must receive the complete class, not one instance — a logged item that names one surface when five carry the claim guarantees the fix → review → log → fix loop, because the surviving surfaces resurface a review later. The enumerated surface list is the implementer's one-commit scope; the review then confirms a re-sweep returns zero residue. **Canonical failure: the DOC-308 → DOC-310 chain (2026-05-29)** — the review that logged DOC-308 scoped it to one page (`odd-platform.md`) while the same phantom `/actuator/env` `show-values=WHEN_AUTHORIZED` claim lived on four more published pages; the incomplete-scope logging forced a second fix item (DOC-310) and another full review pass. The thoroughness a review already spends *finding* an issue must extend to *scoping* what it logs.

   **Cross-cutting-invariant rule (propose the gate, not only the item).** If the discovery is a defect in a CROSS-CUTTING INVARIANT — a property no single feature owns (`"no foreign-language i18n leak"`; `"every t('literal') key resolves to en"`; `"no endpoint 500s on a metacharacter"`; `"every shipped config default is non-destructive"`) — the logged item must LEAD with the **deterministic enforcement that would have caught it** (a CI guard, a parity check, an integration test) as its first acceptance criterion, not merely describe the defect. A backlog item + a doc caveat are PASSIVE knowledge: they predict the bug, they do not prevent it — *knowing != preventing*. **Canonical failure: LSN-036 (2026-06-14)** — the i18n Portuguese-leak was catalogued three ways (PLT-011 rejected, PLT-215 filed, a multilingual-ui doc caveat) and shipped to main anyway because none was an enforced gate; the fix item now leads with a CI key-parity guard.

   - For backlog items: full frontmatter (id, title, status: pending, priority, effort, target_repo, affected_files, scanner_source), Context block, Acceptance Criteria, Notes for implementer.
   - For issue drafts: paste-ready body with reproduction, expected vs actual, suggested fix options, references back to the originating odd-team item.

4. **Update `state/PROGRESS.md`** counts (`pending +N`, `total +N`, etc.) and any active dashboard sections.

5. **Update `state/file-registry.yaml`** if the new item touches files already in flight (so future batches detect the conflict).

## exit

- Every discovery has a tracked artifact on disk: a commit-body note (trivial), a new backlog item, an extended AC on an existing item, or an issue draft.
- The originating item's Context block records the follow-up reference.
- No discovery is left as a conversation-only note.

## on-fail

- If the classification is unclear (e.g., "is this small enough to fold in or large enough to defer?"), escalate to the user with the discovery's evidence and a recommendation. Do not silently downgrade scope to fit the current batch.
- If the upstream code defect spans multiple repos, file one issue draft per repo; cross-link them in each draft's References block.

## case-law

- `retrospectives/LSN-009-backlog-internal-duplication.md` — the grep-backlog-first step (procedure 1) is the rule that prevents the parallel-item failure mode.
- DOC-308 → DOC-310 chain (2026-05-29) — the full-scope rule (procedure 3). DOC-308 was logged scoped to a single page while the same wrong claim sat on four more; fixing one surface per item turned a one-commit correction into a fix→review→log→fix loop across multiple sessions. A logged item must carry the complete cross-tree scope so the implementer (and the confirming review) close the whole class at once.
- `retrospectives/LSN-036-i18n-leak-catalogued-not-gated.md` — the cross-cutting-invariant rule (procedure 3). A defect in a cross-cutting invariant (the i18n Portuguese-leak) was catalogued three ways but never promoted to an enforced gate, so it reached main; the logged fix must lead with the deterministic check (a CI key-parity guard), not a backlog item + a doc caveat.
