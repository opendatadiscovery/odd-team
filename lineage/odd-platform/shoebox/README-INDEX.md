# Shoebox — consolidated index (rev 10, fulfilment pass 2026-05-26)

Generated from `lineage/odd-platform/shoebox/detail/SHB-*.md`. 124 threads.

- **Categories**: clustering = 44 · open = 80
- **Severities**: MEDIUM = 58 · HIGH = 57 · LOW = 9
- **Slices**: A=15 (SHB-003..017) · B=10 (023..032) · C=7 (043..049) · D=15 (053..068, no 058) · E=13 (083..095) · F=12 (103..114) · G=10 (123..132) · H1=30 (143..172) · H2=10 (173..182)

## All threads

| ID | Category | Severity | Hypothesis |
|---|---|---|---|
| SHB-001 | clustering | MEDIUM | Data Entity staleness signal |
| SHB-002 | open | LOW | Compact lineage view-mode toggle |
| SHB-003 | clustering | HIGH | Data Entity Status Auto-Flip job (DRAFT/DEPRECATED → DELETED on switch time) |
| SHB-004 | clustering | HIGH | applyStatus bug silently breaks `status_updated_at` and the 30-day retention window |
| SHB-005 | clustering | MEDIUM | Tag Origin Channel Ownership (Collector-vs-UI ownership boundary) |
| SHB-006 | clustering | MEDIUM | `listMostPopular` tags returns OLDEST tags re-sorted by usage_count, not the most-popular |
| SHB-007 | clustering | HIGH | Dataset Schema Revision History (per-version structure + diff + cross-dataset version-id leak) |
| SHB-008 | open | MEDIUM | Custom Metadata Field Catalogue (auto-growth, pageInfo theatre, no read permission) |
| SHB-009 | clustering | HIGH | Custom Metadata Value write drift (UPDATE-not-UPSERT silent 200, type validation absent, EXTERNAL overwrite, active=NULL regression, no activity event) |
| SHB-010 | clustering | HIGH | Dataset Field per-column annotation surface (replace-all tags, BULK-REPLACE enums, description-link DELETE quirk, XSS verbatim storage) |
| SHB-011 | clustering | HIGH | Runs History endpoint 500s on in-flight runs (RUNNING wire/DB enum asymmetry) and surfaces RUNNING tasks at top of list silently |
| SHB-012 | open | MEDIUM | Directory level-4 page-vs-count predicate divergence (EXCLUDE_FROM_SEARCH inconsistency breaks pagination math) |
| SHB-013 | open | MEDIUM | Directory reflection-based ODDRN-property leak (host / database / port / cluster / account exposed without redaction) |
| SHB-014 | clustering | MEDIUM | `view_count` as ungated popularity-rating channel (any caller inflates any entity to the top of Popular) |
| SHB-015 | clustering | HIGH | Attachment chunk staging path is hardcoded `/tmp/odd/chunks` and per-instance — multi-instance deployments fail under BOTH LOCAL and REMOTE storage |
| SHB-016 | open | MEDIUM | Search session UUIDs: GET-is-a-write `last_accessed_at` UPDATE + persistent query-text trail + bearer-token semantics |
| SHB-017 | open | MEDIUM | Description-edit emits dual activity events + `[[ns:term]]` auto-linking + DELETE-term cannot remove description-linked terms |
| SHB-023 | open | MEDIUM | Microservices lineage is rendered by the SAME hierarchy canvas as datasets, with no class-aware affordances |
| SHB-024 | open | HIGH | Operator can drive arbitrary backend lineage depth by hand-editing `?d=` URL despite UI dropdown caps |
| SHB-025 | open | HIGH | Relationships list endpoint enumerates the entire cross-tenant relationship catalog with WEAKER scoping than `/api/dataentities` |
| SHB-026 | open | HIGH | `relationship_id` path-param TRANSLATES_SILENTLY to `data_entity.id` — third-party callers 404 on real relationships.id values |
| SHB-027 | clustering | HIGH | Query Examples render `definition` AND `query` through Markdown without sanitisation — 4th member of the stored-XSS family |
| SHB-028 | clustering | HIGH | Term-to-term linkage has NO SecurityRule — docs claim TERM_UPDATE gates "directly-linked terms" but runtime accepts any authenticated user |
| SHB-029 | open | MEDIUM | Term delete leaves orphan `term_to_term` rows AND stale `term_search_entrypoint` vectors — deleted terms remain visible in linked-terms panels and search-index storage |
| SHB-030 | open | HIGH | `[[ns:term]]` description-mention syntax silently creates term-link rows, bypassing `DATA_ENTITY_ADD_TERM` permission |
| SHB-031 | open | MEDIUM | TermDetails shell + Overview tab both fire `GET /api/terms/{id}` — 2× cost on a 12-JOIN hot path per page-open |
| SHB-032 | open | MEDIUM | `GET /api/dataentitygroups/{id}/lineage` returns the SAME 404 for "DEG not found", "entity is not a DEG", and "DEG has zero members" — three distinct conditions silently conflated |
| SHB-043 | open | MEDIUM | SLA badge PNG endpoint leaks per-dataset health colour cross-origin via cookie-bearing `<img>` embed |
| SHB-044 | open | MEDIUM | Data-quality test severity changes leave NO audit trail; compliance can't answer "who set this to Critical?" |
| SHB-045 | clustering | HIGH | Quality Dashboard `test_results` counts TESTS by their latest-run status, NOT RUNS as the label and live docs promise |
| SHB-046 | open | HIGH | Lookup Tables list silently caps at 30 rows because InfiniteScroll scrollableTarget references a non-existent DOM id |
| SHB-047 | open | HIGH | Renaming a lookup table renames the underlying Postgres table, silently breaking every downstream pipeline that joined against the old name |
| SHB-048 | clustering | MEDIUM | Lookup-Table permissions are globally-scoped (NO_CONTEXT), inconsistent with Term / Data Entity per-resource scoping — any user with LOOKUP_TABLE_UPDATE can mutate ANY lookup table |
| SHB-049 | clustering | HIGH | 14+ code-referenced i18n keys missing from en.json; every non-English locale silently shows English text for top-level navigation, Lookup Tables form, Query Examples flows |
| SHB-053 | clustering | HIGH | Email failure silently aborts cross-channel notification fan-out for the alert |
| SHB-054 | clustering | HIGH | A single un-deliverable ALERT row blocks ALL notifications cluster-wide indefinitely |
| SHB-055 | open | HIGH | Ingestion-supplied alert descriptions can broadcast-notify the entire Slack workspace via @channel injection |
| SHB-056 | open | HIGH | Webhook receivers cannot verify alert payloads originated from ODD (no HMAC, no signing, no shared secret) |
| SHB-057 | clustering | HIGH | Any authenticated user can drive unbounded LLM cost via /api/genai/ask with no audit, no rate-limit, no size cap, no role gate |
| SHB-059 | clustering | MEDIUM | Activity feed username actor identity bleeds across auth providers — LDAP "alice" and LOGIN_FORM "alice" are indistinguishable in audit history |
| SHB-060 | open | MEDIUM | "My objects" Activity view silently shows empty for users without an Owner association — discoverability gap, looks identical to "no activity" |
| SHB-061 | open | MEDIUM | Alert reopen-conflict guard is application-only — two concurrent reopens of the same type on the same entity both succeed |
| SHB-062 | open | MEDIUM | Discussions /api/messages/{id}/url is a message-existence oracle + open-redirect class surface |
| SHB-063 | open | HIGH | Slack OAuth bot token is the single secret protecting the workspace integration — no rotation, no scoping, no in-app revocation signal |
| SHB-064 | clustering | MEDIUM | Notification channel routing is impossible — every configured channel receives every alert regardless of owner / severity / namespace |
| SHB-065 | open | MEDIUM | Four hand-numbered Postgres advisory lock IDs across notification/datacollaboration/partition subsystems have no central registry — collision = silent deadlock-class behaviour |
| SHB-066 | open | MEDIUM | Notifications and DataCollaboration subsystems emit zero Prometheus metrics — operators cannot answer "are alerts being delivered" without log greppage |
| SHB-067 | open | MEDIUM | /api/activity/counts accepts null dates and silently scans the entire activity history; /api/activity rejects them — asymmetric validation = unbounded query oracle |
| SHB-068 | open | MEDIUM | AlertManager webhook discards severity / alertname / generator labels — every external alert is the same DISTRIBUTION_ANOMALY type with no operator-side discrimination |
| SHB-083 | clustering | HIGH | Housekeeping TTL Java-vs-YAML default mismatch silently deletes all historical state on operator-customised config |
| SHB-084 | clustering | HIGH | Owner directory mintable from 3 service-tier side-doors, bypassing OWNER_CREATE permission |
| SHB-085 | open | MEDIUM | Management-tab list endpoints are universally ungated reads (any authenticated user enumerates Owners / Datasources / Collectors / Titles / Namespaces) |
| SHB-086 | clustering | HIGH | Namespace directory mintable from 4 sister services (TermService / DataSourceService / CollectorService / DataEntityGroupService), bypassing NAMESPACE_CREATE |
| SHB-087 | open | HIGH | DIRECT_OWNER_SYNC + getOrCreate compose into a self-mint-then-self-bind privilege escalation chain |
| SHB-088 | open | MEDIUM | Title directory's free-text auto-create silently defeats Policy conditions on `dataEntity:owner:title == 'X'` |
| SHB-089 | open | MEDIUM | Activity-feed (and Message) retention silently does not exist; docs imply it does |
| SHB-090 | clustering | HIGH | Collector + Datasource token rotation has no grace window — in-flight ingestion 401s on the UPDATE commit |
| SHB-091 | open | HIGH | Collector + Datasource token entropy uses non-cryptographic `RandomStringUtils` → predictable tokens |
| SHB-092 | open | HIGH | Operator UI edits to Datasource name/description are silently overwritten by the next collector startup (asymmetric merge across two write paths) |
| SHB-093 | clustering | MEDIUM | Cascade-on-delete check is TOCTOU-racy across Owner / Namespace / DataSource (non-atomic with the soft-delete that follows) |
| SHB-094 | open | HIGH | AlertHousekeepingJob jOOQ predicate bypasses TTL for manual RESOLVED alerts (docs-acknowledged, source-uncommented, un-tracked, untested) |
| SHB-095 | open | MEDIUM | Soft-deleted Owner row visible via GET-by-id but hidden from list (visibility asymmetry leaks deleted PII) |
| SHB-103 | open | MEDIUM | Per-provider admin-grant inconsistency across OAuth2 handlers |
| SHB-104 | open | HIGH | GitHub login rename silently orphans Owner association |
| SHB-105 | open | MEDIUM | `/api/identity/whoami` is an anonymous auth-mode fingerprint probe |
| SHB-106 | open | HIGH | `auth.ingestion.filter.enabled` only protects one of four `/ingestion/*` paths |
| SHB-107 | open | MEDIUM | OAuth logout token-revocation is asymmetric across providers |
| SHB-108 | open | HIGH | Session cookie attributes never configured; sessions never expire |
| SHB-109 | open | HIGH | S2S `X-API-Key` grants ADMIN globally across ALL `/**` paths |
| SHB-110 | open | HIGH | LDAP `admin-groups` substring match grants admin via name collision |
| SHB-111 | open | HIGH | Soft-deleted Policy still grants permissions (catalogue-vs-grant asymmetry) |
| SHB-112 | open | MEDIUM | Post-logout redirect URI derived from inbound Host header (open-redirect surface) |
| SHB-113 | open | MEDIUM | `PermissionResourceType.MANAGEMENT` is valid in spec but rejected at runtime |
| SHB-114 | open | MEDIUM | Read-collaborative posture: every authenticated user enumerates the catalog |
| SHB-123 | open | HIGH | `auth.ingestion.filter.enabled` covers 1 of 5 ingestion endpoints, but its name suggests the whole namespace |
| SHB-124 | clustering | HIGH | Operators see their datasources commingled because ingestion routes by payload ODDRN, not by collector token identity |
| SHB-125 | open | HIGH | `POST /ingestion/entities/datasets/stats` lets any caller write field statistics to any dataset by knowing the field's ODDRN |
| SHB-126 | open | MEDIUM | Stats ingestion is a side-channel into the global tag taxonomy — bypasses `TAG_CREATE` RBAC |
| SHB-127 | clustering | MEDIUM | Collectors that mix a single bad entity into a 1000-entity payload lose the entire batch with a 5xx body-shape, no per-entity error report, no DLQ |
| SHB-128 | open | MEDIUM | Every running platform serves the full 194-operation API spec at `/api/v3/api-docs` unauthenticated, including a "ProspectLog" legacy title and a personal contact email |
| SHB-129 | open | HIGH | Slack Events webhook (`POST /api/slack/events`) accepts forged events from any internet host because the Slack signing-secret verification is not implemented |
| SHB-130 | open | MEDIUM | `odd.tenant-id` does nothing for metric storage on INTERNAL_POSTGRES (the default), making the documented per-tenant scoping a silent no-op for most deployments |
| SHB-131 | open | HIGH | `GET /ingestion/dataentitygroups/{degOddrn}/entities` lets any HTTP caller enumerate DEG membership in every deployment configuration |
| SHB-132 | open | MEDIUM | Collector tokens have no DB-level uniqueness; soft-deleting a Collector does not revoke its token; both shapes allow cross-collector identity confusion that operators cannot recover from runtime state |
| SHB-143 | clustering | MEDIUM | Primary-navigation tabs render unconditional of feature-flag state |
| SHB-144 | open | LOW | Primary navigation tab labels diverge from URL paths, breaking the operator's URL-mental-model |
| SHB-145 | open | MEDIUM | Catalog and Dictionary tab clicks produce silent no-op failures on backend rejection |
| SHB-146 | open | LOW | Activity tab link carries a 5-day window baked at SPA-bundle load time, not click time |
| SHB-147 | clustering | MEDIUM | i18next fallbackLng walks all six locales before reaching English, occasionally surfacing Spanish or Chinese to non-English users |
| SHB-148 | clustering | LOW | Browser language preference is never consulted; six-locale UI defaults to English on first visit regardless of navigator.language |
| SHB-149 | open | LOW | All six locale JSON bundles ship in the main JS chunk regardless of which the user picks |
| SHB-150 | clustering | MEDIUM | App Info menu opens five external links in new tabs without rel='noopener noreferrer' |
| SHB-151 | open | MEDIUM | App Info menu is hover-only and keyboard-inaccessible despite ARIA claims |
| SHB-152 | open | LOW | App Info menu shows stale operator-configured links until full page reload |
| SHB-153 | clustering | HIGH | Bare-URL fall-through produces a blank page; SPA has no path='*' catch-all and no React error boundary |
| SHB-154 | open | MEDIUM | Backend error messages flash for 6 seconds in a toast; operators have no persistent way to recover the diagnostic |
| SHB-155 | open | MEDIUM | Two state-management paradigms coexist (Redux + jotai); per-feature stores reset on navigate-away with no operator warning |
| SHB-156 | clustering | HIGH | DQ Dashboard "Title" filter binds to OWNERSHIP.TITLE_ID (ownership role) — not dataset title — with no UI signal of the translation |
| SHB-157 | open | MEDIUM | DQ Dashboard filter autocompletes have no debounce + stuck-spinner-on-fail; operators see request bursts and broken loading states |
| SHB-158 | open | MEDIUM | DQ Dashboard fires a full dashboard refetch on every single filter-chip toggle; no batch-apply, no debounce |
| SHB-159 | clustering | MEDIUM | NamespaceAutocomplete mislabels existing namespaces as creatable when total matches exceed 30 |
| SHB-160 | clustering | HIGH | Datasource token regeneration confirms an "Are you sure?" prompt but never warns it breaks running ingestion |
| SHB-161 | open | HIGH | Datasource form submit closes the modal on rejection, discarding all typed input, with only a transient toast |
| SHB-162 | clustering | HIGH | Editing a datasource's name nulls its description (full-form REPLACE-not-MERGE) with no UI warning |
| SHB-163 | clustering | HIGH | Every Management sub-area except Associations is reachable by deep-link to any authenticated user |
| SHB-164 | clustering | HIGH | Opening any data entity detail page mints two view_count increments via self-feeding useEffect dep-array loop |
| SHB-165 | open | MEDIUM | Opening any data entity detail page fires a 5-thunk parallel salvo; no batching, no de-dup, no rate-limit |
| SHB-166 | clustering | HIGH | All Markdown rendering in ODD Platform UI lacks rehype-sanitize; defence-in-depth depends on Chromium HTML-parser policy |
| SHB-167 | open | LOW | Description editor saves on Shift+Enter — power-user shortcut hidden from the only operator-facing tooltip |
| SHB-168 | open | MEDIUM | Description editor's Cancel button silently discards in-flight edits with no confirm prompt |
| SHB-169 | clustering | HIGH | Home-page OwnerAssociation card mis-gates on empty / typo'd / whitespace auth.type values |
| SHB-170 | open | MEDIUM | NamespaceAutocomplete strands the spinner on backend failure across 5+ form types |
| SHB-171 | open | LOW | AppErrorPage has no Try Again / Reload affordance; operators must manually navigate to recover from transient backend errors |
| SHB-172 | open | LOW | AppErrorPage callers using react-query cast a different error type, producing undefined behaviour on missing fields |
| SHB-173 | open | MEDIUM | `/api/appInfo` deployment fingerprint surface (auth-mode + projectVersion exposure) |
| SHB-174 | clustering | HIGH | MinIO SDK builder ships THREE caveat-defaulted parameters, not one — LSN-002 generalises |
| SHB-175 | open | MEDIUM | R2DBC pool ceiling silently 20-per-replica; ten `spring.r2dbc.pool.*` knobs wired but undocumented |
| SHB-176 | open | HIGH | Single-thread `@Scheduled` executor — four background jobs share ONE thread, undocumented |
| SHB-177 | open | HIGH | Spring Boot Actuator `/env` exposure default-on; cross-cutting credentials enumeration surface |
| SHB-178 | clustering | MEDIUM | Operator-Configured Additional Links — URL scheme unvalidated + reverse-tabnabbing (enricher of F-035) |
| SHB-179 | open | MEDIUM | Three soft-delete mechanisms coexist; operator-observable deletion semantics drift across the schema |
| SHB-180 | clustering | HIGH | LOGIN_FORM ↔ LDAP ↔ S2S cross-mode owner bleed via `provider=null` collapse |
| SHB-181 | open | HIGH | ADMIN-role promotion mechanism diverges per auth provider (LDAP substring vs OAuth2 claim vs ODD_IAM flag) |
| SHB-182 | open | HIGH | Orphaned ingestion credentials persist forever; TOKEN table has no housekeeping |
