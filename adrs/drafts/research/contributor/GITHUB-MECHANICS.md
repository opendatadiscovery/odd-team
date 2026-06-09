# GitHub Mechanics for the Contributor Agent

Research artifact for the contributor-pillar ADR.
Decision context: the agent posts issue comments and opens draft PRs directly; humans approve merges only.

Sources fetched: GitHub Docs (REST API, branch protection, rulesets, fine-grained PATs, GitHub Apps auth),
GitHub Blog, bmterra.eu/articles/010625-using-github-apps/, DEV Community (agent identity).

---

## 1. Identity: GitHub App vs fine-grained PAT vs classic PAT

**Recommendation: GitHub App (owner-account-scoped, single installation).**

| Dimension | Classic PAT | Fine-grained PAT | GitHub App |
|---|---|---|---|
| Identity attribution | Commits + API calls appear as the human account owner | Commits + API calls appear as the human account owner | Commits appear as `odd-contributor[bot]` — distinct bot user, not the maintainer |
| Token lifetime | Long-lived; manual rotation | Configurable (1–366 days or none); org can enforce max TTL | Installation access token: 1 hour; auto-refreshed from private key |
| Scope granularity | Coarse pre-defined scopes | 50+ fine-grained permissions, read/write per category | Same fine-grained model; PLUS can further narrow per-token at issue time |
| Per-repo scoping | No — inherits all repos the user can see | Yes — restricted to named repos at creation | Yes — installed per-repo; installation token can be further narrowed to a repo subset |
| Rate limit | 5,000 req/hr (shared with human) | 5,000 req/hr (shared with human) | 15,000 req/hr per installation |
| Revocation | Delete the token on GitHub settings | Delete the token on GitHub settings | Uninstall the app (removes all tokens instantly); or rotate private key |
| Audit | Activity shows as the maintainer's own account | Activity shows as the maintainer's own account | Activity shows as `odd-contributor[bot]`; filterable via `actor_is_bot` in org audit log |
| CODEOWNERS bypass risk | App appears as a named user; harder to exclude from ownership rules | App appears as a named user; harder to exclude from ownership rules | Can be excluded from ownership rules explicitly |

**Why not a fine-grained PAT:** All API actions attribute to the maintainer's personal account. If the token leaks, it revokes against his account; rotation is manual. There is no way to exclude it from code-owner approvals without excluding the maintainer too. Fine-grained PATs are the right choice for personal one-off scripts; they are the wrong choice for a long-running autonomous agent.

**Why not a classic PAT:** Coarse scopes (e.g., `repo` = read+write on ALL repos), long-lived, no bot attribution. Strictly worse than fine-grained in every dimension. Do not use.

**GitHub App identity in practice:** When the app authenticates and makes a commit, the author/committer email is `<app-installation-user-id>+odd-contributor[bot]@users.noreply.github.com` and the GitHub UI renders the distinct `[bot]` badge. You can filter `git log` by that email, filter the org audit log by `actor:odd-contributor[bot]`, and build CODEOWNERS rules that never require the bot's approval on its own PRs. This is a clean operational separation the maintainer's account cannot provide.

**Setup:**

1. GitHub profile → Settings → Developer settings → GitHub Apps → New GitHub App
2. Name: `odd-contributor` (renders as `odd-contributor[bot]`)
3. Homepage URL: `https://github.com/opendatadiscovery/odd-team`
4. Under "Where can this GitHub App be installed?" → **Only on this account** (prevents public abuse)
5. Set permissions (see §2)
6. Generate a private key (.pem); store in a secret manager or encrypted env var — never commit
7. Install the app on the target repositories only (odd-platform, odd-collectors, documentation, odd-specification)

Source: https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app

---

## 2. Least-privilege permissions

These are the exact GitHub App repository permissions. Use **Read** or **Read and write** as specified; grant **No access** on everything else.

