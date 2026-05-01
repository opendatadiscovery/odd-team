---
id: LSN-002
title: REMOTE S3 attachment storage silently restricted to us-east-1 because MinioConfig never called .region(...)
date: 2026-04-23
domain: documentation
severity: critical
gates_informed:
  - gate-5-unset-parameter-audit
  - gate-4-consumer-read
  - implementer-cannot-self-mark-done
status: closed
---

# LSN-002: REMOTE S3 attachment storage silently restricted to us-east-1 because MinioConfig never called .region(...)

## What happened

On 2026-04-23, a second consumer-code audit of the attachment-storage feature — independent of the LSN-001 audit that had just shipped — revealed that the REMOTE S3 integration only worked against `us-east-1` buckets. The cause: `MinioConfig.java` constructed `MinioAsyncClient.builder()` without calling `.region(...)`. The MinIO SDK's documented behaviour is that an unset region defaults to `us-east-1`. The doc didn't mention the constraint; the YAML didn't expose it; the operator who pointed REMOTE at a bucket in any other region got silent failures. The gap was caught by a user spot-check against the original audit, not by the pipeline that had just signed off LSN-001 as `done`. The work item that shipped LSN-001 had been **self-closed by the implementer** in a single session — `/review` had not yet run as a separate session, and the silent caveat travelled through the gate.

## Why it slipped

LSN-001 added Gate 4 (consumer-read) but stopped at the `@Value` consumer level. SDK builders sit one hop further: the consumer reads the config key and passes it into a builder, but the builder has its **own** parameters that the consumer leaves at SDK defaults. Those SDK defaults can be operator-unsafe in ODD's deployment context (us-east-1 is the AWS SDK default, but ODD is not an AWS-only product). No protocol enumerated builder parameters. The reviewer's same-session sign-off compounded the gap: a separate-session reviewer would have re-derived the question "what does this builder do for parameters the consumer leaves unset?" and found the empty `.region(...)` call.

## Rule that emerged

**Gate 5 — Unset-parameter audit for SDK integrations.** For every SDK / client builder in the code path behind a change, enumerate builder parameters and mark each with explicit status: `configured from {config.key}` / `safely defaulted — {rationale}` / `caveat-defaulted — {limitation}`. Caveat-defaulted parameters ship as a dedicated admonition block. **Implementer cannot self-mark `done`.** Phase 2 of `/implement` ends at `status: review-ready`; a separate-session `/review` handles the final transition. Both rules live in `CLAUDE.md` ("Implementation Quality Bar" and "Workflow Phases" respectively); Phase 4 of the architecture refactor distills Gate 5 into `playbooks/unset-parameter-audit.md`.

## Forcing question

For every SDK builder in this code path, what does each parameter *not* explicitly set do — and is that default safe in the deployment context the operator will actually run?

## References

- `odd-platform-api/.../config/MinioConfig.java` (`MinioAsyncClient.builder()` — no `.region(...)` call)
- MinIO SDK README — confirms unset region defaults to `us-east-1`
- Backlog item: `backlog/docs/DOC-008.md` (re-shipped with the regional caveat)
- Originating finding: `findings/docs-accuracy-integration-caveats/2026-04-23-reaudit-critical-odd-platform-config.md`
- Related: LSN-001 (the prior consumer-read audit that did not extend to the SDK builder layer)