## REFACTOR-696 — `AppInfoMenu.tsx:61` uses `link.url` as React reconciliation key in the operator-link map — duplicate URLs (operator configures `Runbook` + `Runbook (old)` both pointing to the same wiki page) trigger React duplicate-key warning and MAY cause render-reconciliation drift in some React versions

**Severity**: LOW
**Category**: react-key-fragility / duplicate-key-warning / operator-input-edge-case
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-06 Configuration & Deployment]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_AppInfoMenu__ui-shell-widget__AppInfoMenu.md:bugs_limitations_corner_cases[4]` (LOW) — "`link.url` is used as React key (line 61). If the operator configures two `odd.links` entries with the same URL but different titles (e.g. one labelled 'Runbook' and one labelled 'Runbook (old)', both pointing to the same wiki page), React emits a duplicate-key warning and may de-duplicate the render in some reconciliation paths. A better key would be the index (`{(link, idx) => ...key={idx}...}`) or a synthetic id stamped at the backend."

**Statement**: `AppInfoMenu.tsx:55-69` maps the operator-configured `odd.links` array to menu items, using `key={link.url}` as the React reconciliation key. The choice has a quiet edge-case: if two operator-configured entries share the same URL (e.g. `Runbook` and `Runbook (old)` both pointing to a wiki page that's been preserved through a rename), React emits a duplicate-key warning to the console and may render only ONE of the two entries (the second's reconciliation hits the first's slot). The exact behaviour depends on the React version + the reconciliation algorithm; for React 18 the typical outcome is "first wins, second silently dropped".

The duplicate-URL config is uncommon but legitimate:
- Renamed-but-preserved wiki page: `Runbook` (current title) + `Runbook (old)` (archived label for the same URL).
- Two distinct labels for the same dashboard: `Production Dashboard` + `Prod` (operator's shorthand).
- Multilingual labels for the same docs page: `Docs (English)` + `Docs (Français)` — both pointing at the same /docs URL.

The operator configuring `odd.links` with such entries has no signal at config time that the UI will mis-render; the duplicate-key warning is silent unless they open DevTools.

**Evidence**:
- AppInfoMenu.tsx:55-69 (the map with `key={link.url}`)
- AdditionalLinkProperties.java:6-9 (the backend record-Link; no uniqueness constraint on `url`)
- LinksController.java:31-33 (the controller passes the list through without dedup)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-234 NEW this batch (AppInfoMenu five-surface consolidation) doesn't address per-key reconciliation. The implied operator-input contract is "each link has a unique URL"; the implementation doesn't validate or enforce this.

**Proposed remedy**: Two options:

**Option A — Use array index as key (cheapest)**:
```tsx
{linksData?.map((link, idx) => (
  <Link key={idx} to={link.url} target='_blank' rel='noopener noreferrer'>
    <Typography variant='h4'>{link.title}</Typography>
  </Link>
))}
```
The index is stable within a single fetch; React reconciles correctly. Cost: re-renders may not preserve scroll/focus state perfectly if the operator changes order (low concern for a 5-15-entry menu).

**Option B — Stamp synthetic id at backend**:
- Add a `synthetic_id: int` (or `position: int`) field to the API response.
- Use it as the React key.
- Effort: more invasive (touches API + UI), but more semantically correct.

**Option C — Concatenate title + url + index** (defensive):
```tsx
<Link key={`${idx}-${link.url}-${link.title}`} ...>
```
Avoids the duplicate-URL issue while preserving title-based diff sensitivity.

For an OSS project with limited capacity, Option A is the recommended quickest fix. Effort: trivial. Also: applying REFACTOR-629's `rel='noopener noreferrer'` strengthen at the same time is a one-line co-commit.

**Severity rationale**: LOW — bounded operator-input edge case. The duplicate-URL config is rare; the symptom (duplicate-key warning + one entry silently dropped) is annoying but not data-loss / security-grade.

**Suggested backlog grouping**: `UI architecture hardening sprint` or `UI security hygiene sprint` — bundle with REFACTOR-629 strengthen (rel=noopener), REFACTOR-697 NEW (hardcoded labels not translatable). The three are all in the same AppInfoMenu surface area.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-234 NEW (AppInfoMenu architecture).
- SUPERSEDES: none.
- CONFLICTS: none.

---