| Permission category | Level | Required for |
|---|---|---|
| **Issues** | Read and write | Read issues (`GET /repos/{owner}/{repo}/issues/{n}`); post comments (`POST /repos/{owner}/{repo}/issues/{n}/comments`) |
| **Pull requests** | Read and write | Create PR (`POST /repos/{owner}/{repo}/pulls`); request reviewer (`POST /repos/{owner}/{repo}/pulls/{n}/requested_reviewers`) |
| **Contents** | Read and write | Read file blob SHAs; create branch (`POST /repos/{owner}/{repo}/git/refs`); push/create/update files (`PUT /repos/{owner}/{repo}/contents/{path}`) |
| **Metadata** | Read (auto-required) | Required for any repo access; GitHub mandates it; grants only public repo metadata |

**Explicitly not granted (confirm these stay at No access):**

- Administration — would allow modifying branch protection rules, the exact thing we rely on for the merge gate
- Workflows — would allow editing `.github/workflows/*.yml`
- Secrets — obvious
- Members — no org membership changes
- Environments — no deployment targets
- Repository hooks — no webhook manipulation
- Pages, Packages, Actions — none needed

**For fine-grained PAT equivalent** (if the team ever chooses PAT fallback):
The same four categories apply: Issues (write), Pull requests (write), Contents (write), Metadata (read-only, implicit). Navigate: Settings → Developer settings → Fine-grained tokens → Generate new token → Repository access: select the target repo(s) only.

Source: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens

---

## 3. Enforcing the merge-gate in GitHub itself

The goal: even if the agent's token somehow calls `PUT /repos/{owner}/{repo}/pulls/{n}/merge`, the API returns 405 and the merge is rejected. Convention is not enough; the gate must be structural.

### Layer 1 — Draft PR status (primary gate)

GitHub enforces at the platform level: **draft pull requests cannot be merged.** The Merge button in the UI is disabled. The REST merge endpoint (`PUT /repos/{owner}/{repo}/pulls/{n}/merge`) returns HTTP 405 `"Pull Request is not mergeable"` while the PR is in draft state.

The agent ALWAYS opens PRs with `"draft": true`. Before a merge can happen, a human must explicitly click "Ready for review" or call `PATCH /repos/{owner}/{repo}/pulls/{n}` with `{"draft": false}` — an action that requires Collaborator write access and is audited.

Source: https://github.blog/changelog/2019-02-14-draft-pull-requests/
Source: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request

### Layer 2 — Branch protection on `main` (backup gate)

Configure branch protection on `main` (Settings → Branches → Add rule → Branch name pattern: `main`):

- **Require a pull request before merging** — no direct push to main
- **Require approvals: 1** — at least one human review required
- **Require review from Code Owners** — CODEOWNERS must approve (see Layer 3)
- **Do not allow bypassing the above settings** — disables admin bypass; this is the critical checkbox

With these rules, even if a human marks the draft ready, a merge still requires an approving human review. The agent's token has **Pull requests: write** but NOT administrator permission; it cannot modify branch protection rules and cannot bypass them.

Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

### Layer 3 — CODEOWNERS (belt + suspenders)

Add a `.github/CODEOWNERS` file to each target repo:

```
# All files require maintainer review
* @raman
```

With "Require review from Code Owners" enabled, every PR touching any file needs explicit approval from `@raman`. The agent's token cannot self-approve (GitHub prevents PR authors from approving their own PRs) and cannot approve as `@raman` (it is a different identity: `odd-contributor[bot]`).

CODEOWNERS also means: when the PR is marked ready for review, `@raman` receives an automatic review request notification — no manual pinging needed.

Source: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners

### Layer 4 — Rulesets (optional hardening, org-only)

For organization-owned repos, GitHub Rulesets provide an additional "bypass list" mechanism where specific GitHub Apps can be excluded from or included in merge rules. The agent app (`odd-contributor`) is NOT added to the bypass list, reinforcing that it cannot circumvent the required-review rule.

Source: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

---

## 4. API call reference (REST, curl shape)

