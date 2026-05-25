# ADR-CANDIDATE-018 — Outbound-integration-required configuration is fail-fast at boot

## STRENGTHENS — batch ZF (2026-05-25)

**One new class-level confirmation** (from 5-sidecar to **6-sidecar**):

- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:implicit_adrs.[1]` — "Slack OAuth token is required at bean-construction time — boot fails fast rather than degrading silently when the token is missing." — evidence: `DataCollaborationConfiguration.java:23-25` — intent_anchor: `throw new IllegalArgumentException("Slack OAuth token is empty")`

This is the second time the DataCollab Slack OAuth token case has been entered into the support set — first via the batch-ZA `postMessageInSlack` method-tier sidecar, now via the batch-ZF DataCollab CONTROLLER-CLASS-LEVEL sidecar. The class-level confirmation strengthens the pattern by demonstrating that the fail-fast stance is **visible at the controller-architecture-overview tier**, not just the method-tier: a reviewer reading the `DataCollabConfiguration` factory + the `DataCollaborationController` class-level sidecar sees the fail-fast as the canonical opening invariant.

The pattern continues to be supported by:
1. DataCollab Slack OAuth token (`DataCollaborationConfiguration.java:23-25`)
2. Notifications Slack webhook URL (`NotificationConfiguration.java:46-48`)
3. Notifications webhook URL (`NotificationConfiguration.java:75-77`)
4. Email sender / host / protocol (`NotificationConfiguration.java:39-49`)
5. ODD LDAP URL + search-method (`ODDLDAPProperties.java:40-49`)
6. DataCollab retry-count non-negativity (`DataCollabProperties.java:14-20`)

The 6-sidecar consistency makes ADR-018 one of the most well-anchored ADRs in the catalog. The maintainer-stance is fully validated: any future outbound-integration configuration property that gates a feature SHOULD throw at bean-construction / @PostConstruct rather than degrade silently.

---
