# GenAI / AI Assistant

AI-powered question answering — proxies natural language questions to an external AI service.

## Code Entry Points (odd-platform)

### Controller
- `odd-platform-api/.../controller/GenAIController.java` — POST `/api/genai/ask`

### Service
- `odd-platform-api/.../service/genai/GenAIService.java` → `GenAIServiceImpl.java`
- Calls external AI endpoint at `{genai.url}/query_data` with `{"question": "..."}` payload
- Handles timeout errors with configurable request timeout

### Configuration (application.yml lines 17-20)
- `genai.enabled` — feature toggle (default: false)
- `genai.url` — external AI service URL (e.g., `http://localhost:5000`)
- `genai.request_timeout` — timeout in minutes (default: 2)

### Properties
- `odd-platform-api/.../config/properties/GenAIProperties.java`

## Documentation (verified 2026-04-30)
- User-facing page: `docs/genai.md` (DOC-045, review-ready) — 7 H2 sections covering what gets proxied (request shape diagram), the 3 config keys with @ConfigurationProperties / Java-field defaults caveats, external service contract (POST {url}/query_data with JSON {"question": "..."}; raw-JSON-string response shape un-quoted + Java-unescaped), platform endpoint /api/genai/ask, UI-API-only status, 6 Known limitations.
- Configuration reference: `docs/configuration-and-deployment/odd-platform.md` "## GenAI Configuration" — 3 keys with field-default vs commented-yaml-example caveats + warning admonition + working YAML / env-var tabs + cross-link to genai.md.
- Features.md teaser at "## GenAI assistant" between Vector Store Metadata and Data Modelling.
- main-concepts.md AI-aspects bullet rewired from a stale Features.md pointer to genai.md.

## Caveats (consumer-read audit, 2026-04-30)

- `genai.url` defaults to empty string (Java field default). Documented + flagged for upstream fix (PLT-008).
- `genai.request_timeout` defaults to 0 (Java primitive default) → `Duration.ofMinutes(0)` immediate timeout. Documented + flagged for upstream fix (PLT-008).
- `application.yml:19-20` commented examples (`http://localhost:5000`, `2`) look like defaults but are not — same misframing class as DOC-077 (spring.custom-datasource) and DOC-008 (MinIO region).
- No authentication added by the platform on outbound calls.
- No retry loop — single attempt per `/api/genai/ask`.
- WebClient is built once at startup — restart required to pick up config changes.
- API-only feature — generated TS clients exist (`odd-platform-ui/src/generated-sources/apis/GenaiApi.ts`), no non-generated UI consumer.

## Related Domains
- data-entities (questions are about entities/metadata; the platform forwards the question text verbatim — any catalog-aware retrieval / RAG must happen inside the external service)
- ingestion (the platform does not embed an LLM; the external service is the AI integration point)
