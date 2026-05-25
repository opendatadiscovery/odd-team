# REFACTOR-644 — `getSlackChannels` filters by `startsWith(channelName)` not `contains(channelName)`; a user typing the middle of a channel name returns an empty dropdown despite the channel existing

**Severity**: MEDIUM
**Category**: input-name-vs-implementation-drift + UX-trap
**Pillars affected**: [P-07 Active Platform Features (Discussions)]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "Channel filter is `startsWith`, not `contains`: `SlackMessageProviderClient.getChannels` (`:52`) is `slackChannel.name().startsWith(nameLike)`. A user typing `platform` to find `#odd-platform-alerts` gets zero results. The UI's debounced 500ms autocomplete (`SlackChannelsAutocomplete.tsx:43-54`) drives this on every keystroke; the only feedback the user gets is an empty dropdown. Severity is MEDIUM because the UI does not surface 'this is a prefix match' anywhere."

**Description**: The Slack channel autocomplete filter at `SlackMessageProviderClient.java:50-55` applies:

```java
.filter(slackChannel -> nameLike == null || slackChannel.name().startsWith(nameLike))
```

— `String.startsWith(prefix)`, not `String.contains(substring)`.

The operator-facing parameter name is `channelName` (per the OpenAPI spec). A user typing into the autocomplete reasonably expects:
- Typing `platform` → matches `#odd-platform-alerts` (substring match).
- Typing `odd` → matches `#odd-platform-alerts` (prefix match).

The implementation supports the second case ONLY. A user looking for `#odd-platform-alerts` by typing `platform` gets an EMPTY dropdown — the same UI feedback as "no channels exist matching this name".

The drift is Category F (input-name-vs-implementation-drift) per the broader LSN-020 framework — the parameter NAME promises a filter; the implementation provides a NARROW form of that filter; the user cannot distinguish from the UI alone.

**Operator-visible failure modes**:

1. **Lost discovery** — users who know a channel exists but don't remember the prefix cannot find it via the autocomplete.
2. **Slack workspaces with naming conventions like `team-<topic>-<purpose>`** — every channel starts with `team-`; typing the topic (`platform`, `discovery`, `alerting`) returns empty; users must type `team-` first.
3. **Multi-prefix workspaces** (e.g. `#engineering-foo`, `#design-foo`, `#product-foo`) — typing `foo` returns nothing; the user has to know one of the prefixes to find any of the "foo" channels.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../SlackMessageProviderClient.java:50-55` (the prefix filter).
- `<odd-platform-ui>/.../SlackChannelsAutocomplete.tsx:43-54` (the debounced UI dispatch; no client-side compensation).
- `<odd-platform-specification>/openapi.yaml:3710-3713` (the `channelName` parameter; no description).
- `https://docs.opendatadiscovery.org/developer-guides/api-reference/data-collaboration` (live doc says "optionally filtered by `channel_name`" — does not state the prefix-vs-substring semantics).

**Existing-ADR-or-implied-prescription**: No specific ADR; sibling pattern is REFACTOR-624 (Title.name no normalization — same shape on a different filter) + REFACTOR-447 cluster (search filter semantic ambiguity).

**Proposed remedy**: Two options, depending on the maintainer-stance:

**Option A (substring match — matches user expectation)**: change to `slackChannel.name().contains(nameLike)`. Drop-in fix. Risk: if a workspace has a large channel count, substring matching is more expensive in the JVM (full scan vs prefix-tree); however, the channel list is already in memory (the Caffeine cache), so the cost is bounded.

**Option B (prefix-with-UI-feedback)** — keep prefix semantics but make them visible: change the UI's autocomplete placeholder to "Start typing a channel prefix..." (so the user knows it's prefix-only); add an empty-state explanatory message "No channels start with '<typed>'. Try typing the channel's prefix.". Drop-in fix on the UI; minimal backend change.

**Option C (substring at the SDK level)** — keep the platform-side filter but call Slack's `conversations.list` with a `query` parameter (Slack's API supports a prefix query natively; substring matching requires platform-side post-filter). Adds Slack API integration; preserves prefix semantics at the SDK layer.

The maintainer-recommended option (per Velocity bias + matches user expectation) is **Option A** — substring match is the standard autocomplete semantic; the UI feedback issue Option B partially-addresses is downstream of the same gap.

**Add integration test** (regardless of option):
- Type a middle-substring → returns matching channels (Option A) OR explicit empty-state message (Option B).
- Type a prefix → returns matching channels.

**Severity rationale**: MEDIUM — UX trap; user-visible but bounded; low operator-priority. Pairs with REFACTOR-647 (Caffeine cache 60s staleness — same UX class) — bundle as one Discussions UX-sprint.

**Suggested backlog grouping**: `Discussions UX sprint` — pair with REFACTOR-647 (cache staleness) + REFACTOR-639 (status-code drift, third-party-client concern) + REFACTOR-645 (audit-log gap). The four together close the operator-visible Discussions issues outside the security cluster.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-624 (Title.name normalization — same shape on different filter); REFACTOR-447 (search semantic ambiguity cluster).
- SUPERSEDES: none.
- CONFLICTS: none.

---
