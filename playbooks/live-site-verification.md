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
   - **Cross-links resolve.** Click-through targets render the intended page. The **rendered article body** must not contain any `github.com/.../blob/main/...` substring — that signals a fallback-cache event (`retrospectives/LSN-004-s2s-fallback-cache.md`). **Scope this check to the body, not the whole raw-HTML document:** GitBook's "Edit on GitHub" button and the Next.js `editOnGit` payload legitimately carry `.../blob/...` URLs in the page *chrome* on every page, so a raw `curl | grep blob` false-positives. Match against the WebFetch body extraction (clean on a healthy page), or scope the grep to the `<main>`/`<article>` region. (Confirmed across the 2026-05-31 ADR `/review`: 2 benign `.../blob/` chrome hits per page, 0 in body — four reviewers independently had to re-litigate the same false positive.)
   - **In-bound links from other pages** resolve to the new page (for new pages: WebFetch the SUMMARY-parent page; verify the link is not still pointing at a stale GitHub URL).
   - **YAML frontmatter parses cleanly** *(2026-05-28; LSN-028; mandatory whenever the change touches frontmatter).* Run PyYAML's `safe_load` on every affected page's frontmatter. FAIL if any file's frontmatter does not parse. The most common hazard is `: ` (colon-space) inside an unquoted `description:` value — reads as a nested mapping separator and stalls GitBook sync entirely until hotfixed. Full hazard catalogue: `memory/reference_yaml_frontmatter_hazards_in_description.md`.
     ```bash
     for f in {affected-pages}; do
       python3 - "$f" <<'PY'
     import yaml, sys
     path = sys.argv[1]
     txt = open(path).read()
     if txt.startswith('---'):
         end = txt.find('---', 3)
         if end != -1:
             try:
                 yaml.safe_load(txt[3:end])
             except yaml.YAMLError as e:
                 print(f'YAML PARSE FAIL: {path}: ' + str(e).split(chr(10))[0])
                 sys.exit(1)
     PY
     done
     ```
   - **Head-rendered metadata + visible page subtitle** *(2026-05-28; LSN-027; mandatory whenever the change touches `description:` frontmatter or any other head-rendered element — title, og tags, canonical URL).* WebFetch's markdown extraction strips `<head>` and does not surface the visible page subtitle reliably. Use `curl -sL` for raw HTML and verify each affected element:
     - `<meta name="description" content="..."/>` — content length + text must match source frontmatter.
     - `<meta property="og:description" content="..."/>` — same.
     - `<meta name="twitter:description" content="..."/>` — same.
     - **`<p>...</p></header>` page-subtitle** (the visible element GitBook renders directly under the H1 from the `description:` frontmatter) — text must match source; FAIL if truncated mid-word.
     - **For other head-rendered elements** (title, canonical, og:image, og:title, structured data) — same fetch + compare.
     - **Truncation rule** (per `memory/reference_gitbook_meta_description_200_char_limit.md`): GitBook truncates `description:` at exactly 200 chars in all four surfaces above. Source frontmatter >200 chars = automatic FAIL. Log as backlog item; do NOT mark "acceptable as {anything}-driven" without `VERIFIED via curl -sL of {url}` citation.

   **Mechanical command** (raw-HTML head + subtitle inspection for one URL):
   ```bash
   url="https://docs.opendatadiscovery.org/{slug}"
   echo "=== meta description ===" && curl -sL "$url" | grep -oE '<meta [^>]*name="description"[^>]*>'
   echo "=== og:description ===" && curl -sL "$url" | grep -oE '<meta [^>]*property="og:description"[^>]*>'
   echo "=== twitter:description ===" && curl -sL "$url" | grep -oE '<meta [^>]*name="twitter:description"[^>]*>'
   echo "=== body subtitle ===" && curl -sL "$url" | grep -oE '<p[^>]*>[^<]+</p></header>' | head -1
   ```

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
- `retrospectives/LSN-027-meta-description-truncation-not-caught-by-webfetch.md` — WebFetch markdown extraction missed `<meta>` truncation in `<head>` AND the visible `<p>` page-subtitle directly under H1; 25 docs pages shipped truncated descriptions across multiple batches because Gate 8 had no raw-HTML inspection step. Added the step above.
- `retrospectives/LSN-028-yaml-frontmatter-parse-error-stalled-gitbook-sync.md` — `: ` (colon-space) inside an unquoted description: frontmatter value parses as a YAML mapping separator and stalls GitBook sync entirely (worse than truncation — the publisher couldn't import the merged commit at all). Pre-commit + Gate 8 now run a PyYAML parse check.
