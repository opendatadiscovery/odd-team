# Alerting

Notifications on entity state changes, quality failures, schema drift, ownership changes.

## Code Entry Points (odd-platform)

### Controllers
- `odd-platform-api/.../controller/AlertController.java` — REST API: list all/my/dependent alerts, change status, get totals
- `odd-platform-api/.../controller/AlertManagerController.java` — `POST /ingestion/alert/alertmanager` external webhook

### Services
- `odd-platform-api/.../service/AlertService.java` → `AlertServiceImpl.java` — core alert CRUD, status updates, action application
- `odd-platform-api/.../service/AlertLocator.java` → `AlertLocatorImpl.java` — BIS detection: dataset fields, transformer sources/targets, consumer inputs
- `odd-platform-api/.../service/AlertHaltConfigServiceImpl.java` — per-entity alert notification snooze

### Alert Ingestion Pipeline
- `odd-platform-api/.../service/ingestion/processor/AlertIngestionRequestProcessor.java` — processes ingestion events into alert actions
- `odd-platform-api/.../service/ingestion/alert/AlertActionResolver.java` → `AlertActionResolverImpl.java` — resolves ingestion events to create/resolve alerts
- `odd-platform-api/.../service/ingestion/alert/AlertActionResolverFactory.java` — factory with halt config integration
- `odd-platform-api/.../service/ingestion/alert/AlertBISCandidate.java` — backwards incompatible schema candidate DTO
- `odd-platform-api/.../service/ingestion/alert/IngestionTaskRunAlertState.java` — task run alert state tracking

### Notifications
- `odd-platform-api/.../notification/config/NotificationConfiguration.java` — Slack/Webhook/Email sender beans
- `odd-platform-api/.../notification/config/NotificationsProperties.java` — `notifications.*` config binding
- `odd-platform-api/.../notification/config/EmailSenderProperties.java` — `notifications.receivers.email.*` config (host, port, protocol, smtp.auth, smtp.starttls)
- `odd-platform-api/.../notification/sender/SlackNotificationSender.java` — Slack incoming webhook sender
- `odd-platform-api/.../notification/sender/WebhookNotificationSender.java` — generic webhook sender
- `odd-platform-api/.../notification/sender/EmailNotificationSender.java` — email notification sender
- `odd-platform-api/.../notification/dto/AlertNotificationMessage.java` — notification message DTO
- `odd-platform-api/.../notification/translator/AlertNotificationMessageTranslator.java` — DB records → notification message

### DTOs & Enums
- `odd-platform-api/.../dto/alert/AlertTypeEnum.java` — 4 types: BACKWARDS_INCOMPATIBLE_SCHEMA, FAILED_DQ_TEST, FAILED_JOB, DISTRIBUTION_ANOMALY
- `odd-platform-api/.../dto/alert/AlertStatusEnum.java` — 3 statuses: OPEN, RESOLVED, RESOLVED_AUTOMATICALLY
- `odd-platform-api/.../dto/alert/AlertDto.java` — alert data transfer object
- `odd-platform-api/.../dto/alert/ExternalAlert.java` — AlertManager payload: labels, generatorURL, startsAt

### Housekeeping
- `odd-platform-api/.../housekeeping/job/AlertHousekeepingJob.java` — auto-deletes resolved alerts after `housekeeping.ttl.resolved_alerts_days` (default 30)

### Auth
- `odd-platform-api/.../auth/manager/extractor/AlertResourceExtractor.java` — RBAC resource extraction for alert operations

### Activity Tracking
- `odd-platform-api/.../service/activity/handler/AlertHaltConfigUpdatedActivityHandler.java`
- `odd-platform-api/.../service/activity/handler/AlertStatusUpdatedHandler.java`

### Repository
- `odd-platform-api/.../repository/reactive/ReactiveAlertRepository.java` → `ReactiveAlertRepositoryImpl.java`

## UI Components (odd-platform-ui)

- `src/components/Alerts/Alerts.tsx` — alerts page container
- `src/components/Alerts/AlertsTabs/AlertsTabs.tsx` — "All" / "My Objects" / "Dependents" tabs
- `src/components/Alerts/AlertsList/AlertsList.tsx` — paginated alert list
- `src/components/Alerts/AlertsList/AlertItem/AlertItem.tsx` — single alert row
- `src/components/Alerts/AlertsRoutes/AlertsRoutes.tsx` — routing for alert views
- `src/components/DataEntityDetails/DataEntityAlerts/NotificationSettings/AlertTypeRange/AlertTypeRange.tsx` — per-entity alert halt config UI (30min–1week)
- `src/components/shared/elements/AlertStatusItem/AlertStatusItem.tsx` — alert status badge
- `src/components/shared/elements/AlertIcon/AlertIcon.tsx` — alert icon component
- `src/components/shared/elements/Activity/ActivityFields/AlertActivityField/AlertActivityField.tsx` — alert activity display

## OpenAPI Spec
- `odd-platform-specification/openapi.yaml` — Alert endpoints at lines 1321, 1340, 1514, 2612, 2630, 2648, 2666, 2681

## Configuration (application.yml)
- `notifications.enabled` (default: false)
- `notifications.message.downstream-entities-depth` (default: 1)
- `notifications.wal.*` — PostgreSQL WAL replication settings
- `notifications.receivers.slack.url` — Slack incoming webhook URL
- `notifications.receivers.webhook.url` — generic webhook URL
- `notifications.receivers.email.{host,port,protocol,sender,password,smtp.auth,smtp.starttls,notification.emails}`
- `housekeeping.ttl.resolved_alerts_days` (default: 30) — auto-cleanup of resolved alerts
- `odd.platform-base-url` — used in notification hyperlinks

## Documentation Pages
- `documentation/docs/Features.md#pipeline-monitoring-and-alerting` — feature overview (4 alert types, notification channels)
- `documentation/docs/configuration-and-deployment/odd-platform.md#enable-alert-notifications` — setup guide

## Related Domains
- data-entities (alerts monitor entity state)
- data-quality (quality failures trigger alerts)
- collaboration (alert subscribers are owners/watchers)
- ingestion (alert processing happens during ingestion pipeline)
