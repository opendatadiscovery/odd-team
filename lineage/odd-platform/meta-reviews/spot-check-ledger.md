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
