# Coherence conflicts — batch ZK (2026-05-26)

Rule-6 pre-emit coherence check, concept-merger reducer, batch ZK (config-properties — SchedulingConfiguration + ODDLDAPProperties + GenAIProperties + HousekeepingTTLProperties + AdditionalLinkProperties).

This file records cross-registry coherence findings that the concept-merger reducer
cannot itself resolve. The maintainer / owning reducer reviews this file before the
next batch fires.

---

## CONTRADICTS-1 — ODDLDAPProperties batch-ZK sidecar claims SUBSTRING admin-group match; existing `auth-mode-quartet-meta-invariant-all-four-sidecars-pinned` asserts FULL-STRING-EQUALITY (CORRECTED batch O)

**Conflicting artefact**: `lineage/odd-platform/concepts/detail/invariants/auth-mode-quartet-meta-invariant-all-four-sidecars-pinned.yaml` — the quartet invariant states verbatim:

> "LDAPSecurityConfiguration@L51 (config-key-consumer, batch C): WIRES AuthorizationCustomizer at line 145; SecurityWebFilterChain runs at Ordered.HIGHEST_PRECEDENCE; admin-group match is FULL-string-equality via OperationUtils.containsIgnoreCase **(CORRECTED batch O — NOT substring)**; CSRF disabled; S2S additively composable"

**Relationship**: CONTRADICTS (Rule 6 step 4 — opposite polarity AND the new finding's evidence is no stronger than the existing claim's).

**What the batch-ZK ODDLDAPProperties sidecar asserts** (the proposed-but-NOT-emitted finding):

The sidecar's `bugs_limitations_corner_cases.[adminGroups substring collision]` + `security.known_security_gaps.[adminGroups substring collision]` + `stress_findings.request_inputs.[adminGroups]` all claim:

> "`Group.adminGroups` is a `Set<String>` (line 31) and the consumer at `LDAPSecurityConfiguration.java:96` matches each LDAP-returned authority against this set using `containsIgnoreCase(properties.getGroups().getAdminGroups(), a.getAuthority())` — which is a **substring**, case-insensitive match (verified via `OperationUtils.containsIgnoreCase` import at `LDAPSecurityConfiguration.java:48`). The Properties class does not restrict entries to valid DN-friendly substrings ... An operator who configures `admin-groups: ['ops']` may inadvertently promote anyone in groups named `devops`, `noops`, `appops`, etc."

The sidecar's `routes_to_finding` field directs this to a substring-collision-admin-escalation finding (Probe P-184).

**Evidence at stake**:

- Both claims cite the SAME consumer file:line — `LDAPSecurityConfiguration.java:48` (the import) + `:96` (the call site).
- The dispute is whether `OperationUtils.containsIgnoreCase(Set<String> set, String item)` is **substring containment** (sidecar's claim — "Set.stream().anyMatch(s -> s.toLowerCase().contains(item.toLowerCase()))") or **full-string-equality with case-fold** (auth-mode-quartet's claim — "Set.stream().anyMatch(s -> s.equalsIgnoreCase(item))").
- Neither artefact cites the implementation of `OperationUtils.containsIgnoreCase` itself. The sidecar infers substring from the method NAME ("contains"); the auth-mode-quartet claims a batch-O correction looked at the implementation.
- Per Rule 6: when evidence is no stronger than the existing claim, DO NOT EMIT the contradicting finding.

**Why this matters**:

The two claims have radically different operator-visible consequences:

- **If substring (sidecar's claim)**: short admin-group labels like `ops` collide with `devops`, `noops`, `appops`. Operator-visible admin-escalation hazard. HIGH severity.
- **If full-string-equality (existing claim)**: labels match exactly modulo case. `ops` matches only the LDAP group literally named `ops`. No collision. The substring-collision invariant doesn't exist.

The maintainer needs to resolve this before either claim becomes load-bearing in downstream artefacts.

**Recommended resolution**:

1. Open `odd-platform-api/src/main/java/.../utils/OperationUtils.java` and inspect the implementation of `containsIgnoreCase(Set<String> set, String value)` directly.
2. Capture the implementation in a NEW dedicated invariant `operation-utils-contains-ignore-case-semantic-pin` (primary-source pinned to the method body).
3. Update WHICHEVER of the two existing claims is wrong with a `superseded_by` block referencing the new pin.
4. If full-string-equality is confirmed: the batch-ZK ODDLDAPProperties sidecar's `adminGroups substring collision` finding is INVALID and should be retracted from the sidecar in the next sidecar refresh.
5. If substring IS confirmed: the auth-mode-quartet batch-O correction was wrong; the substring-collision invariant becomes load-bearing and should be promoted to a dedicated invariant.

**Why batch-ZK does not act**:

- The concept-merger has no source-code access (Rule 1: read sidecars only, not source).
- The sidecar's evidence is its own inference from the method name; not stronger than the existing quartet claim's evidence.
- Surfacing as CONTRADICTS preserves both readings until a sidecar (file-analyser) does the primary-source read of `OperationUtils.containsIgnoreCase`.

**Batch ZK action taken**:

- The substring-collision invariant is NOT minted as a new concept.
- The ODDLDAPProperties sidecar's contribution to existing `admin-groups-silent-no-op-asymmetric-provider-support` is recorded but framed without the substring/equality claim — focuses on `Set<String>` shape + `containsIgnoreCase` import + the claim that adminGroups behaviour DEPENDS on the semantics of that utility (uncontested) without asserting WHICH semantics applies.
- All other batch-ZK ODDLDAPProperties findings (password unmasked + no LDAPS enforcement + AD.domain unvalidated + empty-adminGroups-no-admin) are NOT in conflict with existing artefacts and proceed normally.

---

(End of batch ZK conflicts.)
