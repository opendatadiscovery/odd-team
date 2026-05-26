# REFACTOR-647 — Slack channel-list Caffeine cache has 1-minute TTL with no event-driven invalidation; freshly-invited bot is invisible to autocomplete for up to 60 seconds; freshly-removed bot still appears

**Severity**: LOW
**Category**: stale-cache + missing-event-driven-invalidation
**Pillars affected**: [P-07 Active Platform Features (Discussions)]
**Batch**: ZF (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:bugs_limitations_corner_cases.[5]` (LOW) — "Caffeine cache staleness window of up to 60 seconds: `SlackMessageProviderClient.java:36-44` sets `expireAfterWrite(1, MINUTES)`. A freshly-invited bot is invisible to the autocomplete for up to 60 seconds; a freshly-removed bot is still visible for up to 60 seconds. No cache-invalidation hook exists for `member_joined_channel` / `member_left_channel` Slack events (which `EventApiController` does process — but the cache lives in `SlackMessageProviderClient`, not the event processor)."
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:concepts.invariants.[1-minute-Caffeine-cache-fronts-the-Slack-channel-listing]`
- `odd-platform__java__DataCollaborationController__controller-class__DataCollaborationController.md:stress_findings.resource_boundaries.[0]` — staleness window detailed analysis.

**Description**: `SlackMessageProviderClient.java:36-44` constructs an `AsyncLoadingCache` with:
- `expireAfterWrite(1, MINUTES)` — single-entry TTL of 60 seconds.
- `maximumSize(1)` — one entry total (keyed on a fixed sentinel `CACHE_FIXED_KEY`).
- Load function: `slackAPIClient.getSlackChannels()` — the full paginated `conversations.list` walk.

The cache reduces Slack API call volume for the channel-autocomplete: a workspace with 1000 channels needs 5 `conversations.list` round-trips per cache miss; the cache makes one miss serve all callers within the 60-second window.

The trade is:
- (+) Reduces Slack API load by a factor of (callers × keystrokes) per 60-second window.
- (+) Reduces autocomplete latency from ~hundreds-of-ms (Slack API) to ~ms (cache hit).
- (-) Stale view: invite the bot to a new channel → channel invisible for up to 60s; remove the bot → channel still appears for up to 60s.

The platform DOES process Slack member-joined / member-left events at `EventApiController` (`/api/slack/events`), but the event-processor chain (`SlackEventParser → DataCollaborationMessageEventProcessor`) only handles `message` events with `thread_ts` set (per the EventApiController sidecar's `implicit_adrs.[2]`). The `member_joined_channel` / `member_left_channel` events are FILTERED at parse-time (FILTER branch → ack 200 → discarded); the Caffeine cache is NOT invalidated.

**Operator-visible failure modes**:

1. **Inviting the bot to a new channel** — operator adds `@odd-bot` to `#new-channel` via Slack UI; opens ODD Platform's Discussions tab; types the channel name → empty dropdown. After ~60s the channel appears.
2. **Removing the bot from a channel** — operator removes the bot from a channel; the autocomplete still suggests the channel for up to 60s; if the user picks it and submits a message, the actual `chat.postMessage` call will fail with `not_in_channel`.
3. **Multi-instance cluster staleness** — each platform instance has its own Caffeine cache; if Instance A is hit at T+0 (loads fresh data) and Instance B at T+30 (loads then-fresh data), the two instances may have different channel sets for up to 60 seconds.

**Primary source citations**:
- `<odd-platform-api>/src/main/java/.../SlackMessageProviderClient.java:36-44` (the cache definition).
- `<odd-platform-api>/src/main/java/.../SlackEventParser.java:38-43` (FILTER branch for unknown event types — includes member_joined_channel).
- `<odd-platform-api>/src/main/java/.../EventApiController.java:30-37` (the FILTER branch ack-200s without invalidating any cache).

**Existing-ADR-or-implied-prescription**: No specific ADR; the cache TTL is a maintainer choice (60s is a reasonable default for a non-event-driven cache). Sibling: REFACTOR-297 (no client-side cache-control on home-page lists — different cache layer; same UX-staleness pattern).

**Proposed remedy**: Three options (pick based on operator demand):

**Option A (extend the event-handler to invalidate the cache on member events)** — preferred, structural:

1. Extend `SlackEventParser` to recognise `member_joined_channel` and `member_left_channel` events: pass them through as a separate ParseResultType (e.g. `CHANNEL_MEMBERSHIP_CHANGE`).
2. Extend `EventApiController` to call a NEW method `slackMessageProviderClient.invalidateChannelCache()` on the CHANNEL_MEMBERSHIP_CHANGE path.
3. Cache becomes event-driven; the 60-second window collapses to ~event-delivery-latency (typically <1s).

**Option B (shorten the TTL)** — minor:
- Reduce TTL to 5-10 seconds. Increases Slack API call volume linearly; for a workspace with 1000 channels, 1000/page = 5 round-trips per cache miss × 60s/5s = 60 round-trips per minute vs 1 round-trip per minute under current TTL. Likely tolerable; tune via property.

**Option C (no cache; per-call Slack API)** — only acceptable for very small workspaces (<200 channels = single round-trip).

**Option D (cache + UI staleness disclosure)** — minimal:
- Add tooltip / placeholder "Newly-invited bot may take ~60s to appear" on the autocomplete; operator-onboarding-friendly.

Maintainer-recommended: **Option A** — event-driven cache invalidation is the proper architectural fix; aligns with the existing event-processing pipeline; small implementation cost.

**Add integration tests**:
- Invite bot to channel → simulate the membership event → assert cache invalidated → assert autocomplete returns the channel.
- Remove bot from channel → simulate the membership event → assert cache invalidated → assert autocomplete does NOT return the channel.

**Severity rationale**: LOW — UX staleness; bounded to 60 seconds; operator-visible but routine. Pairs with REFACTOR-644 (startsWith filter — same UX-trap class) — bundle into one Discussions UX sprint.

**Suggested backlog grouping**: `Discussions UX sprint` — pair with REFACTOR-644 + REFACTOR-639 + REFACTOR-645. The four together close the user-visible Discussions issues.

**Coherence check** (LSN-018):
- STRENGTHENS: no direct sibling; aligns with general event-driven-cache-invalidation best practice.
- SUPERSEDES: none.
- CONFLICTS: none.

---
