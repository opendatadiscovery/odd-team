## STRENGTHENS REFACTOR-630 — AdditionalLinkProperties (batch ZK, 2026-05-26) at file-analyser/0.5.0

**Properties-class-side primary-source confirmation + explicit DRIFT_INPUT_NAME_VS_IMPLEMENTATION framing**. REFACTOR-630 was minted from the LinksController sidecar (batch ZE) at a time when the AdditionalLinkProperties sidecar did not exist. The batch-ZK re-enrichment of AdditionalLinkProperties at file-analyser/0.5.0 ADDS the properties-class-side intent anchor AND the explicit name-vs-behavior drift framing from the new stress_findings analysis.

**New batch-ZK evidence**:
- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:stress_findings.request_inputs[1]` (the inner Link record's `url` field) flags `DRIFT_INPUT_NAME_VS_IMPLEMENTATION`:
  > "TRANSLATES_SILENTLY — the name 'url' promises a URL (schema-conformant http(s) by reasonable interpretation); the implementation accepts ANY String including `javascript:alert(1)`, `data:text/html,<script>...</script>`, `file:///etc/passwd`, `vbscript:`, malformed strings, empty strings, and null. The string flows unmodified through to the browser's `<a href>` attribute. The 'silent' aspect: no operator-facing surface (documentation, JSR-303 validation error, application log) warns about scheme restrictions or invalid URLs."

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:bugs_limitations_corner_cases.[0]` (MEDIUM): "Record has NO validation annotations on either field — `title` and `url` can be null, empty string, or any malformed string; binder accepts the entry silently. Operator misconfiguration produces a broken UI entry (button with empty label or null href) instead of a fail-fast at boot."

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:security.known_security_gaps.[0]` (MEDIUM): "No URL-scheme validation at the binding layer — operator can configure `javascript:`, `data:`, `file:`, `vbscript:` and the binder accepts them. The eventual UI rendering depends on React + react-router-dom to neutralise dangerous schemes; this is defence-in-depth pushed entirely to the UI layer, with no backend-side validation as a safety net."

- `odd-platform__java__config_properties__config-properties-class__AdditionalLinkProperties.md:probes_emitted.P-177`: probe locked in for "Verify that operator-supplied URLs of the form `javascript:`, `data:`, `file:`, `vbscript:`, empty string, and relative paths flow unmodified through the record → controller → API response chain, and the rendered UI's `<a href>` attribute." — this PROBE complements REFACTOR-630's existing UI-side investigation roadmap, anchored at the BACKEND (record) layer.

**What batch ZK adds (vs the batch-ZE framing already in REFACTOR-630)**:

1. **The properties-class is the upstream-most enforcement point**. Batch ZE framed REFACTOR-630 with `AdditionalLinkProperties.java:8` as a file:line citation but the SIDECAR was LinksController. Batch ZK confirms from the PROPERTIES SIDECAR that the absence of `@URL` / `@Pattern` / `@NotBlank` / `@Validated` on the record itself is the **deliberate** upstream-most failure point — every UI rendering issue downstream is caused by the binder's permissiveness. The fix proposed in REFACTOR-630 ("add `@URL(protocol = "http", regexp = "...")` annotation to `AdditionalLinkProperties.Link.url`") IS the correct upstream-most fix; batch ZK confirms no downstream alternative is structurally complete (UI validation alone leaves the actuator/env exposure path uncovered).

2. **DRIFT framing makes the operator-visible-failure-mode explicit**. The stress_findings analysis classifies the gap as `DRIFT_INPUT_NAME_VS_IMPLEMENTATION` — a specific drift class that the methodology surfaces as load-bearing. This is the SAME drift class that ADR-CANDIDATE-213's controller-side `DRIFT_NAME_VS_BEHAVIOR` flags, but applied to the field-validation layer rather than the endpoint-lifecycle layer.

3. **Additional operator-visible consequences (beyond batch ZE's framing)**:
   - Empty string `url=''` → renders as `<a href=''>` which is treated as the current document (clicking reloads the ODD page)
   - `null` URL → produces `<a>` with no href (non-clickable; visual but inert)
   - Operator typing `wiki.internal` instead of `https://wiki.internal` → browser interprets as relative path under the current ODD platform host, hitting `/wiki.internal` which 404s
   - None of these is fail-fast at config-load time; all surface as a user opening the menu and clicking a link that does nothing — or worse

4. **`security.data_exposure` from batch ZK adds the actuator/env exposure dimension**: even WITH React's `javascript:` neutralisation in the rendered UI, the configured URL strings are visible via `/actuator/env` (when enabled per `application.yml:230`). An attacker reading `env` learns the operator's internal URL inventory — a deployment-topology intelligence leak that the UI-side mitigation does NOT cover.

**Cross-batch evidence chain for REFACTOR-630**:
- batch ZE (LinksController): controller-passthrough + UI-rendering framing
- batch ZK (AdditionalLinkProperties at file-analyser/0.5.0): properties-class-side intent anchor + explicit DRIFT framing + actuator/env exposure dimension

**Severity unchanged**: MEDIUM. The new evidence does NOT raise the severity (React 17+ + modern browser defences still apply); it CONFIRMS the proposed remedy by anchoring the upstream-most-fix at the properties record + closes the actuator-side leak gap.

---
