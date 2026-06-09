#!/usr/bin/env bash
# Smoke-test the odd-contributor GitHub App wiring: token mint + granted permissions + read access.
# Does NOT write anything. Run after registering + installing the App (install steps: GITHUB-MECHANICS.md).
#
# Required env: GH_APP_ID, GH_INSTALLATION_ID, GH_APP_KEY_PATH
# Optional:     GH_TARGET_REPO  (default opendatadiscovery/odd-platform)
set -euo pipefail

# Auto-load machine-local config (~/.config/odd-contributor/env) if present — set the IDs there once, never re-export.
_cfg="${ODD_CONTRIBUTOR_ENV:-$HOME/.config/odd-contributor/env}"
[ -f "$_cfg" ] && . "$_cfg"

: "${GH_APP_ID:?set GH_APP_ID (or put it in ~/.config/odd-contributor/env)}"; : "${GH_INSTALLATION_ID:?set GH_INSTALLATION_ID}"; : "${GH_APP_KEY_PATH:?set GH_APP_KEY_PATH}"
repo="${GH_TARGET_REPO:-opendatadiscovery/odd-platform}"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 1. mint installation token =="
tok="$("$here/gh-token.sh")"
[ -n "$tok" ] && echo "   OK (1-hour token minted)" || { echo "   FAIL — check GH_APP_ID / GH_INSTALLATION_ID / key path"; exit 1; }

echo "== 2. granted permissions (must be EXACTLY contents/issues/pull_requests=write, metadata=read) =="
jwt="$("$here/gen-jwt.sh" "$GH_APP_ID" "$GH_APP_KEY_PATH")"
curl -fsS -H "Authorization: Bearer $jwt" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/app \
  | python3 -c '
import sys,json
p=json.load(sys.stdin).get("permissions",{})
want={"contents":"write","issues":"write","pull_requests":"write","metadata":"read"}
extra={k:v for k,v in p.items() if k not in want}
miss=[k for k,v in want.items() if p.get(k)!=v]
print("   granted:",p)
print("   OK" if not miss and not extra else "   WARN  missing/wrong:%s  over-scoped:%s"%(miss,list(extra)))
'

api() { curl -fsS -H "Authorization: Bearer $tok" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

echo "== 3. contents read ($repo) =="
api "https://api.github.com/repos/$repo" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("   OK",d["full_name"],"default_branch="+d["default_branch"])'

echo "== 4. issues read =="
api "https://api.github.com/repos/$repo/issues?per_page=1&state=all" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("   OK issues endpoint reachable; sample #:",(d[0]["number"] if d else "none"))'

echo ""
echo "Read + token checks passed. The merge gate (draft PR -> 405) is verified per-PR, not here:"
echo "  branch protection on main (require >=1 approval; the bot authors the PR and cannot self-approve) makes the merge irreducibly human."
echo "Never log or commit the token above; it expires in 1h. Kill-switch: uninstall the App or delete the .pem."
