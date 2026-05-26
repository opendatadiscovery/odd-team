# SHB-161 — Datasource form submit closes the modal on rejection, discarding all typed input, with only a transient toast

**Category**: open
**Severity**: HIGH

## Hypothesis

When operators click Save on the Add/Edit Datasource modal and the backend rejects (e.g. HTTP 400 ODDRN collision, HTTP 403 missing DATA_SOURCE_CREATE permission, HTTP 5xx outage), the modal closes EXACTLY as it does on success — all four typed field values (Name, ODDRN, Namespace, Description) are reset. The operator's only failure signal is the transient 6-second server-error toast (per SHB-154). To retry, the operator must re-open the modal, retype every field, and click Save again. This is because `onSubmit` chains `.then(() => clearState())` onto the dispatch with no rejection check, and `handleResponseAsyncThunk` resolves the promise even on backend rejection.

## Evidence

- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:69-81` — `dispatch(...).then(() => clearState())` — no `.catch`, no rejection check, no condition on response status.
- `odd-platform-ui/src/redux/lib/handleResponseThunk.ts:34-42` — catches errors and `rejectWithValue`s them — never re-throws — so the dispatch promise RESOLVES even on 400/5xx.
- `odd-platform-ui/src/components/Management/DataSourcesList/DataSourceForm/DataSourceForm.tsx:157-169` — `DialogWrapper` is given no `errorText` prop; the supported errorText slot is unused.

## Notes

- Same shape applies to every other form modal in the codebase that uses the same `.then(clearState)` pattern — TermForm, DataEntityGroupForm, CollectorForm, LookupTableForm all likely share this anti-pattern. Worth a grep.
- The DialogWrapper SUPPORTS an `errorText` prop that could render the inline error and keep the modal open — but DataSourceForm never sets it.
- Fix is medium: `.then((result) => { if (result.meta.requestStatus === 'fulfilled') { clearState(); } else { setError(result.payload?.message); } })` plus pass `errorText={error}` to DialogWrapper.
- The Save button is also not disabled while a submit is in flight (only by form validity), so a fast double-click sends two POSTs (per DataSourceForm sidecar P-077). Backend ODDRN unique-index serialises them — worst case a confusing second red toast — but still an issue.
- Operator-impact: an admin registering a new datasource and typoing the ODDRN learns the typo only after every field is wiped; demoralising UX, especially for complex ODDRN strings.
- This is an implicit-ADR candidate ("form submits always close on completion regardless of outcome") — but it's a BAD ADR, the kind the find-implicit-adrs reducer should flag.

## Next

1. Probe P-075 (already emitted): reproduce the modal-closes-on-fail behaviour.
2. Fix DataSourceForm with the `.then` rejection check + DialogWrapper errorText wiring.
3. Grep `.then(.*clearState\|.*reset\|.*close.*Form` across all form components to estimate blast radius.
4. Promote: cluster_with F-031, F-028 (Namespace Lifecycle), F-019 (Owner Lifecycle), F-020 (Collector Lifecycle) — they likely share the bug.

## Links

- cluster_with: [F-031, SHB-154]
- merged_into: (open)
- supersedes: []
