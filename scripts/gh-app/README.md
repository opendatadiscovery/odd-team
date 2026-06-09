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
2. **Export the env** (e.g. in `~/.config/odd-contributor/env`, sourced when you run a contributor pass — never committed):
   ```bash
   export GH_APP_ID=<your-app-id-or-client-id>
   export GH_INSTALLATION_ID=<installation-id>
   export GH_APP_KEY_PATH=~/.config/odd-contributor/key.pem
   ```
3. **Verify:**
   ```bash
   scripts/gh-app/verify-app.sh
   ```
   Expect: token OK, permissions exactly `contents/issues/pull_requests=write, metadata=read`, contents + issues read OK.

## The merge gate (do this in each target repo)

The scripts can't enforce the merge gate — GitHub does. On `opendatadiscovery/odd-platform` (Settings → Branches → `main`): require a PR + 1 approval + **Require review from Code Owners** + **Do not allow bypassing**. Then add `CODEOWNERS.template`'s content as `.github/CODEOWNERS`. The bot's PRs are always `draft:true`; the merge endpoint returns **405** for it regardless.

## Security

- **Never commit the `.pem` or a token.** `*.pem` / `*.token` / `.env` are gitignored; keep the key outside the repo anyway.
- The token is **1-hour, in-memory**: `TOKEN=$(scripts/gh-app/gh-token.sh)` per run, `unset TOKEN` after. Don't echo it to logs.
- **Kill-switch:** uninstall the App (instant, all tokens dead) or delete the `.pem` (≤60-min window). Audit: org audit log filtered by `actor:odd-contributor[bot]`.
