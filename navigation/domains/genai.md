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

## Documentation
- **None** — feature is completely undocumented

## Related Domains
- data-entities (questions are about entities/metadata)
