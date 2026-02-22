#!/bin/sh
set -e

PLACEHOLDER_FULL="http://PLACEHOLDER_API_URL/api"
PLACEHOLDER_ORIGIN="http://placeholder_api_url"

RUNTIME_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}"
RUNTIME_ORIGIN=$(echo "$RUNTIME_URL" | sed 's|^\(https\?://[^/]*\).*|\1|')

echo "Family Vault: configuring API URL to $RUNTIME_URL"

find /app/.next -type f -name "*.js" | xargs -r sed -i \
    "s|${PLACEHOLDER_FULL}|${RUNTIME_URL}|g;s|${PLACEHOLDER_ORIGIN}|${RUNTIME_ORIGIN}|g"

exec node server.js
