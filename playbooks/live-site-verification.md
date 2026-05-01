---
playbook: live-site-verification
status: active
since: 2026-05-01
applies_to: universal
---

# PROTOCOL live-site-verification

Build-time rendering and live-site rendering are not the same system. Only the live site is authoritative for "did the change ship correctly". Implementer cannot self-mark `done`; this protocol runs in `/review` in a session distinct from `/implement`.

## trigger

Review of any item whose target repo publishes to a live site:

- documentation pillar → `https://docs.opendatadiscovery.org`
- (future pillars name their own live site or build artifact)

The trigger fires after the PR has merged to `origin/main` and the publisher (GitBook for documentation; pillar-specific for others) has rebuilt.

## inputs

- list of affected URLs on the live site (per the item's acceptance criteria — implementer surfaces these in the work item)
- expected verbatim phrases / sections / cross-link targets per URL
- the merge commit / PR number for traceability

## procedure

1. **Wait for build/publish.** GitBook commits to `documentation/origin/main` as `[GITBOOK-NN]` or trigger rebuilds on merge; allow the rebuild to complete. If the live site has not updated within ~10 minutes of merge, surface to the user.

2. **WebFetch each affected URL.** One URL at a time so the response body remains in context.

3. **Per URL, verify:**

   - **H1** matches the expected page title.
   - **Target H2 sections** are present.
   - **Expected verbatim phrases** appear in the body (per the item's acceptance criteria — match strings exactly).
   - **In-page TOC entries** match the H2s on the page (Gate 7 cross-check; relevant when the page carries an in-page TOC, e.g., `docs/Features.md`).
   - **Cross-links resolve.** Click-through targets render the intended page. The body must not contain any `github.com/.../blob/main/...` substring — that signals a fallback-cache event (`retrospectives/LSN-004-s2s-fallback-cache.md`).
   - **In-bound links from other pages** resolve to the new page (for new pages: WebFetch the SUMMARY-parent page; verify the link is not still pointing at a stale GitHub URL).

4. **Record verdicts per URL** in the item's Review block. Format: `URL — VERIFIED via WebFetch | what was checked | match status`.

5. **Flag any GitHub-fallback substring** as a fallback-cache event. This is a Gate 8 fail — flip the item to `blocked` with the fetched body excerpt as evidence.

## exit

- Every affected URL passes every criterion in step 3.
- The item's Review block records the verdict per URL.
- No banned phrases (per `playbooks/claim-inventory.md` step 5) appear in the verdict.

## on-fail

- Flip the item to `blocked` with:
  - the specific failing URL
  - the missing content / present GitHub-fallback / wrong-target link
  - the fetched body excerpt (so the implementer doesn't need to re-fetch to diagnose)
- Surface to the user. Live-site failures are a publishing-bar regression, not a small fix.

## case-law

- `retrospectives/LSN-004-s2s-fallback-cache.md` — separate-PR ship of page vs SUMMARY caused GitBook to cache a `github.com/.../blob/main/...` fallback for the index link; live-site fetch was the only thing that would have caught it (build-time rendering passed).
