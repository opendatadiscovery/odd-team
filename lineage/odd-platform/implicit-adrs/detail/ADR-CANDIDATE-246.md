## ADR-CANDIDATE-246 — Add/Edit forms are MOUNTED DIRECTLY in the list page as MODAL DIALOGS via `<DialogWrapper renderOpenBtn={...}>` + `cloneElement`-injected `onClick`; NOT as separate URL routes. Operators do NOT get a shareable URL for an in-progress create/edit; the form lives inside the list page's render tree

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-03 Master Data (LookupTables), and recurring across most form-based mutation surfaces in the SPA — DataEntity tag/term assignments, Owner role bindings, Tag/Namespace/Owner CRUD in Management]
**Batch minted**: ZL (2026-05-26)

**Support count**: 1 sidecar primary-source (LookupTables.tsx batch ZL); the pattern is observable across multiple existing sibling components (`OwnerForm`, `TagForm`, `NamespaceForm`, `DataEntityGroupForm`, `LookupTableForm` — all wrapping the `<DialogWrapper renderOpenBtn={...}>` idiom)

**Surfaced by**:
- `odd-platform__ts__react-component__component__LookupTables.md:implicit_adrs[2]` (HIGH) — "Form-mount pattern: `LookupTableForm` is mounted DIRECTLY in the list page (line 73) — not in a separate route. Implies the Add / Edit flows are dialog-based (modal), not URL-route-based; the user does not get a shareable URL for an in-progress create / edit." — evidence: LookupTables.tsx:72-82 + LookupTableForm.tsx:138-150 (the form is wrapped in `<DialogWrapper>` with `renderOpenBtn`) — intent_anchor: `"<DialogWrapper ... renderOpenBtn={({ handleOpen }) => cloneElement(btnEl, { onClick: handleOpen })} ...>"` (LookupTableForm.tsx:140-141 — the cloneElement-injects-onClick pattern is a deliberate modal-dialog idiom) — confidence: HIGH

**Decision statement**: ODD's SPA implements form-based mutation flows (Add new / Edit / Delete-confirm) as **MODAL DIALOGS mounted inside the list page**, NOT as separate URL routes. Three observable architectural commitments:

1. **The form component is RENDERED in the list page tree** — `LookupTables.tsx:72-82` mounts `<LookupTableForm btnCreateEl={<AppButton ... />}>` directly inside the list-page JSX, alongside the `+Add new` button placeholder. The form is in the React tree regardless of whether the dialog is open.

2. **`<DialogWrapper renderOpenBtn={...}>` is the gating mechanism** — `LookupTableForm.tsx:138-150` wraps the form body in `<DialogWrapper>` which exposes `renderOpenBtn={({ handleOpen }) => cloneElement(btnEl, { onClick: handleOpen })}`. The `cloneElement` call INJECTS the `handleOpen` callback as the `onClick` of the button-element prop. The button is what the operator sees in the list page; clicking it opens the modal.

3. **No URL route for the form** — there is no `/master-data/lookup-tables/new` or `/master-data/lookup-tables/{id}/edit` route. The form's open/closed state lives in `<DialogWrapper>`'s internal React state; refreshing the page closes the dialog; sharing the URL shares the LIST view, not the in-progress form.

The intent: form-based mutations are TRANSIENT WORKFLOWS that don't merit URL persistence. The alternative (route-based forms: `/feature/new`, `/feature/{id}/edit`) would require:
- URL routing infrastructure per form (separate routes per pillar, per CRUD verb)
- Mounting the list page as a layout outlet so the form route nests inside
- Handling cancel/close (route-pop + state cleanup)
- Resolving deep-link semantics (can a user bookmark `/lookup-tables/new`? What happens on refresh?)

The modal-dialog idiom trades shareability for simplicity: ALL form open/close logic lives in `<DialogWrapper>`; the list page is the de-facto parent for every form it spawns; canceling is just `handleClose`; no URL routing involved.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `<DialogWrapper renderOpenBtn={...}>` + `cloneElement(btnEl, { onClick: handleOpen })` chain is an explicit React idiom for declaring a modal dialog with externally-rendered open-button. The pattern recurs across multiple form components (LookupTableForm, OwnerForm, TagForm, NamespaceForm, DataEntityGroupForm) — the convergence makes it intentional. No form component uses route-based mounting.
2. *Structural impact?* YES — defines the user-visible UX shape (modal-dialog vs full-page form); defines the URL contract (forms have NO shareable URL); defines the list-vs-form parent-child relationship (form is rendered INSIDE the list, not alongside). A maintainer who reverses this decision (e.g., moves Add/Edit to route-based pages) faces a multi-pillar refactor.
3. *Refactoring or structural?* STRUCTURAL — moving from modal to route-based forms changes URL shape, deep-link semantics, list-vs-form composition. The decision is upstream of every form-based feature.
→ ADR.

