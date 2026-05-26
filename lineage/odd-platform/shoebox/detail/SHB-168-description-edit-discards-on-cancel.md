# SHB-168 — Description editor's Cancel button silently discards in-flight edits with no confirm prompt

**Category**: open
**Severity**: MEDIUM

## Hypothesis

When an operator has typed (or significantly modified) a data entity description and clicks Cancel, every character of their unsaved work is silently discarded — no confirmation dialog, no "are you sure" prompt, no autosave-on-blur, no draft preservation across sessions. The `toggleEditMode` handler re-syncs `internalDescription` to the latest server-stored value on every flip. Same applies if the operator navigates away (route change, browser back, accidental tab close) — no `beforeunload` warning, no draft-saving heuristic. Operators authoring long-form documentation (a several-paragraph description with embedded term mentions) lose hours of work to a stray Cancel click.

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/useTermWiki.ts:46-49` — `toggleEditMode` re-assigns `internalDescription = description` (the redux-stored value); the in-flight edit is gone.
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/InternalDescription/InternalDescriptionEdit/InternalDescriptionEdit.tsx:35` — Cancel button: `onClick={toggleEditMode}`. No confirm, no guard.
- No `beforeunload` handler in the OverviewDescription cluster — verifiable by grep.

## Notes

- The intent is deliberate (per DataEntityDescription sidecar's implicit_adrs[2]) — but the operator-impact is unbounded.
- Fix candidates: (a) confirm-on-cancel if the form is dirty; (b) autosave to localStorage every N seconds with restore-on-reopen; (c) `beforeunload` warning when the form is dirty.
- Compare to DialogWrapper's `confirmOnClose` pattern (used by the Datasource form) — already established as a project pattern for guarded close.
- Operator-impact: a long term-rich description takes minutes to author; one stray click discards it. For platform stewards who own dozens of entities, this is a real friction point.
- Multi-operator-edits-same-entity is a separate concern (no last-write-wins conflict resolution either) — but the Cancel-discard is the more frequent failure.

## Next

1. Add a confirm-on-cancel-if-dirty step (mirror DialogWrapper's pattern).
2. Decide whether to add a localStorage autosave + restore.
3. Add `beforeunload` warning when the form is dirty.
4. Promote: cluster_with F-004.

## Links

- cluster_with: [F-004]
- merged_into: (open)
- supersedes: []
