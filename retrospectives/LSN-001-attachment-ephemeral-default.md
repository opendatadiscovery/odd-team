---
id: LSN-001
title: Attachment storage default silently wiped production data on container restart
date: 2026-04-21
domain: documentation
severity: critical
gates_informed:
  - gate-3-caveats-captured
  - gate-4-consumer-read
status: closed
---

# LSN-001: Attachment storage default silently wiped production data on container restart

## What happened

On 2026-04-21 a scan of `application.yml` documented `attachment.storage: LOCAL` (the default) without reading the consumer code that resolved the path. The actual consumer wrote files to `/tmp/odd/attachments`, which Kubernetes wipes on every container restart. A user running ODD on Kubernetes lost production attachments before reporting the trap. The code had shipped; the docs never mentioned the ephemerality. Under the pre-existing bar this was filed as "undocumented feature" — medium severity. The actual operator impact was silent data loss in the hands of anyone who read our getting-started page and trusted the defaults.

## Why it slipped

The scanning protocol at the time read `application.yml` declarations and described the keys, treating the YAML as the source of truth for behavior. Consumer code (the `@Value`-annotated services that resolved the storage path, the bean factory that constructed the writer) was not in the required-read set. The file said `LOCAL` was the default and that was authored verbatim into the doc; the operator-facing consequence ("LOCAL writes to a path Kubernetes does not persist") was invisible at the YAML level.

## Rule that emerged

**Gate 4 — Consumer-read before authoring.** Every claim a doc makes about runtime behavior must be traced to the code that enforces it. For config keys, the required reads are the `application.yml` declaration **plus** every `@Value` / `@ConfigurationProperties` consumer **plus** the bean factory or service that wires them. **Gate 3 — Caveats captured.** Defaults that are unsafe in any common deployment context (Kubernetes, Docker, multi-replica) ship as a dedicated admonition block, not buried in prose. Both gates currently live in `CLAUDE.md` "Implementation Quality Bar"; Phase 4 of the architecture refactor (`adrs/drafts/refactor-to-pillar-architecture.md`) distills the consumer-read procedure into `playbooks/consumer-read.md`.

## Forcing question

Before I write a default value into the doc, have I read the consumer that resolves what the default *means* in the deployment context an operator will actually run?

## References

- `odd-platform-api/src/main/resources/application.yml` (`attachment.storage` declaration)
- Consumer files involved in the ephemeral-write path (named in DOC-008 commit)
- Backlog item: `backlog/docs/DOC-008.md`
- Originating finding: `findings/docs-accuracy-config-options/2026-04-21-platform.md`
- Related: LSN-002 (the second consumer-code audit on 2026-04-23 caught a sibling silent failure on the same feature)