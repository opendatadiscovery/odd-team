#!/usr/bin/env bash
# Sign a GitHub App JWT (RS256) from the App private key. No jq, no SDK — openssl only.
# Usage: gen-jwt.sh <app_id_or_client_id> <path/to/private-key.pem>
# The first arg is the JWT issuer (`iss`): the App ID or the App's Client ID both work.
set -euo pipefail

iss="${1:?usage: gen-jwt.sh <app_id_or_client_id> <path-to-private-key.pem>}"
pem="${2:?usage: gen-jwt.sh <app_id_or_client_id> <path-to-private-key.pem>}"
[ -r "$pem" ] || { echo "gen-jwt: cannot read private key: $pem" >&2; exit 1; }

now=$(date +%s)
iat=$((now - 60))    # backdate 60s for clock skew
exp=$((now + 540))   # 9 min (GitHub max is 10)

# base64url, no padding/newlines
b64() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64)
payload=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$iat" "$exp" "$iss" | b64)
unsigned="${header}.${payload}"
signature=$(printf '%s' "$unsigned" | openssl dgst -sha256 -sign "$pem" | b64)

printf '%s.%s\n' "$unsigned" "$signature"