All calls use:
```
Authorization: Bearer <INSTALLATION_ACCESS_TOKEN>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

### 4a. Comment on an issue

```bash
curl -L -X POST \
  https://api.github.com/repos/OWNER/REPO/issues/ISSUE_NUMBER/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"body": "Comment text here."}'
# → 201 Created
```

Source: https://docs.github.com/en/rest/issues/comments

### 4b. Create a branch from main's HEAD SHA

Step 1 — get the current SHA of main:
```bash
curl -L \
  https://api.github.com/repos/OWNER/REPO/git/ref/heads/main \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json"
# response: {"object": {"sha": "abc123..."}}
```

Step 2 — create the branch ref:
```bash
curl -L -X POST \
  https://api.github.com/repos/OWNER/REPO/git/refs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"ref": "refs/heads/bot/DOC-NNN-slug", "sha": "abc123..."}'
# → 201 Created
```

Source: https://docs.github.com/en/rest/git/refs

### 4c. Create or update a file (push a commit)

For a new file, omit `sha`. For an update, include the blob SHA of the file being replaced (fetch it first via `GET /repos/{owner}/{repo}/contents/{path}`):

```bash
# Encode content to base64 first
CONTENT=$(echo -n "file contents here" | base64)

curl -L -X PUT \
  https://api.github.com/repos/OWNER/REPO/contents/path/to/file.md \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d "{
    \"message\": \"docs(DOC-NNN): fix broken anchor on foo page\",
    \"content\": \"$CONTENT\",
    \"branch\": \"bot/DOC-NNN-slug\",
    \"sha\": \"<blob-sha-if-updating>\",
    \"committer\": {
      \"name\": \"odd-contributor[bot]\",
      \"email\": \"<app-installation-user-id>+odd-contributor[bot]@users.noreply.github.com\"
    }
  }"
# → 200 (update) or 201 (create)
```

Source: https://docs.github.com/en/rest/repos/contents

### 4d. Open a draft PR with issue link

```bash
curl -L -X POST \
  https://api.github.com/repos/OWNER/REPO/pulls \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{
    "title": "docs(DOC-NNN): fix broken anchor on foo page",
    "head": "bot/DOC-NNN-slug",
    "base": "main",
    "draft": true,
    "body": "Fixes the broken anchor reported in DOC-NNN.\n\nCloses #NNN\n\n---\n_Opened by odd-contributor[bot]. Human approval required before merge._"
  }'
# → 201 Created; draft=true means merge is blocked at GitHub level
```

**Issue linking:** Include `Closes #NNN` (or `Fixes #NNN`, `Resolves #NNN`) anywhere in the `body`. GitHub auto-links the PR to the issue. The issue closes automatically when the PR is merged into the default branch. If the PR targets a non-default branch, the keyword is ignored — always target `main` or document the manual close step.

Source: https://docs.github.com/en/rest/pulls/pulls
Source: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue

### 4e. Request a review

```bash
curl -L -X POST \
  https://api.github.com/repos/OWNER/REPO/pulls/PULL_NUMBER/requested_reviewers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"reviewers": ["raman"]}'
# → 201 Created; triggers GitHub notification to @raman
```

Source: https://docs.github.com/en/rest/pulls/review-requests

---

## 5. Execution path in this environment (no gh CLI)

Three options compared:

| Option | Mechanism | Token lives | Security trade-offs |
|---|---|---|---|
| **curl + env var (RECOMMENDED)** | Direct REST calls via bash `curl`; token injected from env var `$GITHUB_TOKEN` or `$GH_INSTALLATION_TOKEN` at runtime | Process environment; never on disk; never in script source | Token visible to any subprocess in the same shell session; mitigate by unsetting after use (`unset GITHUB_TOKEN`); rotation handled by 1-hour App token TTL |
| Install `gh` CLI | `gh pr create`, `gh issue comment` etc. | Same as curl — env var | `gh` is not installed; installation requires network + package manager; adds a binary dependency; no security benefit over curl |
| GitHub MCP server | `github-mcp-server` process; tools: `add_issue_comment`, `create_branch`, `create_or_update_file`, `create_pull_request`, `request_copilot_review` | PAT in `GITHUB_PERSONAL_ACCESS_TOKEN` env var or OAuth session | Adds a persistent process boundary; useful when calling from Claude Code tool invocations already in scope; PAT-based (loses bot-identity advantage unless App OAuth is configured); read-only mode available as a lockdown |

