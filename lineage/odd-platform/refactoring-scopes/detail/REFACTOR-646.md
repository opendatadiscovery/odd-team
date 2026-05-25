# REFACTOR-646 — Live docs publish `incoming-webhook` as a requested Slack bot scope but the code never uses Slack incoming webhooks (it uses `chat.postMessage` via the bot OAuth token); requested-but-unused scope is a historical leftover

**Severity**: LOW
**Category**: doc-drift (operator-visible Slack scope request) + dead-config
**Pillars affected**: [P-07 Active Platform Features (Discussions), P-06 Configuration & Deployment]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__EventApiController__controller-class__EventApiController.md:docs_link_semantic.doc_drift_findings.[1]` (LOW) — "Live docs mention `incoming-webhook` as a requested bot scope in the Slack app manifest but the code never uses Slack incoming webhooks (the codebase uses chat.postMessage via the bot-user OAuth token in SlackAPIClientImpl). The scope is requested but unused — historical leftover or copy-paste from a Slack example manifest. Not a security-critical issue but a doc-vs-code drift."

**Description**: The live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` (WebFetched 2026-05-25 status 200) publish a Slack app manifest as the canonical configuration template for operators. The manifest requests the following bot scopes:

```yaml
oauth_config:
  scopes:
    bot:
      - channels:history
      - channels:read
      - chat:write
      - users:read
      - incoming-webhook   # ← UNUSED
```

The platform's code path for outbound message delivery (`SlackAPIClientImpl.exchangeForMessage` lines 50-65) calls Slack's `chat.postMessage` API via the bot OAuth token. This API requires `chat:write` only. The `incoming-webhook` scope is for Slack's "Incoming Webhooks" feature, which provides per-app webhook URLs that the platform would POST to (a different integration pattern). The platform does NOT use incoming webhooks.

Operators following the docs request the `incoming-webhook` scope at app installation. The scope is granted; the platform never uses it. The leftover is a historical artifact (either an early development decision later reversed, or a copy-paste from a Slack example manifest).

**Operator-visible failure modes**:

1. **Operator confusion** — an operator-security-reviewer auditing the platform's Slack integration sees an unused scope and asks "why does this need to be granted?". No answer in the docs.
2. **Slack workspace admin pushback** — a workspace admin reviewing the bot's requested scopes might decline `incoming-webhook` (correctly identifying it as unused); declining works fine (platform functions normally), but the docs say to grant it.
3. **Over-permissioning** — security best practice is to grant only the scopes actually used. The unused scope is technically excess privilege; if Slack's incoming-webhook surface had a vulnerability, the platform's bot token would carry the affected scope.

**Primary source citations**:
- `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration` (the docs manifest).
- `<odd-platform-api>/src/main/java/.../SlackAPIClientImpl.java:1-141` (the code that uses chat.postMessage / chat.getPermalink / conversations.list — none of which need incoming-webhook).
- Slack docs at `https://api.slack.com/scopes/incoming-webhook` (the scope's actual purpose — different integration pattern).

**Existing-ADR-or-implied-prescription**: No specific ADR; the pattern of "request only the scopes you use" is OAuth-architecture standard practice.

**Proposed remedy**: Two-part fix:

1. **Remove `incoming-webhook` from the docs manifest** at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#enable-data-collaboration`. The remaining four scopes (`channels:history`, `channels:read`, `chat:write`, `users:read`) cover all platform-used Slack APIs:
   - `channels:history` → not currently used in any verified path; verify whether the platform actually needs it (the bot's event subscription `message.channels` may require it). If not, remove this scope too.
   - `channels:read` → used by `conversations.list` for channel autocomplete (REFACTOR-644).
   - `chat:write` → used by `chat.postMessage` for outbound message delivery.
   - `users:read` → unclear; verify usage. If not used, remove.

2. **Verify scope usage end-to-end** — grep across `<odd-platform>` for each Slack API call; map each call to its required scope; produce an updated minimal-scope manifest.

3. **Add a brief security note to the docs** explaining the principle: "Only request the scopes the platform actually uses. Slack's principle-of-least-privilege guidance: review scopes annually and remove unused ones."

**Severity rationale**: LOW — operator-visible doc-vs-code drift; not security-critical (the unused scope grants no actual capability the platform exercises); easy doc-only fix; pairs with the broader Slack-integration-docs hygiene work.

**Suggested backlog grouping**: `Slack integration docs hygiene sprint` — bundle with REFACTOR-633 docs note (signature secret addition) + REFACTOR-637/638/639 doc updates. The single doc-update PR closes multiple small drift items.

**Coherence check** (LSN-018):
- STRENGTHENS: no direct sibling; aligns with general OAuth-scope-minimization best practice.
- SUPERSEDES: none.
- CONFLICTS: none.

---
