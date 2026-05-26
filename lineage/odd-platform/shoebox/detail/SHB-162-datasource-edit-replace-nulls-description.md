# SHB-162 — Editing a datasource's name nulls its description (full-form REPLACE-not-MERGE) with no UI warning

**Category**: clustering
**Severity**: HIGH

## Hypothesis

When operators open "Edit datasource" to fix a typo in the Name field and click Save, the backend PUT replaces ALL fields with what the modal holds — including the Description field which, if it wasn't pre-filled (or the operator left it blank), nulls the stored description. The UI gives no warning that a blank field overwrites. The operator's mental model of "edit means patch the fields I changed" is silently violated. The same applies to Namespace (gets reset to the default selection on every open) — an operator who never touched Namespace still has it submitted as-is.

## Evidence

- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:69-81` — `onSubmit` submits the WHOLE `data` object to `updateDataSource`.
- `odd-platform-api/src/main/java/.../DataSourceServiceImpl.java:68-83` + MapStruct null-handling — full-form REPLACE per the updateDataSource backend sidecar's P-043 finding.
- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:40-48` — `getDefaultValues` pre-fills four fields from `dataSource` prop; if the prop's description is `null`, the form field starts blank, and submit sends blank.

## Notes

- Same REPLACE-not-MERGE shape applies to other form modals (TermForm, CollectorForm, LookupTableForm) — verify via grep against the backend sidecars for sibling controllers.
- F-031 (Data Source Lifecycle) likely needs an ENRICHER capturing this UI-side hazard.
- The fix is either UI-side (read `dataSource.description` and warn if it's blank in the modal) or backend-side (switch PUT to PATCH semantics) — backend-side is the better fix but is a bigger ADR/refactor.
- Adjacent: the modal closes on success per SHB-161; an operator who notices the description was nulled has to re-open, re-enter, re-save.
- Cross-reference: P-076 probe already emitted in DataSourceForm sidecar to confirm reachability.

## Next

1. Add a UI warning when a previously-non-blank description is about to be blank-submitted ("This will erase the current description").
2. File a forward-looking REFACTOR-NNN: "Switch /api/datasources/{id} from PUT (full replace) to PATCH (sparse merge)" — bigger but operator-correct.
3. Probe P-076 to confirm the bug surface.
4. Promote: ENRICHER to F-031.

## Links

- cluster_with: [F-031, SHB-160, SHB-161]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — joins the "Form UX class" cluster with SHB-160 + SHB-161 for cohesive next-batch graduation. The REPLACE-not-PATCH backend semantic is cross-cutting (DataSource / Term / Collector / LookupTable) — capturing it once at the cluster level rather than splintering across N F-NNNs is the maintainer-friendlier shape. HIGH severity per silent description nulling.