**Recommendation: curl + env var, with the GitHub App installation token.**

Rationale:
- `gh` CLI is explicitly documented as not installed in this environment; adding it is unnecessary complexity.
- The MCP server is valuable for Claude Code interactive sessions but requires PAT authentication (or OAuth which is VS Code/Claude Desktop flow — not the agent script context). It forfeits the `[bot]` identity unless GitHub App OAuth is configured. For the autonomous agent script, direct REST via curl is simpler, auditable, and already works.
- The GitHub App installation token is fetched fresh at the start of each agent run (1-hour TTL), then used for all curl calls in that run. If the run takes >60 min, re-fetch before the token expires.

**Token storage:**
- Private key (`.pem`) → stored in the odd-team repo as an encrypted secret (GitHub Actions secret or local `.env` file gitignored). NEVER committed.
- App ID → not secret; can be hardcoded in the agent script or stored as a non-secret env var.
- Installation access token → fetched at runtime, kept in-memory (env var), discarded after the run.

**Fetching the installation token (curl-only, no SDK):**

Step 1 — generate a JWT from the private key:

```bash
#!/usr/bin/env bash
# Usage: ./gen-jwt.sh <app-client-id> <path-to-private-key.pem>
client_id=$1
pem=$(cat "$2")

now=$(date +%s)
iat=$((now - 60))
exp=$((now + 600))

b64enc() { openssl base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'; }

header_json='{"typ":"JWT","alg":"RS256"}'
header=$(echo -n "${header_json}" | b64enc)

payload_json="{\"iat\":${iat},\"exp\":${exp},\"iss\":\"${client_id}\"}"
payload=$(echo -n "${payload_json}" | b64enc)

header_payload="${header}.${payload}"
signature=$(openssl dgst -sha256 -sign <(echo -n "${pem}") \
  <(echo -n "${header_payload}") | b64enc)

echo "${header_payload}.${signature}"
```

Step 2 — exchange JWT for installation token:

```bash
JWT=$(./gen-jwt.sh "$APP_CLIENT_ID" "$PRIVATE_KEY_PATH")

GH_INSTALLATION_TOKEN=$(curl -s -X POST \
  https://api.github.com/app/installations/$INSTALLATION_ID/access_tokens \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  | jq -r '.token')
```

Source: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app
Source: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation

---

## 6. Audit + kill-switch

### What the maintainer can see

