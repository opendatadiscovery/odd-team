## REFACTOR-277 — `handleResponseAsyncThunk` wrapper does NOT propagate Redux Toolkit's built-in `requestId` for stale-response protection; rapid entity-id switching produces last-arriving-wins overwrites in `state.dataentities.byId`

**Severity**: MEDIUM
**Category**: race-condition
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07, P-08, P-09] — every async fetch in the SPA inherits the gap (the wrapper is codebase-wide)
**Surfaced by**:
- `fetchDataEntityDetails.md:bugs_limitations_corner_cases[1]` (|-
    "**No `requestId`-based stale-response protection.** Redux Toolkit's `createAsyncThunk` ships with built-in `requestId` tracking that lets reducers reject stale fulfilled actions, but `handleResponseAsyncThunk` does not propagate or check this. A user clicking through entities A → B → C rapidly can land in a state where A's late-arriving response overwrites C's fresh data in `state.dataentities.byId`. No comment or test guards against this; the splice-into-byId reducer at `dataentities.slice.ts:49-66` writes payload.id unconditionally.")

**Description**: Redux Toolkit's `createAsyncThunk` natively supports `requestId` — a unique id generated per dispatch that is forwarded to the inner thunk via `thunkAPI.requestId` and surfaced on every lifecycle action's `meta.requestId`. The standard pattern is for the reducer to track the "current request" in slice state and ignore fulfilled actions whose `requestId` does not match the latest dispatch — protecting against last-arriving-wins overwrites in rapid-navigation scenarios.

The project's `handleResponseAsyncThunk` wrapper (`redux/lib/handleResponseThunk.ts:19-43`) does NOT propagate or check `requestId`. The wrapper signature accepts only `(arg, { rejectWithValue })` — `requestId` is not destructured. The slice reducers (`dataentities.slice.ts:49-66`) write `[payload.id]: { ...payload }` unconditionally; there is no current-request tracking, no requestId compare, no last-write-wins guard.

The observable consequence: a user clicking through entities A → B → C rapidly fires three `fetchDataEntityDetails` dispatches. If A's response arrives AFTER C's response, A overwrites C in `state.dataentities.byId[A]` (correct — A's keyed entry). But if the user is viewing C's page (`details.id === C`), and the slice writes `byId[A].sourceList` while the selectors read `byId[C].sourceList`, the harm is contained.

HOWEVER, fields that are shared across the response (e.g. ownership in `owners.slice`, metadata in `metadata.slice` — see ADR-CANDIDATE-085 fan-out) are keyed by `payload.id` too, so the fan-out preserves the keying. The narrow risk is: a future field that is NOT keyed by id (e.g. a top-level "global" field added by mistake) would silently get clobbered.

A broader risk: the LSN-017 self-feeding loop on the SAME entity id produces back-to-back identical dispatches. If a future code change introduces server-side latency variance that returns the SECOND dispatch first, the first dispatch's later arrival overwrites — no problem in the current shape because the responses are identical, but a hypothetical "view_count value at fetch time" projection inside the response would surface the issue.

**Primary source citations**:
- `redux/lib/handleResponseThunk.ts:24-43` — the wrapper does NOT destructure `requestId` from the inner thunk's `thunkAPI`
- `redux/slices/dataentities.slice.ts:49-66` — `byId` reducer writes unconditionally
- `fetchDataEntityDetails.md` documents the gap explicitly

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-084 codifies the wrapper as the project's standard. The requestId-protection capability is built INTO Redux Toolkit and is conventionally adopted — the absence is a wrapper-design oversight rather than an architectural choice. No ADR prescribes the absence.

**Proposed remedy**: Update `handleResponseAsyncThunk` to destructure `requestId` and pass it through to a new `meta.requestId` field on the fulfilled/rejected actions. Update the slice reducers that need it to track `currentRequestId` and ignore stale fulfilled actions. The change is non-invasive (additive metadata) and unlocks the protection per-slice.

Alternative: adopt RTK Query (`@reduxjs/toolkit/query`) for new thunks — it handles requestId, deduplication, polling, caching natively. The migration path requires a separate ADR (RTKQ-vs-manual-thunks) but is the long-term answer.

**Severity rationale**: MEDIUM — the harm is narrow today (response keying by id contains most cases) but the gap is silent and grows with any future field that breaks the keying invariant. Fix is straightforward.

**Suggested backlog grouping**: `UI architecture hardening` (with REFACTOR-289 zero-test-coverage and the ADR-CANDIDATE-084 codification).

---
