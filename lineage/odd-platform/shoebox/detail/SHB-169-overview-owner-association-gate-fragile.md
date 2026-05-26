# SHB-169 — Home-page OwnerAssociation card mis-gates on empty / typo'd / whitespace auth.type values

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators with misconfigured `auth.type` see a SURPRISING home-page state with no diagnostic. The Overview component evaluates `isShowOwnerAssociation = Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` — a fragile case-sensitive string-equality check with no enum validation. Four failure modes silently produce wrong UI: (1) `AUTH_TYPE=` empty → card HIDDEN as if auth were disabled (masking the deeper deployment misconfig); (2) `AUTH_TYPE=OUATH2` typo → card SHOWS but backend has no matching SecurityConfiguration → apparently-functional UI on a deployment with NO authentication; (3) `AUTH_TYPE=disabled` lowercase → card SHOWS even though operator intent was to disable; (4) `AUTH_TYPE=' DISABLED'` leading whitespace → card SHOWS under what operator believes is a DISABLED deployment.

## Evidence

- `odd-platform-ui/src/components/Overview/Overview.tsx:25-27` — `Boolean(appInfo?.authType && appInfo.authType !== 'DISABLED')` (case-sensitive, no normalization, no enum validation).
- `odd-platform-api/src/main/java/.../AppInfoController.java:18` — backend's `@Value("${auth.type}")` consumer has NO default, NO enum validation either — both layers fail-open into surprising UI states.
- (Cross-ref REFACTOR-073 / REFACTOR-185) — the `@ConditionalOnProperty(value="auth.type", havingValue=...)` SecurityConfigurations have no `matchIfMissing`, so empty/typo'd values silently wire NO SecurityWebFilterChain bean (no auth).
- Live docs `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (WebFetched 2026-05-20, status 200): the doc says "On auth-disabled deployments the section is hidden" — agrees with the intended behaviour but does NOT warn about the typo cases.

## Notes

- The compound failure: backend layer (no `@Value` default) + UI layer (no enum validation) BOTH fail-open, COMPOUNDING into a deployment shape that looks normal but has NO authentication.
- An operator who typos `AUTH_TYPE=OUATH2` sees the OwnerAssociation card render (encouraging signal — "the UI thinks auth is enabled") but has NO Spring Security filter chain wired (because no `@ConditionalOnProperty(havingValue="OUATH2")` matches); the deployment is open.
- The doc says the Recommended panel is "visible on auth-disabled deployments with per-user filtering disabled" — but the CODE hides BOTH OwnerAssociation AND Recommended together on DISABLED; doc and code disagree on a user-observable fact (per Overview sidecar doc_drift_findings[0]).
- Fix candidates: (a) backend `@Value("${auth.type:DISABLED}")` with enum validation at startup; (b) UI-side `KNOWN_AUTH_TYPES.includes(authType.trim().toUpperCase())` with console.warn on mismatch.
- The popular-loop closure: Overview is the home-page chrome that mounts OwnerAssociation → OwnerEntitiesList → Popular column; the gate is the first defence against UI-side popular-inflation under DISABLED.

## Next

1. Probe: test the four failure modes; confirm the surprising UI states.
2. Fix the UI gate (one-line): normalize + validate against known enum values.
3. File a paired refactoring-scope for the backend `@Value` default + enum validation.
4. DOC-NNN: correct the Overview doc-drift on DISABLED-mode Recommended panel visibility.

## Links

- cluster_with: [F-034, F-015, F-001, F-003]
- merged_into: (open)
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: cluster — F-034 (P-09 Security) cross-pillar; F-015 (P-09); F-001/F-003 (P-01) — all outside H1 slice. The compound failure spans BOTH layers (backend @Value with no default + UI case-sensitive string-equality) — it's a single drift class but its home is ambiguous (P-09 SecurityConfiguration fail-open vs P-01 home-page Overview rendering). Cluster_with F-034 for next P-09 pass; the Overview-side facet is the UI symptom of the broader REFACTOR-185 cluster.
