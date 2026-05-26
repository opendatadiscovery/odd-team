## REFACTOR-720 — Local import alias `DataModeling` (single 'l') at App.tsx:40 differs from the file's canonical 'DataModelling' (double-l, used everywhere else — file name, default export, i18n label, BASE_PATH, route module). Observable typo, not user-visible; future search for 'DataModelling' in App.tsx misses the import line

**Severity**: LOW
**Category**: cosmetic-typo / inconsistent-naming
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-02 Data Modelling]

**Surfaced by**:
- `odd-platform__ts__react-component__component__DataModelling.md:bugs_limitations_corner_cases[3]` (LOW) — "**Local import alias `DataModeling` (single 'l') at `App.tsx:40` vs the file/component/pillar's canonical 'DataModelling' (double-l)** — observable typo (recorded in implicit_adrs above). The alias is internal to App.tsx and not user-visible, but a future search for 'DataModelling' in `components/App.tsx` returns zero matches at the import line (the import uses single-l), which surprises maintainers grep-ing the file. Cosmetic." — evidence: components/App.tsx:40 (`const DataModeling = lazy(...)`) vs every other Data-Modelling-related symbol in the codebase — severity: LOW
- `odd-platform__ts__react-component__component__DataModelling.md:implicit_adrs[3]` (HIGH context, LOW severity) — "**The local import alias `DataModeling` (single 'l') at `App.tsx:40` differs from the pillar's canonical spelling 'Data Modelling' (double-l, used everywhere else)** — this is observably a typo, not a deliberate naming decision (the file is `DataModelling.tsx` with double-l; the default export is `DataModelling`; the AppToolbar tab label is `t('Data Modelling')`; the route module is `routes/dataModelling/dataModelling.ts`; the BASE_PATH is `/data-modelling`). The decision (implicit): the alias is local to App.tsx and does not leak to the user-facing surface; the typo persists because no test or lint rule catches the file-name-vs-alias asymmetry. Cosmetic, not a bug."

**Statement**: `components/App.tsx:40` declares:
```tsx
const DataModeling = lazy(() => import('./DataModelling/DataModelling'));   // <-- 'DataModeling' single-l, but imports 'DataModelling' double-l
```

The local alias `DataModeling` (single 'l') is used in App.tsx:74 to mount the route:
```tsx
<Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />
```

Every OTHER Data-Modelling-related symbol in the codebase uses double-l:
- File name: `DataModelling.tsx`
- Default export: `const DataModelling: React.FC = ...; export default DataModelling`
- AppToolbar tab label: `t('Data Modelling')` (with space)
- Route module: `routes/dataModelling/dataModelling.ts`
- BASE_PATH: `/data-modelling` (kebab-case form)
- i18n key: `t('Data Modelling')` (double-l)

The local alias in App.tsx is the lone outlier. It's a TYPO, not a deliberate naming choice — the file-and-export uses double-l consistently; the alias should match. The compiler doesn't catch the mismatch because the import statement uses the relative path and binds to `DataModeling` locally.

**Operator-visible impact**:
- ZERO — the alias is internal to App.tsx; not user-visible
- Maintenance impact: a future maintainer grepping `components/App.tsx` for "DataModelling" misses the import + route-mount lines; they have to search for both spellings
- IDE/refactor impact: rename-symbol refactors targeted at `DataModelling` miss the App.tsx alias; the maintainer must handle it separately

**Evidence**:
- `components/App.tsx:40` — `const DataModeling = lazy(...)` (single-l)
- `components/App.tsx:74` — `<DataModeling />` callsite (same single-l alias)
- `components/DataModelling/DataModelling.tsx:6` — `const DataModelling: React.FC = ...` (double-l, the actual export)
- `components/DataModelling/DataModelling.tsx:17` — `export default DataModelling;` (double-l)
- `components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:51` — `t('Data Modelling')` (double-l with space)
- `routes/dataModelling/dataModelling.ts` — module name (camelCase with double-l)

**Existing-ADR-or-implied-prescription**: There's no ADR governing import-alias-consistency. The implicit convention is "local aliases match the imported symbol's name unless deliberate disambiguation". This case is clearly accidental.

**Proposed remedy**:

```tsx
// components/App.tsx:40
- const DataModeling = lazy(() => import('./DataModelling/DataModelling'));
+ const DataModelling = lazy(() => import('./DataModelling/DataModelling'));

// components/App.tsx:74
- <Route path={`${dataModellingPath()}/*`} element={<DataModeling />} />
+ <Route path={`${dataModellingPath()}/*`} element={<DataModelling />} />
```

Effort: trivial. Two single-line changes in one file. No test impact; no API impact.

**Severity rationale**: LOW — purely cosmetic. The defect has zero operator-visible impact; only a tiny maintenance friction. The fix is trivial and risk-free.

Not zero because:
- The typo is a SIGNAL that lint discipline is incomplete (no rule catches file-name-vs-alias asymmetry)
- Other codebases would catch this via `import/no-anonymous-default-export` or similar custom rules
- The fix is so cheap that NOT fixing it is itself a smell

**Suggested backlog grouping**: `LSN-NNN code-hygiene sprint` (low-priority cleanup) — bundle with REFACTOR-717 (Search pageSize twin literals) and similar cosmetic-only defects.

**Coherence check** (LSN-018):
- STRENGTHENS: none directly; sibling cosmetic-cleanup class.
- SUPERSEDES: none.
- CONFLICTS: none.

---
