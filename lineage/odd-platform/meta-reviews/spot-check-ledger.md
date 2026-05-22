# Spot-check ledger — the Adversary's tested targets

Every target the `panel-adversary` expert has spot-checked, across all runs. The chair appends to it after each run.

**This file is TARGETS ONLY — it carries no verdicts and no findings.** That is deliberate and load-bearing: the Adversary is *blind to what the methodology already found* (it generates fresh checks against primary sources), but it MAY read this ledger to avoid re-testing a target it has already covered. A targets-only ledger lets it stay fresh without leaking the answer key. **Do not add verdict, severity, or finding columns to this file** — doing so would contaminate the next run's Adversary.

| Date | Target (file:symbol or capability) | Sampling strategy |
|---|---|---|
<!-- chair appends one row per Adversary spot-check below this line -->
| 2026-05-21 | JooqFTSHelper.tsQuery / ftsCondition — multi-word search semantics | random-walk |
| 2026-05-21 | HousekeepingJobManager — @Scheduled cadence + ConditionalOnProperty default | boundary |
| 2026-05-21 | DataEntityController#getPopular — ranking signal | capability |
| 2026-05-21 | cteDataEntitySelect — EXCLUDE_FROM_SEARCH filter on list-shape reads | negative-space |
| 2026-05-21 | ReactiveDataEntityRepositoryImpl#getQuerySuggestions — result cap | boundary |
| 2026-05-21 | tsquery-operator-injection invariant — ftsCondition facet call-site enumeration | negative-space |
| 2026-05-21 | PostgreSQLLeaderElectionManagerImpl#acquire — advisory-lock leader election | random-walk |
| 2026-05-21 | spring.session.timeout = -1 + session.provider IN_MEMORY (application.yml) | negative-space |
| 2026-05-21 | V0_0_85 — internal_description varchar(255)→unbounded column-width migration | negative-space |
| 2026-05-21 | ReactiveLineageRepositoryImpl.lineageCte — recursive-CTE depth/cycle bound | boundary |
| 2026-05-21 | FileServiceImpl.uploadFileChunk — chunk-index handling + non-FilePart rejection | capability |
| 2026-05-21 | WebhookNotificationSender.send — outbound webhook request shape (headers/signing/status) | random-walk |
| 2026-05-21 | TokenGeneratorImpl.generate/regenerate — collector ingestion-token RNG source | negative-space |
| 2026-05-21 | SearchServiceImpl.getFacets/getFilterOptions — faceted-search filter enumeration | capability |
| 2026-05-21 | helpers.ts bytesToKb/bytesToMb — file-size unit conversion (SI vs binary) | random-walk |
| 2026-05-21 | TokenGeneratorImpl.regenerateToken — token rotation in-place row mutation / no audit | boundary |
| 2026-05-22 | AttachmentServiceImpl.getUploadOptions/uploadFileChunk — attachment.max-file-size enforcement | negative-space |
| 2026-05-22 | ActivityController.getActivity — `size` parameter boundary on the activity feed | boundary |
| 2026-05-22 | GenAIController.genAiQuestion — RBAC gate on POST /api/genai/ask | capability |
| 2026-05-22 | NamespaceServiceImpl.delete — delete of a namespace with attached resources | random-walk |
| 2026-05-22 | DataEntityRunController.getRuns — per-entity test/job runs list | capability |
| 2026-05-22 | V0_0_79__data_deprecation.sql — data-entity status migration / activity-row purge | negative-space |
| 2026-05-22 | AlertActionResolverImpl.toHalt — per-entity alert-halting suppression semantics | boundary |
