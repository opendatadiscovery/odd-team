#!/usr/bin/env bash
# Mint a 1-hour GitHub App installation access token. No jq (python3 to parse).
# Prints the token to stdout — do NOT log it, commit it, or persist it; it expires in 1h.
#
# Required env:
#   GH_APP_ID          App ID or Client ID (the JWT issuer)
#   GH_INSTALLATION_ID the installation id (from the App's Install settings URL)
#   GH_APP_KEY_PATH    path to the .pem (MUST live outside this repo)
#
# Example:
#   export GH_APP_ID=123456 GH_INSTALLATION_ID=987654 GH_APP_KEY_PATH=~/.config/odd-contributor/key.pem
#   TOKEN=$(scripts/gh-app/gh-token.sh)
set -euo pipefail

# Auto-load machine-local config (App ID + Installation ID + key path) if the vars aren't already set.
# This file is NOT in the repo — the IDs stay off the public repo as defense-in-depth; the key never leaves it.
_cfg="${ODD_CONTRIBUTOR_ENV:-$HOME/.config/odd-contributor/env}"
[ -f "$_cfg" ] && . "$_cfg"

: "${GH_APP_ID:?set GH_APP_ID (App ID or Client ID) — or put it in ~/.config/odd-contributor/env}"
: "${GH_INSTALLATION_ID:?set GH_INSTALLATION_ID}"
: "${GH_APP_KEY_PATH:?set GH_APP_KEY_PATH (path to the .pem)}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
jwt="$("$here/gen-jwt.sh" "$GH_APP_ID" "$GH_APP_KEY_PATH")"

curl -fsS -X POST \
  "https://api.github.com/app/installations/${GH_INSTALLATION_ID}/access_tokens" \
  -H "Authorization: Bearer ${jwt}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
| python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])'
