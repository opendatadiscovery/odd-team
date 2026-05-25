# ADR-CANDIDATE-001 — Controllers are pass-through delegates; HTTP wiring lives on OpenAPI-generator-emitted `*Api` interfaces, not on the controller class

## STRENGTHENS — batch ZF (2026-05-25 — Ingestion + Owner + MetadataField + DataCollab + EventApi class-level)

**Five new class-level confirmations** join the existing 23-sidecar support set:

- `odd-platform__java__IngestionController__controller-class__IngestionController.md:concepts.invariants.[Every-method-Override-of-IngestionApi]` — "Every method `@Override`s a method on `IngestionApi` (line 31 `implements IngestionApi`) — the path mapping (POST/GET on `/ingestion/*` paths) lives in the OpenAPI-generated interface generated from the external `opendatadiscovery-specification` repo. There are NO `@PostMapping`/`@GetMapping`/`@RequestMapping` annotations on this controller class or its methods."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:implicit_adrs.[0]` — "Thin-proxy controller-tier convention — `OwnerController` carries `@RestController` + `@RequiredArgsConstructor` ONLY at the class level; no `@RequestMapping` (path mappings live on the generated interface), no `@PreAuthorize`, no `@Transactional`, no class-level `@Slf4j`. The four `@Override` methods each contain 2-5 lines of pure delegation."
- `odd-platform__java__OwnerController__controller-class__OwnerController.md:implicit_adrs.[2]` — "OpenAPI-generated interface as the single source of routing — `implements OwnerApi` inherits the `@RequestMapping`, the request-body type, the path-variable binding, the OpenAPI `@ApiResponse` declarations."
- `odd-platform__java__MetadataFieldController__controller-class__MetadataFieldController.md:implicit_adrs.[0]` — "**Custom-metadata catalogue is read-only on this surface** — the controller exposes ONLY `getMetadataFieldList`" + `concepts.invariants` — "The controller is the SOLE `@RestController` implementation [of `MetadataApi`]"
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:implicit_adrs.[2]` — "Controller is a thin reactive proxy — every method delegates straight to `DataCollaborationService` with no per-request business logic in the controller itself."
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:understanding` — "The controller (EventApiController.java:18-57) is a thin reactive surface: it reads the raw JSON body, delegates to `SlackEventParser.parse(...)` … and either echoes back Slack's URL-verification `challenge` value, ack-200s anything filtered or unhandled, or — for the PAYLOAD case — calls `DataCollaborationService.enqueueMessageEvent(...)`"

The pattern is now confirmed at **28 sidecars** across every controller-class enriched (was 23 after batch ZD; batch ZE did not net-add to this count because its controllers were already counted; batch ZF adds the 5 new class-level sidecars for Ingestion / Owner / MetadataField / DataCollab / EventApi).

Notable nuance the batch-ZF additions surface:
- **EventApiController is a webhook surface (NOT a /api/* controller)** — yet still follows the pattern: thin delegation; the SlackEventResponse static-factory pattern (`challengeResponse / ack / error`) keeps the controller body free of response-building logic; the parser + service tier carry the semantic work.
- **IngestionController is an S2S surface (NOT a /api/* controller)** — yet still follows the pattern: 5 methods × 4-7 lines each × `@Override` of OpenAPI-generated `IngestionApi`. The pattern propagates across path families.
- **DataCollaborationController + EventApiController are both `@ConditionalOnDataCollaboration`** — yet the conditional registration does NOT change the controller-as-delegate pattern; the thin-proxy convention is orthogonal to feature-flag gating.

The 28-sidecar evidence base is the strongest single ADR pattern in the catalog. Any future controller deviating from the pass-through pattern should be flagged as an architectural exception requiring its own ADR justification.

---
