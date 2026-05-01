---
playbook: consumer-read
status: active
since: 2026-05-01
applies_to: universal
---

# PROTOCOL consumer-read

Every factual claim about runtime behavior must be traced to the code that enforces it. The YAML, the PR description, and prior memory are not sources of truth.

## trigger

Any factual claim about runtime behavior the change is about to author or review:

- a config-key claim (key name, default value, behavior, acceptable values)
- an SDK-backed feature claim (S3/MinIO, SMTP, OAuth2/OIDC, Slack, LDAP, Redis, OTLP, JDBC/R2DBC, AWS SSM, etc.)
- a feature claim (what the platform does end-to-end)
- an error / retry / timeout claim
- a spec claim (HTTP path, verb, request/response schema)
- a lifecycle claim (GA / Beta / Experimental / Deprecated)
- a dependency / version claim

## inputs

- claim text — the sentence the change will assert
- claim class — one of: `config | SDK | feature | error | spec | lifecycle | dep`
- target repo — the repo the SoT lives in
- pointer file — `navigation/domains/{relevant}.md` if it lists the entry points

## procedure

1. **Identify the SoT files for this claim class.**

   | Claim class | Required reads |
   |---|---|
   | `config` | `application.yml` declaration + **every** `@Value` / `@ConfigurationProperties` consumer + the bean factory or service that wires them |
   | `SDK` | bean factory file that constructs the client → run `playbooks/unset-parameter-audit.md` for builder parameters |
   | `feature` | controller → service → repository trace + any scheduled / event-driven side effects |
   | `error` | the explicit handler file (never "the SDK probably retries") |
   | `spec` | OpenAPI YAML at the cited line range |
   | `lifecycle` | ADR (if any) + target repo `README.md` / `CHANGELOG.md` / release tag + grep current `main` for the symbol |
   | `dep` | `pyproject.toml` / `build.gradle` / `package.json` on current `main` |

2. **Read each SoT file** end-to-end on the relevant range. For `config` keys with multiple consumers, read every consumer (e.g., `odd.platform-base-url` feeds Slack and email — read both).

3. **Reconcile the claim with what the code actually does.** If the code says X and the claim says Y, the claim is wrong — update the claim or drop it.

4. **Compose a `Sources:` line per claim class** (run `playbooks/claim-inventory.md` for the footer format).

5. **If the SoT cannot be cited in under 60 seconds of verification**, mark the item `blocked` pending SoT — do not paraphrase from memory.

## exit

- Every claim in the change has a `Sources:` footer line citing a verifiable SoT (`file:line` or URL).
- For `config` claims, every consumer is listed.
- For `SDK` claims, `playbooks/unset-parameter-audit.md` has run and produced a `Builder:` line.

## on-fail

- Drop the claim from the change, **or**
- Mark the item `blocked` with a note naming the missing SoT, **and**
- If the missing SoT is a navigation gap (no domain pointer led you to the file), log a navigation backlog item.

## case-law

- `retrospectives/LSN-001-attachment-ephemeral-default.md` — config-key claim that needed every consumer; YAML alone was insufficient.
- `retrospectives/LSN-002-minio-region-unset.md` — SDK claim that extended the rule to builder parameters; introduced `playbooks/unset-parameter-audit.md` as a sub-protocol.
- `retrospectives/LSN-010-azure-admin-groups-wrong-default.md` — config-key default lived in `@Value` annotation, not YAML; required reading the consumer to see it.
