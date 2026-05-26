## ADR-CANDIDATE-239 — i18next interpolation placeholders (`{{var}}`) are NEVER used in any locale file; variable substitution happens via JSX composition outside the `t()` call — deliberate trade-off accepting a small ergonomic cost to sidestep the per-locale interpolation-divergence risk

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — applies to every translated string in the SPA]

**Surfaced by**:
- `odd-platform__json__locales_translations__i18n-resource__en.md:implicit_adrs[2]` (HIGH) — "No i18next interpolation placeholders (`{{var}}`) are used; variable substitution happens via JSX composition outside the t() call. — evidence: `odd-platform-ui/src/locales/translations/en.json` (zero `{{...}}` patterns, verified by repo-wide grep) + `odd-platform-ui/src/components/Overview/OwnerAssociation/OwnerAssociationForm/OwnerAssociationForm.tsx:153` (the canonical example: `{t('Hi')} {identity?.username}.` — JSX children, not t-interpolation). — intent_anchor: 'JSX composition is the consistent pattern across the entire SPA; the `{t('Hi')} {identity?.username}.` form deliberately avoids i18next interpolation, sidestepping the locale-divergence risk where a contributor adds `{{var}}` in one locale and forgets it in others. The natural-keys pattern + JSX composition is a coherent ADR even though no comment defends it' — confidence: HIGH"

**Decision statement**: The platform's i18n layer never uses i18next interpolation placeholders (`{{var}}`). Variable substitution is performed via JSX composition — the variable value is rendered as a sibling of the translated string, not as a substituted placeholder. Canonical pattern at `OwnerAssociationForm.tsx:153`: `{t('Hi')} {identity?.username}.` — three React children (the translated greeting, the user's name, a period); not `{t('Hi {{name}}.', { name: identity?.username })`.

The choice is verified by repo-wide grep returning ZERO `{{...}}` patterns across all six locale JSON files. The architectural payoff: a contributor adding a NEW interpolation point only needs to add ONE new natural-keys entry per locale (e.g. `"Hi"` translated to `"Bonjour"`); they cannot accidentally introduce a `{{name}}` placeholder in en.json + forget it in fr.json, which would cause the French rendering to show literal text without substitution. The trade-off: more JSX boilerplate, less elegant for sentence-templates that need word-reordering across languages (some languages prefer `{name}, Hi` instead of `Hi, {name}` — JSX composition forces English-style word order).

**Wisdom test (3-question)**:
1. *Intentional?* YES — verified across all six locales by repo-wide grep (zero `{{...}}` matches). 241 t() call sites across the codebase ALL use JSX composition for variable substitution. The uniformity is the evidence; a non-deliberate state would have at least a few legacy interpolation sites.
2. *Structural impact?* YES — the choice composes with the natural-keys ADR (-011) to form a coherent i18n posture: keys ARE English phrases; variables are siblings; missing keys silently render the key (the English phrase). The three together — natural keys + JSX composition + chained fallbackLng — define what a translation contribution looks like and what a missing-key surface looks like.
3. *Refactoring or structural?* STRUCTURAL — switching to interpolation would require: (a) adding `{{var}}` placeholders to en.json wherever needed, (b) propagating the placeholders to every locale, (c) updating every t() call site to pass the variable bag, (d) accepting the per-locale divergence risk. The choice is architectural, not local style.
→ ADR.

**Evidence**:
- en.md says: "No i18next interpolation placeholders (`{{var}}`) are used"
- Repo-wide grep on `odd-platform-ui/src/locales/translations/*.json` for `\{\{[a-zA-Z_]+\}\}` returns ZERO matches across all six locales.
- `OwnerAssociationForm.tsx:153` canonical JSX-composition example: `{t('Hi')} {identity?.username}.`
- 241 t() call sites verified by `Grep -c "t\\(['\\\"]"` across `odd-platform-ui/src/` — all use the same shape.

**Existing ADR**: composes with:
- ADR-CANDIDATE-011 (natural-keys i18next pattern) — the sibling decision; the two together define the i18n posture.
- ADR-CANDIDATE-009 (i18n eager-load) — the bootstrap shape.
- ADR-CANDIDATE-010 (localStorage-only language preference) — the language-selection mechanism.

**Proposed action**: Promote to `adrs/drafts/i18n-jsx-composition-not-interpolation.md` OR add a section to ADR-CANDIDATE-011 (natural-keys). Document:
- The no-interpolation-placeholders rule.
- The JSX-composition pattern as the canonical alternative.
- The trade-off rationale (sidestep per-locale divergence risk; accept some JSX boilerplate).
- The lint-rule opportunity (a custom ESLint rule could flag `t('...{{var}}...')` patterns as ADR-violations).
- The cross-link to ADR-CANDIDATE-011 (natural-keys); the two ADRs are sister i18n decisions.

**Severity rationale**: MEDIUM — pattern-shaping; uniformly applied across 241 t() call sites and all 6 locale bundles. Not HIGH because the decision is positive-property (preventing a class of locale-divergence bug); not LOW because the absence of a defending comment in the code AND the absence of a lint rule mean a future contributor could silently introduce interpolation without anyone noticing.

**Suggested backlog grouping**: `i18n architecture codification` (with ADR-CANDIDATE-009 / 010 / 011).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-693 NEW this batch (no `missingKeyHandler` wired in i18n.ts — composes with the natural-keys + no-interpolation posture; both work because i18next defaults silently fall through, but the absence of a missingKey signal means the contract is enforced by NOTHING).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-011 (natural-keys); ADR-CANDIDATE-009 (eager-load).
- SUPERSEDES: none.
- CONFLICTS: none.

---