| Surface | How to access | What it shows |
|---|---|---|
| **Bot activity feed** | `github.com/odd-contributor` (the bot's GitHub profile) | All issues commented, PRs opened, branches created — public activity log |
| **Org audit log** | Organization Settings → Security → Audit log; filter `actor:odd-contributor[bot]` | Every API action the app took, timestamped, with repo + event type; `actor_is_bot: true` field |
| **PR/issue timeline** | Any PR or issue the bot touched | All comments, branch creates, status changes appear inline with `[bot]` badge |
| **Installation activity** | GitHub App settings → Installations → the installed account | Shows last-used date; links to recent deliveries |

The org audit log retains 180 days. For long-term audit, enable audit log streaming (Enterprise Cloud only) or periodically export via the audit log REST API (`GET /orgs/{org}/audit-log`).

### Kill-switch (instant revocation)

**Fastest path:** GitHub App settings → Installations → the installed org/account → Uninstall. This immediately invalidates all existing installation tokens (1-hour tokens are not cached server-side; they expire on their own, but the app is no longer authorized to generate new ones). Any in-flight API call with the old token returns 401 after the uninstall.

**Softer path:** GitHub App settings → Private keys → Delete the active key. No new JWTs can be signed; no new installation tokens can be fetched. Existing 1-hour tokens remain valid until they expire — max exposure: 60 minutes.

**PAT equivalent path (if using fine-grained PAT fallback):** Settings → Developer settings → Fine-grained tokens → Delete. Effective immediately for all subsequent calls; in-flight requests with the old token fail immediately.

### Why draft-only reinforces audit

Every agent PR opens in draft state. The audit trail for any merge is:
1. Bot opens draft PR (audited under bot identity)
2. Human clicks "Ready for review" (audited under human identity)
3. Human approves (audited under human identity)
4. Human merges (audited under human identity)

Steps 2–4 are irreducibly human actions — no code path the agent can execute skips them. The audit log shows clean attribution throughout.

---

## 7. Fork vs branch-on-upstream

**Recommendation: branch directly on upstream (`opendatadiscovery/odd-platform`, etc.).**

### Trade-off table

| Dimension | Bot branch on upstream | Bot pushes to a fork, cross-repo PR |
|---|---|---|
| PR review UX | Native — reviewer sees diff inline, merges with one click | Reviewer must understand cross-repo context; "fork" label on PR; slightly more cognitive overhead |
| Branch protection enforcement | Branch protection on `main` applies immediately; agent's branch is inside the protected namespace | Branch protection on upstream `main` still applies to the merge target; the fork itself has separate permissions |
| CODEOWNERS | Works normally for the upstream repo | Works normally for the upstream repo (CODEOWNERS checks the merge target, not the source fork) |
| Token scope | App installed on upstream org; Contents write on the upstream repo | App needs write on the fork (or a separate fork-owner account); adds a second installation or a separate PAT |
| Secret surface | One private key + one installation token | Same, but the fork is another repository the token has access to |
| Branch lifecycle | Branches visible in the upstream repo's branch list; easy to manage, easy to delete after merge | Branch lives in the fork; must manage the fork's staleness and divergence from upstream |
| Discovery | `git fetch origin` gets all bot branches | Requires knowing the fork remote |
| Suitability | Internal-maintainer-run bot with write access → branch on upstream is cleaner | External contributors without write access → fork is correct model |

**Conclusion:** The contributor agent is an internal tool run by the maintainer using a GitHub App installed on the maintainer's own repositories. The external-contributor fork model exists to give write-less contributors a path to contribute — that is not this scenario. Branch directly on upstream. One installation, one token scope, no fork-sync debt, branch protection applies cleanly, and CODEOWNERS references work without any cross-repo resolution.

---

## Decisions this feeds into the ADR

1. **Identity: GitHub App named `odd-contributor`, scoped to "Only on this account"**, installed per-repo on the four ODD repositories. Actions attribute as `odd-contributor[bot]`, fully separable from the maintainer's identity in audit logs, CODEOWNERS rules, and git history. Fine-grained PAT is rejected as it conflates bot and human identity.

2. **Permissions: Issues (write) + Pull requests (write) + Contents (write) + Metadata (read)** — exactly four permission categories; everything else at No access, including Administration (cannot touch branch protection) and Workflows (cannot edit CI).

3. **Merge gate: structural, not conventional** — three enforced layers: (a) all PRs created with `"draft": true` (platform-level merge block); (b) `main` branch protection with required approval + "Do not allow bypassing"; (c) CODEOWNERS requiring `@raman` approval. The agent's token cannot unilaterally advance past any layer.

4. **Execution: curl + env var using the App installation token** — JWT generated from the private key (stored encrypted, never committed), exchanged for a 1-hour installation token at agent-run start, used for all REST calls in that run. No `gh` CLI dependency, no persistent process, no long-lived credential on disk.

5. **Topology: branch on upstream, not fork** — the agent pushes `bot/ITEM-slug` branches directly to the upstream org repos. Branch protection applies cleanly. Kill-switch is app uninstall (instant) or private key deletion (≤60 min exposure). Audit surface is the org audit log filtered by `actor:odd-contributor[bot]`.
