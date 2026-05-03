# Collaboration

Ownership, tags, labels, discussions, activity feed, notifications.

## Code Entry Points (odd-platform)

### Activity
- `odd-platform-api/.../dto/activity/ActivityEventTypeDto.java` — 26 event types (not 4 as docs claim)
- `odd-platform-api/.../service/activity/handler/` — individual handlers per event type
- `odd-platform-specification/openapi.yaml` — `/api/activity`, `/api/activity/counts`

### Activity UI
- `odd-platform-ui/src/components/Activity/Filters/Filters.tsx` — 7 filters: Calendar, Datasource, Namespace, Event type, Tag, Owner, User
- `odd-platform-ui/src/components/shared/elements/Activity/` — shared activity components

### Data Collaboration (Slack messaging)
- `odd-platform-api/.../datacollaboration/config/DataCollaborationProperties.java` — config binding
- `odd-platform-api/.../datacollaboration/config/DataCollaborationFeatureCondition.java` — feature toggle
- `odd-platform-api/.../datacollaboration/client/SlackAPIClient.java` → `SlackAPIClientImpl.java`
- `odd-platform-api/.../datacollaboration/service/SlackMessageProviderClient.java`
- `odd-platform-api/.../service/MessageServiceImpl.java` — message persistence
- `odd-platform-specification/openapi.yaml` — `/api/datacollaboration/providers/slack/channels`, `/api/datacollaboration/providers/slack/messages`

### Tags
- Tags are used on both entities and dataset fields (columns)
- No separate "label" system exists — "labels" in docs is incorrect
- `DATASET_FIELD_TAGS_UPDATED` activity event confirms field-level tagging

### Ownership
- `OWNERSHIP_CREATED`, `OWNERSHIP_UPDATED`, `OWNERSHIP_DELETED` activity events

### Configuration (application.yml)
- `datacollaboration.enabled` (default: false)
- `datacollaboration.receive-event-advisory-lock-id` (default: 110)
- `datacollaboration.sender-message-advisory-lock-id` (default: 120)
- `datacollaboration.message-partition-period` (default: 30 days)
- `datacollaboration.sending-messages-retry-count` (default: 3)
- `datacollaboration.slack-oauth-token`

## Documentation
- `documentation/docs/Features.md#manual-object-tagging` — tagging sub-feature
- `documentation/docs/Features.md#activity-feed-for-monitoring-changes` — activity-feed sub-feature
- `documentation/docs/Features.md#data-collaboration` — Data Collaboration (Slack messaging) user-facing showcase
- `documentation/docs/configuration-and-deployment/odd-platform.md#enable-data-collaboration` — operator config home for Data Collaboration
- `documentation/docs/developer-guides/api-reference.md#data-collaboration` — developer API home for Data Collaboration
- `documentation/docs/main-concepts.md#terms-and-aliases` — Slack alert webhook vs Slack collaboration app taxonomic disambiguation

## Related Domains
- data-entities (ownership assigned to entities)
- alerting (subscribers receive alerts)
- management (users/roles who can own things)
