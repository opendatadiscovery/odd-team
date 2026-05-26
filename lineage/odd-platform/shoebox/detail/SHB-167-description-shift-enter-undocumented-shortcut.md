# SHB-167 — Description editor saves on Shift+Enter — power-user shortcut hidden from the only operator-facing tooltip

**Category**: open
**Severity**: LOW

## Hypothesis

When operators edit a data entity description (or dataset-field description), pressing Shift+Enter from inside the Markdown editor immediately saves the description — bypassing the explicit "Save" button. This is a deliberate power-user shortcut but is documented NOWHERE: the only operator-facing surface that explains the editor (an InformationIcon tooltip) covers ONLY the `[[Namespace:TermName]]` term-mention syntax, with no mention of the keyboard shortcut. Operators learning the editor have no way to discover Shift+Enter saves; they may accidentally trigger it while authoring a Markdown bullet list (where Enter starts a new bullet and Shift+Enter is colloquially expected to insert a line break, NOT submit).

## Evidence

- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/useTermWiki.ts:179-184` — `handleSaveMarkdownOnEnter` fires `handleUpdateDescription` when `e.key === 'Enter' && e.shiftKey`.
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/InternalDescription/InternalDescriptionEdit/InternalDescriptionEdit.tsx:23` — `<Box onKeyDown={handlePressEnter}>` wires the shortcut at the editor root.
- `odd-platform-ui/src/components/DataEntityDetails/Overview/OverviewDescription/InternalDescription/InternalDescriptionHeader/InternalDescriptionHeader.tsx:20-28` — the InformationIcon tooltip documents the term-mention syntax ONLY.

## Notes

- The shortcut is intentional (requires the modifier; plain Enter is preserved for newline insertion in the multi-line editor).
- Accidental-save risk: an operator who has typed half a description and instinctively uses Shift+Enter for "line break" loses their context as the description saves and edit-mode exits.
- Documentation fix is small: extend the InformationIcon tooltip to mention "Shift+Enter to save."
- Adjacent: `[[NamespaceName:TermName]]` syntax is also platform-specific and exists nowhere in the public docs (only in this in-product tooltip).
- guess: this is one of N power-user shortcuts hidden across the SPA — worth a `onKeyDown` grep audit.

## Next

1. Extend the InformationIcon tooltip to document Shift+Enter save.
2. DOC-NNN: `docs.opendatadiscovery.org/features/data-discovery/entity-detail` (if it exists) should list keyboard shortcuts.
3. Grep `onKeyDown.*shiftKey` across `odd-platform-ui/src` to enumerate hidden shortcuts.

## Links

- cluster_with: [F-004]
- merged_into: (open)
- supersedes: []
