# odd-contributor GitHub App — wiring

Runnable helpers for the `contributor` pillar's scoped-token GitHub write. The agent uses these (via `playbooks/github-write.md`) to mint a short-lived token; you use them to verify the install. No secrets live here — the `.pem` and the token stay **outside the repo**.

Registration + permissions + the merge-gate hardening: `adrs/drafts/research/contributor/GITHUB-MECHANICS.md`. Install checklist: ask `/contribute` or see the ADR.

## The three scripts

| Script | What it does |
|---|---|
| `gen-jwt.sh <app_id> <key.pem>` | Signs a GitHub App JWT (RS256, openssl). |
| `gh-token.sh` | Mints a **1-hour installation access token** (prints to stdout). |
| `verify-app.sh` | Smoke test: token mint + the granted permissions + contents/issues read. Writes nothing. |

## Setup (one time)

You have the **App ID** and the **`.pem`** already. You still need the **Installation ID** (App → Install settings; it's in the URL `…/installations/<ID>`).

1. **Store the key OUTSIDE this repo** (it's gitignored as `*.pem`, but keep it out anyway):
   ```bash
   mkdir -p ~/.config/odd-contributor && mv /path/to/your-key.pem ~/.config/odd-contributor/key.pem
   chmod 600 ~/.config/odd-contributor/key.pem
   ```
2. **Store the IDs once in `~/.config/odd-contributor/env`** — the scripts **auto-source** this (set it once, never re-export). It is **not** in the repo: the App ID + Installation ID are non-secret identifiers, but they stay off this public repo as defense-in-depth. If you ever lose them, they are recoverable from GitHub — the **App ID** is on the App's page (`…/settings/apps/odd-contributor`), the **Installation ID** is in the App's install-settings URL (`…/installations/<ID>`).
   ```bash
   cat > ~/.config/odd-contributor/env <<'EOF'
   export GH_APP_ID=<your-app-id>
   export GH_INSTALLATION_ID=<your-installation-id>
   export GH_APP_KEY_PATH="$HOME/.config/odd-contributor/key.pem"
   EOF
   chmod 600 ~/.config/odd-contributor/env
   ```
3. **Verify:**
   ```bash
   scripts/gh-app/verify-app.sh
   ```
   Expect: token OK, permissions exactly `contents/issues/pull_requests=write, metadata=read`, contents + issues read OK.

## The merge gate (do this in each target repo)

The scripts can't enforce the merge gate — GitHub does, via `main` branch protection: **require a PR before merging + require ≥1 approving review + do not allow bypassing**. That's the whole gate: the bot authors the PR, GitHub blocks authors from self-approving, so a human maintainer must approve before merge — and any maintainer can (no CODEOWNERS, no hardcoded owner). The bot also opens PRs as `draft` (a signal); the required approval is the enforcement. `odd-platform`'s `main` is already protected — just confirm **Require approvals: 1** is on.

## Security

- **Never commit the `.pem` or a token.** `*.pem` / `*.token` / `.env` are gitignored; keep the key outside the repo anyway.
- The token is **1-hour, in-memory**: `TOKEN=$(scripts/gh-app/gh-token.sh)` per run, `unset TOKEN` after. Don't echo it to logs.
- **Kill-switch:** uninstall the App (instant, all tokens dead) or delete the `.pem` (≤60-min window). Audit: org audit log filtered by `actor:odd-contributor[bot]`.
