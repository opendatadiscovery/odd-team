# config_prefixes rollup

Total prefixes: 14. @ConfigurationProperties classes: 9. @Value consumers: 76.
Auto-derived from `lineage/{repo}/nodes.jsonl` + `edges.jsonl`. Each top-level YAML namespace in `application.yml` is one node; consumer classes (config-properties-class) and `@Value` readers (config-key-consumer) edge into their top-level prefix via `configures` edges.

## attachment

YAML anchor: `odd-platform-api/src/main/resources/application.yml#attachment` — no `@docs`. Classes: 0. Consumers: 12.

**@Value consumers**
- `LocalFilePathConstructor.basePath` reads `${attachment.local.path}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/local/LocalFilePathConstructor.java:15`
- `AttachmentServiceImpl.maxFileSize` reads `${attachment.max-file-size}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/AttachmentServiceImpl.java:27`
- `MinioConfig.accessKey` reads `${attachment.remote.access-key}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:15`
- `RemoteFileUploadServiceImpl.bucket` reads `${attachment.remote.bucket}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/remote/RemoteFileUploadServiceImpl.java:39`
- `MinioConfig.region` reads `${attachment.remote.region}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:22`
- `MinioConfig.secretKey` reads `${attachment.remote.secret-key}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:17`
- `MinioConfig.url` reads `${attachment.remote.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:13`
- `RemoteFilePathConstructor.@ConditionalOnProperty` reads `${attachment.storage}` (default `havingValue=REMOTE`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/remote/RemoteFilePathConstructor.java:10`
- `MinioConfig.@ConditionalOnProperty` reads `${attachment.storage}` (default `havingValue=REMOTE`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MinioConfig.java:11`
- `LocalFilePathConstructor.@ConditionalOnProperty` reads `${attachment.storage}` (default `havingValue=LOCAL`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/local/LocalFilePathConstructor.java:13`
- `LocalFileUploadServiceImpl.@ConditionalOnProperty` reads `${attachment.storage}` (default `havingValue=LOCAL`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/local/LocalFileUploadServiceImpl.java:26`
- `RemoteFileUploadServiceImpl.@ConditionalOnProperty` reads `${attachment.storage}` (default `havingValue=REMOTE`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/attachment/remote/RemoteFileUploadServiceImpl.java:36`

## auth

YAML anchor: `odd-platform-api/src/main/resources/application.yml#auth` — no `@docs`. Classes: 2. Consumers: 18.

**@ConfigurationProperties classes**
- `ODDLDAPProperties` (`@ConfigurationProperties("auth.ldap")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/ODDLDAPProperties.java`
- `ODDOAuth2Properties` (`@ConfigurationProperties("auth.oauth2")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/ODDOAuth2Properties.java`

**@Value consumers**
- `IngestionDataEntitiesFilter.@ConditionalOnProperty` reads `${auth.ingestion.filter.enabled}` (default `havingValue=true`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:20`
- `IngestionAuthenticationFilter.@ConditionalOnProperty` reads `${auth.ingestion.filter.enabled}` (default `havingValue=true`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionAuthenticationFilter.java:49`
- `LoginFormSecurityConfiguration.credentialString` reads `${auth.login-form-credentials}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LoginFormSecurityConfiguration.java:70`
- `LoginFormSecurityConfiguration.redirectURIString` reads `${auth.login-form-redirect}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LoginFormSecurityConfiguration.java:41`
- `S2sTokenProvider.s2sEnabled` reads `${auth.s2s.enabled}` (default `false`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/S2sTokenProvider.java:12`
- `LoginFormSecurityConfiguration.s2sEnabled` reads `${auth.s2s.enabled}` (default `false`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LoginFormSecurityConfiguration.java:42`
- `OAuthSecurityConfiguration.s2sEnabled` reads `${auth.s2s.enabled}` (default `false`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/OAuthSecurityConfiguration.java:90`
- `LDAPSecurityConfiguration.s2sEnabled` reads `${auth.s2s.enabled}` (default `false`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LDAPSecurityConfiguration.java:140`
- `S2sTokenProvider.s2sToken` reads `${auth.s2s.token}` (default `#{null}`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/S2sTokenProvider.java:10`
- `DisabledAuthSecurityConfiguration.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=DISABLED`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/DisabledAuthSecurityConfiguration.java:10`
- `AuthorizationManagerCondition.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=OAUTH2`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/condition/AuthorizationManagerCondition.java:11`
- `AuthorizationManagerCondition.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=LDAP`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/condition/AuthorizationManagerCondition.java:15`
- `OAuthLogoutSuccessHandler.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=OAUTH2`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/OAuthLogoutSuccessHandler.java:16`
- `AppInfoController.authType` reads `${auth.type}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AppInfoController.java:18`
- `AuthIdentityProviderImpl.authType` reads `${auth.type}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/AuthIdentityProviderImpl.java:24`
- `LoginFormSecurityConfiguration.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=LOGIN_FORM`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LoginFormSecurityConfiguration.java:31`
- `LDAPSecurityConfiguration.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=LDAP`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LDAPSecurityConfiguration.java:51`
- `OAuthSecurityConfiguration.@ConditionalOnProperty` reads `${auth.type}` (default `havingValue=OAUTH2`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/OAuthSecurityConfiguration.java:71`

## datacollaboration

YAML anchor: `odd-platform-api/src/main/resources/application.yml#datacollaboration` — no `@docs`. Classes: 1. Consumers: 2.

**@ConfigurationProperties classes**
- `DataCollaborationProperties` (`@ConfigurationProperties("datacollaboration")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/datacollaboration/config/DataCollaborationProperties.java`

**@Value consumers**
- `MessageTablePartitionManager.partitionDaysPeriod` reads `${datacollaboration.message-partition-period}` (default `30`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/partition/manager/MessageTablePartitionManager.java:19`
- `DataCollaborationConfiguration.slackOauthToken` reads `${datacollaboration.slack-oauth-token}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/datacollaboration/config/DataCollaborationConfiguration.java:21`

## genai

YAML anchor: `odd-platform-api/src/main/resources/application.yml#genai` — no `@docs`. Classes: 1. Consumers: 0.

**@ConfigurationProperties classes**
- `GenAIProperties` (`@ConfigurationProperties("genai")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/properties/GenAIProperties.java`

## housekeeping

YAML anchor: `odd-platform-api/src/main/resources/application.yml#housekeeping` — no `@docs`. Classes: 1. Consumers: 1.

**@ConfigurationProperties classes**
- `HousekeepingTTLProperties` (`@ConfigurationProperties("housekeeping.ttl")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/config/HousekeepingTTLProperties.java`

**@Value consumers**
- `HousekeepingJobManager.@ConditionalOnProperty` reads `${housekeeping.enabled}` (default `havingValue=true`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/housekeeping/HousekeepingJobManager.java:18`

## logging

YAML anchor: `odd-platform-api/src/main/resources/application.yml#logging` — no `@docs`. Classes: 0. Consumers: 0.

(No @ConfigurationProperties class or @Value consumer found bound to this top-level prefix in odd-platform-api.)

## management

YAML anchor: `odd-platform-api/src/main/resources/application.yml#management` — no `@docs`. Classes: 0. Consumers: 0.

(No @ConfigurationProperties class or @Value consumer found bound to this top-level prefix in odd-platform-api.)

## metrics

YAML anchor: `odd-platform-api/src/main/resources/application.yml#metrics` — no `@docs`. Classes: 1. Consumers: 17.

**@ConfigurationProperties classes**
- `MetricExporterProperties` (`@ConfigurationProperties("metrics.export")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/properties/MetricExporterProperties.java`

**@Value consumers**
- `NoOpOTLPMetricService.@ConditionalOnProperty` reads `${metrics.export.enabled}` (default `havingValue=false`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/NoOpOTLPMetricService.java:8`
- `MetricExporterConfiguration.@ConditionalOnProperty` reads `${metrics.export.enabled}` (default `havingValue=true`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/MetricExporterConfiguration.java:10`
- `OTLPMetricServiceImpl.@ConditionalOnProperty` reads `${metrics.export.enabled}` (default `havingValue=true`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/metric/OTLPMetricServiceImpl.java:18`
- `ExternalMetricReader.prometheusHost` reads `${metrics.prometheus-host}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ExternalMetricReader.java:52`
- `ExternalIngestionMetricsServiceImpl.prometheusHost` reads `${metrics.prometheus-host}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/ExternalIngestionMetricsServiceImpl.java:68`
- `GaugeTimeSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/GaugeTimeSeriesExtractor.java:16`
- `CounterMetricsSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/internal/CounterMetricsSeriesExtractor.java:18`
- `GaugeMetricSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/internal/GaugeMetricSeriesExtractor.java:18`
- `HistogramMetricSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/internal/HistogramMetricSeriesExtractor.java:19`
- `CounterTimeSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/CounterTimeSeriesExtractor.java:20`
- `SummaryTimeSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/SummaryTimeSeriesExtractor.java:25`
- `HistogramTimeSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/HistogramTimeSeriesExtractor.java:26`
- `SummaryMetricsSeriesExtractor.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/internal/SummaryMetricsSeriesExtractor.java:28`
- `InternalMetricReader.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/InternalMetricReader.java:29`
- `ExternalMetricReader.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ExternalMetricReader.java:40`
- `ExternalIngestionMetricsServiceImpl.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=PROMETHEUS`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/ExternalIngestionMetricsServiceImpl.java:56`
- `InternalIngestionMetricsServiceImpl.@ConditionalOnProperty` reads `${metrics.storage}` (default `havingValue=INTERNAL_POSTGRES`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/InternalIngestionMetricsServiceImpl.java:66`

## notifications

YAML anchor: `odd-platform-api/src/main/resources/application.yml#notifications` — no `@docs`. Classes: 2. Consumers: 8.

**@ConfigurationProperties classes**
- `EmailSenderProperties` (`@ConfigurationProperties("notifications.receivers.email")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/EmailSenderProperties.java`
- `NotificationsProperties` (`@ConfigurationProperties("notifications")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationsProperties.java`

**@Value consumers**
- `NotificationConfiguration.downstreamEntitiesDepth` reads `${notifications.message.downstream-entities-depth}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:123`
- `NotificationConfiguration.notificationEmails` reads `${notifications.receivers.email.notification.emails}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:104`
- `NotificationConfiguration.@ConditionalOnProperty` reads `${notifications.receivers.email.sender}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:37`
- `NotificationConfiguration.@ConditionalOnProperty` reads `${notifications.receivers.email.sender}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:102`
- `NotificationConfiguration.@ConditionalOnProperty` reads `${notifications.receivers.slack.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:75`
- `NotificationConfiguration.slackWebhookUrl` reads `${notifications.receivers.slack.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:77`
- `NotificationConfiguration.@ConditionalOnProperty` reads `${notifications.receivers.webhook.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:89`
- `NotificationConfiguration.webhookUrl` reads `${notifications.receivers.webhook.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:91`

## odd

YAML anchor: `odd-platform-api/src/main/resources/application.yml#odd` — no `@docs`. Classes: 1. Consumers: 10.

**@ConfigurationProperties classes**
- `AdditionalLinkProperties` (`@ConfigurationProperties("odd")`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/properties/AdditionalLinkProperties.java`

**@Value consumers**
- `ActivityTablePartitionManager.partitionDaysPeriod` reads `${odd.activity.partition-period}` (default `30`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/partition/manager/ActivityTablePartitionManager.java:11`
- `DataEntityStaleDetector.stalePeriod` reads `${odd.data-entity-stale-period}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityStaleDetector.java:10`
- `SlackMessageGeneratorConfiguration.platformBaseUrl` reads `${odd.platform-base-url}` (default `http://localhost:8080`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/SlackMessageGeneratorConfiguration.java:15`
- `StaticArgumentMappingContext.platformUrl` reads `${odd.platform-base-url}` (default `http://your.odd.platform`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/integration/StaticArgumentMappingContext.java:16`
- `NotificationConfiguration.platformHost` reads `${odd.platform-base-url}` (default `http://localhost:8080`) — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/notification/config/NotificationConfiguration.java:105`
- `GaugeTimeSeriesExtractor.tenantId` reads `${odd.tenant-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/GaugeTimeSeriesExtractor.java:19`
- `CounterTimeSeriesExtractor.tenantId` reads `${odd.tenant-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/CounterTimeSeriesExtractor.java:23`
- `SummaryTimeSeriesExtractor.tenantId` reads `${odd.tenant-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/SummaryTimeSeriesExtractor.java:28`
- `HistogramTimeSeriesExtractor.tenantId` reads `${odd.tenant-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ingestion/metric/extractors/external/HistogramTimeSeriesExtractor.java:29`
- `ExternalMetricReader.tenantId` reads `${odd.tenant-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/ExternalMetricReader.java:53`

## partition

YAML anchor: `odd-platform-api/src/main/resources/application.yml#partition` — no `@docs`. Classes: 0. Consumers: 1.

**@Value consumers**
- `PostgreSQLPartitionCreationJob.activityLockId` reads `${partition.advisory-lock-id}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/partition/PostgreSQLPartitionCreationJob.java:26`

## session

YAML anchor: `odd-platform-api/src/main/resources/application.yml#session` — no `@docs`. Classes: 0. Consumers: 0.

(No @ConfigurationProperties class or @Value consumer found bound to this top-level prefix in odd-platform-api.)

## spring

YAML anchor: `odd-platform-api/src/main/resources/application.yml#spring` — no `@docs`. Classes: 0. Consumers: 3.

**@Value consumers**
- `R2DBCConfiguration.password` reads `${spring.custom-datasource.password}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/R2DBCConfiguration.java:58`
- `R2DBCConfiguration.url` reads `${spring.custom-datasource.url}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/R2DBCConfiguration.java:56`
- `R2DBCConfiguration.username` reads `${spring.custom-datasource.username}` — `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/R2DBCConfiguration.java:57`

## springdoc

YAML anchor: `odd-platform-api/src/main/resources/application.yml#springdoc` — no `@docs`. Classes: 0. Consumers: 0.

(No @ConfigurationProperties class or @Value consumer found bound to this top-level prefix in odd-platform-api.)

