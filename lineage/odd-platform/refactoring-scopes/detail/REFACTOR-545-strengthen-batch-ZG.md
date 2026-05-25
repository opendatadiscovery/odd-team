## STRENGTHENS — Batch ZG (DatasetFieldController adds THREE new endpoint-level 201-vs-200 drift instances to the cluster)

**New surfaced_by entries**:

The DatasetFieldController controller-class sidecar surfaces THREE new endpoint-level 201-vs-200 drifts (the three PUT endpoints) PLUS ONE asymmetry (the POST endpoint correctly returns 201):

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**Spec/code response-code drift: OpenAPI declares HTTP 201 for the three PUT endpoints, controller returns 200 OK.**" — evidence: `openapi.yaml:2465, :2488, :2511` (`'201': description: OK`) vs `DatasetFieldController.java:42, :52, :62` (`ResponseEntity::ok` → HTTP 200).

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[5]` (LOW, observational) — "**`createEnumValue` returns HTTP 201 from the controller AND the spec says 201** — no drift here. Note this asymmetry: ONLY the POST endpoint correctly returns 201; the three PUT endpoints DO drift. The asymmetry implies the controller author followed the spec for one endpoint but not the other three."

**Cluster size update**:

The cluster size grows from 9+ endpoint-level instances (batch V/W/X/Y) to 12+:
- Previous cluster: createOwner + updateOwner (REFACTOR-641), createTag + updateTag (REFACTOR-492), DataSourceController register + update (REFACTOR-591), CollectorController family (REFACTOR-545 origin), ... [9+ instances]
- **NEW Batch ZG**: DatasetFieldController PUT description + PUT name + PUT tags (3 new instances)
- DatasetFieldController POST enum_values (the ONE CORRECT case — does NOT drift; serves as the case-law for "the spec/code agreement is achievable")

The asymmetry within ONE controller (the POST returns 201 correctly; the three PUTs return 200 with spec saying 201) is informative: the controller author DID know the spec's 201 contract for at least one endpoint; the drift on the other three is either inattention or a deliberate sub-decision. Without a comment, the intent is unanchored.

**Cross-batch refinement** (the cluster's structural shape):

The platform-wide pattern is now confirmed: mutating endpoints UNIFORMLY return 200 via `.map(ResponseEntity::ok)` EXCEPT for one-off cases where the controller explicitly calls `ResponseEntity.status(HttpStatus.CREATED)` (the createEnumValue case). The default-200 pattern is the convention; the spec's 201 declaration is the divergent-from-convention; the spec-vs-code drift compounds across the cluster.

The systemic fix prescribed at REFACTOR-545 origin (a CI check that diff-walks generated `*Api` interface return-codes against `ResponseEntity` calls and fails on mismatch) closes the entire cluster atomically. The cluster has grown by 3+ this batch; the systemic fix's value-per-effort ratio grows correspondingly.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-492 (Tag drift), REFACTOR-591 (DataSource drift), REFACTOR-641 (Owner drift), REFACTOR-014 (GenAI spec only declares 200 — variant where the spec is the side that's incomplete).
- SUPERSEDES: none.
- CONFLICTS: none.

---
