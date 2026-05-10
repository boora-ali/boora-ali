#!/usr/bin/env sh
set -eu

PORT="${NGROK_PORT:-8080}"
DOMAIN="${NGROK_DOMAIN:-}"

if [ -n "$DOMAIN" ]; then
  exec ngrok http --domain "$DOMAIN" "$PORT"
fi

exec ngrok http "$PORT"