**Evidence**:
- `LookupTables.tsx:72-82` — Add-new button + `<LookupTableForm btnCreateEl={...}>` mounted directly in the list page
- `LookupTableForm.tsx:138-150` — `<DialogWrapper renderOpenBtn={({ handleOpen }) => cloneElement(btnEl, { onClick: handleOpen })}>`
- `LookupTablesListItem.tsx:47-58` — sibling Edit-button mount using the SAME LookupTableForm component with `lookupTable` prop (the create-vs-edit distinction is internal to the form, not externalised as a route)
- intent_anchor: the `cloneElement(btnEl, { onClick: handleOpen })` pattern is the LITERAL statement of "button is rendered externally; dialog open is dispatched internally". The convention is observable across multiple form components.

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-089** (Partial UI permission gating — mutation buttons gated by `<WithPermissions>`, content not gated) — the `+Add new` button (modal opener) is the gated affordance; the modal dialog itself isn't separately gated; the underlying create endpoint IS backend-gated via SECURITY_RULES.
- COMPOSES WITH **ADR-CANDIDATE-228** (routes-as-functions) — the absence of `lookupTablesNewPath()` or `lookupTablesEditPath(id)` in `lookupTablesRoutes.ts` is the structural evidence that no form-route exists; this ADR explains WHY the routes module doesn't include them.
- CONTRASTS WITH **route-based form patterns** seen in some pillars: `Management/{type}/{id}` for some entity-detail editors uses route-based deep-linking; the contrast is deliberate — entity detail views ARE shareable surfaces, whereas form-create/edit is a transient action.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-NNN (LOW — no in-progress form recovery: a user typing into the Add-new form, then accidentally closing the dialog, loses their work. The form has no draft-state persistence; the operator must re-type. A form-route variant would survive refresh but be more complex.)
- REFACTOR-NNN (LOW — no shareable in-progress workflow: an operator wanting to ask a colleague for help filling out a complex form cannot share the URL; they must screenshot the form or describe it. This is the explicit trade-off the ADR codifies.)

**Proposed action**: Promote to `adrs/drafts/modal-dialog-form-mount-pattern.md`. Document:
- The `<DialogWrapper renderOpenBtn={...}>` + `cloneElement(btnEl, { onClick: handleOpen })` idiom — the canonical pattern.
- The list-page-as-form-parent composition (form rendered in list-page tree, not in a separate route).
- The trade-offs (no shareable URL; no draft recovery; simpler routing) and the rationale (forms are transient workflows).
- The convention across pillars: LookupTableForm, OwnerForm, TagForm, NamespaceForm, DataEntityGroupForm all share the same shape.
- The maintenance obligation: every new form-based mutation flow follows the same modal-dialog idiom OR documents the deviation (e.g., a route-based form for a complex multi-step workflow).
- The explicit affordance: the `btnCreateEl` (or equivalent) prop is the externally-rendered button; the dialog open/close is internal.

**Severity rationale**: MEDIUM — pattern-shaping convention across multiple pillars; 1 sidecar primary-source but the pattern's reach is observable across the form-component family. Below HIGH because the trade-off (no shareable URL) is the deliberate cost of simplicity; the convention is internal to the UI and doesn't affect backend architecture.

**Suggested backlog grouping**: `UI architecture codification` — pair with ADR-CANDIDATE-089 (partial UI permission gating) which together define the form-button-and-dialog mutation pattern.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-089 (mutation-button gating — modal-dialog opener is the gated affordance); ADR-CANDIDATE-228 (routes-as-functions — the absence of form routes confirms the modal-dialog convention).
- SUPERSEDES: none.
- CONFLICTS: none.
- BACK-LINKS: LookupTables.tsx sidecar receives `related_implicit_adrs: [ADR-CANDIDATE-246]` in next refresh.

---
