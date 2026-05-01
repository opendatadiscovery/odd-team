---
id: LSN-010
title: Azure admin-groups doc claimed default key was groups; the consumer actually read roles
date: 2026-04-21
domain: documentation
severity: high
gates_informed:
  - gate-4-consumer-read
  - gate-9-factual-provenance-config-consumer-line
status: closed
---

# LSN-010: Azure admin-groups doc claimed default key was groups; the consumer actually read roles

## What happened

On 2026-04-21, a config-options scan documented the Azure AD admin-groups configuration as reading from a JWT claim named `groups`. The actual `@Value` consumer read from a claim named `roles`. An operator who configured Azure AD using the doc's instructions would have produced no admin assignments — the JWT contains the configured groups but the consumer never inspects that claim. The gap surfaced on the same scan that produced LSN-001 (attachment ephemeral default) and contributed to the formalization of Gate 9 in the 2026-04-23 pipeline-hardening pass.

## Why it slipped

The scan author read `application.yml` and the inline comment, both of which mentioned `groups` as the canonical claim name. The default value lives in the `@Value` annotation on the consumer side — `@Value("${odd.security.admin-groups-claim:roles}")` — and that file was not in the required-read set. Default values that live in `@Value` annotations are invisible from the YAML perspective: the YAML may name a key without setting a default, and the consumer's annotation supplies the default the runtime actually uses. No protocol forced reading every consumer of every key under audit.

## Rule that emerged

**Gate 4 — Consumer-read before authoring**, with the explicit rule that for config-key claims the required reads are the `application.yml` declaration **plus every** `@Value` / `@ConfigurationProperties` consumer **plus** the bean factory or service that wires them. **Gate 9 — Factual claim provenance**, `Config-consumer:` line in the `Sources:` footer with one bullet per consumer file. The rule lives in `CLAUDE.md` "Implementation Quality Bar" Gate 4 + Gate 9 SoT table; Phase 4 of the architecture refactor distills the config-claim procedure into `playbooks/consumer-read.md` and `playbooks/claim-inventory.md`.

## Forcing question

For every consumer of this config key — not just the YAML declaration — what default does the `@Value` annotation supply, and does the doc claim match every consumer's default?

## References

- `odd-platform-api/src/main/resources/application.yml` (Azure AD section)
- The `@Value("${odd.security.admin-groups-claim:roles}")` consumer (named in DOC-001)
- Backlog item: `backlog/docs/DOC-001.md`
- Originating finding: `findings/docs-accuracy-config-options/2026-04-21-platform.md`
- Related: LSN-001 (sibling consumer-read failure on the same scan), LSN-002 (downstream consumer-read failure that extended Gate 4 to SDK builders)